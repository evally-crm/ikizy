-- IKIZY (Neon): bloqueios de horário (folga, férias, almoço extra) e intervalo entre atendimentos.
-- Pré-requisitos: 20261118100000_multi_service_booking.sql e 20261120000000_client_change_booking.sql
-- (esta migration reescreve get_booking_slots e get_reschedule_slots a partir delas).
--
--   * time_blocks: período em que ninguém (professional_id vazio) ou uma profissional não atende. Tira as vagas do site.
--     Quem trabalha na agenda ainda consegue marcar dentro de um bloqueio (a dona manda); o bloqueio aparece na agenda.
--   * salons.buffer_minutes: tempo de limpeza/descanso depois de cada atendimento (0 a 120 min). As vagas do site passam
--     a deixar esse intervalo antes e depois de cada atendimento já marcado.
--
-- Só acrescenta (tabela e coluna nova com padrão 0) e troca duas funções de vagas: o app antigo continua funcionando.
-- Seguro para rodar de novo. TESTAR ANTES NA BRANCH DEV DO NEON (npm run db:migrate:dev).

alter table public.salons
  add column if not exists buffer_minutes smallint not null default 0;
do $$ begin
  alter table public.salons add constraint salons_buffer_minutes_check check (buffer_minutes between 0 and 120);
exception when duplicate_object then null; end $$;
-- a dona e a gerente mudam o intervalo (a política salons_update já limita a quem é dono ou gerente)
grant update (buffer_minutes) on public.salons to authenticated;

create table if not exists public.time_blocks (
  id              uuid primary key default gen_random_uuid(),
  salon_id        uuid not null references public.salons(id) on delete cascade,
  -- vazio = vale para todas as profissionais
  professional_id uuid,
  starts_at       timestamptz not null,
  ends_at         timestamptz not null,
  reason          text not null default '' check (char_length(reason) <= 80),
  created_at      timestamptz not null default now(),
  check (ends_at > starts_at),
  check (ends_at - starts_at <= interval '366 days'),
  foreign key (professional_id, salon_id) references public.professionals (id, salon_id) on delete cascade
);
create index if not exists time_blocks_salon_idx on public.time_blocks (salon_id, ends_at);

alter table public.time_blocks enable row level security;

-- todos os membros veem (a agenda mostra); só dono e gerente criam, mudam e apagam
do $$ begin
  create policy time_blocks_select on public.time_blocks for select to authenticated using (public.is_member(salon_id));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy time_blocks_insert on public.time_blocks for insert to authenticated
    with check (public.has_role(salon_id, array['owner', 'manager']::public.member_role[]));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy time_blocks_update on public.time_blocks for update to authenticated
    using (public.has_role(salon_id, array['owner', 'manager']::public.member_role[]))
    with check (public.has_role(salon_id, array['owner', 'manager']::public.member_role[]));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy time_blocks_delete on public.time_blocks for delete to authenticated
    using (public.has_role(salon_id, array['owner', 'manager']::public.member_role[]));
exception when duplicate_object then null; end $$;

-- sem acesso (assinatura vencida) o sistema fica só para leitura
do $$ begin
  create policy time_blocks_billing_insert on public.time_blocks as restrictive for insert to authenticated
    with check (public.has_access(salon_id));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy time_blocks_billing_update on public.time_blocks as restrictive for update to authenticated
    using (public.has_access(salon_id)) with check (public.has_access(salon_id));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy time_blocks_billing_delete on public.time_blocks as restrictive for delete to authenticated
    using (public.has_access(salon_id));
exception when duplicate_object then null; end $$;

revoke all on public.time_blocks from anonymous, authenticated;
grant select, insert, update, delete on public.time_blocks to authenticated;

-- vagas do site (uma ou mais serviços) e vagas para remarcar, agora com bloqueios e intervalo
create or replace function public.get_booking_slots(
  p_slug text, p_services uuid[], p_date date, p_professional uuid default null
)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_tz     constant text := 'America/Sao_Paulo';
  v_now    timestamp := (now() at time zone 'America/Sao_Paulo');
  v_salon  uuid;
  v_ss     public.site_settings;
  v_n      integer := coalesce(cardinality(p_services), 0);
  v_found  integer;
  v_dur    integer;
  v_buf    integer;
  v_result jsonb;
begin
  if v_n < 1 or v_n > 4 or (select count(distinct x) from unnest(p_services) x) <> v_n then
    return '[]'::jsonb;
  end if;

  select s.id into v_salon from public.salons s where s.slug = lower(p_slug);
  if v_salon is null then return '[]'::jsonb; end if;

  select * into v_ss from public.site_settings where salon_id = v_salon;
  if not found or not v_ss.published or not v_ss.online_booking or not public.has_access(v_salon) then
    return '[]'::jsonb;
  end if;

  select count(*), sum(sv.duration) into v_found, v_dur from public.services sv
  where sv.id = any(p_services) and sv.salon_id = v_salon and sv.visible;
  if v_found <> v_n or v_dur is null or v_dur > 600 then return '[]'::jsonb; end if;

  if p_date < v_now::date or p_date > v_now::date + v_ss.booking_window_days then
    return '[]'::jsonb;
  end if;

  select coalesce(s.buffer_minutes, 0) into v_buf from public.salons s where s.id = v_salon;

  select coalesce(jsonb_agg(
           jsonb_build_object('professional_id', x.pid, 'professional', x.pname, 'minute', x.m)
           order by x.m, x.pname), '[]'::jsonb)
    into v_result
  from (
    select distinct p.id as pid, p.name as pname, g.m
    from public.professionals p
    join public.working_hours wh
      on wh.professional_id = p.id and wh.salon_id = v_salon
     and wh.weekday = extract(dow from p_date)::int
    cross join lateral generate_series(wh.start_minute::int, wh.end_minute::int - v_dur, 30) as g(m)
    where p.salon_id = v_salon and p.active
      and (p_professional is null or p.id = p_professional)
      -- faz todos os serviços da lista (serviço sem lista de quem faz = todas fazem)
      and not exists (
        select 1 from unnest(p_services) sid
        where exists (select 1 from public.professional_services ps where ps.service_id = sid)
          and not exists (select 1 from public.professional_services ps where ps.service_id = sid and ps.professional_id = p.id)
      )
      and (p_date::timestamp + make_interval(mins => g.m)) >= v_now + make_interval(hours => v_ss.booking_notice_hours)
      and not exists (
        select 1 from public.appointments a
        where a.professional_id = p.id
          and a.status in ('pendente', 'confirmado', 'atendimento')
          and a.starts_at < ((p_date::timestamp + make_interval(mins => g.m + v_dur + v_buf)) at time zone v_tz)
          and a.starts_at + make_interval(mins => a.duration + v_buf) > ((p_date::timestamp + make_interval(mins => g.m)) at time zone v_tz)
      )
      -- folgas, férias e bloqueios (da profissional ou de todas)
      and not exists (
        select 1 from public.time_blocks b
        where b.salon_id = v_salon
          and (b.professional_id is null or b.professional_id = p.id)
          and b.starts_at < ((p_date::timestamp + make_interval(mins => g.m + v_dur)) at time zone v_tz)
          and b.ends_at > ((p_date::timestamp + make_interval(mins => g.m)) at time zone v_tz)
      )
  ) x;

  return v_result;
end;
$$;

create or replace function public.get_reschedule_slots(p_token text, p_date date)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_tz     constant text := 'America/Sao_Paulo';
  v_now    timestamp := (now() at time zone 'America/Sao_Paulo');
  v_salon  uuid;
  v_pro    uuid;
  v_first  timestamptz;
  v_dur    integer;
  v_ss     public.site_settings;
  v_buf    integer;
  v_result jsonb;
begin
  if p_token is null or p_token !~ '^[a-f0-9]{64}$' or p_date is null then return '[]'::jsonb; end if;

  select a.salon_id, min(a.starts_at), sum(a.duration), (array_agg(a.professional_id order by a.starts_at, a.id))[1]
    into v_salon, v_first, v_dur, v_pro
  from public.appointments a
  where a.public_token = p_token and a.status in ('pendente', 'confirmado')
  group by a.salon_id;
  if v_salon is null or v_pro is null or v_first <= now() + interval '2 hours' then return '[]'::jsonb; end if;

  select * into v_ss from public.site_settings where salon_id = v_salon;
  if not found or not public.has_access(v_salon) then return '[]'::jsonb; end if;
  if p_date < v_now::date or p_date > v_now::date + v_ss.booking_window_days then return '[]'::jsonb; end if;

  select coalesce(s.buffer_minutes, 0) into v_buf from public.salons s where s.id = v_salon;

  select coalesce(jsonb_agg(
           jsonb_build_object('professional_id', x.pid, 'professional', x.pname, 'minute', x.m)
           order by x.m), '[]'::jsonb)
    into v_result
  from (
    select distinct p.id as pid, p.name as pname, g.m
    from public.professionals p
    join public.working_hours wh
      on wh.professional_id = p.id and wh.salon_id = v_salon
     and wh.weekday = extract(dow from p_date)::int
    cross join lateral generate_series(wh.start_minute::int, wh.end_minute::int - v_dur, 30) as g(m)
    where p.id = v_pro and p.active
      and (p_date::timestamp + make_interval(mins => g.m)) >= v_now + make_interval(hours => v_ss.booking_notice_hours)
      and not exists (
        select 1 from public.appointments a
        where a.professional_id = p.id
          and a.public_token <> p_token
          and a.status in ('pendente', 'confirmado', 'atendimento')
          and a.starts_at < ((p_date::timestamp + make_interval(mins => g.m + v_dur + v_buf)) at time zone v_tz)
          and a.starts_at + make_interval(mins => a.duration + v_buf) > ((p_date::timestamp + make_interval(mins => g.m)) at time zone v_tz)
      )
      -- folgas, férias e bloqueios (da profissional ou de todas)
      and not exists (
        select 1 from public.time_blocks b
        where b.salon_id = v_salon
          and (b.professional_id is null or b.professional_id = p.id)
          and b.starts_at < ((p_date::timestamp + make_interval(mins => g.m + v_dur)) at time zone v_tz)
          and b.ends_at > ((p_date::timestamp + make_interval(mins => g.m)) at time zone v_tz)
      )
  ) x;

  return v_result;
end;
$$;

-- só o servidor chama (como antes)
revoke all on function public.get_booking_slots(text, uuid[], date, uuid) from public, anonymous, authenticated;
revoke all on function public.get_reschedule_slots(text, date) from public, anonymous, authenticated;

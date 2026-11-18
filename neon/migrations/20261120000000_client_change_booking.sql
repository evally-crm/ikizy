-- IKIZY (Neon): a cliente remarca ou cancela pelo link do pedido.
--
--   * Só até 2 horas antes do primeiro horário do pedido; depois disso a página manda falar com o salão.
--   * Remarcar: a cliente escolhe um novo horário livre da MESMA profissional; os serviços do pedido seguem em
--     sequência, e o pedido volta a "pendente" para o salão confirmar de novo (o horário antigo é liberado).
--   * Cancelar: os atendimentos em aberto do pedido ficam "cancelado" (a vaga volta a ficar livre).
--   * appointments.client_change / client_change_at: marcam que a mudança veio da cliente, para o sininho do app avisar.
--   * get_booking_status() passa a devolver can_change (ainda dá para mudar?) e window_days (até quantos dias à frente).
--
-- Seguro para rodar de novo. TESTAR ANTES NA BRANCH DEV DO NEON (npm run db:migrate:dev).

alter table public.appointments add column if not exists client_change text check (client_change in ('remarcado', 'cancelado'));
alter table public.appointments add column if not exists client_change_at timestamptz;
create index if not exists appointments_client_change_idx on public.appointments (salon_id, client_change_at desc)
  where client_change is not null;

-- ---------------------------------------------------------------- horários livres para remarcar
-- como get_booking_slots(), mas para o pedido que já existe: mesma profissional, soma das durações,
-- e os atendimentos do próprio pedido não contam como ocupados. [{professional_id, professional, minute}]
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
          and a.starts_at < ((p_date::timestamp + make_interval(mins => g.m + v_dur)) at time zone v_tz)
          and a.starts_at + make_interval(mins => a.duration) > ((p_date::timestamp + make_interval(mins => g.m)) at time zone v_tz)
      )
  ) x;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------- remarcar
-- erros com mensagem fixa: not_found, not_allowed (passou do prazo ou o pedido não está em aberto),
-- slot_unavailable, invalid_input. Devolve {starts_at, status}
create or replace function public.reschedule_booking(p_token text, p_date date, p_minute integer)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_tz     constant text := 'America/Sao_Paulo';
  v_salon  uuid;
  v_first  timestamptz;
  v_ids    uuid[];
  v_start  timestamptz;
  v_at     timestamptz;
  v_dur    integer;
  i        integer;
begin
  if p_token is null or p_token !~ '^[a-f0-9]{64}$' or p_date is null or p_minute is null or p_minute not between 0 and 1439 then
    raise exception 'invalid_input' using errcode = 'P0001';
  end if;

  select a.salon_id, min(a.starts_at), array_agg(a.id order by a.starts_at, a.id)
    into v_salon, v_first, v_ids
  from public.appointments a
  where a.public_token = p_token and a.status in ('pendente', 'confirmado')
  group by a.salon_id;
  if v_salon is null then
    if exists (select 1 from public.appointments a where a.public_token = p_token) then
      raise exception 'not_allowed' using errcode = 'P0001';
    end if;
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if v_first <= now() + interval '2 hours' or not public.has_access(v_salon) then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;

  -- trava por salão: dois pedidos ao mesmo tempo passam um de cada vez
  perform pg_advisory_xact_lock(hashtextextended(v_salon::text, 0));

  if not exists (
    select 1 from jsonb_array_elements(public.get_reschedule_slots(p_token, p_date)) e where (e ->> 'minute')::int = p_minute
  ) then
    raise exception 'slot_unavailable' using errcode = 'P0001';
  end if;

  v_start := (p_date::timestamp + make_interval(mins => p_minute)) at time zone v_tz;
  v_at := v_start;

  begin
    -- libera os horários antigos primeiro: sem isso o serviço 1 no horário novo bateria no serviço 2 no horário antigo
    update public.appointments set status = 'cancelado' where id = any (v_ids);
    for i in 1 .. cardinality(v_ids) loop
      select a.duration into v_dur from public.appointments a where a.id = v_ids[i];
      update public.appointments
         set starts_at = v_at, status = 'pendente', client_change = 'remarcado', client_change_at = now()
       where id = v_ids[i];
      v_at := v_at + make_interval(mins => v_dur);
    end loop;
  exception
    when exclusion_violation then
      raise exception 'slot_unavailable' using errcode = 'P0001';
    when check_violation then
      raise exception 'not_allowed' using errcode = 'P0001';
  end;

  return jsonb_build_object('starts_at', v_start, 'status', 'pendente');
end;
$$;

-- ---------------------------------------------------------------- cancelar
create or replace function public.cancel_booking(p_token text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_salon uuid;
  v_first timestamptz;
begin
  if p_token is null or p_token !~ '^[a-f0-9]{64}$' then raise exception 'not_found' using errcode = 'P0001'; end if;

  select a.salon_id, min(a.starts_at) into v_salon, v_first
  from public.appointments a
  where a.public_token = p_token and a.status in ('pendente', 'confirmado')
  group by a.salon_id;
  if v_salon is null then
    if exists (select 1 from public.appointments a where a.public_token = p_token) then
      raise exception 'not_allowed' using errcode = 'P0001';
    end if;
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if v_first <= now() + interval '2 hours' then raise exception 'not_allowed' using errcode = 'P0001'; end if;

  update public.appointments
     set status = 'cancelado', client_change = 'cancelado', client_change_at = now()
   where public_token = p_token and status in ('pendente', 'confirmado');

  return jsonb_build_object('status', 'cancelado');
end;
$$;

-- ---------------------------------------------------------------- página da cliente: pode mudar? até quantos dias à frente?
create or replace function public.get_booking_status(p_token text)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_salon  uuid;
  v_items  jsonb;
  v_state  text;
  v_can    boolean;
  v_review jsonb;
begin
  if p_token is null or p_token !~ '^[a-f0-9]{64}$' then return null; end if;

  select a.salon_id into v_salon from public.appointments a where a.public_token = p_token limit 1;
  if v_salon is null then return null; end if;

  select jsonb_agg(jsonb_build_object(
           'service', a.service_name, 'starts_at', a.starts_at, 'duration', a.duration,
           'professional', p.name, 'status', a.status) order by a.starts_at),
         case
           when bool_and(a.status = 'cancelado') then 'cancelado'
           when bool_or(a.status = 'pendente') then 'pendente'
           when bool_and(a.status in ('concluido', 'cancelado')) and bool_or(a.status = 'concluido') then 'concluido'
           when bool_and(a.status in ('faltou', 'cancelado')) then 'faltou'
           else 'confirmado'
         end,
         coalesce(min(a.starts_at) filter (where a.status in ('pendente', 'confirmado')) > now() + interval '2 hours', false)
    into v_items, v_state, v_can
  from public.appointments a
  left join public.professionals p on p.id = a.professional_id
  where a.public_token = p_token;

  select jsonb_build_object('rating', r.rating, 'comment', r.comment, 'created_at', r.created_at)
    into v_review
  from public.reviews r where r.public_token = p_token;

  return jsonb_build_object(
    'salon', (select jsonb_build_object('name', s.name, 'slug', s.slug, 'whatsapp', coalesce(ss.whatsapp, ''))
              from public.salons s left join public.site_settings ss on ss.salon_id = s.id where s.id = v_salon),
    'client', (select split_part(btrim(c.name), ' ', 1) from public.appointments a join public.clients c on c.id = a.client_id
               where a.public_token = p_token limit 1),
    'status', v_state,
    'items', v_items,
    'review', v_review,
    'can_change', v_can and public.has_access(v_salon),
    'window_days', coalesce((select ss.booking_window_days from public.site_settings ss where ss.salon_id = v_salon), 30)
  );
end;
$$;

revoke all on function public.get_reschedule_slots(text, date) from public, anonymous, authenticated;
revoke all on function public.reschedule_booking(text, date, integer) from public, anonymous, authenticated;
revoke all on function public.cancel_booking(text) from public, anonymous, authenticated;
revoke all on function public.get_booking_status(text) from public, anonymous, authenticated;

insert into public.schema_migrations (version) values ('20261120000000_client_change_booking') on conflict (version) do nothing;

notify pgrst, 'reload schema';

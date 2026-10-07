-- IKIZY (Neon): horário de atendimento por profissional.
-- Base do agendamento online: o cliente só enxerga horários dentro do expediente e sem conflito.
-- Cada linha é um intervalo contínuo de um dia da semana (0 = domingo ... 6 = sábado), em minutos desde 00:00.
-- Pausa de almoço = dois intervalos no mesmo dia (ex.: 09:00-12:00 e 13:00-18:00).
-- Profissional sem nenhuma linha = horário ainda não configurado (a agenda interna usa a grade padrão e o
-- site público não oferece agendamento online até que isso seja definido).

-- permite referenciar (id, salon_id) e garantir que o horário é do mesmo salão da profissional
alter table public.professionals add constraint professionals_id_salon_key unique (id, salon_id);

create table public.working_hours (
  id              uuid primary key default gen_random_uuid(),
  salon_id        uuid not null references public.salons(id) on delete cascade,
  professional_id uuid not null,
  weekday         smallint not null check (weekday between 0 and 6),
  start_minute    smallint not null check (start_minute between 0 and 1439),
  end_minute      smallint not null check (end_minute between 1 and 1440),
  created_at      timestamptz not null default now(),
  check (end_minute > start_minute),
  foreign key (professional_id, salon_id) references public.professionals (id, salon_id) on delete cascade
);
create index working_hours_professional_idx on public.working_hours (professional_id, weekday, start_minute);
create index working_hours_salon_idx on public.working_hours (salon_id);

alter table public.working_hours enable row level security;

create policy working_hours_select on public.working_hours for select to authenticated
  using (public.is_member(salon_id));
create policy working_hours_insert on public.working_hours for insert to authenticated
  with check (public.is_member(salon_id));
create policy working_hours_update on public.working_hours for update to authenticated
  using (public.is_member(salon_id)) with check (public.is_member(salon_id));
create policy working_hours_delete on public.working_hours for delete to authenticated
  using (public.is_member(salon_id));

-- sem acesso ativo (fim do teste/assinatura) o sistema fica em modo leitura, como nas demais tabelas
create policy working_hours_billing_insert on public.working_hours as restrictive for insert to authenticated
  with check (public.has_access(salon_id));
create policy working_hours_billing_update on public.working_hours as restrictive for update to authenticated
  using (public.has_access(salon_id)) with check (public.has_access(salon_id));
create policy working_hours_billing_delete on public.working_hours as restrictive for delete to authenticated
  using (public.has_access(salon_id));

revoke all on public.working_hours from anonymous, authenticated;
grant select, insert, update, delete on public.working_hours to authenticated;

-- troca todos os horários de uma profissional de uma vez (apaga e grava na mesma transação).
-- Roda com as permissões de quem chama, então a RLS continua valendo.
-- p_intervals: [{"weekday":1,"start_minute":540,"end_minute":720}, ...]
create or replace function public.set_working_hours(p_professional uuid, p_intervals jsonb)
returns void
language plpgsql set search_path = ''
as $$
declare
  v_salon uuid;
begin
  select salon_id into v_salon from public.professionals where id = p_professional;
  if v_salon is null then
    raise exception 'profissional não encontrada' using errcode = '42501';
  end if;

  delete from public.working_hours where professional_id = p_professional;

  insert into public.working_hours (salon_id, professional_id, weekday, start_minute, end_minute)
  select v_salon, p_professional, x.weekday, x.start_minute, x.end_minute
  from jsonb_to_recordset(coalesce(p_intervals, '[]'::jsonb))
    as x(weekday smallint, start_minute smallint, end_minute smallint);

  if exists (
    select 1
    from public.working_hours a
    join public.working_hours b
      on b.professional_id = a.professional_id and b.weekday = a.weekday and b.id > a.id
     and a.start_minute < b.end_minute and b.start_minute < a.end_minute
    where a.professional_id = p_professional
  ) then
    raise exception 'os intervalos de um mesmo dia não podem se sobrepor' using errcode = '23514';
  end if;
end;
$$;

revoke all on function public.set_working_hours(uuid, jsonb) from public, anonymous, authenticated;
grant execute on function public.set_working_hours(uuid, jsonb) to authenticated;

-- avisa a Data API para enxergar a tabela e a função novas
notify pgrst, 'reload schema';

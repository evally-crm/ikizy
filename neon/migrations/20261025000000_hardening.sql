-- IKIZY (Neon): endurecimento de regras de dinheiro e de segurança antes de vender (docs/ESPECIFICACAO-PRODUCAO.md).
--
--   1. fuso horário: a trava de "mês fechado" olhava o mês em UTC; um atendimento de 31/out às 22h (horário de
--      Brasília) caía em novembro e escapava da trava (R-13, R-56)
--   2. close_month(): confere assinatura ativa, recusa mês futuro e confere os números enviados pelo navegador
--      (faturamento, atendimentos e saídas) com o que está no banco, em vez de gravar qualquer retrato (R-85, R-88)
--   3. atendimento concluído exige forma de pagamento e não pode ser apagado (R-52, R-58)
--   4. atendimento só aponta para cliente, profissional e serviço do próprio negócio (isolamento entre negócios)
--   5. limite de tentativas no servidor, guardado no banco (vale entre instâncias; R-65)
--   6. WhatsApp único por negócio (R-71), criado só se não houver repetidos hoje
--
-- Seguro para rodar de novo. TESTAR ANTES NUMA BRANCH DO NEON (o localhost usa o banco de produção).
-- Rodar dentro de begin ... commit (o script db:migrate já faz isso).

-- ---------------------------------------------------------------- 1. mês fechado no fuso do negócio
create or replace function public.guard_closed_month()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_tz    constant text := 'America/Sao_Paulo';
  v_salon uuid := coalesce(new.salon_id, old.salon_id);
  v_dates timestamptz[] := array[]::timestamptz[];
begin
  if tg_op in ('UPDATE', 'DELETE') then v_dates := v_dates || old.starts_at; end if;
  if tg_op in ('INSERT', 'UPDATE') then v_dates := v_dates || new.starts_at; end if;
  if exists (
    select 1 from public.month_closings c
    where c.salon_id = v_salon
      and c.month = any (select date_trunc('month', d at time zone v_tz)::date from unnest(v_dates) d)
  ) then
    raise exception 'o mês deste atendimento já está fechado' using errcode = '23514';
  end if;
  return coalesce(new, old);
end;
$$;

-- ---------------------------------------------------------------- 2. fechamento conferido pelo banco
create or replace function public.close_month(p_salon uuid, p_month date, p_snapshot jsonb)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_tz       constant text := 'America/Sao_Paulo';
  v_month    date := date_trunc('month', p_month)::date;
  v_next     date := (date_trunc('month', p_month) + interval '1 month')::date;
  v_from     timestamptz := v_month::timestamp at time zone v_tz;
  v_to       timestamptz := v_next::timestamp at time zone v_tz;
  v_gross    numeric;
  v_count    integer;
  v_expenses numeric;
  v_id       uuid;
begin
  if not public.has_role(p_salon, array['owner', 'manager']::public.member_role[]) then
    raise exception 'sem permissão para fechar o mês' using errcode = '42501';
  end if;
  if not public.has_access(p_salon) then
    raise exception 'sem acesso ativo: renove a assinatura para fechar o mês' using errcode = '42501';
  end if;
  if v_month > date_trunc('month', now() at time zone v_tz)::date then
    raise exception 'o mês ainda não começou' using errcode = '22023';
  end if;
  if p_snapshot is null or jsonb_typeof(p_snapshot) <> 'object'
     or jsonb_typeof(p_snapshot -> 'gross') <> 'number'
     or jsonb_typeof(p_snapshot -> 'appointments') <> 'number'
     or jsonb_typeof(p_snapshot -> 'expenses') <> 'number' then
    raise exception 'snapshot_invalid' using errcode = 'P0001';
  end if;

  select coalesce(sum(a.price), 0), count(*) into v_gross, v_count
  from public.appointments a
  where a.salon_id = p_salon and a.status = 'concluido' and a.starts_at >= v_from and a.starts_at < v_to;

  select coalesce(sum(e.amount), 0) into v_expenses
  from public.expenses e
  where e.salon_id = p_salon and e.spent_on >= v_month and e.spent_on < v_next;

  -- os números da tela mudaram desde que ela abriu (outra aba, outra pessoa da equipe): não grava um retrato velho
  if abs((p_snapshot ->> 'gross')::numeric - v_gross) > 0.005
     or (p_snapshot ->> 'appointments')::numeric <> v_count
     or abs((p_snapshot ->> 'expenses')::numeric - v_expenses) > 0.005 then
    raise exception 'snapshot_stale' using errcode = 'P0001';
  end if;

  insert into public.month_closings (salon_id, month, closed_by, snapshot)
  values (p_salon, v_month, (select auth.uid()), p_snapshot)
  returning id into v_id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------- 3 e 4. atendimentos
create or replace function public.appointments_integrity()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  -- cliente, profissional e serviço têm que ser do mesmo negócio do atendimento
  if not exists (select 1 from public.clients c where c.id = new.client_id and c.salon_id = new.salon_id)
     or not exists (select 1 from public.professionals p where p.id = new.professional_id and p.salon_id = new.salon_id)
     or (new.service_id is not null
         and not exists (select 1 from public.services s where s.id = new.service_id and s.salon_id = new.salon_id)) then
    raise exception 'reference_other_salon' using errcode = '23503';
  end if;

  -- concluir pede a forma de pagamento (R-52); atendimentos antigos sem forma continuam como estão
  if new.status = 'concluido' and new.payment_method is null
     and (tg_op = 'INSERT' or old.status is distinct from 'concluido') then
    raise exception 'payment_required' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists appointments_integrity on public.appointments;
create trigger appointments_integrity
  before insert or update on public.appointments
  for each row execute function public.appointments_integrity();

create or replace function public.appointments_keep_settled()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  -- apagar o negócio inteiro continua possível (a exclusão em cascata chega aqui sem o negócio)
  if old.status = 'concluido' and exists (select 1 from public.salons s where s.id = old.salon_id) then
    raise exception 'settled_appointment' using errcode = 'P0001';
  end if;
  return old;
end;
$$;

drop trigger if exists appointments_keep_settled on public.appointments;
create trigger appointments_keep_settled
  before delete on public.appointments
  for each row execute function public.appointments_keep_settled();

-- ---------------------------------------------------------------- 5. limite de tentativas no banco
create table if not exists public.rate_limits (
  bucket  text not null check (char_length(bucket) between 1 and 160),
  hit_at  timestamptz not null default now()
);
create index if not exists rate_limits_bucket_idx on public.rate_limits (bucket, hit_at);
alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anonymous, authenticated;

-- registra uma tentativa e diz se passou do limite (true = bloquear); só o servidor chama
create or replace function public.hit_rate_limit(p_bucket text, p_max integer, p_window_seconds integer)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  v_count integer;
begin
  if p_bucket is null or char_length(p_bucket) not between 1 and 160 or p_max < 1 or p_window_seconds < 1 then
    raise exception 'invalid_input' using errcode = 'P0001';
  end if;
  insert into public.rate_limits (bucket) values (p_bucket);
  select count(*) into v_count from public.rate_limits
  where bucket = p_bucket and hit_at > now() - make_interval(secs => p_window_seconds);
  -- limpeza barata: de vez em quando apaga o que tem mais de um dia
  if random() < 0.01 then
    delete from public.rate_limits where hit_at < now() - interval '1 day';
  end if;
  return v_count > p_max;
end;
$$;
revoke all on function public.hit_rate_limit(text, integer, integer) from public, anonymous, authenticated;

-- ---------------------------------------------------------------- 6. WhatsApp único por negócio
do $$
begin
  if exists (
    select 1 from public.clients
    where regexp_replace(phone, '\D', '', 'g') <> ''
    group by salon_id, regexp_replace(phone, '\D', '', 'g')
    having count(*) > 1
  ) then
    raise notice 'clients: há clientes com o mesmo WhatsApp no mesmo negócio; junte-as e rode esta migration de novo para criar o índice único';
  else
    create unique index if not exists clients_salon_phone_unique
      on public.clients (salon_id, (regexp_replace(phone, '\D', '', 'g')))
      where regexp_replace(phone, '\D', '', 'g') <> '';
  end if;
end $$;

insert into public.schema_migrations (version) values ('20261025000000_hardening') on conflict (version) do nothing;

notify pgrst, 'reload schema';

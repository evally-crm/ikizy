-- IKIZY (Neon): cobrança com Stripe.
-- Cada salão tem UMA linha em subscriptions. Quem decide o acesso é access_until:
--   * teste do plano Solo: 30 dias sem cartão (access_until = trial_ends_at)
--   * cartão: assinatura mensal; o webhook do Stripe move access_until para o fim do período + tolerância
--   * Pix: pré-pago de 1, 3 ou 12 meses; o webhook soma os meses ao acesso restante
-- O navegador só LÊ esta tabela. Quem escreve é o servidor (webhook do Stripe), com a conexão de dono do banco.
-- Depois do fim do acesso o sistema fica em modo leitura: políticas restritivas bloqueiam insert/update/delete.

create type public.billing_plan as enum ('solo', 'studio', 'salao');
create type public.billing_status as enum ('trialing', 'active', 'past_due', 'canceled');

create table public.subscriptions (
  salon_id               uuid primary key references public.salons(id) on delete cascade,
  plan                   public.billing_plan not null default 'solo',
  status                 public.billing_status not null default 'trialing',
  trial_ends_at          timestamptz,
  access_until           timestamptz not null,
  billing_method         text check (billing_method in ('card', 'pix')),
  stripe_customer_id     text unique,
  stripe_subscription_id text unique,
  cancel_at_period_end   boolean not null default false,
  last_event_at          timestamptz,
  updated_at             timestamptz not null default now()
);

-- eventos do Stripe já tratados (idempotência: o Stripe reenvia eventos)
create table public.stripe_events (
  id          text primary key,
  type        text not null,
  received_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;
alter table public.stripe_events enable row level security;

create policy subscriptions_select on public.subscriptions for select to authenticated
  using (public.is_member(salon_id));

revoke all on public.subscriptions, public.stripe_events from anonymous, authenticated;
grant select on public.subscriptions to authenticated;

-- o salão tem acesso de escrita enquanto access_until estiver no futuro
create or replace function public.has_access(p_salon uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((select s.access_until > now() from public.subscriptions s where s.salon_id = p_salon), false);
$$;
revoke all on function public.has_access(uuid) from public, anonymous;
grant execute on function public.has_access(uuid) to authenticated;

-- novo salão já nasce com 30 dias de teste do Solo
create or replace function public.create_salon(p_name text, p_slug text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_user  uuid := (select auth.uid());
  v_salon uuid;
begin
  if v_user is null then
    raise exception 'não autenticado' using errcode = '28000';
  end if;
  if exists (select 1 from public.members where user_id = v_user) then
    raise exception 'este usuário já pertence a um salão' using errcode = '23505';
  end if;

  insert into public.salons (name, slug) values (trim(p_name), lower(trim(p_slug)))
  returning id into v_salon;
  insert into public.members (salon_id, user_id, role) values (v_salon, v_user, 'owner');
  insert into public.site_settings (salon_id) values (v_salon);
  insert into public.subscriptions (salon_id, plan, status, trial_ends_at, access_until)
  values (v_salon, 'solo', 'trialing', now() + interval '30 days', now() + interval '30 days');
  return v_salon;
end;
$$;

-- salões que já existem ganham 30 dias de teste a partir de agora
insert into public.subscriptions (salon_id, plan, status, trial_ends_at, access_until)
select id, 'solo', 'trialing', now() + interval '30 days', now() + interval '30 days'
from public.salons
on conflict (salon_id) do nothing;

-- modo leitura: sem acesso, ninguém grava nas tabelas operacionais (as políticas restritivas somam com as existentes)
do $$
declare t text;
begin
  foreach t in array array['professionals', 'clients', 'products', 'services', 'appointments', 'site_settings'] loop
    execute format('create policy %I on public.%I as restrictive for insert to authenticated with check (public.has_access(salon_id))', t || '_billing_insert', t);
    execute format('create policy %I on public.%I as restrictive for update to authenticated using (public.has_access(salon_id)) with check (public.has_access(salon_id))', t || '_billing_update', t);
    execute format('create policy %I on public.%I as restrictive for delete to authenticated using (public.has_access(salon_id))', t || '_billing_delete', t);
  end loop;
end $$;

-- IKIZY (Neon): limites por plano, teste grátis em todos os planos e cortesia.
--
-- Limite de profissionais ativas (mesmos números de PLANS.maxProfessionals em apps/app/src/lib/plans.ts):
--   solo 1 · studio até 4 · salao sem limite
-- Teste: todo plano tem 30 dias grátis. O salão nasce no plano que escolheu no cadastro e pode trocar
-- de plano durante o teste, sem pagar, enquanto ainda não assinou (set_trial_plan).
-- Cortesia: acesso liberado de graça para quem testa o sistema a convite (beta). Só quem administra o
-- banco concede ou encerra (grant_courtesy / end_courtesy); o navegador não consegue chamar essas funções.

alter table public.subscriptions
  add column courtesy      boolean not null default false,
  add column courtesy_note text;

-- ---------------------------------------------------------------- limite de profissionais

create or replace function public.plan_professional_limit(p_plan public.billing_plan)
returns int
language sql immutable set search_path = ''
as $$
  select case p_plan when 'solo' then 1 when 'studio' then 4 else null end;
$$;

create or replace function public.enforce_professional_limit()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_plan  public.billing_plan;
  v_limit int;
  v_count int;
begin
  if not new.active then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.active and old.salon_id = new.salon_id then
    return new;
  end if;

  select s.plan into v_plan from public.subscriptions s where s.salon_id = new.salon_id;
  v_limit := public.plan_professional_limit(coalesce(v_plan, 'solo'));
  if v_limit is null then
    return new;
  end if;

  -- trava a linha da assinatura: dois cadastros ao mesmo tempo não passam do limite
  perform 1 from public.subscriptions s where s.salon_id = new.salon_id for update;
  select count(*) into v_count from public.professionals p
  where p.salon_id = new.salon_id and p.active and p.id <> new.id;

  if v_count >= v_limit then
    raise exception 'limite de profissionais do plano atingido (%)', v_limit
      using errcode = 'P0001', hint = 'plan_professional_limit';
  end if;
  return new;
end;
$$;

create trigger professionals_plan_limit
  before insert or update of active, salon_id on public.professionals
  for each row execute function public.enforce_professional_limit();

-- ---------------------------------------------------------------- teste em todos os planos

drop function public.create_salon(text, text);

create function public.create_salon(p_name text, p_slug text, p_plan public.billing_plan default 'solo')
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
  values (v_salon, coalesce(p_plan, 'solo'), 'trialing', now() + interval '30 days', now() + interval '30 days');
  return v_salon;
end;
$$;
revoke all on function public.create_salon(text, text, public.billing_plan) from public, anonymous;
grant execute on function public.create_salon(text, text, public.billing_plan) to authenticated;

-- troca de plano durante o teste grátis (só a dona, só antes de assinar, nunca abaixo das profissionais ativas)
create or replace function public.set_trial_plan(p_plan public.billing_plan)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_salon uuid;
  v_sub   public.subscriptions;
  v_limit int := public.plan_professional_limit(p_plan);
begin
  select m.salon_id into v_salon from public.members m
  where m.user_id = (select auth.uid()) and m.role = 'owner';
  if v_salon is null then
    raise exception 'só a dona do negócio pode trocar o plano' using errcode = '42501';
  end if;

  select * into v_sub from public.subscriptions s where s.salon_id = v_salon for update;
  if v_sub.salon_id is null or v_sub.status <> 'trialing' or v_sub.billing_method is not null
     or v_sub.stripe_subscription_id is not null or v_sub.courtesy or v_sub.access_until <= now() then
    raise exception 'o plano só pode ser trocado assim durante o teste grátis' using errcode = 'P0001', hint = 'not_in_trial';
  end if;

  if v_limit is not null and
     (select count(*) from public.professionals p where p.salon_id = v_salon and p.active) > v_limit then
    raise exception 'há mais profissionais ativas do que o plano permite' using errcode = 'P0001', hint = 'plan_professional_limit';
  end if;

  update public.subscriptions set plan = p_plan, updated_at = now() where salon_id = v_salon;
end;
$$;
revoke all on function public.set_trial_plan(public.billing_plan) from public, anonymous;
grant execute on function public.set_trial_plan(public.billing_plan) to authenticated;

-- ---------------------------------------------------------------- cortesia (beta)

-- uso (no console do banco):  select public.grant_courtesy('studio-da-ana', 'salao', 6, 'Beta: Ana');
create or replace function public.grant_courtesy(
  p_slug   text,
  p_plan   public.billing_plan default 'salao',
  p_months int default 6,
  p_note   text default null
)
returns timestamptz
language plpgsql security definer set search_path = ''
as $$
declare
  v_salon uuid;
  v_until timestamptz := now() + make_interval(months => greatest(p_months, 1));
begin
  select id into v_salon from public.salons where slug = lower(trim(p_slug));
  if v_salon is null then
    raise exception 'salão % não encontrado', p_slug;
  end if;
  update public.subscriptions set
    plan = p_plan,
    courtesy = true,
    courtesy_note = p_note,
    access_until = greatest(access_until, v_until),
    updated_at = now()
  where salon_id = v_salon;
  return greatest((select access_until from public.subscriptions where salon_id = v_salon), v_until);
end;
$$;

-- encerra a cortesia: o acesso vai até a data informada (padrão: hoje + 7 dias, para dar tempo de assinar)
create or replace function public.end_courtesy(p_slug text, p_access_until timestamptz default now() + interval '7 days')
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.subscriptions s set
    courtesy = false,
    access_until = case when s.billing_method is null then p_access_until else s.access_until end,
    updated_at = now()
  from public.salons sa
  where sa.id = s.salon_id and sa.slug = lower(trim(p_slug));
end;
$$;

revoke all on function public.grant_courtesy(text, public.billing_plan, int, text) from public, anonymous, authenticated;
revoke all on function public.end_courtesy(text, timestamptz) from public, anonymous, authenticated;
revoke all on function public.plan_professional_limit(public.billing_plan) from public, anonymous;
grant execute on function public.plan_professional_limit(public.billing_plan) to authenticated;
revoke all on function public.enforce_professional_limit() from public, anonymous, authenticated;

notify pgrst, 'reload schema';

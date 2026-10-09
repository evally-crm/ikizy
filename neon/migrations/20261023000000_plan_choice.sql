-- IKIZY (Neon): escolha do plano no cadastro.
-- Fluxo: e-mail e senha > questionário > PLANO > dashboard.
-- O salão continua nascendo com 30 dias de teste (create_salon), agora em qualquer plano.
-- plan_chosen_at marca que a dona já passou pela tela de planos:
--   * cartão: o webhook do Stripe grava ao receber a assinatura (o teste segue e a 1ª cobrança vem no fim dele)
--   * Pix:    choose_trial_plan() grava direto; ela testa sem cartão e paga por Pix quando o teste acabar

alter table public.subscriptions add column plan_chosen_at timestamptz;

-- quem já existia não volta para a tela de planos
update public.subscriptions set plan_chosen_at = coalesce(updated_at, now()) where plan_chosen_at is null;

-- teste sem cartão (vai pagar por Pix): só a dona, só durante o teste e sem assinatura no cartão
create or replace function public.choose_trial_plan(p_plan public.billing_plan)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_user  uuid := (select auth.uid());
  v_salon uuid;
begin
  if v_user is null then
    raise exception 'não autenticado' using errcode = '28000';
  end if;
  select salon_id into v_salon from public.members where user_id = v_user and role = 'owner' limit 1;
  if v_salon is null then
    raise exception 'só a dona do negócio escolhe o plano' using errcode = '42501';
  end if;

  update public.subscriptions set
    plan = p_plan,
    plan_chosen_at = coalesce(plan_chosen_at, now()),
    updated_at = now()
  where salon_id = v_salon
    and status = 'trialing'
    and stripe_subscription_id is null;
  if not found then
    raise exception 'o plano só pode ser escolhido assim durante o teste' using errcode = '22023';
  end if;
end;
$$;
revoke all on function public.choose_trial_plan(public.billing_plan) from public, anonymous;
grant execute on function public.choose_trial_plan(public.billing_plan) to authenticated;

notify pgrst, 'reload schema';

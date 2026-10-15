-- IKIZY (Neon): criação completa do negócio numa transação só (R-11).
-- O cadastro novo (uma pergunta por tela) junta tudo e chama create_salon_setup() uma vez:
-- negócio, a dona como membro owner E como profissional, serviços sem preço, horário de atendimento,
-- configurações do site (não publicado) e o teste de 30 dias no plano sugerido. Ou cria tudo ou nada.
--
-- plan_chosen_at continua vazio: a dona confirma o plano na tela seguinte (choose_trial_plan ou cartão no Stripe).
-- Antes desta migration o app cai no caminho antigo (create_salon + inserts separados), então pode ser aplicada depois.

create or replace function public.create_salon_setup(
  p_name       text,
  p_slug       text,
  p_owner_name text,
  p_services   jsonb,
  p_hours      jsonb,
  p_plan       public.billing_plan
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_user  uuid := (select auth.uid());
  v_owner text := left(trim(coalesce(p_owner_name, '')), 80);
  v_salon uuid;
  v_pro   uuid;
begin
  if v_user is null then
    raise exception 'não autenticado' using errcode = '28000';
  end if;
  if char_length(v_owner) < 2 then
    raise exception 'informe o seu nome' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_services, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_services, '[]'::jsonb)) > 40 then
    raise exception 'até 40 serviços no cadastro' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_hours, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_hours, '[]'::jsonb)) > 21 then
    raise exception 'horário inválido' using errcode = '22023';
  end if;

  -- negócio, dona (owner), site e assinatura em teste: as mesmas checagens de sempre (link único, reservado, uma conta = um negócio)
  v_salon := public.create_salon(p_name, p_slug);

  insert into public.professionals (salon_id, user_id, name)
  values (v_salon, v_user, v_owner)
  returning id into v_pro;

  insert into public.services (salon_id, name, category, price, duration)
  select v_salon, left(trim(x.name), 80), x.category, 0, x.duration
  from jsonb_to_recordset(coalesce(p_services, '[]'::jsonb))
    as x(name text, category public.service_category, duration integer);

  insert into public.working_hours (salon_id, professional_id, weekday, start_minute, end_minute)
  select v_salon, v_pro, x.weekday, x.start_minute, x.end_minute
  from jsonb_to_recordset(coalesce(p_hours, '[]'::jsonb))
    as x(weekday smallint, start_minute smallint, end_minute smallint);

  if exists (
    select 1 from public.working_hours a
    join public.working_hours b
      on b.professional_id = a.professional_id and b.weekday = a.weekday and b.id > a.id
     and a.start_minute < b.end_minute and b.start_minute < a.end_minute
    where a.professional_id = v_pro
  ) then
    raise exception 'os intervalos de um mesmo dia não podem se sobrepor' using errcode = '23514';
  end if;

  -- o teste começa no plano que combina com a resposta da equipe (ou o que veio do site)
  update public.subscriptions set plan = p_plan, updated_at = now() where salon_id = v_salon;

  return v_salon;
end;
$$;

revoke all on function public.create_salon_setup(text, text, text, jsonb, jsonb, public.billing_plan) from public, anonymous;
grant execute on function public.create_salon_setup(text, text, text, jsonb, jsonb, public.billing_plan) to authenticated;

notify pgrst, 'reload schema';

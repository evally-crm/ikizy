-- IKIZY (Neon): o plano é escolhido no cadastro.
-- O teste de 30 dias sem cartão passa a valer para qualquer plano (antes só o Solo).
-- create_salon ganha p_plan; a versão antiga de 2 argumentos sai para a Data API não ficar com duas opções.

drop function if exists public.create_salon(text, text);

create or replace function public.create_salon(p_name text, p_slug text, p_plan text default 'solo')
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_user  uuid := (select auth.uid());
  v_salon uuid;
  v_plan  public.billing_plan;
begin
  if v_user is null then
    raise exception 'não autenticado' using errcode = '28000';
  end if;
  if exists (select 1 from public.members where user_id = v_user) then
    raise exception 'este usuário já pertence a um salão' using errcode = '23505';
  end if;
  if coalesce(p_plan, 'solo') not in ('solo', 'studio', 'salao') then
    raise exception 'plano inválido' using errcode = '22023';
  end if;
  v_plan := coalesce(p_plan, 'solo')::public.billing_plan;

  insert into public.salons (name, slug) values (trim(p_name), lower(trim(p_slug)))
  returning id into v_salon;
  insert into public.members (salon_id, user_id, role) values (v_salon, v_user, 'owner');
  insert into public.site_settings (salon_id) values (v_salon);
  insert into public.subscriptions (salon_id, plan, status, trial_ends_at, access_until)
  values (v_salon, v_plan, 'trialing', now() + interval '30 days', now() + interval '30 days');
  return v_salon;
end;
$$;

revoke all on function public.create_salon(text, text, text) from public, anonymous;
grant execute on function public.create_salon(text, text, text) to authenticated;

notify pgrst, 'reload schema';

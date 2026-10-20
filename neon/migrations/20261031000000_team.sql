-- IKIZY (Neon): equipe (Fase 2). Convites de acesso, regras do banco por perfil e limites por plano.
--
-- R-20 perfis · R-21 profissional (agenda) x membro (login) · R-22 só dona/gerente cadastram profissionais
-- R-24 convite com link único de 7 dias, uso único, cancelável; gerente não convida gerente nem mexe na dona
-- R-25 remover acesso desliga o login na hora; a profissional continua na agenda
-- R-26 limites: Solo 1 profissional e só a dona; Studio até 3 profissionais e 3 acessos; Salão sem limite
--      (os mesmos números ficam em apps/app/src/lib/plans.ts, PLAN_LIMITS)
-- Seção 4.4 da especificação: a tela esconde, o banco garante. A Data API é aberta ao navegador, então
-- profissional não lê fechamentos, saídas, custos, comissão das colegas, nem atendimentos e clientes de outras.

-- ---------------------------------------------------------------- funções auxiliares de perfil

-- id da profissional ligada ao login (null para quem não atende)
create or replace function public.my_professional(p_salon uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select p.id from public.professionals p
  where p.salon_id = p_salon and p.user_id = (select auth.uid())
  order by p.active desc, p.created_at
  limit 1;
$$;

-- dona, gerente e recepção veem a operação inteira (agenda de todas e todas as clientes)
create or replace function public.sees_all(p_salon uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.has_role(p_salon, array['owner', 'manager', 'reception']::public.member_role[]);
$$;

-- atendimentos: quem vê tudo, ou a profissional nos dela
create or replace function public.can_touch_professional(p_salon uuid, p_professional uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.sees_all(p_salon)
      or (public.has_role(p_salon, array['professional']::public.member_role[])
          and p_professional = public.my_professional(p_salon));
$$;

-- clientes: quem vê tudo, ou a profissional nas que ela cadastrou, atendeu, tem marcadas ou que a preferem
create or replace function public.can_see_client(p_salon uuid, p_client uuid)
returns boolean
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_pro uuid;
begin
  if public.sees_all(p_salon) then
    return true;
  end if;
  if not public.has_role(p_salon, array['professional']::public.member_role[]) then
    return false;
  end if;
  v_pro := public.my_professional(p_salon);
  return exists (
    select 1 from public.clients c
    where c.id = p_client and c.salon_id = p_salon
      and (c.created_by = (select auth.uid())
           or (v_pro is not null and c.preferred_professional = v_pro)
           or (v_pro is not null and exists (
                 select 1 from public.appointments a where a.client_id = c.id and a.professional_id = v_pro)))
  );
end;
$$;

-- ---------------------------------------------------------------- convites (R-24)

create table public.invites (
  id               uuid primary key default gen_random_uuid(),
  salon_id         uuid not null references public.salons(id) on delete cascade,
  -- 256 bits aleatórios; vai no link /convite/<token>
  token            text not null unique default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  role             public.member_role not null check (role <> 'owner'),
  professional_id  uuid,
  created_by       uuid not null,
  created_at       timestamptz not null default now(),
  expires_at       timestamptz not null default now() + interval '7 days',
  accepted_at      timestamptz,
  accepted_by      uuid,
  revoked_at       timestamptz,
  foreign key (professional_id, salon_id) references public.professionals(id, salon_id) on delete cascade,
  -- perfil profissional sempre aponta para quem atende (é a agenda dela que ela vai ver)
  check (role <> 'professional' or professional_id is not null)
);
create index invites_salon_idx on public.invites (salon_id, created_at desc);

alter table public.invites enable row level security;
-- dona e gerente leem (para copiar o link de novo); criar, cancelar e aceitar só pelas funções abaixo
create policy invites_select on public.invites for select to authenticated
  using (public.has_role(salon_id, array['owner', 'manager']::public.member_role[]));
grant select on public.invites to authenticated;

-- ---------------------------------------------------------------- limites por plano (R-26)

-- null = sem limite
create or replace function public.plan_limits(p_plan public.billing_plan, out max_professionals integer, out max_members integer)
language sql immutable set search_path = ''
as $$
  select case p_plan when 'solo' then 1 when 'studio' then 3 else null end,
         case p_plan when 'solo' then 1 when 'studio' then 3 else null end;
$$;

-- contagem que vale para os limites: profissionais ativas; acessos = membros + convites em aberto
create or replace function public.team_counts(p_salon uuid, out professionals integer, out members integer, out open_invites integer)
language sql stable security definer set search_path = ''
as $$
  select (select count(*)::int from public.professionals p where p.salon_id = p_salon and p.active),
         (select count(*)::int from public.members m where m.salon_id = p_salon),
         (select count(*)::int from public.invites i
           where i.salon_id = p_salon and i.accepted_at is null and i.revoked_at is null and i.expires_at > now());
$$;

-- cria o convite e devolve o token. Um convite em aberto por profissional: o anterior é cancelado
create or replace function public.create_invite(p_salon uuid, p_role public.member_role, p_professional uuid default null)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_user   uuid := (select auth.uid());
  v_plan   public.billing_plan;
  v_max    integer;
  v_counts record;
  v_token  text;
begin
  if not public.has_role(p_salon, array['owner', 'manager']::public.member_role[]) then
    raise exception 'só a dona ou a gerente convidam' using errcode = '42501';
  end if;
  if not public.has_access(p_salon) then
    raise exception 'sem assinatura ativa' using errcode = '42501';
  end if;
  if p_role = 'owner' then
    raise exception 'o negócio tem uma dona só' using errcode = '22023';
  end if;
  if p_role = 'manager' and not public.has_role(p_salon, array['owner']::public.member_role[]) then
    raise exception 'só a dona convida gerente' using errcode = '42501';
  end if;
  if p_role = 'professional' and p_professional is null then
    raise exception 'escolha a profissional' using errcode = '22023';
  end if;
  if p_professional is not null then
    if not exists (select 1 from public.professionals p where p.id = p_professional and p.salon_id = p_salon and p.active) then
      raise exception 'profissional não encontrada' using errcode = '22023';
    end if;
    if exists (select 1 from public.professionals p where p.id = p_professional and p.user_id is not null) then
      raise exception 'professional_has_access' using errcode = '23505';
    end if;
    update public.invites set revoked_at = now()
    where professional_id = p_professional and accepted_at is null and revoked_at is null;
  end if;

  select s.plan into v_plan from public.subscriptions s where s.salon_id = p_salon;
  -- gerente e recepção são do Salão; no Studio a equipe com login são as profissionais
  if coalesce(v_plan, 'solo') = 'studio' and p_role <> 'professional' then
    raise exception 'plan_role' using errcode = 'P0001';
  end if;
  v_max := (public.plan_limits(coalesce(v_plan, 'solo'))).max_members;
  v_counts := public.team_counts(p_salon);
  if v_max is not null and v_counts.members + v_counts.open_invites >= v_max then
    raise exception 'plan_limit_members' using errcode = 'P0001';
  end if;

  insert into public.invites (salon_id, role, professional_id, created_by)
  values (p_salon, p_role, p_professional, v_user)
  returning token into v_token;
  return v_token;
end;
$$;

create or replace function public.revoke_invite(p_invite uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_salon uuid;
begin
  select salon_id into v_salon from public.invites where id = p_invite;
  if v_salon is null or not public.has_role(v_salon, array['owner', 'manager']::public.member_role[]) then
    raise exception 'convite não encontrado' using errcode = '42501';
  end if;
  update public.invites set revoked_at = now() where id = p_invite and accepted_at is null and revoked_at is null;
end;
$$;

-- o que a tela /convite/<token> mostra antes de aceitar (também sem login: o token é o segredo)
create or replace function public.get_invite(p_token text)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'salon', s.name,
    'role', i.role,
    'professional', p.name,
    'state', case
      when i.accepted_at is not null then 'used'
      when i.revoked_at is not null then 'revoked'
      when i.expires_at <= now() then 'expired'
      else 'ok' end
  )
  from public.invites i
  join public.salons s on s.id = i.salon_id
  left join public.professionals p on p.id = i.professional_id
  where i.token = p_token and char_length(p_token) = 64;
$$;

-- liga o login ao negócio (e à profissional, se houver). Uma conta = um negócio (R-05)
create or replace function public.accept_invite(p_token text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_inv  public.invites%rowtype;
begin
  if v_user is null then
    raise exception 'não autenticado' using errcode = '28000';
  end if;
  select * into v_inv from public.invites where token = p_token for update;
  if not found then
    raise exception 'invite_invalid' using errcode = '22023';
  end if;
  if v_inv.accepted_at is not null then
    raise exception 'invite_used' using errcode = '22023';
  end if;
  if v_inv.revoked_at is not null then
    raise exception 'invite_revoked' using errcode = '22023';
  end if;
  if v_inv.expires_at <= now() then
    raise exception 'invite_expired' using errcode = '22023';
  end if;
  if exists (select 1 from public.members where user_id = v_user) then
    raise exception 'already_member' using errcode = '23505';
  end if;

  -- marca antes de inserir o membro: o próprio convite deixa de contar como "em aberto" no limite
  update public.invites set accepted_at = now(), accepted_by = v_user where id = v_inv.id;
  insert into public.members (salon_id, user_id, role) values (v_inv.salon_id, v_user, v_inv.role);

  if v_inv.professional_id is not null then
    update public.professionals set user_id = v_user
    where id = v_inv.professional_id and salon_id = v_inv.salon_id and user_id is null;
    if not found then
      raise exception 'professional_has_access' using errcode = '23505';
    end if;
  end if;
  return v_inv.salon_id;
end;
$$;

-- ---------------------------------------------------------------- acessos (R-24, R-25)

create or replace function public.remove_member(p_salon uuid, p_user uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_target public.member_role;
begin
  if not public.has_role(p_salon, array['owner', 'manager']::public.member_role[]) then
    raise exception 'só a dona ou a gerente removem acessos' using errcode = '42501';
  end if;
  if p_user = (select auth.uid()) then
    raise exception 'você não pode remover o próprio acesso' using errcode = '42501';
  end if;
  select role into v_target from public.members where salon_id = p_salon and user_id = p_user;
  if v_target is null then
    return;
  end if;
  if v_target = 'owner' or (v_target = 'manager' and not public.has_role(p_salon, array['owner']::public.member_role[])) then
    raise exception 'sem permissão para remover este acesso' using errcode = '42501';
  end if;
  delete from public.members where salon_id = p_salon and user_id = p_user;
  -- a profissional continua na agenda, só sem login
  update public.professionals set user_id = null where salon_id = p_salon and user_id = p_user;
end;
$$;

create or replace function public.set_member_role(p_salon uuid, p_user uuid, p_role public.member_role)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_target   public.member_role;
  v_is_owner boolean := public.has_role(p_salon, array['owner']::public.member_role[]);
begin
  if not public.has_role(p_salon, array['owner', 'manager']::public.member_role[]) then
    raise exception 'só a dona ou a gerente mudam perfis' using errcode = '42501';
  end if;
  if p_role = 'owner' then
    raise exception 'o negócio tem uma dona só' using errcode = '22023';
  end if;
  select role into v_target from public.members where salon_id = p_salon and user_id = p_user;
  if v_target is null then
    raise exception 'acesso não encontrado' using errcode = '22023';
  end if;
  if v_target = 'owner' or (not v_is_owner and (v_target = 'manager' or p_role = 'manager')) then
    raise exception 'sem permissão para mudar este perfil' using errcode = '42501';
  end if;
  -- perfil profissional só enxerga a própria agenda: precisa estar ligada a quem atende
  if p_role = 'professional' and not exists (
    select 1 from public.professionals where salon_id = p_salon and user_id = p_user
  ) then
    raise exception 'professional_not_linked' using errcode = '22023';
  end if;
  update public.members set role = p_role where salon_id = p_salon and user_id = p_user;
end;
$$;

-- tela de equipe (dona e gerente): profissionais com comissão, acessos com nome e e-mail, convites em aberto e limites
create or replace function public.get_team(p_salon uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_plan public.billing_plan;
begin
  if not public.has_role(p_salon, array['owner', 'manager']::public.member_role[]) then
    raise exception 'só a dona ou a gerente veem a equipe' using errcode = '42501';
  end if;
  select s.plan into v_plan from public.subscriptions s where s.salon_id = p_salon;
  return jsonb_build_object(
    'plan', coalesce(v_plan, 'solo'),
    'professionals', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'name', p.name, 'title', p.title, 'commission_pct', p.commission_pct,
        'active', p.active, 'user_id', p.user_id
      ) order by p.active desc, p.created_at)
      from public.professionals p where p.salon_id = p_salon
    ), '[]'::jsonb),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', m.user_id, 'role', m.role, 'name', u.name, 'email', u.email, 'since', m.created_at,
        'professional_id', (select p.id from public.professionals p where p.salon_id = p_salon and p.user_id = m.user_id limit 1)
      ) order by m.created_at)
      from public.members m
      left join neon_auth."user" u on u.id = m.user_id
      where m.salon_id = p_salon
    ), '[]'::jsonb),
    'invites', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'token', i.token, 'role', i.role, 'professional_id', i.professional_id,
        'created_at', i.created_at, 'expires_at', i.expires_at
      ) order by i.created_at desc)
      from public.invites i
      where i.salon_id = p_salon and i.accepted_at is null and i.revoked_at is null and i.expires_at > now()
    ), '[]'::jsonb)
  );
end;
$$;

-- comissão: dona e gerente veem a de todas; a profissional, só a dela; a recepção, nenhuma
create or replace function public.get_commissions(p_salon uuid)
returns table (professional_id uuid, commission_pct numeric)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.commission_pct
  from public.professionals p
  where p.salon_id = p_salon
    and (public.has_role(p_salon, array['owner', 'manager']::public.member_role[])
         or (public.has_role(p_salon, array['professional']::public.member_role[]) and p.user_id = (select auth.uid())));
$$;

-- ---------------------------------------------------------------- travas de limite (valem para qualquer caminho de escrita)

create or replace function public.guard_professionals_limit()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_plan public.billing_plan;
  v_max  integer;
begin
  if not new.active or (tg_op = 'UPDATE' and old.active) then
    return new;
  end if;
  select s.plan into v_plan from public.subscriptions s where s.salon_id = new.salon_id;
  v_max := (public.plan_limits(coalesce(v_plan, 'solo'))).max_professionals;
  if v_max is not null and (
    select count(*) from public.professionals p where p.salon_id = new.salon_id and p.active and p.id <> new.id
  ) >= v_max then
    raise exception 'plan_limit_professionals' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger professionals_plan_limit
  before insert or update of active on public.professionals
  for each row execute function public.guard_professionals_limit();

create or replace function public.guard_members_limit()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_plan   public.billing_plan;
  v_max    integer;
  v_counts record;
begin
  select s.plan into v_plan from public.subscriptions s where s.salon_id = new.salon_id;
  v_max := (public.plan_limits(coalesce(v_plan, 'solo'))).max_members;
  v_counts := public.team_counts(new.salon_id);
  if v_max is not null and v_counts.members + v_counts.open_invites >= v_max then
    raise exception 'plan_limit_members' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger members_plan_limit
  before insert on public.members
  for each row execute function public.guard_members_limit();

-- trocar para um plano menor no teste exige caber nele (R-106)
create or replace function public.choose_trial_plan(p_plan public.billing_plan)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_user   uuid := (select auth.uid());
  v_salon  uuid;
  v_lim    record;
  v_counts record;
begin
  if v_user is null then
    raise exception 'não autenticado' using errcode = '28000';
  end if;
  select salon_id into v_salon from public.members where user_id = v_user and role = 'owner' limit 1;
  if v_salon is null then
    raise exception 'só a dona do negócio escolhe o plano' using errcode = '42501';
  end if;

  v_lim := public.plan_limits(p_plan);
  v_counts := public.team_counts(v_salon);
  if (v_lim.max_professionals is not null and v_counts.professionals > v_lim.max_professionals)
     or (v_lim.max_members is not null and v_counts.members > v_lim.max_members) then
    raise exception 'plan_too_small' using errcode = 'P0001';
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

-- ---------------------------------------------------------------- regras por perfil (seção 4.4)

-- clientes guardam quem cadastrou: a profissional vê a cliente que acabou de criar, antes do 1º atendimento
alter table public.clients add column created_by uuid default auth.uid();

-- membros: cada um vê a própria linha; dona e gerente veem todos. Escrita só pelas funções (create_salon, accept_invite...)
drop policy members_select on public.members;
drop policy members_manage on public.members;
create policy members_select on public.members for select to authenticated
  using (user_id = (select auth.uid()) or public.has_role(salon_id, array['owner', 'manager']::public.member_role[]));
revoke insert, update, delete on public.members from authenticated;

-- profissionais e horários: todos os membros leem (a agenda mostra os nomes); só dona e gerente alteram (R-22)
-- a comissão não é lida direto: get_commissions() decide quem vê qual
revoke select on public.professionals from authenticated;
grant select (id, salon_id, user_id, name, title, active, created_at) on public.professionals to authenticated;
do $$
declare t text;
begin
  foreach t in array array['professionals', 'working_hours'] loop
    execute format('drop policy %I on public.%I', t || '_insert', t);
    execute format('drop policy %I on public.%I', t || '_update', t);
    execute format('drop policy %I on public.%I', t || '_delete', t);
    execute format($p$create policy %I on public.%I for insert to authenticated with check (public.has_role(salon_id, array['owner','manager']::public.member_role[]))$p$, t || '_insert', t);
    execute format($p$create policy %I on public.%I for update to authenticated using (public.has_role(salon_id, array['owner','manager']::public.member_role[])) with check (public.has_role(salon_id, array['owner','manager']::public.member_role[]))$p$, t || '_update', t);
    execute format($p$create policy %I on public.%I for delete to authenticated using (public.has_role(salon_id, array['owner','manager']::public.member_role[]))$p$, t || '_delete', t);
  end loop;
end $$;

-- atendimentos: dona, gerente e recepção em todos; profissional só nos dela (inclusive não pode passar para outra)
drop policy appointments_select on public.appointments;
drop policy appointments_insert on public.appointments;
drop policy appointments_update on public.appointments;
drop policy appointments_delete on public.appointments;
create policy appointments_select on public.appointments for select to authenticated
  using (public.can_touch_professional(salon_id, professional_id));
create policy appointments_insert on public.appointments for insert to authenticated
  with check (public.can_touch_professional(salon_id, professional_id));
create policy appointments_update on public.appointments for update to authenticated
  using (public.can_touch_professional(salon_id, professional_id))
  with check (public.can_touch_professional(salon_id, professional_id));
-- apagar não faz parte do dia a dia (cancelar é o caminho): só dona e gerente
create policy appointments_delete on public.appointments for delete to authenticated
  using (public.has_role(salon_id, array['owner', 'manager']::public.member_role[]));

-- clientes: todas para quem vê tudo; a profissional, só as dela. Apagar só dona e gerente.
-- "cadastrada por mim" vai direto na regra (não só em can_see_client): no insert ... returning a função
-- ainda não enxerga a linha nova, e a cliente recém-criada precisa voltar para a tela
drop policy clients_select on public.clients;
drop policy clients_update on public.clients;
drop policy clients_delete on public.clients;
create policy clients_select on public.clients for select to authenticated
  using ((public.is_member(salon_id) and created_by = (select auth.uid())) or public.can_see_client(salon_id, id));
create policy clients_update on public.clients for update to authenticated
  using ((public.is_member(salon_id) and created_by = (select auth.uid())) or public.can_see_client(salon_id, id))
  with check ((public.is_member(salon_id) and created_by = (select auth.uid())) or public.can_see_client(salon_id, id));
create policy clients_delete on public.clients for delete to authenticated
  using (public.has_role(salon_id, array['owner', 'manager']::public.member_role[]));

-- anotações e fotos seguem a cliente (R-73); fotos só dona e gerente apagam
do $$
declare t text;
begin
  foreach t in array array['client_notes', 'client_photos'] loop
    execute format('drop policy %I on public.%I', t || '_select', t);
    execute format('drop policy %I on public.%I', t || '_insert', t);
    execute format('drop policy %I on public.%I', t || '_update', t);
    execute format('drop policy %I on public.%I', t || '_delete', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.can_see_client(salon_id, client_id))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.can_see_client(salon_id, client_id))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.can_see_client(salon_id, client_id)) with check (public.can_see_client(salon_id, client_id))', t || '_update', t);
  end loop;
end $$;
create policy client_notes_delete on public.client_notes for delete to authenticated
  using (public.can_see_client(salon_id, client_id));
create policy client_photos_delete on public.client_photos for delete to authenticated
  using (public.has_role(salon_id, array['owner', 'manager']::public.member_role[]));

-- dinheiro do negócio e custos: só dona e gerente leem
drop policy month_closings_select on public.month_closings;
create policy month_closings_select on public.month_closings for select to authenticated
  using (public.has_role(salon_id, array['owner', 'manager']::public.member_role[]));
drop policy expenses_select on public.expenses;
create policy expenses_select on public.expenses for select to authenticated
  using (public.has_role(salon_id, array['owner', 'manager']::public.member_role[]));
drop policy products_select on public.products;
create policy products_select on public.products for select to authenticated
  using (public.has_role(salon_id, array['owner', 'manager']::public.member_role[]));

-- ---------------------------------------------------------------- privilégios

revoke all on function public.my_professional(uuid) from public, anonymous;
revoke all on function public.sees_all(uuid) from public, anonymous;
revoke all on function public.can_touch_professional(uuid, uuid) from public, anonymous;
revoke all on function public.can_see_client(uuid, uuid) from public, anonymous;
revoke all on function public.plan_limits(public.billing_plan) from public, anonymous;
revoke all on function public.team_counts(uuid) from public, anonymous, authenticated;
revoke all on function public.create_invite(uuid, public.member_role, uuid) from public, anonymous;
revoke all on function public.revoke_invite(uuid) from public, anonymous;
revoke all on function public.accept_invite(text) from public, anonymous;
revoke all on function public.remove_member(uuid, uuid) from public, anonymous;
revoke all on function public.set_member_role(uuid, uuid, public.member_role) from public, anonymous;
revoke all on function public.get_team(uuid) from public, anonymous;
revoke all on function public.get_commissions(uuid) from public, anonymous;
revoke all on function public.guard_professionals_limit() from public, anonymous, authenticated;
revoke all on function public.guard_members_limit() from public, anonymous, authenticated;

grant execute on function public.my_professional(uuid) to authenticated;
grant execute on function public.sees_all(uuid) to authenticated;
grant execute on function public.can_touch_professional(uuid, uuid) to authenticated;
grant execute on function public.can_see_client(uuid, uuid) to authenticated;
grant execute on function public.plan_limits(public.billing_plan) to authenticated;
grant execute on function public.create_invite(uuid, public.member_role, uuid) to authenticated;
grant execute on function public.revoke_invite(uuid) to authenticated;
grant execute on function public.accept_invite(text) to authenticated;
grant execute on function public.remove_member(uuid, uuid) to authenticated;
grant execute on function public.set_member_role(uuid, uuid, public.member_role) to authenticated;
grant execute on function public.get_team(uuid) to authenticated;
grant execute on function public.get_commissions(uuid) to authenticated;
-- a tela do convite abre antes do login
grant execute on function public.get_invite(text) to anonymous, authenticated;

insert into public.schema_migrations (version) values ('20261031000000_team') on conflict (version) do nothing;

notify pgrst, 'reload schema';

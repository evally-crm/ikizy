-- IKIZY (Neon): equipe com acesso próprio (convite por link) e permissões por papel.
-- Pré-requisitos: init, billing (has_access), working_hours (unique (id, salon_id) em professionals), plan_limits.
--
-- Papéis (member_role):
--   owner        dona: tudo, inclusive assinatura e equipe
--   manager      gerente: tudo do dia a dia (agenda, clientes, financeiro, site, cadastro de profissionais)
--   reception    recepção: agenda e clientes; não vê o financeiro
--   professional profissional: agenda e clientes; não vê o financeiro
-- O limite do plano conta só quem atende (professionals ativas); recepção e gerente que não atendem não contam.
--
-- Convite: a dona cria um convite (papel + nome, opcionalmente ligado a uma profissional da agenda) e manda o
-- link /convite/<token>. Quem abre entra ou cria a conta e aceita (accept_invite). O token vale 7 dias e uma vez.

-- nome de exibição de quem faz parte da equipe (a conta fica no Neon Auth; aqui só o que a equipe vê)
alter table public.members add column name text check (name is null or char_length(name) between 1 and 80);

-- ---------------------------------------------------------------- convites

create table public.invites (
  id              uuid primary key default gen_random_uuid(),
  salon_id        uuid not null references public.salons(id) on delete cascade,
  token           text not null unique
                  default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
  role            public.member_role not null check (role <> 'owner'),
  name            text not null check (char_length(trim(name)) between 2 and 80),
  professional_id uuid,
  created_by      uuid not null default auth.uid(),
  created_at      timestamptz not null default now(),
  expires_at      timestamptz not null default now() + interval '7 days',
  accepted_at     timestamptz,
  accepted_by     uuid,
  foreign key (professional_id, salon_id) references public.professionals (id, salon_id) on delete cascade
);
create index invites_salon_idx on public.invites (salon_id);

alter table public.invites enable row level security;

-- só a dona convida, vê e cancela convites
create policy invites_select on public.invites for select to authenticated
  using (public.has_role(salon_id, array['owner']::public.member_role[]));
create policy invites_insert on public.invites for insert to authenticated
  with check (public.has_role(salon_id, array['owner']::public.member_role[]) and created_by = (select auth.uid()));
create policy invites_delete on public.invites for delete to authenticated
  using (public.has_role(salon_id, array['owner']::public.member_role[]));
create policy invites_billing_insert on public.invites as restrictive for insert to authenticated
  with check (public.has_access(salon_id));

-- token, datas e quem aceitou são sempre preenchidos pelo banco
grant select, delete on public.invites to authenticated;
grant insert (salon_id, role, name, professional_id) on public.invites to authenticated;

-- o que quem recebeu o link vê antes de aceitar (sem o token não há como listar convites)
create or replace function public.get_invite(p_token text)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'salon', s.name,
    'role', i.role,
    'name', i.name,
    'status', case when i.accepted_at is not null then 'used'
                   when i.expires_at <= now() then 'expired'
                   else 'valid' end
  )
  from public.invites i join public.salons s on s.id = i.salon_id
  where i.token = p_token;
$$;

create or replace function public.accept_invite(p_token text, p_name text default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_inv  public.invites;
  v_name text;
begin
  if v_user is null then
    raise exception 'não autenticado' using errcode = '28000';
  end if;

  select * into v_inv from public.invites where token = p_token for update;
  if v_inv.id is null then
    raise exception 'convite não encontrado' using errcode = 'P0001', hint = 'invite_not_found';
  end if;
  if v_inv.accepted_at is not null then
    raise exception 'convite já usado' using errcode = 'P0001', hint = 'invite_used';
  end if;
  if v_inv.expires_at <= now() then
    raise exception 'convite vencido' using errcode = 'P0001', hint = 'invite_expired';
  end if;
  if exists (select 1 from public.members where user_id = v_user) then
    raise exception 'esta conta já faz parte de um negócio' using errcode = 'P0001', hint = 'already_member';
  end if;

  v_name := coalesce(nullif(left(trim(p_name), 80), ''), v_inv.name);
  insert into public.members (salon_id, user_id, role, name) values (v_inv.salon_id, v_user, v_inv.role, v_name);

  -- liga a conta à profissional da agenda (se ainda não tiver ninguém ligado)
  if v_inv.professional_id is not null then
    update public.professionals set user_id = v_user
    where id = v_inv.professional_id and salon_id = v_inv.salon_id and user_id is null;
  end if;

  update public.invites set accepted_at = now(), accepted_by = v_user where id = v_inv.id;
  return v_inv.salon_id;
end;
$$;

revoke all on function public.get_invite(text) from public, anonymous;
revoke all on function public.accept_invite(text, text) from public, anonymous;
grant execute on function public.get_invite(text) to authenticated;
grant execute on function public.accept_invite(text, text) to authenticated;

-- ---------------------------------------------------------------- membros

-- dona e gerente veem a equipe toda; as demais pessoas veem só a própria linha
drop policy members_select on public.members;
create policy members_select on public.members for select to authenticated
  using (user_id = (select auth.uid()) or public.has_role(salon_id, array['owner', 'manager']::public.member_role[]));

-- quem sai da equipe deixa de estar ligada à profissional da agenda (o histórico fica)
create or replace function public.unlink_removed_member()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.professionals set user_id = null where salon_id = old.salon_id and user_id = old.user_id;
  return old;
end;
$$;
revoke all on function public.unlink_removed_member() from public, anonymous, authenticated;

create trigger members_unlink_professional
  after delete on public.members
  for each row execute function public.unlink_removed_member();

-- ---------------------------------------------------------------- permissões por papel

-- cadastro de profissionais: só dona e gerente (antes qualquer membro podia)
drop policy professionals_insert on public.professionals;
drop policy professionals_update on public.professionals;
drop policy professionals_delete on public.professionals;
create policy professionals_insert on public.professionals for insert to authenticated
  with check (public.has_role(salon_id, array['owner', 'manager']::public.member_role[]));
create policy professionals_update on public.professionals for update to authenticated
  using (public.has_role(salon_id, array['owner', 'manager']::public.member_role[]))
  with check (public.has_role(salon_id, array['owner', 'manager']::public.member_role[]));
create policy professionals_delete on public.professionals for delete to authenticated
  using (public.has_role(salon_id, array['owner', 'manager']::public.member_role[]));

-- financeiro (saídas e fechamentos): só dona e gerente leem
drop policy expenses_select on public.expenses;
create policy expenses_select on public.expenses for select to authenticated
  using (public.has_role(salon_id, array['owner', 'manager']::public.member_role[]));
drop policy month_closings_select on public.month_closings;
create policy month_closings_select on public.month_closings for select to authenticated
  using (public.has_role(salon_id, array['owner', 'manager']::public.member_role[]));

notify pgrst, 'reload schema';

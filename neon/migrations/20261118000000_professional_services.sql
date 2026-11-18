-- IKIZY (Neon): quem faz cada serviço.
--
--   * professional_services: liga um serviço às profissionais que fazem esse serviço.
--     Serviço SEM nenhuma linha = todas as profissionais fazem (é o que vale para os negócios que já existem
--     e para quem cadastra profissional nova depois). Com linhas, só as profissionais listadas.
--   * set_service_professionals(): troca a lista de um serviço de uma vez (roda com as permissões de quem
--     chama, então a RLS vale: só dona e gerente, e só com acesso ativo).
--   * get_available_slots() passa a oferecer só as profissionais que fazem o serviço; book_appointment()
--     usa essa função, então o pedido pelo site também respeita a regra.
--
-- Seguro para rodar de novo. TESTAR ANTES NA BRANCH DEV DO NEON (npm run db:migrate:dev).

-- permite referenciar (id, salon_id) e garantir que a ligação é do mesmo negócio do serviço
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'services_id_salon_key') then
    alter table public.services add constraint services_id_salon_key unique (id, salon_id);
  end if;
end $$;

create table if not exists public.professional_services (
  salon_id        uuid not null references public.salons(id) on delete cascade,
  professional_id uuid not null,
  service_id      uuid not null,
  created_at      timestamptz not null default now(),
  primary key (service_id, professional_id),
  foreign key (professional_id, salon_id) references public.professionals (id, salon_id) on delete cascade,
  foreign key (service_id, salon_id) references public.services (id, salon_id) on delete cascade
);
create index if not exists professional_services_salon_idx on public.professional_services (salon_id);
create index if not exists professional_services_professional_idx on public.professional_services (professional_id);

alter table public.professional_services enable row level security;
revoke all on public.professional_services from anonymous, authenticated;
grant select, insert, delete on public.professional_services to authenticated;

drop policy if exists professional_services_select on public.professional_services;
drop policy if exists professional_services_insert on public.professional_services;
drop policy if exists professional_services_delete on public.professional_services;
drop policy if exists professional_services_billing_insert on public.professional_services;
drop policy if exists professional_services_billing_delete on public.professional_services;

-- todos os membros leem (a agenda filtra as profissionais pelo serviço); só dona e gerente alteram
create policy professional_services_select on public.professional_services for select to authenticated
  using (public.is_member(salon_id));
create policy professional_services_insert on public.professional_services for insert to authenticated
  with check (public.has_role(salon_id, array['owner','manager']::public.member_role[]));
create policy professional_services_delete on public.professional_services for delete to authenticated
  using (public.has_role(salon_id, array['owner','manager']::public.member_role[]));
-- sem acesso ativo o sistema fica em modo leitura, como nas demais tabelas
create policy professional_services_billing_insert on public.professional_services as restrictive for insert to authenticated
  with check (public.has_access(salon_id));
create policy professional_services_billing_delete on public.professional_services as restrictive for delete to authenticated
  using (public.has_access(salon_id));

-- troca a lista de quem faz o serviço; lista vazia (ou nula) = todas fazem
create or replace function public.set_service_professionals(p_service uuid, p_professionals uuid[])
returns void
language plpgsql set search_path = ''
as $$
declare
  v_salon uuid;
begin
  select salon_id into v_salon from public.services where id = p_service;
  if v_salon is null then
    raise exception 'serviço não encontrado' using errcode = '42501';
  end if;

  delete from public.professional_services where service_id = p_service;

  insert into public.professional_services (salon_id, professional_id, service_id)
  select v_salon, x.id, p_service
  from (select distinct unnest(coalesce(p_professionals, '{}'::uuid[])) as id) x;
end;
$$;
revoke all on function public.set_service_professionals(uuid, uuid[]) from public, anonymous, authenticated;
grant execute on function public.set_service_professionals(uuid, uuid[]) to authenticated;

-- horários livres: só as profissionais que fazem o serviço (o resto da função não muda)
do $$
declare v_def text;
begin
  select pg_get_functiondef('public.get_available_slots(text, uuid, date, uuid)'::regprocedure) into v_def;
  if v_def not like '%professional_services%' then
    v_def := replace(
      v_def,
      'and (p_professional is null or p.id = p_professional)',
      'and (p_professional is null or p.id = p_professional)
      and (
        not exists (select 1 from public.professional_services ps where ps.service_id = p_service)
        or exists (select 1 from public.professional_services ps where ps.service_id = p_service and ps.professional_id = p.id)
      )'
    );
    if v_def not like '%professional_services%' then
      raise exception 'get_available_slots mudou: ajuste esta migration';
    end if;
    execute v_def;
  end if;
end $$;
-- a definição recriada mantém as permissões (só o servidor chama)
revoke all on function public.get_available_slots(text, uuid, date, uuid) from public, anonymous, authenticated;

insert into public.schema_migrations (version) values ('20261118000000_professional_services') on conflict (version) do nothing;

notify pgrst, 'reload schema';

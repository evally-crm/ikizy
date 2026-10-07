-- IKIZY: schema inicial multi-salão (multi-tenant) com RLS.
-- Toda tabela de dados tem salon_id; o acesso é sempre filtrado por quem é membro do salão.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- tipos
create type public.member_role as enum ('owner', 'manager', 'reception', 'professional');
create type public.appointment_status as enum ('pendente', 'confirmado', 'atendimento', 'concluido', 'cancelado', 'faltou');
create type public.service_category as enum ('Unhas', 'Cílios', 'Sobrancelha', 'Cabelo', 'Estética');
create type public.site_accent as enum ('bordo', 'rubi', 'vinho');

-- ---------------------------------------------------------------- tabelas
create table public.salons (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 2 and 60),
  slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 40),
  created_at  timestamptz not null default now()
);

create table public.members (
  salon_id    uuid not null references public.salons(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        public.member_role not null default 'reception',
  created_at  timestamptz not null default now(),
  primary key (salon_id, user_id)
);
create index members_user_idx on public.members (user_id);

create table public.professionals (
  id             uuid primary key default gen_random_uuid(),
  salon_id       uuid not null references public.salons(id) on delete cascade,
  user_id        uuid references auth.users(id) on delete set null,
  name           text not null check (char_length(name) between 2 and 80),
  title          text not null default '',
  commission_pct numeric(5,2) not null default 0 check (commission_pct between 0 and 100),
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);
create index professionals_salon_idx on public.professionals (salon_id);

create table public.clients (
  id                     uuid primary key default gen_random_uuid(),
  salon_id               uuid not null references public.salons(id) on delete cascade,
  name                   text not null check (char_length(name) between 2 and 120),
  phone                  text not null default '',
  birthday               date,
  vip                    boolean not null default false,
  preferred_professional uuid references public.professionals(id) on delete set null,
  allergies              text[] not null default '{}',
  preferences            text[] not null default '{}',
  anamnesis_signed_at    timestamptz,
  created_at             timestamptz not null default now()
);
create index clients_salon_idx on public.clients (salon_id, name);

create table public.products (
  id             uuid primary key default gen_random_uuid(),
  salon_id       uuid not null references public.salons(id) on delete cascade,
  name           text not null check (char_length(name) between 1 and 80),
  monthly_spend  numeric(12,2) not null default 0 check (monthly_spend >= 0),
  created_at     timestamptz not null default now()
);
create index products_salon_idx on public.products (salon_id);

create table public.services (
  id              uuid primary key default gen_random_uuid(),
  salon_id        uuid not null references public.salons(id) on delete cascade,
  name            text not null check (char_length(name) between 1 and 80),
  category        public.service_category not null default 'Unhas',
  price           numeric(12,2) not null default 0 check (price >= 0),
  duration        integer not null default 60 check (duration between 5 and 600),
  monthly_volume  integer not null default 0 check (monthly_volume >= 0),
  product_id      uuid references public.products(id) on delete set null,
  visible         boolean not null default true,
  created_at      timestamptz not null default now()
);
create index services_salon_idx on public.services (salon_id);

create table public.appointments (
  id               uuid primary key default gen_random_uuid(),
  salon_id         uuid not null references public.salons(id) on delete cascade,
  client_id        uuid not null references public.clients(id) on delete restrict,
  professional_id  uuid not null references public.professionals(id) on delete restrict,
  service_id       uuid references public.services(id) on delete set null,
  service_name     text not null,
  starts_at        timestamptz not null,
  duration         integer not null check (duration between 5 and 600),
  price            numeric(12,2) not null default 0 check (price >= 0),
  status           public.appointment_status not null default 'pendente',
  created_at       timestamptz not null default now()
);
create index appointments_salon_day_idx on public.appointments (salon_id, starts_at);
create index appointments_client_idx on public.appointments (client_id);

create table public.site_settings (
  salon_id         uuid primary key references public.salons(id) on delete cascade,
  tagline          text not null default '' check (char_length(tagline) <= 70),
  about            text not null default '' check (char_length(about) <= 220),
  whatsapp         text not null default '',
  instagram        text not null default '',
  hours            text not null default '' check (char_length(hours) <= 50),
  accent           public.site_accent not null default 'bordo',
  show_prices      boolean not null default true,
  show_team        boolean not null default true,
  deposit_percent  integer not null default 0 check (deposit_percent between 0 and 100),
  updated_at       timestamptz not null default now()
);

-- fechamento mensal: ao fechar, guardamos um retrato (snapshot) dos números e travamos o mês
create table public.month_closings (
  id          uuid primary key default gen_random_uuid(),
  salon_id    uuid not null references public.salons(id) on delete cascade,
  month       date not null check (month = date_trunc('month', month)::date),
  closed_at   timestamptz not null default now(),
  closed_by   uuid not null references auth.users(id),
  snapshot    jsonb not null,
  unique (salon_id, month)
);

-- ---------------------------------------------------------------- funções auxiliares
-- security definer + search_path vazio: evitam recursão de RLS e sequestro de schema.
create or replace function public.is_member(p_salon uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.members m
    where m.salon_id = p_salon and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.has_role(p_salon uuid, p_roles public.member_role[])
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.members m
    where m.salon_id = p_salon and m.user_id = (select auth.uid()) and m.role = any (p_roles)
  );
$$;

-- cria o salão do usuário logado (dono) com a configuração inicial do site
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
  return v_salon;
end;
$$;

-- página pública: devolve só o que pode ser exibido, sem expor tabelas ao anon
create or replace function public.get_public_site(p_slug text)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'name', s.name,
    'slug', s.slug,
    'settings', to_jsonb(ss) - 'salon_id' - 'updated_at',
    'services', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', sv.name, 'category', sv.category, 'duration', sv.duration,
        'price', case when ss.show_prices then sv.price else null end
      ) order by sv.category, sv.name)
      from public.services sv where sv.salon_id = s.id and sv.visible
    ), '[]'::jsonb),
    'team', case when ss.show_team then coalesce((
      select jsonb_agg(jsonb_build_object('name', p.name, 'title', p.title) order by p.name)
      from public.professionals p where p.salon_id = s.id and p.active
    ), '[]'::jsonb) else '[]'::jsonb end
  )
  from public.salons s
  join public.site_settings ss on ss.salon_id = s.id
  where s.slug = lower(p_slug);
$$;

-- fecha o mês: só dono/gerente, grava o snapshot e trava as alterações do período
create or replace function public.close_month(p_salon uuid, p_month date, p_snapshot jsonb)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.has_role(p_salon, array['owner', 'manager']::public.member_role[]) then
    raise exception 'sem permissão para fechar o mês' using errcode = '42501';
  end if;
  insert into public.month_closings (salon_id, month, closed_by, snapshot)
  values (p_salon, date_trunc('month', p_month)::date, (select auth.uid()), p_snapshot)
  returning id into v_id;
  return v_id;
end;
$$;

-- impede criar/alterar/apagar atendimentos de um mês já fechado
create or replace function public.guard_closed_month()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_salon uuid := coalesce(new.salon_id, old.salon_id);
  v_dates timestamptz[] := array[]::timestamptz[];
begin
  if tg_op in ('UPDATE', 'DELETE') then v_dates := v_dates || old.starts_at; end if;
  if tg_op in ('INSERT', 'UPDATE') then v_dates := v_dates || new.starts_at; end if;
  if exists (
    select 1 from public.month_closings c
    where c.salon_id = v_salon
      and c.month = any (select date_trunc('month', d)::date from unnest(v_dates) d)
  ) then
    raise exception 'o mês deste atendimento já está fechado' using errcode = '23514';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger appointments_guard_closed
  before insert or update or delete on public.appointments
  for each row execute function public.guard_closed_month();

-- fechamento não pode ser editado nem apagado
create or replace function public.month_closings_immutable()
returns trigger language plpgsql set search_path = ''
as $$ begin raise exception 'fechamentos são imutáveis' using errcode = '42501'; end; $$;

create trigger month_closings_no_change
  before update or delete on public.month_closings
  for each row execute function public.month_closings_immutable();

-- mantém site_settings.updated_at
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = ''
as $$ begin new.updated_at := now(); return new; end; $$;

create trigger site_settings_touch
  before update on public.site_settings
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- RLS
alter table public.salons          enable row level security;
alter table public.members         enable row level security;
alter table public.professionals   enable row level security;
alter table public.clients         enable row level security;
alter table public.products        enable row level security;
alter table public.services        enable row level security;
alter table public.appointments    enable row level security;
alter table public.site_settings   enable row level security;
alter table public.month_closings  enable row level security;

-- salões: membros leem; só dono/gerente altera; criação só via create_salon()
create policy salons_select on public.salons for select to authenticated
  using (public.is_member(id));
create policy salons_update on public.salons for update to authenticated
  using (public.has_role(id, array['owner', 'manager']::public.member_role[]))
  with check (public.has_role(id, array['owner', 'manager']::public.member_role[]));

-- membros: cada um vê a própria linha e o dono vê/gerencia a equipe
create policy members_select on public.members for select to authenticated
  using (user_id = (select auth.uid()) or public.has_role(salon_id, array['owner']::public.member_role[]));
create policy members_manage on public.members for all to authenticated
  using (public.has_role(salon_id, array['owner']::public.member_role[]) and role <> 'owner')
  with check (public.has_role(salon_id, array['owner']::public.member_role[]) and role <> 'owner');

-- tabelas operacionais: qualquer membro lê e escreve dentro do próprio salão
do $$
declare t text;
begin
  foreach t in array array['professionals', 'clients', 'appointments'] loop
    execute format('create policy %I on public.%I for select to authenticated using (public.is_member(salon_id))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.is_member(salon_id))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.is_member(salon_id)) with check (public.is_member(salon_id))', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.is_member(salon_id))', t || '_delete', t);
  end loop;
end $$;

-- catálogo, produtos e site: leitura para todos os membros; escrita só dono/gerente
do $$
declare t text;
begin
  foreach t in array array['products', 'services', 'site_settings'] loop
    execute format('create policy %I on public.%I for select to authenticated using (public.is_member(salon_id))', t || '_select', t);
    execute format($p$create policy %I on public.%I for insert to authenticated with check (public.has_role(salon_id, array['owner','manager']::public.member_role[]))$p$, t || '_insert', t);
    execute format($p$create policy %I on public.%I for update to authenticated using (public.has_role(salon_id, array['owner','manager']::public.member_role[])) with check (public.has_role(salon_id, array['owner','manager']::public.member_role[]))$p$, t || '_update', t);
    execute format($p$create policy %I on public.%I for delete to authenticated using (public.has_role(salon_id, array['owner','manager']::public.member_role[]))$p$, t || '_delete', t);
  end loop;
end $$;

-- fechamentos: membros leem; criação apenas pela função close_month()
create policy month_closings_select on public.month_closings for select to authenticated
  using (public.is_member(salon_id));

-- ---------------------------------------------------------------- privilégios
revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from public, anon, authenticated;

grant select, update on public.salons to authenticated;
grant select, insert, update, delete on public.members, public.professionals, public.clients,
  public.products, public.services, public.appointments, public.site_settings to authenticated;
grant select on public.month_closings to authenticated;

grant execute on function public.is_member(uuid) to authenticated;
grant execute on function public.has_role(uuid, public.member_role[]) to authenticated;
grant execute on function public.create_salon(text, text) to authenticated;
grant execute on function public.close_month(uuid, date, jsonb) to authenticated;
-- única porta pública: a página do salão
grant execute on function public.get_public_site(text) to anon, authenticated;

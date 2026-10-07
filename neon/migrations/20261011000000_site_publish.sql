-- IKIZY (Neon): publicação do site do negócio e planos que o negócio vende às clientes.
-- Pré-requisitos: 20261008000000_init.sql e 20261009000000_billing.sql (usa has_access).
--
-- * site_settings.published: o site público só existe depois do primeiro "Publicar".
--   Os campos de site_settings SÃO a versão publicada; o rascunho fica só no navegador até publicar.
-- * client_plans: planos de assinatura do negócio (ex.: "Alongamento por assinatura"), exibidos na página pública
--   com a etiqueta "Novidade" quando is_new. A cobrança das clientes é combinada por WhatsApp (sem pagamento online).
-- * get_public_site(): passa a devolver só sites publicados e inclui os planos.

alter table public.site_settings
  add column published boolean not null default false,
  add column published_at timestamptz;

create table public.client_plans (
  id          uuid primary key default gen_random_uuid(),
  salon_id    uuid not null references public.salons(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 60),
  description text not null default '' check (char_length(description) <= 200),
  price       numeric(12,2) not null default 0 check (price >= 0),
  includes    text[] not null default '{}' check (cardinality(includes) <= 8),
  is_new      boolean not null default false,
  visible     boolean not null default true,
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);
create index client_plans_salon_idx on public.client_plans (salon_id, position);

alter table public.client_plans enable row level security;

-- leitura para todos os membros; escrita só dono/gerente (igual ao catálogo)
create policy client_plans_select on public.client_plans for select to authenticated
  using (public.is_member(salon_id));
create policy client_plans_insert on public.client_plans for insert to authenticated
  with check (public.has_role(salon_id, array['owner', 'manager']::public.member_role[]));
create policy client_plans_update on public.client_plans for update to authenticated
  using (public.has_role(salon_id, array['owner', 'manager']::public.member_role[]))
  with check (public.has_role(salon_id, array['owner', 'manager']::public.member_role[]));
create policy client_plans_delete on public.client_plans for delete to authenticated
  using (public.has_role(salon_id, array['owner', 'manager']::public.member_role[]));

-- sem acesso (assinatura vencida) o sistema fica só para leitura
create policy client_plans_billing_insert on public.client_plans as restrictive for insert to authenticated
  with check (public.has_access(salon_id));
create policy client_plans_billing_update on public.client_plans as restrictive for update to authenticated
  using (public.has_access(salon_id)) with check (public.has_access(salon_id));
create policy client_plans_billing_delete on public.client_plans as restrictive for delete to authenticated
  using (public.has_access(salon_id));

revoke all on public.client_plans from anonymous, authenticated;
grant select, insert, update, delete on public.client_plans to authenticated;

-- página pública: só negócios publicados; preços dos planos respeitam "mostrar preços"
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
    'plans', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', cp.name, 'description', cp.description, 'includes', to_jsonb(cp.includes),
        'is_new', cp.is_new,
        'price', case when ss.show_prices then cp.price else null end
      ) order by cp.position, cp.created_at)
      from public.client_plans cp where cp.salon_id = s.id and cp.visible
    ), '[]'::jsonb),
    'team', case when ss.show_team then coalesce((
      select jsonb_agg(jsonb_build_object('name', p.name, 'title', p.title) order by p.name)
      from public.professionals p where p.salon_id = s.id and p.active
    ), '[]'::jsonb) else '[]'::jsonb end
  )
  from public.salons s
  join public.site_settings ss on ss.salon_id = s.id
  where s.slug = lower(p_slug) and ss.published;
$$;

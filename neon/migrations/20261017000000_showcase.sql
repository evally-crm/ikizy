-- IKIZY (Neon): vitrine de produtos à venda e foto nos serviços.
-- Pré-requisitos: init, billing (has_access) e site_publish.
--
-- * site_photos: fotos reduzidas no navegador (data URL, até ~150 KB). Ficam no banco e a página pública
--   as busca separadas, por /api/photo?id=..., com cache longo (o id muda quando a foto muda).
-- * showcase_items: produtos que o negócio vende (nome, descrição, preço, foto). Não confundir com
--   public.products, que são os gastos internos usados no cálculo de margem.
-- * services.photo_id: foto opcional de cada serviço.
-- * get_public_site(): devolve a vitrine e o id da foto de cada serviço.
-- * get_public_photo(): devolve a foto só se o negócio estiver publicado; só o servidor chama.

create table public.site_photos (
  id          uuid primary key default gen_random_uuid(),
  salon_id    uuid not null references public.salons(id) on delete cascade,
  data        text not null check (data ~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$' and char_length(data) <= 200000),
  created_at  timestamptz not null default now(),
  -- permite referenciar (id, salon_id) e garantir que ninguém use a foto de outro negócio
  constraint site_photos_id_salon_key unique (id, salon_id)
);
create index site_photos_salon_idx on public.site_photos (salon_id);

create table public.showcase_items (
  id           uuid primary key default gen_random_uuid(),
  salon_id     uuid not null references public.salons(id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 60),
  description  text not null default '' check (char_length(description) <= 120),
  price        numeric(12,2) not null default 0 check (price >= 0),
  photo_id     uuid,
  visible      boolean not null default true,
  position     integer not null default 0,
  created_at   timestamptz not null default now(),
  foreign key (photo_id, salon_id) references public.site_photos (id, salon_id) on delete set null (photo_id)
);
create index showcase_items_salon_idx on public.showcase_items (salon_id, position);

alter table public.services
  add column photo_id uuid,
  add constraint services_photo_fkey foreign key (photo_id, salon_id)
    references public.site_photos (id, salon_id) on delete set null (photo_id);

-- ---------------------------------------------------------------- segurança (mesmo padrão do catálogo)
alter table public.site_photos enable row level security;
alter table public.showcase_items enable row level security;

create policy site_photos_select on public.site_photos for select to authenticated using (public.is_member(salon_id));
create policy site_photos_insert on public.site_photos for insert to authenticated
  with check (public.has_role(salon_id, array['owner', 'manager']::public.member_role[]));
create policy site_photos_delete on public.site_photos for delete to authenticated
  using (public.has_role(salon_id, array['owner', 'manager']::public.member_role[]));

create policy showcase_select on public.showcase_items for select to authenticated using (public.is_member(salon_id));
create policy showcase_insert on public.showcase_items for insert to authenticated
  with check (public.has_role(salon_id, array['owner', 'manager']::public.member_role[]));
create policy showcase_update on public.showcase_items for update to authenticated
  using (public.has_role(salon_id, array['owner', 'manager']::public.member_role[]))
  with check (public.has_role(salon_id, array['owner', 'manager']::public.member_role[]));
create policy showcase_delete on public.showcase_items for delete to authenticated
  using (public.has_role(salon_id, array['owner', 'manager']::public.member_role[]));

-- sem acesso (assinatura vencida) o sistema fica só para leitura
create policy site_photos_billing_insert on public.site_photos as restrictive for insert to authenticated
  with check (public.has_access(salon_id));
create policy site_photos_billing_delete on public.site_photos as restrictive for delete to authenticated
  using (public.has_access(salon_id));
create policy showcase_billing_insert on public.showcase_items as restrictive for insert to authenticated
  with check (public.has_access(salon_id));
create policy showcase_billing_update on public.showcase_items as restrictive for update to authenticated
  using (public.has_access(salon_id)) with check (public.has_access(salon_id));
create policy showcase_billing_delete on public.showcase_items as restrictive for delete to authenticated
  using (public.has_access(salon_id));

revoke all on public.site_photos, public.showcase_items from anonymous, authenticated;
grant select, insert, delete on public.site_photos to authenticated;
grant select, insert, update, delete on public.showcase_items to authenticated;

-- ---------------------------------------------------------------- página pública
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
        'id', sv.id, 'name', sv.name, 'category', sv.category, 'duration', sv.duration,
        'price', case when ss.show_prices then sv.price else null end,
        'photo', sv.photo_id
      ) order by sv.category, sv.name)
      from public.services sv where sv.salon_id = s.id and sv.visible
    ), '[]'::jsonb),
    'showcase', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', si.id, 'name', si.name, 'description', si.description,
        'price', case when ss.show_prices then si.price else null end,
        'photo', si.photo_id
      ) order by si.position, si.created_at)
      from public.showcase_items si where si.salon_id = s.id and si.visible
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
    ), '[]'::jsonb) else '[]'::jsonb end,
    'professionals', case when ss.online_booking then coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name) order by p.name)
      from public.professionals p where p.salon_id = s.id and p.active
    ), '[]'::jsonb) else '[]'::jsonb end
  )
  from public.salons s
  join public.site_settings ss on ss.salon_id = s.id
  where s.slug = lower(p_slug) and ss.published;
$$;

-- foto para a página pública: só de negócio publicado
create or replace function public.get_public_photo(p_id uuid)
returns text
language sql stable security definer set search_path = ''
as $$
  select ph.data
  from public.site_photos ph
  join public.site_settings ss on ss.salon_id = ph.salon_id
  where ph.id = p_id and ss.published;
$$;
revoke all on function public.get_public_photo(uuid) from public, anonymous, authenticated;

notify pgrst, 'reload schema';

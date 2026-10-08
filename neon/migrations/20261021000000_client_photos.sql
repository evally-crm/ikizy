-- IKIZY (Neon): fotos de antes e depois na ficha da cliente.
-- Pré-requisitos: init, billing (has_access) e client_file (unique (id, salon_id) em clients).
--
-- * client_photos: fotos reduzidas no navegador e guardadas como data URL.
--   `thumb` (até ~40 KB) carrega na lista; `data` (até ~350 KB) só quando a foto é aberta.
--   São dados sensíveis do atendimento: NÃO passam por get_public_photo nem por /api/photo,
--   só membros do salão leem (RLS), como as anotações.

create table public.client_photos (
  id          uuid primary key default gen_random_uuid(),
  salon_id    uuid not null references public.salons(id) on delete cascade,
  client_id   uuid not null,
  kind        text not null default 'antes' check (kind in ('antes', 'depois', 'outra')),
  caption     text not null default '' check (char_length(caption) <= 80),
  taken_on    date not null default current_date,
  thumb       text not null check (thumb ~ '^data:image/(jpeg|webp|png);base64,[A-Za-z0-9+/=]+$' and char_length(thumb) <= 60000),
  data        text not null check (data ~ '^data:image/(jpeg|webp|png);base64,[A-Za-z0-9+/=]+$' and char_length(data) <= 400000),
  created_at  timestamptz not null default now(),
  foreign key (client_id, salon_id) references public.clients (id, salon_id) on delete cascade
);
create index client_photos_client_idx on public.client_photos (salon_id, client_id, taken_on desc);

alter table public.client_photos enable row level security;

create policy client_photos_select on public.client_photos for select to authenticated
  using (public.is_member(salon_id));
create policy client_photos_insert on public.client_photos for insert to authenticated
  with check (public.is_member(salon_id));
create policy client_photos_update on public.client_photos for update to authenticated
  using (public.is_member(salon_id)) with check (public.is_member(salon_id));
create policy client_photos_delete on public.client_photos for delete to authenticated
  using (public.is_member(salon_id));

-- modo leitura quando o acesso acaba, como nas demais tabelas
create policy client_photos_billing_insert on public.client_photos as restrictive for insert to authenticated
  with check (public.has_access(salon_id));
create policy client_photos_billing_update on public.client_photos as restrictive for update to authenticated
  using (public.has_access(salon_id)) with check (public.has_access(salon_id));
create policy client_photos_billing_delete on public.client_photos as restrictive for delete to authenticated
  using (public.has_access(salon_id));

grant select, insert, update, delete on public.client_photos to authenticated;

notify pgrst, 'reload schema';

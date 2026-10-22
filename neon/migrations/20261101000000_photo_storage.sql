-- Fotos fora do banco (especificação 5.7): os arquivos vão para o Vercel Blob (loja privada "ikizy-fotos")
-- e o banco guarda só o caminho. Pré-requisitos: showcase, client_photos, site_branding, site_cover_address.
--
-- * site_photos.blob_path e client_photos.blob_path/thumb_path: caminho do arquivo na loja. As linhas antigas
--   (data URL em `data`/`thumb`) continuam valendo; uma linha tem um OU outro.
-- * o caminho sempre começa por salons/<id do negócio>/site/ ou /client/: ninguém aponta para a foto de outro negócio.
-- * logo e capa (site_settings.logo/cover) passam a aceitar o id de uma foto em site_photos, além da data URL antiga.
-- * get_public_photo() devolve a data URL antiga ou "blob:<caminho>" para o servidor buscar na loja.
--
-- Os arquivos são gravados pelo servidor (/api/photos/upload), que confere o perfil antes; a linha no banco
-- continua sendo gravada pelo app, com as mesmas regras de acesso (RLS) de antes.
-- Seguro para rodar de novo. TESTAR ANTES NUMA BRANCH DO NEON.

alter table public.site_photos
  add column if not exists blob_path text;
alter table public.site_photos alter column data drop not null;
alter table public.site_photos drop constraint if exists site_photos_source_check;
alter table public.site_photos add constraint site_photos_source_check check (
  (data is not null) <> (blob_path is not null)
  and (blob_path is null or (blob_path ~ '^salons/[0-9a-f-]{36}/site/[0-9a-f-]{36}\.(jpg|png|webp)$'
                             and starts_with(blob_path, 'salons/' || salon_id::text || '/site/')))
);
create unique index if not exists site_photos_blob_path_key on public.site_photos (blob_path) where blob_path is not null;

alter table public.client_photos
  add column if not exists blob_path text,
  add column if not exists thumb_path text;
alter table public.client_photos alter column data drop not null;
alter table public.client_photos alter column thumb drop not null;
alter table public.client_photos drop constraint if exists client_photos_source_check;
alter table public.client_photos add constraint client_photos_source_check check (
  (data is not null and thumb is not null and blob_path is null and thumb_path is null)
  or (data is null and thumb is null and blob_path is not null and thumb_path is not null
      and blob_path ~ '^salons/[0-9a-f-]{36}/client/[0-9a-f-]{36}\.(jpg|png|webp)$'
      and thumb_path ~ '^salons/[0-9a-f-]{36}/client/[0-9a-f-]{36}-mini\.(jpg|png|webp)$'
      and starts_with(blob_path, 'salons/' || salon_id::text || '/client/')
      and starts_with(thumb_path, 'salons/' || salon_id::text || '/client/'))
);

-- logo e capa: data URL antiga ou o id de uma foto do próprio negócio
alter table public.site_settings drop constraint if exists site_settings_logo_check;
alter table public.site_settings add constraint site_settings_logo_check check (
  logo is null
  or (logo ~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$' and char_length(logo) <= 150000)
  or logo ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
);
alter table public.site_settings drop constraint if exists site_settings_cover_check;
alter table public.site_settings add constraint site_settings_cover_check check (
  cover is null
  or (cover ~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$' and char_length(cover) <= 300000)
  or cover ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
);

-- foto da página pública: só de negócio publicado; o servidor entende os dois formatos
create or replace function public.get_public_photo(p_id uuid)
returns text
language sql stable security definer set search_path = ''
as $$
  select coalesce(ph.data, 'blob:' || ph.blob_path)
  from public.site_photos ph
  join public.site_settings ss on ss.salon_id = ph.salon_id
  where ph.id = p_id and ss.published;
$$;
revoke all on function public.get_public_photo(uuid) from public, anonymous, authenticated;

insert into public.schema_migrations (version) values ('20261101000000_photo_storage') on conflict (version) do nothing;

notify pgrst, 'reload schema';

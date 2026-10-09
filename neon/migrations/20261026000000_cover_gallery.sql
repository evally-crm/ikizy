-- IKIZY (Neon): capa do site também pode ser um fundo pronto da galeria ("capa:<id>"),
-- servido pelo próprio app em /capas/<id>.jpg (lista em apps/app/src/lib/covers.ts).
-- Pré-requisito: site_cover_address (coluna site_settings.cover).

alter table public.site_settings drop constraint if exists site_settings_cover_check;
alter table public.site_settings add constraint site_settings_cover_check check (
  cover is null
  or cover ~ '^capa:[a-z0-9-]{1,40}$'
  or (cover ~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$' and char_length(cover) <= 300000)
);

notify pgrst, 'reload schema';

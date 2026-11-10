-- IKIZY (Neon): capa sem foto ganha texturas (poá, onça, zebra, xadrez, listras), desenhadas nas cores da paleta.
-- "editorial" e "organico" saíram do editor, mas continuam aceitos para não quebrar quem já publicou (a página mostra a capa lisa).

alter table public.site_settings drop constraint if exists site_settings_cover_style_check;
alter table public.site_settings add constraint site_settings_cover_style_check
  check (cover_style in ('sobrio', 'poa', 'onca', 'zebra', 'xadrez', 'listras', 'editorial', 'organico'));

notify pgrst, 'reload schema';

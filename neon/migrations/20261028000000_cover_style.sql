-- IKIZY (Neon): estilo da capa do site (o que fica atrás do título quando não há foto).
-- Cinco estilos fixos, todos com as cores da paleta escolhida. Aditiva: quem já publicou continua "sobrio".
-- get_public_site() devolve to_jsonb(site_settings), então a coluna chega à página pública sem mudar a função.

alter table public.site_settings
  add column cover_style text not null default 'sobrio'
    constraint site_settings_cover_style_check
    check (cover_style in ('sobrio', 'poa', 'xadrez', 'editorial', 'organico'));

notify pgrst, 'reload schema';

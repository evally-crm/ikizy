-- IKIZY (Neon): tema (fundo) e fonte dos títulos da página pública.
-- Opções prontas, sem personalização livre: tema claro/bege/escuro e fonte moderna/elegante/forte.
-- get_public_site() devolve a linha inteira de site_settings, então os campos novos chegam à página sozinhos.

alter table public.site_settings
  add column theme text not null default 'claro'    check (theme in ('claro', 'bege', 'escuro')),
  add column font  text not null default 'moderna'  check (font  in ('moderna', 'elegante', 'forte'));

notify pgrst, 'reload schema';

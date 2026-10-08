-- IKIZY (Neon): uma paleta escura, "Preto e branco" (fundo preto, texto e botões brancos).
-- Só amplia a lista aceita; nenhum site muda.

alter table public.site_settings drop constraint site_settings_palette_check;

alter table public.site_settings
  add constraint site_settings_palette_check
    check (palette in ('branco-bege', 'rosa-branco', 'bege-preto', 'gelo-branco', 'marinho-branco', 'vinho-preto', 'creme-pinho', 'preto-branco'));

notify pgrst, 'reload schema';

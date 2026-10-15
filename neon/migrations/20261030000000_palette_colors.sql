-- IKIZY (Neon): paletas nas oito cores escolhidas (vermelho, rosa bebê, verde musgo, rosa, roxo, azul, preto, marrom).
-- Só amplia a lista aceita: os nomes antigos continuam valendo (o app e a página traduzem para a cor atual mais
-- próxima), então nenhum site muda de uma vez e o sistema já publicado continua salvando sem erro.
-- Novos sites nascem no vermelho.

alter table public.site_settings drop constraint site_settings_palette_check;

alter table public.site_settings
  add constraint site_settings_palette_check
    check (palette in (
      'vermelho', 'rosa-bebe', 'verde-musgo', 'rosa', 'roxo', 'azul', 'preto', 'marrom',
      'branco-bege', 'rosa-branco', 'bege-preto', 'gelo-branco', 'marinho-branco', 'vinho-preto', 'creme-pinho', 'preto-branco'
    ));

alter table public.site_settings alter column palette set default 'vermelho';

notify pgrst, 'reload schema';

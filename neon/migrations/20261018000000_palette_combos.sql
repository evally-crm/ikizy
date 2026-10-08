-- IKIZY (Neon): paletas reduzidas às combinações escolhidas para o produto (duas cores cada).
-- branco-bege, rosa-branco, bege-preto, gelo-branco, marinho-branco, vinho-preto (padrão) e creme-pinho.
-- Sites com as paletas anteriores passam para a combinação mais próxima.

alter table public.site_settings drop constraint site_settings_palette_check;

update public.site_settings
set palette = case palette
  when 'bordo' then 'vinho-preto'
  when 'rubi' then 'vinho-preto'
  when 'vinho' then 'vinho-preto'
  when 'toledo' then 'vinho-preto'
  when 'rose' then 'rosa-branco'
  when 'cafe' then 'bege-preto'
  when 'noir' then 'bege-preto'
  when 'floresta' then 'creme-pinho'
  when 'marinho' then 'marinho-branco'
  else palette
end;

alter table public.site_settings
  alter column palette set default 'vinho-preto',
  add constraint site_settings_palette_check
    check (palette in ('branco-bege', 'rosa-branco', 'bege-preto', 'gelo-branco', 'marinho-branco', 'vinho-preto', 'creme-pinho'));

notify pgrst, 'reload schema';

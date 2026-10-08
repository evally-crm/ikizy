-- IKIZY (Neon): paleta fixa do site, no lugar de cor + tema escolhidos separadamente (e da cor livre).
-- Paletas prontas: bordo, rubi, vinho, rose, cafe, floresta, marinho, noir, toledo.
-- Sites que já existiam mantêm o mesmo visual: escuro vira noir, bege vira cafe e, no claro, vale a cor que tinham.
-- As colunas antigas (accent, accent_color, theme) ficam sem uso no app; a página pública ainda as entende se palette estiver vazia.

alter table public.site_settings add column palette text;

update public.site_settings
set palette = case
  when theme = 'escuro' then 'noir'
  when theme = 'bege' then 'cafe'
  else accent::text
end;

alter table public.site_settings
  alter column palette set default 'bordo',
  alter column palette set not null,
  add constraint site_settings_palette_check
    check (palette in ('bordo', 'rubi', 'vinho', 'rose', 'cafe', 'floresta', 'marinho', 'noir', 'toledo'));

update public.site_settings set accent_color = null where accent_color is not null;

notify pgrst, 'reload schema';

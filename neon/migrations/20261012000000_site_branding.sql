-- IKIZY (Neon): identidade visual do site do negócio.
-- * logo: imagem pequena (o app reduz para no máximo 256px) guardada como data URL; aparece na página pública.
-- * accent_color: cor de destaque própria (#rrggbb). Vazia = usa a cor escolhida em "accent".
-- get_public_site() já devolve a linha inteira de site_settings, então os campos novos chegam à página sozinhos.

alter table public.site_settings
  add column logo text check (logo is null or (logo ~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$' and char_length(logo) <= 150000)),
  add column accent_color text check (accent_color is null or accent_color ~ '^#[0-9a-fA-F]{6}$');

notify pgrst, 'reload schema';

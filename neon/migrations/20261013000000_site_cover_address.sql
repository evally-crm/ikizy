-- IKIZY (Neon): foto de capa e endereço físico do salão na página pública.
-- * cover: foto grande do topo do site (o app reduz para no máximo 1000px antes de enviar), como data URL.
-- * address: endereço do salão, mostrado na página com link para o mapa.
-- get_public_site() devolve a linha inteira de site_settings, então os campos novos chegam à página sozinhos.

alter table public.site_settings
  add column cover text check (cover is null or (cover ~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$' and char_length(cover) <= 300000)),
  add column address text not null default '' check (char_length(address) <= 120);

notify pgrst, 'reload schema';

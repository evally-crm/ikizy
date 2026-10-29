-- IKIZY (Neon): quem pediu para sair da lista da landing (link "Não quero receber" no e-mail de apresentação).
--
--   * leads.unsubscribed_at: preenchido quando a pessoa sai da lista. Nenhum e-mail promocional vai para quem tem a data.
--
-- Seguro para rodar de novo. Só acrescenta uma coluna.

alter table public.leads add column if not exists unsubscribed_at timestamptz;

insert into public.schema_migrations (version) values ('20261103000000_leads_unsubscribe') on conflict (version) do nothing;

notify pgrst, 'reload schema';

-- IKIZY (Neon): lembretes por e-mail de fim de teste e de acesso (R-103, E8, E10, E11).
--
--   * subscriptions.notify_email: e-mail da dona para os avisos de cobrança. É gravado pelo servidor a partir do
--     login confirmado (POST /api/account/sync-email), nunca pelo navegador direto.
--   * email_log: um registro por e-mail enviado; a chave única impede mandar o mesmo aviso duas vezes.
--
-- Seguro para rodar de novo. TESTAR ANTES NUMA BRANCH DO NEON.

alter table public.subscriptions
  add column if not exists notify_email text check (notify_email is null or char_length(notify_email) <= 254);

create table if not exists public.email_log (
  key       text primary key check (char_length(key) <= 200),
  salon_id  uuid references public.salons(id) on delete cascade,
  to_email  text not null,
  template  text not null,
  sent_at   timestamptz not null default now()
);
create index if not exists email_log_salon_idx on public.email_log (salon_id, sent_at desc);
alter table public.email_log enable row level security;
revoke all on public.email_log from anonymous, authenticated;

insert into public.schema_migrations (version) values ('20261027000000_email_reminders') on conflict (version) do nothing;

notify pgrst, 'reload schema';

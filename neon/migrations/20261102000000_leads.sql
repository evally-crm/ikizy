-- IKIZY (Neon): e-mails deixados na landing ("Vamos construir uma rotina melhor?").
--
--   * leads: um registro por e-mail (sempre em minúsculas). Gravado só pelo servidor (POST /api/lead), nunca pelo
--     navegador direto. welcomed_at marca quando o e-mail de apresentação saiu; se o envio falhar, fica nulo.
--
-- Seguro para rodar de novo. TESTAR ANTES NUMA BRANCH DO NEON.

create table if not exists public.leads (
  email       text primary key check (char_length(email) between 3 and 254 and email = lower(email)),
  source      text not null default 'landing' check (char_length(source) <= 40),
  created_at  timestamptz not null default now(),
  welcomed_at timestamptz
);
create index if not exists leads_created_idx on public.leads (created_at desc);
alter table public.leads enable row level security;
revoke all on public.leads from anonymous, authenticated;

insert into public.schema_migrations (version) values ('20261102000000_leads') on conflict (version) do nothing;

notify pgrst, 'reload schema';

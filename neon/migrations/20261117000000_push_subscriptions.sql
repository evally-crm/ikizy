-- IKIZY (Neon): avisos no celular e no computador (Web Push) de pedido novo pelo site.
--
--   push_subscriptions: um registro por aparelho que a pessoa autorizou. Só o servidor lê e grava (conexão de dono):
--   o `endpoint` e as chaves são segredos de entrega, então nenhum perfil do app tem acesso.
--   Cai junto quando o negócio é apagado (on delete cascade); a pessoa que sai da equipe leva os seus registros embora (feito no servidor).
--
-- Seguro para rodar de novo. TESTAR ANTES NA BRANCH DEV DO NEON (npm run db:migrate:dev).

create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  salon_id    uuid not null references public.salons(id) on delete cascade,
  endpoint    text not null unique check (char_length(endpoint) between 20 and 1000),
  p256dh      text not null check (char_length(p256dh) between 20 and 200),
  auth        text not null check (char_length(auth) between 10 and 100),
  user_agent  text check (user_agent is null or char_length(user_agent) <= 300),
  created_at  timestamptz not null default now()
);
create index if not exists push_subscriptions_salon_idx on public.push_subscriptions (salon_id);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anonymous, authenticated;

insert into public.schema_migrations (version) values ('20261117000000_push_subscriptions') on conflict (version) do nothing;

notify pgrst, 'reload schema';

-- IKIZY (Neon): ciclo de vida da conta (docs/AUDITORIA-2026-11-16.md, itens 1.3, 1.7 e 1.8).
--
--   1. Exclusão com espera: a dona pede, o negócio fica "agendado para exclusão" por 7 dias e uma tarefa diária apaga
--      de vez quando o prazo passa. Nesse meio tempo ela pode cancelar. As colunas são só do servidor.
--   2. audit_log: registro de quem apagou o quê (ações do master, pedidos e cancelamentos da dona, limpezas automáticas).
--      Não aponta para `salons` de propósito: o registro tem de sobreviver ao negócio apagado.
--
-- Seguro para rodar de novo. TESTAR ANTES NA BRANCH DEV DO NEON (npm run db:migrate:dev).

-- ---------------------------------------------------------------- 1. exclusão com espera
alter table public.salons
  add column if not exists deletion_requested_at   timestamptz,
  add column if not exists deletion_scheduled_at   timestamptz,
  -- a cobrança no cartão foi pausada (cancela no fim do período) só por causa da exclusão: se ela desistir, volta
  add column if not exists deletion_resume_billing boolean not null default false;

alter table public.salons drop constraint if exists salons_deletion_pair;
alter table public.salons add constraint salons_deletion_pair
  check ((deletion_requested_at is null) = (deletion_scheduled_at is null));

create index if not exists salons_deletion_due_idx on public.salons (deletion_scheduled_at) where deletion_scheduled_at is not null;

-- quem está logada só altera nome e endereço por aqui; o pedido de exclusão passa só pelo servidor
revoke update on public.salons from authenticated;
grant update (name, slug) on public.salons to authenticated;

-- ---------------------------------------------------------------- 2. registro de ações
create table if not exists public.audit_log (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  actor_kind  text not null check (actor_kind in ('admin', 'owner', 'system')),
  actor_id    uuid,
  actor_email text check (actor_email is null or char_length(actor_email) <= 254),
  action      text not null check (char_length(action) between 1 and 60),
  salon_id    uuid,
  salon_name  text,
  salon_slug  text,
  details     jsonb not null default '{}'::jsonb
);
create index if not exists audit_log_at_idx on public.audit_log (at desc);
create index if not exists audit_log_salon_idx on public.audit_log (salon_id, at desc);
alter table public.audit_log enable row level security;
revoke all on public.audit_log from anonymous, authenticated;

insert into public.schema_migrations (version) values ('20261116000000_account_lifecycle') on conflict (version) do nothing;

notify pgrst, 'reload schema';

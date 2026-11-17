-- IKIZY (Neon): cortesia — negócio com acesso sem vencimento e sem cobrança (a conta do master da IKIZY).
--
--   * subscriptions.complimentary: quando true, has_access e site_online são sempre verdadeiros, seja qual for access_until.
--   * os avisos de cobrança e a limpeza de negócios vencidos ignoram essas linhas (api/_lib/runtime.ts).
--   * quem marca é o script `npm run db:cortesia` (por e-mail da dona), nunca o navegador: a tabela continua só leitura para ele.
--
-- Seguro para rodar de novo. TESTAR ANTES NA BRANCH DEV DO NEON (npm run db:migrate:dev).

alter table public.subscriptions add column if not exists complimentary boolean not null default false;

create or replace function public.has_access(p_salon uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((select s.complimentary or s.access_until > now() from public.subscriptions s where s.salon_id = p_salon), false);
$$;
revoke all on function public.has_access(uuid) from public, anonymous;
grant execute on function public.has_access(uuid) to authenticated;

create or replace function public.site_online(p_salon uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((select s.complimentary or s.access_until + interval '7 days' > now() from public.subscriptions s where s.salon_id = p_salon), false);
$$;
revoke all on function public.site_online(uuid) from public, anonymous;
grant execute on function public.site_online(uuid) to authenticated;

insert into public.schema_migrations (version) values ('20261117130000_complimentary') on conflict (version) do nothing;

notify pgrst, 'reload schema';

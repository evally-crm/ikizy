-- IKIZY (Neon): Fase 1 do lançamento (docs/ESPECIFICACAO-PRODUCAO.md, seção 4).
--
--   1. controle de migrations (schema_migrations): daqui em diante o script registra o que já foi aplicado
--   2. limpeza: campanhas de WhatsApp aplicadas fora do repositório (sem código, vazias) e a fidelidade (tela removida)
--   3. atendimentos: origem (sistema ou site) e trava no banco contra dois atendimentos da mesma profissional
--      no mesmo horário (R-53); o agendamento online passa a gravar a origem "site"
--   4. slug_available(): o cadastro confere o link do negócio enquanto a pessoa digita (R-10)
--
-- Seguro para rodar de novo (if exists / if not exists). Rodar dentro de begin ... commit.

-- ---------------------------------------------------------------- 1. controle de migrations
create table if not exists public.schema_migrations (
  version    text primary key,
  applied_at timestamptz not null default now()
);
alter table public.schema_migrations enable row level security;
revoke all on public.schema_migrations from anonymous, authenticated;

-- tudo que veio antes já está aplicado em produção
insert into public.schema_migrations (version) values
  ('20261008000000_init'), ('20261008000001_reserved_slugs'), ('20261009000000_billing'),
  ('20261010000000_working_hours'), ('20261011000000_finance'), ('20261011000000_site_publish'),
  ('20261012000000_site_branding'), ('20261013000000_site_cover_address'), ('20261014000000_online_booking'),
  ('20261015000000_site_theme_font'), ('20261016000000_site_palette'), ('20261017000000_showcase'),
  ('20261018000000_palette_combos'), ('20261019000000_palette_dark'), ('20261020000000_client_file'),
  ('20261021000000_client_photos'), ('20261022000000_category_outros'), ('20261023000000_plan_choice')
on conflict (version) do nothing;

-- ---------------------------------------------------------------- 2. limpeza
-- campanhas de WhatsApp: tabelas e funções criadas direto no banco, sem migration nem código (todas vazias)
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'campaign_month', 'campaign_quota', 'create_offer_campaign', 'cancel_offer_campaign', 'add_campaign_credits',
      'claim_campaign_messages', 'finish_campaign_message', 'requeue_campaign_message',
      'pause_salon_campaigns', 'resume_salon_campaigns', 'opt_out_offers'
    )
  loop
    execute format('drop function if exists %s cascade', f.sig);
  end loop;
end $$;
drop table if exists public.campaign_messages cascade;
drop table if exists public.campaigns cascade;
drop table if exists public.campaign_credits cascade;
drop table if exists public.whatsapp_instances cascade;
alter table public.clients drop column if exists offers_opt_out_at;
do $$ begin
  if exists (select 1 from pg_type where typname = 'campaign_status' and typnamespace = 'public'::regnamespace) then
    drop type public.campaign_status;
  end if;
end $$;

-- fidelidade: a tela foi removida (commit 2e5e901)
drop table if exists public.loyalty_entries cascade;
drop table if exists public.loyalty_settings cascade;

-- ---------------------------------------------------------------- 3. atendimentos
do $$ begin
  if not exists (select 1 from pg_type where typname = 'appointment_origin' and typnamespace = 'public'::regnamespace) then
    create type public.appointment_origin as enum ('sistema', 'site');
  end if;
end $$;
alter table public.appointments add column if not exists origin public.appointment_origin not null default 'sistema';

-- trava de horário: a mesma profissional não tem dois atendimentos ativos que se sobrepõem.
-- timestamptz + interval não é "imutável" para o Postgres (por causa de dias/meses); com minutos é seguro.
create extension if not exists btree_gist;
create or replace function public.appointment_range(p_start timestamptz, p_minutes integer)
returns tstzrange
language sql immutable parallel safe set search_path = ''
as $$ select tstzrange(p_start, p_start + make_interval(mins => p_minutes), '[)') $$;

alter table public.appointments drop constraint if exists appointments_no_overlap;
alter table public.appointments
  add constraint appointments_no_overlap
  exclude using gist (professional_id with =, public.appointment_range(starts_at, duration) with &&)
  where (status in ('pendente', 'confirmado', 'atendimento', 'concluido'));

-- o agendamento online grava a origem "site" (o resto da função é igual à de 20261014000000_online_booking)
do $$
declare v_def text;
begin
  select pg_get_functiondef('public.book_appointment(text, uuid, uuid, date, integer, text, text)'::regprocedure) into v_def;
  if v_def not like '%origin%' then
    v_def := replace(
      v_def,
      'insert into public.appointments (salon_id, client_id, professional_id, service_id, service_name, starts_at, duration, price, status)',
      'insert into public.appointments (salon_id, client_id, professional_id, service_id, service_name, starts_at, duration, price, status, origin)'
    );
    v_def := replace(
      v_def,
      'values (v_salon, v_client, v_pro, v_svc.id, v_svc.name, v_start, v_svc.duration, v_svc.price, ''pendente'')',
      'values (v_salon, v_client, v_pro, v_svc.id, v_svc.name, v_start, v_svc.duration, v_svc.price, ''pendente'', ''site'')'
    );
    if v_def not like '%''site''%' then
      raise exception 'book_appointment mudou: ajuste esta migration';
    end if;
    execute v_def;
  end if;
end $$;
-- a definição recriada mantém as permissões (só o servidor chama)
revoke all on function public.book_appointment(text, uuid, uuid, date, integer, text, text) from public, anonymous, authenticated;

-- ---------------------------------------------------------------- 4. link do negócio livre?
-- só responde sim/não: não revela nada além do que o próprio cadastro já revelaria ao tentar criar
create or replace function public.slug_available(p_slug text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select lower(p_slug) ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
     and char_length(p_slug) between 3 and 40
     and lower(p_slug) <> all (array[
       'www', 'app', 'api', 'admin', 'painel', 'dashboard', 'login', 'cadastro', 'mail', 'email', 'smtp',
       'suporte', 'ajuda', 'help', 'blog', 'status', 'docs', 'static', 'assets', 'cdn', 'ikizy', 'dev',
       'staging', 'test', 'teste', 'demo', 'precos', 'recursos', 'sobre', 'contato'
     ])
     and not exists (select 1 from public.salons s where s.slug = lower(p_slug));
$$;
revoke all on function public.slug_available(text) from public, anonymous;
grant execute on function public.slug_available(text) to authenticated;

insert into public.schema_migrations (version) values ('20261024000000_fase1') on conflict (version) do nothing;

notify pgrst, 'reload schema';

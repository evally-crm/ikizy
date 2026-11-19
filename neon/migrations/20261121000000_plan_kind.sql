-- IKIZY (Neon): planos do site viram "planos, pacotes e promoções".
-- Pré-requisito: 20261117120000_site_offline.sql (última versão de get_public_site).
--
-- * client_plans.kind: 'assinatura' (preço por mês, como sempre foi), 'pacote' ou 'promocao' (preço único).
-- * client_plans.old_price: o preço "de" (riscado) de um pacote ou promoção.
-- * client_plans.valid_until: último dia da oferta; depois dele o item some do site sozinho.
-- Só acrescenta colunas com padrão: o app antigo continua funcionando com a migration aplicada.

alter table public.client_plans
  add column if not exists kind text not null default 'assinatura',
  add column if not exists old_price numeric(12,2),
  add column if not exists valid_until date;

do $$ begin
  alter table public.client_plans add constraint client_plans_kind_check check (kind in ('assinatura', 'pacote', 'promocao'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.client_plans add constraint client_plans_old_price_check check (old_price is null or old_price >= 0);
exception when duplicate_object then null; end $$;

create or replace function public.get_public_site(p_slug text)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'name', s.name,
    'slug', s.slug,
    'settings', to_jsonb(ss) - 'salon_id' - 'updated_at',
    'services', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', sv.id, 'name', sv.name, 'category', sv.category, 'duration', sv.duration,
        'price', case when ss.show_prices then sv.price else null end,
        'photo', sv.photo_id
      ) order by sv.category, sv.name)
      from public.services sv where sv.salon_id = s.id and sv.visible
    ), '[]'::jsonb),
    'showcase', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', si.id, 'name', si.name, 'description', si.description,
        'price', case when ss.show_prices then si.price else null end,
        'photo', si.photo_id
      ) order by si.position, si.created_at)
      from public.showcase_items si where si.salon_id = s.id and si.visible
    ), '[]'::jsonb),
    'plans', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', cp.name, 'description', cp.description, 'includes', to_jsonb(cp.includes),
        'is_new', cp.is_new,
        'kind', cp.kind,
        'valid_until', cp.valid_until,
        'price', case when ss.show_prices then cp.price else null end,
        'old_price', case when ss.show_prices then cp.old_price else null end
      ) order by cp.position, cp.created_at)
      from public.client_plans cp
      where cp.salon_id = s.id and cp.visible
        and (cp.valid_until is null or cp.valid_until >= (now() at time zone 'America/Sao_Paulo')::date)
    ), '[]'::jsonb),
    'team', case when ss.show_team then coalesce((
      select jsonb_agg(jsonb_build_object('name', p.name, 'title', p.title) order by p.name)
      from public.professionals p where p.salon_id = s.id and p.active
    ), '[]'::jsonb) else '[]'::jsonb end,
    'professionals', case when ss.online_booking and public.has_access(s.id) then coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name) order by p.name)
      from public.professionals p where p.salon_id = s.id and p.active
    ), '[]'::jsonb) else '[]'::jsonb end
  )
  from public.salons s
  join public.site_settings ss on ss.salon_id = s.id
  where s.slug = lower(p_slug) and ss.published and public.site_online(s.id);
$$;

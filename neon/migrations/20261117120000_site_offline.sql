-- IKIZY (Neon): o site público sai do ar 7 dias depois que o acesso vence.
--
--   * site_online(salão): access_until + 7 dias ainda no futuro (SITE_GRACE_DAYS em src/lib/plans.ts). No teste isso dá
--     37 dias; no Pix, o fim do período + 7; no cartão, o fim do período + 2 de tolerância (já em access_until) + 7.
--   * get_public_site / get_public_photo passam a exigir site_online. Nada é despublicado: quando a dona volta a pagar,
--     o site reaparece sozinho.
--   * entre o vencimento e os 7 dias o site continua no ar, mas sem o agendamento online (que já era recusado
--     por has_access): a lista de profissionais vem vazia e a página esconde o botão.
--   * get_offline_site(slug): nome do negócio publicado que está fora do ar, para a página "temporariamente fora do ar".
--
-- Seguro para rodar de novo. TESTAR ANTES NA BRANCH DEV DO NEON (npm run db:migrate:dev).

create or replace function public.site_online(p_salon uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((select s.access_until + interval '7 days' > now() from public.subscriptions s where s.salon_id = p_salon), false);
$$;
revoke all on function public.site_online(uuid) from public, anonymous;
grant execute on function public.site_online(uuid) to authenticated;

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
        'price', case when ss.show_prices then cp.price else null end
      ) order by cp.position, cp.created_at)
      from public.client_plans cp where cp.salon_id = s.id and cp.visible
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

create or replace function public.get_public_photo(p_id uuid)
returns text
language sql stable security definer set search_path = ''
as $$
  select coalesce(ph.data, 'blob:' || ph.blob_path)
  from public.site_photos ph
  join public.site_settings ss on ss.salon_id = ph.salon_id
  where ph.id = p_id and ss.published and public.site_online(ph.salon_id);
$$;
revoke all on function public.get_public_photo(uuid) from public, anonymous, authenticated;

create or replace function public.get_offline_site(p_slug text)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object('name', s.name)
  from public.salons s
  join public.site_settings ss on ss.salon_id = s.id
  where s.slug = lower(p_slug) and ss.published and not public.site_online(s.id);
$$;
revoke all on function public.get_offline_site(text) from public, anonymous, authenticated;

insert into public.schema_migrations (version) values ('20261117120000_site_offline') on conflict (version) do nothing;

notify pgrst, 'reload schema';

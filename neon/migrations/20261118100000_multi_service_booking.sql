-- IKIZY (Neon): mais de um serviço no mesmo pedido do site (ex.: mão + pé).
--
--   * get_booking_slots(): como get_available_slots(), mas para uma lista de serviços (até 4). Soma as durações e
--     procura um horário seguido com UMA profissional que faça todos os serviços da lista.
--   * book_services(): grava um atendimento por serviço, um logo depois do outro, com a mesma profissional
--     (o financeiro e as comissões continuam por serviço). Atendimentos do mesmo pedido têm o mesmo created_at.
--   * O limite de "3 pedidos em aberto por cliente" conta pedidos (created_at distintos), não atendimentos.
--   * As funções antigas (um serviço) ficam como estão: o app publicado antes desta versão continua funcionando.
--
-- Seguro para rodar de novo. TESTAR ANTES NA BRANCH DEV DO NEON (npm run db:migrate:dev).

-- horários livres para a lista de serviços: [{professional_id, professional, minute}]
create or replace function public.get_booking_slots(
  p_slug text, p_services uuid[], p_date date, p_professional uuid default null
)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_tz     constant text := 'America/Sao_Paulo';
  v_now    timestamp := (now() at time zone 'America/Sao_Paulo');
  v_salon  uuid;
  v_ss     public.site_settings;
  v_n      integer := coalesce(cardinality(p_services), 0);
  v_found  integer;
  v_dur    integer;
  v_result jsonb;
begin
  if v_n < 1 or v_n > 4 or (select count(distinct x) from unnest(p_services) x) <> v_n then
    return '[]'::jsonb;
  end if;

  select s.id into v_salon from public.salons s where s.slug = lower(p_slug);
  if v_salon is null then return '[]'::jsonb; end if;

  select * into v_ss from public.site_settings where salon_id = v_salon;
  if not found or not v_ss.published or not v_ss.online_booking or not public.has_access(v_salon) then
    return '[]'::jsonb;
  end if;

  select count(*), sum(sv.duration) into v_found, v_dur from public.services sv
  where sv.id = any(p_services) and sv.salon_id = v_salon and sv.visible;
  if v_found <> v_n or v_dur is null or v_dur > 600 then return '[]'::jsonb; end if;

  if p_date < v_now::date or p_date > v_now::date + v_ss.booking_window_days then
    return '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(
           jsonb_build_object('professional_id', x.pid, 'professional', x.pname, 'minute', x.m)
           order by x.m, x.pname), '[]'::jsonb)
    into v_result
  from (
    select distinct p.id as pid, p.name as pname, g.m
    from public.professionals p
    join public.working_hours wh
      on wh.professional_id = p.id and wh.salon_id = v_salon
     and wh.weekday = extract(dow from p_date)::int
    cross join lateral generate_series(wh.start_minute::int, wh.end_minute::int - v_dur, 30) as g(m)
    where p.salon_id = v_salon and p.active
      and (p_professional is null or p.id = p_professional)
      -- faz todos os serviços da lista (serviço sem lista de quem faz = todas fazem)
      and not exists (
        select 1 from unnest(p_services) sid
        where exists (select 1 from public.professional_services ps where ps.service_id = sid)
          and not exists (select 1 from public.professional_services ps where ps.service_id = sid and ps.professional_id = p.id)
      )
      and (p_date::timestamp + make_interval(mins => g.m)) >= v_now + make_interval(hours => v_ss.booking_notice_hours)
      and not exists (
        select 1 from public.appointments a
        where a.professional_id = p.id
          and a.status in ('pendente', 'confirmado', 'atendimento')
          and a.starts_at < ((p_date::timestamp + make_interval(mins => g.m + v_dur)) at time zone v_tz)
          and a.starts_at + make_interval(mins => a.duration) > ((p_date::timestamp + make_interval(mins => g.m)) at time zone v_tz)
      )
  ) x;

  return v_result;
end;
$$;

-- reserva da lista de serviços, na ordem escolhida pela cliente.
-- devolve {id, ids, starts_at, service ("Mão + Pé"), professional, price (total), duration (total)}
create or replace function public.book_services(
  p_slug text, p_services uuid[], p_professional uuid, p_date date, p_minute integer,
  p_name text, p_phone text
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_tz      constant text := 'America/Sao_Paulo';
  v_salon   uuid;
  v_name    text := btrim(coalesce(p_name, ''));
  v_digits  text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_n       integer := coalesce(cardinality(p_services), 0);
  v_svc     public.services;
  v_pro     uuid;
  v_pro_nm  text;
  v_client  uuid;
  v_start   timestamptz;
  v_at      timestamptz;
  v_id      uuid;
  v_ids     uuid[] := '{}';
  v_names   text[] := '{}';
  v_price   numeric := 0;
  v_dur     integer := 0;
  i         integer;
begin
  if char_length(v_name) < 2 or char_length(v_name) > 80 or char_length(v_digits) not between 10 and 13
     or p_minute is null or p_minute not between 0 and 1439 or p_date is null
     or v_n < 1 or v_n > 4 or (select count(distinct x) from unnest(p_services) x) <> v_n then
    raise exception 'invalid_input' using errcode = 'P0001';
  end if;

  select s.id into v_salon from public.salons s where s.slug = lower(p_slug);
  if v_salon is null then raise exception 'booking_disabled' using errcode = 'P0001'; end if;

  if not exists (
    select 1 from public.site_settings ss
    where ss.salon_id = v_salon and ss.published and ss.online_booking
  ) or not public.has_access(v_salon) then
    raise exception 'booking_disabled' using errcode = 'P0001';
  end if;

  if (select count(*) from public.services sv where sv.id = any(p_services) and sv.salon_id = v_salon and sv.visible) <> v_n then
    raise exception 'invalid_input' using errcode = 'P0001';
  end if;

  -- trava por salão: dois pedidos ao mesmo tempo passam um de cada vez e o segundo vê a vaga ocupada
  perform pg_advisory_xact_lock(hashtextextended(v_salon::text, 0));

  select (e ->> 'professional_id')::uuid, e ->> 'professional' into v_pro, v_pro_nm
  from jsonb_array_elements(public.get_booking_slots(p_slug, p_services, p_date, p_professional)) e
  where (e ->> 'minute')::int = p_minute
  order by e ->> 'professional'
  limit 1;
  if v_pro is null then raise exception 'slot_unavailable' using errcode = 'P0001'; end if;

  -- limite de abuso: no máximo 30 pedidos novos por hora no salão
  if (select count(distinct a.created_at) from public.appointments a
      where a.salon_id = v_salon and a.status = 'pendente' and a.created_at > now() - interval '1 hour') >= 30 then
    raise exception 'too_many' using errcode = 'P0001';
  end if;

  select c.id into v_client from public.clients c
  where c.salon_id = v_salon and regexp_replace(c.phone, '\D', '', 'g') = v_digits
  order by c.created_at limit 1;

  if v_client is null then
    insert into public.clients (salon_id, name, phone) values (v_salon, v_name, v_digits) returning id into v_client;
  end if;

  -- no máximo 3 pedidos futuros em aberto por cliente (os serviços de um pedido contam como um)
  if (select count(distinct a.created_at) from public.appointments a
      where a.client_id = v_client and a.status in ('pendente', 'confirmado') and a.starts_at > now()) >= 3 then
    raise exception 'too_many' using errcode = 'P0001';
  end if;

  v_start := (p_date::timestamp + make_interval(mins => p_minute)) at time zone v_tz;
  v_at := v_start;

  for i in 1 .. v_n loop
    select * into v_svc from public.services sv where sv.id = p_services[i] and sv.salon_id = v_salon;
    insert into public.appointments (salon_id, client_id, professional_id, service_id, service_name, starts_at, duration, price, status, origin)
    values (v_salon, v_client, v_pro, v_svc.id, v_svc.name, v_at, v_svc.duration, v_svc.price, 'pendente', 'site')
    returning id into v_id;
    v_ids := v_ids || v_id;
    v_names := v_names || v_svc.name;
    v_price := v_price + v_svc.price;
    v_dur := v_dur + v_svc.duration;
    v_at := v_at + make_interval(mins => v_svc.duration);
  end loop;

  return jsonb_build_object(
    'id', v_ids[1], 'ids', to_jsonb(v_ids), 'starts_at', v_start, 'service', array_to_string(v_names, ' + '),
    'professional', v_pro_nm, 'price', v_price, 'duration', v_dur
  );
end;
$$;

-- só o servidor chama (como as funções de um serviço)
revoke all on function public.get_booking_slots(text, uuid[], date, uuid) from public, anonymous, authenticated;
revoke all on function public.book_services(text, uuid[], uuid, date, integer, text, text) from public, anonymous, authenticated;

insert into public.schema_migrations (version) values ('20261118100000_multi_service_booking') on conflict (version) do nothing;

notify pgrst, 'reload schema';

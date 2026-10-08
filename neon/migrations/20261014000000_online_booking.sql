-- IKIZY (Neon): agendamento online pela página pública do negócio.
-- Pré-requisitos: init, billing (has_access), working_hours e site_publish.
--
-- * site_settings: chave "aceitar agendamentos online" e as regras (antecedência mínima e até quantos dias à frente).
-- * get_public_site(): passa a devolver o id de cada serviço e a lista de profissionais (só com o agendamento ligado).
-- * get_available_slots(): horários livres de um serviço num dia = horário de atendimento da profissional
--   menos o que já está marcado, de 30 em 30 minutos, respeitando antecedência e prazo.
-- * book_appointment(): reserva o horário. Trava por profissional (sem dois clientes na mesma vaga),
--   cria a cliente pelo telefone se for nova e grava o atendimento como "pendente" para o negócio confirmar.
--
-- As duas funções NÃO são abertas ao anônimo: só o servidor (api/booking) chama, depois de validar a entrada.
-- Fuso fixo: America/Sao_Paulo.

alter table public.site_settings
  add column online_booking        boolean not null default false,
  add column booking_notice_hours  integer not null default 2  check (booking_notice_hours between 0 and 168),
  add column booking_window_days   integer not null default 30 check (booking_window_days between 1 and 90);

-- página pública: ids dos serviços e profissionais (necessários para reservar)
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
        'price', case when ss.show_prices then sv.price else null end
      ) order by sv.category, sv.name)
      from public.services sv where sv.salon_id = s.id and sv.visible
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
    'professionals', case when ss.online_booking then coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name) order by p.name)
      from public.professionals p where p.salon_id = s.id and p.active
    ), '[]'::jsonb) else '[]'::jsonb end
  )
  from public.salons s
  join public.site_settings ss on ss.salon_id = s.id
  where s.slug = lower(p_slug) and ss.published;
$$;

-- horários livres: [{professional_id, professional, minute}] (minute = minutos desde 00:00 do dia)
create or replace function public.get_available_slots(
  p_slug text, p_service uuid, p_date date, p_professional uuid default null
)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_tz     constant text := 'America/Sao_Paulo';
  v_now    timestamp := (now() at time zone 'America/Sao_Paulo');
  v_salon  uuid;
  v_ss     public.site_settings;
  v_dur    integer;
  v_result jsonb;
begin
  select s.id into v_salon from public.salons s where s.slug = lower(p_slug);
  if v_salon is null then return '[]'::jsonb; end if;

  select * into v_ss from public.site_settings where salon_id = v_salon;
  if not found or not v_ss.published or not v_ss.online_booking or not public.has_access(v_salon) then
    return '[]'::jsonb;
  end if;

  select sv.duration into v_dur from public.services sv
  where sv.id = p_service and sv.salon_id = v_salon and sv.visible;
  if v_dur is null then return '[]'::jsonb; end if;

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

-- reserva: devolve {id, starts_at, service, professional, price}; erros com mensagem fixa (o servidor traduz)
create or replace function public.book_appointment(
  p_slug text, p_service uuid, p_professional uuid, p_date date, p_minute integer,
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
  v_svc     public.services;
  v_pro     uuid;
  v_pro_nm  text;
  v_client  uuid;
  v_start   timestamptz;
  v_id      uuid;
begin
  if char_length(v_name) < 2 or char_length(v_name) > 80 or char_length(v_digits) not between 10 and 13
     or p_minute is null or p_minute not between 0 and 1439 or p_date is null then
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

  select * into v_svc from public.services sv where sv.id = p_service and sv.salon_id = v_salon and sv.visible;
  if v_svc.id is null then raise exception 'invalid_input' using errcode = 'P0001'; end if;

  -- trava por salão: dois pedidos ao mesmo tempo passam um de cada vez e o segundo vê a vaga ocupada
  perform pg_advisory_xact_lock(hashtextextended(v_salon::text, 0));

  select (e ->> 'professional_id')::uuid, e ->> 'professional' into v_pro, v_pro_nm
  from jsonb_array_elements(public.get_available_slots(p_slug, p_service, p_date, p_professional)) e
  where (e ->> 'minute')::int = p_minute
  order by e ->> 'professional'
  limit 1;
  if v_pro is null then raise exception 'slot_unavailable' using errcode = 'P0001'; end if;

  -- limite de abuso: no máximo 30 pedidos novos por hora no salão
  if (select count(*) from public.appointments a
      where a.salon_id = v_salon and a.status = 'pendente' and a.created_at > now() - interval '1 hour') >= 30 then
    raise exception 'too_many' using errcode = 'P0001';
  end if;

  select c.id into v_client from public.clients c
  where c.salon_id = v_salon and regexp_replace(c.phone, '\D', '', 'g') = v_digits
  order by c.created_at limit 1;

  if v_client is null then
    insert into public.clients (salon_id, name, phone) values (v_salon, v_name, v_digits) returning id into v_client;
  end if;

  -- no máximo 3 pedidos futuros em aberto por cliente
  if (select count(*) from public.appointments a
      where a.client_id = v_client and a.status in ('pendente', 'confirmado') and a.starts_at > now()) >= 3 then
    raise exception 'too_many' using errcode = 'P0001';
  end if;

  v_start := (p_date::timestamp + make_interval(mins => p_minute)) at time zone v_tz;

  insert into public.appointments (salon_id, client_id, professional_id, service_id, service_name, starts_at, duration, price, status)
  values (v_salon, v_client, v_pro, v_svc.id, v_svc.name, v_start, v_svc.duration, v_svc.price, 'pendente')
  returning id into v_id;

  return jsonb_build_object(
    'id', v_id, 'starts_at', v_start, 'service', v_svc.name, 'professional', v_pro_nm,
    'price', v_svc.price, 'duration', v_svc.duration
  );
end;
$$;

revoke all on function public.get_available_slots(text, uuid, date, uuid) from public, anonymous, authenticated;
revoke all on function public.book_appointment(text, uuid, uuid, date, integer, text, text) from public, anonymous, authenticated;

notify pgrst, 'reload schema';

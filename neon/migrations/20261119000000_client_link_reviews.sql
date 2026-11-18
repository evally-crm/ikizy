-- IKIZY (Neon): link da cliente e avaliações.
--
--   * appointments.public_token: link secreto do pedido (64 letras e números, impossível de adivinhar).
--     Os serviços de um mesmo pedido do site (mão + pé) dividem o mesmo token; atendimento marcado na agenda
--     ganha um só dele. Os atendimentos que já existem ganham um agora.
--   * get_booking_status(token): o que a página da cliente mostra (status do pedido e a avaliação, se houver).
--   * reviews + submit_review(token, nota, texto): só depois de concluído, uma avaliação por pedido, publicada
--     na hora no site; a dona/gerente pode esconder (reviews.hidden).
--   * book_services() passa a gravar o mesmo token em todos os serviços do pedido e a devolver o token.
--
-- Seguro para rodar de novo. TESTAR ANTES NA BRANCH DEV DO NEON (npm run db:migrate:dev).

-- ---------------------------------------------------------------- link do pedido
create or replace function public.new_public_token()
returns text
language sql volatile set search_path = ''
as $$ select replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '') $$;

alter table public.appointments add column if not exists public_token text;
update public.appointments set public_token = public.new_public_token() where public_token is null;
alter table public.appointments alter column public_token set default public.new_public_token();
alter table public.appointments alter column public_token set not null;
create index if not exists appointments_public_token_idx on public.appointments (public_token);

-- ---------------------------------------------------------------- avaliações
create table if not exists public.reviews (
  id              uuid primary key default gen_random_uuid(),
  salon_id        uuid not null references public.salons(id) on delete cascade,
  public_token    text not null unique,
  -- o nome não é copiado: o site mostra o primeiro nome da ficha (some se a cliente for removida, LGPD)
  client_id       uuid references public.clients(id) on delete set null,
  professional_id uuid references public.professionals(id) on delete set null,
  service_name    text not null default '' check (char_length(service_name) <= 200),
  rating          smallint not null check (rating between 1 and 5),
  comment         text not null default '' check (char_length(comment) <= 500),
  hidden          boolean not null default false,
  created_at      timestamptz not null default now()
);
create index if not exists reviews_salon_idx on public.reviews (salon_id, created_at desc);

alter table public.reviews enable row level security;
revoke all on public.reviews from anonymous, authenticated;
grant select on public.reviews to authenticated;
grant update (hidden) on public.reviews to authenticated;

drop policy if exists reviews_select on public.reviews;
drop policy if exists reviews_update on public.reviews;
-- a equipe vê as avaliações; só dona e gerente escondem ou mostram de novo
create policy reviews_select on public.reviews for select to authenticated
  using (public.is_member(salon_id));
create policy reviews_update on public.reviews for update to authenticated
  using (public.has_role(salon_id, array['owner','manager']::public.member_role[]))
  with check (public.has_role(salon_id, array['owner','manager']::public.member_role[]));

-- ---------------------------------------------------------------- página da cliente
-- null se o token não existe. status do pedido: pendente, confirmado, concluido, cancelado ou faltou
create or replace function public.get_booking_status(p_token text)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_salon  uuid;
  v_items  jsonb;
  v_state  text;
  v_review jsonb;
begin
  if p_token is null or p_token !~ '^[a-f0-9]{64}$' then return null; end if;

  select a.salon_id into v_salon from public.appointments a where a.public_token = p_token limit 1;
  if v_salon is null then return null; end if;

  select jsonb_agg(jsonb_build_object(
           'service', a.service_name, 'starts_at', a.starts_at, 'duration', a.duration,
           'professional', p.name, 'status', a.status) order by a.starts_at),
         case
           when bool_and(a.status = 'cancelado') then 'cancelado'
           when bool_or(a.status = 'pendente') then 'pendente'
           when bool_and(a.status in ('concluido', 'cancelado')) and bool_or(a.status = 'concluido') then 'concluido'
           when bool_and(a.status in ('faltou', 'cancelado')) then 'faltou'
           else 'confirmado'
         end
    into v_items, v_state
  from public.appointments a
  left join public.professionals p on p.id = a.professional_id
  where a.public_token = p_token;

  select jsonb_build_object('rating', r.rating, 'comment', r.comment, 'created_at', r.created_at)
    into v_review
  from public.reviews r where r.public_token = p_token;

  return jsonb_build_object(
    'salon', (select jsonb_build_object('name', s.name, 'slug', s.slug, 'whatsapp', coalesce(ss.whatsapp, ''))
              from public.salons s left join public.site_settings ss on ss.salon_id = s.id where s.id = v_salon),
    'client', (select split_part(btrim(c.name), ' ', 1) from public.appointments a join public.clients c on c.id = a.client_id
               where a.public_token = p_token limit 1),
    'status', v_state,
    'items', v_items,
    'review', v_review
  );
end;
$$;

-- grava a avaliação; erros com mensagem fixa: not_found, not_done, already_reviewed, invalid_input
create or replace function public.submit_review(p_token text, p_rating integer, p_comment text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_a       public.appointments;
  v_names   text;
  v_comment text := btrim(regexp_replace(coalesce(p_comment, ''), '\s+', ' ', 'g'));
begin
  if p_token is null or p_token !~ '^[a-f0-9]{64}$' then raise exception 'not_found' using errcode = 'P0001'; end if;
  if p_rating is null or p_rating not between 1 and 5 or char_length(v_comment) > 500 then
    raise exception 'invalid_input' using errcode = 'P0001';
  end if;

  -- o serviço concluído do pedido (o primeiro, em pedidos com vários)
  select * into v_a from public.appointments a
  where a.public_token = p_token and a.status = 'concluido'
  order by a.starts_at limit 1;
  if v_a.id is null then
    if exists (select 1 from public.appointments a where a.public_token = p_token) then
      raise exception 'not_done' using errcode = 'P0001';
    end if;
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.reviews r where r.public_token = p_token) then
    raise exception 'already_reviewed' using errcode = 'P0001';
  end if;

  select string_agg(a.service_name, ' + ' order by a.starts_at) into v_names
  from public.appointments a where a.public_token = p_token and a.status = 'concluido';

  insert into public.reviews (salon_id, public_token, client_id, professional_id, service_name, rating, comment)
  values (
    v_a.salon_id, p_token, v_a.client_id, v_a.professional_id, left(coalesce(v_names, ''), 200), p_rating, v_comment
  );

  return jsonb_build_object('rating', p_rating, 'comment', v_comment);
end;
$$;

-- avaliações que aparecem no site: média, total e as mais recentes com texto
create or replace function public.get_public_reviews(p_slug text)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'count', count(r.id),
    'average', round(avg(r.rating)::numeric, 1),
    'latest', coalesce((
      select jsonb_agg(x order by x.created_at desc) from (
        select case when c.name is null or c.name = 'Cliente removida' then '' else split_part(btrim(c.name), ' ', 1) end as name,
               r2.service_name as service, r2.rating, r2.comment, r2.created_at
        from public.reviews r2
        left join public.clients c on c.id = r2.client_id
        where r2.salon_id = s.id and not r2.hidden and r2.comment <> ''
        order by r2.created_at desc limit 6
      ) x), '[]'::jsonb)
  )
  from public.salons s
  left join public.reviews r on r.salon_id = s.id and not r.hidden
  where s.slug = lower(p_slug)
  group by s.id;
$$;

revoke all on function public.get_booking_status(text) from public, anonymous, authenticated;
revoke all on function public.submit_review(text, integer, text) from public, anonymous, authenticated;
revoke all on function public.get_public_reviews(text) from public, anonymous, authenticated;
revoke all on function public.new_public_token() from public, anonymous;

-- ---------------------------------------------------------------- pedido do site: um token para o pedido todo
do $$
declare v_def text;
begin
  select pg_get_functiondef('public.book_services(text, uuid[], uuid, date, integer, text, text)'::regprocedure) into v_def;
  if v_def not like '%v_token%' then
    -- os trechos têm quebra de linha: tira o \r (arquivo salvo no Windows) para casar com o texto guardado no banco
    v_def := replace(v_def, '  i         integer;', replace('  i         integer;
  v_token   text := public.new_public_token();', chr(13), ''));
    v_def := replace(v_def,
      replace('insert into public.appointments (salon_id, client_id, professional_id, service_id, service_name, starts_at, duration, price, status, origin)
    values (v_salon, v_client, v_pro, v_svc.id, v_svc.name, v_at, v_svc.duration, v_svc.price, ''pendente'', ''site'')', chr(13), ''),
      replace('insert into public.appointments (salon_id, client_id, professional_id, service_id, service_name, starts_at, duration, price, status, origin, public_token)
    values (v_salon, v_client, v_pro, v_svc.id, v_svc.name, v_at, v_svc.duration, v_svc.price, ''pendente'', ''site'', v_token)', chr(13), ''));
    v_def := replace(v_def, '''professional'', v_pro_nm, ''price'', v_price, ''duration'', v_dur', '''professional'', v_pro_nm, ''price'', v_price, ''duration'', v_dur, ''token'', v_token');
    if (length(v_def) - length(replace(v_def, 'v_token', ''))) / length('v_token') <> 3 then
      raise exception 'book_services mudou: ajuste esta migration';
    end if;
    execute v_def;
  end if;
end $$;
revoke all on function public.book_services(text, uuid[], uuid, date, integer, text, text) from public, anonymous, authenticated;

insert into public.schema_migrations (version) values ('20261119000000_client_link_reviews') on conflict (version) do nothing;

notify pgrst, 'reload schema';

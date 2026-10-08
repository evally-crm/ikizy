-- IKIZY (Neon): campanhas de oferta pelo WhatsApp do próprio salão (Evolution API).
-- Pré-requisitos: init, billing (has_access, stripe_events) e client_file (unique (id, salon_id) em clients).
--
-- Regras (o servidor confere tudo aqui dentro, numa transação com trava por salão):
--   * cada salão conecta UM WhatsApp (whatsapp_instances), que é a "instância" dele na Evolution;
--   * uma campanha vai para 10 a 150 clientes;
--   * o salão tem 1 campanha grátis por mês (mês de São Paulo); passando disso, usa campanha extra comprada
--     (campaign_credits, somada pelo webhook do Stripe, sem validade);
--   * cada cliente recebe no máximo 1 oferta por mês (índice único parcial em campaign_messages);
--   * quem respondeu SAIR (offers_opt_out_at) não recebe mais ofertas.
-- O navegador só LÊ estas tabelas; quem escreve é o servidor (api/whatsapp/*), com a conexão de dono do banco.

alter table public.clients add column offers_opt_out_at timestamptz;

-- ---------------------------------------------------------------- WhatsApp do salão

create table public.whatsapp_instances (
  salon_id       uuid primary key references public.salons(id) on delete cascade,
  instance_name  text not null unique,
  state          text not null default 'close' check (state in ('close', 'connecting', 'open')),
  phone          text,
  updated_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------- campanhas extras compradas

create table public.campaign_credits (
  salon_id    uuid primary key references public.salons(id) on delete cascade,
  balance     int not null default 0 check (balance >= 0),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------- campanhas e mensagens

create type public.campaign_status as enum ('sending', 'paused', 'done', 'canceled');

create table public.campaigns (
  id           uuid primary key default gen_random_uuid(),
  salon_id     uuid not null references public.salons(id) on delete cascade,
  created_by   uuid,
  template     text not null check (char_length(template) between 1 and 40),
  fields       jsonb not null default '{}'::jsonb,
  preview      text not null check (char_length(preview) <= 1200),
  -- primeiro dia do mês (São Paulo) em que a campanha foi criada: é o mês que ela consome
  month        date not null,
  status       public.campaign_status not null default 'sending',
  used_credit  boolean not null default false,
  total        int not null check (total between 10 and 150),
  created_at   timestamptz not null default now(),
  finished_at  timestamptz,
  unique (id, salon_id)
);
create index campaigns_salon_idx on public.campaigns (salon_id, created_at desc);
create index campaigns_active_idx on public.campaigns (status) where status = 'sending';

create table public.campaign_messages (
  id           uuid primary key default gen_random_uuid(),
  campaign_id  uuid not null,
  salon_id     uuid not null,
  client_id    uuid not null,
  phone        text not null check (phone ~ '^55[0-9]{10,11}$'),
  body         text not null check (char_length(body) between 1 and 1200),
  month        date not null,
  status       text not null default 'queued' check (status in ('queued', 'sending', 'sent', 'failed', 'canceled')),
  send_after   timestamptz not null,
  claimed_at   timestamptz,
  sent_at      timestamptz,
  error        text,
  foreign key (campaign_id, salon_id) references public.campaigns (id, salon_id) on delete cascade,
  foreign key (client_id, salon_id) references public.clients (id, salon_id) on delete cascade
);
create index campaign_messages_due_idx on public.campaign_messages (campaign_id, send_after) where status = 'queued';
-- 1 oferta por cliente por mês (mensagens canceladas ou que falharam não contam)
create unique index campaign_messages_client_month_uq on public.campaign_messages (client_id, month)
  where status in ('queued', 'sending', 'sent');

-- ---------------------------------------------------------------- acesso

alter table public.whatsapp_instances enable row level security;
alter table public.campaign_credits enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_messages enable row level security;

create policy whatsapp_instances_select on public.whatsapp_instances for select to authenticated using (public.is_member(salon_id));
create policy campaign_credits_select on public.campaign_credits for select to authenticated using (public.is_member(salon_id));
create policy campaigns_select on public.campaigns for select to authenticated using (public.is_member(salon_id));
create policy campaign_messages_select on public.campaign_messages for select to authenticated using (public.is_member(salon_id));

revoke all on public.whatsapp_instances, public.campaign_credits, public.campaigns, public.campaign_messages from anonymous, authenticated;
grant select on public.whatsapp_instances, public.campaign_credits, public.campaigns, public.campaign_messages to authenticated;

-- ---------------------------------------------------------------- funções (só o servidor chama)

create or replace function public.campaign_month(p_at timestamptz default now())
returns date
language sql stable set search_path = ''
as $$
  select date_trunc('month', p_at at time zone 'America/Sao_Paulo')::date;
$$;

-- quanto o salão já usou no mês: campanha cancelada antes de enviar qualquer mensagem não conta
create or replace function public.campaign_quota(p_salon uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'month', public.campaign_month(),
    'used_free', (
      select count(*) from public.campaigns c
      where c.salon_id = p_salon and c.month = public.campaign_month() and not c.used_credit
        and (c.status <> 'canceled' or exists (
          select 1 from public.campaign_messages m where m.campaign_id = c.id and m.status in ('sent', 'sending')))
    ),
    'credits', coalesce((select balance from public.campaign_credits where salon_id = p_salon), 0)
  );
$$;

/*
 * cria a campanha e a fila de envio. p_messages: [{ "client_id": uuid, "phone": "55...", "body": "..." }]
 * (o texto já vem renderizado pelo servidor). Devolve { ok, campaign_id, total, used_credit } ou { ok: false, error }.
 * Clientes que já receberam oferta no mês, que pediram para sair ou de outro salão ficam de fora;
 * se sobrarem menos de p_min, nada é gravado.
 */
create or replace function public.create_offer_campaign(
  p_salon     uuid,
  p_user      uuid,
  p_template  text,
  p_fields    jsonb,
  p_preview   text,
  p_messages  jsonb,
  p_free      int default 1,
  p_min       int default 10,
  p_max       int default 150,
  p_gap_min   int default 45,
  p_gap_max   int default 90
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_month    date := public.campaign_month();
  v_quota    jsonb;
  v_credit   boolean := false;
  v_campaign uuid;
  v_total    int;
begin
  -- uma campanha por vez por salão: evita duas abas criando ao mesmo tempo e furando o limite
  perform pg_advisory_xact_lock(hashtext('offer_campaign:' || p_salon::text));

  if not public.has_access(p_salon) then
    return jsonb_build_object('ok', false, 'error', 'no_access');
  end if;
  if not exists (select 1 from public.whatsapp_instances w where w.salon_id = p_salon and w.state = 'open') then
    return jsonb_build_object('ok', false, 'error', 'not_connected');
  end if;
  if jsonb_typeof(p_messages) <> 'array' or jsonb_array_length(p_messages) > p_max then
    return jsonb_build_object('ok', false, 'error', 'too_many');
  end if;

  v_quota := public.campaign_quota(p_salon);
  if (v_quota->>'used_free')::int >= p_free then
    if (v_quota->>'credits')::int < 1 then
      return jsonb_build_object('ok', false, 'error', 'no_quota');
    end if;
    v_credit := true;
  end if;

  insert into public.campaigns (salon_id, created_by, template, fields, preview, month, used_credit, total)
  values (p_salon, p_user, p_template, coalesce(p_fields, '{}'::jsonb), p_preview, v_month, v_credit, greatest(p_min, 10))
  returning id into v_campaign;

  -- cada mensagem sai um pouco depois da anterior, em intervalos aleatórios (envio em massa derruba o número)
  with input as (
    select distinct on ((m->>'client_id')::uuid)
      (m->>'client_id')::uuid as client_id, m->>'phone' as phone, m->>'body' as body
    from jsonb_array_elements(p_messages) m
  ), eligible as (
    select i.*, row_number() over (order by random()) as n
    from input i
    join public.clients c on c.id = i.client_id and c.salon_id = p_salon
    where c.offers_opt_out_at is null
      and not exists (
        select 1 from public.campaign_messages x
        where x.client_id = i.client_id and x.month = v_month and x.status in ('queued', 'sending', 'sent'))
  ), gaps as (
    select e.*, sum(case when e.n = 1 then 0 else p_gap_min + floor(random() * (p_gap_max - p_gap_min + 1)) end)
             over (order by e.n) as offset_s
    from eligible e
  )
  insert into public.campaign_messages (campaign_id, salon_id, client_id, phone, body, month, send_after)
  select v_campaign, p_salon, g.client_id, g.phone, g.body, v_month, now() + make_interval(secs => g.offset_s)
  from gaps g
  on conflict do nothing;

  get diagnostics v_total = row_count;
  if v_total < p_min then
    -- desfaz só o que esta função gravou (a transação do chamador segue)
    delete from public.campaigns where id = v_campaign;
    return jsonb_build_object('ok', false, 'error', 'too_few', 'eligible', v_total);
  end if;

  update public.campaigns set total = v_total where id = v_campaign;
  if v_credit then
    update public.campaign_credits set balance = balance - 1, updated_at = now() where salon_id = p_salon;
  end if;

  return jsonb_build_object('ok', true, 'campaign_id', v_campaign, 'total', v_total, 'used_credit', v_credit);
end;
$$;

-- cancela o que ainda não saiu. Se nada foi enviado, a campanha não conta no mês e a extra volta para o saldo.
create or replace function public.cancel_offer_campaign(p_salon uuid, p_campaign uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_c     public.campaigns;
  v_sent  int;
begin
  perform pg_advisory_xact_lock(hashtext('offer_campaign:' || p_salon::text));
  select * into v_c from public.campaigns where id = p_campaign and salon_id = p_salon for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if v_c.status not in ('sending', 'paused') then
    return jsonb_build_object('ok', false, 'error', 'not_active');
  end if;

  update public.campaign_messages set status = 'canceled' where campaign_id = p_campaign and status = 'queued';
  select count(*) into v_sent from public.campaign_messages where campaign_id = p_campaign and status in ('sent', 'sending');
  update public.campaigns set status = 'canceled', finished_at = now() where id = p_campaign;

  if v_sent = 0 and v_c.used_credit then
    insert into public.campaign_credits (salon_id, balance) values (p_salon, 1)
    on conflict (salon_id) do update set balance = public.campaign_credits.balance + 1, updated_at = now();
  end if;
  return jsonb_build_object('ok', true, 'refunded', v_sent = 0);
end;
$$;

-- soma campanhas extras pagas, uma única vez por evento do Stripe
create or replace function public.add_campaign_credits(p_key text, p_type text, p_salon uuid, p_credits int)
returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.stripe_events (id, type) values (p_key, p_type) on conflict do nothing;
  if not found then
    return false;
  end if;
  insert into public.campaign_credits (salon_id, balance) values (p_salon, p_credits)
  on conflict (salon_id) do update set balance = public.campaign_credits.balance + p_credits, updated_at = now();
  return true;
end;
$$;

/*
 * pega as próximas mensagens da fila: no máximo UMA por salão a cada chamada (o cron roda a cada minuto; o mesmo
 * número nunca dispara duas de uma vez, mesmo com duas campanhas), só de campanhas enviando e só quando chegou a hora. Marca como 'sending' para outra execução não pegar a mesma.
 * Mensagens presas em 'sending' há mais de 10 min viram 'failed' (não dá para saber se saíram; reenviar duplicaria).
 */
create or replace function public.claim_campaign_messages(p_limit int default 25)
returns table (id uuid, campaign_id uuid, salon_id uuid, instance_name text, phone text, body text)
language plpgsql security definer set search_path = ''
as $$
#variable_conflict use_column
begin
  update public.campaign_messages m set status = 'failed', error = 'timeout'
  where m.status = 'sending' and m.claimed_at < now() - interval '10 minutes';

  -- fila vazia (tudo enviado, falhou ou foi cancelado por SAIR): a campanha termina
  update public.campaigns c set status = 'done', finished_at = now()
  where c.status = 'sending'
    and not exists (select 1 from public.campaign_messages m where m.campaign_id = c.id and m.status in ('queued', 'sending'));

  return query
  with next as (
    select distinct on (m.salon_id) m.id
    from public.campaign_messages m
    join public.campaigns c on c.id = m.campaign_id and c.status = 'sending'
    where m.status = 'queued' and m.send_after <= now()
      and not exists (select 1 from public.campaign_messages s where s.salon_id = m.salon_id and s.status = 'sending')
    order by m.salon_id, m.send_after
  ), locked as (
    select m.id from public.campaign_messages m
    where m.id in (select n.id from next n)
    order by m.send_after
    limit p_limit
    for update skip locked
  )
  update public.campaign_messages m set status = 'sending', claimed_at = now()
  from locked l, public.whatsapp_instances w
  where m.id = l.id and w.salon_id = m.salon_id
  returning m.id, m.campaign_id, m.salon_id, w.instance_name, m.phone, m.body;
end;
$$;

-- resultado do envio; a campanha termina quando não sobra nada na fila
create or replace function public.finish_campaign_message(p_id uuid, p_ok boolean, p_error text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_campaign uuid;
begin
  update public.campaign_messages
  set status = case when p_ok then 'sent' else 'failed' end,
      sent_at = case when p_ok then now() end,
      error = left(p_error, 300)
  where id = p_id and status = 'sending'
  returning campaign_id into v_campaign;

  if v_campaign is not null then
    update public.campaigns set status = 'done', finished_at = now()
    where id = v_campaign and status = 'sending'
      and not exists (select 1 from public.campaign_messages m where m.campaign_id = v_campaign and m.status in ('queued', 'sending'));
  end if;
end;
$$;

-- a VPS da Evolution não respondeu: a mensagem volta para a fila e tenta de novo em 2 minutos
create or replace function public.requeue_campaign_message(p_id uuid)
returns void
language sql security definer set search_path = ''
as $$
  update public.campaign_messages set status = 'queued', claimed_at = null, send_after = now() + interval '2 minutes'
  where id = p_id and status = 'sending';
$$;

-- WhatsApp caiu no meio do envio: devolve a mensagem para a fila e pausa as campanhas do salão
create or replace function public.pause_salon_campaigns(p_salon uuid, p_message uuid default null)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.campaign_messages set status = 'queued', claimed_at = null where id = p_message and status = 'sending';
  update public.campaigns set status = 'paused' where salon_id = p_salon and status = 'sending';
end;
$$;

-- reconectou: as pausadas voltam a enviar
create or replace function public.resume_salon_campaigns(p_salon uuid)
returns void
language sql security definer set search_path = ''
as $$
  update public.campaigns set status = 'sending' where salon_id = p_salon and status = 'paused';
$$;

-- cliente respondeu SAIR: marca todas as fichas do salão com esse WhatsApp (o número pode vir com ou sem o 9)
create or replace function public.opt_out_offers(p_salon uuid, p_phones text[])
returns int
language plpgsql security definer set search_path = ''
as $$
declare
  v_count int;
begin
  update public.clients c set offers_opt_out_at = now()
  where c.salon_id = p_salon and c.offers_opt_out_at is null
    and regexp_replace(c.phone, '\D', '', 'g') <> ''
    and (case when length(regexp_replace(c.phone, '\D', '', 'g')) in (10, 11) then '55' else '' end)
        || regexp_replace(c.phone, '\D', '', 'g') = any (p_phones);
  get diagnostics v_count = row_count;
  -- o que já estava na fila para essas clientes não sai mais
  update public.campaign_messages m set status = 'canceled'
  where m.salon_id = p_salon and m.status = 'queued' and m.phone = any (p_phones);
  return v_count;
end;
$$;

revoke all on function public.campaign_month(timestamptz) from public, anonymous, authenticated;
revoke all on function public.campaign_quota(uuid) from public, anonymous, authenticated;
revoke all on function public.create_offer_campaign(uuid, uuid, text, jsonb, text, jsonb, int, int, int, int, int) from public, anonymous, authenticated;
revoke all on function public.cancel_offer_campaign(uuid, uuid) from public, anonymous, authenticated;
revoke all on function public.add_campaign_credits(text, text, uuid, int) from public, anonymous, authenticated;
revoke all on function public.claim_campaign_messages(int) from public, anonymous, authenticated;
revoke all on function public.finish_campaign_message(uuid, boolean, text) from public, anonymous, authenticated;
revoke all on function public.requeue_campaign_message(uuid) from public, anonymous, authenticated;
revoke all on function public.pause_salon_campaigns(uuid, uuid) from public, anonymous, authenticated;
revoke all on function public.resume_salon_campaigns(uuid) from public, anonymous, authenticated;
revoke all on function public.opt_out_offers(uuid, text[]) from public, anonymous, authenticated;

notify pgrst, 'reload schema';

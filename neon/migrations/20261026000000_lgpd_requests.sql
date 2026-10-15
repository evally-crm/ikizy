-- IKIZY (Neon): LGPD e pedidos do site sem resposta (docs/ESPECIFICACAO-PRODUCAO.md).
--
--   1. forget_client(): a dona apaga os dados pessoais de uma cliente (R-74). Com histórico de atendimentos a ficha
--      fica anônima ("Cliente removida") para não quebrar o financeiro; sem histórico, a cliente é apagada.
--   2. expire_stale_requests(): pedido do site que passou do horário sem resposta vira cancelado (R-59). Chamada
--      por um cron diário do servidor; pula meses já fechados.
--
-- Seguro para rodar de novo. TESTAR ANTES NUMA BRANCH DO NEON.

-- ---------------------------------------------------------------- 1. LGPD
alter table public.clients add column if not exists forgotten_at timestamptz;

-- devolve 'deleted' (sem histórico) ou 'anonymized' (com atendimentos)
create or replace function public.forget_client(p_client uuid)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_salon uuid;
begin
  select c.salon_id into v_salon from public.clients c where c.id = p_client;
  if v_salon is null then
    raise exception 'client_not_found' using errcode = 'P0001';
  end if;
  if not public.has_role(v_salon, array['owner']::public.member_role[]) then
    raise exception 'sem permissão: só a dona apaga dados de clientes' using errcode = '42501';
  end if;

  delete from public.client_notes where client_id = p_client and salon_id = v_salon;
  delete from public.client_photos where client_id = p_client and salon_id = v_salon;

  if exists (select 1 from public.appointments a where a.client_id = p_client) then
    update public.clients set
      name = 'Cliente removida', phone = '', birthday = null, vip = false, preferred_professional = null,
      allergies = '{}', preferences = '{}', email = '', instagram = '', address = '', occupation = '', referral = '',
      anamnesis = '{}'::jsonb, anamnesis_updated_at = null, anamnesis_signature = null, anamnesis_signed_at = null,
      forgotten_at = now()
    where id = p_client;
    return 'anonymized';
  end if;

  delete from public.clients where id = p_client;
  return 'deleted';
end;
$$;
revoke all on function public.forget_client(uuid) from public, anonymous;
grant execute on function public.forget_client(uuid) to authenticated;

-- ---------------------------------------------------------------- 2. pedidos sem resposta
create or replace function public.expire_stale_requests()
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_tz    constant text := 'America/Sao_Paulo';
  v_count integer;
begin
  update public.appointments a
  set status = 'cancelado'
  where a.status = 'pendente'
    and a.origin = 'site'
    and a.starts_at < now()
    and not exists (
      select 1 from public.month_closings c
      where c.salon_id = a.salon_id and c.month = date_trunc('month', a.starts_at at time zone v_tz)::date
    );
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.expire_stale_requests() from public, anonymous, authenticated;

insert into public.schema_migrations (version) values ('20261026000000_lgpd_requests') on conflict (version) do nothing;

notify pgrst, 'reload schema';

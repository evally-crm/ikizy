-- IKIZY (Neon): comissão personalizável (opcional; só nos planos com equipe, Studio e Salão).
-- Pré-requisitos: init, billing (has_access), working_hours (unique (id, salon_id) em professionals).
--
-- commission_settings: liga/desliga e a base de cálculo do salão
--   base = 'price'                 sobre o valor cobrado
--        = 'price_minus_card_fee'  sobre o valor cobrado menos a taxa da maquininha (crédito e débito)
-- commission_rules: % ou valor fixo por atendimento. Vale a regra mais específica:
--   profissional + serviço  >  só o serviço  >  só a profissional  >  padrão do salão (as duas colunas vazias)
-- O cálculo fica no app (lib/commission.ts) e entra no fechamento do mês.
-- A coluna antiga professionals.commission_pct vira regra de profissional e deixa de ser usada.

create table public.commission_settings (
  salon_id   uuid primary key references public.salons(id) on delete cascade,
  enabled    boolean not null default false,
  base       text not null default 'price' check (base in ('price', 'price_minus_card_fee')),
  updated_at timestamptz not null default now()
);

create table public.commission_rules (
  id              uuid primary key default gen_random_uuid(),
  salon_id        uuid not null references public.salons(id) on delete cascade,
  professional_id uuid,
  service_id      uuid,
  kind            text not null check (kind in ('percent', 'fixed')),
  value           numeric(10,2) not null check (value >= 0 and (kind <> 'percent' or value <= 100)),
  created_at      timestamptz not null default now(),
  foreign key (professional_id, salon_id) references public.professionals (id, salon_id) on delete cascade,
  foreign key (service_id) references public.services (id) on delete cascade
);
-- uma regra por combinação (profissional, serviço), contando "vazio" como valor
create unique index commission_rules_scope_key on public.commission_rules (
  salon_id,
  coalesce(professional_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(service_id, '00000000-0000-0000-0000-000000000000'::uuid)
);

-- o serviço da regra precisa ser do mesmo salão (services não tem unique (id, salon_id))
create or replace function public.guard_commission_rule_service()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.service_id is not null and not exists (
    select 1 from public.services s where s.id = new.service_id and s.salon_id = new.salon_id
  ) then
    raise exception 'serviço de outro salão' using errcode = '23503';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_commission_rule_service() from public, anonymous, authenticated;
create trigger commission_rules_service_guard
  before insert or update of service_id, salon_id on public.commission_rules
  for each row execute function public.guard_commission_rule_service();

alter table public.commission_settings enable row level security;
alter table public.commission_rules enable row level security;

-- comissão é financeiro: só dona e gerente leem e editam
do $$
declare t text;
begin
  foreach t in array array['commission_settings', 'commission_rules'] loop
    execute format($p$create policy %I on public.%I for select to authenticated using (public.has_role(salon_id, array['owner','manager']::public.member_role[]))$p$, t || '_select', t);
    execute format($p$create policy %I on public.%I for insert to authenticated with check (public.has_role(salon_id, array['owner','manager']::public.member_role[]))$p$, t || '_insert', t);
    execute format($p$create policy %I on public.%I for update to authenticated using (public.has_role(salon_id, array['owner','manager']::public.member_role[])) with check (public.has_role(salon_id, array['owner','manager']::public.member_role[]))$p$, t || '_update', t);
    execute format($p$create policy %I on public.%I for delete to authenticated using (public.has_role(salon_id, array['owner','manager']::public.member_role[]))$p$, t || '_delete', t);
    execute format('create policy %I on public.%I as restrictive for insert to authenticated with check (public.has_access(salon_id))', t || '_billing_insert', t);
    execute format('create policy %I on public.%I as restrictive for update to authenticated using (public.has_access(salon_id)) with check (public.has_access(salon_id))', t || '_billing_update', t);
    execute format('create policy %I on public.%I as restrictive for delete to authenticated using (public.has_access(salon_id))', t || '_billing_delete', t);
  end loop;
end $$;

grant select, insert, update, delete on public.commission_settings, public.commission_rules to authenticated;

-- salva a configuração inteira de uma vez (liga/desliga, base e todas as regras), dentro de uma transação
-- p_rules: [{ "professional_id": uuid|null, "service_id": uuid|null, "kind": "percent"|"fixed", "value": number }]
create or replace function public.save_commission_config(p_salon uuid, p_enabled boolean, p_base text, p_rules jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.has_role(p_salon, array['owner', 'manager']::public.member_role[]) then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if not public.has_access(p_salon) then
    raise exception 'sistema em modo leitura' using errcode = '42501';
  end if;
  if jsonb_typeof(coalesce(p_rules, '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_rules, '[]'::jsonb)) > 500 then
    raise exception 'regras inválidas' using errcode = '22023';
  end if;

  insert into public.commission_settings (salon_id, enabled, base, updated_at)
  values (p_salon, coalesce(p_enabled, false), coalesce(p_base, 'price'), now())
  on conflict (salon_id) do update set enabled = excluded.enabled, base = excluded.base, updated_at = now();

  delete from public.commission_rules where salon_id = p_salon;
  insert into public.commission_rules (salon_id, professional_id, service_id, kind, value)
  select p_salon,
         nullif(r->>'professional_id', '')::uuid,
         nullif(r->>'service_id', '')::uuid,
         r->>'kind',
         (r->>'value')::numeric
  from jsonb_array_elements(coalesce(p_rules, '[]'::jsonb)) as r;
end;
$$;
revoke all on function public.save_commission_config(uuid, boolean, text, jsonb) from public, anonymous;
grant execute on function public.save_commission_config(uuid, boolean, text, jsonb) to authenticated;

-- quem já tinha percentual por profissional continua igual: vira regra e a comissão fica ligada
insert into public.commission_rules (salon_id, professional_id, kind, value)
select p.salon_id, p.id, 'percent', p.commission_pct
from public.professionals p
where p.commission_pct > 0
on conflict do nothing;

insert into public.commission_settings (salon_id, enabled)
select distinct salon_id, true from public.commission_rules
on conflict (salon_id) do nothing;

notify pgrst, 'reload schema';

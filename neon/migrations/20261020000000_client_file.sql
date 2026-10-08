-- IKIZY (Neon): ficha completa da cliente, cartão fidelidade de verdade e anotações.
-- Pré-requisitos: 20261008000000_init.sql e 20261009000000_billing.sql (usa has_access).
--
-- * clients: dados de contato e perfil (e-mail, Instagram, endereço, profissão, como conheceu),
--   respostas da anamnese (jsonb) e a assinatura do termo (imagem PNG em data URL, desenhada no celular).
-- * loyalty_settings: regra do cartão fidelidade por salão (ligado, selos por prêmio, qual é o prêmio).
-- * loyalty_entries: movimentos do cartão além das visitas concluídas
--   (stamps > 0 = selo extra dado à mão; stamps < 0 = prêmio resgatado).
--   Selos disponíveis = atendimentos concluídos + soma(stamps).
-- * client_notes: anotações datadas sobre a cliente (linha do tempo da ficha).

alter table public.clients
  add column email       text not null default '' check (char_length(email) <= 120),
  add column instagram   text not null default '' check (char_length(instagram) <= 60),
  add column address     text not null default '' check (char_length(address) <= 160),
  add column occupation  text not null default '' check (char_length(occupation) <= 60),
  add column referral    text not null default '' check (char_length(referral) <= 80),
  add column anamnesis   jsonb not null default '{}'::jsonb
    check (jsonb_typeof(anamnesis) = 'object' and pg_column_size(anamnesis) <= 20000),
  add column anamnesis_updated_at timestamptz,
  add column anamnesis_signature  text
    check (anamnesis_signature is null or (anamnesis_signature like 'data:image/png;base64,%' and char_length(anamnesis_signature) <= 200000)),
  add constraint clients_id_salon_key unique (id, salon_id);

create table public.loyalty_settings (
  salon_id           uuid primary key references public.salons(id) on delete cascade,
  enabled            boolean not null default true,
  stamps_per_reward  integer not null default 10 check (stamps_per_reward between 3 and 30),
  reward             text not null default 'Um serviço grátis' check (char_length(reward) between 1 and 60),
  updated_at         timestamptz not null default now()
);

create trigger loyalty_settings_touch
  before update on public.loyalty_settings
  for each row execute function public.touch_updated_at();

create table public.loyalty_entries (
  id          uuid primary key default gen_random_uuid(),
  salon_id    uuid not null references public.salons(id) on delete cascade,
  client_id   uuid not null,
  stamps      integer not null check (stamps between -30 and 30 and stamps <> 0),
  note        text not null default '' check (char_length(note) <= 80),
  created_at  timestamptz not null default now(),
  foreign key (client_id, salon_id) references public.clients (id, salon_id) on delete cascade
);
create index loyalty_entries_client_idx on public.loyalty_entries (salon_id, client_id);

create table public.client_notes (
  id          uuid primary key default gen_random_uuid(),
  salon_id    uuid not null references public.salons(id) on delete cascade,
  client_id   uuid not null,
  body        text not null check (char_length(body) between 1 and 1000),
  created_at  timestamptz not null default now(),
  foreign key (client_id, salon_id) references public.clients (id, salon_id) on delete cascade
);
create index client_notes_client_idx on public.client_notes (salon_id, client_id, created_at desc);

alter table public.loyalty_settings enable row level security;
alter table public.loyalty_entries  enable row level security;
alter table public.client_notes     enable row level security;

-- regra do programa: todos os membros leem; só dona/gerente altera
create policy loyalty_settings_select on public.loyalty_settings for select to authenticated
  using (public.is_member(salon_id));
create policy loyalty_settings_insert on public.loyalty_settings for insert to authenticated
  with check (public.has_role(salon_id, array['owner','manager']::public.member_role[]));
create policy loyalty_settings_update on public.loyalty_settings for update to authenticated
  using (public.has_role(salon_id, array['owner','manager']::public.member_role[]))
  with check (public.has_role(salon_id, array['owner','manager']::public.member_role[]));

-- selos e anotações são do dia a dia do atendimento: qualquer membro, como em clients
do $$
declare t text;
begin
  foreach t in array array['loyalty_entries', 'client_notes'] loop
    execute format('create policy %I on public.%I for select to authenticated using (public.is_member(salon_id))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.is_member(salon_id))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.is_member(salon_id)) with check (public.is_member(salon_id))', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.is_member(salon_id))', t || '_delete', t);
  end loop;
end $$;

-- modo leitura quando o acesso acaba, como nas demais tabelas
do $$
declare t text;
begin
  foreach t in array array['loyalty_settings', 'loyalty_entries', 'client_notes'] loop
    execute format('create policy %I on public.%I as restrictive for insert to authenticated with check (public.has_access(salon_id))', t || '_billing_insert', t);
    execute format('create policy %I on public.%I as restrictive for update to authenticated using (public.has_access(salon_id)) with check (public.has_access(salon_id))', t || '_billing_update', t);
    execute format('create policy %I on public.%I as restrictive for delete to authenticated using (public.has_access(salon_id))', t || '_billing_delete', t);
  end loop;
end $$;

grant select, insert, update on public.loyalty_settings to authenticated;
grant select, insert, update, delete on public.loyalty_entries, public.client_notes to authenticated;

-- avisa a Data API para enxergar as tabelas e colunas novas
notify pgrst, 'reload schema';

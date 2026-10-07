-- IKIZY (Neon): base do financeiro real.
--   * appointments.payment_method: como a cliente pagou (informado ao concluir o atendimento)
--   * expenses: saídas do mês (aluguel, produtos avulsos, contas...)
-- O fechamento do mês continua em month_closings/close_month (migration inicial).

alter table public.appointments
  add column payment_method text check (payment_method in ('pix', 'credito', 'debito', 'dinheiro'));

create table public.expenses (
  id           uuid primary key default gen_random_uuid(),
  salon_id     uuid not null references public.salons(id) on delete cascade,
  spent_on     date not null default current_date,
  description  text not null check (char_length(description) between 1 and 80),
  amount       numeric(12,2) not null check (amount > 0),
  created_at   timestamptz not null default now()
);
create index expenses_salon_day_idx on public.expenses (salon_id, spent_on);

alter table public.expenses enable row level security;

-- saídas são do caixa do negócio: todos os membros leem, só dona/gerente lançam
create policy expenses_select on public.expenses for select to authenticated
  using (public.is_member(salon_id));
create policy expenses_insert on public.expenses for insert to authenticated
  with check (public.has_role(salon_id, array['owner','manager']::public.member_role[]));
create policy expenses_update on public.expenses for update to authenticated
  using (public.has_role(salon_id, array['owner','manager']::public.member_role[]))
  with check (public.has_role(salon_id, array['owner','manager']::public.member_role[]));
create policy expenses_delete on public.expenses for delete to authenticated
  using (public.has_role(salon_id, array['owner','manager']::public.member_role[]));

-- modo leitura quando o acesso acaba, como nas demais tabelas
create policy expenses_billing_insert on public.expenses as restrictive for insert to authenticated
  with check (public.has_access(salon_id));
create policy expenses_billing_update on public.expenses as restrictive for update to authenticated
  using (public.has_access(salon_id)) with check (public.has_access(salon_id));
create policy expenses_billing_delete on public.expenses as restrictive for delete to authenticated
  using (public.has_access(salon_id));

-- mês fechado não aceita saída nova, alterada ou apagada naquele período
create or replace function public.guard_closed_month_expenses()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_salon uuid := coalesce(new.salon_id, old.salon_id);
  v_dates date[] := array[]::date[];
begin
  if tg_op in ('UPDATE', 'DELETE') then v_dates := v_dates || old.spent_on; end if;
  if tg_op in ('INSERT', 'UPDATE') then v_dates := v_dates || new.spent_on; end if;
  if exists (
    select 1 from public.month_closings c
    where c.salon_id = v_salon
      and c.month = any (select date_trunc('month', d)::date from unnest(v_dates) d)
  ) then
    raise exception 'o mês desta saída já está fechado' using errcode = '23514';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger expenses_guard_closed
  before insert or update or delete on public.expenses
  for each row execute function public.guard_closed_month_expenses();

grant select, insert, update, delete on public.expenses to authenticated;

-- avisa a Data API para enxergar a tabela e a coluna novas
notify pgrst, 'reload schema';

\set ON_ERROR_STOP on
insert into auth.users values
 ('aaaaaaaa-0000-0000-0000-000000000001','a@x'),
 ('bbbbbbbb-0000-0000-0000-000000000002','b@x'),
 ('cccccccc-0000-0000-0000-000000000003','c@x');

create or replace procedure pg_temp.as_user(uid text) language plpgsql as $$
begin
  perform set_config('request.jwt.sub', uid, false);
  execute 'set role authenticated';
end $$;

create or replace function pg_temp.expect_fail(sql text, label text) returns void language plpgsql as $$
begin
  begin
    execute sql;
    raise notice 'FAIL  % (devia falhar)', label;
  exception when others then
    raise notice 'PASS  % -> %', label, sqlerrm;
  end;
end $$;

create or replace function pg_temp.expect_eq(actual anyelement, expected anyelement, label text) returns void language plpgsql as $$
begin
  if actual is not distinct from expected then raise notice 'PASS  % (=%)', label, actual;
  else raise notice 'FAIL  % esperado % obtido %', label, expected, actual; end if;
end $$;

-- A e B criam salões
call pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select public.create_salon('Salão A', 'salao-a') as salon_a \gset
reset role;
call pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select public.create_salon('Salão B', 'salao-b') as salon_b \gset
reset role;

-- C entra no salão A como profissional
insert into public.members values (:'salon_a', 'cccccccc-0000-0000-0000-000000000003', 'professional');

-- dados do salão A (como A)
call pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
insert into public.professionals (salon_id, name) values (:'salon_a', 'Ana Clara') returning id as pro_a \gset
insert into public.clients (salon_id, name) values (:'salon_a', 'Marina Costa') returning id as cli_a \gset
insert into public.services (salon_id, name, price) values (:'salon_a', 'Gel', 90);
select pg_temp.expect_fail(format($$select public.create_salon('Outro','outro-a')$$), 'A não cria segundo salão');
reset role;

-- B não enxerga nada do A
call pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select pg_temp.expect_eq((select count(*) from public.clients), 0::bigint, 'B vê 0 clientes');
select pg_temp.expect_eq((select count(*) from public.salons), 1::bigint, 'B vê só o próprio salão');
select pg_temp.expect_fail(format($$insert into public.clients (salon_id, name) values (%L, 'Invasora')$$, :'salon_a'), 'B não insere cliente no salão A');
update public.clients set name = 'hack' where id = :'cli_a';
select pg_temp.expect_fail(format($$select public.close_month(%L, '2026-10-01', '{}')$$, :'salon_a'), 'B não fecha mês do salão A');
reset role;
select pg_temp.expect_eq((select name from public.clients where id = :'cli_a'), 'Marina Costa', 'update de B não alterou cliente do A');

-- C (profissional): opera atendimentos/clientes, mas não catálogo nem fechamento
call pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
insert into public.clients (salon_id, name) values (:'salon_a', 'Cliente da C');
select pg_temp.expect_fail(format($$insert into public.services (salon_id, name) values (%L, 'Novo')$$, :'salon_a'), 'profissional não cria serviço');
select pg_temp.expect_fail(format($$select public.close_month(%L, '2026-10-01', '{}')$$, :'salon_a'), 'profissional não fecha mês');
reset role;

-- A fecha outubro
call pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
insert into public.appointments (salon_id, client_id, professional_id, service_name, starts_at, duration, price)
  values (:'salon_a', :'cli_a', :'pro_a', 'Gel', '2026-10-05 10:00-03', 60, 90) returning id as ap_a \gset
select public.close_month(:'salon_a', '2026-10-17', '{"gross":90}');
select pg_temp.expect_fail(format($$insert into public.appointments (salon_id, client_id, professional_id, service_name, starts_at, duration) values (%L,%L,%L,'x','2026-10-20 10:00-03',30)$$, :'salon_a', :'cli_a', :'pro_a'), 'não cria atendimento em mês fechado');
select pg_temp.expect_fail(format($$update public.appointments set price = 1 where id = %L$$, :'ap_a'), 'não altera atendimento em mês fechado');
select pg_temp.expect_fail(format($$delete from public.appointments where id = %L$$, :'ap_a'), 'não apaga atendimento em mês fechado');
select pg_temp.expect_fail(format($$select public.close_month(%L, '2026-10-01', '{}')$$, :'salon_a'), 'não fecha o mesmo mês duas vezes');
select pg_temp.expect_fail($$update public.month_closings set snapshot = '{}'$$, 'fechamento é imutável (sem grant de update)');
insert into public.appointments (salon_id, client_id, professional_id, service_name, starts_at, duration)
  values (:'salon_a', :'cli_a', :'pro_a', 'Gel', '2026-11-03 10:00-03', 60);
select pg_temp.expect_eq(true, true, 'novembro continua aberto');
reset role;

-- anon: só a porta pública
set role anon;
select pg_temp.expect_fail($$select * from public.clients$$, 'anon não lê clientes');
select pg_temp.expect_fail($$select * from public.services$$, 'anon não lê serviços');
select pg_temp.expect_fail($$select public.create_salon('x','xxx')$$, 'anon não cria salão');
select pg_temp.expect_eq(public.get_public_site('salao-a')->>'name', 'Salão A', 'anon lê página pública');
select pg_temp.expect_eq(jsonb_array_length(public.get_public_site('salao-a')->'services'), 1, 'página pública lista serviço visível');
select pg_temp.expect_eq(public.get_public_site('salao-a') ? 'members', false, 'página pública não vaza membros');
reset role;
update public.site_settings set show_prices = false where salon_id = :'salon_a';
set role anon;
select pg_temp.expect_eq(public.get_public_site('salao-a')->'services'->0->'price', 'null'::jsonb, 'preço oculto quando show_prices = false');
reset role;

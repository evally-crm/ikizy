# evally

Sistema de gestão para salões de beleza e cuidados (agenda, clientes, financeiro, site próprio).
React + TypeScript + Vite, com Supabase (Postgres, Auth e RLS).

## Rodando

```bash
npm install
npm run dev
```

Sem variáveis de ambiente o app abre em **modo demonstração**, com dados de exemplo e sem login.

## Conectando ao Supabase

1. Crie um projeto em supabase.com.
2. Aplique a migration `supabase/migrations/20261006000000_init.sql` (SQL Editor, ou `supabase db push`).
3. Copie `.env.example` para `.env.local` e preencha a URL e a chave **anon** (Project Settings > API).
   Nunca use a chave `service_role` no front-end.
4. Em Authentication > URL Configuration, adicione a URL do app (ex.: `http://localhost:5173`) como redirect.

Com as variáveis preenchidas, o app exige login e a criação do salão (`/comecar`) antes de abrir o sistema.

## Segurança do banco

- Toda tabela tem `salon_id` e RLS: cada usuária só enxerga o próprio salão.
- Papéis: `owner`, `manager`, `reception`, `professional` (catálogo, produtos e site só dono/gerente).
- O salão é criado só pela função `create_salon()`; a página pública só pela `get_public_site()` (o `anon` não lê tabelas).
- `close_month()` grava o fechamento (imutável) e trava atendimentos do mês.

Testes de RLS: `supabase/tests/rls_test.sql` (validado em Postgres 17 com `auth_stubs.sql` simulando o schema `auth`).

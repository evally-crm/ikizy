# IKIZY

Gestão simples para salões e negócios de beleza: agenda, clientes, financeiro e site próprio.
Monorepo (npm workspaces) com React + TypeScript + Vite e Supabase (Postgres, Auth e RLS).

## Estrutura

```
apps/
  app/        sistema (app.ikizy.com)   login, cadastro, recuperar senha e /dashboard/*
  landing/    site institucional (ikizy.com): /, /precos, /recursos, /sobre, /contato  (Astro, estático)
supabase/     migrations e testes de RLS
neon.ts       configuração do Neon (conectado, ainda sem uso pelo app)
```

| Domínio | O que é |
|---|---|
| `ikizy.com` | landing page (projeto separado, com SEO e deploy próprios) |
| `app.ikizy.com` | o sistema |
| `seu-salao.ikizy.com` | site público de cada negócio (DNS curinga `*.ikizy.com`) |

Rotas do app: `/login`, `/cadastro`, `/cadastro/salao`, `/recuperar-senha`, `/redefinir-senha` e, após entrar,
`/dashboard` com agenda, clientes, serviços, financeiro, equipe e relatórios (marketing, fidelidade, estoque,
meu site e configurações ficam em "Mais").

## Rodando

```bash
npm install
npm run dev            # app em http://localhost:5173
npm run dev:landing    # landing em http://localhost:4321
npm run build          # compila app e landing
```

A landing aponta os botões "Entrar" e "Teste agora" para `https://app.ikizy.com`. Em desenvolvimento, use
`PUBLIC_APP_URL=http://localhost:5173 npm run dev:landing`.

Sem variáveis de ambiente o app abre em **modo demonstração**, com dados de exemplo e sem login.

## Conectando ao Supabase

1. Crie um projeto em supabase.com.
2. Aplique, em ordem, as migrations de `supabase/migrations/` (SQL Editor, ou `supabase db push`).
3. Copie `apps/app/.env.example` para `apps/app/.env.local` e preencha a URL e a chave **anon** (Project Settings > API).
   Nunca use a chave `service_role` no front-end.
4. Em Authentication > URL Configuration, cadastre como redirect `http://localhost:5173/**` e, em produção,
   `https://app.ikizy.com/**` (usados na confirmação de e-mail e na recuperação de senha).

Com as variáveis preenchidas, o app exige login e a criação do negócio (`/cadastro/salao`) antes de abrir o sistema.

## Segurança do banco

- Toda tabela tem `salon_id` e RLS: cada usuária só enxerga o próprio salão.
- Papéis: `owner`, `manager`, `reception`, `professional` (catálogo, produtos e site só dono/gerente).
- O salão é criado só pela função `create_salon()`; a página pública só pela `get_public_site()` (o `anon` não lê tabelas).
- Endereços como `app`, `www` e `api` são reservados (constraint `salons_slug_not_reserved`).
- `close_month()` grava o fechamento (imutável) e trava atendimentos do mês.

Testes de RLS: `supabase/tests/rls_test.sql` (validado em Postgres 17 com `auth_stubs.sql` simulando o schema `auth`).

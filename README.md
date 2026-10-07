# IKIZY

Gestão simples para salões e negócios de beleza: agenda, clientes, financeiro e site próprio.
Monorepo (npm workspaces) com React + TypeScript + Vite e Neon (Postgres, Neon Auth e Data API com RLS).

## Estrutura

```
apps/
  app/        sistema (app.ikizy.com)   login, cadastro, recuperar senha e /dashboard/*
  landing/    site institucional (ikizy.com): /, /precos, /recursos, /sobre, /contato  (Astro, estático)
neon/         migrations do banco (Neon)
supabase/     migrations e testes de RLS originais (referência, não são mais aplicados)
neon.ts       configuração do Neon (auth e dataApi ligados)
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

## Conectando ao Neon

1. `neon deploy` (liga Neon Auth e Data API conforme o `neon.ts`).
2. Aplique, em ordem, as migrations de `neon/migrations/`.
3. `neon env pull` traz `NEON_AUTH_BASE_URL` e `NEON_DATA_API_URL`. Copie-os para `apps/app/.env.local` como
   `VITE_NEON_AUTH_URL` e `VITE_NEON_DATA_API_URL` (veja `apps/app/.env.example`).
4. Cadastre as origens do app como domínios confiáveis do Auth (sem isso, redirecionamentos dão `invalid domain`):
   `neon neon-auth domain add http://localhost:5173` e `neon neon-auth domain add https://app.ikizy.com`.

Com as variáveis preenchidas, o app exige login e a criação do negócio (`/cadastro/salao`) antes de abrir o sistema.
Em produção, o envio de e-mails (verificação e recuperação de senha) exige SMTP próprio no Neon Auth.

## Segurança do banco

- Toda tabela tem `salon_id` e RLS: cada usuária só enxerga o próprio salão.
- Papéis: `owner`, `manager`, `reception`, `professional` (catálogo, produtos e site só dono/gerente).
- O salão é criado só pela função `create_salon()`; a página pública só pela `get_public_site()` (o `anon` não lê tabelas).
- Endereços como `app`, `www` e `api` são reservados (constraint `salons_slug_not_reserved`).
- `close_month()` grava o fechamento (imutável) e trava atendimentos do mês.

Testes de RLS: `supabase/tests/rls_test.sql` (validado em Postgres 17 com `auth_stubs.sql` simulando o schema `auth`; ainda não adaptado ao Neon).

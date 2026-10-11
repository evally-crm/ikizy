# IKIZY

Gestão simples para salões e negócios de beleza: agenda, clientes, financeiro e site próprio.
Monorepo (npm workspaces) com React + TypeScript + Vite e Neon (Postgres, Neon Auth e Data API com RLS).

> Contexto completo do projeto (decisões, o que já foi feito, como trabalhar e o que falta): [CONTEXTO.md](CONTEXTO.md).

## Estrutura

```
apps/
  app/        sistema (app.ikizy.com)   login, cadastro, recuperar senha e /dashboard/*
  landing/    site institucional (ikizy.com): página única com #recursos, #precos, #sobre e #contato, mais /privacidade e /termos (Astro, estático)
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

## Cobrança (Stripe)

Planos: **Solo R$ 9,90**, **Studio R$ 29,90** e **Salão R$ 59,90** por mês (valores em `apps/app/src/lib/plans.ts`, a única fonte).

- **Teste:** 30 dias grátis em qualquer plano. Todo salão novo já nasce com o teste (`create_salon()` cria a linha em `subscriptions`).
- **Cadastro:** e-mail e senha (ou Google) > questionário (`/cadastro/salao`) > plano (`/cadastro/plano`) > dashboard. No passo de plano a dona escolhe o plano e como pagar no fim do teste: cartão (Checkout do Stripe com `trial_end` no fim do teste; nada é cobrado antes) ou Pix (sem cartão, grava com `choose_trial_plan()`). `subscriptions.plan_chosen_at` marca que ela passou por esse passo; sem ele, o dashboard manda de volta para a escolha. O dashboard mostra a contagem dos dias grátis.
- **Cartão:** assinatura mensal recorrente (Checkout do Stripe). Mudar de plano, trocar cartão e cancelar ficam no portal do cliente.
- **Pix:** pré-pago de 1 ou 3 meses (3 meses com 15% de desconto). Contas Stripe do Brasil só aceitam Pix de pagamento único (o Pix Automático não está disponível), então o Pix não renova sozinho: a tela e o aviso no topo lembram de pagar de novo.
- **Sem acesso = só leitura:** `subscriptions.access_until` manda. Vencido, o banco recusa insert/update/delete nas tabelas operacionais (políticas restritivas); os dados continuam visíveis.
- **Quem grava:** só o servidor. O navegador apenas lê `subscriptions`. O webhook `/api/stripe/webhook` confere a assinatura do Stripe e atualiza o banco de forma idempotente.

Funções de servidor (Vercel, `apps/app/api/`): `billing/checkout`, `billing/portal` e `stripe/webhook`. Elas autenticam a pessoa pelo JWT do Neon Auth e só a dona (`owner`) paga.

Configuração (uma vez por ambiente; use chaves de **teste** primeiro):

1. Aplique a migration `neon/migrations/20261009000000_billing.sql`.
2. No Stripe, ative **Pix** em Configurações > Formas de pagamento.
3. Rode o script de preparo (cria preços, portal e webhook; `--dry-run` só mostra o plano, sem chave):

   ```bash
   STRIPE_SECRET_KEY=sk_test_xxx npm run stripe:setup -w @ikizy/app -- --webhook https://app.ikizy.com/api/stripe/webhook
   ```

4. Defina as variáveis de servidor listadas em `apps/app/.env.example` no projeto `ikizy-app` da Vercel.
5. Teste com o cartão `4242 4242 4242 4242`; o Pix em modo teste confirma sozinho. Para o webhook local, use `vercel dev` junto com `stripe listen --forward-to localhost:3000/api/stripe/webhook`.

Testes: `npm run test:api -w @ikizy/app` (regras de checkout, webhook e acesso) e `npm run typecheck:api -w @ikizy/app`.

## Segurança do banco

- Toda tabela tem `salon_id` e RLS: cada usuária só enxerga o próprio salão.
- Papéis: `owner`, `manager`, `reception`, `professional` (catálogo, produtos e site só dono/gerente).
- O salão é criado só pela função `create_salon()`; a página pública só pela `get_public_site()` (o `anon` não lê tabelas).
- Endereços como `app`, `www` e `api` são reservados (constraint `salons_slug_not_reserved`).
- `close_month()` grava o fechamento (imutável) e trava atendimentos do mês.

Testes de RLS: `supabase/tests/rls_test.sql` (validado em Postgres 17 com `auth_stubs.sql` simulando o schema `auth`; ainda não adaptado ao Neon).

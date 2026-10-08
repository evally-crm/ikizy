# IKIZY: contexto completo do projeto

Documento de passagem: o que é o projeto, como está montado, o que já foi feito, como trabalhar nele e o que falta.
Atualizado em 08/10/2026. Complementa o [README](README.md), que explica como rodar e configurar Neon e Stripe.

> Sem segredos aqui. Chaves e senhas ficam em `.env.local` (raiz e `apps/app/`, fora do git) e nas variáveis da Vercel.

---

## 1. O produto

SaaS de gestão para salões e negócios de beleza (unhas, cílios, sobrancelha, cabelo, estética), em português do Brasil.
Referência de mercado principal: **GlossGenius** (fluxo curto, bonito, mobile-first, site do negócio pronto em minutos).

Módulos do sistema (`app.ikizy.com/dashboard`):

| Módulo | O que faz |
|---|---|
| Início | resumo do dia, faturamento da semana, próximos atendimentos |
| Agenda | calendário semana/mês, grade por profissional, horário de atendimento, criar/remarcar/confirmar/concluir |
| Clientes | carteira, VIP, novas, sumidas, histórico |
| Financeiro | fechamento mensal (recibo), saídas, comissões, formas de pagamento |
| Meu site | editor do site público do negócio (detalhado na seção 5) |
| Assinatura | plano do IKIZY (Stripe: cartão e Pix) |

Planos do IKIZY: Solo R$ 9,90, Studio R$ 29,90, Salão R$ 59,90 (fonte única: `apps/app/src/lib/plans.ts`). Todo salão novo ganha 30 dias de teste do Solo.

---

## 2. Stack e infraestrutura

- **Monorepo** npm workspaces: `apps/app` (sistema, React 19 + TypeScript + Vite) e `apps/landing` (Astro, ikizy.com).
- **Banco:** Neon (Postgres) com **Neon Auth** (login) e **Data API** (PostgREST) usando **RLS**. O navegador fala direto com o banco pela Data API; regras de acesso ficam nas políticas.
- **Servidor:** funções da Vercel em `apps/app/api/` (página pública, agendamento, fotos, cobrança).
- **Pagamentos:** Stripe (cartão recorrente e Pix pré-pago).
- **Ícones:** lucide-react. Sem biblioteca de UI: CSS próprio em `apps/app/src/styles/`.

| Item | Valor |
|---|---|
| Repositório | `https://github.com/evally-crm/ikizy` (o remoto antigo `evally-crm/evally` redireciona) |
| Neon | projeto `gentle-glade-92407636` ("evally"), org `org-tiny-waterfall-27334723`, branch `production` (ver `.neon`) |
| Vercel | time `dfdudas-projects`: projetos `ikizy-app` (app.ikizy.com e `*.ikizy.com`) e `ikizy-landing` (ikizy.com, www) |
| DNS | `ikizy.com` registrado e com nameservers na Vercel; curinga `*.ikizy.com` no `ikizy-app` |

Variáveis (só nomes):
- `apps/app/.env.local`: `VITE_NEON_AUTH_URL`, `VITE_NEON_DATA_API_URL` (vão para o navegador).
- `.env.local` da raiz (do `neon env pull`): `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `NEON_AUTH_BASE_URL`, `NEON_DATA_API_URL` e outras.
- Vercel `ikizy-app` (Production): `DATABASE_URL`, `NEON_AUTH_BASE_URL`, `APP_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PORTAL_CONFIGURATION`, `VITE_NEON_AUTH_URL`, `VITE_NEON_DATA_API_URL`.

**Atenção:** o app local (`localhost:5173`) usa o **mesmo banco de produção**. Tudo que é salvo localmente vale no site real.

---

## 3. Fluxo de trabalho (git e deploy)

- Branches: **`dev`** (trabalho do dia a dia) e **`main`** (produção). Cada push na `main` gera deploy de produção na Vercel; pushes na `dev` geram preview (protegido por login da Vercel).
- Para publicar: merge `dev` → `main` com `--no-ff` e push. A usuária pede explicitamente ("leva pra main e publique") antes de cada publicação.
- Commits em português, no formato `feat(area): ...` / `fix(area): ...`.
- Acompanhar o deploy: `npx vercel ls ikizy-app --scope dfdudas-projects` (a CLI já está logada).

### Migrations

Ficam em `neon/migrations/` e são aplicadas **manualmente, em ordem**, no banco de produção (não há ferramenta automática).
Como foram aplicadas até agora: um script Node com `pg` que lê `DATABASE_URL_UNPOOLED` do `.env.local` da raiz e roda o arquivo
inteiro dentro de `begin ... commit` (com `rollback` em erro). Toda migration termina com `notify pgrst, 'reload schema';`
para a Data API enxergar colunas novas (sem isso o app acusa "coluna não existe").

Boa prática usada: antes de aplicar uma migration com lógica, rodar a migration e um roteiro de testes dentro de uma transação
que termina em `rollback`, com um salão fictício.

### Verificações antes de commitar

```bash
cd apps/app
npx tsc -b              # checagem de tipos REAL do app (o "tsc -p ." não checa nada: a raiz só referencia outros configs)
npm run test:api        # testes das funções do servidor (node:test via tsx), hoje 81 testes
npm run typecheck:api   # tipos das funções da Vercel
npm run build
```

---

## 4. Banco de dados: migrations aplicadas

| Migration | O que faz |
|---|---|
| `20261008000000_init` | salões, membros/papéis, profissionais, clientes, produtos (custos), serviços, atendimentos, site_settings, fechamento mensal, RLS, `create_salon()`, `get_public_site()` |
| `20261008000001_reserved_slugs` | endereços reservados (`app`, `www`, `api`...) |
| `20261009000000_billing` | assinaturas do IKIZY (Stripe), `has_access()`, sistema só leitura sem assinatura |
| `20261010000000_working_hours` | horário de atendimento por profissional |
| `20261011000000_finance` | forma de pagamento no atendimento, saídas (despesas) |
| `20261011000000_site_publish` | `published` no site, `client_plans` (planos por assinatura do negócio), site público só se publicado |
| `20261012000000_site_branding` | logo e cor própria (cor própria depois foi abandonada) |
| `20261013000000_site_cover_address` | foto de capa e endereço do salão |
| `20261014000000_online_booking` | agendamento online: `get_available_slots()`, `book_appointment()` |
| `20261015000000_site_theme_font` | tema e fonte (tema depois virou paleta) |
| `20261016000000_site_palette` | coluna `palette` |
| `20261017000000_showcase` | `site_photos`, `showcase_items` (produtos à venda), `services.photo_id`, `get_public_photo()` |
| `20261018000000_palette_combos` | paletas reduzidas às 7 combinações atuais |

Regras importantes:
- Toda tabela tem `salon_id` + RLS. Escrita de catálogo/site só `owner`/`manager`; sem assinatura ativa, escrita bloqueada (políticas restritivas).
- Funções públicas (`get_available_slots`, `book_appointment`, `get_public_photo`) **não** são abertas ao anônimo: só o servidor chama, depois de validar a entrada.
- Fotos de outro salão não podem ser usadas (chave estrangeira composta `(photo_id, salon_id)`).
- Colunas antigas `accent`, `accent_color` e `theme` em `site_settings` ficaram sem uso (o app usa `palette`); a página ainda as entende como reserva.

---

## 5. "Meu site" (a parte mais trabalhada)

### Página pública (`slug.ikizy.com` e `app.ikizy.com/s/slug`)

- Gerada no servidor: `apps/app/api/site.ts` + `api/_lib/siteHtml.ts` (HTML + CSS inline, sem framework, rápida, com SEO e JSON-LD).
- Roteamento em `apps/app/vercel.json` com `routes` (precisam vir antes do sistema de arquivos para o subdomínio funcionar).
- Seções: topo com logo, capa (foto ou fundo marcante na cor da paleta, com o nome do salão), "Agendar é simples" (3 passos),
  Sobre, Serviços (por categoria, com foto opcional e botão de agendar), Produtos à venda (vitrine), Planos por assinatura,
  Equipe, Contato (WhatsApp, Instagram, horário, endereço com mapa) e botão flutuante de agendar no celular.
- Cache de 60 s na Vercel (uma publicação aparece em até ~1 minuto).
- Tudo que o negócio digita passa por `esc()`; fotos só entram por `photoSrc()` (id, `/api/photo` ou data URL de imagem).

### Personalização (fixa, poucas escolhas, por decisão de produto)

- **Paletas fixas** (`apps/app/src/lib/siteTheme.ts`), só estas 7, cada uma com duas cores:
  Branco e bege, Rosa bebê, Bege e preto, Azul gelo, Azul-marinho, **Vinho e preto (padrão)**, Creme e pinho (`#fffbda` + `#00371c`).
  Em cores claras o destaque usa um tom mais fechado da mesma cor para passar no contraste (há teste que garante 4,5:1).
  **Não** há cor livre: a usuária pediu explicitamente para tirar.
- **Fontes dos títulos:** Moderna, Elegante, Forte (fontes do sistema, sem carregar nada de fora).

### Editor (`apps/app/src/pages/MeuSite.tsx`)

- Abre **sempre em tela cheia** em telas largas (sem o menu do app); o X minimiza só naquela visita.
- **Guia em 2 passos** (abre sozinho se o site não está publicado; também por "Abrir guia" ou `?guia=1`):
  segue exatamente o UX da criação de conta (`pages/auth/Onboarding.tsx`): progresso em tracinhos no topo com voltar e "Pular",
  "Seu site" em cinza, título grande, opções em pílulas (a escolhida fica preta), "Fazer depois" e o disco preto com seta.
  Passo 1: paleta + fonte. Passo 2: nome + endereço → publicar. Depois: "Seu site está no ar" (Ver meu site / Completar meu site).
  Ao lado, **prévia fiel** (mesmo gerador da página real, num iframe dentro de uma moldura de navegador; Computador/Celular).
- **Etapas do editor** (tracinhos no topo com setas ← → e "2 de 4"; botões "Próximo: ..." no fim de cada etapa):
  1. **Página:** Aparência (paleta e fonte), Identidade (logo e capa), Textos, Contato e endereço, O que mostrar (preços, equipe, sinal, agendamento online). Seções começam fechadas.
  2. **Serviços e planos:** serviços agrupados por categoria (abre/fecha), com foto opcional; grupo **Planos por assinatura** com selo "Novidade" (nome, preço/mês, descrição, o que inclui, etiqueta Novidade no site). A cobrança dos planos é combinada por WhatsApp.
  3. **Produtos à venda:** vitrine com foto, preço e descrição (botão "Quero este" abre o WhatsApp).
  4. **Produtos e custos:** gastos internos com material, só para calcular margem (não aparece no site).
- Rascunho no navegador; "Publicar alterações" grava tudo de uma vez (`useStudio` em `data/catalog.ts`).
- Fotos: reduzidas no navegador (`lib/imageResize.ts`), gravadas em `site_photos` só ao publicar, servidas por `/api/photo?id=` com cache eterno; fotos trocadas/removidas são apagadas.

### Agendamento online

- Ligado em Meu site → O que mostrar → "Aceitar agendamentos online" (desligado por padrão), com antecedência mínima e prazo.
- A cliente escolhe serviço, profissional (ou qualquer uma), dia (semana de 7 dias com setas) e horário livre; informa nome e WhatsApp.
- `api/booking.ts` (GET horários, POST reserva) + funções do banco com trava contra duas reservas na mesma vaga; cliente reaproveitada pelo telefone; até 3 pedidos em aberto por cliente; limite por IP; campo-isca contra robôs.
- O pedido entra na agenda como **pendente** para o salão confirmar. Fuso fixo: America/Sao_Paulo.

---

## 6. Preferências da usuária (como ela gosta de trabalhar)

- **Mobile-first** em tudo; testar em 375px e em desktop (ela usa tela larga ~1840×880).
- Inspiração forte na **GlossGenius**: fluxos curtos, poucas escolhas, visual caprichado. Ela cobra acabamento ("você é melhor do que isso").
- Reaproveitar o UX da **criação de conta** (tracinhos, pílulas, disco preto) em novos fluxos.
- Nada de rolagem lateral; nada de telas que "estouram"; campos não podem ter a mesma cor do fundo.
- Cores sempre de paletas fixas, combinando com o sistema (bordô/vinho do IKIZY).
- Comunicação em português, direta. Publicar só quando ela pedir.

---

## 7. Pegadinhas conhecidas

- **`desktop.ini` dentro de `.git/refs`:** a pasta é sincronizada pelo Windows e recria esse arquivo; o `git fetch` falha com
  `bad object refs/desktop.ini`. Solução: `find .git -path '*refs*' -name desktop.ini -delete` antes de fetch/merge.
- **`tsc -p .` não verifica o app** (a config raiz só referencia outras). Use `npx tsc -b` (é o que o build usa).
- **Data API não vê coluna nova:** rodar `notify pgrst, 'reload schema';` no banco.
- **Preview da `dev` na Vercel** pede login; para testar a página pública localmente, gerar o HTML com `renderSitePage` via `tsx` e servir com um servidor simples.
- **Navegador embutido de testes:** às vezes a sessão do Neon Auth fica presa em "Carregando…" (a busca é cancelada quando a aba perde foco); recarregar resolve.
- **Modais e telas cheias** precisam ser renderizados no `body` (`createPortal`): dentro do conteúdo, a barra de navegação de baixo fica por cima.

---

## 8. Estado atual e próximos passos

- `main` em produção: tudo até o merge `6673998` (paletas combinadas, guia no UX da criação de conta, tela cheia, vitrine e fotos, agendamento online).
- `dev` **à frente da `main`** com o commit `f3e5e8a`: setas entre as etapas, serviços agrupados, planos por assinatura (Novidade) e guia sem rolagem. **Falta levar para a `main`.**
- Salão de teste: slug `salao` (12 serviços, 1 profissional). O site foi zerado e depois publicado pela usuária durante os testes.

Ideias e pendências conversadas:
1. **Aviso de novo pedido** de agendamento para o salão (hoje só aparece na agenda como pendente).
2. **Sinal por Pix** no agendamento (o campo de % existe, a cobrança não).
3. **Fundos prontos para a capa** (texturas/fotos de banco livre) para o site nascer bonito sem o salão enviar foto.
4. Confirmação automática para a cliente quando o salão confirma.
5. Fuso horário por salão (hoje fixo em São Paulo).

# IKIZY: contexto completo do projeto

Documento de passagem: o que é o projeto, como está montado, o que já foi feito, como trabalhar nele e o que falta.
Atualizado em 09/10/2026. Complementa o [README](README.md), que explica como rodar e configurar Neon e Stripe.
**Antes de mexer em telas, leia o [plano de experiência](docs/PLANO-DE-EXPERIENCIA.md)** (10/10/2026): diagnóstico, nova organização, perfis e fluxos.
**Para ir ao ar, siga a [especificação de produção](docs/ESPECIFICACAO-PRODUCAO.md)** (11/10/2026): regras de negócio, telas finais, schema final e serviços externos.

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

Planos do IKIZY: Solo R$ 9,90, Studio R$ 29,90, Salão R$ 59,90 (fonte única: `apps/app/src/lib/plans.ts`). Todo salão novo ganha 30 dias de teste em qualquer plano; no cadastro a dona escolhe o plano e se paga no cartão (débito automático no fim do teste) ou por Pix.

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
| Neon | projeto **`lingering-base-71670281` ("ikizy")**, org `org-winter-waterfall-22088107` (Maria Eduarda), região São Paulo (`aws-sa-east-1`), branch `production` (`br-ancient-sunset-b6oxgwr8`). Criado do zero em 11/10/2026 com todas as migrations. Desde 11/10/2026 a Vercel (`ikizy-app`, Production) aponta para ele (`DATABASE_URL`, `NEON_AUTH_BASE_URL`, `VITE_NEON_AUTH_URL`, `VITE_NEON_DATA_API_URL`). O projeto antigo `gentle-glade-92407636` ("evally", org do Daniel) ficou parado; só apagar com aprovação |
| Neon Auth / Data API | `https://ep-twilight-heart-b66hba33.neonauth.c-2.sa-east-1.aws.neon.tech/neondb/auth` · `https://ep-twilight-heart-b66hba33.apirest.c-2.sa-east-1.aws.neon.tech/neondb/rest/v1` |
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

Ficam em `neon/migrations/`. Desde `20261024000000_fase1` o banco tem a tabela `schema_migrations` e o script
`npm run db:migrate` (em `apps/app`) lista o que falta; `npm run db:migrate -- --aplicar` aplica em ordem, cada uma em
`begin ... commit`. Usa `DATABASE_URL_UNPOOLED` do `.env.local` da raiz.

**Sempre testar antes numa branch do Neon** (cópia da produção): criar a branch, apontar
`DATABASE_URL_UNPOOLED=<url da branch>` e rodar o script; conferir; só então aplicar na produção.
Toda migration termina com `notify pgrst, 'reload schema';` para a Data API enxergar colunas novas.

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
| `20261018000000_palette_combos` | paletas reduzidas às 7 combinações de então |
| `20261019000000_palette_dark` | paleta escura `preto-branco` aceita no banco |
| `20261020000000_client_file` | ficha completa da cliente (e-mail, Instagram, endereço, profissão, como conheceu, anamnese em jsonb, assinatura do termo), `loyalty_settings`, `loyalty_entries` (selos extras e resgates) e `client_notes` |
| `20261021000000_client_photos` | fotos de antes e depois na ficha (`client_photos`: miniatura + foto, só membros do salão leem; não passam pela página pública) |
| `20261023000000_plan_choice` | passo de plano no cadastro: `subscriptions.plan_chosen_at` e `choose_trial_plan()` (teste sem cartão, paga por Pix) |
| `20261024000000_fase1` | aplicada em 11/10/2026 (testada antes numa branch). No projeto novo `ikizy` todas foram aplicadas do zero; `create_salon(text,text,text)`, que existia só no banco antigo (sem migration), não foi recriada. `schema_migrations`; apaga as campanhas de WhatsApp órfãs e a fidelidade; `appointments.origin` (sistema/site); trava contra dois atendimentos da mesma profissional no mesmo horário (`appointments_no_overlap`); `slug_available()` |

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
- Cache de 60 s na Vercel, sem `stale-while-revalidate` (uma publicação aparece em no máximo 1 minuto; com ele, a versão antiga ainda era entregue depois disso).
- Tudo que o negócio digita passa por `esc()`; fotos só entram por `photoSrc()` (id, `/api/photo` ou data URL de imagem).

### Personalização (fixa, poucas escolhas, por decisão de produto)

- **Paletas fixas** (`apps/app/src/lib/siteTheme.ts`), só estas 8, cada uma com duas cores:
  Branco e bege, Rosa bebê, Bege e preto, Azul gelo, Azul-marinho, **Vinho e preto (padrão)**, Creme e pinho (`#fffbda` + `#00371c`)
  e **Preto e branco**, a única escura (fundo preto, texto e botões brancos; `DARK_CSS` em `siteHtml.ts` mantém capa sem foto e contato escuros).
  Em cores claras o destaque usa um tom mais fechado da mesma cor para passar no contraste (há teste que garante 4,5:1).
  **Não** há cor livre: a usuária pediu explicitamente para tirar.
- **Fontes dos títulos:** Manrope, Forum e Raleway (ids no banco: `moderna`, `elegante`, `forte`), do Google Fonts; a página carrega só a escolhida.

### Editor (`apps/app/src/pages/MeuSite.tsx`)

- Abre **sempre em tela cheia** em telas largas (sem o menu do app); o X minimiza só naquela visita.
- **Sem guia:** o guia de 2 passos foi removido; só existe o editor completo, com a **prévia fiel** ao lado (mesmo gerador da página real, num iframe dentro de uma moldura de navegador; Computador/Celular). O primeiro "Publicar" usa a barra de publicar, com o endereço em "Contato e endereço".
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

## 5b. Confirmação de e-mail no cadastro (LIGADA)

**Estado em 11/10/2026:** quem se cadastra com e-mail e senha só entra depois de digitar o código de 6 números que chega por e-mail.

Configuração do Neon Auth (branch `production`):

| Opção | Valor | Observação |
|---|---|---|
| `require_email_verification` | `true` | sem confirmar, o login é recusado com `email_not_confirmed` |
| `verify_email_on_sign_up` | `false` | **não tem controle no console nem no MCP**; por isso o app pede o código ele mesmo (abaixo) |
| `email_verification_method` | `otp` | o app usa código de 6 números, não link |
| `auto_sign_in_after_verification` | `true` | com o código certo a sessão já abre |
| SMTP | Resend, `nao-responda@ikizy.com`, nome "IKIZY" | domínio verificado (DKIM, SPF e MX no DNS) |
| Webhook | ligado, evento `send.otp`, timeout 5 s | aponta para `https://app.ikizy.com/api/neon-auth/webhook` |

Como o e-mail sai:
- O Neon Auth **não manda** o e-mail padrão: com o webhook `send.otp` ligado ele chama `apps/app/api/neon-auth/webhook.ts`,
  que confere a assinatura Ed25519 (JWKS do Neon) e envia o e-mail pelo Resend com a API `RESEND_API_KEY` (Vercel, Production).
- O desenho do e-mail está em `apps/app/api/_lib/authEmail.ts` (mesmo visual de `apps/landing/email/verificar-email.html`; a flor vem de
  `https://ikizy.com/email/flor.png`). Cobre os tipos `email-verification`, `forget-password` e `sign-in`, com texto simples junto.
- **Cuidado:** não marque `user.before_create` no webhook. É um evento que bloqueia o cadastro e o endpoint não responde `allowed`.
- Para voltar ao e-mail padrão do Neon (em inglês), desligue o toggle "Enable Webhooks" no console (Auth → Configuration).

O que o app faz (`AuthProvider.tsx`):
- `sendCode()` pede o código ao Neon (`emailOtp.sendVerificationOtp`) no cadastro sem sessão, no cadastro de e-mail já existente mas não
  confirmado, e no login de conta não confirmada. O botão de reenviar da tela do código usa o mesmo caminho.
- Tela `/verificar-email?email=...` (`pages/auth/VerificarEmail.tsx`): campo do código, reenvio com espera de 60 s, "usar outro e-mail".
  Com o código certo vai para `/dashboard`; se a sessão não abrir, vai para o login com aviso de "e-mail confirmado".
- Login com Google não passa por isso (o Google já garante o e-mail).

Pontos de atenção:
- **E-mail errado no cadastro:** se o Gmail recusa o endereço (bounce), o Resend passa a bloquear novos envios para ele (*Suppressed*)
  e a pessoa fica na tela do código sem receber nada. Os envios aparecem em Resend → Emails.
- Contas antigas sem confirmação caem na tela do código ao entrar.

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

## 8. Estado atual

- 15/10/2026 (Clientes, item 5.3 do plano de experiência): filtro **"Chamar hoje (N)"** na lista (aniversário hoje, sumida há mais de 45 dias ou retorno atrasado pelo intervalo dela; quem já tem horário marcado só entra pelo aniversário), regra em `domain/clients/call.ts`. Nesse filtro a linha diz o motivo e tem o botão de mensagem pronta no tipo certo; o "já enviei" é o mesmo do "Chamar hoje" da Agenda. A bolinha de seleção só aparece depois de tocar em "Selecionar várias", e os 4 números do topo ficam só na tela larga. Confirmar/Recusar direto na faixa de pedidos já existia (`PendingBanner`).
- 15/10/2026 (cadastro novo, estilo Peec AI, migration `20261029000000_create_salon_setup` aplicada em 15/10/2026): `/cadastro/salao` virou uma pergunta por tela (seu nome se faltar, nome do negócio + link, áreas, Só eu / Eu e equipe, horário, revisão dos serviços) com a prévia do sistema se montando ao fundo; depois "Montando…", "Sua agenda está pronta" e `/cadastro/plano` com os 3 planos (30 dias grátis sem cartão via `choose_trial_plan`, ou cartão no Stripe com `from=onboarding`). Código em `pages/cadastro/`, regras em `domain/onboarding/`, rascunho em `data/onboarding.ts`. `create_salon_setup()` cria tudo numa transação (R-11); sem a migration o app usa o caminho antigo em partes. No modo demonstração (`npm run dev -- --mode demo` com `.env.demo.local` vazio) o cadastro roda de ensaio, sem gravar.
- 12/10/2026 (lembretes por e-mail, migration `20261027000000_email_reminders` aplicada em 15/10/2026): cron diário `/api/cron/trial-reminders` (9h de Brasília) manda
  aviso de teste/Pix/cancelamento acabando (7, 3 e 1 dia), cartão recusado e acesso terminado (R-103, E8, E10, E11). Um aviso por negócio por rodada, sem repetir
  (`email_log`). O e-mail da dona vem de `POST /api/account/sync-email` (token verificado), chamado pelo app ao entrar; sem ele o negócio não recebe aviso.
  Precisa de `CRON_SECRET` e `RESEND_API_KEY` na Vercel. Hobby: 2 crons diários (expire-requests e trial-reminders).
- 12/10/2026 (LGPD e pedidos sem resposta, migration `20261026000000_lgpd_requests` aplicada em 15/10/2026): `forget_client()` (só a dona; ficha anônima "Cliente removida"
  se houver atendimentos, apagada se não houver; botão na ficha, pede o nome) e `expire_stale_requests()` chamada pelo cron diário `/api/cron/expire-requests`
  (`vercel.json`; exige a variável `CRON_SECRET` na Vercel, sem ela a rota responde 503).
- 12/10/2026 (endurecimento, migration `20261025000000_hardening` aplicada em 15/10/2026): `neon/migrations/20261025000000_hardening.sql` (mês fechado no fuso de Brasília,
  `close_month` confere faturamento, atendimentos e saídas com o banco e exige assinatura ativa, concluir exige forma de pagamento e concluído
  não se apaga, atendimento só aponta para cliente/profissional/serviço do próprio negócio, `hit_rate_limit`, WhatsApp único por negócio).
  **Testar antes numa branch do Neon** e só então aplicar (`npm run db:migrate -- --aplicar`). O app e a API já tratam as mensagens novas e
  seguem funcionando sem a migration (o limitador falha aberto). Financeiro: filtro de datas (`PeriodPicker`, `domain/finance/period.ts`,
  `buildPeriod`) no lugar do seletor de mês e do mapa de dias; só o mês inteiro fecha. Cabeçalhos de segurança em `apps/app/vercel.json`.
- 12/10/2026, organização do código (fases 1 a 3, ver [docs/CONVENCOES.md](docs/CONVENCOES.md)): regras da casa em três camadas
  (`src/domain` puro e testado, `src/data` só busca, telas só apresentam), verificador `npm run check:conventions` e `npm test`
  (API + domínio). Financeiro refeito: `pages/financeiro/`, `components/finance|charts|ui`, recibo do dia e do mês em folha, mapa de dias.
  Fase 4 concluída (mesma receita): Meu negócio, Agenda, Clientes e Meu site em `pages/<tela>/`, regras em `domain/{finance,business,agenda,clients,site}`.
  Os arquivos `dashboard.css`, `calendar.css`, `studio.css`, `sects.css` e `wizard.css` deixaram de existir: cada estilo mora ao lado do seu componente;
  `pages.css` ficou com 78 linhas e `forms.css` guarda o sistema de formulário (`.form`, `.field`, `.input`, `.switch`).
- 11/10/2026 (depois), na `main`: confirmação de e-mail **ligada** (seção 5b); primeiros passos virou painel flutuante que recolhe
  e some ao concluir; **Meu negócio** em abas (Dados, Horário, Serviços, Materiais) e no menu do topo; Pix só de 1 e 3 meses (sem 12);
  tela de assinatura relê e tenta de novo se a leitura vier vazia.
- 11/10/2026, Fase 1 do [plano de experiência](docs/PLANO-DE-EXPERIENCIA.md) em andamento, já na `main`: Agenda é a tela
  inicial (o Início com números de exemplo saiu), lista do dia no celular, pedidos com Confirmar/Recusar, barra do celular
  com [+], **Meu negócio** (`/dashboard/negocio`: dados, horário, serviços, custos), cadastro em 3 telas (nome na conta,
  "Seu negócio" numa tela, teste sem cartão no plano certo), login que volta para onde ia, Caixa de hoje no Financeiro,
  Primeiros passos na agenda e planos sem promessas. Migration `fase1` aplicada em produção. Falta: os serviços externos
  (seção 5 da [especificação](docs/ESPECIFICACAO-PRODUCAO.md)).
- 09/10/2026, já na `main`: confirmação de e-mail por código pronta no app mas desligada no Neon (seção 5b); seleção de texto em vermelho
  (landing e sistema); menu próprio do botão direito no sistema (`components/AppContextMenu.tsx`: novo agendamento, nova cliente,
  seções, ver o site, copiar link, recarregar, sair; campos de texto e Shift + botão direito mantêm o menu do navegador;
  `/dashboard/clientes?nova=1` abre o cadastro de cliente, como `/dashboard/agenda?nova=1` já fazia).
- Antes disso, `main` e `dev` iguais e em produção (merge `2e61050`): setas entre as etapas, serviços agrupados, planos por assinatura (Novidade), guia sem rolagem, paletas combinadas, guia no UX da criação de conta, tela cheia, vitrine e fotos, agendamento online.
- Salão de teste: slug `salao` (12 serviços, 1 profissional), site publicado pela usuária durante os testes.

---

## 9. Sugestões de melhoria (priorizadas)

Ordem pensada para o que mais faz um salão **contratar e continuar pagando**. Cada item diz o que já existe e o que falta.
Prioridade: **P1** = próximo a fazer, **P2** = logo depois, **P3** = quando houver tempo.

### 9.1 Agendamento da cliente pelo site (o diferencial principal)

Hoje: a cliente escolhe serviço, profissional, dia e horário livre, informa nome e WhatsApp, e o pedido entra na agenda como **pendente**.

| Prioridade | Melhoria | Por quê / como |
|---|---|---|
| ~~P1~~ | **Aviso de novo pedido para o salão** (feito) | `components/PendingRequests.tsx`: sininho do topo com contagem e lista, faixa "N pedidos do site para confirmar" no Início e na Agenda, contagem no título da aba e aviso rápido (toast) quando chega pedido com o sistema aberto. Pedido = atendimento `pendente` daqui para a frente (os criados no sistema já entram `confirmado`); busca a cada 60 s e ao voltar para a aba (`pending` no `AgendaProvider`). Clicar abre `/dashboard/agenda?pedido=id`, que vai ao dia e abre o atendimento (Confirmar já existe lá). Falta: e-mail/push com o sistema fechado (depende do PWA). |
| P1 | **Confirmar/recusar em um toque** | Lista "Pedidos online" com botões Confirmar e Recusar; ao confirmar, abrir o WhatsApp da cliente com mensagem pronta ("Seu horário de X, dia Y às Z, está confirmado"). |
| P1 | **Confirmação automática (opcional)** | Chave "confirmar sozinho" por salão: pedidos dentro do expediente já entram como confirmados. |
| P1 | **Link da cliente para ver, remarcar ou cancelar** | Após o pedido, um link único (token) com o status; cancelar libera a vaga; remarcar reaproveita a escolha de horário. Regra de antecedência para cancelar. |
| P2 | **Sinal por Pix** | O campo "% de sinal" já existe no site. Gerar cobrança Pix (Stripe ou PSP brasileiro) no pedido; a vaga fica reservada por X minutos até o pagamento. Reduz faltas. |
| P2 | **Lembrete antes do horário** | Mensagem de lembrete (24 h e 2 h antes) com botão de confirmar presença. Via WhatsApp Business API, ou pelo menos e-mail/SMS. Cron na Vercel. |
| P2 | **Serviço × profissional** | Hoje toda profissional faz todos os serviços. Marcar quem faz o quê; o site só oferece a profissional certa. |
| P2 | **Intervalo entre atendimentos e bloqueios** | Tempo de limpeza após cada serviço; bloquear horários (almoço extra, folga, férias) sem precisar mudar o expediente. |
| P2 | **Mais de um serviço no mesmo pedido** | Ex.: mão + pé: soma as durações e procura um horário contínuo. |
| P3 | **Lista de espera** | Dia cheio: a cliente entra na fila e é avisada se abrir vaga. |
| P3 | **Fuso horário por salão** | Hoje fixo em America/Sao_Paulo (problema para Acre, Amazonas e Fernando de Noronha). |
| P3 | **Política de cancelamento e no-show** | Texto exibido no agendamento e cobrança do sinal em caso de falta. |

### 9.2 Site do salão

| Prioridade | Melhoria | Por quê / como |
|---|---|---|
| P1 | **Fundos prontos para a capa** | Hoje, sem foto, a capa é um degradê na cor da paleta. Oferecer 6 a 10 fotos/texturas de banco livre por segmento (unhas, cílios, cabelo...) no guia. É o que faz o site nascer bonito, como na GlossGenius. |
| P1 | **Galeria / portfólio** | Fotos dos trabalhos (antes e depois), em grade. Salões vendem pelo visual. Reaproveita `site_photos`. |
| P2 | **Depoimentos** | Avaliações das clientes (o salão escolhe quais mostrar). Depois: pedir avaliação automaticamente após o atendimento concluído. |
| P2 | **SEO local e compartilhamento** | Imagem de compartilhamento (og:image) gerada com a capa e o nome; dados de horário e endereço no JSON-LD; sitemap dos sites publicados. |
| P2 | **Domínio próprio** | `www.studiomaria.com.br` apontando para o site (Vercel Domains API). Recurso para os planos Studio/Salão. |
| P3 | **Instagram no site** | Últimas fotos do Instagram ou link em destaque. |
| P3 | **Perguntas frequentes** | Bloco de FAQ editável (formas de pagamento, estacionamento, atraso). |
| P3 | **Métricas do site** | Visitas, cliques em "Agendar" e no WhatsApp, pedidos gerados. Mostra ao salão o valor do site. |

### 9.3 Clientes, fidelização e vendas

| Prioridade | Melhoria | Por quê / como |
|---|---|---|
| P1 | **Planos por assinatura com cobrança de verdade** | Hoje os planos aparecem no site e a cobrança é por WhatsApp. Próximo passo: assinatura da cliente (cartão recorrente ou Pix mensal), controle de uso ("2 de 2 manutenções no mês") e aviso de vencimento. |
| ~~P2~~ | **Mensagens prontas no WhatsApp** (feito) | Sem disparo automático, por decisão da usuária: o texto abre no WhatsApp da própria pessoa (wa.me). Tipos em `lib/messages.ts`; card "Mensagens de hoje" no Início (lembretes, pós, faltas, aniversário, prêmio, sumidas), botão Mensagem na agenda e na ficha. O "já enviei" fica só no navegador. Disparo automático (Meta oficial, Z-API ou Evolution) ficou para depois. |
| P2 | **Aniversariantes** | Lista do mês com mensagem pronta e cupom. |
| ~~P2~~ | **Fidelidade** (feito) | Cartão de selos configurável por salão (selos por prêmio e prêmio), selo extra, resgate e desfazer. Próximo: cashback. |
| P3 | **Venda de produtos com estoque** | A vitrine existe; somar estoque, baixa na venda e alerta de reposição. |
| ~~P3~~ | **Ficha da cliente** (feito) | Abas Resumo/Ficha/Histórico/Anotações; anamnese com 20 perguntas, termo assinado com o dedo, pontos de atenção no resumo. Fotos de antes e depois (miniatura na lista, foto inteira ao abrir, comparação lado a lado). |

### 9.4 Agenda, equipe e financeiro

| Prioridade | Melhoria | Por quê / como |
|---|---|---|
| P2 | **Arrastar para remarcar** na grade da agenda | Mais rápido que abrir o menu. |
| P2 | **Atendimentos recorrentes** | "Toda quinzena às 10h" (manutenção de unha/cílios). |
| P2 | **Acesso da profissional** | Cada profissional vê a própria agenda e comissões no celular (papel `professional` já existe no banco). |
| P2 | **Pagamento na hora (Pix/cartão)** | Registrar e, depois, cobrar pelo app; alimenta o financeiro sem digitar. |
| P3 | **Relatórios** | Serviços mais vendidos, ticket médio por profissional, horários ociosos, taxa de faltas. |
| P3 | **Várias unidades** | Plano Salão com mais de um endereço. |

### 9.5 Produto e plataforma

| Prioridade | Melhoria | Por quê / como |
|---|---|---|
| ~~P1~~ | **Ligar a confirmação de e-mail** (feito) | Ligada em 11/10/2026: código por e-mail (Resend, webhook `send.otp`). Passo a passo e cuidados na seção 5b. |
| ~~P1~~ | **Checklist de primeiros passos** (feito) | Painel flutuante no canto (`components/FirstSteps.tsx`), em todas as telas do dashboard: horário, preços, site e agendamento online. Recolhe num botão com anel de progresso, lembra a escolha por negócio e some sozinho ao concluir (mostra "Tudo pronto!" por uns 4 s). Só dona e gerente; some dentro do editor do site. |
| P1 | **App instalável (PWA) + notificações push** | Base para avisar novos pedidos e lembretes. |
| P2 | **Indique e ganhe** | Como o "Give $30, get $30" da GlossGenius: link de indicação, crédito na assinatura das duas. Crescimento barato. |
| P2 | **Testes de ponta a ponta** | Playwright para o fluxo cadastro → site → agendamento; hoje há só testes das funções do servidor (81). |
| P2 | **Monitoramento de erros** | Sentry (ou similar) no app e nas funções da Vercel. |
| P3 | **Branch de banco para desenvolvimento** | Hoje o `localhost` usa o banco de produção. Usar uma branch do Neon para dev/preview e aplicar migrations primeiro nela. |
| P3 | **LGPD** | Termo de consentimento no agendamento, exportar/apagar dados da cliente. |
| P3 | **Ferramenta de migrations** | Registrar quais já foram aplicadas (tabela de controle) em vez de aplicar à mão. |

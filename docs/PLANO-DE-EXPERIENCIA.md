# IKIZY: plano de experiência (antes de colocar no ar)

Análise geral do sistema em 10/10/2026, feita a partir do código e de capturas de todas as telas no computador (1440px)
e no celular (375px). **Nada aqui foi implementado ainda.** É o mapa para decidir e depois construir.

Substitui o `docs/fluxos-do-sistema.md` (de 07/10), que ficou desatualizado. Complementa o `CONTEXTO.md`.

Sumário:
1. Princípio que guia tudo
2. Diagnóstico: o que está solto hoje
3. Nova organização (mapa do sistema)
4. Perfis: quem vê o quê
5. Telas, uma a uma: manter, mudar, tirar
6. Todos os fluxos
7. O que fazer antes de ir para o ar (ordem)
8. Decisões que precisam de você

---

## 1. Princípio que guia tudo

> **O salão abre o IKIZY para ver o dia e atender. Todo o resto é secundário.**

Quem usa o sistema está no meio de um atendimento, com a mão ocupada, no celular. As perguntas que ela faz, em ordem de frequência:

1. **Quem vem agora e depois?** (várias vezes por dia)
2. **Tem pedido novo para confirmar?** (várias vezes por dia)
3. **Encaixa fulana às 15h?** (várias vezes por dia: marcar, remarcar)
4. **Quem eu preciso chamar no WhatsApp hoje?** (1 vez por dia)
5. **Quanto entrou?** (fim do dia / fim do mês)
6. **Meu site está bom?** (de vez em quando)
7. **Minha assinatura, minha equipe, meus serviços** (raramente)

Hoje o sistema está organizado ao contrário: a primeira tela é de números (perguntas 5 e 7), e a agenda do dia (pergunta 1)
só aparece depois de rolar. A proposta inverte isso: **a agenda vira a tela inicial**.

---

## 2. Diagnóstico: o que está solto hoje

### 2.1 Problemas graves (impedem ir para o ar)

| # | Problema | Onde | Por que é grave |
|---|---|---|---|
| G1 | **O Início mostra números inventados para salões reais.** Faturamento da semana, "+12% acima da semana passada", "Outubro em números", ranking de serviços e "meta de R$ 30.000" vêm de dados de exemplo (`data/mock.ts` e `data/finance.ts`), não do banco. | `pages/Dashboard.tsx` | A dona vê R$ 12.890 na semana em que faturou R$ 300. Destrói a confiança no primeiro dia. |
| G2 | **Não existe tela de equipe.** Não dá para cadastrar a 2ª profissional, editar, desativar, nem definir comissão. A agenda só pede "Cadastre quem atende" quando não há nenhuma. O Financeiro diz "Defina o percentual de cada uma" e não há onde definir. | Agenda, Financeiro | Os planos Studio e Salão (equipe) não funcionam de verdade. |
| G3 | **Não existe convite de acesso.** Os papéis gerente, recepção e profissional existem no banco, mas não há como alguém da equipe entrar. | banco `members` | O plano Salão promete "Mais profissionais e permissões". |
| G4 | **Se alguém da equipe entrasse, veria tudo.** As regras do banco deixam qualquer membro ler fechamentos do mês, atendimentos e clientes de todos. | migrations (RLS) | Profissional veria o faturamento do salão e a comissão das colegas. |
| G5 | **Planos prometem o que não existe:** "Relatórios" (Studio), "Mais profissionais e permissões" e "Atendimento prioritário" (Salão). | `lib/plans.ts`, landing | Venda de recurso que não existe. |
| G6 | **Confirmação de e-mail desligada** (seção 5b do `CONTEXTO.md`). | Neon Auth | Contas com e-mail digitado errado ficam sem recuperação de senha. |

### 2.2 Pontas soltas (confundem, mas não quebram)

| # | Ponta solta | Onde |
|---|---|---|
| P1 | A busca do topo ("Buscar cliente ou serviço") não faz nada. | `AppShell.tsx` |
| P2 | Configurações do negócio espalhadas em 5 lugares: nome do negócio em "Minha conta" (avatar); horário de atendimento num botão da Agenda; serviços, preços, WhatsApp e endereço em "Meu site"; custos de produtos em "Meu site" (mas são do Financeiro); assinatura só pelo avatar. | vários |
| P3 | **Serviços moram no "Meu site"**, mas são usados na agenda, no financeiro e no agendamento online. Quem não quer site não acha onde cadastrar serviço. | `MeuSite.tsx` |
| P4 | Pedidos do site aparecem em 3 lugares com textos diferentes: sininho/faixa ("pedidos do site para confirmar") e "Mensagens de hoje" ("Confirmar horário · Aguardando você"). | Início |
| P5 | A grade da agenda é fixa das 8h às 20h, mesmo para quem atende das 13h às 22h. A ocupação do Início usa 9h às 19h fixo. | `lib/agendaTime.ts`, Dashboard |
| P6 | No celular a barra de baixo só tem ícones, sem nome. Assinatura e Minha conta só pelo avatar. | `AppShell.tsx` |
| P7 | No celular a agenda não tem lista do dia: só a grade, uma profissional por vez (sem "Todas"). A lista do dia existe, mas só no computador. | `Agenda.tsx` |
| P8 | Tamanho das telas no celular: **Início = 5 telas de rolagem**, Financeiro = 4,5, Agenda = 2,5 (o 1º atendimento aparece só na 2ª tela). | capturas |
| P9 | Clientes no celular: bolinha de seleção (envio em massa) sempre visível em toda linha, e 4 números no topo antes da lista. | `Clientes.tsx` |
| P10 | Pedidos do site só avisam com o sistema aberto. | `PendingRequests.tsx` |
| P11 | Rotas desconhecidas em `/dashboard/*` mostram "Em construção · em breve". | `Placeholder.tsx` |
| P12 | Documentação desatualizada: `fluxos-do-sistema.md` diz que Clientes e Financeiro usam dados de exemplo (não usam mais) e que o cadastro cria plano Solo direto (hoje há escolha de plano); `CONTEXTO.md` fala da branch `dev` (não existe mais) e do cartão fidelidade como feito (foi removido). | docs |

### 2.3 O que está bom e deve ficar

- **Agenda no computador**: calendário + lista do dia + grade por profissional, menu do botão direito, status com cores, linha do "agora", horário fechado hachurado. É a melhor tela do sistema.
- **Ficha da cliente**: resumo, ficha/anamnese, histórico, anotações, fotos de antes e depois.
- **Financeiro com dados reais**: recibo do mês, fechamento que trava o mês, comissões, formas de pagamento, saídas.
- **Meu site**: guia em 2 passos, prévia fiel, paletas fixas, publicar.
- **Cadastro e questionário**: curto, bonito, já monta serviços.
- **Mensagens prontas no WhatsApp** (sem disparo automático, por decisão sua).
- **Pedidos do site** (sininho, faixa, aviso) recém-feitos.

---

## 3. Nova organização (mapa do sistema)

### 3.1 Antes e depois

```
HOJE                                    PROPOSTA
────────────────────────────────        ────────────────────────────────────────
Início (números, quase tudo falso)  →   (sai; o útil vai para Agenda e Financeiro)
Agenda                              →   AGENDA = tela inicial (dia, semana, mês)
Clientes                            →   CLIENTES (+ "chamar hoje")
Financeiro                          →   FINANCEIRO (+ caixa do dia + mês em números)
Meu site                            →   MEU SITE (só a vitrine pública)
(espalhado)                         →   MEU NEGÓCIO (novo: dados, horário, serviços,
                                         equipe, custos, assinatura, conta)
```

### 3.2 Navegação

**Celular (barra de baixo, com nome embaixo do ícone):**

```
┌──────────────────────────────────────────────┐
│  Agenda   Clientes   [ + ]   Caixa    Mais   │
└──────────────────────────────────────────────┘
```

- **[ + ]** no meio, maior: novo agendamento de qualquer tela (é a ação mais repetida do dia).
- **Caixa** = Financeiro (nome mais curto e mais claro para o dia a dia).
- **Mais** abre: Meu site, Meu negócio (serviços, equipe, horário...), Assinatura, Minha conta, Sair.

**Computador (topo):**

```
IKIZY.   Agenda  Clientes  Financeiro  Meu site      [🔍 Buscar cliente]  [🔔 2]  [+ Agendar]  (ME ▾)
```

- O avatar abre um menu: Meu negócio, Assinatura, Minha conta, Sair.
- A busca passa a funcionar: digita o nome, aparece a cliente; Enter abre a ficha.

### 3.3 Mapa de rotas proposto

```
/dashboard                 → Agenda (hoje)            [era o Início]
/dashboard/agenda          → redireciona para /dashboard (links antigos continuam valendo)
/dashboard/clientes[/:id]  → Clientes / ficha
/dashboard/financeiro      → Financeiro (abre no caixa de hoje; mês ao lado)
/dashboard/site            → Meu site
/dashboard/negocio         → Meu negócio (novo), com seções:
        #dados  #horario  #servicos  #equipe  #custos
/dashboard/assinatura      → Assinatura (continua, mas entra pelo Mais/avatar)
/convite/:token            → aceitar convite da equipe (novo)
```

---

## 4. Perfis: quem vê o quê

Hoje, na prática, só existe a **dona**. A proposta define os 4 perfis que o banco já prevê.

| Área | Dona | Gerente | Recepção | Profissional |
|---|---|---|---|---|
| Agenda de todas | ✅ | ✅ | ✅ | ❌ só a dela ("Minha agenda") |
| Marcar / remarcar / cancelar | ✅ | ✅ | ✅ | ✅ só na agenda dela |
| Confirmar pedidos do site | ✅ | ✅ | ✅ | ✅ só os dela |
| Concluir com forma de pagamento | ✅ | ✅ | ✅ | ✅ só os dela |
| Clientes: lista e ficha | ✅ | ✅ | ✅ | ✅ só as que já atendeu ou tem marcadas |
| Clientes: total gasto, ticket | ✅ | ✅ | ❌ | ❌ |
| Mensagens prontas (WhatsApp) | ✅ | ✅ | ✅ | ✅ das clientes dela |
| Financeiro do salão | ✅ | ✅ | ❌ (só o caixa do dia) | ❌ |
| "Meus ganhos" (comissão própria) | — | — | — | ✅ |
| Fechar o mês | ✅ | ✅ | ❌ | ❌ |
| Meu site | ✅ | ✅ | ❌ | ❌ |
| Meu negócio: serviços, horário | ✅ | ✅ | ❌ | ❌ (pode ver o próprio horário) |
| Meu negócio: equipe e convites | ✅ | ✅ (menos mudar a dona) | ❌ | ❌ |
| Assinatura e pagamento | ✅ | ❌ | ❌ | ❌ |

**Por plano:**
- **Solo:** só a dona; a dona é a profissional. Nada de equipe, comissão ou convite aparece.
- **Studio:** equipe sem limite rígido de acessos? → *decisão sua (seção 8)*. Sugestão: até 3 profissionais e convites.
- **Salão:** equipe maior, papéis de recepção e gerente.

**Importante (G4):** antes de liberar convites, as regras do banco precisam acompanhar a tabela acima
(profissional não lê `month_closings`, não lê comissão das outras, não vê atendimento de outras).
Esconder na tela não basta: a Data API é aberta ao navegador.

---

## 5. Telas, uma a uma: manter, mudar, tirar

Legenda: **Manter** · **Mudar** · **Tirar** · **Novo**

### 5.1 Agenda (vira a tela inicial)

**Celular — proposta (o 1º atendimento aparece sem rolar):**

```
┌─────────────────────────────────┐
│ IKIZY.                🔔2  (ME) │
│                                 │
│ Sáb, 11 de outubro      [Hoje]  │  ← toque abre o mês
│ ‹ Qui Sex [Sáb] Dom Seg Ter ›   │  ← faixa de dias, arrasta
│ 9 atendimentos · R$ 1.960       │
│ ─────────────────────────────── │
│ ┌ 2 pedidos do site ─────────┐  │  ← só se houver
│ │ Fernanda · Nail art · 16:00│  │
│ │      [Recusar] [Confirmar] │  │  ← confirma direto aqui
│ └────────────────────────────┘  │
│ AGORA                           │
│ ┃11:30 Marina Costa   ● Em at.  │
│ ┃      Esmaltação · Ana         │
│ ┃      [Concluir e receber]     │  ← ação do momento
│ PRÓXIMOS                        │
│  12:00 Larissa Nunes  Confirm.  │
│        Lash lifting · Bia  [💬] │  ← 💬 = lembrete pronto
│  13:30 Patrícia Lima  Confirm.  │
│  ┄┄ 15:00–16:00 livre ┄┄  [+]  │  ← buraco livre: toque marca
│  16:00 Fernanda Rocha Aguard.   │
│ JÁ ATENDIDAS (3)            ▾   │  ← recolhido
├─────────────────────────────────┤
│ Agenda Clientes [+] Caixa  Mais │
└─────────────────────────────────┘
```

- **Mudar:** no celular a visão padrão vira **lista do dia** (não a grade). A grade continua num botão "Grade" para quem quer.
- **Mudar:** filtro de profissional vira um seletor "Todas ▾" no topo (hoje são chips, e "Todas" some no celular).
- **Novo:** horários livres aparecem como buracos tocáveis na lista ("15:00–16:00 livre [+]").
- **Novo:** o atendimento em andamento ganha destaque e o botão do próximo passo (Iniciar / Concluir e receber).
- **Novo:** botão 💬 em cada linha com a mensagem certa do momento (confirmação, lembrete, pós-atendimento).
  Isso **substitui o card "Mensagens de hoje"** do Início para tudo que é ligado a atendimento.
- **Mudar:** pedidos do site com **Confirmar / Recusar direto na faixa** (sem abrir o atendimento) e, ao confirmar, abre o WhatsApp com a mensagem pronta.
- **Mudar:** "Horário de atendimento" sai da agenda e vai para Meu negócio (fica um atalho no menu ⋯ da agenda).
- **Mudar:** a grade usa o horário real do salão (do primeiro início ao último fim cadastrados), não 8h–20h fixo.
- **Tirar:** legenda de cores no rodapé no celular (o status vai escrito na linha).

**Computador — proposta (mantém o que já funciona, ajusta o topo):**

```
┌────────────────────────────────────────────────────────────────────────────────────┐
│ Sáb, 11 out  ‹ Hoje ›   [Dia | Semana | Mês]   Todas ▾     9 atend. · R$ 1.960  [+ Agendar] │
├───────────────┬────────────────────────────────────────────────────────────────────┤
│ Calendário    │ ┌ 2 pedidos do site ───────────── [Recusar] [Confirmar] ┐            │
│ do mês        │ └───────────────────────────────────────────────────────┘            │
│               │      Ana Clara        Bia Souza        Carla Mendes                  │
│ Lista do dia  │ 09 ┃ Juliana ✓      ┃ Camila ✓       ┃                               │
│ (agora,       │ 10 ┃                ┃                ┃ Luciana ✓                     │
│  próximos,    │ 11 ┃ Marina ●       ┃                ┃              ── agora ──      │
│  atendidas)   │ 12 ┃                ┃ Larissa        ┃ Aline                          │
│               │ ...                                                                  │
│ Chamar hoje   │                                                                      │
│ (aniversário, │                                                                      │
│  sumidas: 3)  │                                                                      │
└───────────────┴────────────────────────────────────────────────────────────────────┘
```

- **Manter:** calendário + lista + grade, botão direito, linha do agora.
- **Novo:** visão **Semana** de verdade na grade (hoje "Semana" só muda o calendário pequeno).
- **Novo:** cartão "Chamar hoje" (aniversário e sumidas) na coluna da esquerda, que é o resto do "Mensagens de hoje".

### 5.2 Início (sai)

| Bloco de hoje | Destino |
|---|---|
| Previsto hoje / No caixa / Concluídos | Topo da Agenda ("9 atendimentos · R$ 1.960") e Caixa do dia no Financeiro |
| Teste grátis (cartão preto grande) | **Tira** do meio da tela. Vira uma linha discreta no menu Mais/avatar e o aviso amarelo só quando faltar ≤ 7 dias (já existe: `BillingBanner`) |
| Pedidos do site | Agenda |
| Faturamento da semana (falso) | Financeiro, com dado real |
| Próximos atendimentos | É a própria Agenda |
| Mensagens de hoje | Agenda (💬 por atendimento) + "Chamar hoje" (aniversário, sumidas) |
| Outubro fecha em X dias | Financeiro (já existe lá: "Pronta para fechar outubro?") |
| Outubro em números (falso) | Financeiro, com dado real (ticket, ocupação, faltas, atendimentos) |
| Serviços que mais rendem (falso) | Financeiro, com dado real (já existe a "Composição" e o recibo por categoria) |

**Alternativa**, se você quiser manter um painel: deixar o Início só para dona/gerente, **com dados reais**, e a Agenda como tela
inicial de todo mundo. Ver decisão D1.

### 5.3 Clientes

```
CELULAR
┌─────────────────────────────────┐
│ Clientes                  [+ ]  │
│ [🔍 Buscar nome ou telefone   ] │
│ Todas · Chamar hoje (5) · VIP · │  ← "Chamar hoje" = aniversário,
│ Novas · Sumidas                 │     sumidas, retorno atrasado
│ ─────────────────────────────── │
│ (MC) Marina Costa       VIP 🎂  │
│      Última visita há 2 dias    │
│ (DF) Débora Freitas      Nova   │
│ ...                             │
│              [Selecionar várias]│  ← modo seleção só quando pedir
└─────────────────────────────────┘
```

- **Manter:** lista, busca, filtros, ficha completa, anamnese, fotos, mensagem pronta, envio para várias.
- **Mudar:** as 4 bolinhas de números (Ativas, Novas, Retorno, Sumidas) saem do topo no celular; vão para o Financeiro/relatório ou ficam só no computador.
- **Mudar:** a bolinha de seleção só aparece depois de tocar em "Selecionar várias".
- **Novo:** filtro **"Chamar hoje"** (quem tem motivo para receber mensagem hoje).
- **Mudar (perfil):** recepção e profissional não veem "Total gasto" nem ticket da cliente.
- **Manter:** ficha em tela cheia no celular, com voltar.

### 5.4 Financeiro (Caixa)

```
CELULAR
┌─────────────────────────────────┐
│ Caixa         [Hoje | Mês]      │
│                                 │
│ HOJE · sáb, 11 out              │
│ Recebido      R$ 640            │
│ A receber     R$ 1.320 (6)      │
│ Pix 400 · Crédito 240           │
│ ─────────────────────────────── │
│ Recebimentos de hoje            │
│  09:00 Juliana  Pix   R$ 220    │
│  09:30 Camila   Créd. R$ 260    │
│ [+ Lançar saída]                │
└─────────────────────────────────┘
(aba Mês = o que existe hoje: recibo, fechamento, comissões, saídas,
 + "mês em números" e "serviços que mais rendem" vindos do Início, com dado real)
```

- **Novo:** aba **Hoje** (caixa do dia): quanto entrou, por forma de pagamento, o que falta receber. É o que a recepção usa.
- **Manter:** aba Mês inteira (recibo, fechar o mês, comissões, saídas, exportar, enviar no WhatsApp).
- **Mudar:** no celular, o recibo vai para o fim (ou para um botão "Ver recibo"), e o resumo (bruto, lucro, margem) vem primeiro. Hoje o recibo fica no meio da rolagem.
- **Mudar:** "Produtos e custos" sai do Meu site e vem para cá (ou para Meu negócio → Custos), porque é dinheiro, não site.
- **Novo (profissional):** "Meus ganhos": atendimentos concluídos e comissão do mês, só dela.

### 5.5 Meu site

- **Manter:** guia em 2 passos, prévia, paleta, fonte, logo, capa, textos, vitrine de produtos, planos por assinatura, publicar, agendamento online.
- **Mudar:** serviços: o cadastro passa a ser em Meu negócio → Serviços; no Meu site fica só "o que aparece no site" (mostrar/esconder, foto, ordem).
- **Mudar:** WhatsApp, Instagram, endereço e horário escrito vêm de Meu negócio → Dados (um lugar só; o site lê de lá).
- **Tirar:** etapa "Produtos e custos" (vai para o Financeiro/Meu negócio).
- Resultado: 3 etapas em vez de 4: **Página · Serviços no site · Vitrine**.

### 5.6 Meu negócio (novo)

```
┌─────────────────────────────────┐
│ Meu negócio                     │
│ Dados do negócio            ›   │  nome, endereço, WhatsApp, Instagram
│ Horário de atendimento      ›   │  por profissional (já existe o diálogo)
│ Serviços                    ›   │  nome, preço, duração, categoria, quem faz
│ Equipe                      ›   │  profissionais, comissão, acesso (convite)
│ Custos de material          ›   │  (hoje "Produtos e custos" no Meu site)
│ Assinatura                  ›   │  plano, pagamento
└─────────────────────────────────┘
```

- **Novo:** é a "casa" de tudo que hoje está espalhado (P2, P3).
- **Equipe**: lista de profissionais; adicionar, editar nome/especialidade, comissão %, desativar; "Dar acesso" gera convite (link para mandar no WhatsApp) com o papel (profissional, recepção, gerente).
- **Serviços**: ganha "quem faz" (cada profissional marca os serviços dela), que também resolve o item "Serviço × profissional" do agendamento online.

### 5.7 Topo, conta e assinatura

- **Mudar:** busca do topo passa a funcionar (clientes e, depois, atendimentos).
- **Mudar:** avatar abre menu (Meu negócio, Assinatura, Minha conta, Sair) em vez de abrir direto o formulário de nome.
- **Manter:** Assinatura como está (planos, Pix adiantado, cartão, portal Stripe).
- **Mudar:** textos dos planos sem promessa do que não existe (G5) até existir.
- **Manter:** `BillingBanner` (aviso só quando precisa agir).
- **Tirar:** cartão grande "21 dias grátis" do topo da tela inicial (fica uma linha no menu e o aviso nos últimos 7 dias).

### 5.8 Acesso (login, cadastro, questionário, plano)

- **Manter:** tudo.
- **Mudar:** ligar a confirmação de e-mail (G6).
- **Novo:** tela de aceitar convite (`/convite/:token`): mostra "Ana Clara te convidou para o Studio Maria Beauty como profissional", cria a conta ou entra, e cai direto em "Minha agenda".
- **Mudar:** depois do cadastro, a primeira tela é a Agenda vazia com **"Primeiros passos"** (horário → serviços com preço → site → agendamento online), que hoje é só o checklist do Meu site.

---

## 6. Todos os fluxos

### 6.1 Chegada: do site até o primeiro dia

```mermaid
flowchart TD
    L[ikizy.com] -->|Criar conta| C[/cadastro<br/>e-mail+senha ou Google/]
    C -->|e-mail| V[/verificar-email<br/>código de 6 números/]
    C -->|Google| Q
    V --> Q[/cadastro/salao<br/>segmentos, equipe, serviços, preços, nome e endereço/]
    Q --> P[/cadastro/plano<br/>plano + cartão ou Pix/]
    P --> A[Agenda vazia + Primeiros passos]
    A --> H[1. Horário de atendimento]
    A --> S[2. Serviços com preço e duração]
    A --> W[3. Publicar o site]
    A --> O[4. Ligar agendamento online]
```

O que muda: hoje cai no Início com números de exemplo; passa a cair na Agenda com o roteiro.

### 6.2 Dia a dia da dona (Solo), no celular

```mermaid
flowchart TD
    Abre[Abre o app] --> Ag[Agenda de hoje]
    Ag --> Ped{Tem pedido do site?}
    Ped -->|sim| Conf[Confirmar na faixa] --> WA1[WhatsApp: horário confirmado]
    Ped -->|não| Lista
    WA1 --> Lista[Lista: agora e próximos]
    Lista --> Chega[Cliente chegou: Iniciar]
    Chega --> Fim[Concluir e receber: forma de pagamento]
    Fim --> WA2[💬 pós-atendimento, opcional]
    Lista --> Lemb[💬 lembrete para quem vem amanhã]
    Lista --> Livre[Buraco livre: + marcar]
```

### 6.3 Marcar um horário (pedido por WhatsApp ou telefone)

```mermaid
flowchart LR
    Plus[+ em qualquer tela<br/>ou buraco livre] --> Cli[Cliente: busca ou nova<br/>nome + WhatsApp]
    Cli --> Srv[Serviço<br/>já traz preço e duração]
    Srv --> Pro[Profissional<br/>só quem faz o serviço]
    Pro --> Hor[Dia e horário<br/>só horários livres]
    Hor --> Ok[Agendado, confirmado]
    Ok --> Msg[Oferece: mandar confirmação no WhatsApp]
```

Hoje já é quase assim; muda: "só quem faz o serviço" (depende de Serviço × profissional) e a oferta de mensagem no fim.

### 6.4 Pedido pelo site

```mermaid
flowchart TD
    Cl[Cliente no site do salão] --> Esc[Serviço, profissional, dia, horário, nome e WhatsApp]
    Esc --> Pend[(Atendimento pendente)]
    Pend --> Aviso[Sininho, faixa na Agenda, aviso na tela<br/>+ push/e-mail com o app fechado: futuro]
    Aviso --> Dec{Salão decide}
    Dec -->|Confirmar| C1[confirmado] --> W1[WhatsApp: confirmado]
    Dec -->|Recusar| C2[cancelado, vaga liberada] --> W2[WhatsApp: não deu, sugerir outro horário]
    Dec -->|Sem resposta até o horário| C3[some da lista de pedidos<br/>continua aguardando na agenda]
```

O que falta: Confirmar/Recusar direto na faixa e a mensagem de recusa (hoje só existe a de confirmação).

### 6.5 Remarcar, cancelar, falta

```mermaid
flowchart LR
    At[Atendimento] -->|Remarcar| R[novo dia/hora/profissional] --> RW[💬 avisa a cliente]
    At -->|Cancelar| X[confirma] --> XW[💬 opcional]
    At -->|Falta| F[faltou] --> FW[💬 'sentimos sua falta']
```

Já existe. Muda só a oferta de mensagem depois de cada ação (hoje só ao confirmar).

### 6.6 Clientes e relacionamento

```mermaid
flowchart TD
    Lst[Clientes] --> Busca[Buscar] --> Ficha
    Lst --> Hoje[Filtro Chamar hoje<br/>aniversário, sumidas, retorno atrasado] --> Msg[Mensagem pronta]
    Lst --> Varias[Selecionar várias] --> Massa[Mensagem para várias]
    Ficha[Ficha] --> Agendar[Agendar] --> Plus[fluxo 6.3 já com a cliente]
    Ficha --> Anam[Ficha/anamnese + assinatura]
    Ficha --> Fotos[Antes e depois]
    Ficha --> Hist[Histórico]
```

### 6.7 Dinheiro

```mermaid
flowchart TD
    Conc[Concluir atendimento<br/>com forma de pagamento] --> CxD[Caixa de hoje]
    Saida[Lançar saída] --> Mes
    CxD --> Mes[Mês: bruto, comissões, produtos, taxas, lucro]
    Mes --> Fechar{Fim do mês}
    Fechar -->|Fechar| Trava[Recibo fechado, mês travado]
    Trava --> Enviar[Exportar / WhatsApp para contadora]
    Mes --> Com[Comissões por profissional]
    Com -.-> MG[Profissional vê 'Meus ganhos']
```

### 6.8 Equipe (novo)

```mermaid
flowchart TD
    Dona[Dona: Meu negócio → Equipe] --> Add[Adicionar profissional<br/>nome, especialidade, comissão, serviços que faz]
    Add --> Hr[Horário dela]
    Add --> Acc{Dar acesso?}
    Acc -->|não| Fim[Só aparece na agenda]
    Acc -->|sim| Conv[Escolhe papel e gera link]
    Conv --> Zap[Manda o link no WhatsApp]
    Zap --> Aceita[/convite/token: cria conta ou entra/]
    Aceita --> Ela[Profissional cai em Minha agenda]
    Dona --> Tirar[Remover acesso / desativar profissional]
```

### 6.9 Site

```mermaid
flowchart LR
    G[Guia 2 passos: visual e endereço] --> Pub[Publicar]
    Pub --> Comp[Completar: textos, fotos, vitrine, planos]
    Comp --> On[Ligar agendamento online<br/>checklist: serviços, horário, quem atende]
    On --> Ped[Pedidos chegam: fluxo 6.4]
```

### 6.10 Assinatura

```mermaid
flowchart TD
    T[Teste 30 dias] -->|faltam 7 dias| Av[Aviso amarelo]
    Av --> Pg[Assinatura: cartão ou Pix]
    T -->|venceu sem pagar| RO[Só leitura: vê tudo, não altera]
    RO --> Pg
    Pg --> Ok[Ativo]
    Ok -->|cartão falhou| Falha[Aviso: atualizar pagamento]
```

Já existe. Muda só onde se entra (menu Mais/avatar e o aviso).

### 6.11 Profissional (com acesso, novo)

```
CELULAR — Minha agenda
┌─────────────────────────────────┐
│ Olá, Bia                🔔1     │
│ Sáb, 11 out · 4 atendimentos    │
│ AGORA  12:00 Larissa · Lash     │
│        [Iniciar]                │
│ 14:30 Beatriz · Manutenção      │
│ ...                             │
├─────────────────────────────────┤
│ Agenda  Clientes  [+]  Ganhos   │
└─────────────────────────────────┘
```

Vê só a agenda dela, as clientes dela e "Ganhos" (comissão do mês). Sem Financeiro, Meu site, Meu negócio, Assinatura.

### 6.12 Recepção (com acesso, novo)

Agenda de todas, Clientes (sem valores gastos), Caixa de hoje, [+]. Sem mês, comissões, site, negócio, assinatura.

---

## 7. O que fazer antes de ir para o ar (ordem)

### Fase 1 — Obrigatório para lançar (salão Solo funcionando redondo)

1. **Tirar os números falsos** (G1): a Agenda vira a tela inicial; o que for útil do Início vai para o Financeiro com dado real.
2. **Agenda no celular em lista do dia** (P7, P8), com buracos livres, ação do momento e 💬 por atendimento.
3. **Confirmar/Recusar pedido direto na faixa** + mensagem de recusa.
4. **Barra de baixo com nomes e o botão [+]** (P6).
5. **Meu negócio** com Dados, Horário, Serviços e Custos (P2, P3); Meu site fica só com a vitrine.
6. **Grade com o horário real** do salão (P5).
7. **Busca do topo funcionando** (P1) ou retirada até funcionar.
8. **Planos sem promessas falsas** (G5) e **confirmação de e-mail** (G6).
9. **Primeiros passos** na Agenda vazia.
10. Atualizar `CONTEXTO.md` e apagar/arquivar `fluxos-do-sistema.md` (P12).

### Fase 2 — Para vender Studio e Salão (equipe)

11. **Equipe** em Meu negócio: adicionar, editar, comissão, desativar, serviços que faz (G2).
12. **Regras do banco por papel** (G4) — antes de qualquer convite.
13. **Convite de acesso** e tela `/convite/:token` (G3).
14. **Visões por perfil**: Minha agenda + Ganhos (profissional), Caixa de hoje (recepção).
15. **Agenda em semana** na grade do computador.

### Fase 3 — Depois do lançamento

16. App instalável + notificação com o sistema fechado (P10).
17. Lembretes automáticos, sinal por Pix, link da cliente para remarcar (já listados no `CONTEXTO.md` 9.1).

---

## 8. Decisões que precisam de você

| # | Decisão | Opções | Recomendação |
|---|---|---|---|
| D1 | O que fazer com o Início? | (a) some; Agenda vira a tela inicial e os números vão para o Financeiro · (b) fica só para dona/gerente, com dados reais, e a Agenda é a tela inicial | **(a)**: menos telas, nada duplicado. |
| D2 | Nome da aba de dinheiro | "Financeiro" · "Caixa" | **"Caixa"** no celular, "Financeiro" no computador, ou "Caixa" nos dois. |
| D3 | Equipe entra antes ou depois do lançamento? | lançar só Solo e equipe na fase 2 · esperar a fase 2 | **Lançar com Solo** (e Studio/Salão como "em breve" ou só com profissionais sem acesso). |
| D4 | Profissional vê clientes de quem? | só as dela · todas sem valores | **Só as dela.** |
| D5 | Limite de profissionais por plano | Studio até 3, Salão ilimitado · outro | Studio até 3, Salão ilimitado. |
| D6 | Botão [+] central no celular | sim · não | **Sim**: é a ação mais repetida do dia. |
| D7 | Recusar pedido manda mensagem? | sempre oferece · não | **Sempre oferece** (a cliente precisa saber). |

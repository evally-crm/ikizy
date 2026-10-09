# IKIZY — fluxos de cadastro e uso

Levantado do código em 07/10/2026 (branch `dev`, inclui alterações ainda não commitadas).
Renderiza em GitHub, VS Code (extensão Mermaid) ou https://mermaid.live.

## 1. Visão geral (do site ao uso diário)

```mermaid
flowchart TD
    L[Landing ikizy.com<br/>recursos, planos, FAQ, contato] -->|Criar conta| C
    L -->|Entrar| LG

    subgraph ACESSO [app.ikizy.com — acesso]
        C[/cadastro<br/>e-mail + senha ≥ 8 ou Google/]
        LG[/login<br/>e-mail + senha ou Google/]
        RS[/recuperar-senha/]
        RD[/redefinir-senha?token/]
        CF{{Confirmar e-mail}}
        C -->|e-mail/senha| CF -->|link no e-mail| LG
        C -->|Google| OAuth[Google OAuth] --> G
        LG -->|Google| OAuth
        LG -->|Esqueci| RS -->|link no e-mail| RD -->|nova senha| LG
        LG -->|ok| G
    end

    G{Guarda RequireSalon<br/>estado da sessão}
    G -->|sem sessão| LG
    G -->|sessão, sem negócio| OB
    G -->|sessão + negócio| D

    OB[/cadastro/salao<br/>Onboarding em passos/] -->|create_salon + serviços + profissional| D

    subgraph SISTEMA [/dashboard — sistema]
        D[Início] --- AG[Agenda] --- CL[Clientes] --- FN[Financeiro] --- SI[Meu site]
        D --- AS[Assinatura]
        PF[Minha conta<br/>editar nome / negócio / sair]
    end

    D -.->|banner se teste acabando,<br/>Pix vencendo, cartão falhou, sem acesso| AS
```

## 2. Onboarding (/cadastro/salao)

```mermaid
flowchart TD
    S1[1. Segmentos<br/>Unhas, Cílios, Sobrancelha, Cabelo, Estética<br/>multi-escolha] --> S2[2. Equipe]
    S2 --> S3[3. Seu nome<br/>sozinha: também vira profissional na agenda]
    S3 --> S4[4. Serviços<br/>pré-marcados por segmento]
    S4 -->|ao menos 1 marcado| S5[5. Preços<br/>pode pular]
    S4 -->|nenhum| S6
    S5 --> S6[6. Nome do negócio + endereço<br/>slug.ikizy.com]
    S6 --> V{slug ≥ 3, 3–40 chars,<br/>não reservado?}
    V -->|não| S6
    V -->|sim| S7[7. Plano<br/>Solo / Studio / Salão, sugerido pela equipe<br/>ou vindo da landing ?plano=]
    S7 -->|Começar grátis| R[RPC create_salon com p_plan]
    R -->|endereço em uso| S6
    R --> R1[(salons + members=owner<br/>+ site_settings)]
    R --> R2[(subscriptions:<br/>plano escolhido, trial 30 dias)]
    R --> R3[(services e professional<br/>do questionário)]
    R3 --> D[/dashboard/]
```

## 3. Agenda

```mermaid
flowchart TD
    A[/dashboard/agenda/] --> E{Há profissional?}
    E -->|não| FP[Cadastre quem atende<br/>nome + título] --> A
    E -->|sim| V[Calendário semana/mês<br/>lista do dia + grade por profissional]
    V --> H[Horário de atendimento<br/>por profissional e dia da semana,<br/>pausa, copiar da segunda<br/>RPC set_working_hours]
    V -->|botão, clique no horário vago<br/>ou menu de contexto| N[Novo agendamento<br/>cliente, WhatsApp, serviço ou outro,<br/>duração, valor, profissional, dia, hora]
    N -->|cliente novo é criado junto| P
    V -->|clicar no atendimento| M[Atendimento]
    M --> P(pendente)
    P -->|Confirmar| CO(confirmado)
    CO -->|Iniciar atendimento| AT(atendimento)
    AT -->|Concluir| CN(concluído)
    P & CO -->|Remarcar: profissional/dia/hora| P
    P & CO & AT -->|Marcar falta| FT(faltou)
    P & CO & AT -->|Cancelar com confirmação| CC(cancelado)
    M --> DU[Duplicar]
    M --> WA[Chamar no WhatsApp]
    CN -.->|mês fechado trava edição<br/>trigger guard_closed_month| FN[Financeiro]
```

## 4. Clientes, Financeiro, Meu site, Início

```mermaid
flowchart LR
    subgraph CLI [/dashboard/clientes e /:id]
        C1[Lista com busca e filtros por tag] --> C2[Ficha: ligar, WhatsApp, agendar,<br/>selos de fidelidade, preferências,<br/>últimos atendimentos, antes e depois,<br/>anamnese pendente/assinada]
    end
    subgraph FIN [/dashboard/financeiro]
        F1[Escolhe o mês] --> F2[KPIs, composição do faturamento,<br/>comissões, formas de pagamento]
        F2 --> F3{Mês aberto?}
        F3 -->|sim| F4[Fechar mês → RPC close_month<br/>snapshot imutável]
        F3 -->|fechado| F5[Recibo: imprimir / baixar]
    end
    subgraph SITE [/dashboard/site]
        S1[Aba Página: endereço, nome, frase,<br/>sobre, WhatsApp, Instagram, horário,<br/>mostrar preços/equipe, sinal Pix] --> S4
        S2[Aba Serviços: nome, preço, duração, visível] --> S4
        S3[Aba Produtos: gasto médio mensal] --> S4
        S4[Prévia] --> S5[Publicar]
        S6[Checklist: agendamento pelo site] -.-> S1
    end
    subgraph INI [/dashboard]
        I1[Faturamento da semana, próximos atendimentos,<br/>clientes para contatar, fechamento do mês,<br/>mês em números, ranking de serviços]
    end
```

> Estado dos dados hoje: **Agenda** e **cadastro/onboarding** usam o Neon de verdade.
> **Início, Clientes, Financeiro e Meu site** ainda leem dados de exemplo
> (`data/mock.ts`, `clients.ts`, `finance.ts`, `catalog.ts`) — o schema existe no banco, mas as telas não gravam lá.

## 5. Assinatura e pagamento

```mermaid
flowchart TD
    T[Trial Solo 30 dias sem cartão<br/>criado no create_salon] --> AS[/dashboard/assinatura/]
    AS -->|só a dona owner| ESC{Plano + forma}
    ESC -->|Cartão| CK1[POST /api/billing/checkout<br/>Stripe Checkout modo assinatura<br/>Solo em trial mantém dias restantes]
    ESC -->|Pix 1, 3 ou 12 meses<br/>12 meses = 5% off| CK2[POST /api/billing/checkout<br/>Stripe Checkout modo pagamento]
    ESC -->|já tem cartão ativo| PT[POST /api/billing/portal<br/>Portal Stripe: trocar, cancelar,<br/>atualizar cartão]
    CK1 & CK2 --> ST[Stripe]
    ST -->|retorno=ok / cancelado| AS
    ST -->|POST /api/stripe/webhook<br/>assinatura validada| WH{Evento}
    WH -->|checkout.session.completed<br/>Pix pago| W1[applyPixPayment<br/>soma meses ao acesso, 1x por evento]
    WH -->|customer.subscription.*| W2[applySubscription<br/>acesso = fim do período + 2 dias]
    W1 & W2 --> DB[(subscriptions)]
    DB --> ACC{accessState}
    ACC -->|trial / active| OK[Uso normal]
    ACC -->|ending / past_due| BN[Banner de aviso]
    ACC -->|expired| RO[Só leitura<br/>RLS bloqueia insert/update/delete<br/>via has_access]
    RO --> AS
```

## 6. Permissões

| Papel | Pode |
|---|---|
| owner | tudo, inclusive pagar/gerenciar assinatura e membros |
| manager | editar negócio, serviços/produtos |
| reception, professional | ler e operar agenda/clientes (policy `is_member`) |

Na interface hoje só aparece o fluxo da dona (a criação de membros extras ainda não tem tela).

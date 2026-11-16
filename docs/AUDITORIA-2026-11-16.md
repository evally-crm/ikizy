# IKIZY: auditoria do sistema (16/11/2026)

Feita lendo o código, as migrations, a especificação (`ESPECIFICACAO-PRODUCAO.md`), o `CONTEXTO.md` e rodando `npm audit`.
**Não verificado** (o acesso ao banco de produção e a configuração de serviços externos ficaram fora): estado real do banco,
migrations pendentes, DNS/e-mail (SPF, DKIM), Stripe em modo real, backups do Neon, uptime, Sentry recebendo erros,
acessibilidade e desempenho. Cada item abaixo diz o que é fato (visto no código) e o que é risco (precisa confirmar).

Legenda: **A** alto · **M** médio · **B** baixo.

## 1. Conta, exclusão e LGPD (onde a falha foi achada)

| # | Gravidade | Achado | O que fazer |
|---|---|---|---|
| 1.1 | A | **Master volta para o Início ao abrir `/dashboard/admin` direto ou ao recarregar.** `isAdmin` começa `false` e só vira `true` depois da chamada ao servidor; nesse intervalo a tela redireciona. (Bug da funcionalidade nova.) | Guardar "ainda conferindo" (`null`) e só redirecionar quando a resposta chegar. |
| 1.2 | A | **A confirmação da exclusão existe só na tela.** O servidor aceita `{confirm: true}` com qualquer token válido: quem tiver o token (aparelho emprestado, falha de script) apaga o negócio sem digitar nada. | O servidor exigir o que foi digitado (nome do negócio) ou uma senha recente; limitar tentativas. |
| 1.3 | A | **Exclusão imediata e sem volta**, contra a regra R-107 (dados guardados por 90 dias). Sem prazo de arrependimento, sem e-mail de confirmação depois, sem aviso de que Pix já pago não é devolvido. | Período de espera (ex.: 7 dias, cancelável), e-mail de aviso, aviso do Pix pré-pago no diálogo. |
| 1.4 | A | **Não existe exportar os dados** (portabilidade, LGPD). Nem o negócio nem a cliente final conseguem levar os dados antes de apagar. | Exportar o negócio (clientes, atendimentos, financeiro) em CSV/ZIP antes de excluir. |
| 1.5 | M | Dona exclui: **a equipe fica com o login órfão**, sem aviso. Ao entrar, cai direto no cadastro de um negócio novo. | Avisar a equipe por e-mail e/ou mostrar uma tela clara ("este negócio foi encerrado"). |
| 1.6 | M | **Registros fiscais**: ao apagar o negócio apagamos o histórico de assinatura, mas a NFS-e (R-108) nem existe ainda. Quando existir, a nota precisa ficar guardada por anos mesmo com a conta apagada. | Decidir com o contador o que se guarda (dados mínimos de cobrança) e por quanto tempo; citar na política. |
| 1.7 | M | **Não há tarefa de limpeza** (R-107): negócios cancelados há mais de 90 dias nunca são apagados. Logins que começaram o cadastro e não terminaram (sem negócio, ou sem e-mail confirmado) acumulam. | Cron mensal de retenção + limpeza de logins sem negócio. |
| 1.8 | M | **Ações do master não deixam registro** (quem apagou qual negócio e quando). | Tabela de auditoria (`admin_log`) gravada na mesma transação. |
| 1.9 | M | Minha conta ainda **não troca e-mail nem senha com a pessoa logada** (só envia link de redefinição), **não mostra aparelhos conectados**, **não tem notificações**. A especificação lista "nome, e-mail, senha, notificações, sair". | Trocar e-mail com nova confirmação; senha com a atual; encerrar outros aparelhos. |
| 1.10 | M | **Não dá para transferir o negócio** para outra pessoa. Se a dona quer sair, só apagando tudo. | Transferir a posse para gerente/profissional já membro. |

## 2. Segurança

| # | Gravidade | Achado | O que fazer |
|---|---|---|---|
| 2.1 | A | `npm audit`: **22 vulnerabilidades (1 crítica, 9 altas)**. A crítica é no `better-auth` (estado do OAuth usado como link mágico para entrar como outra pessoa). O login roda no servidor gerenciado do Neon, então o risco real depende de eles; as outras vêm de `zod`, `undici` e `@vercel/*`. | Perguntar ao Neon se o servidor de login já está corrigido; atualizar `@neondatabase/neon-js`, `@vercel/*` e `zod` e rodar os testes. |
| 2.2 | M | **Sem Content-Security-Policy** no app nem na landing (a especificação 5.10 pede). Há os outros cabeçalhos (HSTS, nosniff, X-Frame, Permissions-Policy). | Começar em modo só-relatório e ir fechando. |
| 2.3 | M | **Limite de tentativas só no agendamento e no formulário da landing.** As rotas com login (`delete`, `billing/*`, `admin-*`) não têm limite. | Reusar `hit_rate_limit` nelas. |
| 2.4 | M | O JWT é conferido só pelo emissor (não pelo público-alvo `aud`). Token de outra aplicação do mesmo Neon Auth seria aceito. | Conferir `aud` se o Neon emitir. |
| 2.5 | B | O JWT já emitido continua valendo até expirar mesmo depois da conta apagada (só some o acesso aos dados). | Aceitável; apenas registrar. |
| 2.6 | — | **Bom:** todas as tabelas do banco têm RLS nas migrations; `anonymous` só executa duas funções públicas (`get_public_site`, `get_invite`); consultas usam parâmetros (sem SQL montado por texto); segredos só no servidor. | — |

## 3. Cobrança

| # | Gravidade | Achado | O que fazer |
|---|---|---|---|
| 3.1 | M | **NFS-e (R-108) não existe** no código. Cada pagamento deveria gerar nota. | Escolher emissor (Focus NFe, eNotas) com o contador. |
| 3.2 | M | Pix **não tem como cancelar nem pedir devolução** pelo app (só cartão, pelo portal do Stripe). | Fluxo/texto claro de política de devolução. |
| 3.3 | B | Não existe tratamento do evento de cliente apagado no Stripe, mas funciona porque o servidor ignora cliente sem negócio. | Só registrar. |

## 4. Produto e telas

| # | Gravidade | Achado | O que fazer |
|---|---|---|---|
| 4.1 | M | **Não há canal de suporte dentro do app** (a especificação pede "Ajuda" no menu). | Link Ajuda/WhatsApp no menu da conta. |
| 4.2 | M | **App não instalável** (sem manifest/PWA) e sem notificações push (P1 no roadmap). | Manifest + service worker; push depois. |
| 4.3 | B | Landing tem sitemap, robots e 404; app não tem página de erro própria para rotas inválidas (redireciona ao Início). | Opcional. |

## 5. Operação e qualidade

| # | Gravidade | Achado | O que fazer |
|---|---|---|---|
| 5.1 | M | **Testes de ponta a ponta não cobrem cadastro/login, perfis, cobrança nem conta** (15 testes, só telas e agenda). A exclusão e o master só têm testes unitários (12). | E2E de: cadastro → negócio, convite de equipe, excluir conta, perfis. |
| 5.2 | M | O `localhost` usa o banco de produção (`CONTEXTO.md`, P3). Com excluir conta e master, testar localmente com login real mexe em dado real. | Branch do Neon para desenvolvimento. |
| 5.3 | B | **11 de 12 funções** da Vercel (plano Hobby) usadas. Só cabe mais uma. | Juntar outras rotas, como já feito em `account`/`billing`/`cron`. |
| 5.4 | B | Falta checar fora do código: uptime externo, backups (PITR do Neon) e analytics, previstos na especificação 5.10. | Confirmar no painel. |

## 6. Pontos fortes (para não mexer)

RLS em todas as tabelas · cobrança com Stripe testada (81+ testes de servidor) · convite e papéis com regras no banco ·
LGPD por cliente (`forget_client`) · anti-robô e limite no agendamento · e-mails transacionais com a marca · cron de
conferência com o Stripe · monitoramento de erros (Sentry) ligado por variável.

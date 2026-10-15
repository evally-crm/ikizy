# IKIZY: especificação para produção

Documento-base para colocar o IKIZY no ar: **regras de negócio**, **telas finais**, **schema final do banco**
e **tudo que precisa ser contratado ou configurado fora do código** (e-mail, pagamentos, domínios, cron etc.).

Escrito em 11/10/2026. Usa as decisões recomendadas no [plano de experiência](PLANO-DE-EXPERIENCIA.md)
(Agenda como tela inicial, cadastro em 3 telas, "Meu negócio", perfis). Onde uma decisão ainda está em aberto,
está marcado com **[decidir]**.

Sumário:
1. Ponto de partida (o que existe hoje no banco e no código)
2. Regras de negócio
3. Telas finais
4. Schema final do banco
5. Serviços externos e configurações fora do código
6. Tarefas automáticas (cron)
7. Checklist para ir ao ar

---

## 1. Ponto de partida

### 1.1 O banco de produção está praticamente vazio

Conferido direto no Neon (branch `production`) em 11/10/2026:

| Dado | Quantidade |
|---|---|
| Salões | 1 (o de teste, slug `salao`) |
| Atendimentos | 0 |
| Clientes | 0 |

**Consequência prática:** dá para **recriar o schema do zero, limpo, numa migration única** (`baseline`) antes do lançamento,
em vez de empilhar mais 15 migrations em cima das 18 que existem. Recomendação: fazer isso (ver 4.1).

### 1.2 Coisas no banco que não estão no código (órfãs)

| O que | Onde | Situação |
|---|---|---|
| **Sistema de campanhas de WhatsApp**: tabelas `campaigns`, `campaign_messages`, `campaign_credits`, `whatsapp_instances`, coluna `clients.offers_opt_out_at` e 11 funções (`create_offer_campaign`, `claim_campaign_messages`, `add_campaign_credits`, `opt_out_offers`...) | só no banco | **Não existe nenhuma migration nem código no repositório.** Foi aplicado à mão por fora. Todas as tabelas estão vazias. Contradiz a decisão registrada de não ter disparo automático. **[decidir]**: apagar (recomendado) ou recuperar o código de onde veio. |
| Fidelidade: `loyalty_settings`, `loyalty_entries` | migration `20261020` | A tela foi removida (commit `2e5e901`). Vazias. Apagar. |
| `site_settings.accent`, `accent_color`, `theme`, `hours` (texto) | migrations antigas | Substituídas por `palette` e pelo horário de verdade (`working_hours`). Apagar. |
| `services.monthly_volume`, `services.product_id`, tabela `products` | init | Usadas só no "Produtos e custos" do Meu site para estimar custo. Ver 2.9: vira "custos de material" simples. |
| `site_settings.deposit_percent` | init | O site mostra "sinal de X%" mas **não existe cobrança de sinal**. Esconder até existir. |
| Pasta `supabase/` | raiz | Sobrou da versão Supabase. Apagar. |
| `docs/fluxos-do-sistema.md`, partes do `CONTEXTO.md` | docs | Desatualizados (ver plano de experiência, P12). |

### 1.3 O que já está pronto e continua

Agenda (grade, status, horário por profissional, conflitos), clientes (ficha, anamnese, fotos, notas), financeiro
(formas de pagamento, saídas, comissões, fechamento imutável), Meu site (página pública, paletas, vitrine, planos),
agendamento online (horários livres, trava de vaga, limites), assinatura (Stripe cartão e Pix), aviso de pedidos.

---

## 2. Regras de negócio

Cada regra tem um código (R-xx) para ser citada em tarefas e testes.

### 2.1 Conta e acesso

| # | Regra |
|---|---|
| R-01 | Uma conta = uma pessoa (e-mail único). Entra com e-mail e senha (mínimo 8 caracteres) ou Google. |
| R-02 | O nome da pessoa é pedido no cadastro (ou vem do Google) e aparece no sistema. Nunca mostrar pedaço do e-mail como nome. |
| R-03 | Com e-mail e senha, a conta só fica ativa depois de confirmar o e-mail com código de 6 números (vale 10 min; reenvio a cada 60 s; no máximo 5 tentativas erradas por código). |
| R-04 | Recuperar senha manda um link que vale 1 hora e uso único. A resposta é sempre a mesma, exista ou não o e-mail. |
| R-05 | Uma pessoa pertence a **um** negócio (hoje). Ter vários negócios na mesma conta fica para depois. |
| R-06 | Depois de entrar, a pessoa volta para a página que tentou abrir. |
| R-07 | Sessão dura 30 dias no mesmo aparelho; "Sair" encerra só aquele aparelho. |

### 2.2 Negócio (salão)

| # | Regra |
|---|---|
| R-10 | Criado no cadastro com: nome (2 a 60 caracteres), link (`slug`: 3 a 40, minúsculas, números e hífen, único, fora da lista de reservados), áreas e "Só eu / Eu e equipe". |
| R-11 | Ao criar, o sistema cria junto: a dona como membro `owner` **e como profissional**; 3 ou 4 serviços por área marcada, sem preço; horário seg–sáb 9h–19h para a dona; configurações do site (não publicado); assinatura em teste de 30 dias. Tudo numa transação: ou cria tudo ou nada. |
| R-12 | O link (`slug`) não muda depois de criado pelo app, para não quebrar links já compartilhados (troca só pelo suporte). |
| R-13 | Fuso horário do negócio: `America/Sao_Paulo` por padrão, guardado no negócio (prepara para Acre, Amazonas etc.). Todo horário é gravado em UTC e mostrado no fuso do negócio, não no do aparelho. |
| R-14 | Dados de contato do negócio (WhatsApp, Instagram, endereço) ficam no **negócio**, e o site lê de lá. Um lugar só. |

### 2.3 Equipe e perfis

| # | Regra |
|---|---|
| R-20 | Perfis: `owner` (dona), `manager` (gerente), `reception` (recepção), `professional` (profissional). Permissões na tabela da seção 4.4. |
| R-21 | **Profissional** (quem aparece na agenda) e **membro** (quem tem login) são coisas diferentes. Uma profissional pode existir sem login; ao aceitar convite, o login é ligado a ela (`professionals.user_id`). |
| R-22 | Só a dona e a gerente cadastram profissionais. Profissional com atendimento no histórico não é apagada: é **desativada** (some da agenda e do site, o histórico fica). |
| R-23 | Comissão: percentual por profissional (0 a 100%), sobre o valor dos atendimentos **concluídos** dela no mês. **[decidir]**: calcular sobre o valor cheio (hoje) ou descontar a taxa do cartão antes. |
| R-24 | Convite: dona/gerente escolhe a profissional (ou "só recepção/gerente") e o perfil; o sistema gera um link único que vale 7 dias e uso único, para mandar no WhatsApp. Pode ser cancelado. Gerente não convida gerente nem mexe na dona. |
| R-25 | Remover acesso desliga o login daquele negócio na hora; a profissional continua na agenda. |
| R-26 | Limites por plano: Solo = 1 profissional (a dona), sem convites; Studio = até 3 profissionais e 3 acessos; Salão = sem limite. **[decidir]** os números. |

### 2.4 Serviços

| # | Regra |
|---|---|
| R-30 | Serviço tem: nome (1 a 80), categoria (Unhas, Cílios, Sobrancelha, Cabelo, Estética, Barbearia, Outros), preço (≥ 0), duração (5 a 600 min, de 5 em 5), visível no site (sim/não), foto opcional, **quem faz** (lista de profissionais; vazio = todas). |
| R-31 | Serviço com preço 0 aparece no sistema como "sem preço" e **não** é oferecido no agendamento online. |
| R-32 | Mudar preço ou duração não altera atendimentos já marcados (o atendimento guarda o nome, preço e duração do momento). |
| R-33 | Serviço com histórico não é apagado: é arquivado (some das listas, o histórico fica). |

### 2.5 Horário de atendimento

| # | Regra |
|---|---|
| R-40 | Por profissional e dia da semana, um ou mais intervalos (pausa de almoço = dois intervalos). Intervalos do mesmo dia não se sobrepõem. |
| R-41 | **Bloqueios** (novo): folga, férias, compromisso, para uma profissional ou para o salão inteiro, com início e fim. Bloqueio tira os horários do agendamento online e aparece hachurado na agenda. |
| R-42 | A grade da agenda vai do primeiro início ao último fim cadastrados no negócio (com 1 h de folga), não 8h–20h fixo. |
| R-43 | Profissional sem horário cadastrado não aparece no agendamento online. |

### 2.6 Agenda e atendimentos

| # | Regra |
|---|---|
| R-50 | Atendimento tem: cliente, profissional, serviço (ou "outro serviço" com nome livre), início, duração, valor, status, origem (`sistema` ou `site`), observação opcional. |
| R-51 | **Status e transições permitidas:** |

```
                 ┌────────────── Recusar (só origem site) ─────────────┐
                 │                                                     ▼
 [site] ──► pendente ──Confirmar──► confirmado ──Iniciar──► atendimento ──Concluir──► concluido
                 │                      │                       │
                 └──────Cancelar────────┴───────Cancelar────────┘──────► cancelado
                 └──────Falta───────────┴───────Falta───────────┘──────► faltou
 [sistema] ─────────────────────► confirmado (já nasce confirmado)
```

| # | Regra |
|---|---|
| R-52 | Concluir pede a **forma de pagamento** (Pix, crédito, débito, dinheiro). Sem forma, não conclui. Valor pode ser ajustado ao concluir (desconto, adicional). |
| R-53 | **Conflito:** a mesma profissional não pode ter dois atendimentos ativos (pendente, confirmado, em atendimento, concluído) sobrepostos. O sistema avisa e pede confirmação para "encaixar mesmo assim"; o **site nunca** encaixa por cima. A regra vale no banco, não só na tela. |
| R-54 | Fora do horário de atendimento: o sistema avisa mas deixa marcar (encaixe); o site não oferece. |
| R-55 | Remarcar = mudar dia/hora/profissional mantendo o mesmo atendimento. Remarcar um pedido do site o confirma. |
| R-56 | Mês fechado trava criar, alterar e apagar atendimentos e saídas daquele mês (já existe). |
| R-57 | Cancelado e faltou liberam o horário. Faltou conta nas estatísticas de falta da cliente. |
| R-58 | Atendimento não é apagado depois de concluído; antes disso, cancelar é o caminho (fica o histórico). |
| R-59 | Pedido do site sem resposta: continua `pendente` até o horário. Passado o horário sem decisão, vira `cancelado` automaticamente com motivo "sem resposta" (cron, seção 6). **[decidir]** |

### 2.7 Agendamento online (pedidos do site)

| # | Regra |
|---|---|
| R-60 | Só funciona com: site publicado, chave ligada, assinatura com acesso, pelo menos um serviço com preço, uma profissional com horário. |
| R-61 | A cliente escolhe serviço → profissional (ou "qualquer uma") → dia → horário livre; informa nome e WhatsApp. Opcional: e-mail para receber a confirmação. |
| R-62 | Horários livres respeitam: horário de atendimento, bloqueios, atendimentos ativos, antecedência mínima (0 a 168 h, padrão 2 h) e prazo máximo (1 a 90 dias, padrão 30), em intervalos de 15 min. **[decidir]** intervalo de 15 ou 30 min. |
| R-63 | A vaga é travada na hora do pedido (duas pessoas no mesmo horário: só a primeira consegue). |
| R-64 | Cliente identificada pelo WhatsApp (só números, com DDD). Se já existe no salão, reaproveita; senão cria. |
| R-65 | Limites contra abuso: 3 pedidos futuros em aberto por WhatsApp; 30 pedidos novos por hora por salão; 10 pedidos por hora por IP (com armazenamento compartilhado, não em memória); verificação anti-robô invisível. |
| R-66 | O salão é avisado (sininho, faixa, aviso na tela, notificação no celular e e-mail — ver 5.2 e 5.6). |
| R-67 | Confirmar ou recusar oferece a mensagem pronta no WhatsApp da cliente; se a cliente informou e-mail, ela também recebe por e-mail (ver 5.2). |
| R-68 | Link da cliente (fase 3): a cliente recebe um link para ver o status e cancelar até X horas antes. |

### 2.8 Clientes

| # | Regra |
|---|---|
| R-70 | Cliente tem nome (2 a 120) e WhatsApp; o resto é opcional (e-mail, aniversário, Instagram, endereço, profissão, como conheceu, alergias, preferências, VIP, profissional preferida, anamnese, assinatura do termo, fotos, anotações). |
| R-71 | WhatsApp é único por salão (só números). Ao cadastrar um número que já existe, o sistema oferece abrir a cliente existente. |
| R-72 | Etiquetas calculadas (não gravadas): **Nova** (1ª visita há ≤ 30 dias), **Sumida** (sem visita há mais de 45 dias e já veio 2+ vezes), **Aniversário** (no mês), **Retorno atrasado** (passou do intervalo médio dela + 7 dias). VIP é marcado à mão. **[decidir]** os números. |
| R-73 | Fotos de antes e depois e anamnese são dados sensíveis: só membros do salão veem; nunca vão para o site; profissional só vê de clientes dela. |
| R-74 | LGPD: a dona pode exportar e **apagar** os dados de uma cliente (apaga ficha, fotos e anotações; atendimentos ficam anônimos "Cliente removida" para não quebrar o financeiro). |
| R-75 | Cliente com atendimento não é apagada por engano: apagar pede confirmação digitando o nome. |

### 2.9 Dinheiro

| # | Regra |
|---|---|
| R-80 | Faturamento bruto do mês = soma dos atendimentos `concluido` com início no mês (no fuso do negócio). |
| R-81 | Taxa de cartão: percentual configurável por negócio para crédito e para débito (hoje fixo 3,1%). **[decidir]** padrão 3,1% crédito e 1,5% débito. |
| R-82 | Custos de material: lista simples de gastos mensais estimados (nome + valor por mês), sem ligar a serviço. Entra como "Produtos" no lucro. |
| R-83 | Saídas: data, descrição, valor, categoria opcional (aluguel, material, contas, outros). Só dona/gerente lança. |
| R-84 | Lucro = bruto − comissões − taxas de cartão − custos de material − saídas. |
| R-85 | Fechar o mês: só dona/gerente; grava um retrato imutável; trava o mês (R-56). Não reabre pelo app (reabrir = suporte). |
| R-86 | Caixa do dia: concluídos do dia agrupados por forma de pagamento + o que falta receber (confirmados/em atendimento de hoje). |
| R-87 | Ticket médio = bruto ÷ atendimentos concluídos. Ocupação = minutos marcados ÷ minutos de horário de atendimento (de verdade, não 9h–19h fixo). Taxa de falta = faltas ÷ (concluídos + faltas). |
| R-88 | Toda conta de dinheiro é feita em centavos (inteiros) ou `numeric`, nunca em ponto flutuante na hora de somar. |

### 2.10 Site do negócio

| # | Regra |
|---|---|
| R-90 | Endereço: `slug.ikizy.com` (e `app.ikizy.com/s/slug`). Só aparece depois de publicado; antes, mostra "página em construção". |
| R-91 | Personalização fixa: 8 paletas, 3 fontes, logo, capa, textos, seções liga/desliga (preços, equipe, vitrine, planos). Sem cor livre. |
| R-92 | Publicar grava tudo de uma vez; aparece no ar em até 1 minuto. |
| R-93 | O site mostra os serviços visíveis (e com preço, se "mostrar preços" estiver ligado), a equipe ativa, vitrine, planos por assinatura (cobrança combinada no WhatsApp), contato e mapa. |
| R-94 | "Sinal de X%" não aparece no site até existir cobrança de sinal (fase 3). |
| R-95 | Todo texto digitado pelo negócio é escapado; fotos só por endereço controlado pelo IKIZY. |

### 2.11 Assinatura do IKIZY

| # | Regra |
|---|---|
| R-100 | Planos: Solo R$ 9,90, Studio R$ 29,90, Salão R$ 59,90 por mês (fonte única: `lib/plans.ts`). Os textos dos planos só citam o que existe. |
| R-101 | Todo negócio novo começa com 30 dias grátis, **sem cartão**, no plano que combina com a resposta da equipe (ou o que veio do site). |
| R-102 | Cartão: assinatura mensal que renova sozinha (Stripe). Pix: paga 1 mês ou 3 meses (15% off) adiantado; não renova sozinho. A landing e o app só têm mensal e trimestral (o Pix de 12 meses foi retirado). |
| R-103 | Avisos: 7, 3 e 1 dia antes do fim do teste ou do período Pix (na tela e por e-mail); cartão recusado (na tela e por e-mail). |
| R-104 | Sem acesso (teste ou período vencido): o sistema fica **só leitura** (vê tudo, não altera), o site continua no ar por mais 7 dias e depois sai do ar; o agendamento online desliga na hora. **[decidir]** os 7 dias. |
| R-105 | Só a dona vê e mexe na assinatura. |
| R-106 | Trocar de plano: para cima vale na hora (cartão: proporcional pelo Stripe); para baixo vale no próximo período e exige estar dentro do limite do plano menor (R-26). |
| R-107 | Cancelar: acesso continua até o fim do período pago. Dados ficam guardados por 90 dias depois do fim do acesso e então são apagados (avisar por e-mail 7 dias antes). **[decidir]** |
| R-108 | Nota fiscal de serviço (NFS-e) para cada pagamento recebido (ver 5.9). |

### 2.12 Mensagens (WhatsApp)

| # | Regra |
|---|---|
| R-110 | O IKIZY **não dispara** mensagens no WhatsApp: monta o texto e abre o WhatsApp da própria pessoa (`wa.me`). Decisão de produto. |
| R-111 | Tipos: confirmação, recusa (novo), lembrete (véspera e dia), pós-atendimento, falta, aniversário, sumida, retorno atrasado. Textos com o nome do negócio e o link do site quando publicado. |
| R-112 | "Já enviei" fica guardado no banco (não só no navegador), para a recepção e a dona não mandarem duas vezes. |

---

## 3. Telas finais

Desenhos e justificativas no [plano de experiência](PLANO-DE-EXPERIENCIA.md). Aqui fica a lista fechada, com rota e perfis.

Perfis: **D** dona · **G** gerente · **R** recepção · **P** profissional.

### 3.1 Públicas (sem login)

| Tela | Rota | Observação |
|---|---|---|
| Landing | `ikizy.com` | botões de plano levam `?plano=` |
| Termos, Privacidade | `ikizy.com/termos`, `/privacidade` | já existem; revisar com o que o sistema guarda (fotos, anamnese) |
| Site do negócio | `slug.ikizy.com` | |
| Agendar no site | dentro do site do negócio | |
| Status do pedido (fase 3) | `slug.ikizy.com/pedido/:token` | ver e cancelar |
| Descadastro de e-mail | `app.ikizy.com/email/sair/:token` | exigência dos provedores de e-mail |

### 3.2 Acesso

| Tela | Rota | Mudança |
|---|---|---|
| Criar conta | `/cadastro` | nome + e-mail + senha; Google grande |
| Código do e-mail | `/verificar-email` | |
| Entrar | `/login` | volta para onde ia |
| Esqueci a senha / Nova senha | `/recuperar-senha`, `/redefinir-senha` | |
| Seu negócio | `/cadastro/negocio` | uma tela (substitui `/cadastro/salao` e `/cadastro/plano`) |
| Aceitar convite | `/convite/:token` | novo (fase 2) |

### 3.3 Sistema

| Tela | Rota | D | G | R | P |
|---|---|---|---|---|---|
| **Agenda** (dia/semana/mês, pedidos, primeiros passos) — tela inicial | `/dashboard` | ✅ | ✅ | ✅ | só a dela |
| Atendimento (janela) | `/dashboard?atendimento=id` | ✅ | ✅ | ✅ | só os dela |
| Novo agendamento (janela) | `/dashboard?novo=1` | ✅ | ✅ | ✅ | só para ela |
| Clientes | `/dashboard/clientes` | ✅ | ✅ | ✅ sem valores | só as dela |
| Ficha da cliente | `/dashboard/clientes/:id` | ✅ | ✅ | ✅ sem valores | só as dela |
| Caixa de hoje | `/dashboard/financeiro` | ✅ | ✅ | ✅ | — |
| Financeiro do mês | `/dashboard/financeiro?mes=2026-10` | ✅ | ✅ | — | — |
| Meus ganhos | `/dashboard/ganhos` | — | — | — | ✅ |
| Meu site | `/dashboard/site` | ✅ | ✅ | — | — |
| Meu negócio: dados | `/dashboard/negocio` | ✅ | ✅ | — | — |
| Meu negócio: horário e bloqueios | `/dashboard/negocio/horario` | ✅ | ✅ | — | vê o dela |
| Meu negócio: serviços | `/dashboard/negocio/servicos` | ✅ | ✅ | — | — |
| Meu negócio: equipe e acessos | `/dashboard/negocio/equipe` | ✅ | ✅ | — | — |
| Meu negócio: custos e taxas | `/dashboard/negocio/custos` | ✅ | ✅ | — | — |
| Assinatura | `/dashboard/assinatura` | ✅ | — | — | — |
| Minha conta (nome, e-mail, senha, notificações, sair) | `/dashboard/conta` | ✅ | ✅ | ✅ | ✅ |

**Saem:** Início (`Dashboard.tsx`), `/cadastro/salao`, `/cadastro/plano`, `Placeholder` ("em breve"), aba "Produtos e custos" do Meu site.

---

## 4. Schema final do banco

### 4.1 Estratégia

1. Exportar o salão de teste (ou descartar: 0 atendimentos e 0 clientes).
2. Criar uma branch nova no Neon (`baseline`), aplicar **uma migration única** com o schema abaixo e rodar os testes.
3. Trocar a `production` por ela (ou recriar a `production` a partir dela).
4. Daqui em diante: migrations numeradas **com tabela de controle** (`schema_migrations`) e aplicadas por script, primeiro numa branch de teste.

### 4.2 Tipos

```sql
member_role        = owner | manager | reception | professional
appointment_status = pendente | confirmado | atendimento | concluido | cancelado | faltou
appointment_origin = sistema | site                                  -- novo
payment_method     = pix | credito | debito | dinheiro               -- vira enum (hoje é texto com check)
service_category   = Unhas | Cílios | Sobrancelha | Cabelo | Estética | Barbearia | Outros
billing_plan       = solo | studio | salao
billing_status     = trialing | active | past_due | canceled
invite_status      = pendente | aceito | cancelado | vencido          -- novo
```

### 4.3 Tabelas

Legenda: **=** igual a hoje · **~** muda · **+** nova · **−** sai.

#### Negócio e pessoas

```
= salons
  id uuid pk · name text(2..60) · slug text unique(3..40) · created_at
  ~ + timezone text default 'America/Sao_Paulo'
  ~ + segments text[]                       -- áreas marcadas no cadastro
  ~ + whatsapp, instagram, address          -- saem de site_settings (R-14)
  ~ + card_fee_credit_pct numeric(5,2) default 3.10, card_fee_debit_pct default 1.50   (R-81)

= members                                   -- quem tem login no negócio
  salon_id · user_id · role member_role · created_at · pk(salon_id, user_id)
  ~ + professional_id uuid null → professionals   -- liga o login à profissional (R-21)

+ invites                                   -- convites de acesso (R-24)
  id · salon_id · role member_role · professional_id null
  token_hash text unique                    -- guarda só o hash do token
  status invite_status · expires_at · created_by · accepted_by null · created_at

~ professionals
  id · salon_id · user_id (sai: passa para members.professional_id) · name · title
  commission_pct · active · created_at
  ~ + position int                          -- ordem das colunas na agenda
```

#### Catálogo e horário

```
~ services
  id · salon_id · name · category · price · duration · visible · photo_id · created_at
  ~ + archived_at timestamptz null          (R-33)
  − monthly_volume, product_id

+ service_professionals                     -- quem faz o quê (R-30); vazio = todas
  service_id · professional_id · salon_id · pk(service_id, professional_id)

= working_hours
  id · salon_id · professional_id · weekday 0..6 · start_minute · end_minute

+ time_blocks                               -- folgas, férias, bloqueios (R-41)
  id · salon_id · professional_id null (null = salão todo)
  starts_at · ends_at · reason text · created_by · created_at

~ material_costs   (era products)            (R-82)
  id · salon_id · name · monthly_amount · created_at
```

#### Clientes

```
~ clients
  id · salon_id · name · phone (só números) · email · birthday · instagram · address
  occupation · referral · vip · preferred_professional · allergies[] · preferences[]
  anamnesis jsonb · anamnesis_updated_at · anamnesis_signature · anamnesis_signed_at
  created_at
  ~ + unique(salon_id, phone) quando phone <> ''   (R-71)
  ~ + deleted_at null                        -- remoção LGPD (R-74)
  − offers_opt_out_at                        -- vai junto com as campanhas

= client_notes   (id · salon_id · client_id · body · created_at)
  ~ + author_id

= client_photos  (id · salon_id · client_id · kind · caption · taken_on · thumb · data)
  ~ data/thumb deixam de ser base64 no banco → storage_key (ver 5.7)
```

#### Agenda

```
~ appointments
  id · salon_id · client_id · professional_id · service_id null · service_name
  starts_at · duration · price · status · payment_method null · created_at
  ~ + ends_at (gerado: starts_at + duration)       -- para a trava de conflito
  ~ + origin appointment_origin default 'sistema'
  ~ + note text                                    -- observação do atendimento
  ~ + status_changed_at · cancel_reason text null  -- "sem resposta", "cliente desmarcou"...
  ~ + created_by uuid null (null = site)
  ~ + trava de conflito no banco (R-53):
      exclude using gist (professional_id with =, tstzrange(starts_at, ends_at) with &&)
      where (status in ('pendente','confirmado','atendimento','concluido'))
      -- com exceção explícita para "encaixar mesmo assim" via coluna overlap_ok boolean

+ message_log                                -- "já enviei" compartilhado (R-112)
  id · salon_id · client_id · appointment_id null · kind text · sent_by · sent_at
```

#### Dinheiro

```
~ expenses   (id · salon_id · spent_on · description · amount · created_at)
  ~ + category text null · created_by

= month_closings   (id · salon_id · month · closed_at · closed_by · snapshot jsonb) imutável
```

#### Site

```
~ site_settings
  salon_id · published · published_at · palette · font · logo · cover
  tagline · about · show_prices · show_team · show_showcase · show_plans
  online_booking · booking_notice_hours · booking_window_days · booking_step_minutes
  updated_at
  − accent, accent_color, theme, hours, deposit_percent, whatsapp, instagram, address

= site_photos · showcase_items · client_plans
  (fotos: data base64 → storage_key, ver 5.7)
```

#### Assinatura, notificações e operação

```
= subscriptions  (salon_id · plan · status · trial_ends_at · access_until · billing_method
                  stripe_customer_id · stripe_subscription_id · cancel_at_period_end
                  plan_chosen_at · last_event_at · updated_at)
= stripe_events  (id · type · received_at)

+ push_subscriptions                         -- notificação no celular (5.6)
  id · user_id · salon_id · endpoint unique · p256dh · auth · user_agent · created_at · last_ok_at

+ notification_prefs                         -- o que cada pessoa quer receber
  user_id · salon_id · new_request_push bool · new_request_email bool · daily_summary_email bool

+ email_log                                  -- e-mails enviados (evita duplicar e ajuda o suporte)
  id · salon_id null · to_email · template · ref_id · provider_id · status · created_at

+ schema_migrations (version text pk, applied_at)

+ rate_limits                                -- limite por IP/telefone do agendamento online (R-65)
  key text pk · count int · window_start timestamptz

− campaigns, campaign_messages, campaign_credits, whatsapp_instances (+ 11 funções)
− loyalty_settings, loyalty_entries
− products (vira material_costs)
```

### 4.4 Permissões no banco (RLS) por perfil

A tela esconde, **o banco garante**. Funções auxiliares: `is_member(salon)`, `has_role(salon, roles[])`,
`my_professional(salon)` (id da profissional ligada ao login) e `has_access(salon)` (assinatura).

| Tabela | Ler | Criar / alterar | Apagar |
|---|---|---|---|
| salons | membros | D, G | ninguém (suporte) |
| members, invites | D, G (todos); cada um a própria linha | D, G (G não mexe em owner/manager) | D, G |
| professionals, working_hours, time_blocks | membros | D, G; P só os próprios bloqueios **[decidir]** | D, G |
| services, service_professionals, material_costs | membros (P sem custos) | D, G | D, G |
| clients, client_notes, client_photos | D, G, R: todas · P: só clientes com atendimento dela | D, G, R; P nas clientes dela | D, G |
| appointments | D, G, R: todos · P: só os dela | D, G, R: todos · P: só os dela | ninguém (cancelar) |
| message_log | igual a appointments | membros | — |
| expenses, month_closings | D, G | D, G (fechamento só pela função) | D, G |
| site_settings, site_photos, showcase_items, client_plans | membros | D, G | D, G |
| subscriptions | D | só servidor (webhook) | — |
| push_subscriptions, notification_prefs | a própria pessoa | a própria pessoa | a própria pessoa |
| stripe_events, email_log, rate_limits, schema_migrations | só servidor | só servidor | — |

Regras que somam a todas: sem `has_access`, ninguém grava (só leitura). Valores de cliente (total gasto, ticket)
são calculados numa **view** que só D e G podem ler.

### 4.5 Funções do banco

| Função | Quem chama | O que faz |
|---|---|---|
| `create_salon(nome, slug, areas, equipe, plano)` ~ | pessoa logada | R-11 inteiro numa transação |
| `slug_available(slug)` + | cadastro | confere o link enquanto digita (R-10) |
| `accept_invite(token)` + | pessoa logada | liga o login ao negócio e à profissional (R-24) |
| `set_working_hours` = | D, G | troca o horário de uma profissional |
| `get_public_site`, `get_public_photo` = | servidor | página pública |
| `get_available_slots`, `book_appointment` ~ | servidor | + bloqueios, + quem faz o serviço, + intervalo configurável, + origem `site` |
| `respond_request(id, aceitar)` + | D, G, R, P | confirma ou recusa pedido (R-51) |
| `close_month` = | D, G | fechamento |
| `choose_trial_plan` − | — | sai (plano escolhido no cadastro/assinatura) |
| `expire_stale_requests()` + | cron | R-59 |
| `forget_client(id)` + | D | apagar dados da cliente (R-74) |

---

## 5. Serviços externos e configurações fora do código

Tudo que precisa ser **contratado, criado ou configurado** fora do repositório. Coluna "Hoje" diz o estado atual.

### 5.1 Domínio e DNS

| Item | Hoje | Fazer |
|---|---|---|
| `ikizy.com`, `www`, `app`, `*.ikizy.com` | ✅ na Vercel | — |
| Registros de e-mail (SPF, DKIM, DMARC) | ❌ | criar para o provedor de e-mail (5.2), em `mail.ikizy.com` ou `ikizy.com` |
| E-mail de contato e suporte (`contato@`, `suporte@`, `privacidade@`) | ? | caixa de entrada (Google Workspace, Zoho ou encaminhamento). `privacidade@` é exigido pela LGPD na política de privacidade |

### 5.2 E-mail transacional

**Contratar:** um provedor de envio (recomendado **Resend**; alternativas Postmark ou Amazon SES). O plano gratuito do Resend cobre 3.000 e-mails/mês (limite de 100 por dia); o pago começa em 50 mil/mês.

| Configuração | Detalhe |
|---|---|
| Domínio de envio | `ikizy.com` verificado (SPF, DKIM, DMARC `p=quarantine`) |
| Remetente | `IKIZY <nao-responda@ikizy.com>`; respostas para `suporte@ikizy.com` |
| Chave da API | variável `RESEND_API_KEY` na Vercel (servidor) |
| SMTP no Neon Auth | o Neon Auth usa SMTP próprio para os e-mails de **código** e **senha**: configurar o SMTP do Resend no console do Neon (Auth → e-mail) e trocar o texto para português com a marca |
| Modelos (templates) | em código (React Email ou HTML simples), versionados no repositório |

**E-mails que o sistema precisa mandar:**

| # | E-mail | Para | Quando | Quem envia |
|---|---|---|---|---|
| E1 | Código de confirmação | pessoa | cadastro | Neon Auth (SMTP) |
| E2 | Redefinir senha | pessoa | esqueci a senha | Neon Auth (SMTP) |
| E3 | Boas-vindas + primeiros passos | dona | negócio criado | servidor |
| E4 | Convite para a equipe | convidada | convite criado (opcional, além do link) | servidor |
| E5 | **Novo pedido do site** | dona (e quem ativou) | pedido criado | servidor |
| E6 | Resumo do dia seguinte | dona (opcional) | 19h | cron |
| E7 | Pedido recebido / confirmado / recusado | cliente final (se deixou e-mail) | cada etapa | servidor |
| E8 | Teste acaba em 7, 3 e 1 dia | dona | cron diário | cron |
| E9 | Pagamento recebido + recibo/nota | dona | webhook do Stripe | servidor (ou o Stripe envia o recibo) |
| E10 | Cartão recusado | dona | webhook | servidor |
| E11 | Acesso terminou (só leitura) | dona | cron | cron |
| E12 | Seus dados serão apagados em 7 dias | dona | 83 dias após o fim | cron |

Todos com: link "não quero receber" nos não essenciais (E6), registro em `email_log`, envio fora da transação do banco.

### 5.3 Neon (banco e login)

| Item | Hoje | Fazer |
|---|---|---|
| Projeto e branch `production` | ✅ | — |
| Plano pago (sem pausar por inatividade, backups) | ? | conferir plano; ligar **restauração a um ponto no tempo** de pelo menos 7 dias |
| Branch `dev` para testes | ❌ (o localhost usa produção) | criar branch `dev`; `.env.local` aponta para ela |
| Neon Auth: confirmação de e-mail | desligada | ligar `verify_email_on_sign_up` e `require_email_verification` (depois do SMTP) |
| Neon Auth: domínios confiáveis | `localhost:5173`, `app.ikizy.com` | tirar `localhost` da produção quando houver branch de dev |
| Neon Auth: Google | ✅ configurado | ver 5.5 |
| Script de migrations com controle | ❌ | `scripts/migrate.ts` lendo `schema_migrations` |

### 5.4 Stripe (assinatura do IKIZY)

| Item | Hoje | Fazer |
|---|---|---|
| Conta Stripe Brasil | ✅ (modo teste) | ativar a conta: CNPJ, conta bancária, documentos |
| Produtos e preços | script `stripe:setup` | rodar em **modo produção** |
| Pix | ✅ código | **habilitar Pix** no painel (exige conta ativa no Brasil) |
| Webhook `/api/stripe/webhook` | ✅ código | criar o endpoint de produção e pôr o segredo em `STRIPE_WEBHOOK_SECRET`; eventos: `checkout.session.completed`, `customer.subscription.*`, `invoice.payment_failed`, `invoice.paid` |
| Portal do cliente | ✅ | configurar em produção (`STRIPE_PORTAL_CONFIGURATION`): trocar cartão, cancelar, ver faturas |
| Chaves | teste | `STRIPE_SECRET_KEY` de produção só na Vercel (Production) |
| Recibos por e-mail do Stripe | ? | ligar (resolve E9 sem código) |
| Descrição na fatura do cartão | ? | `IKIZY` |

### 5.5 Google (login com Google)

| Item | Fazer |
|---|---|
| Tela de consentimento OAuth | publicar o app como **Em produção** (em "Teste" só 100 e-mails cadastrados conseguem entrar) |
| Dados da tela | nome IKIZY, logo, `ikizy.com`, links de termos e privacidade, e-mail de suporte |
| Verificação do Google | os escopos usados (e-mail, perfil) normalmente não exigem revisão; confirmar no console |
| URIs de retorno | as do Neon Auth de produção |

### 5.6 Notificação no celular (app instalável)

| Item | Fazer |
|---|---|
| PWA | `manifest.webmanifest` (nome, ícones 192/512, cor, `display: standalone`), service worker, tela "Instalar o IKIZY" |
| Web Push | gerar chaves **VAPID** (`VAPID_PUBLIC_KEY` no app, `VAPID_PRIVATE_KEY` no servidor); biblioteca `web-push` nas funções da Vercel |
| iPhone | push só funciona com o app **instalado na tela de início** (iOS 16.4+); explicar isso na tela de instalar |
| Disparos | novo pedido do site (push imediato), lembrete opcional de pedido sem resposta |

### 5.7 Armazenamento de fotos

Hoje as fotos (site, capa, logo, antes e depois) ficam em **base64 dentro do banco** (até ~400 KB cada).
Com muitos salões isso deixa o banco grande, lento e caro, e cada foto passa pelo banco a cada visita.

| Item | Fazer |
|---|---|
| Contratar | **Vercel Blob** (mais simples, mesmo painel) ou Cloudflare R2 (mais barato em escala) |
| Fotos do site | públicas, com cache longo (endereço com hash) |
| Antes e depois / anamnese | **privadas**: endereço assinado que vence em minutos, gerado pelo servidor só para membros do salão |
| Migração | o banco está vazio: já nasce no storage |

### 5.8 Vercel

| Item | Hoje | Fazer |
|---|---|---|
| Projetos `ikizy-app` e `ikizy-landing` | ✅ | — |
| Variáveis de produção | parciais | acrescentar: `RESEND_API_KEY`, `VAPID_*`, `BLOB_READ_WRITE_TOKEN`, `CRON_SECRET`, `TURNSTILE_SECRET_KEY`, `SENTRY_DSN` |
| Cron Jobs | ❌ | ver seção 6 (`vercel.json` → `crons`); no plano Hobby cada tarefa roda no máximo 1 vez por dia; no **Pro** pode rodar de hora em hora |
| Plano | ? | **Pro** para uso comercial (os termos do Hobby não permitem uso comercial) |
| Proteção de previews | ✅ | — |

### 5.9 Empresa, fiscal e jurídico

| Item | Fazer |
|---|---|
| CNPJ e conta PJ | necessário para ativar o Stripe e emitir nota |
| Nota fiscal de serviço (NFS-e) | cada assinatura paga gera NFS-e (software como serviço). Contratar emissor com API (ex.: **Focus NFe**, eNotas, NFE.io) ligado ao webhook do Stripe, ou contador que emita em lote. Verificar com o contador o código de serviço e o regime (Simples Nacional) |
| Termos de uso e Política de privacidade | já existem em `ikizy.com`; revisar para citar: dados de clientes finais (o salão é o controlador, o IKIZY é o operador), fotos e anamnese (dado sensível de saúde), prazo de guarda (R-107), provedores usados (Neon, Vercel, Stripe, Resend, Google) |
| Contrato de tratamento de dados (DPA) | parágrafo nos termos: o salão é responsável por ter consentimento das clientes |
| Encarregado de dados (DPO) | nome e `privacidade@ikizy.com` na política |
| Consentimento no agendamento online | caixa "Li e aceito a política de privacidade do [negócio]" no formulário do site |

### 5.10 Segurança, monitoramento e suporte

| Item | Fazer |
|---|---|
| Anti-robô no agendamento | **Cloudflare Turnstile** (grátis, invisível): chave no site do negócio, validação em `/api/booking` |
| Limite por IP | hoje fica na memória da função (cada instância conta separado): passar para `rate_limits` no banco ou Upstash Redis |
| Monitoramento de erros | **Sentry** no app e nas funções da Vercel (plano grátis) |
| Uptime | monitor externo (Better Stack, UptimeRobot) em `app.ikizy.com`, `/api/site` e um site de teste |
| Analytics | Vercel Analytics ou Plausible (sem cookies, dispensa banner) na landing e no app |
| Backups | restauração a ponto no tempo do Neon (5.3) + exportação semanal |
| Suporte | canal único: WhatsApp Business do IKIZY e/ou `suporte@`; link "Ajuda" no menu Mais |
| Cabeçalhos de segurança | CSP, `X-Frame-Options` (exceto onde o site precisa), HSTS na Vercel |

### 5.11 WhatsApp

Decisão atual: **sem disparo automático** (R-110). Nada a contratar agora.
Se um dia mudar: a API oficial da Meta (WhatsApp Business Platform) exige empresa verificada, modelos aprovados
e cobra por conversa; soluções não oficiais (Evolution, Z-API) correm risco de bloqueio do número.

---

## 6. Tarefas automáticas (cron)

Rodam como Vercel Cron Jobs chamando rotas `/api/cron/*` protegidas por `CRON_SECRET`.

| Tarefa | Frequência | O que faz | Regra |
|---|---|---|---|
| `expire-requests` | a cada hora | pedidos do site pendentes cujo horário já passou → `cancelado` ("sem resposta") | R-59 |
| `trial-reminders` | diário 9h | e-mails de teste/Pix acabando (7, 3, 1 dia) e acesso terminado | R-103, E8, E11 |
| `daily-summary` | diário 19h | resumo de amanhã para quem ativou | E6 |
| `site-offline` | diário | tira do ar sites de negócios sem acesso há mais de 7 dias | R-104 |
| `data-retention` | diário | aviso aos 83 dias e exclusão aos 90 dias sem acesso | R-107, E12 |
| `cleanup` | semanal | fotos órfãs no storage, convites vencidos, `rate_limits` antigos, `push_subscriptions` que falham | — |
| `reconcile-stripe` | diário | confere assinaturas com o Stripe (caso um webhook se perca) | — |

---

## 7. Checklist para ir ao ar

Ordem sugerida. Fases iguais às do plano de experiência (Fase 1 = lançar com Solo).

### Antes de escrever código (configuração e contratos)

- [ ] **[decidir]** os itens marcados nesta especificação e no plano de experiência (seção 8)
- [ ] CNPJ, conta PJ, ativar Stripe em produção, habilitar Pix
- [ ] Contratar e-mail (Resend), verificar domínio (SPF/DKIM/DMARC), caixas `suporte@` e `privacidade@`
- [ ] Vercel Pro; Neon com restauração a ponto no tempo; criar branch `dev`
- [ ] Google OAuth publicado em produção
- [ ] Emissor de NFS-e ou acordo com o contador
- [ ] Apagar do banco as campanhas de WhatsApp órfãs (ou decidir recuperar)

### Fase 1 — lançar (Solo)

- [ ] Schema novo numa migration única (4.1) + script de migrations com controle
- [ ] Cadastro em 3 telas + criação completa do negócio numa transação (R-11)
- [ ] Agenda como tela inicial (lista do dia no celular, pedidos com confirmar/recusar, primeiros passos)
- [ ] Remover o Início com números falsos
- [ ] Meu negócio: dados, horário + bloqueios, serviços, custos e taxas
- [ ] Trava de conflito no banco (R-53) e fuso do negócio (R-13)
- [ ] Caixa de hoje no Financeiro
- [ ] Fotos no storage (5.7)
- [ ] E-mails E1–E3, E5, E8–E11 + SMTP no Neon Auth + confirmação de e-mail ligada
- [ ] Turnstile e limite por IP compartilhado no agendamento online
- [ ] Cron: `expire-requests`, `trial-reminders`, `reconcile-stripe`
- [ ] Sentry, uptime, analytics
- [ ] Textos dos planos sem promessas (R-100); termos e privacidade revisados
- [ ] Teste completo de ponta a ponta numa branch do Neon: cadastro → horário → serviço → site → pedido → confirmar → concluir → fechar o mês → assinatura

### Fase 2 — equipe (Studio e Salão)

- [ ] Equipe, convites (`invites`, `accept_invite`), RLS por perfil (4.4)
- [ ] Minha agenda e Meus ganhos (profissional); Caixa (recepção)
- [ ] Serviço × profissional no agendamento online
- [ ] Limites por plano (R-26)

### Fase 3 — depois do lançamento

- [ ] App instalável + push (5.6)
- [ ] Resumo diário (E6), e-mails para a cliente final (E7)
- [ ] Link da cliente para ver/cancelar (R-68)
- [ ] Sinal por Pix no agendamento (R-94)
- [ ] NFS-e automática ligada ao Stripe

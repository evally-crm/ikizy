# Evolution API (campanhas de oferta no WhatsApp)

A Vercel só roda funções curtas, então o WhatsApp de cada salão fica conectado numa VPS sempre ligada,
com a [Evolution API](https://doc.evolution-api.com). O app (Vercel) fala com ela por HTTP; ela avisa o app
por webhook (WhatsApp conectou/caiu, cliente respondeu SAIR).

```
app.ikizy.com (Vercel) ──/api/whatsapp──► Evolution (VPS) ◄──► WhatsApp do salão
        ▲                                     │
        └──── /api/whatsapp/webhook ◄─────────┘
        └──── /api/whatsapp/dispatch ◄── container "dispatch" (a cada minuto)
```

## Subir

1. **VPS:** Oracle Cloud Always Free (Ubuntu, ARM) ou qualquer VPS com 1 GB+ de RAM. Instale o Docker.
   Libere as portas 80 e 443 (no Oracle: na Security List da VCN **e** no firewall da VM).
2. **DNS:** crie um registro A `evo.ikizy.com` → IP da VPS (na Vercel, em Domains → ikizy.com).
3. **Neon:** crie um banco `evolution` no projeto (separado das tabelas do app) e copie a conexão **direta** (sem `-pooler`).
4. **Na VPS**, nesta pasta: `cp .env.example .env`, preencha e rode `docker compose up -d`.
   Teste: `curl https://evo.ikizy.com` deve responder com a versão da Evolution.
5. **Vercel** (`ikizy-app`, Production), e depois um novo deploy:
   - `EVOLUTION_API_URL` = `https://evo.ikizy.com`
   - `EVOLUTION_API_KEY` = a mesma do `.env`
   - `EVOLUTION_WEBHOOK_SECRET` = um segredo novo (`openssl rand -hex 32`)
   - `CRON_SECRET` = o mesmo do `.env`
6. **Banco do app:** a migration `neon/migrations/20261022000000_offer_campaigns.sql` já foi aplicada em produção (08/10).

Sem as variáveis da Evolution na Vercel, a tela de Campanhas mostra "ainda não foi ativado" e nada é enviado.

## Regras (no código)

- 10 a 150 clientes por campanha; 1 campanha grátis por mês por salão; extras compradas no Stripe (R$ 9,90 cada, sem validade).
- Cada cliente recebe no máximo 1 oferta por mês; quem responde SAIR sai da lista.
- Envio aos poucos: no máximo 1 mensagem por salão por minuto, intervalos aleatórios, só das 8h às 20h (São Paulo).
- Valores em `apps/app/src/lib/campaigns.ts`; travas no banco em `create_offer_campaign()`.

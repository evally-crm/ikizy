-- Cada negócio ganha um endereço seu-negocio.ikizy.com. Estes nomes ficam fora de uso
-- porque já servem ao próprio produto (app.ikizy.com, www, e-mail, etc.).
-- Mantenha a lista igual à de apps/app/src/lib/slug.ts.

alter table public.salons
  add constraint salons_slug_not_reserved
  check (slug <> all (array[
    'www', 'app', 'api', 'admin', 'painel', 'dashboard', 'login', 'cadastro', 'mail', 'email', 'smtp',
    'suporte', 'ajuda', 'help', 'blog', 'status', 'docs', 'static', 'assets', 'cdn', 'ikizy', 'dev',
    'staging', 'test', 'teste', 'demo', 'precos', 'recursos', 'sobre', 'contato'
  ]));

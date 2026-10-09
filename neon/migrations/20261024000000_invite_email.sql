-- IKIZY (Neon): convite da equipe também por e-mail (enviado pelo servidor com o Resend).
-- Pré-requisito: team (tabela invites).
-- O navegador só grava o e-mail no convite; quem envia é a função /api/team/invite-email, que confere se
-- quem pede é a dona do salão e limita os reenvios (1 por minuto, até 5 por convite).

alter table public.invites
  add column email         text check (email is null or (char_length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  add column email_sent_at timestamptz,
  add column email_count   int not null default 0;

-- a dona informa o e-mail ao criar o convite; envio e contagem ficam só com o servidor
grant insert (email) on public.invites to authenticated;

notify pgrst, 'reload schema';

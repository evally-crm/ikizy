-- categoria "Outros": serviços de áreas fora da lista (ex.: maquiagem), digitados no questionário de criação do negócio.
-- pode rodar dentro de begin ... commit, mas o valor novo só fica usável depois do commit.
alter type public.service_category add value if not exists 'Outros';

notify pgrst, 'reload schema';

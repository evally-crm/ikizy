# Regras da casa (código e componentes)

Valem para todo código novo e para tudo que já foi organizado. O verificador `npm run check:conventions`
(`apps/app/scripts/check-conventions.mjs`) confere os arquivos listados em `SCOPES`; a cada tela organizada,
o caminho dela entra na lista e não sai mais.

## 1. Três camadas, cada uma com um trabalho

| Camada | Pasta | Pode | Não pode |
|---|---|---|---|
| **Domínio** | `src/domain/` | funções puras: receber dados, devolver números e estruturas. Tem **teste** | importar React, banco, sessão, rota ou componente |
| **Dados** | `src/data/` | buscar no banco, mapear linha → domínio, expor ações (salvar, apagar) | calcular regra de negócio; desenhar |
| **Apresentação** | `src/pages/`, `src/components/` | montar a tela com o que o domínio e os dados entregam | `reduce`, percentuais, somas, arredondamento, regra de permissão |

Regra de bolso: se a frase "quanto é / quando vale / quem pode" aparece num `.tsx`, ela está no lugar errado.

```
src/
  domain/<assunto>/     funções puras + *.test.ts (um arquivo de teste por arquivo de regra)
  data/                 hooks que buscam e entregam dados prontos
  components/ui/        peças genéricas (PageHeader, StatTile, Tabs, Sheet...), cada uma com seu .css
  components/<assunto>/ peças de um assunto (ex.: finance/Receipt)
  components/charts/    gráficos (recebem números prontos)
  pages/<assunto>/      uma pasta por tela grande; index.tsx só decide o que mostrar
  styles/               tokens, base e folhas por assunto (finance.css...)
```

## 2. Estilo

- **Cor, espaço, raio, sombra e fonte** vêm de `styles/tokens.css`. Nada de `#hex`, `rgb()` ou `rgba()` fora dele.
- **Um componente, uma folha de estilo** ao lado do arquivo (`StatTile.tsx` + `StatTile.css`), importada pelo componente.
- **Nada de `style={{ ... }}`**. Quando o valor é dinâmico (altura de barra, cor de série), passe por variável CSS:
  `style={{ '--fill': '62%' }}` e use `height: var(--fill)` na folha.
- **Nome de classe** no padrão BEM curto: `bloco`, `bloco__parte`, `bloco--variante`. Uma classe não é usada por dois
  componentes diferentes; se dois precisam do mesmo visual, vira um componente de `ui/`.

## 3. Componentes

- Um componente recebe **dados prontos** e **funções de ação**; não busca nem calcula.
- Tela grande (mais de ~250 linhas) se divide em arquivos por seção dentro de `pages/<assunto>/`.
- Texto da tela fica no componente; **rótulo de regra** (ex.: "Taxas de cartão estimadas em 3,1%") vem do domínio.
- Não duplique: antes de criar uma classe ou um componente, procure em `components/ui/`.

## 4. Teste

- Toda função de `src/domain/` tem teste que descreve a regra em português (`describe` / `it`).
- Rodar: `npm run test:domain` (rápido, sem navegador nem banco). `npm test` roda API e domínio.
- Dinheiro sempre em número com duas casas arredondadas por função do domínio, nunca na tela.

## 5. Checklist antes de fechar uma fase

1. `npx tsc --noEmit -p tsconfig.app.json` e `npm run typecheck:api` sem erro.
2. `npm test` verde.
3. `npm run check:conventions` verde, com o caminho novo em `SCOPES`.
4. `git grep -n "style={{" -- <pasta>` e busca por `#` de cor na folha: vazio.
5. Nenhuma classe antiga órfã (procure o nome no projeto antes de apagar).

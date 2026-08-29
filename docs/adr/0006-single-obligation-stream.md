# ADR 0006 — Uma coleção `obligations`, não `payables` + `receivables`

**Data:** 2026-08-28
**Estado:** aceito

## Contexto

A estrutura de referência sugeria coleções separadas para contas a pagar e a
receber. As duas têm exatamente os mesmos campos: descrição, valor, vencimento,
competência, categoria, status, valor liquidado.

## Decisão

Uma coleção `obligations`, com `direction: INFLOW | OUTFLOW`.

## Consequências

**Boas.** O motor de previsão precisa de um fluxo único e ordenado de eventos
de caixa; com duas coleções, todo consumidor teria que intercalar dois streams
e manter a ordenação correta entre eles. Um conjunto de regras em vez de dois.
Um conjunto de índices em vez de dois. Um schema em vez de dois quase idênticos,
que inevitavelmente divergiriam com o tempo.

Liquidação, liquidação parcial, cancelamento e o cálculo de "vencida" são o
mesmo código para as duas direções — e portanto testados uma vez, corretamente.

**Ruins.** Toda consulta por direção precisa filtrar por `direction`, o que
exige um índice composto onde antes bastaria a coleção. A interface precisa ser
explícita sobre qual direção está mostrando, o que na prática é bom: a tela de
Contas tem abas "A pagar" e "A receber", e isso é mais claro do que duas telas
separadas.

Um documento com `direction` errado vira uma receita que deveria ser despesa.
O schema restringe o campo a dois valores e a regra o exige na criação; a
interface nunca deixa o campo em branco.

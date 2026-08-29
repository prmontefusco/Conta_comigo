# ADR 0005 — Datas de calendário e instantes são tipos diferentes

**Data:** 2026-08-28
**Estado:** aceito

## Contexto

"A conta vence em 10 de setembro" é um fato de calendário: verdadeiro
independentemente de onde quem lê está. "Foi paga às 14h32" é um instante.

Modelar os dois como `Date` produz um bug clássico: uma conta aparece como
vencida um dia antes para quem está a leste, ou um dia depois para quem está a
oeste.

## Decisão

Dois tipos, ambos strings marcadas:

```ts
type CalendarDate = string & { __brand: "CalendarDate" }; // "2026-09-10"
type Instant = string & { __brand: "Instant" }; // ISO em UTC
type MonthKey = string & { __brand: "MonthKey" }; // "2026-09"
```

Vencimentos, competências e datas de transação são `CalendarDate`.
`createdAt`, `updatedAt`, `paidAt` são `Instant`.

O fuso do household decide qual dia é "hoje" (`todayIn(timezone)`).

Aritmética de datas usa uma âncora ao meio-dia UTC internamente, para que
mudanças de horário de verão nunca empurrem uma data para o dia seguinte.

## Consequências

**Boas.** Impossível comparar um vencimento com um instante por engano — o
tipo recusa. Ordenação lexicográfica de `CalendarDate` coincide com ordenação
cronológica, o que torna filtros e comparações triviais e baratos. As strings
são legíveis no Firestore, o que ajuda ao depurar.

Um teste específico cobre o caso que motivou a decisão: às 02:00 UTC de 29 de
agosto, ainda é dia 28 em São Paulo.

**Ruins.** Conversão explícita em toda fronteira com `Date` ou com a API do
navegador. `addMonths` precisa de regra de clamp própria (31 de janeiro + 1 mês
= 28 de fevereiro), e essa regra precisa calcular a partir da âncora, não da
ocorrência anterior, para não encurtar permanentemente os meses seguintes.

Strings marcadas não sobrevivem a `JSON.parse`; a validação Zod nas bordas é o
que as reintroduz.

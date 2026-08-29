# Motor de previsão

`src/modules/forecast/domain/forecast.ts`

## Contrato

```ts
forecast(input: ForecastInput): ForecastResult
```

Função pura. Recebe estruturas de domínio, devolve uma projeção. Não lê banco,
não faz I/O, não conhece Firestore. Mesma entrada, mesma saída, sempre.

Ver [`adr/0004-forecast-engine-is-pure.md`](adr/0004-forecast-engine-is-pure.md).

## Entrada

```ts
{
  asOf: CalendarDate,           // hoje, no fuso do household
  horizon: DateRange,
  openingBalance: Money,        // soma das contas hoje
  protectedReserve: Money,      // o que a pessoa decidiu não usar
  obligations, recurringRules, cardStatements, debts,
  paidDebtInstallments?,
  simulatedEvents?,             // injeções de simulação
  includeEstimated?             // padrão: true
}
```

## Como funciona

### 1. Coletar eventos

Cinco fontes viram um fluxo único de `ForecastEvent`:

| Fonte                  | O que vira evento                          |
| ---------------------- | ------------------------------------------ |
| Obrigações registradas | Saldo em aberto, na data de vencimento     |
| Regras de recorrência  | Ocorrências expandidas dentro do horizonte |
| Faturas de cartão      | Saldo em aberto, na data de vencimento     |
| Parcelas de dívida     | Cronograma, a partir de hoje               |
| Simulação              | Eventos injetados, nunca persistidos       |

### 2. Deduplicar

A parte delicada. A mesma conta pode ser descrita por uma regra de recorrência
**e** já existir como obrigação materializada. Uma fatura pode ter virado
obrigação.

Sempre que ambos existem, o **registro concreto vence** e o gerado é
descartado — porque o concreto pode ter sido editado ou parcialmente pago.

A reconciliação usa três chaves:

- `source.occurrenceKey` = `ruleId:dataNominal`
- `source.cardStatementId`
- `source.debtId` + `source.installmentNumber`

### 3. Contas vencidas continuam no cálculo

Uma conta com vencimento anterior a `asOf` e ainda em aberto entra no primeiro
dia da projeção, marcada como `OVERDUE_OBLIGATION`. Ela não desaparece porque a
data passou: o dinheiro ainda vai precisar sair.

### 4. Linha do tempo diária

```
saldo de ontem
+ entradas previstas de hoje
− saídas previstas de hoje
= saldo projetado de hoje
```

Entradas são aplicadas antes das saídas no mesmo dia — é o que acontece quando
o salário cai na mesma data em que a conta vence.

Cada dia produz `projectedCashBalance` e `freeProjectedBalance`
(= saldo − reserva protegida).

### 5. Buckets mensais

Agrupados por **mês de competência**, não pela data de caixa. Uma fatura
consumida em setembro e paga em outubro é reportada contra setembro.

Duas correções importantes:

**Eventos com competência no passado.** Uma conta de julho ainda em aberto em
agosto tem competência fora do horizonte. Ela é atribuída ao primeiro mês
exibido — que é quando o dinheiro precisa sair. Sem isso, ela sumiria da tabela
enquanto continuava contando no resumo.

**O primeiro mês pode ser parcial.** Se a projeção começa dia 28, o salário que
caiu dia 5 não está nela. O mês é marcado `isPartial`, a interface o rotula como
"o que resta", e ele é **excluído** da detecção de déficit — senão todo mês
apareceria em déficit dependendo do dia em que a pessoa abrisse o aplicativo.

### 6. Resumo

```ts
{
  projectedCashBalance, protectedReserve, freeProjectedBalance,
  committedOutflows, expectedInflows,
  overdueAmount, upcomingAmount, debtCommitment,
  lowestProjectedBalance, lowestProjectedBalanceDate,
  firstNegativeDate?, firstDeficitMonth?
}
```

`lowestProjectedBalance` e `firstNegativeDate` são os dois números que nenhum
extrato mostra e que mais mudam decisões.

## Horizontes

`forecastWindows` produz 7, 15, 30, 90, 180 e 365 dias a partir de **uma única**
projeção longa, fatiada. Rodar o motor uma vez por janela poderia produzir
números que não se conciliam entre si.

## Certeza

`confidence: CONFIRMED | ESTIMATED`. Com `includeEstimated: false`, a projeção
responde _e se só o que é certo acontecer?_ — o piso honesto da situação.

## Déficit mensal não é falência

Um mês em déficit significa que, naquele mês, os compromissos passam das
receitas. Se houve sobra nos meses anteriores, o saldo pode continuar positivo.

Por isso a interface mostra as duas coisas: o resultado de cada mês e o saldo
projetado ao longo do tempo. Só o primeiro assusta demais; só o segundo esconde
o aperto.

## Simulações

`src/modules/forecast/domain/scenario.ts`

Uma simulação é a mesma função com eventos extras. Nada é persistido.

| Cenário             | Vira                                                 |
| ------------------- | ---------------------------------------------------- |
| Compra parcelada    | N saídas mensais, valores somando exatamente o total |
| Viagem / emergência | Uma saída pontual                                    |
| Nova despesa fixa   | Saídas mensais no período                            |
| Queda de renda      | Saídas mensais equivalentes à redução                |
| Renda extra         | Uma entrada pontual                                  |

O resultado é `ScenarioResult`: comparação mês a mês, saídas adicionais, menor
saldo livre e a data em que ele ocorre, meses que passam a fechar negativo, e
`staysAboveZero`.

Tudo descritivo. O produto não diz se vale a pena — ver
[`PRODUCT.md`](PRODUCT.md), "Isto não é consultoria financeira".

## O que o motor não faz

- Não prevê gastos com base em histórico. Projeta o que foi cadastrado.
- Não considera juros sobre saldo negativo em conta corrente.
- Não modela rendimento de investimentos.
- Não considera inflação.
- Não usa IA. É aritmética determinística, e é assim que deve continuar: uma IA
  poderá um dia _explicar_ estes números, nunca calculá-los.

## Testes

`forecast.test.ts` e `scenario.test.ts` cobrem, entre outros: receita prevista
não vira saldo; conta vencida permanece; reserva protegida separada do saldo
livre; recorrência não duplicada quando já materializada; compra de cartão
contada uma vez ao longo de todo o horizonte; parcela paga sai da projeção;
mês parcial não vira déficit; competência passada não some; e o cenário
setembro/outubro/novembro do brief, em que novembro aparece com meses de
antecedência.

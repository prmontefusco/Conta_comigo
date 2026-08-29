# Modelo de domínio

Este documento explica **por que** o domínio tem esta forma. As decisões aqui
existem para que os números apresentados estejam certos, não para satisfazer
alguma estética de modelagem.

## A regra que organiza tudo

Não modelar tudo como `Transaction` ou `Expense`.

As diferenças abaixo são semânticas, não cosméticas, e por isso existem no
tipo: dinheiro, conta, obrigação, despesa, receita, transferência, compra,
parcela, cartão, fatura, dívida, empréstimo, financiamento, reserva,
investimento, previsão, pagamento.

Um sistema que colapsa isso em "lançamento" produz números que parecem certos e
não são.

## Dinheiro

`src/core/money/money.ts`

```ts
interface Money {
  readonly amount: number; // inteiro, em centavos
  readonly currency: "BRL";
}
```

Nunca ponto flutuante. `0.1 + 0.2 !== 0.3` em IEEE-754, e um erro desses num
saldo é invisível até virar uma diferença inexplicável de centavos.

Duas funções merecem atenção:

**`allocate(total, partes)`** garante que a soma das partes seja exatamente o
total. R$ 100 em 3 vezes vira `[33,34; 33,33; 33,33]`, nunca
`[33,33; 33,33; 33,33]`. O resto vai para as primeiras parcelas, como fazem os
emissores de cartão.

**`fromDecimalString`** aceita `"1.234,56"`, `"1234.56"`, `"R$ 1.234,56"` e
`"-42"`. Pessoas colam valores de muitos lugares.

Ver [`adr/0003-money-as-integer-minor-units.md`](adr/0003-money-as-integer-minor-units.md).

## Datas

`src/core/date/calendar-date.ts`

Dois tipos distintos, e essa distinção evita uma classe inteira de bugs:

| Tipo           | O que é                                    | Exemplo                      |
| -------------- | ------------------------------------------ | ---------------------------- |
| `CalendarDate` | Um fato de calendário, sem hora e sem fuso | `"2026-09-10"`               |
| `Instant`      | Um momento preciso, em UTC                 | `"2026-08-28T14:32:00.000Z"` |

Um vencimento é um fato de calendário: "a conta de luz vence em 2026-09-10" é
verdade independentemente de onde a pessoa está. Um `paidAt` é um instante.

O fuso do household decide qual dia é "hoje". Sem isso, um membro viajando
veria uma conta como vencida um dia antes.

Campos de data nunca são um único `date`. São: `createdAt`, `updatedAt`,
`transactionDate`, `competenceDate`, `dueDate`, `paidAt`, `receivedAt`,
`statementClosingDate`.

Ver [`adr/0005-calendar-dates-vs-instants.md`](adr/0005-calendar-dates-vs-instants.md).

## Transaction: dinheiro que se moveu

`src/modules/transactions/domain/transaction.ts`

Se nada saiu ou entrou numa conta, não é uma `Transaction`.

`amount` é **sempre positivo**. A direção é consequência do `kind`, nunca de um
sinal — assim um menos digitado errado não inverte um saldo.

| kind                             | Caixa               | Consumo                     | Renda | Dívida      | Patrimônio |
| -------------------------------- | ------------------- | --------------------------- | ----- | ----------- | ---------- |
| `INCOME`                         | + conta             | —                           | +     | —           | +          |
| `EXPENSE`                        | − conta             | +                           | —     | —           | −          |
| `TRANSFER`                       | − origem, + destino | —                           | —     | —           | **0**      |
| `CARD_STATEMENT_PAYMENT`         | − conta             | **—**                       | —     | − cartão    | **0**      |
| `LOAN_DISBURSEMENT`              | + conta             | —                           | **—** | + dívida    | **0**      |
| `DEBT_PAYMENT`                   | − conta             | **só juros/tarifas/seguro** | —     | − principal | − custo    |
| `RESERVE_ALLOCATION` / `RELEASE` | 0 ou entre contas   | **—**                       | —     | —           | **0**      |
| `ADJUSTMENT`                     | ± conta             | —                           | —     | —           | ±          |

As células em negrito são exatamente onde os aplicativos costumam errar.

Quatro funções puras implementam a tabela: `cashEffect`, `spendingEffect`,
`incomeEffect`, `debtEffect`. Uma quinta, `netWorthEffect`, é derivada delas e
serve como verificação: para transferência, pagamento de fatura, empréstimo e
reserva, ela retorna exatamente zero.

### O caso do pagamento de dívida

Uma parcela de R$ 1.000 com R$ 820 de principal, R$ 150 de juros, R$ 20 de
tarifa e R$ 10 de seguro:

- sai R$ 1.000 da conta;
- **R$ 180** é consumo (juros + tarifas + seguro);
- a dívida cai R$ 820;
- o patrimônio cai R$ 180, não R$ 1.000.

Quando o credor não informa a decomposição, `breakdown` fica ausente, a parcela
inteira é tratada como amortização e a interface diz isso explicitamente. O
domínio suporta a decomposição desde o primeiro dia; a entrada de dados é que
pode começar simplificada.

## Obligation: dinheiro que ainda vai se mover

`src/modules/obligations/domain/obligation.ts`

Uma conta de energia que chega dia 5 e vence dia 15 já é um compromisso no dia 5. Registrar compromissos, e não apenas pagamentos, é o que permite responder
"quanto ainda preciso este mês?".

Payables e receivables compartilham uma forma só, com `direction` como campo. O
motor de previsão precisa de um fluxo ordenado único de eventos de caixa; duas
coleções obrigariam a intercalar dois streams em todo lugar. Ver
[`adr/0006-single-obligation-stream.md`](adr/0006-single-obligation-stream.md).

### OVERDUE é derivado, nunca armazenado

`status` guarda `SCHEDULED | PARTIALLY_SETTLED | SETTLED | CANCELED`.
"Vencida" é calculado a partir de `dueDate < hoje`. Uma flag armazenada ficaria
obsoleta durante a noite e exigiria um job agendado para nada.

Uma conta vencida **continua existindo** e continua entrando na projeção até
ser paga. Sistemas que arquivam automaticamente o que venceu produzem uma
projeção otimista e errada justamente quando a informação correta mais importa.

### Liquidação parcial é normal

Acordos e pagamentos em duas partes acontecem. `settle()` aceita valor parcial,
`remainingAmount` continua visível e o restante segue na projeção.

## Cartão de crédito

`src/modules/cards/domain/credit-card.ts`

Um cartão **não é uma conta**. Ele não guarda dinheiro, guarda dívida.
Modelá-lo como conta é a origem clássica do bug "meu saldo aumentou quando eu
comprei algo".

### Fechamento e vencimento

Uma compra pertence à primeira fatura cuja data de fechamento seja maior ou
igual à data da compra. Uma compra exatamente no dia do fechamento entra nessa
fatura; no dia seguinte, na próxima.

Quando `dueDay <= closingDay` — o arranjo brasileiro comum de "fecha dia 25,
vence dia 5" — o vencimento cai no mês seguinte.

### Parcelas e faturas são derivadas

Nem `CardInstallment` nem `CardStatement` são armazenados. Ambos são função
determinística de `CardPurchase` + configuração do cartão + pagamentos
registrados.

Isso elimina uma classe inteira de bugs de sincronização: uma compra lançada
com atraso, ou corrigida, cai imediatamente na fatura certa, sem passo de
reconciliação e sem job de fechamento. Ver
[`adr/0007-derived-card-statements.md`](adr/0007-derived-card-statements.md).

### Estratégia de competência

Por padrão, `competenceDate` de uma compra é a **data da compra**. Um household
pode preferir atribuí-la ao mês da fatura (`cardCompetenceStrategy`).

A escolha é aplicada **no momento da criação** e gravada no documento. Mudar a
configuração não reescreve o passado: registros antigos nunca mudam de
significado.

### Limite comprometido

Parcelas futuras de uma compra já feita contam como comprometidas, mesmo que a
fatura ainda não tenha fechado. O dinheiro já tem dono. O limite "disponível"
que o app do banco mostra normalmente não considera isso.

`utilisation` **não** é limitado a 1: um cartão a 110% é uma situação
materialmente diferente de um a 100%, e arredondar esconderia isso.

## Dívidas

`src/modules/debts/domain/debt.ts`

Três sistemas de amortização:

- **PRICE** — parcela constante; no início quase tudo é juros.
- **SAC** — amortização constante; a parcela cai ao longo do tempo.
- **SIMPLE** — quando o credor só informou "48 x R$ 830,00". O cronograma é
  honesto sobre não saber a separação: `breakdownKnown` é `false` e a interface
  diz isso, em vez de inventar um valor de juros.

`principalContracted` e `amountDisbursed` são campos separados. A diferença
(`disbursementCost`) é um custo real pago no dia um, e não deveria desaparecer
dentro do saldo devedor.

## Recorrência

`src/modules/recurring/domain/recurring-rule.ts`

Uma regra é uma **descrição** do futuro, não os eventos em si. Expandi-la sob
demanda permite projetar doze meses sem gravar doze meses de documentos, e
mudar a regra muda todas as projeções que dependiam dela.

Duas sutilezas resolvidas:

**Fim de mês.** Uma conta no dia 31 vira 31/jan, 28/fev, 31/mar — e não 31, 28, 28. Cada ocorrência é calculada a partir da âncora, nunca da anterior, para que
um clamp de fevereiro não encurte todos os meses seguintes.

**Fim de semana.** Com `weekendPolicy: NEXT_BUSINESS_DAY`, o vencimento anda
para segunda, mas a **competência permanece no dia nominal** — uma conta de 31
de março não pula para o orçamento de abril. Feriados nacionais ainda não são
modelados; é uma aproximação deliberada.

**Idempotência.** Cada ocorrência tem `occurrenceKey = ruleId:dataNominal`.
É por isso que uma conta já materializada nunca é contada duas vezes pela
projeção.

## Reservas

`src/modules/reserves/domain/reserve.ts`

Uma reserva protegida sai do saldo livre e permanece no saldo total. Uma
reserva não protegida é uma intenção de poupança que a pessoa aceita usar.

`emergencyCoverage` e `monthsOfRunway` respondem "se acontecer alguma coisa, eu
tenho?" com um fato — a diferença — e não com um veredito.

## Orçamento

`src/modules/budget/domain/budget.ts`

Três números por categoria, nunca dois:

- **planejado** — quanto se decidiu destinar;
- **comprometido** — contas do mês que já existem e não foram pagas;
- **realizado** — o que já saiu.

Com R$ 1.500 planejados, R$ 900 gastos e R$ 400 comprometidos, restam R$ 200 —
não R$ 600. Essa diferença é a origem de boa parte dos meses que "estouram do
nada".

## Household

O household é o limite multi-tenant. Todo dado financeiro pertence
explicitamente a um `householdId`, e a única forma de acessá-lo é ter uma
`Membership` ativa. Papéis: `OWNER`, `ADMIN`, `MEMBER`, `VIEWER`.

`visibility = PERSONAL | HOUSEHOLD` e `responsibleMemberId` separam o que é da
casa do que é de alguém. Isso governa agrupamento e relatórios, **não** controle
de acesso — o controle de acesso é a fronteira do household.

Ver [`SECURITY.md`](SECURITY.md) e
[`adr/0001-household-as-tenant.md`](adr/0001-household-as-tenant.md).

## O que foi deliberadamente deixado de fora

- Open Finance, OFX e CSV: as abstrações permitem, nada foi acoplado à entrada
  manual, mas nada foi implementado.
- Múltiplas moedas: o campo `currency` existe; a aritmética recusa misturar.
- Investimentos: `AccountType.INVESTMENT` existe como lugar onde dinheiro está,
  sem qualquer modelagem de rentabilidade.
- Feriados nacionais no cálculo de dias úteis.
- Event sourcing, CQRS, agregados com raiz explícita. O domínio é feito de
  funções puras sobre valores imutáveis, o que já entrega testabilidade sem o
  custo.

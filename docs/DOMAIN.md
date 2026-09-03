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

### Parcelamento em andamento

`openInstallmentPlans` responde a pergunta que o total mensal esconde: quantas
parcelas ainda faltam e em que mês cai a última. Uma parcela conta como
**cobrada** quando a fatura dela já fechou — não quando foi paga. São coisas
diferentes: o que interessa para "ainda vou dever isso" é o fechamento.

`billingSchedule` soma, mês a mês, o que cada cartão vai faturar. Meses sem
nada são omitidos em vez de aparecerem como zero: linha vazia diz "não sei",
que é uma afirmação diferente de "nada a pagar".

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

### Qual taxa comparar

`effectiveMonthlyRate` responde "quanto esta dívida custa por mês" a partir de
quatro fontes, em ordem de autoridade: a taxa do contrato, o CET convertido
para o mês, a taxa **resolvida** a partir de principal, parcela e prazo
(`impliedMonthlyRate`, por bisseção sobre a fórmula Price) e, por fim,
desconhecida.

A fonte viaja junto com o número. Uma taxa resolvida é útil e não é a mesma
coisa que uma taxa informada pelo banco — dizer qual é qual é a diferença entre
informar alguém e inventar um número por ela. O que o módulo **não** faz é
supor uma média de mercado quando nada é conhecido: uma ordenação construída
sobre taxa inventada manda a pessoa atacar a dívida errada primeiro.

### Risco: o que acontece se parar de pagar

`classifyDebt` (`domain/debt-risk.ts`) classifica pela **consequência**, nunca
pelo tamanho. Financiamento de veículo, de imóvel e de equipamento é crítico
porque o bem é a garantia; consignado é alto porque sai da folha antes de o
salário chegar; cheque especial e renegociação de cartão são altos por juros;
o resto é sem garantia. Qualquer contrato em atraso vira crítico.

Uma dívida pequena com o carro em garantia vem antes de uma grande sem
garantia. Isso é ordenação por consequência, e é diferente da ordem do método
Avalanche, que responde a outra pergunta — qual custa mais.

`essentialServiceConsequence` faz o equivalente para contas: energia, água,
gás, moradia e afins têm nome próprio para o que se perde. Só reconhece as
categorias semeadas; para as inventadas pela família, silêncio — um aviso
errado ensina a ignorar os certos.

## Negociação

`modules/negotiation` responde à pergunta que o call center faz e que ninguém
deveria responder de improviso: _quanto você pode pagar por mês?_

`proposalCapacity` calcula dois tetos e usa o menor: o que sobra de fato
(renda menos essenciais, menos dívidas atuais, menos o que se quer continuar
guardando) e o teto de comprometimento — 30% da renda, referência prudencial
usual, apresentada como referência e não como lei.

`evaluateProposal` julga a oferta contra esse teto e mostra o que a proposta
esconde: o total efetivamente pago, a taxa mensal embutida (a mesma
`impliedMonthlyRate` das dívidas) e a diferença entre o que será pago e o saldo
que o credor alega. Um "desconto" que custa mais do que a dívida aparece como
custo, não como desconto.

Os roteiros (`domain/scripts.ts`) preenchem apenas o que o app sabe. O que não
sabe vira lacuna — nunca um valor plausível.

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

### Reserva de partida

`starterReserveTarget` define o primeiro degrau: metade de um mês de despesas,
com piso de R$ 500 e teto de R$ 1.000. Ele vem **antes** da quitação total, e
essa ordem é deliberada: quem zera o caixa para pagar dívida volta ao cartão no
primeiro imprevisto, a juros de rotativo, desfazendo meses de esforço. A
reserva pequena não é investimento; é o que impede o plano de reiniciar.

Só reservas com propósito `EMERGENCY` contam. Dinheiro de viagem é dinheiro
real com destino: gastá-lo num conserto cancela a viagem, e dizer que a família
está protegida quando não está é pior do que não dizer nada.

## Orçamento

`src/modules/budget/domain/budget.ts`

Três números por categoria, nunca dois:

- **planejado** — quanto se decidiu destinar;
- **comprometido** — contas do mês que já existem e não foram pagas;
- **realizado** — o que já saiu.

Com R$ 1.500 planejados, R$ 900 gastos e R$ 400 comprometidos, restam R$ 200 —
não R$ 600. Essa diferença é a origem de boa parte dos meses que "estouram do
nada".

## Dia a dia

O registro do cotidiano — mercado, combustível, estacionamento, a diária
recebida — não é um tipo novo de documento. É uma leitura sobre dois que já
existiam: `Transaction` de `EXPENSE`/`INCOME` e `CardPurchase`
(`modules/daily/domain/daily-entries.ts`).

O que fica de fora dessa leitura é a parte que importa: transferência,
pagamento de fatura, liberação de empréstimo e a amortização de uma parcela de
dívida. Nenhum deles empobrece a casa, e listá-los como gasto é exatamente o
caminho para contar o mesmo dinheiro duas vezes.

Um provento já recebido é `Transaction` de `INCOME`. Quando a pessoa diz que
ele se repete, a `RecurringRule` criada junto começa na **próxima** ocorrência,
nunca nesta: o dinheiro que já está na conta não pode ser projetado de novo
como se ainda fosse entrar.

### Comprovante por foto

A leitura de comprovante (`modules/receipts/`) devolve uma **sugestão** de
preenchimento, nunca um lançamento. O domínio descarta o que o modelo não tem
como saber: valor não positivo, data no futuro, categoria que não é do
household. A foto não é armazenada em lugar nenhum — vai na requisição que a
lê e é descartada com ela.

## Household

O household é o limite multi-tenant. Todo dado financeiro pertence
explicitamente a um `householdId`, e a única forma de acessá-lo é ter uma
`Membership` ativa. Papéis: `OWNER`, `ADMIN`, `MEMBER`, `VIEWER`.

`visibility = PERSONAL | HOUSEHOLD` e `responsibleMemberId` separam o que é da
casa do que é de alguém. Isso governa agrupamento e relatórios, **não** controle
de acesso — o controle de acesso é a fronteira do household.

A atribuição é sempre explícita: um lançamento pertence a quem foi registrado
como responsável, e todo o resto é do grupo. Nada é inferido a partir de quem
digitou — adivinhar aqui é inventar uma discussão sobre quem gastou o quê.

Entrar num household existente exige que a pessoa já tenha conta própria e
passe o identificador dela a quem administra. Convite por e-mail não existe
porque aceitá-lo exigiria que o convidado escrevesse no documento do household,
o que só um administrador pode fazer; enquanto isso não roda num servidor, o
fluxo honesto é o que a tela descreve.

Ver [`SECURITY.md`](SECURITY.md) e
[`adr/0001-household-as-tenant.md`](adr/0001-household-as-tenant.md).

### Tetos sugeridos pelo histórico

`suggestBudgetLines` propõe cada teto a partir do que a casa realmente gastou
nos meses anteriores — o mês em curso fica de fora, porque metade de um mês
sugeriria metade de um teto. Meses sem gasto na categoria contam como zero: uma
compra de roupa por trimestre precisa de uma provisão mensal de um terço, não
de um teto que só existe no mês da compra.

Três números acompanham a sugestão: média, mês típico (mediana) e mês mais
alto. Uma categoria que oscila entre R$ 200 e R$ 900 pede uma decisão diferente
de uma que fica parada, e é a pessoa quem decide — o botão preenche o
formulário, não salva nada.

O motivo de o orçamento ser abandonado na segunda semana quase sempre é o
mesmo: os números foram chutados.

## Conquistas

`modules/achievements` deriva marcos dos mesmos registros de todo o resto:
dívida sem saldo, cada quarto amortizado, fatura sem atraso, reserva de partida
formada, mês fechado no azul. Nada é armazenado, concedido ou pontuado.

Sair da dívida leva meses em que nada visível acontece — os marcos existem para
que algo aconteça. Duas regras: cada marco declara o fato por trás dele, e um
mês ruim não retira nada do que já foi conquistado. Só o próximo quarto é
oferecido de cada vez; listar todos transformaria marco em checklist.

## Educação onde a situação está

`modules/education` guarda pílulas curtas, cada uma declarando a condição a que
pertence (`appliesTo`). A tela mostra só as verdadeiras agora: quem tem fatura
vencida lê sobre rotativo, quem tem carro financiado lê por que essa é a
primeira a pagar. Quando nada urge, as gerais aparecem — o cartão nunca fica
vazio nem vira muro de conselhos.

O conteúdo explica mecanismo, nunca produto. Nenhuma pílula nomeia investimento:
os termos de uso proíbem recomendação, e um teste automatizado falha se algum
texto citar CDB, Tesouro, poupança e afins.

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

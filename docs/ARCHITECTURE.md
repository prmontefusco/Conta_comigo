# Arquitetura

## Objetivo

A arquitetura serve a uma coisa: manter a lógica financeira correta e
verificável. Tudo que não contribui para isso foi deixado de fora.

## Camadas

```
UI (React)
  ↓
Application Services / Use Cases
  ↓
Domain  ← nunca depende de nada abaixo
  ↑
Repository ports (interfaces)
  ↑
Firebase adapters
```

A seta do domínio aponta para cima de propósito: o domínio define o que precisa
e a infraestrutura se adapta, não o contrário.

## Estrutura

```
src/
  core/                    Puro, sem dependências de negócio
    money/                 Money, formatação
    date/                  CalendarDate, MonthKey, Instant
    result/                Result<T, E> e erros de aplicação
    id/                    Geração de ids (porta, não global)

  modules/
    <módulo>/
      domain/              Entidades, invariantes, cálculos. Sem Firebase.
      application/         Casos de uso que orquestram domínio + portas
      infrastructure/      Schemas Zod, adaptadores Firestore
      ui/                  Componentes e hooks React

  lib/firebase/            Bootstrap do SDK, caminhos do Firestore
  components/              Primitivas de UI compartilhadas
  app/                     Rotas Next.js (App Router)
```

Módulos existentes: `accounts`, `alerts`, `auth`, `budget`, `cards`,
`categories`, `dashboard`, `debts`, `forecast`, `household`, `obligations`,
`recurring`, `reserves`, `shared`, `transactions`.

## A regra que a máquina verifica

O ESLint proíbe qualquer import de `firebase` ou `firebase-admin` fora de
`lib/firebase/**`, `**/infrastructure/**`, `server/**`, `scripts/**` e
`tests/**`:

```js
"no-restricted-imports": ["error", { patterns: [{
  group: ["firebase", "firebase/*", "firebase-admin", "firebase-admin/*"],
  message: "Domain and core layers must not import Firebase.",
}]}]
```

Sem isso, a separação vira convenção e a convenção erode. Com isso, um import
acidental quebra o lint.

## O motor de previsão é uma função pura

```ts
forecast(input: ForecastInput): ForecastResult
```

Ele recebe estruturas de domínio e devolve uma projeção. Não lê banco, não faz
I/O, não conhece Firestore. Consequências práticas:

- os testes cobrem cenários complexos em milissegundos, sem emulador;
- uma simulação "e se?" é literalmente a mesma função com eventos extras;
- o cálculo é reproduzível: mesma entrada, mesma saída, sempre.

Ver [`adr/0004-forecast-engine-is-pure.md`](adr/0004-forecast-engine-is-pure.md)
e [`FORECAST_ENGINE.md`](FORECAST_ENGINE.md).

## Acesso a dados: cliente + Security Rules

Todo acesso a dados acontece no cliente, com as Firestore Security Rules como
camada de autorização.

**Por quê.** Um único lugar, testável, decide quem pode ler o quê. Não existe
service account em lugar nenhum do repositório e nenhuma é necessária. E as
regras deixam de ser uma segunda linha de defesa opcional: elas são _a_ linha
de defesa, o que garante que sejam levadas a sério e testadas.

**O custo.** Toda leitura precisa ser expressável como uma query que as regras
aceitem. Isso é uma restrição real, e é o que molda o modelo do Firestore.

Ver [`adr/0002-client-side-data-access.md`](adr/0002-client-side-data-access.md).

## Carregamento e derivação

`FinanceProvider` assina as coleções do household e deriva **tudo** em memória:
saldos, faturas, projeção, alertas, orçamento.

Isso é deliberado. Um household tem milhares de documentos, não milhões.
Carregar o conjunto e derivar é mais simples e mais barato que uma frota de
queries agregadas, e mantém o Firestore no papel de armazenamento — ele nunca
calcula um saldo.

`deriveFinanceData` é exportada separadamente do provider React justamente para
poder ser exercitada com dados de fixture, sem React e sem Firestore.

O dia em que essa premissa deixar de valer é o dia de revisá-la, e o limite
está exatamente nessa função.

## Faturas e parcelas são derivadas, não armazenadas

`CardStatement` e `CardInstallment` são função determinística de
`CardPurchase` + configuração do cartão + pagamentos. Não existem no Firestore.

Elimina drift, elimina job de fechamento, e uma compra lançada com atraso cai
imediatamente na fatura certa.

## Escrita: batches para operações compostas

Quitar uma obrigação cria uma transação **e** atualiza a obrigação. As duas
coisas vão num `writeBatch`. Separá-las permitiria que uma falha deixasse uma
conta marcada como paga sem movimentação por trás — ou dinheiro movimentado
duas vezes para a mesma conta.

O bootstrap do household é a exceção deliberada: dois writes sequenciais, não
um batch. As Security Rules avaliam um batch contra o estado _anterior_ a ele,
então uma regra que protege a coleção de membros não enxergaria o household
sendo criado ao lado. Ver [`SECURITY.md`](SECURITY.md).

## Validação nas bordas

Nenhum documento entra no domínio sem passar por um schema Zod
(`modules/shared/infrastructure/schemas.ts`). As regras impedem outro household
de ler os dados; os schemas impedem que um documento malformado vire um número
errado no painel.

Os schemas espelham `firestore.rules` campo a campo. Quando uma regra restringe
algo, o schema diz o mesmo em TypeScript.

## O que não foi feito, de propósito

Sem microsserviços, Kafka, Kubernetes, event sourcing, CQRS completo, múltiplos
bancos ou Cloud Functions. Este é um SaaS pequeno.

Cloud Functions em particular: nada aqui precisa delas hoje. Faturas são
derivadas, alertas são calculados na leitura, `OVERDUE` é derivado da data. A
ausência de jobs agendados não é uma limitação — é consequência de o modelo
não precisar deles.

## Preparado, sem estar implementado

O domínio não está acoplado à entrada manual, então importação (OFX, CSV, Open
Finance) é uma fonte de dados a mais. `plan = FREE | PREMIUM` existe. `currency`
existe. `AdSlot` centraliza publicidade. Nada disso está implementado além do
necessário.

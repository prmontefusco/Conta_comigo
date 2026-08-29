# Modelo do Firestore

## Como se chegou aqui

Antes de criar coleções: identificar os agregados, as consultas necessárias, os
limites de consistência e os índices. A modelagem é consequência disso, não o
ponto de partida.

## Estrutura

```
users/{uid}
households/{householdId}
households/{householdId}/members/{uid}
households/{householdId}/invites/{inviteId}
households/{householdId}/categories/{categoryId}
households/{householdId}/accounts/{accountId}
households/{householdId}/transactions/{transactionId}
households/{householdId}/obligations/{obligationId}
households/{householdId}/creditCards/{cardId}
households/{householdId}/cardPurchases/{purchaseId}
households/{householdId}/debts/{debtId}
households/{householdId}/recurringRules/{ruleId}
households/{householdId}/budgets/{YYYY-MM}
households/{householdId}/reserves/{reserveId}
households/{householdId}/goals/{goalId}
households/{householdId}/vehicles/{vehicleId}
```

Com a única exceção do perfil do usuário, **todo documento financeiro vive sob
`households/{householdId}`**. Esse fato isolado é o que torna as Security Rules
curtas o bastante para serem auditadas, e o que garante que uma query não possa
atravessar households por acidente.

## Diferenças em relação à estrutura de referência

A proposta inicial sugeria `payables` e `receivables` separados, além de
`cardStatements`. Ambas foram avaliadas e alteradas:

**`obligations` no lugar de `payables` + `receivables`.** O motor de previsão
precisa de um fluxo único e ordenado de eventos de caixa. Duas coleções
obrigariam a intercalar dois streams em toda consulta, duplicariam índices e
duplicariam regras. `direction: INFLOW | OUTFLOW` resolve com um campo.
Ver [`adr/0006-single-obligation-stream.md`](adr/0006-single-obligation-stream.md).

**`cardStatements` não existe.** Uma fatura é função determinística das compras
do cartão, da sua configuração e dos pagamentos registrados. Armazená-la criaria
uma cópia que pode divergir e exigiria um job de fechamento mensal.
Ver [`adr/0007-derived-card-statements.md`](adr/0007-derived-card-statements.md).

## Documentos

### `users/{uid}`

Perfil e plano. Legível e editável apenas pelo próprio usuário; `plan` é
imutável pelo cliente. Não é possível listar a coleção — para ninguém.

### `households/{householdId}`

```ts
{
  name, ownerUid, memberUids: string[], settings, archived, ...audit
}
```

`memberUids` existe por uma razão só: tornar "meus grupos" uma query possível.

```ts
query(collection(db, "households"), where("memberUids", "array-contains", uid));
```

Uma query não restringida por esse filtro é recusada pelas regras. O array
**não** é a fonte de verdade de permissão — essa é a subcoleção `members`.

### `households/{householdId}/members/{uid}`

O id do documento é o uid. É isso que permite às regras verificarem acesso com
um `exists()` sobre um caminho conhecido, sem query.

```ts
{ uid, householdId, displayName, email?, role, status, joinedAt, ...audit }
```

Uma membership com `status !== 'ACTIVE'` não concede acesso nenhum.

### Documentos financeiros

Todos carregam `householdId` redundante com o caminho. As regras exigem que
sejam iguais na criação e imutáveis na atualização. Sem isso, um cliente
poderia gravar em A um documento que se declara de B e mais tarde ser lido como
se fosse de B.

Todos carregam `createdAt`, `updatedAt`, `createdBy`, e os três primeiros campos
são imutáveis após a criação.

### Ids determinísticos

| Coleção             | Id        | Por quê                                                     |
| ------------------- | --------- | ----------------------------------------------------------- |
| `budgets`           | `YYYY-MM` | Um mês só pode ter um orçamento                             |
| `categories` (seed) | slug      | Rodar o seed duas vezes não cria "Alimentação" em duplicata |
| `members`           | uid       | Verificação de acesso sem query                             |

Faturas usam `${cardId}_${YYYY-MM}` como identificador **em memória**, para que
um pagamento sempre aponte para a fatura certa mesmo sem documento persistido.

## Consultas

| Pergunta              | Consulta                                                   |
| --------------------- | ---------------------------------------------------------- |
| Meus grupos           | `households where memberUids array-contains uid`           |
| Meu papel neste grupo | `get households/{hid}/members/{uid}`                       |
| Tudo do household     | `collection(households/{hid}/<sub>)` — assinatura completa |
| Contas vencendo       | derivado em memória                                        |
| Faturas               | derivado em memória                                        |
| Projeção              | derivado em memória                                        |

O provider assina cada subcoleção inteira e deriva o resto. Ver
[`ARCHITECTURE.md`](ARCHITECTURE.md), "Carregamento e derivação".

## Índices

`firestore.indexes.json` declara índices compostos para as consultas que a
aplicação passará a fazer quando um household crescer o suficiente para
justificar paginação — transações por conta e data, obrigações por status e
vencimento, compras por cartão e data.

Eles estão declarados agora porque um índice ausente só aparece em produção, no
momento em que o volume cresce. Declará-los cedo custa nada e evita uma falha
que só se manifesta com dados reais.

## Consistência

**Transacional** (mesmo `writeBatch`): quitação de obrigação — transação criada
e obrigação atualizada juntas. Pagamento de fatura — transação criada.

**Eventual, e tudo bem**: `memberUids` e a subcoleção `members`. As regras
forçam a ordem correta (o array primeiro, o documento depois), então uma falha
no meio deixa alguém listado no array sem membership — o que não concede acesso
nenhum, porque o acesso vem do documento.

**Derivado, nunca armazenado**: saldos de conta, faturas, parcelas, status
`OVERDUE`, projeções, alertas, orçamento realizado.

## Custo

Uma sessão típica assina 11 subcoleções de um household. Para uma família com
alguns milhares de documentos, isso é da ordem de alguns milhares de leituras
por sessão inicial, e depois apenas as mudanças.

As regras usam `get()` sobre `members/{uid}` para autorizar. O Firestore faz
cache desse `get()` dentro de uma mesma avaliação de requisição, então o custo é
uma leitura extra por requisição, não por documento.

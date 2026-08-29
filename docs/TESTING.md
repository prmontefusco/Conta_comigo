# Testes

## Princípio

Os testes existem para garantir que os números estejam certos. Um teste que não
protege uma afirmação financeira, uma regra de acesso ou um fluxo real do
usuário não vale o custo de mantê-lo.

**Nenhuma funcionalidade está pronta se a regra de segurança correspondente não
tiver teste.**

## Camadas

| Camada         | Ferramenta                              | Onde                         | Precisa de emulador |
| -------------- | --------------------------------------- | ---------------------------- | ------------------- |
| Domínio        | Vitest (node)                           | `src/**/domain/**/*.test.ts` | não                 |
| Componentes    | Vitest (jsdom)                          | `src/**/*.test.tsx`          | não                 |
| Security Rules | Vitest + `@firebase/rules-unit-testing` | `tests/rules/`               | sim                 |
| E2E            | Playwright                              | `tests/e2e/`                 | stack completa      |

Duas configurações separadas: `vitest.config.mts` (unitários) e
`vitest.rules.config.mts` (regras). As regras são mais lentas, precisam de
emulador e **nunca devem ser silenciosamente puladas** — daí a separação.

## Estado atual

```
npm run test         → 189 testes, 8 arquivos
npm run test:rules   →  45 testes
npm run test:e2e     →  30 testes por perfil (mobile e desktop)
```

## Casos financeiros obrigatórios

`src/modules/transactions/domain/financial-principles.test.ts`

Estes não são testes unitários comuns. Cada um codifica um princípio que, se
quebrado, faria o aplicativo mentir sobre o dinheiro de alguém.

| Caso                | O que garante                                                            |
| ------------------- | ------------------------------------------------------------------------ |
| Transferência       | Não altera patrimônio; não é receita nem despesa; soma zero entre contas |
| Empréstimo          | Aumenta caixa e dívida, não renda; patrimônio inalterado                 |
| Reserva             | Não vira despesa; patrimônio inalterado                                  |
| Pagamento de fatura | Não duplica a despesa; reduz a dívida do cartão                          |
| Pagamento de dívida | Só juros, tarifas e seguro são consumo                                   |
| Compra de cartão    | Contada uma vez em todo o horizonte, nunca por fatura                    |
| Compra parcelada    | Cria compromissos futuros corretos, sem perder centavos                  |
| Conta recorrente    | Projeta corretamente meses futuros                                       |
| Conta vencida       | Permanece pendente até liquidação                                        |
| Receita prevista    | Não aparece como saldo bancário real                                     |
| Orçamento           | Distingue previsto, comprometido e realizado                             |
| Isolamento          | Família A nunca acessa dados da Família B (`tests/rules/`)               |

## Como os testes de domínio são escritos

Builders com padrões sensatos (`src/modules/shared/testing/builders.ts`) para
que cada teste declare só o que é sobre ele:

```ts
const purchase = aCardPurchase({ totalAmount: brl(1200), installmentCount: 6 });
```

Um teste que diz "uma compra de R$ 1.200 em 6x" não deveria estar enterrado em
vinte campos irrelevantes.

Datas são sempre literais (`on("2026-08-28")`), nunca `new Date()`. Um teste
que muda de resultado conforme o dia não é um teste.

## Testes de Security Rules

```bash
npm run test:rules            # sobe um emulador só para isso
npm run test:rules:attached   # usa um emulador já rodando
```

Cobrem: usuário não autenticado, usuário autenticado sem membership, membro,
admin, owner, acesso a outro household, manipulação de ids, escalada de
privilégio, e validação de formato.

O setup usa `withSecurityRulesDisabled` para montar as fixtures, de modo que
cada teste seja sobre a regra que exercita, e não sobre como o cenário foi
construído.

## E2E

```bash
npm run test:e2e
```

Sobem os emuladores, o seed e a aplicação, e os testes rodam contra a stack
real, em perfis mobile e desktop, com locale `pt-BR` e fuso
`America/Sao_Paulo`.

Cobrem os caminhos que precisam funcionar de ponta a ponta: entrar, ver o
resumo, encontrar o mês com déficit, navegar entre as telas, simular uma compra
parcelada, e verificar que o site público não carrega publicidade real
localmente.

Elementos são localizados por **papel e nome acessível**, nunca por classe CSS
ou texto do rótulo visual. O rótulo de um campo obrigatório é "Senha*", mas o
que um leitor de tela anuncia é "Senha" — e é isso que o teste deve verificar.
Essa escolha já pagou: foi um teste E2E que revelou que o componente `Card`
estava descartando `aria-labelledby`, deixando todos os painéis sem nome
acessível.

## O que não é testado, de propósito

- Aparência. Testes de screenshot quebram com qualquer ajuste e raramente
  pegam um bug real.
- O SDK do Firebase. É responsabilidade do Google.
- Getters e construtores triviais.

## Cobertura

Configurada apenas sobre `core/`, `**/domain/**` e `**/application/**` — as
camadas onde uma linha não coberta significa um cálculo não verificado.
Limiares: 80% de statements, 75% de branches.

Cobertura de UI não é medida: um componente renderizado num teste não prova
que ele está certo.

## Antes de abrir um PR

```bash
npm run verify   # typecheck + lint + testes + regras
```

## Adicionando testes junto com uma funcionalidade

1. Regra nova em `firestore.rules` → teste em `tests/rules/`. Obrigatório.
2. Cálculo financeiro novo → teste de domínio, com valores concretos.
3. Fluxo novo do usuário → considere um E2E, se ele puder quebrar em silêncio.

Se o cálculo envolve dinheiro, escreva o caso que erraria por um centavo. É
justamente o que passa despercebido.

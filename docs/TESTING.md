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
| Core e lib     | Vitest (node)                           | `src/core/**`, `src/lib/**`  | não                 |
| Componentes    | Vitest (jsdom)                          | `src/**/*.test.tsx`          | não                 |
| Security Rules | Vitest + `@firebase/rules-unit-testing` | `tests/rules/`               | sim                 |
| E2E            | Playwright                              | `tests/e2e/`                 | stack completa      |
| Acessibilidade | Playwright + axe-core                   | `tests/e2e/accessibility`    | stack completa      |

Duas configurações separadas: `vitest.config.mts` (unitários) e
`vitest.rules.config.mts` (regras). As regras são mais lentas, precisam de
emulador e **nunca devem ser silenciosamente puladas** — daí a separação.

## O que cada suíte cobre

| Comando              | Cobre                                                                                                    |
| -------------------- | -------------------------------------------------------------------------------------------------------- |
| `npm run test`       | Domínio financeiro, motor de projeção, componentes e as barreiras de ambiente da infraestrutura          |
| `npm run test:rules` | Cada regra de `firestore.rules`, contra o emulador                                                       |
| `npm run test:e2e`   | Fluxos reais no navegador, em dois perfis (mobile e desktop), incluindo auditoria WCAG 2.1 AA por página |

Números exatos ficam fora daqui de propósito: envelhecem a cada commit e passam
a mentir. `npm run verify` diz o número de hoje.

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

### Rotas de API

`payments.spec.ts` e `ai-advisor.spec.ts` afirmam a mesma coisa por caminhos
diferentes: que a ausência de configuração **fecha** o caminho em vez de deixá-lo
aberto.

Não precisam de chave de provedor nem de segredo de webhook — a recusa acontece
antes de qualquer chamada externa, e é justamente isso que se está verificando.
Cada teste corresponde a uma forma de o custo ou o direito vazar: token ausente,
token inventado, corpo enorme, método não previsto.

A consultoria de IA nasceu sem nenhuma dessas barreiras (achado nº 6 em
[`PRODUCTION_READINESS.md`](PRODUCTION_READINESS.md)). Os testes existem para que
ela não volte a nascer assim.

### Acessibilidade

`accessibility.spec.ts` audita **29 páginas** contra WCAG 2.1 A e AA com
axe-core, em mobile e desktop, mais navegação por teclado e comportamento de
diálogo.

Já encontrou dois defeitos que a revisão humana havia deixado passar: um
`aria-label` proibido que podia fazer um leitor de tela anunciar **nada** onde
havia um valor, e containers de rolagem horizontal inalcançáveis por teclado no
mobile. Ambos corrigidos.

O que axe não faz é julgar se a tela faz sentido. Por isso as outras suítes
asseveram sobre nomes acessíveis, e não sobre classes CSS.

Elementos são localizados por **papel e nome acessível**, nunca por classe CSS
ou texto do rótulo visual. O rótulo de um campo obrigatório é "Senha*", mas o
que um leitor de tela anuncia é "Senha" — e é isso que o teste deve verificar.
Essa escolha já pagou: foi um teste E2E que revelou que o componente `Card`
estava descartando `aria-labelledby`, deixando todos os painéis sem nome
acessível.

## O que não é testado, de propósito

- Aparência. Testes de screenshot quebram com qualquer ajuste e raramente
  pegam um bug real. O que é testado nos gráficos é o contrato: que o SVG seja
  decorativo e que exista uma tabela com os mesmos números ao lado dele.
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

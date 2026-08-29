# Conta comigo

Plataforma web de planejamento e organização financeira pessoal e familiar,
voltada ao público brasileiro.

O objetivo não é anotar gastos. É responder, com números corretos, as perguntas
que fazem diferença numa decisão: **quanto eu tenho hoje, quanto já está
comprometido e para onde minhas finanças estão indo.**

---

## Começando (tudo local, sem tocar em produção)

Pré-requisitos: **Node 22+**, **Java 11+** (o emulador do Firestore roda em JVM)
e **Git**.

```bash
git clone https://github.com/prmontefusco/Conta_comigo.git
cd Conta_comigo
npm install
npm run dev:local
```

Isso sobe, em um comando:

| Serviço                          | Endereço              |
| -------------------------------- | --------------------- |
| Aplicação (App Hosting Emulator) | http://127.0.0.1:5002 |
| Emulator UI                      | http://127.0.0.1:4000 |
| Authentication Emulator          | 127.0.0.1:9099        |
| Firestore Emulator               | 127.0.0.1:8080        |

E popula os emuladores com três famílias fictícias. Entre em
http://127.0.0.1:5002/entrar com qualquer um destes usuários — **senha
`conta1234`**:

| E-mail               | Cenário                                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------------------- |
| `ana@exemplo.test`   | Família organizada: receitas acima dos compromissos, reserva formada                                          |
| `carla@exemplo.test` | Família apertada: margem mensal pequena, qualquer imprevisto muda o mês                                       |
| `diego@exemplo.test` | Família endividada: empréstimo, financiamento, cartão parcelado, contas em atraso e meses futuros com déficit |

O terceiro cenário é o mais interessante para ver a projeção funcionando.

**Nada disso toca o Firebase real.** O projeto usado localmente é
`demo-conta-comigo`; um id que começa com `demo-` faz o Emulator Suite recusar
qualquer chamada a serviços reais do Google Cloud. Não há credenciais de
produção neste repositório e nenhuma é necessária.

---

## Comandos

| Comando                  | O que faz                                                                |
| ------------------------ | ------------------------------------------------------------------------ |
| `npm run dev:local`      | Emuladores + aplicação + seed. É o comando do dia a dia.                 |
| `npm run emulators`      | Só Auth e Firestore (para rodar o Next separadamente).                   |
| `npm run dev`            | Só o Next.js, em http://127.0.0.1:3000, assumindo emuladores já no ar.   |
| `npm run emulators:kill` | Libera portas de emulador presas (o Java às vezes não morre no Windows). |
| `npm run seed`           | Recria os dados fictícios (idempotente).                                 |
| `npm run typecheck`      | TypeScript em modo estrito.                                              |
| `npm run lint`           | ESLint, incluindo a regra que impede o domínio de importar Firebase.     |
| `npm run test`           | Testes unitários do domínio financeiro (Vitest).                         |
| `npm run test:rules`     | Testes das Firestore Security Rules (sobe um emulador só para isso).     |
| `npm run test:e2e`       | Playwright contra a stack local.                                         |
| `npm run verify`         | typecheck + lint + testes + regras.                                      |
| `npm run build`          | Build de produção.                                                       |

---

## Como o produto pensa

Três princípios que aparecem no código, não só na documentação:

**Transferência não é despesa.** Mover dinheiro entre contas não empobrece
ninguém. `netWorthEffect` de uma transferência é exatamente zero.

**Empréstimo não é renda.** Receber R$ 10.000 emprestado aumenta o caixa e cria
uma obrigação do mesmo tamanho. Aparece como disponibilidade e como dívida,
nunca como receita.

**Reserva não é gasto.** Guardar dinheiro muda o estado dele, não o dono. Por
isso existem dois números distintos em todas as telas: saldo total e saldo
livre.

**A fatura do cartão não é uma segunda despesa.** A compra é contabilizada no
mês em que aconteceu; pagar a fatura movimenta caixa sem repetir o gasto.

Cada um desses princípios tem teste automatizado em
[`src/modules/transactions/domain/financial-principles.test.ts`](src/modules/transactions/domain/financial-principles.test.ts).

---

## Arquitetura em uma tela

```
src/
  core/            dinheiro, datas, resultado, ids — puro, sem dependências
  modules/
    <módulo>/
      domain/          entidades e regras. Nunca importa Firebase.
      application/     casos de uso
      infrastructure/  schemas Zod e adaptadores Firestore
      ui/              componentes React
  lib/firebase/    bootstrap do SDK e caminhos do Firestore
  app/             rotas (site público, autenticação, aplicação)
```

O motor de previsão é uma função pura: recebe estruturas de domínio e devolve
uma projeção. Não conhece Firestore, não faz I/O e é testado inteiramente em
memória. Uma regra de ESLint impede que qualquer arquivo em `domain/` importe
Firebase, para que isso continue verdadeiro.

Detalhes em [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

---

## Documentação

| Documento                                                      | Assunto                                              |
| -------------------------------------------------------------- | ---------------------------------------------------- |
| [`docs/PRODUCT.md`](docs/PRODUCT.md)                           | O que o produto é, para quem, e o tom da interface   |
| [`docs/DOMAIN.md`](docs/DOMAIN.md)                             | Modelo de domínio e as decisões financeiras          |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)                 | Camadas, módulos e limites                           |
| [`docs/FIRESTORE_MODEL.md`](docs/FIRESTORE_MODEL.md)           | Coleções, consultas e índices                        |
| [`docs/SECURITY.md`](docs/SECURITY.md)                         | Regras de segurança e modelo de ameaças              |
| [`docs/LOCAL_DEVELOPMENT.md`](docs/LOCAL_DEVELOPMENT.md)       | Ambiente local e emuladores                          |
| [`docs/TESTING.md`](docs/TESTING.md)                           | Estratégia de testes                                 |
| [`docs/FORECAST_ENGINE.md`](docs/FORECAST_ENGINE.md)           | Como a projeção é calculada                          |
| [`docs/REPORTS.md`](docs/REPORTS.md)                           | Os relatórios e a pergunta que cada um responde      |
| [`docs/BILLING.md`](docs/BILLING.md)                           | Assinatura, pagamentos e a conta Asaas compartilhada |
| [`docs/ADSENSE.md`](docs/ADSENSE.md)                           | Publicidade e as regras de privacidade               |
| [`docs/PRODUCTION_READINESS.md`](docs/PRODUCTION_READINESS.md) | Revisão da Fase 12: achados, custo e o que falta     |
| [`docs/ROADMAP.md`](docs/ROADMAP.md)                           | Fases e estado atual                                 |
| [`docs/adr/`](docs/adr/)                                       | Decisões arquiteturais registradas                   |

---

## Stack

Next.js 15.5 (App Router), TypeScript estrito, React 19, Firebase Auth,
Cloud Firestore, Firebase App Hosting, Zod, React Hook Form, Tailwind CSS,
Vitest, Playwright e `@firebase/rules-unit-testing`.

A versão do Next.js foi escolhida por estar na faixa oficialmente suportada
pelo Firebase App Hosting — ver
[`docs/adr/0008-nextjs-version.md`](docs/adr/0008-nextjs-version.md).

---

## Aviso

O Conta comigo organiza e apresenta as informações que a própria pessoa
cadastra. Não é instituição financeira, não oferece crédito e não faz
recomendação de investimentos. As projeções são cálculos determinísticos sobre
os dados fornecidos, não previsões garantidas.

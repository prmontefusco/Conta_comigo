# Desenvolvimento local

## Requisito inegociável

O ambiente normal de desenvolvimento **não consome recursos reais do Firebase**.
Tudo roda no Firebase Local Emulator Suite.

Não executar `firebase deploy`. Não conectar a aplicação local ao Firestore
real. Não usar banco nem Authentication de produção para desenvolver. Não criar
recursos pagos. Não guardar service accounts no repositório.

## Pré-requisitos

- **Node 22 ou superior.** O App Hosting oferece `nodejs20`, `nodejs22` e
  `nodejs24`. Um aviso não fatal aparece no `postinstall` se a versão for menor.
- **Java 11 ou superior.** O emulador do Firestore roda em JVM.
- **Git.**

O Firebase CLI vem como dependência de desenvolvimento; não é preciso
instalá-lo globalmente.

## Um comando

```bash
npm install
npm run dev:local
```

Sobe emuladores de App Hosting, Authentication e Firestore, mais a Emulator UI,
e popula o banco com três famílias fictícias.

| Serviço        | Endereço              |
| -------------- | --------------------- |
| Aplicação      | http://127.0.0.1:5002 |
| Emulator UI    | http://127.0.0.1:4000 |
| Authentication | 127.0.0.1:9099        |
| Firestore      | 127.0.0.1:8080        |

## Usuários de teste

Senha: **`conta1234`**

| E-mail               | Papel  | Cenário                      |
| -------------------- | ------ | ---------------------------- |
| `ana@exemplo.test`   | OWNER  | Família Silva — organizada   |
| `bruno@exemplo.test` | ADMIN  | Família Silva                |
| `carla@exemplo.test` | OWNER  | Família Costa — apertada     |
| `diego@exemplo.test` | OWNER  | Família Almeida — endividada |
| `elis@exemplo.test`  | MEMBER | Família Almeida              |

**Família Silva** — receitas confortavelmente acima dos compromissos, reserva de
emergência formada, cartão sem parcelamentos longos.

**Família Costa** — margem mensal pequena. Qualquer imprevisto muda o mês. Boa
para testar alertas e a diferença entre saldo total e saldo livre.

**Família Almeida** — empréstimo, financiamento de veículo, dois cartões
parcelados, contas em atraso e meses futuros com déficit. É o cenário principal
para validar a projeção.

As datas do seed são relativas a "hoje", então os cenários nunca envelhecem.

O seed também gera **movimentação já realizada** dos meses anteriores, a partir
das próprias regras de recorrência de cada família: seis meses para as duas
primeiras, nove para a endividada. Contas variáveis oscilam por um valor
derivado de um hash estável — mesma regra, mesmo mês, mesmo número em toda
execução — para que as séries dos relatórios pareçam um household real sem
tornar uma falha impossível de reproduzir. O mês corrente fica de fora: ele
ainda está em andamento.

## Por que isso não toca em produção

O projeto local é `demo-conta-comigo`. Um id que começa com `demo-` faz o
Emulator Suite **recusar** qualquer chamada a serviços reais do Google Cloud.

Além disso, `assertUsableFirebaseConfig()` recusa iniciar em desenvolvimento
apontando para um projeto real sem emuladores.

## Configuração por ambiente

| Arquivo                    | Quando vale         | Versionado                           |
| -------------------------- | ------------------- | ------------------------------------ |
| `.env.development`         | `npm run dev`       | ✔ (só valores demo)                  |
| `apphosting.emulator.yaml` | `npm run dev:local` | ✔ (só valores demo)                  |
| `apphosting.yaml`          | Produção            | ✔ (sem segredos; use Secret Manager) |
| `.env.local`               | Sobrescreve local   | ✖ ignorado                           |
| `apphosting.local.yaml`    | Sobrescreve local   | ✖ ignorado                           |

## Comandos

| Comando                    | O que faz                                     |
| -------------------------- | --------------------------------------------- |
| `npm run dev:local`        | Emuladores + aplicação + seed                 |
| `npm run emulators`        | Só Auth e Firestore                           |
| `npm run emulators:all`    | Todos, sem seed                               |
| `npm run dev`              | Só o Next.js na porta 3000                    |
| `npm run seed`             | Recria os dados fictícios                     |
| `npm run emulators:export` | Exporta o estado para `firebase-export-data/` |
| `npm run typecheck`        | TypeScript estrito                            |
| `npm run lint`             | ESLint                                        |
| `npm run test`             | Testes unitários                              |
| `npm run test:rules`       | Security Rules (sobe um emulador próprio)     |
| `npm run test:e2e`         | Playwright                                    |
| `npm run verify`           | typecheck + lint + testes + regras            |

## Trabalhando em duas janelas

`npm run dev:local` faz tudo, mas reinicia o Next junto com os emuladores.
Para iterar mais rápido:

```bash
# terminal 1 — deixe rodando
npm run emulators

# terminal 2
npm run seed
npm run dev        # http://127.0.0.1:3000
```

## Problemas conhecidos

### "Could not start Firestore Emulator, port taken"

O processo Java do emulador nem sempre encerra ao receber SIGINT no Windows.
Verifique e encerre:

```bash
netstat -ano | grep LISTENING | grep ":8080"
```

```powershell
Stop-Process -Id <PID> -Force
```

### Erros `ENOENT: _buildManifest.js.tmp`

Você rodou `npm run build` com `npm run dev:local` aberto. Os dois usam o mesmo
diretório `.next` e um sobrescreve o outro. Pare o dev, apague `.next` e
reinicie:

```bash
rm -rf .next
```

### `MetadataLookupWarning` durante o seed

O Admin SDK tenta consultar o metadata server do Google Cloud, que não existe
numa máquina local. É inofensivo em modo emulador.

### O aviso "Running in emulator mode"

Banner do próprio Firebase Authentication. Ele confirma que você está falando
com o emulador, e não com produção.

## Exportar e importar estado

```bash
npm run emulators:export
npx firebase emulators:start --project demo-conta-comigo --import ./firebase-export-data
```

Útil para congelar um estado difícil de reproduzir. `firebase-export-*` está no
`.gitignore`.

## Adicionando uma coleção

1. Entidade de domínio em `src/modules/<módulo>/domain/`.
2. Schema Zod em `src/modules/shared/infrastructure/schemas.ts`.
3. Caminho em `src/lib/firebase/paths.ts`.
4. **Regra em `firestore.rules`** — sem ela, a coleção fica inacessível, que é o
   comportamento correto por omissão.
5. **Teste da regra em `tests/rules/`.** Sem teste, a funcionalidade não está
   pronta.
6. Assinatura em `FinanceProvider`, se a UI precisar dela ao vivo.
7. Índice em `firestore.indexes.json`, se houver consulta composta.

# ADR 0009 — Uma superfície de servidor, exclusivamente para pagamentos

**Data:** 2026-08-29
**Estado:** aceito
**Relação:** complementa a [ADR 0002](0002-client-side-data-access.md), sem revogá-la

## Contexto

A [ADR 0002](0002-client-side-data-access.md) decidiu que todo acesso a dados
acontece no cliente, com as Security Rules como camada de autorização, e que o
repositório não teria service account nenhuma.

Cobrar assinatura quebra essa premissa por três motivos que não têm contorno:

1. **A chave do provedor não pode estar no navegador.** Quem tiver a chave da
   API do ASAAS emite cobranças em nome da conta.
2. **Quem paga não pode declarar que pagou.** As regras hoje tornam `plan`
   imutável pelo cliente — deliberadamente. Confirmar um pagamento exige
   privilégio que o navegador não tem e não deve ter.
3. **O provedor precisa de um endereço para avisar.** Um webhook é, por
   definição, um endpoint público que recebe POST de fora.

## Decisão

O projeto passa a ter uma superfície de servidor **restrita a pagamentos**.

Concretamente:

- Route Handlers do Next.js sob `src/app/api/`, executados pelo App Hosting.
- Firebase Admin SDK autenticado por **Application Default Credentials**. Não
  há arquivo de service account no repositório, e continua não havendo: no App
  Hosting o backend recebe identidade em runtime; localmente o emulador injeta
  `FIRESTORE_EMULATOR_HOST` e `FIREBASE_AUTH_EMULATOR_HOST` no processo.
- Autenticação das rotas por verificação do ID token do Firebase no servidor.

A ADR 0002 **continua valendo para tudo o mais**. Nenhuma leitura ou escrita de
dado financeiro passa a ser feita pelo servidor. A regra é: se dá para fazer com
as Security Rules, faz-se com as Security Rules.

## Consequências

**Boas.** A chave de pagamento nunca chega ao cliente. O estado da assinatura
passa a ter uma fonte de verdade que o navegador não consegue forjar. O webhook
tem onde chegar.

O modelo de dados fica honesto: `subscriptions/{uid}` é legível pela própria
pessoa e **gravável por ninguém** pelo cliente — as regras negam escrita a
todos, e o servidor escreve por cima delas com o Admin SDK.

**Ruins.** Existe agora um caminho privilegiado que as Security Rules não
protegem. Ele é pequeno e está inteiro sob `src/app/api/` e
`src/modules/billing/`, mas precisa ser revisado com o mesmo cuidado que as
regras — e a revisão de segurança independente que a Fase 12 já pedia passa a
ser mais necessária, não menos.

O desenvolvimento continua inteiramente local: sem chave configurada, o gateway
lança `PaymentGatewayUnavailableError` e as rotas respondem 503. Nenhuma
cobrança pode ser aberta a partir de uma máquina de desenvolvimento.

## O que foi trazido do projeto CVLivre

A integração foi portada de um projeto irmão que já roda em produção no mesmo
stack. Três decisões dele foram mantidas por serem corretas:

**O corpo do webhook é uma pista, nunca uma afirmação.** O payload diz apenas
_qual_ cobrança olhar; status, valor e pagador são relidos da API do provedor
antes de conceder qualquer plano. Um POST forjado não vira assinatura.

**Fail-closed em todos os pontos.** Segredo de webhook ausente recusa todas as
requisições, em vez de pular a verificação. Chave de provedor ausente desabilita
o checkout, em vez de deixá-lo aberto.

**Existe reconciliação.** Webhooks se perdem — é quando, não se. Uma rota
autenticada relê a cobrança no provedor e ativa o plano se ele foi pago.

## O que foi mudado em relação ao original

**Um provedor só.** O original suporta ASAAS e Mercado Pago. Aqui ficou apenas
ASAAS: um provedor não usado é código morto num caminho que mexe com dinheiro.

**O produto entra na referência externa.** A mesma conta ASAAS atende dois
produtos. O original grava `{userId, cycle}` em `externalReference` e não
verifica de qual produto veio a cobrança. Aqui grava-se também o produto, e a
verificação recusa um pagamento que não seja deste. Colisão de uid entre dois
projetos Firebase é improvável ao ponto de ser teórica, mas a checagem custa uma
comparação.

**O segredo do webhook só vem por cabeçalho.** O original também o aceita em
query string, porque o Mercado Pago precisa. Query string vaza em log de acesso
e em referer; o ASAAS envia `asaas-access-token` como cabeçalho, então a query
string foi removida.

**A expiração é resolvida na leitura.** `resolveEffectivePlan` trata uma
assinatura vencida como FREE, sem depender de job agendado. O cliente resolve o
plano efetivo em vez de ler `plan` cru — senão uma assinatura vencida
continuaria sem anúncios para sempre.

## Quando revisitar

Se algum dia for preciso rodar trabalho privilegiado que não seja pagamento —
notificações, importação bancária, exportação assíncrona. Aí vale discutir se a
superfície continua restrita ou se o projeto assume um backend de verdade.

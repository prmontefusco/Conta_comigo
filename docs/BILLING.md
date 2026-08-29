# Assinatura e pagamentos

Estado: **camada de servidor pronta, checkout ainda fechado.**

A rota que abre uma cobrança não existe de propósito — os preços e o que o
plano Premium entrega ainda não foram decididos. `isPlanCatalogueConfigured()`
devolve `false` enquanto os valores forem zero, e há teste garantindo isso.

## Como funciona

```
  navegador                    servidor                    Asaas
     │                            │                          │
     │  (checkout: ainda não existe)                         │
     │                            │                          │
     │                            │◀── webhook PAYMENT_* ────│
     │                            │                          │
     │                            │─── relê a cobrança ─────▶│
     │                            │◀── status, valor, ref ───│
     │                            │                          │
     │                       grava subscriptions/{uid}       │
     │◀── onSnapshot ─────────────│                          │
     │                            │                          │
     │─── POST /api/assinatura/reconciliar ─▶ (se o webhook se perdeu)
```

## As três regras que sustentam isso

**O corpo do webhook é pista, não prova.** O payload diz apenas _qual_ cobrança
olhar. Status, valor e pagador são relidos da API do Asaas antes de conceder
qualquer plano. Quem descobrir a URL do endpoint pode enviar o que quiser e não
vira assinante.

**Fail-closed em todo ponto.** Sem `PAYMENT_WEBHOOK_SECRET`, o webhook recusa
todas as requisições — uma variável ausente não desliga a autenticação. Sem
`ASAAS_API_KEY`, o gateway lança `PaymentGatewayUnavailableError` e nada pode
ser cobrado.

**Quem paga não declara que pagou.** As Security Rules negam escrita em
`subscriptions` para todo mundo. Só o Admin SDK grava ali, e ele ignora as
regras — é o único caminho privilegiado do projeto. Há teste afirmando que
ninguém se concede um plano.

## Conta Asaas compartilhada

A mesma conta atende mais de um produto, então `externalReference` carrega o
produto além do usuário e do ciclo:

```json
{ "product": "conta-comigo", "userId": "…", "cycle": "YEARLY" }
```

`decodeExternalReference` devolve `null` para qualquer coisa que não seja deste
produto, e `verifyPayment` recusa. Uma cobrança legítima de outro produto na
mesma conta não concede nada aqui.

O mesmo vale para o cliente no Asaas: `externalReference` é
`conta-comigo:{uid}`, então o mesmo uid noutro produto não colide.

**Ainda em aberto:** se misturar as cobranças dos dois produtos no extrato do
Asaas é aceitável para a conciliação contábil.

## Valores

O domínio guarda **centavos inteiros**; a API do Asaas recebe e devolve **reais
decimais**. Errar isso cobra cem vezes a mais ou a menos.

A conversão acontece exclusivamente em `toProviderAmount` e
`fromProviderAmount`, dentro de `asaas-gateway.ts`, e em nenhum outro lugar.

## Expiração

`resolveEffectivePlan` trata uma assinatura vencida como FREE **na leitura**.
Não há job agendado, e é deliberado: um job que não roda deixaria assinaturas
vencidas ativas para sempre.

O cliente lê o plano por `useSession().isPremium`, nunca por `profile.plan` —
esse campo é um espelho de conveniência escrito pelo servidor e não sabe se o
prazo acabou.

## Reprocessamento

Webhooks repetem: o Asaas reenvia até receber 200. `grant` compara o
`externalTxId` com o já registrado e não estende o plano duas vezes pelo mesmo
pagamento.

Renovar antes do vencimento **soma** ao prazo restante em vez de reiniciar —
quem paga adiantado não perde os dias já pagos. Há teste.

## Desenvolvimento local

Sem chave configurada, nada de pagamento funciona, e é o correto: nenhuma
cobrança pode ser aberta de uma máquina de desenvolvimento.

O Admin SDK, sob `npm run dev:local`, fala com os emuladores — o emulador do
App Hosting injeta `FIRESTORE_EMULATOR_HOST` e `FIREBASE_AUTH_EMULATOR_HOST` no
processo do Next. `assertSafeEnvironment` recusa iniciar em desenvolvimento
contra um projeto real, porque o Admin SDK ignora as Security Rules.

Para exercitar o fluxo de verdade, use o sandbox:
`ASAAS_API_BASE_URL=https://api-sandbox.asaas.com/v3`.

## O que falta

- [ ] **Preços e ciclos** — `PLAN_CATALOGUE` está zerado
- [ ] **O que o Premium entrega** além de tirar anúncios
- [ ] Rota de checkout (depende dos dois itens acima)
- [ ] Telas de assinatura e de pagamento
- [ ] Cancelamento pela interface
- [ ] Cadastro do webhook no painel do Asaas
- [ ] Decidir a conciliação contábil da conta compartilhada
- [ ] Revisão de segurança independente deste caminho, junto com a das regras

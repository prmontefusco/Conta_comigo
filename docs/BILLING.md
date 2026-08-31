# Assinatura e pagamentos

Estado: **fluxo completo implementado; falta a chave do provedor.**

Preços: **R$ 5,00 por mês** ou **R$ 50,00 por ano** (equivale a R$ 4,17/mês).

## Preço é configuração, não código

Decisão registrada na [ADR 0010](adr/0010-price-as-configuration.md). Os valores
vivem em variáveis de ambiente, em **centavos inteiros**:

```
SUBSCRIPTION_PRICE_MONTHLY_CENTS=500
SUBSCRIPTION_PRICE_YEARLY_CENTS=5000
```

Centavos, e não reais, para não haver dúvida sobre separador decimal: `"5.00"` e
`"5,00"` são a mesma intenção e o mesmo tropeço. Mudar o preço é editar
`apphosting.yaml` e reimplantar; não exige alterar código nem abrir um commit.

Um valor ausente ou inválido **fecha a venda daquele ciclo**, em vez de virar
zero — é melhor não vender do que vender pelo preço errado. Sem nenhum dos dois,
`isPlanCatalogueConfigured()` devolve `false` e a tela diz que a assinatura
ainda não está disponível.

O preço fica **só no servidor**, nunca numa variável `NEXT_PUBLIC_`. O navegador
consulta `GET /api/assinatura/planos`, de modo que existe uma única fonte de
verdade: a mesma que o checkout usa para cobrar. Dois lugares poderiam divergir,
e a tela mostraria um valor diferente do debitado.

## Como funciona

```
  navegador                    servidor                    Asaas
     │                            │                          │
     │─── GET  /api/assinatura/planos ──▶ (preço do catálogo) │
     │◀── ciclos, valores, economia do anual                  │
     │                            │                          │
     │─── POST /api/assinatura/checkout ─▶                    │
     │      { cycle, method }     │─── cria a cobrança ─────▶│
     │◀── Pix copia-e-cola ou invoiceUrl ◀── chargeId ────────│
     │                       grava status PENDING            │
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

## As quatro regras que sustentam isso

**O corpo do webhook é pista, não prova.** O payload diz apenas _qual_ cobrança
olhar. Status, valor e pagador são relidos da API do Asaas antes de conceder
qualquer plano. Quem descobrir a URL do endpoint pode enviar o que quiser e não
vira assinante.

**Fail-closed em todo ponto.** Sem `PAYMENT_WEBHOOK_SECRET`, o webhook recusa
todas as requisições — uma variável ausente não desliga a autenticação. Sem
`ASAAS_API_KEY`, o gateway lança `PaymentGatewayUnavailableError` e nada pode
ser cobrado. E o gateway recusa falar com `api.asaas.com` fora de produção, para
que uma chave válida no ambiente errado não crie cobranças de verdade.

**O valor sai do servidor, nunca do cliente.** O corpo do checkout aceita
apenas `cycle`, `method` e — quando o provedor exigir — `cpfCnpj`. Não existe
campo de valor no schema: o preço é lido do catálogo do servidor, e a identidade
de quem paga vem do token verificado. Aceitar um valor do navegador deixaria
qualquer pessoa assinar por um centavo.

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

- [ ] **Chave do Asaas** — sem `ASAAS_API_KEY`, `/api/assinatura/planos`
      responde `open: false` e o checkout devolve 503. É o único item que
      separa o fluxo atual de uma venda real.
- [ ] **O que o Premium entrega** além de tirar anúncios. Hoje a tela afirma que
      nenhuma função de planejamento fica atrás do pagamento; se isso mudar, o
      texto muda junto.
- [ ] Cancelamento pela interface
- [ ] Guardar mais de uma cobrança pendente. Hoje fica só a última: quem abrir um
      Pix, depois um cartão, e pagar o Pix, não é atendido pelo botão "já paguei"
      — mas continua sendo ativado pelo webhook, que parte do id enviado pelo
      provedor.
- [ ] Cadastro do webhook no painel do Asaas
- [ ] Decidir a conciliação contábil da conta compartilhada
- [ ] Revisão de segurança independente deste caminho, junto com a das regras

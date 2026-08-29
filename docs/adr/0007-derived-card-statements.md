# ADR 0007 — Faturas e parcelas são derivadas, não armazenadas

**Data:** 2026-08-28
**Estado:** aceito

## Contexto

A estrutura de referência sugeria coleções `cardStatements` e parcelas
persistidas. Isso levanta três problemas:

- quem fecha a fatura? um job agendado? o primeiro acesso do mês?
- o que acontece com uma compra lançada com atraso, depois do fechamento?
- e se alguém corrigir o valor ou o número de parcelas de uma compra já
  distribuída em faturas?

Cada resposta é um caminho de reconciliação, e cada caminho é uma chance de a
soma das partes deixar de bater com o todo.

## Decisão

Nem parcelas nem faturas são persistidas. Ambas são função determinística de:

- as compras do cartão (`cardPurchases`);
- a configuração do cartão (dia de fechamento e de vencimento);
- as transações de pagamento de fatura (`CARD_STATEMENT_PAYMENT`).

`projectStatements()` calcula tudo em memória. Uma fatura tem id determinístico
`${cardId}_${YYYY-MM}`, para que um pagamento sempre aponte para a fatura certa
mesmo sem documento persistido.

## Consequências

**Boas.** Não existe estado que possa divergir. Uma compra lançada com um mês de
atraso, ou corrigida, cai imediatamente na fatura correta, sem passo de
reconciliação. Não há job de fechamento — e portanto não há Cloud Functions,
não há agendamento, não há falha de job para monitorar.

A soma das faturas é sempre exatamente a soma das compras. Isso é verificado
por teste, e é uma propriedade que não poderia ser garantida com faturas
persistidas.

**Ruins.** As compras do cartão precisam estar carregadas para exibir qualquer
fatura. Na prática, o provider já assina a coleção inteira.

Editar uma parcela individual (um estorno parcial, um acordo sobre uma parcela
específica) não é possível hoje. Quando for necessário, a forma correta será um
documento de ajuste ligado à compra — não persistir a parcela, o que traria de
volta exatamente o problema que esta decisão evita.

Faturas muito antigas são recalculadas junto com as recentes. O horizonte é
limitado a 18 meses para trás, o que mantém o custo estável.

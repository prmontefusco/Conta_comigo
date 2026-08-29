# ADR 0003 — Dinheiro como inteiro em centavos

**Data:** 2026-08-28
**Estado:** aceito

## Contexto

Ponto flutuante não representa exatamente valores decimais. `0.1 + 0.2` é
`0.30000000000000004`. Somando mil centavos, o erro aparece. Num saldo, ele
aparece como uma diferença que ninguém consegue explicar.

## Decisão

```ts
interface Money {
  readonly amount: number; // inteiro, menor unidade da moeda
  readonly currency: "BRL";
}
```

`money()` lança se receber um não inteiro ou algo fora do intervalo seguro.
Aritmética recusa misturar moedas. `fromDecimal` e `fromDecimalString` são os
únicos pontos de entrada a partir de decimais, e arredondam meio para longe de
zero — como se arredonda dinheiro à mão.

`allocate(total, partes)` garante que a soma das partes seja exatamente o
total, distribuindo o resto às primeiras parcelas.

## Consequências

**Boas.** Nenhum erro de arredondamento em soma, comparação ou acumulação. Um
parcelamento nunca perde nem inventa um centavo, o que é verificável: há um
teste que divide R$ 9.876,54 em 1 a 60 partes e confere a soma em cada caso. O
tipo obriga a pensar em moeda em toda operação.

**Ruins.** Toda entrada e saída precisa converter. `toDecimal` existe apenas
para exibição e exportação, nunca para cálculo. O limite é `Number.MAX_SAFE_INTEGER`
centavos — cerca de 90 trilhões de reais, o que não é uma restrição prática.

Juros compostos ainda usam ponto flutuante no fator; o resultado é arredondado
uma vez ao voltar para `Money`, com o modo de arredondamento explícito, para
que os cronogramas sejam reproduzíveis.

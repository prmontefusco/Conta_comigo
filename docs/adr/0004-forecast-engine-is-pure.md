# ADR 0004 — O motor de previsão não depende de Firestore

**Data:** 2026-08-28
**Estado:** aceito

## Contexto

A projeção financeira é o componente mais importante e mais complexo do
produto. Ela combina obrigações, recorrências, faturas de cartão e cronogramas
de dívida ao longo de até um ano.

Se ela precisasse de banco para rodar, cada teste precisaria de um emulador,
cada cenário exigiria montar documentos, e as suítes ficariam lentas o
bastante para serem evitadas.

## Decisão

```ts
forecast(input: ForecastInput): ForecastResult
```

Função pura. Recebe estruturas de domínio, devolve uma projeção. Sem I/O, sem
Firestore, sem relógio implícito — `asOf` é parâmetro.

Uma regra de ESLint impede qualquer import de Firebase em `domain/`, para que a
decisão não dependa de disciplina.

## Consequências

**Boas.** Cenários complexos são testados em milissegundos, sem emulador. Uma
simulação "e se?" é literalmente a mesma função com eventos extras — não existe
um segundo caminho de cálculo que possa divergir do real. O cálculo é
reproduzível: mesma entrada, mesma saída, sempre, o que torna possível
investigar um número que alguém questiona.

Também mantém o Firestore no papel de armazenamento. Ele nunca calcula um
saldo, então não existe lógica financeira dividida entre dois lugares.

**Ruins.** Toda a entrada precisa ser carregada antes de chamar a função. Isso
empurra a decisão de "carregar tudo e derivar" documentada em
`ARCHITECTURE.md`, que é adequada para milhares de documentos por household e
precisaria ser revisitada em outra ordem de grandeza.

Projeções não podem ser pré-computadas no servidor sem duplicar o motor. Se um
dia isso for necessário, a função pura roda igualmente bem em Node — o que é
justamente o ponto.

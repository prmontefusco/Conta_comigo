# Produto

## O problema

Existe uma diferença entre saber onde o dinheiro foi e saber onde ele está
indo. Quase todo aplicativo financeiro resolve o primeiro. O segundo é o que
faz diferença numa decisão.

Uma pessoa que está apertada raramente chegou lá por uma decisão ruim isolada.
Chegou por acúmulo: uma parcela aqui, uma anuidade ali, um aumento de aluguel,
uma conta que mudou de valor. Cada item, sozinho, cabia. Somados, não cabem — e
ninguém percebeu, porque nunca estiveram todos na mesma tela.

O Conta comigo existe para colocá-los na mesma tela e mostrar as consequências
antes que elas cheguem.

## Público

Pessoas e famílias brasileiras que:

- perderam o controle e não sabem por onde começar;
- estão endividadas e precisam enxergar o tamanho real da situação;
- estão organizadas mas querem antecipar meses difíceis;
- dividem contas com outra pessoa e precisam de um número comum.

Boa parte dessas pessoas chega ansiosa. Isso tem consequências diretas de
design, listadas na seção de tom.

## As perguntas que o produto responde

O produto se mede por conseguir responder, com números corretos:

- Quanto dinheiro eu tenho hoje?
- Quanto ainda vou receber?
- Quanto já está comprometido?
- Quais contas vencem primeiro?
- Quanto preciso até o fim do mês?
- Quanto vai sobrar?
- Quanto posso gastar sem comprometer contas futuras?
- Qual será minha situação em 30, 60, 90, 180 e 365 dias?
- Uma compra parcelada cabe no orçamento?
- Uma viagem é possível?
- Se surgir uma emergência, tenho reserva suficiente?
- Quanto dos próximos meses já está tomado por cartões, empréstimos e
  financiamentos?
- Estou reduzindo ou aumentando meu endividamento?
- O que acontece se minha renda diminuir?
- O que acontece se surgir uma despesa extraordinária?

Cada tela existe porque responde pelo menos uma dessas perguntas. Uma tela que
não responde nenhuma não deveria existir.

## As três dimensões

| Dimensão | O que é                                                                                          | Onde aparece                                              |
| -------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| Passado  | O que efetivamente aconteceu: receitas recebidas, contas pagas, transferências, faturas quitadas | `Transaction`                                             |
| Presente | Saldo das contas, pendências, atrasos, reservas, compromissos assumidos                          | Derivado de `Account` + `Transaction` + `Obligation`      |
| Futuro   | Salários previstos, contas recorrentes, parcelas, faturas, dívidas, obrigações eventuais         | `Obligation` + `RecurringRule` + `CardStatement` + `Debt` |

O diferencial não está em nenhuma delas isolada. Está em combinar as três numa
projeção única. Ver [`FORECAST_ENGINE.md`](FORECAST_ENGINE.md).

## Princípios financeiros inegociáveis

Estes quatro princípios não são preferências de modelagem. Violá-los faz o
aplicativo mentir para alguém sobre o próprio dinheiro. Cada um tem teste
automatizado em `src/modules/transactions/domain/financial-principles.test.ts`.

**Transferência não é receita nem despesa.** Mover R$ 1.000 da conta A para a
conta B diminui uma conta, aumenta outra e não muda o patrimônio.

**Empréstimo não é renda.** Receber R$ 10.000 emprestado aumenta a
disponibilidade financeira e cria uma obrigação do mesmo tamanho. O painel
distingue três coisas diferentes: aumento de disponibilidade, aumento de renda e
aumento de endividamento.

**Reserva não é despesa.** Mover R$ 1.000 para uma reserva não é gastar
R$ 1.000. Por isso `totalCash` e `spendableCash` são números distintos: alguém
pode ter R$ 10.000 nas contas e ter decidido que R$ 6.000 são reserva de
emergência. Disponibilidade discricionária: R$ 4.000.

**Pagar a fatura do cartão não é uma segunda despesa.** Uma compra de R$ 1.200
em 6 parcelas gera uma compra e seis obrigações futuras de R$ 200. O gasto
pertence ao mês da compra; o desembolso, aos meses das parcelas.

## Duas visões, sempre separadas

**Visão de consumo (competência)** — quando e em quê o dinheiro foi
comprometido. Uma compra de agosto pertence a agosto.

**Visão de caixa (fluxo)** — quando o dinheiro efetivamente sai da conta. As
parcelas dessa mesma compra podem impactar setembro a fevereiro.

Confundir as duas produz dois erros simétricos: achar que se gasta pouco (só as
parcelas aparecem) ou achar que se gastou duas vezes (compra e fatura contadas).

A estratégia adotada está documentada em [`DOMAIN.md`](DOMAIN.md), seção
"Cartão de crédito".

## Tom da interface

O público inclui pessoas endividadas, desorganizadas ou ansiosas com dinheiro.
Elas normalmente já sabem que a situação não está boa. O software não precisa
confirmar isso.

**Nunca:**

> Você gastou demais.
> Você falhou.
> Sua situação financeira está péssima.

**Sempre:**

> Seus compromissos previstos superam as receitas de novembro em R$ 720.
> Há três contas vencendo nos próximos sete dias.
> R$ 1.300 do saldo atual está reservado para despesas já previstas.

A regra prática: cada frase da interface afirma um **fato** e, quando útil, a
**consequência** dele. Nenhuma avalia a pessoa.

Consequências concretas disso no código:

- A paleta evita vermelho de alarme como cor padrão de saída de dinheiro. Saída
  não é fracasso.
- Um mês em déficit é destacado em âmbar, com o valor exato da diferença.
- Alertas são ordenados por urgência, não por gravidade moral.
- Nenhuma tela usa gamificação, streaks ou emoji de decepção.

## Isto não é consultoria financeira

O produto organiza e apresenta informações. Não diz o que fazer.

Não: "Você deve investir nisso", "Pegue este empréstimo", "Compre este produto".

Sim: "Neste cenário, seu saldo projetado em dezembro seria R$ X."

O simulador é o caso mais sensível: ele responde "como ficariam os números", e
termina explicitamente com "a decisão é sua".

## Onboarding

Ninguém configura cinquenta coisas antes de ver valor. A ordem é:

1. criar conta;
2. criar o grupo (pode ser uma pessoa só);
3. informar a renda principal;
4. cadastrar contas e saldos;
5. cadastrar contas recorrentes;
6. cadastrar cartões;
7. cadastrar dívidas e parcelamentos.

Com as etapas 1 a 4 a projeção já começa a fazer sentido. A tela
`/app/comecar` mostra o que cada etapa desbloqueia, para que o esforço tenha
retorno visível.

## Modelo de negócio

**FREE** — funcionalidades principais, com anúncios do Google AdSense.
**PREMIUM** — arquitetura preparada para ausência de anúncios e recursos
adicionais. Cobrança não implementada.

Nenhum dado financeiro é enviado à rede de anúncios, em nenhuma hipótese. Ver
[`ADSENSE.md`](ADSENSE.md).

## Definition of Done do MVP

O primeiro MVP funcional exige que uma pessoa consiga, usando apenas o Firebase
Emulator Suite: criar conta, criar família, cadastrar contas bancárias e saldos,
receitas, despesas, contas recorrentes, cartões, compras parceladas, empréstimos,
financiamentos, reservas e orçamento; e visualizar faturas, contas futuras,
receitas futuras, a projeção financeira, os meses com déficit, quanto está
comprometido e quanto está realmente livre.

O estado atual está em [`ROADMAP.md`](ROADMAP.md).

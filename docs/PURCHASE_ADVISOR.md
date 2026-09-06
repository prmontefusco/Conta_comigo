# Antes de comprar — proposta de desenho

**Estado:** implementado (fases 1, 2 e 3)
**Data:** 2026-09-05

## Por que esta função importa mais do que parece

Todo o resto do produto é retrospectivo ou defensivo: aqui está a sua situação,
aqui está o que pagar primeiro, aqui está como negociar o que você já deve.
Esta seria a **única função prospectiva** — o momento em que o aplicativo pode
evitar a próxima dívida em vez de administrar a atual.

E há um segundo motivo, de retenção: ninguém abre um aplicativo de finanças
para se sentir mal. Mas alguém parado na loja, com o celular na mão, decidindo
entre 10x e à vista, **quer** uma resposta naquele instante. É um dos poucos
momentos de demanda genuína que este produto tem.

A observação que originou a ideia está certa e é a parte difícil: pessoas
endividadas continuam precisando comprar. A máquina de lavar quebra justamente
no mês apertado. Morre um parente e a passagem custa R$ 900. Fingir que essas
compras não vão acontecer é a mesma desonestidade que prometer quitação a quem
está em déficit.

## A regra que decide todo o resto: isto não é um portão

A versão ingênua desta função é uma calculadora que responde "pode" ou "não
pode". Ela falha por três motivos, nesta ordem:

1. **A máquina de lavar continua quebrada.** Dizer "você não pode" a quem tem
   três filhos e nenhuma máquina não resolve nada e é um pouco cruel.
2. **A pessoa compra assim mesmo.** A necessidade não desaparece porque um
   aplicativo desaprovou.
3. **Ela para de abrir o aplicativo**, porque ele virou a coisa que diz não.

A pergunta real quase nunca é "compro ou não". É **"qual forma de pagar
machuca menos?"**. Então a saída não é um veredito: é uma comparação de
caminhos, com o efeito de cada um sobre o plano de sair da dívida.

Corolário: **o aplicativo nunca diz "pode comprar"**. Ele diz o que acontece.
A decisão continua de quem lê — o mesmo compromisso que já vale na tela de
negociação.

## As quatro opções, e a terceira é a que ninguém oferece

Toda análise mostra as quatro, mesmo as que a pessoa não perguntou:

1. **À vista**, com o dinheiro que existe hoje
2. **Parcelado**, cada proposta que a pessoa tiver em mãos
3. **Esperar N meses e comprar à vista** ← o diferencial
4. **Alternativa mais barata**: consertar, usado, recondicionado, alugar o
   serviço

A opção 3 é a que nenhum concorrente calcula, e é a que mais economiza:

> Adiar 2 meses e guardar R$ 190 por mês: você compra à vista por R$ 380 a
> menos e sua data de quitação não muda.

A opção 4 tem um cálculo concreto que ninguém faz. Para a máquina de lavar:

> Consertar custa R$ 380. Comprar custa R$ 1.890. O conserto se paga se a
> máquina durar mais 8 meses.
>
> Lavanderia custa cerca de R$ 60 por mês. A máquina nova se paga em 31 meses.

## A pergunta de essencialidade é sobre consequência, não sobre mérito

O aplicativo não julga se alguém precisa de um celular — pode ser vaidade ou
pode ser a ferramenta de trabalho, e ele não tem como saber. O que ele pergunta
é **o que acontece se você não comprar**, exatamente a mesma lógica que
`debt-risk.ts` usa para dívidas e `triage.ts` para contas:

| Situação                             | Como muda a análise                                       |
| ------------------------------------ | --------------------------------------------------------- |
| Quebrou e é essencial                | Adiar tem custo próprio; entra no cálculo                 |
| Está falhando, ainda funciona        | Esperar é barato; a opção 3 ganha peso                    |
| Necessário para trabalhar ou estudar | Adiar pode custar renda; o custo de não comprar é o maior |
| Emergência familiar (morte, saúde)   | **Não há decisão a tomar.** Muda de modo — ver abaixo     |
| Quero, e dá para esperar             | O adiamento é apresentado primeiro                        |

O caso da emergência familiar merece tratamento próprio. Não existe "vale a
pena?" numa passagem para o enterro de um parente. A pergunta vira **"como
absorver isso com menos estrago"**, e a resposta é o que adiar — que é
literalmente a tela `/app/emergencia`. O conselheiro deveria encaminhar para
lá, não simular.

## Os números que só este aplicativo consegue dar

O motor de previsão e o de recuperação já existem. Isso torna possível uma
saída que nenhuma calculadora de loja produz:

- **Total pago** e a **taxa embutida** — via `impliedMonthlyRate`, que já
  resolve a taxa escondida em "10x de R$ 189"
- **Em que mês o seu saldo fica negativo** por causa desta compra
- **Quantos meses a sua quitação atrasa** — rodando
  `calculateRecoveryTimeline` com e sem a parcela hipotética
- **Se a compra destrói a reserva de partida** — `starterReserveStatus`
- **Se a compra empurra o plano para `NOT_VIABLE`** — a frase mais forte que
  este produto poderia dizer:

> Com esta parcela, suas parcelas mínimas deixam de caber no mês. Não é que
> fique apertado: a conta passa a não fechar.

## "Parcelado sem juros" não é de graça

Vale uma explicação dedicada, porque é o engano central do varejo brasileiro.
Dez vezes sem juros não cobra juro nenhum — e trava R$ 189 da sua capacidade
mensal por dez meses. Juro não custa; **espaço** custa. E espaço é exatamente
o que falta a quem está endividado.

A tela deveria dizer isso em números:

> Sem juros, mas compromete 18% da sua sobra até junho de 2027. Nesse período,
> um imprevisto de R$ 200 não cabe.

Pelo mesmo motivo, **o total pago aparece antes da parcela**, sempre. O sistema
inteiro de varejo é construído para fazer a pessoa pensar em parcela; quebrar
isso é a função.

E um empurrão que a tela de negociação já tem na veia: **perguntar o desconto à
vista**. Quase toda loja tem, e quase nenhuma oferece sozinha.

## O que o texto não pode fazer

Os termos de uso dizem que o serviço não oferece, intermedia nem recomenda
crédito. Isso vale aqui com força:

- **Nunca** "faça o carnê da loja" ou "use o cartão" — é recomendação de
  crédito. O padrão a seguir é o de `local-advice.ts`, que descreve critérios
  (CET, total pago, mês que quebra) e nunca nomeia o produto a contratar.
- **Nunca** "pode comprar". Quem autoriza, responde.
- **Nunca** gamificar a renúncia. "Você resistiu a uma compra!" é condescendente
  com quem está sem máquina de lavar.

## Reuso — quase tudo já existe

| Precisa de                        | Já existe em                                      |
| --------------------------------- | ------------------------------------------------- |
| Quanto cabe por mês               | `negotiation/domain/affordable-proposal.ts`       |
| Taxa escondida na parcela         | `debts/domain/debt.ts` → `impliedMonthlyRate`     |
| Comparar à vista contra parcelado | `negotiation/domain/feirao-offer.ts`              |
| Efeito na data de quitação        | `recovery-timeline/domain/recovery-calculator.ts` |
| Dano à reserva de partida         | `reserves/domain/starter-reserve.ts`              |
| Em que mês o saldo fica negativo  | `forecast/domain/forecast.ts`                     |

O módulo novo é sobretudo **composição**, não cálculo novo. É a terceira
aplicação do mesmo princípio de consequência que já organiza dívidas e contas.

## Construção sugerida, em três fases

**Fase 1 — domínio puro.** `modules/purchase-advisor/domain/`, sem UI e sem
I/O, testado em memória como o resto do domínio financeiro. Entrada: item,
consequência de não comprar, as propostas de pagamento que a pessoa tem, e os
números da casa. Saída: uma linha por caminho, com total pago, taxa embutida,
mês que quebra, meses adicionados à quitação e efeito na reserva.

**Fase 2 — a tela**, em `/app/comprar`. No plano gratuito, pelo mesmo motivo do
modo emergência: é decisão sobre dívida, não comodidade.

**Fase 3 — integração.** Feita em duas partes:

- **O aviso de mudança de estado**, em `purchase-advisor.ts`
  (`flipsMonthIntoDeficit`). Diferente de "em dezembro aperta": dispara quando
  a casa fecha o mês hoje e esta parcela é o que a tira do azul, e nomeia os
  dois números. Nunca dispara para quem já estava no vermelho — aí a compra
  não é a causa, e culpá-la seria mentira.
- **O retrato do que já está comprometido**, em `committed-installments.ts` e
  na tela de cartões. A lista de parcelamentos mostrava uma compra por linha,
  e cada uma parece pequena; o que muda a próxima decisão é a soma mês a mês,
  o mês mais pesado e o mês em que alivia.

## Nome

"Conselheiro de compras" descreve bem a intenção, mas "conselheiro" encosta em
consultoria, que é o que os termos de uso dizem que o produto não faz. Alguns
nomes que prometem menos e entregam a mesma coisa:

- **Antes de comprar** — é um momento, não uma autoridade
- **Vale a pena?** — devolve a pergunta a quem decide
- **Simulador de compra** — descritivo, sem prometer veredito

A recomendação é **"Antes de comprar"**: diz quando usar, e não promete
resposta.

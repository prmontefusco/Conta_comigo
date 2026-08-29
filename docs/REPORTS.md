# Relatórios

`src/modules/reports/domain/reports.ts` e `src/modules/reports/ui/charts.tsx`

## O critério

Um gráfico só existe se responde uma pergunta que alguém realmente faz. Cada
bloco da tela `/app/relatorios` é **titulado com a sua pergunta**, e esse título
é o contrato: um bloco que deixe de respondê-la deve deixar de existir.

Isso é uma restrição deliberada contra o painel cheio de gráficos bonitos que
ninguém usa para decidir nada (docs/PRODUCT.md, seção 33).

## Os seis blocos

### Quanto entrou e quanto saiu?

Receitas e despesas por **competência**, mês a mês. Transferências não aparecem
— elas movimentam dinheiro sem alterar o que a família tem — e pagamentos de
fatura também não, porque a despesa já foi contabilizada no mês da compra.

`cashFlowByMonth` calcula os dois pares de números lado a lado: competência
(como foi o mês) e caixa (o que de fato se moveu). São perguntas diferentes e
não são somadas.

### Para onde meu dinheiro foi?

Categorias do mês, ordenadas, separando o que já foi gasto do que ainda está
comprometido, com a diferença em relação ao mês anterior.

A comparação existe porque "R$ 900 em alimentação" isolado quer dizer pouco, e
"R$ 900, R$ 240 acima do mês passado" quer dizer muito.

O seletor de mês cai por padrão no **último mês com movimento**. No início de um
mês não há nada registrado ainda, e um bloco vazio pareceria uma família que
não gastou nada em vez de um mês que acabou de começar.

### Isso é sempre assim?

Evolução mensal de uma categoria, ou do total, com a média dos meses que tiveram
movimento. Um mês isolado é anedota; seis meses são um padrão.

### Quanto do meu custo é obrigatório?

Compromissos do mês divididos em fixos, variáveis e eventuais, com a fatia dos
fixos em destaque.

Calculado a partir de obrigações e regras de recorrência, não do que foi pago:
é ali que a classificação vive, e a pergunta é sobre a **forma** dos custos da
casa, não sobre quais boletos aconteceram de compensar neste mês.

Nada é inferido. Uma conta que ninguém classificou é contada onde o seu próprio
`expenseNature` diz (docs/PRODUCT.md, seção 35).

### O orçamento está funcionando?

Planejado contra gasto somado ao comprometido, ao longo dos meses. Meses sem
orçamento são marcados como tal, em vez de aparecerem como se estivessem em dia.

Um mês acima do planejado é ruído. Vários meses seguidos significam que o plano
não corresponde à vida — e é o plano que deveria mudar.

### Estou reduzindo meu endividamento?

Trajetória do total devido nos próximos doze meses, mais a data em que cada
dívida termina.

**Os dois lados assumem pagamento em dia.** Empréstimos seguem o cronograma;
faturas de cartão são consideradas quitadas no vencimento. Essa premissa tem de
ser a mesma para os dois, ou as duas metades da linha estariam medindo mundos
diferentes. Atrasos são um fato sobre hoje, mostrado pelos alertas; misturá-los
numa trajetória só a embaçaria.

## Gráficos

SVG escrito à mão, sem biblioteca. São formas simples, e mantê-las sob controle
significa cores que respeitam o tema e uma alternativa acessível honesta —
duas coisas que uma dependência tiraria das nossas mãos.

Três componentes:

| Componente       | Uso                                                                      |
| ---------------- | ------------------------------------------------------------------------ |
| `BarList`        | Ranking com barras proporcionais. O número fica sempre ao lado da barra. |
| `MonthlyColumns` | Colunas agrupadas sobre meses.                                           |
| `TrendLine`      | Uma linha sobre meses, onde o formato é a mensagem.                      |

### Acessibilidade

Todo SVG é `aria-hidden` e vem acompanhado dos **mesmos números** — não de um
resumo — como texto real ou como uma `<table>` visível apenas para leitores de
tela.

No `BarList` isso é estrutural: o valor é renderizado ao lado da barra, então a
barra só acrescenta noção de proporção e nunca é a única forma de ler o dado.

Um teste E2E verifica que a quantidade de tabelas dentro de `figure` é igual à
de SVGs, e que todo SVG está marcado como decorativo. Um gráfico que ninguém
consegue ler não é um gráfico, é enfeite.

## Testes

`reports.test.ts` cobre, entre outros casos:

- pagamento de fatura não vira consumo em nenhum mês;
- transferência não entra nem como entrada nem como saída de caixa;
- empréstimo entra como caixa, nunca como receita;
- uma regra de recorrência que já virou obrigação não é contada duas vezes;
- obrigações quitadas somem do comprometido;
- meses sem orçamento são marcados, não tratados como zero;
- a dívida cai mês a mês, e empréstimo e cartão usam a mesma premissa.

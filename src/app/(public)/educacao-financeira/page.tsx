import type { Metadata } from "next";
import { Bullets, ContentPage, Section } from "@/components/content-page";

export const metadata: Metadata = {
  title: "Educação financeira: conceitos que mudam decisões",
  description:
    "Patrimônio, fluxo de caixa, competência, amortização, CET e reserva de emergência " +
    "explicados pelo que realmente muda na hora de decidir.",
  alternates: { canonical: "/educacao-financeira" },
};

export default function Page() {
  return (
    <ContentPage
      title="Educação financeira"
      intro="Poucos conceitos, escolhidos por um critério só: entender cada um deles muda alguma decisão prática."
    >
      <Section heading="Patrimônio e caixa não são a mesma coisa">
        <p>Caixa é o dinheiro disponível agora. Patrimônio é o que você tem menos o que deve.</p>
        <p>
          Pegar um empréstimo de R$ 10.000 aumenta o caixa em R$ 10.000 e não muda o patrimônio,
          porque nasce uma dívida do mesmo tamanho. É por isso que um empréstimo pode resolver um
          problema de caixa e, ao mesmo tempo, não melhorar nada de fundo.
        </p>
      </Section>

      <Section heading="Competência e caixa: quando o gasto é seu e quando o dinheiro sai">
        <p>
          Uma compra parcelada acontece hoje. O dinheiro sai ao longo de vários meses. O gasto
          pertence ao mês da compra; o desembolso pertence aos meses das parcelas.
        </p>
        <p>
          Confundir as duas visões leva a duas conclusões erradas simétricas: achar que se gasta
          pouco (porque só as parcelas aparecem) ou achar que se gastou duas vezes (porque compra e
          fatura foram contadas).
        </p>
      </Section>

      <Section heading="Amortização e juros">
        <p>
          Em uma parcela de empréstimo, uma parte reduz a dívida — amortização — e outra parte é o
          custo de ter tomado o dinheiro emprestado: juros, tarifas e seguros.
        </p>
        <p>
          Só a segunda parte é despesa de verdade. A amortização troca dinheiro por uma dívida
          menor, e não muda o patrimônio. Quem enxerga a parcela inteira como gasto conclui que está
          gastando mais do que gasta; quem enxerga tudo como amortização não percebe o custo de
          estar endividado.
        </p>
      </Section>

      <Section heading="Tabela Price e SAC">
        <p>
          Na <strong>Price</strong>, a parcela é constante do começo ao fim. No início, quase tudo é
          juros; ao longo do tempo, a amortização cresce.
        </p>
        <p>
          No <strong>SAC</strong>, a amortização é constante e a parcela vai diminuindo. A primeira
          parcela é mais pesada e o total de juros costuma ser menor.
        </p>
        <p>
          Não existe sistema melhor em abstrato. Existe o que cabe no seu orçamento nos primeiros
          meses.
        </p>
      </Section>

      <Section heading="CET: o número que compara de verdade">
        <p>
          A taxa de juros anunciada não inclui tarifas, seguros e outros custos. O Custo Efetivo
          Total inclui, e é o único número que permite comparar duas propostas de crédito de forma
          justa.
        </p>
        <p>
          Um empréstimo com juros menor e tarifas altas pode sair mais caro que outro com juros
          maior e sem tarifas. O CET revela isso; a taxa isolada, não.
        </p>
      </Section>

      <Section heading="Crédito rotativo">
        <p>
          Pagar menos que o total da fatura joga o restante para o rotativo, historicamente uma das
          linhas mais caras que existem no Brasil. A dívida cresce rápido e volta somada às compras
          do mês seguinte.
        </p>
        <p>
          Quando o rotativo já começou, trocá-lo por qualquer crédito mais barato costuma reduzir o
          custo — sem que isso resolva a causa, que continua sendo um mês que não fechou.
        </p>
      </Section>

      <Section heading="Reserva de emergência">
        <p>
          A função da reserva não é render. É evitar que um imprevisto se transforme em dívida cara.
          Uma reserva parada rendendo pouco pode economizar muito mais do que rende, ao impedir o
          uso do rotativo.
        </p>
        <p>
          O tamanho ideal varia com a estabilidade da renda. Mas qualquer reserva funciona melhor
          que nenhuma: mesmo R$ 500 já cobrem parte dos imprevistos comuns.
        </p>
      </Section>

      <Section heading="Sinais de que vale reavaliar">
        <Bullets
          items={[
            "As parcelas fixas consomem uma fatia crescente da renda a cada mês.",
            "A fatura do cartão é paga com empréstimo, ou com outro cartão.",
            "O saldo só fecha porque existe cheque especial.",
            "Uma despesa pequena e inesperada obriga a parcelar.",
            "Você não sabe dizer quanto deve, somando tudo.",
          ]}
        />
        <p>
          Nenhum desses sinais é um veredito sobre alguém. São indicadores de que a estrutura
          precisa mudar, e a primeira mudança possível é enxergar a situação inteira.
        </p>
      </Section>

      <Section heading="Uma observação necessária">
        <p>
          Este conteúdo é informativo. O Conta comigo não faz recomendação de investimentos nem de
          produtos financeiros, e não substitui a orientação de um profissional certificado.
        </p>
      </Section>
    </ContentPage>
  );
}

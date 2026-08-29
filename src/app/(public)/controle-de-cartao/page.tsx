import type { Metadata } from "next";
import { Bullets, ContentPage, Section } from "@/components/content-page";

export const metadata: Metadata = {
  title: "Controle de cartão de crédito: fechamento, vencimento e parcelas",
  description:
    "Como funcionam fechamento e vencimento, por que o limite disponível engana e como saber " +
    "quanto dos próximos meses já está comprometido com parcelas.",
  alternates: { canonical: "/controle-de-cartao" },
};

export default function Page() {
  return (
    <ContentPage
      title="Controle de cartão de crédito"
      intro="O cartão não é uma conta com dinheiro dentro. É uma dívida que se acumula durante o mês e é cobrada de uma vez."
    >
      <Section heading="Fechamento e vencimento não são a mesma data">
        <p>
          Todo cartão tem duas datas. O <strong>fechamento</strong> é o dia em que a fatura para de
          receber compras. O <strong>vencimento</strong> é o dia em que ela precisa ser paga.
        </p>
        <p>
          Um cartão que fecha dia 25 e vence dia 5: uma compra feita dia 24 entra na fatura que
          vence no dia 5 do mês seguinte. Uma compra feita dia 26 entra na fatura seguinte, ou seja,
          vence quase quarenta dias depois.
        </p>
        <p>
          Não é truque de esperto: é só o funcionamento do ciclo. Mas saber em qual fatura cada
          compra cai muda a conta do mês.
        </p>
      </Section>

      <Section heading="Limite disponível é a informação mais enganosa do cartão">
        <p>
          O limite que o aplicativo do banco mostra costuma considerar apenas o que já foi faturado.
          As parcelas dos próximos meses ainda não apareceram — mas o dinheiro já está comprometido.
        </p>
        <p>
          Se você comprou R$ 3.000 em 10 vezes, R$ 2.700 continuam sendo seus para pagar, ainda que
          o limite pareça mais livre a cada mês. Um controle honesto conta a parcela futura como
          compromisso desde o primeiro dia.
        </p>
      </Section>

      <Section heading="A armadilha da contagem dupla">
        <p>
          Um erro comum ao anotar gastos: registrar a compra quando ela acontece e registrar de novo
          quando a fatura é paga. O gasto vira o dobro do que foi.
        </p>
        <p>A separação correta tem dois lados:</p>
        <Bullets
          items={[
            "A compra é uma despesa, no mês em que aconteceu, pelo valor cheio.",
            "O pagamento da fatura é uma saída de dinheiro da conta, e não uma nova despesa.",
          ]}
        />
        <p>
          Assim, um mês em que você paga muitas parcelas antigas aparece como um mês de caixa
          apertado — que é o que ele é — e não como um mês de consumo alto, que ele não foi.
        </p>
      </Section>

      <Section heading="Parcelar não é sempre errado, mas nunca é neutro">
        <p>
          Parcelar sem juros transfere o custo para o futuro sem aumentá-lo. O problema aparece
          quando várias compras parceladas se sobrepõem: cada uma cabia sozinha, e a soma não cabe.
        </p>
        <p>
          Antes de parcelar, vale ver o total de parcelas já assumidas para cada um dos próximos
          seis meses. Se em algum deles a soma já preocupa, a nova parcela vai cair exatamente ali.
        </p>
      </Section>

      <Section heading="Pagamento mínimo e rotativo">
        <p>
          Pagar o mínimo da fatura transforma o restante em crédito rotativo, uma das linhas mais
          caras do mercado brasileiro. O que sobra vira dívida nova, com juros, e volta na fatura
          seguinte somada às compras do mês.
        </p>
        <p>
          Se o rotativo já começou, tratá-lo como dívida — com valor, prazo e parcela — é mais útil
          do que continuar olhando só a fatura do mês. Uma negociação parcelada quase sempre custa
          menos que o rotativo, ainda que a dívida continue existindo.
        </p>
      </Section>

      <Section heading="O que acompanhar todo mês">
        <Bullets
          items={[
            "Quanto a próxima fatura já acumulou.",
            "Quanto de cada um dos próximos seis meses já está tomado por parcelas.",
            "Quanto do limite está comprometido, contando parcelas futuras.",
            "Se alguma compra parcelada está chegando ao fim — e quanto isso libera por mês.",
          ]}
        />
      </Section>
    </ContentPage>
  );
}

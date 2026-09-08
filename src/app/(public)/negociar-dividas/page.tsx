import type { Metadata } from "next";
import { Bullets, ContentPage, Section } from "@/components/content-page";

export const metadata: Metadata = {
  title: "Como negociar dívidas com bancos e credores: roteiro prático e descontos",
  description:
    "Aprenda a negociar dívidas bancárias, aproveitar feirões (Serasa Limpa Nome, Desenrola), obter descontos de até 90% e nunca assinar um acordo que não cabe no seu orçamento.",
  alternates: { canonical: "/negociar-dividas" },
};

export default function Page() {
  return (
    <ContentPage
      title="Como negociar dívidas com bancos e credores"
      intro="Negociação não é pedir favor; é um processo comercial. Os credores sabem que é melhor receber parte do dinheiro do que não receber nada. Saiba como se posicionar com firmeza e inteligência."
    >
      <Section heading="1. A regra de ouro: nunca feche um acordo que você não pode pagar">
        <p>
          O erro mais comum ao negociar dívidas é aceitar a primeira contraproposta do banco apenas para
          aliviar a pressão psicológica e as ligações de cobrança. Se a parcela acordada consumir mais do que a
          sua sobra real no mês, você quebrará o acordo na segunda ou terceira parcela.
        </p>
        <p>
          Quebrar uma renegociação é pior do que a dívida original: você perde o valor de entrada pago,
          o desconto concedido é cancelado e os juros voltam a incidir sobre o montante total. Calcule antes
          exatamente quanto cabe no seu bolso.
        </p>
      </Section>

      <Section heading="2. Entenda a dinâmica do credor">
        <p>
          Os bancos provisionam perdas conforme o tempo de atraso. Quanto mais antiga a dívida (após 180 dias
          a 1 ano de atraso), maior a propensão da instituição em conceder grandes descontos sobre juros e multas
          para liquidar a pendência à vista ou em poucas parcelas.
        </p>
        <Bullets
          items={[
            "Até 60 dias de atraso: o banco tenta refinanciar com taxas ainda altas. Tenha calma.",
            "De 90 a 180 dias: a dívida costuma ir para assessorias de cobrança externas. A margem de desconto aumenta.",
            "Acima de 360 dias: ocorrem as maiores oportunidades em feirões oficiais, com abatimentos de até 80% ou 90% dos juros acumulados.",
          ]}
        />
      </Section>

      <Section heading="3. Feirões de renegociação: Serasa Limpa Nome e Desenrola Brasil">
        <p>
          Feirões periódicos promovidos pelo Serasa, SPC Brasil e programas governamentais como o Desenrola
          reúnem dezenas de instituições financeiras e concessionárias com condições pré-aprovadas.
        </p>
        <p>
          Antes de aceitar uma proposta em aplicativo, verifique se o valor corresponde à quitação total
          e se haverá termo de quitação após o pagamento do boleto. Exija sempre o contrato ou comprovante formal
          de encerramento da pendência.
        </p>
      </Section>

      <Section heading="4. Roteiro de conversa com o cobrador">
        <Bullets
          items={[
            "Mantenha a calma e o tom profissional. Cobradores usam pressão emocional para apressar uma decisão impulsiva.",
            "Diga claramente: 'Quero pagar, mas apenas pelo valor que cabe na minha realidade atual'.",
            "Peça o detalhamento da dívida: qual é o valor original (principal) e quanto é juro e multa.",
            "Proponha parcelas que não ultrapassem 15% a 20% da sua renda familiar livre.",
            "Se a proposta não for boa, agradeça e desligue: 'Nesse valor não posso me comprometer. Quando tiverem uma condição viável, entrem em contato'.",
          ]}
        />
      </Section>

      <Section heading="5. Pagou o acordo? Monitore a retirada da restrição">
        <p>
          Por lei (Código de Defesa do Consumidor e jurisprudência do STJ), após o pagamento da primeira parcela
          ou do valor total acordado, o credor tem até <strong>5 dias úteis</strong> para retirar seu nome dos
          cadastros de proteção ao crédito (Serasa, SPC, Boa Vista).
        </p>
        <p>
          Guarde o comprovante de pagamento e consulte seu extrato de CPF após o prazo. Caso o nome permaneça
          negativado, abra chamado no Procon ou pelo portal Consumidor.gov.br.
        </p>
      </Section>
    </ContentPage>
  );
}

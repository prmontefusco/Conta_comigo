import type { Metadata } from "next";
import { Bullets, ContentPage, Section } from "@/components/content-page";

export const metadata: Metadata = {
  title: "Controle de contas a pagar: vencimentos, atrasos e recorrência",
  description:
    "Como acompanhar boletos e contas fixas sem perder vencimentos, o que fazer com contas " +
    "atrasadas e por que uma conta paga com atraso continua pertencendo ao mês original.",
  alternates: { canonical: "/controle-de-contas" },
};

export default function Page() {
  return (
    <ContentPage
      title="Controle de contas a pagar"
      intro="Perder um vencimento raramente é esquecimento puro. Costuma ser falta de uma lista única, ordenada por data, com o valor ao lado."
    >
      <Section heading="Uma conta existe antes de ser paga">
        <p>
          A conta de energia que chega dia 5 e vence dia 15 já é um compromisso no dia 5. Nesses dez
          dias ela não aparece em extrato nenhum, mas o dinheiro já tem destino.
        </p>
        <p>
          Registrar compromissos, e não apenas pagamentos, é o que permite responder &quot;quanto
          ainda preciso este mês?&quot; em vez de só &quot;quanto já gastei?&quot;.
        </p>
      </Section>

      <Section heading="Contas que se repetem merecem uma regra, não um cadastro por mês">
        <p>
          Aluguel, internet, escola e plano de saúde acontecem todo mês. Cadastrar cada ocorrência à
          mão é trabalho garantido e esquecimento provável.
        </p>
        <p>
          Uma regra de recorrência descreve o padrão uma vez: valor, frequência e dia. A partir
          dela, os próximos doze meses aparecem na projeção automaticamente. Quando o valor mudar,
          muda-se a regra — e todos os meses futuros se ajustam.
        </p>
      </Section>

      <Section heading="Valor fixo e valor estimado">
        <p>
          Um aluguel de R$ 1.800 é R$ 1.800. Uma conta de energia é diferente todo mês. As duas
          entram na projeção, mas convém saber qual é qual.
        </p>
        <p>
          Marcar uma conta como estimada não a torna menos importante. Torna possível perguntar como
          ficaria o mês se as estimativas viessem mais altas do que o esperado.
        </p>
      </Section>

      <Section heading="Uma conta atrasada continua existindo">
        <p>
          Passar da data de vencimento não faz a conta desaparecer. Ela deveria continuar visível,
          com o valor original, até ser efetivamente paga — e continuar entrando no cálculo do que
          ainda precisa sair.
        </p>
        <p>
          Sistemas que arquivam automaticamente o que venceu produzem uma projeção otimista e
          errada, justo no momento em que a informação correta mais importa.
        </p>
      </Section>

      <Section heading="Pagou em outro mês, mas a conta é do mês dela">
        <p>
          Uma conta de agosto paga em setembro é uma despesa de agosto que saiu do caixa de
          setembro. As duas informações são verdadeiras e servem a perguntas diferentes:
        </p>
        <Bullets
          items={[
            "Para saber quanto agosto custou: a conta pertence a agosto.",
            "Para saber o que saiu da conta em setembro: o pagamento pertence a setembro.",
          ]}
        />
        <p>
          Guardar as duas datas separadas — competência e pagamento — evita que um mês pareça barato
          e o seguinte, caríssimo, só porque um boleto atrasou.
        </p>
      </Section>

      <Section heading="Pagamento parcial é normal">
        <p>
          Acordos, negociações e pagamentos em duas partes acontecem. O saldo restante precisa
          continuar visível, senão a conta desaparece do radar com dinheiro ainda em aberto.
        </p>
      </Section>

      <Section heading="Uma rotina que se sustenta">
        <Bullets
          items={[
            "Uma vez por semana: olhar o que vence nos próximos sete dias.",
            "Ao receber um boleto: registrar na hora, com valor e vencimento.",
            "Ao pagar: marcar como pago, informando de qual conta saiu.",
            "Uma vez por mês: conferir se as recorrências ainda têm os valores certos.",
          ]}
        />
        <p>
          São poucos minutos por semana. O que torna esse hábito sustentável não é disciplina, é a
          lista estar sempre no mesmo lugar e ordenada por urgência.
        </p>
      </Section>
    </ContentPage>
  );
}

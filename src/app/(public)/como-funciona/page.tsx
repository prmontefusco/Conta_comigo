import type { Metadata } from "next";
import { Bullets, ContentPage, Section } from "@/components/content-page";

export const metadata: Metadata = {
  title: "Como funciona",
  description:
    "O Conta comigo separa o que já aconteceu, o que está acontecendo e o que vai acontecer, " +
    "e combina os três para responder quanto você tem, quanto já comprometeu e o que sobra.",
  alternates: { canonical: "/como-funciona" },
};

export default function Page() {
  return (
    <ContentPage
      title="Como funciona"
      intro="A ideia é simples de dizer e difícil de fazer: mostrar a sua situação financeira sem distorcer nenhum número pelo caminho."
    >
      <Section heading="Três tempos, não um">
        <p>
          A maioria dos aplicativos financeiros mostra apenas o passado: o que você gastou. Isso
          responde &quot;o que aconteceu?&quot;, mas não responde &quot;o que vai acontecer?&quot; —
          que é a pergunta que tira o sono.
        </p>
        <p>O Conta comigo trabalha com três dimensões ao mesmo tempo:</p>
        <Bullets
          items={[
            "Passado: receitas recebidas, contas pagas, transferências, faturas quitadas.",
            "Presente: saldo das contas, o que está pendente, o que já venceu, quanto está reservado.",
            "Futuro: salários previstos, contas recorrentes, parcelas, faturas, empréstimos e obrigações eventuais.",
          ]}
        />
        <p>
          O valor não está em nenhuma delas isolada. Está na combinação: partindo do saldo de hoje,
          somando o que entra e subtraindo o que já está comprometido, chega-se ao saldo projetado
          de cada dia e de cada mês.
        </p>
      </Section>

      <Section heading="Compromisso e movimentação são coisas diferentes">
        <p>
          Uma conta de energia que vence dia 15 é um compromisso. O pagamento dela, no dia 15, é uma
          movimentação. Guardar essas duas coisas separadas é o que permite responder &quot;quanto
          ainda preciso pagar este mês?&quot; sem confundir com &quot;quanto já paguei?&quot;.
        </p>
        <p>
          Quando você registra o pagamento, o compromisso é quitado e a movimentação é criada,
          ligadas uma à outra. Nunca as duas contam como gasto.
        </p>
      </Section>

      <Section heading="Quando o dinheiro sai e quando o gasto acontece">
        <p>
          Uma compra de R$ 1.200 em 6 vezes no cartão acontece hoje, mas o dinheiro sai ao longo de
          seis meses. São duas verdades diferentes, e o aplicativo mostra as duas:
        </p>
        <Bullets
          items={[
            "Visão de consumo: a compra pertence ao mês em que foi feita, com o valor cheio.",
            "Visão de caixa: R$ 200 saem da conta em cada um dos seis meses seguintes, na data de vencimento da fatura.",
          ]}
        />
        <p>
          Pagar a fatura não gera uma segunda despesa. Se gerasse, um mês com muitas parcelas
          antigas apareceria como se você tivesse gasto duas vezes.
        </p>
      </Section>

      <Section heading="Saldo total e saldo livre">
        <p>
          Ter R$ 10.000 na conta e ter R$ 10.000 disponíveis são situações diferentes. Se R$ 6.000
          estão reservados para emergências e R$ 2.500 são contas que vencem esta semana, o valor
          com que você pode contar é R$ 1.500.
        </p>
        <p>
          O aplicativo mostra os três números lado a lado, sempre. Ver só o saldo bancário é o
          caminho mais curto para gastar dinheiro que já tinha dono.
        </p>
      </Section>

      <Section heading="Simulações antes da decisão">
        <p>
          Antes de parcelar uma compra, contratar uma despesa fixa ou marcar uma viagem, dá para
          perguntar ao próprio orçamento. A simulação usa exatamente o mesmo cálculo da projeção
          real e mostra como ficariam os próximos meses.
        </p>
        <p>
          O resultado é sempre descritivo: quanto sobraria, em que mês faltaria, de quanto seria a
          diferença. O aplicativo não diz se você deve ou não fazer. Essa parte é sua.
        </p>
      </Section>

      <Section heading="Começar leva poucos minutos">
        <Bullets
          items={[
            "Crie sua conta e o seu grupo (pode ser só você).",
            "Informe onde seu dinheiro está e quanto tem em cada lugar.",
            "Cadastre sua renda principal.",
            "Cadastre as contas que se repetem todo mês.",
            "Depois, quando quiser, acrescente cartões, dívidas e reservas.",
          ]}
        />
        <p>
          Com as três primeiras etapas a projeção já começa a fazer sentido. O restante pode vir aos
          poucos.
        </p>
      </Section>
    </ContentPage>
  );
}

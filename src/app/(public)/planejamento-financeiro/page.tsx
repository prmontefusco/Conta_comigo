import type { Metadata } from "next";
import { Bullets, ContentPage, Section } from "@/components/content-page";

export const metadata: Metadata = {
  title: "Planejamento financeiro: o que é projetar e por que funciona",
  description:
    "Projeção financeira não é adivinhação. É aritmética sobre compromissos que já existem — " +
    "e é ela que revela, com meses de antecedência, o mês em que as contas não fecham.",
  alternates: { canonical: "/planejamento-financeiro" },
};

export default function Page() {
  return (
    <ContentPage
      title="Planejamento financeiro: o que é projetar e por que funciona"
      intro="Projetar não é tentar adivinhar o futuro. É somar o que já está contratado e ver onde isso leva."
    >
      <Section heading="A maior parte do seu futuro já está decidida">
        <p>
          Se você tem aluguel, escola, plano de saúde, uma parcela de financiamento e três compras
          parceladas no cartão, boa parte dos próximos doze meses já está definida. Não é previsão:
          é contrato.
        </p>
        <p>
          Uma projeção honesta parte disso. Ela não tenta imaginar quanto você vai gastar em lazer
          no ano que vem; ela mostra o que já está comprometido e quanto espaço resta.
        </p>
      </Section>

      <Section heading="Como o cálculo é feito">
        <p>A conta é a mesma, dia a dia:</p>
        <p className="rounded-lg border border-[color:var(--card-border)] p-4 text-sm leading-relaxed">
          saldo de ontem
          <br />+ receitas previstas para hoje
          <br />− contas, parcelas, faturas e obrigações que vencem hoje
          <br />= saldo projetado de hoje
        </p>
        <p>
          Repetindo isso por 365 dias, aparecem duas informações que nenhum extrato mostra: o menor
          saldo do período e a data em que ele acontece.
        </p>
      </Section>

      <Section heading="Os horizontes que importam">
        <Bullets
          items={[
            "7 e 15 dias: as contas mais urgentes. Serve para decidir a semana.",
            "30 dias e o resto do mês: se o mês fecha, e com quanto.",
            "3 meses: onde a maioria dos apertos aparece pela primeira vez.",
            "6 e 12 meses: o efeito de parcelamentos longos e o momento em que eles terminam.",
          ]}
        />
        <p>
          Uma situação pode parecer tranquila em sete dias e apertada em noventa. A diferença entre
          esses dois números costuma ser exatamente a informação que faltava.
        </p>
      </Section>

      <Section heading="Certeza não é tudo igual">
        <p>
          Um aluguel contratado e uma comissão variável não merecem o mesmo peso. Marcar valores
          como confirmados ou estimados permite fazer a pergunta mais útil de todas:{" "}
          <em>e se só o que é certo acontecer?</em>
        </p>
        <p>
          Se o mês fecha considerando apenas o que é garantido, você tem folga real. Se só fecha
          contando com o que é incerto, o plano é mais frágil do que parece.
        </p>
      </Section>

      <Section heading="Déficit em um mês não é falência">
        <p>
          Um mês fechar negativo significa que, naquele mês, os compromissos passam das receitas. Se
          houve sobra acumulada nos meses anteriores, o saldo pode continuar positivo — o mês fica
          apertado, não impossível.
        </p>
        <p>
          Por isso vale olhar duas coisas ao mesmo tempo: o resultado de cada mês e o saldo
          projetado ao longo do tempo. Só o primeiro assusta demais; só o segundo esconde o aperto.
        </p>
      </Section>

      <Section heading="Perguntar antes, não depois">
        <p>
          A projeção fica realmente útil quando aceita perguntas: e se eu parcelar isso em dez
          vezes? e se aparecer uma despesa fixa de R$ 700? e se minha renda cair 20% por seis meses?
        </p>
        <p>
          Cada resposta é um conjunto de números e datas. O que fazer com eles continua sendo uma
          decisão sua, tomada com informação em vez de na esperança.
        </p>
      </Section>
    </ContentPage>
  );
}

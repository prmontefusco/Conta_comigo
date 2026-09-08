import type { Metadata } from "next";
import Link from "next/link";
import { Bullets, ContentPage, Section } from "@/components/content-page";
import { JsonLd, buildArticleSchema, buildFaqSchema } from "@/lib/json-ld";

export const metadata: Metadata = {
  title: "Lei do Superendividamento (Lei 14.181/2021): seus direitos e renegociação em bloco",
  description:
    "Conheça a Lei 14.181/2021, o direito à preservação do Mínimo Existencial, a repactuação conjunta de dívidas na Justiça ou Procon e como sair do endividamento crônico.",
  alternates: { canonical: "/lei-do-superendividamento" },
  keywords: [
    "lei do superendividamento",
    "lei 14181",
    "superendividamento como funciona",
    "renegociação em bloco de dívidas",
    "mínimo existencial lei",
    "defensoria pública superendividamento",
    "procon superendividamento",
  ],
};

const FAQS = [
  {
    question: "O que é considerado superendividamento pela Lei 14.181/2021?",
    answer:
      "É a impossibilidade manifesta de o consumidor de boa-fé pagar todas as suas dívidas sem comprometer o sustento básico (mínimo existencial) para moradia, alimentação e saúde de sua família.",
  },
  {
    question: "O que é o Mínimo Existencial garantido por lei?",
    answer:
      "É a quantia mensal protegida pelo Código de Defesa do Consumidor e pelo Decreto nº 11.567/2023 que não pode ser confiscada nem retida por bancos para quitar parcelas de empréstimos.",
  },
  {
    question: "Como funciona a repactuação em bloco das dívidas?",
    answer:
      "O consumidor reúne todos os seus credores em uma única audiência de conciliação para propor um plano de pagamento em até 5 anos (60 meses), pedindo a suspensão de encargos de mora e prazos justos.",
  },
  {
    question: "Onde solicitar a renegociação da Lei do Superendividamento gratuitamente?",
    answer:
      "Nos núcleos de atendimento ao superendividado da Defensoria Pública (NUDECON), nos Procons municipais e estaduais ou nos CEJUSCs dos Tribunais de Justiça.",
  },
];

export default function Page() {
  return (
    <>
      <JsonLd
        data={buildArticleSchema({
          title: "Lei do Superendividamento: a lei que protege sua sobrevivência",
          description:
            "Como funciona a Lei 14.181/2021, proteção do Mínimo Existencial e repactuação de dívidas em bloco.",
          urlPath: "/lei-do-superendividamento",
        })}
      />
      <JsonLd data={buildFaqSchema(FAQS)} />

      <ContentPage
        title="Lei do Superendividamento: a lei que protege sua sobrevivência"
        intro="A Lei nº 14.181/2021 atualizou o Código de Defesa do Consumidor para criar um mecanismo legal que permite a pessoas de boa-fé renegociarem todas as suas dívidas de uma só vez, garantindo dinheiro para comer e morar."
      >
        <Section heading="1. O que é considerado superendividamento?">
          <p>
            A lei define superendividamento como a impossibilidade manifesta de o consumidor pessoa física,
            de boa-fé, pagar a totalidade de suas dívidas de consumo, exigíveis e vincendas, sem comprometer seu
            <strong> mínimo existencial</strong>.
          </p>
          <p>
            Aplica-se a quem contraiu empréstimos, faturas de cartão, crediários e contas de consumo para uso próprio
            ou familiar e que, por desemprego, doença, divórcio ou redução de renda, não consegue mais fechar as contas.
            A lei não protege dívidas contraídas com dolo ou má-fé (como fraudes deliberadas).
          </p>
        </Section>

        <Section heading="2. O que é o 'Mínimo Existencial'?">
          <p>
            O conceito de mínimo existencial (regulamentado pelo Decreto nº 11.567/2023) estabelece uma quantia mensal
            da renda da pessoa que <strong>não pode ser penhorada nem tomada por bancos</strong> para pagamento de dívidas.
          </p>
          <p>
            Os bancos não podem debitar parcelas de consignado ou empréstimos na sua conta a ponto de deixá-lo
            sem dinheiro para alimentação, medicamentos, água e moradia. Veja detalhadamente em nosso artigo sobre{" "}
            <Link href="/minimo-existencial" className="text-teal-700 underline font-medium">
              como calcular e proteger seu Mínimo Existencial
            </Link>.
          </p>
        </Section>

        <Section heading="3. Como funciona a Repactuação em Bloco (Plano de Pagamento)">
          <p>
            Em vez de negociar isoladamente com 5 bancos diferentes enquanto cada um cobra juros abusivos, a lei permite
            reunir <em>todos os credores em uma única audiência de conciliação</em>:
          </p>
          <Bullets
            items={[
              "O consumidor apresenta sua renda real, seus custos básicos essenciais e a relação completa de dívidas.",
              "É apresentado um Plano de Pagamento com prazo de até 5 anos (60 meses) para quitação de todos os débitos.",
              "Pede-se a suspensão dos juros de mora e a extensão do prazo para que a parcela caiba na sobra do salário.",
              "O credor que não comparecer à audiência sem justificativa tem a cobrança de sua dívida suspensa e fica no fim da fila de recebimento.",
            ]}
          />
          <p className="mt-3">
            Para saber como formalizar essa petição, acesse o guia prático da{" "}
            <Link href="/acao-de-repactuacao-de-dividas" className="text-teal-700 underline font-medium">
              Ação de Repactuação de Dívidas passo a passo
            </Link>.
          </p>
        </Section>

        <Section heading="4. Como provar a situação para o Juiz sem ter o pedido negado">
          <p>
            Um dos maiores motivos de indeferimento de pedidos na Justiça é a falta de discriminação dos gastos essenciais.
            Juízes costumam rejeitar a liminar se o extrato bancário trouxer assinaturas ou gastos sem a prova de que já foram cancelados.
            Confira o nosso passo a passo completo sobre{" "}
            <Link href="/como-provar-superendividamento" className="text-teal-700 underline font-medium">
              como provar superendividamento na Justiça e demonstrar cortes reais
            </Link>.
          </p>
        </Section>

        <Section heading="5. Onde buscar ajuda gratuita?">
          <p>Você não precisa contratar advogados caros para ter acesso aos benefícios da lei. Procure:</p>
          <Bullets
            items={[
              "Defensoria Pública do seu Estado (Núcleo de Defesa do Consumidor - NUDECON).",
              "Procons estaduais e municipais que já contam com o Núcleo de Tratamento do Superendividamento.",
              "Centros Judiciários de Solução de Conflitos e Cidadania (CEJUSC) dos Tribunais de Justiça.",
            ]}
          />
        </Section>
      </ContentPage>
    </>
  );
}

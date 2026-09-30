import type { Metadata } from "next";
import { Bullets, Callout, ContentPage, Section, Steps } from "@/components/content-page";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Alugar ou comprar imóvel: como decidir com números",
  description:
    "Guia para comparar aluguel e compra considerando juros, entrada, custos de transação, manutenção, mobilidade e prazo de permanência.",
  path: "/alugar-ou-comprar-imovel",
});

export default function Page() {
  return (
    <ContentPage
      title="Alugar ou comprar: a resposta depende da sua vida"
      intro="Aluguel compra o direito de morar; juros, impostos, seguro e manutenção também são custos de morar. A decisão correta compara cenários completos — não apenas aluguel contra parcela."
    >
      <Callout title="Pagar aluguel não é jogar dinheiro fora">
        <p>
          O aluguel paga uso, localização e flexibilidade. Na compra, parte da parcela amortiza a
          dívida e vira patrimônio, mas juros e vários custos não retornam. Nenhuma opção vence em
          todos os casos.
        </p>
      </Callout>

      <Section heading="1. Custos que entram na conta">
        <div className="grid gap-3 sm:grid-cols-2">
          <Callout title="Ao alugar">
            <p>
              Aluguel, seguro-fiança ou garantia, condomínio, mudanças e eventuais reajustes.
              Confirme no contrato quem paga IPTU e despesas específicas.
            </p>
          </Callout>
          <Callout title="Ao comprar" tone="warning">
            <p>
              Entrada, juros e seguros do financiamento, ITBI, escritura/registro, condomínio, IPTU,
              manutenção, reformas e custo de vender depois.
            </p>
          </Callout>
        </div>
      </Section>

      <Section heading="2. Compare o mesmo imóvel e o mesmo prazo">
        <Steps
          items={[
            {
              title: "Colete valores reais",
              body: "Use aluguel e preço de venda de imóveis equivalentes no mesmo bairro.",
            },
            {
              title: "Obtenha o CET",
              body: "Simule entrada, prazo, sistema de amortização, seguros e tarifas no banco.",
            },
            {
              title: "Inclua custos invisíveis",
              body: "Projete manutenção, documentação, reajustes e o rendimento líquido da entrada se ela fosse investida.",
            },
            {
              title: "Compare o patrimônio",
              body: "No fim do prazo, compare imóvel menos saldo devedor com os investimentos do cenário de aluguel.",
            },
          ]}
        />
      </Section>

      <Section heading="3. O tempo muda a decisão">
        <p>
          Comprar costuma exigir custos altos logo na entrada e na futura venda. Quanto menor a
          permanência, menos tempo existe para diluí-los. Se trabalho, cidade ou tamanho da família
          podem mudar em poucos anos, a flexibilidade do aluguel tem valor financeiro.
        </p>
        <p>
          Permanência longa, renda estável e desejo de adaptar o imóvel favorecem a compra — desde
          que ela não destrua a reserva nem deixe o orçamento vulnerável.
        </p>
      </Section>

      <Section heading="4. Perguntas que os números não respondem sozinhos">
        <Bullets
          items={[
            "Você pretende ficar na mesma cidade e no mesmo imóvel por vários anos?",
            "A entrada preserva sua reserva de emergência e outras metas importantes?",
            "Você tolera reformas, manutenção e menor mobilidade?",
            "O orçamento suporta juros ou reajustes sem depender de renda incerta?",
            "A compra é uma decisão de moradia ou uma tentativa de acompanhar pressão familiar?",
          ]}
        />
      </Section>

      <Section heading="5. Regra de segurança">
        <Callout title="Não decida pela primeira parcela" tone="success">
          <p>
            Peça a evolução completa do saldo devedor e das parcelas, especialmente em contratos
            indexados. Faça três cenários — favorável, provável e apertado — e escolha uma opção que
            continue sustentável no cenário apertado.
          </p>
        </Callout>
      </Section>
    </ContentPage>
  );
}

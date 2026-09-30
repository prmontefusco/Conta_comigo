import type { Metadata } from "next";
import { Bullets, Callout, ContentPage, Section, Steps } from "@/components/content-page";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Carro novo ou usado: como comparar o custo total",
  description:
    "Compare carro novo, usado e financiamento considerando CET, depreciação, seguro, manutenção e custo de oportunidade.",
  path: "/carro-novo-ou-usado",
});

export default function Page() {
  return (
    <ContentPage
      title="Carro novo ou usado: compare além da parcela"
      intro="A melhor escolha não nasce de uma frase pronta. Ela depende do custo total, da segurança que o carro oferece, da sua necessidade real e do que a compra faz com o restante do orçamento."
    >
      <Callout title="A comparação viral pode enganar" tone="warning">
        <p>
          Comparar quem financia um carro novo com quem compra um usado muito mais barato e investe
          a diferença mistura dois padrões de consumo. É uma reflexão útil, mas não prova que todo
          carro zero “mantém alguém pobre”. Compare veículos que atendam à mesma necessidade e use
          taxas e custos reais.
        </p>
      </Callout>

      <Section heading="1. Some o custo total, não só a prestação">
        <Bullets
          items={[
            "Entrada e parcelas, usando o CET — Custo Efetivo Total — da proposta, não apenas a taxa anunciada.",
            "Seguro, IPVA, licenciamento, combustível, estacionamento e revisões.",
            "Manutenção provável, pneus e uma margem para reparos no usado.",
            "Depreciação: a diferença estimada entre o preço de compra e o valor de revenda.",
            "Custo de oportunidade: quanto a entrada e as parcelas poderiam render ou ajudar em outras metas.",
          ]}
        />
      </Section>

      <Section heading="2. Faça uma comparação justa">
        <Steps
          items={[
            {
              title: "Defina a necessidade",
              body: "Liste segurança, espaço, uso mensal e confiabilidade de que você realmente precisa.",
            },
            {
              title: "Escolha o mesmo horizonte",
              body: "Calcule as duas opções pelo mesmo período, como 48 ou 60 meses.",
            },
            {
              title: "Projete todos os custos",
              body: "Use cotações de seguro, CET, consumo e manutenção para o seu perfil e cidade.",
            },
            {
              title: "Estime o patrimônio final",
              body: "Subtraia dívidas pendentes e some o valor provável de revenda e o dinheiro investido.",
            },
          ]}
        />
      </Section>

      <Section heading="3. Quando o financiamento merece cautela">
        <p>
          Se a entrada consumir sua reserva, se a parcela apertar meses ruins ou se o CET superar
          com folga o rendimento líquido e seguro do seu dinheiro, financiar tende a custar caro. A
          prestação também não termina no boleto: o carro passa a criar despesas mensais.
        </p>
        <Callout title="Teste de resistência">
          <p>
            Simule o orçamento com renda 20% menor e uma manutenção inesperada. Se a conta depender
            do cartão ou do cheque especial, o carro ainda não cabe com segurança.
          </p>
        </Callout>
      </Section>

      <Section heading="4. Novo e usado têm vantagens reais">
        <div className="grid gap-3 sm:grid-cols-2">
          <Callout title="Carro novo">
            <p>
              Mais previsibilidade, garantia e tecnologia; em troca, costuma exigir mais capital e
              sofrer depreciação relevante nos primeiros anos.
            </p>
          </Callout>
          <Callout title="Carro usado" tone="success">
            <p>
              Menor preço de entrada e possível depreciação mais lenta; exige laudo cautelar,
              histórico, inspeção e reserva para manutenção.
            </p>
          </Callout>
        </div>
      </Section>

      <Section heading="5. Checklist antes de assinar">
        <Bullets
          items={[
            "Peça o CET, o valor total financiado e a soma de todas as parcelas por escrito.",
            "Consulte seguro e impostos antes de escolher o modelo.",
            "No usado, verifique documentação, recall, histórico e faça avaliação independente.",
            "Não use toda a reserva na entrada; preserve dinheiro para emergências.",
            "Compare com alternativas: transporte por aplicativo, aluguel eventual ou adiar a troca.",
          ]}
        />
      </Section>
    </ContentPage>
  );
}

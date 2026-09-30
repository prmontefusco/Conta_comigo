import type { Metadata } from "next";
import { Bullets, Callout, ContentPage, Section, Steps } from "@/components/content-page";
import { buildPageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPageMetadata({
  title: "Como cuidar dos primeiros R$ 1.000",
  description:
    "Passo a passo para usar os primeiros R$ 1.000: quitar dívida cara, formar reserva, estudar e só então diversificar investimentos.",
  path: "/como-investir-primeiros-1000-reais",
});

export default function Page() {
  return (
    <ContentPage
      title="Seus primeiros R$ 1.000: qual é o próximo passo?"
      intro="Não existe uma divisão universal entre livros, reserva e bolsa. Antes de escolher um investimento, descubra qual problema esses R$ 1.000 precisam resolver na sua vida."
    >
      <Section heading="1. Siga esta ordem de decisão">
        <Steps
          items={[
            {
              title: "Proteja o básico",
              body: "Separe o necessário para contas essenciais que vencem antes da próxima renda.",
            },
            {
              title: "Ataque dívida cara",
              body: "Rotativo e cheque especial geralmente custam muito mais do que investimentos conservadores rendem.",
            },
            {
              title: "Crie uma minirreserva",
              body: "Busque primeiro um colchão de R$ 500 a R$ 1.000 para pequenos imprevistos.",
            },
            {
              title: "Amplie e diversifique",
              body: "Depois da reserva e com horizonte longo, estude alternativas compatíveis com seu perfil.",
            },
          ]}
        />
      </Section>

      <Section heading="2. Onde guardar a reserva">
        <p>
          Reserva de emergência pede segurança, liquidez e simplicidade. Compare rendimento líquido,
          prazo de resgate, tributação, carência, taxas e garantias. Tesouro Selic e CDB com
          liquidez diária são exemplos comuns para estudar, mas não são equivalentes e podem ter
          horários, prazos e riscos diferentes.
        </p>
        <Callout title="Atenção à liquidez">
          <p>
            “Liquidez diária” não significa necessariamente dinheiro disponível a qualquer hora,
            inclusive em fins de semana. Confira quando o resgate cai na conta e mantenha uma
            pequena parcela de acesso imediato se suas emergências não puderem esperar.
          </p>
        </Callout>
      </Section>

      <Section heading="3. Conhecimento também é investimento — com critério">
        <p>
          Você não precisa gastar R$ 200 em livros para começar. Bibliotecas, materiais oficiais e
          cursos gratuitos podem ensinar orçamento, juros, inflação, risco e golpes. Pague por
          conteúdo apenas quando ele tiver objetivo claro e fonte confiável; desconfie de fórmulas
          de riqueza e urgência para comprar.
        </p>
      </Section>

      <Section heading="4. E os ETFs e a bolsa?">
        <p>
          Fundos de índice podem diversificar uma carteira, mas os preços oscilam e você pode
          precisar vender com prejuízo. Eles não substituem a reserva. Antes de investir, entenda o
          índice, as taxas, a tributação, a moeda envolvida, o prazo e a sua capacidade emocional de
          ver quedas.
        </p>
        <Bullets
          items={[
            "Dinheiro para usar em breve não combina com oscilações fortes.",
            "Um código de negociação não é uma recomendação: leia o regulamento e compare alternativas.",
            "Diversificar reduz riscos específicos, mas não elimina perdas.",
            "Aportes recorrentes e custos baixos costumam importar mais que tentar acertar o melhor dia.",
          ]}
        />
      </Section>

      <Section heading="5. Três exemplos possíveis">
        <div className="space-y-3">
          <Callout title="Com dívida no rotativo" tone="warning">
            <p>
              Use o dinheiro para contas essenciais e para reduzir ou negociar a dívida. Investir
              enquanto a dívida cresce tende a piorar o patrimônio.
            </p>
          </Callout>
          <Callout title="Sem dívida e sem reserva">
            <p>
              Priorize a minirreserva; depois, aumente-a gradualmente conforme sua estabilidade de
              renda e seus custos essenciais.
            </p>
          </Callout>
          <Callout title="Reserva completa e meta distante" tone="success">
            <p>
              Estude diversificação e risco. Escolha produtos pelo objetivo e pelo prazo, não por
              uma lista pronta da internet.
            </p>
          </Callout>
        </div>
      </Section>

      <Section heading="Uma observação necessária">
        <p>
          Este conteúdo é educativo e não é recomendação individual de investimento. Rentabilidade,
          tributação e regras podem mudar; confirme as condições nas fontes oficiais antes de
          decidir.
        </p>
      </Section>
    </ContentPage>
  );
}

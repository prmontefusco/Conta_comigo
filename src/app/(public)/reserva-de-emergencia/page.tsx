import type { Metadata } from "next";
import { Bullets, ContentPage, Section } from "@/components/content-page";

export const metadata: Metadata = {
  title: "Reserva de emergência: o que é, onde guardar e como montar a sua",
  description:
    "Descubra como construir um fundo de emergência passo a passo, quanto guardar de acordo com a sua profissão e critérios seguros para proteger seu dinheiro.",
  alternates: { canonical: "/reserva-de-emergencia" },
};

export default function Page() {
  return (
    <ContentPage
      title="Reserva de emergência: seu escudo financeiro"
      intro="A função da reserva de emergência não é gerar lucro ou enriquecer. É comprar tranquilidade e evitar que qualquer imprevisto da vida se transforme em uma bola de neve de dívidas com juros altos."
    >
      <Section heading="1. O que realmente é uma reserva de emergência?">
        <p>
          A reserva de emergência é um montante financeiro reservado exclusivamente para imprevistos inevitáveis:
          uma demissão repentina, problemas de saúde, consertos urgentes no carro ou na casa, ou queda temporária
          no faturamento de quem trabalha por conta própria.
        </p>
        <p>
          Quando surge uma emergência e não há reserva, a única saída imediata costuma ser o cheque especial,
          o rotativo do cartão ou empréstimos pessoais caros — começando um ciclo de endividamento.
        </p>
      </Section>

      <Section heading="2. Quanto guardar? A regra dos meses">
        <p>O tamanho ideal da reserva depende diretamente da estabilidade da sua fonte de renda:</p>
        <Bullets
          items={[
            "Funcionários públicos estatutários: de 3 a 6 meses do custo de vida essencial (alta estabilidade no emprego).",
            "Trabalhadores CLT em setores consolidados: 6 meses do custo de vida essencial (tempo médio para recolocação).",
            "Autônomos, MEIs, freelancers e empresários: de 9 a 12 meses do custo de vida essencial (alta volatilidade de faturamento e ausência de FGTS).",
          ]}
        />
        <p>
          Atenção: o cálculo deve ser baseado no seu <strong>custo de vida essencial</strong> (moradia, comida,
          saúde e contas básicas), e não nos seus gastos supérfluos totais.
        </p>
      </Section>

      <Section heading="3. Como começar quando sobra pouco no mês?">
        <p>
          Não espere sobrar muito dinheiro para começar. O hábito de guardar é mais importante que o valor inicial.
          Quem guarda R$ 30, R$ 50 ou R$ 100 com consistência constrói o primeiro degrau.
        </p>
        <Bullets
          items={[
            "Meta 1: Junte seus primeiros R$ 500 a R$ 1.000. Isso já cobre 80% das pequenas emergências domésticas e médicas.",
            "Meta 2: Alcance 1 mês do custo essencial.",
            "Meta 3: Expanda progressivamente até atingir a meta completa de 6 ou mais meses.",
          ]}
        />
      </Section>

      <Section heading="4. Critérios para escolher onde guardar">
        <p>
          O Conta comigo não indica produtos específicos nem intermediários, mas existem três critérios
          fundamentais que qualquer lugar para guardar a reserva precisa respeitar:
        </p>
        <Bullets
          items={[
            "Liquidez diária (imediata): você precisa conseguir resgatar o dinheiro no mesmo dia ou no dia útil seguinte, sem carência.",
            "Baixíssimo risco de perda: o valor principal não pode oscilar negativamente. Se você guardou R$ 1.000, não pode encontrar R$ 950 amanhã.",
            "Facilidade de acesso separada da conta do dia a dia: mantenha a reserva em uma conta ou aplicação separada da sua conta corrente comum, para não gastar sem perceber.",
          ]}
        />
      </Section>

      <Section heading="5. Quando usar e quando NÃO usar a reserva">
        <p>
          A reserva existe para ser usada quando a vida real exigir. Não tenha culpa se precisar resgatar o dinheiro
          para uma urgência legítima — comemore o fato de ter tido o dinheiro e não ter entrado em dívida!
        </p>
        <p>
          O que <strong>não</strong> é emergência: promoções de passagens aéreas, compras de Natal, troca de celular
          que ainda funciona ou jantares fora. Para esses objetivos, crie reservas específicas com outros nomes.
        </p>
      </Section>
    </ContentPage>
  );
}

import type { Metadata } from "next";
import { Bullets, ContentPage, Section } from "@/components/content-page";

export const metadata: Metadata = {
  title: "Corte inteligente de gastos: economize sem perder a dignidade e a qualidade de vida",
  description:
    "Como identificar ralos invisíveis de dinheiro, renegociar contratos fixos (telecom, tarifas, energia) e cortar despesas com estratégia e sustentabilidade.",
  alternates: { canonical: "/corte-inteligente-de-gastos" },
};

export default function Page() {
  return (
    <ContentPage
      title="Corte inteligente de gastos: estratégia sem sofrimento"
      intro="Cortar gastos não significa viver de pão e água nem abrir mão de tudo o que traz alegria. O corte inteligente elimina o desperdício invisível para que sobre dinheiro para o que realmente importa."
    >
      <Section heading="1. O perigo dos cortes cegos">
        <p>
          Quando as pessoas entram em pânico financeiro, o primeiro reflexo é cortar pequenos prazeres:
          o cafezinho na padaria, a assinatura do canal que assiste com os filhos ou o passeio no parque.
        </p>
        <p>
          O resultado: a economia real é de R$ 50 ou R$ 100 no mês, mas o custo emocional é gigantesco.
          A pessoa se sente miserável, desiste do orçamento na terceira semana e tem uma crise de consumo compensatório.
          Em vez de cortar o cafezinho, corte os <strong>ralos estruturais invisíveis</strong>.
        </p>
      </Section>

      <Section heading="2. Os três grandes blocos de despesas">
        <p>
          Em qualquer família, cerca de 70% a 80% do dinheiro vai embora em três áreas: moradia, transporte
          e alimentação. É nelas que uma negociação de 10% faz a diferença de centenas de reais todos os meses.
        </p>
        <Bullets
          items={[
            "Moradia: negocie o aluguel no aniversário do contrato, reduza o consumo elétrico no chuveiro (maior vilão) e troque lâmpadas por LED.",
            "Transporte: faça as contas reais de manter um segundo carro na garagem (IPVA, seguro, manutenção, combustível e depreciação) versus usar transporte por aplicativo ou público.",
            "Alimentação: o desperdício na geladeira é dinheiro no lixo. Planeje o cardápio da semana antes de ir ao supermercado e nunca vá às compras com fome.",
          ]}
        />
      </Section>

      <Section heading="3. A caça aos 'vampiros invisíveis'">
        <p>Examine o extrato bancário dos últimos 3 meses procurando por:</p>
        <Bullets
          items={[
            "Tarifas bancárias e pacotes de serviços: por lei (Resolução 3.919 do BC), você tem direito aos 'Serviços Essenciais' gratuitos em qualquer banco, sem pagar taxa de manutenção de conta.",
            "Anuidades de cartão de crédito: ligue para a operadora e peça isenção total; se recusarem, cancele e migre para cartões sem anuidade.",
            "Assinaturas esquecidas: aplicativos de celular, clubes de benefícios e streamings que ninguém assiste há mais de 30 dias.",
            "Planos de celular e internet antigos: ligue para a operadora e peça a equiparação com os planos vigentes para novos clientes (direito garantido pela Anatel).",
          ]}
        />
      </Section>

      <Section heading="4. A regra dos 3 dias para compras não essenciais">
        <p>
          Sempre que sentir um impulso incontrolável de comprar algo online ou na vitrine, espere 72 horas.
          Se após três dias a necessidade ainda existir e o valor couber no seu orçamento, compre conscientemente.
          Em mais de 80% dos casos, o desejo impulsivo desaparece antes do terceiro dia.
        </p>
      </Section>
    </ContentPage>
  );
}

import type { Metadata } from "next";
import { Bullets, ContentPage, Section } from "@/components/content-page";

export const metadata: Metadata = {
  title: "Portabilidade de crédito: como trocar dívida cara por barata",
  description:
    "Aprenda a transferir empréstimos e financiamentos para outro banco com juros menores, economizar milhares de reais e conhecer seus direitos garantidos pelo Banco Central.",
  alternates: { canonical: "/portabilidade-de-credito" },
};

export default function Page() {
  return (
    <ContentPage
      title="Portabilidade de crédito: troque juros altos por alívio"
      intro="Você não é obrigado a ficar preso ao banco que concedeu seu empréstimo. Por regulamentação do Banco Central, você tem o direito gratuito de transferir sua dívida para qualquer instituição que ofereça taxas mais baixas."
    >
      <Section heading="1. O que é a portabilidade de crédito?">
        <p>
          A portabilidade de crédito é a transferência de uma operação de crédito (empréstimo pessoal,
          consignado ou financiamento imobiliário/veicular) de uma instituição financeira credora original para
          outra instituição proponente, com condições mais vantajosas (juros menores ou parcelas mais baixas).
        </p>
        <p>
          O novo banco quita a sua dívida no banco antigo e assume o contrato. Para você, nada muda na prática,
          exceto que a parcela fica menor ou o prazo encurta.
        </p>
      </Section>

      <Section heading="2. A regra fundamental: comparar o CET, não apenas os juros nominais">
        <p>
          Nunca compare apenas a taxa de juros anunciada. Exija sempre o <strong>Custo Efetivo Total (CET)</strong>.
          O CET inclui juros, tarifas bancárias, seguros obrigatórios e IOF.
        </p>
        <p>
          Muitas vezes, uma instituição anuncia juros de 1,5% ao mês, mas cobra tarifas e seguros que elevam
          o CET para 2,4% ao mês — tornando a proposta mais cara do que uma que cobra 1,8% ao mês sem tarifas extras.
        </p>
      </Section>

      <Section heading="3. Passo a passo para solicitar a portabilidade">
        <Bullets
          items={[
            "Passo 1: Solicite ao banco atual o Demonstrativo de Evolução da Dívida (DED). O banco é obrigado a fornecer esse documento em até 1 dia útil.",
            "Passo 2: No DED constam o saldo devedor atualizado, número de parcelas restantes, taxa de juros e sistema de amortização.",
            "Passo 3: Pesquise propostas em outras instituições financeiras apresentando o seu DED.",
            "Passo 4: Escolha a melhor proposta e solicite a portabilidade no novo banco.",
            "Passo 5: O novo banco fará a solicitação eletrônica ao banco antigo via sistema centralizado (CIP). O banco antigo tem até 5 dias úteis para cobrir a oferta ou liberar a transferência.",
          ]}
        />
      </Section>

      <Section heading="4. É cobrada alguma taxa pela portabilidade?">
        <p>
          <strong>Não.</strong> A resolução do Banco Central proíbe expressamente qualquer cobrança de tarifas
          para a realização da portabilidade. O banco credor original também não pode criar obstáculos ou se
          recusar a fornecer as informações do contrato.
        </p>
      </Section>

      <Section heading="5. Quando a troca vale mais a pena?">
        <Bullets
          items={[
            "Troca de rotativo de cartão ou cheque especial por crédito consignado ou pessoal com juros controlados.",
            "Contratos de longo prazo (financiamento imobiliário), onde uma redução de 1% a 2% ao ano representa dezenas de milhares de reais economizados.",
            "Quando a Selic ou as taxas médias de mercado caíram desde a assinatura do seu contrato original.",
          ]}
        />
      </Section>
    </ContentPage>
  );
}

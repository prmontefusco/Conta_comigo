import type { Metadata } from "next";
import { Bullets, ContentPage, Section } from "@/components/content-page";

export const metadata: Metadata = {
  title: "Regra 50-30-20 na prática: como dividir seu salário sem complicação",
  description:
    "Descubra como adaptar a regra 50-30-20 para a realidade brasileira: 50% necessidades básicas, 30% estilo de vida e 20% prioridades financeiras ou pagamento de dívidas.",
  alternates: { canonical: "/regra-50-30-20" },
};

export default function Page() {
  return (
    <ContentPage
      title="A Regra 50-30-20 na realidade brasileira"
      intro="Dividir o salário em três baldes simples é uma das formas mais eficazes de manter as finanças saudáveis sem precisar anotar cada cafezinho com sofrimento."
    >
      <Section heading="1. Como funciona a divisão clássica">
        <p>
          A regra sugere dividir a sua <strong>renda líquida mensal</strong> (o dinheiro que realmente cai
          na sua conta após descontos de INSS e IR) em três categorias:
        </p>
        <Bullets
          items={[
            "50% para Necessidades Básicas: moradia (aluguel/condomínio), contas essenciais (luz, água, gás, internet básica), alimentação básica, transporte para o trabalho e saúde.",
            "30% para Desejos e Estilo de Vida: passeios, lazer, restaurantes, assinaturas de streaming, compras pessoais e hobbies.",
            "20% para Prioridades Financeiras: quitação acelerada de dívidas, construção da reserva de emergência e planos futuros.",
          ]}
        />
      </Section>

      <Section heading="2. O ajuste para a realidade do Brasil (60-20-20 ou 70-20-10)">
        <p>
          Em muitas cidades brasileiras, o custo de moradia e alimentação consome mais de 50% da renda da maioria
          das famílias. Não se frustre se os 50% não forem suficientes no início!
        </p>
        <p>
          A regra é uma diretriz de equilíbrio, não uma lei imutável. Se suas necessidades básicas hoje consomem
          65% ou 70%, adapte para:
        </p>
        <Bullets
          items={[
            "60% Necessidades | 20% Desejos | 20% Dívidas / Reserva",
            "Ou 70% Necessidades | 15% Desejos | 15% Dívidas / Reserva",
          ]}
        />
        <p>
          O princípio essencial é nunca deixar a fatia das prioridades financeiras (o seu futuro) em 0%. Mesmo que
          sejam 5% ou 10%, manter essa porta aberta constrói o hábito da liberdade financeira.
        </p>
      </Section>

      <Section heading="3. Para quem está endividado: a prioridade inverte">
        <p>
          Se você tem dívidas caras (cartão rotativo, cheque especial ou empréstimos com parcelas pesadas), os 20%
          das prioridades devem ser direcionados integralmente para estancar os juros e quitar as pendências.
        </p>
        <p>
          Temporariamente, aperte também a fatia dos 30% de desejos (reduzindo para 10% ou 15%) para criar uma
          frente de ataque muito mais rápida contra as dívidas. Quanto mais rápido as dívidas acabarem, mais rápido
          sua renda voltará a ser 100% sua.
        </p>
      </Section>

      <Section heading="4. Como manter o controle na prática">
        <Bullets
          items={[
            "Calcule os valores em reais: se sua renda líquida é R$ 3.000, 50% são R$ 1.500, 30% são R$ 900 e 20% são R$ 600.",
            "Pague o seu futuro primeiro: no dia do pagamento, separe imediatamente os 20% antes de começar os gastos do mês.",
            "Defina um teto semanal para o lazer: dividir a verba de estilo de vida em 4 semanas impede que o dinheiro acabe no dia 10.",
          ]}
        />
      </Section>
    </ContentPage>
  );
}

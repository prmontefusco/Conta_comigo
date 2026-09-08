import type { Metadata } from "next";
import { Bullets, ContentPage, Section } from "@/components/content-page";

export const metadata: Metadata = {
  title: "Segurança financeira a longo prazo: como construir solidez e patrimônio",
  description:
    "Para quem já não tem dívidas ou quer construir tranquilidade duradoura: pilares da estabilidade, proteção patrimonial e liberdade ao longo do tempo.",
  alternates: { canonical: "/seguranca-financeira" },
};

export default function Page() {
  return (
    <ContentPage
      title="Segurança financeira: construindo estabilidade para a vida"
      intro="A verdadeira segurança financeira não é ter um milhão na conta da noite para o dia. É construir uma estrutura onde imprevistos não abalam sua família e onde seu tempo pertence a você."
    >
      <Section heading="1. Os quatro estágios da vida financeira">
        <Bullets
          items={[
            "Estágio 1 - Sobrevivência / Déficit: o dinheiro não chega ao fim do mês; dívidas crescendo e ansiedade constante.",
            "Estágio 2 - Equilíbrio / Respiração: as contas são pagas em dia, as dívidas estão quitadas ou sob controle, mas não sobra quase nada.",
            "Estágio 3 - Segurança: existe uma reserva de emergência robusta (6 a 12 meses); imprevistos são resolvidos sem estresse e sobra dinheiro todo mês.",
            "Estágio 4 - Liberdade / Independência: o patrimônio acumulado e a renda passiva pagam parte ou a totalidade do custo de vida familiar.",
          ]}
        />
      </Section>

      <Section heading="2. O pilar da proteção: seguros e blindagem familiar">
        <p>
          Muitas famílias constroem patrimônio por 10 anos e perdem tudo em 6 meses por falta de proteção básica.
          Segurança financeira de longo prazo envolve:
        </p>
        <Bullets
          items={[
            "Plano de saúde ou reserva médica: despesas de saúde imprevistas são a maior causa de falência pessoal no mundo.",
            "Seguro de vida e invalidez: especialmente para quem é o principal provedor ou tem filhos pequenos dependentes.",
            "Seguro patrimonial: proteger o carro contra roubo/terceiros e a casa contra incêndio/danos elétricos custa uma fração do valor do bem.",
          ]}
        />
      </Section>

      <Section heading="3. Evite a inflação do estilo de vida">
        <p>
          O maior obstáculo para a segurança financeira de quem ganha bem é a &ldquo;inflação do estilo de vida&rdquo;.
          A pessoa é promovida ou passa a faturar mais e, imediatamente, troca de carro, aluga um imóvel mais caro
          e multiplica os custos fixos.
        </p>
        <p>
          A regra inteligente: <strong>ao receber um aumento ou renda extra, guarde pelo menos 50% desse aumento</strong>
          e use os outros 50% para elevar o padrão de vida. Dessa forma, sua segurança cresce na mesma velocidade que suas conquistas.
        </p>
      </Section>

      <Section heading="4. Diversificação e consistência de longo prazo">
        <p>
          Não existem atalhos milagrosos, promessas de retorno de 5% ao mês ou fórmulas secretas.
          A segurança financeira duradoura é filha da consistência: aportes regulares, juros compostos trabalhando
          a seu favor por décadas e custos de vida mantidos sempre abaixo do que se ganha.
        </p>
      </Section>
    </ContentPage>
  );
}

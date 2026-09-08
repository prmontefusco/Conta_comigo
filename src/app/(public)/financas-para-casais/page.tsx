import type { Metadata } from "next";
import { Bullets, ContentPage, Section } from "@/components/content-page";

export const metadata: Metadata = {
  title: "Finanças para casais: como falar de dinheiro e dividir contas sem brigas",
  description:
    "Modelos de divisão proporcional de despesas, transparência orçamentária no casamento e como alinhar sonhos a dois sem conflitos emocionais.",
  alternates: { canonical: "/financas-para-casais" },
};

export default function Page() {
  return (
    <ContentPage
      title="Finanças a dois: parceria sem ansiedade e sem brigas"
      intro="O dinheiro é um dos motivos mais frequentes de desentendimentos nos relacionamentos. Quando o casal transforma o orçamento em um projeto compartilhado, o peso divide pela metade e os sonhos multiplicam."
    >
      <Section heading="1. Por que falar de dinheiro é tão difícil?">
        <p>
          Cada pessoa traz uma bagagem emocional diferente sobre finanças: quem cresceu vendo os pais brigarem por
          contas tende a ser excessivamente ansioso ou controlador; quem nunca teve limites pode encarar o dinheiro
          com desatenção ou impulsividade.
        </p>
        <p>
          O primeiro passo é desarmar o julgamento moral. Ninguém é &ldquo;vilão&rdquo; por ter receios ou hábitos diferentes.
          O objetivo da conversa não é apontar erros do passado, mas sim decidir como construir o futuro a partir de hoje.
        </p>
      </Section>

      <Section heading="2. Três modelos de divisão de despesas">
        <p>Não existe uma fórmula única para todos os casais. Escolham o modelo que melhor respeita a realidade de vocês:</p>
        <Bullets
          items={[
            "1. Divisão 50/50 (Igualitária): cada um paga exatamente metade das contas da casa. Funciona muito bem quando ambos ganham salários semelhantes. Se um ganha muito mais que o outro, esse modelo pode sufocar o parceiro de menor renda.",
            "2. Divisão Proporcional à Renda (Mais justa): se a pessoa A ganha R$ 6.000 (60% da renda da casa) e a pessoa B ganha R$ 4.000 (40%), as despesas comuns são divididas em 60% para A e 40% para B. Ambos contribuem com o mesmo percentual de esforço.",
            "3. Receita Total Unificada: todo o dinheiro entra em uma conta comum do casal, pagam-se todas as despesas familiares e define-se um valor idêntico de 'mesada pessoal' para cada um gastar livremente sem prestar contas ao outro.",
          ]}
        />
      </Section>

      <Section heading="3. A importância da autonomia individual">
        <p>
          Mesmo no casamento mais unido, ter uma quantia livre de controle do parceiro é fundamental para o bem-estar
          emocional. Se você quer comprar um presente, um livro ou sair com amigos, não deve precisar justificar cada
          centavo se as contas da família estiverem em dia e o valor estiver dentro do acordado.
        </p>
      </Section>

      <Section heading="4. Reunião mensal das contas: a 'noite do orçamento'">
        <Bullets
          items={[
            "Marquem um dia fixo no mês (por exemplo, todo dia 5 ou primeiro domingo após o pagamento).",
            "Criem um clima acolhedor: façam um café ou peçam uma comida gostosa.",
            "Abram o Conta comigo e revisem juntos: o que entrou, o que saiu e quanto sobrou para a reserva do casal.",
            "Celebrem as vitórias: comemorem quando uma dívida for quitada ou a meta da viagem estiver mais próxima.",
          ]}
        />
      </Section>
    </ContentPage>
  );
}

import type { Metadata } from "next";
import { Bullets, ContentPage, Section } from "@/components/content-page";

export const metadata: Metadata = {
  title: "Rotativo do cartão e cheque especial: por que são perigosos e como sair",
  description:
    "Com taxas que ultrapassam 300% a 400% ao ano, o rotativo e o cheque especial são os maiores vilões do orçamento. Veja como desarmar essa armadilha agora.",
  alternates: { canonical: "/rotativo-e-cheque-especial" },
};

export default function Page() {
  return (
    <ContentPage
      title="Cheque especial e rotativo: desarme os maiores juros do Brasil"
      intro="Nenhuma aplicação financeira rende o que essas duas modalidades cobram. Entender a matemática do rotativo e do cheque especial é o primeiro passo para não permitir que o banco engula seu trabalho."
    >
      <Section heading="1. O efeito dos juros sobre juros">
        <p>
          No Brasil, o rotativo do cartão de crédito e o cheque especial operam historicamente com taxas que
          variam de 8% a mais de 15% <em>ao mês</em>. Em termos anuais, isso significa juros compostos que
          ultrapassam 300% a 450% ao ano.
        </p>
        <p>
          Na prática: uma dívida de R$ 2.000 esquecida no rotativo pode se transformar em mais de R$ 8.000 em
          apenas 12 meses. O que você está pagando não é o produto que comprou, mas sim encargos financeiros puros.
        </p>
      </Section>

      <Section heading="2. O que diz a regra do Banco Central sobre o rotativo?">
        <p>
          Pela Resolução nº 4.549 do Banco Central, o consumidor não pode permanecer no crédito rotativo por mais
          de 30 dias. Se a fatura seguinte não for paga integralmente, a instituição financeira é obrigada a
          oferecer uma linha de crédito parcelada com condições e juros menores que os do rotativo.
        </p>
        <p>
          Além disso, novas regulamentações estabeleceram tetos máximos para a cobrança acumulada de juros no rotativo,
          limitando o montante total de juros ao valor original da dívida. Conhecer essa regra evita cobranças
          abusivas.
        </p>
      </Section>

      <Section heading="3. A ilusão do cheque especial">
        <p>
          Muitos bancos somam o valor do cheque especial ao saldo da conta corrente, fazendo parecer que a
          pessoa tem mais dinheiro do que realmente possui.
        </p>
        <p>
          <strong>Cheque especial não é renda.</strong> É um empréstimo pré-aprovado de altíssimo custo.
          Assim que o salário cai na conta, o banco abocanha o valor para cobrir o limite negativo, e a pessoa
          se vê forçada a usar o cheque especial de novo no dia seguinte para sobreviver, virando refém perpétuo.
        </p>
      </Section>

      <Section heading="4. Plano de emergência para estancar o sangramento">
        <Bullets
          items={[
            "Passo 1: Peça a redução ou o cancelamento do limite do cheque especial junto ao seu gerente ou aplicativo.",
            "Passo 2: Abra uma 'Conta Salário' ou exerça o direito de 'Portabilidade Salarial' para outro banco, impedindo que o banco retenha 100% da sua renda antes de você pagar despesas de sobrevivência.",
            "Passo 3: Troque a dívida por uma linha mais barata: contrate um empréstimo pessoal ou consignado com juros de 1,5% a 2,5% a.m. e liquide o rotativo à vista.",
            "Passo 4: Guarde o cartão na gaveta e utilize débito ou dinheiro durante o processo de recuperação.",
          ]}
        />
      </Section>
    </ContentPage>
  );
}

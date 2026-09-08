import type { Metadata } from "next";
import { Bullets, ContentPage, Section } from "@/components/content-page";

export const metadata: Metadata = {
  title: "Score de crédito: mitos, verdades e como aumentar sua pontuação",
  description:
    "Entenda como funciona o score de crédito (Serasa, SPC, Boa Vista), o Cadastro Positivo, o que realmente faz a nota subir e os golpes que você deve evitar.",
  alternates: { canonical: "/score-de-credito" },
};

export default function Page() {
  return (
    <ContentPage
      title="Score de crédito: o que realmente funciona"
      intro="O score de crédito é uma estimativa estatística de probabilidade de pagamento. Compreender como ele é calculado ajuda a evitar armadilhas e a construir uma reputação sólida no mercado financeiro."
    >
      <Section heading="1. Como o score é calculado?">
        <p>
          Os birôs de crédito (Serasa Experian, SPC Brasil, Boa Vista/Equifax e Quod) utilizam algoritmos
          que analisam o histórico financeiro do seu CPF em faixas que variam de 0 a 1.000 pontos:
        </p>
        <Bullets
          items={[
            "De 0 a 300 (Muito baixo): alto risco de inadimplência, crédito raramente concedido.",
            "De 301 a 500 (Baixo): risco moderado, crédito difícil com juros elevados.",
            "De 501 a 700 (Bom): perfil confiável, acesso razoável a cartões e empréstimos.",
            "De 701 a 1.000 (Excelente): menor risco, acesso às melhores taxas e limites do mercado.",
          ]}
        />
      </Section>

      <Section heading="2. Mitos comuns que você deve ignorar">
        <Bullets
          items={[
            "Mito: 'Pagar para aumentar o score'. Isso é GOLPE. Nenhuma empresa, despachante ou perfil de rede social pode alterar manualmente sua pontuação nos birôs.",
            "Mito: 'Colocar CPF na nota fiscal aumenta o score'. O CPF na nota alimenta programas fiscais estaduais (como Nota Fiscal Paulista), mas não interfere diretamente no cálculo do score bancário.",
            "Mito: 'Consultar o próprio CPF diminui a nota'. Consultar seu próprio score pelo app ou site oficial dos birôs é gratuito e não diminui nenhum ponto.",
          ]}
        />
      </Section>

      <Section heading="3. O que realmente aumenta o seu score">
        <Bullets
          items={[
            "Pagar as contas em dia: o histórico de pontualidade no pagamento de água, luz, telefone, faturas e empréstimos é o fator de maior peso.",
            "Manter o Cadastro Positivo ativo: o Cadastro Positivo registra quando você paga em dia, e não apenas quando atrasa.",
            "Quitar dívidas negativadas: retirar seu nome da inadimplência é o primeiro passo para a recuperação gradual da pontuação.",
            "Evitar pedir muitos cartões e empréstimos ao mesmo tempo: cada solicitação gera uma consulta de terceiros no seu CPF; muitas consultas em curto período sinalizam desespero financeiro.",
            "Manter seus dados cadastrais atualizados nos sites dos birôs.",
          ]}
        />
      </Section>

      <Section heading="4. Por que o score demora para subir após pagar uma dívida?">
        <p>
          O score reflete um histórico de comportamento de 12 a 24 meses. Ao pagar uma dívida, o apontamento
          negativo sai em até 5 dias úteis, mas o algoritmo precisa de alguns meses consecutivos de pagamentos
          em dia para entender que o risco diminuiu de forma estável.
        </p>
        <p>
          Paciência e consistência são as únicas estratégias reais. Foque em manter seu orçamento sob controle,
          e a pontuação acompanhará a sua tranquilidade naturalmente.
        </p>
      </Section>
    </ContentPage>
  );
}

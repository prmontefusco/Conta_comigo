import type { Metadata } from "next";
import { Bullets, ContentPage, Section } from "@/components/content-page";

export const metadata: Metadata = {
  title: "Finanças para autônomos, MEIs e freelancers: gestão de renda variável",
  description:
    "Aprenda a separar conta PJ de PF, definir um pró-labore fixo, criar reserva de oscilação e gerir o fluxo de caixa sem ficar no sufoco em meses de baixa.",
  alternates: { canonical: "/financas-para-autonomos" },
};

export default function Page() {
  return (
    <ContentPage
      title="Finanças para autônomos e freelancers: domando a renda variável"
      intro="Quem trabalha por conta própria não tem salário fixo todo dia 5. Saber gerir a alternância entre meses gordos e meses magros é a habilidade mais vital para o autônomo e MEI."
    >
      <Section heading="1. O mandamento nº 1: separe a Pessoa Jurídica da Pessoa Física">
        <p>
          O erro que destrói a maioria dos pequenos negócios é a mistura das contas bancárias. Quando o dinheiro
          do cliente cai na mesma conta onde você paga a feira da casa e o almoço das crianças, você perde a noção
          se o negócio é lucrativo ou se você está consumindo o capital de giro.
        </p>
        <Bullets
          items={[
            "Abra uma conta bancária exclusiva para a atividade profissional (PJ ou conta secundária dedicada).",
            "Todos os recebimentos de clientes e despesas do negócio (DAS-MEI, ferramentas, insumos) passam por essa conta.",
            "As contas pessoais (aluguel, mercado, lazer da família) são pagas exclusivamente na conta Pessoa Física.",
          ]}
        />
      </Section>

      <Section heading="2. Defina um 'salário fixo' para você (Pró-labore)">
        <p>
          Em vez de transferir todo o dinheiro da empresa para a sua conta pessoal assim que o cliente paga,
          adote um pró-labore fixo:
        </p>
        <p>
          Calcule seu custo de vida familiar básico mensal (ex: R$ 3.500). Nos meses em que a empresa faturar
          R$ 7.000, você transfere apenas os R$ 3.500 para sua conta PF. O restante fica na conta PJ como reserva.
          No mês em que você faturar apenas R$ 2.000, a reserva da PJ completa os seus R$ 3.500.
        </p>
        <p>Isso transforma sua renda irregular em um salário previsível para a sua casa!</p>
      </Section>

      <Section heading="3. A 'Reserva de Oscilação de Demanda'">
        <p>
          Todo negócio tem sazonalidade (janeiro e fevereiro costumam ser mais fracos em muitos setores, por exemplo).
          Crie duas reservas distintas:
        </p>
        <Bullets
          items={[
            "Reserva de Capital de Giro PJ: de 2 a 3 meses dos custos operacionais do negócio.",
            "Reserva de Emergência Familiar PF: de 6 a 12 meses do custo de vida essencial da casa.",
          ]}
        />
      </Section>

      <Section heading="4. Provisão para impostos e direitos">
        <p>
          Quem é autônomo não tem 13º salário, férias remuneradas ou FGTS pagos por um empregador.
          Você precisa ser o seu próprio gestor de benefícios:
        </p>
        <Bullets
          items={[
            "Separe mensalmente a porcentagem de impostos (DAS do MEI ou Simples Nacional) assim que receber a nota.",
            "Guarde cerca de 1/12 do seu pró-labore todo mês para garantir suas férias e seu '13º salário' no fim do ano.",
            "Contribua com o INSS ou previdência para garantir cobertura de auxílio-doença, maternidade e aposentadoria.",
          ]}
        />
      </Section>
    </ContentPage>
  );
}

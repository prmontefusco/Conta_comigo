import type { Metadata } from "next";
import { Bullets, ContentPage, Section } from "@/components/content-page";

export const metadata: Metadata = {
  title: "Termos de Uso",
  description:
    "Condições de uso do Conta comigo: o que o serviço faz, o que não faz e quais são as " +
    "responsabilidades de cada lado.",
  alternates: { canonical: "/termos" },
};

export default function Page() {
  return (
    <ContentPage
      title="Termos de Uso"
      intro="As condições abaixo valem para o uso do Conta comigo. Estão escritas para serem lidas, não para desencorajar a leitura."
      cta={false}
    >
      <Section heading="O que o serviço é">
        <p>
          O Conta comigo é uma ferramenta de organização e planejamento financeiro pessoal e
          familiar. Ele registra as informações que você fornece e apresenta cálculos e projeções a
          partir delas.
        </p>
      </Section>

      <Section heading="O que o serviço não é">
        <Bullets
          items={[
            "Não somos instituição financeira e não realizamos operações financeiras.",
            "Não oferecemos, intermediamos nem recomendamos crédito, investimentos ou seguros.",
            "Não prestamos consultoria financeira, contábil, jurídica ou tributária.",
            "Não nos conectamos às suas contas bancárias e não movimentamos dinheiro.",
          ]}
        />
        <p>
          As projeções são cálculos determinísticos sobre os dados que você cadastrou. Não são
          garantias, previsões certificadas nem recomendações. As decisões financeiras são sempre
          suas.
        </p>
      </Section>

      <Section heading="Sua conta">
        <Bullets
          items={[
            "Você precisa ter 18 anos ou mais para criar uma conta.",
            "As informações de cadastro devem ser verdadeiras.",
            "Você é responsável por manter sua senha em segurança e pelo que acontece na sua conta.",
            "Ao adicionar alguém ao seu grupo familiar, você concede a essa pessoa acesso aos dados financeiros do grupo, conforme o papel atribuído.",
          ]}
        />
      </Section>

      <Section heading="Seus dados são seus">
        <p>
          Você mantém a titularidade de todas as informações que cadastra. Concede ao Conta comigo
          apenas a permissão necessária para armazenar, processar e exibir esses dados para você e
          para os membros do seu grupo.
        </p>
        <p>
          Você pode exportar ou excluir seus dados a qualquer momento, como descrito na{" "}
          <a href="/privacidade" className="underline underline-offset-2">
            Política de Privacidade
          </a>
          .
        </p>
      </Section>

      <Section heading="Uso aceitável">
        <p>Não é permitido:</p>
        <Bullets
          items={[
            "Tentar acessar dados de outros usuários ou de outros grupos familiares.",
            "Interferir na operação do serviço ou contornar seus mecanismos de segurança.",
            "Utilizar o serviço para atividades ilegais.",
            "Automatizar acessos de forma a prejudicar a disponibilidade para outras pessoas.",
          ]}
        />
      </Section>

      <Section heading="Planos e publicidade">
        <p>
          A versão gratuita é sustentada por publicidade, exibida sem qualquer uso das suas
          informações financeiras. Planos pagos, quando existirem, terão preço e condições
          informados antes de qualquer cobrança.
        </p>
      </Section>

      <Section heading="Disponibilidade">
        <p>
          O serviço é fornecido no estado em que se encontra. Trabalhamos para mantê-lo disponível e
          correto, mas não garantimos operação ininterrupta nem ausência de erros. Interrupções para
          manutenção podem ocorrer.
        </p>
      </Section>

      <Section heading="Limitação de responsabilidade">
        <p>
          Na máxima extensão permitida pela legislação brasileira, o Conta comigo não responde por
          decisões financeiras tomadas com base nas informações apresentadas, nem por perdas
          decorrentes de dados incorretos ou incompletos fornecidos por você.
        </p>
        <p>
          Nada nestes termos afasta direitos que a legislação consumerista brasileira garanta a
          você.
        </p>
      </Section>

      <Section heading="Encerramento">
        <p>
          Você pode encerrar sua conta a qualquer momento. Podemos suspender contas que violem estes
          termos, com aviso prévio sempre que possível.
        </p>
      </Section>

      <Section heading="Alterações e foro">
        <p>
          Mudanças relevantes nestes termos serão comunicadas dentro do aplicativo antes de entrarem
          em vigor. Aplica-se a legislação brasileira, e fica eleito o foro do domicílio do usuário
          para dirimir eventuais conflitos.
        </p>
      </Section>
    </ContentPage>
  );
}

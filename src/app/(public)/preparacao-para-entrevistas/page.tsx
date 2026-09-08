import type { Metadata } from "next";
import { Bullets, ContentPage, Section } from "@/components/content-page";

export const metadata: Metadata = {
  title: "Preparação para entrevistas de emprego: perguntas difíceis e postura",
  description:
    "Como se destacar na entrevista de emprego, responder sobre períodos fora do mercado ou dívidas, usar o método STAR e negociar salário com segurança.",
  alternates: { canonical: "/preparacao-para-entrevistas" },
};

export default function Page() {
  return (
    <ContentPage
      title="Preparação para entrevistas de emprego: como conquistar a vaga"
      intro="Ser chamado para a entrevista significa que seu currículo passou na triagem e a empresa viu potencial em você. Agora é hora de transformar essa oportunidade em uma proposta de trabalho."
    >
      <Section heading="1. Antes da entrevista: a lição de casa indispensável">
        <Bullets
          items={[
            "Pesquise sobre a empresa: acesse o site oficial, redes sociais e notícias recentes. Entenda o que ela vende, quem são os clientes e quais são os valores da organização.",
            "Releia a descrição da vaga: identifique as 3 ou 4 competências centrais exigidas e pense em exemplos práticos da sua vida profissional que comprovem essas habilidades.",
            "Revise seu currículo: saiba explicar detalhadamente qualquer linha que esteja escrita nele (se ainda não atualizou, gere um modelo limpo no cvlivre.com.br).",
            "Chegue com 10 a 15 minutos de antecedência (ou teste a câmera e microfone 20 minutos antes, caso seja online).",
          ]}
        />
      </Section>

      <Section heading="2. O Método STAR para responder perguntas sobre situações passadas">
        <p>
          Recrutadores adoram perguntas como: <em>&ldquo;Me conte sobre uma vez em que você enfrentou um problema difícil no trabalho&rdquo;</em>.
          Responda de forma clara e estruturada usando a técnica <strong>STAR</strong>:
        </p>
        <Bullets
          items={[
            "S - Situação: contextualize brevemente o cenário que você viveu ('Na empresa X, tínhamos uma meta de entrega com prazo apertado...').",
            "T - Tarefa: explique qual era a sua responsabilidade específica ('Minha função era coordenar o estoque para que nada faltasse...').",
            "A - Ação: relate exatamente o que você fez ('Organizei uma planilha de controle e conversei com os fornecedores para antecipar a remessa...').",
            "R - Resultado: compartilhe o desfecho positivo ('Conseguimos entregar o pedido com 2 dias de antecedência e sem nenhuma reclamação do cliente').",
          ]}
        />
      </Section>

      <Section heading="3. Como responder perguntas delicadas">
        <Bullets
          items={[
            "Período longo sem trabalhar (gap no currículo): Seja honesto com naturalidade. Explique se cuidou da família, se fez cursos de qualificação, trabalhos informais ou se buscou recolocação com foco.",
            "Por que saiu do emprego anterior: Nunca fale mal da empresa anterior ou de ex-chefes. Foque no futuro: 'Busco novos desafios profissionais e uma oportunidade onde eu possa crescer'.",
            "Pretensão salarial: Pesquise a média do cargo no mercado (Glassdoor, vagas semelhantes). Diga uma faixa razoável: 'Tenho como expectativa uma remuneração entre R$ X e R$ Y, mas estou aberto a avaliar o pacote completo de benefícios da empresa'.",
          ]}
        />
      </Section>

      <Section heading="4. Tenha perguntas inteligentes para o recrutador no final">
        <p>
          No fim da conversa, quando perguntarem <em>&ldquo;Você tem alguma dúvida?&rdquo;</em>, nunca diga apenas &ldquo;não&rdquo;.
          Fazer perguntas demonstra interesse genuíno:
        </p>
        <Bullets
          items={[
            "'Como é o dia a dia e os principais desafios de quem assume essa função?'",
            "'Quais são as prioridades que a empresa espera que essa pessoa resolva nos primeiros 3 meses?'",
            "'Quais são os próximos passos do processo seletivo?'",
          ]}
        />
      </Section>
    </ContentPage>
  );
}

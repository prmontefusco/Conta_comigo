import type { Metadata } from "next";
import { Bullets, ContentPage, Section } from "@/components/content-page";

export const metadata: Metadata = {
  title: "Como procurar emprego quando está desempregado ou precisando de renda",
  description:
    "Estratégia prática para encontrar um emprego adequado: rotina diária de buscas, onde encontrar vagas, networking sem vergonha e preparação do currículo.",
  alternates: { canonical: "/como-procurar-emprego" },
};

export default function Page() {
  return (
    <ContentPage
      title="Como procurar emprego quando você mais precisa"
      intro="Estar desempregado ou com renda insuficiente é angustiante. Mas procurar emprego é, em si, um trabalho diário: com método, disciplina e as ferramentas certas, a vaga adequada aparece muito mais rápido."
    >
      <Section heading="1. Trate a busca por emprego como uma rotina de trabalho">
        <p>
          O maior perigo do desemprego é a perda de rotina e a sensação de desamparo. Acordar sem horário definido
          e passar o dia rolando redes sociais sem rumo aumenta a ansiedade e diminui a eficácia da busca.
        </p>
        <Bullets
          items={[
            "Defina horários fixos: acorde cedo, tome banho, vista-se e dedique 3 a 4 horas focadas todos os dias para pesquisa, envio de candidaturas e estudos.",
            "Crie uma planilha de acompanhamento: anote as empresas onde se candidatou, o cargo, o salário informado e a data de envio para acompanhar retornos.",
            "Não gaste o dia inteiro enviando currículos aleatórios: 5 candidaturas bem direcionadas e personalizadas funcionam infinitamente melhor do que 100 envios no piloto automático.",
          ]}
        />
      </Section>

      <Section heading="2. Onde estão as vagas reais hoje?">
        <p>Não dependa de uma única fonte. Distribua seus esforços:</p>
        <Bullets
          items={[
            "LinkedIn: essencial para cargos administrativos, técnicos, comerciais e de gestão. Mantenha seu perfil completo com foto profissional e resumo claro.",
            "Portais de vagas consolidados: InfoJobs, Catho, Vagas.com.br e Gupy.",
            "SINE e Postos de Atendimento ao Trabalhador (PAT / Poupatempo): fundamentais para vagas operacionais, comércio, serviços e indústria regional.",
            "Trabalhe Conosco de empresas locais: visite os sites de supermercados, hospitais, distribuidoras e fábricas da sua região e cadastre seu currículo diretamente.",
          ]}
        />
      </Section>

      <Section heading="3. O poder do networking sem constrangimento">
        <p>
          Mais de 60% das contratações no Brasil acontecem por indicação direta. Ter vergonha de dizer que está
          procurando emprego só atrasa a sua recolocação.
        </p>
        <p>
          Mande uma mensagem gentil e objetiva para ex-colegas de trabalho, amigos, vizinhos e parentes:
          <em> &ldquo;Olá fulano, estou em busca de uma oportunidade na área comercial/administrativa. Caso saiba de alguma vaga onde meu perfil possa somar, agradeço muito a lembrança! Segue meu currículo atualizado.&rdquo;</em>
        </p>
      </Section>

      <Section heading="4. Seu cartão de visitas: o currículo profissional">
        <p>
          O recrutador leva em média <strong>6 segundos</strong> para bater o olho em um currículo e decidir se descarta
          ou se chama para a entrevista. Um currículo desorganizado, sem dados de contato claros ou com erros de português
          elimina candidatos excelentes antes mesmo de terem a chance de conversar.
        </p>
        <div className="rounded-2xl border-2 border-teal-200 bg-teal-50/60 p-6">
          <h3 className="text-lg font-semibold text-teal-900">Precisa criar ou atualizar seu currículo agora?</h3>
          <p className="mt-2 text-sm leading-relaxed text-teal-800">
            Se você precisa fazer um currículo profissional, bonito, moderno e no formato exato que os recrutadores
            e sistemas de seleção exigem, acesse o{" "}
            <a
              href="https://cvlivre.com.br/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold underline underline-offset-2 hover:text-teal-950"
            >
              CV Livre (cvlivre.com.br)
            </a>
            . É uma plataforma brasileira especializada e gratuita na criação de currículos profissionais de destaque.
          </p>
          <div className="mt-4">
            <a
              href="https://cvlivre.com.br/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-teal-800"
            >
              Criar meu currículo no CV Livre ↗
            </a>
          </div>
        </div>
      </Section>

      <Section heading="5. Qualificação gratuita enquanto espera">
        <p>
          Aproveite o tempo livre para adicionar cursos rápidos ao currículo. Plataformas como Fundação Bradesco
          (Escola Virtual), SEBRAE, FGV Online e SENAI oferecem cursos 100% gratuitos com certificado reconhecido
          em informática, atendimento, vendas, finanças e logística.
        </p>
      </Section>
    </ContentPage>
  );
}

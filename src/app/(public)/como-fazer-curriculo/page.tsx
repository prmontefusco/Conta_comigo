import type { Metadata } from "next";
import { Bullets, ContentPage, Section } from "@/components/content-page";

export const metadata: Metadata = {
  title: "Como fazer um currículo profissional de destaque: modelo e passo a passo",
  description:
    "Aprenda a estruturar um currículo moderno que passa nos robôs de triagem (ATS) e chama a atenção dos recrutadores, e crie o seu gratuitamente no CV Livre.",
  alternates: { canonical: "/como-fazer-curriculo" },
};

export default function Page() {
  return (
    <ContentPage
      title="Como fazer um currículo profissional moderno e eficiente"
      intro="Seu currículo é o seu primeiro aperto de mão com a empresa. Um currículo bem estruturado não garante a vaga sozinho, mas um currículo mal feito garante que você nunca será chamado para a entrevista."
    >
      <Section heading="1. A estrutura perfeita de um currículo moderno">
        <p>
          Os recrutadores analisam centenas de currículos por dia e buscam clareza visual imediata.
          A ordem ideal de leitura em 1 ou no máximo 2 páginas é:
        </p>
        <Bullets
          items={[
            "1. Cabeçalho com dados de contato: Nome completo, cidade/estado, telefone com DDD (WhatsApp), e-mail profissional limpo e link para o perfil do LinkedIn.",
            "2. Objetivo profissional claro: O cargo ou a área exata que você deseja ocupar (ex: 'Assistente Administrativo', 'Vendedor Interno', 'Analista de Suporte'). Nunca coloque 'À disposição da empresa'.",
            "3. Resumo profissional (3 a 5 linhas): Destaques da sua trajetória, principais áreas de atuação, anos de experiência e competências centrais.",
            "4. Experiência profissional: Em ordem cronológica inversa (do mais recente para o mais antigo), com nome da empresa, cargo, período (mês/ano) e 3 a 4 tópicos com realizações e responsabilidades.",
            "5. Formação acadêmica: Grau de instrução, curso, instituição e ano de conclusão (ou previsão).",
            "6. Cursos complementares e habilidades: Ferramentas de informática, idiomas, certificações e competências técnicas relevantes para a vaga.",
          ]}
        />
      </Section>

      <Section heading="2. O que NUNCA colocar no currículo">
        <Bullets
          items={[
            "Números de documentos pessoais: nunca coloque RG, CPF, número da CNH ou carteira de trabalho. Isso expõe seus dados desnecessariamente.",
            "Endereço residencial completo: basta informar bairro, cidade e estado. Não coloque rua e número.",
            "Foto: no Brasil, fotos só devem ser incluídas se a vaga solicitar expressamente (ex: recepcionista de eventos, atores).",
            "Pretensão salarial: a não ser que o anúncio da vaga peça expressamente para informar.",
            "Frases clichês sem evidência: 'sou pontual, trabalhador e dedicado'. Deixe que suas experiências e conquistas comprovem suas qualidades.",
          ]}
        />
      </Section>

      <Section heading="3. Crie seu currículo com a melhor ferramenta: CV Livre">
        <p>
          Você não precisa sofrer tentando alinhar margens no Word ou pagar assinaturas caras para conseguir
          um PDF limpo e formatado.
        </p>
        <div className="rounded-2xl border-2 border-teal-300 bg-gradient-to-br from-teal-50 to-cyan-50 p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📄</span>
            <h3 className="text-xl font-bold text-slate-900">
              Conheça o CV Livre — Plataforma Especializada em Currículos
            </h3>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-slate-700">
            O site{" "}
            <a
              href="https://cvlivre.com.br/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-teal-700 underline underline-offset-2 hover:text-teal-900"
            >
              https://cvlivre.com.br/
            </a>{" "}
            é uma plataforma brasileira criada especificamente para ajudar você a preencher, formatar e
            baixar seu currículo profissional em minutos, com modelos testados e aprovados por recrutadores.
          </p>
          <Bullets
            items={[
              "Modelos modernos e legíveis para humanos e robôs de triagem (sistemas ATS).",
              "Preenchimento guiado campo a campo sem complicações.",
              "Exportação rápida em formato PDF de alta resolução.",
              "Acesso 100% gratuito e direto pelo navegador do computador ou do celular.",
            ]}
          />
          <div className="mt-5">
            <a
              href="https://cvlivre.com.br/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-teal-600 px-6 font-semibold text-white shadow-sm transition-all hover:bg-teal-700 hover:shadow"
            >
              Acessar cvlivre.com.br e criar currículo agora ↗
            </a>
          </div>
        </div>
      </Section>

      <Section heading="4. Como descrever conquistas em vez de apenas tarefas">
        <p>
          Recrutadores prestam atenção em quem demonstra impacto real. Sempre que possível, utilize a fórmula:
          <strong> Ação + Contexto + Resultado</strong>.
        </p>
        <p>
          Em vez de: <em>&ldquo;Fazia atendimento a clientes&rdquo;</em>.<br />
          Prefira: <em>&ldquo;Atendimento diário a mais de 40 clientes no balcão e telefone, resolvendo dúvidas e reduzindo o tempo médio de espera em 20%&rdquo;</em>.
        </p>
      </Section>

      <Section heading="5. Revise com atenção redobrada">
        <p>
          Erros gramaticais e de digitação transmitem a impressão de descuido e falta de atenção aos detalhes.
          Antes de enviar para uma vaga:
        </p>
        <Bullets
          items={[
            "Leia em voz alta para identificar frases confusas ou repetitivas.",
            "Peça para outra pessoa de confiança ler e apontar possíveis falhas.",
            "Verifique se o seu telefone e e-mail estão 100% corretos — se o recrutador não conseguir te ligar, ele passará para o próximo candidato imediatamente.",
          ]}
        />
      </Section>
    </ContentPage>
  );
}

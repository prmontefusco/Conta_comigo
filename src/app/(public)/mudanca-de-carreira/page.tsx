import type { Metadata } from "next";
import { Bullets, ContentPage, Section } from "@/components/content-page";

export const metadata: Metadata = {
  title: "Como mudar de carreira com planejamento financeiro e segurança",
  description:
    "Guia prático para fazer transição de carreira sem colocar a família em risco: cálculo de reserva de transição, mapeamento de habilidades transferíveis e currículo adequado.",
  alternates: { canonical: "/mudanca-de-carreira" },
};

export default function Page() {
  return (
    <ContentPage
      title="Como mudar de carreira com segurança financeira"
      intro="Querer mudar de profissão quando sua área estagnou ou você não aguenta mais o trabalho atual é legítimo. Mas a transição bem-sucedida é aquela que você planeja com a cabeça fria, e não no calor de um pedido de demissão impulsivo."
    >
      <Section heading="1. O maior perigo: o 'salto no escuro'">
        <p>
          Pedir demissão antes de ter outra oportunidade engatilhada ou sem uma reserva financeira dedicada
          costuma transformar o sonho da mudança em pesadelo. O desespero por pagar as contas logo no mês seguinte
          força a pessoa a aceitar qualquer vaga pior do que a anterior.
        </p>
        <p>
          A regra de ouro: <strong>faça a transição em paralelo</strong>. Construa a ponte antes de queimar o barco.
        </p>
      </Section>

      <Section heading="2. A 'Reserva de Transição de Carreira'">
        <p>
          Mudar de área costuma envolver começar em cargos juniores ou passar por períodos de estágio/trainee,
          com redução temporária de remuneração.
        </p>
        <Bullets
          items={[
            "Calcule a diferença salarial: se você ganha R$ 4.500 e a nova área paga R$ 3.000 inicialmente, faltarão R$ 1.500 por mês.",
            "Defina um horizonte de 6 a 12 meses para se consolidar na nova carreira.",
            "Crie um fundo específico de transição para cobrir essa diferença de renda sem gerar dívidas para sua casa.",
          ]}
        />
      </Section>

      <Section heading="3. Identifique suas 'Habilidades Transferíveis'">
        <p>
          Você não está começando do zero absoluto. Anos de experiência profissional em qualquer área constroem
          competências valiosas para qualquer empregador:
        </p>
        <Bullets
          items={[
            "Comunicação, negociação e resolução de conflitos com clientes e colegas.",
            "Gestão de tempo, organização de processos e cumprimento de prazos rígidos.",
            "Capacidade de liderança e treinamento de equipes.",
            "Foco em resultados e pensamento analítico sob pressão.",
          ]}
        />
      </Section>

      <Section heading="4. Como adaptar o currículo para a nova área">
        <p>
          O currículo de quem está mudando de carreira não deve ser puramente cronológico. Ele precisa ser
          um <strong>currículo funcional ou híbrido</strong>, destacando projetos práticos, cursos recentes,
          certificações e as habilidades transferíveis aplicáveis à nova vaga.
        </p>
        <div className="rounded-2xl border-2 border-cyan-200 bg-cyan-50/60 p-6">
          <h3 className="text-lg font-semibold text-cyan-950">Precisa reformular seu currículo para a transição?</h3>
          <p className="mt-2 text-sm leading-relaxed text-cyan-900">
            Para apresentar suas experiências com uma linguagem moderna que os novos recrutadores valorizam,
            utilize a plataforma especializada{" "}
            <a
              href="https://cvlivre.com.br/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold underline underline-offset-2 hover:text-cyan-950"
            >
              CV Livre (https://cvlivre.com.br/)
            </a>
            . O site permite criar currículos profissionais prontos para exportar em PDF, com modelos modernos e
            seções específicas para valorizar seu novo momento profissional.
          </p>
          <div className="mt-4">
            <a
              href="https://cvlivre.com.br/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-cyan-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-cyan-800"
            >
              Montar meu novo currículo no CV Livre ↗
            </a>
          </div>
        </div>
      </Section>

      <Section heading="5. Próximos passos para a sua recolocação">
        <p>
          Converse com pessoas que já trabalham na área para onde você quer ir. Peça 15 minutos de bate-papo no LinkedIn
          para tirar dúvidas sobre o dia a dia e entender quais ferramentas são indispensáveis. A transição planejada
          abre portas duradouras.
        </p>
      </Section>
    </ContentPage>
  );
}

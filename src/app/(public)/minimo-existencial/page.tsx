import type { Metadata } from "next";
import Link from "next/link";
import { Bullets, ContentPage, Section } from "@/components/content-page";
import {
  JsonLd,
  buildArticleSchema,
  buildFaqSchema,
  type FaqItem,
} from "@/lib/json-ld";

export const metadata: Metadata = {
  title: "Mínimo Existencial no Brasil: o que é, quanto vale e quais despesas são protegidas por lei",
  description:
    "Tudo sobre o Decreto nº 11.567/2023, o valor do mínimo existencial, quais gastos são protegidos contra descontos de bancos e como impedir que empréstimos consumam seu salário.",
  keywords: [
    "mínimo existencial",
    "decreto 11567",
    "valor minimo existencial 2026",
    "desconto consignado limite",
    "proteção salário divida",
    "bloqueio judicial conta salário",
    "lei 14181 superendividamento",
    "quanto o banco pode descontar do salário",
  ],
  alternates: { canonical: "/minimo-existencial" },
};

const MINIMO_FAQS: readonly FaqItem[] = [
  {
    question: "Quanto vale o Mínimo Existencial hoje no Brasil?",
    answer:
      "O Decreto Federal nº 11.567/2023 fixa o mínimo existencial em R$ 600,00 por indivíduo. Contudo, juízes e defensores públicos consideram que o verdadeiro mínimo existencial deve cobrir o total comprovado de despesas essenciais (moradia, luz, água, alimentação básica e remédios contínuos) e a quantidade de dependentes na casa.",
  },
  {
    question: "O banco pode descontar todo o meu salário para pagar empréstimo ou cartão?",
    answer:
      "Não. O STJ e a legislação de proteção ao consumidor proíbem que retenções bancárias ou descontos de parcelas deixem o correntista sem recursos para a sobrevivência básica. Descontos em folha e em conta corrente possuem limite jurisprudencial de 30% a 35% dos rendimentos líquidos.",
  },
  {
    question: "Quais gastos entram no cálculo do mínimo existencial?",
    answer:
      "Entram despesas estritamente essenciais: alimentação básica, aluguel/condomínio, água, energia elétrica, gás de cozinha, medicamentos de uso contínuo com receita médica e transporte para o trabalho. Assinaturas, compras a prazo de bens supérfluos e restaurantes são excluídos.",
  },
  {
    question: "Financiamento imobiliário e pensão entram no mínimo existencial?",
    answer:
      "Não. Dívidas de pensão alimentícia, financiamento habitacional de longo prazo, tributos fiscais (IPTU, IPVA) e créditos rurais não entram na renegociação do superendividamento.",
  },
];

export default function Page() {
  return (
    <>
      <JsonLd
        data={buildArticleSchema({
          title: "Mínimo Existencial no Brasil: o que é, quanto vale e quais despesas são protegidas por lei",
          description:
            "Tudo sobre o Decreto nº 11.567/2023, o valor do mínimo existencial, quais gastos são protegidos contra descontos de bancos e como impedir que empréstimos consumam seu salário.",
          urlPath: "/minimo-existencial",
        })}
      />
      <JsonLd data={buildFaqSchema(MINIMO_FAQS)} />
      <ContentPage
        title="Mínimo Existencial: a proteção da lei contra o confisco do seu salário"
        intro="Nenhum banco ou financeira pode cobrar parcelas a ponto de deixar você ou seus dependentes sem dinheiro para comida, remédio ou moradia. Conheça as regras do Decreto nº 11.567/2023 e como defender seus rendimentos."
      >
      <Section heading="1. O que é o Mínimo Existencial?">
        <p>
          O <strong>Mínimo Existencial</strong> é uma garantia legal e constitucional derivada do princípio da
          dignidade da pessoa humana. Regulamentado pelo <strong>Decreto nº 11.567/2023</strong>, ele representa
          uma quantia indispensável para que o cidadão pague suas contas mais básicas de subsistência.
        </p>
        <p>
          Em termos práticos: quando a soma dos empréstimos consignados, cartões de crédito e débitos em conta
          deixa a pessoa com menos do que o necessário para sobreviver, há uma violação direta da legislação brasileira.
        </p>
      </Section>

      <Section heading="2. Quanto vale o Mínimo Existencial em 2026?">
        <p>
          O valor de referência fixado pelo governo federal no Decreto 11.567/2023 é de <strong>R$ 600,00 por pessoa</strong>.
          Contudo, a jurisprudência dominante nos Tribunais de Justiça e no Superior Tribunal de Justiça (STJ) entende que:
        </p>
        <Bullets
          items={[
            "O valor de R$ 600 é apenas um piso federal genérico para programas de assistência.",
            "O verdadeiro mínimo existencial deve considerar a composição do núcleo familiar (número de dependentes, crianças e idosos sob tutela).",
            "Gastos com saúde essencial comprovada (doenças crônicas, compra contínua de medicamentos) elevam o valor do mínimo existencial individual.",
            "Descontos de empréstimos em folha de pagamento ou em conta corrente não podem comprometer mais de 30% a 35% dos proventos líquidos.",
          ]}
        />
      </Section>

      <Section heading="3. Quais despesas entram no cálculo das despesas essenciais?">
        <p>Apenas gastos estritamente ligados à subsistência compõem o mínimo existencial:</p>
        <Bullets
          items={[
            "Moradia: Aluguel comprovado por contrato, condomínio e taxa de água e esgoto.",
            "Energia e Gás: Contas de luz e botijão de gás doméstico.",
            "Alimentação Básica: Alimentos de primeira necessidade e nutrição familiar (excluindo restaurantes e delivery).",
            "Saúde: Medicamentos de uso contínuo, tratamentos essenciais e planos de saúde básicos.",
            "Educação: Material escolar básico e transporte para escola de dependentes.",
            "Transporte de Trabalho: Condução pública ou combustível estrito para deslocamento laboral.",
          ]}
        />
      </Section>

      <Section heading="4. Quais dívidas NÃO entram na Lei do Superendividamento?">
        <p>É importante estar atento às dívidas que a lei exclui expressamente do benefício da repactuação:</p>
        <Bullets
          items={[
            "Dívidas de pensão alimentícia (têm caráter de sobrevivência imediata de terceiros).",
            "Tributos e impostos fiscais (IPTU, IPVA, Imposto de Renda).",
            "Multas penais e sanções administrativas.",
            "Créditos rurais e financiamentos imobiliários de longo prazo (possuem regras contratuais e garantias reais próprias).",
            "Dívidas contraídas mediante fraude dolosa comprovada.",
          ]}
        />
      </Section>

      <Section heading="5. Como calcular sua margem real no Conta Comigo">
        <p>
          No Conta Comigo, você não precisa fazer contas complexas na mão. Nossa ferramenta cruza automaticamente
          suas receitas com seus compromissos e exibe se o Mínimo Existencial está sendo violado pelas instituições financeiras.
        </p>
        <p className="mt-4">
          <Link
            href="/app/superendividamento"
            className="inline-block rounded-xl bg-[color:var(--color-brand-600)] px-5 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-95"
          >
            Calcular meu Mínimo Existencial no Conta Comigo &rarr;
          </Link>
        </p>
      </Section>

      <Section heading="6. Perguntas frequentes sobre o Mínimo Existencial">
        <div className="mt-4 space-y-3">
          {MINIMO_FAQS.map((faq) => (
            <details
              key={faq.question}
              className="group rounded-xl border border-[color:var(--card-border)] bg-[color:var(--card-bg)] p-4 open:bg-[color:var(--color-surface-sunken)]"
            >
              <summary className="flex cursor-pointer items-center justify-between font-medium text-sm text-[color:var(--color-foreground)]">
                <span>{faq.question}</span>
                <span className="ml-2 text-base text-[color:var(--muted-fg)] transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-2 text-sm leading-relaxed text-[color:var(--muted-fg)]">
                {faq.answer}
              </p>
            </details>
          ))}
        </div>
      </Section>

      <Section heading="Leituras complementares essenciais">
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href="/lei-do-superendividamento"
            className="rounded-lg border border-[color:var(--card-border)] p-4 transition-colors hover:border-[color:var(--color-brand-600)]"
          >
            <strong className="block text-sm font-semibold">Lei do Superendividamento (Lei 14.181/2021)</strong>
            <span className="text-xs text-[color:var(--muted-fg)]">
              Direitos, renegociação em bloco e prazos legais.
            </span>
          </Link>
          <Link
            href="/como-provar-superendividamento"
            className="rounded-lg border border-[color:var(--card-border)] p-4 transition-colors hover:border-[color:var(--color-brand-600)]"
          >
            <strong className="block text-sm font-semibold">Como Provar o Superendividamento</strong>
            <span className="text-xs text-[color:var(--muted-fg)]">
              Documentos essenciais e o erro que anula o pedido.
            </span>
          </Link>
          <Link
            href="/acao-de-repactuacao-de-dividas"
            className="rounded-lg border border-[color:var(--card-border)] p-4 transition-colors hover:border-[color:var(--color-brand-600)]"
          >
            <strong className="block text-sm font-semibold">Ação de Repactuação de Dívidas</strong>
            <span className="text-xs text-[color:var(--muted-fg)]">
              Como funciona a audiência de conciliação no Procon e CEJUSC.
            </span>
          </Link>
          <Link
            href="/corte-inteligente-de-gastos"
            className="rounded-lg border border-[color:var(--card-border)] p-4 transition-colors hover:border-[color:var(--color-brand-600)]"
          >
            <strong className="block text-sm font-semibold">Corte Inteligente de Gastos</strong>
            <span className="text-xs text-[color:var(--muted-fg)]">
              Como cortar supérfluos sem comprometer o essencial da casa.
            </span>
          </Link>
        </div>
      </Section>
    </ContentPage>
    </>
  );
}

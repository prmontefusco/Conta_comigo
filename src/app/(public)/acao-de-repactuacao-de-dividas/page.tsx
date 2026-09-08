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
  title: "Ação de Repactuação de Dívidas: passo a passo no Procon, CEJUSC e Justiça (Lei 14.181/2021)",
  description:
    "Como funciona o processo de repactuação de dívidas, carência de até 180 dias, quitação em até 5 anos e como solicitar auxílio na Defensoria Pública ou Procon.",
  keywords: [
    "ação de repactuação de dívidas",
    "processo lei superendividamento",
    "audiência de conciliação dívidas",
    "cejusc superendividamento",
    "plano de pagamento 5 anos",
    "carência 180 dias dívidas",
    "plano judicial compulsório art 104-B",
    "defensoria pública superendividamento",
  ],
  alternates: { canonical: "/acao-de-repactuacao-de-dividas" },
};

const REPACTUACAO_FAQS: readonly FaqItem[] = [
  {
    question: "O que acontece se um banco não comparecer à audiência de conciliação?",
    answer:
      "A Lei 14.181/2021 determina a suspensão imediata da exigibilidade do débito e o congelamento dos juros de mora. O credor faltoso fica obrigado a aceitar o plano imposto e só recebe depois que todos os outros bancos presentes tiverem sido pagos.",
  },
  {
    question: "Qual o prazo máximo para pagar as dívidas repactuadas?",
    answer:
      "O plano de pagamento da Lei do Superendividamento pode ter duração de até 5 anos (60 meses), com uma carência inicial de até 180 dias (6 meses) para início do primeiro pagamento.",
  },
  {
    question: "Onde posso dar entrada na repactuação de dívidas gratuitamente?",
    answer:
      "Você pode dar entrada no Procon municipal, no portal Consumidor.gov.br, na Defensoria Pública do Estado (NUDECON) ou no Centro Judiciário de Solução de Conflitos (CEJUSC) do fórum da sua cidade.",
  },
  {
    question: "Meu nome fica limpo durante a repactuação?",
    answer:
      "Sim. Com a homologação do acordo de repactuação ou a concessão de liminar judicial, os órgãos de proteção ao crédito (Serasa, SPC) retiram os apontamentos negativos referentes às dívidas incluídas no plano.",
  },
];

export default function Page() {
  return (
    <>
      <JsonLd
        data={buildArticleSchema({
          title: "Ação de Repactuação de Dívidas: passo a passo no Procon, CEJUSC e Justiça (Lei 14.181/2021)",
          description:
            "Como funciona o processo de repactuação de dívidas, carência de até 180 dias, quitação em até 5 anos e como solicitar auxílio na Defensoria Pública ou Procon.",
          urlPath: "/acao-de-repactuacao-de-dividas",
        })}
      />
      <JsonLd data={buildFaqSchema(REPACTUACAO_FAQS)} />
      <ContentPage
        title="Ação de Repactuação de Dívidas: o guia prático do Procon à Justiça"
        intro="A Lei nº 14.181/2021 criou um rito processual inovador no Brasil: em vez de você ser processado isoladamente por vários bancos, você chama todos eles para uma mesa conjunta e propõe um plano de até 5 anos que cabe no seu bolso."
      >
      <Section heading="1. As 3 fases do processo de Repactuação">
        <p>
          O procedimento da Lei do Superendividamento foi concebido para priorizar a solução rápida e amigável,
          evitando litígios demorados:
        </p>
        <Bullets
          items={[
            "Fase 1: Conciliação Extrajudicial (Procon ou Consumidor.gov.br) — Todos os bancos são notificados para comparecer a uma mesa de negociação conjunta para ouvir sua proposta de pagamento.",
            "Fase 2: Audiência de Conciliação Pré-Processual (CEJUSC) — Conduzida por um conciliador judicial do Tribunal de Justiça. Se houver acordo, o termo é homologado pelo juiz com força de sentença irrecorrível.",
            "Fase 3: Processo por Superendividamento e Plano Compulsório (Art. 104-B do CDC) — Se os credores se recusarem a negociar ou faltarem à audiência injustificadamente, o juiz impõe um plano judicial obrigatório, cortando juros moratórios e multas.",
          ]}
        />
      </Section>

      <Section heading="2. O que o plano de pagamento pode exigir?">
        <p>O Código de Defesa do Consumidor estipula benefícios que você não consegue em negociações comuns:</p>
        <Bullets
          items={[
            "Prazo de quitação de até 5 anos (60 meses) para o saldo devedor renegociado.",
            "Período de carência de até 180 dias (6 meses) para início do pagamento da primeira parcela.",
            "Supressão de juros moratórios, taxas de inadimplência e multas abusivas acumuladas.",
            "Suspensão de cobranças extrajudiciais, ligações insistentes e ações de cobrança individuais.",
            "Preservação do nome limpo e restabelecimento gradual do acesso a serviços essenciais.",
          ]}
        />
      </Section>

      <Section heading="3. O credor pode se recusar a comparecer?">
        <p>
          A Lei 14.181/2021 previu uma punição severa para bancos que ignoram o consumidor: o credor que não comparecer
          à audiência de conciliação <strong>tem a exigibilidade do débito suspensa e os juros de mora interrompidos</strong>.
        </p>
        <p>
          Além disso, o banco ausente fica obrigado a aceitar as condições mais desfavoráveis e só recebe seus créditos
          depois que todos os demais credores conciliados tiverem sido integralmente pagos.
        </p>
      </Section>

      <Section heading="4. Como dar entrada gratuitamente sem custos advocatícios">
        <p>
          Se a sua renda familiar não permite pagar um advogado particular, você tem direito constitucional
          à assistência jurídica integral e gratuita:
        </p>
        <Bullets
          items={[
            "Procure a Defensoria Pública do seu Estado e solicite agendamento no Núcleo de Defesa do Consumidor (NUDECON).",
            "Consulte o Centro Judiciário de Solução de Conflitos e Cidadania (CEJUSC) do fórum da sua comarca.",
            "Compareça ao Procon municipal ou registre pedido no portal oficial Consumidor.gov.br.",
          ]}
        />
        <p className="mt-4">
          Com o <strong>Conta Comigo</strong>, você gera o Dossiê completo com as despesas discriminadas,
          gastos cortados e o cálculo do rateio em 60 meses, levando um documento técnico pronto para agilizar o atendimento.
        </p>
        <p className="mt-4">
          <Link
            href="/app/superendividamento"
            className="inline-block rounded-xl bg-[color:var(--color-brand-600)] px-5 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-95"
          >
            Gerar meu Dossiê de Repactuação no Conta Comigo &rarr;
          </Link>
        </p>
      </Section>

      <Section heading="5. Perguntas frequentes sobre Repactuação">
        <div className="mt-4 space-y-3">
          {REPACTUACAO_FAQS.map((faq) => (
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
            <strong className="block text-sm font-semibold">Lei do Superendividamento explicada</strong>
            <span className="text-xs text-[color:var(--muted-fg)]">
              Entenda os prazos de 5 anos e direitos do devedor de boa-fé.
            </span>
          </Link>
          <Link
            href="/como-provar-superendividamento"
            className="rounded-lg border border-[color:var(--card-border)] p-4 transition-colors hover:border-[color:var(--color-brand-600)]"
          >
            <strong className="block text-sm font-semibold">Como Provar o Superendividamento</strong>
            <span className="text-xs text-[color:var(--muted-fg)]">
              Documentos exigidos pelo juiz e pelo Procon.
            </span>
          </Link>
          <Link
            href="/minimo-existencial"
            className="rounded-lg border border-[color:var(--card-border)] p-4 transition-colors hover:border-[color:var(--color-brand-600)]"
          >
            <strong className="block text-sm font-semibold">Mínimo Existencial (Decreto 11.567)</strong>
            <span className="text-xs text-[color:var(--muted-fg)]">
              Quais gastos essenciais são protegidos da retenção bancária.
            </span>
          </Link>
          <Link
            href="/negociar-dividas"
            className="rounded-lg border border-[color:var(--card-border)] p-4 transition-colors hover:border-[color:var(--color-brand-600)]"
          >
            <strong className="block text-sm font-semibold">Como Negociar Dívidas</strong>
            <span className="text-xs text-[color:var(--muted-fg)]">
              Táticas de contraproposta e canais oficiais de conciliação.
            </span>
          </Link>
        </div>
      </Section>
    </ContentPage>
    </>
  );
}

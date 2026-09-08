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
  title: "Como Provar o Superendividamento na Justiça: o que o juiz exige e o erro que anula seu pedido",
  description:
    "Descubra como comprovar boa-fé perante juízes e no Procon, discriminar despesas essenciais, demonstrar cortes de supérfluos e evitar que seu processo de superendividamento seja negado.",
  keywords: [
    "como provar superendividamento",
    "erro processo superendividamento",
    "boa fé lei 14181",
    "documentos superendividamento",
    "ação de superendividamento",
    "indeferimento lei superendividamento",
    "liminar suspensão descontos empréstimo",
  ],
  alternates: { canonical: "/como-provar-superendividamento" },
};

const PROVAR_FAQS: readonly FaqItem[] = [
  {
    question: "O que o juiz analisa primeiro no pedido de superendividamento?",
    answer:
      "O juiz analisa a boa-fé do devedor e se as despesas apresentadas são estritamente essenciais para a sobrevivência digna. Ele verifica se os gastos supérfluos foram de fato cortados e se a pessoa não contraiu dívidas já sabendo que não pagaria.",
  },
  {
    question: "Por que gastos com streaming ou lazer podem anular o pedido?",
    answer:
      "A Lei 14.181/2021 exige sacrifício pessoal do devedor. Se extratos bancários ainda exibirem assinaturas de streaming, compras em lojas ou delivery sem comprovação de cancelamento, o magistrado pode entender que o consumidor quer manter luxos às custas de não pagar os credores.",
  },
  {
    question: "Quais documentos são obrigatórios para comprovar o superendividamento?",
    answer:
      "Os 3 últimos holerites ou extratos da conta de renda, contratos de empréstimos com taxa de juros e CET, comprovantes de moradia (aluguel/condomínio), recibos de farmácia e tratamentos de saúde contínuos, e uma proposta detalhada de plano de repactuação em até 60 meses.",
  },
  {
    question: "Preciso de advogado para dar entrada na Lei do Superendividamento?",
    answer:
      "Não necessariamente. Você pode iniciar a repactuação extrajudicial no Procon ou em órgãos de conciliação (como CEJUSC) e recorrer à Defensoria Pública se não tiver condições de pagar honorários advocatícios.",
  },
];

export default function Page() {
  return (
    <>
      <JsonLd
        data={buildArticleSchema({
          title: "Como Provar o Superendividamento na Justiça: o que o juiz exige e o erro que anula seu pedido",
          description:
            "Descubra como comprovar boa-fé perante juízes e no Procon, discriminar despesas essenciais e evitar indeferimento.",
          urlPath: "/como-provar-superendividamento",
        })}
      />
      <JsonLd data={buildFaqSchema(PROVAR_FAQS)} />
      <ContentPage
        title="Como provar o superendividamento na Justiça (e não ter o pedido negado)"
        intro="Muitos pedidos de repactuação judicial e suspensão de parcelas são indeferidos porque o consumidor anexa extratos sem discriminar o que já cortou. Entenda o que juízes e promotores realmente avaliam para conceder a proteção da Lei 14.181/2021."
      >
      <Section heading="1. O maior erro que faz o juiz rejeitar seu pedido">
        <p>
          Quando alguém entra com uma ação judicial de superendividamento ou procura a Defensoria Pública,
          o juiz analisa atentamente o padrão de gastos da família.
        </p>
        <p>
          O erro mais frequente — e mais prejudicial — é <strong>anexar faturas e extratos antigos com gastos supérfluos
          (como Netflix, restaurantes, compras em lojas ou delivery) sem comprovar expressamente que esses gastos já foram cancelados</strong>.
        </p>
        <p>
          Se o juiz vê assinaturas de streaming ou lazer nas planilhas, ele pode concluir que o devedor deseja
          &quot;manter um padrão de consumo confortável às custas dos credores&quot;, negando liminares de suspensão de descontos.
          É indispensável comprovar o sacrifício pessoal prévio.
        </p>
      </Section>

      <Section heading="2. O tripé que comprova sua Boa-Fé perante o juiz">
        <p>
          O artigo 54-A do Código de Defesa do Consumidor exige que o devedor seja de <strong>boa-fé</strong>.
          Para provar isso de maneira irrefutável na petição, seu dossiê deve ser dividido em três quadros obrigatórios:
        </p>
        <Bullets
          items={[
            "Quadro de Despesas Essenciais Atuais (Mínimo Existencial): Moradia básica, água, luz, alimentação básica, farmácia e remédios contínuos, transporte estrito para o trabalho.",
            "Quadro de Sacrifício Pessoal e Gastos Já Cortados: Uma lista explícita comprovando que você já cancelou assinaturas digitais, zerou refeições fora de casa, cancelou academias e eliminou supérfluos, demonstrando economia mensal de centenas de reais.",
            "Balanço Patrimonial Transparente: Declaração de que você não escondeu bens, não fez doações suspeitas nem adquiriu bens de luxo antes de ingressar com a repactuação.",
          ]}
        />
      </Section>

      <Section heading="3. Documentos obrigatórios para instruir o processo">
        <p>Antes de protocolar a ação ou comparecer à audiência do CEJUSC, organize os seguintes documentos:</p>
        <Bullets
          items={[
            "Os 3 últimos contracheques / holerites ou extratos da conta corrente que recebe sua renda líquida.",
            "Contratos de empréstimos, financiamentos e cédulas de crédito bancário (CCB) com taxas de juros e CET.",
            "Comprovantes de gastos com saúde (receitas médicas contínuas, laudos ou notas fiscais de farmácia).",
            "Comprovantes de moradia (contrato de aluguel ou recibos de condomínio/IPTU).",
            "Declaração do Imposto de Renda recente ou extrato de isenção da Receita Federal.",
            "Plano de Repactuação em até 60 meses, demonstrando exatamente quanto sobra da renda após garantir a subsistência básica.",
          ]}
        />
      </Section>

      <Section heading="4. Como o Conta Comigo ajuda você a montar seu dossiê">
        <p>
          O aplicativo Conta Comigo possui um módulo exclusivo de <strong>Superendividamento (Lei 14.181/2021)</strong>,
          desenvolvido exatamente para separar suas despesas essenciais daquilo que já foi cortado, calculando
          a margem real de amortização e gerando um dossiê técnico com auxílio de Inteligência Artificial pronto
          para ser anexado ao seu pedido na Justiça, Defensoria Pública ou Procon.
        </p>
        <p className="mt-4">
          <Link
            href="/app/superendividamento"
            className="inline-block rounded-xl bg-[color:var(--color-brand-600)] px-5 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-95"
          >
            Acessar o Dossiê de Superendividamento no Conta Comigo &rarr;
          </Link>
        </p>
      </Section>

      <Section heading="5. Dúvidas frequentes sobre provas do superendividamento">
        <div className="mt-4 space-y-3">
          {PROVAR_FAQS.map((faq) => (
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
              Entenda os prazos de 5 anos e carência de até 180 dias.
            </span>
          </Link>
          <Link
            href="/minimo-existencial"
            className="rounded-lg border border-[color:var(--card-border)] p-4 transition-colors hover:border-[color:var(--color-brand-600)]"
          >
            <strong className="block text-sm font-semibold">Mínimo Existencial (Decreto 11.567)</strong>
            <span className="text-xs text-[color:var(--muted-fg)]">
              Saiba qual valor é protegido contra descontos abusivos de bancos.
            </span>
          </Link>
          <Link
            href="/acao-de-repactuacao-de-dividas"
            className="rounded-lg border border-[color:var(--card-border)] p-4 transition-colors hover:border-[color:var(--color-brand-600)]"
          >
            <strong className="block text-sm font-semibold">Ação de Repactuação de Dívidas</strong>
            <span className="text-xs text-[color:var(--muted-fg)]">
              O passo a passo do Procon e CEJUSC até a audiência de conciliação.
            </span>
          </Link>
          <Link
            href="/como-sair-das-dividas"
            className="rounded-lg border border-[color:var(--card-border)] p-4 transition-colors hover:border-[color:var(--color-brand-600)]"
          >
            <strong className="block text-sm font-semibold">Como Sair das Dívidas</strong>
            <span className="text-xs text-[color:var(--muted-fg)]">
              Métodos Bola de Neve e Avalanche para quitar contas.
            </span>
          </Link>
        </div>
      </Section>
    </ContentPage>
    </>
  );
}

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
  title: "Orçamento familiar: dividir contas sem transformar dinheiro em briga",
  description:
    "Como separar despesas da casa das despesas pessoais, o que compartilhar entre membros da família e por que planejado, comprometido e realizado são três números diferentes.",
  keywords: [
    "orçamento familiar",
    "gestão financeira familiar",
    "divisão de contas de casal",
    "como dividir contas em casa",
    "planejamento financeiro familiar",
    "controle de gastos família",
    "aplicativo financeiro para casal",
    "reunião financeira familiar",
  ],
  alternates: { canonical: "/orcamento-familiar" },
};

const FAMILIAR_FAQS: readonly FaqItem[] = [
  {
    question: "Como dividir as contas do casal de forma justa?",
    answer:
      "A divisão mais saudável e sustentável é a proporcional à renda líquida: quem ganha 60% da renda do casal assume 60% das despesas fixas da casa. Isso preserva a autonomia e capacidade de poupança individual de ambos.",
  },
  {
    question: "Como evitar brigas por dinheiro na família?",
    answer:
      "Separando com clareza os gastos 'da casa' dos gastos 'pessoais'. Os gastos da casa são compartilhados e decididos em conjunto; os gastos pessoais pertencem exclusivamente a cada um, sem necessidade de justificativas minuciosas.",
  },
  {
    question: "Qual a diferença entre saldo planejado, comprometido e realizado?",
    answer:
      "Planejado é a estimativa inicial; realizado é o que já saiu da conta; comprometido são contas e parcelas que já existem e vencerão no mês. Ignorar o saldo comprometido é a razão número 1 para orçamentos estourarem de surpresa.",
  },
  {
    question: "Os filhos devem ter acesso ao orçamento dos pais?",
    answer:
      "É recomendável envolver filhos em decisões educativas sobre metas da casa, mas com níveis de permissão adequados: eles podem lançar pequenos gastos diários sem ter acesso irrestrito ao salário integral ou a dívidas complexas dos pais.",
  },
];

export default function Page() {
  return (
    <>
      <JsonLd
        data={buildArticleSchema({
          title: "Orçamento familiar: dividir contas sem transformar dinheiro em briga",
          description:
            "Como separar despesas da casa das despesas pessoais e dominar a gestão financeira familiar.",
          urlPath: "/orcamento-familiar",
        })}
      />
      <JsonLd data={buildFaqSchema(FAMILIAR_FAQS)} />
      <ContentPage
        title="Orçamento familiar"
        intro="Duas pessoas com a mesma renda e as mesmas contas podem discordar profundamente sobre dinheiro — quase sempre porque estão olhando números diferentes."
      >
      <Section heading="Nem tudo precisa ser compartilhado">
        <p>
          Numa casa existem gastos que são de todos e gastos que são de um. A conta de energia é da
          casa. A academia de alguém é dessa pessoa. Misturar as duas coisas produz discussões que
          não são sobre dinheiro, são sobre categoria.
        </p>
        <p>
          Marcar cada despesa como &quot;da casa&quot; ou &quot;pessoal&quot; permite ver o custo
          real da moradia sem que ele fique inflado por escolhas individuais, e permite que cada
          pessoa acompanhe as próprias sem prestar contas de tudo.
        </p>
      </Section>

      <Section heading="Papéis diferentes, acesso diferente">
        <p>
          Nem todo mundo precisa poder alterar tudo. Alguém que só quer acompanhar a situação pode
          ver sem editar; quem cuida do dia a dia registra pagamentos; quem administra gerencia
          membros e configurações.
        </p>
        <p>Isso não é desconfiança. É evitar edições acidentais e deixar claro quem fez o quê.</p>
      </Section>

      <Section heading="Três números, não dois">
        <p>
          A maioria dos orçamentos compara planejado com gasto. Falta o número do meio, que é o que
          muda decisões:
        </p>
        <Bullets
          items={[
            "Planejado: quanto vocês decidiram destinar à categoria neste mês.",
            "Comprometido: contas do mês que já existem e ainda não foram pagas.",
            "Realizado: o que já saiu.",
          ]}
        />
        <p>
          Com R$ 1.500 planejados para alimentação, R$ 900 já gastos e R$ 400 de uma compra
          parcelada caindo este mês, restam R$ 200 — e não R$ 600. Essa diferença é a origem de boa
          parte dos meses que &quot;estouram do nada&quot;.
        </p>
      </Section>

      <Section heading="Comece pelo que já existe">
        <p>
          Um orçamento montado a partir de números desejados quase sempre é abandonado no segundo
          mês. Um orçamento montado a partir da média real dos últimos meses tem chance de durar.
        </p>
        <p>
          Primeiro observe. Depois ajuste, uma categoria por vez, começando pela que mais incomoda
          os dois.
        </p>
      </Section>

      <Section heading="Conversas que funcionam melhor com números na mesa">
        <Bullets
          items={[
            "Quanto custa manter esta casa por mês, sem contar gastos pessoais?",
            "Quanto de cada renda vai para despesas compartilhadas?",
            "Quanto dos próximos três meses já está comprometido?",
            "Quanto conseguimos separar por mês sem apertar o essencial?",
            "Se uma renda cair, por quanto tempo a reserva sustenta a casa?",
          ]}
        />
        <p>
          Nenhuma dessas perguntas tem resposta certa. Todas ficam mais fáceis quando as duas
          pessoas estão olhando exatamente a mesma tela.
        </p>
      </Section>

      <Section heading="Uma reserva da casa e reservas pessoais">
        <p>
          Vale ter uma reserva compartilhada para o que afeta a todos — uma emergência médica, um
          eletrodoméstico que quebra, uma perda de renda — e permitir reservas individuais para
          objetivos de cada um.
        </p>
        <p>
          Ambas saem do saldo disponível e nenhuma é gasto. Continuam sendo patrimônio da família;
          só deixaram de estar em jogo.
        </p>
      </Section>

      <Section heading="Perguntas frequentes sobre Orçamento Familiar">
        <div className="mt-4 space-y-3">
          {FAMILIAR_FAQS.map((faq) => (
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

      <Section heading="Leituras recomendadas">
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href="/financas-para-casais"
            className="rounded-lg border border-[color:var(--card-border)] p-4 transition-colors hover:border-[color:var(--color-brand-600)]"
          >
            <strong className="block text-sm font-semibold">Finanças para Casais</strong>
            <span className="text-xs text-[color:var(--muted-fg)]">
              Modelos de conta conjunta, proporcionalidade e autonomia.
            </span>
          </Link>
          <Link
            href="/regra-50-30-20"
            className="rounded-lg border border-[color:var(--card-border)] p-4 transition-colors hover:border-[color:var(--color-brand-600)]"
          >
            <strong className="block text-sm font-semibold">Regra 50-30-20 na Prática</strong>
            <span className="text-xs text-[color:var(--muted-fg)]">
              Como equilibrar necessidades, desejos e reservas familiares.
            </span>
          </Link>
          <Link
            href="/como-sair-das-dividas"
            className="rounded-lg border border-[color:var(--card-border)] p-4 transition-colors hover:border-[color:var(--color-brand-600)]"
          >
            <strong className="block text-sm font-semibold">Como Sair das Dívidas</strong>
            <span className="text-xs text-[color:var(--muted-fg)]">
              Estratégias para quitar dívidas e proteger o orçamento familiar.
            </span>
          </Link>
          <Link
            href="/lei-do-superendividamento"
            className="rounded-lg border border-[color:var(--card-border)] p-4 transition-colors hover:border-[color:var(--color-brand-600)]"
          >
            <strong className="block text-sm font-semibold">Lei do Superendividamento</strong>
            <span className="text-xs text-[color:var(--muted-fg)]">
              Proteção jurídica contra o comprometimento da sobrevivência da casa.
            </span>
          </Link>
        </div>
      </Section>
    </ContentPage>
    </>
  );
}

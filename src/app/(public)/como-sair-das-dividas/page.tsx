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
  title: "Como sair das dívidas: o passo a passo prático para recuperar o fôlego",
  description:
    "Estancar o sangramento dos juros, listar o que realmente se deve e aplicar métodos comprovados (Bola de Neve e Avalanche) para reconquistar sua paz financeira.",
  keywords: [
    "como sair das dívidas",
    "quitar dívidas rápido",
    "método bola de neve",
    "método avalanche",
    "renegociação de dívidas",
    "desenrola brasil",
    "limpa nome",
    "endividamento familiar",
    "priorizar dívidas",
  ],
  alternates: { canonical: "/como-sair-das-dividas" },
};

const DIVIDAS_FAQS: readonly FaqItem[] = [
  {
    question: "Qual o melhor método para pagar dívidas: Bola de Neve ou Avalanche?",
    answer:
      "Matematicamente, o Método Avalanche é mais econômico, pois você prioriza as taxas de juros mais altas (cartão de crédito e cheque especial). Porém, psicologicamente, o Método Bola de Neve (quitar primeiro as menores dívidas) traz vitórias rápidas e motivação imediata para continuar.",
  },
  {
    question: "Vale a pena guardar dinheiro enquanto estou endividado?",
    answer:
      "Sim. Manter uma micro-reserva de segurança de R$ 500 a R$ 1.000 evita que qualquer imprevisto do dia a dia (remédio urgente, conserto doméstico) faça você recorrer a novos empréstimos com juros abusivos.",
  },
  {
    question: "O que fazer se as parcelas das dívidas forem maiores que meu salário?",
    answer:
      "Quando a soma das parcelas consome sua sobrevivência básica, você se enquadra na Lei do Superendividamento (Lei 14.181/2021). Você pode acionar o Procon ou a Defensoria Pública para convocar os credores e exigir um plano de repactuação em até 5 anos.",
  },
  {
    question: "Devo usar o FGTS para quitar dívidas?",
    answer:
      "O saque emergencial ou aniversário do FGTS só deve ser usado para abater dívidas que tenham juros maiores do que o rendimento do fundo (como cartão rotativo ou cheque especial) e mediante desconto expressivo no valor principal.",
  },
];

export default function Page() {
  return (
    <>
      <JsonLd
        data={buildArticleSchema({
          title: "Como sair das dívidas: o passo a passo prático para recuperar o fôlego",
          description:
            "Estancar o sangramento dos juros, listar o que realmente se deve e aplicar métodos comprovados (Bola de Neve e Avalanche) para reconquistar sua paz financeira.",
          urlPath: "/como-sair-das-dividas",
        })}
      />
      <JsonLd data={buildFaqSchema(DIVIDAS_FAQS)} />
      <ContentPage
        title="Como sair das dívidas sem desespero"
        intro="Sair das dívidas não é uma questão de culpa moral ou força de vontade cega. É um problema de estratégia, matemática clara e passos práticos na ordem certa."
      >
      <Section heading="1. O primeiro passo: parar o sangramento">
        <p>
          Antes de tentar pagar tudo de uma vez, a regra de ouro é: <strong>não crie novas dívidas</strong>.
          Continuar usando o cartão de crédito ou pegando empréstimos para pagar parcelas antigas é como
          tentar secar o chão com a torneira aberta.
        </p>
        <p>
          Bloqueie temporariamente as compras a prazo e adote a regra do dinheiro ou Pix para as despesas
          do mês. Ver o dinheiro saindo na hora quebra a ilusão de fôlego que o limite do cartão provoca.
        </p>
      </Section>

      <Section heading="2. Faça o raio-x honesto de tudo o que deve">
        <p>
          A ansiedade financeira se alimenta da incerteza. Muitas pessoas sabem que estão endividadas,
          mas não sabem o valor exato total. Isso gera pânico desproporcional ou paralisia.
        </p>
        <p>Reúna todos os contratos, faturas e carnês e anote em um só lugar:</p>
        <Bullets
          items={[
            "O saldo devedor total (o valor real para quitar hoje, sem juros futuros).",
            "A taxa de juros mensal e o Custo Efetivo Total (CET).",
            "O valor da parcela e a data de vencimento.",
            "O tipo de dívida: se tem bens em garantia (carro, casa), se é consignado ou cartão rotativo.",
          ]}
        />
      </Section>

      <Section heading="3. Priorização: quais dívidas pagar primeiro?">
        <p>Nem todas as dívidas são iguais. Existem duas prioridades urgentes antes de qualquer estratégia:</p>
        <Bullets
          items={[
            "Dívidas que cortam serviços essenciais: água, luz e gás precisam estar em dia para a família manter a dignidade.",
            "Dívidas com bens em garantia: financiamento de veículo ou imóvel, cujo atraso pode acarretar busca e apreensão ou leilão.",
          ]}
        />
        <p>
          Em seguida, separe as dívidas de consumo (cartão, cheque especial, empréstimo pessoal) e escolha um
          dos dois métodos matemáticos:
        </p>
      </Section>

      <Section heading="4. Método Bola de Neve vs. Método Avalanche">
        <p>
          No <strong>Método Avalanche</strong>, você paga o valor mínimo de todas as dívidas e concentra todo
          o dinheiro extra disponível na dívida com a <em>maior taxa de juros</em> (geralmente cartão de crédito ou cheque especial).
          Matematicamente, é o método que mais economiza dinheiro ao longo do tempo.
        </p>
        <p>
          No <strong>Método Bola de Neve</strong>, você paga o mínimo de todas e ataca com força total a
          dívida de <em>menor valor absoluto</em>, independentemente dos juros. Ao liquidar rapidamente uma conta
          pequena, você sente a vitória psicológica e libera o valor daquela parcela para acelerar as próximas.
          Para quem está muito desanimado, o efeito psicológico da Bola de Neve costuma fazer a diferença entre persistir ou desistir.
        </p>
      </Section>

      <Section heading="5. Crie uma micro-reserva de segurança">
        <p>
          Pode parecer contra-intuitivo guardar dinheiro enquanto se tem dívidas, mas ter de R$ 500 a R$ 1.000
          separados é o escudo que evita uma nova dívida. Se um remédio ou conserto urgente acontecer no meio do
          caminho, essa reserva absorve o impacto sem jogar você de volta ao rotativo do cartão.
        </p>
      </Section>

      <Section heading="6. E se a conta não fechar de jeito nenhum?">
        <p>
          Se o total das parcelas mínimas ultrapassar sua renda líquida mensal, o plano não é viável apenas
          com cortes de gastos. Não se culpe: quando a matemática não fecha, o caminho não é &ldquo;apertar os cintos&rdquo;,
          mas sim <strong>renegociar prazos</strong>, buscar portabilidade ou participar de feirões oficiais como o
          Desenrola Brasil e o Feirão Limpa Nome.
        </p>
        <p className="mt-4">
          <Link
            href="/app/superendividamento"
            className="inline-block rounded-xl bg-[color:var(--color-brand-600)] px-5 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-95"
          >
            Fazer Diagnóstico de Superendividamento no Conta Comigo &rarr;
          </Link>
        </p>
      </Section>

      <Section heading="7. Perguntas frequentes sobre como quitar dívidas">
        <div className="mt-4 space-y-3">
          {DIVIDAS_FAQS.map((faq) => (
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
            <strong className="block text-sm font-semibold">Lei do Superendividamento</strong>
            <span className="text-xs text-[color:var(--muted-fg)]">
              Como repactuar dívidas que ultrapassam sua renda com respaldo legal.
            </span>
          </Link>
          <Link
            href="/minimo-existencial"
            className="rounded-lg border border-[color:var(--card-border)] p-4 transition-colors hover:border-[color:var(--color-brand-600)]"
          >
            <strong className="block text-sm font-semibold">Mínimo Existencial</strong>
            <span className="text-xs text-[color:var(--muted-fg)]">
              Impeça que cobranças e parcelas confisquem o dinheiro da comida.
            </span>
          </Link>
          <Link
            href="/orcamento-familiar"
            className="rounded-lg border border-[color:var(--card-border)] p-4 transition-colors hover:border-[color:var(--color-brand-600)]"
          >
            <strong className="block text-sm font-semibold">Orçamento Familiar</strong>
            <span className="text-xs text-[color:var(--muted-fg)]">
              Divida as contas da casa sem gerar desavenças na família.
            </span>
          </Link>
          <Link
            href="/corte-inteligente-de-gastos"
            className="rounded-lg border border-[color:var(--card-border)] p-4 transition-colors hover:border-[color:var(--color-brand-600)]"
          >
            <strong className="block text-sm font-semibold">Corte Inteligente de Gastos</strong>
            <span className="text-xs text-[color:var(--muted-fg)]">
              Onde economizar sem destruir a qualidade de vida.
            </span>
          </Link>
        </div>
      </Section>
    </ContentPage>
    </>
  );
}

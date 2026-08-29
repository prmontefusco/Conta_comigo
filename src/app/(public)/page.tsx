import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  // `absolute` evita o sufixo do template do layout raiz, que aqui produziria
  // "Conta comigo — ... | Conta comigo".
  title: {
    absolute: "Conta comigo — quanto tenho, quanto já comprometi, para onde estou indo",
  },
  description:
    "Uma ferramenta de planejamento financeiro pessoal e familiar que mostra o saldo real, " +
    "o que já está comprometido e como serão os próximos meses. Sem julgamento.",
  alternates: { canonical: "/" },
};

const QUESTIONS = [
  "Quanto dinheiro eu tenho hoje, de verdade?",
  "Quanto disso já está comprometido com contas deste mês?",
  "Quais contas vencem primeiro?",
  "Quanto vai sobrar no fim do mês?",
  "Uma compra parcelada cabe no meu orçamento?",
  "Se minha renda cair, o que acontece?",
  "Como estarão minhas finanças daqui a 3, 6 e 12 meses?",
] as const;

const PRINCIPLES = [
  {
    title: "Transferência não é despesa",
    body:
      "Mover dinheiro entre suas contas não empobrece ninguém. O Conta comigo registra a " +
      "movimentação sem inventar um gasto que não existiu.",
  },
  {
    title: "Empréstimo não é renda",
    body:
      "Receber R$ 10.000 de empréstimo aumenta o que está disponível e, ao mesmo tempo, cria " +
      "uma obrigação. As duas coisas aparecem separadas, porque são coisas diferentes.",
  },
  {
    title: "Reserva não é gasto",
    body:
      "Guardar dinheiro não é perdê-lo. O saldo continua sendo seu; o que muda é quanto está " +
      "disponível para novas decisões. Por isso mostramos saldo total e saldo livre.",
  },
  {
    title: "A fatura do cartão não é uma segunda despesa",
    body:
      "A compra é contabilizada no mês em que aconteceu. Pagar a fatura movimenta dinheiro, " +
      "mas não repete o gasto. Sem isso, o mês parece pior do que é.",
  },
] as const;

export default function HomePage() {
  return (
    <>
      <section className="mx-auto max-w-5xl px-4 py-14 sm:py-20">
        <p className="text-sm font-medium text-[color:var(--color-brand-700)]">
          Planejamento financeiro pessoal e familiar
        </p>
        <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">
          Saber onde você está é o que torna possível decidir para onde ir.
        </h1>
        <p className="mt-4 max-w-2xl text-lg" style={{ color: "var(--muted-fg)" }}>
          O Conta comigo reúne o que você tem, o que já está comprometido e o que ainda vai
          acontecer, e mostra o resultado em números claros. Foi feito para quem precisa entender a
          própria situação, não para quem quer só anotar gastos.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/criar-conta"
            className="inline-flex min-h-12 items-center rounded-lg bg-[color:var(--color-brand-600)] px-6 font-medium text-white"
          >
            Começar agora
          </Link>
          <Link
            href="/como-funciona"
            className="inline-flex min-h-12 items-center rounded-lg border border-[color:var(--card-border)] px-6 font-medium"
          >
            Ver como funciona
          </Link>
        </div>
      </section>

      <section className="border-y border-[color:var(--card-border)] bg-[color:var(--color-surface-sunken)]">
        <div className="mx-auto max-w-5xl px-4 py-14">
          <h2 className="text-2xl font-semibold tracking-tight">
            As perguntas que o aplicativo responde
          </h2>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {QUESTIONS.map((question) => (
              <li
                key={question}
                className="rounded-lg border border-[color:var(--card-border)] bg-[color:var(--card-bg)] p-4"
              >
                {question}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-14">
        <h2 className="text-2xl font-semibold tracking-tight">
          O mês que não fecha aparece antes de chegar
        </h2>
        <p className="mt-3 max-w-2xl" style={{ color: "var(--muted-fg)" }}>
          A maior parte dos apertos não é surpresa: é a soma de compromissos que já existiam. A
          projeção mensal mostra receitas previstas e compromissos assumidos lado a lado, e destaca
          o primeiro mês em que as contas não fecham.
        </p>

        <div
          role="region"
          aria-label="Exemplo de projeção mensal"
          tabIndex={0}
          className="mt-6 overflow-x-auto"
        >
          <table className="w-full min-w-[30rem] border-collapse text-sm">
            <caption className="sr-only">Exemplo de projeção mensal</caption>
            <thead>
              <tr className="border-b border-[color:var(--card-border)] text-left">
                <th scope="col" className="py-2 pr-4 font-medium">
                  Mês
                </th>
                <th scope="col" className="py-2 pr-4 text-right font-medium">
                  Receitas
                </th>
                <th scope="col" className="py-2 pr-4 text-right font-medium">
                  Compromissos
                </th>
                <th scope="col" className="py-2 text-right font-medium">
                  Sobra
                </th>
              </tr>
            </thead>
            <tbody className="tabular">
              <tr className="border-b border-[color:var(--card-border)]">
                <th scope="row" className="py-2.5 pr-4 text-left font-medium">
                  Setembro
                </th>
                <td className="py-2.5 pr-4 text-right">R$ 8.000,00</td>
                <td className="py-2.5 pr-4 text-right">R$ 6.200,00</td>
                <td className="py-2.5 text-right text-[color:var(--color-positive-700)]">
                  R$ 1.800,00
                </td>
              </tr>
              <tr className="border-b border-[color:var(--card-border)]">
                <th scope="row" className="py-2.5 pr-4 text-left font-medium">
                  Outubro
                </th>
                <td className="py-2.5 pr-4 text-right">R$ 8.000,00</td>
                <td className="py-2.5 pr-4 text-right">R$ 7.400,00</td>
                <td className="py-2.5 text-right text-[color:var(--color-positive-700)]">
                  R$ 600,00
                </td>
              </tr>
              <tr className="border-b border-[color:var(--card-border)] bg-[color:var(--color-attention-100)]">
                <th scope="row" className="py-2.5 pr-4 text-left font-medium">
                  Novembro
                </th>
                <td className="py-2.5 pr-4 text-right">R$ 8.000,00</td>
                <td className="py-2.5 pr-4 text-right">R$ 8.700,00</td>
                <td className="py-2.5 text-right text-[color:var(--color-critical-700)]">
                  − R$ 700,00
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="mt-4 max-w-2xl text-sm" style={{ color: "var(--muted-fg)" }}>
          Em agosto já dá para ver o problema de novembro. Três meses de antecedência costumam ser a
          diferença entre ajustar algo e recorrer a crédito caro.
        </p>
      </section>

      <section className="border-t border-[color:var(--card-border)]">
        <div className="mx-auto max-w-5xl px-4 py-14">
          <h2 className="text-2xl font-semibold tracking-tight">
            Contas corretas, não apenas somadas
          </h2>
          <p className="mt-3 max-w-2xl" style={{ color: "var(--muted-fg)" }}>
            Muitos aplicativos tratam tudo como &quot;lançamento&quot;. Isso produz números que
            parecem certos e não são. Aqui, cada tipo de movimento tem o significado que realmente
            tem.
          </p>

          <dl className="mt-8 grid gap-6 sm:grid-cols-2">
            {PRINCIPLES.map((principle) => (
              <div key={principle.title}>
                <dt className="font-semibold">{principle.title}</dt>
                <dd className="mt-1 text-sm" style={{ color: "var(--muted-fg)" }}>
                  {principle.body}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="border-t border-[color:var(--card-border)] bg-[color:var(--color-surface-sunken)]">
        <div className="mx-auto max-w-3xl px-4 py-14 text-center">
          <h2 className="text-2xl font-semibold tracking-tight">Sem sermão, sem culpa</h2>
          <p className="mt-3" style={{ color: "var(--muted-fg)" }}>
            Quem está endividado ou perdido nas contas normalmente já sabe disso. O que falta é
            informação clara. O Conta comigo apresenta fatos e consequências, e deixa a decisão com
            você.
          </p>
          <Link
            href="/criar-conta"
            className="mt-8 inline-flex min-h-12 items-center rounded-lg bg-[color:var(--color-brand-600)] px-6 font-medium text-white"
          >
            Criar conta gratuita
          </Link>
        </div>
      </section>
    </>
  );
}

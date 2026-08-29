"use client";

import Link from "next/link";
import { Button, Card, CardTitle, ProgressBar } from "@/components/ui/primitives";
import { useFinance } from "@/modules/household/ui/finance-provider";

/**
 * Progressive onboarding.
 *
 * Nobody is asked to configure everything before seeing anything. Each step
 * says what it unlocks, so the value of doing it is visible before the work
 * (docs/PRODUCT.md section 13).
 */
export default function OnboardingPage() {
  const finance = useFinance();

  const steps = [
    {
      href: "/app/contas-bancarias",
      title: "Cadastre suas contas e saldos",
      description: "Onde seu dinheiro está hoje. Sem isso, não há de onde partir.",
      unlocks: "Mostra quanto você tem agora.",
      done: finance.accounts.length > 0,
    },
    {
      href: "/app/contas",
      title: "Informe sua renda",
      description: "Salário, benefício ou renda variável. Pode marcar como estimada.",
      unlocks: "Permite projetar quanto vai entrar.",
      done: finance.recurringRules.some((rule) => rule.direction === "INFLOW"),
    },
    {
      href: "/app/contas",
      title: "Cadastre as contas que se repetem",
      description: "Aluguel, energia, internet, escola, plano de saúde.",
      unlocks: "Revela quanto de cada mês já está comprometido.",
      done: finance.recurringRules.some((rule) => rule.direction === "OUTFLOW"),
    },
    {
      href: "/app/cartoes",
      title: "Cadastre seus cartões",
      description: "Com o dia de fechamento e o de vencimento.",
      unlocks: "Coloca cada parcela no mês certo.",
      done: finance.cards.length > 0,
    },
    {
      href: "/app/dividas",
      title: "Cadastre empréstimos e parcelamentos",
      description: "Se existirem. Se não existirem, pode pular.",
      unlocks: "Separa o que é dívida do que é consumo.",
      done: finance.debts.length > 0,
    },
    {
      href: "/app/reservas",
      title: "Separe sua reserva",
      description: "O que você já tem guardado e não pretende gastar.",
      unlocks: "Diferencia saldo total de saldo realmente livre.",
      done: finance.reserves.length > 0,
    },
  ];

  const completed = steps.filter((step) => step.done).length;
  const allDone = completed === steps.length;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Vamos começar</h1>

      <Card>
        <CardTitle hint="Você pode fazer aos poucos e voltar quando quiser.">
          {completed} de {steps.length} etapas
        </CardTitle>
        <ProgressBar
          ratio={completed / steps.length}
          label="Progresso da configuração inicial"
          tone={allDone ? "positive" : "brand"}
        />
        <p className="mt-3 text-sm" style={{ color: "var(--muted-fg)" }}>
          {completed === 0
            ? "Com as duas primeiras etapas já dá para ver algo útil."
            : allDone
              ? "Tudo cadastrado. A projeção já reflete a sua situação real."
              : "A projeção já funciona com o que você cadastrou. Quanto mais completo, mais próxima da realidade."}
        </p>
      </Card>

      <ol className="space-y-3">
        {steps.map((step, index) => (
          <li key={step.title}>
            <Card as="div">
              <div className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className={[
                    "flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                    step.done
                      ? "bg-[color:var(--color-positive-100)] text-[color:var(--color-positive-700)]"
                      : "bg-[color:var(--color-ink-100)]",
                  ].join(" ")}
                >
                  {step.done ? "✓" : index + 1}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {step.title}
                    {step.done ? <span className="sr-only"> (concluída)</span> : null}
                  </p>
                  <p className="mt-0.5 text-sm" style={{ color: "var(--muted-fg)" }}>
                    {step.description}
                  </p>
                  <p className="mt-1 text-xs" style={{ color: "var(--muted-fg)" }}>
                    {step.unlocks}
                  </p>
                </div>

                <Link href={step.href} className="shrink-0">
                  <Button variant={step.done ? "secondary" : "primary"}>
                    {step.done ? "Revisar" : "Fazer"}
                  </Button>
                </Link>
              </div>
            </Card>
          </li>
        ))}
      </ol>

      <div className="flex justify-center pt-2">
        <Link href="/app">
          <Button variant="secondary">Ir para o resumo</Button>
        </Link>
      </div>
    </div>
  );
}

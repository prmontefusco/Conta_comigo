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

  /**
   * Três etapas abrem uma tela útil; as outras três a deixam exata.
   *
   * `hasMinimumViableSetup` já sabia disso no domínio — contas, renda e o
   * grupo — e a tela mostrava seis caixas iguais mesmo assim. Para quem tem
   * carnê de loja e rotativo, seis etapas antes de ver qualquer coisa é onde
   * a pessoa fecha o aplicativo.
   *
   * As três de baixo continuam ali, e continuam valendo. Elas só deixaram de
   * bloquear a sensação de ter terminado.
   */
  const steps = [
    {
      href: "/app/contas-bancarias",
      title: "Cadastre suas contas e saldos",
      essential: true,
      description: "Onde seu dinheiro está hoje. Sem isso, não há de onde partir.",
      unlocks: "Mostra quanto você tem agora.",
      done: finance.accounts.length > 0,
    },
    {
      href: "/app/contas",
      title: "Informe sua renda",
      essential: true,
      description: "Salário, benefício ou renda variável. Pode marcar como estimada.",
      unlocks: "Permite projetar quanto vai entrar.",
      done: finance.recurringRules.some((rule) => rule.direction === "INFLOW"),
    },
    {
      href: "/app/contas",
      title: "Cadastre as contas que se repetem",
      essential: true,
      description: "Aluguel, energia, internet, escola, plano de saúde.",
      unlocks: "Revela quanto de cada mês já está comprometido.",
      done: finance.recurringRules.some((rule) => rule.direction === "OUTFLOW"),
    },
    {
      href: "/app/cartoes",
      title: "Cadastre seus cartões",
      essential: false,
      description: "Com o dia de fechamento e o de vencimento.",
      unlocks: "Coloca cada parcela no mês certo.",
      done: finance.cards.length > 0,
    },
    {
      href: "/app/dividas",
      title: "Cadastre empréstimos e parcelamentos",
      essential: false,
      description: "Se existirem. Se não existirem, pode pular.",
      unlocks: "Separa o que é dívida do que é consumo.",
      done: finance.debts.length > 0,
    },
    {
      href: "/app/reservas",
      title: "Separe sua reserva",
      essential: false,
      description: "O que você já tem guardado e não pretende gastar.",
      unlocks: "Diferencia saldo total de saldo realmente livre.",
      done: finance.reserves.length > 0,
    },
  ];

  const essentials = steps.filter((step) => step.essential);
  const extras = steps.filter((step) => !step.essential);

  const essentialsDone = essentials.filter((step) => step.done).length;
  const readyToUse = essentialsDone === essentials.length;
  const completed = steps.filter((step) => step.done).length;
  const allDone = completed === steps.length;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Vamos começar</h1>

      <Card>
        <CardTitle hint="Dá para fazer aos poucos e voltar quando quiser.">
          {essentialsDone} de {essentials.length} para começar
        </CardTitle>
        <ProgressBar
          ratio={essentialsDone / essentials.length}
          label="Progresso do essencial"
          tone={readyToUse ? "positive" : "brand"}
        />
        <p className="mt-3 text-sm" style={{ color: "var(--muted-fg)" }}>
          {readyToUse
            ? allDone
              ? "Tudo cadastrado. A projeção reflete a sua situação real."
              : "Pronto: o aplicativo já funciona com o que você cadastrou. O resto é para deixar a projeção mais exata, e pode esperar."
            : "São três coisas para o aplicativo ter o que mostrar. O resto vem depois, sem pressa."}
        </p>
      </Card>

      <ol className="space-y-3">
        {essentials.map((step, index) => (
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

      <details className="rounded-2xl border border-[color:var(--card-border)] bg-[color:var(--card-bg)] p-4">
        <summary className="cursor-pointer text-sm font-medium">
          Depois, quando der: mais {extras.length} {extras.length === 1 ? "etapa" : "etapas"} que
          deixam a projeção exata
          {extras.filter((step) => step.done).length > 0
            ? ` (${extras.filter((step) => step.done).length} já ${
                extras.filter((step) => step.done).length === 1 ? "feita" : "feitas"
              })`
            : ""}
        </summary>

        <ul className="mt-3 space-y-2.5">
          {extras.map((step) => (
            <li
              key={step.title}
              className="flex flex-wrap items-start gap-3 border-t border-[color:var(--card-border)] pt-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {step.done ? "✓ " : null}
                  {step.title}
                </p>
                <p className="text-2xs mt-0.5" style={{ color: "var(--muted-fg)" }}>
                  {step.description} {step.unlocks}
                </p>
              </div>
              <Link href={step.href} className="shrink-0">
                <Button variant="secondary">{step.done ? "Revisar" : "Fazer"}</Button>
              </Link>
            </li>
          ))}
        </ul>
      </details>

      <div className="flex justify-center pt-2">
        <Link href="/app">
          <Button variant={readyToUse ? "primary" : "secondary"}>
            {readyToUse ? "Ver meus números" : "Ir para o resumo"}
          </Button>
        </Link>
      </div>
    </div>
  );
}

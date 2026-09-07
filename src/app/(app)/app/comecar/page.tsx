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
   * O caminho para quem já chega endividado precisa começar pelo que muda a
   * decisão de hoje: renda, contas vencidas, cartões e dívidas. Ver o plano no
   * final fecha o ciclo e devolve uma próxima ação concreta.
   *
   * As etapas não bloqueiam uso: são uma trilha. Quem não tiver cartão ou
   * empréstimo revisa o passo e segue.
   */
  const steps = [
    {
      id: "income",
      href: "/app/recorrentes",
      title: "Cadastre sua renda",
      essential: true,
      description:
        "Salário, benefício, bico, comissão ou renda variável. Pode começar com uma estimativa.",
      unlocks: "Mostra quanto costuma entrar e até onde um acordo pode ir sem estourar o mês.",
      done: finance.recurringRules.some((rule) => rule.direction === "INFLOW"),
    },
    {
      href: "/app/contas-bancarias",
      title: "Informe onde está o dinheiro",
      essential: true,
      description: "Conta corrente, carteira ou poupança. Não precisa estar perfeito para começar.",
      unlocks: "Separa saldo total, reserva e dinheiro livre para os próximos pagamentos.",
      done: finance.accounts.length > 0,
    },
    {
      href: "/app/contas",
      title: "Cadastre contas vencidas e próximas",
      essential: true,
      description:
        "Comece pelas atrasadas, aluguel, energia, água, internet, escola e boletos deste mês.",
      unlocks: "O app consegue mostrar o que pede atenção primeiro e o que pode esperar.",
      done: finance.obligations.some((obligation) => obligation.direction === "OUTFLOW"),
    },
    {
      href: "/app/cartoes",
      title: "Cadastre cartões e faturas",
      essential: true,
      description:
        "Informe limite, vencimento e faturas em aberto. Se você não usa cartão, pode revisar e seguir.",
      unlocks: "Evita que parcelas futuras fiquem invisíveis na projeção.",
      done: finance.cards.length > 0 || finance.cardStatements.length > 0,
    },
    {
      href: "/app/dividas",
      title: "Cadastre empréstimos, carnês e financiamentos",
      essential: false,
      description:
        "Inclua banco, loja, veículo, imóvel ou acordo já feito. O valor aproximado já ajuda.",
      unlocks: "Mostra risco, juros e parcela máxima para negociar com mais segurança.",
      done: finance.debts.length > 0,
    },
    {
      href: "/app/recorrentes",
      title: "Cadastre contas que se repetem",
      essential: false,
      description:
        "Aluguel, mercado estimado, internet, escola, transporte e outras despesas fixas.",
      unlocks: "Deixa os próximos meses menos dependentes de memória.",
      done: finance.recurringRules.some((rule) => rule.direction === "OUTFLOW"),
    },
    {
      href: "/app/plano",
      title: "Veja seu plano de ação",
      essential: true,
      description:
        "Quando tiver o básico, abra o plano para ver prioridades, metas e roteiros de negociação.",
      unlocks: "Transforma os dados cadastrados em próximos passos.",
      done: finance.alerts.length > 0 || finance.forecast.months.length > 0,
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
      <h1 className="text-xl font-semibold">Vamos organizar o começo</h1>

      <Card>
        <CardTitle hint="Dá para fazer aos poucos e voltar quando quiser.">
          {essentialsDone} de {essentials.length} passos essenciais
        </CardTitle>
        <ProgressBar
          ratio={essentialsDone / essentials.length}
          label="Progresso do essencial"
          tone={readyToUse ? "positive" : "brand"}
        />
        <p className="mt-3 text-sm" style={{ color: "var(--muted-fg)" }}>
          {readyToUse
            ? allDone
              ? "Você já tem dados suficientes para acompanhar alertas, projeção e plano de ação."
              : "O aplicativo já consegue ajudar com o que foi informado. Os próximos passos deixam a projeção mais precisa."
            : "Comece pelo essencial. Não precisa cadastrar a vida inteira hoje; cada passo já melhora a leitura da situação."}
        </p>
      </Card>

      <Card className="border-l-4 border-l-[color:var(--color-brand-600)]">
        <CardTitle>Se a situação está apertada, siga esta ordem</CardTitle>
        <p className="text-sm" style={{ color: "var(--muted-fg)" }}>
          Primeiro entra a renda. Depois vêm as contas vencidas, os cartões e as dívidas. Com isso,
          o app consegue mostrar alertas, prioridades e um plano mais honesto para o mês.
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
          ajudam a refinar o plano
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

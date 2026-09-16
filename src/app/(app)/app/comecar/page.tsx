"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, Card, CardTitle, ProgressBar, Spinner } from "@/components/ui/primitives";
import { markOnboardingStep } from "@/modules/household/application/onboarding";
import { initialSetupProgress } from "@/modules/household/domain/setup-progress";
import { useFinance } from "@/modules/household/ui/finance-provider";
import { useSession } from "@/modules/household/ui/session-provider";
import type { OnboardingStep } from "@/modules/household/domain/household";

export default function OnboardingPage() {
  const finance = useFinance();
  const { profile, user, refreshProfile } = useSession();
  const [skipping, setSkipping] = useState<string | null>(null);
  const progress = initialSetupProgress(profile, finance);

  if (finance.loading) return <Spinner label="Preparando seus primeiros passos" />;

  const steps = [
    {
      id: "personalData" as const,
      href: "/app/meus-dados",
      title: "Complete seus dados pessoais",
      description: "Nome, contato, profissão, endereço e objetivo financeiro.",
      unlocks: "Personaliza os relatórios e as orientações para a realidade da família.",
      done: progress.steps.personalData,
    },
    {
      id: "bankAccounts" as const,
      href: "/app/contas-bancarias",
      title: "Cadastre suas contas bancárias",
      description: "Informe onde está o dinheiro e o saldo atual de cada conta.",
      unlocks: "Cria o ponto de partida correto para saldos e projeções.",
      done: progress.steps.bankAccounts,
    },
    {
      id: "cards" as const,
      href: "/app/cadastro-cartoes",
      title: "Cadastre seus cartões",
      description: "Limite, fechamento e vencimento. Se não usa cartão, marque que não se aplica.",
      unlocks: "Permite organizar faturas, compras parceladas e limite comprometido.",
      done: progress.steps.cards,
      skipStep: "ADD_CARDS" as OnboardingStep,
      skipLabel: "Não uso cartão",
    },
    {
      id: "monthlyBills" as const,
      href: "/app/contas",
      title: "Cadastre as contas mensais",
      description: "Água, energia, telefone, aluguel, internet e outros compromissos recorrentes.",
      unlocks: "Forma a base da previsão dos próximos meses.",
      done: progress.steps.monthlyBills,
    },
    {
      id: "debts" as const,
      href: "/app/cadastro-emprestimos",
      title: "Cadastre dívidas e financiamentos",
      description: "Empréstimos, consignados, veículos, imóveis e outros contratos.",
      unlocks: "Mostra parcelas futuras, juros e impacto no orçamento.",
      done: progress.steps.debts,
      skipStep: "ADD_DEBTS" as OnboardingStep,
      skipLabel: "Não tenho dívidas",
    },
  ];
  const nextIndex = steps.findIndex((step) => !step.done);

  async function skip(id: string, step: OnboardingStep) {
    if (!user) return;
    setSkipping(id);
    try {
      await markOnboardingStep(user.uid, step);
      await refreshProfile();
    } finally {
      setSkipping(null);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Primeiros passos</h1>
        <p className="mt-1 text-sm text-[color:var(--muted-fg)]">
          Faça no seu ritmo. Ao sair para um cadastro, o atalho “Primeiros passos” continua no menu
          e um aviso permite voltar para esta sequência.
        </p>
      </div>

      <Card>
        <CardTitle hint="A conclusão é reconhecida pelos dados realmente cadastrados.">
          {progress.completed} de {progress.total} etapas concluídas
        </CardTitle>
        <ProgressBar
          ratio={progress.completed / progress.total}
          label="Progresso da configuração inicial"
          tone={progress.done ? "positive" : "brand"}
        />
        <p className="mt-3 text-sm text-[color:var(--muted-fg)]">
          {progress.done
            ? "Configuração inicial concluída. Você pode revisar qualquer etapa quando precisar."
            : `Próxima etapa recomendada: ${steps[nextIndex]?.title ?? "revisar seus dados"}.`}
        </p>
      </Card>

      <ol className="space-y-3">
        {steps.map((step, index) => {
          const current = index === nextIndex;
          return (
            <li key={step.id}>
              <Card
                as="div"
                className={current ? "border-l-4 border-l-[color:var(--color-brand-600)]" : ""}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                  <span
                    aria-hidden="true"
                    className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                      step.done
                        ? "bg-[color:var(--color-positive-100)] text-[color:var(--color-positive-700)]"
                        : current
                          ? "bg-[color:var(--color-brand-600)] text-white"
                          : "bg-[color:var(--color-ink-100)]"
                    }`}
                  >
                    {step.done ? "✓" : index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {step.title}{" "}
                      {current ? (
                        <span className="text-xs text-[color:var(--color-brand-700)]">
                          · próximo
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-sm text-[color:var(--muted-fg)]">
                      {step.description}
                    </p>
                    <p className="mt-1 text-xs text-[color:var(--muted-fg)]">{step.unlocks}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                    {step.skipStep && !step.done ? (
                      <Button
                        variant="ghost"
                        disabled={skipping !== null}
                        onClick={() => void skip(step.id, step.skipStep!)}
                      >
                        {skipping === step.id ? "Salvando…" : step.skipLabel}
                      </Button>
                    ) : null}
                    <Link href={step.href}>
                      <Button variant={current ? "primary" : "secondary"}>
                        {step.done ? "Revisar" : current ? "Fazer agora" : "Fazer"}
                      </Button>
                    </Link>
                  </div>
                </div>
              </Card>
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap justify-center gap-2 pt-2">
        <Link href="/app">
          <Button variant="secondary">Ir para o resumo</Button>
        </Link>
        {progress.done ? (
          <Link href="/app/plano">
            <Button>Ver meu plano financeiro</Button>
          </Link>
        ) : null}
      </div>
    </div>
  );
}

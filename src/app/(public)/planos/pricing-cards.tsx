"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FREE_LIMITS, PREMIUM_LIMITS } from "@/modules/billing/domain/plan-limits";
import { TRIAL_DAYS } from "@/modules/billing/domain/subscription";

/**
 * Os planos, com o preço vindo do servidor.
 *
 * Os valores estavam escritos à mão aqui — "7,99", "69,99", "5,83" — enquanto
 * a ADR 0010 dizia que a única fonte de verdade é `GET /api/assinatura/planos`,
 * o mesmo catálogo que o checkout usa para cobrar. Bastava alterar a variável
 * de ambiente em produção para o site anunciar um preço e a cobrança sair por
 * outro. Agora não há preço nesta camada: enquanto a resposta não chega, os
 * cartões mostram o que o plano faz, sem número nenhum.
 */

interface PlanOption {
  readonly cycle: "MONTHLY" | "YEARLY";
  readonly label: string;
  readonly amountCents: number;
}

interface Catalogue {
  readonly open: boolean;
  readonly plans: readonly PlanOption[];
  readonly yearlySavingPerMonthCents: number | null;
}

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function PricingCards() {
  const [billingCycle, setBillingCycle] = useState<"MONTHLY" | "YEARLY">("YEARLY");
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/assinatura/planos")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: Catalogue | null) => {
        if (active && data) setCatalogue(data);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  const monthly = catalogue?.plans.find((plan) => plan.cycle === "MONTHLY");
  const yearly = catalogue?.plans.find((plan) => plan.cycle === "YEARLY");
  const selected = billingCycle === "YEARLY" ? yearly : monthly;

  const yearlyPerMonth = yearly ? Math.round(yearly.amountCents / 12) : null;
  const savingPercent =
    monthly && yearlyPerMonth && monthly.amountCents > yearlyPerMonth
      ? Math.round(((monthly.amountCents - yearlyPerMonth) / monthly.amountCents) * 100)
      : null;

  return (
    <div className="space-y-8">
      {/* Seletor Ciclo de Cobrança */}
      <div className="flex justify-center">
        <div className="inline-flex items-center rounded-2xl border border-slate-200/80 bg-white/90 p-1.5 shadow-xs backdrop-blur-sm">
          <button
            type="button"
            onClick={() => setBillingCycle("MONTHLY")}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-all ${
              billingCycle === "MONTHLY"
                ? "bg-slate-900 text-white shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Mensal
          </button>

          <button
            type="button"
            onClick={() => setBillingCycle("YEARLY")}
            className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium transition-all ${
              billingCycle === "YEARLY"
                ? "bg-gradient-to-r from-teal-600 to-cyan-600 text-white shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <span>Anual</span>
            {savingPercent ? (
              <span className="rounded-full bg-emerald-100/90 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                Economize {savingPercent}%
              </span>
            ) : null}
          </button>
        </div>
      </div>

      {/* Grid com os 2 Planos */}
      <div className="grid gap-6 md:grid-cols-2 lg:gap-8">
        {/* Plano Gratuito */}
        <div className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-xs backdrop-blur-sm sm:p-8">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold tracking-wider text-slate-500 uppercase">
                Plano Básico
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                Gratuito para sempre
              </span>
            </div>

            <h2 className="mt-3 text-xl font-bold text-slate-900">Conta comigo Grátis</h2>
            <p className="mt-1 text-xs text-slate-500">
              Tudo o que é preciso para enxergar a própria situação e sair da dívida. Sem prazo para
              acabar.
            </p>

            <div className="mt-6 flex items-baseline gap-1">
              <span className="text-4xl font-extrabold text-slate-900">R$ 0</span>
              <span className="text-xs text-slate-400">/ mês</span>
            </div>

            <ul className="mt-6 space-y-3 text-xs text-slate-600">
              {[
                "Contas, dívidas e lançamentos sem limite de quantidade",
                "Modo emergência: o que pagar primeiro quando o dinheiro não dá",
                "Quanto o atraso está custando por dia, em multa e juros",
                "Calculadora de acordo e roteiros de negociação",
                "Diagnóstico honesto, inclusive quando o plano não fecha",
                "Todos os guias de educação financeira",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <span className="text-teal-600">✓</span>
                  <span>{item}</span>
                </li>
              ))}
              <li className="flex items-start gap-2.5 text-slate-400">
                <span>•</span>
                <span>
                  Projeção de {FREE_LIMITS.forecastMonths} meses, {FREE_LIMITS.members} pessoas no
                  grupo e {FREE_LIMITS.creditCards} cartões
                </span>
              </li>
              <li className="flex items-start gap-2.5 text-slate-400">
                <span>•</span>
                <span>Cadastro de contas e faturas digitado, sem leitura por foto</span>
              </li>
            </ul>
          </div>

          <div className="mt-8 border-t border-slate-100 pt-4">
            <Link
              href="/criar-conta"
              className="flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              Criar conta gratuita
            </Link>
          </div>
        </div>

        {/* Plano Premium */}
        <div className="relative flex flex-col justify-between rounded-3xl border-2 border-teal-500 bg-gradient-to-b from-teal-50/50 via-white to-white p-6 shadow-md sm:p-8">
          <div className="absolute -top-3.5 right-6 rounded-full bg-gradient-to-r from-teal-600 to-cyan-600 px-3.5 py-1 text-xs font-bold text-white shadow-sm">
            ⭐ {TRIAL_DAYS} DIAS GRÁTIS
          </div>

          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold tracking-wider text-teal-700 uppercase">
                Plano Completo Familiar
              </span>
            </div>

            <h2 className="mt-3 text-xl font-bold text-slate-900">Conta comigo Premium</h2>
            <p className="mt-1 text-xs text-slate-600">
              Para organizar com mais folga: horizonte longo, leitura automática de documentos e a
              casa toda no mesmo painel.
            </p>

            <div className="mt-6 flex flex-col">
              {selected ? (
                billingCycle === "YEARLY" && yearlyPerMonth ? (
                  <div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-4xl font-extrabold text-slate-900">
                        R$ {formatCents(yearlyPerMonth)}
                      </span>
                      <span className="text-xs text-slate-500">/ mês</span>
                    </div>
                    <p className="mt-1 text-xs font-medium text-teal-800">
                      Cobrado uma vez por ano: R$ {formatCents(selected.amountCents)}, após os{" "}
                      {TRIAL_DAYS} dias grátis.
                    </p>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-4xl font-extrabold text-slate-900">
                        R$ {formatCents(selected.amountCents)}
                      </span>
                      <span className="text-xs text-slate-500">/ mês</span>
                    </div>
                    <p className="mt-1 text-xs font-medium text-teal-800">
                      Sem fidelidade e sem renovação automática.
                    </p>
                  </div>
                )
              ) : (
                <p className="text-sm text-slate-500">
                  {catalogue && !catalogue.open
                    ? "A assinatura ainda não está disponível. O plano gratuito já funciona por inteiro."
                    : "Carregando o preço…"}
                </p>
              )}
            </div>

            <p className="mt-6 text-xs font-semibold text-slate-900">Tudo do gratuito, e mais:</p>
            <ul className="mt-3 space-y-3 text-xs text-slate-700">
              {[
                `${TRIAL_DAYS} dias de teste ao criar a conta, sem cartão`,
                `Projeção completa de ${PREMIUM_LIMITS.forecastMonths} meses, não ${FREE_LIMITS.forecastMonths}`,
                "Leitor de faturas, boletos e comprovantes por foto",
                "Diagnóstico redigido por IA, além do cálculo local",
                `Até ${PREMIUM_LIMITS.members} pessoas no mesmo painel familiar`,
                `Até ${PREMIUM_LIMITS.creditCards} cartões de crédito`,
                "Simulador de aumento, 13º salário e férias",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <span className="mt-px flex size-4.5 shrink-0 items-center justify-center rounded-full bg-teal-100 text-xs text-teal-700">
                    ✓
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-8 border-t border-teal-100 pt-4">
            <Link
              href="/criar-conta"
              className="flex min-h-12 items-center justify-center rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 font-semibold text-white shadow-sm transition-all hover:from-teal-700 hover:to-cyan-700 hover:shadow-md"
            >
              Começar os {TRIAL_DAYS} dias grátis
            </Link>
            <p className="mt-2 text-center text-[11px] text-slate-500">
              Sem cartão para testar • O pagamento é avulso e não renova sozinho
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

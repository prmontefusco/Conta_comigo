"use client";

import Link from "next/link";
import { useState } from "react";

export function PricingCards() {
  const [billingCycle, setBillingCycle] = useState<"MONTHLY" | "YEARLY">("YEARLY");

  const monthlyPrice = "7,99";
  const yearlyPrice = "69,99";
  const yearlyEquivalentMonthly = "5,83";

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
            <span className="rounded-full bg-emerald-100/90 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
              Economize 27%
            </span>
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
              Para quem quer dar os primeiros passos e organizar a rotina básica de contas.
            </p>

            <div className="mt-6 flex items-baseline gap-1">
              <span className="text-4xl font-extrabold text-slate-900">R$ 0</span>
              <span className="text-xs text-slate-400">/ mês</span>
            </div>

            <ul className="mt-6 space-y-3 text-xs text-slate-600">
              <li className="flex items-center gap-2.5">
                <span className="text-teal-600">✓</span>
                <span>Registro de contas e despesas do dia a dia</span>
              </li>
              <li className="flex items-center gap-2.5">
                <span className="text-teal-600">✓</span>
                <span>Visão de contas a pagar no mês</span>
              </li>
              <li className="flex items-center gap-2.5">
                <span className="text-teal-600">✓</span>
                <span>1 membro no grupo familiar</span>
              </li>
              <li className="flex items-center gap-2.5">
                <span className="text-teal-600">✓</span>
                <span>Acesso a todos os artigos e guias educativos</span>
              </li>
              <li className="flex items-center gap-2.5 text-slate-400">
                <span>•</span>
                <span>Exibe anúncios discretos</span>
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

        {/* Plano Premium - Destaque */}
        <div className="relative flex flex-col justify-between rounded-3xl border-2 border-teal-500 bg-gradient-to-b from-teal-50/50 via-white to-white p-6 shadow-md sm:p-8">
          <div className="absolute -top-3.5 right-6 rounded-full bg-gradient-to-r from-teal-600 to-cyan-600 px-3.5 py-1 text-xs font-bold text-white shadow-sm">
            ⭐ 30 DIAS GRÁTIS
          </div>

          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold tracking-wider text-teal-700 uppercase">
                Plano Completo Familiar
              </span>
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                Teste 30 dias grátis
              </span>
            </div>

            <h2 className="mt-3 text-xl font-bold text-slate-900">Conta comigo Premium</h2>
            <p className="mt-1 text-xs text-slate-600">
              Controle total, projeção de 12 meses, IA financeira e zero distrações para sua
              família.
            </p>

            <div className="mt-6 flex flex-col">
              {billingCycle === "YEARLY" ? (
                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-4xl font-extrabold text-slate-900">
                      R$ {yearlyEquivalentMonthly}
                    </span>
                    <span className="text-xs text-slate-500">/ mês</span>
                  </div>
                  <p className="mt-1 text-xs font-medium text-teal-800">
                    Cobrado anualmente: R$ {yearlyPrice} / ano (após os 30 dias grátis)
                  </p>
                </div>
              ) : (
                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-4xl font-extrabold text-slate-900">
                      R$ {monthlyPrice}
                    </span>
                    <span className="text-xs text-slate-500">/ mês</span>
                  </div>
                  <p className="mt-1 text-xs font-medium text-teal-800">
                    Sem fidelidade. Cancele quando quiser.
                  </p>
                </div>
              )}
            </div>

            <ul className="mt-6 space-y-3 text-xs text-slate-700">
              <li className="flex items-center gap-2.5 font-medium text-slate-900">
                <span className="flex size-4.5 items-center justify-center rounded-full bg-teal-100 text-xs text-teal-700">
                  ✓
                </span>
                <span>30 dias de teste gratuito sem compromisso</span>
              </li>
              <li className="flex items-center gap-2.5">
                <span className="flex size-4.5 items-center justify-center rounded-full bg-teal-100 text-xs text-teal-700">
                  ✓
                </span>
                <span>100% Livre de anúncios e distrações</span>
              </li>
              <li className="flex items-center gap-2.5">
                <span className="flex size-4.5 items-center justify-center rounded-full bg-teal-100 text-xs text-teal-700">
                  ✓
                </span>
                <span>Motor de Projeção Financeira Completo (30 a 365 dias)</span>
              </li>
              <li className="flex items-center gap-2.5">
                <span className="flex size-4.5 items-center justify-center rounded-full bg-teal-100 text-xs text-teal-700">
                  ✓
                </span>
                <span>Simulador de Salários, 13º Salário e Proventos Futuros</span>
              </li>
              <li className="flex items-center gap-2.5">
                <span className="flex size-4.5 items-center justify-center rounded-full bg-teal-100 text-xs text-teal-700">
                  ✓
                </span>
                <span>Diagnóstico com IA & Leitor Inteligente de Faturas/Boletos</span>
              </li>
              <li className="flex items-center gap-2.5">
                <span className="flex size-4.5 items-center justify-center rounded-full bg-teal-100 text-xs text-teal-700">
                  ✓
                </span>
                <span>Multi-membros da família no mesmo painel compartilhado</span>
              </li>
              <li className="flex items-center gap-2.5">
                <span className="flex size-4.5 items-center justify-center rounded-full bg-teal-100 text-xs text-teal-700">
                  ✓
                </span>
                <span>Calculadora de Acordos e Roteiros de Negociação de Dívidas</span>
              </li>
              <li className="flex items-center gap-2.5">
                <span className="flex size-4.5 items-center justify-center rounded-full bg-teal-100 text-xs text-teal-700">
                  ✓
                </span>
                <span>Suporte prioritário e humanizado</span>
              </li>
            </ul>
          </div>

          <div className="mt-8 border-t border-teal-100 pt-4">
            <Link
              href="/criar-conta"
              className="flex min-h-12 items-center justify-center rounded-xl bg-gradient-to-r from-teal-600 to-cyan-600 font-semibold text-white shadow-sm transition-all hover:from-teal-700 hover:to-cyan-700 hover:shadow-md"
            >
              Experimentar 30 dias grátis
            </Link>
            <p className="mt-2 text-center text-[11px] text-slate-500">
              Ativação imediata • Cancele quando quiser
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { formatCalendarDate } from "@/core/date/calendar-date";
import { formatMoney } from "@/core/money/format";
import { isNegative, money, subtract, sum } from "@/core/money/money";
import { Button, Card, CardTitle, Stat } from "@/components/ui/primitives";
import { HealthScoreCard } from "@/modules/ai-advisor/ui/health-score-card";
import { AlertsList } from "@/modules/alerts/ui/alerts-list";
import { MonthBlock, Next30DaysBlock } from "@/modules/dashboard/ui/month-block";
import { TodayBlock } from "@/modules/dashboard/ui/today-block";
import { outstandingPrincipal } from "@/modules/debts/domain/debt";
import { EducationPillsCard } from "@/modules/education/ui/pills-card";
import { MonthsTable } from "@/modules/forecast/ui/months-table";
import { useFinance } from "@/modules/household/ui/finance-provider";
import { DocumentImportButton } from "@/modules/receipts/ui/document-import-button";
import { CurrentGoalHeroCard } from "@/modules/recovery-timeline/ui/current-goal-hero-card";
import { FutureTimelineCard } from "@/modules/recovery-timeline/ui/future-timeline-card";
import { StarterReserveCard } from "@/modules/reserves/ui/starter-reserve-card";

export type DashboardTab = "GERAL" | "ENTRADAS" | "DESPESAS" | "RESERVAS" | "DIVIDAS";

export function DashboardTabs() {
  const finance = useFinance();
  const [activeTab, setActiveTab] = useState<DashboardTab>("GERAL");

  const currency = finance.totalCash.currency;
  const currentMonth = finance.forecast.months[0];

  // Cálculos do mês atual
  const monthlyInflows = currentMonth?.expectedInflows ?? money(0, currency);
  const monthlyOutflows = currentMonth?.committedOutflows ?? money(0, currency);
  const monthlySurplus = subtract(monthlyInflows, monthlyOutflows);

  // Entradas recorrentes
  const recurringInflows = finance.recurringRules.filter((r) => r.direction === "INFLOW" && r.active);

  // Obrigações de saída do mês
  const openObligations = finance.obligations.filter(
    (o) => o.direction === "OUTFLOW" && (o.status === "SCHEDULED" || o.status === "PARTIALLY_SETTLED"),
  );

  // Total de Dívidas
  const activeDebts = finance.debts.filter((d) => d.status !== "SETTLED");
  const totalDebtBalance = sum(
    activeDebts.map((d) =>
      outstandingPrincipal(d, finance.paidDebtInstallments.get(d.id) ?? []),
    ),
    currency,
  );

  return (
    <div className="space-y-6">
      {/* 0. Hero da Meta Prioritária */}
      <CurrentGoalHeroCard />

      {/* Seletor de Pilares Segmentados */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-[color:var(--card-border)] bg-[color:var(--color-surface-sunken)] p-1.5 shadow-2xs">
        <button
          type="button"
          onClick={() => setActiveTab("GERAL")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all ${
            activeTab === "GERAL"
              ? "tab-active shadow-sm"
              : "text-[color:var(--page-fg)] hover:bg-[color:var(--card-bg)]"
          }`}
        >
          <span>📊</span>
          <span>Visão Geral</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("ENTRADAS")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all ${
            activeTab === "ENTRADAS"
              ? "bg-[color:var(--color-positive-600)] text-white shadow-sm"
              : "text-[color:var(--page-fg)] hover:bg-[color:var(--card-bg)]"
          }`}
        >
          <span>🟢</span>
          <span>Entradas ({formatMoney(monthlyInflows)})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("DESPESAS")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all ${
            activeTab === "DESPESAS"
              ? "bg-[color:var(--color-attention-600)] text-white shadow-sm"
              : "text-[color:var(--page-fg)] hover:bg-[color:var(--card-bg)]"
          }`}
        >
          <span>🔴</span>
          <span>Despesas ({formatMoney(monthlyOutflows)})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("RESERVAS")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all ${
            activeTab === "RESERVAS"
              ? "bg-[color:var(--color-brand-600)] text-white shadow-sm"
              : "text-[color:var(--page-fg)] hover:bg-[color:var(--card-bg)]"
          }`}
        >
          <span>🔵</span>
          <span>Reservas ({formatMoney(finance.protectedReserve)})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("DIVIDAS")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-all ${
            activeTab === "DIVIDAS"
              ? "bg-[color:var(--color-critical-600)] text-white shadow-sm"
              : "text-[color:var(--page-fg)] hover:bg-[color:var(--card-bg)]"
          }`}
        >
          <span>🏛️</span>
          <span>Dívidas ({formatMoney(totalDebtBalance)})</span>
        </button>
      </div>

      {/* CONTEÚDO DE CADA PILAR */}

      {/* 1. VISÃO GERAL */}
      {activeTab === "GERAL" && (
        <div className="space-y-5 animate-in fade-in duration-200">
          <HealthScoreCard />
          <TodayBlock />
          <AlertsList alerts={finance.alerts} />
          <MonthBlock />
          <Next30DaysBlock />
          <MonthsTable months={finance.forecast.months} limit={6} />
          <EducationPillsCard />
        </div>
      )}

      {/* 2. ENTRADAS */}
      {activeTab === "ENTRADAS" && (
        <div className="space-y-5 animate-in fade-in duration-200">
          <Card className="border-l-4 border-l-[color:var(--color-positive-600)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--card-border)] pb-4">
              <div>
                <span className="text-xs font-bold tracking-wider text-[color:var(--color-positive-600)] uppercase">
                  Pilar de Renda Familiar
                </span>
                <h3 className="text-lg font-bold text-[color:var(--page-fg)]">
                  Entradas e Recebimentos do Mês
                </h3>
              </div>
              <Link href="/app/recorrentes">
                <Button variant="secondary" className="px-3 py-1.5 text-xs">
                  + Adicionar Salário / Renda Extra
                </Button>
              </Link>
            </div>

            <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Stat label="Total Previsto no Mês" value={monthlyInflows} tone="positive" size="lg" />
              <Stat
                label="Saldo Livre para o Mês"
                value={monthlySurplus}
                tone={isNegative(monthlySurplus) ? "critical" : "positive"}
                hint="Diferença entre entradas e despesas previstas"
              />
              <Stat label="Disponibilidade em Caixa Hoje" value={finance.totalCash} tone="neutral" />
            </dl>
          </Card>

          <Card>
            <CardTitle hint="Fontes de renda ativas da família (salários, comissões, pró-labore)">
              Rendas Recorrentes Cadastradas
            </CardTitle>

            {recurringInflows.length === 0 ? (
              <p className="mt-3 text-sm" style={{ color: "var(--muted-fg)" }}>
                Nenhuma receita fixa cadastrada. Adicione os salários e rendas da casa em{" "}
                <Link href="/app/recorrentes" className="underline text-[color:var(--color-brand-600)]">
                  Recorrentes
                </Link>
                .
              </p>
            ) : (
              <div className="mt-3 divide-y divide-[color:var(--card-border)]">
                {recurringInflows.map((rule) => (
                  <div key={rule.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-semibold">{rule.description}</p>
                      <p className="text-xs" style={{ color: "var(--muted-fg)" }}>
                        Vencimento no dia {rule.dayOfMonth ?? 5} de cada mês
                      </p>
                    </div>
                    <span className="tabular text-sm font-bold text-[color:var(--color-positive-600)]">
                      +{formatMoney(rule.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* 3. DESPESAS */}
      {activeTab === "DESPESAS" && (
        <div className="space-y-5 animate-in fade-in duration-200">
          <Card className="border-l-4 border-l-[color:var(--color-attention-600)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--card-border)] pb-4">
              <div>
                <span className="text-xs font-bold tracking-wider text-[color:var(--color-attention-600)] uppercase">
                  Pilar de Despesas & Contas
                </span>
                <h3 className="text-lg font-bold text-[color:var(--page-fg)]">
                  Compromissos do Mês
                </h3>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <DocumentImportButton />
                <Link href="/app/contas">
                  <Button variant="secondary" className="px-3 py-1.5 text-xs">
                    Ver Todas as Contas &rarr;
                  </Button>
                </Link>
              </div>
            </div>

            <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Stat label="Total de Saídas no Mês" value={monthlyOutflows} tone="outflow" size="lg" />
              <Stat
                label="Contas Pendentes"
                value={money(openObligations.reduce((acc, o) => acc + o.amount.amount, 0), currency)}
                tone="attention"
                hint={`${openObligations.length} conta(s) a pagar neste mês`}
              />
              <Stat
                label="Comprometimento com Dívidas/Cartões"
                value={currentMonth?.debtCommitment ?? money(0, currency)}
                tone="outflow"
              />
            </dl>
          </Card>

          <Next30DaysBlock />

          <Card>
            <div className="flex items-center justify-between">
              <CardTitle hint="Água, energia, aluguel, internet, supermercado e transporte">
                Próximas Contas a Pagar
              </CardTitle>
              <Link href="/app/contas">
                <Button variant="ghost" className="px-3 py-1.5 text-xs">
                  Gerenciar &rarr;
                </Button>
              </Link>
            </div>

            {openObligations.length === 0 ? (
              <p className="mt-3 text-sm" style={{ color: "var(--muted-fg)" }}>
                Não há contas pendentes cadastradas para este mês.
              </p>
            ) : (
              <div className="mt-3 divide-y divide-[color:var(--card-border)]">
                {openObligations.slice(0, 5).map((obligation) => (
                  <div key={obligation.id} className="flex items-center justify-between py-2.5">
                    <div>
                      <p className="text-sm font-medium">{obligation.description}</p>
                      <p className="text-xs" style={{ color: "var(--muted-fg)" }}>
                        Vence em {formatCalendarDate(obligation.dueDate)}
                      </p>
                    </div>
                    <span className="tabular text-sm font-bold text-[color:var(--color-critical-fg)]">
                      {formatMoney(obligation.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* 4. RESERVAS & INVESTIMENTOS */}
      {activeTab === "RESERVAS" && (
        <div className="space-y-5 animate-in fade-in duration-200">
          <StarterReserveCard />

          <Card className="border-l-4 border-l-[color:var(--color-brand-600)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--card-border)] pb-4">
              <div>
                <span className="text-xs font-bold tracking-wider text-[color:var(--color-brand-600)] uppercase">
                  Segurança & Futuro
                </span>
                <h3 className="text-lg font-bold text-[color:var(--page-fg)]">
                  Suas Reservas e Colchão de Tranquilidade
                </h3>
              </div>
              <Link href="/app/reservas">
                <Button variant="secondary" className="px-3 py-1.5 text-xs">
                  Gerenciar Reservas &rarr;
                </Button>
              </Link>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-[color:var(--card-border)] bg-[color:var(--card-bg)] p-4">
                <p className="text-xs font-semibold text-[color:var(--color-brand-600)] uppercase">
                  Passo 1: Reserva de Respiro
                </p>
                <p className="mt-1 text-xs" style={{ color: "var(--muted-fg)" }}>
                  Meta de R$ 500 a R$ 1.000 antes de quitar dívidas para não recorrer ao cartão quando furar um pneu ou faltar remédio.
                </p>
              </div>

              <div className="rounded-xl border border-[color:var(--card-border)] bg-[color:var(--card-bg)] p-4">
                <p className="text-xs font-semibold text-[color:var(--color-positive-600)] uppercase">
                  Passo 2: Reserva de Emergência Plena
                </p>
                <p className="mt-1 text-xs" style={{ color: "var(--muted-fg)" }}>
                  De 3 a 6 meses do custo de vida essencial da família, construída logo após zerar os empréstimos e cartões caros.
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* 5. DÍVIDAS & RECUPERAÇÃO */}
      {activeTab === "DIVIDAS" && (
        <div className="space-y-5 animate-in fade-in duration-200">
          <Card className="border-l-4 border-l-[color:var(--color-critical-600)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--card-border)] pb-4">
              <div>
                <span className="text-xs font-bold tracking-wider text-[color:var(--color-critical-600)] uppercase">
                  Passivos e Metas de Quitação
                </span>
                <h3 className="text-lg font-bold text-[color:var(--page-fg)]">
                  Mapa de Dívidas da Família
                </h3>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href="/app/negociar">
                  <Button className="px-3 py-1.5 text-xs">
                    Simular Acordo / Feirão &rarr;
                  </Button>
                </Link>
                <Link href="/app/dividas">
                  <Button variant="secondary" className="px-3 py-1.5 text-xs">
                    Ver Todas as Dívidas
                  </Button>
                </Link>
              </div>
            </div>

            <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Stat label="Saldo Devedor Total" value={totalDebtBalance} tone="critical" size="lg" />
              <Stat
                label="Contratos Ativos"
                value={money(activeDebts.length, currency)}
                tone="neutral"
                hint={`${activeDebts.length} dívida(s) ou financiamento(s)`}
              />
              <Stat
                label="Parcelas Mensais em Dívidas"
                value={currentMonth?.debtCommitment ?? money(0, currency)}
                tone="outflow"
              />
            </dl>
          </Card>

          <FutureTimelineCard />
        </div>
      )}
    </div>
  );
}

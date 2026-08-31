"use client";

import { useState } from "react";
import { formatCalendarDate } from "@/core/date/calendar-date";
import { formatMoney } from "@/core/money/format";
import { Button, Card, CardTitle, Spinner } from "@/components/ui/primitives";
import { evaluateFinancialHealth } from "@/modules/ai-advisor/domain/financial-health";
import { calculateRecoveryTimeline } from "@/modules/recovery-timeline/domain/recovery-calculator";
import { useFinance } from "@/modules/household/ui/finance-provider";

const QUICK_QUESTIONS = [
  "Como sair do vermelho e estancar os juros?",
  "Qual dívida devo priorizar pagar primeiro?",
  "Onde posso cortar despesas sem sofrimento?",
  "Qual a melhor estratégia para o cartão de crédito?",
  "Como montar minha primeira reserva de emergência?",
];

export function AIAdvisorPanel() {
  const finance = useFinance();
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<
    Array<{ sender: "user" | "ai"; text: string; source?: string }>
  >([]);
  const [loading, setLoading] = useState(false);

  const report = evaluateFinancialHealth({
    asOf: finance.asOf,
    openingBalance: finance.totalCash,
    totalCash: finance.totalCash,
    protectedReserve: finance.protectedReserve,
    forecast: finance.forecast,
    debts: finance.debts,
    cards: finance.cards,
    cardStatements: finance.cardStatements,
    obligations: finance.obligations,
    recurringRules: finance.recurringRules,
    reserves: finance.reserves,
  });

  const recovery = calculateRecoveryTimeline({
    asOf: finance.asOf,
    openingBalance: finance.totalCash,
    totalCash: finance.totalCash,
    protectedReserve: finance.protectedReserve,
    forecast: finance.forecast,
    debts: finance.debts,
    cardStatements: finance.cardStatements,
    reserves: finance.reserves,
  });

  async function handleAsk(promptText: string) {
    if (!promptText.trim()) return;

    const userMsg = promptText.trim();
    setQuestion("");
    setMessages((prev) => [...prev, { sender: "user", text: userMsg }]);
    setLoading(true);

    try {
      const response = await fetch("/api/ai/diagnostico", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMsg,
          context: {
            score: report.score,
            statusLabel: report.statusLabel,
            totalCashFormatted: formatMoney(report.monthlyNet),
            monthlyIncomeFormatted: formatMoney(report.monthlyIncome),
            monthlyExpensesFormatted: formatMoney(report.monthlyExpenses),
            monthlyNetFormatted: formatMoney(report.monthlyNet),
            debtCommitmentRatio: report.debtCommitmentRatio,
            totalDebtFormatted: formatMoney(report.totalDebtOutstanding),
            overdueBillsCount: report.overdueBillsCount,
            overdueBillsTotalFormatted: formatMoney(report.overdueBillsTotal),
            emergencyFundMonths: report.emergencyFundMonths,
            monthsToDebtFree: recovery.monthsToDebtFree,
            debtFreeDateFormatted: formatCalendarDate(recovery.debtFreeDate),
          },
        }),
      });

      if (!response.ok) {
        throw new Error("Erro na resposta");
      }

      const data = await response.json();
      setMessages((prev) => [
        ...prev,
        {
          sender: "ai",
          text: data.reply,
          source: data.source,
        },
      ]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          sender: "ai",
          text: "Desculpe, ocorreu uma instabilidade momentânea ao processar sua pergunta. Por favor, tente novamente.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Plano de Ação Estruturado */}
      <Card>
        <CardTitle hint="Baseado no diagnóstico automático das suas receitas, despesas e compromissos.">
          🎯 Plano de Ação Recomendado
        </CardTitle>

        <div className="mt-4 space-y-3">
          {report.actionPlan.map((step) => (
            <div
              key={step.priority}
              className="flex items-start gap-3.5 rounded-xl border border-[color:var(--card-border)] bg-[color:var(--color-surface-sunken)] p-4"
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-brand-600)] text-xs font-bold text-white shadow-xs">
                {step.priority}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold text-[color:var(--page-fg)]">
                    {step.title}
                  </h4>
                  {step.estimatedDaysToComplete ? (
                    <span className="rounded-md bg-[color:var(--color-ink-100)] px-2 py-0.5 text-2xs font-medium text-[color:var(--page-fg)]">
                      Meta: {step.estimatedDaysToComplete} dias
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs" style={{ color: "var(--muted-fg)" }}>
                  {step.description}
                </p>
                <p className="mt-1.5 text-xs font-medium text-[color:var(--color-positive-700)]">
                  💡 Impacto: {step.impact}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Consultor IA Interativo */}
      <Card className="border-2 border-[color:var(--color-brand-600)]/30 bg-gradient-to-b from-[color:var(--card-bg)] to-[color:var(--color-surface-sunken)]">
        <div className="flex items-center justify-between gap-2 border-b border-[color:var(--card-border)] pb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🤖</span>
            <div>
              <CardTitle hint="Tire dúvidas, peça dicas de negociação ou estratégias personalizadas de economia.">
                Consultor Financeiro Inteligente
              </CardTitle>
            </div>
          </div>
          <span className="rounded-full bg-[color:var(--color-brand-100)] px-2.5 py-0.5 text-2xs font-semibold text-[color:var(--color-brand-700)]">
            IA Ativa
          </span>
        </div>

        {/* Quick questions suggestions */}
        <div className="mt-4">
          <p className="text-xs font-medium text-[color:var(--muted-fg)] mb-2">
            Perguntas sugeridas para sua situação:
          </p>
          <div className="flex flex-wrap gap-2">
            {QUICK_QUESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => handleAsk(q)}
                className="rounded-full border border-[color:var(--card-border)] bg-[color:var(--card-bg)] px-3 py-1.5 text-xs font-medium text-[color:var(--page-fg)] shadow-2xs hover:border-[color:var(--color-brand-600)] hover:text-[color:var(--color-brand-600)] transition text-left"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Message feed */}
        {messages.length > 0 ? (
          <div className="mt-6 space-y-4 max-h-[32rem] overflow-y-auto pr-1">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex gap-3 ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.sender === "ai" ? (
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-brand-600)] text-xs text-white">
                    🤖
                  </span>
                ) : null}
                <div
                  className={`max-w-[85%] rounded-2xl p-4 text-xs leading-relaxed ${
                    msg.sender === "user"
                      ? "bg-[color:var(--color-brand-600)] text-white font-medium"
                      : "border border-[color:var(--card-border)] bg-[color:var(--card-bg)] shadow-xs"
                  }`}
                >
                  {msg.sender === "ai" ? (
                    <div className="prose prose-xs dark:prose-invert space-y-2 whitespace-pre-wrap">
                      {msg.text}
                    </div>
                  ) : (
                    msg.text
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {loading ? (
          <div className="py-6 text-center">
            <Spinner label="Analisando suas finanças e gerando orientações..." />
          </div>
        ) : null}

        {/* Input box */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAsk(question);
          }}
          className="mt-6 flex gap-2"
        >
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Faça uma pergunta sobre suas finanças ou peça ajuda para se organizar..."
            className="flex-1 rounded-xl border border-[color:var(--card-border)] bg-[color:var(--card-bg)] px-4 py-2.5 text-xs text-[color:var(--page-fg)] placeholder:text-[color:var(--muted-fg)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-brand-600)] shadow-xs"
          />
          <Button type="submit" disabled={loading || !question.trim()}>
            Enviar
          </Button>
        </form>
      </Card>
    </div>
  );
}

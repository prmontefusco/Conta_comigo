"use client";

import { useState } from "react";
import { formatCalendarDate } from "@/core/date/calendar-date";
import { formatMoney } from "@/core/money/format";
import { Button, Card, CardTitle, Spinner } from "@/components/ui/primitives";
import { evaluateFinancialHealth } from "@/modules/ai-advisor/domain/financial-health";
import { calculateRecoveryTimeline } from "@/modules/recovery-timeline/domain/recovery-calculator";
import { useFinance } from "@/modules/household/ui/finance-provider";
import { useSession } from "@/modules/household/ui/session-provider";

const QUICK_QUESTIONS = [
  "Como sair do vermelho e estancar os juros?",
  "Qual dívida devo priorizar pagar primeiro?",
  "Onde posso cortar despesas sem sofrimento?",
  "Qual a melhor estratégia para o cartão de crédito?",
  "Como montar minha primeira reserva de emergência?",
];

export function AIAdvisorPanel() {
  const finance = useFinance();
  const { user } = useSession();
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
      // A rota é autenticada: ela chama um modelo cobrado por token e não pode
      // ficar aberta. Sem sessão não há o que enviar.
      if (!user) throw new Error("Sessão ausente.");
      const token = await user.getIdToken();

      const response = await fetch("/api/ai/diagnostico", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: userMsg,
          context: {
            score: report.score,
            statusLabel: report.statusLabel,
            // O saldo em conta é `finance.totalCash`. O relatório de saúde não
            // carrega esse campo, e usar `monthlyNet` aqui fazia o consultor
            // anunciar a sobra do mês como se fosse o saldo — dois números que
            // levam a decisões opostas quando a sobra é negativa.
            totalCashFormatted: formatMoney(finance.totalCash),
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

      const data = await response.json();

      if (!response.ok) {
        // O 429 tem conserto do lado de quem lê: esperar. Dizer isso é mais
        // útil que "instabilidade momentânea", que sugere tentar de novo já.
        const message =
          typeof data === "object" && data !== null && "message" in data
            ? String((data as { message: unknown }).message)
            : "Não foi possível gerar a consultoria agora. Tente novamente.";
        setMessages((prev) => [...prev, { sender: "ai", text: message }]);
        return;
      }

      setMessages((prev) => [
        ...prev,
        {
          sender: "ai",
          text: data.reply,
          source: data.source,
        },
      ]);
    } catch {
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
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold text-[color:var(--page-fg)]">
                    {step.title}
                  </h4>
                  {step.estimatedDaysToComplete ? (
                    <span className="text-2xs rounded-md bg-[color:var(--color-ink-100)] px-2 py-0.5 font-medium text-[color:var(--page-fg)]">
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
          <span className="text-2xs rounded-full bg-[color:var(--color-brand-100)] px-2.5 py-0.5 font-semibold text-[color:var(--color-brand-700)]">
            IA Ativa
          </span>
        </div>

        {/* Quick questions suggestions */}
        <div className="mt-4">
          <p className="mb-2 text-xs font-medium text-[color:var(--muted-fg)]">
            Perguntas sugeridas para sua situação:
          </p>
          <div className="flex flex-wrap gap-2">
            {QUICK_QUESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => handleAsk(q)}
                className="rounded-full border border-[color:var(--card-border)] bg-[color:var(--card-bg)] px-3 py-1.5 text-left text-xs font-medium text-[color:var(--page-fg)] shadow-2xs transition hover:border-[color:var(--color-brand-600)] hover:text-[color:var(--color-brand-600)]"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Message feed */}
        {messages.length > 0 ? (
          <div className="mt-6 max-h-[32rem] space-y-4 overflow-y-auto pr-1">
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
                      ? "bg-[color:var(--color-brand-600)] font-medium text-white"
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
            className="flex-1 rounded-xl border border-[color:var(--card-border)] bg-[color:var(--card-bg)] px-4 py-2.5 text-xs text-[color:var(--page-fg)] shadow-xs placeholder:text-[color:var(--muted-fg)] focus:ring-2 focus:ring-[color:var(--color-brand-600)] focus:outline-none"
          />
          <Button type="submit" disabled={loading || !question.trim()}>
            Enviar
          </Button>
        </form>
      </Card>
    </div>
  );
}

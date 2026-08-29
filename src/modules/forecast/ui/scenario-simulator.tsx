"use client";

import { useMemo, useState } from "react";
import {
  addMonths,
  dateRange,
  formatCalendarDate,
  formatMonthKey,
  calendarDate,
} from "@/core/date/calendar-date";
import { formatMoney } from "@/core/money/format";
import { fromDecimalString } from "@/core/money/money";
import { Button, Card, CardTitle, MoneyText } from "@/components/ui/primitives";
import { DateField, FormError, MoneyField, SelectField, TextField } from "@/components/ui/form";
import { simulate, type ScenarioChange } from "@/modules/forecast/domain/scenario";
import { useFinance } from "@/modules/household/ui/finance-provider";

/**
 * What-if simulations.
 *
 * The answer is always a set of numbers and dates. The app never says whether
 * the purchase is a good idea - that is the person's call, and pretending
 * otherwise would be financial advice this product does not give
 * (docs/PRODUCT.md section 31).
 */

type Question = "PURCHASE" | "TRIP" | "INCOME_LOSS" | "NEW_EXPENSE" | "EMERGENCY";

const QUESTIONS: ReadonlyArray<{ value: Question; label: string }> = [
  { value: "PURCHASE", label: "Consigo comprar isso parcelado?" },
  { value: "TRIP", label: "Consigo fazer uma viagem?" },
  { value: "INCOME_LOSS", label: "E se minha renda cair?" },
  { value: "NEW_EXPENSE", label: "E se surgir uma despesa fixa?" },
  { value: "EMERGENCY", label: "E se acontecer uma emergência?" },
];

export function ScenarioSimulator() {
  const finance = useFinance();

  const [question, setQuestion] = useState<Question>("PURCHASE");
  const [label, setLabel] = useState("");
  const [amountText, setAmountText] = useState("");
  const [installments, setInstallments] = useState("10");
  const [startDate, setStartDate] = useState<string>(addMonths(finance.asOf, 1).slice(0, 8) + "05");
  const [months, setMonths] = useState("6");
  const [result, setResult] = useState<ReturnType<typeof simulate> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const horizonEnd = useMemo(() => addMonths(finance.asOf, 18), [finance.asOf]);

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setResult(null);

    const amount = fromDecimalString(amountText);
    if (!amount || amount.amount <= 0) {
      setError("Informe um valor maior que zero.");
      return;
    }

    let date;
    try {
      date = calendarDate(startDate);
    } catch {
      setError("Informe uma data válida.");
      return;
    }

    const name = label.trim() || defaultLabel(question);
    const change = buildChange(question, {
      name,
      amount,
      installments: Math.max(1, Number(installments) || 1),
      date,
      months: Math.max(1, Number(months) || 1),
    });

    setResult(
      simulate({ ...finance.forecastInput, horizon: dateRange(finance.asOf, horizonEnd) }, [
        change,
      ]),
    );
  }

  return (
    <Card aria-labelledby="simulador-title">
      <CardTitle
        id="simulador-title"
        hint="Nada aqui é salvo. É só uma pergunta ao seu próprio orçamento."
      >
        Simulador
      </CardTitle>

      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error ? <FormError>{error}</FormError> : null}

        <SelectField
          label="O que você quer saber"
          value={question}
          onChange={(event) => {
            setQuestion(event.target.value as Question);
            setResult(null);
          }}
          options={QUESTIONS.map((item) => ({ value: item.value, label: item.label }))}
        />

        <TextField
          label="Nome"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder={defaultLabel(question)}
        />

        <MoneyField
          label={amountLabel(question)}
          required
          value={amountText}
          onChange={(event) => setAmountText(event.target.value)}
          placeholder="0,00"
        />

        <div className="grid grid-cols-2 gap-4">
          <DateField
            label={question === "PURCHASE" ? "Primeira parcela" : "A partir de"}
            required
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
          />

          {question === "PURCHASE" ? (
            <TextField
              label="Parcelas"
              type="number"
              min={1}
              max={60}
              value={installments}
              onChange={(event) => setInstallments(event.target.value)}
            />
          ) : question === "INCOME_LOSS" || question === "NEW_EXPENSE" ? (
            <TextField
              label="Por quantos meses"
              type="number"
              min={1}
              max={36}
              value={months}
              onChange={(event) => setMonths(event.target.value)}
            />
          ) : null}
        </div>

        <Button type="submit" className="w-full">
          Simular
        </Button>
      </form>

      {result ? <ScenarioResultView result={result} /> : null}
    </Card>
  );
}

function ScenarioResultView({ result }: { result: ReturnType<typeof simulate> }) {
  const affected = result.months.filter((month) => month.difference.amount !== 0);

  return (
    <div className="mt-6 border-t border-[color:var(--card-border)] pt-5">
      <h3 className="text-sm font-semibold">Resultado</h3>

      <p className="mt-2 text-sm">
        Isso adiciona <strong className="tabular">{formatMoney(result.additionalOutflows)}</strong>{" "}
        em saídas ao longo do período.
      </p>

      <p
        role="note"
        className={[
          "mt-3 rounded-lg border-l-4 p-3 text-sm text-[color:var(--color-ink-900)]",
          result.staysAboveZero
            ? "border-[color:var(--color-positive-600)] bg-[color:var(--color-positive-100)]"
            : "border-[color:var(--color-attention-600)] bg-[color:var(--color-attention-100)]",
        ].join(" ")}
      >
        {result.staysAboveZero ? (
          <>
            Com este cenário, o menor saldo livre no período seria{" "}
            <strong className="tabular">{formatMoney(result.lowestFreeBalance)}</strong>, em{" "}
            {formatCalendarDate(result.lowestFreeBalanceDate)}. O saldo não fica negativo em nenhum
            momento.
          </>
        ) : (
          <>
            Com este cenário, o saldo livre ficaria negativo. No pior momento, em{" "}
            {formatCalendarDate(result.lowestFreeBalanceDate)}, faltariam{" "}
            <strong className="tabular">{formatMoney(result.shortfallAtWorstPoint)}</strong>.
          </>
        )}
      </p>

      {result.newDeficitMonths.length > 0 ? (
        <p className="mt-3 text-sm">
          Meses que passariam a fechar no negativo:{" "}
          <strong>
            {result.newDeficitMonths.map((month) => formatMonthKey(month)).join(", ")}
          </strong>
          .
        </p>
      ) : null}

      {affected.length > 0 ? (
        <div className="-mx-4 mt-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <table className="w-full min-w-[26rem] border-collapse text-sm">
            <caption className="sr-only">Comparação do saldo livre por mês</caption>
            <thead>
              <tr className="border-b border-[color:var(--card-border)] text-left">
                <th scope="col" className="py-2 pr-3 font-medium">
                  Mês
                </th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">
                  Sem o cenário
                </th>
                <th scope="col" className="py-2 text-right font-medium">
                  Com o cenário
                </th>
              </tr>
            </thead>
            <tbody>
              {affected.slice(0, 12).map((month) => (
                <tr key={month.month} className="border-b border-[color:var(--card-border)]">
                  <th scope="row" className="py-2 pr-3 text-left font-normal">
                    {formatMonthKey(month.month)}
                  </th>
                  <td className="py-2 pr-3 text-right">
                    <MoneyText value={month.baselineFreeBalance} size="sm" />
                  </td>
                  <td className="py-2 text-right">
                    <MoneyText
                      value={month.scenarioFreeBalance}
                      size="sm"
                      tone={month.scenarioFreeBalance.amount < 0 ? "critical" : "neutral"}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <p className="mt-4 text-xs" style={{ color: "var(--muted-fg)" }}>
        Esta simulação não foi salva e não alterou nada. A decisão é sua.
      </p>
    </div>
  );
}

function defaultLabel(question: Question): string {
  switch (question) {
    case "PURCHASE":
      return "Compra parcelada";
    case "TRIP":
      return "Viagem";
    case "INCOME_LOSS":
      return "Redução de renda";
    case "NEW_EXPENSE":
      return "Nova despesa fixa";
    case "EMERGENCY":
      return "Despesa inesperada";
  }
}

function amountLabel(question: Question): string {
  switch (question) {
    case "PURCHASE":
      return "Valor total da compra";
    case "TRIP":
      return "Custo estimado";
    case "INCOME_LOSS":
      return "Quanto deixa de entrar por mês";
    case "NEW_EXPENSE":
      return "Valor mensal";
    case "EMERGENCY":
      return "Valor da despesa";
  }
}

function buildChange(
  question: Question,
  input: {
    name: string;
    amount: NonNullable<ReturnType<typeof fromDecimalString>>;
    installments: number;
    date: ReturnType<typeof calendarDate>;
    months: number;
  },
): ScenarioChange {
  switch (question) {
    case "PURCHASE":
      return {
        kind: "INSTALLMENT_PURCHASE",
        description: input.name,
        totalAmount: input.amount,
        installments: input.installments,
        firstDueDate: input.date,
      };
    case "TRIP":
    case "EMERGENCY":
      return {
        kind: "ONE_OFF_EXPENSE",
        description: input.name,
        amount: input.amount,
        date: input.date,
      };
    case "NEW_EXPENSE":
      return {
        kind: "RECURRING_EXPENSE",
        description: input.name,
        monthlyAmount: input.amount,
        startDate: input.date,
        endDate: addMonths(input.date, input.months - 1),
      };
    case "INCOME_LOSS":
      return {
        kind: "INCOME_CHANGE",
        description: input.name,
        monthlyDelta: { amount: -input.amount.amount, currency: input.amount.currency },
        startDate: input.date,
        endDate: addMonths(input.date, input.months - 1),
      };
  }
}

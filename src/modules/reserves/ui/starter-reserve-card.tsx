"use client";

import { useMemo, useState } from "react";
import { formatMoney } from "@/core/money/format";
import { money, subtract } from "@/core/money/money";
import { Button, Card, CardTitle, MoneyText, ProgressBar } from "@/components/ui/primitives";
import { useFinance } from "@/modules/household/ui/finance-provider";
import { useSession } from "@/modules/household/ui/session-provider";
import {
  monthsToStarterReserve,
  starterReserveStatus,
} from "@/modules/reserves/domain/starter-reserve";
import { useCollections } from "@/modules/shared/ui/use-collections";

/**
 * The first step, shown before the payoff.
 *
 * Deliberately placed where someone deep in debt will see it: the instinct is
 * to send every spare real to the creditor, and the households that do it end
 * up back on the card at the first emergency. The card disappears once the
 * step is done, so it never becomes background noise.
 */
export function StarterReserveCard() {
  const finance = useFinance();
  const { canWrite } = useSession();
  const collections = useCollections();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { status, monthlyCapacity } = useMemo(() => {
    const wholeMonths = finance.forecast.months.filter((month) => !month.isPartial);
    const average = (values: readonly number[]) =>
      values.length === 0
        ? 0
        : Math.round(values.reduce((total, value) => total + value, 0) / values.length);

    const outflows = average(wholeMonths.map((month) => month.committedOutflows.amount));
    const debt = average(wholeMonths.map((month) => month.debtCommitment.amount));
    const net = average(wholeMonths.map((month) => month.net.amount));

    return {
      // The essentials, without the debt servicing: the cushion protects the
      // month's living costs, not the instalments.
      status: starterReserveStatus(finance.reserves, subtract(money(outflows), money(debt))),
      monthlyCapacity: money(Math.max(net, 0)),
    };
  }, [finance.forecast.months, finance.reserves]);

  if (status.isComplete) return null;

  const months = monthsToStarterReserve(status, monthlyCapacity);

  async function createReserve() {
    if (!collections.householdId) return;
    setError(null);
    setCreating(true);
    try {
      await collections.reserves.create({
        householdId: collections.householdId,
        name: "Reserva de partida",
        purpose: "EMERGENCY",
        currentAmount: money(0),
        targetAmount: status.target,
        isProtected: true,
        visibility: "HOUSEHOLD",
        archived: false,
      } as never);
    } catch (createError) {
      console.error(createError);
      setError("Não foi possível criar agora. Tente novamente.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <Card>
      <CardTitle hint="O primeiro degrau, antes de quitar tudo.">Reserva de partida</CardTitle>

      <p className="text-sm" style={{ color: "var(--muted-fg)" }}>
        Guardar um pouco enquanto ainda se deve parece contraintuitivo, e é o que impede um pneu
        furado de jogar a família de volta no cartão. A meta é pequena de propósito:{" "}
        <strong>{formatMoney(status.target)}</strong>.
      </p>

      <div className="mt-4">
        <ProgressBar
          ratio={status.ratio}
          label="Progresso da reserva de partida"
          tone={status.ratio >= 0.5 ? "positive" : "brand"}
        />
        <p className="mt-1.5 text-sm">
          <MoneyText value={status.current} size="sm" tone="positive" /> de{" "}
          {formatMoney(status.target)} ·{" "}
          <span style={{ color: "var(--muted-fg)" }}>
            faltam <MoneyText value={status.missing} size="sm" />
          </span>
        </p>
        <p className="mt-1 text-xs" style={{ color: "var(--muted-fg)" }}>
          {months === null
            ? "Com a sobra atual do mês em zero, essa reserva só sai reduzindo um compromisso ou aumentando a entrada."
            : months === 0
              ? "Você já chegou lá."
              : `No ritmo da sua sobra mensal, cerca de ${months} ${months === 1 ? "mês" : "meses"}.`}
        </p>
      </div>

      {error ? (
        <p role="alert" className="mt-3 text-sm font-medium text-[color:var(--tone-critical)]">
          {error}
        </p>
      ) : null}

      {!status.hasEmergencyReserve && canWrite ? (
        <Button className="mt-4" onClick={() => void createReserve()} disabled={creating}>
          {creating ? "Criando…" : "Criar a reserva de partida"}
        </Button>
      ) : null}
    </Card>
  );
}

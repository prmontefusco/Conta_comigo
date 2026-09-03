"use client";

import { useState } from "react";
import { formatMoney } from "@/core/money/format";
import { fromDecimalString } from "@/core/money/money";
import {
  Badge,
  Button,
  Callout,
  Card,
  CardTitle,
  EmptyState,
  MoneyText,
  ProgressBar,
  Spinner,
  Stat,
} from "@/components/ui/primitives";
import { FormError, MoneyField, SelectField, TextField } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import {
  emergencyCoverage,
  monthsOfRunway,
  progressOf,
  RESERVE_PURPOSE_LABELS,
  type ReservePurpose,
} from "@/modules/reserves/domain/reserve";
import { useFinance } from "@/modules/household/ui/finance-provider";
import { useSession } from "@/modules/household/ui/session-provider";
import { StarterReserveCard } from "@/modules/reserves/ui/starter-reserve-card";
import { FinancialInsightCard } from "@/modules/education/ui/financial-insight-card";
import { useCollections } from "@/modules/shared/ui/use-collections";

/**
 * Reserves and goals.
 *
 * The page exists to make one distinction visible: money set aside is still
 * yours, so it is part of the balance, but it is not part of what you can
 * decide to spend.
 */
export default function ReservesPage() {
  const finance = useFinance();
  const { canWrite } = useSession();
  const [creating, setCreating] = useState(false);

  if (finance.loading) return <Spinner label="Carregando suas reservas" />;

  const active = finance.reserves.filter((reserve) => !reserve.archived);

  const monthlyExpenses = {
    amount: Math.round(
      finance.forecast.months
        .slice(0, 3)
        .reduce((acc, month) => acc + month.committedOutflows.amount, 0) / 3,
    ),
    currency: "BRL" as const,
  };
  const runway = monthsOfRunway(active, monthlyExpenses);
  const coverage = emergencyCoverage(active, monthlyExpenses);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Reservas e metas</h1>
        {canWrite ? <Button onClick={() => setCreating(true)}>Nova reserva</Button> : null}
      </div>

      <FinancialInsightCard
        tag="O Colchão de Segurança"
        title="Por Que Juntar os Primeiros R$ 500 a R$ 1.000 Antes de Quitar Dívidas?"
        description="O instinto natural de quem se endivida é jogar todo o dinheiro que sobra nas dívidas. Isso falha porque o primeiro imprevisto (remédio, gás, pneu furado) obriga a pessoa a recorrer ao cartão rotativo de novo."
        tips={[
          "Construa a Reserva de Respiro primeiro: ter R$ 1.000 guardados é o que impede seu plano de reiniciar do zero no primeiro imprevisto.",
          "Reserva não é gasto: guardar dinheiro não diminui seu patrimônio, apenas separa o dinheiro do dia a dia do dinheiro protegido.",
          "Reserva de Emergência Plena: depois que eliminar as dívidas de juros altos, a meta da família será acumular de 3 a 6 meses do custo de vida básico.",
        ]}
        helpTopic="Crie 'potes' de reservas para emergências ou metas familiares. O app desconta o valor reservado do seu 'saldo livre' para você não gastar por engano."
      />

      <StarterReserveCard />

      <Card>
        <CardTitle>Como isso afeta o seu saldo</CardTitle>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Stat label="Saldo nas contas" value={finance.totalCash} />
          <Stat label="Reserva protegida" value={finance.protectedReserve} tone="outflow" />
          <Stat
            label="Disponível para decidir"
            value={finance.overview.today.spendableCash}
            tone="positive"
          />
        </dl>

        <Callout tone="info">
          Guardar dinheiro não é gastar. A reserva continua fazendo parte do que é seu; ela só deixa
          de contar como disponível para novos gastos.
        </Callout>
      </Card>

      {active.length === 0 ? (
        <Card>
          <EmptyState
            title="Nenhuma reserva criada"
            description="Uma reserva separa parte do saldo para um objetivo: emergência, viagem, impostos, manutenção."
            action={
              canWrite ? <Button onClick={() => setCreating(true)}>Nova reserva</Button> : undefined
            }
          />
        </Card>
      ) : (
        <>
          <Card>
            <CardTitle>Se acontecer um imprevisto</CardTitle>
            <p className="text-sm">
              Suas reservas de emergência somam{" "}
              <strong className="tabular">{formatMoney(coverage.available)}</strong>. Considerando
              uma média de <strong className="tabular">{formatMoney(monthlyExpenses)}</strong> de
              compromissos por mês, isso cobre{" "}
              <strong>{Number.isFinite(runway) ? runway.toFixed(1).replace(".", ",") : "—"}</strong>{" "}
              {runway === 1 ? "mês" : "meses"}.
            </p>
          </Card>

          <Card>
            <CardTitle>Suas reservas</CardTitle>
            <ul className="space-y-4">
              {active.map((reserve) => {
                const progress = progressOf(reserve);
                return (
                  <li key={reserve.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{reserve.name}</p>
                        <p className="text-xs" style={{ color: "var(--muted-fg)" }}>
                          {RESERVE_PURPOSE_LABELS[reserve.purpose]}
                        </p>
                        {!reserve.isProtected ? (
                          <span className="mt-1 inline-block">
                            <Badge>Não protegida</Badge>
                          </span>
                        ) : null}
                      </div>
                      <div className="shrink-0 text-right">
                        <MoneyText value={reserve.currentAmount} size="lg" />
                        {progress.target ? (
                          <p className="text-xs" style={{ color: "var(--muted-fg)" }}>
                            de {formatMoney(progress.target)}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    {progress.ratio !== null ? (
                      <div className="mt-2">
                        <ProgressBar
                          ratio={progress.ratio}
                          label={`Progresso da reserva ${reserve.name}`}
                          tone={progress.belowTarget ? "brand" : "positive"}
                        />
                        {progress.belowTarget ? (
                          <p className="mt-1.5 text-xs" style={{ color: "var(--muted-fg)" }}>
                            Faltam {formatMoney(progress.missing)} para a meta.
                          </p>
                        ) : (
                          <p className="mt-1.5 text-xs" style={{ color: "var(--muted-fg)" }}>
                            Meta atingida.
                          </p>
                        )}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </Card>
        </>
      )}

      <NewReserveDialog open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}

function NewReserveDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { household } = useSession();
  const collections = useCollections();

  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState<ReservePurpose>("EMERGENCY");
  const [currentText, setCurrentText] = useState("");
  const [targetText, setTargetText] = useState("");
  const [isProtected, setIsProtected] = useState("true");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!household) return;

    if (name.trim().length < 2) {
      setError("Dê um nome à reserva.");
      return;
    }
    const currentAmount = fromDecimalString(currentText || "0");
    if (!currentAmount) {
      setError("Informe um valor válido. Pode ser zero.");
      return;
    }

    setSaving(true);
    try {
      await collections.reserves.create({
        householdId: household.id,
        name: name.trim(),
        purpose,
        currentAmount,
        targetAmount: targetText ? (fromDecimalString(targetText) ?? undefined) : undefined,
        isProtected: isProtected === "true",
        visibility: "HOUSEHOLD",
        archived: false,
      } as never);
      setName("");
      setCurrentText("");
      setTargetText("");
      onClose();
    } catch (saveError) {
      console.error(saveError);
      setError("Não foi possível salvar agora. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Nova reserva">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error ? <FormError>{error}</FormError> : null}

        <TextField
          label="Nome"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Reserva de emergência"
        />

        <SelectField
          label="Objetivo"
          value={purpose}
          onChange={(event) => setPurpose(event.target.value as ReservePurpose)}
          options={Object.entries(RESERVE_PURPOSE_LABELS).map(([value, label]) => ({
            value,
            label,
          }))}
        />

        <MoneyField
          label="Valor já guardado"
          required
          value={currentText}
          onChange={(event) => setCurrentText(event.target.value)}
          placeholder="0,00"
        />

        <MoneyField
          label="Meta"
          value={targetText}
          onChange={(event) => setTargetText(event.target.value)}
          placeholder="0,00"
          hint="Opcional."
        />

        <SelectField
          label="Proteger este valor"
          value={isProtected}
          onChange={(event) => setIsProtected(event.target.value)}
          hint="Protegida, a reserva sai do saldo livre. Não protegida, ela continua contando como disponível."
          options={[
            { value: "true", label: "Sim, não conta como disponível" },
            { value: "false", label: "Não, ainda posso usar" },
          ]}
        />

        <div className="flex gap-2 pt-2">
          <Button type="submit" className="flex-1" disabled={saving}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </form>
    </Modal>
  );
}

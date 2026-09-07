"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatCalendarDate } from "@/core/date/calendar-date";
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
  Spinner,
} from "@/components/ui/primitives";
import { DateField, FormError, MoneyField, SelectField, TextField } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import {
  DECISION_KINDS,
  DECISION_KIND_EXAMPLES,
  DECISION_KIND_LABELS,
  DECISION_STATUS_LABELS,
  filterByKind,
  summariseDecisions,
  type Decision,
  type DecisionKind,
  type DecisionStatus,
} from "@/modules/decisions/domain/decision";
import { useFinance } from "@/modules/household/ui/finance-provider";
import { useSession } from "@/modules/household/ui/session-provider";
import { useCollections } from "@/modules/shared/ui/use-collections";

/**
 * Histórico de decisões.
 *
 * O aplicativo dizia o tempo todo o que estava errado e o que dava para
 * fazer. Não guardava nada do que a casa efetivamente fez a respeito — e sem
 * isso, três meses depois ninguém lembra se a ligação para a financeira
 * aconteceu, o que foi proposto e o que responderam.
 *
 * A tela existe para uma frase: "em março a gente decidiu isto". Ela não
 * julga o que foi decidido, não cobra o que ficou pendente e não recalcula
 * nada — registrar "vou renegociar" não move um centavo em lugar nenhum. O
 * que ela faz é dar à família um lugar onde a própria história fica escrita,
 * com data, para usar no atendimento seguinte.
 */
export default function DecisionsPage() {
  const finance = useFinance();
  const { canWrite } = useSession();
  const [creating, setCreating] = useState(false);
  const [kindFilter, setKindFilter] = useState<DecisionKind | null>(null);

  const summary = useMemo(() => summariseDecisions(finance.decisions), [finance.decisions]);
  const visible = filterByKind(finance.decisions, kindFilter);

  if (finance.loading) return <Spinner label="Carregando as decisões da família" />;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Decisões da família</h1>
          <p className="mt-1 max-w-2xl text-sm" style={{ color: "var(--muted-fg)" }}>
            Um registro do que vocês combinaram: uma renegociação, uma compra adiada, uma conta
            priorizada. Serve para lembrar o que já foi feito e para chegar preparado na próxima
            conversa com o credor.
          </p>
        </div>
        {canWrite ? (
          <Button onClick={() => setCreating(true)}>Registrar decisão</Button>
        ) : (
          <Badge>Somente leitura</Badge>
        )}
      </header>

      <Card>
        <CardTitle>O que já foi registrado</CardTitle>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <SummaryItem label="Decisões registradas" value={String(summary.total)} />
          <SummaryItem label="Já feitas" value={String(summary.done)} />
          <SummaryItem label="Ainda combinadas" value={String(summary.planned)} />
          <SummaryItem
            label="Valor das decisões feitas"
            value={formatMoney(summary.amountDone)}
            hint="Só das que tinham valor informado."
          />
        </dl>

        <Callout tone="info">
          Registrar uma decisão não muda saldo, projeção nem dívida. Quando o pagamento acontecer,
          lance em{" "}
          <Link href="/app/dia-a-dia" className="underline underline-offset-2">
            Dia a dia
          </Link>{" "}
          para os números acompanharem.
        </Callout>
      </Card>

      <Card>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por tipo">
          <FilterButton active={kindFilter === null} onClick={() => setKindFilter(null)}>
            Todas
          </FilterButton>
          {DECISION_KINDS.map((kind) => (
            <FilterButton
              key={kind}
              active={kindFilter === kind}
              onClick={() => setKindFilter(kind)}
            >
              {DECISION_KIND_LABELS[kind]}
            </FilterButton>
          ))}
        </div>
      </Card>

      {visible.length === 0 ? (
        <Card>
          <EmptyState
            title={
              finance.decisions.length === 0
                ? "Nenhuma decisão registrada ainda"
                : "Nenhuma decisão deste tipo"
            }
            description={
              finance.decisions.length === 0
                ? "Comece pela última coisa que vocês combinaram sobre dinheiro, mesmo que pequena: adiar uma compra, ligar para um credor, guardar um valor por semana."
                : "Troque o filtro para ver as outras decisões registradas."
            }
            action={
              canWrite && finance.decisions.length === 0 ? (
                <Button onClick={() => setCreating(true)}>Registrar decisão</Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <Card>
          <CardTitle hint="Da mais recente para a mais antiga.">Linha do tempo</CardTitle>
          <ul className="divide-y divide-[color:var(--card-border)]">
            {visible.map((decision) => (
              <li key={decision.id}>
                <DecisionRow decision={decision} canWrite={canWrite} />
              </li>
            ))}
          </ul>
        </Card>
      )}

      <NewDecisionDialog open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}

function SummaryItem({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <dt className="text-xs" style={{ color: "var(--muted-fg)" }}>
        {label}
      </dt>
      {/* O texto de apoio fica dentro do <dd>: um <p> solto entre os pares
          da lista de definição é uma violação de estrutura, e o axe reprova. */}
      <dd className="mt-0.5">
        <span className="tabular block text-lg font-semibold">{value}</span>
        {hint ? (
          <span className="block text-xs" style={{ color: "var(--muted-fg)" }}>
            {hint}
          </span>
        ) : null}
      </dd>
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`min-h-11 rounded-full px-3 py-1.5 text-sm font-semibold transition ${
        active
          ? "bg-[color:var(--color-brand-600)] text-white"
          : "bg-[color:var(--color-surface-sunken)] hover:bg-[color:var(--color-ink-100)]"
      }`}
    >
      {children}
    </button>
  );
}

function DecisionRow({ decision, canWrite }: { decision: Decision; canWrite: boolean }) {
  const collections = useCollections();
  const [saving, setSaving] = useState(false);

  const nextStatus: DecisionStatus = decision.status === "DONE" ? "PLANNED" : "DONE";

  async function toggleStatus() {
    setSaving(true);
    try {
      await collections.decisions.update(decision.id, { status: nextStatus });
    } catch (error) {
      console.error(error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold tracking-wide text-[color:var(--color-brand-700)] uppercase">
            {DECISION_KIND_LABELS[decision.kind]}
          </span>
          <Badge tone={decision.status === "DONE" ? "positive" : "neutral"}>
            {DECISION_STATUS_LABELS[decision.status]}
          </Badge>
        </div>
        <p className="mt-1 text-sm font-medium">{decision.description}</p>
        <p className="mt-0.5 text-xs" style={{ color: "var(--muted-fg)" }}>
          {formatCalendarDate(decision.decidedOn)}
        </p>
        {decision.notes ? (
          <p className="mt-1 text-xs" style={{ color: "var(--muted-fg)" }}>
            {decision.notes}
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-3">
        {decision.amount ? <MoneyText value={decision.amount} size="sm" /> : null}
        {canWrite ? (
          <Button variant="secondary" onClick={() => void toggleStatus()} disabled={saving}>
            {decision.status === "DONE" ? "Marcar como combinada" : "Marcar como feita"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function NewDecisionDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { household } = useSession();
  const finance = useFinance();
  const collections = useCollections();

  const [kind, setKind] = useState<DecisionKind>("RENEGOTIATE_DEBT");
  const [description, setDescription] = useState("");
  const [amountText, setAmountText] = useState("");
  // Já vem preenchida com hoje: ninguém precisa digitar data para registrar,
  // e quem anota uma semana depois pode corrigir.
  const [decidedOn, setDecidedOn] = useState<string>(finance.asOf);
  const [status, setStatus] = useState<DecisionStatus>("PLANNED");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!household) return;

    if (description.trim().length < 3) {
      setError("Escreva em uma linha o que foi decidido.");
      return;
    }

    // Valor é opcional; se veio escrito, precisa ser um número legível.
    const amount = amountText.trim() ? fromDecimalString(amountText) : undefined;
    if (amountText.trim() && !amount) {
      setError("Informe um valor válido, ou deixe o campo em branco.");
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(decidedOn)) {
      setError("Informe a data no formato dia/mês/ano.");
      return;
    }

    setSaving(true);
    try {
      await collections.decisions.create({
        householdId: household.id,
        kind,
        description: description.trim(),
        ...(amount ? { amount } : {}),
        decidedOn: decidedOn as Decision["decidedOn"],
        status,
        visibility: "HOUSEHOLD",
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      } as never);

      setDescription("");
      setAmountText("");
      setNotes("");
      setStatus("PLANNED");
      onClose();
    } catch (saveError) {
      console.error(saveError);
      setError("Não foi possível salvar agora. Tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Registrar decisão"
      description="Uma linha basta. Ninguém além da sua família vê isto."
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error ? <FormError>{error}</FormError> : null}

        <SelectField
          label="Tipo de decisão"
          value={kind}
          onChange={(event) => setKind(event.target.value as DecisionKind)}
          options={DECISION_KINDS.map((value) => ({
            value,
            label: DECISION_KIND_LABELS[value],
          }))}
        />

        <TextField
          label="O que foi decidido"
          required
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder={DECISION_KIND_EXAMPLES[kind]}
          hint={`Exemplo: ${DECISION_KIND_EXAMPLES[kind]}`}
        />

        <MoneyField
          label="Valor envolvido"
          value={amountText}
          onChange={(event) => setAmountText(event.target.value)}
          placeholder="0,00"
          hint="Opcional. Nem toda decisão tem um valor."
        />

        <DateField
          label="Data da decisão"
          value={decidedOn}
          onChange={(event) => setDecidedOn(event.target.value)}
          hint="Já vem com a data de hoje. Mude se a decisão foi em outro dia."
        />

        <SelectField
          label="Situação"
          value={status}
          onChange={(event) => setStatus(event.target.value as DecisionStatus)}
          options={[
            { value: "PLANNED", label: "Combinado, ainda vai acontecer" },
            { value: "DONE", label: "Já foi feito" },
          ]}
        />

        <TextField
          label="Observação"
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Com quem falou, o que responderam, prazo dado"
          hint="Opcional."
        />

        <div className="flex gap-2 pt-2">
          <Button type="submit" className="flex-1" disabled={saving}>
            {saving ? "Salvando…" : "Salvar decisão"}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </form>
    </Modal>
  );
}

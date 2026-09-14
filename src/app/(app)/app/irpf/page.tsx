"use client";

import { useEffect, useMemo, useState } from "react";
import { formatCalendarDate, type CalendarDate } from "@/core/date/calendar-date";
import { formatMoney } from "@/core/money/format";
import { fromDecimalString, sum, zero, type Money } from "@/core/money/money";
import { DateField, FormError, MoneyField, SelectField, TextField } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
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
import { useFinance } from "@/modules/household/ui/finance-provider";
import { useSession } from "@/modules/household/ui/session-provider";
import type { IrpfRecordDoc } from "@/modules/shared/infrastructure/schemas";
import { useCollections } from "@/modules/shared/ui/use-collections";
import {
  AI_UPLOAD_ACCEPT,
  messageFromResponse,
  prepareUpload,
  UploadError,
} from "@/modules/receipts/ui/file-upload";

type IrpfKind = IrpfRecordDoc["kind"];

const KIND_LABELS: Record<IrpfKind, string> = {
  HEALTH: "Saúde",
  EDUCATION: "Educação",
  INCOME: "Rendimentos",
  DEPENDENT: "Dependentes",
  ALIMONY: "Pensão alimentícia",
  RENT: "Aluguel",
  ASSET: "Bens e direitos",
  DEBT: "Dívidas e ônus",
  DONATION: "Doações",
  OTHER: "Outros",
};

const KIND_OPTIONS = Object.entries(KIND_LABELS).map(([value, label]) => ({ value, label }));

const DEDUCTIBLE_KINDS = new Set<IrpfKind>(["HEALTH", "EDUCATION", "ALIMONY"]);

interface IrpfForm {
  taxYear: string;
  kind: IrpfKind;
  title: string;
  amount: string;
  paidOn: string;
  documentName: string;
  documentIssuer: string;
  documentIdentifier: string;
  fileName: string;
  notes: string;
}

export default function IrpfPage() {
  const finance = useFinance();
  const { canWrite } = useSession();
  const [year, setYear] = useState(() => String(Number(finance.asOf.slice(0, 4))));
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<IrpfForm | null>(null);

  const taxYear = Number(year);
  const records = useMemo(
    () =>
      finance.irpfRecords
        .filter((record) => !record.archived && record.taxYear === taxYear)
        .sort((a, b) => {
          const dateA = a.paidOn ?? "";
          const dateB = b.paidOn ?? "";
          if (dateA !== dateB) return dateB.localeCompare(dateA);
          return a.title.localeCompare(b.title, "pt-BR");
        }),
    [finance.irpfRecords, taxYear],
  );
  const summary = useMemo(() => summarise(records), [records]);
  const report = useMemo(() => buildReport(taxYear, records), [records, taxYear]);

  if (finance.loading) return <Spinner label="Carregando IRPF" />;

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold">IRPF</h1>
          <p className="mt-1 max-w-2xl text-sm" style={{ color: "var(--muted-fg)" }}>
            Organize recibos, informes, bens, dívidas e despesas dedutíveis por ano-calendário.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="sr-only" htmlFor="irpf-year">
            Ano-calendário
          </label>
          <input
            id="irpf-year"
            className="min-h-11 w-28 rounded-lg border border-[color:var(--card-border)] bg-[color:var(--card-bg)] px-3 text-base"
            inputMode="numeric"
            value={year}
            onChange={(event) => setYear(event.target.value)}
          />
          {canWrite ? (
            <>
              <IrpfImportButton
                taxYear={taxYear}
                onReading={(form) => {
                  setDraft(form);
                  setCreating(true);
                }}
              />
              <Button
                onClick={() => {
                  setDraft(null);
                  setCreating(true);
                }}
              >
                Adicionar item
              </Button>
            </>
          ) : null}
        </div>
      </header>

      <Card>
        <CardTitle hint="Use como checklist antes de abrir o programa da Receita.">
          Resumo do ano
        </CardTitle>
        <dl className="grid gap-4 sm:grid-cols-4">
          <SummaryItem label="Itens guardados" value={String(records.length)} />
          <SummaryMoney label="Saúde" value={summary.byKind.HEALTH} />
          <SummaryMoney label="Educação" value={summary.byKind.EDUCATION} />
          <SummaryMoney label="Dedutíveis registrados" value={summary.deductibleTotal} />
        </dl>
      </Card>

      <Callout tone="info">
        Este painel organiza as informações para preenchimento. Ele não substitui a conferência das
        regras oficiais do IRPF nem envia declaração para a Receita Federal.
      </Callout>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.8fr)]">
        <Card>
          <CardTitle>Itens do IRPF</CardTitle>
          {records.length === 0 ? (
            <EmptyState
              title="Nada registrado para este ano"
              description="Adicione recibos médicos, escola, informes de rendimento, aluguel, bens ou dívidas. O valor é opcional para documentos que só servem como comprovante."
              action={
                canWrite ? (
                  <Button
                    onClick={() => {
                      setDraft(null);
                      setCreating(true);
                    }}
                  >
                    Adicionar item
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <ul className="divide-y divide-[color:var(--card-border)]">
              {records.map((record) => (
                <li key={record.id}>
                  <IrpfRow record={record} canWrite={canWrite} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardTitle hint="Texto simples para revisar, imprimir ou usar como roteiro.">
            Relatório
          </CardTitle>
          <textarea
            readOnly
            value={report}
            className="min-h-80 w-full resize-y rounded-lg border border-[color:var(--card-border)] bg-[color:var(--color-surface-sunken)] p-3 font-mono text-xs leading-relaxed"
          />
          <div className="mt-3 flex justify-end">
            <Button
              variant="secondary"
              onClick={() => void navigator.clipboard?.writeText(report)}
              disabled={!report.trim()}
            >
              Copiar relatório
            </Button>
          </div>
        </Card>
      </div>

      <NewIrpfRecordDialog
        open={creating}
        defaultYear={taxYear}
        initialForm={draft}
        onClose={() => {
          setCreating(false);
          setDraft(null);
        }}
      />
    </div>
  );
}

function IrpfImportButton({
  taxYear,
  onReading,
}: {
  taxYear: number;
  onReading: (form: IrpfForm) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      const upload = await prepareUpload(file);
      const response = await fetch("/api/ai/irpf", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fileBase64: upload.base64, mimeType: upload.mimeType }),
      });
      const data: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setError(messageFromResponse(data) ?? "Não foi possível ler este documento.");
        return;
      }

      const reading = readIrpfResponse(data);
      if (!reading) {
        setError("O documento foi lido, mas não trouxe dados suficientes.");
        return;
      }

      onReading({
        taxYear: String(taxYear),
        kind: reading.kind,
        title: reading.title,
        amount: reading.amount === null ? "" : String(reading.amount).replace(".", ","),
        paidOn: reading.paidOn ?? "",
        documentName: reading.documentName ?? "",
        documentIssuer: reading.documentIssuer ?? "",
        documentIdentifier: reading.documentIdentifier ?? "",
        fileName: file.name,
        notes: reading.notes ?? "",
      });
    } catch (uploadError) {
      setError(
        uploadError instanceof UploadError
          ? uploadError.message
          : "Não foi possível preparar este arquivo.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-1">
      <label className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-[color:var(--card-border)] bg-[color:var(--card-bg)] px-4 text-sm font-medium hover:bg-[color:var(--color-ink-50)]">
        {busy ? "Lendo..." : "Importar documento"}
        <input
          type="file"
          accept={AI_UPLOAD_ACCEPT}
          className="sr-only"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.currentTarget.value = "";
            if (file) void onFile(file);
          }}
        />
      </label>
      {error ? (
        <p className="max-w-xs text-xs text-[color:var(--tone-critical)]">{error}</p>
      ) : null}
    </div>
  );
}

function IrpfRow({ record, canWrite }: { record: IrpfRecordDoc; canWrite: boolean }) {
  const collections = useCollections();
  const [saving, setSaving] = useState(false);

  async function archive() {
    setSaving(true);
    try {
      await collections.irpfRecords.update(record.id, { archived: true });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={DEDUCTIBLE_KINDS.has(record.kind) ? "positive" : "neutral"}>
            {KIND_LABELS[record.kind]}
          </Badge>
          {record.fileName ? <Badge tone="brand">Documento</Badge> : null}
        </div>
        <p className="mt-1 font-medium">{record.title}</p>
        <p className="mt-0.5 text-sm" style={{ color: "var(--muted-fg)" }}>
          {[record.paidOn ? formatCalendarDate(record.paidOn) : null, record.documentIssuer]
            .filter(Boolean)
            .join(" · ") || "Sem data informada"}
        </p>
        {record.documentName || record.documentIdentifier || record.fileName ? (
          <p className="mt-1 text-xs" style={{ color: "var(--muted-fg)" }}>
            {[record.documentName, record.documentIdentifier, record.fileName]
              .filter(Boolean)
              .join(" · ")}
          </p>
        ) : null}
        {record.notes ? (
          <p className="mt-1 text-xs" style={{ color: "var(--muted-fg)" }}>
            {record.notes}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {record.amount ? <MoneyText value={record.amount} /> : <span className="text-sm">Sem valor</span>}
        {canWrite ? (
          <Button variant="secondary" onClick={() => void archive()} disabled={saving}>
            Arquivar
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function NewIrpfRecordDialog({
  open,
  defaultYear,
  initialForm,
  onClose,
}: {
  open: boolean;
  defaultYear: number;
  initialForm: IrpfForm | null;
  onClose: () => void;
}) {
  const { household } = useSession();
  const collections = useCollections();
  const [form, setForm] = useState<IrpfForm>(() => emptyForm(defaultYear));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(initialForm ?? emptyForm(defaultYear));
    setError(null);
  }, [defaultYear, initialForm, open]);

  function close() {
    setForm(emptyForm(defaultYear));
    setError(null);
    onClose();
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!household) return;

    const taxYear = Number(form.taxYear);
    if (!Number.isInteger(taxYear) || taxYear < 2000 || taxYear > 2100) {
      setError("Informe um ano-calendário válido.");
      return;
    }
    if (form.title.trim().length < 2) {
      setError("Informe uma descrição curta para o item.");
      return;
    }
    const amount = form.amount.trim() ? fromDecimalString(form.amount) : undefined;
    if (form.amount.trim() && !amount) {
      setError("Informe um valor válido, ou deixe em branco.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await collections.irpfRecords.create({
        householdId: household.id,
        taxYear,
        kind: form.kind,
        title: form.title.trim(),
        ...(amount ? { amount } : {}),
        paidOn: blankToUndefined(form.paidOn) as CalendarDate | undefined,
        documentName: blankToUndefined(form.documentName),
        documentIssuer: blankToUndefined(form.documentIssuer),
        documentIdentifier: blankToUndefined(form.documentIdentifier),
        fileName: blankToUndefined(form.fileName),
        notes: blankToUndefined(form.notes),
        archived: false,
      });
      close();
    } catch (saveError) {
      console.error(saveError);
      setError("Não foi possível salvar o item do IRPF agora.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Adicionar item do IRPF"
      description="Registre o essencial agora. Documento, CNPJ/CPF e observações podem ficar em branco."
    >
      <form className="space-y-4" onSubmit={submit} noValidate>
        <FormError>{error}</FormError>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            label="Ano-calendário"
            required
            inputMode="numeric"
            value={form.taxYear}
            onChange={(event) => setForm({ ...form, taxYear: event.target.value })}
          />
          <SelectField
            label="Tipo"
            value={form.kind}
            onChange={(event) => setForm({ ...form, kind: event.target.value as IrpfKind })}
            options={KIND_OPTIONS}
          />
        </div>
        <TextField
          label="Descrição"
          required
          value={form.title}
          onChange={(event) => setForm({ ...form, title: event.target.value })}
          placeholder="Consulta médica, escola, informe do banco"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <MoneyField
            label="Valor"
            value={form.amount}
            onChange={(event) => setForm({ ...form, amount: event.target.value })}
            placeholder="0,00"
            hint="Opcional para documentos sem valor."
          />
          <DateField
            label="Data"
            value={form.paidOn}
            onChange={(event) => setForm({ ...form, paidOn: event.target.value })}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            label="Documento"
            value={form.documentName}
            onChange={(event) => setForm({ ...form, documentName: event.target.value })}
            placeholder="Recibo, nota fiscal, informe"
          />
          <TextField
            label="Emissor"
            value={form.documentIssuer}
            onChange={(event) => setForm({ ...form, documentIssuer: event.target.value })}
            placeholder="Clínica, escola, banco"
          />
          <TextField
            label="CPF/CNPJ/Número"
            value={form.documentIdentifier}
            onChange={(event) => setForm({ ...form, documentIdentifier: event.target.value })}
          />
          <TextField
            label="Arquivo guardado"
            value={form.fileName}
            onChange={(event) => setForm({ ...form, fileName: event.target.value })}
            placeholder="recibo-consulta.pdf"
            hint="Por enquanto é uma referência ao arquivo."
          />
        </div>
        <TextField
          label="Observação"
          value={form.notes}
          onChange={(event) => setForm({ ...form, notes: event.target.value })}
          placeholder="Detalhes úteis para conferir depois"
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={close}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving || !collections.ready}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm" style={{ color: "var(--muted-fg)" }}>
        {label}
      </dt>
      <dd className="mt-0.5 text-xl font-semibold tabular">{value}</dd>
    </div>
  );
}

function SummaryMoney({ label, value }: { label: string; value: Money }) {
  return (
    <div>
      <dt className="text-sm" style={{ color: "var(--muted-fg)" }}>
        {label}
      </dt>
      <dd className="mt-0.5">
        <MoneyText value={value} size="lg" />
      </dd>
    </div>
  );
}

function summarise(records: readonly IrpfRecordDoc[]) {
  const byKind = Object.fromEntries(
    Object.keys(KIND_LABELS).map((kind) => [kind, zero()]),
  ) as Record<IrpfKind, Money>;

  for (const record of records) {
    if (!record.amount) continue;
    byKind[record.kind] = sum([byKind[record.kind], record.amount]);
  }

  return {
    byKind,
    deductibleTotal: sum([...DEDUCTIBLE_KINDS].map((kind) => byKind[kind])),
  };
}

function buildReport(taxYear: number, records: readonly IrpfRecordDoc[]): string {
  const lines = [`IRPF - Ano-calendário ${taxYear}`, ""];
  if (records.length === 0) {
    lines.push("Nenhum item registrado.");
    return lines.join("\n");
  }

  for (const kind of Object.keys(KIND_LABELS) as IrpfKind[]) {
    const group = records.filter((record) => record.kind === kind);
    if (group.length === 0) continue;
    const total = sum(group.map((record) => record.amount ?? zero()));
    lines.push(`${KIND_LABELS[kind]} - total registrado: ${formatMoney(total)}`);
    for (const record of group) {
      const parts = [
        record.paidOn ? formatCalendarDate(record.paidOn) : "sem data",
        record.amount ? formatMoney(record.amount) : "sem valor",
        record.documentIssuer,
        record.documentIdentifier,
        record.fileName ? `arquivo: ${record.fileName}` : null,
      ].filter(Boolean);
      lines.push(`- ${record.title}: ${parts.join(" | ")}`);
      if (record.notes) lines.push(`  Obs.: ${record.notes}`);
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

function emptyForm(defaultYear: number): IrpfForm {
  return {
    taxYear: String(defaultYear),
    kind: "HEALTH",
    title: "",
    amount: "",
    paidOn: "",
    documentName: "",
    documentIssuer: "",
    documentIdentifier: "",
    fileName: "",
    notes: "",
  };
}

function blankToUndefined(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

interface IrpfApiReading {
  kind: IrpfKind;
  title: string;
  amount: number | null;
  paidOn: string | null;
  documentName: string | null;
  documentIssuer: string | null;
  documentIdentifier: string | null;
  notes: string | null;
}

function readIrpfResponse(data: unknown): IrpfApiReading | null {
  if (typeof data !== "object" || data === null) return null;
  const reading = (data as Record<string, unknown>).reading;
  if (typeof reading !== "object" || reading === null) return null;

  const value = reading as Record<string, unknown>;
  if (!isIrpfKind(value.kind) || typeof value.title !== "string" || value.title.trim() === "") {
    return null;
  }

  return {
    kind: value.kind,
    title: value.title,
    amount: typeof value.amount === "number" && Number.isFinite(value.amount) ? value.amount : null,
    paidOn: nullableString(value.paidOn),
    documentName: nullableString(value.documentName),
    documentIssuer: nullableString(value.documentIssuer),
    documentIdentifier: nullableString(value.documentIdentifier),
    notes: nullableString(value.notes),
  };
}

function isIrpfKind(value: unknown): value is IrpfKind {
  return typeof value === "string" && value in KIND_LABELS;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

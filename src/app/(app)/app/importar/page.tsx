"use client";

import { useMemo, useState } from "react";
import { formatCalendarDate, tryCalendarDate, type CalendarDate } from "@/core/date/calendar-date";
import { formatMoney } from "@/core/money/format";
import { money } from "@/core/money/money";
import { Badge, Button, Callout, Card, CardTitle, Spinner } from "@/components/ui/primitives";
import { FormError, SelectField } from "@/components/ui/form";
import {
  entriesFromRows,
  parseStatement,
  type ImportedEntry,
  type StatementParseResult,
} from "@/modules/transactions/domain/statement-import";
import { useFinance } from "@/modules/household/ui/finance-provider";
import { useSession } from "@/modules/household/ui/session-provider";
import {
  AI_UPLOAD_ACCEPT,
  messageFromResponse,
  prepareUpload,
  UploadError,
} from "@/modules/receipts/ui/file-upload";
import { useCollections } from "@/modules/shared/ui/use-collections";

/**
 * Importar o extrato do banco.
 *
 * Digitar meses de histórico é barreira suficiente para desistir no primeiro
 * dia, e sem histórico a projeção não tem de onde partir.
 *
 * Dois caminhos chegam à mesma lista:
 *
 * - **OFX e CSV**, lidos aqui no aparelho. É o caminho preferido, e a tela diz
 *   isso: arquivo estruturado não tem leitura errada.
 * - **PDF ou foto**, lidos por IA. É o caminho de quem não encontra o menu de
 *   exportação do banco — a maioria. O arquivo sai do aparelho nesse caso, e a
 *   tela avisa antes, não depois.
 *
 * A tela lê e **propõe**; nada é gravado sem conferência. Um extrato traz
 * transferência entre contas próprias, estorno e o que já foi lançado à mão —
 * importar tudo às cegas produziria um saldo errado com aparência de precisão,
 * que é pior do que não importar.
 */

interface ReadingSummary {
  readonly institution: string | null;
  readonly periodStart: string | null;
  readonly periodEnd: string | null;
  readonly closingBalance: number | null;
  readonly confidence: "ALTA" | "MEDIA" | "BAIXA";
}

export default function ImportStatementPage() {
  const finance = useFinance();
  const { household, canWrite, user } = useSession();
  const collections = useCollections();

  const [fileName, setFileName] = useState("");
  const [reading, setReading] = useState(false);
  const [parsed, setParsed] = useState<StatementParseResult | null>(null);
  const [summary, setSummary] = useState<ReadingSummary | null>(null);
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [skipped, setSkipped] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [imported, setImported] = useState<number | null>(null);

  const accounts = finance.accounts.filter((account) => !account.archived);

  // Um gasto precisa de categoria — é o que separa "R$ 45,90" de uma leitura
  // de para onde o dinheiro vai, e o esquema exige. Uma linha de extrato não
  // traz nenhuma, então a tela pede uma categoria de entrada para o lote
  // inteiro, editável depois em cada lançamento. Categorizar sessenta linhas
  // uma a uma seria reinventar o atrito que a importação existe para remover.
  const expenseCategories = finance.categories.filter(
    (category) => !category.archived && category.kind !== "INCOME",
  );

  // O que já existe com a mesma data e valor. Não bloqueia: marca, desmarca e
  // deixa a pessoa decidir — um salário de valor idêntico em dois meses é
  // legítimo, e adivinhar por ela seria pior.
  const alreadyThere = useMemo(() => {
    const keys = new Set<string>();
    for (const transaction of finance.transactions) {
      if (transaction.kind !== "EXPENSE" && transaction.kind !== "INCOME") continue;
      const signed =
        transaction.kind === "EXPENSE" ? -transaction.amount.amount : transaction.amount.amount;
      keys.add(`${transaction.transactionDate}|${signed}`);
    }
    return keys;
  }, [finance.transactions]);

  if (finance.loading) return <Spinner label="Carregando suas contas" />;

  const selectedAccount = accounts.find((account) => account.id === accountId) ?? accounts[0];
  const selectedCategory =
    expenseCategories.find((category) => category.id === categoryId) ??
    expenseCategories.find((category) => category.id.endsWith("outros-gastos")) ??
    expenseCategories[expenseCategories.length - 1];

  function accept(result: StatementParseResult) {
    setParsed(result);
    setSkipped(
      new Set(
        result.entries
          .filter((entry) => alreadyThere.has(`${entry.date}|${entry.amount.amount}`))
          .map((entry) => entry.fingerprint),
      ),
    );
  }

  async function onFile(file: File) {
    setError(null);
    setImported(null);
    setParsed(null);
    setSummary(null);
    setFileName(file.name);

    const byAi = file.type === "application/pdf" || file.type.startsWith("image/");
    if (byAi) return readWithAi(file);

    try {
      accept(parseStatement(await file.text()));
    } catch {
      setError("Não consegui ler este arquivo. Exporte de novo em OFX ou CSV.");
    }
  }

  /** PDF ou foto: o arquivo vai à leitura por IA e volta como lista. */
  async function readWithAi(file: File) {
    setReading(true);
    try {
      const { base64, mimeType } = await prepareUpload(file);
      const token = await user?.getIdToken();

      if (!token) {
        setError("Entre na sua conta para usar a leitura por PDF ou foto.");
        return;
      }

      const response = await fetch("/api/ai/extrato", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ fileBase64: base64, mimeType, today: finance.asOf }),
      });

      const data: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        setError(
          messageFromResponse(data) ??
            "Não consegui ler este arquivo agora. Tente o OFX ou o CSV do seu banco.",
        );
        return;
      }

      const rows = readEntries(data);
      if (rows.length === 0) {
        setError("Não encontrei lançamentos neste arquivo. Tente o OFX ou o CSV do seu banco.");
        return;
      }

      accept(entriesFromRows(rows));
      setSummary(readSummary(data));
    } catch (readError) {
      setError(
        readError instanceof UploadError
          ? readError.message
          : "Não consegui ler este arquivo agora. Tente novamente.",
      );
    } finally {
      setReading(false);
    }
  }

  const chosen = (parsed?.entries ?? []).filter((entry) => !skipped.has(entry.fingerprint));

  async function commit() {
    setError(null);
    if (!household || !selectedAccount || chosen.length === 0) return;
    if (!selectedCategory) {
      setError("Cadastre ao menos uma categoria de gasto antes de importar.");
      return;
    }

    setSaving(true);
    let done = 0;
    try {
      for (const entry of chosen) {
        const isIncome = entry.amount.amount > 0;
        await collections.transactions.create({
          householdId: household.id,
          kind: isIncome ? "INCOME" : "EXPENSE",
          amount: { ...entry.amount, amount: Math.abs(entry.amount.amount) },
          transactionDate: entry.date,
          competenceDate: entry.date,
          description: entry.description,
          accountId: selectedAccount.id,
          // Só a despesa exige categoria; uma receita importada fica sem, que
          // é o correto — "salário" não é uma categoria de gasto.
          ...(isIncome ? {} : { categoryId: selectedCategory.id }),
          visibility: "HOUSEHOLD",
        } as never);
        done += 1;
      }
      setImported(done);
      setParsed(null);
      setSummary(null);
      setFileName("");
    } catch (saveError) {
      console.error(saveError);
      setError(
        done === 0
          ? "Não foi possível importar agora. Tente novamente."
          : `Importei ${done} de ${chosen.length} e algo falhou no caminho. Confira a lista antes de tentar de novo.`,
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Importar extrato</h1>
        <p className="text-xs" style={{ color: "var(--muted-fg)" }}>
          Traga meses de histórico de uma vez, em vez de digitar linha por linha.
        </p>
      </div>

      {imported !== null ? (
        <Callout tone="positive">
          {imported} {imported === 1 ? "lançamento importado" : "lançamentos importados"}. Eles já
          entram nos saldos, na projeção e nos relatórios.
        </Callout>
      ) : null}

      {accounts.length === 0 ? (
        <Callout tone="attention">
          Cadastre uma conta antes de importar: o extrato precisa saber a que conta pertence.
        </Callout>
      ) : (
        <Card>
          <CardTitle hint="OFX ou CSV do seu banco, ou o PDF e a foto do extrato.">
            Escolha o arquivo
          </CardTitle>

          {error ? (
            <div className="mt-3">
              <FormError>{error}</FormError>
            </div>
          ) : null}

          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Conta de destino"
              value={selectedAccount?.id ?? ""}
              onChange={(event) => setAccountId(event.target.value)}
              options={accounts.map((account) => ({ value: account.id, label: account.name }))}
              hint="Todos os lançamentos deste arquivo vão para ela."
            />

            <SelectField
              label="Categoria dos gastos importados"
              value={selectedCategory?.id ?? ""}
              onChange={(event) => setCategoryId(event.target.value)}
              options={expenseCategories.map((category) => ({
                value: category.id,
                label: category.name,
              }))}
              hint="Vale para o lote todo. Dá para trocar depois, lançamento a lançamento."
            />

            <label className="text-sm">
              <span className="mb-1.5 block font-medium">Arquivo do extrato</span>
              <input
                type="file"
                accept={`.ofx,.csv,.txt,text/csv,text/plain,${AI_UPLOAD_ACCEPT}`}
                disabled={!canWrite || reading}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void onFile(file);
                }}
                className="block w-full text-sm file:mr-3 file:min-h-10 file:rounded-lg file:border-0 file:bg-[color:var(--color-brand-600)] file:px-3 file:text-sm file:font-semibold file:text-white"
              />
              {fileName ? (
                <span className="text-2xs mt-1 block" style={{ color: "var(--muted-fg)" }}>
                  {fileName}
                </span>
              ) : null}
            </label>
          </div>

          {reading ? (
            <div className="mt-4">
              <Spinner label="Lendo o extrato e separando os lançamentos" />
            </div>
          ) : null}

          <p className="text-2xs mt-3" style={{ color: "var(--muted-fg)" }}>
            O <strong>OFX</strong> e o <strong>CSV</strong> são lidos no seu próprio aparelho e não
            saem daqui. O <strong>PDF</strong> e a <strong>foto</strong> precisam de leitura
            automática: o arquivo é enviado para ser lido, não fica guardado em lugar nenhum e some
            junto com a resposta. Em qualquer um dos casos, só os lançamentos que você confirmar são
            gravados.
          </p>
        </Card>
      )}

      {parsed ? (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle hint="Desmarque o que não deve entrar: transferência entre contas suas, estorno, ou o que você já lançou.">
              Confira antes de importar
            </CardTitle>
            <Badge tone={parsed.format === "IA" ? "attention" : "neutral"}>
              {parsed.format === "IA" ? "Lido por IA" : parsed.format}
            </Badge>
          </div>

          {parsed.format === "IA" ? (
            <div className="mt-3">
              <Callout tone="attention" title="Confira valor e data linha por linha">
                A leitura de PDF e de foto acerta quase sempre, mas não é o arquivo do banco:
                confira antes de confirmar.{" "}
                {summary?.institution ? `Identifiquei o extrato como ${summary.institution}. ` : ""}
                {summary?.periodStart && summary?.periodEnd
                  ? `Período de ${formatCalendarDate(summary.periodStart as CalendarDate)} a ${formatCalendarDate(summary.periodEnd as CalendarDate)}. `
                  : ""}
                {summary?.closingBalance !== null && summary?.closingBalance !== undefined
                  ? `O extrato fecha com saldo de ${formatMoney(money(summary.closingBalance))} — compare com o saldo da conta depois de importar.`
                  : ""}
              </Callout>
            </div>
          ) : null}

          <p className="mt-2 text-sm" style={{ color: "var(--muted-fg)" }}>
            {parsed.entries.length}{" "}
            {parsed.entries.length === 1 ? "linha encontrada" : "linhas encontradas"} ·{" "}
            <strong style={{ color: "var(--page-fg)" }}>{chosen.length} marcadas</strong>
            {skipped.size > 0 ? ` · ${skipped.size} desmarcadas` : ""}
          </p>

          {parsed.rejected.length > 0 ? (
            <details className="mt-3 rounded-lg border border-[color:var(--card-border)] p-3">
              <summary className="cursor-pointer text-xs font-medium">
                {parsed.rejected.length}{" "}
                {parsed.rejected.length === 1 ? "linha não lida" : "linhas não lidas"}
              </summary>
              <ul className="mt-2 space-y-1">
                {parsed.rejected.slice(0, 20).map((item, index) => (
                  <li key={index} className="text-2xs" style={{ color: "var(--muted-fg)" }}>
                    <span className="font-mono">{item.line}</span> — {item.reason}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}

          <ul className="mt-3 divide-y divide-[color:var(--card-border)]">
            {parsed.entries.map((entry) => (
              <EntryRow
                key={entry.fingerprint}
                entry={entry}
                checked={!skipped.has(entry.fingerprint)}
                duplicate={alreadyThere.has(`${entry.date}|${entry.amount.amount}`)}
                onToggle={() =>
                  setSkipped((current) => {
                    const next = new Set(current);
                    if (next.has(entry.fingerprint)) next.delete(entry.fingerprint);
                    else next.add(entry.fingerprint);
                    return next;
                  })
                }
              />
            ))}
          </ul>

          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[color:var(--card-border)] pt-4">
            <Button onClick={() => void commit()} disabled={saving || chosen.length === 0}>
              {saving
                ? "Importando…"
                : `Importar ${chosen.length} ${chosen.length === 1 ? "lançamento" : "lançamentos"}`}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setParsed(null);
                setSummary(null);
                setFileName("");
              }}
              disabled={saving}
            >
              Cancelar
            </Button>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function EntryRow({
  entry,
  checked,
  duplicate,
  onToggle,
}: {
  entry: ImportedEntry;
  checked: boolean;
  duplicate: boolean;
  onToggle: () => void;
}) {
  const isIncome = entry.amount.amount > 0;

  return (
    <li className="flex flex-wrap items-center gap-3 py-2.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        aria-label={`Importar ${entry.description}`}
        className="size-5 shrink-0"
      />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{entry.description}</p>
        <p className="text-2xs" style={{ color: "var(--muted-fg)" }}>
          {formatCalendarDate(entry.date)}
          {duplicate ? " · já existe um lançamento igual nesse dia" : ""}
        </p>
      </div>

      <p
        className="tabular shrink-0 text-sm font-semibold"
        style={{ color: isIncome ? "var(--color-positive-700)" : "var(--tone-critical)" }}
      >
        {isIncome ? "+" : "−"}{" "}
        {formatMoney({ ...entry.amount, amount: Math.abs(entry.amount.amount) })}
      </p>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* A resposta da leitura                                               */
/* ------------------------------------------------------------------ */

/**
 * As linhas da resposta, já validadas.
 *
 * A rota é confiável, mas o que chega aqui é JSON: uma data que não é data ou
 * um valor que não é número precisa cair fora antes de virar `ImportedEntry`,
 * e não depois, dentro de um saldo.
 */
function readEntries(
  data: unknown,
): { date: CalendarDate; description: string; amountCents: number }[] {
  const entries = readField(readField(data, "reading"), "entries");
  if (!Array.isArray(entries)) return [];

  const rows: { date: CalendarDate; description: string; amountCents: number }[] = [];

  for (const item of entries) {
    const rawDate = readField(item, "date");
    const amount = readField(item, "amount");
    const description = readField(item, "description");

    const date = typeof rawDate === "string" ? tryCalendarDate(rawDate) : null;
    if (!date) continue;
    if (typeof amount !== "number" || !Number.isFinite(amount)) continue;

    rows.push({
      date,
      description: typeof description === "string" ? description : "",
      amountCents: Math.round(amount),
    });
  }

  return rows;
}

function readSummary(data: unknown): ReadingSummary {
  const reading = readField(data, "reading");
  const confidence = readField(reading, "confidence");

  return {
    institution: readString(reading, "institution"),
    periodStart: readString(reading, "periodStart"),
    periodEnd: readString(reading, "periodEnd"),
    closingBalance: readNumber(reading, "closingBalance"),
    confidence:
      confidence === "ALTA" || confidence === "BAIXA" || confidence === "MEDIA"
        ? confidence
        : "MEDIA",
  };
}

function readField(data: unknown, key: string): unknown {
  if (typeof data !== "object" || data === null) return undefined;
  return (data as Record<string, unknown>)[key];
}

function readString(data: unknown, key: string): string | null {
  const value = readField(data, key);
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function readNumber(data: unknown, key: string): number | null {
  const value = readField(data, key);
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

"use client";

import { useMemo, useState } from "react";
import { formatCalendarDate } from "@/core/date/calendar-date";
import { formatMoney } from "@/core/money/format";
import { Badge, Button, Callout, Card, CardTitle, Spinner } from "@/components/ui/primitives";
import { FormError, SelectField } from "@/components/ui/form";
import {
  parseStatement,
  type ImportedEntry,
  type StatementParseResult,
} from "@/modules/transactions/domain/statement-import";
import { useFinance } from "@/modules/household/ui/finance-provider";
import { useSession } from "@/modules/household/ui/session-provider";
import { useCollections } from "@/modules/shared/ui/use-collections";

/**
 * Importar o extrato do banco.
 *
 * Digitar meses de histórico é barreira suficiente para desistir no primeiro
 * dia, e sem histórico a projeção não tem de onde partir.
 *
 * A tela lê e **propõe**; nada é gravado sem conferência. Um extrato traz
 * transferência entre contas próprias, estorno e o que já foi lançado à mão —
 * importar tudo às cegas produziria um saldo errado com aparência de precisão,
 * que é pior do que não importar.
 */
export default function ImportStatementPage() {
  const finance = useFinance();
  const { household, canWrite } = useSession();
  const collections = useCollections();

  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState<StatementParseResult | null>(null);
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

  async function onFile(file: File) {
    setError(null);
    setImported(null);
    setFileName(file.name);

    try {
      const content = await file.text();
      const result = parseStatement(content);
      setParsed(result);
      setSkipped(
        new Set(
          result.entries
            .filter((entry) => alreadyThere.has(`${entry.date}|${entry.amount.amount}`))
            .map((entry) => entry.fingerprint),
        ),
      );
    } catch {
      setError("Não consegui ler este arquivo. Exporte de novo em OFX ou CSV.");
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
          <CardTitle hint="OFX ou CSV, exportado pelo aplicativo ou pelo site do seu banco.">
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
                accept=".ofx,.csv,.txt,text/csv,text/plain"
                disabled={!canWrite}
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

          <p className="text-2xs mt-3" style={{ color: "var(--muted-fg)" }}>
            O arquivo é lido no seu próprio aparelho e não é enviado a lugar nenhum. Só os
            lançamentos que você confirmar são gravados.
          </p>
        </Card>
      )}

      {parsed ? (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle hint="Desmarque o que não deve entrar: transferência entre contas suas, estorno, ou o que você já lançou.">
              Confira antes de importar
            </CardTitle>
            <Badge>{parsed.format}</Badge>
          </div>

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

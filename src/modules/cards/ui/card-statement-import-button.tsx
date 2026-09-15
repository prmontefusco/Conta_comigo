"use client";

import { useEffect, useMemo, useState } from "react";
import {
  calendarDate,
  dayInMonth,
  formatCalendarDate,
  formatMonthKey,
  type MonthKey,
} from "@/core/date/calendar-date";
import { formatMoney } from "@/core/money/format";
import { money } from "@/core/money/money";
import { Badge, Button, Callout, MoneyText, Spinner } from "@/components/ui/primitives";
import { SelectField } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import {
  openInstallmentPlans,
  statementMonthForPurchase,
  type CreditCard,
} from "@/modules/cards/domain/credit-card";
import { InstallmentPlansCard } from "@/modules/cards/ui/installment-plans-card";
import { useFinance } from "@/modules/household/ui/finance-provider";
import { useSession } from "@/modules/household/ui/session-provider";
import {
  groupImportedPurchases,
  importStatementMonth,
  remainingInstallments,
} from "@/modules/receipts/domain/card-statement-reading";
import { useCollections } from "@/modules/shared/ui/use-collections";

interface ImportedCardPurchase {
  readonly date: string;
  readonly description: string;
  readonly installmentAmount: number;
  readonly installmentNumber: number;
  readonly installmentCount: number;
  readonly firstStatementMonth: MonthKey;
  readonly importKey: string;
}

interface CardStatementReadingResponse {
  readonly issuer: string | null;
  readonly cardName: string | null;
  readonly brand: string | null;
  readonly lastFourDigits: string | null;
  readonly dueDate: string | null;
  readonly closingDate: string | null;
  readonly referenceMonth: MonthKey | null;
  readonly statementTotal: number | null;
  readonly minimumPayment: number | null;
  readonly creditLimit: number | null;
  readonly confidence: "ALTA" | "MEDIA" | "BAIXA";
  readonly purchases: readonly ImportedCardPurchase[];
  readonly discarded: readonly { readonly reason: string; readonly line: string }[];
}

const CARD_STATEMENT_CACHE_PREFIX = "conta-comigo:card-statement-reading:";
const CARD_STATEMENT_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_IMPORT_PURCHASE_LIMIT = 120;

export function CardStatementImportButton({
  className,
  onManualEntry,
}: {
  className?: string;
  /** A leitura falhou; oferece lançar a fatura à mão em vez de travar aqui. */
  onManualEntry?: (cardId: string) => void;
}) {
  const finance = useFinance();
  const { household, user } = useSession();
  const collections = useCollections();
  const [open, setOpen] = useState(false);
  const [cardId, setCardId] = useState(finance.cards.find((card) => !card.archived)?.id ?? "");
  const [reading, setReading] = useState<CardStatementReadingResponse | null>(null);
  const [excluded, setExcluded] = useState<ReadonlySet<string>>(new Set());
  // Cada compra da fatura tem a categoria dela: mercado, posto e streaming não
  // são a mesma coisa, e escolher uma categoria só para o lote inteiro jogava
  // tudo debaixo dela - a última coisa que a pessoa tivesse selecionado no
  // combo, e não necessariamente algo que fizesse sentido para a fatura.
  const [categoryByKey, setCategoryByKey] = useState<Readonly<Record<string, string>>>({});
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Preenchido depois de salvar, com os ids criados — é o que permite desfazer
  // uma importação errada (cartão trocado, arquivo errado) sem caçar cada
  // lançamento um por um.
  const [savedIds, setSavedIds] = useState<string[] | null>(null);

  const card = finance.cards.find((item) => item.id === cardId);
  const expenseCategories = finance.categories.filter((category) => category.kind === "EXPENSE");
  const defaultCategoryId =
    expenseCategories.find((category) => category.id.endsWith("outros-gastos"))?.id ??
    expenseCategories[0]?.id ??
    "";

  const proposals = useMemo(() => {
    if (!reading || !card) return [];
    return groupImportedPurchases(reading.purchases).map((purchase) => ({
      ...purchase,
      match: duplicateMatchFor(purchase, card, finance.cardPurchases),
    }));
  }, [reading, card, finance.cardPurchases]);

  // Uma leitura nova define os candidatos a duplicata e a categoria inicial de
  // cada linha; dali em diante quem decide é a pessoa, marcando/desmarcando e
  // trocando a categoria — o mesmo padrão da importação de extrato bancário,
  // que já resolve "isso eu já lancei" desse jeito.
  useEffect(() => {
    if (!reading || !card) return;
    const grouped = groupImportedPurchases(reading.purchases);
    setExcluded(
      new Set(
        grouped
          .filter((purchase) => duplicateMatchFor(purchase, card, finance.cardPurchases) !== null)
          .map((purchase) => purchase.importKey),
      ),
    );
    setCategoryByKey(
      Object.fromEntries(grouped.map((purchase) => [purchase.importKey, defaultCategoryId])),
    );
    // Só quando uma leitura nova chega. Reavaliar a cada tecla desfaria a
    // escolha da pessoa toda vez que o card ou a lista de compras mudasse.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reading]);

  const toCreate = proposals.filter((purchase) => !excluded.has(purchase.importKey));

  function reset() {
    setReading(null);
    setExcluded(new Set());
    setCategoryByKey({});
    setError(null);
    setAnalyzing(false);
    setSaving(false);
    setSavedIds(null);
  }

  async function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.currentTarget.value = "";
    if (!file || !user) return;

    setError(null);
    setAnalyzing(true);
    setReading(null);

    try {
      const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
      if (!allowedTypes.includes(file.type)) {
        throw new Error("Formato não suportado. Envie um arquivo PDF, JPG ou PNG.");
      }
      if (file.size > 12 * 1024 * 1024) {
        throw new Error("O arquivo é muito grande. O tamanho máximo é de 10MB.");
      }

      const fileBase64 = await readAsBase64(file);
      const fileHash = await sha256(`${file.type}:${file.size}:${fileBase64}`);
      const cached = readCachedStatement(fileHash);
      if (cached) {
        setReading(cached);
        const matchingCard = matchCard(cached, finance.cards);
        if (matchingCard) setCardId(matchingCard.id);
        return;
      }

      const token = await user.getIdToken();
      const response = await fetch("/api/ai/fatura-cartao", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fileBase64,
          mimeType: file.type,
          maxPurchases: DEFAULT_IMPORT_PURCHASE_LIMIT,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "Não foi possível ler esta fatura.");
      }

      const data = (await response.json()) as { reading?: CardStatementReadingResponse };
      if (!data.reading) throw new Error("Não encontrei dados de fatura de cartão no arquivo.");

      setReading(data.reading);
      writeCachedStatement(fileHash, data.reading);
      const matchingCard = matchCard(data.reading, finance.cards);
      if (matchingCard) setCardId(matchingCard.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao processar a fatura.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleSave() {
    setError(null);
    if (!household || !card) {
      setError("Escolha o cartão para salvar as compras.");
      return;
    }
    if (toCreate.some((purchase) => !categoryByKey[purchase.importKey])) {
      setError("Escolha uma categoria para cada compra marcada.");
      return;
    }

    setSaving(true);
    try {
      const createdIds: string[] = [];
      for (const purchase of toCreate) {
        // A fatura lida mostra a parcela ATUAL (ex.: 12 de 12), não a compra
        // inteira desde o início. Recriar as 12 parcelas a partir da primeira
        // inventaria 11 faturas passadas que a pessoa já pagou fora do app,
        // como se estivessem em aberto hoje. Por isso só as parcelas que ainda
        // faltam entram, a partir do mês desta fatura.
        const remaining = remainingInstallments(purchase);
        const importMonth = importStatementMonth(purchase);
        const purchaseDate = estimatedPurchaseDate(card, importMonth);
        const totalAmount = money(purchase.installmentAmount * remaining);
        const created = await collections.cardPurchases.create({
          householdId: household.id,
          creditCardId: card.id,
          description: purchase.description,
          merchant: purchase.description,
          totalAmount,
          purchaseDate,
          competenceDate: purchaseDate,
          categoryId: categoryByKey[purchase.importKey],
          installmentCount: remaining,
          visibility: "HOUSEHOLD",
          notes: `Importado de fatura do cartão. Chave: ${purchase.importKey}`,
        } as never);
        createdIds.push(created.id);
      }

      setSavedIds(createdIds);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Falha ao salvar as compras.");
    } finally {
      setSaving(false);
    }
  }

  /** Some tudo o que a última importação criou — o "arrependimento" de cartão errado ou arquivo errado. */
  async function handleUndo() {
    if (!savedIds) return;
    setError(null);
    setSaving(true);
    try {
      for (const id of savedIds) {
        await collections.cardPurchases.remove(id);
      }
      setOpen(false);
      reset();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Não foi possível desfazer agora.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button
        variant="secondary"
        className={className}
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        Importar fatura
      </Button>

      <Modal
        open={open}
        onClose={() => {
          if (!analyzing && !saving) {
            setOpen(false);
            reset();
          }
        }}
        title="Importar fatura do cartão"
        description="Leia um PDF ou foto da fatura para cadastrar compras e parcelas futuras."
      >
        <div className="space-y-4">
          <SelectField
            label="Cartão"
            value={cardId}
            onChange={(event) => setCardId(event.target.value)}
            options={finance.cards
              .filter((item) => !item.archived)
              .map((item) => ({ value: item.id, label: item.name }))}
          />

          <div className="rounded-lg border-2 border-dashed border-[color:var(--card-border)] bg-[color:var(--color-surface-sunken)] p-5 text-center">
            <p className="text-sm font-semibold">PDF ou foto da fatura</p>
            <p className="mt-1 text-xs" style={{ color: "var(--muted-fg)" }}>
              A leitura cria uma proposta para conferência antes de salvar.
            </p>
            <label className="mt-3 inline-flex cursor-pointer items-center justify-center rounded-lg bg-[color:var(--color-brand-600)] px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-[color:var(--color-brand-700)]">
              Escolher arquivo
              <input
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                onChange={handleFileSelected}
                className="sr-only"
              />
            </label>
          </div>

          {error ? (
            <Callout tone="critical" title="Não foi possível importar">
              <p>{error}</p>
              {onManualEntry && card ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="mt-3"
                  onClick={() => {
                    const targetCardId = card.id;
                    setOpen(false);
                    reset();
                    onManualEntry(targetCardId);
                  }}
                >
                  Lançar fatura manualmente
                </Button>
              ) : null}
            </Callout>
          ) : null}

          {analyzing ? <Spinner label="Lendo fatura e parcelas" /> : null}

          {savedIds ? (
            <Callout tone="positive" title="Importação concluída">
              <p>
                {savedIds.length} {savedIds.length === 1 ? "compra lançada" : "compras lançadas"}{" "}
                nesta fatura.
              </p>
              <div className="mt-3 flex gap-2">
                <Button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    reset();
                  }}
                  disabled={saving}
                >
                  Concluir
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void handleUndo()}
                  disabled={saving}
                >
                  {saving ? "Desfazendo…" : "Desfazer importação"}
                </Button>
              </div>
            </Callout>
          ) : null}

          {reading && !analyzing && !savedIds ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[color:var(--color-surface-sunken)] p-3">
                <div>
                  <p className="text-sm font-semibold">
                    {reading.cardName || reading.issuer || "Fatura de cartão"}
                  </p>
                  <p className="text-xs" style={{ color: "var(--muted-fg)" }}>
                    {reading.dueDate
                      ? `Vence em ${formatCalendarDate(calendarDate(reading.dueDate))}`
                      : "Vencimento não lido"}
                    {reading.referenceMonth ? ` · ${formatMonthKey(reading.referenceMonth)}` : ""}
                  </p>
                </div>
                <Badge tone={reading.confidence === "ALTA" ? "positive" : "attention"}>
                  {reading.confidence}
                </Badge>
              </div>

              {reading.statementTotal !== null ? (
                <Callout tone="info" title="Valor da fatura atual">
                  Total lido: {formatMoney(money(Math.round(reading.statementTotal * 100)))}
                  {reading.minimumPayment !== null
                    ? ` · mínimo: ${formatMoney(money(Math.round(reading.minimumPayment * 100)))}`
                    : ""}
                </Callout>
              ) : null}

              {card &&
              openInstallmentPlans(finance.cards, finance.cardPurchases, finance.asOf).some(
                (plan) => plan.creditCardId === card.id,
              ) ? (
                <details className="rounded-lg border border-[color:var(--card-border)] p-3">
                  <summary className="cursor-pointer text-xs font-medium">
                    Parcelamentos já em andamento neste cartão — compare antes de confirmar
                  </summary>
                  <div className="mt-3">
                    <InstallmentPlansCard cardId={card.id} />
                  </div>
                </details>
              ) : null}

              <div>
                <h3 className="text-sm font-semibold">Compras encontradas</h3>
                <p className="text-xs" style={{ color: "var(--muted-fg)" }}>
                  Cada compra tem a própria categoria — confira, porque a fatura mistura mercado,
                  posto, assinatura e o resto. Desmarque o que já foi lançado à mão, ou marque de
                  volta o que a checagem automática errou.
                </p>
                <ul className="mt-2 divide-y divide-[color:var(--card-border)]">
                  {proposals.map((purchase) => (
                    <li key={purchase.importKey} className="space-y-2 py-2.5">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={!excluded.has(purchase.importKey)}
                          onChange={() =>
                            setExcluded((current) => {
                              const next = new Set(current);
                              if (next.has(purchase.importKey)) next.delete(purchase.importKey);
                              else next.add(purchase.importKey);
                              return next;
                            })
                          }
                          aria-label={`Importar ${purchase.description}`}
                          className="size-5 shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{purchase.description}</p>
                          <p className="text-xs" style={{ color: "var(--muted-fg)" }}>
                            {purchase.installmentCount > 1
                              ? `Parcela ${purchase.installmentNumber}/${purchase.installmentCount} — ` +
                                (remainingInstallments(purchase) === 1
                                  ? "última, "
                                  : `restam ${remainingInstallments(purchase)}, `) +
                                `a partir de ${formatMonthKey(importStatementMonth(purchase))}`
                              : "Compra à vista"}
                          </p>
                          {purchase.match === "EXACT" ? (
                            <Badge tone="neutral">Já cadastrada</Badge>
                          ) : purchase.match === "POSSIBLE" ? (
                            <Badge tone="attention">
                              Possível duplicata — confira o valor e as parcelas
                            </Badge>
                          ) : null}
                        </div>
                        <MoneyText
                          value={money(
                            purchase.installmentAmount * remainingInstallments(purchase),
                          )}
                          size="sm"
                          tone="outflow"
                        />
                      </div>

                      {!excluded.has(purchase.importKey) ? (
                        <label className="block pl-8 text-sm">
                          <span className="sr-only">Categoria de {purchase.description}</span>
                          <select
                            value={categoryByKey[purchase.importKey] ?? defaultCategoryId}
                            onChange={(event) =>
                              setCategoryByKey((current) => ({
                                ...current,
                                [purchase.importKey]: event.target.value,
                              }))
                            }
                            className="min-h-10 w-full rounded-lg border border-[color:var(--card-border)] bg-[color:var(--card-bg)] px-2 text-sm"
                          >
                            {expenseCategories.map((category) => (
                              <option key={category.id} value={category.id}>
                                {`${category.icon ?? ""} ${category.name}`.trim()}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex gap-2 border-t border-[color:var(--card-border)] pt-4">
                <Button variant="secondary" onClick={reset} disabled={saving}>
                  Ler outro arquivo
                </Button>
                <Button onClick={handleSave} disabled={saving || toCreate.length === 0}>
                  {saving
                    ? "Salvando..."
                    : `Salvar ${toCreate.length} ${toCreate.length === 1 ? "compra" : "compras"}`}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </Modal>
    </>
  );
}

function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("Erro ao ler o arquivo selecionado."));
    reader.readAsDataURL(file);
  });
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function readCachedStatement(hash: string): CardStatementReadingResponse | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(`${CARD_STATEMENT_CACHE_PREFIX}${hash}`);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as {
      savedAt?: number;
      reading?: CardStatementReadingResponse;
    };
    if (!parsed.savedAt || Date.now() - parsed.savedAt > CARD_STATEMENT_CACHE_TTL_MS) {
      window.localStorage.removeItem(`${CARD_STATEMENT_CACHE_PREFIX}${hash}`);
      return null;
    }
    return parsed.reading ?? null;
  } catch {
    window.localStorage.removeItem(`${CARD_STATEMENT_CACHE_PREFIX}${hash}`);
    return null;
  }
}

function writeCachedStatement(hash: string, reading: CardStatementReadingResponse) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      `${CARD_STATEMENT_CACHE_PREFIX}${hash}`,
      JSON.stringify({ savedAt: Date.now(), reading }),
    );
  } catch {
    // Cache é economia de custo, não parte do lançamento. Se o navegador negar,
    // o fluxo segue normalmente.
  }
}

type DuplicateMatch = "EXACT" | "POSSIBLE" | null;

/**
 * Se esta linha lida da fatura já parece existir entre as compras do cartão.
 *
 * `EXACT` exige texto igual, porque é o único jeito de ter certeza sem a
 * pessoa conferir. Mas quem lançou "Geladeira" na hora da compra nunca vai
 * bater com o texto que o banco imprime na fatura ("Magazine Luiza Parc"),
 * então descrição sozinha deixa passar duplicata de verdade. `POSSIBLE` cobre
 * esse caso: valor parecido e o mesmo número de parcelas já são um sinal forte
 * o bastante para pedir confirmação, mesmo com a descrição diferente — a
 * decisão final continua sendo da pessoa, marcando ou desmarcando a linha.
 */
function duplicateMatchFor(
  purchase: ImportedCardPurchase,
  card: CreditCard,
  existing: ReturnType<typeof useFinance>["cardPurchases"],
): DuplicateMatch {
  const totalAmount = purchase.installmentAmount * purchase.installmentCount;
  let possible = false;

  for (const item of existing) {
    if (item.creditCardId !== card.id) continue;
    if (item.notes?.includes(purchase.importKey)) return "EXACT";

    const sameInstallmentCount = item.installmentCount === purchase.installmentCount;
    if (!sameInstallmentCount) continue;

    if (
      item.totalAmount.amount === totalAmount &&
      normalise(item.description) === normalise(purchase.description) &&
      statementMonthForPurchase(card, item.purchaseDate) === purchase.firstStatementMonth
    ) {
      return "EXACT";
    }

    if (isCloseAmount(item.totalAmount.amount, totalAmount)) possible = true;
  }

  return possible ? "POSSIBLE" : null;
}

/** Valores em centavos a até R$5 ou 3% de diferença, o que for maior — o bastante para pegar arredondamento sem confundir compras de valores realmente diferentes. */
function isCloseAmount(a: number, b: number): boolean {
  const tolerance = Math.max(500, Math.round(Math.max(a, b) * 0.03));
  return Math.abs(a - b) <= tolerance;
}

function estimatedPurchaseDate(card: CreditCard, firstStatementMonth: MonthKey) {
  return dayInMonth(firstStatementMonth, card.closingDay);
}

function matchCard(reading: CardStatementReadingResponse, cards: readonly CreditCard[]) {
  if (reading.lastFourDigits) {
    const byDigits = cards.find((card) => card.lastFourDigits === reading.lastFourDigits);
    if (byDigits) return byDigits;
  }

  const labels = [reading.cardName, reading.issuer, reading.brand]
    .filter((value): value is string => Boolean(value))
    .map(normalise);
  return cards.find((card) =>
    [card.name, card.issuer, card.brand]
      .filter((value): value is string => Boolean(value))
      .some((value) =>
        labels.some(
          (label) => normalise(value).includes(label) || label.includes(normalise(value)),
        ),
      ),
  );
}

function normalise(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

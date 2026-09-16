"use client";

import { useEffect, useMemo, useState } from "react";
import {
  calendarDate,
  addMonthsToKey,
  formatCalendarDate,
  formatMonthKey,
  monthKey,
  tryCalendarDate,
  type MonthKey,
} from "@/core/date/calendar-date";
import { formatMoney } from "@/core/money/format";
import { money } from "@/core/money/money";
import { Badge, Button, Callout, MoneyText, Spinner } from "@/components/ui/primitives";
import { SelectField, TextField } from "@/components/ui/form";
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
  readonly installmentOffers?: readonly {
    installments: number;
    installmentAmount: number;
    upfrontAmount: number;
    annualCetPercent: number | null;
  }[];
  readonly revolvingOffer?: {
    monthlyRatePercent: number | null;
    annualRatePercent: number | null;
    annualCetPercent: number | null;
    iofDailyPercent: number | null;
    iofAdditionalPercent: number | null;
  } | null;
  readonly discarded: readonly { readonly reason: string; readonly line: string }[];
}

const CARD_STATEMENT_CACHE_PREFIX = "conta-comigo:card-statement-reading:";
const CARD_STATEMENT_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_IMPORT_PURCHASE_LIMIT = 120;

export function CardStatementImportButton({ className }: { className?: string }) {
  const finance = useFinance();
  const { household, user } = useSession();
  const collections = useCollections();
  const [open, setOpen] = useState(false);
  const [cardId, setCardId] = useState(finance.cards.find((card) => !card.archived)?.id ?? "");
  const [reading, setReading] = useState<CardStatementReadingResponse | null>(null);
  const [confirmedTotal, setConfirmedTotal] = useState("");
  const [confirmedMonth, setConfirmedMonth] = useState("");
  const [confirmedDueDate, setConfirmedDueDate] = useState("");
  const [excluded, setExcluded] = useState<ReadonlySet<string>>(new Set());
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Preenchido depois de salvar, com os ids criados — é o que permite desfazer
  // uma importação errada (cartão trocado, arquivo errado) sem caçar cada
  // lançamento um por um.
  const [savedIds, setSavedIds] = useState<string[] | null>(null);

  const card = finance.cards.find((item) => item.id === cardId);

  const proposals = useMemo(() => {
    if (!reading || !card) return [];
    return groupImportedPurchases(reading.purchases).map((purchase) => ({
      ...purchase,
      match: duplicateMatchFor(purchase, card, finance.cardPurchases),
    }));
  }, [reading, card, finance.cardPurchases]);

  // Os itens lidos são candidatos à previsão, não compras financeiras.
  // A pessoa pode excluir linhas já cadastradas manualmente.
  useEffect(() => {
    if (!reading || !card) return;
    setConfirmedTotal(reading.statementTotal != null ? String(reading.statementTotal) : "");
    setConfirmedMonth(reading.referenceMonth ?? "");
    setConfirmedDueDate(reading.dueDate ?? "");
    const grouped = groupImportedPurchases(reading.purchases);
    setExcluded(
      new Set(
        grouped
          .filter((purchase) => duplicateMatchFor(purchase, card, finance.cardPurchases) !== null)
          .map((purchase) => purchase.importKey),
      ),
    );
    // Só quando uma leitura nova chega. Reavaliar a cada tecla desfaria a
    // escolha da pessoa toda vez que o card ou a lista de compras mudasse.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reading]);

  const toForecast = proposals.filter((purchase) => !excluded.has(purchase.importKey));

  function reset() {
    setReading(null);
    setConfirmedTotal("");
    setConfirmedMonth("");
    setConfirmedDueDate("");
    setExcluded(new Set());
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
    if (!household || !card || !reading) {
      setError("Escolha o cartão e leia a fatura.");
      return;
    }
    const amount = Number(confirmedTotal);
    let referenceMonth: MonthKey;
    try {
      referenceMonth = monthKey(confirmedMonth);
    } catch {
      setError("Informe um mês de referência válido.");
      return;
    }
    const dueDate = tryCalendarDate(confirmedDueDate);
    if (!Number.isFinite(amount) || amount <= 0 || !dueDate) {
      setError("Confirme um total positivo e uma data de vencimento válida.");
      return;
    }
    if (
      finance.cardInvoices.some(
        (invoice) => invoice.creditCardId === card.id && invoice.referenceMonth === referenceMonth,
      )
    ) {
      setError(
        "Já existe uma fatura importada para este cartão e mês. Corrija ou remova a anterior antes de importar novamente.",
      );
      return;
    }

    setSaving(true);
    try {
      const created = await collections.cardInvoices.create({
        householdId: household.id,
        creditCardId: card.id,
        referenceMonth,
        dueDate,
        totalAmount: money(Math.round(amount * 100)),
        ...(reading.minimumPayment && reading.minimumPayment > 0
          ? { minimumPayment: money(Math.round(reading.minimumPayment * 100)) }
          : {}),
        ...(reading.revolvingOffer
          ? {
              revolvingOffer: {
                ...(reading.revolvingOffer.monthlyRatePercent != null
                  ? { monthlyRatePercent: reading.revolvingOffer.monthlyRatePercent }
                  : {}),
                ...(reading.revolvingOffer.annualRatePercent != null
                  ? { annualRatePercent: reading.revolvingOffer.annualRatePercent }
                  : {}),
                ...(reading.revolvingOffer.annualCetPercent != null
                  ? { annualCetPercent: reading.revolvingOffer.annualCetPercent }
                  : {}),
                ...(reading.revolvingOffer.iofDailyPercent != null
                  ? { iofDailyPercent: reading.revolvingOffer.iofDailyPercent }
                  : {}),
                ...(reading.revolvingOffer.iofAdditionalPercent != null
                  ? { iofAdditionalPercent: reading.revolvingOffer.iofAdditionalPercent }
                  : {}),
              },
            }
          : {}),
        forecastLines: toForecast
          .filter((purchase) => remainingInstallments(purchase) > 1)
          .map((purchase) => ({
            key: `${normalise(purchase.description).slice(0, 80)}:${purchase.installmentAmount}:${purchase.installmentCount}:${purchase.firstStatementMonth}`,
            description: purchase.description,
            amount: money(purchase.installmentAmount),
            firstFutureMonth: addMonthsToKey(referenceMonth, 1),
            remainingMonths: remainingInstallments(purchase) - 1,
          })),
        installmentOffers: (reading.installmentOffers ?? []).map((offer) => ({
          installments: offer.installments,
          installmentAmount: money(offer.installmentAmount),
          upfrontAmount: money(offer.upfrontAmount),
          ...(offer.annualCetPercent != null ? { annualCetPercent: offer.annualCetPercent } : {}),
        })),
      } as never);
      setSavedIds([created.id]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Falha ao salvar a fatura.");
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
        await collections.cardInvoices.remove(id);
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
        description="O total da fatura entra como obrigação. Parcelas futuras ficam apenas na previsão."
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
              {card ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="mt-3"
                  onClick={() => {
                    setError(null);
                    setReading({
                      issuer: null,
                      cardName: card.name,
                      brand: null,
                      lastFourDigits: card.lastFourDigits ?? null,
                      dueDate: null,
                      closingDate: null,
                      referenceMonth: null,
                      statementTotal: null,
                      minimumPayment: null,
                      creditLimit: null,
                      confidence: "BAIXA",
                      purchases: [],
                      installmentOffers: [],
                      revolvingOffer: null,
                      discarded: [],
                    });
                  }}
                >
                  Informar somente o total manualmente
                </Button>
              ) : null}
            </Callout>
          ) : null}

          {analyzing ? <Spinner label="Lendo fatura e parcelas" /> : null}

          {savedIds ? (
            <Callout tone="positive" title="Importação concluída">
              <p>
                Fatura confirmada salva. Os itens parcelados não criaram compras nem faturas
                passadas.
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

              <div className="grid gap-3 sm:grid-cols-3">
                <TextField
                  label="Total a pagar (R$)"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={confirmedTotal}
                  onChange={(event) => setConfirmedTotal(event.target.value)}
                  required
                />
                <TextField
                  label="Mês da fatura"
                  type="month"
                  value={confirmedMonth}
                  onChange={(event) => setConfirmedMonth(event.target.value)}
                  required
                />
                <TextField
                  label="Vencimento"
                  type="date"
                  value={confirmedDueDate}
                  onChange={(event) => setConfirmedDueDate(event.target.value)}
                  required
                />
              </div>
              <p className="text-xs" style={{ color: "var(--muted-fg)" }}>
                Confira estes dados no documento. A leitura automática pode errar; somente este
                total entra nos cálculos.
              </p>

              {(reading.installmentOffers?.length ?? 0) > 0 ? (
                <Callout tone="attention" title="Parcelamento oferecido na fatura">
                  <p>Alternativa ao pagamento integral, sujeita à confirmação com o emissor.</p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {reading.installmentOffers!.map((offer, index) => {
                      const total =
                        offer.upfrontAmount + offer.installments * offer.installmentAmount;
                      return (
                        <li key={index}>
                          {offer.installments} × {formatMoney(money(offer.installmentAmount))}
                          {offer.upfrontAmount > 0
                            ? ` + entrada de ${formatMoney(money(offer.upfrontAmount))}`
                            : ""}
                          {` · total ${formatMoney(money(total))}`}
                          {Number(confirmedTotal) > 0
                            ? ` · ${total >= Math.round(Number(confirmedTotal) * 100) ? "custo adicional" : "economia"} ${formatMoney(money(Math.abs(total - Math.round(Number(confirmedTotal) * 100))))}`
                            : ""}
                          {offer.annualCetPercent != null
                            ? ` · CET anual ${offer.annualCetPercent}%`
                            : " · CET não lido"}
                        </li>
                      );
                    })}
                  </ul>
                </Callout>
              ) : null}

              {reading.revolvingOffer ? (
                <Callout tone="critical" title="Crédito rotativo informado na fatura">
                  <p>Condições lidas para estimar o saldo que pode seguir para a próxima fatura.</p>
                  <p className="mt-1 text-sm">
                    {reading.revolvingOffer.monthlyRatePercent != null
                      ? `Juros ${reading.revolvingOffer.monthlyRatePercent}% ao mês`
                      : "Taxa mensal não lida"}
                    {reading.revolvingOffer.annualCetPercent != null
                      ? ` · CET anual ${reading.revolvingOffer.annualCetPercent}%`
                      : ""}
                    {reading.revolvingOffer.iofDailyPercent != null
                      ? ` · IOF diário ${reading.revolvingOffer.iofDailyPercent}%`
                      : ""}
                    {reading.revolvingOffer.iofAdditionalPercent != null
                      ? ` + IOF adicional ${reading.revolvingOffer.iofAdditionalPercent}%`
                      : ""}
                  </p>
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
                <h3 className="text-sm font-semibold">Parcelas para previsão</h3>
                <p className="text-xs" style={{ color: "var(--muted-fg)" }}>
                  Estes itens não alteram o valor da fatura nem os saldos. Desmarque parcelas já
                  lançadas manualmente; somente as parcelas seguintes entram na estimativa.
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
                          aria-label={`Prever ${purchase.description}`}
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
                        <MoneyText value={money(purchase.installmentAmount)} size="sm" />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex gap-2 border-t border-[color:var(--card-border)] pt-4">
                <Button variant="secondary" onClick={reset} disabled={saving}>
                  Ler outro arquivo
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving || !confirmedTotal || !confirmedMonth || !confirmedDueDate}
                >
                  {saving ? "Salvando..." : "Salvar valor da fatura"}
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

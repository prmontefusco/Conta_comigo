"use client";

import { useState } from "react";
import { todayIn, calendarDate } from "@/core/date/calendar-date";
import { fromDecimalString } from "@/core/money/money";
import { Badge, Button, Spinner } from "@/components/ui/primitives";
import { DateField, FormError, MoneyField, SelectField, TextField } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { useFinance } from "@/modules/household/ui/finance-provider";
import { useSession } from "@/modules/household/ui/session-provider";
import { useCollections } from "@/modules/shared/ui/use-collections";
import type { DocumentReading } from "../domain/document-reading";

export function DocumentImportButton({
  className,
  onImportSuccess,
}: {
  className?: string;
  onImportSuccess?: () => void;
}) {
  const { categories } = useFinance();
  const { household, user } = useSession();
  const collections = useCollections();

  const [open, setOpen] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dados extraídos e editáveis
  const [reading, setReading] = useState<DocumentReading | null>(null);
  const [description, setDescription] = useState("");
  const [amountText, setAmountText] = useState("");
  const [dueDate, setDueDate] = useState<string>(
    todayIn(household?.settings.timezone ?? "America/Sao_Paulo"),
  );
  const [categoryId, setCategoryId] = useState("");
  const [barcode, setBarcode] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);

  function reset() {
    setReading(null);
    setDescription("");
    setAmountText("");
    setBarcode("");
    setIsRecurring(false);
    setError(null);
    setAnalyzing(false);
    setSaving(false);
  }

  async function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    setError(null);
    setAnalyzing(true);

    try {
      const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
      if (!allowedTypes.includes(file.type)) {
        throw new Error("Formato não suportado. Envie um arquivo PDF, JPG ou PNG.");
      }

      if (file.size > 12 * 1024 * 1024) {
        throw new Error("O arquivo é muito grande. O tamanho máximo é de 10MB.");
      }

      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const dataUrl = reader.result as string;
          const base64 = dataUrl.split(",")[1];
          const token = await user.getIdToken();

          const res = await fetch("/api/ai/documento", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              fileBase64: base64,
              mimeType: file.type,
            }),
          });

          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.message || "Não foi possível ler este documento.");
          }

          const { reading: readData } = await res.json();
          if (!readData) {
            throw new Error("Não foi possível extrair os dados do documento.");
          }

          setReading(readData);
          setDescription(readData.description || "");
          if (readData.totalAmount !== null && readData.totalAmount !== undefined) {
            setAmountText(String(readData.totalAmount).replace(".", ","));
          }
          if (readData.dueDate) {
            setDueDate(readData.dueDate);
          }
          if (readData.barcode) {
            setBarcode(readData.barcode);
          }
          if (readData.documentType === "CONTA_CONSUMO") {
            setIsRecurring(true);
          }
        } catch (err: unknown) {
          setError(err instanceof Error ? err.message : "Erro ao processar documento.");
        } finally {
          setAnalyzing(false);
        }
      };

      reader.onerror = () => {
        setError("Erro ao ler o arquivo selecionado.");
        setAnalyzing(false);
      };

      reader.readAsDataURL(file);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao selecionar arquivo.");
      setAnalyzing(false);
    }
  }

  async function handleConfirmSave(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (!household || !user) return;

    const amount = fromDecimalString(amountText);
    if (!amount || amount.amount <= 0) {
      setError("Informe um valor válido maior que zero.");
      return;
    }

    if (description.trim().length < 2) {
      setError("Dê uma descrição para a conta.");
      return;
    }

    setSaving(true);

    try {
      const due = calendarDate(dueDate);

      if (isRecurring) {
        await collections.recurringRules.create({
          householdId: household.id,
          direction: "OUTFLOW",
          description: description.trim(),
          amount,
          frequency: "MONTHLY",
          interval: 1,
          dayOfMonth: Number(due.slice(8, 10)),
          startDate: due,
          weekendPolicy: "KEEP",
          categoryId: categoryId || undefined,
          expenseNature: "FIXED",
          confidence: "CONFIRMED",
          visibility: "HOUSEHOLD",
          active: true,
        } as never);
      } else {
        await collections.obligations.create({
          householdId: household.id,
          direction: "OUTFLOW",
          origin: "MANUAL",
          description: description.trim(),
          amount,
          dueDate: due,
          competenceDate: due,
          categoryId: categoryId || undefined,
          expenseNature: "FIXED",
          confidence: "CONFIRMED",
          visibility: "HOUSEHOLD",
          status: "SCHEDULED",
          settledAmount: { amount: 0, currency: "BRL" },
          settlementTransactionIds: [],
        } as never);
      }

      setOpen(false);
      reset();
      onImportSuccess?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Falha ao salvar conta.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button
        variant="secondary"
        onClick={() => {
          reset();
          setOpen(true);
        }}
        className={className}
      >
        <span>📄</span>
        <span>Importar Conta / Fatura (PDF ou Foto)</span>
      </Button>

      <Modal
        open={open}
        onClose={() => {
          if (!analyzing && !saving) {
            setOpen(false);
            reset();
          }
        }}
        title="Importar Conta, Boleto ou Fatura"
      >
        <div className="space-y-4">
          <p className="text-sm" style={{ color: "var(--muted-fg)" }}>
            Envie o arquivo <strong>PDF</strong> recebido por e-mail ou tire uma{" "}
            <strong>foto</strong> de uma conta de luz, água, internet, gás, condomínio ou fatura de
            cartão. A IA preenche os dados para você.
          </p>

          <FormError>{error}</FormError>

          {!reading && !analyzing && (
            <div className="rounded-xl border-2 border-dashed border-[color:var(--card-border)] bg-[color:var(--color-surface-sunken)] p-6 text-center">
              <span className="text-3xl">📁</span>
              <p className="mt-2 text-sm font-semibold">Arraste seu PDF ou imagem aqui</p>
              <p className="mt-1 text-xs" style={{ color: "var(--muted-fg)" }}>
                Suporta faturas e contas em PDF, JPG ou PNG de até 10MB
              </p>

              <label className="mt-4 inline-flex cursor-pointer items-center justify-center rounded-lg bg-[color:var(--color-brand-600)] px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-[color:var(--color-brand-700)]">
                <span>Escolher arquivo no celular ou PC</span>
                <input
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  onChange={handleFileSelected}
                  className="sr-only"
                />
              </label>
            </div>
          )}

          {analyzing && (
            <div className="py-8 text-center">
              <Spinner label="Analisando documento e identificando valores..." />
              <p className="mt-2 text-xs" style={{ color: "var(--muted-fg)" }}>
                Lendo código de barras, vencimento e concessionária...
              </p>
            </div>
          )}

          {reading && !analyzing && (
            <form
              onSubmit={handleConfirmSave}
              className="animate-in fade-in space-y-4 duration-200"
            >
              <div className="flex items-center justify-between rounded-lg bg-[color:var(--color-surface-sunken)] p-3">
                <div>
                  <span className="text-xs font-bold text-[color:var(--color-positive-600)] uppercase">
                    Documento Identificado
                  </span>
                  <p className="text-sm font-semibold">{reading.issuer || reading.description}</p>
                </div>
                <Badge tone={reading.confidence === "ALTA" ? "positive" : "attention"}>
                  {reading.documentType === "FATURA_CARTAO"
                    ? "Fatura de Cartão"
                    : reading.documentType === "CONTA_CONSUMO"
                      ? "Conta de Consumo"
                      : "Boleto"}
                </Badge>
              </div>

              <TextField
                label="Descrição da conta"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />

              <div className="grid grid-cols-2 gap-3">
                <MoneyField
                  label="Valor a pagar"
                  value={amountText}
                  onChange={(e) => setAmountText(e.target.value)}
                  required
                />
                <DateField
                  label="Data de vencimento"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  required
                />
              </div>

              {barcode ? (
                <div>
                  <label className="text-xs font-medium" style={{ color: "var(--muted-fg)" }}>
                    Linha digitável / Código de barras
                  </label>
                  <p className="tabular mt-1 rounded-md border border-[color:var(--card-border)] bg-[color:var(--color-surface-sunken)] p-2 text-xs break-all">
                    {barcode}
                  </p>
                </div>
              ) : null}

              <SelectField
                label="Categoria (opcional)"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                options={[
                  { value: "", label: "Selecione uma categoria" },
                  ...categories.map((c) => ({ value: c.id, label: c.name })),
                ]}
              />

              <label className="flex items-center gap-2 text-xs font-medium">
                <input
                  type="checkbox"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                  className="rounded border-[color:var(--card-border)] text-[color:var(--color-brand-600)]"
                />
                <span>Esta é uma conta recorrente (repete todos os meses neste dia)</span>
              </label>

              <div className="mt-4 flex justify-end gap-2 border-t border-[color:var(--card-border)] pt-4">
                <Button variant="secondary" onClick={() => reset()} disabled={saving}>
                  Ler outro arquivo
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? "Salvando..." : "Confirmar e Salvar Conta"}
                </Button>
              </div>
            </form>
          )}
        </div>
      </Modal>
    </>
  );
}

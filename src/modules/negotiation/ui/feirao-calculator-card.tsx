"use client";

import { useState } from "react";
import { formatMoney } from "@/core/money/format";
import { fromDecimalString, type Money } from "@/core/money/money";
import { Badge, Callout, Card, CardTitle } from "@/components/ui/primitives";
import { MoneyField, TextField } from "@/components/ui/form";
import { evaluateFeiraoOffer, type FeiraoOfferAnalysis } from "../domain/feirao-offer";
import type { ProposalCapacity } from "../domain/affordable-proposal";

interface FeiraoCalculatorCardProps {
  readonly capacity: ProposalCapacity;
  readonly availableCash: Money;
  readonly minimumReserveCushion: Money;
}

export function FeiraoCalculatorCard({
  capacity,
  availableCash,
  minimumReserveCushion,
}: FeiraoCalculatorCardProps) {
  const [originalBalanceText, setOriginalBalanceText] = useState("");
  const [cashOfferText, setCashOfferText] = useState("");
  const [installmentAmountText, setInstallmentAmountText] = useState("");
  const [installmentCountText, setInstallmentCountText] = useState("12");

  const originalBalance = fromDecimalString(originalBalanceText);
  const cashOffer = fromDecimalString(cashOfferText);
  const installmentAmount = fromDecimalString(installmentAmountText);
  const installmentCount = Number(installmentCountText) || 0;

  const analysis: FeiraoOfferAnalysis | null = originalBalance
    ? evaluateFeiraoOffer({
        originalBalance,
        cashOfferAmount: cashOffer ?? undefined,
        installmentAmount: installmentAmount ?? undefined,
        installmentCount: installmentCount > 0 ? installmentCount : undefined,
        availableCash,
        minimumReserveCushion,
        capacity,
      })
    : null;

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[color:var(--card-border)] pb-3">
        <CardTitle hint="Desenrola Brasil, Serasa Limpa Nome e Feirões de Renegociação">
          🏛️ Simulador Feirão / Desenrola (À Vista vs Parcelado)
        </CardTitle>
        <span className="rounded-md bg-[color:var(--color-surface-sunken)] px-2.5 py-1 text-xs font-semibold text-[color:var(--color-brand-600)]">
          Decisão Segura
        </span>
      </div>

      <p className="mt-3 text-sm" style={{ color: "var(--muted-fg)" }}>
        Em feirões de renegociação é comum oferecerem 70% a 90% de desconto à vista ou parcelamento
        longo. Use esta ferramenta para descobrir se vale a pena descapitalizar agora ou se o
        parcelamento protege melhor sua família.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MoneyField
          label="Saldo original da dívida"
          value={originalBalanceText}
          onChange={(e) => setOriginalBalanceText(e.target.value)}
          placeholder="Ex: 4.500,00"
          hint="Valor total cobrado antes dos descontos do feirão."
        />
        <MoneyField
          label="Proposta à vista com desconto"
          value={cashOfferText}
          onChange={(e) => setCashOfferText(e.target.value)}
          placeholder="Ex: 650,00"
          hint="Valor único para liquidação imediata."
        />
        <div className="grid grid-cols-2 gap-2">
          <MoneyField
            label="Valor da parcela"
            value={installmentAmountText}
            onChange={(e) => setInstallmentAmountText(e.target.value)}
            placeholder="Ex: 85,00"
          />
          <TextField
            label="Qtd. parcelas"
            type="number"
            min={1}
            max={72}
            value={installmentCountText}
            onChange={(e) => setInstallmentCountText(e.target.value)}
          />
        </div>
      </div>

      {analysis ? (
        <div className="mt-6 space-y-4 rounded-xl border border-[color:var(--card-border)] bg-[color:var(--color-surface-sunken)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-bold text-[color:var(--page-fg)]">
              Análise Comparativa da Proposta
            </h4>
            <Badge
              tone={
                analysis.recommendation === "PAY_CASH" ||
                analysis.recommendation === "PAY_INSTALLMENT"
                  ? "positive"
                  : analysis.recommendation === "CASH_RISKY_CONSIDER_INSTALLMENT"
                    ? "attention"
                    : "critical"
              }
            >
              {analysis.recommendation === "PAY_CASH"
                ? "À Vista Recomendado"
                : analysis.recommendation === "PAY_INSTALLMENT"
                  ? "Parcelamento Sustentável"
                  : analysis.recommendation === "CASH_RISKY_CONSIDER_INSTALLMENT"
                    ? "Cuidado com o Caixa"
                    : "Parcela Não Cabe"}
            </Badge>
          </div>

          <Callout
            tone={
              analysis.recommendation === "PAY_CASH" ||
              analysis.recommendation === "PAY_INSTALLMENT"
                ? "info"
                : "attention"
            }
          >
            {analysis.recommendationReason}
          </Callout>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Opção À Vista */}
            {analysis.cashOfferAmount ? (
              <div className="rounded-lg border border-[color:var(--card-border)] bg-[color:var(--card-bg)] p-3">
                <span className="text-xs font-semibold text-[color:var(--color-brand-600)] uppercase">
                  Opção À Vista
                </span>
                <p className="tabular mt-1 text-xl font-bold">
                  {formatMoney(analysis.cashOfferAmount)}
                </p>
                <p className="mt-1 text-xs font-medium text-[color:var(--color-positive-fg)]">
                  {analysis.cashDiscountPercentage}% de desconto (Economia de{" "}
                  {analysis.cashSavingsAmount ? formatMoney(analysis.cashSavingsAmount) : "—"})
                </p>
                <p className="mt-2 text-xs" style={{ color: "var(--muted-fg)" }}>
                  {analysis.isCashAffordableWithoutTouchingReserve
                    ? "✅ Caixa disponível cobre sem mexer na reserva de respiro."
                    : "⚠️ Exige usar parte do caixa essencial de emergência."}
                </p>
              </div>
            ) : null}

            {/* Opção Parcelada */}
            {analysis.installmentTotalCost ? (
              <div className="rounded-lg border border-[color:var(--card-border)] bg-[color:var(--card-bg)] p-3">
                <span className="text-xs font-semibold text-[color:var(--color-brand-600)] uppercase">
                  Opção Parcelada
                </span>
                <p className="tabular mt-1 text-xl font-bold">
                  {formatMoney(analysis.installmentTotalCost)}
                </p>
                <p className="mt-1 text-xs font-medium text-[color:var(--color-positive-fg)]">
                  {analysis.installmentDiscountPercentage}% de desconto (Economia de{" "}
                  {analysis.installmentSavingsVsOriginal
                    ? formatMoney(analysis.installmentSavingsVsOriginal)
                    : "—"}
                  )
                </p>
                <p className="mt-2 text-xs" style={{ color: "var(--muted-fg)" }}>
                  {analysis.isInstallmentAffordable
                    ? "✅ Parcela cabe dentro do seu teto mensal sustentável."
                    : "❌ Parcela ultrapassa o limite seguro do seu orçamento."}
                </p>
              </div>
            ) : null}

            {/* Proteção de Reserva */}
            <div className="rounded-lg border border-[color:var(--card-border)] bg-[color:var(--card-bg)] p-3">
              <span className="text-xs font-semibold text-[color:var(--page-fg)] uppercase">
                Seu Colchão de Segurança
              </span>
              <p className="tabular mt-1 text-lg font-bold">{formatMoney(availableCash)}</p>
              <p className="mt-1 text-xs" style={{ color: "var(--muted-fg)" }}>
                Reserva mínima protegida: {formatMoney(minimumReserveCushion)}
              </p>
              <p className="mt-2 text-xs" style={{ color: "var(--muted-fg)" }}>
                Capacidade máx. de parcela: {formatMoney(capacity.maxInstallment)}/mês
              </p>
            </div>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-xs" style={{ color: "var(--muted-fg)" }}>
          💡 Digite o saldo original e ao menos uma das opções (à vista ou parcelada) para comparar
          o impacto.
        </p>
      )}
    </Card>
  );
}

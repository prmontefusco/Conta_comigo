"use client";

import { useMemo, useState } from "react";
import { formatMoney } from "@/core/money/format";
import { fromDecimalString, sum } from "@/core/money/money";
import { Callout, Card, Stat } from "@/components/ui/primitives";
import { MoneyField, TextField } from "@/components/ui/form";
import { useFinance } from "@/modules/household/ui/finance-provider";
import { buildSchedule } from "@/modules/debts/domain/debt";
import {
  avaliarPortabilidadeCredito,
  type PortabilidadeContratoAtual,
  type PortabilidadeNovaProposta,
} from "../domain/portabilidade-credit";

export function PortabilidadeCard() {
  const finance = useFinance();
  const currency = finance.totalCash.currency;

  const activeDebts = useMemo(
    () => finance.debts.filter((d) => d.status !== "SETTLED"),
    [finance.debts],
  );

  const [selectedDebtId, setSelectedDebtId] = useState<string>(activeDebts[0]?.id ?? "");
  const [novaInstituicao, setNovaInstituicao] = useState("");
  const [custoTotalPropostaText, setCustoTotalPropostaText] = useState("");
  const [novaParcelaMensalText, setNovaParcelaMensalText] = useState("");
  const [custosAdicionaisText, setCustosAdicionaisText] = useState("");

  const selectedDebt = activeDebts.find((d) => d.id === selectedDebtId) ?? activeDebts[0];

  const analise = useMemo(() => {
    if (!selectedDebt) return null;

    const paidNumbers = new Set(finance.paidDebtInstallments.get(selectedDebt.id) ?? []);
    const pendingInstallments = buildSchedule(selectedDebt).filter(
      (installment) => !paidNumbers.has(installment.number),
    );
    if (pendingInstallments.length === 0) return null;
    const parcelaAtual = pendingInstallments[0]!.total;
    const custoTotalRestanteAtual = sum(
      pendingInstallments.map((installment) => installment.total),
      currency,
    );
    const custoTotalProposta = fromDecimalString(custoTotalPropostaText);
    const novaParcelaMensal = fromDecimalString(novaParcelaMensalText);
    if (!custoTotalProposta || custoTotalProposta.amount <= 0) return null;
    const custosAdicionais = fromDecimalString(custosAdicionaisText);

    const contratoAtual: PortabilidadeContratoAtual = {
      instituicaoAtual: selectedDebt.institution || selectedDebt.description,
      custoTotalRestanteAtual,
      parcelaAtual,
    };

    const proposta: PortabilidadeNovaProposta = {
      novaInstituicao: novaInstituicao.trim() || "Nova Instituição",
      custoTotalInformado: custoTotalProposta,
      ...(novaParcelaMensal ? { novaParcelaMensal } : {}),
      ...(custosAdicionais ? { custosAdicionaisInformados: custosAdicionais } : {}),
    };

    return avaliarPortabilidadeCredito(contratoAtual, proposta);
  }, [
    selectedDebt,
    finance.paidDebtInstallments,
    currency,
    novaInstituicao,
    custoTotalPropostaText,
    novaParcelaMensalText,
    custosAdicionaisText,
  ]);

  if (activeDebts.length === 0) {
    return null;
  }

  return (
    <Card className="border-l-4 border-l-[color:var(--color-positive-600)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--card-border)] pb-4">
        <div>
          <span className="text-xs font-bold tracking-wider text-[color:var(--color-positive-600)] uppercase">
            Portabilidade de crédito
          </span>
          <h3 className="text-lg font-bold text-[color:var(--page-fg)]">
            Compare os totais de duas propostas
          </h3>
        </div>
      </div>

      <p className="mt-3 text-sm" style={{ color: "var(--muted-fg)" }}>
        Informe os valores que constam nas propostas para comparar a soma das parcelas. A ferramenta
        não confirma elegibilidade, custo efetivo total (CET) nem se uma cobrança é regular. Confira
        o CET e os custos totais nos documentos da instituição antes de decidir.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted-fg)" }}>
            Selecione o Contrato Atual
          </label>
          <select
            value={selectedDebtId}
            onChange={(e) => setSelectedDebtId(e.target.value)}
            className="mt-1 block w-full rounded-xl border border-[color:var(--card-border)] bg-[color:var(--card-bg)] p-2.5 text-sm"
          >
            {activeDebts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.description} ({d.institution ?? "Sem banco"} - {d.installmentCount} parcelas)
              </option>
            ))}
          </select>
        </div>

        <div>
          <TextField
            label="Instituição Proponente (Novo Banco)"
            value={novaInstituicao}
            onChange={(e) => setNovaInstituicao(e.target.value)}
            placeholder="Ex: C6, Nubank, Santander..."
          />
        </div>

        <div>
          <MoneyField
            label="Total da nova proposta"
            value={custoTotalPropostaText}
            onChange={(e) => setCustoTotalPropostaText(e.target.value)}
            hint="Use a soma total indicada nos documentos, incluindo os custos que fazem parte da proposta."
          />
        </div>

        <div>
          <MoneyField
            label="Parcela mensal proposta (opcional)"
            value={novaParcelaMensalText}
            onChange={(e) => setNovaParcelaMensalText(e.target.value)}
            hint="Preencha também se quiser comparar o valor mensal."
          />
        </div>

        <div>
          <MoneyField
            label="Custos adicionais informados (se houver)"
            value={custosAdicionaisText}
            onChange={(e) => setCustosAdicionaisText(e.target.value)}
            hint="Informe o valor indicado na proposta. Isso não determina se a cobrança é opcional ou regular."
          />
        </div>
      </div>

      {!analise ? (
        <p className="mt-4 text-sm" style={{ color: "var(--muted-fg)" }}>
          Informe o total da nova proposta para comparar os custos restantes. O cronograma atual
          considera as parcelas já registradas como pagas.
        </p>
      ) : null}

      {analise && (
        <div className="mt-5 space-y-4">
          {analise.temCustosAdicionaisInformados && (
            <Callout tone="attention" title="Custos adicionais informados">
              Valor informado: <strong>{formatMoney(analise.custosAdicionaisInformados)}</strong>.
              Confira se esse valor já está incluído nas parcelas para evitar contar o custo duas
              vezes. O simulador não classifica a cobrança.
            </Callout>
          )}

          <Callout
            tone={analise.totalPropostoMenor ? "positive" : "attention"}
            title="Comparação dos totais informados"
          >
            {analise.comparacao}
            <p className="mt-2 text-xs">
              {analise.instituicaoAtual} → {analise.novaInstituicao}
            </p>
          </Callout>

          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Stat
              label="Diferença entre os totais"
              value={analise.economiaTotal}
              tone={
                analise.economiaTotal.amount > 0
                  ? "positive"
                  : analise.economiaTotal.amount < 0
                    ? "outflow"
                    : "neutral"
              }
            />
            {analise.diferencaParcelaMensal ? (
              <Stat
                label="Diferença na parcela mensal"
                value={analise.diferencaParcelaMensal}
                tone={
                  analise.diferencaParcelaMensal.amount > 0
                    ? "positive"
                    : analise.diferencaParcelaMensal.amount < 0
                      ? "outflow"
                      : "neutral"
                }
              />
            ) : null}
            <Stat
              label="Custo Atual Restante"
              value={analise.custoTotalRestanteAtual}
              tone="neutral"
            />
            <Stat
              label="Custo Total Nova Proposta"
              value={analise.custoTotalNovaProposta}
              tone="neutral"
            />
          </dl>
        </div>
      )}
    </Card>
  );
}

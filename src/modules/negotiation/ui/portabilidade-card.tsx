"use client";

import { useMemo, useState } from "react";
import { formatMoney } from "@/core/money/format";
import { fromDecimalString, zero } from "@/core/money/money";
import { Callout, Card, Stat } from "@/components/ui/primitives";
import { MoneyField, TextField } from "@/components/ui/form";
import { useFinance } from "@/modules/household/ui/finance-provider";
import { outstandingPrincipal, effectiveMonthlyRate } from "@/modules/debts/domain/debt";
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
  const [novaTaxaText, setNovaTaxaText] = useState("1.5");
  const [novasParcelasCountText, setNovasParcelasCountText] = useState("36");
  const [novaParcelaText, setNovaParcelaText] = useState("");
  const [seguroPrestamistaText, setSeguroPrestamistaText] = useState("");

  const selectedDebt = activeDebts.find((d) => d.id === selectedDebtId) ?? activeDebts[0];

  const analise = useMemo(() => {
    if (!selectedDebt) return null;

    const saldo = outstandingPrincipal(
      selectedDebt,
      finance.paidDebtInstallments.get(selectedDebt.id) ?? [],
    );
    const taxaAtual = effectiveMonthlyRate(selectedDebt).monthly;
    const parcelaAtual = selectedDebt.installmentAmount ?? zero(currency);
    const parcelasRestantes = selectedDebt.installmentCount;

    const novaTaxa = parseFloat(novaTaxaText) || 1.5;
    const novasParcelasCount = parseInt(novasParcelasCountText, 10) || 36;
    const novaParcela = fromDecimalString(novaParcelaText) ?? parcelaAtual;
    const seguro = fromDecimalString(seguroPrestamistaText);

    const contratoAtual: PortabilidadeContratoAtual = {
      instituicaoAtual: selectedDebt.institution || selectedDebt.description,
      saldoDevedor: saldo,
      parcelaAtual,
      parcelasRestantes,
      taxaJurosMensal: taxaAtual,
    };

    const proposta: PortabilidadeNovaProposta = {
      novaInstituicao: novaInstituicao.trim() || "Nova Instituição",
      novaTaxaMensal: novaTaxa,
      novasParcelasCount,
      novaParcelaMensal: novaParcela,
      ...(seguro ? { seguroPrestamistaEmbutido: seguro } : {}),
    };

    return avaliarPortabilidadeCredito(contratoAtual, proposta);
  }, [
    selectedDebt,
    finance.paidDebtInstallments,
    currency,
    novaInstituicao,
    novaTaxaText,
    novasParcelasCountText,
    novaParcelaText,
    seguroPrestamistaText,
  ]);

  if (activeDebts.length === 0) {
    return null;
  }

  return (
    <Card className="border-l-4 border-l-[color:var(--color-positive-600)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--card-border)] pb-4">
        <div>
          <span className="text-xs font-bold tracking-wider text-[color:var(--color-positive-600)] uppercase">
            Direito do Consumidor & Portabilidade
          </span>
          <h3 className="text-lg font-bold text-[color:var(--page-fg)]">
            Simulador de Portabilidade de Crédito (com Detector de Venda Casada)
          </h3>
        </div>
      </div>

      <p className="mt-3 text-sm" style={{ color: "var(--muted-fg)" }}>
        Você tem o direito garantido pelo Banco Central e pelo CDC de transferir suas dívidas para
        qualquer banco que ofereça taxas menores. Use este simulador para verificar se a proposta é
        realmente vantajosa ou se o banco está embutindo seguros proibidos por lei.
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
          <TextField
            label="Nova Taxa de Juros Mensal (% a.m.)"
            value={novaTaxaText}
            onChange={(e) => setNovaTaxaText(e.target.value)}
            placeholder="Ex: 1.45"
          />
        </div>

        <div>
          <TextField
            label="Número de Parcelas Oferecidas"
            value={novasParcelasCountText}
            onChange={(e) => setNovasParcelasCountText(e.target.value)}
            placeholder="Ex: 36"
          />
        </div>

        <div>
          <MoneyField
            label="Novo Valor da Parcela Proposta"
            value={novaParcelaText}
            onChange={(e) => setNovaParcelaText(e.target.value)}
            hint="O valor mensal que o novo banco cobraria."
          />
        </div>

        <div>
          <MoneyField
            label="Seguro Prestamista ou Tarifa Embutida (se houver)"
            value={seguroPrestamistaText}
            onChange={(e) => setSeguroPrestamistaText(e.target.value)}
            hint="Verifique na proposta se há 'seguro proteção financeira' incluído."
          />
        </div>
      </div>

      {analise && (
        <div className="mt-5 space-y-4">
          {analise.detectouVendaCasada && (
            <Callout tone="critical" title="Alerta de Venda Casada (Art. 39, I do CDC)">
              {analise.alertaVendaCasadaMensagem}
              <p className="mt-2 text-xs font-medium">
                Valor do Seguro/Taxa embutido: <strong>{formatMoney(analise.valorVendaCasadaTotal)}</strong>.
                Taxa real com o seguro (CET): <strong>{analise.cetRealEstimadoMensal}% a.m.</strong>
              </p>
            </Callout>
          )}

          <Callout tone={analise.ehVantajosa ? "positive" : "attention"} title="Parecer da Simulação">
            {analise.recomendacao}
          </Callout>

          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat
              label="Economia Total Estimada"
              value={analise.economiaTotal}
              tone={analise.ehVantajosa ? "positive" : "outflow"}
            />
            <Stat
              label="Alívio na Parcela Mensal"
              value={analise.diferencaParcelaMensal}
              tone={analise.ehVantajosa ? "positive" : "neutral"}
            />
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

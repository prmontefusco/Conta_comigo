"use client";

import { useMemo, useState } from "react";
import { formatMoney } from "@/core/money/format";
import { fromDecimalString, money } from "@/core/money/money";
import { Badge, Button, Card, CardTitle, Spinner, Stat } from "@/components/ui/primitives";
import { MoneyField, TextField } from "@/components/ui/form";
import { useFinance } from "@/modules/household/ui/finance-provider";
import { useSession } from "@/modules/household/ui/session-provider";
import { outstandingPrincipal } from "@/modules/debts/domain/debt";
import {
  avaliarSuperendividamento,
  DISCLAIMER_LEGAL_SUPERENDIVIDAMENTO,
  ROTEIRO_SUPERENDIVIDAMENTO_PASSOS,
  type BemPatrimonial,
  type CredorDividaItem,
  type DespesaEssencialItem,
  type GastoCortadoItem,
  type StatusSuperendividamento,
} from "@/modules/superendividamento/domain/superendividamento";

const TONE_STATUS: Record<StatusSuperendividamento, "critical" | "attention" | "positive" | "brand"> = {
  SUPERENDIVIDADO_CRITICO: "critical",
  SUPERENDIVIDADO_MODERADO: "critical",
  ALERTA_ENDIVIDAMENTO: "attention",
  COMPROMETIMENTO_EQUILIBRADO: "positive",
};

export default function SuperendividamentoPage() {
  const finance = useFinance();
  const { household, profile } = useSession();
  const currency = finance.totalCash.currency;

  const currentMonth = finance.forecast.months[0];
  const initialInflow = currentMonth?.expectedInflows ?? money(400000, currency);

  // Estados do Formulário
  const [rendaText, setRendaText] = useState((initialInflow.amount / 100).toString());
  const [dependentes, setDependentes] = useState(1);
  const [motivoCrise, setMotivoCrise] = useState(
    "Aumento abusivo de encargos bancários e juros de cartão rotativo, somado à inflação de itens básicos de subsistência.",
  );

  // 1. Despesas Essenciais (Mínimo Existencial)
  const [essenciais, setEssenciais] = useState<DespesaEssencialItem[]>([
    { id: "e1", categoria: "MORADIA", descricao: "Aluguel / Condomínio / Moradia", valorMensal: money(140000, currency) },
    { id: "e2", categoria: "UTILIDADES", descricao: "Energia elétrica, água e gás de cozinha", valorMensal: money(38000, currency) },
    { id: "e3", categoria: "ALIMENTACAO", descricao: "Alimentação básica essencial e feira", valorMensal: money(110000, currency) },
    { id: "e4", categoria: "SAUDE", descricao: "Medicamentos contínuos e farmácia", valorMensal: money(25000, currency) },
    { id: "e5", categoria: "TRANSPORTE", descricao: "Transporte público / locomoção para o trabalho", valorMensal: money(22000, currency) },
  ]);

  // 2. Gastos JÁ CORTADOS (Prova de Boa-Fé para o Juiz)
  const [cortes, setCortes] = useState<GastoCortadoItem[]>([
    { id: "c1", categoria: "STREAMING_APPS", descricao: "Netflix, Amazon Prime e assinaturas de streaming", economiaMensal: money(8990, currency), dataCorte: "Cancelados recentemente" },
    { id: "c2", categoria: "DELIVERY_RESTAURANTES", descricao: "Refeições fora de casa e aplicativos de delivery", economiaMensal: money(35000, currency), dataCorte: "Suspensos totalmente" },
    { id: "c3", categoria: "LAZER_VIAGENS", descricao: "Passeios, viagens e compras de vestuário não essenciais", economiaMensal: money(25000, currency), dataCorte: "Zerados" },
    { id: "c4", categoria: "SERVICOS_SUPERFLUOS", descricao: "Academia e mensalidades de clubes", economiaMensal: money(12000, currency), dataCorte: "Cancelados" },
  ]);

  // 3. Bens e Patrimônio (afastando suspeita de dilapidação)
  const [bens] = useState<BemPatrimonial[]>([
    { id: "b1", descricao: "Móveis e utensílios que guarnecem a residência familiar", tipo: "IMOVEL_RESIDENCIAL", valorEstimado: money(800000, currency), bemDeFamilia: true },
  ]);

  // 4. Credores (importados das dívidas ativas da família)
  const [credores] = useState<CredorDividaItem[]>(() => {
    return finance.debts
      .filter((d) => d.status !== "SETTLED")
      .map((d) => ({
        id: d.id,
        instituicao: d.institution || d.description,
        tipo: d.kind === "PAYROLL_LOAN" ? "EMPRESTIMO_CONSIGNADO" : "EMPRESTIMO_PESSOAL",
        saldoDevedorEstimado: outstandingPrincipal(d, finance.paidDebtInstallments.get(d.id) ?? []),
        valorParcelaMensal: d.installmentAmount ?? money(35000, currency),
        parcelasRestantes: d.installmentCount,
      }));
  });

  // Novos itens para adicionar dinamicamente
  const [novoEssencialNome, setNovoEssencialNome] = useState("");
  const [novoEssencialValor, setNovoEssencialValor] = useState("");
  const [novoCorteNome, setNovoCorteNome] = useState("");
  const [novoCorteValor, setNovoCorteValor] = useState("");

  // Estado da IA
  const [narrativaIA, setNarrativaIA] = useState<string | null>(null);
  const [gerandoIA, setGerandoIA] = useState(false);

  // Aba ativa: DIAGNOSTICO ou DOSSIE_IMPRESSAO
  const [modoVisualizacao, setModoVisualizacao] = useState<"DIAGNOSTICO" | "DOSSIE">("DIAGNOSTICO");

  const renda = fromDecimalString(rendaText) ?? initialInflow;

  const diagnostico = useMemo(() => {
    return avaliarSuperendividamento({
      rendaLiquidaMensal: renda,
      dependentesCount: dependentes,
      despesasEssenciais: essenciais,
      gastosCortados: cortes,
      dividas: credores,
      bens,
    });
  }, [renda, dependentes, essenciais, cortes, credores, bens]);

  const handleGerarNarrativaIA = async () => {
    setGerandoIA(true);
    try {
      const response = await fetch("/api/ai/superendividamento", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          rendaLiquida: formatMoney(diagnostico.rendaLiquida),
          dependentes,
          motivoInadimplencia: motivoCrise,
          despesasEssenciaisTotal: formatMoney(diagnostico.totalDespesasEssenciais),
          despesasEssenciaisDescricao: essenciais.map((e) => `${e.descricao} (${formatMoney(e.valorMensal)})`).join(", "),
          cortesRealizadosDescricao: cortes.map((c) => `• ${c.descricao}: economia de ${formatMoney(c.economiaMensal)}/mês (${c.dataCorte ?? "cancelado"})`).join("\n"),
          totalEconomiaCortes: formatMoney(diagnostico.totalEconomiaCortesRealizados),
          totalPassivo: formatMoney(diagnostico.totalPassivoDevedor),
          totalParcelasAtuais: formatMoney(diagnostico.totalParcelasAtuais),
          credoresResumo: credores.map((c) => `${c.instituicao}: Saldo ${formatMoney(c.saldoDevedorEstimado)}, Parcela ${formatMoney(c.valorParcelaMensal)}`).join("; "),
          propostaMensal60m: formatMoney(diagnostico.margemDisponivelParaPagamento),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setNarrativaIA(data.narrativa);
      }
    } catch {
      // continua sem quebrar
    } finally {
      setGerandoIA(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const adicionarDespesaEssencial = () => {
    if (!novoEssencialNome.trim()) return;
    const valor = fromDecimalString(novoEssencialValor) ?? money(10000, currency);
    setEssenciais((prev) => [
      ...prev,
      { id: `e_${Date.now()}`, categoria: "OUTRO_ESSENCIAL", descricao: novoEssencialNome.trim(), valorMensal: valor },
    ]);
    setNovoEssencialNome("");
    setNovoEssencialValor("");
  };

  const adicionarGastoCortado = () => {
    if (!novoCorteNome.trim()) return;
    const valor = fromDecimalString(novoCorteValor) ?? money(5000, currency);
    setCortes((prev) => [
      ...prev,
      { id: `c_${Date.now()}`, categoria: "OUTRO_CORTE", descricao: novoCorteNome.trim(), economiaMensal: valor, dataCorte: "Cortado voluntariamente" },
    ]);
    setNovoCorteNome("");
    setNovoCorteValor("");
  };

  const removerEssencial = (id: string) => {
    setEssenciais((prev) => prev.filter((e) => e.id !== id));
  };

  const removerCorte = (id: string) => {
    setCortes((prev) => prev.filter((c) => c.id !== id));
  };

  if (finance.loading) return <Spinner label="Carregando dados de superendividamento" />;

  return (
    <div className="space-y-6">
      {/* Botões de Ação de Topo (Não aparecem na impressão) */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <span className="text-xs font-bold tracking-wider text-[color:var(--color-critical-600)] uppercase">
            Lei nº 14.181/2021 & Decreto nº 11.567/2023
          </span>
          <h1 className="text-xl font-bold text-[color:var(--page-fg)]">
            Dossiê de Superendividamento & Repactuação em 5 Anos
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setModoVisualizacao("DIAGNOSTICO")}
            className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
              modoVisualizacao === "DIAGNOSTICO"
                ? "bg-[color:var(--color-brand-600)] text-white shadow-2xs"
                : "border border-[color:var(--card-border)] bg-[color:var(--card-bg)] text-[color:var(--page-fg)]"
            }`}
          >
            📝 Preencher Dados & Simular
          </button>
          <button
            type="button"
            onClick={() => setModoVisualizacao("DOSSIE")}
            className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
              modoVisualizacao === "DOSSIE"
                ? "bg-[color:var(--color-brand-600)] text-white shadow-2xs"
                : "border border-[color:var(--card-border)] bg-[color:var(--card-bg)] text-[color:var(--page-fg)]"
            }`}
          >
            ⚖️ Ver Dossiê para Juiz / Procon
          </button>
          {modoVisualizacao === "DOSSIE" && (
            <Button onClick={handlePrint} className="px-3.5 py-2 text-xs">
              🖨️ Imprimir / Salvar PDF
            </Button>
          )}
        </div>
      </div>

      {/* MODO 1: DIAGNÓSTICO E FORMULÁRIO */}
      {modoVisualizacao === "DIAGNOSTICO" && (
        <div className="space-y-6 print:hidden">
          {/* Card de Enquadramento */}
          <Card className="border-l-4 border-l-[color:var(--color-critical-600)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--card-border)] pb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[color:var(--color-critical-600)]">
                  Resultado do Diagnóstico
                </span>
                <h3 className="text-lg font-bold text-[color:var(--page-fg)]">
                  {diagnostico.status === "SUPERENDIVIDADO_CRITICO"
                    ? "Situação Crítica: Enquadramento Pleno na Lei 14.181/2021"
                    : diagnostico.status === "SUPERENDIVIDADO_MODERADO"
                    ? "Superendividamento Moderado Detectado"
                    : "Comprometimento sob Atenção"}
                </h3>
              </div>
              <Badge tone={TONE_STATUS[diagnostico.status]}>
                {diagnostico.percentualComprometimentoAtual}% da renda em dívidas
              </Badge>
            </div>

            <p className="mt-3 text-sm" style={{ color: "var(--muted-fg)" }}>
              {diagnostico.justificativaEnquadramento}
            </p>

            <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat label="Renda Líquida" value={diagnostico.rendaLiquida} tone="positive" />
              <Stat label="Mínimo Existencial" value={diagnostico.minimoExistencialCalculado} tone="neutral" hint="Protegido por lei" />
              <Stat label="Parcelas Mensais Atuais" value={diagnostico.totalParcelasAtuais} tone="critical" />
              <Stat label="Capacidade Real de Amortização" value={diagnostico.margemDisponivelParaPagamento} tone="positive" hint="Renda livre para o plano" />
            </dl>
          </Card>

          {/* Seção 1: Renda e Dependentes */}
          <Card>
            <CardTitle hint="Informe os rendimentos comprováveis da família em holerites ou extratos.">
              1. Renda Familiar e Contexto
            </CardTitle>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <MoneyField
                label="Renda Líquida Mensal Total"
                value={rendaText}
                onChange={(e) => setRendaText(e.target.value)}
                hint="Salário líquido recebido em conta, sem descontos facultativos."
              />
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted-fg)" }}>
                  Número de Dependentes (Filhos / Cônjuge sem renda)
                </label>
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={dependentes}
                  onChange={(e) => setDependentes(parseInt(e.target.value, 10) || 0)}
                  className="mt-1 block w-full rounded-xl border border-[color:var(--card-border)] bg-[color:var(--card-bg)] p-2.5 text-sm"
                />
              </div>
            </div>

            <div className="mt-4">
              <TextField
                label="Histórico / Motivo do Endividamento (Importante para o Juiz)"
                value={motivoCrise}
                onChange={(e) => setMotivoCrise(e.target.value)}
                hint="Explique de forma objetiva como as dívidas saíram do controle (ex: perda de emprego anterior, doença na família, juros abusivos de cartão)."
              />
            </div>
          </Card>

          {/* Seção 2: Despesas Essenciais (Mínimo Existencial) */}
          <Card className="border-l-4 border-l-[color:var(--color-brand-600)]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[color:var(--card-border)] pb-3">
              <div>
                <CardTitle hint="Gastos indispensáveis à sobrevivência com dignidade que a lei protege contra penhora e retenção.">
                  2. Despesas Essenciais Mínimas (Mínimo Existencial)
                </CardTitle>
              </div>
              <span className="text-sm font-bold text-[color:var(--page-fg)]">
                Total: {formatMoney(diagnostico.totalDespesasEssenciais)}/mês
              </span>
            </div>

            <div className="mt-4 divide-y divide-[color:var(--card-border)]">
              {essenciais.map((item) => (
                <div key={item.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div>
                    <p className="font-medium text-[color:var(--page-fg)]">{item.descricao}</p>
                    <span className="text-2xs uppercase tracking-wider" style={{ color: "var(--muted-fg)" }}>
                      {item.categoria}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-[color:var(--page-fg)]">
                      {formatMoney(item.valorMensal)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removerEssencial(item.id)}
                      className="text-xs text-[color:var(--color-critical-600)] hover:underline"
                    >
                      Remover
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap gap-2 border-t border-[color:var(--card-border)] pt-4">
              <div className="flex-1 min-w-[180px]">
                <TextField
                  label="Nova despesa essencial"
                  value={novoEssencialNome}
                  onChange={(e) => setNovoEssencialNome(e.target.value)}
                  placeholder="Ex: Farmácia para filho, transporte"
                />
              </div>
              <div className="w-36">
                <MoneyField
                  label="Valor (R$)"
                  value={novoEssencialValor}
                  onChange={(e) => setNovoEssencialValor(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button onClick={adicionarDespesaEssencial} variant="secondary" className="text-xs">
                  + Adicionar
                </Button>
              </div>
            </div>
          </Card>

          {/* Seção 3: GASTOS JÁ CORTADOS (PROVA DE BOA-FÉ PARA O JUIZ) */}
          <Card className="border-l-4 border-l-[color:var(--color-positive-600)]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[color:var(--card-border)] pb-3">
              <div>
                <span className="text-xs font-bold text-[color:var(--color-positive-600)] uppercase">
                  Ponto Decisivo para a Decisão do Juiz
                </span>
                <CardTitle hint="Comprovação de esforço pessoal: Liste tudo que você cortou para mostrar que não há luxo e que as dívidas decorrem do estrangulamento financeiro.">
                  3. Gastos e Supérfluos JÁ Cortados ou Cancelados (Prova de Boa-Fé)
                </CardTitle>
              </div>
              <span className="text-sm font-bold text-[color:var(--color-positive-600)]">
                Economia Gerada: {formatMoney(diagnostico.totalEconomiaCortesRealizados)}/mês
              </span>
            </div>

            <div className="mt-4 divide-y divide-[color:var(--card-border)]">
              {cortes.map((corte) => (
                <div key={corte.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div>
                    <p className="font-medium text-[color:var(--page-fg)]">{corte.descricao}</p>
                    <p className="text-xs text-[color:var(--color-positive-700)]">
                      {corte.dataCorte ?? "Cancelado"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-[color:var(--color-positive-600)]">
                      - {formatMoney(corte.economiaMensal)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removerCorte(corte.id)}
                      className="text-xs text-[color:var(--color-critical-600)] hover:underline"
                    >
                      Remover
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap gap-2 border-t border-[color:var(--card-border)] pt-4">
              <div className="flex-1 min-w-[180px]">
                <TextField
                  label="Despesa cortada / cancelada"
                  value={novoCorteNome}
                  onChange={(e) => setNovoCorteNome(e.target.value)}
                  placeholder="Ex: Netflix, academia, diarista, salão"
                />
              </div>
              <div className="w-36">
                <MoneyField
                  label="Economia (R$)"
                  value={novoCorteValor}
                  onChange={(e) => setNovoCorteValor(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button onClick={adicionarGastoCortado} variant="secondary" className="text-xs">
                  + Adicionar Corte
                </Button>
              </div>
            </div>
          </Card>

          {/* Seção 4: Proposta de Repactuação em até 60 Meses */}
          <Card>
            <CardTitle hint="Proposta calculada conforme o art. 104-A do CDC com carência de 180 dias e rateio proporcional.">
              4. Proposta de Plano de Repactuação em 60 Meses (5 Anos)
            </CardTitle>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[color:var(--card-border)] text-xs uppercase" style={{ color: "var(--muted-fg)" }}>
                    <th className="pb-2">Credor / Banco</th>
                    <th className="pb-2">Saldo Devedor</th>
                    <th className="pb-2">% do Passivo</th>
                    <th className="pb-2">Parcela Proposta Mensal</th>
                    <th className="pb-2">Total em 60 Meses</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--card-border)]">
                  {diagnostico.planoRepactuacao.credoresPropostas.map((prop) => (
                    <tr key={prop.credorId}>
                      <td className="py-2.5 font-medium text-[color:var(--page-fg)]">{prop.instituicao}</td>
                      <td className="py-2.5">{formatMoney(prop.saldoDevedor)}</td>
                      <td className="py-2.5">{prop.percentualDoTotal}%</td>
                      <td className="py-2.5 font-bold text-[color:var(--color-positive-600)]">
                        {formatMoney(prop.parcelaPropostaMensal)}
                      </td>
                      <td className="py-2.5">{formatMoney(prop.totalAPagarEm60Meses)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--card-border)] pt-4">
              <span className="text-xs" style={{ color: "var(--muted-fg)" }}>
                Prazo: <strong>60 meses</strong> | Carência: <strong>180 dias</strong> (Art. 104-A, § 2º)
              </span>
              <Button onClick={() => setModoVisualizacao("DOSSIE")} className="text-xs">
                Visualizar Dossiê Completo Formatado &rarr;
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* MODO 2: DOSSIÊ COMPLETO PARA JUIZ / DEFENSORIA / PROCON */}
      {modoVisualizacao === "DOSSIE" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-[color:var(--card-border)] bg-white p-6 shadow-sm text-neutral-900 print:border-none print:p-0 print:shadow-none">
            {/* Cabeçalho Institucional do Dossiê */}
            <div className="border-b-2 border-neutral-800 pb-4 text-center">
              <h2 className="text-xl font-bold tracking-tight text-neutral-900 uppercase">
                Dossiê Técnico de Superendividamento & Proposta de Repactuação
              </h2>
              <p className="text-xs font-semibold text-neutral-600">
                Instrumento Financeiro-Contábil fundamentado na Lei nº 14.181/2021 e no Decreto nº 11.567/2023
              </p>
              <p className="mt-1 text-2xs text-neutral-500">
                Requerente: <strong>{profile?.displayName ?? household?.name ?? "Consumidor"}</strong> | Emissão:{" "}
                {new Date().toLocaleDateString("pt-BR")}
              </p>
            </div>

            {/* Declaração Formal de Boa-Fé */}
            <div className="mt-5 rounded-lg bg-neutral-50 p-4 border border-neutral-200">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-700">
                Declaração de Boa-Fé e Inexistência de Fraude (Art. 54-A do CDC)
              </h3>
              <p className="mt-1 text-xs text-neutral-700 leading-relaxed text-justify">
                Declara o(a) Requerente, sob as penas da lei, que todas as dívidas constantes neste documento
                foram contraídas de boa-fé para consumo próprio e manutenção do lar, jamais mediante dolo,
                fraude ou intenção de não adimplir. A incapacidade de pagamento sobreveio de forma involuntária
                em razão de: <em>&quot;{motivoCrise}&quot;</em>.
              </p>
            </div>

            {/* Assistente de IA de Narrativa (Se gerado) */}
            {narrativaIA ? (
              <div className="mt-5 rounded-lg border border-neutral-200 bg-neutral-50/50 p-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800 mb-2">
                  Fundamentação Fática e Jurídica da Situação Orçamentária
                </h3>
                <div className="text-xs text-neutral-800 space-y-2 whitespace-pre-line text-justify leading-relaxed">
                  {narrativaIA}
                </div>
              </div>
            ) : (
              <div className="mt-4 print:hidden flex items-center justify-between rounded-xl border border-[color:var(--card-border)] bg-[color:var(--color-surface-sunken)] p-3">
                <span className="text-xs" style={{ color: "var(--muted-fg)" }}>
                  Deseja que a Inteligência Artificial redija a fundamentação técnica para anexar à petição?
                </span>
                <Button
                  onClick={handleGerarNarrativaIA}
                  disabled={gerandoIA}
                  className="px-3 py-1.5 text-xs"
                >
                  {gerandoIA ? "Redigindo com IA..." : "✨ Redigir Narrativa com IA"}
                </Button>
              </div>
            )}

            {/* Quadro 1: Renda Líquida vs. Despesas Essenciais (Mínimo Existencial) */}
            <div className="mt-6">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-900 border-b border-neutral-300 pb-1">
                Quadro 1: Renda Líquida e Composição do Mínimo Existencial
              </h3>
              <div className="mt-2 grid grid-cols-2 gap-4 text-xs">
                <div>
                  <p><strong>Renda Mensal Líquida:</strong> {formatMoney(diagnostico.rendaLiquida)}</p>
                  <p><strong>Dependentes do Núcleo Familiar:</strong> {dependentes} pessoa(s)</p>
                  <p><strong>Piso Legal Mínimo Existencial:</strong> {formatMoney(diagnostico.minimoExistencialCalculado)}</p>
                </div>
                <div>
                  <p><strong>Total Despesas Essenciais:</strong> {formatMoney(diagnostico.totalDespesasEssenciais)}</p>
                  <p><strong>Parcelas de Dívidas Cobradas:</strong> {formatMoney(diagnostico.totalParcelasAtuais)}</p>
                  <p><strong>Saldo Disponível para Rateio:</strong> {formatMoney(diagnostico.margemDisponivelParaPagamento)}</p>
                </div>
              </div>

              <div className="mt-3">
                <table className="w-full text-xs text-left border border-neutral-200">
                  <thead className="bg-neutral-100">
                    <tr>
                      <th className="p-1.5 border-b">Item Essencial de Sobrevivência</th>
                      <th className="p-1.5 border-b">Categoria</th>
                      <th className="p-1.5 border-b text-right">Valor Mensal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {essenciais.map((e) => (
                      <tr key={e.id}>
                        <td className="p-1.5">{e.descricao}</td>
                        <td className="p-1.5">{e.categoria}</td>
                        <td className="p-1.5 text-right font-medium">{formatMoney(e.valorMensal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Quadro 2: CORTES EFETUADOS (PROVANDO PARA O JUIZ QUE NÃO HÁ LUXO) */}
            <div className="mt-6">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-900 border-b border-neutral-300 pb-1">
                Quadro 2: Medidas Concretas de Redução de Gastos Já Adotadas pelo Consumidor (Boa-Fé)
              </h3>
              <p className="mt-1 text-2xs text-neutral-600 text-justify">
                Demonstra-se que o requerente agiu diligentemente reduzindo ao máximo o padrão de vida e
                cancelando quaisquer serviços supérfluos, gerando uma contenção orçamentária comprovada de{" "}
                <strong>{formatMoney(diagnostico.totalEconomiaCortesRealizados)} ao mês</strong>:
              </p>
              <div className="mt-2">
                <table className="w-full text-xs text-left border border-neutral-200">
                  <thead className="bg-neutral-100">
                    <tr>
                      <th className="p-1.5 border-b">Despesa / Serviço Cancelado</th>
                      <th className="p-1.5 border-b">Status / Data</th>
                      <th className="p-1.5 border-b text-right">Economia Gerada</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {cortes.map((c) => (
                      <tr key={c.id}>
                        <td className="p-1.5">{c.descricao}</td>
                        <td className="p-1.5">{c.dataCorte ?? "Cancelado"}</td>
                        <td className="p-1.5 text-right font-semibold text-emerald-800">
                          {formatMoney(c.economiaMensal)}/mês
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Quadro 3: Relação de Credores e Proposta em 60 Meses */}
            <div className="mt-6">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-900 border-b border-neutral-300 pb-1">
                Quadro 3: Quadro Geral de Credores & Plano de Repactuação (Art. 104-A, CDC)
              </h3>
              <p className="mt-1 text-2xs text-neutral-600 text-justify">
                Proposta de quitação em 60 parcelas mensais, com carência de 180 dias para início dos pagamentos,
                com rateio proporcional da capacidade financeira líquida mensal ({formatMoney(diagnostico.margemDisponivelParaPagamento)}):
              </p>
              <div className="mt-2">
                <table className="w-full text-xs text-left border border-neutral-200">
                  <thead className="bg-neutral-100">
                    <tr>
                      <th className="p-1.5 border-b">Instituição Credora</th>
                      <th className="p-1.5 border-b text-right">Saldo Devedor</th>
                      <th className="p-1.5 border-b text-right">% Rateio</th>
                      <th className="p-1.5 border-b text-right font-bold">Parcela Proposta</th>
                      <th className="p-1.5 border-b text-right">Total 60m</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-200">
                    {diagnostico.planoRepactuacao.credoresPropostas.map((prop) => (
                      <tr key={prop.credorId}>
                        <td className="p-1.5 font-medium">{prop.instituicao}</td>
                        <td className="p-1.5 text-right">{formatMoney(prop.saldoDevedor)}</td>
                        <td className="p-1.5 text-right">{prop.percentualDoTotal}%</td>
                        <td className="p-1.5 text-right font-bold text-neutral-900">
                          {formatMoney(prop.parcelaPropostaMensal)}
                        </td>
                        <td className="p-1.5 text-right">{formatMoney(prop.totalAPagarEm60Meses)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Roteiro Processual Orientativo */}
            <div className="mt-6 border-t border-neutral-300 pt-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-900">
                Roteiro de Acesso à Justiça e Próximos Passos
              </h3>
              <div className="mt-2 space-y-2 text-2xs text-neutral-700">
                {ROTEIRO_SUPERENDIVIDAMENTO_PASSOS.map((passo) => (
                  <div key={passo.numero} className="rounded border border-neutral-200 p-2">
                    <p className="font-bold text-neutral-900">
                      Passo {passo.numero}: {passo.titulo} ({passo.orgao})
                    </p>
                    <p className="mt-0.5">{passo.descricao}</p>
                    <p className="mt-0.5 text-neutral-500">
                      <strong>Custo:</strong> {passo.custoAproximado}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Disclaimer Legal */}
            <div className="mt-6 border-t border-neutral-300 pt-4 text-justify">
              <p className="text-2xs text-neutral-500 leading-relaxed">
                {DISCLAIMER_LEGAL_SUPERENDIVIDAMENTO}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

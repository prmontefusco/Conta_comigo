"use client";

import { useState } from "react";
import Link from "next/link";
import { formatMoney } from "@/core/money/format";
import { Badge, Button, Card, CardTitle, Spinner } from "@/components/ui/primitives";
import { FormError } from "@/components/ui/form";
import { getDb } from "@/lib/firebase/client";
import { useSession } from "@/modules/household/ui/session-provider";
import { useFinance } from "@/modules/household/ui/finance-provider";
import { exportUserData } from "@/modules/privacy/application/data-portability";
import {
  buildAccountsCsv,
  buildCardsCsv,
  buildDebtsCsv,
  buildRecurringCsv,
  buildReservesCsv,
  buildTransactionsCsv,
} from "@/modules/privacy/domain/export-csv";

function triggerDownload(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function BaixarDadosPage() {
  const { user, profile, households, household } = useSession();
  const finance = useFinance();

  const [exportingJson, setExportingJson] = useState(false);
  const [exportingAllCsv, setExportingAllCsv] = useState(false);
  const [downloadSuccessMessage, setDownloadSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (finance.loading) {
    return <Spinner label="Carregando seus registros para exportação" />;
  }

  const dataAtual = new Date().toISOString().slice(0, 10);

  // 1. Download de Backup Completo em JSON
  const handleDownloadJson = async () => {
    if (!user) return;
    setExportingJson(true);
    setErrorMessage(null);
    setDownloadSuccessMessage(null);

    try {
      const payload = await exportUserData(
        getDb(),
        user.uid,
        households.map((h) => h.id),
      );

      triggerDownload(
        JSON.stringify(payload, null, 2),
        `conta-comigo-backup-completo-${dataAtual}.json`,
        "application/json",
      );
      setDownloadSuccessMessage("Arquivo de backup completo (JSON) baixado com sucesso!");
    } catch (err) {
      console.error(err);
      setErrorMessage("Erro ao preparar o backup em JSON. Tente novamente.");
    } finally {
      setExportingJson(false);
    }
  };

  // 2. Downloads individuais em CSV (Abre direto no Excel)
  const handleDownloadTransactionsCsv = () => {
    const csv = buildTransactionsCsv(finance.transactions, finance.categories, finance.accounts);
    triggerDownload(csv, `conta-comigo-movimentacoes-${dataAtual}.csv`, "text/csv;charset=utf-8;");
    setDownloadSuccessMessage("Planilha de Movimentações baixada com sucesso!");
  };

  const handleDownloadAccountsCsv = () => {
    const csv = buildAccountsCsv(finance.accounts);
    triggerDownload(csv, `conta-comigo-contas-e-saldos-${dataAtual}.csv`, "text/csv;charset=utf-8;");
    setDownloadSuccessMessage("Planilha de Contas e Saldos baixada com sucesso!");
  };

  const handleDownloadDebtsCsv = () => {
    const csv = buildDebtsCsv(finance.debts, finance.paidDebtInstallments);
    triggerDownload(csv, `conta-comigo-dividas-e-emprestimos-${dataAtual}.csv`, "text/csv;charset=utf-8;");
    setDownloadSuccessMessage("Planilha de Dívidas e Empréstimos baixada com sucesso!");
  };

  const handleDownloadCardsCsv = () => {
    const csv = buildCardsCsv(finance.cards);
    triggerDownload(csv, `conta-comigo-cartoes-de-credito-${dataAtual}.csv`, "text/csv;charset=utf-8;");
    setDownloadSuccessMessage("Planilha de Cartões baixada com sucesso!");
  };

  const handleDownloadRecurringCsv = () => {
    const csv = buildRecurringCsv(finance.recurringRules, finance.categories);
    triggerDownload(csv, `conta-comigo-contas-recorrentes-${dataAtual}.csv`, "text/csv;charset=utf-8;");
    setDownloadSuccessMessage("Planilha de Contas Recorrentes baixada com sucesso!");
  };

  const handleDownloadReservesCsv = () => {
    const csv = buildReservesCsv(finance.reserves, finance.goals);
    triggerDownload(csv, `conta-comigo-reservas-e-metas-${dataAtual}.csv`, "text/csv;charset=utf-8;");
    setDownloadSuccessMessage("Planilha de Metas e Reservas baixada com sucesso!");
  };

  // 3. Download de Todas as Planilhas
  const handleDownloadAllCsv = async () => {
    setExportingAllCsv(true);
    setErrorMessage(null);
    setDownloadSuccessMessage(null);

    try {
      handleDownloadTransactionsCsv();
      await new Promise((r) => setTimeout(r, 350));
      handleDownloadAccountsCsv();
      await new Promise((r) => setTimeout(r, 350));
      handleDownloadDebtsCsv();
      await new Promise((r) => setTimeout(r, 350));
      handleDownloadCardsCsv();
      await new Promise((r) => setTimeout(r, 350));
      handleDownloadRecurringCsv();
      await new Promise((r) => setTimeout(r, 350));
      handleDownloadReservesCsv();

      setDownloadSuccessMessage("Todas as 6 planilhas em formato Excel/CSV foram baixadas!");
    } catch (err) {
      console.error(err);
      setErrorMessage("Erro ao gerar pacote de planilhas.");
    } finally {
      setExportingAllCsv(false);
    }
  };

  const totalTransacoes = finance.transactions.length;
  const totalContas = finance.accounts.length;
  const totalDividas = finance.debts.length;
  const totalCartoes = finance.cards.length;
  const totalRecorrentes = finance.recurringRules.length;

  return (
    <div className="space-y-6">
      {/* Topo / Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold tracking-wider text-[color:var(--color-brand-600)] uppercase">
            Backup Local & Portabilidade Total
          </span>
          <h1 className="text-xl font-bold tracking-tight text-[color:var(--page-fg)]">
            Baixar Meus Dados (Backup Local)
          </h1>
          <p className="mt-1 text-xs text-[color:var(--muted-fg)] max-w-2xl leading-relaxed">
            Seus dados pertencem exclusivamente a você. Aqui você baixa uma cópia completa de todas as
            suas informações financeiras e cadastrais para guardar com segurança no seu computador,
            celular ou pen-drive.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={() => window.print()} className="text-xs">
            🖨️ Imprimir Resumo / Salvar PDF
          </Button>
        </div>
      </div>

      {/* Alertas de Sucesso / Erro */}
      {downloadSuccessMessage && (
        <div className="rounded-xl border border-[color:var(--color-positive-300)] bg-[color:var(--color-positive-50)] p-4 text-xs font-semibold text-[color:var(--color-positive-800)] dark:bg-[color:var(--color-positive-950)]/30 dark:text-[color:var(--color-positive-200)]">
          ✓ {downloadSuccessMessage}
        </div>
      )}
      {errorMessage && <FormError>{errorMessage}</FormError>}

      {/* Resumo do Inventário de Dados Disponíveis */}
      <Card>
        <CardTitle hint="Tudo o que está armazenado no seu grupo familiar hoje">
          Inventário de Registros Armazenados
        </CardTitle>

        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <div className="rounded-xl border border-[color:var(--card-border)] bg-[color:var(--color-surface-sunken)] p-3 text-center">
            <span className="text-xl">🧾</span>
            <p className="mt-1 text-base font-bold text-[color:var(--page-fg)]">{totalTransacoes}</p>
            <p className="text-2xs text-[color:var(--muted-fg)]">Movimentações</p>
          </div>

          <div className="rounded-xl border border-[color:var(--card-border)] bg-[color:var(--color-surface-sunken)] p-3 text-center">
            <span className="text-xl">🏦</span>
            <p className="mt-1 text-base font-bold text-[color:var(--page-fg)]">{totalContas}</p>
            <p className="text-2xs text-[color:var(--muted-fg)]">Contas Bancárias</p>
          </div>

          <div className="rounded-xl border border-[color:var(--card-border)] bg-[color:var(--card-bg)] p-3 text-center">
            <span className="text-xl">💳</span>
            <p className="mt-1 text-base font-bold text-[color:var(--page-fg)]">{totalCartoes}</p>
            <p className="text-2xs text-[color:var(--muted-fg)]">Cartões de Crédito</p>
          </div>

          <div className="rounded-xl border border-[color:var(--card-border)] bg-[color:var(--color-surface-sunken)] p-3 text-center">
            <span className="text-xl">🏛️</span>
            <p className="mt-1 text-base font-bold text-[color:var(--page-fg)]">{totalDividas}</p>
            <p className="text-2xs text-[color:var(--muted-fg)]">Dívidas & Empréstimos</p>
          </div>

          <div className="rounded-xl border border-[color:var(--card-border)] bg-[color:var(--card-bg)] p-3 text-center">
            <span className="text-xl">🔁</span>
            <p className="mt-1 text-base font-bold text-[color:var(--page-fg)]">{totalRecorrentes}</p>
            <p className="text-2xs text-[color:var(--muted-fg)]">Contas Fixas / Mês</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[color:var(--card-border)] pt-3 text-xs text-[color:var(--muted-fg)]">
          <span>
            Titular: <strong>{profile?.displayName ?? household?.name ?? "Usuário"}</strong>
            {profile?.cpf && ` | CPF: ${profile.cpf}`}
          </span>
          <span className="text-2xs text-[color:var(--color-positive-700)]">
            🔒 Dados protegidos e compatíveis com a LGPD (Lei nº 13.709/2018)
          </span>
        </div>
      </Card>

      {/* SEÇÃO 1: PLANILHAS EXCEL (CSV) FORMATADAS */}
      <Card className="border-l-4 border-l-[color:var(--color-brand-600)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-lg">📊</span>
              <CardTitle hint="Formato universal para abrir no Excel, Google Planilhas ou LibreOffice">
                Planilhas Formatadas para Excel (.CSV)
              </CardTitle>
            </div>
            <p className="text-xs text-[color:var(--muted-fg)] max-w-xl leading-relaxed">
              O formato ideal para quem quer abrir as contas em tabelas, ver fórmulas, fazer contas ou
              guardar cópias organizadas por assunto. Formatado com padrão brasileiro (ponto-e-vírgula e
              valores em R$).
            </p>
          </div>

          <Button
            onClick={() => void handleDownloadAllCsv()}
            disabled={exportingAllCsv}
            className="text-xs font-semibold px-4 py-2.5 shadow-sm"
          >
            {exportingAllCsv ? "Baixando arquivos..." : "📦 Baixar Todas as Planilhas (1 Clique)"}
          </Button>
        </div>

        {/* Grade de Tabelas Individuais */}
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-[color:var(--card-border)] bg-[color:var(--card-bg)] p-3.5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <strong className="text-xs text-[color:var(--page-fg)]">🧾 Movimentações</strong>
                <Badge tone="brand">{totalTransacoes} itens</Badge>
              </div>
              <p className="mt-1 text-2xs text-[color:var(--muted-fg)]">
                Extrato com todas as despesas e receitas, categorias, contas e valores.
              </p>
            </div>
            <Button
              variant="secondary"
              onClick={handleDownloadTransactionsCsv}
              className="mt-3 text-xs w-full"
            >
              📥 Baixar Movimentações (.csv)
            </Button>
          </div>

          <div className="rounded-xl border border-[color:var(--card-border)] bg-[color:var(--card-bg)] p-3.5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <strong className="text-xs text-[color:var(--page-fg)]">🏦 Contas & Saldos</strong>
                <Badge tone="brand">{totalContas} contas</Badge>
              </div>
              <p className="mt-1 text-2xs text-[color:var(--muted-fg)]">
                Lista de bancos, instituições financeiras, tipos de conta e saldos iniciais.
              </p>
            </div>
            <Button
              variant="secondary"
              onClick={handleDownloadAccountsCsv}
              className="mt-3 text-xs w-full"
            >
              📥 Baixar Contas (.csv)
            </Button>
          </div>

          <div className="rounded-xl border border-[color:var(--card-border)] bg-[color:var(--card-bg)] p-3.5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <strong className="text-xs text-[color:var(--page-fg)]">🏛️ Dívidas & Financiamentos</strong>
                <Badge tone="attention">{totalDividas} contratos</Badge>
              </div>
              <p className="mt-1 text-2xs text-[color:var(--muted-fg)]">
                Credores, valor contratado, valor das parcelas, parcelas pagas e taxas.
              </p>
            </div>
            <Button
              variant="secondary"
              onClick={handleDownloadDebtsCsv}
              className="mt-3 text-xs w-full"
            >
              📥 Baixar Dívidas (.csv)
            </Button>
          </div>

          <div className="rounded-xl border border-[color:var(--card-border)] bg-[color:var(--card-bg)] p-3.5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <strong className="text-xs text-[color:var(--page-fg)]">💳 Cartões de Crédito</strong>
                <Badge tone="brand">{totalCartoes} cartões</Badge>
              </div>
              <p className="mt-1 text-2xs text-[color:var(--muted-fg)]">
                Limites, bandeiras, dias de fechamento da fatura e vencimentos.
              </p>
            </div>
            <Button
              variant="secondary"
              onClick={handleDownloadCardsCsv}
              className="mt-3 text-xs w-full"
            >
              📥 Baixar Cartões (.csv)
            </Button>
          </div>

          <div className="rounded-xl border border-[color:var(--card-border)] bg-[color:var(--card-bg)] p-3.5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <strong className="text-xs text-[color:var(--page-fg)]">🔁 Contas Recorrentes</strong>
                <Badge tone="neutral">{totalRecorrentes} regras</Badge>
              </div>
              <p className="mt-1 text-2xs text-[color:var(--muted-fg)]">
                Aluguel, água, energia, assinaturas e gastos fixos cadastrados.
              </p>
            </div>
            <Button
              variant="secondary"
              onClick={handleDownloadRecurringCsv}
              className="mt-3 text-xs w-full"
            >
              📥 Baixar Recorrentes (.csv)
            </Button>
          </div>

          <div className="rounded-xl border border-[color:var(--card-border)] bg-[color:var(--card-bg)] p-3.5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <strong className="text-xs text-[color:var(--page-fg)]">🎯 Metas & Reservas</strong>
                <Badge tone="brand">{finance.reserves.length + finance.goals.length} itens</Badge>
              </div>
              <p className="mt-1 text-2xs text-[color:var(--muted-fg)]">
                Reservas de emergência, objetivos financeiros e progresso acumulado.
              </p>
            </div>
            <Button
              variant="secondary"
              onClick={handleDownloadReservesCsv}
              className="mt-3 text-xs w-full"
            >
              📥 Baixar Metas (.csv)
            </Button>
          </div>
        </div>
      </Card>

      {/* SEÇÃO 2: BACKUP GERAL TÉCNICO EM ARQUIVO ÚNICO (JSON - LGPD) */}
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-lg">💾</span>
              <CardTitle hint="Arquivo bruto padronizado contendo 100% de tudo no aplicativo">
                Backup Geral em Arquivo Único (JSON - Portabilidade LGPD)
              </CardTitle>
            </div>
            <p className="text-xs text-[color:var(--muted-fg)] max-w-xl leading-relaxed">
              Exporta um único arquivo de texto estruturado com todas as coleções, perfil familiar,
              permissões e histórico. Ideal para arquivar em nuvem como cópia de segurança permanente
              ou realizar auditorias de dados.
            </p>
          </div>

          <Button
            onClick={() => void handleDownloadJson()}
            disabled={exportingJson}
            className="text-xs"
          >
            {exportingJson ? "Gerando arquivo JSON..." : "💾 Baixar Backup Geral (.json)"}
          </Button>
        </div>
      </Card>

      {/* SEÇÃO 3: FOLHA DE RESUMO PARA IMPRESSÃO LOCAL / PDF */}
      <div className="rounded-2xl border border-[color:var(--card-border)] bg-white p-6 text-neutral-900 shadow-sm print:border-none print:p-0 print:shadow-none">
        <div className="border-b border-neutral-200 pb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-neutral-900 uppercase tracking-wide">
              Resumo Cadastral e Financeiro Local
            </h3>
            <p className="text-2xs text-neutral-500">
              Emitido em {new Date().toLocaleDateString("pt-BR")} | Conta Comigo
            </p>
          </div>
          <span className="text-2xs font-semibold text-neutral-600">
            {profile?.displayName ?? household?.name ?? "Usuário"}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-neutral-700">
          <div>
            <p className="font-semibold text-neutral-900">Dados do Titular:</p>
            <p className="mt-0.5">Nome: {profile?.displayName || "Não informado"}</p>
            <p>E-mail: {profile?.email || user?.email || "Não informado"}</p>
            <p>CPF: {profile?.cpf || "Não informado"}</p>
            <p>Profissão: {profile?.occupation || "Não informada"}</p>
          </div>

          <div>
            <p className="font-semibold text-neutral-900">Situação Geral Atual:</p>
            <p className="mt-0.5">Disponível em Caixa/Contas: {formatMoney(finance.totalCash)}</p>
            <p>Reserva Protegida: {formatMoney(finance.protectedReserve)}</p>
            <p>
              Total de Dívidas Contratadas:{" "}
              {formatMoney(
                finance.debts.reduce(
                  (acc, d) => ({
                    amount: acc.amount + d.principalContracted.amount,
                    currency: acc.currency,
                  }),
                  { amount: 0, currency: "BRL" as const },
                ),
              )}
            </p>
          </div>
        </div>

        <div className="mt-4 border-t border-neutral-200 pt-3 flex items-center justify-between text-2xs text-neutral-500">
          <span>Esta página pode ser salva em PDF ou impressa pelo botão do topo.</span>
          <Link href="/app/meus-dados" className="text-teal-700 underline print:hidden">
            Gerenciar meus dados cadastrais &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}

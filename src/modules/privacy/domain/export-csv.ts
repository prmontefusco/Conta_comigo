import { Money } from "@/core/money/money";
import type { Account } from "@/modules/accounts/domain/account";
import type { Category } from "@/modules/categories/domain/category";
import type { CreditCard } from "@/modules/cards/domain/credit-card";
import type { Debt } from "@/modules/debts/domain/debt";
import type { RecurringRule } from "@/modules/recurring/domain/recurring-rule";
import type { Goal, Reserve } from "@/modules/reserves/domain/reserve";
import type { Transaction } from "@/modules/transactions/domain/transaction";

/**
 * Utilitários de exportação em CSV para backup local e abertura facilitada em planilhas (Excel / LibreOffice / Google Sheets).
 *
 * Utiliza separador ponto-e-vírgula (";") e o marcador UTF-8 BOM (\uFEFF)
 * para garantir que o Microsoft Excel em computadores Windows/Mac abra
 * o arquivo diretamente com colunas separadas e acentos corretos.
 */

export const UTF8_BOM = "\uFEFF";

export function formatMoneyCsv(m: Money): string {
  const num = m.amount / 100;
  return num.toFixed(2).replace(".", ",");
}

export function escapeCsv(val: unknown): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(";") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildTransactionsCsv(
  transactions: readonly Transaction[],
  categories: readonly Category[] = [],
  accounts: readonly Account[] = [],
): string {
  const catMap = new Map(categories.map((c) => [c.id, c.name]));
  const accMap = new Map(accounts.map((a) => [a.id, a.name]));

  const headers = [
    "Data de Competência",
    "Tipo de Lançamento",
    "Descrição",
    "Categoria",
    "Conta Bancária",
    "Valor (R$)",
    "Moeda",
    "Observações",
  ];

  const rows = transactions.map((t) => {
    const tipo =
      t.kind === "EXPENSE"
        ? "Despesa"
        : t.kind === "INCOME"
          ? "Receita"
          : t.kind === "TRANSFER"
            ? "Transferência entre contas"
            : t.kind === "CARD_STATEMENT_PAYMENT"
              ? "Pagamento de Fatura de Cartão"
              : t.kind === "DEBT_PAYMENT"
                ? "Pagamento de Empréstimo / Dívida"
                : t.kind === "LOAN_DISBURSEMENT"
                  ? "Entrada de Empréstimo"
                  : t.kind === "RESERVE_ALLOCATION"
                    ? "Aporte em Reserva"
                    : t.kind === "RESERVE_RELEASE"
                      ? "Resgate de Reserva"
                      : "Ajuste de Saldo";

    const catId = "categoryId" in t && typeof t.categoryId === "string" ? t.categoryId : undefined;
    const cat = catId ? catMap.get(catId) ?? "Sem categoria" : "Não aplicável";

    let accNome = "Não informada";
    if ("accountId" in t && typeof t.accountId === "string") {
      accNome = accMap.get(t.accountId) ?? "Conta";
    } else if ("fromAccountId" in t && typeof t.fromAccountId === "string") {
      accNome = accMap.get(t.fromAccountId) ?? "Conta de Origem";
    }

    const valor = formatMoneyCsv(t.amount);
    const obs = t.notes ?? "";

    return [
      escapeCsv(t.competenceDate),
      escapeCsv(tipo),
      escapeCsv(t.description),
      escapeCsv(cat),
      escapeCsv(accNome),
      escapeCsv(valor),
      escapeCsv(t.amount.currency),
      escapeCsv(obs),
    ].join(";");
  });

  return UTF8_BOM + [headers.join(";"), ...rows].join("\r\n");
}

export function buildAccountsCsv(accounts: readonly Account[]): string {
  const headers = [
    "Nome da Conta",
    "Instituição / Banco",
    "Tipo de Conta",
    "Saldo de Abertura (R$)",
    "Moeda",
  ];

  const rows = accounts.map((a) => {
    const tipo =
      a.type === "CHECKING"
        ? "Conta Corrente"
        : a.type === "SAVINGS"
          ? "Poupança"
          : a.type === "INVESTMENT"
            ? "Investimento"
            : "Carteira / Dinheiro";

    return [
      escapeCsv(a.name),
      escapeCsv(a.institution || "Não informado"),
      escapeCsv(tipo),
      escapeCsv(formatMoneyCsv(a.openingBalance)),
      escapeCsv(a.openingBalance.currency),
    ].join(";");
  });

  return UTF8_BOM + [headers.join(";"), ...rows].join("\r\n");
}

export function buildDebtsCsv(
  debts: readonly Debt[],
  paidInstallmentsMap?: ReadonlyMap<string, readonly number[]>,
): string {
  const headers = [
    "Descrição / Contrato",
    "Instituição Financeira",
    "Tipo de Dívida",
    "Saldo Contratado (R$)",
    "Valor da Parcela (R$)",
    "Total de Parcelas",
    "Parcelas Pagas",
    "Primeiro Vencimento",
    "Taxa Mensal (%)",
  ];

  const rows = debts.map((d) => {
    const tipo =
      d.kind === "PERSONAL_LOAN"
        ? "Empréstimo Pessoal"
        : d.kind === "PAYROLL_LOAN"
          ? "Empréstimo Consignado"
          : d.kind === "VEHICLE_FINANCING"
            ? "Financiamento de Veículo"
            : d.kind === "REAL_ESTATE_FINANCING"
              ? "Financiamento Imobiliário"
              : d.kind === "OVERDRAFT"
                ? "Cheque Especial"
                : d.kind === "CARD_RENEGOTIATION"
                  ? "Renegociação de Cartão"
                  : "Outra Dívida";

    const pagas = paidInstallmentsMap?.get(d.id)?.length ?? 0;
    const taxa = d.interestRateMonthly ? `${d.interestRateMonthly}%` : "Não informada";
    const parcela = d.installmentAmount ? formatMoneyCsv(d.installmentAmount) : "Variável / SAC";

    return [
      escapeCsv(d.description),
      escapeCsv(d.institution || "Não informado"),
      escapeCsv(tipo),
      escapeCsv(formatMoneyCsv(d.principalContracted)),
      escapeCsv(parcela),
      escapeCsv(d.installmentCount),
      escapeCsv(pagas),
      escapeCsv(d.firstDueDate),
      escapeCsv(taxa),
    ].join(";");
  });

  return UTF8_BOM + [headers.join(";"), ...rows].join("\r\n");
}

export function buildCardsCsv(cards: readonly CreditCard[]): string {
  const headers = [
    "Nome do Cartão",
    "Bandeira",
    "Limite Total (R$)",
    "Dia do Fechamento",
    "Dia do Vencimento",
  ];

  const rows = cards.map((c) => {
    return [
      escapeCsv(c.name),
      escapeCsv(c.brand || "Outra"),
      escapeCsv(formatMoneyCsv(c.creditLimit)),
      escapeCsv(c.closingDay),
      escapeCsv(c.dueDay),
    ].join(";");
  });

  return UTF8_BOM + [headers.join(";"), ...rows].join("\r\n");
}

export function buildRecurringCsv(
  rules: readonly RecurringRule[],
  categories: readonly Category[] = [],
): string {
  const catMap = new Map(categories.map((c) => [c.id, c.name]));

  const headers = [
    "Descrição",
    "Tipo de Fluxo",
    "Categoria",
    "Valor Previsto (R$)",
    "Frequência",
    "Dia do Vencimento",
    "Ativo",
  ];

  const rows = rules.map((r) => {
    const tipo = r.direction === "OUTFLOW" ? "Despesa Fixa" : "Receita Fixa";
    const cat = r.categoryId ? catMap.get(r.categoryId) ?? "Sem categoria" : "Sem categoria";
    const freq =
      r.frequency === "MONTHLY"
        ? "Mensal"
        : r.frequency === "ANNUAL"
          ? "Anual"
          : r.frequency === "WEEKLY"
            ? "Semanal"
            : r.frequency;
    const dia = r.dayOfMonth ? String(r.dayOfMonth) : "Variável";
    const ativo = r.active ? "Sim" : "Não / Pausado";

    return [
      escapeCsv(r.description),
      escapeCsv(tipo),
      escapeCsv(cat),
      escapeCsv(formatMoneyCsv(r.amount)),
      escapeCsv(freq),
      escapeCsv(dia),
      escapeCsv(ativo),
    ].join(";");
  });

  return UTF8_BOM + [headers.join(";"), ...rows].join("\r\n");
}

export function buildReservesCsv(
  reserves: readonly Reserve[],
  goals: readonly Goal[] = [],
): string {
  const headers = [
    "Tipo de Item",
    "Nome / Finalidade",
    "Valor Atual Guardado (R$)",
    "Meta Estipulada (R$)",
    "Status",
  ];

  const rowsReserves = reserves.map((r) => [
    escapeCsv("Reserva Financeira"),
    escapeCsv(r.name),
    escapeCsv(formatMoneyCsv(r.currentAmount)),
    escapeCsv(r.targetAmount ? formatMoneyCsv(r.targetAmount) : "Sem meta fixa"),
    escapeCsv(r.archived ? "Arquivada" : "Ativa"),
  ].join(";"));

  const rowsGoals = goals.map((g) => [
    escapeCsv("Meta Financeira"),
    escapeCsv(g.name),
    escapeCsv("Aporte vinculado"),
    escapeCsv(formatMoneyCsv(g.targetAmount)),
    escapeCsv(
      g.status === "ACHIEVED"
        ? "Concluída"
        : g.status === "ACTIVE"
          ? "Em andamento"
          : g.status === "PAUSED"
            ? "Pausada"
            : "Cancelada",
    ),
  ].join(";"));

  return UTF8_BOM + [headers.join(";"), ...rowsReserves, ...rowsGoals].join("\r\n");
}

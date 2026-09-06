import { differenceInDays, type CalendarDate } from "@/core/date/calendar-date";
import type { Money } from "@/core/money/money";
import type { Account } from "@/modules/accounts/domain/account";
import type { Category } from "@/modules/categories/domain/category";
import type { CategoryId } from "@/modules/shared/domain/common";
import type { ExpenseTransaction, Transaction } from "@/modules/transactions/domain/transaction";

/**
 * Lançar um gasto em poucos segundos.
 *
 * O formulário completo pede nove campos: descrição, valor, data, parcelas,
 * de onde saiu, categoria, se repete, de quem é e visibilidade. Cada um existe
 * por um motivo, e juntos eles são a razão pela qual um cadastro envelhece em
 * duas semanas — e todas as projeções do aplicativo envelhecem junto.
 *
 * O cálculo que importa aqui não é financeiro: **registrar precisa custar
 * menos do que não registrar**. Um pão de R$ 12 não justifica nove campos, e
 * quem desiste de lançar não deixa de gastar — deixa só de enxergar.
 *
 * Este módulo escolhe os padrões para que sobrem dois toques: o valor e a
 * categoria. Tudo o mais é deduzido do que a própria pessoa vem fazendo, e
 * fica visível e editável no formulário completo, que continua ali.
 */

/** Quantos dias de histórico contam para dizer o que é "usado com frequência". */
export const RECENCY_WINDOW_DAYS = 60;

/** Quantas categorias cabem numa fileira de atalhos sem virar um menu. */
export const QUICK_CATEGORY_COUNT = 6;

export interface CategorySuggestion {
  readonly category: Category;
  /** Quantos lançamentos recentes usaram esta categoria. */
  readonly uses: number;
}

export interface SuggestQuickCategoriesInput {
  readonly categories: readonly Category[];
  readonly transactions: readonly Transaction[];
  readonly asOf: CalendarDate;
  readonly limit?: number;
}

/**
 * As categorias que esta casa realmente usa, mais usada primeiro.
 *
 * Frequência, não valor. Quem paga um aluguel por mês e faz vinte compras de
 * mercado precisa do atalho de mercado — o aluguel tem outro caminho, e uma
 * lista ordenada por dinheiro colocaria a maior despesa onde deveria estar a
 * mais repetida.
 *
 * Uma casa nova não tem histórico. Em vez de mostrar uma fileira vazia, cai
 * para a ordem de exibição das categorias padrão, que já vêm ordenadas pelo
 * que é mais comum numa casa brasileira.
 */
export function suggestQuickCategories(
  input: SuggestQuickCategoriesInput,
): readonly CategorySuggestion[] {
  const limit = input.limit ?? QUICK_CATEGORY_COUNT;
  const usable = input.categories.filter(
    (category) => !category.archived && category.kind !== "INCOME",
  );

  const uses = new Map<CategoryId, number>();
  for (const transaction of input.transactions) {
    if (transaction.kind !== "EXPENSE" || !transaction.categoryId) continue;
    const age = differenceInDays(transaction.transactionDate, input.asOf);
    if (age < 0 || age > RECENCY_WINDOW_DAYS) continue;
    uses.set(transaction.categoryId, (uses.get(transaction.categoryId) ?? 0) + 1);
  }

  return [...usable]
    .map((category) => ({ category, uses: uses.get(category.id) ?? 0 }))
    .sort((a, b) => {
      if (b.uses !== a.uses) return b.uses - a.uses;
      return a.category.sortOrder - b.category.sortOrder;
    })
    .slice(0, limit);
}

export interface SuggestQuickAccountInput {
  readonly accounts: readonly Account[];
  readonly transactions: readonly Transaction[];
  readonly asOf: CalendarDate;
}

/**
 * De onde o dinheiro provavelmente saiu.
 *
 * A conta usada por último, entre as que continuam ativas. É o palpite certo
 * quase sempre, e errar aqui é barato: o valor aparece na tela e a edição é
 * um toque. Errar a categoria seria pior, e por isso ela não é adivinhada.
 */
export function suggestQuickAccount(input: SuggestQuickAccountInput): Account | null {
  const open = input.accounts.filter((account) => !account.archived);
  if (open.length === 0) return null;
  if (open.length === 1) return open[0]!;

  const byId = new Map(open.map((account) => [account.id, account]));

  const recent = input.transactions
    .filter(
      (transaction): transaction is ExpenseTransaction =>
        transaction.kind === "EXPENSE" && byId.has(transaction.accountId),
    )
    .sort((a, b) => (a.transactionDate < b.transactionDate ? 1 : -1))[0];

  if (recent) return byId.get(recent.accountId) ?? null;

  // Sem histórico: a conta corrente, que é de onde sai o gasto do dia a dia.
  return open.find((account) => account.type === "CHECKING") ?? open[0]!;
}

export interface QuickEntryDraft {
  readonly amount: Money;
  readonly categoryId: CategoryId;
  readonly accountId: string;
  readonly date: CalendarDate;
  readonly description: string;
}

export type QuickEntryProblem = "NO_AMOUNT" | "NO_CATEGORY" | "NO_ACCOUNT";

export const PROBLEM_MESSAGES: Record<QuickEntryProblem, string> = {
  NO_AMOUNT: "Digite quanto foi.",
  NO_CATEGORY: "Toque numa categoria.",
  NO_ACCOUNT: "Cadastre uma conta antes de lançar um gasto.",
};

export interface BuildQuickEntryInput {
  readonly amount: Money | null;
  readonly category: Category | null;
  readonly account: Account | null;
  readonly asOf: CalendarDate;
  /** Opcional: quando vazio, o nome da categoria vira a descrição. */
  readonly description?: string;
}

/**
 * Monta o lançamento, ou diz o que falta.
 *
 * A descrição em branco vira o nome da categoria em vez de bloquear o
 * lançamento. "Alimentação" num extrato é pouco, e é infinitamente mais do
 * que a compra que não foi registrada porque exigia um nome.
 */
export function buildQuickEntry(
  input: BuildQuickEntryInput,
): { readonly draft: QuickEntryDraft } | { readonly problem: QuickEntryProblem } {
  if (!input.amount || input.amount.amount <= 0) return { problem: "NO_AMOUNT" };
  if (!input.category) return { problem: "NO_CATEGORY" };
  if (!input.account) return { problem: "NO_ACCOUNT" };

  const typed = input.description?.trim() ?? "";

  return {
    draft: {
      amount: input.amount,
      categoryId: input.category.id,
      accountId: input.account.id,
      date: input.asOf,
      description: typed.length >= 2 ? typed : input.category.name,
    },
  };
}

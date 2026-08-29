import type {
  AuditFields,
  CategoryId,
  ExpenseNature,
  HouseholdId,
} from "@/modules/shared/domain/common";

/**
 * Categories.
 *
 * The seed list below is a starting point, not a cage: people categorise their
 * lives in ways no product can anticipate, and being forced into someone
 * else's taxonomy is a good reason to stop using an app.
 */

export type CategoryKind = "EXPENSE" | "INCOME";

export interface Category extends AuditFields {
  readonly id: CategoryId;
  readonly householdId: HouseholdId;
  readonly name: string;
  readonly kind: CategoryKind;
  readonly parentId?: CategoryId;
  readonly icon?: string;
  readonly color?: string;
  readonly defaultExpenseNature?: ExpenseNature;
  /** Seeded categories. Can be renamed or hidden, never silently required. */
  readonly isSystem: boolean;
  readonly archived: boolean;
  readonly sortOrder: number;
}

export interface CategorySeed {
  readonly slug: string;
  readonly name: string;
  readonly kind: CategoryKind;
  readonly icon: string;
  readonly defaultExpenseNature: ExpenseNature;
  readonly group: "HOUSEHOLD" | "PERSONAL" | "DEBT" | "INCOME";
}

/**
 * Default categories for a new household, in pt-BR.
 *
 * Chosen to cover the bills a Brazilian household actually receives, so the
 * first week of use needs almost no category creation.
 */
export const DEFAULT_CATEGORIES: readonly CategorySeed[] = [
  // Casa
  {
    slug: "moradia",
    name: "Moradia",
    kind: "EXPENSE",
    icon: "🏠",
    defaultExpenseNature: "FIXED",
    group: "HOUSEHOLD",
  },
  {
    slug: "energia",
    name: "Energia elétrica",
    kind: "EXPENSE",
    icon: "💡",
    defaultExpenseNature: "VARIABLE",
    group: "HOUSEHOLD",
  },
  {
    slug: "agua",
    name: "Água",
    kind: "EXPENSE",
    icon: "💧",
    defaultExpenseNature: "VARIABLE",
    group: "HOUSEHOLD",
  },
  {
    slug: "gas",
    name: "Gás",
    kind: "EXPENSE",
    icon: "🔥",
    defaultExpenseNature: "VARIABLE",
    group: "HOUSEHOLD",
  },
  {
    slug: "internet",
    name: "Internet e telefone",
    kind: "EXPENSE",
    icon: "📶",
    defaultExpenseNature: "FIXED",
    group: "HOUSEHOLD",
  },
  {
    slug: "condominio",
    name: "Condomínio",
    kind: "EXPENSE",
    icon: "🏢",
    defaultExpenseNature: "FIXED",
    group: "HOUSEHOLD",
  },
  {
    slug: "alimentacao",
    name: "Alimentação",
    kind: "EXPENSE",
    icon: "🛒",
    defaultExpenseNature: "VARIABLE",
    group: "HOUSEHOLD",
  },
  {
    slug: "transporte",
    name: "Transporte",
    kind: "EXPENSE",
    icon: "🚌",
    defaultExpenseNature: "VARIABLE",
    group: "HOUSEHOLD",
  },
  {
    slug: "veiculo",
    name: "Veículo",
    kind: "EXPENSE",
    icon: "🚗",
    defaultExpenseNature: "VARIABLE",
    group: "HOUSEHOLD",
  },
  {
    slug: "saude",
    name: "Saúde",
    kind: "EXPENSE",
    icon: "💊",
    defaultExpenseNature: "VARIABLE",
    group: "HOUSEHOLD",
  },
  {
    slug: "educacao",
    name: "Educação",
    kind: "EXPENSE",
    icon: "🎓",
    defaultExpenseNature: "FIXED",
    group: "HOUSEHOLD",
  },
  {
    slug: "seguros",
    name: "Seguros",
    kind: "EXPENSE",
    icon: "🛡️",
    defaultExpenseNature: "FIXED",
    group: "HOUSEHOLD",
  },
  {
    slug: "impostos",
    name: "Impostos e taxas",
    kind: "EXPENSE",
    icon: "🧾",
    defaultExpenseNature: "OCCASIONAL",
    group: "HOUSEHOLD",
  },

  // Pessoais
  {
    slug: "lazer",
    name: "Lazer",
    kind: "EXPENSE",
    icon: "🎬",
    defaultExpenseNature: "VARIABLE",
    group: "PERSONAL",
  },
  {
    slug: "restaurantes",
    name: "Restaurantes",
    kind: "EXPENSE",
    icon: "🍽️",
    defaultExpenseNature: "VARIABLE",
    group: "PERSONAL",
  },
  {
    slug: "vestuario",
    name: "Vestuário",
    kind: "EXPENSE",
    icon: "👕",
    defaultExpenseNature: "OCCASIONAL",
    group: "PERSONAL",
  },
  {
    slug: "assinaturas",
    name: "Assinaturas",
    kind: "EXPENSE",
    icon: "📺",
    defaultExpenseNature: "FIXED",
    group: "PERSONAL",
  },
  {
    slug: "cuidados",
    name: "Cuidados pessoais",
    kind: "EXPENSE",
    icon: "💇",
    defaultExpenseNature: "VARIABLE",
    group: "PERSONAL",
  },
  {
    slug: "presentes",
    name: "Presentes",
    kind: "EXPENSE",
    icon: "🎁",
    defaultExpenseNature: "OCCASIONAL",
    group: "PERSONAL",
  },
  {
    slug: "viagens",
    name: "Viagens",
    kind: "EXPENSE",
    icon: "✈️",
    defaultExpenseNature: "OCCASIONAL",
    group: "PERSONAL",
  },
  {
    slug: "outros-gastos",
    name: "Outros gastos",
    kind: "EXPENSE",
    icon: "📦",
    defaultExpenseNature: "VARIABLE",
    group: "PERSONAL",
  },

  // Custo de dívida
  {
    slug: "juros",
    name: "Juros e encargos",
    kind: "EXPENSE",
    icon: "📉",
    defaultExpenseNature: "FIXED",
    group: "DEBT",
  },
  {
    slug: "tarifas",
    name: "Tarifas bancárias",
    kind: "EXPENSE",
    icon: "🏦",
    defaultExpenseNature: "FIXED",
    group: "DEBT",
  },

  // Receitas
  {
    slug: "salario",
    name: "Salário",
    kind: "INCOME",
    icon: "💼",
    defaultExpenseNature: "FIXED",
    group: "INCOME",
  },
  {
    slug: "beneficio",
    name: "Benefício",
    kind: "INCOME",
    icon: "🎫",
    defaultExpenseNature: "FIXED",
    group: "INCOME",
  },
  {
    slug: "comissao",
    name: "Comissão",
    kind: "INCOME",
    icon: "📈",
    defaultExpenseNature: "VARIABLE",
    group: "INCOME",
  },
  {
    slug: "aluguel-recebido",
    name: "Aluguel recebido",
    kind: "INCOME",
    icon: "🔑",
    defaultExpenseNature: "FIXED",
    group: "INCOME",
  },
  {
    slug: "servicos",
    name: "Serviços prestados",
    kind: "INCOME",
    icon: "🧰",
    defaultExpenseNature: "VARIABLE",
    group: "INCOME",
  },
  {
    slug: "renda-extra",
    name: "Renda extra",
    kind: "INCOME",
    icon: "✨",
    defaultExpenseNature: "OCCASIONAL",
    group: "INCOME",
  },
  {
    slug: "outras-receitas",
    name: "Outras receitas",
    kind: "INCOME",
    icon: "➕",
    defaultExpenseNature: "OCCASIONAL",
    group: "INCOME",
  },
] as const;

export function categoriesByKind(categories: readonly Category[], kind: CategoryKind): Category[] {
  return categories
    .filter((category) => category.kind === kind && !category.archived)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "pt-BR"));
}

export function buildCategoryIndex(
  categories: readonly Category[],
): ReadonlyMap<CategoryId, Category> {
  return new Map(categories.map((category) => [category.id, category]));
}

/** Falls back to a neutral label rather than showing a raw id. */
export function categoryName(
  index: ReadonlyMap<CategoryId, Category>,
  categoryId: CategoryId | undefined,
): string {
  if (!categoryId) return "Sem categoria";
  return index.get(categoryId)?.name ?? "Categoria removida";
}

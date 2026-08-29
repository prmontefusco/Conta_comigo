import {
  addDays,
  addMonths,
  calendarDate,
  monthKeyOf,
  startOfMonth,
  todayIn,
  type CalendarDate,
} from "@/core/date/calendar-date";
import { fromDecimal } from "@/core/money/money";
import { DEFAULT_CATEGORIES } from "@/modules/categories/domain/category";
import { occurrencesBetween, type RecurringRule } from "@/modules/recurring/domain/recurring-rule";

/**
 * Development fixtures.
 *
 * Three households that exercise genuinely different financial shapes, so the
 * forecast engine and the dashboard can be judged against situations that
 * actually occur - not against one tidy happy path (docs/LOCAL_DEVELOPMENT.md).
 */

const TIMEZONE = "America/Sao_Paulo";
const brl = (value: number) => fromDecimal(value);

/** Dates are relative to "today" so the seed never goes stale. */
export function seedAnchors(now: Date = new Date()) {
  const today = todayIn(TIMEZONE, now);
  const thisMonth = monthKeyOf(today);
  return {
    today,
    thisMonth,
    monthStart: startOfMonth(today),
    lastYear: addMonths(today, -12),
    sixMonthsAgo: addMonths(today, -6),
    threeMonthsAgo: addMonths(today, -3),
    lastMonth: addMonths(today, -1),
    nextMonth: addMonths(today, 1),
    inTwoMonths: addMonths(today, 2),
    inThreeMonths: addMonths(today, 3),
  };
}

export type Anchors = ReturnType<typeof seedAnchors>;

export interface SeedUser {
  readonly uid: string;
  readonly email: string;
  readonly password: string;
  readonly displayName: string;
  readonly role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";
}

export interface SeedHousehold {
  readonly id: string;
  readonly name: string;
  readonly summary: string;
  readonly users: readonly SeedUser[];
  /** Months of realised movement to generate, so the reports have a series. */
  readonly monthsOfHistory: number;
  /** Account the generated history moves through. */
  readonly historyAccountId: string;
  build(anchors: Anchors): SeedContent;
}

/**
 * Turns a household's recurring rules into transactions that already happened.
 *
 * Without a few months of realised movement the reports have nothing to
 * compare, and a page of charts showing zeros is worse than no page at all.
 * Variable bills wobble by a deterministic amount so the trend lines look like
 * a real household rather than a ruler - deterministic because a seed that
 * produces different numbers on every run makes failures impossible to read.
 */
export function realisedHistory(
  householdId: string,
  content: SeedContent,
  anchors: Anchors,
  monthsBack: number,
  accountId: string,
  createdBy: string,
): Record<string, unknown>[] {
  const transactions: Record<string, unknown>[] = [];
  const from = addMonths(anchors.monthStart, -monthsBack);
  // Stop before the current month: it is still in progress.
  const to = addDays(anchors.monthStart, -1);

  for (const raw of content.recurringRules) {
    const rule = raw as unknown as RecurringRule;
    if (!rule.active) continue;

    for (const occurrence of occurrencesBetween(rule, from, to)) {
      const isIncome = rule.direction === "INFLOW";
      // A stable wobble: same rule, same month, same number, every run.
      const wobble =
        rule.expenseNature === "VARIABLE" || rule.confidence === "ESTIMATED"
          ? 1 + (hashOf(`${rule.id}:${occurrence.dueDate}`) % 31) / 100 - 0.15
          : 1;

      transactions.push({
        id: `${householdId}-tx-${rule.id}-${occurrence.dueDate}`,
        householdId,
        kind: isIncome ? "INCOME" : "EXPENSE",
        amount: {
          amount: Math.round(occurrence.amount.amount * wobble),
          currency: "BRL",
        },
        transactionDate: occurrence.dueDate,
        competenceDate: occurrence.competenceDate,
        description: rule.description,
        visibility: rule.visibility,
        accountId,
        ...(isIncome
          ? {}
          : { categoryId: rule.categoryId ?? categoryId(householdId, "outros-gastos") }),
        ...(rule.responsibleMemberId ? { responsibleMemberId: rule.responsibleMemberId } : {}),
        createdBy,
      });
    }
  }

  return transactions;
}

/** Small, stable hash. Only used to make the seed's variation reproducible. */
function hashOf(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 100_000;
  }
  return hash;
}

export interface SeedContent {
  readonly accounts: readonly Record<string, unknown>[];
  readonly creditCards: readonly Record<string, unknown>[];
  readonly cardPurchases: readonly Record<string, unknown>[];
  readonly recurringRules: readonly Record<string, unknown>[];
  readonly obligations: readonly Record<string, unknown>[];
  readonly transactions: readonly Record<string, unknown>[];
  readonly debts: readonly Record<string, unknown>[];
  readonly reserves: readonly Record<string, unknown>[];
  readonly goals: readonly Record<string, unknown>[];
  readonly budgets: readonly Record<string, unknown>[];
}

const emptyContent: SeedContent = {
  accounts: [],
  creditCards: [],
  cardPurchases: [],
  recurringRules: [],
  obligations: [],
  transactions: [],
  debts: [],
  reserves: [],
  goals: [],
  budgets: [],
};

/** Category ids are deterministic so the fixtures can reference them. */
export const categoryId = (householdId: string, slug: string) => `${householdId}-cat-${slug}`;

export function categoriesFor(householdId: string) {
  return DEFAULT_CATEGORIES.map((seed, index) => ({
    id: categoryId(householdId, seed.slug),
    householdId,
    name: seed.name,
    kind: seed.kind,
    icon: seed.icon,
    defaultExpenseNature: seed.defaultExpenseNature,
    isSystem: true,
    archived: false,
    sortOrder: index,
  }));
}

function monthlyRule(
  householdId: string,
  id: string,
  description: string,
  amount: number,
  dayOfMonth: number,
  slug: string,
  extra: Record<string, unknown> = {},
) {
  return {
    id,
    householdId,
    direction: "OUTFLOW",
    description,
    amount: brl(amount),
    frequency: "MONTHLY",
    interval: 1,
    dayOfMonth,
    weekendPolicy: "KEEP",
    categoryId: categoryId(householdId, slug),
    expenseNature: "FIXED",
    confidence: "CONFIRMED",
    visibility: "HOUSEHOLD",
    active: true,
    ...extra,
  };
}

function salaryRule(
  householdId: string,
  id: string,
  description: string,
  amount: number,
  dayOfMonth: number,
  startDate: CalendarDate,
  memberId?: string,
) {
  return {
    id,
    householdId,
    direction: "INFLOW",
    description,
    amount: brl(amount),
    frequency: "MONTHLY",
    interval: 1,
    dayOfMonth,
    startDate,
    weekendPolicy: "KEEP",
    categoryId: categoryId(householdId, "salario"),
    expenseNature: "FIXED",
    confidence: "CONFIRMED",
    visibility: "HOUSEHOLD",
    active: true,
    ...(memberId ? { responsibleMemberId: memberId } : {}),
  };
}

/* ------------------------------------------------------------------ */
/* Scenario A - an organised household                                 */
/* ------------------------------------------------------------------ */

const scenarioA: SeedHousehold = {
  id: "seed-familia-organizada",
  name: "Família Silva",
  summary:
    "Receitas confortavelmente acima dos compromissos, reserva de emergência formada, cartão usado sem parcelamentos longos.",
  users: [
    {
      uid: "seed-uid-ana",
      email: "ana@exemplo.test",
      password: "conta1234",
      displayName: "Ana Silva",
      role: "OWNER",
    },
    {
      uid: "seed-uid-bruno",
      email: "bruno@exemplo.test",
      password: "conta1234",
      displayName: "Bruno Silva",
      role: "ADMIN",
    },
  ],
  monthsOfHistory: 6,
  historyAccountId: "seed-familia-organizada-conta-corrente",
  build(anchors) {
    const h = this.id;
    return {
      ...emptyContent,
      accounts: [
        {
          id: `${h}-conta-corrente`,
          householdId: h,
          name: "Conta corrente conjunta",
          type: "CHECKING",
          institution: "Banco do Brasil",
          openingBalance: brl(8400),
          openingBalanceDate: anchors.monthStart,
          visibility: "HOUSEHOLD",
          includeInTotals: true,
          archived: false,
        },
        {
          id: `${h}-poupanca`,
          householdId: h,
          name: "Poupança",
          type: "SAVINGS",
          openingBalance: brl(22000),
          openingBalanceDate: anchors.monthStart,
          visibility: "HOUSEHOLD",
          includeInTotals: true,
          archived: false,
        },
      ],
      creditCards: [
        {
          id: `${h}-cartao`,
          householdId: h,
          name: "Cartão família",
          issuer: "Nubank",
          creditLimit: brl(12000),
          closingDay: 25,
          dueDay: 5,
          visibility: "HOUSEHOLD",
          archived: false,
        },
      ],
      cardPurchases: [
        {
          id: `${h}-compra-mercado`,
          householdId: h,
          creditCardId: `${h}-cartao`,
          description: "Supermercado do mês",
          totalAmount: brl(1180),
          purchaseDate: anchors.today,
          competenceDate: anchors.today,
          categoryId: categoryId(h, "alimentacao"),
          installmentCount: 1,
          visibility: "HOUSEHOLD",
        },
        {
          id: `${h}-compra-notebook`,
          householdId: h,
          creditCardId: `${h}-cartao`,
          description: "Notebook",
          totalAmount: brl(3600),
          purchaseDate: anchors.lastMonth,
          competenceDate: anchors.lastMonth,
          categoryId: categoryId(h, "educacao"),
          installmentCount: 6,
          visibility: "HOUSEHOLD",
        },
      ],
      recurringRules: [
        salaryRule(h, `${h}-salario-ana`, "Salário Ana", 9800, 5, anchors.lastYear, "seed-uid-ana"),
        salaryRule(
          h,
          `${h}-salario-bruno`,
          "Salário Bruno",
          7400,
          5,
          anchors.lastYear,
          "seed-uid-bruno",
        ),
        monthlyRule(h, `${h}-aluguel`, "Aluguel", 3200, 10, "moradia", {
          startDate: anchors.lastYear,
        }),
        monthlyRule(h, `${h}-energia`, "Energia elétrica", 380, 15, "energia", {
          startDate: anchors.lastYear,
          expenseNature: "VARIABLE",
          confidence: "ESTIMATED",
        }),
        monthlyRule(h, `${h}-internet`, "Internet", 149, 12, "internet", {
          startDate: anchors.lastYear,
        }),
        monthlyRule(h, `${h}-escola`, "Escola", 1450, 8, "educacao", {
          startDate: anchors.lastYear,
        }),
        monthlyRule(h, `${h}-plano-saude`, "Plano de saúde", 890, 20, "saude", {
          startDate: anchors.lastYear,
        }),
      ],
      obligations: [
        {
          id: `${h}-iptu`,
          householdId: h,
          direction: "OUTFLOW",
          origin: "MANUAL",
          description: "IPTU - parcela única",
          amount: brl(1850),
          dueDate: addMonths(anchors.today, 2),
          competenceDate: addMonths(anchors.today, 2),
          categoryId: categoryId(h, "impostos"),
          expenseNature: "OCCASIONAL",
          confidence: "CONFIRMED",
          visibility: "HOUSEHOLD",
          status: "SCHEDULED",
          settledAmount: brl(0),
          settlementTransactionIds: [],
        },
      ],
      reserves: [
        {
          id: `${h}-reserva-emergencia`,
          householdId: h,
          name: "Reserva de emergência",
          purpose: "EMERGENCY",
          currentAmount: brl(22000),
          targetAmount: brl(36000),
          accountId: `${h}-poupanca`,
          isProtected: true,
          visibility: "HOUSEHOLD",
          archived: false,
        },
      ],
      goals: [
        {
          id: `${h}-meta-viagem`,
          householdId: h,
          name: "Viagem em família",
          targetAmount: brl(12000),
          targetDate: addMonths(anchors.today, 10),
          status: "ACTIVE",
          visibility: "HOUSEHOLD",
        },
      ],
      budgets: [
        {
          id: anchors.thisMonth,
          householdId: h,
          month: anchors.thisMonth,
          lines: [
            { categoryId: categoryId(h, "alimentacao"), plannedAmount: brl(1800) },
            { categoryId: categoryId(h, "transporte"), plannedAmount: brl(700) },
            { categoryId: categoryId(h, "lazer"), plannedAmount: brl(600) },
            { categoryId: categoryId(h, "restaurantes"), plannedAmount: brl(500) },
          ],
        },
      ],
    };
  },
};

/* ------------------------------------------------------------------ */
/* Scenario B - a household with very little room                      */
/* ------------------------------------------------------------------ */

const scenarioB: SeedHousehold = {
  id: "seed-familia-apertada",
  name: "Família Costa",
  summary:
    "Sobra mensal pequena. Qualquer imprevisto muda o mês. Bom para testar alertas e a diferença entre saldo total e saldo livre.",
  users: [
    {
      uid: "seed-uid-carla",
      email: "carla@exemplo.test",
      password: "conta1234",
      displayName: "Carla Costa",
      role: "OWNER",
    },
  ],
  monthsOfHistory: 6,
  historyAccountId: "seed-familia-apertada-conta",
  build(anchors) {
    const h = this.id;
    return {
      ...emptyContent,
      accounts: [
        {
          id: `${h}-conta`,
          householdId: h,
          name: "Conta corrente",
          type: "CHECKING",
          institution: "Caixa",
          openingBalance: brl(940),
          openingBalanceDate: anchors.monthStart,
          overdraftLimit: brl(1500),
          visibility: "HOUSEHOLD",
          includeInTotals: true,
          archived: false,
        },
        {
          id: `${h}-carteira`,
          householdId: h,
          name: "Dinheiro",
          type: "CASH",
          openingBalance: brl(120),
          openingBalanceDate: anchors.monthStart,
          visibility: "HOUSEHOLD",
          includeInTotals: true,
          archived: false,
        },
      ],
      creditCards: [
        {
          id: `${h}-cartao`,
          householdId: h,
          name: "Cartão",
          creditLimit: brl(2500),
          closingDay: 20,
          dueDay: 28,
          visibility: "HOUSEHOLD",
          archived: false,
        },
      ],
      cardPurchases: [
        {
          id: `${h}-compra-farmacia`,
          householdId: h,
          creditCardId: `${h}-cartao`,
          description: "Farmácia",
          totalAmount: brl(320),
          purchaseDate: anchors.today,
          competenceDate: anchors.today,
          categoryId: categoryId(h, "saude"),
          installmentCount: 1,
          visibility: "HOUSEHOLD",
        },
        {
          id: `${h}-compra-oculos`,
          householdId: h,
          creditCardId: `${h}-cartao`,
          description: "Óculos de grau",
          totalAmount: brl(1080),
          purchaseDate: anchors.lastMonth,
          competenceDate: anchors.lastMonth,
          categoryId: categoryId(h, "saude"),
          installmentCount: 6,
          visibility: "HOUSEHOLD",
        },
      ],
      recurringRules: [
        salaryRule(h, `${h}-salario`, "Salário", 4200, 5, anchors.lastYear, "seed-uid-carla"),
        {
          ...salaryRule(h, `${h}-extra`, "Renda extra (aulas)", 600, 20, anchors.sixMonthsAgo),
          confidence: "ESTIMATED",
          categoryId: categoryId(h, "renda-extra"),
        },
        monthlyRule(h, `${h}-aluguel`, "Aluguel", 1600, 10, "moradia", {
          startDate: anchors.lastYear,
        }),
        monthlyRule(h, `${h}-energia`, "Energia elétrica", 240, 18, "energia", {
          startDate: anchors.lastYear,
          expenseNature: "VARIABLE",
          confidence: "ESTIMATED",
        }),
        monthlyRule(h, `${h}-agua`, "Água", 95, 14, "agua", {
          startDate: anchors.lastYear,
          expenseNature: "VARIABLE",
        }),
        monthlyRule(h, `${h}-internet`, "Internet", 110, 12, "internet", {
          startDate: anchors.lastYear,
        }),
        monthlyRule(h, `${h}-transporte`, "Transporte", 380, 5, "transporte", {
          startDate: anchors.lastYear,
          expenseNature: "VARIABLE",
        }),
        monthlyRule(h, `${h}-mercado`, "Supermercado", 1100, 3, "alimentacao", {
          startDate: anchors.lastYear,
          expenseNature: "VARIABLE",
          confidence: "ESTIMATED",
        }),
      ],
      obligations: [
        {
          id: `${h}-conta-atrasada`,
          householdId: h,
          direction: "OUTFLOW",
          origin: "MANUAL",
          description: "Conta de gás",
          amount: brl(88),
          dueDate: addMonths(anchors.today, 0) as CalendarDate,
          competenceDate: anchors.monthStart,
          categoryId: categoryId(h, "gas"),
          expenseNature: "VARIABLE",
          confidence: "CONFIRMED",
          visibility: "HOUSEHOLD",
          status: "SCHEDULED",
          settledAmount: brl(0),
          settlementTransactionIds: [],
        },
        {
          id: `${h}-material-escolar`,
          householdId: h,
          direction: "OUTFLOW",
          origin: "MANUAL",
          description: "Material escolar",
          amount: brl(760),
          dueDate: addMonths(anchors.today, 3),
          competenceDate: addMonths(anchors.today, 3),
          categoryId: categoryId(h, "educacao"),
          expenseNature: "OCCASIONAL",
          confidence: "CONFIRMED",
          visibility: "HOUSEHOLD",
          status: "SCHEDULED",
          settledAmount: brl(0),
          settlementTransactionIds: [],
        },
      ],
      reserves: [
        {
          id: `${h}-reserva`,
          householdId: h,
          name: "Reserva de emergência",
          purpose: "EMERGENCY",
          currentAmount: brl(400),
          targetAmount: brl(9000),
          isProtected: true,
          visibility: "HOUSEHOLD",
          archived: false,
        },
      ],
      budgets: [
        {
          id: anchors.thisMonth,
          householdId: h,
          month: anchors.thisMonth,
          lines: [
            { categoryId: categoryId(h, "alimentacao"), plannedAmount: brl(1100) },
            { categoryId: categoryId(h, "transporte"), plannedAmount: brl(380) },
            { categoryId: categoryId(h, "lazer"), plannedAmount: brl(150) },
          ],
        },
      ],
    };
  },
};

/* ------------------------------------------------------------------ */
/* Scenario C - a household carrying significant debt                  */
/* ------------------------------------------------------------------ */

const scenarioC: SeedHousehold = {
  id: "seed-familia-endividada",
  name: "Família Almeida",
  summary:
    "Empréstimo, financiamento de veículo, cartão parcelado e contas em atraso. Meses futuros com déficit - o cenário principal para validar a projeção.",
  users: [
    {
      uid: "seed-uid-diego",
      email: "diego@exemplo.test",
      password: "conta1234",
      displayName: "Diego Almeida",
      role: "OWNER",
    },
    {
      uid: "seed-uid-elis",
      email: "elis@exemplo.test",
      password: "conta1234",
      displayName: "Elis Almeida",
      role: "MEMBER",
    },
  ],
  monthsOfHistory: 9,
  historyAccountId: "seed-familia-endividada-conta",
  build(anchors) {
    const h = this.id;
    return {
      ...emptyContent,
      accounts: [
        {
          id: `${h}-conta`,
          householdId: h,
          name: "Conta corrente",
          type: "CHECKING",
          institution: "Itaú",
          openingBalance: brl(310),
          openingBalanceDate: anchors.monthStart,
          overdraftLimit: brl(3000),
          visibility: "HOUSEHOLD",
          includeInTotals: true,
          archived: false,
        },
      ],
      creditCards: [
        {
          id: `${h}-cartao-1`,
          householdId: h,
          name: "Cartão principal",
          creditLimit: brl(6000),
          closingDay: 25,
          dueDay: 5,
          visibility: "HOUSEHOLD",
          archived: false,
        },
        {
          id: `${h}-cartao-2`,
          householdId: h,
          name: "Cartão da loja",
          creditLimit: brl(2000),
          closingDay: 10,
          dueDay: 20,
          visibility: "HOUSEHOLD",
          archived: false,
        },
      ],
      cardPurchases: [
        {
          id: `${h}-compra-geladeira`,
          householdId: h,
          creditCardId: `${h}-cartao-1`,
          description: "Geladeira",
          totalAmount: brl(4200),
          purchaseDate: anchors.threeMonthsAgo,
          competenceDate: anchors.threeMonthsAgo,
          categoryId: categoryId(h, "moradia"),
          installmentCount: 12,
          visibility: "HOUSEHOLD",
        },
        {
          id: `${h}-compra-pneus`,
          householdId: h,
          creditCardId: `${h}-cartao-1`,
          description: "Pneus",
          totalAmount: brl(2400),
          purchaseDate: anchors.lastMonth,
          competenceDate: anchors.lastMonth,
          categoryId: categoryId(h, "veiculo"),
          installmentCount: 10,
          visibility: "HOUSEHOLD",
        },
        {
          id: `${h}-compra-roupas`,
          householdId: h,
          creditCardId: `${h}-cartao-2`,
          description: "Roupas",
          totalAmount: brl(890),
          purchaseDate: anchors.lastMonth,
          competenceDate: anchors.lastMonth,
          categoryId: categoryId(h, "vestuario"),
          installmentCount: 6,
          visibility: "HOUSEHOLD",
        },
      ],
      recurringRules: [
        salaryRule(
          h,
          `${h}-salario-diego`,
          "Salário Diego",
          3900,
          5,
          anchors.lastYear,
          "seed-uid-diego",
        ),
        salaryRule(
          h,
          `${h}-salario-elis`,
          "Salário Elis",
          2600,
          5,
          anchors.lastYear,
          "seed-uid-elis",
        ),
        monthlyRule(h, `${h}-aluguel`, "Aluguel", 1750, 10, "moradia", {
          startDate: anchors.lastYear,
        }),
        monthlyRule(h, `${h}-energia`, "Energia elétrica", 310, 15, "energia", {
          startDate: anchors.lastYear,
          expenseNature: "VARIABLE",
          confidence: "ESTIMATED",
        }),
        monthlyRule(h, `${h}-internet`, "Internet e telefone", 180, 12, "internet", {
          startDate: anchors.lastYear,
        }),
        monthlyRule(h, `${h}-mercado`, "Supermercado", 1400, 3, "alimentacao", {
          startDate: anchors.lastYear,
          expenseNature: "VARIABLE",
          confidence: "ESTIMATED",
        }),
        monthlyRule(h, `${h}-combustivel`, "Combustível", 520, 6, "veiculo", {
          startDate: anchors.lastYear,
          expenseNature: "VARIABLE",
        }),
        monthlyRule(h, `${h}-escola`, "Escola", 980, 8, "educacao", {
          startDate: anchors.lastYear,
        }),
      ],
      obligations: [
        {
          id: `${h}-conta-vencida-energia`,
          householdId: h,
          direction: "OUTFLOW",
          origin: "MANUAL",
          description: "Energia elétrica (em atraso)",
          amount: brl(310),
          dueDate: addMonths(anchors.today, -1),
          competenceDate: addMonths(anchors.today, -1),
          categoryId: categoryId(h, "energia"),
          expenseNature: "VARIABLE",
          confidence: "CONFIRMED",
          visibility: "HOUSEHOLD",
          status: "SCHEDULED",
          settledAmount: brl(0),
          settlementTransactionIds: [],
        },
        {
          id: `${h}-conta-vencida-agua`,
          householdId: h,
          direction: "OUTFLOW",
          origin: "MANUAL",
          description: "Água (em atraso)",
          amount: brl(142),
          dueDate: addMonths(anchors.today, -1),
          competenceDate: addMonths(anchors.today, -1),
          categoryId: categoryId(h, "agua"),
          expenseNature: "VARIABLE",
          confidence: "CONFIRMED",
          visibility: "HOUSEHOLD",
          status: "SCHEDULED",
          settledAmount: brl(0),
          settlementTransactionIds: [],
        },
        {
          id: `${h}-ipva`,
          householdId: h,
          direction: "OUTFLOW",
          origin: "MANUAL",
          description: "IPVA",
          amount: brl(1240),
          dueDate: addMonths(anchors.today, 3),
          competenceDate: addMonths(anchors.today, 3),
          categoryId: categoryId(h, "impostos"),
          expenseNature: "OCCASIONAL",
          confidence: "CONFIRMED",
          visibility: "HOUSEHOLD",
          status: "SCHEDULED",
          settledAmount: brl(0),
          settlementTransactionIds: [],
        },
      ],
      debts: [
        {
          id: `${h}-emprestimo`,
          householdId: h,
          kind: "PERSONAL_LOAN",
          description: "Empréstimo pessoal",
          institution: "Banco Itaú",
          principalContracted: brl(18000),
          amountDisbursed: brl(17100),
          disbursementDate: anchors.sixMonthsAgo,
          amortisationSystem: "PRICE",
          interestRateMonthly: 2.79,
          installmentCount: 24,
          firstDueDate: addMonths(anchors.sixMonthsAgo, 1),
          monthlyInsurance: brl(18),
          status: "ACTIVE",
          visibility: "HOUSEHOLD",
        },
        {
          id: `${h}-financiamento`,
          householdId: h,
          kind: "VEHICLE_FINANCING",
          description: "Financiamento do carro",
          institution: "Banco Votorantim",
          principalContracted: brl(42000),
          amountDisbursed: brl(42000),
          disbursementDate: addMonths(anchors.today, -20),
          amortisationSystem: "PRICE",
          interestRateMonthly: 1.49,
          installmentCount: 48,
          firstDueDate: addMonths(anchors.today, -19),
          monthlyInsurance: brl(64),
          status: "ACTIVE",
          visibility: "HOUSEHOLD",
        },
      ],
      reserves: [
        {
          id: `${h}-reserva`,
          householdId: h,
          name: "Reserva de emergência",
          purpose: "EMERGENCY",
          currentAmount: brl(0),
          targetAmount: brl(12000),
          isProtected: true,
          visibility: "HOUSEHOLD",
          archived: false,
        },
      ],
      goals: [
        {
          id: `${h}-meta-quitar`,
          householdId: h,
          name: "Quitar o empréstimo pessoal",
          targetAmount: brl(18000),
          status: "ACTIVE",
          visibility: "HOUSEHOLD",
        },
      ],
      budgets: [
        {
          id: anchors.thisMonth,
          householdId: h,
          month: anchors.thisMonth,
          lines: [
            { categoryId: categoryId(h, "alimentacao"), plannedAmount: brl(1400) },
            { categoryId: categoryId(h, "veiculo"), plannedAmount: brl(520) },
            { categoryId: categoryId(h, "lazer"), plannedAmount: brl(120) },
          ],
        },
      ],
    };
  },
};

export const SEED_HOUSEHOLDS: readonly SeedHousehold[] = [scenarioA, scenarioB, scenarioC];

export const SEED_TIMEZONE = TIMEZONE;

/** Every account referenced by the fixtures, for the "clear before seed" step. */
export const SEED_HOUSEHOLD_IDS = SEED_HOUSEHOLDS.map((household) => household.id);

export const SEED_USERS = SEED_HOUSEHOLDS.flatMap((household) =>
  household.users.map((user) => ({ ...user, householdId: household.id })),
);

export { calendarDate };

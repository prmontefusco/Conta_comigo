import { z } from "zod";
import {
  auditSchema,
  calendarDateSchema,
  confidenceSchema,
  currencySchema,
  descriptionSchema,
  expenseNatureSchema,
  flowDirectionSchema,
  householdRoleSchema,
  idSchema,
  instantSchema,
  labelSchema,
  moneySchema,
  monthKeySchema,
  notesSchema,
  visibilitySchema,
} from "./codecs";

/**
 * Firestore document schemas.
 *
 * They live together because they are one thing: the wire format, mirroring
 * firestore.rules field for field. When a rule constrains a field, the schema
 * here says the same thing in TypeScript, so a bad document is rejected before
 * it can reach a calculation.
 */

const base = auditSchema.extend({
  id: idSchema,
  householdId: idSchema,
});

/* ------------------------------------------------------------------ */
/* Identity and household                                              */
/* ------------------------------------------------------------------ */

export const userProfileSchema = auditSchema.extend({
  id: idSchema,
  uid: idSchema,
  displayName: z.string().trim().min(1).max(120),
  email: z.string().email(),
  plan: z.enum(["FREE", "PREMIUM"]),
  defaultHouseholdId: idSchema.optional(),
  onboardingCompletedSteps: z
    .array(
      z.enum([
        "CREATE_HOUSEHOLD",
        "ADD_MAIN_INCOME",
        "ADD_ACCOUNTS",
        "ADD_RECURRING_BILLS",
        "ADD_CARDS",
        "ADD_DEBTS",
      ]),
    )
    .default([]),
  acceptedTermsAt: instantSchema.optional(),
});

export const householdSettingsSchema = z.object({
  timezone: z.string().min(1).default("America/Sao_Paulo"),
  currency: currencySchema.default("BRL"),
  locale: z.string().min(2).default("pt-BR"),
  cardCompetenceStrategy: z.enum(["PURCHASE_DATE", "STATEMENT_MONTH"]).default("PURCHASE_DATE"),
  monthStartDay: z.number().int().min(1).max(28).default(1),
});

export const householdSchema = auditSchema.extend({
  id: idSchema,
  name: labelSchema,
  ownerUid: idSchema,
  memberUids: z.array(idSchema).min(1),
  settings: householdSettingsSchema,
  archived: z.boolean().default(false),
});

export const membershipSchema = auditSchema.extend({
  id: idSchema,
  householdId: idSchema,
  uid: idSchema,
  displayName: z.string().trim().min(1).max(120),
  email: z.string().email().optional(),
  role: householdRoleSchema,
  status: z.enum(["ACTIVE", "INVITED", "REMOVED"]),
  joinedAt: instantSchema.optional(),
});

/* ------------------------------------------------------------------ */
/* Financial documents                                                 */
/* ------------------------------------------------------------------ */

export const categorySchema = base.extend({
  name: labelSchema,
  kind: z.enum(["EXPENSE", "INCOME"]),
  parentId: idSchema.optional(),
  icon: z.string().max(8).optional(),
  color: z.string().max(24).optional(),
  defaultExpenseNature: expenseNatureSchema.optional(),
  isSystem: z.boolean().default(false),
  archived: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
});

export const accountSchema = base.extend({
  name: labelSchema,
  type: z.enum(["CHECKING", "SAVINGS", "WALLET", "CASH", "DIGITAL", "INVESTMENT", "OTHER"]),
  institution: z.string().trim().max(120).optional(),
  openingBalance: moneySchema,
  openingBalanceDate: calendarDateSchema,
  visibility: visibilitySchema,
  ownerMemberId: idSchema.optional(),
  overdraftLimit: moneySchema.optional(),
  includeInTotals: z.boolean().default(true),
  archived: z.boolean().default(false),
  color: z.string().max(24).optional(),
  icon: z.string().max(8).optional(),
});

const transactionCommon = base.extend({
  amount: moneySchema.refine((value) => value.amount >= 0, {
    message: "O valor deve ser positivo. A direção vem do tipo do lançamento.",
  }),
  transactionDate: calendarDateSchema,
  competenceDate: calendarDateSchema,
  description: descriptionSchema,
  visibility: visibilitySchema,
  responsibleMemberId: idSchema.optional(),
  notes: notesSchema,
  tags: z.array(z.string().trim().max(40)).max(20).optional(),
  vehicleId: idSchema.optional(),
});

const debtBreakdownSchema = z.object({
  principal: moneySchema,
  interest: moneySchema,
  fees: moneySchema,
  insurance: moneySchema,
});

export const transactionSchema = z.discriminatedUnion("kind", [
  transactionCommon.extend({
    kind: z.literal("INCOME"),
    accountId: idSchema,
    categoryId: idSchema.optional(),
    settlesObligationId: idSchema.optional(),
  }),
  transactionCommon.extend({
    kind: z.literal("EXPENSE"),
    accountId: idSchema,
    categoryId: idSchema,
    settlesObligationId: idSchema.optional(),
  }),
  transactionCommon.extend({
    kind: z.literal("TRANSFER"),
    fromAccountId: idSchema,
    toAccountId: idSchema,
  }),
  transactionCommon.extend({
    kind: z.literal("CARD_STATEMENT_PAYMENT"),
    accountId: idSchema,
    creditCardId: idSchema,
    statementId: idSchema,
  }),
  transactionCommon.extend({
    kind: z.literal("LOAN_DISBURSEMENT"),
    accountId: idSchema,
    debtId: idSchema,
  }),
  transactionCommon.extend({
    kind: z.literal("DEBT_PAYMENT"),
    accountId: idSchema,
    debtId: idSchema,
    breakdown: debtBreakdownSchema.optional(),
    settlesObligationId: idSchema.optional(),
  }),
  transactionCommon.extend({
    kind: z.literal("RESERVE_ALLOCATION"),
    reserveId: idSchema,
    accountId: idSchema,
    counterAccountId: idSchema.optional(),
  }),
  transactionCommon.extend({
    kind: z.literal("RESERVE_RELEASE"),
    reserveId: idSchema,
    accountId: idSchema,
    counterAccountId: idSchema.optional(),
  }),
  transactionCommon.extend({
    kind: z.literal("ADJUSTMENT"),
    accountId: idSchema,
    direction: z.enum(["INCREASE", "DECREASE"]),
    reason: z.string().trim().min(1).max(200),
  }),
]);

export const obligationSourceSchema = z.object({
  recurringRuleId: idSchema.optional(),
  cardStatementId: idSchema.optional(),
  creditCardId: idSchema.optional(),
  debtId: idSchema.optional(),
  occurrenceKey: z.string().max(280).optional(),
  installmentNumber: z.number().int().min(1).optional(),
  installmentCount: z.number().int().min(1).optional(),
});

export const obligationSchema = base.extend({
  direction: flowDirectionSchema,
  origin: z.enum([
    "MANUAL",
    "RECURRING_RULE",
    "CARD_STATEMENT",
    "DEBT_SCHEDULE",
    "INSTALLMENT_PLAN",
    "SIMULATED",
  ]),
  source: obligationSourceSchema.optional(),
  description: descriptionSchema,
  amount: moneySchema,
  dueDate: calendarDateSchema,
  competenceDate: calendarDateSchema,
  categoryId: idSchema.optional(),
  expectedAccountId: idSchema.optional(),
  expenseNature: expenseNatureSchema,
  confidence: confidenceSchema,
  visibility: visibilitySchema,
  responsibleMemberId: idSchema.optional(),
  vehicleId: idSchema.optional(),
  status: z.enum(["SCHEDULED", "PARTIALLY_SETTLED", "SETTLED", "CANCELED"]),
  settledAmount: moneySchema,
  settlementTransactionIds: z.array(idSchema).default([]),
  settledAt: instantSchema.optional(),
  notes: notesSchema,
});

export const creditCardSchema = base.extend({
  name: labelSchema,
  issuer: z.string().trim().max(120).optional(),
  brand: z.string().trim().max(60).optional(),
  lastFourDigits: z
    .string()
    .regex(/^\d{4}$/)
    .optional(),
  holderMemberId: idSchema.optional(),
  creditLimit: moneySchema,
  closingDay: z.number().int().min(1).max(31),
  dueDay: z.number().int().min(1).max(31),
  visibility: visibilitySchema,
  parentCardId: idSchema.optional(),
  archived: z.boolean().default(false),
  color: z.string().max(24).optional(),
});

export const cardPurchaseSchema = base.extend({
  creditCardId: idSchema,
  description: descriptionSchema,
  merchant: z.string().trim().max(120).optional(),
  totalAmount: moneySchema,
  purchaseDate: calendarDateSchema,
  competenceDate: calendarDateSchema,
  categoryId: idSchema,
  installmentCount: z.number().int().min(1).max(120),
  visibility: visibilitySchema,
  responsibleMemberId: idSchema.optional(),
  vehicleId: idSchema.optional(),
  refunded: z.boolean().optional(),
  notes: notesSchema,
});

export const debtSchema = base.extend({
  kind: z.enum([
    "PERSONAL_LOAN",
    "PAYROLL_LOAN",
    "VEHICLE_FINANCING",
    "REAL_ESTATE_FINANCING",
    "EQUIPMENT_FINANCING",
    "OVERDRAFT",
    "CARD_RENEGOTIATION",
    "OTHER",
  ]),
  description: descriptionSchema,
  institution: z.string().trim().max(120).optional(),
  principalContracted: moneySchema,
  amountDisbursed: moneySchema,
  disbursementDate: calendarDateSchema,
  amortisationSystem: z.enum(["PRICE", "SAC", "SIMPLE"]),
  interestRateMonthly: z.number().min(0).max(100).optional(),
  cetAnnual: z.number().min(0).max(1000).optional(),
  installmentCount: z.number().int().min(1).max(600),
  installmentAmount: moneySchema.optional(),
  firstDueDate: calendarDateSchema,
  monthlyFees: moneySchema.optional(),
  monthlyInsurance: moneySchema.optional(),
  status: z.enum(["ACTIVE", "SETTLED", "RENEGOTIATED", "IN_DEFAULT"]),
  visibility: visibilitySchema,
  responsibleMemberId: idSchema.optional(),
  vehicleId: idSchema.optional(),
  notes: notesSchema,
});

export const recurringRuleSchema = base.extend({
  direction: flowDirectionSchema,
  description: descriptionSchema,
  amount: moneySchema,
  frequency: z.enum([
    "WEEKLY",
    "BIWEEKLY",
    "MONTHLY",
    "BIMONTHLY",
    "QUARTERLY",
    "SEMIANNUAL",
    "ANNUAL",
    "EVERY_N_DAYS",
  ]),
  interval: z.number().int().min(1).max(365).default(1),
  dayOfMonth: z.number().int().min(1).max(31).optional(),
  dayOfWeek: z.number().int().min(0).max(6).optional(),
  monthOfYear: z.number().int().min(1).max(12).optional(),
  startDate: calendarDateSchema,
  endDate: calendarDateSchema.optional(),
  maxOccurrences: z.number().int().min(1).max(600).optional(),
  weekendPolicy: z.enum(["KEEP", "NEXT_BUSINESS_DAY"]).default("KEEP"),
  categoryId: idSchema.optional(),
  expectedAccountId: idSchema.optional(),
  expenseNature: expenseNatureSchema,
  confidence: confidenceSchema,
  visibility: visibilitySchema,
  responsibleMemberId: idSchema.optional(),
  vehicleId: idSchema.optional(),
  active: z.boolean().default(true),
  notes: notesSchema,
});

export const budgetSchema = base.extend({
  month: monthKeySchema,
  lines: z
    .array(
      z.object({
        categoryId: idSchema,
        plannedAmount: moneySchema,
        expenseNature: expenseNatureSchema.optional(),
        memberId: idSchema.optional(),
        notes: notesSchema,
      }),
    )
    .max(200),
});

export const reserveSchema = base.extend({
  name: labelSchema,
  purpose: z.enum([
    "EMERGENCY",
    "TRAVEL",
    "MAINTENANCE",
    "TAXES",
    "HOME",
    "VEHICLE",
    "HEALTH",
    "EDUCATION",
    "OTHER",
  ]),
  currentAmount: moneySchema,
  targetAmount: moneySchema.optional(),
  accountId: idSchema.optional(),
  isProtected: z.boolean().default(true),
  visibility: visibilitySchema,
  linkedGoalId: idSchema.optional(),
  archived: z.boolean().default(false),
  notes: notesSchema,
});

export const goalSchema = base.extend({
  name: labelSchema,
  description: z.string().trim().max(500).optional(),
  targetAmount: moneySchema,
  targetDate: calendarDateSchema.optional(),
  linkedReserveId: idSchema.optional(),
  status: z.enum(["ACTIVE", "ACHIEVED", "PAUSED", "ABANDONED"]),
  visibility: visibilitySchema,
});

export const vehicleSchema = base.extend({
  name: labelSchema,
  plate: z.string().trim().max(10).optional(),
  brand: z.string().trim().max(60).optional(),
  model: z.string().trim().max(60).optional(),
  year: z.number().int().min(1900).max(2100).optional(),
  ownerMemberId: idSchema.optional(),
  archived: z.boolean().default(false),
});

export type UserProfileDoc = z.infer<typeof userProfileSchema>;
export type HouseholdDoc = z.infer<typeof householdSchema>;
export type MembershipDoc = z.infer<typeof membershipSchema>;
export type CategoryDoc = z.infer<typeof categorySchema>;
export type AccountDoc = z.infer<typeof accountSchema>;
export type TransactionDoc = z.infer<typeof transactionSchema>;
export type ObligationDoc = z.infer<typeof obligationSchema>;
export type CreditCardDoc = z.infer<typeof creditCardSchema>;
export type CardPurchaseDoc = z.infer<typeof cardPurchaseSchema>;
export type DebtDoc = z.infer<typeof debtSchema>;
export type RecurringRuleDoc = z.infer<typeof recurringRuleSchema>;
export type BudgetDoc = z.infer<typeof budgetSchema>;
export type ReserveDoc = z.infer<typeof reserveSchema>;
export type GoalDoc = z.infer<typeof goalSchema>;
export type VehicleDoc = z.infer<typeof vehicleSchema>;

import type { CalendarDate, DateRange, MonthKey } from "@/core/date/calendar-date";
import type { Money } from "@/core/money/money";
import type { CardStatement } from "@/modules/cards/domain/credit-card";
import type { Debt } from "@/modules/debts/domain/debt";
import type { Obligation } from "@/modules/obligations/domain/obligation";
import type { RecurringRule } from "@/modules/recurring/domain/recurring-rule";
import type { CategoryId, Confidence, DebtId, FlowDirection } from "@/modules/shared/domain/common";

/**
 * Inputs and outputs of the forecast engine.
 *
 * Everything here is a plain value. The engine never reads a database, never
 * knows what a Firestore document is, and can therefore be exercised entirely
 * in memory (docs/adr/0004-forecast-engine-is-pure.md).
 */

export type ForecastEventSource =
  | "OVERDUE_OBLIGATION"
  | "OBLIGATION"
  | "RECURRING_RULE"
  | "CARD_STATEMENT"
  | "DEBT_INSTALLMENT"
  | "SIMULATED";

export interface ForecastEvent {
  /** The day cash is expected to move. */
  readonly date: CalendarDate;
  /** The month this belongs to economically. */
  readonly competenceMonth: MonthKey;
  readonly direction: FlowDirection;
  /** Always a positive magnitude; direction carries the sign. */
  readonly amount: Money;
  readonly description: string;
  readonly source: ForecastEventSource;
  readonly confidence: Confidence;
  readonly categoryId?: CategoryId;
  /** Id of the originating obligation, statement, rule or debt. */
  readonly referenceId?: string;
  /**
   * True for loan, financing and card-statement payments.
   *
   * Tracked separately so the dashboard can answer "how much of next month is
   * already promised to debt?" without conflating it with living costs.
   */
  readonly isDebtCommitment: boolean;
}

export interface ForecastInput {
  /** The day the projection starts from, in the household's timezone. */
  readonly asOf: CalendarDate;
  readonly horizon: DateRange;
  /** Total cash across accounts today. */
  readonly openingBalance: Money;
  /** Money the household has decided is not available to spend. */
  readonly protectedReserve: Money;

  readonly obligations: readonly Obligation[];
  readonly recurringRules: readonly RecurringRule[];
  readonly cardStatements: readonly CardStatement[];
  readonly debts: readonly Debt[];
  /** Installment numbers already paid, per debt. */
  readonly paidDebtInstallments?: ReadonlyMap<DebtId, readonly number[]>;

  /** Extra events injected by a what-if simulation. Never persisted. */
  readonly simulatedEvents?: readonly ForecastEvent[];

  /**
   * Whether ESTIMATED amounts count towards the projection.
   *
   * Defaults to true. Turning it off answers "what if only what is certain
   * happens?", which is the honest floor of the projection.
   */
  readonly includeEstimated?: boolean;
}

export interface ForecastDay {
  readonly date: CalendarDate;
  readonly inflow: Money;
  readonly outflow: Money;
  readonly net: Money;
  /** Cash in accounts at the end of this day. */
  readonly projectedCashBalance: Money;
  /** Same, minus the protected reserve. What is genuinely free. */
  readonly freeProjectedBalance: Money;
  readonly events: readonly ForecastEvent[];
}

export interface ForecastMonth {
  readonly month: MonthKey;
  readonly expectedInflows: Money;
  readonly committedOutflows: Money;
  /** Portion of the outflows that is debt and card servicing. */
  readonly debtCommitment: Money;
  readonly net: Money;
  readonly openingCashBalance: Money;
  readonly endingCashBalance: Money;
  readonly freeEndingBalance: Money;
  readonly lowestBalance: Money;
  readonly lowestBalanceDate: CalendarDate;
  /** True when commitments exceed what comes in during the month. */
  readonly isDeficit: boolean;
  /** How much the month is short by. Zero when there is no deficit. */
  readonly deficitAmount: Money;
  /**
   * True for the month the projection starts in, when it starts mid-month.
   *
   * A partial month is not comparable to a whole one: a salary that already
   * arrived on the 5th is not in it, so its "deficit" would look alarming and
   * mean nothing. The UI labels it, and `firstDeficitMonth` skips it.
   */
  readonly isPartial: boolean;
}

export interface ForecastSummary {
  /** Projected cash at the end of the horizon. */
  readonly projectedCashBalance: Money;
  readonly protectedReserve: Money;
  readonly freeProjectedBalance: Money;
  readonly committedOutflows: Money;
  readonly expectedInflows: Money;
  /** Bills already past their due date and still open. */
  readonly overdueAmount: Money;
  /** Everything due within the next 30 days. */
  readonly upcomingAmount: Money;
  readonly debtCommitment: Money;

  readonly lowestProjectedBalance: Money;
  readonly lowestProjectedBalanceDate: CalendarDate;
  /** First day the free balance goes below zero, if it ever does. */
  readonly firstNegativeDate?: CalendarDate;
  readonly firstDeficitMonth?: MonthKey;
}

export interface ForecastResult {
  readonly asOf: CalendarDate;
  readonly horizon: DateRange;
  readonly openingBalance: Money;
  readonly protectedReserve: Money;
  readonly days: readonly ForecastDay[];
  readonly months: readonly ForecastMonth[];
  readonly summary: ForecastSummary;
  readonly events: readonly ForecastEvent[];
}

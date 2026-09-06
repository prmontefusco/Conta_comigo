import type { CalendarDate } from "@/core/date/calendar-date";
import { type Money, add, money, subtract } from "@/core/money/money";
import type { CardStatement } from "@/modules/cards/domain/credit-card";
import { classifyDebt, essentialServiceConsequence } from "@/modules/debts/domain/debt-risk";
import { lateInstallmentCount, type Debt } from "@/modules/debts/domain/debt";
import { estimateObligationLateFees } from "./late-fees";
import { isOpen, remainingAmount, type Obligation } from "./obligation";

/**
 * Quando o dinheiro não dá para tudo.
 *
 * Todo o resto do produto responde "como sair da dívida". Este módulo responde
 * a pergunta que vem antes, e que era a única sem resposta: **com o dinheiro
 * que eu tenho hoje, o que eu pago?**
 *
 * A ordem não é por valor nem por juros. É por **consequência** — o mesmo
 * princípio de `debt-risk.ts`, estendido às contas do mês. Quem tem R$ 400 e
 * cinco boletos não precisa saber qual é o mais caro; precisa saber qual deles
 * corta a luz, qual toma o carro e qual só liga cobrando.
 *
 * Nada aqui paga nada. O módulo devolve uma lista ordenada e o que sobra de
 * dinheiro em cada passo, e a decisão continua sendo de quem lê.
 */

export type TriageTier =
  /** Não pagar remove algo de que a casa vive: água, luz, gás, moradia. */
  | "ESSENTIAL_SERVICE"
  /** Não pagar pode custar um bem: veículo ou imóvel alienado. */
  | "ASSET_AT_RISK"
  /** Já vencido, crescendo com multa e mora todo dia. */
  | "ACCRUING"
  /** Vence em breve; pagar em dia evita que entre nas faixas acima. */
  | "UPCOMING"
  /** Cobrança sem corte, sem garantia e sem multa diária relevante. */
  | "PRESSURE_ONLY";

export const TIER_ORDER: readonly TriageTier[] = [
  "ESSENTIAL_SERVICE",
  "ASSET_AT_RISK",
  "ACCRUING",
  "UPCOMING",
  "PRESSURE_ONLY",
];

export const TIER_LABELS: Record<TriageTier, string> = {
  ESSENTIAL_SERVICE: "Corta um serviço essencial",
  ASSET_AT_RISK: "Pode custar um bem",
  ACCRUING: "Cresce todo dia",
  UPCOMING: "Vence em breve",
  PRESSURE_ONLY: "Cobrança, sem corte",
};

export const TIER_EXPLANATIONS: Record<TriageTier, string> = {
  ESSENTIAL_SERVICE:
    "Ficar sem água, luz ou gás custa mais do que a conta — e religar tem taxa. Estas vêm primeiro, mesmo que sejam as menores.",
  ASSET_AT_RISK:
    "O bem é a garantia do contrato. Atrasar pode terminar em busca e apreensão, mesmo com quase tudo pago.",
  ACCRUING: "Já venceram e crescem com multa e juros a cada dia parado. Quanto antes, menos.",
  UPCOMING: "Ainda dá para pagar em dia e não deixar virar atraso.",
  PRESSURE_ONLY:
    "O credor vai cobrar e pode negativar o nome, mas não corta serviço nem toma bem. É a última da fila, e a primeira a negociar.",
};

export interface TriageItem {
  readonly id: string;
  readonly description: string;
  readonly tier: TriageTier;
  /** O que se perde ao não pagar, em uma frase. */
  readonly consequence: string;
  readonly amount: Money;
  readonly dueDate: CalendarDate;
  readonly daysLate: number;
  /** Quanto este atraso custa por dia. Zero quando não venceu. */
  readonly dailyCost: Money;
  /** Verdadeiro quando o dinheiro disponível cobre este item na sua vez. */
  readonly coveredByAvailableCash: boolean;
}

export interface TriageResult {
  readonly items: readonly TriageItem[];
  readonly availableCash: Money;
  /** Soma do que dá para pagar, seguindo a ordem. */
  readonly payableNow: Money;
  /** O que fica de fora depois de gastar tudo. */
  readonly unpayable: Money;
  /** Quanto o conjunto do que ficar de fora vai custar por dia. */
  readonly dailyCostOfWhatIsLeft: Money;
}

export interface BuildTriageInput {
  readonly asOf: CalendarDate;
  /** Dinheiro que a pessoa tem hoje para distribuir. */
  readonly availableCash: Money;
  readonly obligations: readonly Obligation[];
  readonly debts: readonly Debt[];
  readonly cardStatements: readonly CardStatement[];
  readonly cardNames?: ReadonlyMap<string, string>;
  readonly paidDebtInstallments?: ReadonlyMap<string, readonly number[]>;
  /** Quantos dias à frente ainda contam como "vence em breve". */
  readonly upcomingWindowDays?: number;
}

const DEFAULT_UPCOMING_WINDOW = 7;

export function buildTriage(input: BuildTriageInput): TriageResult {
  const currency = input.availableCash.currency;
  const items: TriageItem[] = [];

  /* --- Contas do mês ------------------------------------------------- */

  for (const obligation of input.obligations) {
    if (!isOpen(obligation) || obligation.direction !== "OUTFLOW") continue;

    const fees = estimateObligationLateFees(obligation, input.asOf);
    const essential = essentialServiceConsequence(obligation.categoryId);
    const withinWindow =
      fees.daysLate === 0 &&
      daysUntil(input.asOf, obligation.dueDate) <=
        (input.upcomingWindowDays ?? DEFAULT_UPCOMING_WINDOW);

    if (fees.daysLate === 0 && !withinWindow) continue;

    items.push({
      id: obligation.id,
      description: obligation.description,
      // Serviço essencial só entra na primeira faixa depois de vencer.
      //
      // Uma conta de luz que vence daqui a cinco dias não corta nada hoje, e
      // colocá-la acima de uma conta já vencida inverte a urgência real.
      tier:
        essential && fees.daysLate > 0
          ? "ESSENTIAL_SERVICE"
          : fees.daysLate > 0
            ? "ACCRUING"
            : "UPCOMING",
      consequence: essential
        ? fees.daysLate > 0
          ? `Risco de ${essential}.`
          : `Se vencer, o risco é ${essential}.`
        : fees.daysLate > 0
          ? `Vencida há ${fees.daysLate} ${fees.daysLate === 1 ? "dia" : "dias"}, crescendo com multa e mora.`
          : "Ainda em dia. Pagar agora evita que entre na fila do atraso.",
      amount: remainingAmount(obligation),
      dueDate: obligation.dueDate,
      daysLate: fees.daysLate,
      dailyCost: fees.dailyCost,
      coveredByAvailableCash: false,
    });
  }

  /* --- Parcelas de dívida em atraso ---------------------------------- */

  for (const debt of input.debts) {
    if (debt.status === "SETTLED") continue;

    const late = lateInstallmentCount(
      debt,
      input.asOf,
      input.paidDebtInstallments?.get(debt.id) ?? [],
    );
    if (late <= 0) continue;

    const risk = classifyDebt(debt);
    const installment = debt.installmentAmount ?? money(0, currency);

    items.push({
      id: `debt:${debt.id}`,
      description: `${debt.description} — ${late} ${late === 1 ? "parcela" : "parcelas"} em atraso`,
      tier: risk.guarantee === "COLLATERAL" ? "ASSET_AT_RISK" : "ACCRUING",
      consequence: risk.consequence,
      amount: money(installment.amount * late, currency),
      dueDate: input.asOf,
      daysLate: 1,
      dailyCost: money(0, currency),
      coveredByAvailableCash: false,
    });
  }

  /* --- Faturas de cartão vencidas ------------------------------------ */

  const overdueByCard = new Map<string, number>();
  for (const statement of input.cardStatements) {
    if (statement.remainingAmount.amount <= 0) continue;
    if (statement.dueDate >= input.asOf) continue;
    overdueByCard.set(
      statement.creditCardId,
      (overdueByCard.get(statement.creditCardId) ?? 0) + statement.remainingAmount.amount,
    );
  }

  for (const [cardId, amount] of overdueByCard) {
    const name = input.cardNames?.get(cardId);
    items.push({
      id: `card:${cardId}`,
      description: cardStatementLabel(name),
      tier: "ACCRUING",
      consequence:
        "Fatura vencida entra no rotativo, o crédito mais caro do país. Se não der para pagar tudo, peça ao banco o parcelamento da fatura — costuma custar bem menos.",
      amount: money(amount, currency),
      dueDate: input.asOf,
      daysLate: 1,
      dailyCost: money(0, currency),
      coveredByAvailableCash: false,
    });
  }

  /* --- Ordenação e distribuição do dinheiro -------------------------- */

  // Dentro de cada faixa, o menor primeiro: com pouco dinheiro, resolver duas
  // contas pequenas tira duas ameaças da mesa em vez de uma.
  const ordered = [...items].sort((a, b) => {
    const byTier = TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier);
    if (byTier !== 0) return byTier;
    return a.amount.amount - b.amount.amount;
  });

  let remaining = Math.max(0, input.availableCash.amount);
  let payable = money(0, currency);
  const allocated = ordered.map((item) => {
    const covered = item.amount.amount > 0 && item.amount.amount <= remaining;
    if (covered) {
      remaining -= item.amount.amount;
      payable = add(payable, item.amount);
    }
    return { ...item, coveredByAvailableCash: covered };
  });

  const total = allocated.reduce((sofar, item) => add(sofar, item.amount), money(0, currency));
  const leftOut = allocated.filter((item) => !item.coveredByAvailableCash);

  return {
    items: allocated,
    availableCash: input.availableCash,
    payableNow: payable,
    unpayable: subtract(total, payable),
    dailyCostOfWhatIsLeft: leftOut.reduce(
      (sofar, item) => add(sofar, item.dailyCost),
      money(0, currency),
    ),
  };
}

/** "Fatura atrasada do Nubank", sem repetir "cartão" quando o nome já o traz. */
function cardStatementLabel(name: string | undefined): string {
  if (!name) return "Fatura de cartão atrasada";
  const alreadySaysCard = name.trim().toLowerCase().startsWith("cartão ");
  return alreadySaysCard ? `Fatura atrasada do ${name}` : `Fatura atrasada do cartão ${name}`;
}

function daysUntil(from: CalendarDate, to: CalendarDate): number {
  const millis = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  return Math.round(millis / 86_400_000);
}

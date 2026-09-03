import type { Debt, DebtKind } from "./debt";

/**
 * Not all debt is equally dangerous.
 *
 * Two debts of the same size and rate can have completely different
 * consequences: one ends in a phone call, the other in losing the car the
 * household needs to work. Ordering by interest alone - which is what the
 * Avalanche method does - is the right answer to "what costs most" and the
 * wrong answer to "what do I protect first".
 *
 * So risk here is about *consequence*, never about the amount. A small
 * financing with the car as collateral outranks a large personal loan.
 */

export type DebtRiskLevel = "CRITICAL" | "HIGH" | "MODERATE";

export type DebtGuarantee =
  /** A good the lender can take back: vehicle, property, equipment. */
  | "COLLATERAL"
  /** Discounted from the salary before it arrives. */
  | "PAYROLL"
  /** Nothing pledged. The lender can charge, not seize. */
  | "NONE";

export interface DebtRisk {
  readonly level: DebtRiskLevel;
  readonly guarantee: DebtGuarantee;
  /** Short label for a badge. */
  readonly label: string;
  /** What actually happens if it stops being paid. */
  readonly consequence: string;
}

const BY_KIND: Record<DebtKind, DebtRisk> = {
  VEHICLE_FINANCING: {
    level: "CRITICAL",
    guarantee: "COLLATERAL",
    label: "Veículo em garantia",
    consequence:
      "O veículo está alienado ao banco. A falta de pagamento pode terminar em busca e apreensão, mesmo com boa parte das parcelas já pagas.",
  },
  REAL_ESTATE_FINANCING: {
    level: "CRITICAL",
    guarantee: "COLLATERAL",
    label: "Imóvel em garantia",
    consequence:
      "O imóvel é a garantia do contrato. A inadimplência pode levar à consolidação da propriedade em nome do credor e ao leilão do bem.",
  },
  EQUIPMENT_FINANCING: {
    level: "CRITICAL",
    guarantee: "COLLATERAL",
    label: "Bem em garantia",
    consequence: "O bem financiado é a garantia e pode ser retomado pelo credor.",
  },
  PAYROLL_LOAN: {
    level: "HIGH",
    guarantee: "PAYROLL",
    label: "Desconto em folha",
    consequence:
      "A parcela sai do salário antes de você receber. Não gera atraso, mas reduz a renda disponível todo mês e é difícil de suspender.",
  },
  OVERDRAFT: {
    level: "HIGH",
    guarantee: "NONE",
    label: "Juros altíssimos",
    consequence:
      "O cheque especial cobra uma das maiores taxas do mercado e se renova sozinho a cada mês em que o saldo não volta ao positivo.",
  },
  CARD_RENEGOTIATION: {
    level: "HIGH",
    guarantee: "NONE",
    label: "Juros altos",
    consequence:
      "Renegociação de cartão costuma carregar juros altos. Confira o CET antes de aceitar uma nova proposta sobre esta.",
  },
  PERSONAL_LOAN: {
    level: "MODERATE",
    guarantee: "NONE",
    label: "Sem garantia",
    consequence:
      "Sem bem dado em garantia: a cobrança recai sobre você e sobre seu nome, não sobre um bem que possa ser retomado.",
  },
  OTHER: {
    level: "MODERATE",
    guarantee: "NONE",
    label: "Sem garantia",
    consequence:
      "Sem bem dado em garantia: a cobrança recai sobre você e sobre seu nome, não sobre um bem que possa ser retomado.",
  },
};

/**
 * How dangerous this debt is, and why.
 *
 * A debt already in default is critical whatever it is secured by: the
 * consequence has stopped being hypothetical.
 */
export function classifyDebt(debt: Debt): DebtRisk {
  const base = BY_KIND[debt.kind];
  if (debt.status !== "IN_DEFAULT") return base;

  return {
    ...base,
    level: "CRITICAL",
    consequence: `Este contrato já está em atraso. ${base.consequence}`,
  };
}

const RANK: Record<DebtRiskLevel, number> = { CRITICAL: 0, HIGH: 1, MODERATE: 2 };

/** Most dangerous first; ties keep the larger balance ahead. */
export function sortByRisk(debts: readonly Debt[]): Debt[] {
  return [...debts].sort((a, b) => {
    const byLevel = RANK[classifyDebt(a).level] - RANK[classifyDebt(b).level];
    if (byLevel !== 0) return byLevel;
    return b.principalContracted.amount - a.principalContracted.amount;
  });
}

/** True when missing a payment can cost the household a good it depends on. */
export function putsAssetAtRisk(debt: Debt): boolean {
  return classifyDebt(debt).guarantee === "COLLATERAL";
}

export const RISK_LEVEL_LABELS: Record<DebtRiskLevel, string> = {
  CRITICAL: "Risco crítico",
  HIGH: "Risco alto",
  MODERATE: "Sem garantia",
};

/* ------------------------------------------------------------------ */
/* Essential services                                                  */
/* ------------------------------------------------------------------ */

/**
 * Bills whose non-payment removes something the household lives on.
 *
 * Keyed by the seeded category ids, so this recognises the categories every
 * household starts with and stays silent about the ones they invent - which is
 * the right failure: a wrong warning about a made-up category would teach
 * people to ignore the real ones.
 */
const ESSENTIAL_SERVICE_CONSEQUENCES: Record<string, string> = {
  energia: "corte de energia elétrica",
  agua: "corte do fornecimento de água",
  gas: "suspensão do fornecimento de gás",
  moradia: "risco de ação de despejo",
  condominio: "cobrança judicial e restrição ao uso de áreas comuns",
  internet: "suspensão da internet e do telefone",
  saude: "suspensão do plano de saúde",
  educacao: "bloqueio de matrícula ou de acesso às aulas",
};

/** What is lost if this bill stays unpaid, or null when nothing essential is. */
export function essentialServiceConsequence(categoryId: string | undefined): string | null {
  if (!categoryId) return null;
  return ESSENTIAL_SERVICE_CONSEQUENCES[categoryId] ?? null;
}

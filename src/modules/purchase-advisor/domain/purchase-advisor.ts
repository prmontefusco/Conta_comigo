import {
  addMonthsToKey,
  formatMonthKey,
  monthKeyOf,
  type CalendarDate,
  type MonthKey,
} from "@/core/date/calendar-date";
import { type Money, add, clampToZero, money, multiply, subtract } from "@/core/money/money";
import { impliedMonthlyRate } from "@/modules/debts/domain/debt";
import type { ForecastResult } from "@/modules/forecast/domain/forecast-types";
import type { StarterReserveStatus } from "@/modules/reserves/domain/starter-reserve";

/**
 * Antes de comprar.
 *
 * A única função prospectiva do produto: todo o resto administra a dívida que
 * já existe, e esta tenta evitar a próxima. Ela existe porque pessoas
 * endividadas continuam precisando comprar — a máquina de lavar quebra no mês
 * apertado, e fingir o contrário é a mesma desonestidade que prometer quitação
 * a quem está em déficit.
 *
 * ## Isto não é um portão
 *
 * O módulo nunca devolve "pode" ou "não pode". Ele devolve **caminhos**, cada
 * um com o que custa e o que faz com o plano de sair da dívida. Um aplicativo
 * que reprova a compra não conserta a máquina: a pessoa compra assim mesmo e
 * para de abrir o aplicativo.
 *
 * ## A unidade que responde às três perguntas
 *
 * "Vale a pena consertar?", "se eu esperar dois meses compro um que dure
 * mais?" e "a parcela cabe nos próximos meses?" parecem perguntas diferentes.
 * As duas primeiras são a mesma: **custo por mês de uso** — o total pago
 * dividido pelos meses que a coisa deve durar. Nessa unidade, um conserto de
 * R$ 380 que segura doze meses (R$ 31,67) e uma máquina de R$ 1.890 que dura
 * oito anos (R$ 19,69) ficam comparáveis, e a lavanderia a R$ 60 por mês
 * também.
 *
 * A vida útil é uma estimativa que a pessoa informa, e o módulo trata como
 * tal: sem ela, o custo por mês de uso é `null` e não aparece na tela. Um
 * número inventado aqui decidiria uma compra.
 *
 * A terceira pergunta é de fluxo, não de preço, e a resposta honesta não é um
 * "sim": é mês a mês, contra a projeção que a casa já tem. Uma parcela pode
 * caber em setembro e não caber em dezembro, quando cai o IPVA.
 */

/* ------------------------------------------------------------------ */
/* Entrada                                                             */
/* ------------------------------------------------------------------ */

/**
 * O que acontece se a compra não for feita.
 *
 * Deliberadamente sobre consequência, nunca sobre mérito. O aplicativo não
 * tem como saber se um celular é vaidade ou ferramenta de trabalho, e não é
 * papel dele julgar - é o mesmo princípio de `debt-risk.ts`.
 */
export type PurchaseUrgency =
  /** Quebrou, e a casa depende disso. */
  | "BROKEN_ESSENTIAL"
  /** Ainda funciona, mas está falhando. */
  | "FAILING"
  /** Sem isso, a renda ou os estudos ficam em risco. */
  | "WORK_OR_STUDY"
  /** Morte, doença, urgência familiar. Não há deliberação a fazer. */
  | "FAMILY_EMERGENCY"
  /** Vontade legítima, e dá para escolher a hora. */
  | "WANTED";

export const URGENCY_LABELS: Record<PurchaseUrgency, string> = {
  BROKEN_ESSENTIAL: "Quebrou, e a casa precisa disso",
  FAILING: "Ainda funciona, mas está falhando",
  WORK_OR_STUDY: "Preciso para trabalhar ou estudar",
  FAMILY_EMERGENCY: "Emergência familiar (saúde, falecimento)",
  WANTED: "Quero, e dá para escolher a hora",
};

export interface InstallmentOffer {
  readonly id: string;
  /** Como a loja apresentou: "10x sem juros", "12x no carnê". */
  readonly label: string;
  readonly installmentAmount: Money;
  readonly installmentCount: number;
  /** Entrada exigida, quando houver. */
  readonly downPayment?: Money;
}

export interface PurchaseAdvisorInput {
  readonly asOf: CalendarDate;
  readonly urgency: PurchaseUrgency;

  /** Preço à vista, quando a pessoa souber. */
  readonly cashPrice?: Money;
  readonly installmentOffers?: readonly InstallmentOffer[];

  /** Consertar o que já existe, em vez de trocar. */
  readonly repairCost?: Money;
  /** Quantos meses o conserto deve segurar. Estimativa de quem conserta. */
  readonly repairLifespanMonths?: number;
  /** Quantos meses o item novo deve durar. */
  readonly newLifespanMonths?: number;

  /** Pagar pelo serviço em vez do bem: lavanderia, aluguel. */
  readonly serviceMonthlyCost?: Money;

  /** Dinheiro livre hoje. */
  readonly availableCash: Money;
  readonly starterReserve: StarterReserveStatus;
  /**
   * O que sobra por mês depois de tudo o que a casa já assumiu.
   *
   * A mesma capacidade que o motor de recuperação usa, e pode ser negativa —
   * quem já não fecha o mês precisa ver isso, não um zero.
   */
  readonly monthlyCapacity: Money;
  readonly forecast: ForecastResult;
}

/* ------------------------------------------------------------------ */
/* Saída                                                               */
/* ------------------------------------------------------------------ */

export type PurchasePathKind = "CASH" | "INSTALLMENTS" | "WAIT_AND_PAY_CASH" | "REPAIR" | "SERVICE";

/**
 * Quão bem o caminho cabe. Ordenado do melhor para o pior.
 *
 * Nenhum destes é uma reprovação: são descrições do que acontece. "Não cabe"
 * é um fato sobre o mês, não um julgamento sobre a pessoa.
 */
export type PathVerdict =
  /** Cabe com folga. */
  | "FITS"
  /** Cabe, mas consome quase tudo o que sobra. */
  | "TIGHT"
  /** Consome a reserva de partida, que é o que evita voltar ao cartão. */
  | "EATS_RESERVE"
  /** Em algum mês do prazo, a parcela não cabe. */
  | "BREAKS_A_MONTH"
  /** A parcela é maior que tudo o que sobra. */
  | "DOES_NOT_FIT";

const VERDICT_RANK: Record<PathVerdict, number> = {
  FITS: 0,
  TIGHT: 1,
  EATS_RESERVE: 2,
  BREAKS_A_MONTH: 3,
  DOES_NOT_FIT: 4,
};

export const VERDICT_LABELS: Record<PathVerdict, string> = {
  FITS: "Cabe no seu mês",
  TIGHT: "Cabe apertado",
  EATS_RESERVE: "Consome sua reserva",
  BREAKS_A_MONTH: "Quebra um mês à frente",
  DOES_NOT_FIT: "Não cabe hoje",
};

export interface MonthFit {
  readonly month: MonthKey;
  readonly capacity: Money;
  readonly installment: Money;
  /** Sobra depois da parcela. Negativo quando falta. */
  readonly leftOver: Money;
  readonly fits: boolean;
}

export interface PurchasePath {
  readonly id: string;
  readonly kind: PurchasePathKind;
  readonly label: string;

  /** Tudo o que sai do bolso, do começo ao fim. */
  readonly totalPaid: Money;
  /** O que sai hoje. */
  readonly upfront: Money;
  readonly monthlyAmount?: Money;
  readonly months: number;

  /**
   * A taxa escondida na parcela, quando há preço à vista para comparar.
   *
   * Null quando não dá para calcular - e null é a resposta certa para mostrar,
   * porque uma taxa apresentada sem base é como se aceita a proposta cara
   * achando que é a barata.
   */
  readonly impliedMonthlyRate: number | null;

  /**
   * Total dividido pelos meses que a coisa deve durar.
   *
   * Null sem estimativa de vida útil. É o número que compara conserto, compra
   * nova e serviço na mesma unidade.
   */
  readonly costPerMonthOfUse: Money | null;
  readonly lifespanMonths?: number;

  readonly verdict: PathVerdict;
  /** Mês a mês, enquanto durar a parcela. Vazio para pagamento único. */
  readonly monthByMonth: readonly MonthFit[];
  /** O primeiro mês em que a parcela não cabe, se houver. */
  readonly firstMonthThatBreaks: MonthKey | null;
  /** Quanto sobra da reserva de partida depois do que sai hoje. */
  readonly reserveAfter: Money;
  readonly touchesStarterReserve: boolean;

  /**
   * Verdadeiro quando o mês fecha hoje e deixa de fechar por causa desta compra.
   *
   * É diferente de `firstMonthThatBreaks`, que aponta um mês difícil lá na
   * frente. Isto é sobre a **mudança de estado**: a casa está no azul todo
   * mês, e esta parcela é o que a tira de lá. É a frase mais forte que a tela
   * tem, e por isso só aparece quando é literalmente verdade — nunca para
   * quem já estava no vermelho antes de abrir a tela, porque aí a compra não
   * é a causa e culpá-la seria mentira.
   */
  readonly flipsMonthIntoDeficit: boolean;

  /** Fatos que valem dizer. Nunca conselhos, nunca repreensão. */
  readonly notes: readonly string[];
}

export interface PurchaseAdvice {
  /**
   * Verdadeiro quando não há decisão a tomar.
   *
   * Uma passagem para o enterro de um parente não passa por "vale a pena?".
   * A pergunta vira "como absorver isso com menos estrago", que é a tela de
   * emergência - e a interface encaminha para lá em vez de simular escolhas.
   */
  readonly skipDeliberation: boolean;
  readonly urgency: PurchaseUrgency;
  readonly paths: readonly PurchasePath[];
  /** Id do caminho com menor custo por mês de uso, quando dá para comparar. */
  readonly cheapestPerMonthOfUseId: string | null;
  /** Id do caminho de menor custo total entre os que cabem. */
  readonly cheapestViableId: string | null;
  /**
   * Verdadeiro quando nenhum caminho cabe no mês.
   *
   * É a situação mais provável para o público deste produto, e a que a tela
   * precisa tratar com cuidado: quatro cartões dizendo "não cabe", um embaixo
   * do outro e sem síntese, é o aplicativo virando a coisa que só diz não.
   */
  readonly nothingFits: boolean;
  /**
   * O menor desembolso imediato entre os caminhos, quando nenhum cabe.
   *
   * Não é uma recomendação: é o ponto de partida de uma conversa — quanto
   * falta para o caminho mais barato, e a partir daí dá para pedir prazo,
   * juntar, ou procurar alternativa.
   */
  readonly smallestUpfront: Money | null;
}

/* ------------------------------------------------------------------ */
/* Cálculo                                                             */
/* ------------------------------------------------------------------ */

/** Acima disto, a parcela consome quase toda a folga e o mês fica sem ar. */
const COMFORT_SHARE = 0.8;

export function advisePurchase(input: PurchaseAdvisorInput): PurchaseAdvice {
  const paths: PurchasePath[] = [];

  if (input.urgency === "FAMILY_EMERGENCY") {
    return {
      skipDeliberation: true,
      urgency: input.urgency,
      paths: [],
      cheapestPerMonthOfUseId: null,
      cheapestViableId: null,
      nothingFits: false,
      smallestUpfront: null,
    };
  }

  const capacityByMonth = monthlyCapacities(input);

  /* --- À vista -------------------------------------------------------- */

  if (input.cashPrice && input.cashPrice.amount > 0) {
    paths.push(
      singlePaymentPath({
        id: "cash",
        kind: "CASH",
        label: "Pagar à vista",
        amount: input.cashPrice,
        lifespanMonths: input.newLifespanMonths,
        input,
        notes: ["Pergunte o desconto à vista: quase toda loja tem, e poucas oferecem sozinhas."],
      }),
    );
  }

  /* --- Parcelado ------------------------------------------------------ */

  for (const offer of input.installmentOffers ?? []) {
    paths.push(installmentPath(offer, input, capacityByMonth));
  }

  /* --- Esperar e comprar à vista -------------------------------------- */

  const waiting = waitPath(input);
  if (waiting) paths.push(waiting);

  /* --- Consertar ------------------------------------------------------ */

  if (input.repairCost && input.repairCost.amount > 0) {
    const repairNotes: string[] = [];
    const newPerMonth = perMonthOfUse(input.cashPrice, input.newLifespanMonths);
    const repairPerMonth = perMonthOfUse(input.repairCost, input.repairLifespanMonths);

    if (newPerMonth && repairPerMonth && input.repairLifespanMonths) {
      repairNotes.push(
        repairPerMonth.amount <= newPerMonth.amount
          ? `Por mês de uso, o conserto sai mais barato que trocar (${formatBRL(repairPerMonth)} contra ${formatBRL(newPerMonth)}).`
          : `Por mês de uso, trocar sai mais barato que consertar (${formatBRL(newPerMonth)} contra ${formatBRL(repairPerMonth)}) — o conserto só compensa se durar mais que o esperado.`,
      );
    }

    if (input.cashPrice && newPerMonth) {
      const breakEven = Math.ceil(input.repairCost.amount / Math.max(newPerMonth.amount, 1));
      repairNotes.push(
        `O conserto se paga se o aparelho durar mais ${breakEven} ${breakEven === 1 ? "mês" : "meses"}.`,
      );
    }

    paths.push(
      singlePaymentPath({
        id: "repair",
        kind: "REPAIR",
        label: "Consertar o que você já tem",
        amount: input.repairCost,
        lifespanMonths: input.repairLifespanMonths,
        input,
        notes: repairNotes,
      }),
    );
  }

  /* --- Pagar pelo serviço --------------------------------------------- */

  if (input.serviceMonthlyCost && input.serviceMonthlyCost.amount > 0) {
    paths.push(servicePath(input, capacityByMonth));
  }

  const ordered = [...paths].sort((a, b) => {
    const byVerdict = VERDICT_RANK[a.verdict] - VERDICT_RANK[b.verdict];
    if (byVerdict !== 0) return byVerdict;
    return a.totalPaid.amount - b.totalPaid.amount;
  });

  const nothingFits =
    ordered.length > 0 &&
    ordered.every((path) => VERDICT_RANK[path.verdict] >= VERDICT_RANK.BREAKS_A_MONTH);

  const smallestUpfront = ordered
    .map((path) => path.upfront)
    .filter((value) => value.amount > 0)
    .sort((a, b) => a.amount - b.amount)[0];

  return {
    skipDeliberation: false,
    urgency: input.urgency,
    paths: ordered,
    cheapestPerMonthOfUseId: cheapestByPerMonthOfUse(ordered),
    cheapestViableId:
      ordered.find((path) => VERDICT_RANK[path.verdict] <= VERDICT_RANK.TIGHT)?.id ?? null,
    nothingFits,
    smallestUpfront: smallestUpfront ?? null,
  };
}

/* ------------------------------------------------------------------ */
/* Caminhos                                                            */
/* ------------------------------------------------------------------ */

function singlePaymentPath(args: {
  id: string;
  kind: PurchasePathKind;
  label: string;
  amount: Money;
  lifespanMonths: number | undefined;
  input: PurchaseAdvisorInput;
  notes: readonly string[];
}): PurchasePath {
  const { amount, input } = args;

  const impact = reserveImpact(input.availableCash, input.starterReserve.current, amount);

  const notes = [...args.notes];
  if (impact.touches && input.starterReserve.current.amount > 0) {
    notes.push(
      `Paga com ${formatBRL(subtract(input.starterReserve.current, impact.reserveAfter))} da reserva de partida, que fica em ${formatBRL(impact.reserveAfter)}. Sem colchão, o próximo imprevisto volta para o cartão.`,
    );
  }

  return {
    id: args.id,
    kind: args.kind,
    label: args.label,
    totalPaid: amount,
    upfront: amount,
    months: 0,
    impliedMonthlyRate: null,
    costPerMonthOfUse: perMonthOfUse(amount, args.lifespanMonths),
    ...(args.lifespanMonths ? { lifespanMonths: args.lifespanMonths } : {}),
    verdict: !impact.affordable ? "DOES_NOT_FIT" : impact.touches ? "EATS_RESERVE" : "FITS",
    monthByMonth: [],
    firstMonthThatBreaks: null,
    reserveAfter: impact.reserveAfter,
    touchesStarterReserve: impact.touches,
    // Pagamento único não compromete mês nenhum à frente: sai hoje e acabou.
    flipsMonthIntoDeficit: false,
    notes,
  };
}

function installmentPath(
  offer: InstallmentOffer,
  input: PurchaseAdvisorInput,
  capacityByMonth: readonly { month: MonthKey; capacity: Money }[],
): PurchasePath {
  const currency = offer.installmentAmount.currency;
  const down = offer.downPayment ?? money(0, currency);
  const totalPaid = add(down, multiply(offer.installmentAmount, offer.installmentCount));

  const financed = input.cashPrice ? clampToZero(subtract(input.cashPrice, down)) : undefined;
  const rate = financed
    ? impliedMonthlyRate(financed, offer.installmentAmount, offer.installmentCount)
    : null;

  // Mês a mês contra a projeção da casa. Uma parcela pode caber em setembro e
  // não caber em dezembro, quando cai o IPVA - e essa é a resposta honesta
  // para "cabe no meu bolso nos próximos meses?".
  const monthByMonth: MonthFit[] = capacityByMonth
    .slice(0, offer.installmentCount)
    .map(({ month, capacity }) => {
      const leftOver = subtract(capacity, offer.installmentAmount);
      return {
        month,
        capacity,
        installment: offer.installmentAmount,
        leftOver,
        fits: leftOver.amount >= 0,
      };
    });

  const broken = monthByMonth.find((fit) => !fit.fits);
  const impact = reserveImpact(input.availableCash, input.starterReserve.current, down);
  const touchesReserve = impact.touches;

  const tight =
    input.monthlyCapacity.amount > 0 &&
    offer.installmentAmount.amount > input.monthlyCapacity.amount * COMFORT_SHARE;

  const verdict: PathVerdict = broken
    ? monthByMonth[0] && !monthByMonth[0].fits
      ? "DOES_NOT_FIT"
      : "BREAKS_A_MONTH"
    : touchesReserve
      ? "EATS_RESERVE"
      : tight
        ? "TIGHT"
        : "FITS";

  // A casa fecha o mês hoje? Então esta parcela pode ser exatamente o que a
  // tira do azul — e isso merece ser dito como mudança de estado, não como
  // mais um mês difícil na tabela.
  const flipsMonthIntoDeficit =
    input.monthlyCapacity.amount >= 0 &&
    offer.installmentAmount.amount > input.monthlyCapacity.amount;

  const notes: string[] = [];

  if (flipsMonthIntoDeficit) {
    notes.push(
      `Hoje o seu mês fecha, com ${formatBRL(input.monthlyCapacity)} de folga. Com esta parcela de ${formatBRL(offer.installmentAmount)}, deixa de fechar — e o que faltar sai de alguma conta que já está comprometida.`,
    );
  }

  if (input.cashPrice) {
    const extra = subtract(totalPaid, input.cashPrice);
    if (extra.amount > 0) {
      notes.push(
        `São ${formatBRL(extra)} a mais que o preço à vista — o total pago é ${formatBRL(totalPaid)}, não ${formatBRL(offer.installmentAmount)}.`,
      );
    } else if (extra.amount === 0) {
      notes.push("Não há juro embutido: o total parcelado é igual ao preço à vista.");
    }
  }

  // "Sem juros" não é de graça: trava capacidade mensal por todo o prazo, e
  // capacidade é exatamente o que falta a quem está endividado.
  if (rate === null && input.monthlyCapacity.amount > 0) {
    const share = Math.round((offer.installmentAmount.amount / input.monthlyCapacity.amount) * 100);
    const last = capacityByMonth[Math.min(offer.installmentCount, capacityByMonth.length) - 1];
    notes.push(
      `Mesmo sem juros, compromete ${share}% da sua folga mensal${last ? ` até ${formatMonthKey(last.month)}` : ""}. Nesse período, um imprevisto tem menos espaço.`,
    );
  }

  if (broken) {
    notes.push(
      `Em ${formatMonthKey(broken.month)} faltam ${formatBRL(money(-broken.leftOver.amount, currency))} para essa parcela caber.`,
    );
  }

  return {
    id: offer.id,
    kind: "INSTALLMENTS",
    label: offer.label,
    totalPaid,
    upfront: down,
    monthlyAmount: offer.installmentAmount,
    months: offer.installmentCount,
    impliedMonthlyRate: rate,
    costPerMonthOfUse: perMonthOfUse(totalPaid, input.newLifespanMonths),
    ...(input.newLifespanMonths ? { lifespanMonths: input.newLifespanMonths } : {}),
    verdict,
    monthByMonth,
    firstMonthThatBreaks: broken?.month ?? null,
    reserveAfter: impact.reserveAfter,
    touchesStarterReserve: touchesReserve,
    flipsMonthIntoDeficit,
    notes,
  };
}

/**
 * Esperar, guardar e comprar à vista.
 *
 * O caminho que nenhuma calculadora de loja mostra, e que costuma ser o mais
 * barato. Só aparece quando é possível: sem folga mensal não há como guardar,
 * e oferecer isso a quem não tem sobra seria outro tipo de mentira.
 */
function waitPath(input: PurchaseAdvisorInput): PurchasePath | null {
  if (!input.cashPrice || input.cashPrice.amount <= 0) return null;
  if (input.monthlyCapacity.amount <= 0) return null;

  const currency = input.cashPrice.currency;

  // O que dá para gastar sem tocar no que já foi separado.
  //
  // Contra `current`, não contra `target`: quem guardou acima da meta da
  // reserva de partida não guardou por engano. Usar a meta aqui e o saldo em
  // `reserveImpact` fazia as duas metades do módulo discordarem sobre o que é
  // dinheiro disponível — e a tela dizia "pagar à vista consome sua reserva"
  // sem oferecer a espera que evitaria exatamente isso.
  const spendableToday = clampToZero(subtract(input.availableCash, input.starterReserve.current));
  const missing = clampToZero(subtract(input.cashPrice, spendableToday));
  const months = Math.ceil(missing.amount / input.monthlyCapacity.amount);

  // Já dá para pagar à vista hoje sem tocar na reserva: não há espera a propor.
  if (months <= 0) return null;
  // Mais de dois anos de espera não é um plano, é um não disfarçado.
  if (months > 24) return null;

  const notes = [
    `Guardando ${formatBRL(input.monthlyCapacity)} por mês, em ${months} ${months === 1 ? "mês" : "meses"} você paga à vista.`,
    "Esperar não mexe na sua data de quitação: nada de novo entra no orçamento.",
  ];

  const cheapestInstallment = [...(input.installmentOffers ?? [])]
    .map((offer) =>
      add(
        offer.downPayment ?? money(0, currency),
        multiply(offer.installmentAmount, offer.installmentCount),
      ),
    )
    .sort((a, b) => a.amount - b.amount)[0];

  if (cheapestInstallment) {
    const saving = subtract(cheapestInstallment, input.cashPrice);
    if (saving.amount > 0) {
      notes.push(`Economiza ${formatBRL(saving)} em relação ao melhor parcelamento que você tem.`);
    }
  }

  if (input.urgency === "BROKEN_ESSENTIAL" || input.urgency === "WORK_OR_STUDY") {
    notes.push(
      "Esperar tem custo próprio aqui: conte o que você gasta enquanto isso — lavanderia, transporte, o que for — antes de comparar.",
    );
  }

  return {
    id: "wait",
    kind: "WAIT_AND_PAY_CASH",
    label: `Esperar ${months} ${months === 1 ? "mês" : "meses"} e pagar à vista`,
    totalPaid: input.cashPrice,
    upfront: money(0, currency),
    monthlyAmount: input.monthlyCapacity,
    months,
    impliedMonthlyRate: null,
    costPerMonthOfUse: perMonthOfUse(input.cashPrice, input.newLifespanMonths),
    ...(input.newLifespanMonths ? { lifespanMonths: input.newLifespanMonths } : {}),
    verdict: "FITS",
    monthByMonth: [],
    firstMonthThatBreaks: null,
    reserveAfter: input.starterReserve.current,
    touchesStarterReserve: false,
    // Guardar não compromete o mês: é o contrário disso.
    flipsMonthIntoDeficit: false,
    notes,
  };
}

/** Pagar pelo serviço em vez do bem: lavanderia, aluguel, assinatura. */
function servicePath(
  input: PurchaseAdvisorInput,
  capacityByMonth: readonly { month: MonthKey; capacity: Money }[],
): PurchasePath {
  const monthly = input.serviceMonthlyCost!;
  const currency = monthly.currency;
  const horizon = Math.max(capacityByMonth.length, 1);

  const monthByMonth: MonthFit[] = capacityByMonth.map(({ month, capacity }) => {
    const leftOver = subtract(capacity, monthly);
    return { month, capacity, installment: monthly, leftOver, fits: leftOver.amount >= 0 };
  });

  const broken = monthByMonth.find((fit) => !fit.fits);
  const notes: string[] = [
    "Não vira patrimônio: você paga enquanto usar, e para de pagar quando parar.",
  ];

  if (input.cashPrice && input.cashPrice.amount > 0) {
    const breakEven = Math.ceil(input.cashPrice.amount / Math.max(monthly.amount, 1));
    notes.push(
      `Comprando à vista, o aparelho se paga em ${breakEven} ${breakEven === 1 ? "mês" : "meses"} de serviço.`,
    );
  }

  return {
    id: "service",
    kind: "SERVICE",
    label: "Pagar pelo serviço, sem comprar",
    // Só o horizonte da projeção: somar "para sempre" produziria um número
    // grande e sem sentido.
    totalPaid: multiply(monthly, horizon),
    upfront: money(0, currency),
    monthlyAmount: monthly,
    months: horizon,
    impliedMonthlyRate: null,
    costPerMonthOfUse: monthly,
    verdict: broken ? "BREAKS_A_MONTH" : "FITS",
    monthByMonth,
    firstMonthThatBreaks: broken?.month ?? null,
    reserveAfter: input.starterReserve.current,
    touchesStarterReserve: false,
    flipsMonthIntoDeficit:
      input.monthlyCapacity.amount >= 0 && monthly.amount > input.monthlyCapacity.amount,
    notes,
  };
}

/* ------------------------------------------------------------------ */
/* Auxiliares                                                          */
/* ------------------------------------------------------------------ */

/**
 * Quanto sobra em cada mês à frente, pela projeção da casa.
 *
 * Cai para a capacidade média quando a projeção não tem meses inteiros - sem
 * isso, uma conta recém-criada não teria resposta nenhuma para dar.
 */
function monthlyCapacities(
  input: PurchaseAdvisorInput,
): readonly { month: MonthKey; capacity: Money }[] {
  const currency = input.availableCash.currency;
  const whole = input.forecast.months.filter((month) => !month.isPartial);

  if (whole.length === 0) {
    const start = monthKeyOf(input.asOf);
    return Array.from({ length: 12 }, (_unused, index) => ({
      month: addMonthsToKey(start, index + 1),
      capacity: input.monthlyCapacity,
    }));
  }

  // A capacidade de um mês é o que entra menos o que já está comprometido
  // nele. É o mesmo número que a tela de projeção mostra como sobra.
  const observed = whole.map((month) => ({
    month: month.month,
    capacity: money(month.expectedInflows.amount - month.committedOutflows.amount, currency),
  }));

  // Parcelamentos longos passam do horizonte. Repetir o último mês conhecido é
  // melhor que parar a análise, e o rótulo da tela diz que dali em diante é
  // repetição da média.
  const last = observed[observed.length - 1]!;
  const extended = [...observed];
  while (extended.length < 24) {
    const previous = extended[extended.length - 1]!;
    extended.push({ month: addMonthsToKey(previous.month, 1), capacity: last.capacity });
  }

  return extended;
}

/** Total dividido pela vida útil. Null sem estimativa: não se inventa aqui. */
function perMonthOfUse(total: Money | undefined, lifespanMonths: number | undefined): Money | null {
  if (!total || !lifespanMonths || lifespanMonths <= 0) return null;
  return money(Math.round(total.amount / lifespanMonths), total.currency);
}

/**
 * O que um pagamento à vista faz com a reserva de partida.
 *
 * A reserva está **dentro** do dinheiro disponível: são os mesmos reais, com
 * um destino declarado. Um pagamento consome primeiro o que está fora dela e
 * só depois encosta no colchão - que é exatamente a ordem em que a vida gasta
 * o dinheiro de alguém.
 */
interface ReserveImpact {
  readonly reserveAfter: Money;
  readonly touches: boolean;
  /** Falso quando nem gastando tudo, reserva inclusive, o pagamento cabe. */
  readonly affordable: boolean;
}

function reserveImpact(availableCash: Money, reserveCurrent: Money, payment: Money): ReserveImpact {
  const outsideReserve = clampToZero(subtract(availableCash, reserveCurrent));
  const reachesReserve = clampToZero(subtract(payment, outsideReserve));

  return {
    reserveAfter: clampToZero(subtract(reserveCurrent, reachesReserve)),
    touches: reachesReserve.amount > 0,
    affordable: payment.amount <= availableCash.amount,
  };
}

/**
 * Qual caminho entrega mais uso por real.
 *
 * "Esperar" fica de fora: é o mesmo bem, pelo mesmo preço, comprado depois -
 * comparar os dois por custo de uso empataria sempre e roubaria o rótulo de
 * quem tem algo a dizer. A comparação que interessa é entre coisas
 * diferentes: consertar o velho, comprar o novo, ou pagar pelo serviço.
 */
function cheapestByPerMonthOfUse(paths: readonly PurchasePath[]): string | null {
  const comparable = paths.filter(
    (path) => path.costPerMonthOfUse !== null && path.kind !== "WAIT_AND_PAY_CASH",
  );
  if (comparable.length < 2) return null;
  return comparable.reduce((best, path) =>
    path.costPerMonthOfUse!.amount < best.costPerMonthOfUse!.amount ? path : best,
  ).id;
}

function formatBRL(value: Money): string {
  const negative = value.amount < 0;
  const absolute = Math.abs(value.amount);
  const reais = Math.floor(absolute / 100);
  const cents = absolute % 100;
  return `${negative ? "-" : ""}R$ ${reais.toLocaleString("pt-BR")},${String(cents).padStart(2, "0")}`;
}

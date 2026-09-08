import type { Instant } from "@/core/date/calendar-date";
import type { Money } from "@/core/money/money";
import type { UserId } from "@/modules/shared/domain/common";

/**
 * Assinatura.
 *
 * O estado do plano tem uma fonte de verdade do lado do servidor. O cliente lê,
 * nunca escreve: as Security Rules negam escrita a todos em `subscriptions`, e
 * só o Admin SDK grava ali (docs/adr/0009-server-side-payments.md).
 *
 * Tudo neste arquivo é puro. Quem cobra é a infraestrutura; quem decide se
 * alguém tem direito ao plano é este módulo, e isso precisa ser testável sem
 * rede e sem banco.
 */

export type UserPlan = "FREE" | "PREMIUM";

export type SubscriptionStatus = "NONE" | "PENDING" | "ACTIVE" | "EXPIRED" | "CANCELLED";

/* ------------------------------------------------------------------ */
/* Período de teste                                                    */
/* ------------------------------------------------------------------ */

/**
 * Dias de Premium que toda conta nova ganha.
 *
 * O site anunciava isto em cinco lugares e o código não implementava em
 * nenhum: não havia estado de teste, e `ensureUserProfile` gravava `FREE` e
 * parava por aí. Era propaganda enganosa em relação de consumo, e o conserto
 * mais barato era implementar a promessa.
 */
export const TRIAL_DAYS = 30;

/**
 * O teste é **derivado** da data de criação da conta, não gravado.
 *
 * As Security Rules negam escrita de cliente em `subscriptions` — só o Admin
 * SDK grava ali (ADR 0009). Um teste que precisasse de escrita exigiria uma
 * rota de servidor no cadastro, mais um ponto de falha logo no primeiro
 * minuto de uso. Derivar de `createdAt` dá o mesmo resultado, é a mesma
 * função no cliente e no servidor, e não pode dessincronizar.
 */
export function trialEndsAt(accountCreatedAt: Instant | undefined): Instant | null {
  if (!accountCreatedAt) return null;
  const created = new Date(accountCreatedAt).getTime();
  if (!Number.isFinite(created)) return null;
  return new Date(created + TRIAL_DAYS * 86_400_000).toISOString() as Instant;
}

/** Dias que ainda faltam do teste. Zero quando acabou ou nunca houve. */
export function trialDaysRemaining(
  accountCreatedAt: Instant | undefined,
  now: Date = new Date(),
): number {
  const ends = trialEndsAt(accountCreatedAt);
  if (!ends) return 0;
  const remaining = Math.ceil((new Date(ends).getTime() - now.getTime()) / 86_400_000);
  return Math.max(0, remaining);
}

export function isWithinTrial(
  accountCreatedAt: Instant | undefined,
  now: Date = new Date(),
): boolean {
  const ends = trialEndsAt(accountCreatedAt);
  return ends !== null && now.getTime() < new Date(ends).getTime();
}

export type SubscriptionCycle = "MONTHLY" | "YEARLY";

export type PaymentProvider = "ASAAS" | "MANUAL";

/**
 * Identifica o produto na conta do provedor.
 *
 * A mesma conta ASAAS atende mais de um produto. Sem isso, um pagamento feito
 * noutro produto poderia, em tese, ativar assinatura aqui.
 */
export const PRODUCT_CODE = "conta-comigo";

export interface Subscription {
  readonly userId: UserId;
  readonly plan: UserPlan;
  readonly status: SubscriptionStatus;
  readonly cycle?: SubscriptionCycle;
  readonly provider?: PaymentProvider;
  /** Identificador da cobrança no provedor, usado para reconciliar. */
  readonly externalTxId?: string;
  /** Instante em que o direito ao plano termina. */
  readonly expiresAt?: Instant;
  readonly activatedAt?: Instant;
  readonly updatedAt: Instant;
}

export function freeSubscription(userId: UserId, now: Instant): Subscription {
  return { userId, plan: "FREE", status: "NONE", updatedAt: now };
}

/**
 * O plano que a pessoa efetivamente tem agora.
 *
 * Uma assinatura vencida vira FREE aqui, na leitura. Isso evita depender de um
 * job agendado para rebaixar planos — e evita o bug em que uma assinatura
 * expirada continua sem anúncios para sempre porque ninguém rodou o job.
 *
 * O período de teste de 30 dias exige que o e-mail da conta esteja verificado
 * (`emailVerified: true`). Sem isso, contas criadas com e-mails descartáveis ou
 * fictícios permanecem no plano FREE até a confirmação do e-mail.
 */
export function resolveEffectivePlan(
  subscription: Subscription | null | undefined,
  now: Date = new Date(),
  /** Quando a conta foi criada, para o período de teste. */
  accountCreatedAt?: Instant,
  /** Se o e-mail da conta foi verificado (padrão true para retrocompatibilidade). */
  emailVerified: boolean = true,
): UserPlan {
  if (isSubscriptionActive(subscription, now)) return "PREMIUM";
  // Uma assinatura paga que venceu não volta a ser teste: o teste é dos
  // primeiros trinta dias da conta, e esses já passaram há muito.
  // O teste também exige e-mail confirmado contra abusos de e-mails descartáveis.
  if (emailVerified && isWithinTrial(accountCreatedAt, now)) return "PREMIUM";
  return "FREE";
}

function isSubscriptionActive(subscription: Subscription | null | undefined, now: Date): boolean {
  if (!subscription) return false;
  if (subscription.plan !== "PREMIUM") return false;
  if (subscription.status !== "ACTIVE") return false;
  if (subscription.expiresAt && new Date(subscription.expiresAt).getTime() <= now.getTime()) {
    return false;
  }
  return true;
}

export function isPremium(
  subscription: Subscription | null | undefined,
  now: Date = new Date(),
  accountCreatedAt?: Instant,
  emailVerified: boolean = true,
): boolean {
  return resolveEffectivePlan(subscription, now, accountCreatedAt, emailVerified) === "PREMIUM";
}

/** Como a pessoa chegou ao Premium: assinatura paga, teste, ou nenhum. */
export type PlanSource = "PAID" | "TRIAL" | "NONE";

export function planSource(
  subscription: Subscription | null | undefined,
  accountCreatedAt: Instant | undefined,
  now: Date = new Date(),
  emailVerified: boolean = true,
): PlanSource {
  if (isSubscriptionActive(subscription, now)) return "PAID";
  if (emailVerified && isWithinTrial(accountCreatedAt, now)) return "TRIAL";
  return "NONE";
}

/** Se a conta é recente e precisa apenas confirmar o e-mail para desbloquear o teste de 30 dias. */
export function isPendingEmailVerificationForTrial(
  subscription: Subscription | null | undefined,
  accountCreatedAt: Instant | undefined,
  emailVerified: boolean,
  now: Date = new Date(),
): boolean {
  if (isSubscriptionActive(subscription, now)) return false;
  return !emailVerified && isWithinTrial(accountCreatedAt, now);
}

/** Dias que faltam para vencer. Negativo se já venceu, null se não há prazo. */
export function daysUntilExpiry(
  subscription: Subscription | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!subscription?.expiresAt) return null;
  const millis = new Date(subscription.expiresAt).getTime() - now.getTime();
  return Math.ceil(millis / 86_400_000);
}

/**
 * Dias antes do vencimento em que a renovação antecipada abre.
 *
 * Existe aqui, e não nas duas pontas, porque a tela e a rota precisam concordar:
 * se a tela oferecesse renovação antes da rota aceitar, o botão só poderia
 * devolver 409.
 */
export const RENEWAL_WINDOW_DAYS = 10;

/** Verdadeiro quando faz sentido renovar: o plano vale, mas está perto do fim. */
export function isWithinRenewalWindow(
  subscription: Subscription | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!isPremium(subscription, now)) return false;
  const remaining = daysUntilExpiry(subscription, now);
  // Sem prazo não há o que renovar — e não há como estar perto do fim.
  return remaining !== null && remaining <= RENEWAL_WINDOW_DAYS;
}

export function cycleDurationMs(cycle: SubscriptionCycle): number {
  return cycle === "MONTHLY" ? 30 * 86_400_000 : 365 * 86_400_000;
}

/**
 * Estende a assinatura a partir de um pagamento já confirmado.
 *
 * Estende a partir do vencimento atual quando ele ainda está no futuro, e não a
 * partir de hoje: quem renova antes do fim não deve perder os dias que já
 * pagou.
 */
export function activate(
  current: Subscription | null,
  input: {
    readonly userId: UserId;
    readonly cycle: SubscriptionCycle;
    readonly provider: PaymentProvider;
    readonly externalTxId: string;
    readonly now: Date;
  },
): Subscription {
  const nowMs = input.now.getTime();
  const currentExpiry = current?.expiresAt ? new Date(current.expiresAt).getTime() : 0;
  const base = Math.max(nowMs, currentExpiry);
  const instant = (ms: number) => new Date(ms).toISOString() as Instant;

  return {
    userId: input.userId,
    plan: "PREMIUM",
    status: "ACTIVE",
    cycle: input.cycle,
    provider: input.provider,
    externalTxId: input.externalTxId,
    expiresAt: instant(base + cycleDurationMs(input.cycle)),
    activatedAt: current?.activatedAt ?? instant(nowMs),
    updatedAt: instant(nowMs),
  };
}

/** Marca uma cobrança aberta, ainda não paga. */
export function markPending(
  current: Subscription | null,
  input: {
    readonly userId: UserId;
    readonly cycle: SubscriptionCycle;
    readonly provider: PaymentProvider;
    readonly externalTxId: string;
    readonly now: Date;
  },
): Subscription {
  const instant = input.now.toISOString() as Instant;

  return {
    ...(current ?? freeSubscription(input.userId, instant)),
    userId: input.userId,
    // Uma cobrança aberta não concede nada. Só o pagamento confirmado concede.
    plan: current?.plan === "PREMIUM" ? "PREMIUM" : "FREE",
    status: "PENDING",
    cycle: input.cycle,
    provider: input.provider,
    externalTxId: input.externalTxId,
    updatedAt: instant,
  };
}

export function cancel(current: Subscription, now: Date): Subscription {
  return {
    ...current,
    // Cancelar não tira o que já foi pago: o direito vai até o vencimento.
    status: "CANCELLED",
    updatedAt: now.toISOString() as Instant,
  };
}

/* ------------------------------------------------------------------ */
/* Catálogo de planos                                                  */
/* ------------------------------------------------------------------ */

export interface PlanOption {
  readonly cycle: SubscriptionCycle;
  readonly price: Money;
  readonly label: string;
}

/**
 * Preços definidos no servidor, nunca escolhidos pelo cliente.
 *
 * O valor vem de configuração, não do código: preço muda por decisão de
 * negócio, e trocá-lo não deveria exigir um commit. Enquanto não houver
 * configuração válida, o catálogo fica vazio e o checkout permanece fechado —
 * é melhor não vender do que vender pelo preço errado.
 */
export type PlanCatalogue = Readonly<Partial<Record<SubscriptionCycle, PlanOption>>>;

export const CYCLE_LABELS: Readonly<Record<SubscriptionCycle, string>> = {
  MONTHLY: "Mensal",
  YEARLY: "Anual",
};

/**
 * Lê um preço em centavos inteiros.
 *
 * Centavos, e não reais, para não haver dúvida sobre separador decimal: "5.00"
 * e "5,00" são a mesma intenção e o mesmo tropeço. Devolve null para qualquer
 * coisa que não seja um inteiro positivo — um preço inválido fecha o checkout
 * em vez de virar zero.
 */
export function parsePlanPrice(raw: string | undefined): Money | null {
  if (typeof raw !== "string" || raw.trim() === "") return null;

  const parsed = Number(raw.trim());
  if (!Number.isSafeInteger(parsed) || parsed <= 0) return null;

  return { amount: parsed, currency: "BRL" };
}

/**
 * Monta o catálogo com os ciclos que tiverem preço válido.
 *
 * Um ciclo sem preço simplesmente não é oferecido. Vender só o anual é uma
 * situação legítima; vender o mensal por zero não é.
 */
export function buildPlanCatalogue(prices: {
  readonly monthly?: string | undefined;
  readonly yearly?: string | undefined;
}): PlanCatalogue {
  const monthly = parsePlanPrice(prices.monthly);
  const yearly = parsePlanPrice(prices.yearly);

  return {
    ...(monthly
      ? { MONTHLY: { cycle: "MONTHLY", price: monthly, label: CYCLE_LABELS.MONTHLY } }
      : {}),
    ...(yearly ? { YEARLY: { cycle: "YEARLY", price: yearly, label: CYCLE_LABELS.YEARLY } } : {}),
  };
}

export function isPlanCatalogueConfigured(catalogue: PlanCatalogue): boolean {
  return Object.keys(catalogue).length > 0;
}

/**
 * Quanto o anual economiza por mês em relação ao mensal.
 *
 * Um fato, não um argumento de venda: se o anual não for mais barato, devolve
 * null e a interface não inventa vantagem nenhuma.
 */
export function yearlySavingPerMonth(catalogue: PlanCatalogue): Money | null {
  const monthly = catalogue.MONTHLY?.price;
  const yearly = catalogue.YEARLY?.price;
  if (!monthly || !yearly) return null;

  const yearlyPerMonth = Math.round(yearly.amount / 12);
  const saving = monthly.amount - yearlyPerMonth;

  return saving > 0 ? { amount: saving, currency: "BRL" } : null;
}

/* ------------------------------------------------------------------ */
/* Referência externa                                                  */
/* ------------------------------------------------------------------ */

export interface ExternalReference {
  readonly product: string;
  readonly userId: UserId;
  readonly cycle: SubscriptionCycle;
}

export function encodeExternalReference(reference: ExternalReference): string {
  return JSON.stringify(reference);
}

/**
 * Lê a referência que o provedor devolve, sem confiar nela.
 *
 * Devolve null para qualquer coisa que não seja deste produto — inclusive uma
 * cobrança legítima de outro produto na mesma conta ASAAS.
 */
export function decodeExternalReference(raw: unknown): ExternalReference | null {
  if (typeof raw !== "string" || raw.trim() === "") return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;

    const candidate = parsed as Record<string, unknown>;
    if (candidate.product !== PRODUCT_CODE) return null;
    if (typeof candidate.userId !== "string" || candidate.userId === "") return null;
    if (candidate.cycle !== "MONTHLY" && candidate.cycle !== "YEARLY") return null;

    return {
      product: PRODUCT_CODE,
      userId: candidate.userId,
      cycle: candidate.cycle,
    };
  } catch {
    return null;
  }
}

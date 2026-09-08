import { type Money, add, money, clampToZero } from "@/core/money/money";

export type ReflectionStatus = "IN_PROGRESS" | "ABANDONED" | "PURCHASED";

export interface ImpulseReflection {
  readonly id: string;
  readonly householdId: string;
  readonly itemName: string;
  readonly amount: Money;
  readonly reason: string;
  readonly createdAt: string; // ISO 8601
  readonly unlockAt: string; // ISO 8601
  readonly status: ReflectionStatus;
  readonly resolvedAt?: string;
  readonly reflectionNote?: string;
}

export interface ReflectionProgress {
  readonly isLocked: boolean;
  readonly remainingHours: number;
  readonly remainingMinutes: number;
  readonly percentElapsed: number;
}

export interface SelfControlStats {
  readonly totalReflections: number;
  readonly abandonedCount: number;
  readonly purchasedCount: number;
  readonly inProgressCount: number;
  readonly totalSaved: Money;
  readonly abandonmentRate: number; // 0 to 1
}

/**
 * Cria uma nova trava de impulso (período de reflexão de 24h por padrão).
 */
export function createImpulseReflection(params: {
  id?: string;
  householdId: string;
  itemName: string;
  amount: Money;
  reason?: string;
  durationHours?: number;
  now?: Date;
}): ImpulseReflection {
  const now = params.now ?? new Date();
  const durationHours = params.durationHours ?? 24;
  const unlockDate = new Date(now.getTime() + durationHours * 60 * 60 * 1000);

  return {
    id: params.id ?? `refl_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    householdId: params.householdId,
    itemName: params.itemName.trim() || "Item sem nome",
    amount: clampToZero(params.amount),
    reason: params.reason?.trim() || "Desejo de compra sob reflexão",
    createdAt: now.toISOString(),
    unlockAt: unlockDate.toISOString(),
    status: "IN_PROGRESS",
  };
}

/**
 * Calcula o status de tempo restante da trava de reflexão.
 */
export function checkReflectionStatus(
  reflection: ImpulseReflection,
  nowDate?: Date,
): ReflectionProgress {
  const now = (nowDate ?? new Date()).getTime();
  const start = new Date(reflection.createdAt).getTime();
  const end = new Date(reflection.unlockAt).getTime();

  const totalDuration = Math.max(1, end - start);
  const elapsed = Math.max(0, now - start);
  const remainingMs = Math.max(0, end - now);

  const percentElapsed = Math.min(100, Math.max(0, Math.round((elapsed / totalDuration) * 100)));
  const remainingHours = Math.floor(remainingMs / (1000 * 60 * 60));
  const remainingMinutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));

  return {
    isLocked: remainingMs > 0 && reflection.status === "IN_PROGRESS",
    remainingHours,
    remainingMinutes,
    percentElapsed,
  };
}

/**
 * Resolve uma reflexão com a decisão final do usuário:
 * - "ABANDONED": O usuário desistiu da compra (vitória de autocontrole!)
 * - "PURCHASED": O usuário deliberou friamente e decidiu realizar a compra.
 */
export function resolveReflection(
  reflection: ImpulseReflection,
  decision: "ABANDONED" | "PURCHASED",
  note?: string,
  nowDate?: Date,
): ImpulseReflection {
  const now = nowDate ?? new Date();
  return {
    ...reflection,
    status: decision,
    resolvedAt: now.toISOString(),
    ...(note ? { reflectionNote: note.trim() } : {}),
  };
}

/**
 * Soma o valor total economizado com itens em que a pessoa desistiu após o período de reflexão.
 */
export function totalSavedBySelfControl(reflections: readonly ImpulseReflection[]): Money {
  return reflections
    .filter((r) => r.status === "ABANDONED")
    .reduce((sum, r) => add(sum, r.amount), money(0));
}

/**
 * Estatísticas consolidadas de autocontrole.
 */
export function getSelfControlStats(
  reflections: readonly ImpulseReflection[],
): SelfControlStats {
  let abandonedCount = 0;
  let purchasedCount = 0;
  let inProgressCount = 0;

  for (const r of reflections) {
    if (r.status === "ABANDONED") abandonedCount++;
    else if (r.status === "PURCHASED") purchasedCount++;
    else if (r.status === "IN_PROGRESS") inProgressCount++;
  }

  const totalCompleted = abandonedCount + purchasedCount;
  const abandonmentRate = totalCompleted > 0 ? abandonedCount / totalCompleted : 0;

  return {
    totalReflections: reflections.length,
    abandonedCount,
    purchasedCount,
    inProgressCount,
    totalSaved: totalSavedBySelfControl(reflections),
    abandonmentRate: Math.round(abandonmentRate * 100) / 100,
  };
}

const STORAGE_KEY_PREFIX = "cc_impulse_reflections_";

/**
 * Salva localmente as reflexões do domicílio (persistência segura e instantânea).
 */
export function loadLocalReflections(householdId: string): ImpulseReflection[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${householdId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export function saveLocalReflections(householdId: string, reflections: readonly ImpulseReflection[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(
      `${STORAGE_KEY_PREFIX}${householdId}`,
      JSON.stringify(reflections),
    );
  } catch {
    // Ignora erro de cota ou navegação anônima
  }
}

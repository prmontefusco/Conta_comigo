import "server-only";

/**
 * Limite de requisições por chave, em janela fixa.
 *
 * Existe por causa de uma rota só: a consultoria de IA chama um modelo cobrado
 * por token. Autenticar impede que um anônimo gaste a chave; não impede que uma
 * conta autenticada, num laço, gaste sozinha o orçamento do mês.
 *
 * **O que este limitador não é.** A contagem vive na memória do processo. Com
 * `maxInstances: 2` no App Hosting, o teto real é o dobro do configurado, e um
 * deploy zera as janelas. Isso é aceitável para conter abuso e custo acidental,
 * e não seria aceitável para proteger algo cuja violação é irreversível. Um
 * limite exato exige estado compartilhado (Firestore ou Redis), que é a troca a
 * fazer quando houver mais de uma instância importando.
 */

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();

/** Acima disto, a limpeza oportunista roda antes de inserir uma chave nova. */
const CLEANUP_THRESHOLD = 10_000;

export interface RateLimitResult {
  readonly allowed: boolean;
  /** Segundos até a janela abrir de novo. Serve para o cabeçalho `Retry-After`. */
  readonly retryAfterSeconds: number;
}

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): RateLimitResult {
  const existing = windows.get(key);

  if (!existing || now >= existing.resetAt) {
    if (windows.size >= CLEANUP_THRESHOLD) purgeExpired(now);
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

/**
 * Sem isto, o mapa cresce com o número de usuários já vistos e nunca encolhe —
 * uma fuga de memória lenta o bastante para só aparecer em produção.
 */
function purgeExpired(now: number): void {
  for (const [key, window] of windows) {
    if (now >= window.resetAt) windows.delete(key);
  }
}

/** Apenas para os testes: nenhuma janela sobrevive de um caso para o outro. */
export function resetRateLimits(): void {
  windows.clear();
}

import "server-only";

import { adminDb } from "@/lib/firebase/admin";
import { describeError, logger } from "@/lib/observability/logger";
import { checkRateLimit as checkInMemory, type RateLimitResult } from "./rate-limit";

/**
 * Limite de requisições compartilhado entre instâncias.
 *
 * O limitador em memória sempre foi honesto sobre a própria limitação — o
 * comentário dele dizia que a contagem vive no processo, que o teto real é
 * multiplicado pelo número de instâncias e que um deploy zera as janelas.
 * Aceitável enquanto não havia chave de modelo; um problema de custo no dia em
 * que houver, porque é exatamente aí que alguém num laço vira dinheiro.
 *
 * Firestore resolve sem infraestrutura nova: um documento por chave e janela,
 * incrementado em transação, apagado sozinho pela política de TTL.
 *
 * ## Por que a falha é permissiva, e não restritiva
 *
 * Se o Firestore não responder, este limitador **deixa passar para o
 * limitador em memória** em vez de bloquear. Um limitador que nega quando a
 * própria infraestrutura falha derruba a função para todo mundo por um
 * problema que não é do usuário. O que se perde é a precisão entre
 * instâncias; o que resta é o teto local, que é o que existia antes — e a
 * autenticação, que continua barrando anônimo.
 *
 * ## A coleção
 *
 * `rateLimits/{key}` é escrita **apenas** pelo Admin SDK. As Security Rules
 * negam tudo ali para o cliente, como em `subscriptions`: uma contagem que o
 * navegador pudesse zerar não seria um limite.
 */

const COLLECTION = "rateLimits";

/** Janelas antigas somem sozinhas por TTL; ver docs/SECURITY.md. */
export const TTL_FIELD = "expiresAt";

interface WindowDoc {
  readonly count: number;
  readonly resetAtMs: number;
}

/**
 * Conta esta requisição e diz se ela cabe.
 *
 * A chave inclui o início da janela, então cada janela é um documento novo e
 * a transação nunca disputa com a janela anterior.
 */
export async function checkSharedRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number = Date.now(),
): Promise<RateLimitResult> {
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const resetAtMs = windowStart + windowMs;
  const documentId = `${key.replace(/\//g, "_")}__${windowStart}`;

  try {
    const reference = adminDb().collection(COLLECTION).doc(documentId);

    const count = await adminDb().runTransaction(async (transaction) => {
      const snapshot = await transaction.get(reference);
      const current = (snapshot.data() as WindowDoc | undefined)?.count ?? 0;
      const next = current + 1;

      transaction.set(reference, {
        count: next,
        resetAtMs,
        // O Firestore apaga o documento depois desta data, desde que a
        // política de TTL esteja configurada para o campo. Sem ela nada
        // quebra: a coleção só cresce, e o custo aparece na conta.
        [TTL_FIELD]: new Date(resetAtMs + windowMs),
      });

      return next;
    });

    if (count > limit) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((resetAtMs - now) / 1000)),
      };
    }

    return { allowed: true, retryAfterSeconds: 0 };
  } catch (error) {
    // Ver o comentário do topo: cair para o teto local é pior que o limite
    // exato e muito melhor que negar a função a quem não tem culpa.
    logger.warn("Limitador compartilhado indisponível; usando o teto local.", {
      operation: "checkSharedRateLimit",
      ...describeError(error),
    });
    return checkInMemory(key, limit, windowMs, now);
  }
}

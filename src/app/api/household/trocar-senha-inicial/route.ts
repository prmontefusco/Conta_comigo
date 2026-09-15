import { NextResponse } from "next/server";
import { z } from "zod";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { instant } from "@/core/date/calendar-date";
import { describeError, logger } from "@/lib/observability/logger";
import { requireAuth } from "@/server/auth-guard";

/**
 * Troca a senha gerada por uma escolhida pela própria pessoa, no primeiro
 * acesso de uma conta criada por um administrador (`criar-membro/route.ts`).
 *
 * Passa pelo Admin SDK, e não pelo `updatePassword` do cliente, porque a conta
 * acabou de nascer com uma senha que a pessoa não escolheu: exigir que ela
 * prove a senha atual de novo aqui não provaria nada além do que o próprio
 * token de sessão já prova. O token identifica quem está chamando; a marca
 * `mustChangePassword` no Firestore é o que decide se a rota aceita o pedido.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const requestSchema = z.object({
  householdId: z.string().trim().min(1),
  newPassword: z.string().min(8).max(128),
});

export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if ("errorResponse" in auth) return auth.errorResponse;

  const body: unknown = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_REQUEST", message: "Use pelo menos 8 caracteres para a nova senha." },
      { status: 400 },
    );
  }

  const { householdId, newPassword } = parsed.data;
  const db = adminDb();
  const memberRef = db.doc(`households/${householdId}/members/${auth.caller.uid}`);
  const memberSnap = await memberRef.get();
  const member = memberSnap.data();

  if (!memberSnap.exists || member?.status !== "ACTIVE") {
    return NextResponse.json(
      { error: "NOT_FOUND", message: "Não encontramos sua participação neste grupo." },
      { status: 404 },
    );
  }

  if (member.mustChangePassword !== true) {
    return NextResponse.json(
      {
        error: "NOT_REQUIRED",
        message: "Esta conta não precisa trocar a senha por aqui. Use “Esqueci minha senha”.",
      },
      { status: 400 },
    );
  }

  try {
    await adminAuth().updateUser(auth.caller.uid, { password: newPassword });
  } catch (error) {
    logger.error("Falha ao trocar a senha inicial.", {
      operation: "trocar-senha-inicial",
      ...describeError(error),
    });
    return NextResponse.json(
      { error: "UPDATE_FAILED", message: "Não foi possível trocar a senha agora. Tente novamente." },
      { status: 500 },
    );
  }

  await memberRef.update({ mustChangePassword: false, updatedAt: instant() });

  return NextResponse.json({ ok: true });
}

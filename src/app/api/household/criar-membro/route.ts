import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { instant } from "@/core/date/calendar-date";
import { describeError, logger } from "@/lib/observability/logger";
import { canAddOne } from "@/modules/billing/domain/plan-limits";
import { resolveCallerPlan } from "@/server/plan-guard";
import { requireAuth } from "@/server/auth-guard";
import { HOUSEHOLD_ROLES, type HouseholdRole } from "@/modules/shared/domain/common";

/**
 * O administrador cria a conta da outra pessoa, em vez de pedir que ela crie
 * a própria e devolva um identificador de 28 caracteres.
 *
 * A troca de segurança é deliberada: hoje só o Firebase Auth confirma "este
 * e-mail é seu" (fluxo de convite, `invites.ts`). Aqui é o administrador quem
 * vouches por isso, então a conta nasce com `emailVerified: true` — sem essa
 * marca a pessoa nunca passaria da tela de confirmação de e-mail, que ela não
 * tem como responder porque nunca pediu a própria conta.
 *
 * Não é um convite maior: a pessoa entra pronta, com uma senha gerada aqui e
 * mostrada uma única vez para o administrador repassar. Ninguém além dele vê
 * essa senha — ela nunca é gravada no Firestore.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ASSIGNABLE_ROLES = HOUSEHOLD_ROLES.filter(
  (role) => role !== "OWNER" && role !== "DEPENDENT",
) as Exclude<HouseholdRole, "OWNER" | "DEPENDENT">[];

const requestSchema = z.object({
  householdId: z.string().trim().min(1),
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  role: z.enum(ASSIGNABLE_ROLES as [string, ...string[]]),
});

/** Sem caracteres ambíguos (0/O, 1/l/I), porque alguém vai digitar isto de cabeça. */
const PASSWORD_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function generatePassword(length = 12): string {
  const bytes = randomBytes(length);
  let password = "";
  for (const byte of bytes) {
    password += PASSWORD_ALPHABET[byte % PASSWORD_ALPHABET.length];
  }
  return password;
}

export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if ("errorResponse" in auth) return auth.errorResponse;

  const body: unknown = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_REQUEST", message: "Confira o nome, o e-mail e o papel informados." },
      { status: 400 },
    );
  }

  const { householdId, name, role } = parsed.data;
  const email = parsed.data.email.trim().toLowerCase();
  const db = adminDb();

  const householdRef = db.doc(`households/${householdId}`);
  const callerMemberRef = db.doc(`households/${householdId}/members/${auth.caller.uid}`);
  const [householdSnap, callerMemberSnap] = await Promise.all([
    householdRef.get(),
    callerMemberRef.get(),
  ]);

  if (!householdSnap.exists) {
    return NextResponse.json(
      { error: "NOT_FOUND", message: "Este grupo não existe mais." },
      { status: 404 },
    );
  }

  const callerRole = callerMemberSnap.data()?.role as HouseholdRole | undefined;
  const callerActive = callerMemberSnap.data()?.status === "ACTIVE";
  if (!callerActive || (callerRole !== "OWNER" && callerRole !== "ADMIN")) {
    return NextResponse.json(
      { error: "PERMISSION_DENIED", message: "Só quem administra o grupo pode adicionar pessoas." },
      { status: 403 },
    );
  }

  const membersSnap = await db
    .collection(`households/${householdId}/members`)
    .where("status", "==", "ACTIVE")
    .get();
  const seats = membersSnap.docs.filter((d) => d.data().role !== "DEPENDENT").length;

  const { plan } = await resolveCallerPlan(auth.caller.uid, auth.caller.emailVerified);
  const room = canAddOne("members", plan, seats);
  if (!room.allowed) {
    return NextResponse.json({ error: "PLAN_LIMIT", message: room.message }, { status: 400 });
  }

  const password = generatePassword();
  let newUid: string;

  try {
    const created = await adminAuth().createUser({
      email,
      password,
      displayName: name,
      emailVerified: true,
    });
    newUid = created.uid;
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "auth/email-already-exists") {
      return NextResponse.json(
        {
          error: "EMAIL_IN_USE",
          message:
            "Já existe uma conta com esse e-mail. Peça para a pessoa entrar com a conta dela, ou use “Convidar por e-mail”.",
        },
        { status: 409 },
      );
    }
    logger.error("Falha ao criar conta de membro.", {
      operation: "criar-membro",
      ...describeError(error),
    });
    return NextResponse.json(
      { error: "CREATE_FAILED", message: "Não foi possível criar a conta agora. Tente novamente." },
      { status: 500 },
    );
  }

  const now = instant();
  try {
    await householdRef.update({ memberUids: FieldValue.arrayUnion(newUid), updatedAt: now });
    await db.doc(`households/${householdId}/members/${newUid}`).set({
      uid: newUid,
      householdId,
      displayName: name,
      email,
      role,
      status: "ACTIVE",
      joinedAt: now,
      createdAt: now,
      updatedAt: now,
      createdBy: auth.caller.uid,
      // A senha foi gerada aqui, não escolhida pela pessoa: ela precisa trocar
      // no primeiro acesso (ver /api/household/trocar-senha-inicial).
      mustChangePassword: true,
    });
  } catch (error) {
    // A conta já existe no Auth mas não entrou no grupo - desfaz, ou vira um
    // login órfão que ninguém no app consegue ver ou remover.
    await adminAuth()
      .deleteUser(newUid)
      .catch(() => undefined);
    logger.error("Falha ao registrar membro após criar a conta; conta revertida.", {
      operation: "criar-membro",
      ...describeError(error),
    });
    return NextResponse.json(
      { error: "CREATE_FAILED", message: "Não foi possível concluir agora. Tente novamente." },
      { status: 500 },
    );
  }

  return NextResponse.json({ uid: newUid, email, password });
}

import { doc, getDoc, setDoc, updateDoc, type Firestore } from "firebase/firestore";
import { instant } from "@/core/date/calendar-date";
import { err, ok, validationError, type Result } from "@/core/result/result";
import type { HouseholdId, HouseholdRole, UserId } from "@/modules/shared/domain/common";

/**
 * Convidar por e-mail, sem servidor.
 *
 * O caminho anterior era o único possível e era ruim: a outra pessoa criava a
 * conta, abria a tela de Membros, copiava um identificador de 28 caracteres e
 * mandava de volta por WhatsApp, para então o administrador colar. Três telas,
 * dois aparelhos e um código andando na direção errada.
 *
 * O que travava tudo era a autorização: entrar num grupo exige escrever em
 * `households/{id}.memberUids`, que só um administrador podia fazer. A saída
 * pareceu ser uma rota de servidor — e não é. As Security Rules conseguem
 * autorizar o próprio convidado, desde que possam encontrar o convite dele
 * sem que ele diga qual é.
 *
 * Daí a decisão que organiza este arquivo: **o id do documento de convite é o
 * e-mail em minúsculas**. A regra monta o caminho a partir de
 * `request.auth.token.email` e busca. Um id aleatório obrigaria o convidado a
 * informá-lo, e informar um id não prova nada sobre quem ele é.
 *
 * A outra metade da segurança é `email_verified`. Sem ela, bastaria criar uma
 * conta com o e-mail de outra pessoa para cair no grupo dela
 * (docs/SECURITY.md).
 *
 * ## O que isto não faz
 *
 * Não envia e-mail. Não há infraestrutura de envio no projeto, e inventar uma
 * aqui seria escopo de outra decisão. O convite é endereçado a um e-mail e o
 * link é compartilhado como sempre foi — o que mudou é que nada precisa voltar
 * do convidado.
 */

/** Depois disto o convite não serve mais. Curto o bastante para não ficar solto. */
export const INVITE_VALID_DAYS = 14;

export type InviteStatus = "PENDING" | "ACCEPTED";

export interface Invite {
  readonly id: string;
  readonly householdId: HouseholdId;
  readonly email: string;
  readonly role: Exclude<HouseholdRole, "OWNER" | "DEPENDENT">;
  readonly status: InviteStatus;
  readonly expiresAt: string;
}

/**
 * O e-mail vira id de documento.
 *
 * Minúsculas porque endereço de e-mail não distingue caixa na prática, e a
 * regra compara com `request.auth.token.email.lower()` — se o id fosse
 * gravado com maiúsculas, o convite existiria e a regra não o acharia.
 */
export function inviteIdFor(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidInviteEmail(email: string): boolean {
  const normalised = inviteIdFor(email);
  // Sem barra e sem ponto isolado: são os únicos caracteres que o Firestore
  // recusa num id de documento, e um e-mail com barra não existe.
  if (normalised.includes("/") || normalised === "." || normalised === "..") return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalised);
}

export interface CreateInviteInput {
  readonly db: Firestore;
  readonly householdId: HouseholdId;
  readonly actorUid: UserId;
  readonly email: string;
  readonly role: Exclude<HouseholdRole, "OWNER" | "DEPENDENT">;
}

export async function createInvite(input: CreateInviteInput): Promise<Result<{ id: string }>> {
  const email = inviteIdFor(input.email);

  if (!isValidInviteEmail(email)) {
    return err(validationError("Esse e-mail não parece válido."));
  }

  const now = instant();
  const expiresAt = new Date(Date.now() + INVITE_VALID_DAYS * 86_400_000);

  try {
    await setDoc(doc(input.db, `households/${input.householdId}/invites/${email}`), {
      householdId: input.householdId,
      email,
      role: input.role,
      status: "PENDING",
      expiresAt,
      createdAt: now,
      updatedAt: now,
      createdBy: input.actorUid,
    });
  } catch (writeError) {
    console.error(writeError);
    return err(validationError("Não foi possível criar o convite agora. Tente novamente."));
  }

  return ok({ id: email });
}

export type AcceptInviteProblem =
  "NOT_FOUND" | "EXPIRED" | "ALREADY_USED" | "EMAIL_NOT_VERIFIED" | "FAILED";

export const ACCEPT_PROBLEM_MESSAGES: Record<AcceptInviteProblem, string> = {
  NOT_FOUND: "Não há convite para o seu e-mail neste grupo. Peça para quem administra reenviar.",
  EXPIRED: "Este convite venceu. Peça um novo a quem administra o grupo.",
  ALREADY_USED: "Este convite já foi usado.",
  EMAIL_NOT_VERIFIED:
    "Confirme seu e-mail antes de entrar no grupo. É o que garante que o convite era mesmo para você.",
  FAILED: "Não foi possível entrar no grupo agora. Tente novamente.",
};

export interface AcceptInviteInput {
  readonly db: Firestore;
  readonly householdId: HouseholdId;
  readonly uid: UserId;
  readonly email: string;
  readonly emailVerified: boolean;
  readonly displayName: string;
  /** Os uids que já estão no grupo, lidos do documento do household. */
  readonly currentMemberUids: readonly string[];
}

/**
 * Entra no grupo, em três escritas, nesta ordem.
 *
 * A ordem é imposta pelas regras, não por preferência: a participação só pode
 * ser criada para um uid que já esteja em `memberUids`, e o convite só pode
 * ser marcado como aceito enquanto ainda vale — se fosse marcado antes, ele
 * deixaria de autorizar as escritas seguintes.
 */
export async function acceptInvite(
  input: AcceptInviteInput,
): Promise<Result<{ role: HouseholdRole }, { code: AcceptInviteProblem; message: string }>> {
  const fail = (code: AcceptInviteProblem) => err({ code, message: ACCEPT_PROBLEM_MESSAGES[code] });

  if (!input.emailVerified) return fail("EMAIL_NOT_VERIFIED");

  const inviteRef = doc(
    input.db,
    `households/${input.householdId}/invites/${inviteIdFor(input.email)}`,
  );

  let invite;
  try {
    invite = await getDoc(inviteRef);
  } catch {
    return fail("NOT_FOUND");
  }

  if (!invite.exists()) return fail("NOT_FOUND");

  const data = invite.data();
  if (data.status !== "PENDING") return fail("ALREADY_USED");

  const expiresAt = data.expiresAt?.toDate?.() ?? new Date(data.expiresAt);
  if (!(expiresAt instanceof Date) || expiresAt.getTime() <= Date.now()) return fail("EXPIRED");

  const role = data.role as HouseholdRole;
  const now = instant();

  try {
    // 1. O acesso. A regra só aceita a lista de antes com o próprio uid no fim.
    await updateDoc(doc(input.db, `households/${input.householdId}`), {
      memberUids: [...input.currentMemberUids, input.uid],
      updatedAt: now,
    });

    // 2. A participação, com o papel que o convite fixou.
    await setDoc(doc(input.db, `households/${input.householdId}/members/${input.uid}`), {
      uid: input.uid,
      householdId: input.householdId,
      displayName: input.displayName,
      email: inviteIdFor(input.email),
      role,
      status: "ACTIVE",
      joinedAt: now,
      createdAt: now,
      updatedAt: now,
      createdBy: input.uid,
    });

    // 3. O convite queima. Falhar aqui não desfaz a entrada — a pessoa já está
    // dentro, e um convite pendente a mais é ruído, não brecha: usá-lo de novo
    // exigiria não estar em `memberUids`, e ela está.
    await updateDoc(inviteRef, { status: "ACCEPTED", updatedAt: now }).catch(() => undefined);
  } catch (writeError) {
    console.error(writeError);
    return fail("FAILED");
  }

  return ok({ role });
}

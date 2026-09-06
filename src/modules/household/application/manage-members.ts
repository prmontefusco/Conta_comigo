import {
  arrayRemove,
  arrayUnion,
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  type Firestore,
} from "firebase/firestore";
import { instant } from "@/core/date/calendar-date";
import { err, ok, validationError, type Result } from "@/core/result/result";
import { DEPENDENT_ID_PREFIX } from "@/modules/shared/domain/common";
import type { HouseholdId, HouseholdRole, MemberId, UserId } from "@/modules/shared/domain/common";
import { randomId } from "@/core/id/id";

/**
 * Adding and removing the other people in the household.
 *
 * The order of the two writes is forced by the Security Rules: a member
 * document may only be created for a uid already listed in the household's
 * `memberUids`, which is what keeps the array and the subcollection from
 * drifting apart (firestore.rules, "Membership"). So the household is updated
 * first, and rolled back if the membership write fails - otherwise a failed
 * attempt would leave a uid with a claim on the household and no record of it
 * on screen.
 *
 * There is deliberately no way to invite by e-mail here: accepting an invite
 * would require the invited person to write to the household document, which
 * only an administrator may do. Until that runs on a server, the honest flow
 * is the one the screen describes - the other person creates their own
 * account and passes along their identifier.
 */

export interface AddMemberInput {
  readonly db: Firestore;
  readonly householdId: HouseholdId;
  /** The administrator doing this. Recorded as the author of the membership. */
  readonly actorUid: UserId;
  readonly uid: UserId;
  readonly displayName: string;
  readonly email?: string;
  readonly role: Exclude<HouseholdRole, "OWNER">;
}

export async function addMemberByUid(input: AddMemberInput): Promise<Result<{ uid: UserId }>> {
  const uid = input.uid.trim();
  const displayName = input.displayName.trim();

  if (uid.length < 6 || uid.length > 250 || /[/\s]/.test(uid)) {
    return err(
      validationError(
        "Esse identificador não parece válido. Peça à pessoa o código que aparece em “Meus dados”.",
      ),
    );
  }
  if (displayName.length < 2) {
    return err(validationError("Informe o nome da pessoa."));
  }

  const memberRef = doc(input.db, `households/${input.householdId}/members/${uid}`);
  const existing = await getDoc(memberRef);
  if (existing.exists() && existing.data().status !== "REMOVED") {
    return err(validationError("Essa pessoa já faz parte do grupo."));
  }

  const householdRef = doc(input.db, `households/${input.householdId}`);
  const now = instant();

  await updateDoc(householdRef, { memberUids: arrayUnion(uid), updatedAt: now });

  try {
    await setDoc(memberRef, {
      uid,
      householdId: input.householdId,
      displayName,
      ...(input.email?.trim() ? { email: input.email.trim().toLowerCase() } : {}),
      role: input.role,
      status: "ACTIVE",
      joinedAt: now,
      createdAt: now,
      updatedAt: now,
      createdBy: input.actorUid,
    });
  } catch (writeError) {
    // Leaving the uid in memberUids would grant nothing on its own, but it
    // would be a claim nobody can see. Undo it.
    await updateDoc(householdRef, { memberUids: arrayRemove(uid), updatedAt: instant() }).catch(
      () => undefined,
    );
    console.error(writeError);
    return err(
      validationError(
        "Não foi possível adicionar essa pessoa. Confira o identificador e tente novamente.",
      ),
    );
  }

  return ok({ uid });
}

export interface AddDependentInput {
  readonly db: Firestore;
  readonly householdId: HouseholdId;
  /** O administrador que está cadastrando. Fica como autor do perfil. */
  readonly actorUid: UserId;
  readonly displayName: string;
}

/**
 * Uma pessoa da casa que não entra no aplicativo.
 *
 * O caso mais comum de uma família brasileira, e o que ficava de fora: um
 * filho de doze anos, um pai idoso, alguém que só precisa existir para a
 * pergunta "de quem é este gasto". Exigir conta própria e a troca de um
 * identificador de 28 caracteres para isso matava a atribuição de despesas
 * na prática.
 *
 * Duas diferenças em relação a `addMemberByUid`, e as duas são o ponto:
 *
 * 1. **O id não é um uid.** É gerado aqui com o prefixo `dep_`, que o Firebase
 *    Auth nunca emite. As Security Rules exigem esse prefixo justamente para
 *    que um administrador não possa criar `members/{uidDeOutraPessoa}` e fazer
 *    o próprio grupo aparecer na lista de um estranho.
 * 2. **`memberUids` não é tocado.** Aquele array é o que concede acesso; um
 *    perfil sem acesso não entra nele. Por isso aqui há uma escrita só, e não
 *    a dança de duas etapas que `addMemberByUid` precisa fazer.
 */
export async function addDependent(input: AddDependentInput): Promise<Result<{ id: MemberId }>> {
  const displayName = input.displayName.trim();
  if (displayName.length < 2) {
    return err(validationError("Informe o nome da pessoa."));
  }

  const id = `${DEPENDENT_ID_PREFIX}${randomId()}`;
  const now = instant();

  try {
    await setDoc(doc(input.db, `households/${input.householdId}/members/${id}`), {
      uid: id,
      householdId: input.householdId,
      displayName,
      role: "DEPENDENT",
      status: "ACTIVE",
      joinedAt: now,
      createdAt: now,
      updatedAt: now,
      createdBy: input.actorUid,
    });
  } catch (writeError) {
    console.error(writeError);
    return err(validationError("Não foi possível cadastrar essa pessoa agora. Tente novamente."));
  }

  return ok({ id });
}

export interface RemoveMemberInput {
  readonly db: Firestore;
  readonly householdId: HouseholdId;
  readonly uid: UserId;
}

/**
 * Removing someone from the household.
 *
 * Their records stay: a purchase made by a person who left still happened, and
 * deleting it would change the household's history. Only the access goes.
 */
export async function removeMember(input: RemoveMemberInput): Promise<Result<null>> {
  const householdRef = doc(input.db, `households/${input.householdId}`);

  await deleteDoc(doc(input.db, `households/${input.householdId}/members/${input.uid}`));
  await updateDoc(householdRef, {
    memberUids: arrayRemove(input.uid),
    updatedAt: instant(),
  });

  return ok(null);
}

export interface ChangeMemberRoleInput {
  readonly db: Firestore;
  readonly householdId: HouseholdId;
  readonly uid: UserId;
  readonly role: Exclude<HouseholdRole, "OWNER">;
}

export async function changeMemberRole(input: ChangeMemberRoleInput): Promise<Result<null>> {
  await updateDoc(doc(input.db, `households/${input.householdId}/members/${input.uid}`), {
    role: input.role,
    updatedAt: instant(),
  });
  return ok(null);
}

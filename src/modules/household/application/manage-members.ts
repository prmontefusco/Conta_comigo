import {
  arrayRemove,
  doc,
  setDoc,
  updateDoc,
  writeBatch,
  type Firestore,
} from "firebase/firestore";
import { instant } from "@/core/date/calendar-date";
import { err, ok, validationError, type Result } from "@/core/result/result";
import { DEPENDENT_ID_PREFIX } from "@/modules/shared/domain/common";
import type { HouseholdId, HouseholdRole, MemberId, UserId } from "@/modules/shared/domain/common";
import { randomId } from "@/core/id/id";

/**
 * Adding and removing the other people in the household.
 */

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
 * Duas coisas marcam a diferença para um membro com acesso:
 *
 * 1. **O id não é um uid.** É gerado aqui com o prefixo `dep_`, que o Firebase
 *    Auth nunca emite. As Security Rules exigem esse prefixo justamente para
 *    que um administrador não possa criar `members/{uidDeOutraPessoa}` e fazer
 *    o próprio grupo aparecer na lista de um estranho.
 * 2. **`memberUids` não é tocado.** Aquele array é o que concede acesso; um
 *    perfil sem acesso não entra nele. Por isso aqui há uma escrita só.
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
 *
 * The member document and `memberUids` are removed in a single batch: doing
 * them as two separate awaits let a dropped connection between the two leave
 * `memberUids` pointing at a uid whose member document no longer exists.
 */
export async function removeMember(input: RemoveMemberInput): Promise<Result<null>> {
  try {
    const batch = writeBatch(input.db);
    batch.delete(doc(input.db, `households/${input.householdId}/members/${input.uid}`));
    batch.update(doc(input.db, `households/${input.householdId}`), {
      memberUids: arrayRemove(input.uid),
      updatedAt: instant(),
    });
    await batch.commit();
  } catch (writeError) {
    console.error(writeError);
    return err(validationError("Não foi possível remover essa pessoa agora. Tente novamente."));
  }

  return ok(null);
}

export interface ChangeMemberRoleInput {
  readonly db: Firestore;
  readonly householdId: HouseholdId;
  readonly uid: UserId;
  readonly role: Exclude<HouseholdRole, "OWNER">;
}

export async function changeMemberRole(input: ChangeMemberRoleInput): Promise<Result<null>> {
  try {
    await updateDoc(doc(input.db, `households/${input.householdId}/members/${input.uid}`), {
      role: input.role,
      updatedAt: instant(),
    });
  } catch (writeError) {
    console.error(writeError);
    return err(validationError("Não foi possível alterar o papel agora. Tente novamente."));
  }
  return ok(null);
}

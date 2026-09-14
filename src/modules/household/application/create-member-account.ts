import { err, ok, validationError, type Result } from "@/core/result/result";
import type { HouseholdId, HouseholdRole } from "@/modules/shared/domain/common";

/**
 * Pede ao servidor para criar a conta da outra pessoa e já colocá-la no
 * grupo, numa chamada só.
 *
 * O cliente nunca cria essa conta diretamente: fazer isso com o SDK do
 * navegador trocaria a sessão de quem está logado pela da pessoa recém-criada
 * — exatamente o Admin SDK do lado do servidor existe para evitar.
 */

export interface CreateMemberAccountInput {
  readonly idToken: string;
  readonly householdId: HouseholdId;
  readonly name: string;
  readonly email: string;
  readonly role: Exclude<HouseholdRole, "OWNER" | "DEPENDENT">;
}

export interface CreatedMemberAccount {
  readonly uid: string;
  readonly email: string;
  readonly password: string;
}

export async function createMemberAccount(
  input: CreateMemberAccountInput,
): Promise<Result<CreatedMemberAccount>> {
  const response = await fetch("/api/household/criar-membro", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.idToken}`,
    },
    body: JSON.stringify({
      householdId: input.householdId,
      name: input.name,
      email: input.email,
      role: input.role,
    }),
  }).catch(() => null);

  if (!response) {
    return err(validationError("Não foi possível conectar ao servidor agora. Tente novamente."));
  }

  const data: { message?: string; uid?: string; email?: string; password?: string } = await response
    .json()
    .catch(() => ({}));

  if (!response.ok || !data.uid || !data.email || !data.password) {
    return err(
      validationError(data.message ?? "Não foi possível criar a conta agora. Tente novamente."),
    );
  }

  return ok({ uid: data.uid, email: data.email, password: data.password });
}

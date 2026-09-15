import { err, ok, validationError, type Result } from "@/core/result/result";
import type { HouseholdId } from "@/modules/shared/domain/common";

/**
 * Troca a senha gerada no primeiro acesso de uma conta criada por um
 * administrador. Ver `criar-membro/route.ts` e `trocar-senha-inicial/route.ts`
 * para o porquê disso passar pelo servidor em vez do `updatePassword` do
 * cliente.
 */

export interface ChangeInitialPasswordInput {
  readonly idToken: string;
  readonly householdId: HouseholdId;
  readonly newPassword: string;
}

export async function changeInitialPassword(
  input: ChangeInitialPasswordInput,
): Promise<Result<true>> {
  const response = await fetch("/api/household/trocar-senha-inicial", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.idToken}`,
    },
    body: JSON.stringify({
      householdId: input.householdId,
      newPassword: input.newPassword,
    }),
  }).catch(() => null);

  if (!response) {
    return err(validationError("Não foi possível conectar ao servidor agora. Tente novamente."));
  }

  const data: { message?: string; ok?: boolean } = await response.json().catch(() => ({}));

  if (!response.ok || !data.ok) {
    return err(
      validationError(data.message ?? "Não foi possível trocar a senha agora. Tente novamente."),
    );
  }

  return ok(true);
}

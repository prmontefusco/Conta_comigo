import { describe, expect, it } from "vitest";
import { planAccountDeletion } from "./data-portability";

/**
 * Deleting an account can take other people's data with it, so what it will do
 * has to be decidable before anything is deleted - and the answer has to be a
 * value, not a side effect.
 */

const ME = "uid-me";
const OTHER = "uid-other";

describe("plano de exclusão de conta", () => {
  it("apaga um grupo em que a pessoa está sozinha", () => {
    const plan = planAccountDeletion(ME, [
      { id: "h1", name: "Minhas finanças", ownerUid: ME, memberUids: [ME] },
    ]);

    expect(plan.entries).toEqual([
      { kind: "DELETE_HOUSEHOLD", householdId: "h1", name: "Minhas finanças" },
    ]);
    expect(plan.blocked).toBe(false);
  });

  it("apenas sai de um grupo de outra pessoa", () => {
    const plan = planAccountDeletion(ME, [
      { id: "h1", name: "Família", ownerUid: OTHER, memberUids: [OTHER, ME] },
    ]);

    expect(plan.entries).toEqual([{ kind: "LEAVE_HOUSEHOLD", householdId: "h1", name: "Família" }]);
    expect(plan.blocked).toBe(false);
  });

  it("bloqueia quando a pessoa é responsável por um grupo compartilhado", () => {
    // Apagar levaria dados que não são só dela; passar a responsabilidade a
    // alguém que não pediu também não é melhor. É uma decisão de pessoa.
    const plan = planAccountDeletion(ME, [
      { id: "h1", name: "Família", ownerUid: ME, memberUids: [ME, OTHER] },
    ]);

    expect(plan.entries[0]).toEqual({
      kind: "BLOCKED_OWNER",
      householdId: "h1",
      name: "Família",
      otherMembers: 1,
    });
    expect(plan.blocked).toBe(true);
  });

  it("um único grupo bloqueado impede a exclusão inteira", () => {
    const plan = planAccountDeletion(ME, [
      { id: "h1", name: "Sozinho", ownerUid: ME, memberUids: [ME] },
      { id: "h2", name: "Compartilhado", ownerUid: ME, memberUids: [ME, OTHER] },
    ]);

    expect(plan.blocked).toBe(true);
    expect(plan.entries.map((entry) => entry.kind)).toEqual(["DELETE_HOUSEHOLD", "BLOCKED_OWNER"]);
  });

  it("conta corretamente quantas outras pessoas existem", () => {
    const plan = planAccountDeletion(ME, [
      { id: "h1", name: "Família", ownerUid: ME, memberUids: [ME, OTHER, "uid-3"] },
    ]);

    expect(plan.entries[0]).toMatchObject({ kind: "BLOCKED_OWNER", otherMembers: 2 });
  });

  it("não tem o que fazer quando não há grupos", () => {
    const plan = planAccountDeletion(ME, []);
    expect(plan.entries).toEqual([]);
    expect(plan.blocked).toBe(false);
  });
});

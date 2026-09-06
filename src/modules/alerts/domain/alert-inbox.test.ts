import { describe, expect, it } from "vitest";
import { buildAlertInbox, inboxStorageKey, markAllSeen } from "./alert-inbox";
import type { Alert } from "./alerts";

/**
 * O sininho só serve enquanto o número significar alguma coisa. Um contador
 * que nunca muda vira decoração, e é o que aconteceria sem a distinção entre
 * o que já foi visto e o que é novo.
 */
const alert = (id: string, severity: Alert["severity"]): Alert => ({
  id,
  kind: "DUE_SOON",
  severity,
  message: id,
});

describe("buildAlertInbox", () => {
  it("conta só o que ainda não foi visto", () => {
    const inbox = buildAlertInbox({
      alerts: [alert("a", "ATTENTION"), alert("b", "ATTENTION"), alert("c", "ATTENTION")],
      seenIds: ["a"],
    });

    expect(inbox.items).toHaveLength(3);
    expect(inbox.unseenCount).toBe(2);
  });

  it("ordena por gravidade antes de por novidade", () => {
    // Um corte de energia visto ontem continua mais importante que um aviso
    // novo de orçamento estourado.
    const inbox = buildAlertInbox({
      alerts: [alert("novo-leve", "INFO"), alert("visto-urgente", "URGENT")],
      seenIds: ["visto-urgente"],
    });

    expect(inbox.items[0]?.alert.id).toBe("visto-urgente");
  });

  it("dentro da mesma gravidade, o novo vem primeiro", () => {
    const inbox = buildAlertInbox({
      alerts: [alert("visto", "ATTENTION"), alert("novo", "ATTENTION")],
      seenIds: ["visto"],
    });

    expect(inbox.items[0]?.alert.id).toBe("novo");
  });

  it("separa urgentes não vistos, que decidem a cor do contador", () => {
    const inbox = buildAlertInbox({
      alerts: [alert("a", "URGENT"), alert("b", "ATTENTION")],
      seenIds: [],
    });

    expect(inbox.unseenCount).toBe(2);
    expect(inbox.unseenUrgentCount).toBe(1);
    expect(inbox.hasUrgent).toBe(true);
  });

  it("zera quando tudo já foi visto", () => {
    const inbox = buildAlertInbox({
      alerts: [alert("a", "URGENT")],
      seenIds: ["a"],
    });

    expect(inbox.unseenCount).toBe(0);
    // O aviso continua na lista: ter sido visto não o torna falso.
    expect(inbox.items).toHaveLength(1);
    expect(inbox.hasUrgent).toBe(true);
  });

  it("caixa vazia não tem urgência nem contador", () => {
    const inbox = buildAlertInbox({ alerts: [], seenIds: ["a", "b"] });

    expect(inbox.items).toHaveLength(0);
    expect(inbox.unseenCount).toBe(0);
    expect(inbox.hasUrgent).toBe(false);
  });
});

describe("markAllSeen", () => {
  it("guarda só os ids que existem hoje", () => {
    // Sem isso a lista cresceria para sempre — e um aviso que volta a
    // acontecer com o mesmo id chegaria já marcado como visto.
    expect(markAllSeen([alert("a", "INFO"), alert("b", "INFO")])).toEqual(["a", "b"]);
    expect(markAllSeen([])).toEqual([]);
  });
});

describe("inboxStorageKey", () => {
  it("separa grupos diferentes", () => {
    expect(inboxStorageKey("casa-1")).not.toBe(inboxStorageKey("casa-2"));
  });
});

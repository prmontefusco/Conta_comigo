import { beforeEach, describe, expect, it, vi } from "vitest";
import { calendarDate } from "@/core/date/calendar-date";
import { fromDecimal } from "@/core/money/money";
import { anObligation } from "@/modules/shared/testing/builders";

/**
 * A liquidação é o único ponto do produto onde uma obrigação vira dinheiro.
 *
 * Ela escreve dois documentos num único lote — a transação e a obrigação — e o
 * comentário do módulo diz por que isso não é negociável: separar as duas
 * deixaria uma conta marcada como paga sem movimento de dinheiro atrás, ou o
 * mesmo dinheiro saindo duas vezes.
 *
 * Esta camada não tinha teste nenhum, e `vitest.config.mts` cobre
 * `application/**` com limiar de 80%. O que se verifica aqui é o contrato: o
 * que é recusado antes de escrever, e o formato exato do que é escrito.
 *
 * O Firestore é dublê. O objetivo não é testar o SDK, é testar as regras de
 * domínio que decidem o conteúdo do lote.
 */

interface BatchOperation {
  readonly kind: "set" | "update";
  readonly path: string;
  readonly data: Record<string, unknown>;
}

const operations: BatchOperation[] = [];
let commits = 0;

vi.mock("firebase/firestore", () => {
  let generated = 0;

  return {
    collection: (_db: unknown, path: string) => ({ __path: path }),
    doc: (target: unknown, ...segments: string[]) => {
      // `doc(collectionRef)` gera um id novo; `doc(db, path, id)` aponta para um existente.
      if (typeof target === "object" && target !== null && "__path" in target) {
        generated += 1;
        const id = `generated-${generated}`;
        return { id, __path: `${(target as { __path: string }).__path}/${id}` };
      }
      const path = segments.join("/");
      return { id: segments.at(-1) ?? "", __path: path };
    },
    writeBatch: () => ({
      set: (ref: { __path: string }, data: Record<string, unknown>) => {
        operations.push({ kind: "set", path: ref.__path, data });
      },
      update: (ref: { __path: string }, data: Record<string, unknown>) => {
        operations.push({ kind: "update", path: ref.__path, data });
      },
      commit: async () => {
        commits += 1;
      },
    }),
  };
});

const { settleObligation } = await import("./settle-obligation");

const db = {} as never;
const baseInput = {
  db,
  householdId: "household-a",
  uid: "user-1",
  accountId: "account-1",
  paidOn: calendarDate("2026-09-10"),
};

beforeEach(() => {
  operations.length = 0;
  commits = 0;
});

const written = (kind: "set" | "update") => operations.find((operation) => operation.kind === kind);

describe("settleObligation — o que é recusado antes de escrever", () => {
  it("recusa uma obrigação cancelada", async () => {
    const result = await settleObligation({
      ...baseInput,
      obligation: anObligation({ status: "CANCELED" }),
      amount: fromDecimal(100),
    });

    expect(result.ok).toBe(false);
    expect(commits).toBe(0);
  });

  it("recusa uma obrigação já quitada", async () => {
    const result = await settleObligation({
      ...baseInput,
      obligation: anObligation({ status: "SETTLED", settledAmount: fromDecimal(300) }),
      amount: fromDecimal(100),
    });

    expect(result.ok).toBe(false);
    expect(commits).toBe(0);
  });

  it("recusa valor zero ou negativo", async () => {
    for (const amount of [fromDecimal(0), fromDecimal(-50)]) {
      const result = await settleObligation({
        ...baseInput,
        obligation: anObligation(),
        amount,
      });
      expect(result.ok).toBe(false);
    }
    expect(commits).toBe(0);
  });

  it("nada é escrito quando a validação falha", async () => {
    await settleObligation({
      ...baseInput,
      obligation: anObligation({ status: "CANCELED" }),
      amount: fromDecimal(100),
    });

    expect(operations).toEqual([]);
  });
});

describe("settleObligation — o que é escrito", () => {
  it("grava a transação e a obrigação no mesmo lote", async () => {
    const result = await settleObligation({
      ...baseInput,
      obligation: anObligation(),
      amount: fromDecimal(300),
    });

    expect(result.ok).toBe(true);
    expect(commits).toBe(1);
    expect(operations).toHaveLength(2);
    expect(operations.map((operation) => operation.kind)).toEqual(["set", "update"]);
  });

  it("a transação herda a competência da obrigação, não a data do pagamento", async () => {
    // Uma conta de agosto paga em setembro continua sendo custo de agosto.
    await settleObligation({
      ...baseInput,
      paidOn: calendarDate("2026-09-10"),
      obligation: anObligation({
        competenceDate: calendarDate("2026-08-01"),
        dueDate: calendarDate("2026-08-10"),
      }),
      amount: fromDecimal(300),
    });

    const transaction = written("set")?.data;
    expect(transaction?.transactionDate).toBe("2026-09-10");
    expect(transaction?.competenceDate).toBe("2026-08-01");
  });

  it("uma obrigação a pagar vira despesa, com categoria garantida", async () => {
    await settleObligation({
      ...baseInput,
      obligation: anObligation({ direction: "OUTFLOW", categoryId: undefined }),
      amount: fromDecimal(300),
    });

    const transaction = written("set")?.data;
    expect(transaction?.kind).toBe("EXPENSE");
    // O esquema exige categoria na despesa; a receita pode ficar sem.
    expect(transaction?.categoryId).toBe("outros-gastos");
  });

  it("uma obrigação a receber vira receita e pode ficar sem categoria", async () => {
    await settleObligation({
      ...baseInput,
      obligation: anObligation({ direction: "INFLOW", categoryId: undefined }),
      amount: fromDecimal(300),
    });

    const transaction = written("set")?.data;
    expect(transaction?.kind).toBe("INCOME");
    expect(transaction).not.toHaveProperty("categoryId");
  });

  it("a transação aponta para a obrigação que ela liquida", async () => {
    // É este vínculo que impede o mesmo dinheiro de ser contado como
    // compromisso em aberto e como movimento realizado ao mesmo tempo.
    await settleObligation({
      ...baseInput,
      obligation: anObligation({ id: "obligation-7" }),
      amount: fromDecimal(300),
    });

    expect(written("set")?.data.settlesObligationId).toBe("obligation-7");
  });

  it("pagar tudo marca como quitada e registra a data", async () => {
    await settleObligation({
      ...baseInput,
      obligation: anObligation({ amount: fromDecimal(300) }),
      amount: fromDecimal(300),
    });

    const update = written("update")?.data;
    expect(update?.status).toBe("SETTLED");
    expect(update?.settledAmount).toEqual(fromDecimal(300));
    expect(update?.settledAt).toBeDefined();
  });

  it("pagar parte deixa a conta parcialmente quitada e sem data de quitação", async () => {
    await settleObligation({
      ...baseInput,
      obligation: anObligation({ amount: fromDecimal(300) }),
      amount: fromDecimal(100),
    });

    const update = written("update")?.data;
    expect(update?.status).toBe("PARTIALLY_SETTLED");
    expect(update?.settledAmount).toEqual(fromDecimal(100));
    expect(update?.settledAt).toBeUndefined();
  });

  it("soma sobre o que já havia sido pago antes", async () => {
    await settleObligation({
      ...baseInput,
      obligation: anObligation({
        amount: fromDecimal(300),
        settledAmount: fromDecimal(100),
        status: "PARTIALLY_SETTLED",
      }),
      amount: fromDecimal(200),
    });

    const update = written("update")?.data;
    expect(update?.settledAmount).toEqual(fromDecimal(300));
    expect(update?.status).toBe("SETTLED");
  });

  it("acumula o id da transação sem perder as anteriores", async () => {
    await settleObligation({
      ...baseInput,
      obligation: anObligation({
        amount: fromDecimal(300),
        settledAmount: fromDecimal(100),
        status: "PARTIALLY_SETTLED",
        settlementTransactionIds: ["tx-anterior"],
      }),
      amount: fromDecimal(50),
    });

    const ids = written("update")?.data.settlementTransactionIds as string[];
    expect(ids).toHaveLength(2);
    expect(ids[0]).toBe("tx-anterior");
  });
});

describe("settleObligation — receber mais do que o previsto", () => {
  /**
   * Décimo terceiro, hora extra, uma conta que veio maior: receber acima do
   * previsto é comum. Digitar um zero a mais também é. Por isso a recusa é o
   * padrão e a autorização é explícita — quem confirma viu a diferença na tela.
   */
  const salario = anObligation({ direction: "INFLOW", amount: fromDecimal(2000) });

  it("recusa por padrão, sem escrever nada", async () => {
    const result = await settleObligation({
      ...baseInput,
      obligation: salario,
      amount: fromDecimal(2200),
    });

    expect(result.ok).toBe(false);
    expect(commits).toBe(0);
  });

  it("aceita quando a tela confirma explicitamente", async () => {
    const result = await settleObligation({
      ...baseInput,
      obligation: salario,
      amount: fromDecimal(2200),
      allowOverpayment: true,
    });

    expect(result.ok).toBe(true);
    expect(written("update")?.data.status).toBe("SETTLED");
    expect(written("update")?.data.settledAmount).toEqual(fromDecimal(2200));
  });
});

describe("settleObligation — receber menos do que o previsto", () => {
  const salario = anObligation({
    direction: "INFLOW",
    description: "Salário",
    amount: fromDecimal(2000),
  });

  it("sem encerrar, o resto continua em aberto", async () => {
    // O caso da conta a pagar: quem pagou metade do boleto ainda deve a outra.
    await settleObligation({ ...baseInput, obligation: salario, amount: fromDecimal(1850) });

    const update = written("update")?.data;
    expect(update?.status).toBe("PARTIALLY_SETTLED");
    expect(update?.settledAmount).toEqual(fromDecimal(1850));
  });

  it("encerrando, não sobra receita fantasma", async () => {
    // O caso do salário: os R$ 150 do desconto da Unimed não são de ninguém.
    await settleObligation({
      ...baseInput,
      obligation: salario,
      amount: fromDecimal(1850),
      closeRemainder: true,
    });

    const update = written("update")?.data;
    expect(update?.status).toBe("SETTLED");
    expect(update?.settledAmount).toEqual(fromDecimal(1850));
    expect(update?.settledAt).toBeDefined();
  });

  it("encerrar grava a transação pelo valor que realmente entrou", async () => {
    await settleObligation({
      ...baseInput,
      obligation: salario,
      amount: fromDecimal(1850),
      closeRemainder: true,
    });

    expect(written("set")?.data.amount).toEqual(fromDecimal(1850));
  });
});

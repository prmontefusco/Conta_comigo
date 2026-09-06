import { describe, expect, it } from "vitest";
import { calendarDate, dateRange, type CalendarDate } from "@/core/date/calendar-date";
import { money } from "@/core/money/money";
import type { ForecastResult } from "@/modules/forecast/domain/forecast-types";
import { starterReserveStatus } from "@/modules/reserves/domain/starter-reserve";
import type { Reserve } from "@/modules/reserves/domain/reserve";
import { advisePurchase, type PurchaseAdvisorInput } from "./purchase-advisor";

/**
 * O caso que originou a função: a máquina de lavar quebrou no mês apertado.
 *
 * A regra que estes testes guardam é a que decide todo o resto — o módulo
 * nunca reprova a compra. Ele devolve caminhos e o que cada um faz com o
 * plano, e a decisão continua de quem lê.
 */

const asOf = calendarDate("2026-09-20");

function forecastOf(
  perMonth: readonly { inflow: number; outflow: number }[],
  start = "2026-10",
): ForecastResult {
  const [year, month] = start.split("-").map(Number) as [number, number];

  const months = perMonth.map((entry, index) => {
    const absolute = month - 1 + index;
    const key = `${year + Math.floor(absolute / 12)}-${String((absolute % 12) + 1).padStart(2, "0")}`;
    return {
      month: key as never,
      expectedInflows: money(entry.inflow),
      committedOutflows: money(entry.outflow),
      debtCommitment: money(0),
      net: money(entry.inflow - entry.outflow),
      openingCashBalance: money(0),
      endingCashBalance: money(0),
      freeEndingBalance: money(0),
      lowestBalance: money(0),
      lowestBalanceDate: asOf as CalendarDate,
      isDeficit: entry.outflow > entry.inflow,
      deficitAmount: money(Math.max(0, entry.outflow - entry.inflow)),
      isPartial: false,
    };
  });

  return {
    asOf,
    horizon: dateRange(asOf, calendarDate("2027-09-20")),
    openingBalance: money(0),
    protectedReserve: money(0),
    days: [],
    months,
    events: [],
    summary: {
      projectedCashBalance: money(0),
      protectedReserve: money(0),
      freeProjectedBalance: money(0),
      committedOutflows: money(0),
      expectedInflows: money(0),
      debtCommitment: money(0),
      overdueAmount: money(0),
      upcomingAmount: money(0),
      lowestProjectedBalance: money(0),
      lowestProjectedBalanceDate: asOf,
    },
  } as unknown as ForecastResult;
}

const reserve = (current: number): Reserve =>
  ({
    id: "r1",
    householdId: "h1",
    name: "Reserva de partida",
    purpose: "EMERGENCY",
    currentAmount: money(current),
    targetAmount: money(100000),
    isProtected: true,
    visibility: "HOUSEHOLD",
    archived: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    createdBy: "u1",
  }) as unknown as Reserve;

/** Casa com R$ 400 de folga por mês e R$ 600 guardados. */
function base(overrides: Partial<PurchaseAdvisorInput> = {}): PurchaseAdvisorInput {
  return {
    asOf,
    urgency: "BROKEN_ESSENTIAL",
    availableCash: money(80000),
    starterReserve: starterReserveStatus([reserve(60000)], money(180000)),
    monthlyCapacity: money(40000),
    forecast: forecastOf(Array.from({ length: 12 }, () => ({ inflow: 300000, outflow: 260000 }))),
    ...overrides,
  };
}

describe("advisePurchase", () => {
  it("nunca devolve um veredito de compra: devolve caminhos", () => {
    const advice = advisePurchase(
      base({
        cashPrice: money(189000),
        installmentOffers: [
          {
            id: "10x",
            label: "10x sem juros",
            installmentAmount: money(18900),
            installmentCount: 10,
          },
        ],
      }),
    );

    expect(advice.paths.length).toBeGreaterThan(1);
    // Nenhum caminho autoriza nem proíbe: todos descrevem o que acontece.
    for (const path of advice.paths) {
      expect(path.notes.join(" ")).not.toMatch(/você não deveria|evite|não compre/i);
    }
  });

  it("mostra o total pago, não só a parcela", () => {
    const advice = advisePurchase(
      base({
        cashPrice: money(150000),
        installmentOffers: [
          { id: "12x", label: "12x", installmentAmount: money(18000), installmentCount: 12 },
        ],
      }),
    );

    const parcelado = advice.paths.find((path) => path.id === "12x")!;

    // 12 x R$ 180 = R$ 2.160 contra R$ 1.500 à vista.
    expect(parcelado.totalPaid).toEqual(money(216000));
    expect(parcelado.notes.join(" ")).toContain("R$ 660,00 a mais que o preço à vista");
    expect(parcelado.impliedMonthlyRate).not.toBeNull();
  });

  it('diz que "sem juros" trava capacidade, porque é o que falta a quem deve', () => {
    const advice = advisePurchase(
      base({
        cashPrice: money(189000),
        installmentOffers: [
          {
            id: "10x",
            label: "10x sem juros",
            installmentAmount: money(18900),
            installmentCount: 10,
          },
        ],
      }),
    );

    const parcelado = advice.paths.find((path) => path.id === "10x")!;

    expect(parcelado.impliedMonthlyRate).toBeNull();
    // R$ 189 de parcela contra R$ 400 de folga: 47%.
    expect(parcelado.notes.join(" ")).toMatch(/compromete 47% da sua folga/);
  });
});

/**
 * "Vale a pena consertar?"
 *
 * A resposta não é sim nem não: é o custo por mês de uso das duas opções, na
 * mesma unidade, mais o ponto em que o conserto se paga.
 */
describe("consertar contra trocar", () => {
  it("compara na mesma unidade: custo por mês de uso", () => {
    const advice = advisePurchase(
      base({
        cashPrice: money(189000), // R$ 1.890 a máquina nova
        newLifespanMonths: 96, // oito anos
        repairCost: money(38000), // R$ 380 o conserto
        repairLifespanMonths: 12, // deve segurar um ano
      }),
    );

    const conserto = advice.paths.find((path) => path.id === "repair")!;
    const nova = advice.paths.find((path) => path.id === "cash")!;

    expect(conserto.costPerMonthOfUse).toEqual(money(3167)); // R$ 31,67
    expect(nova.costPerMonthOfUse).toEqual(money(1969)); // R$ 19,69
    expect(advice.cheapestPerMonthOfUseId).toBe("cash");
    expect(conserto.notes.join(" ")).toContain("trocar sai mais barato que consertar");
  });

  it("diz em quantos meses o conserto se paga", () => {
    const advice = advisePurchase(
      base({
        cashPrice: money(189000),
        newLifespanMonths: 96,
        repairCost: money(38000),
        repairLifespanMonths: 12,
      }),
    );

    // R$ 380 dividido por R$ 19,69 de custo mensal da nova: 20 meses.
    expect(advice.paths.find((path) => path.id === "repair")!.notes.join(" ")).toContain(
      "durar mais 20 meses",
    );
  });

  it("não inventa custo por mês de uso quando não há estimativa de vida útil", () => {
    const advice = advisePurchase(base({ cashPrice: money(189000), repairCost: money(38000) }));

    for (const path of advice.paths) {
      expect(path.costPerMonthOfUse).toBeNull();
    }
    expect(advice.cheapestPerMonthOfUseId).toBeNull();
  });
});

/**
 * "Se eu esperar dois meses, compro um que dure mais?"
 *
 * O caminho que nenhuma calculadora de loja mostra.
 */
describe("esperar e pagar à vista", () => {
  it("calcula em quantos meses dá para comprar à vista, e o que economiza", () => {
    const advice = advisePurchase(
      base({
        availableCash: money(80000),
        cashPrice: money(189000),
        installmentOffers: [
          { id: "12x", label: "12x", installmentAmount: money(21000), installmentCount: 12 },
        ],
      }),
    );

    const esperar = advice.paths.find((path) => path.id === "wait")!;

    // Livre sem tocar na reserva: R$ 800 − R$ 900 de meta = R$ 0.
    // Faltam R$ 1.890, guardando R$ 400 por mês: 5 meses.
    expect(esperar.months).toBe(5);
    expect(esperar.totalPaid).toEqual(money(189000));
    // 12 x R$ 210 = R$ 2.520 contra R$ 1.890 à vista.
    expect(esperar.notes.join(" ")).toContain("Economiza R$ 630,00");
    expect(esperar.notes.join(" ")).toContain("não mexe na sua data de quitação");
  });

  it("lembra que esperar tem custo próprio quando o item é essencial e quebrou", () => {
    const advice = advisePurchase(base({ urgency: "BROKEN_ESSENTIAL", cashPrice: money(189000) }));

    expect(advice.paths.find((path) => path.id === "wait")!.notes.join(" ")).toContain(
      "Esperar tem custo próprio",
    );
  });

  it("não oferece esperar a quem não tem folga para guardar", () => {
    const advice = advisePurchase(
      base({
        monthlyCapacity: money(-30000),
        cashPrice: money(189000),
        forecast: forecastOf(
          Array.from({ length: 12 }, () => ({ inflow: 300000, outflow: 330000 })),
        ),
      }),
    );

    expect(advice.paths.find((path) => path.id === "wait")).toBeUndefined();
  });

  it("não propõe esperar quando o dinheiro livre já cobre o preço", () => {
    // R$ 4.000 no total, R$ 600 separados: sobram R$ 3.400 fora da reserva.
    const advice = advisePurchase(base({ availableCash: money(400000), cashPrice: money(189000) }));

    expect(advice.paths.find((path) => path.id === "wait")).toBeUndefined();
  });

  /**
   * As duas metades do módulo precisam concordar sobre o que é gastável.
   *
   * `reserveImpact` protege o saldo guardado; o caminho de espera protegia só
   * a meta. Numa casa que guardou acima da meta, a tela dizia "pagar à vista
   * consome sua reserva" e não oferecia a espera que evitaria exatamente isso.
   */
  it("oferece esperar quando o à vista só caberia mexendo no que foi guardado", () => {
    const advice = advisePurchase(
      base({
        // R$ 3.000 no total, dos quais R$ 2.200 já estão separados.
        availableCash: money(300000),
        starterReserve: starterReserveStatus([reserve(220000)], money(180000)),
        cashPrice: money(189000),
      }),
    );

    const avista = advice.paths.find((path) => path.id === "cash")!;
    const esperar = advice.paths.find((path) => path.id === "wait");

    expect(avista.touchesStarterReserve).toBe(true);
    // Fora da reserva sobram R$ 800; faltam R$ 1.090, a R$ 400 por mês: 3 meses.
    expect(esperar?.months).toBe(3);
  });
});

/**
 * "A parcela cabe no meu bolso nos próximos meses?"
 *
 * A resposta honesta é mês a mês. Uma parcela cabe em outubro e não cabe em
 * dezembro, quando cai o IPVA.
 */
describe("a parcela cabe nos próximos meses", () => {
  it("encontra o mês que quebra, e diz de quanto falta nele", () => {
    const advice = advisePurchase(
      base({
        // Dezembro aperta: entra o mesmo e sai R$ 1.100 a mais.
        forecast: forecastOf([
          { inflow: 300000, outflow: 260000 },
          { inflow: 300000, outflow: 260000 },
          { inflow: 300000, outflow: 370000 },
          { inflow: 300000, outflow: 260000 },
          { inflow: 300000, outflow: 260000 },
          { inflow: 300000, outflow: 260000 },
        ]),
        cashPrice: money(120000),
        installmentOffers: [
          { id: "6x", label: "6x de R$ 200", installmentAmount: money(20000), installmentCount: 6 },
        ],
      }),
    );

    const parcelado = advice.paths.find((path) => path.id === "6x")!;

    expect(parcelado.verdict).toBe("BREAKS_A_MONTH");
    expect(parcelado.firstMonthThatBreaks).toBe("2026-12");
    expect(parcelado.monthByMonth).toHaveLength(6);
    expect(parcelado.monthByMonth[0]?.fits).toBe(true);
    expect(parcelado.notes.join(" ")).toContain("faltam R$ 900,00");
  });

  it("quando o primeiro mês já não cabe, a parcela simplesmente não cabe", () => {
    const advice = advisePurchase(
      base({
        cashPrice: money(500000),
        installmentOffers: [
          {
            id: "10x",
            label: "10x de R$ 500",
            installmentAmount: money(50000),
            installmentCount: 10,
          },
        ],
      }),
    );

    expect(advice.paths.find((path) => path.id === "10x")!.verdict).toBe("DOES_NOT_FIT");
  });

  it("marca como apertado o que cabe mas consome quase toda a folga", () => {
    const advice = advisePurchase(
      base({
        cashPrice: money(120000),
        installmentOffers: [
          { id: "4x", label: "4x de R$ 350", installmentAmount: money(35000), installmentCount: 4 },
        ],
      }),
    );

    // R$ 350 contra R$ 400 de folga: passa dos 80% de conforto.
    expect(advice.paths.find((path) => path.id === "4x")!.verdict).toBe("TIGHT");
  });
});

describe("reserva de partida", () => {
  // A casa tem R$ 800 no total, dos quais R$ 600 são a reserva de partida.
  // Fora dela sobram R$ 200: qualquer pagamento acima disso encosta no colchão.
  it("avisa quando pagar à vista consome o colchão, e diz quanto sobra dele", () => {
    const advice = advisePurchase(base({ cashPrice: money(50000) }));

    const avista = advice.paths.find((path) => path.id === "cash")!;

    expect(avista.touchesStarterReserve).toBe(true);
    expect(avista.verdict).toBe("EATS_RESERVE");
    // R$ 500 de pagamento, R$ 200 fora da reserva: R$ 300 saem do colchão.
    expect(avista.reserveAfter).toEqual(money(30000));
    expect(avista.notes.join(" ")).toContain("R$ 300,00 da reserva de partida");
    expect(avista.notes.join(" ")).toContain("volta para o cartão");
  });

  it("não encosta na reserva quando o dinheiro de fora dela dá conta", () => {
    const advice = advisePurchase(base({ cashPrice: money(15000) }));

    const avista = advice.paths.find((path) => path.id === "cash")!;

    expect(avista.touchesStarterReserve).toBe(false);
    expect(avista.verdict).toBe("FITS");
    expect(avista.reserveAfter).toEqual(money(60000));
  });

  it("nem gastando tudo, reserva inclusive, alguns preços cabem", () => {
    const advice = advisePurchase(base({ cashPrice: money(200000) }));

    expect(advice.paths.find((path) => path.id === "cash")!.verdict).toBe("DOES_NOT_FIT");
  });
});

describe("pagar pelo serviço em vez de comprar", () => {
  it("compara com a compra e diz em quantos meses o aparelho se paga", () => {
    const advice = advisePurchase(
      base({ cashPrice: money(189000), serviceMonthlyCost: money(6000) }),
    );

    const servico = advice.paths.find((path) => path.id === "service")!;

    expect(servico.costPerMonthOfUse).toEqual(money(6000));
    expect(servico.notes.join(" ")).toContain("se paga em 32 meses");
    expect(servico.notes.join(" ")).toContain("Não vira patrimônio");
  });
});

describe("emergência familiar", () => {
  it("não simula escolhas: não há decisão a tomar num enterro", () => {
    const advice = advisePurchase(base({ urgency: "FAMILY_EMERGENCY", cashPrice: money(90000) }));

    expect(advice.skipDeliberation).toBe(true);
    expect(advice.paths).toHaveLength(0);
  });
});

describe("ordem dos caminhos", () => {
  it("põe o que cabe antes do que não cabe, e o mais barato primeiro", () => {
    const advice = advisePurchase(
      base({
        cashPrice: money(120000),
        installmentOffers: [
          {
            id: "cabe",
            label: "12x de R$ 120",
            installmentAmount: money(12000),
            installmentCount: 12,
          },
          {
            id: "nao-cabe",
            label: "2x de R$ 700",
            installmentAmount: money(70000),
            installmentCount: 2,
          },
        ],
      }),
    );

    const ids = advice.paths.map((path) => path.id);
    expect(ids.indexOf("cabe")).toBeLessThan(ids.indexOf("nao-cabe"));
    expect(advice.cheapestViableId).not.toBe("nao-cabe");
  });
});

/**
 * Quando nada cabe.
 *
 * A situação mais provável para o público deste produto, e a que decide se a
 * tela ajuda ou vira a coisa que só diz não.
 */
describe("quando nenhum caminho cabe", () => {
  const semNada = () =>
    advisePurchase(
      base({
        availableCash: money(6400),
        starterReserve: starterReserveStatus([reserve(0)], money(220000)),
        monthlyCapacity: money(-24000),
        forecast: forecastOf(
          Array.from({ length: 12 }, () => ({ inflow: 198000, outflow: 222000 })),
        ),
        cashPrice: money(189000),
        repairCost: money(38000),
        installmentOffers: [
          {
            id: "12x",
            label: "12x de R$ 210",
            installmentAmount: money(21000),
            installmentCount: 12,
          },
        ],
      }),
    );

  it("sinaliza a situação uma vez, em vez de deixar quatro negativas soltas", () => {
    expect(semNada().nothingFits).toBe(true);
  });

  it("aponta o menor desembolso, que é por onde a conversa começa", () => {
    // Entre R$ 1.890 à vista e R$ 380 de conserto, o conserto é o piso.
    expect(semNada().smallestUpfront).toEqual(money(38000));
  });

  it("não é 'nada cabe' quando alguma coisa cabe", () => {
    const advice = advisePurchase(base({ cashPrice: money(15000) }));
    expect(advice.nothingFits).toBe(false);
  });
});

/**
 * A frase mais forte da tela.
 *
 * Não é "em dezembro aperta" — é "hoje o seu mês fecha, e com esta parcela
 * deixa de fechar". A mudança de estado, dita uma vez.
 */
describe("quando a compra tira o mês do azul", () => {
  it("avisa a mudança de estado, com os dois números", () => {
    const advice = advisePurchase(
      base({
        // Folga de R$ 400 por mês.
        cashPrice: money(600000),
        installmentOffers: [
          {
            id: "12x",
            label: "12x de R$ 550",
            installmentAmount: money(55000),
            installmentCount: 12,
          },
        ],
      }),
    );

    const parcelado = advice.paths.find((path) => path.id === "12x")!;

    expect(parcelado.flipsMonthIntoDeficit).toBe(true);
    expect(parcelado.notes.join(" ")).toContain("Hoje o seu mês fecha");
    expect(parcelado.notes.join(" ")).toContain("R$ 400,00 de folga");
    expect(parcelado.notes.join(" ")).toContain("R$ 550,00");
  });

  it("não avisa quando a parcela cabe na folga", () => {
    const advice = advisePurchase(
      base({
        cashPrice: money(120000),
        installmentOffers: [
          {
            id: "12x",
            label: "12x de R$ 100",
            installmentAmount: money(10000),
            installmentCount: 12,
          },
        ],
      }),
    );

    expect(advice.paths.find((path) => path.id === "12x")!.flipsMonthIntoDeficit).toBe(false);
  });

  /**
   * O limite que impede a frase de virar acusação.
   *
   * Quem já estava no vermelho antes de abrir a tela não foi levado até lá por
   * esta compra. Dizer que foi seria falso, e culpar quem já está apertado é
   * exatamente o que este produto não faz.
   */
  it("não culpa a compra por um mês que já não fechava", () => {
    const advice = advisePurchase(
      base({
        monthlyCapacity: money(-24000),
        forecast: forecastOf(
          Array.from({ length: 12 }, () => ({ inflow: 198000, outflow: 222000 })),
        ),
        cashPrice: money(120000),
        installmentOffers: [
          {
            id: "12x",
            label: "12x de R$ 100",
            installmentAmount: money(10000),
            installmentCount: 12,
          },
        ],
      }),
    );

    const parcelado = advice.paths.find((path) => path.id === "12x")!;

    expect(parcelado.flipsMonthIntoDeficit).toBe(false);
    expect(parcelado.notes.join(" ")).not.toContain("Hoje o seu mês fecha");
  });

  it("pagamento único nunca compromete um mês à frente", () => {
    const advice = advisePurchase(base({ cashPrice: money(15000) }));

    expect(advice.paths.find((path) => path.id === "cash")!.flipsMonthIntoDeficit).toBe(false);
  });
});

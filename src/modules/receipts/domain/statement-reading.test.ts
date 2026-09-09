import { describe, expect, it } from "vitest";
import { calendarDate } from "@/core/date/calendar-date";
import { parseStatementReading } from "./statement-reading";

const today = calendarDate("2026-09-09");

describe("parseStatementReading", () => {
  it("lê um extrato com entradas e saídas, mantendo o sinal", () => {
    const response = JSON.stringify({
      instituicao: "Nubank",
      conta: "Conta do Nu",
      periodoInicio: "2026-08-01",
      periodoFim: "2026-08-31",
      saldoFinal: 842.15,
      confianca: "ALTA",
      lancamentos: [
        { data: "2026-08-05", descricao: "Salário", valor: 2800 },
        { data: "2026-08-06", descricao: "Mercado Extra", valor: -184.9 },
        { data: "2026-08-07", descricao: "PIX enviado - Maria", valor: -50 },
      ],
    });

    const reading = parseStatementReading(response, { today });

    expect(reading).not.toBeNull();
    expect(reading?.institution).toBe("Nubank");
    expect(reading?.periodEnd).toBe("2026-08-31");
    expect(reading?.closingBalanceCents).toBe(84215);
    expect(reading?.entries).toHaveLength(3);
    // Mais recente primeiro.
    expect(reading?.entries[0]?.date).toBe("2026-08-07");
    expect(reading?.entries[0]?.amountCents).toBe(-5000);
    expect(reading?.entries[2]?.amountCents).toBe(280000);
  });

  it("aceita JSON dentro de cerca de markdown", () => {
    const response = `Segue o extrato:
\`\`\`json
{"lancamentos":[{"data":"2026-08-10","descricao":"Farmácia","valor":-32.4}]}
\`\`\``;

    const reading = parseStatementReading(response, { today });

    expect(reading?.entries).toHaveLength(1);
    expect(reading?.entries[0]?.amountCents).toBe(-3240);
  });

  it("descarta linha sem data válida, dizendo o motivo", () => {
    const response = JSON.stringify({
      lancamentos: [
        { data: "não sei", descricao: "Alguma coisa", valor: -10 },
        { data: "2026-08-10", descricao: "Padaria", valor: -12.5 },
      ],
    });

    const reading = parseStatementReading(response, { today });

    expect(reading?.entries).toHaveLength(1);
    expect(reading?.discarded).toHaveLength(1);
    expect(reading?.discarded[0]?.reason).toBe("sem data reconhecível");
  });

  it("descarta data no futuro: extrato é histórico", () => {
    const response = JSON.stringify({
      lancamentos: [
        { data: "2027-01-10", descricao: "Compra futura", valor: -99 },
        { data: "2026-09-01", descricao: "Combustível", valor: -180 },
      ],
    });

    const reading = parseStatementReading(response, { today });

    expect(reading?.entries).toHaveLength(1);
    expect(reading?.entries[0]?.description).toBe("Combustível");
  });

  it("descarta valor zero em vez de gravar um lançamento vazio", () => {
    const response = JSON.stringify({
      lancamentos: [
        { data: "2026-08-10", descricao: "Estorno", valor: 0 },
        { data: "2026-08-11", descricao: "Uber", valor: -21.9 },
      ],
    });

    const reading = parseStatementReading(response, { today });

    expect(reading?.entries).toHaveLength(1);
    expect(reading?.discarded[0]?.reason).toBe("sem valor reconhecível");
  });

  it("devolve null quando nenhuma linha sobrou", () => {
    const response = JSON.stringify({
      instituicao: "Itaú",
      lancamentos: [{ data: "abc", descricao: "x", valor: null }],
    });

    expect(parseStatementReading(response, { today })).toBeNull();
  });

  it("devolve null quando a resposta não é JSON", () => {
    expect(parseStatementReading("Não consegui ler o arquivo.", { today })).toBeNull();
  });

  it("dá uma descrição quando o modelo não leu o histórico", () => {
    const response = JSON.stringify({
      lancamentos: [{ data: "2026-08-10", descricao: "   ", valor: -15 }],
    });

    const reading = parseStatementReading(response, { today });

    expect(reading?.entries[0]?.description).toBe("Lançamento importado");
  });

  it("guarda o saldo final como conferência, sem criar lançamento para ele", () => {
    const response = JSON.stringify({
      saldoFinal: 1500,
      lancamentos: [{ data: "2026-08-10", descricao: "Aluguel", valor: -1200 }],
    });

    const reading = parseStatementReading(response, { today });

    expect(reading?.closingBalanceCents).toBe(150000);
    expect(reading?.entries).toHaveLength(1);
  });
});

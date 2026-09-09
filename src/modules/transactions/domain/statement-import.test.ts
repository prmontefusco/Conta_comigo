import { describe, expect, it } from "vitest";
import { money } from "@/core/money/money";
import { calendarDate } from "@/core/date/calendar-date";
import {
  entriesFromRows,
  parseBrazilianDate,
  parseCsv,
  parseDecimal,
  parseOfx,
  parseStatement,
} from "./statement-import";

/**
 * O extrato é a porta de entrada de quem já tem meses de histórico. Errar a
 * leitura de um número aqui não produz um erro visível: produz um saldo errado
 * com aparência de precisão, que é pior.
 */

describe("parseDecimal", () => {
  it("lê o formato brasileiro", () => {
    expect(parseDecimal("1.234,56")).toBe(123456);
    expect(parseDecimal("-45,90")).toBe(-4590);
    expect(parseDecimal("0,99")).toBe(99);
  });

  it("lê o formato americano, que o OFX costuma usar", () => {
    expect(parseDecimal("1234.56")).toBe(123456);
    expect(parseDecimal("-45.90")).toBe(-4590);
    expect(parseDecimal("1,234.56")).toBe(123456);
  });

  it("não confunde separador de milhar com decimal", () => {
    // O erro que transformaria R$ 1.234,56 em R$ 1,23.
    expect(parseDecimal("1.234,56")).toBe(123456);
    expect(parseDecimal("1,234.56")).toBe(123456);
  });

  it("desempata o separador solitário pela quantidade de casas", () => {
    // `1.234` é ambíguo de verdade. Dinheiro tem duas casas decimais, então
    // três dígitos depois do separador é milhar.
    expect(parseDecimal("1.234")).toBe(123400);
    expect(parseDecimal("1,234")).toBe(123400);
    expect(parseDecimal("45.90")).toBe(4590);
    expect(parseDecimal("45,9")).toBe(4590);
  });

  it("lê milhar repetido, que antes virava NaN", () => {
    expect(parseDecimal("1.234.567,89")).toBe(123456789);
    expect(parseDecimal("1.234.567")).toBe(123456700);
    expect(parseDecimal("1,234,567.89")).toBe(123456789);
  });

  it("ignora símbolo de moeda e espaço", () => {
    expect(parseDecimal("R$ 1.500,00")).toBe(150000);
    expect(parseDecimal(" -12,00 ")).toBe(-1200);
  });

  it("devolve null para o que não é número", () => {
    expect(parseDecimal("")).toBeNull();
    expect(parseDecimal("-")).toBeNull();
    expect(parseDecimal(undefined)).toBeNull();
    expect(parseDecimal("abc")).toBeNull();
  });
});

describe("parseBrazilianDate", () => {
  it("aceita os formatos que os bancos daqui usam", () => {
    expect(parseBrazilianDate("06/09/2026")).toBe("2026-09-06");
    expect(parseBrazilianDate("2026-09-06")).toBe("2026-09-06");
    expect(parseBrazilianDate("06-09-2026")).toBe("2026-09-06");
    expect(parseBrazilianDate("06/09/26")).toBe("2026-09-06");
  });

  it("recusa o que não dá para ler, em vez de chutar", () => {
    expect(parseBrazilianDate("setembro")).toBeNull();
    expect(parseBrazilianDate("")).toBeNull();
    expect(parseBrazilianDate("32/13/2026")).toBeNull();
  });
});

describe("parseOfx", () => {
  const ofx = `
OFXHEADER:100
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260903120000[-3:BRT]
<TRNAMT>-45.90
<FITID>202609030001
<MEMO>SUPERMERCADO BOM PRECO
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260905
<TRNAMT>1980.00
<FITID>202609050002
<MEMO>SALARIO
</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;

  it("lê tags SGML que não fecham, que é como o banco exporta", () => {
    const result = parseOfx(ofx);

    expect(result.format).toBe("OFX");
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0]?.description).toBe("SUPERMERCADO BOM PRECO");
    expect(result.entries[0]?.amount).toEqual(money(-4590));
    expect(result.entries[0]?.date).toBe("2026-09-03");
  });

  it("separa entrada de saída pelo sinal, como o extrato traz", () => {
    const result = parseOfx(ofx);

    expect(result.entries[1]?.amount).toEqual(money(198000));
    expect(result.entries[1]?.description).toBe("SALARIO");
  });

  it("usa o id do banco como identidade da linha", () => {
    const result = parseOfx(ofx);

    expect(result.entries[0]?.externalId).toBe("202609030001");
    expect(result.entries[0]?.fingerprint).toBe("id:202609030001");
  });

  it("não descarta em silêncio o que não deu para ler", () => {
    const result = parseOfx(`<STMTTRN><TRNAMT>-10.00<MEMO>SEM DATA</STMTTRN>`);

    expect(result.entries).toHaveLength(0);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0]?.reason).toContain("data");
  });

  it("descarta lançamento de valor zero", () => {
    const result = parseOfx(`<STMTTRN><DTPOSTED>20260903<TRNAMT>0.00<MEMO>NADA</STMTTRN>`);

    expect(result.entries).toHaveLength(0);
    expect(result.rejected[0]?.reason).toContain("zero");
  });
});

describe("parseCsv", () => {
  it("encontra as colunas pelo cabeçalho, sem exigir layout", () => {
    const csv = [
      "Data;Descrição;Valor",
      "03/09/2026;Supermercado;-45,90",
      "05/09/2026;Salário;1980,00",
    ].join("\n");

    const result = parseCsv(csv);

    expect(result.entries).toHaveLength(2);
    expect(result.entries[0]?.amount).toEqual(money(-4590));
    expect(result.entries[1]?.description).toBe("Salário");
  });

  it("descobre o separador sozinho", () => {
    const comVirgula = parseCsv("Data,Descricao,Valor\n03/09/2026,Mercado,-45.90");
    const comTab = parseCsv("Data\tDescricao\tValor\n03/09/2026\tMercado\t-45.90");

    expect(comVirgula.entries).toHaveLength(1);
    expect(comTab.entries).toHaveLength(1);
  });

  it("respeita campo entre aspas com o separador dentro", () => {
    const result = parseCsv('Data;Descricao;Valor\n03/09/2026;"Mercado; feira";-45,90');

    expect(result.entries[0]?.description).toBe("Mercado; feira");
  });

  it("diz quando não reconhece o cabeçalho, em vez de devolver lista vazia", () => {
    const result = parseCsv("Coluna A;Coluna B\nx;y");

    expect(result.entries).toHaveLength(0);
    expect(result.rejected[0]?.reason).toContain("cabeçalho");
  });

  it("ignora acento e caixa no cabeçalho", () => {
    const result = parseCsv("DATA;HISTÓRICO;VALOR\n03/09/2026;Mercado;-10,00");

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]?.description).toBe("Mercado");
  });

  it("registra a linha ruim e segue com as boas", () => {
    const result = parseCsv(
      ["Data;Descricao;Valor", "lixo;;;", "03/09/2026;Mercado;-45,90"].join("\n"),
    );

    expect(result.entries).toHaveLength(1);
    expect(result.rejected).toHaveLength(1);
  });
});

describe("parseStatement", () => {
  it("escolhe o leitor pelo conteúdo, não pela extensão", () => {
    expect(parseStatement("<OFX><STMTTRN><DTPOSTED>20260903<TRNAMT>-1.00</STMTTRN>").format).toBe(
      "OFX",
    );
    expect(parseStatement("Data;Valor\n03/09/2026;-1,00").format).toBe("CSV");
  });

  it("linhas iguais no mesmo dia colidem de propósito", () => {
    // A pessoa confere a lista antes de confirmar; colidir é o que faz uma
    // reimportação do mesmo arquivo não duplicar tudo.
    const result = parseCsv(
      ["Data;Descricao;Valor", "03/09/2026;Mercado;-45,90", "03/09/2026;Mercado;-45,90"].join("\n"),
    );

    expect(result.entries[0]?.fingerprint).toBe(result.entries[1]?.fingerprint);
  });
});

describe("entriesFromRows", () => {
  it("monta a lista do extrato lido por IA com a mesma impressão digital do CSV", () => {
    const fromCsv = parseCsv(["Data;Descricao;Valor", "03/09/2026;Mercado;-45,90"].join("\n"));
    const fromIa = entriesFromRows([
      { date: calendarDate("2026-09-03"), description: "Mercado", amountCents: -4590 },
    ]);

    expect(fromIa.format).toBe("IA");
    expect(fromIa.entries[0]?.fingerprint).toBe(fromCsv.entries[0]?.fingerprint);
    expect(fromIa.entries[0]?.amount).toEqual(money(-4590));
  });

  it("recusa valor zero em vez de gravar um lançamento vazio", () => {
    const result = entriesFromRows([
      { date: calendarDate("2026-09-03"), description: "Estorno", amountCents: 0 },
    ]);

    expect(result.entries).toHaveLength(0);
    expect(result.rejected[0]?.reason).toBe("valor zero");
  });

  it("dá uma descrição quando a linha veio sem histórico", () => {
    const result = entriesFromRows([
      { date: calendarDate("2026-09-03"), description: "  ", amountCents: -100 },
    ]);

    expect(result.entries[0]?.description).toBe("Lançamento importado");
  });
});

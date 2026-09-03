import { describe, expect, it } from "vitest";
import { parseDocumentReading } from "./document-reading";

describe("parseDocumentReading", () => {
  it("extrai conta de consumo (energia Enel) com valor e vencimento", () => {
    const geminiResponse = JSON.stringify({
      tipoDocumento: "CONTA_CONSUMO",
      emissor: "Enel",
      descricao: "Conta de Energia - Enel",
      valorTotal: 215.8,
      dataVencimento: "2026-09-18",
      linhaDigitavel: "846700000021580010920260918000000000000",
      confianca: "ALTA",
    });

    const result = parseDocumentReading(geminiResponse);

    expect(result).not.toBeNull();
    expect(result?.documentType).toBe("CONTA_CONSUMO");
    expect(result?.issuer).toBe("Enel");
    expect(result?.totalAmount?.amount).toBe(21580);
    expect(result?.dueDate).toBe("2026-09-18");
    expect(result?.barcode).toBe("846700000021580010920260918000000000000");
  });

  it("extrai fatura de cartão de crédito com valor total e mínimo", () => {
    const geminiResponse = `
      \`\`\`json
      {
        "tipoDocumento": "FATURA_CARTAO",
        "emissor": "Nubank",
        "descricao": "Fatura Cartão Nubank",
        "valorTotal": 1420.50,
        "valorMinimo": 210.00,
        "dataVencimento": "2026-09-25",
        "confianca": "ALTA"
      }
      \`\`\`
    `;

    const result = parseDocumentReading(geminiResponse);

    expect(result).not.toBeNull();
    expect(result?.documentType).toBe("FATURA_CARTAO");
    expect(result?.issuer).toBe("Nubank");
    expect(result?.totalAmount?.amount).toBe(142050);
    expect(result?.minimumAmount?.amount).toBe(21000);
    expect(result?.dueDate).toBe("2026-09-25");
  });

  it("retorna null se o texto for ilegível ou vazio", () => {
    const result = parseDocumentReading("Texto inválido sem json");
    expect(result).toBeNull();
  });
});

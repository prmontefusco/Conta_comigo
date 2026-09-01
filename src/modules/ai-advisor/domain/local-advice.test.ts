import { describe, expect, it } from "vitest";
import type { AdvisorContext } from "./advisor-request-schema";
import { generateLocalFinancialAdvice, namesInvestmentProduct } from "./local-advice";

/**
 * Enquanto não houver chave de modelo configurada, este é o **único** texto que
 * a pessoa endividada lê ao pedir ajuda. Ele merece o mesmo tratamento que o
 * resto do domínio financeiro.
 *
 * O caso que mais importa aqui não é de formatação: é o de não recomendar
 * investimento. Os termos de uso dizem que o serviço não faz isso, e por três
 * commits o texto fazia — nomeava produtos por nome.
 */

const CONTEXT: AdvisorContext = {
  score: 38,
  statusLabel: "Crítico",
  totalCashFormatted: "R$ 240,00",
  monthlyIncomeFormatted: "R$ 3.200,00",
  monthlyExpensesFormatted: "R$ 3.500,00",
  monthlyNetFormatted: "-R$ 300,00",
  debtCommitmentRatio: 47,
  totalDebtFormatted: "R$ 18.400,00",
  overdueBillsCount: 3,
  overdueBillsTotalFormatted: "R$ 1.120,00",
  emergencyFundMonths: 0,
  monthsToDebtFree: 36,
  debtFreeDateFormatted: "01/09/2029",
};

/** Uma pergunta por ramo, mais o caso sem pergunta. */
const EVERY_BRANCH = [
  "",
  "Qual a melhor estratégia para o cartão de crédito?",
  "Onde posso cortar despesas?",
  "Qual dívida devo quitar primeiro?",
  "Como montar minha reserva de emergência?",
  "Uma pergunta que não casa com nenhum assunto previsto",
];

describe("generateLocalFinancialAdvice", () => {
  it("nunca nomeia um produto de investimento", () => {
    // Os termos de uso: "Não oferecemos, intermediamos nem recomendamos
    // crédito, investimentos ou seguros." Nomear produto é recomendar, mesmo
    // quando a intenção é proteger — dizer "nunca na poupança" também é.
    for (const question of EVERY_BRANCH) {
      const advice = generateLocalFinancialAdvice(CONTEXT, question);
      const found = namesInvestmentProduct(advice);

      expect(found, `"${found}" apareceu para: ${question || "(sem pergunta)"}`).toBeUndefined();
    }
  });

  it("casa por palavra inteira, e não por trecho", () => {
    // A primeira versão deste teste procurava "ação" dentro do texto e acusava
    // "Plano de Ação" e "Redução". Um teste que grita no lugar errado é pior
    // que nenhum: alguém acaba desligando.
    expect(namesInvestmentProduct("Seu Plano de Ação e a Redução das dívidas")).toBeUndefined();
    expect(namesInvestmentProduct("Considere um CDB de liquidez diária")).toBe("cdb");
    expect(namesInvestmentProduct("nunca na poupança tradicional")).toBe("poupança");
  });

  it("responde a orientação sobre reserva por critério, não por produto", () => {
    const advice = generateLocalFinancialAdvice(CONTEXT, "Como monto minha reserva?");

    // O que substitui o nome do produto precisa ser utilizável: sem critério, a
    // resposta vira só uma recusa educada.
    expect(advice).toContain("resgate no mesmo dia");
    expect(advice).toMatch(/não indica onde investir/i);
  });

  it("devolve texto para qualquer pergunta, inclusive vazia", () => {
    for (const question of EVERY_BRANCH) {
      const advice = generateLocalFinancialAdvice(CONTEXT, question);
      expect(advice.trim().length).toBeGreaterThan(80);
    }
  });

  it("usa os números da pessoa no diagnóstico geral", () => {
    const advice = generateLocalFinancialAdvice(CONTEXT, "");

    // Um diagnóstico que não cita os próprios números é conselho genérico.
    expect(advice).toContain("38/100");
    expect(advice).toContain("-R$ 300,00");
    expect(advice).toContain("36 meses");
  });

  it("prioriza contas vencidas quando existem", () => {
    const advice = generateLocalFinancialAdvice(CONTEXT, "");

    expect(advice).toContain("Regularizar Contas Vencidas");
    expect(advice).toContain("3 conta(s) em atraso");
  });

  it("troca a primeira etapa quando não há conta vencida", () => {
    // Mandar "regularize suas contas vencidas" para quem está em dia destrói a
    // confiança no resto do texto.
    const advice = generateLocalFinancialAdvice({ ...CONTEXT, overdueBillsCount: 0 }, "");

    expect(advice).not.toContain("Regularizar Contas Vencidas");
    expect(advice).toContain("Blindagem e Controle Imediato");
  });

  it("reconhece o assunto sem depender de acento", () => {
    // Quem digita com pressa, no celular, escreve "divida" e "cartao".
    const comAcento = generateLocalFinancialAdvice(CONTEXT, "Qual dívida quitar?");
    const semAcento = generateLocalFinancialAdvice(CONTEXT, "Qual divida quitar?");

    expect(semAcento).toBe(comAcento);
    expect(semAcento).toContain("Bola de Neve");
  });

  it("não promete resultado garantido", () => {
    for (const question of EVERY_BRANCH) {
      const advice = generateLocalFinancialAdvice(CONTEXT, question).toLowerCase();
      expect(advice).not.toMatch(/garantimos|garantido|com certeza você (vai|irá)/);
    }
  });
});

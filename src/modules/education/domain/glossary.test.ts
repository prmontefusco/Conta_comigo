import { describe, expect, it } from "vitest";
import { allGlossaryTerms, glossaryTerm, type GlossaryTermId } from "./glossary";

/**
 * O glossário é texto, e texto não costuma ter teste. Estes existem porque a
 * falha aqui é silenciosa: um verbete copiado e não editado continua
 * compilando, continua abrindo o balão, e explica a coisa errada para quem
 * estava com dúvida — que é pior do que não ter ajuda nenhuma.
 */

describe("glossário", () => {
  it("todo verbete diz o que é e no que mexe", () => {
    // As duas partes são o contrato do componente: sem `impact`, o balão vira
    // dicionário, e saber a definição não ajuda ninguém a preencher o campo.
    for (const term of allGlossaryTerms()) {
      expect(term.term.trim().length, `${term.id}: falta o nome`).toBeGreaterThan(0);
      expect(term.what.trim().length, `${term.id}: falta o "o que é"`).toBeGreaterThan(20);
      expect(term.impact.trim().length, `${term.id}: falta o "no que mexe"`).toBeGreaterThan(20);
    }
  });

  it("o id do verbete bate com a chave, para a busca nunca devolver outro", () => {
    for (const term of allGlossaryTerms()) {
      expect(glossaryTerm(term.id).id).toBe(term.id);
    }
  });

  it("nenhum texto é repetido entre verbetes", () => {
    // Um copiar-e-colar não editado é o erro provável aqui, e ele passaria
    // por qualquer verificação de "não está vazio".
    const impacts = allGlossaryTerms().map((term) => term.impact);
    expect(new Set(impacts).size).toBe(impacts.length);

    const whats = allGlossaryTerms().map((term) => term.what);
    expect(new Set(whats).size).toBe(whats.length);
  });

  it("nenhum verbete culpa quem lê", () => {
    // docs/PRODUCT.md, seção 12: o público já se culpa o suficiente. A ajuda
    // não é lugar para reforçar isso.
    const proibidas = /\bvocê deveria\b|\bcuidado\b|\berro seu\b|\bdescuido\b|\bimprudên/i;

    for (const term of allGlossaryTerms()) {
      expect(proibidas.test(`${term.what} ${term.impact}`), `${term.id}`).toBe(false);
    }
  });

  it("explica os três números que mais confundem no painel", () => {
    const essenciais: GlossaryTermId[] = ["SALDO_NAS_CONTAS", "RESERVA_PROTEGIDA", "SALDO_LIVRE"];

    for (const id of essenciais) {
      expect(glossaryTerm(id)).toBeDefined();
    }
  });

  it("diz que CET em branco não atrapalha o cálculo", () => {
    // É a informação que destrava o cadastro de dívida: ninguém tem o CET na
    // cabeça, e sem essa frase o campo vira um bloqueio.
    expect(glossaryTerm("CET").impact).toMatch(/branco não atrapalha/i);
  });
});

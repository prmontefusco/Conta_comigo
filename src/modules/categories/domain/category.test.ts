import { describe, expect, it } from "vitest";
import { instant } from "@/core/date/calendar-date";
import {
  buildCategoryIndex,
  categoriesByKind,
  categoryName,
  DEFAULT_CATEGORIES,
  type Category,
} from "./category";

const NOW = instant("2026-09-08T10:00:00.000Z");
const AUDIT = { createdAt: NOW, updatedAt: NOW, createdBy: "user-1" };

describe("domínio de categorias (category)", () => {
  const catMoradia: Category = {
    ...AUDIT,
    id: "cat-moradia",
    householdId: "household-a",
    name: "Moradia",
    kind: "EXPENSE",
    sortOrder: 10,
    isSystem: true,
    archived: false,
  };

  const catAlimentacao: Category = {
    ...AUDIT,
    id: "cat-alimentacao",
    householdId: "household-a",
    name: "Alimentação",
    kind: "EXPENSE",
    sortOrder: 5,
    isSystem: true,
    archived: false,
  };

  const catArquivada: Category = {
    ...AUDIT,
    id: "cat-antiga",
    householdId: "household-a",
    name: "Lazer Antigo",
    kind: "EXPENSE",
    sortOrder: 20,
    isSystem: false,
    archived: true,
  };

  const catSalario: Category = {
    ...AUDIT,
    id: "cat-salario",
    householdId: "household-a",
    name: "Salário",
    kind: "INCOME",
    sortOrder: 1,
    isSystem: true,
    archived: false,
  };

  const categories = [catMoradia, catAlimentacao, catArquivada, catSalario];

  it("filtra categorias ativas por tipo (EXPENSE / INCOME) e ordena por sortOrder", () => {
    const despesas = categoriesByKind(categories, "EXPENSE");
    expect(despesas).toHaveLength(2);
    expect(despesas.map((c) => c.id)).toEqual(["cat-alimentacao", "cat-moradia"]);

    const receitas = categoriesByKind(categories, "INCOME");
    expect(receitas).toHaveLength(1);
    expect(receitas[0]!.id).toBe("cat-salario");
  });

  it("indexa categorias por ID e resolve nomes de forma resiliente", () => {
    const index = buildCategoryIndex(categories);

    expect(categoryName(index, "cat-moradia")).toBe("Moradia");
    expect(categoryName(index, undefined)).toBe("Sem categoria");
    expect(categoryName(index, "cat-inexistente")).toBe("Categoria removida");
  });

  it("possui catálogo padrão (DEFAULT_CATEGORIES) com categorias essenciais brasileiras", () => {
    expect(DEFAULT_CATEGORIES.length).toBeGreaterThanOrEqual(10);
    const slugs = DEFAULT_CATEGORIES.map((c) => c.slug);
    expect(slugs).toContain("moradia");
    expect(slugs).toContain("energia");
    expect(slugs).toContain("alimentacao");
    expect(slugs).toContain("salario");
  });
});

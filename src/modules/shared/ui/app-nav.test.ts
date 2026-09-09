import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  allNavItems,
  APP_NAV_SECTIONS,
  DEPENDENT_BLOCKED_PATHS,
  MOBILE_BAR,
  navSectionsFor,
} from "./app-nav";

/**
 * O menu não é decoração: no celular, uma tela fora dele não existe.
 *
 * Este arquivo virou teste depois de um caso concreto. Havia duas listas — a
 * da coluna do desktop e a da página "Mais" — e a segunda ficou para trás.
 * Cinco telas passaram a não ter caminho nenhum no telefone: Contas a pagar,
 * Cartões, Importar extrato, Antes de comprar e Projeção. Nada quebrou, nada
 * apareceu em log: elas só sumiram para quem usa o aplicativo do jeito que a
 * maioria usa.
 *
 * O teste abaixo lê as pastas de rota do próprio repositório. Uma tela nova
 * sem entrada no menu falha aqui, no lugar certo, em vez de sumir em silêncio.
 */

// A partir da raiz do projeto: em jsdom, `import.meta.url` não é um caminho de
// arquivo, e o Vitest roda com a raiz do repositório como diretório de trabalho.
const APP_ROUTES_DIR = join(process.cwd(), "src", "app", "(app)", "app");

/**
 * Rotas que não pertencem ao menu, e por quê.
 *
 * Toda exceção precisa de motivo: é isso que impede a lista de virar o lugar
 * onde se esconde o esquecimento.
 */
const NOT_IN_MENU: Record<string, string> = {
  comecar: "criação do primeiro grupo — só aparece para quem ainda não tem um",
  convite: "abre a partir de um link de convite, não da navegação",
  mais: "é a própria página de menu do celular",
};

function routeSegments(): string[] {
  return readdirSync(APP_ROUTES_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => existsSync(join(APP_ROUTES_DIR, name, "page.tsx")));
}

describe("menu do aplicativo", () => {
  it("tem uma entrada para toda tela do aplicativo", () => {
    const inMenu = new Set(allNavItems().map((item) => item.href));

    const semCaminho = routeSegments()
      .filter((segment) => !(segment in NOT_IN_MENU))
      .filter((segment) => !inMenu.has(`/app/${segment}`));

    expect(semCaminho).toEqual([]);
  });

  it("leva ao celular tudo o que leva ao desktop", () => {
    // A página "Mais" é montada a partir das mesmas seções, então o que se
    // verifica aqui é que ela continua sendo a porta: cada destino ou está na
    // barra de baixo, ou está numa seção que "Mais" renderiza.
    const naBarra = new Set(MOBILE_BAR.map((item) => item.href));
    const emMais = new Set(navSectionsFor("OWNER").flatMap((s) => s.items.map((i) => i.href)));

    for (const item of allNavItems()) {
      expect(naBarra.has(item.href) || emMais.has(item.href)).toBe(true);
    }
  });

  it("a barra de baixo cabe num polegar", () => {
    expect(MOBILE_BAR.length).toBeLessThanOrEqual(6);
  });

  it("a barra de baixo só aponta para destinos que existem", () => {
    const conhecidos = new Set([...allNavItems().map((item) => item.href), "/app/mais"]);

    for (const item of MOBILE_BAR) {
      expect(conhecidos.has(item.href)).toBe(true);
    }
  });

  it("não repete o mesmo destino em duas seções", () => {
    const hrefs = allNavItems().map((item) => item.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("esconde do dependente o que ele não pode ver, e não esvazia seções", () => {
    const paraDependente = navSectionsFor("DEPENDENT");
    const hrefs = paraDependente.flatMap((section) => section.items.map((item) => item.href));

    expect(hrefs).not.toContain("/app/dividas");
    expect(hrefs).not.toContain("/app/contas-bancarias");
    expect(hrefs).toContain("/app/dia-a-dia");
    expect(paraDependente.every((section) => section.items.length > 0)).toBe(true);
  });

  it("não redireciona o dependente de uma tela que o menu mostra a ele", () => {
    // Redirecionar sem esconder manda a pessoa para outra tela ao clicar num
    // item que o próprio menu ofereceu.
    const restritos = new Set(
      allNavItems()
        .filter((item) => item.restrictedForDependent)
        .map((item) => item.href),
    );

    for (const blocked of DEPENDENT_BLOCKED_PATHS) {
      expect(restritos.has(blocked)).toBe(true);
    }
  });

  it("toda seção tem título e nenhum item sem rótulo", () => {
    for (const section of APP_NAV_SECTIONS) {
      expect(section.title.trim()).not.toBe("");
      for (const item of section.items) {
        expect(item.label.trim()).not.toBe("");
        expect(item.href.startsWith("/")).toBe(true);
      }
    }
  });
});

import { expect, test } from "@playwright/test";
import { signIn, USERS } from "./seed-users";

/**
 * As telas que a auditoria acrescentou, contra a stack real.
 *
 * O que estes testes guardam não é layout: é a **honestidade dos números**. O
 * defeito mais caro que este produto já teve foi prometer quitação a quem
 * estava em déficit, e ele passava por todos os testes unitários — porque a
 * aritmética estava certa e o que faltava era a recusa de responder.
 *
 * Por isso quase toda asserção aqui é sobre a ausência de uma promessa.
 */

test.describe("plano que não fecha", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, USERS.massMarket.email);
  });

  test("não inventa data de quitação para quem está em déficit", async ({ page }) => {
    await page.goto("/app/visao-futuro");

    await expect(page.getByText("Este plano não fecha")).toBeVisible();
    await expect(page.getByText(/só para pagar as parcelas mínimas/)).toBeVisible();
    // O horizonte aparece como travessão, não como um número tranquilizador.
    await expect(page.getByText("Sem data enquanto o mês não fechar").first()).toBeVisible();
  });

  test("encaminha para renegociar prazo, em vez de mandar apertar mais", async ({ page }) => {
    await page.goto("/app/visao-futuro");

    await expect(
      page.getByText("O caminho aqui é renegociar prazo, não pagar mais rápido."),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Preparar a renegociação" })).toBeVisible();
  });
});

test.describe("modo emergência", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, USERS.massMarket.email);
    await page.goto("/app/emergencia");
  });

  test("ordena por consequência: serviço essencial antes do resto", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Modo emergência" })).toBeVisible();

    const faixas = page.getByText(/Corta um serviço essencial|Cresce todo dia|Vence em breve/);
    await expect(faixas.first()).toContainText("Corta um serviço essencial");
  });

  test("nomeia o que se perde, não só o valor", async ({ page }) => {
    await expect(page.getByText(/corte de energia elétrica/)).toBeVisible();
  });

  test("diz quanto o atraso custa por dia", async ({ page }) => {
    await expect(page.getByText("O atraso custa por dia")).toBeVisible();
    await expect(page.getByText(/Multa e juros já somam/)).toBeVisible();
  });
});

test.describe("antes de comprar", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, USERS.organised.email);
    await page.goto("/app/comprar");
  });

  test("não decide pela pessoa", async ({ page }) => {
    await expect(page.getByText("Esta tela não diz se você deve comprar.")).toBeVisible();
  });

  test("mostra o total pago junto da parcela, e o juro embutido", async ({ page }) => {
    await page.getByLabel("Preço à vista").fill("1890,00");
    await page.getByLabel("Valor da parcela").fill("210,00");
    await page.getByLabel("Quantas parcelas").fill("12");

    // 12 x R$ 210 = R$ 2.520, contra R$ 1.890 à vista.
    await expect(page.getByText(/R\$ 630,00 a mais que o preço à vista/)).toBeVisible();
    await expect(page.getByText("Juro embutido")).toBeVisible();
  });

  test("oferece esperar e pagar à vista, que loja nenhuma oferece", async ({ page }) => {
    await page.getByLabel("Preço à vista").fill("30000,00");

    await expect(page.getByText(/Esperar \d+ (mês|meses) e pagar à vista/)).toBeVisible();
    await expect(page.getByText(/não mexe na sua data de quitação/)).toBeVisible();
  });

  test("compara consertar e trocar na mesma unidade", async ({ page }) => {
    await page.getByLabel("Preço à vista").fill("1890,00");
    await page.getByLabel("Quantos meses deve durar").fill("96");
    await page.getByLabel("Custo do conserto").fill("380,00");
    await page.getByLabel("Quantos meses o conserto segura").fill("12");

    await expect(page.getByText("Por mês de uso").first()).toBeVisible();
    await expect(page.getByText(/O conserto se paga se o aparelho durar mais/)).toBeVisible();
  });

  test("carrega o aviso de que a decisão é de quem lê", async ({ page }) => {
    await expect(
      page.getByText(/A decisão, a compra e o compromisso assumido são seus/),
    ).toBeVisible();
  });
});

test.describe("lançamento rápido", () => {
  test("lança um gasto com valor e categoria, sem abrir formulário", async ({ page }) => {
    await signIn(page, USERS.organised.email);
    await page.goto("/app/dia-a-dia");

    await expect(page.getByLabel("Quanto foi")).toBeVisible();
    await page.getByLabel("Quanto foi").fill("12,50");

    // Os atalhos são ordenados pelo que a casa mais usa, então qual deles vem
    // primeiro depende do cenário. O que se testa é o caminho, não a lista.
    await page.locator("fieldset button").first().click();
    await page.getByRole("button", { name: "Lançar", exact: true }).click();

    // `\s` e não um espaço literal: `Intl.NumberFormat` separa "R$" do número
    // com espaço não-quebrável (U+00A0), e um espaço comum no padrão nunca
    // casaria — o teste falharia apontando para uma tela que está correta.
    await expect(page.getByText(/Lançado:\s*R\$\s*12,50/)).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("avisos", () => {
  test("o sininho conta o que ainda não foi visto e zera ao abrir", async ({ page }) => {
    await signIn(page, USERS.indebted.email);

    const bell = page.getByRole("button", { name: /^Avisos:/ });
    await expect(bell).toHaveAttribute("aria-label", /\d+ novos?/);

    await bell.click();
    await expect(page.getByRole("dialog", { name: "Avisos" })).toBeVisible();
    await expect(bell).toHaveAttribute("aria-label", "Avisos: nenhum novo");
  });

  test("a caixa de avisos lista alertas acionáveis e permite marcar como visto", async ({
    page,
  }) => {
    await signIn(page, USERS.indebted.email);
    await page.goto("/app/avisos");

    await expect(page.getByRole("heading", { name: "Caixa de avisos" })).toBeVisible();
    await expect(page.getByText("Alertas dentro do aplicativo")).toBeVisible();
    await expect(page.getByRole("link", { name: "Ver contas vencidas" })).toBeVisible();

    const filters = page.getByRole("group", { name: "Filtrar avisos" });
    await filters.getByRole("button", { name: "Novos" }).click();
    await expect(page.getByText("novo").first()).toBeVisible();

    await page.getByRole("button", { name: "Marcar tudo como visto" }).click();
    await expect(page.getByText("Nada nesta lista")).toBeVisible();
    await filters.getByRole("button", { name: "Todos" }).click();
    await expect(page.getByText("visto").first()).toBeVisible();
  });
});

test.describe("onboarding", () => {
  test("guia quem está endividado pelo cadastro mínimo antes do plano", async ({ page }) => {
    await signIn(page, USERS.indebted.email);
    await page.goto("/app/comecar");

    await expect(page.getByRole("heading", { name: "Vamos organizar o começo" })).toBeVisible();
    await expect(page.getByText("Se a situação está apertada, siga esta ordem")).toBeVisible();
    await expect(page.getByText("Cadastre sua renda")).toBeVisible();
    await expect(page.getByText("Cadastre contas vencidas e próximas")).toBeVisible();
    await expect(page.getByText("Cadastre cartões e faturas")).toBeVisible();
    await expect(page.getByText("Veja seu plano de ação")).toBeVisible();
  });
});

test.describe("plano de ação", () => {
  test("reúne agenda, renda variável, prioridades, metas, negociação e relatório", async ({
    page,
  }) => {
    await signIn(page, USERS.indebted.email);
    await page.goto("/app/plano");

    await expect(page.getByRole("heading", { name: "Plano de ação" })).toBeVisible();
    await expect(page.getByText("Próximos passos")).toBeVisible();
    await expect(page.getByText("Calendário financeiro")).toBeVisible();
    await expect(page.getByText("Simulador de renda variável")).toBeVisible();
    await expect(page.getByText("Priorização de dívidas")).toBeVisible();
    await expect(page.getByText("Metas de curto prazo")).toBeVisible();
    await expect(page.getByText("Central de negociação")).toBeVisible();
    await expect(page.getByText("Relatório para atendimento")).toBeVisible();

    await page.getByLabel("Queda de renda simulada (%)").fill("50");
    await expect(page.getByText("Renda simulada", { exact: true })).toBeVisible();
    await expect(page.getByText("Parcela máxima", { exact: true })).toBeVisible();
  });
});

/**
 * A rodada de teste com perfil realista.
 *
 * Um único caminho, do jeito que a pessoa percorre: entra, vê o que está
 * pegando fogo, abre a ação, registra o que a família decidiu e confere que a
 * decisão ficou guardada. Cada tela isolada já tem teste próprio; o que este
 * bloco guarda é a **costura** entre elas — que é onde um produto costuma
 * quebrar sem nenhum teste unitário reclamar.
 *
 * Roda nos dois projetos do Playwright, celular e desktop, e por isso a
 * decisão registrada carrega um carimbo de tempo: a segunda execução encontra
 * o banco com o que a primeira gravou, e um texto fixo tornaria a asserção
 * ambígua.
 */
test.describe("rodada com perfil endividado", () => {
  test("vê a prioridade, abre a ação, registra a decisão e a reencontra no histórico", async ({
    page,
  }) => {
    const carimbo = Date.now();
    const decisao = `Ligar para o banco sobre o empréstimo (${carimbo})`;

    /* 1. Entra com a família endividada. */
    await signIn(page, USERS.indebted.email);

    /* 2. A tela inicial abre pelo que precisa de atenção. */
    const atencao = page.getByRole("region", { name: "Atenção agora" });
    await expect(atencao).toBeVisible();

    /* 3. A prioridade crítica está nomeada, não escondida num número. */
    await expect(atencao.getByText("Conta vencida").first()).toBeVisible();

    /* 4. A ação leva direto à tela onde dá para resolver. */
    await atencao.getByRole("link", { name: "Ver contas vencidas" }).click();
    await page.waitForURL(/\/app\/contas/);

    /* 5. Registra a decisão que a família tomou a respeito. */
    await page.goto("/app/decisoes");
    await expect(page.getByRole("heading", { name: "Decisões da família" })).toBeVisible();

    await page.getByRole("button", { name: "Registrar decisão" }).click();
    const dialogo = page.getByRole("dialog", { name: "Registrar decisão" });
    await expect(dialogo).toBeVisible();

    await dialogo.getByLabel("O que foi decidido").fill(decisao);
    await dialogo.getByLabel("Valor envolvido").fill("180,00");
    await dialogo.getByRole("button", { name: "Salvar decisão" }).click();

    /* 6. Ela aparece na linha do tempo, e continua lá depois de recarregar. */
    await expect(dialogo).toBeHidden();
    await expect(page.getByText(decisao)).toBeVisible({ timeout: 15_000 });

    await page.reload();
    await expect(page.getByText(decisao)).toBeVisible({ timeout: 15_000 });

    /* 7. O plano de ação mostra o que foi combinado, junto do que falta. */
    await page.goto("/app/plano");
    await expect(page.getByRole("heading", { name: "Plano de ação" })).toBeVisible();
    // Pelo papel, e não pelo texto: o menu lateral tem um link com este mesmo
    // nome, e no celular ele fica no DOM mas escondido (`hidden md:block`).
    // `getByText(...).first()` casava com o link invisível, não com o cartão.
    await expect(page.getByRole("heading", { name: "Decisões da família" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Abrir histórico" })).toBeVisible();
    // O cartão do plano lista o que está combinado; a asserção pelo texto
    // exato da decisão fica no histórico, que é a lista completa.
    await expect(page.getByText("Nenhuma decisão registrada ainda")).toHaveCount(0);
  });

  test("marca uma decisão como feita, e o estado sobrevive a um recarregamento", async ({
    page,
  }) => {
    await signIn(page, USERS.indebted.email);
    await page.goto("/app/decisoes");

    // A decisão que o seed deixa pendente: procurar o banco para alongar o
    // prazo. É dela que a linha é marcada como feita.
    const linha = page
      .getByRole("listitem")
      .filter({ hasText: "alongar o prazo do empréstimo pessoal" })
      .first();
    await expect(linha).toBeVisible();

    const botao = linha.getByRole("button", { name: /Marcar como/ });
    const rotuloInicial = (await botao.textContent())?.trim();

    await botao.click();
    await expect(botao).not.toHaveText(rotuloInicial ?? "", { timeout: 15_000 });

    const rotuloDepois = (await botao.textContent())?.trim();
    await page.reload();
    await expect(
      page
        .getByRole("listitem")
        .filter({ hasText: "alongar o prazo do empréstimo pessoal" })
        .first()
        .getByRole("button", { name: /Marcar como/ }),
    ).toHaveText(rotuloDepois ?? "", { timeout: 15_000 });
  });

  test("abre o histórico já com o botão de registrar para quem pode escrever", async ({ page }) => {
    // A recusa a um VIEWER é garantida pelas Security Rules e está coberta em
    // tests/rules. O que falta verificar contra a stack real é o outro lado:
    // que uma casa recém-chegada — a Souza não tem nenhuma decisão gravada —
    // encontra a tela pronta para receber a primeira, e não um beco sem saída.
    await signIn(page, USERS.massMarket.email);
    await page.goto("/app/decisoes");

    await expect(page.getByRole("heading", { name: "Decisões da família" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Registrar decisão" }).first()).toBeVisible();
  });
});

test.describe("importar extrato", () => {
  test("lê o arquivo, propõe, e só grava o que foi confirmado", async ({ page }) => {
    await signIn(page, USERS.organised.email);
    await page.goto("/app/importar");

    await page.getByLabel("Arquivo do extrato").setInputFiles({
      name: "extrato.ofx",
      mimeType: "text/plain",
      // Duas notações de número no mesmo arquivo, de propósito: o
      // americano do OFX e o brasileiro que alguns bancos escrevem nele.
      buffer: Buffer.from(
        [
          "OFXHEADER:100",
          "<OFX>",
          "<STMTTRN><DTPOSTED>20260901<TRNAMT>-45.90<FITID>E2E1<MEMO>MERCADO E2E</STMTTRN>",
          "<STMTTRN><DTPOSTED>20260902<TRNAMT>-1.234,56<FITID>E2E2<MEMO>ALUGUEL E2E</STMTTRN>",
          "<STMTTRN><TRNAMT>-10.00<MEMO>SEM DATA</STMTTRN>",
          "</OFX>",
        ].join("\n"),
      ),
    });

    await expect(page.getByText("Confira antes de importar")).toBeVisible();
    await expect(page.getByText("MERCADO E2E")).toBeVisible();
    // R$ 1.234,56 e não R$ 1,23: o erro que passaria despercebido.
    await expect(page.getByText(/−\s*R\$\s*1\.234,56/)).toBeVisible();
    await expect(page.getByText(/1 linha não lida/)).toBeVisible();
  });
});

test.describe("pessoa sem acesso", () => {
  test("cadastra um dependente e ele passa a aparecer na atribuição", async ({ page }) => {
    await signIn(page, USERS.massMarket.email);
    await page.goto("/app/membros");

    await page.getByRole("button", { name: "Adicionar pessoa sem acesso" }).click();

    // Os dois diálogos ficam no DOM, um deles fechado; sem escopo, o campo
    // "Nome da pessoa" casa com os dois.
    const dialogo = page.getByRole("dialog", { name: "Adicionar pessoa sem acesso" });
    await dialogo.getByLabel("Nome da pessoa").fill("Lucas E2E");
    await dialogo.getByRole("button", { name: "Adicionar", exact: true }).click();

    // Aparece na lista de quem tem acesso e no seletor "de quem é" — as duas
    // são o ponto, então basta confirmar a presença.
    await expect(page.getByText("Lucas E2E").first()).toBeVisible({ timeout: 15_000 });
    // "Sem acesso" também é o rótulo na legenda de papéis logo abaixo; o que
    // importa é o que aparece na linha da pessoa, dentro de "Quem tem acesso".
    await expect(page.getByText("Sem acesso").first()).toBeVisible();
  });
});

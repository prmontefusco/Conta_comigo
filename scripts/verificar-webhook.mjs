/**
 * Confere se o token cadastrado no painel do Asaas é o mesmo que o servidor
 * espera.
 *
 * Existe por causa de um botão. Ao lado do campo "Token de autenticação", o
 * painel do Asaas oferece **Gerar Token** — e um token gerado ali não é o
 * `PAYMENT_WEBHOOK_SECRET` do servidor. Quando os dois divergem, nada avisa: a
 * cobrança é paga normalmente, o Asaas envia o evento, o servidor responde 401
 * e o plano nunca é concedido. O sintoma aparece no pior lugar possível — em
 * alguém que pagou e não recebeu.
 *
 * O teste é inócuo por construção. O evento enviado **não** começa com
 * `PAYMENT_`, então o handler responde antes de tocar em assinatura, cobrança
 * ou API do Asaas (src/app/api/webhook/pagamento/route.ts). O que se exercita é
 * exatamente a verificação do segredo, e nada mais.
 *
 * Uso:
 *
 *   PAYMENT_WEBHOOK_SECRET='...' node scripts/verificar-webhook.mjs
 *
 * Ou contra outro ambiente:
 *
 *   PAYMENT_WEBHOOK_SECRET='...' node scripts/verificar-webhook.mjs http://127.0.0.1:5002
 *
 * O token nunca é impresso, nem em caso de erro.
 */

const DEFAULT_ORIGIN = "https://contacomigo.api.br";
const PATH = "/api/webhook/pagamento";

const origin = (process.argv[2] ?? DEFAULT_ORIGIN).replace(/\/+$/, "");
const url = `${origin}${PATH}`;
const secret = process.env.PAYMENT_WEBHOOK_SECRET;

if (!secret) {
  console.error(
    "\n[verificar-webhook] Falta o segredo.\n\n" +
      "  Leia o valor sem imprimi-lo no histórico do terminal:\n" +
      "    npx firebase apphosting:secrets:access PAYMENT_WEBHOOK_SECRET --project prod\n\n" +
      "  Depois:\n" +
      "    PAYMENT_WEBHOOK_SECRET='<valor>' node scripts/verificar-webhook.mjs\n",
  );
  process.exit(2);
}

const linha = "─".repeat(68);

async function main() {
  console.info(`\n[verificar-webhook] ${url}\n${linha}`);

  /* --- 1. A rota está no ar? ---------------------------------------- */

  const alcance = await fetch(url, { method: "GET" }).catch((error) => error);

  if (alcance instanceof Error) {
    falhar("A rota não respondeu.", [
      `Erro de rede: ${alcance.message}`,
      "Confira o endereço e se o rollout do App Hosting terminou.",
    ]);
  }

  if (alcance.status !== 200) {
    falhar(`GET respondeu ${alcance.status}, e deveria responder 200.`, [
      "A rota existe para confirmar que subiu. Um status diferente sugere",
      "que esta versão do aplicativo ainda não está publicada.",
    ]);
  }

  console.info("  [1/2] A rota está no ar (GET 200).");

  /* --- 2. O segredo confere? ---------------------------------------- */

  // Sem prefixo `PAYMENT_`: o handler responde antes de qualquer efeito.
  const resposta = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "asaas-access-token": secret,
    },
    body: JSON.stringify({ event: "VERIFICACAO_DE_CADASTRO" }),
  }).catch((error) => error);

  if (resposta instanceof Error) {
    falhar("O POST não completou.", [`Erro de rede: ${resposta.message}`]);
  }

  if (resposta.status === 200) {
    console.info("  [2/2] O segredo confere (POST 200).");
    console.info(
      `${linha}\n` +
        "  Tudo certo. O que o Asaas enviar chega autenticado.\n\n" +
        "  Isto não prova que a cobrança será concedida — só que o servidor\n" +
        "  aceita o remetente. A concessão depende da releitura da cobrança\n" +
        "  no provedor, que é o que torna um POST forjado inútil.\n",
    );
    return;
  }

  if (resposta.status === 401) {
    falhar("O segredo NÃO confere (401).", [
      "O token do painel do Asaas é diferente do PAYMENT_WEBHOOK_SECRET.",
      "",
      "A causa quase sempre é o botão 'Gerar Token': ele cria um valor novo,",
      "que o servidor não conhece. Cole no painel o mesmo valor da variável,",
      "salve, e rode isto de novo.",
    ]);
  }

  if (resposta.status === 503) {
    falhar("O servidor não tem PAYMENT_WEBHOOK_SECRET configurado (503).", [
      "A variável não chegou ao ambiente de execução. Confira o App Hosting",
      "e lembre que mudar variável exige um novo rollout para valer.",
    ]);
  }

  falhar(`Resposta inesperada: ${resposta.status}.`, [await resposta.text().catch(() => "")]);
}

function falhar(titulo, detalhes) {
  console.error(`\n[verificar-webhook] ${titulo}\n`);
  for (const linhaDetalhe of detalhes) {
    if (linhaDetalhe) console.error(`  ${linhaDetalhe}`);
    else console.error("");
  }
  console.error("");
  process.exit(1);
}

main().catch((error) => {
  // A mensagem pode conter a URL, nunca o segredo: ele só existe no cabeçalho.
  console.error(`\n[verificar-webhook] Falha inesperada: ${error.message}\n`);
  process.exit(1);
});

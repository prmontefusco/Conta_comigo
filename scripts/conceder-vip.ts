/**
 * ============================================================================
 * CONTA COMIGO - SCRIPT DE CONCESSÃO DE ACESSO VIP / TESTE GRATUITO
 * ============================================================================
 *
 * Este script concede, consulta ou revoga acesso PREMIUM (cortesia/teste)
 * diretamente no Firebase Firestore do Conta Comigo.
 *
 * ----------------------------------------------------------------------------
 * 📋 COMO FUNCIONA:
 * ----------------------------------------------------------------------------
 * 1. O script busca o usuário pelo e-mail (no Firebase Auth e no Firestore).
 * 2. Grava a assinatura em `subscriptions/{uid}` com:
 *      plan: "PREMIUM"
 *      status: "ACTIVE"
 *      expiresAt: <data de validade> (padrão: 10 anos / permanente)
 * 3. Atualiza o espelho do plano no perfil do usuário em `users/{uid}`.
 * 4. O usuário tem o acesso liberado IMEDIATAMENTE no navegador (tempo real),
 *    sem necessidade de novo deploy no App Hosting e sem reiniciar o app.
 *
 * ----------------------------------------------------------------------------
 * 🚀 COMO EXECUTAR O SCRIPT:
 * ----------------------------------------------------------------------------
 *
 * OPÇÃO 1: Executando contra a PRODUÇÃO (Firebase Real)
 * ---------------------------------------------------
 * O script precisa de permissão de administrador no projeto Firebase.
 *
 * Passo 1.1: Autentique seu terminal no Google Cloud / Firebase (faça uma única vez):
 *    gcloud auth application-default login
 *
 *    (OU se você tiver uma chave JSON de conta de serviço baixada do console):
 *    No PowerShell:
 *      $env:GOOGLE_APPLICATION_CREDENTIALS="C:\caminho\para\sua-chave.json"
 *
 * Passo 1.2: Execute o script passando o e-mail:
 *
 *    # Conceder acesso VIP permanente (10 anos):
 *    npm run vip -- amigo@exemplo.com
 *
 *    # Conceder acesso VIP por um período específico (ex: 60 dias):
 *    npm run vip -- testador@exemplo.com --dias 60
 *
 *    # Conceder para múltiplos e-mails de uma só vez:
 *    npm run vip -- user1@gmail.com user2@gmail.com --dias 90
 *
 *    # Apenas consultar a situação atual de um usuário:
 *    npm run vip -- usuario@exemplo.com --status
 *
 *    # Revogar o acesso VIP (retornar para plano FREE):
 *    npm run vip -- usuario@exemplo.com --revogar
 *
 *
 * OPÇÃO 2: Executando localmente contra os EMULADORES (Desenvolvimento)
 * --------------------------------------------------------------------
 * Se você estiver rodando `npm run dev:all` ou `npm run emulators`:
 *
 * No PowerShell:
 *    $env:FIRESTORE_EMULATOR_HOST="127.0.0.1:8080"
 *    $env:FIREBASE_AUTH_EMULATOR_HOST="127.0.0.1:9099"
 *    npm run vip -- teste@local.com
 *
 * ============================================================================
 */

import { initializeApp, getApps, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const PROJECT_ID =
  process.env.GCLOUD_PROJECT ??
  process.env.GOOGLE_CLOUD_PROJECT ??
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ??
  "conta-comigo-a318a";

const isEmulator = Boolean(
  process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST,
);

// Inicializa o Firebase Admin SDK
const existingApps = getApps();
const app =
  existingApps[0] ??
  initializeApp(
    isEmulator
      ? { projectId: PROJECT_ID }
      : { credential: applicationDefault(), projectId: PROJECT_ID },
  );

const auth = getAuth(app);
const db = getFirestore(app);

interface CliOptions {
  emails: string[];
  days: number;
  revoke: boolean;
  statusOnly: boolean;
  help: boolean;
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    emails: [],
    days: 3650, // Padrão: 10 anos (~permanente)
    revoke: false,
    statusOnly: false,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;
    if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (arg === "--revogar" || arg === "--revoke") {
      options.revoke = true;
    } else if (arg === "--status" || arg === "-s") {
      options.statusOnly = true;
    } else if (arg === "--dias" || arg === "-d") {
      const nextArg = args[++i];
      const val = nextArg ? parseInt(nextArg, 10) : NaN;
      if (!isNaN(val) && val > 0) {
        options.days = val;
      } else {
        console.error(`❌ Valor inválido para --dias: "${nextArg ?? ""}". Use um número positivo.`);
        process.exit(1);
      }
    } else if (!arg.startsWith("-")) {
      options.emails.push(arg.trim().toLowerCase());
    }
  }

  return options;
}

function showHelp() {
  console.log(`
Uso: npm run vip -- <e-mail> [opções]

Opções:
  <e-mail...>           Um ou mais endereços de e-mail dos usuários
  --dias, -d <número>    Duração do acesso em dias (padrão: 3650 dias / 10 anos)
  --status, -s          Apenas consulta o status atual do usuário sem alterar
  --revogar             Revoga o acesso VIP e retorna a conta para FREE
  --help, -h            Exibe esta ajuda

Exemplos:
  npm run vip -- amigo@teste.com
  npm run vip -- amigo@teste.com --dias 30
  npm run vip -- amigo@teste.com --status
  npm run vip -- amigo@teste.com --revogar
  `);
}

async function findUser(email: string) {
  let uid: string | null = null;
  let displayName = "Não informado";

  // 1. Tentar localizar no Firebase Auth
  try {
    const userRecord = await auth.getUserByEmail(email);
    uid = userRecord.uid;
    if (userRecord.displayName) displayName = userRecord.displayName;
  } catch {
    // Não encontrado no Auth direto pelo SDK, tenta na coleção 'users' do Firestore
  }

  // 2. Tentar localizar no Firestore
  if (!uid) {
    const querySnapshot = await db.collection("users").where("email", "==", email).limit(1).get();

    if (!querySnapshot.empty) {
      const firstDoc = querySnapshot.docs[0];
      if (firstDoc) {
        uid = firstDoc.id;
        const data = firstDoc.data();
        if (typeof data.displayName === "string") displayName = data.displayName;
      }
    }
  }

  return uid ? { uid, email, displayName } : null;
}

async function processUser(email: string, options: CliOptions) {
  console.log(`\n🔍 Buscando usuário com e-mail: ${email}...`);

  const user = await findUser(email);
  if (!user) {
    console.error(`❌ Usuário com e-mail "${email}" não encontrado.`);
    console.error(`   Certifique-se de que a pessoa já criou a conta no Conta Comigo.`);
    return;
  }

  console.log(`👤 Usuário encontrado:`);
  console.log(`   - Nome: ${user.displayName}`);
  console.log(`   - UID:  ${user.uid}`);

  const subDocRef = db.collection("subscriptions").doc(user.uid);
  const userDocRef = db.collection("users").doc(user.uid);
  const currentSubSnap = await subDocRef.get();
  const currentSub = currentSubSnap.data();

  if (options.statusOnly) {
    console.log(`\n📊 Status Atual da Assinatura:`);
    if (!currentSub) {
      console.log(
        `   - Sem registro de assinatura (Plano padrão FREE ou teste inicial de 30 dias)`,
      );
    } else {
      console.log(`   - Plano:      ${currentSub.plan ?? "N/A"}`);
      console.log(`   - Status:     ${currentSub.status ?? "N/A"}`);
      console.log(`   - Provedor:   ${currentSub.provider ?? "N/A"}`);
      console.log(
        `   - Expira em:  ${currentSub.expiresAt ? new Date(currentSub.expiresAt).toLocaleString("pt-BR") : "Sem expiração"}`,
      );
      console.log(
        `   - Atualizado: ${currentSub.updatedAt ? new Date(currentSub.updatedAt).toLocaleString("pt-BR") : "N/A"}`,
      );
      if (currentSub.notes) console.log(`   - Notas:      ${currentSub.notes}`);
    }
    return;
  }

  const now = new Date();
  const nowIso = now.toISOString();

  if (options.revoke) {
    console.log(`⚠️  Revogando acesso VIP...`);
    await subDocRef.set(
      {
        userId: user.uid,
        plan: "FREE",
        status: "EXPIRED",
        updatedAt: nowIso,
        notes: `VIP revogado manualmente via script em ${now.toLocaleString("pt-BR")}`,
      },
      { merge: true },
    );

    await userDocRef.set(
      {
        plan: "FREE",
        updatedAt: nowIso,
      },
      { merge: true },
    );

    console.log(`✅ Acesso revogado com sucesso! A conta agora está no plano FREE.`);
    return;
  }

  // Conceder VIP
  const expiresDate = new Date(now.getTime() + options.days * 86_400_000);
  const expiresIso = expiresDate.toISOString();

  console.log(`✨ Concedendo acesso PREMIUM VIP (${options.days} dias)...`);

  await subDocRef.set(
    {
      userId: user.uid,
      plan: "PREMIUM",
      status: "ACTIVE",
      provider: "MANUAL",
      activatedAt: nowIso,
      expiresAt: expiresIso,
      updatedAt: nowIso,
      notes: `Acesso VIP concedido manualmente via script em ${now.toLocaleString("pt-BR")}`,
    },
    { merge: true },
  );

  // Espelha no documento do perfil
  await userDocRef.set(
    {
      plan: "PREMIUM",
      updatedAt: nowIso,
    },
    { merge: true },
  );

  console.log(`🎉 Sucesso! Acesso VIP concedido para ${email}:`);
  console.log(`   - Plano:     PREMIUM`);
  console.log(`   - Status:    ACTIVE`);
  console.log(`   - Válido até: ${expiresDate.toLocaleDateString("pt-BR")} (${options.days} dias)`);
  console.log(`   O usuário já pode recarregar a página e usufruir de todos os recursos.`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help || options.emails.length === 0) {
    showHelp();
    process.exit(options.help ? 0 : 1);
  }

  console.log(`\n======================================================`);
  console.log(`Conta Comigo - Gerenciador de Acessos VIP`);
  console.log(`Projeto: ${PROJECT_ID} ${isEmulator ? "(EMULADOR LOCAL)" : "(PRODUÇÃO)"}`);
  console.log(`======================================================`);

  for (const email of options.emails) {
    try {
      await processUser(email, options);
    } catch (err: unknown) {
      console.error(`❌ Erro ao processar o usuário ${email}:`, err);
    }
  }

  console.log(`\nConcluído!\n`);
}

main().catch((err) => {
  console.error("❌ Erro fatal:", err);
  process.exit(1);
});

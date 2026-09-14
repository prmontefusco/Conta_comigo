/**
 * Seeds one realistic local user without clearing the existing fixtures.
 *
 *   npx tsx scripts/seed-test-user.ts
 */

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "demo-conta-comigo";
const FIRESTORE_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? "127.0.0.1:8080";
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST ?? "127.0.0.1:9099";

if (!PROJECT_ID.startsWith("demo-")) {
  console.error(`[seed-test-user] Recusando executar contra o projeto "${PROJECT_ID}".`);
  process.exit(1);
}

process.env.FIRESTORE_EMULATOR_HOST = FIRESTORE_HOST;
process.env.FIREBASE_AUTH_EMULATOR_HOST = AUTH_HOST;
process.env.GCLOUD_PROJECT = PROJECT_ID;

import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { addDays, addMonths, instant, startOfMonth } from "../src/core/date/calendar-date";
import { fromDecimal } from "../src/core/money/money";
import { DEFAULT_HOUSEHOLD_SETTINGS } from "../src/modules/household/domain/household";
import { categoriesFor, categoryId, seedAnchors, SEED_TIMEZONE } from "./seed-data";

const app = initializeApp({ projectId: PROJECT_ID }, "seed-test-user");
const db = getFirestore(app);
const auth = getAuth(app);
const now = instant();
const anchors = seedAnchors();
const brl = (value: number) => fromDecimal(value);

const USER = {
  uid: "teste-paulo-completo",
  email: "teste@contacomigo.local",
  password: "Teste1234!",
  displayName: "Paulo Teste",
};

const SPOUSE = {
  uid: "teste-marina-completo",
  email: "marina.teste@contacomigo.local",
  displayName: "Marina Teste",
};

const householdId = "teste-familia-realista";
const audit = { createdAt: now, updatedAt: now, createdBy: USER.uid };

async function main() {
  console.info(`[seed-test-user] Projeto: ${PROJECT_ID}`);
  console.info(`[seed-test-user] Firestore: ${FIRESTORE_HOST} | Auth: ${AUTH_HOST}`);

  await auth
    .createUser({
      uid: USER.uid,
      email: USER.email,
      password: USER.password,
      displayName: USER.displayName,
      emailVerified: true,
    })
    .catch(async (error: unknown) => {
      if ((error as { code?: string }).code !== "auth/uid-already-exists") throw error;
      await auth.updateUser(USER.uid, {
        email: USER.email,
        password: USER.password,
        displayName: USER.displayName,
        emailVerified: true,
      });
    });

  await db.doc(`users/${USER.uid}`).set({
    uid: USER.uid,
    displayName: USER.displayName,
    email: USER.email,
    plan: "PREMIUM",
    defaultHouseholdId: householdId,
    onboardingCompletedSteps: [
      "CREATE_HOUSEHOLD",
      "ADD_MAIN_INCOME",
      "ADD_ACCOUNTS",
      "ADD_RECURRING_BILLS",
      "ADD_CARDS",
      "ADD_DEBTS",
    ],
    acceptedTermsAt: now,
    cpf: "123.456.789-09",
    phone: "(67) 99999-0000",
    birthDate: "1988-05-14",
    occupation: "Analista financeiro",
    declaredMonthlyIncome: brl(7200),
    address: {
      cep: "79000-000",
      street: "Rua das Acácias",
      number: "120",
      neighborhood: "Centro",
      city: "Campo Grande",
      state: "MS",
    },
    familyMembers: [
      {
        id: SPOUSE.uid,
        name: SPOUSE.displayName,
        relationship: "Cônjuge",
        birthDate: "1990-09-20",
        isDependent: false,
      },
      {
        id: "teste-filho-lucas",
        name: "Lucas Teste",
        relationship: "Filho",
        birthDate: "2016-02-11",
        isDependent: true,
      },
    ],
    financialGoal: "ORGANIZATION",
    ...audit,
  });

  await db.doc(`households/${householdId}`).set({
    name: "Família Teste",
    ownerUid: USER.uid,
    memberUids: [USER.uid],
    settings: { ...DEFAULT_HOUSEHOLD_SETTINGS, timezone: SEED_TIMEZONE },
    archived: false,
    ...audit,
  });

  await db.doc(`households/${householdId}/members/${USER.uid}`).set({
    uid: USER.uid,
    householdId,
    displayName: USER.displayName,
    email: USER.email,
    role: "OWNER",
    status: "ACTIVE",
    joinedAt: now,
    ...audit,
  });

  await write("categories", categoriesFor(householdId));
  await write("accounts", accounts());
  await write("vehicles", vehicles());
  await write("properties", properties());
  await write("creditCards", creditCards());
  await write("cardPurchases", cardPurchases());
  await write("recurringRules", recurringRules());
  await write("obligations", obligations());
  await write("transactions", transactions());
  await write("debts", debts());
  await write("reserves", reserves());
  await write("goals", goals());
  await write("budgets", budgets());
  await write("decisions", decisions());
  await write("irpfRecords", irpfRecords());

  console.info("\nUsuário pronto para teste:");
  console.info(`  E-mail: ${USER.email}`);
  console.info(`  Senha:  ${USER.password}`);
  console.info("  URL:    http://localhost:3000/entrar\n");
}

async function write(collectionName: string, documents: readonly Record<string, unknown>[]) {
  if (documents.length === 0) return;
  const batch = db.batch();
  for (const document of documents) {
    const { id, ...data } = document as { id: string } & Record<string, unknown>;
    batch.set(db.doc(`households/${householdId}/${collectionName}/${id}`), {
      ...audit,
      ...data,
      householdId,
    });
  }
  await batch.commit();
}

function accounts() {
  return [
    {
      id: "teste-conta-corrente",
      name: "Conta corrente Itaú",
      type: "CHECKING",
      institution: "Itaú",
      openingBalance: brl(3850),
      openingBalanceDate: anchors.monthStart,
      overdraftLimit: brl(1200),
      visibility: "HOUSEHOLD",
      includeInTotals: true,
      archived: false,
    },
    {
      id: "teste-reserva-conta",
      name: "Caixinha emergência",
      type: "SAVINGS",
      institution: "Nubank",
      openingBalance: brl(2400),
      openingBalanceDate: anchors.monthStart,
      visibility: "HOUSEHOLD",
      includeInTotals: true,
      archived: false,
    },
  ];
}

function vehicles() {
  return [
    {
      id: "teste-veiculo-civic",
      name: "Honda Civic",
      plate: "ABC1D23",
      brand: "Honda",
      model: "Civic",
      year: 2019,
      ipvaDueDate: addMonths(anchors.monthStart, 3),
      ownerMemberId: USER.uid,
      archived: false,
    },
  ];
}

function properties() {
  return [
    {
      id: "teste-imovel-casa",
      name: "Casa principal",
      kind: "HOME",
      address: "Rua das Acácias, 120 - Campo Grande/MS",
      iptuDueDate: addMonths(anchors.monthStart, 4),
      ownerMemberId: USER.uid,
      archived: false,
    },
  ];
}

function creditCards() {
  return [
    {
      id: "teste-cartao-passai",
      name: "Passaí Mastercard",
      issuer: "Itaú",
      brand: "Mastercard",
      lastFourDigits: "8895",
      holderMemberId: USER.uid,
      creditLimit: brl(4500),
      closingDay: 10,
      dueDay: 17,
      visibility: "HOUSEHOLD",
      archived: false,
      color: "#2563eb",
    },
    {
      id: "teste-cartao-nubank",
      name: "Nubank Ultravioleta",
      issuer: "Nubank",
      brand: "Mastercard",
      lastFourDigits: "1234",
      holderMemberId: USER.uid,
      creditLimit: brl(8000),
      closingDay: 25,
      dueDay: 5,
      visibility: "HOUSEHOLD",
      archived: false,
      color: "#7c3aed",
    },
  ];
}

function cardPurchases() {
  return [
    {
      id: "teste-compra-mercado-passai",
      creditCardId: "teste-cartao-passai",
      description: "Assaí Atacadista",
      merchant: "Assaí Atacadista",
      totalAmount: brl(763.56),
      purchaseDate: addDays(anchors.today, -8),
      competenceDate: addDays(anchors.today, -8),
      categoryId: categoryId(householdId, "alimentacao"),
      installmentCount: 3,
      visibility: "HOUSEHOLD",
      responsibleMemberId: USER.uid,
    },
    {
      id: "teste-compra-pneus",
      creditCardId: "teste-cartao-nubank",
      description: "Pneus do Civic",
      merchant: "Auto Center Avenida",
      totalAmount: brl(1800),
      purchaseDate: addMonths(anchors.today, -1),
      competenceDate: addMonths(anchors.today, -1),
      categoryId: categoryId(householdId, "veiculo"),
      installmentCount: 6,
      visibility: "HOUSEHOLD",
      vehicleId: "teste-veiculo-civic",
    },
    {
      id: "teste-compra-consulta",
      creditCardId: "teste-cartao-nubank",
      description: "Consulta pediátrica",
      merchant: "Clínica Infantil",
      totalAmount: brl(320),
      purchaseDate: addDays(anchors.today, -5),
      competenceDate: addDays(anchors.today, -5),
      categoryId: categoryId(householdId, "saude"),
      installmentCount: 1,
      visibility: "HOUSEHOLD",
      responsibleMemberId: "teste-filho-lucas",
    },
  ];
}

function recurringRules() {
  return [
    incomeRule("teste-renda-salario", "Salário Paulo", 7200, 5, "salario", USER.uid),
    incomeRule("teste-renda-marina", "Freelas Marina", 1800, 20, "renda-extra", SPOUSE.uid, "ESTIMATED"),
    outflowRule("teste-aluguel", "Aluguel", 2100, 10, "moradia", "FIXED", "CONFIRMED", {
      propertyId: "teste-imovel-casa",
    }),
    outflowRule("teste-energia", "Energia elétrica", 420, 15, "energia", "VARIABLE", "ESTIMATED", {
      propertyId: "teste-imovel-casa",
    }),
    outflowRule("teste-internet", "Internet", 129.9, 12, "internet"),
    outflowRule("teste-combustivel", "Combustível", 650, 8, "veiculo", "VARIABLE", "ESTIMATED", {
      vehicleId: "teste-veiculo-civic",
    }),
    outflowRule("teste-escola", "Escola Lucas", 980, 7, "educacao", "FIXED", "CONFIRMED", {
      responsibleMemberId: "teste-filho-lucas",
    }),
  ];
}

function incomeRule(
  id: string,
  description: string,
  amount: number,
  dayOfMonth: number,
  slug: string,
  memberId: string,
  confidence = "CONFIRMED",
) {
  return {
    id,
    direction: "INFLOW",
    description,
    amount: brl(amount),
    frequency: "MONTHLY",
    interval: 1,
    dayOfMonth,
    startDate: addMonths(anchors.today, -12),
    weekendPolicy: "KEEP",
    categoryId: categoryId(householdId, slug),
    expenseNature: "FIXED",
    confidence,
    visibility: "HOUSEHOLD",
    responsibleMemberId: memberId,
    active: true,
  };
}

function outflowRule(
  id: string,
  description: string,
  amount: number,
  dayOfMonth: number,
  slug: string,
  expenseNature = "FIXED",
  confidence = "CONFIRMED",
  extra: Record<string, unknown> = {},
) {
  return {
    id,
    direction: "OUTFLOW",
    description,
    amount: brl(amount),
    frequency: "MONTHLY",
    interval: 1,
    dayOfMonth,
    startDate: addMonths(anchors.today, -12),
    weekendPolicy: "KEEP",
    categoryId: categoryId(householdId, slug),
    expenseNature,
    confidence,
    visibility: "HOUSEHOLD",
    active: true,
    ...extra,
  };
}

function obligations() {
  return [
    {
      id: "teste-conta-agua-vencida",
      direction: "OUTFLOW",
      origin: "MANUAL",
      description: "Água em atraso",
      amount: brl(146.4),
      dueDate: addDays(anchors.today, -6),
      competenceDate: monthStartFrom(anchors.today),
      categoryId: categoryId(householdId, "agua"),
      expectedAccountId: "teste-conta-corrente",
      expenseNature: "VARIABLE",
      confidence: "CONFIRMED",
      visibility: "HOUSEHOLD",
      propertyId: "teste-imovel-casa",
      status: "SCHEDULED",
      settledAmount: brl(0),
      settlementTransactionIds: [],
    },
    {
      id: "teste-ipva-futuro",
      direction: "OUTFLOW",
      origin: "MANUAL",
      description: "IPVA Civic",
      amount: brl(1280),
      dueDate: addMonths(anchors.today, 2),
      competenceDate: addMonths(anchors.today, 2),
      categoryId: categoryId(householdId, "impostos"),
      expectedAccountId: "teste-conta-corrente",
      expenseNature: "OCCASIONAL",
      confidence: "CONFIRMED",
      visibility: "HOUSEHOLD",
      vehicleId: "teste-veiculo-civic",
      status: "SCHEDULED",
      settledAmount: brl(0),
      settlementTransactionIds: [],
    },
  ];
}

function transactions() {
  return [
    {
      id: "teste-tx-mercado",
      kind: "EXPENSE",
      amount: brl(438.75),
      transactionDate: addDays(anchors.today, -4),
      competenceDate: addDays(anchors.today, -4),
      description: "Supermercado Comper",
      visibility: "HOUSEHOLD",
      accountId: "teste-conta-corrente",
      categoryId: categoryId(householdId, "alimentacao"),
      responsibleMemberId: USER.uid,
    },
    {
      id: "teste-tx-abastecimento",
      kind: "EXPENSE",
      amount: brl(280),
      transactionDate: addDays(anchors.today, -2),
      competenceDate: addDays(anchors.today, -2),
      description: "Abastecimento Civic",
      visibility: "HOUSEHOLD",
      accountId: "teste-conta-corrente",
      categoryId: categoryId(householdId, "veiculo"),
      vehicleId: "teste-veiculo-civic",
    },
    {
      id: "teste-tx-aluguel",
      kind: "EXPENSE",
      amount: brl(2100),
      transactionDate: addDays(anchors.today, -1),
      competenceDate: monthStartFrom(anchors.today),
      description: "Aluguel pago",
      visibility: "HOUSEHOLD",
      accountId: "teste-conta-corrente",
      categoryId: categoryId(householdId, "moradia"),
      propertyId: "teste-imovel-casa",
    },
  ];
}

function debts() {
  return [
    {
      id: "teste-emprestimo-pessoal",
      kind: "PERSONAL_LOAN",
      description: "Empréstimo pessoal Itaú",
      institution: "Itaú",
      principalContracted: brl(16000),
      amountDisbursed: brl(15120),
      disbursementDate: addMonths(anchors.today, -6),
      amortisationSystem: "PRICE",
      interestRateMonthly: 2.89,
      cetAnnual: 46.5,
      installmentCount: 24,
      installmentAmount: brl(920),
      firstDueDate: addMonths(anchors.today, -5),
      installmentsPaidBeforeTracking: 5,
      monthlyInsurance: brl(18),
      status: "ACTIVE",
      visibility: "HOUSEHOLD",
      responsibleMemberId: USER.uid,
    },
  ];
}

function reserves() {
  return [
    {
      id: "teste-reserva-emergencia",
      name: "Reserva de emergência",
      purpose: "EMERGENCY",
      currentAmount: brl(2400),
      targetAmount: brl(18000),
      accountId: "teste-reserva-conta",
      isProtected: true,
      visibility: "HOUSEHOLD",
      archived: false,
    },
  ];
}

function goals() {
  return [
    {
      id: "teste-meta-quitar",
      name: "Quitar empréstimo pessoal",
      targetAmount: brl(16000),
      targetDate: addMonths(anchors.today, 18),
      status: "ACTIVE",
      visibility: "HOUSEHOLD",
    },
  ];
}

function budgets() {
  return [
    {
      id: anchors.thisMonth,
      month: anchors.thisMonth,
      lines: [
        { categoryId: categoryId(householdId, "alimentacao"), plannedAmount: brl(1600) },
        { categoryId: categoryId(householdId, "veiculo"), plannedAmount: brl(850) },
        { categoryId: categoryId(householdId, "saude"), plannedAmount: brl(500) },
        { categoryId: categoryId(householdId, "lazer"), plannedAmount: brl(300) },
      ],
    },
  ];
}

function decisions() {
  return [
    {
      id: "teste-decisao-renegociar",
      kind: "RENEGOTIATE_DEBT",
      description: "Simular portabilidade do empréstimo se a parcela apertar o mês",
      decidedOn: addDays(anchors.today, -10),
      status: "PLANNED",
      visibility: "HOUSEHOLD",
      notes: "Comparar taxa atual de 2,89% ao mês.",
    },
  ];
}

function irpfRecords() {
  const taxYear = Number(anchors.today.slice(0, 4));
  return [
    {
      id: "teste-irpf-consulta",
      taxYear,
      kind: "HEALTH",
      title: "Consulta pediátrica Lucas",
      amount: brl(320),
      paidOn: addDays(anchors.today, -5),
      relatedMemberId: "teste-filho-lucas",
      documentName: "Recibo médico",
      documentIssuer: "Clínica Infantil",
      documentIdentifier: "12.345.678/0001-90",
      fileName: "recibo-consulta-lucas.pdf",
      archived: false,
    },
    {
      id: "teste-irpf-escola",
      taxYear,
      kind: "EDUCATION",
      title: "Mensalidade Escola Lucas",
      amount: brl(980),
      paidOn: addDays(anchors.today, -12),
      relatedMemberId: "teste-filho-lucas",
      documentName: "Nota fiscal",
      documentIssuer: "Escola Caminho Feliz",
      documentIdentifier: "98.765.432/0001-10",
      archived: false,
    },
    {
      id: "teste-irpf-informe",
      taxYear,
      kind: "INCOME",
      title: "Informe de rendimentos Itaú",
      documentName: "Informe anual",
      documentIssuer: "Itaú",
      fileName: "informe-itau.pdf",
      archived: false,
    },
  ];
}

function monthStartFrom(date: string) {
  return startOfMonth(date as never);
}

main()
  .then(() => process.exit(0))
  .catch((error: unknown) => {
    console.error("[seed-test-user] Falhou:", error);
    process.exit(1);
  });

import type { HouseholdRole } from "@/modules/shared/domain/common";

/**
 * O menu do aplicativo, em um lugar só.
 *
 * Havia duas listas: a do `AppShell`, que alimenta a coluna do desktop, e uma
 * escrita à mão em `/app/mais`, que é o único caminho para o resto do produto
 * no celular. Elas divergiram — e a divergência não aparece como erro, aparece
 * como tela que simplesmente não existe para quem usa o telefone. Contas a
 * pagar, Cartões, Importar extrato, Antes de comprar e Projeção ficaram sem
 * nenhum caminho no celular por causa disso.
 *
 * Aqui a lista é uma só. A coluna do desktop, a página "Mais" do celular e o
 * teste que confere se toda rota tem caminho leem deste arquivo.
 *
 * ## Por que a barra de baixo é curta
 *
 * A barra inferior comporta cinco ou seis alvos do tamanho de um polegar, e
 * guarda o que alguém abre em pé, numa fila. Ela não é o menu: é o atalho. O
 * menu do celular é "Mais", e ele leva a tudo — exatamente o que a coluna do
 * desktop leva.
 */

export interface NavItem {
  readonly href: string;
  readonly label: string;
  readonly icon: string;
  /** Escondido de quem é dependente no grupo. */
  readonly restrictedForDependent?: boolean;
}

export interface NavSection {
  readonly title: string;
  readonly items: readonly NavItem[];
}

export interface NavContext {
  readonly hasBankAccount?: boolean;
  readonly role?: HouseholdRole | null;
}

export const APP_NAV_SECTIONS: readonly NavSection[] = [
  {
    title: "Hoje",
    items: [
      { href: "/app", label: "Início", icon: "🏠" },
      { href: "/app/avisos", label: "Avisos", icon: "🔔" },
      { href: "/app/lancar", label: "Adicionar rápido", icon: "➕" },
    ],
  },
  {
    title: "Movimentos",
    items: [
      { href: "/app/entradas", label: "Entradas", icon: "💰" },
      { href: "/app/dia-a-dia", label: "Saídas", icon: "🧾" },
      { href: "/app/contas", label: "Contas a Pagar", icon: "📄" },
      {
        href: "/app/recorrentes",
        label: "Contas que se repetem",
        icon: "🔁",
        restrictedForDependent: true,
      },
      {
        href: "/app/importar",
        label: "Importar extrato",
        icon: "📥",
        restrictedForDependent: true,
      },
    ],
  },
  {
    title: "Cartões",
    items: [
      {
        href: "/app/cartoes",
        label: "Faturas e parcelas",
        icon: "💳",
        restrictedForDependent: true,
      },
    ],
  },
  {
    title: "Dívidas",
    items: [
      { href: "/app/emergencia", label: "Pagar primeiro", icon: "🚨" },
      {
        href: "/app/dividas",
        label: "Dívidas e empréstimos",
        icon: "🏛️",
        restrictedForDependent: true,
      },
      {
        href: "/app/negociar",
        label: "Negociar dívidas",
        icon: "🤝",
        restrictedForDependent: true,
      },
      {
        href: "/app/superendividamento",
        label: "Superendividamento",
        icon: "⚖️",
        restrictedForDependent: true,
      },
      { href: "/app/plano", label: "Plano de recuperação", icon: "🧭" },
    ],
  },
  {
    title: "Planejamento",
    items: [
      {
        href: "/app/orcamento",
        label: "Orçamento do mês",
        icon: "🎯",
        restrictedForDependent: true,
      },
      {
        href: "/app/reservas",
        label: "Reservas e metas",
        icon: "🛟",
        restrictedForDependent: true,
      },
      { href: "/app/comprar", label: "Antes de comprar", icon: "🛒" },
      {
        href: "/app/projecao",
        label: "Projeção & Fluxo",
        icon: "📈",
        restrictedForDependent: true,
      },
      { href: "/app/visao-futuro", label: "Visão de Futuro", icon: "🚀" },
      { href: "/app/diagnostico-ia", label: "Diagnóstico IA", icon: "✨" },
    ],
  },
  {
    title: "Cadastros",
    items: [
      {
        href: "/app/meus-dados",
        label: "Dados pessoais",
        icon: "👤",
      },
      { href: "/app/membros", label: "Família", icon: "👥" },
      {
        href: "/app/contas-bancarias",
        label: "Contas bancárias",
        icon: "🏦",
        restrictedForDependent: true,
      },
      {
        href: "/app/cadastro-cartoes",
        label: "Cartões de crédito",
        icon: "💳",
        restrictedForDependent: true,
      },
      {
        href: "/app/cadastro-emprestimos",
        label: "Empréstimos",
        icon: "🏛️",
        restrictedForDependent: true,
      },
      { href: "/app/veiculos", label: "Veículos", icon: "🚗", restrictedForDependent: true },
      { href: "/app/imoveis", label: "Imóveis", icon: "🏘️", restrictedForDependent: true },
    ],
  },
  {
    title: "IRPF",
    items: [
      {
        href: "/app/irpf",
        label: "Imposto de renda",
        icon: "🧾",
        restrictedForDependent: true,
      },
    ],
  },
  {
    title: "Relatórios",
    items: [
      { href: "/app/decisoes", label: "Decisões da família", icon: "🗒️" },
      { href: "/app/relatorios", label: "Relatórios", icon: "📊", restrictedForDependent: true },
    ],
  },
  {
    title: "Configurações",
    items: [
      { href: "/app/configuracoes", label: "Configurações da conta", icon: "⚙️" },
      { href: "/app/assinatura", label: "Assinatura", icon: "💳" },
      { href: "/app/baixar-dados", label: "Backup e exportação", icon: "💾" },
    ],
  },
  {
    title: "Ajuda & Sobre",
    items: [
      { href: "/contato", label: "Fale Conosco / Suporte", icon: "💬" },
      { href: "/educacao-financeira", label: "Educação financeira", icon: "📚" },
      { href: "/privacidade", label: "Política de privacidade", icon: "🔒" },
      { href: "/termos", label: "Termos de uso", icon: "📄" },
    ],
  },
];

/**
 * A barra inferior do celular.
 *
 * Atalho, não menu: o que alguém abre em pé, numa fila. "Mais" está aqui
 * porque no celular ele é a porta para todo o resto.
 */
export const MOBILE_BAR: readonly NavItem[] = [
  { href: "/app", label: "Início", icon: "🏠" },
  { href: "/app/lancar", label: "Adicionar", icon: "➕" },
  { href: "/app/dia-a-dia", label: "Movimentos", icon: "🧾" },
  { href: "/app/cartoes", label: "Cartões", icon: "💳" },
  { href: "/app/mais", label: "Mais", icon: "⋯" },
];

export function mobileBarFor(context: NavContext = {}): readonly NavItem[] {
  const isDependent = context.role === "DEPENDENT";

  return MOBILE_BAR.map((item) => {
    if (item.href === "/app/dia-a-dia" && context.hasBankAccount === false) {
      return { href: "/app/contas-bancarias", label: "Conta", icon: "🏦" };
    }
    // Cartões é escondido de dependentes no menu completo (restrictedForDependent);
    // a barra fixa precisa de um substituto em vez de levar a uma tela que o
    // redireciona de volta.
    if (item.href === "/app/cartoes" && isDependent) {
      return { href: "/app/contas", label: "Contas", icon: "📄" };
    }
    return item;
  });
}

/**
 * Para onde um dependente é devolvido ao tentar abrir uma tela que não é dele.
 *
 * É um subconjunto do que `restrictedForDependent` esconde: esconder do menu e
 * redirecionar são coisas diferentes, e redirecionar toda tela escondida
 * mudaria o que dependentes conseguem ver hoje. O teste garante que nada
 * apareça aqui sem estar escondido no menu.
 */
export const DEPENDENT_BLOCKED_PATHS: readonly string[] = [
  "/app/dividas",
  "/app/superendividamento",
  "/app/projecao",
  "/app/cartoes",
  "/app/importar",
  "/app/irpf",
  "/app/imoveis",
  "/app/veiculos",
  "/app/cadastro-cartoes",
  "/app/cadastro-emprestimos",
];

/** As seções que este papel pode ver, sem seção vazia. */
export function navSectionsFor(role: HouseholdRole | null, context: NavContext = {}): NavSection[] {
  const isDependent = role === "DEPENDENT";

  return APP_NAV_SECTIONS.filter(
    (section) => context.hasBankAccount !== false || section.title !== "Movimentos",
  )
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !(isDependent && item.restrictedForDependent)),
    }))
    .filter((section) => section.items.length > 0);
}

/** Todo destino do menu, em ordem. Serve aos testes e a quem precisa da lista crua. */
export function allNavItems(): NavItem[] {
  return APP_NAV_SECTIONS.flatMap((section) => [...section.items]);
}

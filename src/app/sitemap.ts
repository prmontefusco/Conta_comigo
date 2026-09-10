import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://127.0.0.1:5002";

/**
 * Only public, genuinely useful pages are listed.
 *
 * The authenticated area is excluded because it must never be indexed, and no
 * page exists here that was created purely to occupy a keyword
 * (docs/PRODUCT.md section 29).
 */
const PAGES = [
  { path: "", priority: 1, changeFrequency: "monthly" as const },
  { path: "como-funciona", priority: 0.9, changeFrequency: "monthly" as const },
  { path: "organizar-financas", priority: 0.8, changeFrequency: "monthly" as const },
  { path: "planejamento-financeiro", priority: 0.8, changeFrequency: "monthly" as const },
  { path: "controle-de-contas", priority: 0.7, changeFrequency: "monthly" as const },
  { path: "controle-de-cartao", priority: 0.7, changeFrequency: "monthly" as const },
  { path: "orcamento-familiar", priority: 0.7, changeFrequency: "monthly" as const },
  { path: "educacao-financeira", priority: 0.7, changeFrequency: "monthly" as const },
  { path: "como-sair-das-dividas", priority: 0.8, changeFrequency: "monthly" as const },
  { path: "negociar-dividas", priority: 0.8, changeFrequency: "monthly" as const },
  { path: "reserva-de-emergencia", priority: 0.8, changeFrequency: "monthly" as const },
  { path: "score-de-credito", priority: 0.7, changeFrequency: "monthly" as const },
  { path: "portabilidade-de-credito", priority: 0.7, changeFrequency: "monthly" as const },
  { path: "regra-50-30-20", priority: 0.7, changeFrequency: "monthly" as const },
  { path: "rotativo-e-cheque-especial", priority: 0.7, changeFrequency: "monthly" as const },
  { path: "seguranca-financeira", priority: 0.7, changeFrequency: "monthly" as const },
  { path: "financas-para-casais", priority: 0.7, changeFrequency: "monthly" as const },
  { path: "financas-para-autonomos", priority: 0.7, changeFrequency: "monthly" as const },
  { path: "corte-inteligente-de-gastos", priority: 0.7, changeFrequency: "monthly" as const },
  { path: "lei-do-superendividamento", priority: 0.7, changeFrequency: "monthly" as const },
  { path: "como-provar-superendividamento", priority: 0.8, changeFrequency: "monthly" as const },
  { path: "minimo-existencial", priority: 0.8, changeFrequency: "monthly" as const },
  { path: "acao-de-repactuacao-de-dividas", priority: 0.8, changeFrequency: "monthly" as const },
  { path: "precisa-de-advogado-para-superendividamento", priority: 0.8, changeFrequency: "monthly" as const },
  { path: "renda-extra", priority: 0.8, changeFrequency: "monthly" as const },
  { path: "como-procurar-emprego", priority: 0.8, changeFrequency: "monthly" as const },
  { path: "mudanca-de-carreira", priority: 0.8, changeFrequency: "monthly" as const },
  { path: "como-fazer-curriculo", priority: 0.8, changeFrequency: "monthly" as const },
  { path: "preparacao-para-entrevistas", priority: 0.7, changeFrequency: "monthly" as const },
  { path: "planos", priority: 0.6, changeFrequency: "monthly" as const },
  { path: "privacidade", priority: 0.3, changeFrequency: "yearly" as const },
  { path: "termos", priority: 0.3, changeFrequency: "yearly" as const },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return PAGES.map((page) => ({
    url: page.path ? `${SITE_URL}/${page.path}` : SITE_URL,
    lastModified,
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));
}

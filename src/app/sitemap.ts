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
  { path: "educacao-financeira", priority: 0.6, changeFrequency: "monthly" as const },
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

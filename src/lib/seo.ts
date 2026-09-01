/**
 * Indexação é opt-in explícito.
 *
 * A regra anterior — "é produção e não é localhost, logo pode indexar" —
 * convidaria o Google a indexar o domínio provisório do App Hosting durante os
 * primeiros testes em produção.
 *
 * Isso pesa mais do que pareceria: o site público tem oito páginas escritas
 * para descoberta orgânica. Indexá-las num endereço temporário e migrar depois
 * significa competir com a própria cópia antiga e refazer o trabalho. Indexar é
 * rápido; desindexar é lento.
 *
 * Ligue `NEXT_PUBLIC_ALLOW_INDEXING=true` quando o domínio definitivo estiver
 * no ar e for o valor de `NEXT_PUBLIC_SITE_URL`.
 */
export function isIndexable(): boolean {
  if (process.env.NODE_ENV !== "production") return false;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  if (siteUrl === "" || siteUrl.includes("127.0.0.1") || siteUrl.includes("localhost"))
    return false;

  return process.env.NEXT_PUBLIC_ALLOW_INDEXING === "true";
}

import type { MetadataRoute } from "next";
import { getSiteUrl, isIndexable } from "@/lib/seo";

const SITE_URL = getSiteUrl();

/**
 * Crawling rules.
 *
 * A decisão de indexar mora em `lib/seo.ts`, porque o layout raiz precisa da
 * mesma resposta para a metatag `robots`. Duas fontes de verdade aqui dariam
 * um robots.txt que barra e uma metatag que convida.
 */
export default function robots(): MetadataRoute.Robots {
  if (!isIndexable()) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Everything behind authentication, plus the auth screens themselves.
        disallow: ["/app", "/app/", "/entrar", "/criar-conta"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}

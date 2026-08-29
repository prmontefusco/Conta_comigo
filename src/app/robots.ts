import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://127.0.0.1:5002";

/**
 * Crawling rules.
 *
 * Local and preview environments are excluded entirely: a development URL must
 * never end up in an index.
 */
export default function robots(): MetadataRoute.Robots {
  const isProduction = process.env.NODE_ENV === "production" && !SITE_URL.includes("127.0.0.1");

  if (!isProduction) {
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

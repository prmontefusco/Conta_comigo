import type { ReactElement } from "react";

export interface FaqItem {
  readonly question: string;
  readonly answer: string;
}

export function JsonLd({ data }: { readonly data: Record<string, unknown> }): ReactElement {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://contacomigo.api.br";

export function buildOrganizationSchema(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Conta Comigo",
    url: SITE_URL,
    logo: `${SITE_URL}/icon.png`,
    description:
      "Plataforma de gestão financeira familiar, planejamento, renegociação de dívidas e proteção pelo superendividamento.",
    sameAs: [
      "https://contacomigo.api.br",
    ],
  };
}

export function buildWebSiteSchema(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Conta Comigo",
    url: SITE_URL,
    inLanguage: "pt-BR",
    description:
      "Planejamento financeiro pessoal e familiar, cálculo do mínimo existencial e combate ao superendividamento.",
  };
}

export function buildSoftwareAppSchema(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Conta Comigo",
    applicationCategory: "FinanceApplication",
    operatingSystem: "Web, Android, iOS (PWA)",
    url: SITE_URL,
    offers: [
      {
        "@type": "Offer",
        price: "0",
        priceCurrency: "BRL",
        name: "Plano Gratuito",
      },
      {
        "@type": "Offer",
        price: "11.99",
        priceCurrency: "BRL",
        name: "Plano Premium Mensal",
      },
      {
        "@type": "Offer",
        price: "109.99",
        priceCurrency: "BRL",
        name: "Plano Premium Anual",
      },
    ],
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.9",
      ratingCount: "520",
      bestRating: "5",
      worstRating: "1",
    },
  };
}

export function buildFaqSchema(faqs: readonly FaqItem[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}

export function buildArticleSchema(params: {
  readonly title: string;
  readonly description: string;
  readonly urlPath: string;
  readonly datePublished?: string;
  readonly dateModified?: string;
}): Record<string, unknown> {
  const fullUrl = `${SITE_URL}${params.urlPath}`;
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: params.title,
    description: params.description,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": fullUrl,
    },
    url: fullUrl,
    inLanguage: "pt-BR",
    author: {
      "@type": "Organization",
      name: "Equipe Editorial Conta Comigo",
      url: SITE_URL,
    },
    publisher: {
      "@type": "Organization",
      name: "Conta Comigo",
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/icon.png`,
      },
    },
    datePublished: params.datePublished ?? "2026-01-15T08:00:00.000Z",
    dateModified: params.dateModified ?? new Date().toISOString(),
  };
}

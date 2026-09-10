import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { isIndexable } from "@/lib/seo";
import { JsonLd, buildOrganizationSchema, buildWebSiteSchema } from "@/lib/json-ld";
import "./globals.css";
import { ServiceWorkerRegistration } from "@/components/service-worker-registration";
import { PWAInstallPrompt } from "@/components/pwa-install-prompt";

/**
 * Inter, servido do próprio repositório.
 *
 * `next/font/google` baixava a fonte a cada build, porque o download não é
 * guardado em cache persistente: some junto com `.next`. Isso tornava o build
 * dependente de rede, o que contraria o requisito de desenvolvimento
 * inteiramente local (docs/LOCAL_DEVELOPMENT.md).
 *
 * Aqui vai só o subset latino, 48 KB, que cobre o português inteiro. É um
 * arquivo só e sem `unicode-range`, então o navegador sempre o baixa — por
 * isso vale manter pequeno. Texto em cirílico ou grego cai na pilha de fontes
 * do sistema, o que é aceitável num produto pt-BR.
 *
 * A fonte continua sendo servida pelo nosso domínio: nenhuma requisição sai
 * para o Google, nem em produção.
 */
const inter = localFont({
  src: "./fonts/inter-latin-variable.woff2",
  weight: "100 900",
  variable: "--font-inter",
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://127.0.0.1:5002";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Conta comigo — planejamento financeiro pessoal e familiar",
    template: "%s | Conta comigo",
  },
  description:
    "Entenda quanto você tem hoje, quanto já está comprometido e como suas finanças " +
    "estarão nos próximos meses. Sem julgamento, com números claros.",
  applicationName: "Conta comigo",
  authors: [{ name: "Conta comigo" }],
  keywords: [
    "planejamento financeiro",
    "organização financeira",
    "controle de contas",
    "orçamento familiar",
    "controle de cartão de crédito",
    "projeção financeira",
    "superendividamento",
    "lei do superendividamento",
    "lei 14181",
    "mínimo existencial",
    "como sair das dívidas",
    "renegociação de dívidas",
    "gestão financeira familiar",
    "controle de gastos",
    "repactuação de dívidas",
  ],
  alternates: {
    canonical: siteUrl,
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "Conta comigo",
    title: "Conta comigo — planejamento financeiro pessoal e familiar",
    description: "Quanto tenho, quanto já comprometi e para onde minhas finanças estão indo.",
    url: siteUrl,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Conta comigo",
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico?v=2", sizes: "any" },
      { url: "/icon-192.png?v=2", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png?v=2", sizes: "512x512", type: "image/png" },
      { url: "/icon.png?v=2", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png?v=2", sizes: "180x180", type: "image/png" }],
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
  robots: {
    index: isIndexable(),
    follow: isIndexable(),
    googleBot: {
      index: isIndexable(),
      follow: isIndexable(),
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google:
      process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION ??
      "8wthYwMneAEpCHlAPegGy5TZixSp8EvZ2iaQVTddnWk",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f8fafc",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className="min-h-dvh antialiased">
        <JsonLd data={buildOrganizationSchema()} />
        <JsonLd data={buildWebSiteSchema()} />
        <a href="#conteudo" className="skip-link">
          Ir para o conteúdo
        </a>
        {children}
        <PWAInstallPrompt />
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}

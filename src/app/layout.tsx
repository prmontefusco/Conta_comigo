import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
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
  ],
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "Conta comigo",
    title: "Conta comigo — planejamento financeiro pessoal e familiar",
    description: "Quanto tenho, quanto já comprometi e para onde minhas finanças estão indo.",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f8f9" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1d21" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className="min-h-dvh antialiased">
        <a href="#conteudo" className="skip-link">
          Ir para o conteúdo
        </a>
        {children}
      </body>
    </html>
  );
}

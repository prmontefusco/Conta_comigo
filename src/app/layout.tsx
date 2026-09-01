import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { isIndexable } from "@/lib/seo";
import "./globals.css";

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
  ],
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "Conta comigo",
    title: "Conta comigo — planejamento financeiro pessoal e familiar",
    description: "Quanto tenho, quanto já comprometi e para onde minhas finanças estão indo.",
  },
  // Alinhada ao robots.txt de propósito: barrar num lugar e convidar no outro
  // é o tipo de contradição que só aparece depois de indexado.
  robots: { index: isIndexable(), follow: isIndexable() },
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

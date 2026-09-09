import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Conta comigo · Planejamento e Recuperação Financeira",
    short_name: "Conta comigo",
    description:
      "Plataforma de planejamento financeiro familiar, controle de contas, quitação de dívidas e metas.",
    start_url: "/app?source=pwa",
    scope: "/",
    id: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui", "window-controls-overlay"],
    orientation: "portrait-primary",
    background_color: "#0f172a",
    theme_color: "#0284c7",
    lang: "pt-BR",
    dir: "ltr",
    categories: ["finance", "productivity"],
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/apple-icon.png",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/favicon.ico",
        sizes: "48x48 32x32 16x16",
        type: "image/x-icon",
      },
    ],
    shortcuts: [
      {
        name: "Lançamentos",
        short_name: "Lançamentos",
        description: "Acesse e registre seus lançamentos diários",
        url: "/app/dia-a-dia",
        icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Contas a Pagar",
        short_name: "Contas",
        description: "Consulte vencimentos e pague contas",
        url: "/app/contas",
        icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Diagnóstico IA",
        short_name: "Diagnóstico IA",
        description: "Análise inteligente das finanças familiares",
        url: "/app/diagnostico-ia",
        icons: [{ src: "/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}

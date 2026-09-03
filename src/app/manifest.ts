import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Conta comigo · Planejamento e Recuperação Financeira",
    short_name: "Conta comigo",
    description:
      "Plataforma de planejamento financeiro familiar, controle de contas, quitação de dívidas e metas.",
    start_url: "/app",
    display: "standalone",
    background_color: "#0f172a",
    theme_color: "#0284c7",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}

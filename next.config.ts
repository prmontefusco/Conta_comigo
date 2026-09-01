import type { NextConfig } from "next";

/**
 * Content Security Policy — em modo de observação.
 *
 * Uma CSP errada não degrada: ela quebra o login ou a monetização em produção,
 * e quebra em silêncio para quem já estava com a página aberta. Por isso esta
 * política sai como `Report-Only`: o navegador **relata** o que ela bloquearia e
 * não bloqueia nada. É a única forma honesta de escrever a primeira versão de
 * uma CSP para uma página que carrega Firebase, reCAPTCHA e AdSense — domínios
 * de terceiros que mudam sem avisar.
 *
 * `tests/e2e/csp.spec.ts` navega pelas telas e falha se alguma violação for
 * relatada. Enquanto esse teste passar, a política está pronta para virar
 * obrigatória: trocar o nome do cabeçalho para `Content-Security-Policy`.
 *
 * O que ainda não dá para apertar:
 *
 * - `'unsafe-inline'` em `script-src`. O App Router injeta scripts inline de
 *   hidratação. Tirar isso exige nonce por requisição, o que obriga toda página
 *   a ser dinâmica — hoje 30 delas são estáticas, e é isso que faz o site
 *   público carregar 188 kB. A troca não vale antes de haver medida real.
 * - `'unsafe-inline'` em `style-src`. Há `style={{...}}` espalhado pelas telas.
 */
const CSP_REPORT_ONLY = [
  "default-src 'self'",
  // Firebase Auth (apis.google.com), reCAPTCHA do App Check (google/gstatic) e
  // AdSense. O inline é da hidratação do Next.
  "script-src 'self' 'unsafe-inline' https://apis.google.com https://www.google.com https://www.gstatic.com https://pagead2.googlesyndication.com https://partner.googleadservices.com https://tpc.googlesyndication.com",
  "style-src 'self' 'unsafe-inline'",
  // A fonte é servida por nós de propósito (ver src/app/layout.tsx).
  "font-src 'self'",
  // `data:` para SVG embutido; os domínios de anúncio servem pixels e criativos.
  "img-src 'self' data: blob: https://www.google.com https://www.gstatic.com https://pagead2.googlesyndication.com https://tpc.googlesyndication.com https://googleads.g.doubleclick.net",
  // Firestore fala por WebChannel; Auth por identitytoolkit e securetoken.
  "connect-src 'self' https://*.googleapis.com https://firestore.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://pagead2.googlesyndication.com https://googleads.g.doubleclick.net",
  // Iframes: criativos de anúncio, o desafio do reCAPTCHA e o handler do Auth.
  "frame-src 'self' https://www.google.com https://googleads.g.doubleclick.net https://tpc.googlesyndication.com https://*.firebaseapp.com",
  // Nada disto é usado, e negar é mais barato que auditar depois.
  "object-src 'none'",
  "base-uri 'self'",
  // O formulário desta aplicação nunca posta para fora.
  "form-action 'self'",
].join("; ");

/**
 * Cabeçalhos de segurança, aplicados a todas as rotas.
 *
 * Estes já valem — são os que não dependem de conhecer domínios de terceiros.
 */
const securityHeaders = [
  // Um ano, com subdomínios. O App Hosting já serve só por HTTPS; isto impede o
  // primeiro pedido em texto claro nas visitas seguintes.
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  // Impede que um arquivo servido como texto seja interpretado como script.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // O caminho da página pode conter id de household; ele não vai para terceiros.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Clickjacking: nenhuma página nossa é enquadrável. Fica no cabeçalho que
  // vale, e não no `Report-Only` — `frame-ancestors` é ignorado em modo de
  // observação, e esta é a defesa de uma tela que movimenta dinheiro.
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  // O produto não usa nenhuma destas. Negar por padrão vale mais que confiar
  // que nenhuma dependência vá pedir.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  { key: "Content-Security-Policy-Report-Only", value: CSP_REPORT_ONLY },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,

  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;

/*
 * Service worker do Conta comigo.
 *
 * Existe por dois motivos, ambos ligados a quem o produto atende. Primeiro, é
 * o que falta para o aplicativo ser instalável: havia manifest, mas o Chrome
 * só oferece "adicionar à tela inicial" quando há um service worker com
 * handler de fetch. Segundo, o público principal usa celular barato e rede
 * instável, e abrir o aplicativo para ver um dinossauro é o tipo de atrito que
 * faz alguém desistir de acompanhar as contas.
 *
 * ## O que ele deliberadamente NÃO faz
 *
 * Não guarda nada de financeiro. Nenhuma resposta de API, nenhum documento do
 * Firestore, nenhuma página autenticada. Um cache de saldos no disco de um
 * aparelho compartilhado é exatamente o risco que este produto não deve criar,
 * e um saldo velho servido como se fosse atual é pior que nenhum saldo.
 *
 * O que fica em cache é apenas a casca estática: ícones, a página offline e os
 * assets versionados do Next, cujos nomes já carregam hash.
 */

const VERSION = "v1";
const SHELL_CACHE = `conta-comigo-shell-${VERSION}`;
const ASSET_CACHE = `conta-comigo-assets-${VERSION}`;

const OFFLINE_URL = "/offline";
const SHELL = [OFFLINE_URL, "/icon-192.png", "/icon-512.png", "/favicon.ico"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      // `reload` para não pegar do cache HTTP uma versão anterior da casca.
      .then((cache) => cache.addAll(SHELL.map((url) => new Request(url, { cache: "reload" }))))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== SHELL_CACHE && key !== ASSET_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Só o próprio domínio. Firebase, Google e qualquer terceiro passam direto.
  if (url.origin !== self.location.origin) return;

  // Nada de API, nada de autenticação. Estas rotas nunca veem o cache.
  if (url.pathname.startsWith("/api/")) return;

  // Assets versionados do Next: o nome tem hash, então cache-first é seguro e
  // é o que faz o aplicativo abrir rápido numa rede ruim.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request, ASSET_CACHE));
    return;
  }

  if (SHELL.includes(url.pathname)) {
    event.respondWith(cacheFirst(request, SHELL_CACHE));
    return;
  }

  // Navegação: sempre tenta a rede primeiro, porque o conteúdo é financeiro e
  // precisa estar atual. Só quando não há rede é que aparece a página offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await caches.match(OFFLINE_URL);
        return (
          cached ??
          new Response("Sem conexão.", {
            status: 503,
            headers: { "content-type": "text/plain; charset=utf-8" },
          })
        );
      }),
    );
  }
});

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(cacheName);
    cache.put(request, response.clone());
  }
  return response;
}

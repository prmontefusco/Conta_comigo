/**
 * `ads.txt`, served only in production.
 *
 * Google requires this file to authorise sellers of the site's inventory.
 * It is generated from the configured publisher id rather than committed as a
 * static file, so a development build can never publish a real publisher id
 * (docs/ADSENSE.md).
 */
export const dynamic = "force-static";

export function GET(): Response {
  const publisherId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;
  const adsEnabled = process.env.NEXT_PUBLIC_ADS_ENABLED === "true";

  if (!adsEnabled || !publisherId) {
    return new Response("# Sem publicidade configurada neste ambiente.\n", {
      status: 200,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  // The publisher id arrives as "ca-pub-XXXXXXXXXXXXXXXX"; ads.txt wants the
  // bare "pub-" form.
  const bareId = publisherId.replace(/^ca-/, "");

  return new Response(`google.com, ${bareId}, DIRECT, f08c47fec0942fa0\n`, {
    status: 200,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

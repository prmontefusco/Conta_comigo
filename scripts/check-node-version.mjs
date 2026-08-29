// Non-fatal guard: App Hosting runs even-numbered Node LTS releases only.
// We warn instead of failing so `npm install` never blocks a contributor.
const [major] = process.versions.node.split(".").map(Number);

if (major === undefined || major < 22) {
  console.warn(
    `\n[conta-comigo] Node ${process.versions.node} detected. This project targets Node 22+ ` +
      `(Firebase App Hosting supports nodejs20/22/24). Some tooling may misbehave.\n`,
  );
}

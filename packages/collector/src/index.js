#!/usr/bin/env node
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createCollectorServer } from "./server.js";

export { createCollectorServer } from "./server.js";
export { JsonlEventStore, MemoryEventStore, SQLiteEventStore } from "./store.js";
export { projectClaim, projectClaims } from "./projection.js";
export { validateEventAgainstHistory, validateEventShape, validateReplay } from "./validation.js";

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const port = Number.parseInt(process.env.PORT || "8787", 10);
  const host = process.env.HOST || "127.0.0.1";
  const memory = process.env.OPENCLAIMS_MEMORY === "1";
  const jsonl = process.env.OPENCLAIMS_JSONL === "1";
  const server = createCollectorServer({ memory, jsonl });

  server.listen({ port, host }).then(() => {
    process.stdout.write(`openclaims-collector v0.1 listening on http://${host}:${port}\n`);
  }).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

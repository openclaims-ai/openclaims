#!/usr/bin/env node
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createCollectorServer } from "../packages/collector/src/index.js";
import { MemoryEventStore } from "../packages/collector/src/store.js";
import { projectClaim } from "../packages/collector/src/projection.js";
import { validateEventShape, validateReplay } from "../packages/collector/src/validation.js";

const root = resolve(new URL("..", import.meta.url).pathname);

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function listJsonFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => join(directory, entry.name))
    .sort();
}

const validFiles = await listJsonFiles(join(root, "fixtures", "valid"));
const invalidFiles = await listJsonFiles(join(root, "fixtures", "invalid"));

for (const file of validFiles) {
  validateEventShape(await readJson(file));
}

for (const file of invalidFiles) {
  try {
    validateEventShape(await readJson(file));
  } catch {
    continue;
  }
  throw new Error(`expected invalid fixture to fail: ${file}`);
}

const lifecycle = [
  await readJson(join(root, "fixtures", "valid", "claim-emitted.json")),
  await readJson(join(root, "fixtures", "valid", "claim-verified.json")),
  await readJson(join(root, "fixtures", "valid", "claim-disputed.json")),
  await readJson(join(root, "fixtures", "valid", "claim-retracted.json"))
];
const accepted = validateReplay(lifecycle, []);
const store = new MemoryEventStore();
await store.append(accepted);
const projection = projectClaim(lifecycle[0].claim.claim_id, await store.readAll());

assert.equal(projection.events.length, 4);
assert.equal(projection.status, "retracted");

const caseFiles = await listJsonFiles(join(root, "conformance", "cases"));
for (const file of caseFiles) {
  const testCase = await readJson(file);
  try {
    const acceptedCase = validateReplay(testCase.events, []);
    if (testCase.expect.error_type) {
      throw new Error(`expected ${testCase.name} to fail with ${testCase.expect.error_type}`);
    }
    assert.equal(acceptedCase.length, testCase.expect.accepted, `${testCase.name} accepted count`);
    const caseProjection = projectClaim(acceptedCase[0].claim?.claim_id ?? acceptedCase[0].claim_ref, acceptedCase);
    assert.equal(caseProjection.status, testCase.expect.claim_status, `${testCase.name} claim status`);
  } catch (error) {
    if (!testCase.expect.error_type) throw error;
    assert.equal(error.name, testCase.expect.error_type, `${testCase.name} error type`);
  }
}

const app = createCollectorServer({ storePath: join(mkdtempSync(join(tmpdir(), "openclaims-sqlite-")), "events.sqlite") });
try {
  let response = await app.inject({ method: "GET", url: "/health" });
  assert.equal(response.statusCode, 200);
  response = await app.inject({ method: "POST", url: "/v0/events", payload: { events: lifecycle.slice(0, 2) } });
  assert.equal(response.statusCode, 202);
  response = await app.inject({ method: "GET", url: `/v0/claims/${encodeURIComponent(lifecycle[0].claim.claim_id)}/events` });
  assert.equal(JSON.parse(response.body).count, 2);
  response = await app.inject({ method: "POST", url: "/v0/cloudevents", payload: JSON.parse(await readFile(join(root, "fixtures", "cloudevents", "claim-emitted.json"), "utf8")) });
  assert.equal(response.statusCode, 409);
} finally {
  await app.close();
}

process.stdout.write(
  `collector verification passed: ${validFiles.length} valid fixtures, ${invalidFiles.length} invalid fixtures, ${caseFiles.length} conformance cases\n`
);

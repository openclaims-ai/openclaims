#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { eventDigest, verifyEventDigest } from "../../typescript-sdk/src/canonicalize.js";
import { validateEvent } from "../../typescript-sdk/src/validate.js";
import { eventToJsonLd } from "../../jsonld-exporter/src/index.js";

const [, , command, ...args] = process.argv;

try {
  if (command === "validate") validateCommand(args[0]);
  else if (command === "inspect") inspectCommand(args[0]);
  else if (command === "digest") digestCommand(args[0]);
  else if (command === "verify-digest") verifyDigestCommand(args[0]);
  else if (command === "export-jsonld") exportJsonLdCommand(args[0]);
  else if (command === "fixtures") fixturesCommand(args[0] ?? "fixtures");
  else usage(1);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

function validateCommand(file) {
  const event = readJson(file);
  const result = validateEvent(event);
  if (!result.valid) {
    printErrors(result.errors);
    process.exit(1);
  }
  console.log(`${file}: valid`);
}

function inspectCommand(file) {
  const event = readJson(file);
  const result = validateEvent(event, { verifyDigest: false });
  const claimId = event.claim?.claim_id ?? event.claim_ref;
  console.log(JSON.stringify({
    file,
    valid_shape: result.valid,
    event_id: event.event_id,
    event_type: event.event_type,
    claim_id: claimId,
    sources: event.sources?.length ?? 0,
    evidence: event.evidence?.length ?? 0,
    contradicting_evidence: event.contradicting_evidence?.length ?? 0,
    verification_status: event.verification?.claim_status,
    trace_ids: collectTraceIds(event)
  }, null, 2));
}

function digestCommand(file) {
  console.log(JSON.stringify(eventDigest(readJson(file)), null, 2));
}

function verifyDigestCommand(file) {
  if (!verifyEventDigest(readJson(file))) {
    console.error(`${file}: digest mismatch`);
    process.exit(1);
  }
  console.log(`${file}: digest verified`);
}

function exportJsonLdCommand(file) {
  console.log(JSON.stringify(eventToJsonLd(readJson(file)), null, 2));
}

function fixturesCommand(root) {
  const validDir = join(root, "valid");
  const invalidDir = join(root, "invalid");
  let failed = 0;
  for (const file of listJson(validDir)) {
    const result = validateEvent(readJson(file));
    if (!result.valid) {
      failed += 1;
      console.error(`${file}: expected valid`);
      printErrors(result.errors);
    }
  }
  for (const file of listJson(invalidDir)) {
    const result = validateEvent(readJson(file));
    if (result.valid) {
      failed += 1;
      console.error(`${file}: expected invalid`);
    }
  }
  if (failed > 0) process.exit(1);
  console.log("fixtures: passed");
}

function readJson(file) {
  if (!file) usage(1);
  return JSON.parse(readFileSync(file, "utf8"));
}

function listJson(path) {
  try {
    return readdirSync(path)
      .map((name) => join(path, name))
      .filter((file) => statSync(file).isFile() && file.endsWith(".json"));
  } catch {
    return [];
  }
}

function collectTraceIds(event) {
  const ids = new Set();
  if (event.trace?.trace_id) ids.add(event.trace.trace_id);
  for (const toolRun of event.tool_runs ?? []) {
    if (toolRun.trace_ref) ids.add(toolRun.trace_ref);
  }
  return [...ids];
}

function printErrors(errors) {
  for (const item of errors) console.error(`${item.path}: ${item.message}`);
}

function usage(exitCode) {
  console.error(`Usage:
  openclaims validate <file>
  openclaims inspect <file>
  openclaims digest <file>
  openclaims verify-digest <file>
  openclaims export-jsonld <file>
  openclaims fixtures [fixtures-root]`);
  process.exit(exitCode);
}

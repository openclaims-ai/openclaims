# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OpenClaims is a v0.1 reference implementation for **claim provenance and evidence lineage** in AI systems. It captures:
- What claim was made
- Which evidence and sources support it
- Which tools produced or verified it
- How the event history can be validated and audited

**Not a truth engine** - records provenance, support relationships, verification outcomes, and lifecycle events.

## Architecture

### Monorepo Structure

This is a pnpm workspace with TypeScript/JavaScript packages and a Python SDK:

- **`schemas/openclaims/0.1/`** - Normative JSON Schemas (2020-12) and JSON-LD context. Source of truth for validation.
- **`packages/typescript-sdk/`** - Schema-aware builders, canonicalization, digest computation, ID generation, validation, CloudEvents helpers, TypeScript types.
- **`packages/validator-cli/`** - CLI for validation, inspection, digest verification, fixture checks, JSON-LD export.
- **`packages/jsonld-exporter/`** - JSON-LD semantic profile mapping for graph-based interchange.
- **`packages/collector/`** - Reference Fastify-based ingestion gateway with SQLite/in-memory stores, replay validation, claim projection.
- **`python/`** - Python SDK with matching canonicalization, builders, and models.
- **`fixtures/`** - Normative examples: valid, invalid, CloudEvents, JSON-LD, signed events. These define conformance expectations.
- **`spec/`** - Human-readable specification (core-model, verification, transport, graph, signing, facets).
- **`site/`** - Static landing page (GitHub Pages deployment).

### Event Lifecycle Model

Four lifecycle events form a claim's history:
1. **claim.emitted** - Initial claim with evidence, sources, tool runs
2. **claim.verified** - Verification assessment (method, confidence, status)
3. **claim.disputed** - Contradicting evidence or challenges
4. **claim.retracted** - Claim withdrawn or superseded

Events are **additive only** - no overwrites. Each event references previous events via `claim_ref` or embeds full claim.

### Core Concepts

- **Claim** - Factual assertion with provenance (claim_id, text, claim_type, context, relations)
- **Evidence** - Specific support/contradiction with selectors (page_span, text_fragment, etc.)
- **Source** - Origin document with URI, version, digest, observation timestamp
- **ToolRun** - Retriever/model execution metadata (tool, parameters, trace_ref)
- **Verification** - Assessment result (method, confidence, status: verified/challenged/disputed)
- **Digest** - Canonical SHA-256 fingerprint for tamper detection (all IDs and payloads)

### Canonical Representation

Events use **canonical JSON** for digest stability:
- Deterministic ID generation with semantic prefixes (`clm_`, `src_`, `ev_`, `evt_`)
- Base64url-encoded SHA-256 digests
- snake_case field names (public API convention)

Both TypeScript and Python SDKs implement matching canonicalization.

## Common Commands

### Setup

```sh
# Install all workspace dependencies
pnpm install

# Python SDK setup
python3 -m venv .venv
.venv/bin/python -m pip install './python[test]'
```

### Build & Test

```sh
# Run type checks (JavaScript syntax verification)
pnpm build

# Run all tests (TypeScript SDK, collector, fixtures)
pnpm test

# Validate all fixtures
pnpm fixtures
# or directly:
node packages/validator-cli/src/index.js fixtures

# Verify collector replay logic
node scripts/verify-collector.mjs

# Python tests
.venv/bin/python -m pytest python/tests
```

### Validator CLI Usage

```sh
# Validate single event
node packages/validator-cli/src/index.js validate <file.json>

# Inspect event details
node packages/validator-cli/src/index.js inspect <file.json>

# Compute/verify digest
node packages/validator-cli/src/index.js digest <file.json>

# Export to JSON-LD
node packages/validator-cli/src/index.js export-jsonld <file.json>
```

### Collector Server

```sh
# Run collector (default: SQLite storage)
node packages/collector/src/index.js

# In-memory mode
OPENCLAIMS_STORE=memory node packages/collector/src/index.js
```

REST API endpoints:
- `GET /health` - Health check
- `POST /v0/events` - Ingest OpenClaims event
- `POST /v0/events/cloudevents` - Ingest CloudEvents-wrapped event
- `GET /v0/events/:event_id` - Retrieve event by ID
- `GET /v0/claims/:claim_id/events` - Get full claim history

## Development Workflow

### Schema Changes

When modifying schemas, update:
1. `schemas/openclaims/0.1/*.schema.json`
2. `packages/typescript-sdk/src/index.d.ts` (TypeScript types)
3. `packages/typescript-sdk/src/validate.js` (if semantic validation changes)
4. `python/openclaims/models.py` (Python models)
5. Valid and invalid fixtures
6. Spec docs if behavior changes

**Do not change v0.1 field semantics casually** - document compatibility impact.

### Fixture Regeneration

After changing builders or canonicalization:

```sh
node scripts/generate-fixtures.mjs
node packages/validator-cli/src/index.js fixtures
node scripts/verify-collector.mjs
```

Valid fixtures must pass schema validation and digest verification. Invalid fixtures must fail for a clear reason.

### Adding New Event Fields

1. Add field to relevant schema
2. Update TypeScript declarations
3. Update Python models
4. Add at least one valid fixture
5. Add invalid fixture if validation rules exist
6. Update docs if user-facing

### Adding New Event Types

Requires:
- Specialized schema + `ClaimEvent` union update
- SDK builder support (TypeScript + Python)
- CLI validation coverage
- Collector replay semantics
- Conformance fixtures

## Coding Conventions

- **Event fields**: snake_case (public API)
- **Event history**: Additive only, no overwrite semantics
- **Sensitive data**: Store by digest or redacted summary
- **Validation**: Schema-backed + small semantic checks (avoid ad hoc validation)
- **Generated files**: Keep out of repo

## Documentation

- **User Guide** (`docs/user-guide.md`) - CLI, SDK, collector usage
- **Contributor Guide** (`docs/contributor-guide.md`) - Development workflow, coding conventions
- **Maintainer Guide** (`docs/maintainer-guide.md`) - Release process, compatibility rules
- **Assessment** (`docs/assessment-and-roadmap.md`) - Problem context, regulatory drivers, roadmap
- **Spec** (`spec/README.md`) - Human-readable v0.1 specification

## Landing Page

Static site in `site/` deployed via GitHub Pages:
- Brutalist technical aesthetic (black/white/lime)
- IBM Plex Mono + Space Grotesk fonts
- High contrast (WCAG AAA compliant)
- Deployed via `.github/workflows/deploy-pages.yml`
- Live at: https://openclaims-ai.github.io/openclaims/

## Repository

- **GitHub**: https://github.com/openclaims-ai/openclaims
- **Node version**: >=20
- **Package manager**: pnpm (workspace)

<claude-mem-context>
# Recent Activity

<!-- This section is auto-generated by claude-mem. Edit content outside the tags. -->

### May 17, 2026

| ID | Time | T | Title | Read |
|----|------|---|-------|------|
| #15326 | 12:12 PM | 🔵 | OpenClaims v0.1 Reference Implementation Overview | ~459 |
</claude-mem-context>

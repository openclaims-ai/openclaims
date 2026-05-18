# OpenClaims / ClaimLineage

OpenClaims is a v0.1 reference implementation for claim provenance and evidence lineage. It records what claim was made, which evidence and sources bear on it, which tools produced or verified it, and how the resulting event history can be validated and audited.

It is not a truth engine. The implementation captures provenance, support relationships, verification outcomes, and additive lifecycle events.

## Current Packages

- `packages/typescript-sdk`: schema-aware builders, canonicalization, digests, IDs, validation, and CloudEvents helpers.
- `packages/validator-cli`: command-line validation, inspection, digest checks, fixture checks, and JSON-LD export.
- `packages/jsonld-exporter`: JSON-LD semantic profile mapping.
- `packages/collector`: reference ingestion gateway.
- `python`: Python SDK with matching canonicalization and builders.

## Quick Start

Install workspace dependencies:

```sh
pnpm install
```

Validate the bundled fixtures and inspect a sample event:

```sh
node packages/validator-cli/src/index.js fixtures
node packages/validator-cli/src/index.js inspect fixtures/valid/claim-emitted.json
node packages/validator-cli/src/index.js export-jsonld fixtures/valid/claim-emitted.json
```

Run the main checks:

```sh
pnpm build
pnpm test
node scripts/verify-collector.mjs
```

## Documentation

- [Landing Page](site/index.html): static project landing page.
- [User Guide](docs/user-guide.md): CLI, SDK, collector, fixtures, and common workflows.
- [Contributor Guide](docs/contributor-guide.md): repo layout, development workflow, coding conventions, and how to add schemas or fixtures.
- [Maintainer Guide](docs/maintainer-guide.md): release process, compatibility rules, conformance expectations, and governance notes.
- [Assessment And Roadmap](docs/assessment-and-roadmap.md): project fit against the research report, problem significance, adjacent standards, and next milestones.
- [Spec](spec/README.md): human-readable v0.1 specification.
- [Conformance](conformance/README.md): fixture-driven compatibility expectations.

# OpenClaims Landing Page

Static landing page for OpenClaims / ClaimLineage.

The page includes a zero-backend Verified Analysis demo. The demo uses
representative travel-policy fixture data generated at `site/assets/verified-analysis-demo.json` to show the
OpenClaims flow from AI answer to claim, evidence, source, tool run, digest, and
lifecycle event. It does not call a model, collector, or external API.

Regenerate the demo fixture from the repo root:

```sh
pnpm demo:verified-analysis
```

Open locally:

```sh
open site/index.html
```

No build step is required.

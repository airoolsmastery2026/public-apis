# DHP API Hub

This directory turns the upstream `public-apis/public-apis` list into a **discovery source** for Dai Hai Phat / UMS. It does not treat every listed API as trusted, production-ready, free forever, or safe to invoke automatically.

## Architecture

```text
upstream README catalog
        |
        v
import-public-apis.mjs (safe-category discovery only)
        |
        v
candidate list (local/generated, not authoritative)
        |
        v
manual + official-doc verification
        |
        v
registry.json (small curated seed)
        |
        v
UMS tool/API routing + DHP policy gates
        |
        v
project-owned adapter / provider call
```

## Hard rules

1. **Catalog != capability proof.** A README row is only a lead. Verify official docs, authentication, terms, quota, data quality, endpoint behavior, and current availability before production use.
2. **$0-first, fail closed.** `free_public` and durable official free tiers rank above metered providers. Never auto-upgrade, auto-top-up, or silently continue into paid usage.
3. **No secrets in git.** Keys/tokens stay in the host secret store or environment. Registry entries may name an environment variable, never contain a credential value.
4. **Minimum necessary routing.** Do not expose thousands of APIs to an agent. Resolve the requested capability first, then shortlist only matching verified entries.
5. **Read before write.** Discovery does not authorize side effects. Any write-capable provider remains behind project permission, validation, idempotency, and audit boundaries.
6. **Provider data is external evidence.** It does not replace DHP repository source of truth, business databases, pricing, CRM, knowledge governance, or domain rules.
7. **Respect provider etiquette.** Cache where appropriate, identify the application when requested, respect rate limits/retry headers, and stop rather than hammering a degraded endpoint.
8. **Safe default discovery.** The importer allowlists broadly useful technical/business/public-data categories and intentionally ignores unrelated high-risk or low-value categories.

## Files

- `registry.json` — curated, small, policy-rich seed of verified API families.
- `registry.schema.json` — portable contract for each registry entry.
- `validate.mjs` — dependency-free structural/policy validator.
- `health-check.mjs` — sequential, read-only health checks for no-auth entries only.
- `import-public-apis.mjs` — converts the giant README into a local candidate list; it never auto-promotes candidates into `registry.json`.

## Tier model

- **A** — public/no-key API from a durable or authoritative source; still subject to terms/rate limits.
- **B** — official free tier requiring an account/key/token; free quota can change and must be re-verified before enabling.
- **C** — experimental/community candidate; disabled by default until separately reviewed.

`registry.json` intentionally contains only A/B entries. B-tier AI providers are marked `denyMeteredOverflow: true` so a host must stop or fall back to another approved free/local route when the free allowance is exhausted.

## Run locally

Requires Node.js 20+ and no npm packages.

```bash
node dhp/validate.mjs
node dhp/health-check.mjs --soft
node dhp/import-public-apis.mjs --output .cache/dhp-public-api-candidates.json
```

The generated candidate file is disposable local state and should not be committed.

## Promotion checklist

Before adding or changing a provider in `registry.json`:

- verify the official documentation URL;
- verify current auth and free-tier semantics;
- verify HTTPS and a non-destructive example/health endpoint;
- document quota/etiquette constraints without assuming they are permanent;
- set `denyMeteredOverflow: true` for every free-tier provider that can become billable;
- define required secret environment variable names only, never values;
- define capabilities narrowly enough for deterministic routing;
- keep `productionReady: false` until the consuming project has its own integration/e2e evidence.

## DHP/UMS placement

This fork remains an external catalog source. Canonical routing/authority lives in `universal-master-skills`; DHP Website/domain code remains the system of record and the owner of any production integration. Do not copy this entire repository into `dai-hai-phat-web`.

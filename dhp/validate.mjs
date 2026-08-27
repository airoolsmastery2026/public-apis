#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const registryPath = path.join(HERE, 'registry.json');
const data = JSON.parse(fs.readFileSync(registryPath, 'utf8'));

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

function isHttps(value) {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

if (data.schema !== 'dhp-verified-api-registry-v1') fail('unsupported registry schema');
if (!/^\d+\.\d+\.\d+$/.test(data.version ?? '')) fail('version must be semver-like x.y.z');
if (!/^\d{4}-\d{2}-\d{2}$/.test(data.reviewedAt ?? '')) fail('reviewedAt must be YYYY-MM-DD');
if (!Array.isArray(data.providers) || data.providers.length === 0) fail('providers must be a non-empty array');

const ids = new Set();
const allowedTier = new Set(['A', 'B', 'C']);
const allowedAuth = new Set(['none', 'optional', 'api-key', 'bearer', 'account-binding']);
const allowedCost = new Set(['free_public', 'official_free_tier', 'unknown']);
const allowedHealthMethod = new Set(['GET', 'HEAD', 'MANUAL']);
const credentialLike = /(sk-[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{20,}|Bearer\s+[A-Za-z0-9._-]{16,})/;

for (const provider of data.providers) {
  const id = provider.id;
  if (!/^[a-z0-9][a-z0-9-]{2,63}$/.test(id ?? '')) fail(`invalid provider id: ${id}`);
  if (ids.has(id)) fail(`duplicate provider id: ${id}`);
  ids.add(id);

  if (!provider.name || !provider.category) fail(`${id}: name/category required`);
  if (!Array.isArray(provider.capabilities) || provider.capabilities.length === 0) fail(`${id}: capabilities required`);
  if (provider.capabilities.length !== new Set(provider.capabilities).size) fail(`${id}: duplicate capabilities`);
  if (!provider.capabilities.every((x) => /^[a-z0-9][a-z0-9._-]+$/.test(x))) fail(`${id}: invalid capability format`);
  if (!allowedTier.has(provider.tier)) fail(`${id}: unsupported tier ${provider.tier}`);
  if (provider.authority !== 'external-data-or-execution-only') fail(`${id}: invalid authority`);
  if (!isHttps(provider.docs)) fail(`${id}: docs must be HTTPS`);
  if (!isHttps(provider.baseUrl)) fail(`${id}: baseUrl must be HTTPS`);

  const auth = provider.auth ?? {};
  if (!allowedAuth.has(auth.mode)) fail(`${id}: unsupported auth mode ${auth.mode}`);
  if (auth.secretEnv && !/^[A-Z][A-Z0-9_]+$/.test(auth.secretEnv)) fail(`${id}: invalid secretEnv name`);
  if (auth.mode === 'none' && auth.secretEnv) fail(`${id}: no-auth provider must not define secretEnv`);
  if (['api-key', 'bearer', 'account-binding'].includes(auth.mode) && !auth.secretEnv) fail(`${id}: credentialed provider must name secretEnv`);

  const cost = provider.cost ?? {};
  if (!allowedCost.has(cost.class)) fail(`${id}: unsupported cost class ${cost.class}`);
  if (cost.denyMeteredOverflow !== true) fail(`${id}: denyMeteredOverflow must be true`);
  if (provider.tier === 'A' && cost.class !== 'free_public') fail(`${id}: tier A must use free_public cost class`);
  if (provider.tier === 'B' && cost.class !== 'official_free_tier') fail(`${id}: tier B must use official_free_tier cost class`);

  const policy = provider.policy ?? {};
  for (const key of ['readOnlyByDefault', 'cacheWhereAllowed', 'respectRetryAfter', 'verifyTermsAtActivation']) {
    if (typeof policy[key] !== 'boolean') fail(`${id}: policy.${key} must be boolean`);
  }
  if (policy.readOnlyByDefault !== true) fail(`${id}: registry providers must be read-only by default`);
  if (policy.respectRetryAfter !== true) fail(`${id}: must respect retry/backoff signals`);
  if (policy.verifyTermsAtActivation !== true) fail(`${id}: terms must be re-verified at activation`);

  const health = provider.health ?? {};
  if (typeof health.enabled !== 'boolean') fail(`${id}: health.enabled must be boolean`);
  if (!allowedHealthMethod.has(health.method)) fail(`${id}: unsupported health method ${health.method}`);
  if (health.enabled) {
    if (!['GET', 'HEAD'].includes(health.method)) fail(`${id}: enabled health check must be GET or HEAD`);
    if (!isHttps(health.url)) fail(`${id}: enabled health check requires HTTPS url`);
    if (!Array.isArray(health.expectedStatus) || health.expectedStatus.length === 0) fail(`${id}: expectedStatus required`);
  }
  if (health.method === 'MANUAL' && health.enabled) fail(`${id}: MANUAL health check cannot be enabled`);

  if (provider.productionReady !== false) fail(`${id}: seed registry must stay productionReady=false until project-specific evidence exists`);

  const serialized = JSON.stringify(provider);
  if (credentialLike.test(serialized)) fail(`${id}: possible credential value committed to registry`);
}

const aiProviders = data.providers.filter((p) => p.category === 'ai');
if (aiProviders.length === 0) fail('at least one AI provider is required by the DHP seed');
if (aiProviders.some((p) => p.tier !== 'B')) fail('AI seed providers must be policy-gated tier B entries');

console.log(`OK: ${data.providers.length} curated providers (${aiProviders.length} AI), zero-cost overflow denied, no committed credentials detected.`);

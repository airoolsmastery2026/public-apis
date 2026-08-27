#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(fs.readFileSync(path.join(HERE, 'registry.json'), 'utf8'));
const soft = process.argv.includes('--soft');
const timeoutMs = 10000;
const userAgent = 'DHP-API-Hub-HealthCheck/1.0 (+https://github.com/airoolsmastery2026/public-apis)';

const checks = data.providers.filter((p) => p.health?.enabled === true);
const results = [];

for (const provider of checks) {
  const started = Date.now();
  let result;
  try {
    const response = await fetch(provider.health.url, {
      method: provider.health.method,
      redirect: 'follow',
      headers: {
        'User-Agent': userAgent,
        'Accept': 'application/json, text/plain;q=0.8, */*;q=0.5'
      },
      signal: AbortSignal.timeout(timeoutMs)
    });
    const ok = provider.health.expectedStatus.includes(response.status);
    result = {
      id: provider.id,
      ok,
      status: response.status,
      latencyMs: Date.now() - started
    };
  } catch (error) {
    result = {
      id: provider.id,
      ok: false,
      status: null,
      latencyMs: Date.now() - started,
      error: error?.name ?? 'Error'
    };
  }
  results.push(result);
  console.log(`${result.ok ? 'OK' : 'FAIL'} ${provider.id} status=${result.status ?? '-'} latencyMs=${result.latencyMs}`);

  // Deliberately serial with a small pause: health checking must not become load generation.
  await new Promise((resolve) => setTimeout(resolve, 250));
}

const failed = results.filter((r) => !r.ok);
console.log(JSON.stringify({ checkedAt: new Date().toISOString(), total: results.length, failed: failed.length, results }, null, 2));

if (failed.length > 0 && !soft) process.exit(1);

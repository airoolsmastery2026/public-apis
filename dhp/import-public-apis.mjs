#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(HERE);
const readmePath = path.join(ROOT, 'README.md');

const SAFE_CATEGORIES = new Set([
  'Books',
  'Business',
  'Calendar',
  'Cloud Storage & File Sharing',
  'Continuous Integration',
  'Currency Exchange',
  'Data Validation',
  'Development',
  'Dictionaries',
  'Documents & Productivity',
  'Email',
  'Environment',
  'Events',
  'Finance',
  'Geocoding',
  'Government',
  'Jobs',
  'Machine Learning',
  'News',
  'Open Data',
  'Open Source Projects',
  'Patent',
  'Programming',
  'Science & Math',
  'Security',
  'Test Data',
  'Text Analysis',
  'Tracking',
  'Transportation',
  'URL Shorteners',
  'Vehicle',
  'Video',
  'Weather'
]);

const args = process.argv.slice(2);
let output = path.join(ROOT, '.cache', 'dhp-public-api-candidates.json');
for (let i = 0; i < args.length; i += 1) {
  if (args[i] === '--output' && args[i + 1]) output = path.resolve(ROOT, args[++i]);
}

const lines = fs.readFileSync(readmePath, 'utf8').split(/\r?\n/);
let category = null;
const candidates = [];

function cleanCell(value) {
  return value.trim().replace(/\\\|/g, '|');
}

function extractMarkdownLink(cell) {
  const match = cell.match(/^\s*\[([^\]]+)\]\((https?:\/\/[^)]+)\)/);
  if (!match) return null;
  return { name: match[1].trim(), docs: match[2].trim() };
}

for (const line of lines) {
  const heading = line.match(/^###\s+(.+?)\s*$/);
  if (heading) {
    category = SAFE_CATEGORIES.has(heading[1]) ? heading[1] : null;
    continue;
  }

  if (!category || !line.startsWith('|')) continue;
  if (/^\|\s*:?-+/.test(line)) continue;

  const cells = line.slice(1, -1).split('|').map(cleanCell);
  if (cells.length < 5 || cells[0] === 'API') continue;

  const link = extractMarkdownLink(cells[0]);
  if (!link) continue;

  const authRaw = cells[2].replace(/`/g, '').trim();
  const httpsRaw = cells[3].trim().toLowerCase();
  const corsRaw = cells[4].trim();

  candidates.push({
    category,
    name: link.name,
    docs: link.docs,
    description: cells[1],
    auth: authRaw || 'Unknown',
    https: httpsRaw === 'yes',
    cors: corsRaw,
    source: 'README.md',
    status: 'candidate-only',
    promotionRule: 'Verify official docs, terms, auth, cost, quota and endpoint health before adding to dhp/registry.json.'
  });
}

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify({
  schema: 'dhp-public-api-candidates-v1',
  generatedAt: new Date().toISOString(),
  safeCategoryAllowlist: [...SAFE_CATEGORIES],
  candidateCount: candidates.length,
  candidates
}, null, 2) + '\n');

console.log(`Wrote ${candidates.length} safe-category candidates to ${path.relative(ROOT, output)}`);
console.log('No candidate was promoted into dhp/registry.json automatically.');

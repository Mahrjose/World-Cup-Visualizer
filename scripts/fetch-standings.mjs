#!/usr/bin/env node
/**
 * fetch-standings.mjs
 *
 * Pulls live WC 2026 group standings from ESPN and writes them to
 * src/data/starting_data.json (or a custom output path).
 *
 * Usage:
 *   node scripts/fetch-standings.mjs
 *   node scripts/fetch-standings.mjs --out my_snapshot.json
 *   node scripts/fetch-standings.mjs --dry-run   # print JSON, don't write
 *
 * After running, open the app and hit "Load JSON" if you don't use auto-sync,
 * or just rely on the in-app "Sync Live" button for real-time updates.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ── Parse CLI args ──────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const outIdx = args.indexOf('--out');
const outPath = outIdx !== -1 && args[outIdx + 1]
  ? resolve(process.cwd(), args[outIdx + 1])
  : resolve(ROOT, 'src/data/live_standings.json');

// ── Load our official team metadata ─────────────────────────────────────────
const startingData = JSON.parse(
  readFileSync(resolve(ROOT, 'src/data/starting_data.json'), 'utf8')
);

const TEAM_META = {};
const TEAM_BY_NAME = {};
for (const teams of Object.values(startingData.groups)) {
  for (const t of teams) {
    TEAM_META[t.id.toUpperCase()] = t;
    TEAM_BY_NAME[t.name.toLowerCase()] = t;
  }
}

function findTeamMeta(abbr, displayName) {
  return TEAM_META[abbr.toUpperCase()] ?? TEAM_BY_NAME[(displayName ?? '').toLowerCase()] ?? null;
}

function intStat(statsArr, name) {
  const hit = statsArr.find((s) => s.name === name);
  return hit ? Math.round(Number(hit.value) || 0) : 0;
}

function extractGroups(json) {
  return (
    json?.children ??
    json?.standings?.groups ??
    null
  );
}

function transformGroup(rawGroup) {
  const raw = rawGroup.abbreviation ?? rawGroup.name ?? rawGroup.shortName ?? '';
  const letter = raw.replace(/^group\s*/i, '').trim().toUpperCase().slice(0, 1);
  if (!letter || letter < 'A' || letter > 'L') return null;

  const entries = rawGroup.standings?.entries ?? rawGroup.entries ?? [];
  const teams = entries.map((entry) => {
    const abbr = (entry.team?.abbreviation ?? '').toUpperCase();
    const displayName = entry.team?.displayName ?? entry.team?.name ?? abbr;
    const base = findTeamMeta(abbr, displayName);

    const s  = entry.stats ?? [];
    const w  = intStat(s, 'wins');
    const d  = intStat(s, 'ties');
    const l  = intStat(s, 'losses');
    const gf = intStat(s, 'pointsFor');
    const ga = intStat(s, 'pointsAgainst');

    return {
      id:            base?.id            ?? abbr,
      name:          base?.name          ?? displayName,
      flag:          base?.flag          ?? abbr.slice(0, 2).toLowerCase(),
      confederation: base?.confederation ?? '',
      pot:           base?.pot           ?? 4,
      mp: w + d + l,
      w, d, l, gf, ga,
      pts: w * 3 + d,
    };
  });

  return { letter, teams };
}

// ── Fetch ────────────────────────────────────────────────────────────────────
const ENDPOINTS = [
  'https://site.api.espn.com/apis/v2/sports/soccer/fifa.world/standings',
];

async function fetchWithFallback() {
  for (const url of ENDPOINTS) {
    process.stderr.write(`Trying ${url} … `);
    try {
      const res = await fetch(url);
      if (!res.ok) {
        process.stderr.write(`HTTP ${res.status}\n`);
        continue;
      }
      const json = await res.json();
      const rawGroups = extractGroups(json);
      if (!rawGroups?.length) {
        process.stderr.write('no groups in response\n');
        continue;
      }
      process.stderr.write(`${rawGroups.length} groups received\n`);
      return rawGroups;
    } catch (e) {
      process.stderr.write(`error: ${e.message}\n`);
    }
  }
  throw new Error('All ESPN endpoints failed. Check your internet connection.');
}

const rawGroups = await fetchWithFallback();

const groups = {};
for (const rg of rawGroups) {
  const parsed = transformGroup(rg);
  if (parsed) groups[parsed.letter] = parsed.teams;
}

// Fill any missing groups with zeros from starting data
for (const letter of 'ABCDEFGHIJKL'.split('')) {
  if (!groups[letter]) {
    groups[letter] = startingData.groups[letter].map((t) => ({ ...t }));
  }
}

const count = Object.keys(groups).length;
if (count === 0) {
  console.error('No groups A–L could be parsed from the ESPN response.');
  process.exit(1);
}

const output = {
  groups,
  _source: 'espn',
  _fetchedAt: new Date().toISOString(),
};

if (dryRun) {
  process.stdout.write(JSON.stringify(output, null, 2));
  process.stdout.write('\n');
  process.stderr.write(`\nDry run — ${count} groups parsed, nothing written.\n`);
} else {
  writeFileSync(outPath, JSON.stringify(output, null, 2));
  process.stderr.write(`\nWrote ${count} groups to ${outPath}\n`);
  process.stderr.write(
    `\nNext steps:\n` +
    `  • In the app, click "Load JSON" and select ${outPath}\n` +
    `  • Or just use the in-app "Sync Live" button for automatic fetching\n`
  );
}

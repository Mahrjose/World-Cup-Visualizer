/**
 * fetchStandings.js
 *
 * Pulls live group-stage standings from ESPN's public (no API key required) soccer
 * endpoint and transforms the result into the shape this app expects:
 *   { groups: { A: [teamObj, ...], ..., L: [...] } }
 *
 * The base team metadata (flag codes, confederation, pot) comes from our official
 * draw data so flags and confederation labels are always correct even when ESPN
 * abbreviations differ slightly.
 *
 * Endpoint reference:
 *   https://site.api.espn.com/apis/v2/sports/soccer/{slug}/standings
 *
 * Known working slugs — try them in order if one stops working:
 *   fifa.world          → current / active World Cup
 *   fifa.world.2026     → explicit year variant (ESPN may add this)
 *   fifa-world-cup-2026 → another possible slug
 */

import startingData from '../data/starting_data.json';

const ENDPOINTS = [
  'https://site.api.espn.com/apis/v2/sports/soccer/fifa.world/standings',
];

// Build id → full team object from the official draw data
const TEAM_META = (() => {
  const m = {};
  for (const teams of Object.values(startingData.groups)) {
    for (const t of teams) m[t.id.toUpperCase()] = t;
  }
  return m;
})();

// Also index by lowercase display name for fuzzy matching
const TEAM_BY_NAME = (() => {
  const m = {};
  for (const teams of Object.values(startingData.groups)) {
    for (const t of teams) m[t.name.toLowerCase()] = t;
  }
  return m;
})();

function findTeamMeta(abbr, displayName) {
  return (
    TEAM_META[abbr.toUpperCase()] ??
    TEAM_BY_NAME[(displayName ?? '').toLowerCase()] ??
    null
  );
}

function intStat(statsArr, name) {
  const hit = statsArr.find((s) => s.name === name);
  return hit ? Math.round(Number(hit.value) || 0) : 0;
}

function extractGroups(json) {
  // ESPN 2026 shape: top-level `children` array, each child IS a group
  return (
    json?.children ??
    json?.standings?.groups ??
    null
  );
}

function transformGroup(rawGroup) {
  // Extract single letter from "Group A", "A", "GROUP B", etc.
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
      // Metadata from official draw; fall back to ESPN values if team isn't in our list
      id:            base?.id            ?? abbr,
      name:          base?.name          ?? displayName,
      flag:          base?.flag          ?? abbr.slice(0, 2).toLowerCase(),
      confederation: base?.confederation ?? '',
      pot:           base?.pot           ?? 4,
      // Live stats
      mp: w + d + l,
      w, d, l, gf, ga,
      pts: w * 3 + d,
    };
  });

  return { letter, teams };
}

/**
 * Fetch live WC 2026 group standings from ESPN.
 *
 * Returns `{ groups: { A: [...], ..., L: [...] } }` — the same shape as
 * starting_data.json, ready to pass straight into `loadFromJson()`.
 *
 * Throws with a descriptive message on any failure so the caller can surface
 * it in the UI.
 */
export async function fetchLiveStandings() {
  let lastError;

  for (const url of ENDPOINTS) {
    let res, json;
    try {
      res = await fetch(url);
      if (!res.ok) {
        lastError = new Error(`ESPN returned HTTP ${res.status} for ${url}`);
        continue;
      }
      json = await res.json();
    } catch (e) {
      lastError = new Error(`Network error fetching ${url}: ${e.message}`);
      continue;
    }

    const rawGroups = extractGroups(json);
    if (!rawGroups?.length) {
      lastError = new Error(
        `Unexpected ESPN response shape at ${url} — no groups array found. ` +
        'The API may have changed its structure.'
      );
      continue;
    }

    const groups = {};
    for (const rg of rawGroups) {
      const parsed = transformGroup(rg);
      if (parsed) groups[parsed.letter] = parsed.teams;
    }

    const count = Object.keys(groups).length;
    if (count === 0) {
      lastError = new Error(
        `ESPN data parsed but no groups A–L found (got ${rawGroups.length} raw groups). ` +
        'Group names or tournament slug may have changed.'
      );
      continue;
    }

    // Partial update: any group NOT returned by ESPN keeps its starting-data zeros
    // so the validator won't reject a partially-played tournament
    for (const letter of 'ABCDEFGHIJKL'.split('')) {
      if (!groups[letter]) {
        groups[letter] = startingData.groups[letter].map((t) => ({ ...t }));
      }
    }

    return { groups, _source: 'espn', _fetchedAt: new Date().toISOString() };
  }

  throw lastError ?? new Error('fetchLiveStandings: all endpoints failed');
}

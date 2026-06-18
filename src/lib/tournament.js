// src/lib/tournament.js
// Core competition logic: group sorting, third-place ranking, and Round-of-32 bracket construction.

export const GROUP_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

/** Derive GD and Pts from raw W/D/L/GF/GA so the two always stay consistent. */
export function deriveStats(team) {
  const gd = team.gf - team.ga;
  const pts = team.w * 3 + team.d * 1;
  return { ...team, gd, pts };
}

/** Standard FIFA tiebreak order: Pts, GD, GF, then alphabetical as a final stable fallback
 *  (head-to-head and fair-play points are not modeled in this sandbox). */
export function compareTeams(a, b) {
  if (b.pts !== a.pts) return b.pts - a.pts;
  if (b.gd !== a.gd) return b.gd - a.gd;
  if (b.gf !== a.gf) return b.gf - a.gf;
  return a.name.localeCompare(b.name);
}

/** Sort one group's teams and attach derived stats + rank. Accepts an optional
 *  manualOrder array of team ids to force a specific order (drag-and-drop override). */
export function sortGroup(teams, manualOrder) {
  const withStats = teams.map(deriveStats);
  if (manualOrder && manualOrder.length === withStats.length) {
    const byId = Object.fromEntries(withStats.map((t) => [t.id, t]));
    return manualOrder.map((id, i) => ({ ...byId[id], rank: i + 1 }));
  }
  const sorted = [...withStats].sort(compareTeams);
  return sorted.map((t, i) => ({ ...t, rank: i + 1 }));
}

/** Rank all third-placed teams across the 12 groups; returns the full ordered list
 *  with a `qualifies` flag on the top 8. */
export function rankThirdPlace(standingsByGroup) {
  const thirds = GROUP_LETTERS.map((g) => {
    const group = standingsByGroup[g];
    const t = group?.[2];
    return t ? { ...t, group: g } : null;
  }).filter(Boolean);

  const sorted = [...thirds].sort(compareTeams);
  return sorted.map((t, i) => ({ ...t, overallRank: i + 1, qualifies: i < 8 }));
}

/**
 * Build the Round of 32 bracket.
 *
 * Real FIFA regulations use a 495-row lookup table (Annex C) keyed on exactly which
 * 8 of the 12 groups produce qualifying third-place teams — the matchup for a given
 * bracket position depends on group identity, not just rank, specifically so that
 * teams who already met in the group stage don't immediately meet again. Reproducing
 * that table exactly requires encoding all 495 scenarios, which is out of scope for
 * this sandbox. Instead, this app uses a simpler, always-well-defined rule: the 8
 * qualifying third-place teams fill the bracket's "vs 3rd" slots in their overall
 * ranking order (best qualifying third in the first such slot, and so on). This
 * guarantees every slot is always filled for any combination of qualifiers, at the
 * cost of not guaranteeing the same anti-repeat-matchup protection FIFA's real table
 * provides.
 *
 * The 24 direct slots (12 group winners + 12 runners-up) are fixed and every slot is
 * used exactly once: 12 winner-matches (8 face a third-place team, 4 face a runner-up
 * directly) plus 4 runner-up-vs-runner-up matches use the remaining 8 runners-up.
 */
const ROUND_OF_32_TEMPLATE = [
  { id: 'R32-1', home: 'B1', away: 'A2' },
  { id: 'R32-2', home: 'G1', away: 'H2' },
  { id: 'R32-3', home: 'J1', away: 'K2' },
  { id: 'R32-4', home: 'L1', away: 'C2' },
  { id: 'R32-5', home: 'A1', away: '3rd' },
  { id: 'R32-6', home: 'C1', away: '3rd' },
  { id: 'R32-7', home: 'D1', away: '3rd' },
  { id: 'R32-8', home: 'E1', away: '3rd' },
  { id: 'R32-9', home: 'F1', away: '3rd' },
  { id: 'R32-10', home: 'H1', away: '3rd' },
  { id: 'R32-11', home: 'I1', away: '3rd' },
  { id: 'R32-12', home: 'K1', away: '3rd' },
  { id: 'R32-13', home: 'B2', away: 'D2' },
  { id: 'R32-14', home: 'E2', away: 'F2' },
  { id: 'R32-15', home: 'G2', away: 'I2' },
  { id: 'R32-16', home: 'J2', away: 'L2' },
];

function slotToTeam(slot, standingsByGroup) {
  // slot like "A1", "C2"
  const group = slot[0];
  const rank = parseInt(slot[1], 10);
  return standingsByGroup[group]?.[rank - 1] ?? null;
}

/** Fills the template's "3rd" slots with the 8 qualifying third-place teams in
 *  overall-rank order. Always succeeds (8 slots, exactly 8 qualifiers) as long as
 *  every group has at least 3 ranked teams, which sortGroup always guarantees. */
function assignThirdPlaceSlots(template, qualifyingThirdsInRankOrder) {
  const assignments = {};
  const queue = [...qualifyingThirdsInRankOrder];
  template.forEach((match) => {
    if (match.away !== '3rd') return;
    assignments[match.id] = queue.shift() || null;
  });
  return assignments;
}

/** Build the full Round of 32 given current standings for every group.
 *  Returns an array of { id, homeTeam, awayTeam, homeSlot, awaySlot } where team can be
 *  null if the group doesn't have enough data yet (always populated once stats exist,
 *  since standings always produce 4 ranked rows). */
export function buildRoundOf32(standingsByGroup) {
  const qualifyingThirds = rankThirdPlace(standingsByGroup).filter((t) => t.qualifies);
  const thirdAssignments = assignThirdPlaceSlots(ROUND_OF_32_TEMPLATE, qualifyingThirds);

  return ROUND_OF_32_TEMPLATE.map((match) => {
    const homeTeam = slotToTeam(match.home, standingsByGroup);
    const awayTeam =
      match.away === '3rd' ? thirdAssignments[match.id] || null : slotToTeam(match.away, standingsByGroup);
    return {
      id: match.id,
      round: 'R32',
      homeSlot: match.home,
      awaySlot: match.away === '3rd' ? `3rd (${awayTeam?.group ?? '?'})` : match.away,
      homeTeam,
      awayTeam,
    };
  });
}

/** Given a completed round's matches (each possibly with a winner set), build the next
 *  round by pairing match i with match i+1 in sequence. */
export function buildNextRound(matches, roundName) {
  const next = [];
  for (let i = 0; i < matches.length; i += 2) {
    const m1 = matches[i];
    const m2 = matches[i + 1];
    next.push({
      id: `${roundName}-${i / 2 + 1}`,
      round: roundName,
      homeSlot: m1?.id,
      awaySlot: m2?.id,
      homeTeam: m1?.winner || null,
      awayTeam: m2?.winner || null,
    });
  }
  return next;
}

export const ROUND_SEQUENCE = ['R32', 'R16', 'QF', 'SF', 'F'];
export const ROUND_LABELS = {
  R32: 'Round of 32',
  R16: 'Round of 16',
  QF: 'Quarterfinals',
  SF: 'Semifinals',
  F: 'Final',
};

// ─── JSON validation ─────────────────────────────────────────────────────────

const REQUIRED_STAT_FIELDS = ['w', 'd', 'l', 'gf', 'ga'];

/** Validates the shape of a loaded JSON object.
 *  Throws a descriptive Error on failure; returns the groups object on success. */
export function validateGroupsJson(json) {
  if (!json || typeof json !== 'object') throw new Error('Expected a JSON object.');
  if (!json.groups || typeof json.groups !== 'object') throw new Error('Missing required "groups" key.');

  const groups = json.groups;
  const keys = Object.keys(groups);

  const missing = GROUP_LETTERS.filter((g) => !keys.includes(g));
  if (missing.length) throw new Error(`Missing groups: ${missing.join(', ')}. Expected all 12 (A–L).`);

  const extra = keys.filter((k) => !GROUP_LETTERS.includes(k));
  if (extra.length) throw new Error(`Unexpected group keys: ${extra.join(', ')}. Only A–L allowed.`);

  for (const letter of GROUP_LETTERS) {
    const teams = groups[letter];
    if (!Array.isArray(teams)) throw new Error(`Group ${letter}: expected an array of teams.`);
    if (teams.length !== 4) throw new Error(`Group ${letter}: expected 4 teams, got ${teams.length}.`);

    teams.forEach((team, i) => {
      if (!team || typeof team !== 'object') throw new Error(`Group ${letter} team ${i + 1}: not an object.`);
      if (!team.id || typeof team.id !== 'string') throw new Error(`Group ${letter} team ${i + 1}: missing string "id".`);
      if (!team.name || typeof team.name !== 'string') throw new Error(`Group ${letter} team ${i + 1} (${team.id}): missing string "name".`);
      for (const f of REQUIRED_STAT_FIELDS) {
        if (typeof team[f] !== 'number' || !isFinite(team[f])) {
          throw new Error(`Group ${letter} / ${team.id}: field "${f}" must be a finite number (got ${JSON.stringify(team[f])}).`);
        }
      }
    });
  }

  return groups;
}

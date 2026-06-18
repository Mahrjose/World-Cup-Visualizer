import { describe, it, expect } from 'vitest';
import {
  deriveStats,
  compareTeams,
  sortGroup,
  rankThirdPlace,
  buildRoundOf32,
  buildNextRound,
  GROUP_LETTERS,
  ROUND_SEQUENCE,
  validateGroupsJson,
} from './tournament.js';

// helpers
function makeTeam(id, w, d, l, gf, ga, name) {
  return { id, name: name ?? id, w, d, l, gf, ga, mp: w + d + l };
}

function makeFullStandings(overrides = {}) {
  const standings = {};
  GROUP_LETTERS.forEach((g) => {
    const base = overrides[g] ?? [
      makeTeam(`${g}1`, 3, 0, 0, 9, 1),
      makeTeam(`${g}2`, 2, 0, 1, 6, 3),
      makeTeam(`${g}3`, 1, 0, 2, 3, 6),
      makeTeam(`${g}4`, 0, 0, 3, 1, 9),
    ];
    standings[g] = sortGroup(base);
  });
  return standings;
}

// ─── deriveStats ─────────────────────────────────────────────────────────────

describe('deriveStats', () => {
  it('calculates pts as 3*w + d', () => {
    expect(deriveStats(makeTeam('X', 2, 1, 0, 5, 2)).pts).toBe(7);
  });

  it('calculates gd as gf - ga', () => {
    expect(deriveStats(makeTeam('X', 1, 0, 1, 4, 3)).gd).toBe(1);
  });

  it('handles negative gd', () => {
    expect(deriveStats(makeTeam('X', 0, 0, 3, 0, 9)).gd).toBe(-9);
  });
});

// ─── compareTeams ────────────────────────────────────────────────────────────

describe('compareTeams', () => {
  it('sorts by pts descending', () => {
    const a = { name: 'A', pts: 9, gd: 9, gf: 9 };
    const b = { name: 'B', pts: 3, gd: -3, gf: 3 };
    expect(compareTeams(a, b)).toBeLessThan(0);
  });

  it('breaks pts tie by gd', () => {
    const a = { name: 'A', pts: 6, gd: 3, gf: 5 };
    const b = { name: 'B', pts: 6, gd: 1, gf: 5 };
    expect(compareTeams(a, b)).toBeLessThan(0);
  });

  it('breaks gd tie by gf', () => {
    const a = { name: 'A', pts: 6, gd: 2, gf: 7 };
    const b = { name: 'B', pts: 6, gd: 2, gf: 5 };
    expect(compareTeams(a, b)).toBeLessThan(0);
  });

  it('breaks full tie alphabetically', () => {
    const a = { name: 'Alpha', pts: 4, gd: 0, gf: 4 };
    const b = { name: 'Beta', pts: 4, gd: 0, gf: 4 };
    expect(compareTeams(a, b)).toBeLessThan(0);
    expect(compareTeams(b, a)).toBeGreaterThan(0);
  });
});

// ─── sortGroup ───────────────────────────────────────────────────────────────

describe('sortGroup', () => {
  it('assigns ranks 1-4 in correct order', () => {
    const teams = [
      makeTeam('A', 1, 0, 2, 3, 6),
      makeTeam('B', 3, 0, 0, 9, 1),
      makeTeam('C', 2, 0, 1, 6, 3),
      makeTeam('D', 0, 0, 3, 1, 9),
    ];
    const sorted = sortGroup(teams);
    expect(sorted.map((t) => t.rank)).toEqual([1, 2, 3, 4]);
    expect(sorted[0].id).toBe('B');
    expect(sorted[1].id).toBe('C');
  });

  it('respects manualOrder override', () => {
    const teams = [
      makeTeam('A', 3, 0, 0, 9, 0),
      makeTeam('B', 0, 0, 3, 0, 9),
      makeTeam('C', 2, 0, 1, 6, 3),
      makeTeam('D', 1, 0, 2, 3, 6),
    ];
    const sorted = sortGroup(teams, ['D', 'C', 'B', 'A']);
    expect(sorted.map((t) => t.id)).toEqual(['D', 'C', 'B', 'A']);
    expect(sorted.map((t) => t.rank)).toEqual([1, 2, 3, 4]);
  });

  it('ignores manualOrder if length mismatch', () => {
    const teams = [
      makeTeam('A', 3, 0, 0, 9, 0),
      makeTeam('B', 0, 0, 3, 0, 9),
      makeTeam('C', 2, 0, 1, 6, 3),
      makeTeam('D', 1, 0, 2, 3, 6),
    ];
    const sorted = sortGroup(teams, ['D', 'C']); // partial → computed order
    expect(sorted[0].id).toBe('A');
  });

  it('derives pts and gd', () => {
    const result = sortGroup([makeTeam('X', 2, 1, 0, 7, 2)]);
    expect(result[0].pts).toBe(7);
    expect(result[0].gd).toBe(5);
  });

  it('handles all-zero starting state (falls back to alphabetical)', () => {
    const teams = [
      makeTeam('MEX', 0, 0, 0, 0, 0, 'Mexico'),
      makeTeam('RSA', 0, 0, 0, 0, 0, 'South Africa'),
      makeTeam('KOR', 0, 0, 0, 0, 0, 'South Korea'),
      makeTeam('CZE', 0, 0, 0, 0, 0, 'Czech Republic'),
    ];
    const sorted = sortGroup(teams);
    expect(sorted).toHaveLength(4);
    expect(sorted[0].name).toBe('Czech Republic');
  });
});

// ─── rankThirdPlace ──────────────────────────────────────────────────────────

describe('rankThirdPlace', () => {
  it('returns exactly 12 entries', () => {
    expect(rankThirdPlace(makeFullStandings())).toHaveLength(12);
  });

  it('marks exactly 8 as qualifying', () => {
    const ranking = rankThirdPlace(makeFullStandings());
    expect(ranking.filter((t) => t.qualifies)).toHaveLength(8);
    ranking.slice(0, 8).forEach((t) => expect(t.qualifies).toBe(true));
    ranking.slice(8).forEach((t) => expect(t.qualifies).toBe(false));
  });

  it('assigns overallRank 1-12', () => {
    const ranking = rankThirdPlace(makeFullStandings());
    expect(ranking.map((t) => t.overallRank)).toEqual(
      Array.from({ length: 12 }, (_, i) => i + 1)
    );
  });

  it('includes one team from each of the 12 groups', () => {
    const ranking = rankThirdPlace(makeFullStandings());
    const groups = ranking.map((t) => t.group);
    expect(new Set(groups).size).toBe(12);
    GROUP_LETTERS.forEach((g) => expect(groups).toContain(g));
  });

  it('ranks best third-place team first by pts/gd/gf', () => {
    const standings = makeFullStandings({
      A: [
        makeTeam('A1', 3, 0, 0, 9, 0),
        makeTeam('A2', 2, 0, 1, 6, 2),
        makeTeam('BEST3', 1, 1, 1, 8, 2, 'Best Third'), // 4 pts, +6 gd
        makeTeam('A4', 0, 0, 3, 0, 9),
      ],
    });
    expect(rankThirdPlace(standings)[0].id).toBe('BEST3');
  });
});

// ─── buildRoundOf32 ──────────────────────────────────────────────────────────

describe('buildRoundOf32', () => {
  it('returns 16 matches', () => {
    expect(buildRoundOf32(makeFullStandings())).toHaveLength(16);
  });

  it('produces 32 unique non-null teams', () => {
    const matches = buildRoundOf32(makeFullStandings());
    const ids = matches.flatMap((m) => [m.homeTeam?.id, m.awayTeam?.id]);
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(32);
  });

  it('all matches have round R32', () => {
    buildRoundOf32(makeFullStandings()).forEach((m) => expect(m.round).toBe('R32'));
  });

  it('all-zero starting stats still produce 32 unique non-null teams', () => {
    const standings = {};
    GROUP_LETTERS.forEach((g) => {
      standings[g] = sortGroup([
        makeTeam(`${g}a`, 0, 0, 0, 0, 0, `${g} Alpha`),
        makeTeam(`${g}b`, 0, 0, 0, 0, 0, `${g} Beta`),
        makeTeam(`${g}c`, 0, 0, 0, 0, 0, `${g} Gamma`),
        makeTeam(`${g}d`, 0, 0, 0, 0, 0, `${g} Delta`),
      ]);
    });
    const matches = buildRoundOf32(standings);
    const ids = matches.flatMap((m) => [m.homeTeam?.id, m.awayTeam?.id]);
    expect(ids.every(Boolean)).toBe(true);
    expect(new Set(ids).size).toBe(32);
  });

  it('no team appears in both home and away slots', () => {
    const matches = buildRoundOf32(makeFullStandings());
    const homeIds = new Set(matches.map((m) => m.homeTeam.id));
    const awayIds = new Set(matches.map((m) => m.awayTeam.id));
    expect([...homeIds].filter((id) => awayIds.has(id))).toHaveLength(0);
  });

  it('50 randomised simulations all produce 32 unique non-null teams', () => {
    // Deterministic "random" via sin so tests are reproducible
    function pseudoRand(seed) {
      return Math.abs(Math.floor(Math.sin(seed * 9301 + 49297) * 10000)) % 7;
    }
    for (let sim = 0; sim < 50; sim++) {
      const standings = {};
      GROUP_LETTERS.forEach((g, gi) => {
        const teams = [1, 2, 3, 4].map((i) => {
          const seed = sim * 100 + gi * 10 + i;
          return makeTeam(
            `${g}${i}`,
            pseudoRand(seed) % 4,
            pseudoRand(seed + 1) % 3,
            pseudoRand(seed + 2) % 4,
            pseudoRand(seed + 3),
            pseudoRand(seed + 4),
            `Team ${g}${i}`
          );
        });
        standings[g] = sortGroup(teams);
      });
      const matches = buildRoundOf32(standings);
      const ids = matches.flatMap((m) => [m.homeTeam?.id, m.awayTeam?.id]);
      expect(ids.every(Boolean), `sim ${sim}: null team`).toBe(true);
      expect(new Set(ids).size, `sim ${sim}: duplicate teams`).toBe(32);
    }
  });
});

// ─── buildNextRound ──────────────────────────────────────────────────────────

describe('buildNextRound', () => {
  it('halves the match count', () => {
    const r32 = Array.from({ length: 16 }, (_, i) => ({
      id: `R32-${i + 1}`,
      winner: makeTeam(`T${i}`, 1, 0, 0, 1, 0),
    }));
    expect(buildNextRound(r32, 'R16')).toHaveLength(8);
  });

  it('uses winners as next-round home/away', () => {
    const wa = makeTeam('WA', 1, 0, 0, 1, 0);
    const wb = makeTeam('WB', 1, 0, 0, 1, 0);
    const next = buildNextRound([{ id: 'M1', winner: wa }, { id: 'M2', winner: wb }], 'R16');
    expect(next[0].homeTeam).toEqual(wa);
    expect(next[0].awayTeam).toEqual(wb);
  });

  it('sets null teams when no winner picked', () => {
    const next = buildNextRound([{ id: 'M1', winner: null }, { id: 'M2', winner: null }], 'R16');
    expect(next[0].homeTeam).toBeNull();
    expect(next[0].awayTeam).toBeNull();
  });

  it('full R32→R16→QF→SF→F produces correct match counts [16,8,4,2,1]', () => {
    let matches = buildRoundOf32(makeFullStandings()).map((m) => ({ ...m, winner: m.homeTeam }));
    const counts = [matches.length];
    for (let i = 1; i < ROUND_SEQUENCE.length; i++) {
      matches = buildNextRound(matches, ROUND_SEQUENCE[i]).map((m) => ({ ...m, winner: m.homeTeam }));
      counts.push(matches.length);
    }
    expect(counts).toEqual([16, 8, 4, 2, 1]);
  });
});

// ─── validateGroupsJson ──────────────────────────────────────────────────────

describe('validateGroupsJson', () => {
  function makeValidJson() {
    const groups = {};
    GROUP_LETTERS.forEach((g) => {
      groups[g] = [1, 2, 3, 4].map((i) => ({
        id: `${g}${i}`,
        name: `Team ${g}${i}`,
        w: 0, d: 0, l: 0, gf: 0, ga: 0,
      }));
    });
    return { groups };
  }

  it('accepts valid JSON', () => {
    expect(() => validateGroupsJson(makeValidJson())).not.toThrow();
  });

  it('throws if groups key is missing', () => {
    expect(() => validateGroupsJson({})).toThrow(/missing.*groups/i);
  });

  it('throws if a group is missing', () => {
    const json = makeValidJson();
    delete json.groups.L;
    expect(() => validateGroupsJson(json)).toThrow(/L/);
  });

  it('throws on unexpected group keys', () => {
    const json = makeValidJson();
    json.groups.Z = json.groups.A.map((t) => ({ ...t }));
    expect(() => validateGroupsJson(json)).toThrow(/Z/);
  });

  it('throws if a group has wrong team count', () => {
    const json = makeValidJson();
    json.groups.A = json.groups.A.slice(0, 3);
    expect(() => validateGroupsJson(json)).toThrow(/Group A.*4 teams/);
  });

  it('throws if a stat field is missing', () => {
    const json = makeValidJson();
    delete json.groups.B[0].gf;
    expect(() => validateGroupsJson(json)).toThrow(/"gf"/);
  });

  it('throws if a stat field is a string', () => {
    const json = makeValidJson();
    json.groups.C[1].w = '2';
    expect(() => validateGroupsJson(json)).toThrow(/"w"/);
  });

  it('throws if team id is missing', () => {
    const json = makeValidJson();
    delete json.groups.D[0].id;
    expect(() => validateGroupsJson(json)).toThrow(/missing string "id"/);
  });

  it('returns the groups object on success', () => {
    const json = makeValidJson();
    expect(validateGroupsJson(json)).toBe(json.groups);
  });
});

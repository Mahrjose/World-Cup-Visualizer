import { useState, useMemo, useEffect, useRef } from 'react';
import { buildNextRound, ROUND_SEQUENCE } from '../lib/tournament';

/** Manages winner picks across R32 -> R16 -> QF -> SF -> F, regenerating downstream
 *  rounds whenever an upstream pick changes or the R32 itself changes (because group
 *  standings were edited). Winner picks are keyed by match id so they survive
 *  re-renders of the base R32 array (new array identity each render). */
export function useBracketProgression(roundOf32) {
  const [winners, setWinners] = useState({}); // matchId -> team

  // If the R32 matchup in a given slot changes (e.g. group order changed and a
  // different team now occupies that slot), drop any stale winner pick for it and
  // everything downstream that depended on it.
  const lastR32Signature = useRef(null);
  useEffect(() => {
    const signature = roundOf32.map((m) => `${m.id}:${m.homeTeam?.id}-${m.awayTeam?.id}`).join('|');
    if (lastR32Signature.current !== null && lastR32Signature.current !== signature) {
      setWinners({});
    }
    lastR32Signature.current = signature;
  }, [roundOf32]);

  const rounds = useMemo(() => {
    const withWinners = (matches) =>
      matches.map((m) => ({ ...m, winner: winners[m.id] || null }));

    const r32 = withWinners(roundOf32);
    const out = { R32: r32 };

    let current = r32;
    for (let i = 1; i < ROUND_SEQUENCE.length; i++) {
      const roundName = ROUND_SEQUENCE[i];
      const next = withWinners(buildNextRound(current, roundName));
      out[roundName] = next;
      current = next;
    }
    return out;
  }, [roundOf32, winners]);

  function pickWinner(matchId, team) {
    setWinners((prev) => ({ ...prev, [matchId]: team }));
  }

  function resetBracket() {
    setWinners({});
  }

  const champion = rounds.F?.[0]?.winner || null;

  return { rounds, pickWinner, resetBracket, champion };
}

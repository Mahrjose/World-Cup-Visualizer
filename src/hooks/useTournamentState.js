import { useState, useMemo, useCallback, useEffect } from 'react';
import startingData from '../data/starting_data.json';
import { sortGroup, rankThirdPlace, buildRoundOf32, GROUP_LETTERS, validateGroupsJson } from '../lib/tournament';

const STORAGE_KEY = 'wc26_state';

function loadPersistedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const { groups, manualOrder } = JSON.parse(raw);
    if (!groups || typeof groups !== 'object') return null;
    return { groups, manualOrder: manualOrder || {} };
  } catch {
    return null;
  }
}

const STORAGE_NOTE = 'State auto-saved to localStorage — persists across reloads.';

export function useTournamentState() {
  const [groups, setGroups] = useState(() => {
    const persisted = loadPersistedState();
    return structuredCloneGroups(persisted?.groups ?? startingData.groups);
  });
  const [manualOrder, setManualOrder] = useState(() => loadPersistedState()?.manualOrder ?? {});
  const [history, setHistory] = useState([]);

  // persist on every change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ groups, manualOrder }));
    } catch {
      // storage quota exceeded or private browsing — silently skip
    }
  }, [groups, manualOrder]);

  const pushHistory = useCallback((prevGroups, prevManual) => {
    setHistory((h) => [...h.slice(-19), { groups: prevGroups, manualOrder: prevManual }]);
  }, []);

  const undo = useCallback(() => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const last = h[h.length - 1];
      setGroups(last.groups);
      setManualOrder(last.manualOrder);
      return h.slice(0, -1);
    });
  }, []);

  const updateTeamStat = useCallback(
    (groupLetter, teamId, field, value) => {
      setGroups((prev) => {
        pushHistory(prev, manualOrder);
        const next = { ...prev };
        next[groupLetter] = prev[groupLetter].map((t) => {
          if (t.id !== teamId) return t;
          const updated = { ...t, [field]: clampStat(field, value) };
          if (['w', 'd', 'l'].includes(field)) {
            updated.mp = updated.w + updated.d + updated.l;
          }
          return updated;
        });
        return next;
      });
    },
    [manualOrder, pushHistory]
  );

  const reorderGroup = useCallback(
    (groupLetter, newIdOrder) => {
      setManualOrder((prev) => {
        pushHistory(groups, prev);
        return { ...prev, [groupLetter]: newIdOrder };
      });
    },
    [groups, pushHistory]
  );

  const clearManualOrder = useCallback((groupLetter) => {
    setManualOrder((prev) => {
      const next = { ...prev };
      delete next[groupLetter];
      return next;
    });
  }, []);

  const resetAll = useCallback(() => {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    setGroups(structuredCloneGroups(startingData.groups));
    setManualOrder({});
    setHistory([]);
  }, []);

  const loadFromJson = useCallback((json) => {
    const groups = validateGroupsJson(json); // throws with a descriptive message on failure
    setGroups(structuredCloneGroups(groups));
    setManualOrder({});
    setHistory([]);
  }, []);

  // computed standings: sorted + ranked per group, respecting manual overrides
  const standings = useMemo(() => {
    const out = {};
    GROUP_LETTERS.forEach((g) => {
      out[g] = sortGroup(groups[g] || [], manualOrder[g]);
    });
    return out;
  }, [groups, manualOrder]);

  const thirdPlaceRanking = useMemo(() => rankThirdPlace(standings), [standings]);

  const roundOf32 = useMemo(() => buildRoundOf32(standings), [standings]);

  return {
    groups,
    standings,
    thirdPlaceRanking,
    roundOf32,
    updateTeamStat,
    reorderGroup,
    clearManualOrder,
    manualOrder,
    resetAll,
    loadFromJson,
    undo,
    canUndo: history.length > 0,
    storageNote: STORAGE_NOTE,
  };
}

function structuredCloneGroups(groups) {
  return Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, v.map((t) => ({ ...t }))]));
}

function clampStat(field, value) {
  const n = Math.max(0, Math.min(99, Math.round(Number(value) || 0)));
  return n;
}

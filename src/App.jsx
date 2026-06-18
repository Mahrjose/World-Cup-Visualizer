import { useRef, useState } from 'react';
import { Trophy, Upload, RotateCcw, Undo2, Info, RefreshCw } from 'lucide-react';
import { useTournamentState } from './hooks/useTournamentState';
import { useBracketProgression } from './hooks/useBracketProgression';
import { GROUP_LETTERS } from './lib/tournament';
import { fetchLiveStandings } from './lib/fetchStandings';
import GroupCard from './components/GroupCard';
import ThirdPlaceMatrix from './components/ThirdPlaceMatrix';
import KnockoutBracket from './components/KnockoutBracket';

export default function App() {
  const {
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
    canUndo,
  } = useTournamentState();

  const { rounds, pickWinner, resetBracket, champion } = useBracketProgression(roundOf32);
  const fileInputRef = useRef(null);
  const [loadError, setLoadError] = useState(null);
  const [syncing, setSyncing] = useState(false);

  async function handleSync() {
    setSyncing(true);
    setLoadError(null);
    try {
      const data = await fetchLiveStandings();
      loadFromJson(data);
      resetBracket();
    } catch (err) {
      setLoadError(`Sync failed: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target.result);
        loadFromJson(json);
        resetBracket();
        setLoadError(null);
      } catch (err) {
        setLoadError(`Couldn't load that file: ${err.message}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function handleResetAll() {
    resetAll();
    resetBracket();
    setLoadError(null);
  }

  return (
    <div className="min-h-screen pitch-texture bg-cream">
      <header className="bg-pitch border-b-4 border-whistle sticky top-0 z-20">
        <div className="max-w-[1680px] mx-auto px-4 md:px-6 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-whistle rounded-md p-1.5 flex-shrink-0">
              <Trophy size={20} className="text-pitch" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="font-display font-bold text-cream text-lg sm:text-xl tracking-tight leading-tight">
                FIFA World Cup 2026 Visualizer
              </h1>
              <p className="text-[11px] text-whistle/80 font-medium tracking-wide hidden sm:block">
                48 teams · 12 groups · interactive sandbox
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSync}
              disabled={syncing}
              title="Fetch live standings from ESPN"
              className="flex items-center gap-1.5 text-cream/90 hover:text-whistle disabled:opacity-50 text-xs font-medium px-2.5 py-1.5 rounded-md hover:bg-white/10 transition-colors"
            >
              <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">{syncing ? 'Syncing…' : 'Sync Live'}</span>
            </button>
            <button
              onClick={undo}
              disabled={!canUndo}
              className="flex items-center gap-1.5 text-cream/90 hover:text-whistle disabled:opacity-30 disabled:hover:text-cream/90 text-xs font-medium px-2.5 py-1.5 rounded-md hover:bg-white/10 transition-colors"
            >
              <Undo2 size={14} />
              <span className="hidden sm:inline">Undo</span>
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 text-cream/90 hover:text-whistle text-xs font-medium px-2.5 py-1.5 rounded-md hover:bg-white/10 transition-colors"
            >
              <Upload size={14} />
              <span className="hidden sm:inline">Load JSON</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              onClick={handleResetAll}
              className="flex items-center gap-1.5 bg-whistle text-pitch text-xs font-bold px-3 py-1.5 rounded-md hover:bg-white transition-colors"
            >
              <RotateCcw size={14} />
              Reset
            </button>
          </div>
        </div>
      </header>

      {loadError && (
        <div className="max-w-[1680px] mx-auto px-4 md:px-6 pt-3">
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-3 py-2">
            {loadError}
          </div>
        </div>
      )}

      <main className="max-w-[1680px] mx-auto px-4 md:px-6 py-6 flex flex-col gap-6">
        <div className="flex items-start gap-2 text-slate-muted text-[12px] bg-white/50 border border-slate-line rounded-md px-3 py-2">
          <Info size={14} className="flex-shrink-0 mt-0.5" />
          <p>
            Drag the grip handle on any row to override its position, or click directly on a W,
            D, L, GF, or GA cell to edit it inline — points and goal difference recalculate
            automatically, and the knockout bracket updates the moment a group's order changes.
            Your changes are saved automatically and persist across reloads. Hit "Reset" to
            return to the official group draw.
          </p>
        </div>

        <section>
          <h2 className="font-display font-bold text-lg text-ink tracking-tight mb-3">
            Group Standings
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {GROUP_LETTERS.map((g) => (
              <GroupCard
                key={g}
                groupLetter={g}
                teams={standings[g]}
                isManual={Boolean(manualOrder[g])}
                onReorder={reorderGroup}
                onEdit={updateTeamStat}
                onClearManual={clearManualOrder}
              />
            ))}
          </div>
        </section>

        <ThirdPlaceMatrix thirdPlaceRanking={thirdPlaceRanking} />

        <KnockoutBracket rounds={rounds} onPickWinner={pickWinner} />

        {champion && (
          <section className="bg-pitch rounded-lg p-6 text-center border-4 border-whistle">
            <Trophy size={32} className="text-whistle mx-auto mb-2" strokeWidth={2} />
            <p className="text-whistle/80 text-xs font-bold tracking-widest uppercase mb-1">
              World Champions
            </p>
            <p className="font-display font-bold text-cream text-3xl tracking-tight">
              {champion.name}
            </p>
          </section>
        )}
      </main>

      <footer className="max-w-[1680px] mx-auto px-4 md:px-6 py-6 text-center text-[11px] text-slate-muted">
        Seeded from the official December 5, 2025 World Cup draw. Round of 32 third-place
        pairings use a simplified deterministic mapping rather than FIFA's full 495-scenario
        Annex C table. Not an official FIFA product.
      </footer>
    </div>
  );
}

import Flag from './Flag';
import { ROUND_LABELS } from '../lib/tournament';

// ─── Layout constants ─────────────────────────────────────────────────────────
const SLOT_H   = 76;           // px per R32 match slot (each half has 8)
const HALF_H   = 8 * SLOT_H;  // 608px — total height of each bracket half
const CARD_W   = 184;          // match card width
const FINAL_W  = 204;          // Final match card width (slightly wider)
const GAP_W    = 52;           // SVG connector column width
const LABEL_H  = 28;           // round-label row height

// ─── Brand colours ────────────────────────────────────────────────────────────
const LINE_IDLE = '#C9C5B8';
const LINE_GLOW = '#C8FF4D'; // winner's path — still alive in the tournament

// ─── Glow logic ───────────────────────────────────────────────────────────────
// An arm from `src` glows only if src produced a winner AND that winner hasn't
// been eliminated in the subsequent `dest` match.
function armGlows(src, dest) {
  if (!src?.winner) return false;
  if (!dest?.winner) return true;               // advanced, dest not yet decided
  return dest.winner.id === src.winner.id;      // won dest too — still live
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function KnockoutBracket({ rounds, onPickWinner }) {
  if (!rounds.R32?.length) return null;

  const final = rounds.F?.[0] ?? null;

  // Left half: R32[0-7] → R16[0-3] → QF[0-1] → SF[0]
  const left = [
    { key: 'R32', label: 'Round of 32',    matches: rounds.R32.slice(0, 8) },
    { key: 'R16', label: 'Round of 16',    matches: rounds.R16.slice(0, 4) },
    { key: 'QF',  label: 'Quarterfinals',  matches: rounds.QF.slice(0, 2)  },
    { key: 'SF',  label: 'Semifinals',     matches: rounds.SF.slice(0, 1)  },
  ];

  // Right half — order: SF near center, R32 on far right
  // Connectors fan outward: each col feeds the col to its LEFT
  const right = [
    { key: 'SF',  label: 'Semifinals',     matches: rounds.SF.slice(1, 2)  },
    { key: 'QF',  label: 'Quarterfinals',  matches: rounds.QF.slice(2, 4)  },
    { key: 'R16', label: 'Round of 16',    matches: rounds.R16.slice(4, 8)  },
    { key: 'R32', label: 'Round of 32',    matches: rounds.R32.slice(8, 16) },
  ];

  return (
    <section className="bg-cream rounded-lg border border-slate-line p-4 md:p-6">
      <div className="flex items-baseline justify-between mb-1">
        <h2 className="font-display font-bold text-lg text-ink tracking-tight">
          Knockout Bracket
        </h2>
        <span className="text-[11px] text-slate-muted font-medium">
          Click a team to advance them
        </span>
      </div>
      <p className="text-[11.5px] text-slate-muted mb-5 max-w-2xl">
        Generated live from current group standings. Round of 32 pairings update automatically
        as you edit results above; advance winners manually round by round to play out the rest
        of the bracket.
      </p>

      <div className="overflow-x-auto pb-3">
        <div className="flex items-start" style={{ height: LABEL_H + HALF_H }}>

          {/* ── LEFT HALF: fan left→right, each column feeds the one to its right ── */}
          {left.map((col, ci) => (
            <div key={`L-${col.key}`} className="flex items-start flex-shrink-0 h-full">
              {ci > 0 && (
                <ConnectorGap style={{ marginTop: LABEL_H }}>
                  <BracketConnectors
                    roundA={left[ci - 1].matches}
                    roundB={col.matches}
                    direction="right"
                  />
                </ConnectorGap>
              )}
              <RoundColumn label={col.label} matches={col.matches} onPickWinner={onPickWinner} />
            </div>
          ))}

          {/* ── SF_left → Final connector (simple horizontal, direction right) ── */}
          <ConnectorGap style={{ marginTop: LABEL_H }}>
            <SimpleConnector src={rounds.SF[0]} dest={final} direction="right" />
          </ConnectorGap>

          {/* ── FINAL in center ── */}
          <div className="flex flex-col flex-shrink-0 h-full" style={{ width: FINAL_W }}>
            <div
              className="text-center text-[10px] font-bold text-pitch tracking-widest font-display uppercase"
              style={{ height: LABEL_H, lineHeight: `${LABEL_H}px` }}
            >
              Final
            </div>
            <div className="flex flex-col justify-around" style={{ height: HALF_H }}>
              {final && (
                <div className="flex justify-center">
                  <MatchCard match={final} width={FINAL_W - 8} onPickWinner={onPickWinner} />
                </div>
              )}
            </div>
          </div>

          {/* ── Final → SF_right connector (simple horizontal, direction left) ── */}
          <ConnectorGap style={{ marginTop: LABEL_H }}>
            <SimpleConnector src={rounds.SF[1]} dest={final} direction="left" />
          </ConnectorGap>

          {/* ── RIGHT HALF: SF near center, R32 on far right ──
               Each column's matches feed the column to its LEFT.
               Connector SVG between col[i] and col[i+1]: roundA = col[i+1] (outer/right),
               roundB = col[i] (inner/left), direction = "left". ── */}
          {right.map((col, ci) => (
            <div key={`R-${col.key}-${ci}`} className="flex items-start flex-shrink-0 h-full">
              <RoundColumn label={col.label} matches={col.matches} onPickWinner={onPickWinner} />
              {ci < right.length - 1 && (
                <ConnectorGap style={{ marginTop: LABEL_H }}>
                  <BracketConnectors
                    roundA={right[ci + 1].matches}
                    roundB={col.matches}
                    direction="left"
                  />
                </ConnectorGap>
              )}
            </div>
          ))}

        </div>
      </div>
    </section>
  );
}

// ─── Round column ─────────────────────────────────────────────────────────────

function RoundColumn({ label, matches, onPickWinner }) {
  return (
    <div className="flex flex-col flex-shrink-0 h-full" style={{ width: CARD_W }}>
      <div
        className="text-center text-[10px] font-bold text-pitch tracking-widest font-display uppercase"
        style={{ height: LABEL_H, lineHeight: `${LABEL_H}px` }}
      >
        {label}
      </div>
      <div className="flex flex-col justify-around" style={{ height: HALF_H }}>
        {matches.map((match) => (
          <div key={match.id} className="flex justify-center">
            <MatchCard match={match} width={CARD_W - 8} onPickWinner={onPickWinner} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Connector gap wrapper ────────────────────────────────────────────────────

function ConnectorGap({ children, style }) {
  return (
    <div className="flex-shrink-0" style={{ width: GAP_W, ...style }}>
      {children}
    </div>
  );
}

// ─── Simple 1-to-1 horizontal connector (SF ↔ Final) ─────────────────────────

function SimpleConnector({ src, dest, direction }) {
  const y = HALF_H / 2;
  const glow = armGlows(src, dest);
  const x1 = direction === 'right' ? 0 : GAP_W;
  const x2 = direction === 'right' ? GAP_W : 0;
  return (
    <svg width={GAP_W} height={HALF_H} className="overflow-visible">
      <GlowDefs />
      <ConnLine x1={x1} y1={y} x2={x2} y2={y} active={glow} />
    </svg>
  );
}

// ─── Branching connector (pairs of matches from roundA → single match in roundB) ──

function BracketConnectors({ roundA, roundB, direction }) {
  // direction="right": roundA is LEFT (arms at x=0), roundB is RIGHT (out arm at x=GAP_W)
  // direction="left":  roundA is RIGHT (arms at x=GAP_W), roundB is LEFT (out arm at x=0)
  const countA = roundA.length;
  const countB = roundB.length;
  const armX   = direction === 'right' ? 0     : GAP_W;
  const outX   = direction === 'right' ? GAP_W : 0;
  const midX   = GAP_W / 2;

  const segments = [];
  for (let j = 0; j < countB; j++) {
    const iA = 2 * j;
    const iB = 2 * j + 1;
    const yA   = (iA + 0.5) * (HALF_H / countA);
    const yB   = (iB + 0.5) * (HALF_H / countA);
    const midY = (yA + yB) / 2;
    const glowA = armGlows(roundA[iA], roundB[j]);
    const glowB = armGlows(roundA[iB], roundB[j]);
    segments.push({ yA, yB, midY, glowA, glowB });
  }

  return (
    <svg width={GAP_W} height={HALF_H} className="overflow-visible">
      <GlowDefs />
      {segments.map(({ yA, yB, midY, glowA, glowB }, i) => (
        <g key={i}>
          {/* Arm from match iA (top) */}
          <ConnLine x1={armX} y1={yA} x2={midX} y2={yA} active={glowA} />
          {/* Arm from match iB (bottom) */}
          <ConnLine x1={armX} y1={yB} x2={midX} y2={yB} active={glowB} />
          {/* Upper half of vertical: yA → midY — only glows if top arm active */}
          <ConnLine x1={midX} y1={yA} x2={midX} y2={midY} active={glowA} />
          {/* Lower half of vertical: midY → yB — only glows if bottom arm active */}
          <ConnLine x1={midX} y1={midY} x2={midX} y2={yB} active={glowB} />
          {/* Out arm to next round — glows if either team is still advancing */}
          <ConnLine x1={midX} y1={midY} x2={outX} y2={midY} active={glowA || glowB} />
        </g>
      ))}
    </svg>
  );
}

// ─── SVG primitives ───────────────────────────────────────────────────────────

function GlowDefs() {
  return (
    <defs>
      <filter id="gf" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
    </defs>
  );
}

function ConnLine({ x1, y1, x2, y2, active }) {
  return (
    <line
      x1={x1} y1={y1} x2={x2} y2={y2}
      stroke={active ? LINE_GLOW : LINE_IDLE}
      strokeWidth={active ? 2.2 : 1.5}
      strokeLinecap="round"
      filter={active ? 'url(#gf)' : undefined}
      className={active ? 'bracket-glow' : undefined}
      style={{ transition: 'stroke 0.35s ease, stroke-width 0.35s ease' }}
    />
  );
}

// ─── Match card ───────────────────────────────────────────────────────────────

function MatchCard({ match, width, onPickWinner }) {
  const canPick = !!(match.homeTeam && match.awayTeam);
  return (
    <div
      className="bg-cream border border-slate-line rounded-md overflow-hidden shadow-sm"
      style={{ width }}
    >
      <div className="border-b border-slate-line/70">
        <TeamSlot
          team={match.homeTeam}
          slot={match.homeSlot}
          isWinner={!!match.winner && match.winner.id === match.homeTeam?.id}
          clickable={canPick}
          onClick={() => onPickWinner(match.id, match.homeTeam)}
        />
      </div>
      <TeamSlot
        team={match.awayTeam}
        slot={match.awaySlot}
        isWinner={!!match.winner && match.winner.id === match.awayTeam?.id}
        clickable={canPick}
        onClick={() => onPickWinner(match.id, match.awayTeam)}
      />
    </div>
  );
}

// ─── Team slot ────────────────────────────────────────────────────────────────

function TeamSlot({ team, slot, isWinner, clickable, onClick }) {
  if (!team) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] text-slate-muted/50 italic">
        <span className="w-5 h-3.5 bg-slate-line/40 rounded-sm flex-shrink-0" />
        {slot ? `TBD (${slot})` : 'TBD'}
      </div>
    );
  }
  return (
    <button
      onClick={clickable ? onClick : undefined}
      disabled={!clickable}
      className={`w-full flex items-center gap-1.5 px-2.5 py-1.5 text-left transition-colors ${
        clickable ? 'hover:bg-whistle/20 cursor-pointer' : 'cursor-default'
      } ${isWinner ? 'bg-whistle/30' : ''}`}
    >
      <Flag code={team.flag} name={team.name} className="w-5 h-3.5 flex-shrink-0" />
      <span className={`text-[12px] leading-none truncate ${
        isWinner ? 'font-bold text-ink' : 'font-medium text-ink/80'
      }`}>
        {team.name}
      </span>
    </button>
  );
}

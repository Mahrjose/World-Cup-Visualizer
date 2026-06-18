import Flag from './Flag';

export default function ThirdPlaceMatrix({ thirdPlaceRanking }) {
  return (
    <section className="bg-cream rounded-lg border border-slate-line p-4 md:p-5">
      <div className="flex items-baseline justify-between mb-1">
        <h2 className="font-display font-bold text-lg text-ink tracking-tight">
          Third-Place Qualification Line
        </h2>
        <span className="text-[11px] text-slate-muted font-medium">
          Top 8 of 12 advance to the Round of 32
        </span>
      </div>
      <p className="text-[11.5px] text-slate-muted mb-4 max-w-2xl">
        Every group's third-placed team is ranked here on points, then goal difference, then
        goals scored. The dashed line marks the cut — teams above it join the knockout bracket,
        teams below go home.
      </p>

      <div className="flex flex-col">
        {thirdPlaceRanking.map((team, i) => {
          const isCutLine = i === 8; // render the dashed line right before the 9th row
          return (
            <div key={team.id}>
              {isCutLine && (
                <div className="relative flex items-center my-1.5" aria-hidden="true">
                  <div className="flex-1 border-t-2 border-dashed border-pitch/40" />
                  <span className="px-2 text-[10px] font-bold text-pitch tracking-wider font-display">
                    CUT LINE
                  </span>
                  <div className="flex-1 border-t-2 border-dashed border-pitch/40" />
                </div>
              )}
              <div
                className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                  team.qualifies ? 'bg-whistle/15' : 'bg-black/[0.02] opacity-60'
                }`}
              >
                <span className="font-display font-bold text-base w-5 text-center text-ink tabular-nums">
                  {team.overallRank}
                </span>
                <span className="text-[10px] font-bold text-slate-muted w-5 text-center">
                  {team.group}
                </span>
                <Flag code={team.flag} name={team.name} className="w-6 h-4 flex-shrink-0" />
                <span className="text-[13px] font-medium text-ink flex-1 truncate">
                  {team.name}
                </span>
                <div className="hidden sm:flex items-center gap-4 text-[11px] font-mono text-slate-muted tabular-nums">
                  <span title="Matches played" className="w-8 text-center">{team.mp} MP</span>
                  <span title="Goal difference" className="w-12 text-center">
                    GD {team.gd > 0 ? '+' : ''}{team.gd}
                  </span>
                  <span title="Goals for" className="w-8 text-center">GF {team.gf}</span>
                </div>
                <div className="flex items-baseline gap-0.5 w-14 justify-end">
                  <span className="font-mono font-bold text-sm text-ink tabular-nums leading-none">
                    {team.pts}
                  </span>
                  <span className="text-[10px] text-slate-muted font-medium leading-none">pts</span>
                </div>
                {team.qualifies ? (
                  <span className="text-[10px] font-bold text-pitch bg-whistle px-2 py-0.5 rounded-full whitespace-nowrap w-16 text-center">
                    THROUGH
                  </span>
                ) : (
                  <span className="text-[10px] font-medium text-slate-muted px-2 py-0.5 whitespace-nowrap w-16 text-center">
                    eliminated
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

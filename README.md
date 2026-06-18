# FIFA World Cup 2026 Tournament Visualizer — Frontend

Interactive sandbox for the 48-team, 12-group 2026 World Cup format: editable group
standings, a live third-place qualification ranking, and a knockout bracket that
regenerates from current standings. This package is the **frontend only** — no
backend, no persistence, no live data sync. Everything lives in React state and
resets on page reload.

## Quick start

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173`. Also available:

```bash
npm run build      # production build to dist/
npm run preview    # serve the production build locally
```

Requires Node 18+.

## What's actually implemented

- **Group standings (12 cards, Groups A–L).** Real teams from the official
  December 5, 2025 draw, seeded with all stats at zero — this is a sandbox, not a
  live tracker, so you start from scratch and simulate results.
- **Drag-and-drop reordering.** Grab the handle on any row to manually override a
  group's order. A small dot next to the team name marks rows that have been
  manually overridden; "Reset order" clears it back to computed standings.
- **Inline stat editing.** Click directly into W / D / L / GF / GA cells. Pts and
  GD recalculate automatically; editing W/D/L also keeps MP in sync.
- **Third-place qualification matrix.** Ranks all 12 third-placed teams by the
  standard tiebreak order (points → goal difference → goals for → alphabetical),
  with a dashed cut line after the 8th team — exactly mirroring the real 2026
  format where 8 of 12 thirds advance.
- **Knockout bracket (R32 → Final).** Generated live from current standings.
  Click a team in any match to advance them; downstream rounds rebuild
  automatically. If you change a group's standings after picking winners deeper in
  the bracket, those picks are cleared since the underlying matchup changed.
- **Load JSON.** Header button to load a different `groups` JSON payload at
  runtime (shape documented below). Useful once you've built a backend or fetch
  script that produces live data.
- **Undo / Reset.** Single-step undo for stat edits and reorders; full reset
  reloads the original starting data and clears the bracket.

## Known simplification (read this before treating the bracket as authoritative)

FIFA's actual Round of 32 third-place pairing rule uses a 495-row lookup table
(Annex C in the competition regulations) keyed on *which 8 of the 12 groups*
produce qualifying third-place teams — this is what keeps two teams who already
played each other in the group stage from immediately meeting again in the
bracket. Encoding that table is out of scope for a sandbox tool.

This app uses a deliberately simpler rule instead: the 8 qualifying third-place
teams fill the bracket's "vs 3rd" slots in **overall ranking order** (best
qualifying third in the first such slot, and so on). This guarantees every slot
is always filled correctly for any combination of qualifiers — verified against
all 495 real-world combinations plus 50 randomized stress runs, zero duplicate or
missing assignments — but it does **not** replicate FIFA's anti-repeat-matchup
protection. Treat the R32 pairings as structurally correct (right number of
teams, no duplicates, real qualification logic) but not officially binding.

This is flagged in the footer of the running app too, so end users see it.

## Data model

`src/data/starting_data.json` — the seed data, shape:

```json
{
  "meta": { "tournament": "...", "hosts": [...], "generatedAt": "...", "note": "..." },
  "groups": {
    "A": [
      {
        "id": "MEX", "name": "Mexico", "flag": "mx",
        "confederation": "CONCACAF", "pot": 1,
        "mp": 0, "w": 0, "d": 0, "l": 0, "gf": 0, "ga": 0, "pts": 0
      },
      ...3 more teams
    ],
    "B": [...],
    ... through "L"
  }
}
```

Notes for whoever builds the backend / live-sync piece:
- `flag` is a lowercase ISO 3166-1 alpha-2 code (or `gb-eng` / `gb-sct` for the
  home nations) matching [flagcdn.com](https://flagcdn.com)'s naming — the `Flag`
  component fetches `https://flagcdn.com/{code}.svg` directly and falls back to a
  text badge if that fails (e.g. offline, or the domain's blocked).
- `gd` is **not** stored — it's derived client-side from `gf - ga` everywhere, so
  a backend feed never needs to compute or send it. Same for `pts` (from `w`/`d`),
  though the JSON above includes a `pts: 0` field for convenience; it's overwritten
  on load.
- The "Load JSON" button in the header accepts any file matching the `{ groups: {...} }`
  shape above and swaps it in at runtime — this is the integration point for a
  fetch script or backend endpoint. It does basic validation (checks for a `groups`
  key) and shows an error banner on parse failure, but doesn't deeply validate
  team shape — garbage in the JSON will likely produce a broken-looking but
  non-crashing UI (good enough for a sandbox, worth hardening before production use).

## Architecture

```
src/
  lib/tournament.js          Pure functions: sorting, tiebreaks, third-place
                              ranking, R32 bracket generation, next-round pairing.
                              No React, no side effects — easy to unit test or
                              reuse in a backend if you want server-side validation.
  hooks/useTournamentState.js   Owns groups + manual-order overrides + undo stack.
                                 Exposes computed standings via useMemo.
  hooks/useBracketProgression.js  Owns winner picks per match id, regenerates
                                    R16→Final from R32 + picks, clears stale picks
                                    when the underlying R32 matchup changes.
  components/
    GroupCard.jsx             One group's table: drag-and-drop (@dnd-kit) +
                               inline stat inputs.
    ThirdPlaceMatrix.jsx      Ranked list of 12 thirds with the cut-line.
    KnockoutBracket.jsx       Horizontal bracket tree, R32 through Final.
    Flag.jsx                  flagcdn.com SVG with text fallback.
  data/starting_data.json     Seed data (see above).
  App.jsx                     Layout, header actions (load/reset/undo), wiring.
```

State is intentionally all client-side (`useState`/`useMemo`, no external store) —
straightforward to lift into whatever data layer you're adding. The two hooks are
the seams: swap `useTournamentState`'s internals for a backend-backed version
(e.g. polling an endpoint, websocket updates) without touching any component.

## Design system

Tokens live in `tailwind.config.js`: pitch green (`pitch`, `#0B3D2E`) as the base,
a lime "whistle" accent (`#C8FF4D`) for live/qualifying states, warm cream
surfaces (`#F7F5EF`), ink text (`#13201C`), muted slate for secondary text/borders.
Display type is a condensed grotesk (Archivo Narrow) for headers and rank numbers;
body/data uses Inter; stat values use IBM Plex Mono for tabular alignment. Fonts
load from Google Fonts via `@import` in `src/index.css` — swap for self-hosted
fonts if you need to drop the external dependency.

## Dependencies

- `lucide-react` — icons
- `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` — drag-and-drop
- Tailwind CSS v3 — styling
- Vite + React — build tooling

No state management library, no router (single page by design per the original
brief), no backend client of any kind — that's the part you're building next.

## Things worth doing before this goes further

- The "Load JSON" validation is shallow (checks for a `groups` key only). Decide
  how strict you want this once real data is coming from somewhere.
- No automated test suite is wired up (Vitest isn't installed). The tournament
  logic in `lib/tournament.js` was manually stress-tested during development
  (all 495 real third-place qualification combinations, 50 randomized full-season
  simulations, a complete R32→Final progression) but there's no `npm test` script.
- Mobile layout has not been visually verified in a real browser in this
  environment (no headless browser available here) — the Tailwind classes are
  responsive-minded (`sm:`/`lg:`/`xl:` breakpoints throughout) but give it a real
  look on a phone-sized viewport before calling it done.
- `localStorage`/`sessionStorage` are deliberately not used anywhere — if you want
  the sandbox state to survive a refresh, that's backend/persistence territory.

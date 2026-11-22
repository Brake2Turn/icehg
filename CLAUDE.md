# ICEHG — I Could Eat a Horse Games

Hunger Games–style battle simulator, installable web app (PWA). Full spec: `docs/ICEHG_SPEC.md`. Judgement calls not in the spec: `docs/DECISIONS.md` (add to it whenever you make one).

## Current phase
**Phase 1 — Engine + event database + text-only game: built, awaiting the owner's "next phase".** Build one phase at a time (§13 of the spec); at the end of each phase run the tests, stop, and report (what was built, how to try it on a phone, decisions made).

## Stack
React + TypeScript (strict) + Vite, React Router, Tailwind CSS v4, Zustand, Dexie (IndexedDB), zod (tests only), vite-plugin-pwa, Vitest. Hosting: Vercel (auto-deploys from GitHub). Phase 3 adds PixiJS; Phase 4 adds Supabase.

## Folder layout
```
/engine            pure TypeScript simulation (see purity rule)
  /core            types, rng, clock, world (state + patch-recording mutations), stateAt, simulate, text
  /systems         needs, movement, solo, encounters (+Bloodbath), groups, betrayal, fight, gamemakers, affinity, resolve
  /analysis        stats used by sim:stats and the in-app Sim stats screen
  /tests           Vitest: determinism, victors, invariants, stateAt, fights, events, content rules, purity
  tuning.ts        EVERY chance/number lives here
/events            the event database — JSON files + schema.ts (zod) + types.ts + validate.ts
/scripts           sim-stats.ts (npm run sim:stats)
/src
  /app             Home, Settings, router
  /features/setup  mode select, create screen, startGame
  /features/feed   game screen, feed, name chips, Fallen + Victor overlays, roster
  /features/lab    Event Lab, Sim stats (dev tools: tap the version number 7× in Settings)
  /data            Dexie schema + GameRepository / PoolRepository
  /store           Zustand stores (settings, draft board)
  /theme           Tailwind theme + global CSS
/docs              spec + decisions
```

## Engine purity rule (§4.1) — enforced by `engine/tests/purity.test.ts`
`/engine` is pure TypeScript: no React, PixiJS, browser APIs or Supabase; **no `Math.random()` / `Date.now()`** (all randomness comes from the seeded `Rng` passed in); no I/O; the only dependency allowed is `zod` (engine code imports event *types* from `events/types.ts`). The whole game is rolled at Start into an event log; the clock only changes what you *see*, never what happens. Every on-screen state change goes through a `World` mutation helper that records a `Patch`, so `stateAt(log, t)` rebuilds the same view (tested at every midnight).

## Content rules (§6.13) — non-negotiable, scanned by `engine/tests/events.test.ts`
- Allowed: violence, cruelty, gore; dark tone with dry, deadpan humour.
- Suicide: rare only, always one plain sentence ("{A} takes {A.their} own life in the {zone}."). No method, no detail, never a joke.
- Never: sexual content, rape/sexual violence, romance of any kind (no crushes, kissing, couples, flirting — positive affinity is friendship/loyalty only), slurs or jokes about real-world identity. The contestants are real people.
- All event text must be original — nothing copied from other simulators, the books or the films.

## Writing events
Templates live in `/events/*.json` (see §6.12 and `events/schema.ts`). Tokens: `{A}` names; `{A.they}/{A.them}/{A.their}/{A.theirs}/{A.themself}` (+ capitalised); verbs `{A.is} {A.was} {A.has} {A.does} {A.s} {A.es} {A.ies}`; units `{G} {G.count} {G.first}`; `{R}` = group G minus A/B/C; `{zone} {item} {weapon}`; fight lines `{K} {V} {W} {L}` (openers use `{G}`/`{H}`). Verbs after a name agree with the head-count ("Sam runs", "Sam and Jo run"); after a pronoun they follow the pronoun ("they run"). Avoid contractions after pronoun tokens (`{A.they}'ve`). Lethal templates need ≥2 outcomes including a non-lethal one. Use the Event Lab to preview.

## Commands
```bash
npm install          # once
npm run dev          # local dev server (add -- --host to open on a phone on the same Wi-Fi)
npm test             # all tests (must pass every phase)
npm run sim:stats    # 1,000 games of 24 → compare with the §6.14 targets (npm run sim:stats -- 200 for a quicker run)
npm run build        # typecheck + production build into dist/
npm run preview      # serve the production build locally
npm run build:artifact  # one self-contained HTML file (artifact/icehg.html) for the claude.ai link
```

## Deploy
**For now the owner runs it locally** (`npm run dev`, phone on the same Wi-Fi); no hosting yet. Keep everything host-agnostic so hosting and online play (Phase 4) can be added later.
When hosting is added: push to GitHub → Vercel builds (`npm run build`, output `dist/`, SPA rewrites in `vercel.json`) and the site updates within a minute or two. Production deploys come from `main`; other branches get preview URLs. Tell the owner before anything costs money or needs a new account.

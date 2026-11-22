# ICEHG — I Could Eat a Horse Games

A Hunger Games–style battle simulator for me and my friends. Fill a board with names, press Start, and watch them fight it out: teaming up, betraying each other, starving, getting set on fire by the Gamemakers. Every game is rolled with dice, so some end in three days and some drag on for twelve. Last one alive wins.

It's a web app that runs in any phone browser. No app store.

## Features (Phase 1)
- **Classic** (12 districts × 2 tributes) or **Custom** (2–48 contestants)
- A simulation engine where relationships, traits, hunger, thirst, wounds and time of day tilt the odds, but never decide the outcome
- 160+ original events, from common to legendary, plus a fight system where bigger sides usually (not always) win
- A live feed with names colour-coded by what happened to them, a day/night clock you can pause, speed up or skip, the Fallen screen at midnight and a Victor screen with awards
- Games save automatically and resume where you left off

Coming next: photos and a saved contestant pool, relationship editing, an animated arena map, and watching games live with friends. See the [roadmap](docs/ICEHG_SPEC.md#13-build-phases).

## Run it
You need [Node.js](https://nodejs.org) (the LTS version).

```bash
npm install      # once
npm run dev      # start; open the "Network" address on a phone on the same Wi-Fi
```

## Develop
```bash
npm test             # run all tests
npm run sim:stats    # simulate 1,000 games and print the balance report
npm run build        # production build into dist/
```

- `engine/` — the simulation (pure TypeScript, seeded dice, fully tested)
- `events/` — the event database as JSON; add events here and preview them in the Event Lab (Settings → tap the version number 7 times)
- `src/` — the React app

Built with React, TypeScript, Vite, Tailwind CSS, Zustand and Dexie.

## Docs
- [Full build spec](docs/ICEHG_SPEC.md)
- [Decisions log](docs/DECISIONS.md)
- [Notes for Claude Code](CLAUDE.md)

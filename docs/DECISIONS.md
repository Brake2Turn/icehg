# Decisions log

Judgement calls that aren't spelled out in `docs/ICEHG_SPEC.md`, per §0.7 (pick the simplest option that keeps later phases possible, log it, keep going).

## Phase 1

### Repo and tooling
- **The spec was in `README.md`, not `ICEHG_SPEC.md`.** I copied it verbatim to `docs/ICEHG_SPEC.md` and left `README.md` untouched.
- **Latest stable versions** at the time of writing (installed with `@latest`): React 19, Vite 8, TypeScript 7, Tailwind 4, Vitest 5, zod 4, Dexie 4, Zustand 5, React Router 8, vite-plugin-pwa 2.
- **zod isn't shipped to phones.** The app imports the event JSON directly (typed via `events/types.ts`); strict zod validation (`events/validate.ts`) runs in the tests and `sim:stats`. This keeps the bundle ~160 KB gzipped.
- **`npm audit` shows moderate advisories** in `vite-plugin-pwa`'s build-time dependencies (glob/minimatch). They only run on the build machine, not in the app. The suggested "fix" downgrades the plugin, so I left it.
- **Settings use localStorage** (via Zustand `persist`); games use IndexedDB (Dexie) as the spec requires. The settings are tiny per-device preferences.

### Event schema extensions (§6.12)
All additive, so the spec's examples are valid as written:
- `trigger` on a template: `woundWorsen`, `succumb`, `dehydration`, `starvation`, `hazard`, `closure`, `feastAnnounce`, `feastDrop`, `gong`. Like `betrayal: true`, triggered templates are only chosen by that system.
- Extra requirements: `lacksItem`, `unarmed`, `solo` (not in a group), `asleep`, `awake`. Extra `when.zones` (specific zones).
- Extra weight mods: `day` (×(1 + per·(day−1))) and `hasTag`.
- `alive` mod: ×(1 + per·(1 − alive/start)).
- `groupSize` mod: ×(1 + per·(size − 1)).
- Extra items: `matches`, `map` (alongside food, water, medkit, rope, trap, sleepingBag).
- Fight lines gain a `stalemate` kind (the fight system needs text for draws). Openers use `{G}` (attackers) and `{H}` (defenders), since the winner isn't known when a fight opens.
- Extra tokens: `{R}` (the rest of group G, excluding A/B/C, e.g. "{R} slip away while {A} sleeps"), `{X.es}` / `{X.ies}` verb endings, `{G.Count}`.
- A `note` field for humans (ignored by the engine).
- Hazard-style templates with an empty `perVictim` are used for announcements (gong, feast).

### Reading templates
- **Verb agreement:** after a name, verbs agree with the head-count ("Sam runs", "Sam and Jo run", even when Sam uses they); after a subject pronoun they follow the pronoun ("they run", "she runs"). The renderer tracks which came last for each role.
- **Requirements on a unit (G/H):** tags, health, items and weapons pass if *any* member qualifies; needs use the unit's average; `asleep`/`awake`/`unarmed` need *every* member.
- **`requires.tags … has: ["vengeful"]`** means vengeful toward someone else in the event (or toward anyone, in a solo event). Revenge templates therefore only fire when the avenger meets the actual killer.
- **`when.zoneTags`** passes if the zone has *any* of the listed tags.
- **Tone multiplier:** actor = A (else G), target = B (else H). For group events with only A and G (e.g. ditching), the group (minus A) is the actor and A the target. Cooperative tone uses the average affinity across all ordered pairs of participants.
- **Template weight** = rarity weight × the *average* binding multiplier (tone × mods) over all valid role bindings, so templates with more ways to bind aren't favoured. The binding is then picked in proportion to its own multiplier, then the outcome by rarity × outcome mods.

### Simulation
- **Pace is part of the setup** because the quiet window after midnight (§6.3) depends on it. Determinism = same setup (including pace) + seed. The quiet window is rounded up to whole ticks for the engine (Quick: 4 ticks, Standard: 2, Slow/Real time: 1); the Fallen screen uses the exact length.
- **Travelling contestants can't have events.** A journey sets their zone to the destination when they leave (so the map can walk them there in Phase 3); they're off-limits until they arrive.
- **The Bloodbath** gives each contestant exactly one moment over 10:00–10:30 (two ticks), drawn from Bloodbath templates. Lethal Bloodbath templates get a weight multiplier (`BLOODBATH_LETHAL_MULT`) to hit the ~30% target. Nobody is forced out of the Cornucopia afterwards; the normal movement rules empty it quickly.
- **Gamemaker temperament:** each game rolls one lognormal "mood" multiplier (`GM_MOOD_SD`) that scales hazard and arena-shrink odds. It's dice, like everything else, and it never looks at game length or picks a winner; it's what gives games their real spread (some arenas are crueller than others).
- **Hunters:** ruthless, strong, healthy units (`(ruthlessness+strength)/20` above a threshold) are drawn toward zones with people, a little more as the field shrinks. Timid survivors still hide, so endgames vary.
- **Needs:** people drink silently in water zones, graze in food zones, eat/drink carried items, and sleep at night. Extreme thirst/hunger triggers visible dehydration/starvation events.
- **Wounds:** `wounded` can worsen (infection or a reopened wound) to `critical`; `critical` gets a "succumb" event chance each tick (lethal or not). Sleep slowly heals (faster with a sleeping bag).
- **The feast** is announced at dawn (from Day 3) and held at 08:00 the *next* morning. For two hours, encounters at the Cornucopia use feast templates and are more likely.
- **Arena shrink:** from Day 6 (tuned from 5) each dawn may close one outer zone; at least one outer zone stays open until the Day 30 backstop. A last-resort "sudden death" from Day 40 keeps the engine from ever looping forever (never reached in 1,000-game runs).
- **Never-wipe** also guards `kill` effects and fights (the last fighter to fall is spared, wounded). In fights, two fighters never kill each other; winners who die are listed before losers, and winners loot better weapons and packs from those they kill.
- **The game stops the moment one tribute is left**, mid-tick if necessary.
- **Grief:** witnesses who liked the victim (≥40) grieve immediately; everyone else who liked them finds out at midnight.
- **Name colours:** green = healed, gained an item or a better weapon, or joined/formed a group.
- **`stateAt` vs the engine:** the shared "view state" covers everything the screen shows (alive, health, weapon, items, zone, group, kills, cause of death, tags, groups, affinity, closed zones, feast, Victor). Hunger/thirst/fatigue and sleep are engine-internal and not compared.
- **Suicide** (`solo.last_light`) is very rare, needs Day 2+, and is more likely for abandoned/grieving/betrayed contestants. Its other outcome is the person choosing to keep going.

### App (Phase 1)
- **New games start playing immediately; saved games resume paused** (§9). The clock autosaves every 2 seconds while running and when the app is hidden.
- **The Fallen screen** stays up for at least ~4.5 real seconds even at 10x, holding the display clock at the end of the quiet window; tapping closes it.
- **"Fill empty slots with sample names"** on the create screen, so you can test a 24-slot board without typing (the real pool comes in Phase 2).
- **Small extras beyond the Phase 1 list:** feed filters (All / Deaths / Groups & betrayals / tap a name to follow one person) and a simple Tributes list (status, kills, weapon, items, group, traits) as a stand-in until the Phase 3 contestant card.
- **Awards on the Victor screen:** "Most loyal friendship" needs ≥40 both ways and "Most hated" needs a negative average; otherwise they're skipped.
- **"Play again with the same cast"** reuses names, pronouns and districts with a new seed.

### Hosting (owner's choice, after Phase 1)
- **No hosting for now: the owner runs the app locally** and opens it on their phone over the same Wi-Fi. Over plain `http://` on a local network the game, feed and saved games all work, but "Add to Home Screen" won't give a proper installed app and offline mode is off (both need https). Nothing in the code depends on Vercel: `vercel.json` stays in the repo, unused, so hosting can be switched on later. Multiplayer (Phase 4) stays possible: storage already sits behind `GameRepository`/`PoolRepository` interfaces, and the game is a log replayed by a clock, which is what live spectating needs.

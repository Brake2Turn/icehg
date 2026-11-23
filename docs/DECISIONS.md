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
- **A tappable link without hosting:** `npm run build:artifact` builds the whole app into one self-contained HTML file (`artifact/icehg.html`, not committed), published as a private claude.ai page. That build keeps routes in memory (the page can't change its address), has no service worker, and so doesn't install or work offline. Games saved there stay in that browser only. Browser pop-ups (`confirm()`) are blocked there, so deleting a saved game now uses an in-page "Delete?" tap instead, everywhere.

### Feed and contestants changes (owner's notes before Phase 2)
These override §8.1 and §8.3 of the spec at the owner's request.
- **Names are plain white.** Each event *card* gets a coloured edge for the biggest thing that happened in it: red = death, purple = betrayal, orange = injury, green = something good (alliance formed or joined, new weapon or supplies, recovering). Ordinary events keep the plain edge.
- **Every card that changes something gets a one-line summary** under the text, in the edge colour, e.g. "Mark has died", "Mark and James have an alliance", "Brad has joined Mark and James's alliance", "Mark has left the alliance", "Mark was dropped from the alliance", "Mark and James's alliance has ended", "Brad betrayed James", "Mark now has a knife and a medkit", "Mark is injured / is badly hurt / is recovering / has recovered", "James wants revenge on Brad". They're worked out by comparing the game state before and after the event (`src/features/feed/outcomes.ts`), so they always match what actually happened; nothing changed in the engine or saved games. "Alliance has ended" is left out when everyone in it died.
- **No cannon icons** anywhere (the red edge does that job).
- **No Deaths / Groups & betrayals filter buttons.** Tapping the "16 / 24 contestants ›" counter opens the Contestants screen, grouped into Alliances (each with a colour-blind-safe colour and a letter badge), On their own, and Fallen (with who killed them and the day). Tapping a person there, or a name in the feed, still shows only their events, with a button to show everyone again.
- **Playback controls use solid SVG icons** (play, pause, next event, skip to midnight) in near-black on light buttons, instead of emoji-style characters.

### Second round of owner's notes (before Phase 2)
- **Card colours** (plain edge, no glow), strongest wins: pink = a betrayal that killed · red = death · purple = betrayal, or an alliance ending / someone leaving or being dropped · cyan = someone saved someone · blue = alliance formed or joined · orange = injury · green = new gear or recovering. **Each summary line keeps its own colour**, e.g. "Otto betrayed and killed Ottilie" (pink) · "Otto and Ottilie's alliance has ended" (purple). "Wants revenge" lines are grey.
- **Repetition:** every time a template is used in a game, it becomes less likely for the rest of that game (×0.6 per use, never below ×0.12). The same applies to fight lines, Gamemaker events, and the per-person lines inside one Gamemaker event.
- **Gamemaker events: at most one a day.** Hazards, zone closures and the feast (its announcement day and its feast day) all count. The day-30 backstop and the day-40 safety net are exempt. The per-tick chance grows with the day (`day^1.3`), so in 1,000 games it's ~7% on Day 1, ~30% on Day 2, ~50% on Day 3 and ~75% by Day 6. The per-game Gamemaker mood now mostly changes how *deadly* their events are (crueller Gamemakers kill more), which is what keeps game lengths varied.
- **Arena-wide vs area events:** about a third of hazards hit the whole arena (cold snap, earthquake, screech, bad water, storm); the rest hit one area. The feed card shows the intro and then one line per contestant caught in it (died, hurt, survived, or saved). Arena-wide events cover everyone alive; area events cover everyone in that area. Until the map exists (Phase 3), "area" means the zone. Hazards now happen at the start of a tick so nobody is left out of their own fate line.
- **Saves (cyan):** (1) in a Gamemaker event, someone in the same place may pull a victim out: chance 0.1 × e^(2.2 × affinity/100), so ~10% for a stranger, ~37% at +60, ~70% at +90; (2) in a fight, a teammate who likes someone (≥ +20) may take the killing blow for them; (3) new "save" encounter and alliance events (cutting someone out of a snare, stopping bleeding, feeding the starving, catching someone at a cliff edge, cutting out an infection, a snake in the night) are weighted by how much the saver likes the person. Saves raise the saved person's affinity a lot, and several of them form alliances, which creates more chances for betrayal later. Templates mark saves with `"save": true`; fight lines have a new `save` kind with `{S}` (saver), `{V}` (saved) and `{K}` (attacker); rescue lines inside hazards use `trigger: "hazardRescue"`. New weight mod: `affinity` (×e^(per·aff/100)).
- **New content (no new items):** 7 murders, 5 betrayals, 10 solo downtime moments, 10 alliance moments, 5 arena-wide events, 5 hazard rescues, 9 save events, 6 fight-save lines, plus a fake-helper murder.
- Retuned after all this (1,000 games): median 7 days, 14% ≤4 days, 13% ≥11 days, Bloodbath 29%, betrayals median 2, legendary ~11 per 100 games (slightly above the 5–10 target), ~4–5 saves per game.

### Third round of owner's notes
- **Saves tally:** the Contestants screen shows "N saves" for anyone who has saved someone (counted from what's been shown so far), and the Victor screen has a "Most saves" award.
- **No last alliance standing:** an alliance can never form or grow to include everyone still alive (the outcome is simply not allowed). If deaths leave everyone alive in one alliance anyway, it must end on its next group roll: 55% a forced betrayal (the likeliest traitor turns on the member they like least), otherwise a "last alliance" event where they split up, ditch someone, or back away from each other at weapon-point (`events/lastalliance.json`, `trigger: "lastAlliance"`). Tested: across 90 games of 3, 6 and 24, it never lasts more than 16 ticks (4 hours).
- **Legendary moments** get a gold card: a gold wash, a gold edge (unless an outcome colour applies) and a gold "Legendary moment" label. **Gamemaker events** get black-and-yellow hazard tape along the top and bottom edges only.

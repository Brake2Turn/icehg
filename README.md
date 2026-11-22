# icehg
My own Hunger Games simulator
# ICEHG: I Could Eat a Horse Games
### Build spec for Claude Code · v2.1 · 22 Nov 2026

A Hunger Games–style battle simulator for me and my friends. It's an installable web app: it works on iPhone and Android from a link, and there's no app store.

---

## 0. Read this first (instructions for Claude Code)

1. Read this whole document before writing code.
2. Save it in the repo as `docs/ICEHG_SPEC.md`. Create a short `CLAUDE.md` at the repo root covering: the stack, folder layout, the engine purity rule (§4.1), the content rules (§6.13), how to run, test and deploy, and the current phase.
3. **Build one phase at a time** (§13). At the end of each phase, run the tests, then stop and give me (a) what was built, (b) step-by-step instructions to try it on my phone, and (c) any decisions you made that aren't in this spec. Wait for me to say "next phase".
4. I'm not a full-time developer. Explain any command I need to run, keep setup minimal, and **tell me before anything costs money or needs a new account**.
5. Use the latest stable versions of everything. Don't copy version numbers from anywhere.
6. All event text must be original. Don't copy it from existing simulators or from the books or films.
7. If something here is ambiguous, pick the simplest option that keeps later phases possible, log it in `docs/DECISIONS.md`, and keep going.
8. This app is **not** going on any app store. It's for me and the friends I send the link to.

---

## 1. What we're building

You pick **Classic** (12 districts, 2 tributes each) or **Custom** (any number of contestants, no districts). Fill each empty slot on the create screen with a name and photo, or grab someone from your saved contestant pool, and adjust how people feel about each other. Then press Start and watch them fight it out on an animated arena map. A running feed of events appears, with names colour-coded by what happened to them. A day/night cycle runs throughout, and the Fallen screen appears at midnight. Last one alive wins.

What makes it different from other simulators:
- **Relationships shape the story.** Every contestant has an affinity score for every other contestant. Affinity tilts the odds of who teams up, who betrays whom and who hunts whom, but it never decides the outcome outright.
- **There's no script.** Everything is rolled with dice: affinity, traits and elapsed time shift the odds, and the game runs its course. Some games end in three days and some drag on for twelve.
- **Events come in rarities.** Common things happen all the time. Rare and legendary things are possible but don't happen often.
- **Fights are won on odds, not scripts.** Bigger, better-armed sides usually win, but not always, and people on both sides can live or die.
- **The map follows the story.** Contestant photos move around the arena, and every event plays out on the map as its text appears.
- **You can watch together.** Games can be public or private, friends can spectate live from a link, and they can help build the cast.

---

## 2. Decisions already made

| Area | Decision | Why |
|---|---|---|
| Platform | **Installable web app (PWA)** built with React + TypeScript + Vite | Free and works on iPhone and Android from one link. Friends tap "Add to Home Screen" and it behaves like an app. Updates ship by pushing to GitHub. A native app would need Apple's paid developer program to reach friends' iPhones, because Expo Go on iPhone only opens projects from the account you're signed into |
| Hosting | **Vercel** free tier, auto-deploying from the GitHub repo `icehg` | Push to GitHub and the update is live within a minute or two |
| Arena graphics | **PixiJS** (WebGL 2D) | Smooth animation of dozens of photo sprites, masks, filters and glow on phones |
| Local storage | **IndexedDB via Dexie**: contestant pool (including photos), saved games, settings | Home-screen web apps on iPhone are exempt from Safari's 7-day storage wipe |
| Backend (online, Phase 4+) | **Supabase**: Postgres, anonymous Auth, Realtime, Storage | Live spectating and shared lobbies; free tier |
| Simulation | Pure TypeScript engine, **tick-based**, seeded RNG | Testable; affinity and time can influence every roll |
| Outcome steering | **None.** No pacing director, no target game length, no chosen winner | Games should run their course naturally (§6.1) |
| Event database | JSON files in `/events`, validated with zod and bundled into the app | Easy for me (and you) to add events; tests catch broken ones |
| State | Zustand | Simple |
| Styling | Tailwind CSS | Fast iteration |

### 2.1 Vocabulary
Tributes · Districts · the Cornucopia · the Bloodbath (opening) · the Gamemakers (automatic arena events) · cannon · the Fallen (midnight screen) · the Victor.

---

## 3. Tech stack

- **Core:** React + TypeScript (strict) + Vite, React Router
- **PWA:** `vite-plugin-pwa`. The manifest uses name "I Could Eat a Horse Games", short_name "ICEHG", `display: standalone`, portrait orientation and a dark theme colour, plus a service worker for offline play.
- **Graphics:** PixiJS for the arena, and a small tween helper (or GSAP) for movement
- **State and data:** Zustand, Dexie (IndexedDB), zod
- **Styling:** Tailwind CSS
- **Photos:** a single `<input type="file" accept="image/*">` (iPhone and Android both offer *Take Photo* or *Photo Library* from it), a circular crop step (e.g. `react-easy-crop`), and resizing to 256×256 JPEG at ~80% quality on a canvas before saving
- **Sound:** Web Audio or Howler.js for the cannon and UI sounds. iPhone only allows audio to start after a tap, so unlock it on the Start button.
- **Screen:** the Screen Wake Lock API, so the screen stays on while watching (optional setting)
- **Tests:** Vitest. Engine tests run in plain Node.
- **Online (Phase 4+):** `@supabase/supabase-js`, plus the Supabase CLI for migrations

---

## 4. Architecture

### 4.1 Engine purity rule (important)
`/engine` is pure TypeScript:
- no React, PixiJS, browser APIs or Supabase
- no `Math.random()` or `Date.now()`; all randomness comes from the seeded RNG that's passed in
- no I/O
- the only allowed dependency is `zod`

### 4.2 How a game plays out: simulate → log → clock
1. **The engine rolls the game forward one tick at a time** (§6.3), using only the current state plus dice. It never looks ahead, never aims for a length, and never picks a winner.
2. Because that's fast, the whole game is rolled when Start is pressed and stored as an **event log**. Each entry has a `gameMinute` timestamp, participants, zone, text, effects and a visual. Silent `move` entries drive the map.
3. A **clock** reveals the log in real time. Pausing, speeding up or skipping only changes what you *see* when; it never changes what happens. Every game gets a new random seed (stored, so games can be replayed and debugged).

```ts
type GameClock = { anchorWallMs: number; anchorGameMin: number; speed: number; paused: boolean; pace: Pace };
// game minutes per real second at 1x, by pace (§9): quick 7.5 · standard 2 · slow 0.4 · realtime 1/60
function gameNow(c: GameClock, wallNowMs: number): number {
  if (c.paused) return c.anchorGameMin;
  return c.anchorGameMin + ((wallNowMs - c.anchorWallMs) / 1000) * c.speed * GAME_MIN_PER_SEC[c.pace];
}
// To change speed or pause: re-anchor first (anchorGameMin = gameNow(c, now); anchorWallMs = now), then update the fields.
```

4. Everything on screen comes from `stateAt(log, gameNow)`, which folds only the revealed entries. The map may peek at the next few seconds of the log **only** to start walking participants toward an upcoming event, never to reveal text or outcomes early.

### 4.3 Storage
Define a `GameRepository` interface, with `LocalGameRepository` (Dexie) in Phase 1 and `OnlineGameRepository` (Supabase) in Phase 4. The contestant pool lives behind a `PoolRepository` that is local first and gets account sync in Phase 4.

### 4.4 Folder layout
```
/src
  /app            # routes/screens
  /features
    /setup        # mode select, create screen, add-contestant sheet, relationships mode
    /pool         # contestant pool
    /arena        # PixiJS map, markers, visuals, camera
    /feed         # toasts, feed panel, name highlighting, fallen screen, victor screen
    /online       # live list, watch links, lobby (Phase 4+)
  /components
  /data           # repositories, Dexie schema, Supabase client
  /store
  /theme
/engine
  /core           # types, rng, clock, state, stateAt, simulate
  /systems        # needs, movement, encounters, groups, betrayal, gamemakers, affinity
  tuning.ts       # EVERY chance/number lives here
  /tests
/events           # the event database (JSON), split by category
  schema.ts
/scripts
  sim-stats.ts    # npm run sim:stats
/supabase         # Phase 4+
/docs
```

---

## 5. Setup: modes, create screen, contestant pool, relationships

### 5.1 Mode select (first screen of New Game)
- **Classic:** 12 districts × 2 tributes = 24 slots. Districts are labelled with their number and industry: 1 Luxury · 2 Masonry · 3 Technology · 4 Fishing · 5 Power · 6 Transportation · 7 Lumber · 8 Textiles · 9 Grain · 10 Livestock · 11 Agriculture · 12 Mining.
- **Custom:** no districts. The user enters how many contestants (2–48), and the create screen shows that many slots. Slots can still be added or removed on the create screen.
- Pace (§9) is chosen here too, defaulting to Standard.

### 5.2 Create screen (the board)
- A grid of **empty slots**. In Classic, there are 12 district cards with two slots each; in Custom, a plain numbered grid.
- **Tap an empty slot** to open the Add sheet, which has two tabs:
  - **New:** name (required), photo (*Take photo / Choose from library* via one button, then circular crop), pronouns (he / she / they; default they; used in event text), and a toggle **"Save to contestant pool"** (on by default).
  - **From pool:** a searchable grid of saved contestants. Anyone already in this game is greyed out.
- If no photo is added, show an initials avatar (generated locally from the name). Photos can be added any time before Start.
- **Tap a filled slot** to edit it, remove it, or save it to the pool if it isn't saved already. **Long-press and drag** to swap two slots, including across districts.
- **"Fill empty slots from pool"** fills the remaining slots with random pool contestants.
- A mode toggle at the top switches between **Tributes | Relationships** (§5.4).
- **Start** is enabled when every slot is filled.

### 5.3 Contestant pool
- Saved contestants store a name, photo (blob), pronouns and date added.
- Home → **Contestant pool** lets you edit, delete and search them.
- Stored in IndexedDB; synced to the user's account in Phase 4.

### 5.4 Relationships mode (on the create screen)
- **Default starting values:** mild random affinity (see §6.6). Districts are labels only: they give no affinity or stat bonuses.
- **Focus someone:** tap a contestant. Every other slot then shows a coloured ring and a small number for how the focused contestant feels about them (red = hates through grey = neutral to green = loyal).
- **Edit a pair:** with someone focused, tap another contestant to open a sheet with two sliders, **A → B** and **B → A** (−100…+100). A **Link both ways** toggle is on by default. Each slider shows its label: Hates ≤ −60 · Dislikes −59…−20 · Neutral −19…19 · Likes 20…59 · Loyal ≥ 60.
- **Presets:** Best friends (+80/+80) · Allies (+50/+50) · Rivals (−60/−60) · Sworn enemies (−90/−90) · One-sided (+60/−20). No romantic presets.
- Buttons: **Randomise all** · **Reset to neutral**.
- Manual edits always override the defaults.

---

## 6. Simulation engine

### 6.1 Principles
- **Everything is random.** Affinity, traits, needs, time and location only **shift probabilities**.
- **Nothing steers the result.** There's no target game length, no rubber-banding toward a finish, and no picking a winner. Games end when they end.
- **Early contact is high** because everyone starts together at the Cornucopia. Contact then drops as people scatter, and rises again over the days as resources run low and the Gamemakers shrink the arena.
- Every number below is a starting value in `engine/tuning.ts`, to be tuned with `sim:stats` (§6.14).

### 6.2 Contestant state
`alive`, `health: healthy | wounded | critical`, `hunger`, `thirst` and `fatigue` (each 0–100), `weapon: none | knife | spear | bow | axe | sword | mace`, `items` (food, water, medkit, rope, trap, sleeping bag…), `zone` + map position + travel target, `groupId?`, `kills[]`, `killedBy?`, `deathMinute?`.

**Traits** (1–10, rolled randomly per game, visible on the contestant card): `strength`, `stealth`, `cunning`, `survival`, `loyalty`, `ruthlessness`.

**Status tags** with expiry:

| Tag | When it's added | How long it lasts |
|---|---|---|
| `abandoned` | left behind by their group | 24 game hours |
| `betrayed` | survived a betrayal | 48 game hours |
| `grieving` | someone they liked (≥ 40) died | 24 game hours |
| `vengeful:<id>` | witnessed a friend's killer | until one of them dies |
| `hunted` | escaped an attack | 12 game hours |
| `poisoned` | — | short |
| `hiding` | — | short |

Templates can require or exclude tags.

### 6.3 Time
- The game clock runs in **game minutes**. Day 1 starts at **10:00** with the gong and the Bloodbath.
- **Tick = 15 game minutes.**
- Time-of-day bands: Dawn 05:00–07:00 · Day 07:00–18:00 · Dusk 18:00–20:00 · Night 20:00–05:00. Night means more sleeping, less movement, fewer encounters, but sneakier ones (stealth matters more).
- **Midnight (00:00):** the **Fallen screen** shows everyone who died since the previous midnight (on Day 1, since the gong). The engine reserves a short quiet window after 00:00, worth ~8 real seconds at 1x for the chosen pace, in which everyone is asleep and no visible events happen. Needs still tick.
- The day counter increments at 00:00. Labels look like "Day 3 · 21:40".

### 6.4 Arena and movement
- **The Cornucopia** is at the centre (tiny zone, so encounters are near-certain while people are there; tags: supplies, exposed).
- **Eight outer zones** sit in a ring. Each is adjacent to its two neighbours and to the Cornucopia, and each has a size and tags:
  - Forest (shelter, food)
  - River (water, food)
  - Lake (water)
  - Swamp (water, dangerous)
  - Meadow (food, exposed)
  - Cliffs (high ground, dangerous)
  - Caves (shelter, dark)
  - Ruins (shelter)
- **Travel takes time:** 1–2 game hours to reach an adjacent zone, longer via the Cornucopia. Map markers walk there.
- **Each tick, a contestant decides whether to move, based on:**
  - needs: thirst sends them toward water, hunger toward food, fatigue at night toward shelter and sleep
  - safety: they avoid zones with hazards or known enemies
  - groups: members follow the group
  - hunting: high ruthlessness + strength draws them toward zones with other people
  - vengeance: they move toward their target
  - the Gamemakers: hazards push people out of a zone
- Movement is emitted as silent `move` entries so the map can animate it.

### 6.5 What happens each tick
1. **Needs and wounds.** Hunger, thirst and fatigue rise. Wounds may worsen: `wounded` can become infected, and `critical` has a chance each tick to become a lethal solo event ("succumbs to wounds"). Medkits and rest heal.
2. **Movement** (§6.4).
3. **Solo rolls.** Each contestant has a chance `P_SOLO` (lower at night) of a solo event chosen from matching solo templates: foraging, hunting, building shelter, getting lost, eating bad berries, crying alone, finding a weapon, setting a trap, and so on.
4. **Encounter rolls.** In each zone, every pair of **units** (a lone contestant or a group) not already in the same group can meet:
   `p = 1 − exp(−ENCOUNTER_RATE × visibility(time of day, stealth) / zoneSize)`.
   When they meet, pick an encounter template that fits the unit types (solo–solo, solo–group, group–group), weighted as in §6.7. If the result is a fight, the fight system resolves it (§6.10).
5. **Group rolls.** Each group has a chance `P_GROUP` of an internal event: bonding, sharing food, keeping watch, arguing, deciding to ditch someone, or splitting up. Betrayal checks (§6.9) run here.
6. **Gamemaker rolls** (§6.11).
7. **Never-wipe rule.** No single event may kill everyone still alive; if an outcome would, re-roll it, excluding wipe outcomes.
8. **One visible event per contestant per tick.** Events get timestamps spread across the tick.
9. **Victory** when one tribute remains.

### 6.6 Affinity
- A directed integer matrix `aff[A][B]` in **−100…+100**. It's asymmetric, because one-sided feelings create drama.
- **Default start:** each directed pair is drawn from Normal(0, 25) with reciprocity: `aff[B][A] = 0.6·aff[A][B] + 0.4·(new draw)`, clamped. Then the user's manual edits apply. Districts give no bonuses.
- **Systemic changes:**
  - **Witnessing:** when A kills B, every C present (same zone, or in A's group) with `aff[C][B] ≥ 20` gets `aff[C][A] −= 30`. If `aff[C][B] ≥ 60`, C also gets `vengeful:A`.
  - **Help and harm:** template effects (e.g. saving someone: +20…+35 toward the saviour).
  - **Shared hardship:** group members get +3 toward each other per day survived together.
  - **Drift:** every value moves 2% per day back toward its starting value.
  - **Hidden information:** feelings only change for people who would *know*. If A steals from sleeping B and isn't caught, B's affinity doesn't change.
  - **The Fallen screen:** everyone learns who died (like faces in the sky). Contestants who liked the dead (≥ 40) get `grieving`.

### 6.7 Chance model (how an event gets picked)
**Rarity** sets the base weight, and modifiers shift it. When several templates or outcomes are eligible, each one's chance = its weight ÷ the sum of all eligible weights.

| Rarity | Base weight | Feel |
|---|---|---|
| common | 100 | happens constantly |
| uncommon | 30 | a few times a game |
| rare | 8 | maybe once a game |
| very rare | 2 | once every few games |
| legendary | 0.5 | a story people tell |

**Tone multiplier.** This is how affinity tilts things without deciding them. Every template has a `tone`:
- `cooperative`: weight × e^(k · m/100), where m = average mutual affinity between the participants
- `hostile`: weight × e^(−k · h/100), where h = the actor's affinity toward the target (for units, the average across members)
- `neutral`: no change

With `k = AFFINITY_INFLUENCE = 1.4`, a pair at +80 is ~3× likelier to cooperate and ~3× less likely to attack. At −80 it's the reverse. Nothing drops to zero, so enemies can still team up and best friends can still turn.

**Other modifiers** (declared on templates and outcomes): traits, trait differences, needs, health, items/weapons, zone tags, time of day, day number, and alive count.

### 6.8 Groups (alliances)
- Formed by cooperative encounter outcomes. High affinity makes this much likelier, but low-affinity pairs still team up through **alliances of necessity**: neutral-tone templates that are more likely when someone is wounded, unarmed, starving, or it's early in the game.
- Maximum group size is 6. Groups move together, share some items, and members can't be picked as hostile targets for each other *except* through betrayal or argument templates.
- **Leaving without violence:** arguments are likelier when the group's average affinity is below 0. A group can decide to **ditch** a member (likelier if that member is wounded or the group dislikes them). The ditched member gets `abandoned`, which makes "cries alone" style events common for them for a day.
- A group with one member left dissolves.

### 6.9 Betrayal
Each tick, for each group member A, measured against the group (using A's average affinity toward the other members, `a`):

```
p = BETRAYAL_BASE
    × e^(−k · a/100)                          // low affinity → likelier; high affinity → rarer, never zero
    × (startCount / aliveCount) ^ 1.2         // rises as the field shrinks
    × (0.5 + ruthlessness/10) × (1.5 − loyalty/10)
    × scarcity(A)                             // hungry/thirsty/no supplies → higher
    × (everyone alive is in this group ? 4 : 1)
```

If it triggers, A gets a template flagged `betrayal: true` (these are only ever chosen this way), aimed at the group member A likes least, weighted by low affinity. **After a betrayal:** A leaves the group; the victim, if alive, gets `aff[victim][A] = −100` plus `betrayed`; members who know get `−40` toward A.

### 6.10 Fights
There's no special event for "a big group attacks someone". Any hostile encounter can turn into a fight (a template with a `fight` effect), and the fight system resolves it with odds. It works the same for 1v1, 1v5 or 3v4. The text is then stitched together from fight lines in the event database (§6.12).

1. **Sides.** Each side is a unit: a lone contestant or a group. An ambush (attackers unseen, decided by stealth) gives the attackers +25% power. Fighters woken by a night attack fight at −25%.
2. **Fighter score** = strength + weapon bonus (bare hands 0 · knife 1 · mace 2 · spear 2 · axe 2 · bow 2 · sword 3) − wound penalty (wounded 2 · critical 4) + 0.3 × cunning + random noise (Normal(0, 2)), never below 0.5.
3. **Affinity across the line.** A fighter with affinity ≥ 60 toward someone on the other side fights at half strength and is unlikely to land the killing blow on them.
4. **Side power** = the sum of its fighters' scores.
5. **Who wins:** first roll for a **stalemate** (both sides break off), which is likeliest when the sides are evenly matched: `P = STALEMATE_BASE × (1 − |X − Y| / (X + Y))`. Otherwise side X wins with `P = X^α / (X^α + Y^α)`, where α = 1.5 so numbers count for more than raw totals. Roll it. A bigger side is favoured but never guaranteed.
6. **Casualties** (rolled per fighter, so some people on each side live and some die):
   - Losing side: dies 50% · wounded 25% · escapes 25%. Stealth improves escape; the winners' ruthlessness raises the death chance.
   - Winning side: dies 20% × closeness · wounded 40% × closeness, where closeness = loserPower ÷ winnerPower (max 1). A lopsided win costs little; a close one costs a lot.
   - Stalemate: everyone has a modest chance of a wound and a small chance of death, then both sides retreat to different zones.
   - Kill credit goes to a fighter on the opposing side, weighted by their score.
   - The never-wipe rule applies.
7. **Text:** one feed entry made of an opener line, one line per death or wound (chosen to match the killer's weapon), escape lines, and an ending line. Every name is highlighted by its own result (§8.1).
8. **Upsets emerge on their own.** With evenly matched fighters, a lone tribute beats two attackers about 1 time in 4 and five attackers about 1 time in 12. Killing all five happens in well under 1% of those fights. Nothing has to be scripted.

### 6.11 The Gamemakers (automatic; the user has no control)
- **Hazards:** each tick there's a chance `P_GM × (1 + 0.15 × day) × (1 + hoursSinceLastDeath / 12)` (they get bored) of a hazard in one zone: wildfire, flood, poison fog, mutts, rockslide, heat, acid rain. Everyone in the zone gets an individual outcome (escape → pushed to an adjacent zone, wounded, or killed), weighted by `survival`.
- **Feast:** once per game. From Day 3, a chance each dawn of the Gamemakers announcing a feast at the Cornucopia the next morning. It's a lethal hotspot. Low-supply and wounded contestants are likelier to go; cunning ones are likelier to ambush it.
- **The arena shrinks:** from Day 5, each dawn has a growing chance that the Gamemakers **close** an outer zone for the rest of the game (fire wall or flood). It's drawn on the map; anyone inside must flee or take a hazard roll. This is how long games naturally get forced together.
- **Backstop only:** if Day 30 dawns with more than one alive (it should basically never happen), the Gamemakers close everything except the Cornucopia.

### 6.12 The event database
Events are plain JSON-serialisable data in `/events/*.json` (split by category). They're validated with zod at build/test time and bundled into the app. **This is the file set I'll keep adding to.**

```ts
type Rarity = 'common' | 'uncommon' | 'rare' | 'veryRare' | 'legendary';
type Category = 'bloodbath' | 'solo' | 'encounter' | 'group' | 'gamemaker' | 'feast';
type Tone = 'cooperative' | 'hostile' | 'neutral';
type Severity = 'flavour' | 'minor' | 'major' | 'lethal';
type Visual = 'none' | 'cry' | 'sleep' | 'forage' | 'hide' | 'trap' | 'huddle' | 'fight' | 'chase'
            | 'ambush' | 'betrayal' | 'injury' | 'death' | 'hazard' | 'feast' | 'loot';

type EventTemplate = {
  id: string;                       // 'solo.cries_alone_abandoned'
  category: Category;
  severity: Severity;
  rarity: Rarity;
  tone: Tone;
  visual: Visual;
  betrayal?: boolean;               // only chosen by the betrayal system
  roles: {                          // A, B, C: single contestants. G, H: units (one person or a whole group; size range per template)
    A?: 'one'; B?: 'one'; C?: 'one';
    G?: { min: number; max: number };
    H?: { min: number; max: number };
  };
  when?: {
    timeOfDay?: ('dawn' | 'day' | 'dusk' | 'night')[];
    day?: { min?: number; max?: number };
    alive?: { min?: number; max?: number };
    zoneTags?: ZoneTag[];
  };
  requires?: {
    tags?: { who: Role; has?: Tag[]; lacks?: Tag[] }[];
    needs?: { who: Role; need: 'hunger' | 'thirst' | 'fatigue'; min?: number; max?: number }[];
    health?: { who: Role; is: Health[] }[];
    hasItem?: { who: Role; item: Item }[];
    hasWeapon?: Role[];
    inGroup?: { who: Role; group: 'G' | 'H' }[];   // e.g. A is a member of G
    notSameGroup?: Role[][];
    affinity?: { from: Role; to: Role; min?: number; max?: number }[];
  };
  mods?: WeightMod[];               // template-level weight modifiers
  outcomes: Outcome[];              // lethal templates need ≥ 2 outcomes
};

type Outcome = { rarity: Rarity; mods?: WeightMod[]; text: string; effects: Effect[]; visual?: Visual };

type WeightMod =
  | { kind: 'trait'; who: Role; trait: Trait; per: number }                // ×(1 + per·(trait − 5))
  | { kind: 'traitDiff'; a: Role; b: Role; trait: Trait; per: number }
  | { kind: 'need'; who: Role; need: Need; per: number }                   // ×(1 + per·need/100)
  | { kind: 'hasWeapon'; who: Role; mult: number }
  | { kind: 'hasItem'; who: Role; item: Item; mult: number }
  | { kind: 'health'; who: Role; is: Health; mult: number }
  | { kind: 'groupSize'; who: 'G' | 'H'; per: number }
  | { kind: 'timeOfDay'; is: TimeBand; mult: number }
  | { kind: 'alive'; per: number };                                        // scales as the field shrinks
// Final weights are clamped to >= 0.

type Effect =
  | { kind: 'kill'; target: Role | 'G.all' | 'G.first' | 'H.all'; by?: Role | 'G' }   // by G → a random member gets the kill credit
  | { kind: 'injure'; target: Role; severity: 'wounded' | 'critical' }
  | { kind: 'heal'; target: Role }
  | { kind: 'need'; who: Role; need: Need; delta: number }
  | { kind: 'gainItem' | 'loseItem'; who: Role; item: Item }
  | { kind: 'transferItem'; from: Role; to: Role; item: Item | 'all' }
  | { kind: 'setWeapon'; who: Role; weapon: Weapon }
  | { kind: 'affinity'; from: Role | 'G'; to: Role | 'G'; delta: number; mutual?: boolean }
  | { kind: 'affinitySet'; from: Role; to: Role; value: number }
  | { kind: 'formGroup'; members: (Role | 'G')[] }
  | { kind: 'joinGroup'; who: Role; group: 'G' }
  | { kind: 'leaveGroup'; who: Role }
  | { kind: 'ditch'; who: Role; from: 'G' }        // also adds the 'abandoned' tag
  | { kind: 'addTag' | 'removeTag'; who: Role; tag: Tag }
  | { kind: 'move'; who: (Role | 'G' | 'H')[]; to: 'adjacent' | 'cornucopia' | ZoneId }
  | { kind: 'fight'; attackers: 'A' | 'G'; defenders: 'B' | 'H'; ambush?: boolean };   // hands over to the fight system (§6.10)
```

**Gamemaker hazard templates** use `{ ..., category: 'gamemaker', intro: string, perVictim: Outcome[] }`. Each contestant in the zone rolls their own outcome using role `X`.

**Fight lines** are a separate pool used by the fight system (§6.10):
```ts
type FightLine = {
  id: string;
  kind: 'opener' | 'kill' | 'wound' | 'escape' | 'stalemate' | 'ending';
  rarity: Rarity;
  weapon?: Weapon[];                                  // kill/wound lines can be weapon-specific ('none' = bare hands)
  matchup?: ('1v1' | '1vGroup' | 'groupVsGroup')[];   // for openers and endings
  winner?: 'bigger' | 'smaller' | 'even';             // for endings, e.g. upset endings
  text: string;   // tokens: {K} killer · {V} victim · {W} winning side · {L} losing side · plus {zone} {weapon}
};
```

**Text tokens:**
- `{A}` → name
- `{G}` → "Sam, Priya and Jo"
- `{G.count}` → "five"; `{G.first}` → first member's name
- pronouns: `{A.they}` `{A.them}` `{A.their}` `{A.theirs}` `{A.themself}`, plus capitalised forms (`{A.They}`)
- verb agreement: `{A.is}` `{A.was}` `{A.has}` `{A.does}`, and the suffix `{A.s}` (as in `run{A.s}`)
- `{zone}` `{item}` `{weapon}`
- verb tokens work on units too (`{G.s}`, `{G.is}`, `{G.has}`…): plural for a group of 2+, the person's own pronouns for a lone contestant

**Example templates.** These set the voice. Write the rest in the same spirit.

```jsonc
// Common solo, made likely by being ditched
{ "id": "solo.cries_alone_abandoned", "category": "solo", "severity": "flavour", "rarity": "common", "tone": "neutral", "visual": "cry",
  "roles": { "A": "one" },
  "requires": { "tags": [{ "who": "A", "has": ["abandoned"] }] },
  "outcomes": [{ "rarity": "common",
    "text": "{A} sits alone in the {zone} and cries. {A.Their} group didn't even say goodbye.",
    "effects": [{ "kind": "need", "who": "A", "need": "fatigue", "delta": 10 }] }] }

// Hostile encounter that starts a fight (any unit sizes: 1v1, 1v5, 3v4...)
{ "id": "enc.attack_at_water", "category": "encounter", "severity": "lethal", "rarity": "common", "tone": "hostile", "visual": "fight",
  "roles": { "G": { "min": 1, "max": 6 }, "H": { "min": 1, "max": 6 } },
  "when": { "zoneTags": ["water"] },
  "outcomes": [
    { "rarity": "common", "text": "{G} spot{G.s} {H} at the water's edge and attack{G.s}.",
      "effects": [{ "kind": "fight", "attackers": "G", "defenders": "H" }] },
    { "rarity": "uncommon", "mods": [{ "kind": "trait", "who": "H", "trait": "stealth", "per": 0.2 }],
      "text": "{H} see{H.s} {G} coming and slip{H.s} away before anyone gets close.",
      "effects": [{ "kind": "move", "who": ["H"], "to": "adjacent" }, { "kind": "addTag", "who": "H", "tag": "hunted" }] } ] }

// Fight lines (the fight system stitches these together)
{ "id": "fl.kill.knife.ribs", "kind": "kill", "rarity": "common", "weapon": ["knife"],
  "text": "{K} drives a knife up under {V}'s ribs and holds it there until {V} stops moving." }
{ "id": "fl.kill.axe.twice", "kind": "kill", "rarity": "uncommon", "weapon": ["axe"],
  "text": "{K} buries an axe in {V}'s shoulder, wrenches it free, and finishes it on the second swing." }
{ "id": "fl.wound.spear.thigh", "kind": "wound", "rarity": "common", "weapon": ["spear"],
  "text": "{V} takes a spear through the thigh and keeps swinging anyway." }
{ "id": "fl.escape.zone", "kind": "escape", "rarity": "common",
  "text": "{V} breaks away and disappears into the {zone}." }
{ "id": "fl.ending.upset", "kind": "ending", "rarity": "common", "winner": "smaller",
  "text": "When it's over, {W} {W.is} still standing. Nobody would have bet on that." }

// Cooperative team-up (affinity scales this via tone)
{ "id": "enc.team_up", "category": "encounter", "severity": "major", "rarity": "common", "tone": "cooperative", "visual": "huddle",
  "roles": { "A": "one", "B": "one" },
  "requires": { "notSameGroup": [["A", "B"]] },
  "outcomes": [{ "rarity": "common", "text": "{A} and {B} agree to stick together. For now.",
    "effects": [{ "kind": "formGroup", "members": ["A", "B"] }] }] }

// Alliance of necessity (neutral tone, so low affinity doesn't block it)
{ "id": "enc.alliance_of_necessity", "category": "encounter", "severity": "major", "rarity": "uncommon", "tone": "neutral", "visual": "huddle",
  "roles": { "A": "one", "B": "one" },
  "requires": { "notSameGroup": [["A", "B"]], "health": [{ "who": "A", "is": ["wounded", "critical"] }] },
  "outcomes": [{ "rarity": "common", "text": "{A} is bleeding and {B} has nothing. They team up out of pure desperation. Neither of them is happy about it.",
    "effects": [{ "kind": "formGroup", "members": ["A", "B"] }] }] }

// Group ditches a wounded member
{ "id": "grp.ditch_wounded", "category": "group", "severity": "major", "rarity": "uncommon", "tone": "hostile", "visual": "chase",
  "roles": { "A": "one", "G": { "min": 2, "max": 6 } },
  "requires": { "inGroup": [{ "who": "A", "group": "G" }], "health": [{ "who": "A", "is": ["wounded", "critical"] }] },
  "outcomes": [{ "rarity": "common", "text": "The rest of the group decide {A} is slowing them down. {A} wakes up alone.",
    "effects": [{ "kind": "ditch", "who": "A", "from": "G" }, { "kind": "affinity", "from": "A", "to": "G", "delta": -40 }] }] }

// Betrayal (betrayal system only)
{ "id": "grp.betrayal_night_knife", "category": "group", "severity": "lethal", "rarity": "common", "tone": "hostile", "visual": "betrayal", "betrayal": true,
  "roles": { "A": "one", "B": "one", "G": { "min": 2, "max": 6 } },
  "requires": { "inGroup": [{ "who": "A", "group": "G" }, { "who": "B", "group": "G" }] },
  "when": { "timeOfDay": ["night"] },
  "outcomes": [
    { "rarity": "common", "text": "{A} waits until {B} is asleep, then opens {B.their} throat and takes {B.their} pack.",
      "effects": [{ "kind": "kill", "target": "B", "by": "A" }, { "kind": "transferItem", "from": "B", "to": "A", "item": "all" }, { "kind": "leaveGroup", "who": "A" }] },
    { "rarity": "uncommon", "mods": [{ "kind": "trait", "who": "B", "trait": "survival", "per": 0.2 }],
      "text": "{B} wakes as {A} raises the knife. {B} gets away, bleeding and very, very awake.",
      "effects": [{ "kind": "injure", "target": "B", "severity": "wounded" }, { "kind": "leaveGroup", "who": "A" }, { "kind": "leaveGroup", "who": "B" }] } ] }

// Gamemaker hazard
{ "id": "gm.wildfire", "category": "gamemaker", "severity": "lethal", "rarity": "common", "tone": "neutral", "visual": "hazard",
  "intro": "The Gamemakers set the {zone} on fire.",
  "perVictim": [
    { "rarity": "common", "mods": [{ "kind": "trait", "who": "X", "trait": "survival", "per": 0.2 }], "text": "{X} outruns the flames.",
      "effects": [{ "kind": "move", "who": ["X"], "to": "adjacent" }] },
    { "rarity": "uncommon", "text": "{X} gets out with burns down one arm.",
      "effects": [{ "kind": "injure", "target": "X", "severity": "wounded" }, { "kind": "move", "who": ["X"], "to": "adjacent" }] },
    { "rarity": "uncommon", "text": "{X} doesn't make it out of the {zone}.", "effects": [{ "kind": "kill", "target": "X" }] } ] }
```

**Starter database (Phase 1): at least 120 templates.**
- By category: ~20 Bloodbath, ~40 solo, ~30 encounter, ~20 group, ~10 Gamemaker/feast.
- Every rarity is represented, and lethal templates always have non-lethal outcomes too.
- Cover all of the following: the abandoned / grieving / vengeful / betrayed / hunted tags; hunger, thirst and fatigue; wounds and infection; medkits; traps; weapons; night ambushes; groups bonding, arguing, splitting and ditching; alliances of necessity; mercy (refusing to kill someone they like ≥ 60); revenge kills; and suicide (rare, written per §6.13).
- **Fight lines:** at least 10 openers (covering 1v1, 1-vs-group and group-vs-group), 30 kill lines spread across every weapon plus bare hands, 15 wound lines, 8 escape lines, and 10 endings, including upset endings for when the smaller side wins.

### 6.13 Content rules (non-negotiable)
- **Allowed:** violence, cruelty and gore. Murders and injuries can be described in graphic detail. The tone is dark, with a streak of dry, deadpan humour.
- **Suicide:** allowed as a rare event, but always one plain, simple sentence (e.g. "{A} takes {A.their} own life in the {zone}."). Never describe the method, never add detail, and never play it for laughs.
- **Never:** sexual content of any kind, rape or sexual violence, romance or romantic relationships (no crushes, kissing, couples or flirting; positive affinity is friendship and loyalty only), and slurs or jokes about real-world identity (race, religion, sexuality, gender, disability). The contestants are real people.
- A test must scan all event text for a banned-word list.

### 6.14 Tests and `sim:stats`
**Tests (must pass every phase):**
- Determinism: same setup + seed → identical log.
- Exactly one Victor every game, for field sizes 2, 3, 12, 24 and 48.
- A dead contestant never acts, moves or appears in later events (except recaps).
- No contestant has more than one visible event per tick.
- Affinity always stays within −100…100.
- `stateAt` matches the engine's internal state at every midnight.
- Every template passes zod validation and renders with no leftover `{tokens}` for each pronoun set and group size.
- Fights: across 10,000 simulated fights between evenly matched fighters, the bigger side wins more often as the size gap grows, and no fight kills everyone left alive.
- The content-rules scan passes.

**`npm run sim:stats`** runs 1,000 games of 24 tributes and prints:
- the game length distribution (as a histogram)
- Bloodbath deaths
- deaths per day
- visible events per game-hour by day
- groups formed
- betrayals per game
- the share of Victors who were ever in a group
- legendary outcomes per 100 games
- fight results: the smaller side's win rate at each size ratio (1v1, 1v2, 1v3, 1v5, 2v4…) and deaths on each side
- per-template usage, flagging any template that's never used

**Tune the constants in `tuning.ts` until the stats look roughly like this.** These are *descriptive* targets for tuning only; the engine never looks at them:
- game length: median 5–9 days, with real variance (at least 10% of games ≤ 4 days and at least 10% ≥ 11 days)
- Bloodbath deaths: median ~30% of the field, ranging 10–50%
- betrayals per game: median 1–3
- legendary outcomes: in roughly 1 game in 10–20
- fights between evenly matched fighters: a lone tribute beats two attackers about 1 time in 4 and five attackers about 1 time in 12
- the first hour after the gong: busy (15–30 events)
- mid-game: 1–4 events per game-hour, with occasional quiet stretches

---

## 7. The arena graphic

- **World:** a circular arena with the golden Cornucopia at the centre and 8 wedge zones around it. Each biome is drawn procedurally (gradients, textures, simple shapes like trees, water and rocks) with zone labels. Keep it easy to swap in real art later.
- **Time of day:** continuous lighting through dawn (warm), day (clear), dusk (purple) and night (deep blue with stars). Closed zones show as burnt or flooded and darkened.
- **Markers:**
  - circular photo (or initials) ~36px, with a ring in the group colour (white if solo)
  - a small district-number badge in Classic
  - wounded: pulsing red ring
  - dead: red flash, turns greyscale with a ✕, fades, and stays at the death spot until the Fallen screen
- **The map follows the text.** Every visible event has a location and a `visual`:
  1. Participants walk to the spot just before the event is due (start ~3 real seconds early, scaled by speed).
  2. The visual plays as the text appears: fight (clash sparks), ambush (group converges), chase (one runs, others follow), huddle (pull together and link in the group colour), betrayal (ring breaks, flash), death (red flash + cannon), injury (red pulse), cry/sleep/hide/forage/trap (a small icon bubble), hazard (fire, flood or fog washes over the zone), feast (a crate drop at the Cornucopia).
  3. Groups always move as a cluster. Dead markers never move.
- **Camera:** pinch to zoom, drag to pan, and a **Follow action** toggle. Tapping a feed item or a highlighted name focuses on that event or contestant. Tapping a marker opens the contestant card.
- **Performance:** 60fps with 48 markers on a mid-range phone. Respect the "reduce motion" setting.

---

## 8. Text updates

### 8.1 Highlighted names
Names in event text are rendered as coloured, bold, tappable chips. Colour shows what happened to that person **in that event**:

| Colour | Meaning |
|---|---|
| Red | died |
| Purple | betrayed someone |
| Gold | killed someone |
| Orange | injured |
| Green | healed, found something, or joined a group |
| White | involved, nothing major |

When several apply, priority is red > purple > gold > orange > green > white. Derive colours automatically from the event's effects. Tapping a name opens that contestant's card.

### 8.2 Toasts (on-screen notifications)
- Toasts appear top-centre, up to 3 stacked, and auto-dismiss after ~4 s, with a minimum gap between toasts.
- At 5x speed and above, only major/lethal events toast; the rest collapse into a "+N events" chip that opens the feed.
- Setting: All / Major only / Off.

### 8.3 Feed
- **Phone portrait:** a bottom sheet (peek / half / full). **Landscape or larger screens:** a right-hand sidebar.
- Grouped by day with timestamps ("Day 2 · 14:30"). Death events get a cannon icon.
- Filters: All · Deaths · Groups & betrayals · pick a contestant.
- Auto-scroll, unless the user has scrolled up (then show a "↓ New events" pill).

### 8.4 Fallen screen (at 00:00)
A full-screen, night-sky overlay. Each fallen tribute appears in turn (photo, name, district in Classic) with a cannon sound. If nobody died: "No cannons tonight." It closes on its own after the quiet window; in local games it can also be tapped to close.

### 8.5 Contestant card
Shows photo, name, district, status (and how they died), kills, group, items, weapon and traits. The **Relationships** section shows the top 3 people they like and the top 3 they dislike as affinity bars, with a toggle for "What others think of them".

### 8.6 Victor screen
The Victor, plus awards: Most kills · Biggest betrayal · Most loyal friendship · Most hated · Survived longest with zero kills · First blood. Buttons: Full log · Play again with the same cast · Save cast as a group in the pool.

---

## 9. Pace and clock (viewing only; no arena control)

| Pace | 1 game hour at 1x | 1 game day at 1x |
|---|---|---|
| Quick | 8 s | ~3 min |
| Standard (default) | 30 s | ~12 min |
| Slow | 2.5 min | ~1 hr |
| Real time | 1 hr | 24 hrs |

- **Controls:** ⏸/▶ · 1x · 2x · 5x · 10x · ⏭ Next event · ⏩ Skip to midnight.
- These only change viewing; they never change what happens. **The user has no control over the arena once the game starts.**
- Top bar shows "Day 3 · 21:40", alive count ("11 / 24") and the controls.
- **Keep screen awake** setting (Wake Lock).
- Local games autosave, including the clock, and resume paused.

---

## 10. Online: spectating and shared setup (Phases 4–5)

- **Accounts:** a Supabase anonymous sign-in plus a display name, the first time someone uses an online feature. An optional "link email" lets you keep your account and pool across devices.
- **Visibility:** **Private** (needs a 6-character code or invite link) or **Public** (listed under **Watch → Live**). Games show the names and photos exactly as the host entered them.
- **Watch links:** `/watch/ABC123` opens straight in any browser, with no install needed, so friends can watch instantly.
- **Data model:**
```
profiles        (id = auth uid, display_name, created_at)
pool            (id, owner_id, name, pronouns, photo_path, created_at)           -- synced contestant pool
games           (id, host_id, title, mode 'classic'|'custom', visibility 'private'|'public', join_code unique,
                 status 'lobby'|'running'|'finished', seed bigint, settings jsonb,
                 clock_anchor_wall timestamptz, clock_anchor_game_min double, clock_speed numeric,
                 clock_paused bool, pace text, victor_id, created_at, finished_at)
game_members    (game_id, user_id, role 'host'|'collaborator'|'spectator', joined_at)
contestants     (id, game_id, slot int, district int null, name, pronouns jsonb, photo_path, traits jsonb, added_by)
relationships   (game_id, from_id, to_id, value int)
events          (game_id, seq int, game_min double, kind, template_id, category, severity, text,
                 participant_ids uuid[], name_colours jsonb, zone, visual, effects jsonb, primary key (game_id, seq))
storage bucket  photos
```
  Row-level security on everything: private games are members only, public games are readable by any signed-in user, and only the host (or collaborators in a lobby) can write. Anonymous users count as authenticated, so write policies carefully.
- **Starting a live game:**
  1. The host's device simulates the whole game.
  2. It batch-uploads the log (chunks of ~500).
  3. It sets `running` with the clock anchored to server time + a 5 s countdown.
  4. It broadcasts the change.
- **Sync:**
  - Clients estimate their offset from server time with a `server_time()` RPC (using round-trip/2).
  - One Realtime channel per game: **Broadcast** for clock changes, **Presence** for the viewer count. Prefer Broadcast over `postgres_changes`.
  - Late joiners fetch the game + log and render `stateAt(log, gameNow)` instantly.
  - The host controls pause and speed for everyone; viewers can scroll the feed and move the camera.
  - The game keeps playing for viewers even if the host's phone locks.
- **Shared setup (Phase 5):** collaborators join a lobby by code and fill slots, pick from their own pools, and set relationships on the same create screen, synced live. The host presses Start. There's no in-game control for anyone.
- **Free-tier note:** Supabase pauses free projects after a week with no database activity, and online features stop until someone clicks **Resume** in the Supabase dashboard (the data is kept). To prevent that, add a GitHub Actions scheduled workflow (free; runs on GitHub's servers, no device needed) that does one tiny database read every 3 days. Keep the `icehg` repo **private**, because GitHub switches off scheduled workflows in public repos after 60 days without a commit. Also tell me how to resume the project manually, just in case.

---

## 11. Screens

- **Home:** New game · Continue · Contestant pool · Watch (Live list + Join by code) · Settings
- **New game:** Mode select (Classic / Custom + count, pace) → Create screen (Tributes | Relationships) → Start → Game screen
- **Game screen:** arena + top bar + toasts + feed + controls. Overlays: Fallen screen · contestant card · Victor screen · full log
- **Settings:** default pace, sound, toast level, keep screen awake, account, **How to install** (iPhone/Android instructions with screenshots), and Developer tools (tap the version number 7 times): **Event Lab** (preview any template with chosen or random contestants and every outcome, pronoun set and group size) and **Sim stats**
- **First launch in a browser tab (not installed):** a friendly banner explaining "Add to Home Screen", with instructions for iPhone or Android depending on the device

---

## 12. Look and feel

- Dark and cinematic, with frosted-glass panels for the top bar, toasts, feed and sheets, and Capitol-gold accents.
- A bold condensed display face for headings and numbers; a clean sans-serif for event text (Google Fonts).
- High-contrast text over the map. A colour-blind-safe group palette, always paired with badges or shapes.
- Title treatment: **I Could Eat a Horse Games**, with "ICEHG" as the short mark and app icon text.
- **If I give you a design system doc, it overrides this section.**

---

## 13. Build phases

Stop after each one (§0.3).

### Phase 1: Engine + event database + text-only game
- Vite + React + TypeScript + PWA skeleton, Tailwind, Dexie, routing
- Help me create the GitHub repo `icehg` and connect Vercel, so I can test on my phone over HTTPS from the start
- Mode select (Classic / Custom + count, pace) and a **basic** create screen: slots with names and pronouns only, default random affinities
- The complete engine (§6), all tests, `sim:stats`, tuned to §6.14
- At least 120 templates in `/events`, plus the Event Lab
- Game screen v0: top bar, clock controls, feed with **highlighted names**, Fallen screen at midnight, basic Victor screen. Autosave and resume.

**Done when:** tests pass; `sim:stats` lands in the §6.14 ranges with no unused templates; I can open the Vercel link on my iPhone, add it to my home screen, and run a full Classic game with names coloured correctly and the Fallen screen at midnight.

### Phase 2: Full create screen + contestant pool
- Photos (camera or library + crop + resize), initials fallback, the Add sheet with **New / From pool**, the save-to-pool toggle, Contestant pool screen, drag to swap, fill from pool, and **Relationships mode** (§5.4) with presets.

**Done when:** I can fill a 24-slot Classic board in a few minutes using photos and the pool, set a few relationships, and see those relationships reflected in a game's events.

### Phase 3: The arena map
- Everything in §7, toasts (§8.2), the feed as a bottom sheet/sidebar (§8.3), the contestant card (§8.5), cannon sound, wake lock.

**Done when:** markers visibly walk to each event before its text appears; visuals match what the text says (deaths, ambushes, groups); dead never move; it's smooth on my phone with 24 tributes.

### Phase 4: Online spectating
- Walk me through creating the Supabase project. Then: anonymous auth, schema + RLS, photo storage, pool sync, upload-and-start, clock sync, Live list, join by code, watch links, viewer count, late join, keep-alive job.

**Done when:** I start a public game; a friend's phone finds it under Live (or opens my watch link in a browser) and sees the same events at the same moment (within ~1 s); pausing on my phone pauses theirs; someone joining at Day 3 sees the correct state; locking my phone doesn't stop the game for them.

### Phase 5: Shared setup (collaborate)
- Lobby with live co-editing of slots and relationships (§10); the host starts the game.

**Done when:** a friend and I fill the same board from our own phones at the same time, then both watch the game.

### Phase 6: Polish and share
- App icon and splash, the install-instructions banner and page, offline checks, an update prompt when a new version deploys, and an optional custom domain (tell me the cost first).

**Done when:** I can text a friend the link, and they install and play without my help.

---

## 14. Getting it onto phones

- **During development:** `npm run dev -- --host` and open the shown address on my phone over the same Wi-Fi. For full PWA behaviour (install, offline, camera), use the Vercel URL, which is HTTPS.
- **Sharing:** send the Vercel link (e.g. `icehg.vercel.app`).
  - **iPhone:** open it in Safari → Share → **Add to Home Screen**.
  - **Android:** open it in Chrome → **Install app**.
  - Always launch it from the home-screen icon: data saved inside a regular Safari tab can be deleted after 7 days of not visiting.
- **Updates:** I push to GitHub, Vercel deploys, and everyone gets the new version the next time they open it (show an "Update available" prompt).
- **Cost:** $0 on free tiers. A custom domain is optional.
- **If an app store is ever wanted later:** the same web app can be wrapped with Capacitor. Not now.

---

## 15. Later (keep these possible; don't build them now)

- Gamemaker or sponsor controls for the host or friends (re-simulate from a cut point in the log)
- An in-app event editor, and moving events into a Supabase table so they can be edited live
- Seasons: the same cast over multiple games, with grudges carrying over
- A shareable 4:5 Victor card image
- Replays with a scrubber; spectator emoji reactions
- Push notifications (home-screen web apps support web push on iPhone)

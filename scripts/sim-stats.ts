// npm run sim:stats [-- games] — runs N games of 24 tributes and prints the §6.14 report.
import { eventDb, validateEventDb } from '../events';
import { median, pct, runStats } from '../engine/analysis/stats';

validateEventDb();
const games = Number(process.argv[2] ?? 1000);
const t0 = Date.now();
const s = runStats(eventDb, games, 24, 1000, (i) => {
  if ((i + 1) % 100 === 0) process.stderr.write(`  ${i + 1}/${games} games\r`);
});
const secs = ((Date.now() - t0) / 1000).toFixed(1);
const bar = (n: number, max: number, w = 40) => '█'.repeat(Math.round((n / Math.max(1, max)) * w));
const f1 = (x: number) => x.toFixed(1);

console.log(`\n=== ICEHG sim:stats — ${games} games of 24 tributes (${secs}s) ===\n`);

console.log('Game length (days):');
const hist: Record<number, number> = {};
for (const d of s.lengthDays) hist[d] = (hist[d] ?? 0) + 1;
const maxH = Math.max(...Object.values(hist));
for (const d of Object.keys(hist).map(Number).sort((a, b) => a - b))
  console.log(`  Day ${String(d).padStart(2)}: ${String(hist[d]).padStart(4)} ${bar(hist[d]!, maxH)}`);
const le4 = s.lengthDays.filter((d) => d <= 4).length / games;
const ge11 = s.lengthDays.filter((d) => d >= 11).length / games;
console.log(`  median ${median(s.lengthDays)} · ≤4 days ${(le4 * 100).toFixed(0)}% · ≥11 days ${(ge11 * 100).toFixed(0)}%   [target: median 5–9, ≥10% each tail]\n`);

const bb = s.bloodbathDeaths.map((d) => (d / 24) * 100);
console.log(`Bloodbath deaths: median ${median(s.bloodbathDeaths)} (${f1(median(bb))}%), p5 ${f1(pct(bb, 0.05))}% – p95 ${f1(pct(bb, 0.95))}%   [target: ~30%, 10–50%]`);
console.log(`First hour after the gong: median ${median(s.firstHourEvents)} events   [target: 15–30]\n`);

console.log('Deaths per day (avg) · visible events per game-hour:');
s.deathsPerDay.slice(0, 16).forEach((d, i) => console.log(`  Day ${String(i + 1).padStart(2)}: ${f1(d).padStart(5)} deaths · ${s.eventsPerHourByDay[i]!.toFixed(2)} events/h`));
console.log(`  quiet stretches (≥4h with no visible event): ${f1(s.quietStretches)} per game   [target: mid-game 1–4 events/h, occasional quiet]\n`);

console.log(`Groups formed per game: median ${median(s.groupsFormed)}`);
console.log(`Betrayals per game: median ${median(s.betrayals)} (mean ${f1(s.betrayals.reduce((a, b) => a + b, 0) / games)})   [target: median 1–3]`);
console.log(`Victors who were ever in a group: ${(s.victorEverInGroupShare * 100).toFixed(0)}%`);
console.log(`Legendary outcomes per 100 games: ${f1(s.legendaryPer100)}   [target: ~5–10]\n`);

console.log('Fights (smaller side win rate, stalemates, avg deaths per fight):');
const keys = Object.keys(s.fights).sort((a, b) => {
  const [a1, a2] = a.split('v').map(Number);
  const [b1, b2] = b.split('v').map(Number);
  return a1! - b1! || a2! - b2!;
});
for (const k of keys) {
  const f = s.fights[k]!;
  if (f.n < 20) continue;
  console.log(
    `  ${k.padEnd(5)} n=${String(f.n).padStart(6)}  smaller wins ${((f.smallerWins / f.n) * 100).toFixed(1).padStart(5)}%  stalemate ${((f.stalemates / f.n) * 100).toFixed(1).padStart(5)}%  deaths smaller ${(f.deathsSmaller / f.n).toFixed(2)} · bigger ${(f.deathsBigger / f.n).toFixed(2)}`,
  );
}

console.log('\nTemplate usage (least used 15):');
const used = Object.entries(s.templateUse).sort((a, b) => a[1] - b[1]);
for (const [id, n] of used.slice(0, 15)) console.log(`  ${String(n).padStart(6)}  ${id}`);
console.log(`\nUnused templates: ${s.unusedTemplates.length ? s.unusedTemplates.join(', ') : 'none ✓'}`);
console.log(`Unused fight lines: ${s.unusedFightLines.length ? s.unusedFightLines.join(', ') : 'none ✓'}`);

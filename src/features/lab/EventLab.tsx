import { useMemo, useState } from 'react';
import { renderText, type PronounKey, type TextBinding, type TextContext } from '../../../engine';
import { eventDb } from '../../../events';
import { isHazard, type AnyTemplate, type Outcome } from '../../../events/types';
import { Screen } from '../../components/Screen';
import { NameText } from '../feed/NameText';
import { SAMPLE_NAMES } from '../setup/sampleNames';

type PSet = PronounKey | 'mixed';

/** Preview any template with every outcome, pronoun set and group size (§11). */
export function EventLab() {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<string>(eventDb.templates[0]!.id);
  const [pset, setPset] = useState<PSet>('mixed');
  const [g, setG] = useState(2);
  const [h, setH] = useState(2);
  const [seed, setSeed] = useState(0);
  const [tab, setTab] = useState<'templates' | 'fight'>('templates');

  const t = eventDb.templates.find((x) => x.id === sel)!;
  const filtered = eventDb.templates.filter((x) => x.id.includes(q.trim().toLowerCase()));

  const names = useMemo(() => {
    const shuffled = SAMPLE_NAMES.slice().sort(() => Math.random() - 0.5);
    return shuffled;
  }, [seed]);
  const pron = (i: number): PronounKey => (pset === 'mixed' ? names[i]![1] : pset);
  const nameMap: Record<string, string> = {};
  let n = 0;
  const person = (role: string) => {
    const id = `${role}${n}`;
    nameMap[id] = names[n % names.length]![0];
    return { id, pronouns: pron(n++ % names.length) };
  };
  const unit = (role: string, size: number): TextBinding => ({ people: Array.from({ length: size }, () => person(role)), isUnit: true });
  const clampSize = (r: { min: number; max: number } | undefined, v: number) => (r ? Math.max(r.min, Math.min(r.max, v)) : v);
  const tpl = t as AnyTemplate;
  const gSize = clampSize(tpl.roles.G, g);
  const hSize = clampSize(tpl.roles.H, h);
  const roles: TextContext['roles'] = {
    A: { people: [person('A')], isUnit: false },
    B: { people: [person('B')], isUnit: false },
    C: { people: [person('C')], isUnit: false },
    X: { people: [person('X')], isUnit: false },
    K: { people: [person('K')], isUnit: false },
    V: { people: [person('V')], isUnit: false },
  };
  roles.G = unit('G', gSize);
  roles.H = unit('H', hSize);
  roles.W = roles.G;
  roles.L = roles.H;
  const insideG = !isHazard(tpl) ? (tpl.requires?.inGroup ?? []).filter((x) => x.group === 'G').map((x) => x.who) : [];
  if (insideG.length) {
    // A/B/C are members of G: show G including them, and {R} as the rest.
    const inside = insideG.map((r) => roles[r]!.people[0]!);
    roles.R = { people: roles.G.people.slice(0, Math.max(1, gSize - inside.length)), isUnit: true };
    roles.G = { people: [...inside, ...roles.R.people], isUnit: true };
  } else roles.R = roles.G;
  const ctx: TextContext = { roles, zone: 'forest', item: 'medkit', weapon: 'knife' };
  const nameOf = (id: string) => nameMap[id] ?? id;
  const outs: Outcome[] = isHazard(tpl) ? tpl.perVictim : tpl.outcomes;

  return (
    <Screen title="Event Lab" back="/settings">
      <div className="flex gap-2 mb-3">
        {(['templates', 'fight'] as const).map((k) => (
          <button key={k} onClick={() => setTab(k)} className={`btn flex-1 !py-2 ${tab === k ? 'btn-gold' : 'btn-ghost'}`}>
            {k === 'templates' ? `Templates (${eventDb.templates.length})` : `Fight lines (${eventDb.fightLines.length})`}
          </button>
        ))}
      </div>

      <div className="glass rounded-2xl p-3 mb-3 flex flex-wrap gap-2 items-center text-sm">
        <span className="text-mute">Pronouns</span>
        {(['mixed', 'he', 'she', 'they'] as const).map((p) => (
          <button key={p} onClick={() => setPset(p)} className={`px-2.5 py-1 rounded-full border ${pset === p ? 'border-gold text-gold' : 'border-line text-mute'}`}>
            {p}
          </button>
        ))}
        <span className="text-mute ml-2">G</span>
        <input type="number" min={1} max={6} value={g} onChange={(e) => setG(Number(e.target.value))} className="input !w-16 !py-1" />
        <span className="text-mute">H</span>
        <input type="number" min={1} max={6} value={h} onChange={(e) => setH(Number(e.target.value))} className="input !w-16 !py-1" />
        <button className="btn btn-ghost !py-1 !px-3" onClick={() => setSeed((s) => s + 1)}>
          New names
        </button>
      </div>

      {tab === 'templates' ? (
        <div className="flex flex-col gap-3">
          <input className="input" placeholder="Search templates…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="input" value={sel} onChange={(e) => setSel(e.target.value)} size={6}>
            {filtered.map((x) => (
              <option key={x.id} value={x.id}>
                {x.id} · {x.rarity}
              </option>
            ))}
          </select>
          <div className="glass rounded-2xl p-4">
            <div className="font-mono text-sm text-gold">{t.id}</div>
            <div className="text-xs text-mute mt-1">
              {t.category} · {t.severity} · {t.rarity} · tone {t.tone} · visual {t.visual}
              {t.betrayal ? ' · betrayal' : ''}
              {t.trigger ? ` · trigger ${t.trigger}` : ''}
            </div>
            {isHazard(tpl) && (
              <p className="mt-3 italic">
                <NameText text={renderText(tpl.intro, ctx)} nameOf={nameOf} />
              </p>
            )}
            <ul className="mt-3 flex flex-col gap-3">
              {outs.map((o, i) => (
                <li key={i} className="border-l-2 border-gold/40 pl-3">
                  <div className="text-[11px] uppercase tracking-widest text-mute">
                    {o.rarity} · {o.effects.map((e) => e.kind).join(', ') || 'no effects'}
                  </div>
                  <div className="text-[15px] leading-snug">
                    <NameText text={renderText(o.text, ctx)} nameOf={nameOf} />
                  </div>
                </li>
              ))}
            </ul>
            {(t.when || (!isHazard(tpl) && tpl.requires)) && (
              <pre className="mt-3 text-[11px] text-mute whitespace-pre-wrap">{JSON.stringify({ when: t.when, requires: !isHazard(tpl) ? tpl.requires : undefined }, null, 1)}</pre>
            )}
          </div>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {eventDb.fightLines.map((l) => (
            <li key={l.id} className="glass rounded-xl p-3">
              <div className="text-[11px] uppercase tracking-widest text-mute">
                {l.kind} · {l.rarity}
                {l.weapon ? ` · ${l.weapon.join('/')}` : ''}
                {l.matchup ? ` · ${l.matchup.join('/')}` : ''}
                {l.winner ? ` · ${l.winner}` : ''}
              </div>
              <NameText text={renderText(l.text, ctx)} nameOf={nameOf} />
            </li>
          ))}
        </ul>
      )}
    </Screen>
  );
}

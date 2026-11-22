// The engine purity rule (§4.1), enforced.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(__dirname, '..');
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return f === 'tests' ? [] : files(p);
    return p.endsWith('.ts') ? [p] : [];
  });
}

describe('engine purity (§4.1)', () => {
  const src = files(root).map((p) => ({ p: relative(root, p), code: readFileSync(p, 'utf8') }));
  it('uses no Math.random, Date.now, browser APIs or I/O', () => {
    for (const { p, code } of src) {
      for (const banned of [/Math\.random/, /Date\.now/, /new Date\(/, /\bwindow\./, /\bdocument\./, /localStorage/, /indexedDB/, /\bfetch\(/, /performance\.now/, /console\./]) {
        expect(banned.test(code), `${p} uses ${banned}`).toBe(false);
      }
    }
  });
  it('imports only relative files, the event schema and zod', () => {
    for (const { p, code } of src) {
      for (const m of code.matchAll(/from\s+'([^']+)'/g)) {
        const mod = m[1]!;
        expect(mod.startsWith('.') || mod === 'zod', `${p} imports ${mod}`).toBe(true);
        if (mod.startsWith('../../') || mod.startsWith('../events')) expect(mod).toMatch(/events\/schema$/);
      }
    }
  });
});

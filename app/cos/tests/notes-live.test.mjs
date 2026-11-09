// Test pentru formatarea la vedere din notițe (live.ts): bucățile din câmpul de scris, lipite la loc, dau exact textul,
// iar semnele sunt marcate ca semne. Rulare (în suite/): node tests/notes-live.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync, writeFileSync } from 'node:fs';

const src = (f) => join(process.cwd(), f).split(String.fromCharCode(92)).join('/');
const entry = join(tmpdir(), `suite-noteslive-entry-${process.pid}.ts`);
writeFileSync(entry, [`export * from '${src('src/notes/live.ts')}';`, `export { parseInline } from '${src('src/notes/inline.ts')}';`].join(String.fromCharCode(10)));
const out = join(tmpdir(), `suite-noteslive-${process.pid}.mjs`);
await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const m = await import(pathToFileURL(out).href);
rmSync(out, { force: true });
rmSync(entry, { force: true });

const NL = String.fromCharCode(10);
let bad = 0;
const check = (name, ok, got) => { console.log((ok ? 'OK   ' : 'GREȘIT ') + name + (ok ? '' : '  →  ' + got)); if (!ok) bad++; };
const show = (parts) => parts.map((p) => (p.m ? '~' : '') + (p.b ? 'B' : '') + (p.i ? 'I' : '') + (p.u ? 'U' : '') + (p.x ? 'X' : '') + (p.h ? 'H' : '') + (p.c ? 'C' : '') + (p.hd ? 'T' + p.hd : '') + '[' + p.s + ']').join('');
const joined = (body) => m.liveLines(body).map((ln) => ln.map((p) => p.s).join('')).join(NL);

const samples = [
  'a **b** *c* d',
  '**x *y* z**',
  '***tot*** și ~~vechi~~ ==nou== ++sub++',
  '{roșu:text {fundal verde:verde} aici} și {mare:mare} {font Georgia:G}',
  '# Titlu cu **aldin**' + NL + '## Sub' + NL + 'rând simplu' + NL,
  '{ecuație:x^2 + 1} și 2 * 3 = 6 și 4*',
  '{la centru:centrat}' + NL + '| a | b |' + NL + '☐ de făcut' + NL + NL + 'final',
  'C++ și 1 + 1, {nu e semn} și {roșu:} gol',
];
for (const s of samples) check('textul rămâne exact: ' + JSON.stringify(s).slice(0, 40), joined(s) === s, JSON.stringify(joined(s)));

check('aldin cu semnele estompate', show(m.liveLines('a **b** c')[0]) === '[a ]~[**]B[b]~[**][ c]', show(m.liveLines('a **b** c')[0]));
check('cursiv în aldin', show(m.liveLines('**x *y* z**')[0]) === '~[**]B[x ]~B[*]BI[y]~B[*]B[ z]~[**]', show(m.liveLines('**x *y* z**')[0]));
check('culoare: semnele au culoarea', show(m.liveLines('{roșu:r}')[0]) === '~C[{roșu:]C[r]~C[}]', show(m.liveLines('{roșu:r}')[0]));
check('titlul: „# ” estompat, restul aldin', show(m.liveLines('# Hai')[0]) === '~T1[# ]BT1[Hai]', show(m.liveLines('# Hai')[0]));
check('ecuația rămâne scrisă întreagă', m.liveLines('{ecuație:a/b}')[0][0].s === '{ecuație:a/b}' && m.liveLines('{ecuație:a/b}')[0][0].eq === 'a/b', JSON.stringify(m.liveLines('{ecuație:a/b}')[0]));
check('fără keep, parseInline e la fel ca înainte', show(m.parseInline('a **b** {roșu:c}')) === '[a ]B[b][ ]C[c]', show(m.parseInline('a **b** {roșu:c}')));

if (bad) { console.log(`\n${bad} verificări greșite`); process.exit(1); }
console.log('\nToate verificările au trecut.');

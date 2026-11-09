// Test pentru Notițe → Stiluri → lista Titlu…: stilurile de paragraf Citat, Sursă (citare) și Cod (inline.ts paraStyleEdit):
// se pun pe rândurile alese, scot titlul, se schimbă unul cu altul, se scot puse din nou și se citesc formatat de parseInline.
// Rulare (în suite/): node tests/notes-parastyle.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const out = join(tmpdir(), `suite-parastyle-${process.pid}.mjs`);
await build({ entryPoints: ['src/notes/inline.ts'], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const { paraStyleEdit, parseInline } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });
let bad = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'GRESIT: ') + m); if (!c) bad++; };
const NL = String.fromCharCode(10);
const apply = (v, ed) => v.slice(0, ed.from) + ed.text + v.slice(ed.to);

const v = ['Început', 'A fi sau a nu fi', '## Titlu', 'x = 1', 'Sfârșit'].join(NL);
const q = apply(v, paraStyleEdit(v, 10, 10, 'quote'));
ok(q.split(NL)[1] === '{gri:*A fi sau a nu fi*}', 'Citat pe rândul cu cursorul: ' + q.split(NL)[1]);
const sp = parseInline(q.split(NL)[1]);
ok(sp.length === 1 && sp[0].i && sp[0].c && sp[0].s === 'A fi sau a nu fi', 'citatul se vede cursiv și gri');
ok(apply(q, paraStyleEdit(q, 10, 10, 'quote')) === v, 'Citat pus din nou se scoate');
const c = apply(q, paraStyleEdit(q, 10, 10, 'cite'));
ok(c.split(NL)[1] === '{mic:{gri:A fi sau a nu fi}}', 'Sursă în locul citatului: ' + c.split(NL)[1]);
const cs = parseInline(c.split(NL)[1])[0];
ok(cs.sz && cs.c && !cs.i, 'sursa: mic și gri, fără cursiv');
const at = v.indexOf('## Titlu') + 2;
const h = apply(v, paraStyleEdit(v, at, at, 'code'));
ok(h.split(NL)[2] === '{font Consolas:Titlu}', 'Cod pe un titlu scoate semnul de titlu: ' + h.split(NL)[2]);
ok(parseInline(h.split(NL)[2])[0].f, 'codul are fontul Consolas');
// Mai multe rânduri deodată, cu un rând gol care rămâne gol.
const m = ['unu', '', 'doi'].join(NL);
const mm = apply(m, paraStyleEdit(m, 0, m.length, 'code'));
ok(mm === ['{font Consolas:unu}', '', '{font Consolas:doi}'].join(NL), 'mai multe rânduri: ' + JSON.stringify(mm));
ok(apply(mm, paraStyleEdit(mm, 0, mm.length, 'code')) === m, 'și se scot toate deodată');
ok(apply(v, paraStyleEdit(v, 0, 0, 'necunoscut')) === v, 'un stil necunoscut nu schimbă nimic');

console.log(bad ? `${bad} GRESITE` : 'TOATE BUNE');
process.exit(bad ? 1 : 0);

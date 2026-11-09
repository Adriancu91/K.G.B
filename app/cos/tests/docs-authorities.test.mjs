// Test: tabelul de autorități din Docs: categoriile în ordine, citările în ordine alfabetică și fără repetări,
// paginile o singură dată, „passim” de la 5 pagini, o singură categorie și textul pentru .docx / .odt.
// Rulare (în suite/): node tests/docs-authorities.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync, writeFileSync } from 'node:fs';

const entry = join(tmpdir(), `suite-toa-entry-${process.pid}.ts`);
const out = join(tmpdir(), `suite-toa-${process.pid}.mjs`);
const src = (p) => JSON.stringify(join(process.cwd(), p).split(String.fromCharCode(92)).join('/'));
writeFileSync(entry, `export { AUTH_CATS, PASSIM_FROM, buildAuthorities, authLinesJson, cleanCat, cleanCite } from ${src('src/docs/authorities.ts')};\n`);
await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error', loader: { '.css': 'empty' } });
const M = await import(pathToFileURL(out).href);
rmSync(entry, { force: true });

let bad = 0;
const check = (ok, what) => { console.log((ok ? 'OK    ' : 'GRESIT') + ' ' + what); if (!ok) bad++; };
const J = JSON.stringify;

check(M.AUTH_CATS.length === 7 && M.PASSIM_FROM === 5, '7 categorii, passim de la 5 pagini');
check(M.cleanCat('3') === 3 && M.cleanCat(0) === 1 && M.cleanCat(9) === 1 && M.cleanCat('x') === 1, 'cleanCat');
check(M.cleanCite('  Legea   nr. 1 ') === 'Legea nr. 1' && M.cleanCite(5) === '', 'cleanCite');

const L = 'Legea nr. 31/1990', C = 'Codul civil', D = 'ICCJ, decizia nr. 5/2020';
const hits = [
  { long: L, short: '', cat: 2, pos: 10 }, { long: C, short: '', cat: 2, pos: 20 }, { long: D, short: '', cat: 1, pos: 30 },
  { long: 'legea NR. 31/1990', short: '', cat: 2, pos: 40 }, { long: C, short: '', cat: 2, pos: 50 }, { long: C, short: '', cat: 2, pos: 60 },
  { long: C, short: '', cat: 2, pos: 70 }, { long: C, short: '', cat: 2, pos: 80 }, { long: C, short: '', cat: 2, pos: 90 },
];
const pages = [1, 1, 2, 3, 2, 3, 3, 4, 5];
const g = M.buildAuthorities(hits, pages);
check(J(g.map((x) => x.name)) === J(['Jurisprudență', 'Legi']), 'categoriile în ordine: ' + g.map((x) => x.name));
check(J(g[1].rows.map((r) => r.long)) === J([C, L]), 'Legi în ordine alfabetică, Legea o singură dată (la prima scriere)');
check(J(g[1].rows[1].pages.map((p) => p.page)) === J([1, 3]), 'paginile Legii: 1, 3');
check(J(g[1].rows[0].pages.map((p) => p.page)) === J([1, 2, 3, 4, 5]) && g[1].rows[0].passim === true, 'Codul civil pe 5 pagini: passim');
check(g[1].rows[1].passim === false, 'Legea pe 2 pagini: fără passim');
check(M.buildAuthorities(hits, pages, 0, false)[1].rows[0].passim === false, 'fără bifa passim: numerele');
const only = M.buildAuthorities(hits, pages, 1);
check(only.length === 1 && only[0].name === 'Jurisprudență', 'o singură categorie');
check(M.buildAuthorities(hits, pages, 4).length === 0, 'categorie fără citări: gol');
const noPages = M.buildAuthorities(hits, hits.map(() => null));
check(noPages[1].rows[0].pages.length === 1 && noPages[1].rows[0].pages[0].page === null && !noPages[1].rows[0].passim, 'fără pagini (în afara ecranului): un singur loc, fără passim');

const doc = { type: 'doc', content: [
  { type: 'paragraph', content: [{ type: 'text', text: 'x' }, { type: 'authEntry', attrs: { long: L, cat: 2 } }, { type: 'authEntry', attrs: { long: D, cat: 1 } }] },
  { type: 'paragraph', content: [{ type: 'authEntry', attrs: { long: 'Tratat de drept civil', cat: 5 } }, { type: 'authEntry', attrs: { long: '', cat: 5 } }] },
] };
check(J(M.authLinesJson(doc)) === J([{ text: 'Jurisprudență', head: true }, { text: D, head: false }, { text: 'Legi', head: true }, { text: L, head: false }, { text: 'Doctrină', head: true }, { text: 'Tratat de drept civil', head: false }]), 'textul pentru .docx / .odt');
check(J(M.authLinesJson(doc, 5)) === J([{ text: 'Doctrină', head: true }, { text: 'Tratat de drept civil', head: false }]), 'textul doar pentru Doctrină');

rmSync(out, { force: true });
console.log(bad ? `${bad} GRESITE` : 'TOATE BUNE');
process.exit(bad ? 1 : 0);

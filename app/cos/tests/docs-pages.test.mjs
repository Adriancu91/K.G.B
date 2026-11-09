// Test pentru „Pagina X din Y” din Docs: paginile din înălțimea blocurilor, „Pagină nouă” și paragrafele mai lungi decât o pagină.
// Rulare (în suite/): node tests/docs-pages.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const out = join(tmpdir(), `suite-docspages-${process.pid}.mjs`);
await build({ entryPoints: ['src/docs/pageCount.ts'], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const { pageStarts, pageOf } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

let fail = 0;
const check = (name, got, want) => { const g = JSON.stringify(got), w = JSON.stringify(want); const ok = g === w; console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ` → ${g} (trebuia ${w})`}`); if (!ok) fail++; };
const blocks = (hs) => { let y = 0; return hs.map((h) => (h === 'B' ? { top: y, height: 0, pageBreak: true } : { top: (y += h) - h, height: h })); };

check('totul pe o pagină', pageStarts(blocks([100, 100, 100]), 1000), [0]);
check('al treilea bloc trece pe pagina 2', pageStarts(blocks([400, 400, 400]), 1000), [0, 800]);
check('pagină nouă (Ctrl+Enter)', pageStarts(blocks([100, 'B', 100, 'B', 100]), 1000), [0, 100, 200]);
check('paragraf mai lung decât pagina se rupe', pageStarts(blocks([200, 2500]), 1000), [0, 1000, 2000]);
check('după paragraful rupt se continuă pe ultima pagină', pageStarts(blocks([200, 2500, 200]), 1000), [0, 1000, 2000]);
check('dacă nu mai are loc, trece pe pagina următoare', pageStarts(blocks([200, 2500, 400, 400]), 1000), [0, 1000, 2000, 2700]);
check('cursorul pe pagina 2', pageOf([0, 800, 1600], 900), { page: 2, pages: 3 });
check('cursorul la început', pageOf([0, 800], 0), { page: 1, pages: 2 });
check('document gol', pageOf(pageStarts([], 1000), 0), { page: 1, pages: 1 });

console.log(fail ? `\n${fail} GREȘELI` : '\nToate testele au trecut.');
process.exit(fail ? 1 : 0);

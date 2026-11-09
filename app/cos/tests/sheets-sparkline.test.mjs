// Test pentru minigraficele din Sheets (sparkline.ts): citirea din fișier, numerele zonei, desenul (SVG valid) și locul implicit.
// Rulare (în suite/): node tests/sheets-sparkline.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import { DOMParser } from '@xmldom/xmldom';

const out = join(tmpdir(), `suite-spark-${process.pid}.mjs`);
await build({ entryPoints: ['src/sheets/sparkline.ts'], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const { cleanSparks, sparkValues, sparkSvg, sparkMap, sparkPlace, SPARK_KINDS } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

let fail = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'GREȘIT: ') + m); if (!c) fail++; };
const c = cleanSparks([{ at: 'g2', range: '$B$2:F2', kind: 'col' }, { at: 'G2', range: 'B3:F3' }, { at: 'X', range: 'A1:B1' }, { at: 'H1', range: 'nimic' }, { at: 'H2', range: 'A1:Z100' }, { at: 'H3', range: 'A1:A3', kind: 'ciudat', color: '#FF0000' }]);
ok(c.length === 2 && c[0].at === 'G2' && c[0].range === 'B2:F2' && c[0].kind === 'col', 'citirea: litere mari, fără $, una pe celulă, zonele stricate sau prea mari respinse');
ok(c[1].kind === 'line' && c[1].color === '#ff0000', 'felul necunoscut → linie; culoarea păstrată');
ok(cleanSparks('x').length === 0 && cleanSparks(null).length === 0, 'fără minigrafice în fișiere ciudate');
const cells = { B2: '1', C2: '3', D2: 'text', E2: '', F2: '=1+1' };
const results = { F2: { num: true, value: 2, text: '2' } };
ok(JSON.stringify(sparkValues('B2:F2', cells, results)) === '[1,3,null,null,2]', 'numerele zonei, cu pauze la text și gol, și din formule');
ok(JSON.stringify(sparkValues('B2:B4', { B2: '1,5', B3: '-2' }, {})) === '[1.5,-2,null]', 'virgula zecimală și coloana');
for (const [k] of SPARK_KINDS) for (const v of [[], [5], [1, 2, 3], [3, -1, 0, null, 4], [-1, -2], [0, 0, 0], Array.from({ length: 60 }, (_, i) => Math.sin(i))]) {
  const svg = sparkSvg(v, k);
  let errs = 0;
  new DOMParser({ onError: () => { errs++; } }).parseFromString(svg, 'image/svg+xml');
  ok(!errs && !svg.includes('NaN') && !svg.includes('Infinity'), `desen valid: ${k} ${JSON.stringify(v).slice(0, 30)}`);
}
ok((sparkSvg([3, -1, 2], 'col').match(/#d93025/g) ?? []).length === 1, 'coloanele negative sunt roșii');
ok((sparkSvg([3, -1, 0, 2], 'winloss').match(/<rect/g) ?? []).length === 3, 'câștig / pierdere: zero nu are bară');
const m = sparkMap([{ at: 'G2', range: 'B2:F2', kind: 'line' }], cells, results);
ok(m.G2?.startsWith('sp:url("data:image/svg+xml'), 'harta: fundalul celulei cu desenul');
ok(JSON.stringify(sparkPlace({ r0: 1, r1: 1, c0: 1, c1: 5 })) === '{"range":"B2:F2","at":"G2"}', 'un rând: minigraficul în dreapta');
ok(JSON.stringify(sparkPlace({ r0: 1, r1: 6, c0: 2, c1: 2 })) === '{"range":"C2:C7","at":"C8"}', 'o coloană: minigraficul dedesubt');
console.log(fail ? `${fail} GREȘELI` : 'TOATE OK');
process.exit(fail ? 1 : 0);

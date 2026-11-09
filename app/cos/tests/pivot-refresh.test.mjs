// Test: Rezumatul ține minte cum a fost făcut (foaia sursă și alegerile), ca Reîmprospătare să-l poată face din nou,
// și asta rămâne după salvare / deschidere (.ssheet). Rulare (în suite/): node tests/pivot-refresh.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const out = join(tmpdir(), `suite-pvref-${process.pid}`);
await build({ entryPoints: ['src/sheets/pivot.ts', 'src/sheets/format.ts'], bundle: true, format: 'esm', platform: 'node', outdir: out, logLevel: 'error' });
const { buildPivot } = await import(pathToFileURL(join(out, 'pivot.js')).href);
const { parseSheetDoc, serializeSheetDoc, emptySheetDoc } = await import(pathToFileURL(join(out, 'format.js')).href);
rmSync(out, { recursive: true, force: true });

let bad = 0;
const check = (ok, what) => { console.log((ok ? 'OK    ' : 'GRESIT') + ' ' + what); if (!ok) bad++; };
const src = { name: 'Vânzări', cells: { A1: 'Oraș', B1: 'Suma', A2: 'Cluj', B2: '10', A3: 'Iași', B3: '60' }, styles: {} };
const spec = { range: { r0: 0, c0: 0, r1: 2, c1: 1 }, rowCol: 0, valCol: 1, op: 'sum', show: 'running' };
const pv = buildPivot(src, {}, spec, 'Rezumat');
check(pv.pivot.make?.src === 'Vânzări' && pv.pivot.make.spec.show === 'running' && pv.pivot.make.spec.range.r1 === 2, 'rezumatul ține minte foaia sursă și alegerile');
check(pv.chartRange === 'A4:B6' && pv.lastCol === 1, 'zona graficului pivot fără Total: ' + pv.chartRange);
const pv2 = buildPivot({ ...src, cells: { ...src.cells, C1: 'Lună', C2: 'ian', C3: 'feb' } }, {}, { range: { r0: 0, c0: 0, r1: 2, c1: 2 }, rowCol: 0, colCol: 2, valCol: 1, op: 'sum' }, 'R2');
check(pv2.chartRange === 'A4:C6' && pv2.lastCol === 3, 'cu grupare pe coloane, fără coloana Total: ' + pv2.chartRange + ', ultima coloană ' + pv2.lastCol);
const doc = { ...emptySheetDoc(), sheets: [src, pv.sheet], pivots: [pv.pivot] };
const back = parseSheetDoc(serializeSheetDoc(doc));
const mk = back.pivots?.[0]?.make;
check(mk?.src === 'Vânzări' && mk.spec.rowCol === 0 && mk.spec.valCol === 1 && mk.spec.op === 'sum' && mk.spec.show === 'running', 'după salvare și deschidere rămâne la fel');
const broken = JSON.parse(serializeSheetDoc(doc));
broken.pivots[0].make.spec.range = { r0: -1 };
check(parseSheetDoc(JSON.stringify(broken)).pivots?.[0] && !parseSheetDoc(JSON.stringify(broken)).pivots[0].make, 'o definiție stricată se ignoră, rezumatul rămâne');
console.log(bad ? `\n${bad} verificări greșite` : '\nToate verificările au trecut');
process.exit(bad ? 1 : 0);

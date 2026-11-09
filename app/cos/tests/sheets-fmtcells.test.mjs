// Test pentru Sheets → Formatare celule (Ctrl+1): doar câmpurile schimbate se pun pe celule, codul și formatul din listă se exclud, chenarul.
// Rulare (în suite/): node tests/sheets-fmtcells.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const out = join(tmpdir(), `suite-fmtcells-${process.pid}.mjs`);
await build({
  stdin: { contents: "export * from './src/sheets/cellsFormat.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
});
const { styleChanges, formatCellsPatch, CELL_STYLES } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

const errors = [];
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) errors.push(`${m}: ${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`); };

eq(styleChanges({ b: true, color: '#ff0000' }, { b: true, color: '#ff0000' }), {}, 'nimic schimbat');
eq(styleChanges({ b: true }, { b: false, i: true }), { b: undefined, i: true }, 'aldin scos, cursiv pus');
eq(styleChanges({ fmt: 'lei', dec: 2 }, { fmt: 'lei', dec: 0 }), { dec: 0 }, 'doar zecimalele');

const cells = { A1: '5', B1: 'x', A2: '7' };
const styles = { A1: { color: '#ff0000' }, B1: { color: '#0000ff', code: '0.00' } };
const g = { r0: 0, c0: 0, r1: 1, c1: 1 };
// Aldin pe tot: culorile diferite rămân.
const p1 = formatCellsPatch(cells, styles, [g], { b: true });
eq(p1.A1, { color: '#ff0000', b: true }, 'A1 aldin');
eq(p1.B1, { color: '#0000ff', code: '0.00', b: true }, 'B1 aldin, codul rămâne');
eq(p1.B2, { b: true }, 'B2 goală tot primește aldin');
// Format din listă: scoate codul.
const p2 = formatCellsPatch(cells, styles, [g], { fmt: 'percent' });
eq(p2.B1, { color: '#0000ff', fmt: 'percent' }, 'formatul din listă scoate codul');
// Cod: scoate formatul din listă.
const p3 = formatCellsPatch(cells, { A1: { fmt: 'lei', dec: 1 } }, [{ r0: 0, c0: 0, r1: 0, c1: 0 }], { code: '#,##0 "buc."' });
eq(p3.A1, { code: '#,##0 "buc."' }, 'codul scoate formatul din listă');
// Scoaterea culorii: celula rămâne fără formatare ({}).
const p4 = formatCellsPatch(cells, styles, [{ r0: 0, c0: 0, r1: 0, c1: 0 }], { color: undefined });
eq(p4.A1, {}, 'culoare scoasă → fără formatare');
// Chenar contur, linie dublă roșie, plus umplere.
const p5 = formatCellsPatch(cells, {}, [g], { bg: '#ffff00' }, { kind: 'outline', look: { st: 'double', col: '#ff0000' } });
eq(p5.A1, { bg: '#ffff00', bd: 'tl', bdStyle: 'double', bdColor: '#ff0000' }, 'A1 contur sus-stânga');
eq(p5.B2, { bg: '#ffff00', bd: 'br', bdStyle: 'double', bdColor: '#ff0000' }, 'B2 contur jos-dreapta');
// Fără chenar: scoate liniile.
const p6 = formatCellsPatch(cells, { A1: { bd: 'tblr', bdStyle: 'thick' } }, [{ r0: 0, c0: 0, r1: 0, c1: 0 }], {}, { kind: 'none', look: {} });
eq(p6.A1, {}, 'fără chenar');
// Stilurile de celulă: Titlu 1 (mărime, aldin, linie groasă jos), apoi Normal le scoate pe toate.
const cs = (id) => CELL_STYLES.find((x) => x.id === id);
const row = { r0: 0, c0: 0, r1: 0, c1: 1 };
const h1 = formatCellsPatch(cells, {}, [row], cs('h1').ch, cs('h1').border);
eq(h1.A1, { sz: 15, b: true, color: '#44546a', bd: 'b', bdStyle: 'thick', bdColor: '#4472c4' }, 'Titlu 1');
const back = formatCellsPatch(cells, h1, [row], cs('normal').ch, cs('normal').border);
eq(back.A1, {}, 'Normal scoate tot');
const inp = formatCellsPatch(cells, {}, [{ r0: 0, c0: 0, r1: 0, c1: 0 }], cs('input').ch, cs('input').border);
eq(inp.A1.unlock, true, 'Intrare lasă celula deblocată');
for (const x of CELL_STYLES) if (!x.label || !x.id) errors.push('stil fără nume');
console.log(errors.length ? 'ERORI:\n' + errors.join('\n') : 'OK');
process.exit(errors.length ? 1 : 0);

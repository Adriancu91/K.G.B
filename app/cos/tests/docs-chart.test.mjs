// Test pentru graficele din Docs (chart.ts): descrierea păstrată pe imagine, lipirea unui tabel, desenul SVG și textul alternativ.
// Rulare (în suite/): node tests/docs-chart.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const out = join(tmpdir(), `suite-dchart-${process.pid}.mjs`);
await build({ entryPoints: ['src/docs/chart.ts'], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const { parseChart, cellsFromText, chartSvgOf, chartAlt, newChart } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

let fail = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'GREȘIT: ') + m); if (!c) fail++; };
const c = newChart();
ok(parseChart(JSON.stringify(c))?.cells.length === 5, 'graficul nou se citește înapoi');
ok(parseChart('{stricat') === null && parseChart({ t: 'col', cells: [['x']] }) === null && parseChart(null) === null, 'descrierile stricate sunt respinse');
ok(parseChart({ t: 'necunoscut', cells: [['', 'A'], ['x', '1']] })?.t === 'col', 'un fel necunoscut devine Coloane');
const big = parseChart({ t: 'line', title: 'x'.repeat(500), cells: Array.from({ length: 80 }, () => Array(20).fill('9'.repeat(100))) });
ok(big.cells.length === 30 && big.cells[0].length === 9 && big.cells[0][0].length === 60 && big.title.length === 120, 'limitele tabelului (30 × 9, 60 de litere)');
ok(parseChart({ cells: [['', 'A', 'B'], ['x']] }).cells[1].length === 3, 'rândurile scurte se completează');
const T = String.fromCharCode(9), N = String.fromCharCode(10), CR = String.fromCharCode(13);
ok(JSON.stringify(cellsFromText(['Lună' + T + 'A', 'Ian' + T + '1', 'Feb' + T + '2', ''].join(CR + N))) === JSON.stringify([['Lună', 'A'], ['Ian', '1'], ['Feb', '2']]), 'tabel lipit cu Tab (și rânduri Windows)');
ok(cellsFromText(['a;b', 'c;5'].join(N))?.[1][1] === '5', 'tabel lipit cu ;');
ok(cellsFromText('un singur rând') === null && cellsFromText(['a', 'b'].join(N)) === null, 'textul care nu e tabel nu se lipește');
const svg = chartSvgOf({ t: 'pie', title: 'Buget', cells: [['', 'Lei'], ['Chirie', '1.500'], ['Mâncare', '900']] });
ok(svg.startsWith('<svg') && svg.includes('Buget') && svg.includes('Chirie'), 'desenul are titlul și etichetele');
ok(chartAlt({ t: 'bar', title: 'Vânzări', cells: [['', 'A', 'B'], ['x', '1', '2']] }) === 'Grafic (bare): Vânzări; A, B pe o categorie', 'textul alternativ: ' + chartAlt({ t: 'bar', title: 'Vânzări', cells: [['', 'A', 'B'], ['x', '1', '2']] }));
// Aspectul (paleta, legenda, valorile, grila, umplerea, conturul) se păstrează și ajunge în desen; valorile stricate nu se iau.
const look = { t: 'col', title: 'A', cells: [['', 'Lei'], ['x', '10'], ['y', '20']], pal: 2, leg: 'none', lab: true, ng: true, bg: '#E8F0FB', ln: '#c62828' };
const lk = parseChart(JSON.stringify(look));
ok(lk.pal === 2 && lk.leg === 'none' && lk.lab === true && lk.ng === true && lk.bg === '#e8f0fb' && lk.ln === '#c62828', 'aspectul graficului se citește înapoi');
const bad = parseChart({ ...look, pal: 99, leg: 'x', lab: 'da', ng: 1, bg: 'red', ln: '#12' });
ok(!('pal' in bad) && !('leg' in bad) && !('lab' in bad) && !('ng' in bad) && !('bg' in bad) && !('ln' in bad), 'aspectul stricat e ignorat');
const ls = chartSvgOf(lk);
ok(ls.includes('fill="#e8f0fb"') && ls.includes('stroke="#c62828"') && !ls.includes('stroke="#e3e3e3"') && ls.includes('class="dl"'), 'desenul are fundalul, conturul, valorile și nu are grilă');
const fk = parseChart(JSON.stringify({ ...look, fn: 'Georgia', ink: '#1F3864' }));
ok(fk.fn === 'Georgia' && fk.ink === '#1f3864', 'fontul și culoarea textului se citesc înapoi');
ok(!('fn' in parseChart({ ...look, fn: 'x"><y' })) && !('ink' in parseChart({ ...look, ink: 'blue' })), 'fontul / culoarea stricate sunt ignorate');
const fs2 = chartSvgOf(fk);
ok(fs2.includes('font-family="Georgia, Segoe UI') && fs2.includes('fill="#1f3864"'), 'desenul are fontul și culoarea textului alese');
console.log(fail ? `\n${fail} verificări greșite` : '\nToate verificările au trecut.');
process.exit(fail ? 1 : 0);

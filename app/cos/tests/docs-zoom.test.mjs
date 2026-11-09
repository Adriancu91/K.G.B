// Test pentru zoom-ul din Docs: treptele (ca în Chrome), limitele 50–200% și „Lățime pagină”.
// Rulare (în suite/): node tests/docs-zoom.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const out = join(tmpdir(), `suite-docszoom-${process.pid}.mjs`);
await build({ entryPoints: ['src/zoom.ts'], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const { nextZoom, fitZoom, fitPageZoom, clampZoom, loadZoom, saveZoom } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

let fail = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ' ' + extra}`); if (!ok) fail++; };

check('100 → 110 → 125', nextZoom(100, 1) === 110 && nextZoom(110, 1) === 125);
check('100 → 90 → 80', nextZoom(100, -1) === 90 && nextZoom(90, -1) === 80);
check('de la o valoare oarecare (133) la treapta vecină', nextZoom(133, 1) === 150 && nextZoom(133, -1) === 125);
check('limitele: 200 rămâne 200, 50 rămâne 50', nextZoom(200, 1) === 200 && nextZoom(50, -1) === 50);
check('clamp', clampZoom(10) === 50 && clampZoom(500) === 200 && clampZoom(99.6) === 100);
check('lățime: pagina A4 (794 px) în 1200 px', fitZoom(1200, 794) === 145, String(fitZoom(1200, 794)));
check('lățime: fereastră îngustă → minimum 50', fitZoom(300, 794) === 50);
check('lățime: date lipsă → 100', fitZoom(0, 794) === 100 && fitZoom(1000, 0) === 100);
// Fără localStorage (Node): nu se strică, întoarce 100.
check('fără memorie: 100, fără eroare', loadZoom() === 100 && (saveZoom(120), true));
const store = new Map();
globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
saveZoom(125);
check('se ține minte', loadZoom() === 125);
store.set('suite.docs.zoom', 'stricat');
check('valoare stricată → 100', loadZoom() === 100);
saveZoom(75, 'suite.sheets.zoom');
check('fiecare modul cu zoom-ul lui', loadZoom('suite.sheets.zoom') === 75 && loadZoom() === 100);

// O pagină: toată pagina A4 (816 × 1154 la 100%) încape în zonă; contează latura care încape mai greu.
check('O pagină: pe un ecran lat contează înălțimea', fitPageZoom(1600, 800, 816, 1154) === Math.floor(((800 - 32) / 1154) * 100), String(fitPageZoom(1600, 800, 816, 1154)));
check('O pagină: pe o zonă îngustă contează lățimea', fitPageZoom(500, 2000, 816, 1154) === 55, String(fitPageZoom(500, 2000, 816, 1154)));
check('O pagină: limita de jos 50%', fitPageZoom(300, 300, 816, 1154) === 50);
check('O pagină: limita de sus 200%', fitPageZoom(5000, 5000, 816, 1154) === 200);
check('O pagină: zonă fără mărime → 100%', fitPageZoom(0, 0, 816, 1154) === 100);
if (fail) { console.log(`\n${fail} verificări greșite`); process.exit(1); }
console.log('\nToate verificările au trecut.');

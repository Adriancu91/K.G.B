// Test pentru citirea desenelor .wmf / .emf (src/metafile.ts → SVG).
// Rulare (în suite/): node tests/metafile.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import JSZip from 'jszip';

const out = join(tmpdir(), `suite-metafile-${process.pid}.mjs`);
await build({ entryPoints: ['src/metafile.ts'], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const { wmfToSvg, emfToSvg, metafileToSvg, metafileToUrl } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

let fail = 0;
const ok = (cond, msg) => { if (!cond) { fail++; console.log('GREȘIT:', msg); } else console.log('ok:', msg); };

// --- WMF făcut de mână: fereastra 0..100 × 0..50, pensulă roșie, dreptunghi, text „Salut”.
function wmf(records) {
  const body = records.flat();
  const words = (a) => a.flatMap((v) => [v & 255, (v >> 8) & 255]);
  const rec = (fn, params) => { const size = 3 + params.length; return [...words([size & 0xffff, size >> 16, fn]), ...words(params)]; };
  const recs = body.length ? records.map(([fn, p]) => rec(fn, p)).flat() : [];
  const header = words([1, 9, 0x300, 0, 0, 1, 0, 0, 0]);
  return new Uint8Array([...header, ...recs, ...rec(0, [])]);
}
const red = [0x00ff, 0x0000]; // COLORREF 0x000000ff (R=255) ca două cuvinte
const s = 'Salut', txt = [...s].map((c) => c.charCodeAt(0));
const strWords = []; for (let i = 0; i < txt.length; i += 2) strWords.push(txt[i] | ((txt[i + 1] ?? 0) << 8));
const w1 = wmf([
  [0x020b, [0, 0]], // SETWINDOWORG y, x
  [0x020c, [50, 100]], // SETWINDOWEXT y, x
  [0x02fc, [0, ...red, 0]], // CREATEBRUSHINDIRECT solid roșu → obiectul 0
  [0x012d, [0]], // SELECTOBJECT 0
  [0x041b, [40, 90, 10, 10]], // RECTANGLE bottom, right, top, left
  [0x0521, [s.length, ...strWords, 30, 20]], // TEXTOUT
]);
const svg1 = wmfToSvg(w1);
ok(svg1 && /width="1200" height="600"/.test(svg1), 'WMF: mărimea după fereastră (2:1)');
ok(svg1 && /<path d="M120 120L1080 120L1080 480L120 480Z" fill="#ff0000"/.test(svg1), 'WMF: dreptunghiul roșu la locul lui');
ok(svg1 && />Salut<\/text>/.test(svg1), 'WMF: textul');
ok(metafileToSvg(w1) === svg1, 'metafileToSvg recunoaște WMF');
ok(wmfToSvg(new Uint8Array([1, 2, 3])) === null, 'WMF stricat → null');

// --- EMF făcut de mână: antet + elipsă albastră + EOF.
function emf() {
  const recs = [];
  const r = (type, ints) => { const b = new DataView(new ArrayBuffer(8 + 4 * ints.length)); b.setUint32(0, type, true); b.setUint32(4, 8 + 4 * ints.length, true); ints.forEach((v, i) => b.setInt32(8 + 4 * i, v, true)); return new Uint8Array(b.buffer); };
  const head = new DataView(new ArrayBuffer(88));
  head.setUint32(0, 1, true); head.setUint32(4, 88, true);
  [0, 0, 199, 99].forEach((v, i) => head.setInt32(8 + 4 * i, v, true)); // Bounds (pixeli)
  [0, 0, 5292, 2646].forEach((v, i) => head.setInt32(24 + 4 * i, v, true)); // Frame (0,01 mm) ≈ 200 × 100 px la 96 dpi
  head.setUint32(40, 0x464d4520, true);
  [1920, 1080, 508, 286].forEach((v, i) => head.setInt32(72 + 4 * i, v, true)); // Device, Millimeters
  recs.push(new Uint8Array(head.buffer));
  recs.push(r(39, [1, 0, 0xff0000, 0])); // CREATEBRUSHINDIRECT ih=1 solid albastru (0x00BBGGRR)
  recs.push(r(37, [1])); // SELECTOBJECT 1
  recs.push(r(37, [0x80000008])); // NULL_PEN
  recs.push(r(42, [0, 0, 200, 100])); // ELLIPSE
  recs.push(r(14, [0, 16, 20]));
  const all = new Uint8Array(recs.reduce((a, b) => a + b.length, 0));
  let o = 0; for (const b of recs) { all.set(b, o); o += b.length; }
  return all;
}
const svg2 = emfToSvg(emf());
ok(svg2 && /fill="#0000ff"/.test(svg2) && /stroke="none"/.test(svg2) && /C/.test(svg2), 'EMF: elipsa albastră fără contur');
ok(metafileToSvg(emf()) === svg2, 'metafileToSvg recunoaște EMF');
const url = await metafileToUrl(emf());
ok(url?.startsWith('data:image/svg+xml;base64,'), 'metafileToUrl în afara ferestrei → SVG');

// --- Un .rtf cu desenul WMF de mai sus (\pict\wmetafile8, hex): în HTML apare ca poză, nu se mai sare.
const rout = join(tmpdir(), `suite-rtf-${process.pid}.mjs`);
await build({ entryPoints: ['src/docs/rtfImport.ts'], bundle: true, format: 'esm', platform: 'node', outfile: rout, logLevel: 'error' });
const { rtfToHtml } = await import(pathToFileURL(rout).href);
rmSync(rout, { force: true });
const BS = String.fromCharCode(92);
const hexW = Array.from(w1, (b) => b.toString(16).padStart(2, '0')).join('');
const rtf = `{${BS}rtf1${BS}ansi{${BS}fonttbl{${BS}f0 Arial;}}${BS}pard Desen: {${BS}pict${BS}wmetafile8${BS}picw100${BS}pich50${BS}picwgoal1500${BS}pichgoal750 ${hexW}}${BS}par}`;
const res = await rtfToHtml(new TextEncoder().encode(rtf));
ok(res.html.includes('<img src="data:image/svg+xml;base64,') && res.warnings === 0, '.rtf: desenul WMF devine poză, fără avertismente');

// --- Fișierele reale din colecție (dacă există): fiecare desen dă un SVG cu ceva în el.
const corpus = '../test-corpus';
const files = [['pptx/bug62513.pptx', 9], ['docx/VariousPictures.docx', 3], ['xlsx/WithDrawing.xlsx', 3], ['pptx/KEY02.pptx', 1], ['pptx/customGeo.pptx', 1], ['docx/drawing.docx', 1]];
for (const [f, n] of files) {
  if (!existsSync(join(corpus, f))) { console.log('(sărit, lipsește)', f); continue; }
  const zip = await JSZip.loadAsync(readFileSync(join(corpus, f)));
  const mfs = Object.keys(zip.files).filter((p) => /\.(wmf|emf)$/i.test(p));
  let good = 0;
  for (const p of mfs) { const s = metafileToSvg(await zip.file(p).async('uint8array')); if (s && /<(path|text|image|g)\b/.test(s)) good++; }
  ok(good === n, `${f}: ${good} din ${mfs.length} desene citite (așteptat ${n})`);
}

if (fail) { console.log(`\n${fail} verificări greșite`); process.exit(1); }
console.log('\nToate verificările au trecut.');

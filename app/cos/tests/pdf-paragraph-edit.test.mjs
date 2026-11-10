// Test pentru „Editează text” pe paragraf în PDF: rândurile se adună în paragrafe (aceeași margine, mărime și pas;
// alineatul primului rând; cuvântul despărțit cu cratimă lipit la loc; titlul și coloana vecină rămân separate), iar textul
// nou se reașază pe lățimea paragrafului, cu același pas între rânduri, și textul vechi dispare.
// Rulare (în suite/): node tests/pdf-paragraph-edit.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument } from 'pdf-lib';

const entry = join(tmpdir(), `suite-para-entry-${process.pid}.ts`);
writeFileSync(entry, `export * from ${JSON.stringify(join(process.cwd(), 'src/pdf/replaceText.ts'))};\nexport * from ${JSON.stringify(join(process.cwd(), 'src/pdf/paragraphs.ts'))};\n`);
const out = join(tmpdir(), `suite-para-${process.pid}.mjs`);
await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error', external: ['pdfjs-dist'] });
const { replaceTextPdf, segOf, paragraphsOf, paragraphAt, wrapLines } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });
rmSync(entry, { force: true });
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
const reg = readFileSync('node_modules/pdfjs-dist/standard_fonts/LiberationSans-Regular.ttf');

let fail = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ' ' + extra}`); if (!ok) fail++; };

// wrapLines
const m = (s) => s.length;
check('wrapLines: cuvintele pe rânduri', JSON.stringify(wrapLines('aa bb cc dd', () => 5, m)) === '["aa bb","cc dd"]', JSON.stringify(wrapLines('aa bb cc dd', () => 5, m)));
check('wrapLines: \\n = paragraf nou', JSON.stringify(wrapLines('aa\nbb cc', () => 9, m)) === '["aa","bb cc"]');
check('wrapLines: cuvânt prea lung singur pe rând', JSON.stringify(wrapLines('a lunguuuuu b', () => 4, m)) === '["a","lunguuuuu","b"]');

const H = 600;
const pdf = await PDFDocument.create();
pdf.registerFontkit(fontkit);
const f = await pdf.embedFont(reg, { subset: true });
const pg = pdf.addPage([500, H]);
pg.drawText('Titlul documentului', { x: 50, y: 540, size: 20, font: f });
// Paragraful 1: primul rând retras, trei rânduri la 15 pt, o despărțire în silabe.
pg.drawText('Primul paragraf are alineat la', { x: 70, y: 500, size: 12, font: f });
pg.drawText('început și continuă pe rândul al doi-', { x: 50, y: 485, size: 12, font: f });
pg.drawText('lea, apoi se termină aici.', { x: 50, y: 470, size: 12, font: f });
// Paragraful 2 (după un spațiu mai mare).
pg.drawText('Al doilea paragraf e separat de primul', { x: 50, y: 430, size: 12, font: f });
pg.drawText('printr-un spațiu mai mare.', { x: 50, y: 415, size: 12, font: f });
// O coloană în dreapta, la aceleași înălțimi: nu se lipește de paragraful 1.
pg.drawText('Nota din dreapta', { x: 330, y: 500, size: 12, font: f });
pg.drawText('pe două rânduri', { x: 330, y: 485, size: 12, font: f });
const src = await pdf.save();

const items = async (bytes) => {
  const d = await pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: false, standardFontDataUrl: 'node_modules/pdfjs-dist/standard_fonts/' }).promise;
  const p = await d.getPage(1);
  return (await p.getTextContent()).items.filter((it) => 'str' in it);
};
// Blocurile ca în TextEdit.pageBlocks (pagina nerotită: y de sus).
const blocksOf = (its) => its.map((it, i) => ({ it, i })).filter(({ it }) => it.str && (it.str.trim() || it.width > 0)).map(({ it, i }) => {
  const s = segOf(it, 0, it.str.length, 1, true);
  return { i, str: it.str, x: s.x, y: H - s.y - s.size * 0.98, w: s.width, h: s.size * 1.26, size: s.size, flat: true, ...(it.str.trim() ? {} : { ws: true }) };
});
const its = await items(src);
const blocks = blocksOf(its);
const paras = paragraphsOf(blocks);
check('trei paragrafe găsite (titlul nu)', paras.length === 3, paras.map((p) => p.str).join(' | '));
const p1 = paras.find((p) => p.str.startsWith('Primul'));
check('paragraful 1: textul lipit, cu cratima scoasă', p1?.str === 'Primul paragraf are alineat la început și continuă pe rândul al doilea, apoi se termină aici.', p1?.str);
check('paragraful 1: 3 bucăți, pasul 15 pt', p1?.lines?.length === 3 && Math.abs(p1.lead - 15) < 0.5, `${p1?.lines?.length} ${p1?.lead}`);
check('paragraful 2 separat', paras.some((p) => p.str === 'Al doilea paragraf e separat de primul printr-un spațiu mai mare.'));
check('coloana din dreapta separată', paras.some((p) => p.str === 'Nota din dreapta pe două rânduri'));
const titleB = blocks.find((b) => b.str.startsWith('Titlul'));
check('fără alte paragrafe din spații', paras.every((p) => p.str.trim()));
check('titlul nu e în niciun paragraf', !paragraphAt(paras, titleB));
check('paragraphAt găsește paragraful după al doilea rând', paragraphAt(paras, blocks.find((b) => b.str.startsWith('lea')))?.str === p1?.str);

// Reașezarea: un text mai lung, cu diacritice.
const segs = p1.lines.map((b, k) => segOf(its[b.i], 0, its[b.i].str.length, 1, !k));
const nou = 'Primul paragraf are acum un text mult mai lung, care nu mai încape pe trei rânduri, așa că paragraful crește în jos, cu același pas.';
const outB = await replaceTextPdf(src, segs, nou, { regular: reg }, true);
const its2 = await items(outB);
const all = its2.map((x) => x.str).join(' ');
check('textul vechi a dispărut', !all.includes('alineat la') && !all.includes('doi-'), all);
check('celelalte paragrafe neatinse', all.includes('Al doilea paragraf e separat de primul') && all.includes('Nota din dreapta'));
const newIts = its2.filter((x) => x.transform[5] <= 501 && x.transform[5] > 380 && x.transform[4] < 320 && !x.str.startsWith('Al doilea') && !x.str.startsWith('printr-un') && x.str.trim());
const joined = newIts.map((x) => x.str).join(' ').replace(/\s+/g, ' ').trim();
check('textul nou e tot acolo', joined === nou, joined);
check('mai multe rânduri decât înainte', newIts.length > 3, String(newIts.length));
check('primul rând retras (x 70), restul la 50', Math.abs(newIts[0].transform[4] - 70) < 0.5 && newIts.slice(1).every((x) => Math.abs(x.transform[4] - 50) < 0.5), newIts.map((x) => x.transform[4]).join(','));
const ys = newIts.map((x) => x.transform[5]);
check('pasul 15 pt între rânduri', ys.every((y, k) => !k || Math.abs(ys[k - 1] - y - 15) < 0.3) && Math.abs(ys[0] - 500) < 0.3, ys.join(','));
const right = Math.max(...segs.map((s) => s.x + s.width));
check('niciun rând nu trece de marginea dreaptă', newIts.every((x) => x.transform[4] + x.width <= right + 0.5), `${right} ${newIts.map((x) => (x.transform[4] + x.width).toFixed(1)).join(',')}`);

// Shift+Enter: paragraf nou în casetă → rând nou de la margine.
const out2 = await replaceTextPdf(src, segs, 'Scurt.\nAl doilea rând nou.', { regular: reg }, true);
const its3 = (await items(out2)).filter((x) => x.transform[5] <= 501 && x.transform[5] > 470 && x.transform[4] < 320 && x.str.trim());
check('\\n → rând nou la marginea paragrafului', its3.length === 2 && its3[1].str === 'Al doilea rând nou.' && Math.abs(its3[1].transform[4] - 50) < 0.5 && Math.abs(its3[1].transform[5] - 485) < 0.3, its3.map((x) => `${x.str}@${x.transform[4]},${x.transform[5]}`).join(' '));

// Alinierea: un paragraf la centru, unul la dreapta și unul stânga-dreapta (cuvinte desenate cu spații întinse).
const pdfA = await PDFDocument.create();
pdfA.registerFontkit(fontkit);
const fa = await pdfA.embedFont(reg, { subset: true });
const pa = pdfA.addPage([500, H]);
const center = (t, y) => pa.drawText(t, { x: 250 - fa.widthOfTextAtSize(t, 12) / 2, y, size: 12, font: fa });
const toRight = (t, y) => pa.drawText(t, { x: 450 - fa.widthOfTextAtSize(t, 12), y, size: 12, font: fa });
center('Un text pus la mijlocul paginii', 560); center('pe două rânduri', 545);
toRight('Strada Florilor nr. 10', 500); toRight('Brașov, România', 485);
const just = ['Acest paragraf este aliniat la', 'ambele margini ale paginii, ca', 'în documentele oficiale.'];
just.forEach((t, k) => {
  const words = t.split(' '), y = 440 - k * 15;
  if (k === just.length - 1) { pa.drawText(t, { x: 50, y, size: 12, font: fa }); return; }
  const gap = (400 - words.reduce((a, w) => a + fa.widthOfTextAtSize(w, 12), 0)) / (words.length - 1);
  let x = 50;
  for (const w of words) { pa.drawText(w, { x, y, size: 12, font: fa }); x += fa.widthOfTextAtSize(w, 12) + gap; }
});
const srcA = await pdfA.save();
const itsA = await items(srcA);
const parasA = paragraphsOf(blocksOf(itsA));
const pc = parasA.find((p) => p.str.startsWith('Un text pus'));
const pr = parasA.find((p) => p.str.startsWith('Strada'));
const pj = parasA.find((p) => p.str.startsWith('Acest paragraf'));
check('paragraful la centru recunoscut', pc?.align === 'center' && pc.str === 'Un text pus la mijlocul paginii pe două rânduri', JSON.stringify(pc && [pc.str, pc.align]));
check('paragraful la dreapta recunoscut', pr?.align === 'right' && pr.str === 'Strada Florilor nr. 10 Brașov, România', JSON.stringify(pr && [pr.str, pr.align]));
check('paragraful stânga-dreapta recunoscut', pj?.align === 'justify' && pj.str === 'Acest paragraf este aliniat la ambele margini ale paginii, ca în documentele oficiale.', JSON.stringify(pj && [pj.str, pj.align]));
check('paragraful obișnuit rămâne la stânga', !p1.align);
const segsOf = (p, its) => p.lines.map((b, k) => segOf(its[b.i], 0, its[b.i].str.length, 1, !k));
const near = (a, b) => Math.abs(a - b) < 0.6;
{
  const o = await items(await replaceTextPdf(srcA, segsOf(pc, itsA), 'Un text nou, ceva mai lung, tot la mijlocul paginii', { regular: reg }, 'center'));
  const L = o.filter((x) => x.transform[5] > 520 && x.str.trim());
  check('la centru: rândurile noi au mijlocul la 250', L.length >= 2 && L.every((x) => near(x.transform[4] + x.width / 2, 250)), L.map((x) => (x.transform[4] + x.width / 2).toFixed(1)).join(','));
}
{
  const o = await items(await replaceTextPdf(srcA, segsOf(pr, itsA), 'Strada Teilor nr. 7, bloc A, Brașov', { regular: reg }, 'right'));
  const L = o.filter((x) => x.transform[5] > 470 && x.transform[5] < 520 && x.str.trim());
  check('la dreapta: rândurile noi se termină la 450', L.length >= 2 && L.every((x) => near(x.transform[4] + x.width, 450)), L.map((x) => (x.transform[4] + x.width).toFixed(1)).join(','));
}
{
  const nouJ = 'Acest paragraf este aliniat la ambele margini ale paginii și are acum mai multe cuvinte, ca să se vadă bine reașezarea pe rânduri întinse până la marginea din dreapta a paginii.';
  const o = await items(await replaceTextPdf(srcA, segsOf(pj, itsA), nouJ, { regular: reg }, 'justify'));
  const L = o.filter((x) => x.transform[5] < 450 && x.transform[5] > 300 && x.str.trim());
  const rows = [...new Set(L.map((x) => Math.round(x.transform[5])))].sort((a, b) => b - a);
  const ends = rows.map((y) => Math.max(...L.filter((x) => Math.round(x.transform[5]) === y).map((x) => x.transform[4] + x.width)));
  const starts = rows.map((y) => Math.min(...L.filter((x) => Math.round(x.transform[5]) === y).map((x) => x.transform[4])));
  check('stânga-dreapta: rândurile pline până la 450, ultimul mai scurt', rows.length >= 3 && ends.slice(0, -1).every((e) => near(e, 450)) && ends[ends.length - 1] < 440 && starts.every((s) => near(s, 50)), `${rows.join(',')} | ${ends.map((e) => e.toFixed(1)).join(',')}`);
  check('stânga-dreapta: textul întreg', L.map((x) => x.str).join(' ').split(/\s+/).join(' ').trim() === nouJ);
}

// Un cuvânt aldin în mijlocul paragrafului rămâne aldin după reașezare; cuvintele noi se scriu ca paragraful.
{
  const boldB = readFileSync('node_modules/pdfjs-dist/standard_fonts/LiberationSans-Bold.ttf');
  const pdfB = await PDFDocument.create();
  pdfB.registerFontkit(fontkit);
  const fr = await pdfB.embedFont(reg, { subset: true }), fb = await pdfB.embedFont(boldB, { subset: true });
  const pb = pdfB.addPage([500, H]);
  const run = (parts, y) => { let x = 50; for (const [t, f] of parts) { pb.drawText(t, { x, y, size: 12, font: f }); x += f.widthOfTextAtSize(t, 12); } };
  run([['Acesta este un paragraf cu un cuvânt ', fr], ['important', fb], [' în', fr]], 500);
  run([['mijloc, scris pe două rânduri.', fr]], 485);
  const srcB = await pdfB.save();
  const itsB = await items(srcB);
  const pB = paragraphsOf(blocksOf(itsB)).find((p) => p.str.startsWith('Acesta'));
  check('paragraful cu cuvântul aldin găsit', !!pB && pB.str === 'Acesta este un paragraf cu un cuvânt important în mijloc, scris pe două rânduri.', pB?.str);
  const sB = pB.lines.map((b, k) => ({ ...segOf(itsB[b.i], 0, itsB[b.i].str.length, 1, !k), str: itsB[b.i].str, ...(itsB[b.i].str === 'important' ? { run: { bold: true } } : {}) }));
  check('bucata aldină are stilul ei', sB.filter((s) => s.run).length === 1);
  const nouB = 'Am schimbat începutul: acesta este un paragraf cu un cuvânt important, păstrat aldin, în mijloc, scris acum pe mai multe rânduri.';
  const o = await items(await replaceTextPdf(srcB, sB, nouB, { regular: reg, bold: boldB }, true));
  const L = o.filter((x) => x.transform[5] <= 501 && x.str.trim());
  check('textul nou e tot acolo (cu cuvântul aldin)', L.map((x) => x.str).join('').split(' ').join('') === nouB.split(' ').join(''), L.map((x) => x.str).join('|'));
  const imp = L.find((x) => x.str.trim() === 'important,' || x.str.trim() === 'important');
  const wB = await PDFDocument.create().then(async (d) => { d.registerFontkit(fontkit); return [await d.embedFont(boldB), await d.embedFont(reg)]; });
  check('„important” scris aldin (lățimea fontului aldin)', !!imp && near(imp.width, wB[0].widthOfTextAtSize(imp.str, 12)) && !near(imp.width, wB[1].widthOfTextAtSize(imp.str, 12)), JSON.stringify(imp && [imp.str, imp.width]));
  const nb = L.find((x) => x.str.includes('păstrat'));
  check('cuvintele noi scrise obișnuit', !!nb && near(nb.width, wB[1].widthOfTextAtSize(nb.str, 12)), JSON.stringify(nb && [nb.str, nb.width]));
  check('rândurile la margine, cu pasul 15', L.every((x) => x.transform[4] >= 49.5) && [...new Set(L.map((x) => Math.round(x.transform[5])))].length >= 2, L.map((x) => `${x.str}@${x.transform[4].toFixed(0)},${x.transform[5].toFixed(0)}`).join(' '));
}

console.log(fail ? `\n${fail} GREȘELI` : '\nTOATE TESTELE AU TRECUT');
process.exit(fail ? 1 : 0);

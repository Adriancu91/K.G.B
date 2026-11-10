// Test pentru „Găsește și înlocuiește” în PDF: potrivirile știu ce litere ating din fiecare bucată de text, textul nou
// se scrie ca text adevărat (cu diacritice) în locul celui vechi, la aceeași mărime, și pe pagini rotite; textul mai lung
// se micșorează puțin; „aldin” folosește fontul aldin; fontul nou urmează felul celui vechi (serife / monospațiat / cursiv).
// Rulare (în suite/): node tests/pdf-replacetext.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, degrees } from 'pdf-lib';

const entry = join(tmpdir(), `suite-repl-entry-${process.pid}.ts`);
writeFileSync(entry, `export * from ${JSON.stringify(join(process.cwd(), 'src/pdf/replaceText.ts'))};\nexport { findInPage } from ${JSON.stringify(join(process.cwd(), 'src/pdf/find.ts'))};\n`);
const out = join(tmpdir(), `suite-repl-${process.pid}.mjs`);
await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error', external: ['pdfjs-dist'] });
const { replaceTextPdf, segOf, segBox, findInPage, fontStyleOf } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });
rmSync(entry, { force: true });
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
const reg = readFileSync('node_modules/pdfjs-dist/standard_fonts/LiberationSans-Regular.ttf');
const bold = readFileSync('node_modules/pdfjs-dist/standard_fonts/LiberationSans-Bold.ttf');
const italic = readFileSync('node_modules/pdfjs-dist/standard_fonts/LiberationSans-Italic.ttf');
const boldItalic = readFileSync('node_modules/pdfjs-dist/standard_fonts/LiberationSans-BoldItalic.ttf');

let fail = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ' ' + extra}`); if (!ok) fail++; };

const pdf = await PDFDocument.create();
pdf.registerFontkit(fontkit);
const f = await pdf.embedFont(reg, { subset: true });
const p1 = pdf.addPage([500, 400]);
p1.drawText('Contract nr. 123 semnat de Ion Popescu la Brașov.', { x: 50, y: 300, size: 14, font: f });
p1.drawText('Ion Popescu plătește chiria.', { x: 50, y: 250, size: 12, font: f });
const p2 = pdf.addPage([400, 500]);
p2.setRotation(degrees(90));
p2.drawText('Beneficiar: Ion Popescu', { x: 60, y: 200, size: 16, font: f });
const src = await pdf.save();

const read = async (bytes) => {
  const doc = await pdfjs.getDocument({ data: bytes.slice(), disableFontFace: true, useSystemFonts: false }).promise;
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const tc = await (await doc.getPage(i)).getTextContent();
    pages.push(tc.items.filter((it) => 'str' in it));
  }
  await doc.loadingTask.destroy();
  return pages;
};

const pages = await read(src);
const segs = [];
const hits = [];
pages.forEach((items, k) => {
  const pt = { items: items.map((it) => it.str), eol: items.map((it) => it.hasEOL) };
  for (const m of findInPage(pt, 'ion popescu', k + 1)) {
    hits.push(m);
    m.parts.forEach(([i, a, b], j) => segs.push(segOf(items[i], a, b, k + 1, j === 0)));
  }
});
check('trei potriviri, cu literele atinse', hits.length === 3 && hits.every((m) => m.parts.length >= 1), JSON.stringify(hits));
const first = pages[0][hits[0].parts[0][0]];
check('litera de început a potrivirii e „I”', first.str.slice(hits[0].parts[0][1], hits[0].parts[0][2]).startsWith('Ion'), first.str);
check('mărimea literelor citită (14)', Math.abs(segs[0].size - 14) < 0.01, String(segs[0].size));
check('pe pagina rotită unghiul rămâne al textului (0°)', Math.abs(segs.find((s) => s.page === 2).angle) < 0.01);
const bx = segBox(segs[0]);
check('albul acoperă și codițele (sub linia de bază)', bx[1] < 300 && bx[3] > 300 + 14 * 0.9, JSON.stringify(bx));

const outBytes = await replaceTextPdf(src, segs, 'Maria Ștefănescu', { regular: reg, bold });
const after = await read(outBytes);
const all1 = after[0].map((it) => it.str).join('|');
check('textul nou apare ca text, cu diacritice', all1.includes('Maria Ștefănescu'), all1);
const neu = after[0].filter((it) => it.str.includes('Maria Ștefănescu'));
check('de două ori pe prima pagină', neu.length === 2, String(neu.length));
const sameLine = neu.find((it) => Math.abs(it.transform[5] - 300) < 0.5);
check('pe același rând și la începutul cuvântului vechi', !!sameLine && Math.abs(sameLine.transform[4] - segs[0].x) < 0.5, JSON.stringify(sameLine?.transform));
const sz = Math.hypot(sameLine.transform[2], sameLine.transform[3]);
check('textul mai lung se micșorează puțin, nu sub 80%', sz < 14 && sz >= 14 * 0.8 - 0.01, String(sz));
check('și pe pagina rotită', after[1].some((it) => it.str.includes('Maria Ștefănescu')));

const bseg = [{ ...segs[0], bold: true }];
const outB = await replaceTextPdf(src, bseg, 'X', { regular: reg, bold });
const docB = await PDFDocument.load(outB);
const names = [];
docB.context.enumerateIndirectObjects().forEach(([, o]) => { const n = o?.get?.(docB.context.obj('BaseFont')); if (n) names.push(n.toString()); });
check('aldin folosește fontul aldin', names.some((n) => /Bold/.test(n)), names.join(' '));

// Felul fontului vechi, din numele lui din PDF.
// Câmpul font (numele fontului vechi, pentru refolosire) nu contează aici.
const st = (n) => { const { font: _f, ...r } = fontStyleOf(n); return JSON.stringify(r); };
check('Times New Roman aldin cursiv', st('ABCDEF+TimesNewRomanPS-BoldItalicMT') === JSON.stringify({ bold: true, italic: true, family: 'serif' }), st('ABCDEF+TimesNewRomanPS-BoldItalicMT'));
check('Arial obișnuit: fără serife', st('BCDEEE+ArialMT') === JSON.stringify({ bold: false, italic: false }), st('BCDEEE+ArialMT'));
check('Courier New: monospațiat', fontStyleOf('CourierNewPSMT').family === 'mono');
check('Liberation Sans nu e „cu serife”', fontStyleOf('LiberationSans-Regular').family === undefined);
const fontsOf = async (bytes) => { const d = await PDFDocument.load(bytes); const out = []; d.context.enumerateIndirectObjects().forEach(([, o]) => { const n = o?.get?.(d.context.obj('BaseFont')); if (n) out.push(n.toString()); }); return out.join(' '); };
const all4 = { regular: reg, bold, italic, boldItalic };
const fSer = await fontsOf(await replaceTextPdf(src, [{ ...segs[0], family: 'serif', bold: true }], 'Contract', all4));
check('cu serife, aldin, fără ș / ț / ă: Times aldin', /Times-Bold/.test(fSer), fSer);
const fSerRo = await fontsOf(await replaceTextPdf(src, [{ ...segs[0], family: 'serif' }], 'Brașov', all4));
check('cu serife, dar cu ș: rămâne fontul cu diacritice', !/Times/.test(fSerRo) && /Liberation/.test(fSerRo), fSerRo);
const fIt = await fontsOf(await replaceTextPdf(src, [{ ...segs[0], italic: true }], 'Ștefan', all4));
check('cursiv: fontul cursiv', /Italic/.test(fIt), fIt);
const fMono = await fontsOf(await replaceTextPdf(src, [{ ...segs[0], family: 'mono' }], 'ABC 123', all4));
check('monospațiat: Courier', /Courier/.test(fMono), fMono);
const outRo = await read(await replaceTextPdf(src, [{ ...segs[0], family: 'serif' }], 'Brașov', all4));
check('textul cu ș se citește înapoi corect', outRo[0].some((it) => it.str.includes('Brașov')));

console.log(fail ? `\n${fail} verificări greșite` : '\nToate verificările au trecut.');
process.exit(fail ? 1 : 0);

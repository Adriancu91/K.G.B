// Test pentru comentariile cu fir din Sheets în .xlsx (threadedComments + persons + comentariul clasic): scrise valid, citite înapoi.
// Rulare (în suite/): node tests/sheets-comments-xlsx.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';

const dir = join(tmpdir(), `suite-cmtxlsx-${process.pid}`);
await build({ entryPoints: ['src/sheets/xlsx.ts', 'src/sheets/format.ts', 'src/sheets/odsExport.ts'], bundle: true, format: 'esm', platform: 'node', outdir: dir, logLevel: 'error' });
const { readXlsx, writeXlsx } = await import(pathToFileURL(join(dir, 'xlsx.js')).href);
const fmt = await import(pathToFileURL(join(dir, 'format.js')).href);
rmSync(dir, { recursive: true, force: true });

let fail = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'GREȘIT: ') + m); if (!c) fail++; };
const valid = (xml) => { let errs = 0; new DOMParser({ onError: () => { errs++; } }).parseFromString(xml, 'text/xml'); return !errs; };

const thread = [
  { a: 'Ana Pop', t: '2026-10-27T06:15:00.000Z', x: 'Poți verifica suma <din> martie & aprilie?' },
  { a: 'Ion', t: '2026-10-27T07:02:00.000Z', x: 'Da, e corectă.\nAm verificat facturile.' },
];
const styles = {
  B2: { b: true, cmt: thread, cdone: true },
  C3: { cmt: [{ a: 'Ion', t: '2026-10-27T08:00:00.000Z', x: 'Cine a pus asta?' }] },
  D4: { note: 'notă simplă' },
};
const bytes = await writeXlsx([{ sheet: { name: 'Foaia 1', colW: {}, cells: { B2: '100', C3: 'x', D4: '1' }, styles }, results: {} }]);
const zip = await JSZip.loadAsync(bytes);
const get = async (p) => (await zip.file(p)?.async('string')) ?? '';
const tc = await get('xl/threadedComments/threadedComment1.xml');
const ps = await get('xl/persons/person.xml');
const cm = await get('xl/comments1.xml');
const ct = await get('[Content_Types].xml');
const srels = await get('xl/worksheets/_rels/sheet1.xml.rels');
const ws = await get('xl/worksheets/sheet1.xml');
ok(tc && valid(tc), 'threadedComment1.xml există și e XML valid');
ok(ps && valid(ps) && ps.includes('displayName="Ana Pop"') && ps.includes('displayName="Ion"'), 'persons cu cei doi autori');
ok((tc.match(/<threadedComment /g) ?? []).length === 3, '3 mesaje în fire');
ok(/ref="B2"[^>]*done="1"/.test(tc), 'firul din B2 e rezolvat');
ok(/parentId="\{[0-9A-F-]+\}"/.test(tc), 'răspunsul are parentId');
ok(tc.includes('&lt;din&gt; martie &amp; aprilie'), 'textul e scăpat corect');
ok(valid(cm) && cm.includes('[Threaded comment]') && cm.includes('notă simplă') && /<author>tc=\{[0-9A-F-]+\}<\/author>/.test(cm), 'comentariul clasic: locul firului + nota simplă');
ok(ct.includes('application/vnd.ms-excel.threadedcomments+xml') && ct.includes('application/vnd.ms-excel.person+xml'), 'tipurile de conținut');
ok(srels.includes('relationships/threadedComment') && srels.includes('/comments"') && srels.includes('/vmlDrawing"'), 'legăturile foii');
const vmlId = /<Relationship Id="(rId\d+)" Type="[^"]*\/vmlDrawing"/.exec(srels)?.[1];
ok(vmlId && ws.includes(`<legacyDrawing r:id="${vmlId}"/>`), 'legacyDrawing trimite la desenul VML (' + vmlId + ')');
// Celula cu comentariu nu primește un stil Excel din cauza lui (doar aldinul din B2).
ok(/<c r="C3" t="s">|<c r="C3" t="inlineStr">|<c r="C3"[^>]*>/.test(ws) && !/<c r="C3" s=/.test(ws), 'comentariul nu schimbă stilul celulei');

const back = (await readXlsx(bytes)).sheets[0].styles;
ok(JSON.stringify(back.B2?.cmt) === JSON.stringify(thread), 'firul din B2 citit înapoi: ' + JSON.stringify(back.B2?.cmt));
ok(back.B2?.cdone === true && back.B2?.b === true, 'rezolvat + aldin păstrate');
ok(back.B2?.note === undefined && back.C3?.note === undefined, 'textul „[Threaded comment]” nu devine notă');
ok(back.C3?.cmt?.length === 1 && back.C3.cmt[0].a === 'Ion' && !back.C3.cdone, 'firul din C3');
ok(back.D4?.note === 'notă simplă' && !back.D4.cmt, 'nota simplă rămâne notă');

// Fișierul nostru: curățarea la deschidere.
{
  const raw = { A1: { cmt: [{ a: 'X', t: 'nu e dată', x: 'ok' }, { a: 5, x: '' }, 'gunoi'], cdone: true }, A2: { cmt: 'nu e listă', cdone: true } };
  const c = fmt.parseSheetDoc(JSON.stringify({ format: 'suite-sheet', version: 1, sheets: [{ name: 'F', cells: {}, styles: raw }] })).sheets[0].styles;
  ok(c.A1?.cmt?.length === 1 && c.A1.cmt[0].t === '' && c.A1.cdone === true, 'firul curățat la deschidere');
  ok(!c.A2, 'un fir stricat nu lasă nimic');
}
console.log(fail ? `${fail} GREȘELI` : 'TOATE OK');
process.exit(fail ? 1 : 0);

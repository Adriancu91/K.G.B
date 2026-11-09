// Test pentru Docs → stilurile noi create de utilizator (panoul Stiluri → ＋ Stil nou): curățare, foaia de stil, .sdoc și .docx.
// Rulare (în suite/): node tests/docs-customstyles.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import JSZip from 'jszip';

const out = join(tmpdir(), `suite-customst-${process.pid}.mjs`);
await build({
  stdin: { contents: "export * from './src/docs/docStyles.ts'; export { docToDocx } from './src/docs/docx.ts'; export { NO_PAGE_SETUP, parseDoc, serializeDoc } from './src/docs/format.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
});
const { cleanStyles, cleanCustom, stylesCss, newStyleId, styleSet, docToDocx, NO_PAGE_SETUP, parseDoc, serializeDoc } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

const errors = [];
const ok = (c, m) => { if (!c) errors.push(m); };

const custom = [{ id: 'sabc123', name: 'Avertisment', def: { size: 13, color: '#c00000', bold: true } }];
ok(JSON.stringify(cleanCustom(custom)) === JSON.stringify(custom), 'stilul bun rămâne la fel');
ok(cleanCustom([{ id: 'A B', name: 'x' }, { id: 'ok1', name: '' }, { id: 'ok2', name: '<b>' }, 5]) === undefined, 'stilurile greșite se scot');
ok(cleanCustom([{ id: 'a1', name: 'X' }, { id: 'a1', name: 'Y' }]).length === 1, 'id-uri dublate: doar primul');
ok(cleanCustom(Array.from({ length: 60 }, (_, i) => ({ id: 'a' + i, name: 'S' + i }))).length === 40, 'cel mult 40 de stiluri');
const st = cleanStyles({ h1: { color: '#ff0000' }, custom });
ok(st.custom?.[0]?.name === 'Avertisment' && st.h1?.color === '#ff0000', 'cleanStyles păstrează stilurile noi');
const css = stylesCss(st, '[data-docstyles="d"]');
ok(css.includes('[data-docstyles="d"] .ProseMirror [data-cstyle="sabc123"]') && css.includes('#c00000') && css.includes('13pt'), 'foaia de stil are regula stilului nou');
const id = newStyleId(custom);
ok(/^[a-z0-9]{1,12}$/.test(id) && id !== 'sabc123', 'id nou valid: ' + id);
ok(styleSet('modern').custom === undefined, 'seturile nu au stiluri noi');

// .sdoc dus-întors
const content = { type: 'doc', content: [
  { type: 'paragraph', attrs: { cstyle: 'sabc123' }, content: [{ type: 'text', text: 'Atenție la termen.' }] },
  { type: 'paragraph', content: [{ type: 'text', text: 'Text normal.' }] },
] };
const back = parseDoc(serializeDoc(content, { ...NO_PAGE_SETUP, styles: st }));
ok(back.page?.styles?.custom?.[0]?.id === 'sabc123', '.sdoc păstrează stilul nou');
// .docx: stilul cu numele lui în styles.xml și paragraful care îl folosește
const zip = await JSZip.loadAsync(await docToDocx(content, { ...NO_PAGE_SETUP, styles: st }));
const stylesXml = await zip.file('word/styles.xml').async('string');
const docXml = await zip.file('word/document.xml').async('string');
ok(/w:styleId="Suitesabc123"/.test(stylesXml) && stylesXml.includes('w:val="Avertisment"'), '.docx: stilul „Avertisment” în styles.xml');
ok(/<w:pStyle w:val="Suitesabc123"\/>/.test(docXml), '.docx: paragraful folosește stilul');
ok((docXml.match(/Suitesabc123/g) ?? []).length === 1, '.docx: doar primul paragraf are stilul');
console.log(errors.length ? 'ERORI:\n' + errors.join('\n') : 'OK');
process.exit(errors.length ? 1 : 0);

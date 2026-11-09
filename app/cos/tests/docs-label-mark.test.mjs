// Test: Docs → Proprietăți → Clasificare: marcajul pe pagină (numele clasificării în subsol și / sau ca filigran), pus, schimbat și scos.
// Rulare (în suite/): node tests/docs-label-mark.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const out = join(tmpdir(), `suite-lblmark-${process.pid}.mjs`);
await build({ entryPoints: [join(process.cwd(), 'src/docs/format.ts')], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error', loader: { '.css': 'empty' } });
const { markLabel, labelMarkOf, NO_PAGE_SETUP, parseDoc, serializeDoc, emptyDoc } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

let bad = 0;
const check = (ok, what, extra = '') => { console.log((ok ? 'OK    ' : 'GRESIT') + ' ' + what + (ok ? '' : ' ' + extra)); if (!ok) bad++; };
const both = { footer: true, watermark: true }, none = { footer: false, watermark: false };

const p0 = { ...NO_PAGE_SETUP };
check(JSON.stringify(labelMarkOf(p0)) === JSON.stringify(none), 'pagina goală: fără marcaj');
const p1 = markLabel(p0, 'confidential', both);
check(p1.footer === 'Confidențial' && p1.watermark === 'CONFIDENȚIAL', 'subsol gol: doar clasificarea; filigran cu majuscule', JSON.stringify(p1));
check(JSON.stringify(labelMarkOf(p1)) === JSON.stringify(both), 'marcajul se recunoaște');
const p2 = markLabel(p1, 'strict', both);
check(p2.footer === 'Strict confidențial' && p2.watermark === 'STRICT CONFIDENȚIAL', 'altă clasificare: o înlocuiește pe cea veche', JSON.stringify(p2));
const p3 = markLabel({ ...p0, footer: 'Firma SRL', watermark: 'CIORNĂ' }, 'public', both);
check(p3.footer === 'Firma SRL · Public' && p3.watermark === 'PUBLIC', 'subsolul utilizatorului rămâne, clasificarea după el', JSON.stringify(p3));
const p4 = markLabel(p3, 'general', { footer: true, watermark: false });
check(p4.footer === 'Firma SRL · Uz general' && p4.watermark === undefined, 'filigranul debifat se scoate; subsolul se schimbă', JSON.stringify(p4));
const p5 = markLabel(p4, undefined, both);
check(p5.footer === 'Firma SRL' && p5.watermark === undefined, 'fără clasificare: marcajul dispare, subsolul utilizatorului rămâne', JSON.stringify(p5));
const p6 = markLabel({ ...p0, watermark: 'CIORNĂ' }, 'public', none);
check(p6.watermark === 'CIORNĂ' && p6.footer === '', 'filigranul utilizatorului nu se atinge când nu se cere marcaj', JSON.stringify(p6));
const back = parseDoc(serializeDoc(emptyDoc().content, { ...p1, props: { label: 'confidential' } }));
check(back.page?.footer === 'Confidențial' && back.page?.watermark === 'CONFIDENȚIAL', 'marcajul se păstrează în fișierul Suite', JSON.stringify(back.page));

console.log(bad ? `${bad} GRESITE` : 'Toate trec.');
process.exit(bad ? 1 : 0);

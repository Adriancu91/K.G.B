// Test pentru BAHTTEXT (suma în cuvinte thailandeze, cu baht și satang), cu valorile din Excel.
// Rulare (în suite/): node tests/formula-bahttext.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const out = join(tmpdir(), `suite-baht-${process.pid}.mjs`);
await build({ entryPoints: ['src/sheets/formula.ts'], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const { evaluateAll } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

const cases = [
  ['1234', 'หนึ่งพันสองร้อยสามสิบสี่บาทถ้วน'], ['1', 'หนึ่งบาทถ้วน'], ['11', 'สิบเอ็ดบาทถ้วน'], ['21', 'ยี่สิบเอ็ดบาทถ้วน'],
  ['101', 'หนึ่งร้อยเอ็ดบาทถ้วน'], ['100', 'หนึ่งร้อยบาทถ้วน'], ['1000000', 'หนึ่งล้านบาทถ้วน'], ['21000000', 'ยี่สิบเอ็ดล้านบาทถ้วน'],
  ['0', 'ศูนย์บาทถ้วน'], ['1/2', 'ห้าสิบสตางค์'], ['-49/4', 'ลบสิบสองบาทยี่สิบห้าสตางค์'], ['"abc"', '#VALUE!'],
];
const cells = Object.fromEntries(cases.map(([v], i) => [`A${i + 1}`, `=BAHTTEXT(${v})`]));
const r = evaluateAll(cells, { self: 'Foaia1', sheets: [] });
let fail = 0;
cases.forEach(([v, want], i) => {
  const got = r[`A${i + 1}`]?.text;
  const ok = got === want;
  console.log(`${ok ? 'ok ' : 'GREȘIT'} BAHTTEXT(${v}) = ${got}${ok ? '' : ` (trebuia ${want})`}`);
  if (!ok) fail++;
});
if (fail) { console.log(`\n${fail} verificări greșite`); process.exit(1); }
console.log('\nToate verificările au trecut');

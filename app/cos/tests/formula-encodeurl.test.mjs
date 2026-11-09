// Test pentru ENCODEURL și PHONETIC (FILTERXML cere navigatorul: tests/cdp/cdp-sheets-filterxml.mjs).
// Rulare (în suite/): node tests/formula-encodeurl.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const out = join(tmpdir(), `suite-encurl-${process.pid}.mjs`);
await build({ entryPoints: ['src/sheets/formula.ts'], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const { evaluateAll } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

const cells = {
  A1: 'Ana Maria', A2: '42',
  B1: '=ENCODEURL("http://contoso.sharepoint.com/Finance/Profit and Loss Statement.xlsx")',
  B2: '=ENCODEURL("a(b)*c!d\'e~f")', B3: '=ENCODEURL("ăîș")', B4: '=PHONETIC(A1)', B5: '=PHONETIC(A1:A2)', B6: '=PHONETIC(A2)',
};
const want = {
  B1: 'http%3A%2F%2Fcontoso.sharepoint.com%2FFinance%2FProfit%20and%20Loss%20Statement.xlsx',
  B2: 'a%28b%29%2Ac%21d%27e~f', B3: '%C4%83%C3%AE%C8%99', B4: 'Ana Maria', B5: 'Ana Maria', B6: '42',
};
const r = evaluateAll(cells, { self: 'Foaia1', sheets: [{ name: 'Foaia1', cells }] });
let fail = 0;
for (const [k, w] of Object.entries(want)) {
  const got = r[k]?.text ?? String(r[k]);
  if (got === w) console.log(`ok: ${k} = ${w}`); else { fail++; console.log(`GREȘIT: ${k} = ${got}, trebuia ${w}`); }
}
if (fail) { console.log(`\n${fail} verificări greșite`); process.exit(1); }
console.log('\nToate verificările au trecut.');

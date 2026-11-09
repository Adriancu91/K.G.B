// Test pentru formatele de număr scrise ca cod (Sheets: TEXT și, mai departe, Formatare celule → Particularizat).
// Rulare (în suite/): node tests/sheets-fmtcode.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const out = join(tmpdir(), `suite-fmtcode-${process.pid}.mjs`);
await build({ entryPoints: ['src/sheets/fmtcode.ts'], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const { formatCode, codeFromLocal } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

let fail = 0;
const eq = (v, code, want, color) => {
  const r = formatCode(v, code);
  const ok = r.text === want && (color === undefined || r.color === color);
  console.log(`${ok ? 'ok ' : 'GREȘIT'} ${JSON.stringify(v)} „${code}” → „${r.text}”${r.color ? ' ' + r.color : ''}${ok ? '' : ` (aștept „${want}”${color ? ' ' + color : ''})`}`);
  if (!ok) fail++;
};
const DAY = 86400000, EPOCH = Date.UTC(1899, 11, 30);
const serial = (y, m, d) => (Date.UTC(y, m - 1, d) - EPOCH) / DAY;

eq(1234.567, '#,##0.00', '1.234,57');
eq(1234.567, '0', '1235');
eq(0.5, '0%', '50%');
eq(0.1234, '0.0%', '12,3%');
eq(-1234.5, '#,##0.00 "lei"', '-1.234,50 lei');
eq(-5, '0;[Red](0)', '(5)', '#ff0000');
eq(5, '0;[Red](0)', '5');
eq(0, '0;-0;"zero"', 'zero');
eq('abc', '0;-0;0;"Text: "@', 'Text: abc');
eq('abc', '0.00', 'abc');
eq('abc', '@', 'abc');
eq(1234567, '#,##0,', '1.235');
eq(1234567, '0.0,,"M"', '1,2M');
eq(0.000123, '0.00E+00', '1,23E-04');
eq(12345, '0.00E+00', '1,23E+04');
eq(12345, '##0.0E+0', '12,3E+3');
eq(1.25, '# ?/?', '1 1/4');
eq(0.75, '?/?', '3/4');
eq(2.5, '# ?/8', '2 4/8');
eq(3, '# ?/?', '3');
eq(0.3333, '# ??/??', ' 1/3 ');
eq(45, '000', '045');
eq(5551234567, '000-000-0000', '555-123-4567');
eq(1.5, '0.0#', '1,5');
eq(1.567, '0.0#', '1,57');
eq(3, '#.##', '3,');
eq(-0.001, '0.00', '0,00');
eq(1234.5, 'General', '1234,5');
eq(7, '"Nr. "0', 'Nr. 7');
eq(7, String.fromCharCode(92) + '#0', '#7');
eq(1500, '[$€-x-euro2] #,##0', '€ 1.500');
eq(150, '[>100][Green]0;[Red]0', '150', '#008000');
eq(50, '[>100][Green]0;[Red]0', '50', '#ff0000');
const s = serial(2026, 10, 18);
eq(s, 'dd.mm.yyyy', '18.10.2026');
eq(s, 'd mmmm yyyy', '18 octombrie 2026');
eq(s, 'dddd', 'duminică');
eq(s, 'mmm-yy', 'oct-26');
eq(s + 0.5, 'dd.mm.yyyy hh:mm', '18.10.2026 12:00');
eq(1.5, '[h]:mm', '36:00');
eq(0.75, 'h:mm AM/PM', '6:00 PM');
eq(0.25 + 30 / 86400, 'hh:mm:ss', '06:00:30');
eq(1.5 / 86400 + 60 / 86400, 'mm:ss.0', '01:01,5');
eq(true, '0', 'ADEVĂRAT');

const loc = (c, want) => { const g = codeFromLocal(c); const ok = g === want; console.log(`${ok ? 'ok ' : 'GREȘIT'} cod românesc „${c}” → „${g}”`); if (!ok) fail++; };
loc('#.##0,00', '#,##0.00');
loc('0,00', '0.00');
loc('#,##0', '#,##0');
loc('zz.ll.aaaa', 'dd.mm.yyyy');
loc('dd-mmm-yyyy', 'dd-mmm-yyyy');
loc('0,0 "lei, net"', '0.0 "lei, net"');

console.log(fail ? `${fail} GREȘELI` : 'Toate testele formatelor-cod au trecut.');
process.exit(fail ? 1 : 0);

// Test pentru „Dată și oră” din Docs: formatele românești și formatul ținut minte pentru Alt+Shift+D.
// Rulare (în suite/): node tests/docs-datetime.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const out = join(tmpdir(), `suite-datetime-${process.pid}.mjs`);
await build({ entryPoints: ['src/docs/dateTime.ts'], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const mem = new Map();
globalThis.localStorage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)) };
const { formatDate, DATE_FORMATS, lastDateFormat, rememberDateFormat } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

let fail = 0;
const check = (name, ok) => { console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}`); if (!ok) fail++; };
const d = new Date(2026, 9, 19, 5, 7, 3); // luni, 19 octombrie 2026, 05:07:03
const want = {
  'zz.ll.aaaa': '19.10.2026', 'z luna aaaa': '19 octombrie 2026', 'zi, z luna aaaa': 'luni, 19 octombrie 2026', 'zz/ll/aaaa': '19/10/2026',
  'aaaa-ll-zz': '2026-10-19', 'luna aaaa': 'octombrie 2026', 'zz.ll.aaaa oo:mm': '19.10.2026 05:07', 'oo:mm': '05:07', 'oo:mm:ss': '05:07:03',
};
for (const [id] of DATE_FORMATS) check(`${id} → ${want[id]}`, formatDate(d, id) === want[id]);
check('1 martie, cu zero în față', formatDate(new Date(2027, 2, 1), 'zz.ll.aaaa') === '01.03.2027' && formatDate(new Date(2027, 2, 1), 'zi, z luna aaaa') === 'luni, 1 martie 2027');
check('format necunoscut → zz.ll.aaaa', formatDate(d, 'xyz') === '19.10.2026');
check('implicit pentru Alt+Shift+D: zz.ll.aaaa', lastDateFormat() === 'zz.ll.aaaa');
rememberDateFormat('z luna aaaa');
check('ține minte formatul ales', lastDateFormat() === 'z luna aaaa');
rememberDateFormat('oo:mm');
check('ora nu înlocuiește formatul datei', lastDateFormat() === 'z luna aaaa');
console.log(fail ? `\n${fail} verificări GREȘITE` : '\nToate verificările au trecut.');
process.exit(fail ? 1 : 0);

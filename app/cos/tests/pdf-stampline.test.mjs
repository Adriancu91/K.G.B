// Test pentru rândul de sub ștampila dinamică: data, data și ora, numele și data (ca ștampilele dinamice din Acrobat).
// Rulare (în suite/): node tests/pdf-stampline.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const out = join(process.cwd(), 'node_modules', '.cache', `suite-stampline-${process.pid}.mjs`);
await build({ entryPoints: [join(process.cwd(), 'src/pdf/sign.ts')], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error', external: ['pdfjs-dist'] });
const { stampLine } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

let fails = 0;
const check = (name, got, want) => { const ok = got === want; console.log((ok ? 'OK   ' : 'GREȘIT ') + name + ' — ' + got); if (!ok) fails++; };
const d = new Date(2026, 0, 5, 9, 7);
check('doar data', stampLine(d, {}), '05.01.2026');
check('data și ora', stampLine(d, { time: true }), '05.01.2026 09:07');
check('numele și data', stampLine(d, { name: ' Ion Pop ' }), 'Ion Pop · 05.01.2026');
check('nume gol = doar data și ora', stampLine(d, { time: true, name: '  ' }), '05.01.2026 09:07');
console.log(fails ? `${fails} GREȘITE` : 'TOATE TREC');
process.exit(fails ? 1 : 0);

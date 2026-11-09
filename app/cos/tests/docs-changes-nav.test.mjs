// Test pentru „Anterioara / Următoarea” la modificările urmărite din Docs: ordinea, întoarcerea la început și la sfârșit.
// Rulare (în suite/): node tests/docs-changes-nav.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const out = join(tmpdir(), `suite-docschg-${process.pid}.mjs`);
await build({ stdin: { contents: "export { nearChange } from './src/docs/track.ts';", resolveDir: process.cwd(), loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const { nearChange } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

let fail = 0;
const check = (name, got, want) => { const ok = got === want; console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ` → ${got} (trebuia ${want})`}`); if (!ok) fail++; };
const ch = [{ from: 5, to: 9 }, { from: 20, to: 25 }, { from: 40, to: 41 }];
const at = (c) => c?.from ?? null;

check('următoarea de la început', at(nearChange(ch, 1, 1)), 5);
check('următoarea când ești pe una', at(nearChange(ch, 5, 1)), 20);
check('următoarea din mijlocul uneia', at(nearChange(ch, 22, 1)), 40);
check('după ultima, înapoi la prima', at(nearChange(ch, 40, 1)), 5);
check('anterioara', at(nearChange(ch, 40, -1)), 20);
check('anterioara din text', at(nearChange(ch, 30, -1)), 20);
check('înaintea primei, la ultima', at(nearChange(ch, 5, -1)), 40);
check('fără modificări', nearChange([], 3, 1), null);

console.log(fail ? `\n${fail} GREȘELI` : '\nToate testele au trecut.');
process.exit(fail ? 1 : 0);

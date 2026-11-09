// Test pentru Docs → seturile de stiluri (panoul Stiluri): recunoașterea setului, copia independentă, foaia de stil și ordinea stilurilor.
// Rulare (în suite/): node tests/docs-stylesets.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const out = join(tmpdir(), `suite-stylesets-${process.pid}.mjs`);
await build({
  stdin: { contents: "export * from './src/docs/docStyles.ts'; export { BLOCK_STYLES } from './src/docs/paraStyle.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
});
const { STYLE_SETS, styleSet, styleSetOf, stylesCss, cleanStyles, BLOCK_STYLES } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

const errors = [];
const ok = (c, m) => { if (!c) errors.push(m); };
ok(STYLE_SETS.length >= 5, 'prea puține seturi');
ok(styleSetOf(undefined) === 'implicit', 'documentul fără stiluri nu e „Implicit”');
for (const [id] of STYLE_SETS) {
  const st = styleSet(id);
  ok(styleSetOf(st) === id, `setul ${id} nu se recunoaște după aplicare`);
  ok(JSON.stringify(cleanStyles(st)) === JSON.stringify(st), `setul ${id} are câmpuri greșite`);
}
const modern = styleSet('modern');
modern.h1.color = '#ff0000';
ok(styleSetOf(modern) === '', 'un set schimbat de mână trebuie să fie „Particularizat”');
ok(styleSet('modern').h1.color !== '#ff0000', 'schimbarea a atins setul însuși');
ok(styleSet('nu-exista') === undefined, 'set necunoscut');
const css = stylesCss(styleSet('clasic'), '[data-docstyles="x"]');
ok(css.includes('Times New Roman') && css.includes('h1') && css.includes('#1f2a44'), 'foaia de stil a setului Clasic');
ok(BLOCK_STYLES.map(([v]) => v).join(',') === 'p,title,subtitle,caption,quote,h1,h2,h3,h4,h5,h6', 'ordinea stilurilor: ' + BLOCK_STYLES.map(([v]) => v).join(','));
console.log(errors.length ? 'ERORI:\n' + errors.join('\n') : 'OK');
process.exit(errors.length ? 1 : 0);

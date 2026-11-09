// Test pentru „Mergi la” din Docs: țintele de fiecare fel și saltul la următorul / anteriorul (cu reluare de la capăt).
// Rulare (în suite/): node tests/docs-goto.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const out = join(tmpdir(), `suite-goto-${process.pid}.mjs`);
await build({
  stdin: { contents: `export * from './src/docs/goTo.ts'; export { getSchema } from '@tiptap/core'; export { default as StarterKit } from '@tiptap/starter-kit';
export { Comment } from './src/docs/comment.ts';`, resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
});
const { goTargets, stepTarget, containingTarget, getSchema, StarterKit, Comment } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

let fail = 0;
const check = (name, got, want) => { const g = JSON.stringify(got), w = JSON.stringify(want); const ok = g === w; console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ` → ${g} (trebuia ${w})`}`); if (!ok) fail++; };
const schema = getSchema([StarterKit, Comment]);
const doc = schema.nodeFromJSON({ type: 'doc', content: [
  { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Unu' }] },
  { type: 'paragraph', content: [{ type: 'text', text: 'ab', marks: [{ type: 'comment', attrs: { id: 'c1' } }] }, { type: 'text', text: ' x ' }, { type: 'text', text: 'cd', marks: [{ type: 'comment', attrs: { id: 'c2' } }] }] },
  { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Doi' }] },
  { type: 'paragraph', content: [{ type: 'text', text: 'final' }] },
] });
const h = goTargets(doc, 'heading');
check('2 titluri', h.length, 2);
check('2 comentarii (câte unul pe id)', goTargets(doc, 'comment').length, 2);
check('niciun tabel', goTargets(doc, 'table'), []);
check('următorul titlu după cursor', stepTarget(h, 1, 1), h[1]);
check('după ultimul, se reia de la primul', stepTarget(h, h[1] + 1, 1), h[0]);
check('anteriorul', stepTarget(h, h[1] + 1, -1), h[1]);
check('cursorul în titlul 2: ținta lui e titlul 2', containingTarget(doc, h, h[1] + 1), h[1]);
check('cursorul în text: nicio țintă', containingTarget(doc, h, h[1] + 7), null);
check('anteriorul de la sfârșit → titlul 2', stepTarget(h, doc.content.size - 1, -1), h[1]);
check('înaintea primului, se reia de la ultimul', stepTarget(h, 0, -1), h[1]);
check('fără ținte: null', stepTarget([], 3, 1), null);
console.log(fail ? `\n${fail} verificări GREȘITE` : '\nToate verificările au trecut.');
process.exit(fail ? 1 : 0);

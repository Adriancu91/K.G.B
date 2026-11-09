// Test: linia de semnătură completată la semnarea digitală (src/docs/signFill.ts): numele din certificat deasupra liniei,
// data în rândul „Data: ____”, linia cu numele semnatarului aleasă înaintea celorlalte, documentul inițial neschimbat.
// Rulare (în suite/): node tests/docs-signfill.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import assert from 'node:assert/strict';

const dir = join(tmpdir(), `suite-signfill-${process.pid}`);
await build({ entryPoints: ['src/docs/signFill.ts'], bundle: true, format: 'esm', platform: 'node', outdir: dir, logLevel: 'error', external: ['@tiptap/*'] });
const { fillSignatureLine, SIGN_LINE, SIGNED_PREFIX } = await import(pathToFileURL(join(dir, 'signFill.js')).href);
rmSync(dir, { recursive: true, force: true });

const p = (text, bold) => ({ type: 'paragraph', content: text ? [{ type: 'text', text, ...(bold ? { marks: [{ type: 'bold' }] } : {}) }] : undefined });
const block = (name, title) => [p(''), p(SIGN_LINE), p(name, true), ...(title ? [p(title)] : []), p('Data: ' + '_'.repeat(14))];
const text = (n) => (n?.text ?? '') + (n?.content ?? []).map(text).join('');
const when = new Date(2026, 9, 31, 17, 0);

// Două linii: Ion Popescu și Ana Ștefănescu; semnează „Ana Stefanescu” (fără diacritice în certificat) → a doua linie.
const doc = { type: 'doc', content: [p('Contract'), ...block('Ion Popescu', 'Administrator'), ...block('Ana Ștefănescu', 'Director')] };
const before = JSON.stringify(doc);
const r = fillSignatureLine(doc, 'Ana Stefanescu', when);
assert.equal(r.filled, true);
assert.equal(JSON.stringify(doc), before, 'documentul inițial rămâne neschimbat');
const b = r.doc.content;
assert.equal(text(b[1]), '', 'prima linie (Ion) rămâne goală');
assert.equal(text(b[5]), 'Data: ' + '_'.repeat(14));
assert.equal(text(b[6]), SIGNED_PREFIX + 'Ana Stefanescu');
assert.equal(b[6].content[0].marks[0].type, 'italic');
assert.equal(text(b[10]), 'Data: 31.10.2026');

// Al doilea semnatar, pe copia deja semnată: Ion, linia lui; linia Anei nu se mai atinge.
const r2 = fillSignatureLine(r.doc, 'ION POPESCU', when);
assert.equal(text(r2.doc.content[1]), SIGNED_PREFIX + 'ION POPESCU');
assert.equal(text(r2.doc.content[5]), 'Data: 31.10.2026');
assert.equal(text(r2.doc.content[6]), SIGNED_PREFIX + 'Ana Stefanescu');

// Nume necunoscut → prima linie liberă; fără rând de dată → doar numele.
const r3 = fillSignatureLine({ type: 'doc', content: [p(''), p(SIGN_LINE), p('Altcineva', true), p('Text')] }, 'Maria', when);
assert.equal(text(r3.doc.content[0]), SIGNED_PREFIX + 'Maria');
assert.equal(text(r3.doc.content[3]), 'Text');

// Toate liniile semnate sau niciuna → nimic de completat.
assert.equal(fillSignatureLine(r2.doc, 'X', when).filled, false);
assert.equal(fillSignatureLine({ type: 'doc', content: [p('Doar text')] }, 'X', when).filled, false);
console.log('OK: linia de semnătură completată la semnarea digitală');

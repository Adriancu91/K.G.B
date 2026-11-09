// Test pentru exportul .rtf (Docs → Alt format, PDF → Ca text): structura RTF, diacritice, formatare, liste, tabele.
// Rulare (în suite/): node tests/docs-rtf.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import assert from 'node:assert/strict';

// În proiect (nu în %TEMP%), ca @tiptap/* lăsat în afara pachetului să se găsească în node_modules.
const dir = join(process.cwd(), 'node_modules', '.cache', `suite-rtf-${process.pid}`);
await build({ entryPoints: ['src/docs/plainExport.ts'], bundle: true, format: 'esm', platform: 'node', outdir: dir, logLevel: 'error', external: ['@tiptap/*'] });
const { docJsonToRtf, rtfEscape } = await import(pathToFileURL(join(dir, 'plainExport.js')).href);
rmSync(dir, { recursive: true, force: true });
const B = String.fromCharCode(92);
let n = 0;
const has = (s, part, m) => { n++; assert.ok(s.includes(part), m + ': lipsește ' + JSON.stringify(part)); };

assert.equal(rtfEscape('a{b}c' + B), 'a' + B + '{b' + B + '}c' + B + B); n++;
assert.equal(rtfEscape('ăș'), B + 'u259?' + B + 'u537?'); n++;
assert.equal(rtfEscape('€'), B + 'u8364?'); n++;
assert.equal(rtfEscape('😀'), B + 'u-10179?' + B + 'u-8704?'); n++;
const doc = { type: 'doc', content: [
  { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Raport lunar' }] },
  { type: 'paragraph', content: [{ type: 'text', text: 'Text ' }, { type: 'text', text: 'aldin', marks: [{ type: 'bold' }] }, { type: 'text', text: ' și ' },
    { type: 'text', text: 'link', marks: [{ type: 'link', attrs: { href: 'https://exemplu.ro' } }] }, { type: 'hardBreak' }, { type: 'text', text: 'rând nou' }] },
  { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'unu' }] },
    { type: 'orderedList', attrs: { start: 3 }, content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'trei' }] }] }] }] }] },
  { type: 'table', content: [
    { type: 'tableRow', content: [{ type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Nume' }] }] }, { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Sumă' }] }] }] },
    { type: 'tableRow', content: [{ type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Ana' }] }] }, { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: '10' }] }] }] },
  ] },
  { type: 'pageBreak' },
  { type: 'paragraph', content: [{ type: 'text', text: 'Final' }] },
] };
const r = docJsonToRtf(doc);
assert.ok(r.startsWith('{' + B + 'rtf1' + B + 'ansi')); n++;
let depth = 0, min = 0;
for (let i = 0; i < r.length; i++) { if (r[i] === B) { i++; continue; } if (r[i] === '{') depth++; if (r[i] === '}') { depth--; min = Math.min(min, depth); } }
assert.equal(depth, 0, 'acoladele se închid toate'); assert.equal(min, 0); n += 2;
has(r, '{' + B + 'b' + B + 'fs40 Raport lunar}', 'titlu');
has(r, '{' + B + 'b aldin}', 'aldin');
has(r, 'HYPERLINK "https://exemplu.ro"', 'legătură');
has(r, B + 'line rând nou'.replace('â', B + 'u226?'), 'rând nou în paragraf');
has(r, B + 'u8226?' + B + 'tab unu', 'bulină');
has(r, B + 'li720' + B + 'fi-360' + B + 'tx720 3.' + B + 'tab trei', 'listă numerotată în listă, de la 3');
has(r, B + 'cellx4500', 'coloanele tabelului');
has(r, '{' + B + 'b Nume}' + B + 'cell', 'cap de tabel aldin');
has(r, 'Ana' + B + 'cell', 'celulă');
has(r, B + 'row', 'rând de tabel');
has(r, B + 'page', 'salt de pagină');
console.log(`OK: ${n} verificări pentru exportul .rtf`);

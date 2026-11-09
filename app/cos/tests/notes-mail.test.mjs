// Test pentru Notițe → Fișier → ✉ Trimite prin e-mail: adresa mailto: cu subiectul și textul notiței, fără semnele de formatare.
// Rulare (în suite/): node tests/notes-mail.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const out = join(tmpdir(), `suite-notesmail-${process.pid}.mjs`);
await build({ stdin: { contents: `export * from './src/notes/mail.ts';`, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const { noteMailText, noteMailto, MAIL_MAX } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

let fail = 0;
const check = (name, got, want) => { const ok = got === want; console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ` → ${JSON.stringify(got)} (trebuia ${JSON.stringify(want)})`}`); if (!ok) fail++; };
const note = (body, extra = {}) => ({ id: 'n', title: 'Cumpărături', body, created: '', updated: '', ...extra });
const parse = (url) => { const q = new URLSearchParams(url.slice(url.indexOf('?') + 1)); return { subject: q.get('subject'), body: q.get('body') }; };

check('formatarea dispare', noteMailText(note('## Lista\n**pâine** și {mare:lapte} cu ++unt++ și ~~sare~~')), 'Lista\npâine și lapte cu unt și sare');
check('bifele și bulinele rămân', noteMailText(note('☐ ouă\n☑ făină\n• zahăr')), '☐ ouă\n☑ făină\n• zahăr');
const u = noteMailto(note('Rândul 1\nRândul 2'));
check('începe cu mailto:?', u.startsWith('mailto:?subject='), true);
check('subiectul = titlul', parse(u).subject, 'Cumpărături');
check('rândurile noi ca CRLF', parse(u).body, 'Rândul 1\r\nRândul 2');
check('fără titlu: primul rând', parse(noteMailto(note('Idee nouă\nrest', { title: '' }))).subject, 'Idee nouă');
check('pozele sunt pomenite', parse(noteMailto(note('Text', { images: ['data:a', 'data:b'] }))).body.includes('2 poze în notiță'), true);
const long = parse(noteMailto(note('x'.repeat(5000)))).body;
check('textul lung se taie', long.length < MAIL_MAX + 120 && long.includes('restul e în notița din Cyber Office Studio'), true);
check('caracterele speciale sunt codate', noteMailto(note('a & b = c?')).includes('a%20%26%20b%20%3D%20c%3F'), true);

console.log(fail ? `\n${fail} GREȘITE` : '\nToate trec.');
process.exit(fail ? 1 : 0);

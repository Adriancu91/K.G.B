// Test pentru Revizuire → 🔀 Combină mai multe .docx…: copiile corectate de mai mulți oameni puse deodată peste documentul de acum,
// fiecare modificare pe numele celui care a făcut-o (rânduri inserate, șterse, schimbate cuvânt cu cuvânt, schimbate de doi oameni).
// Rulare (în suite/): node tests/docs-combine-many.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const out = join(tmpdir(), `suite-combmany-${process.pid}.mjs`);
await build({
  stdin: { contents: "export { combinedDoc } from './src/docs/compareMarked.ts'; export { diffLines } from './src/versionText.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
});
const { combinedDoc, diffLines } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

let fail = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ' ' + info}`); if (!ok) fail++; };
// Fiecare paragraf ca text: [-șters (autor)-], {+inserat (autor)+}.
const show = (doc) => doc.content.map((p) => (p.content ?? []).map((t) => {
  const m = t.marks?.[0];
  return !m ? t.text : m.type === 'deletion' ? `[-${t.text}(${m.attrs.author})-]` : `{+${t.text}(${m.attrs.author})+}`;
}).join(''));

const base = ['Contract de închiriere', 'Chiria este de 500 de lei pe lună.', 'Plata se face până pe 5 ale lunii.', 'Garanția este de o chirie.', 'Semnături'];
const ana = ['Contract de închiriere', 'Chiria este de 550 de lei pe lună.', 'Plata se face până pe 5 ale lunii.', 'Utilitățile se plătesc separat.', 'Garanția este de o chirie.', 'Semnături'];
const ion = ['Contract de închiriere', 'Chiria este de 500 de lei pe lună.', 'Plata se face până pe 10 ale lunii.', 'Semnături', 'Anexa 1'];
const rev = (lines, author) => ({ diff: diffLines(base, lines), author, date: '2026-11-01T10:00:00Z' });
const s = show(combinedDoc(base, [rev(ana, 'Ana'), rev(ion, 'Ion')]));
check('titlul rămâne neschimbat', s[0] === 'Contract de închiriere', s[0]);
check('chiria schimbată de Ana, cuvânt cu cuvânt', s[1] === 'Chiria este de [-500(Ana)-]{+550(Ana)+} de lei pe lună.', s[1]);
check('termenul schimbat de Ion', s[2] === 'Plata se face până pe [-5(Ion)-]{+10(Ion)+} ale lunii.', s[2]);
check('rândul inserat de Ana, la locul lui', s[3] === '{+Utilitățile se plătesc separat.(Ana)+}', s[3]);
check('garanția ștearsă de Ion', s[4] === '[-Garanția este de o chirie.(Ion)-]', s[4]);
check('semnăturile rămân', s[5] === 'Semnături', s[5]);
check('anexa inserată de Ion la final', s[6] === '{+Anexa 1(Ion)+}' && s.length === 7, JSON.stringify(s));

// Același rând schimbat de doi oameni: rândul vechi șters și ambele variante inserate; aceeași inserare la amândoi apare o dată.
const b2 = ['Primul rând.', 'Termenul este de 30 de zile.', 'Ultimul rând.'];
const x = ['Primul rând.', 'Termenul este de 15 zile.', 'Rând nou comun.', 'Ultimul rând.'];
const y = ['Primul rând.', 'Termenul este de 45 de zile.', 'Rând nou comun.', 'Ultimul rând.'];
const s2 = show(combinedDoc(b2, [{ diff: diffLines(b2, x), author: 'X', date: '' }, { diff: diffLines(b2, y), author: 'Y', date: '' }]));
check('rândul schimbat de doi: vechiul șters', s2[1] === '[-Termenul este de 30 de zile.(X)-]', JSON.stringify(s2));
check('rândul schimbat de doi: ambele variante', s2[2] === '{+Termenul este de 15 zile.(X)+}' && s2[3] === '{+Termenul este de 45 de zile.(Y)+}', JSON.stringify(s2));
check('inserarea comună apare o singură dată', s2.filter((p) => p.includes('Rând nou comun')).length === 1, JSON.stringify(s2));
// Un singur om, fără modificări: documentul rămâne la fel.
const s3 = show(combinedDoc(b2, [{ diff: diffLines(b2, b2), author: 'Z', date: '' }]));
check('fără modificări = documentul de acum', JSON.stringify(s3) === JSON.stringify(b2), JSON.stringify(s3));

console.log(fail ? `ERORI: ${fail}` : 'OK: Combină mai multe fișiere');
process.exit(fail ? 1 : 0);

// Test pentru Notițe → lipirea cu formatare: semnele puse de htmlpaste.ts (aldin, cursiv, subliniat, tăiat, evidențiat,
// culori, una în alta, mărimi, fonturi) se citesc înapoi corect de parseInline, iar culorile CSS ajung la culoarea din notiță potrivită.
// Rulare (în suite/): node tests/notes-pastefmt.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync, writeFileSync } from 'node:fs';

const entry = join(tmpdir(), `suite-pastefmt-entry-${process.pid}.ts`);
writeFileSync(entry, `export { parseInline } from ${JSON.stringify(join(process.cwd(), 'src/notes/inline.ts').split('\\').join('/'))};\nexport { cssRgb, nearestInk, sizeName, fontName } from ${JSON.stringify(join(process.cwd(), 'src/notes/htmlpaste.ts').split('\\').join('/'))};\n`);
const out = join(tmpdir(), `suite-pastefmt-${process.pid}.mjs`);
await build({ entryPoints: [entry], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const { parseInline, cssRgb, nearestInk, sizeName, fontName } = await import(pathToFileURL(out).href);
rmSync(out, { force: true }); rmSync(entry, { force: true });
let bad = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'GRESIT: ') + m); if (!c) bad++; };
const span = (t, s) => parseInline(t).find((p) => p.s === s) ?? {};

ok(span('a **b** c', 'b').b, '**aldin**');
const bi = span('***x***', 'x');
ok(bi.b && bi.i, '***aldin cursiv***: ' + JSON.stringify(parseInline('***x***')));
ok(span('++**u**++', 'u').b && span('++**u**++', 'u').u, '++**aldin subliniat**++');
ok(span('~~*s*~~', 's').x && span('~~*s*~~', 's').i, '~~*cursiv tăiat*~~');
const r = span('{roșu:**r**}', 'r');
ok(r.b && r.c, '{roșu:**aldin roșu**}: ' + JSON.stringify(r));
ok(span('x ==m== y', 'm').h, '==evidențiat==');
ok(span('{fundal verde:v}', 'v').hc, '{fundal verde:…}');

ok(JSON.stringify(cssRgb('#f00')) === '[255,0,0]' && JSON.stringify(cssRgb('rgb(10, 20, 30)')) === '[10,20,30]' && JSON.stringify(cssRgb('red')) === '[255,0,0]', 'culorile CSS se citesc');
ok(cssRgb('rgba(0,0,0,0)') === null, 'culoarea transparentă nu contează');
ok(nearestInk([255, 0, 0], false) === 'roșu' && nearestInk([139, 0, 0], false) === 'roșu', 'roșu și roșu închis → roșu');
ok(nearestInk([0, 0, 255], false) === 'albastru' && nearestInk([0, 128, 0], false) === 'verde', 'albastru, verde');
ok(nearestInk([255, 255, 0], true) === 'galben' && nearestInk([255, 241, 118], true) === 'galben', 'galben (și galben pal) ca fundal → galben');
ok(nearestInk([51, 51, 51], false) === null && nearestInk([0, 0, 0], false) === null && nearestInk([128, 128, 128], false) === null, 'negrul și griul rămân text obișnuit');
ok(nearestInk([255, 255, 255], true) === null && nearestInk([250, 250, 245], true) === null && nearestInk([224, 224, 224], true) === null, 'fundalul alb sau gri deschis nu se pune');
ok(nearestInk([200, 230, 201], true) === 'verde' && nearestInk([187, 222, 251], true) === 'albastru', 'fundalurile pale: verde, albastru');

// Mărimile față de textul obișnuit și fonturile din lista notițelor.
ok(sizeName(1) === null && sizeName(12 / 11) === null && sizeName(0.95) === null, 'mărimea apropiată de cea obișnuită nu se scrie');
ok(sizeName(16 / 11) === 'mare' && sizeName(9 / 11) === 'mic' && sizeName(0.7) === 'foarte mic' && sizeName(1.7) === 'foarte mare' && sizeName(24 / 11) === 'uriaș', 'mare, mic, foarte mic, foarte mare, uriaș');
ok(sizeName(0) === null && sizeName(NaN) === null, 'mărimea greșită nu se scrie');
ok(fontName('"Times New Roman", serif') === 'Times New Roman' && fontName("'georgia'") === 'Georgia' && fontName('Aptos, Calibri, sans-serif') === 'Calibri', 'fonturile cunoscute (și al doilea din listă)');
ok(fontName('Aptos') === null && fontName('sans-serif, Arial') === null, 'fontul necunoscut sau familia generică nu se scriu');
const sz = span('{font Georgia:{uriaș:{roșu:v}}}', 'v');
ok(sz.f && sz.sz === 2.2 && sz.c, '{font Georgia:{uriaș:{roșu:…}}} se citește: ' + JSON.stringify(sz));

console.log(bad ? `${bad} GRESITE` : 'TOATE BUNE');
process.exit(bad ? 1 : 0);

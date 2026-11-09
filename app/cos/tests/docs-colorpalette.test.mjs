// Test pentru paleta de culori din Docs: nuanțele (mai deschise / mai închise), culorile temei după documentul ales,
// lista culorilor recente. Rulare (în suite/): node tests/docs-colorpalette.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const out = join(tmpdir(), `suite-clrpal-${process.pid}`);
await build({ entryPoints: ['src/docs/colorPalette.ts', 'src/docs/docStyles.ts'], bundle: true, format: 'esm', platform: 'node', outdir: out, logLevel: 'error' });
const { shade, shadesOf, themeColumns, pushRecent, STANDARD_COLORS, HIGHLIGHT_COLORS } = await import(pathToFileURL(join(out, 'colorPalette.js')).href);
const { withThemeColors } = await import(pathToFileURL(join(out, 'docStyles.js')).href);
rmSync(out, { recursive: true, force: true });

let bad = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'GRESIT: ') + m); if (!c) bad++; };
ok(shade('#000000', 0.5) === '#808080' && shade('#ffffff', -0.5) === '#808080' && shade('#204060', 0) === '#204060', 'shade: negru +50% = gri, alb −50% = gri, 0 = la fel');
const s = shadesOf('#2e75b6');
ok(s.length === 5 && s.slice(0, 3).every((c) => parseInt(c.slice(1, 3), 16) > 0x2e) && s.slice(3).every((c) => parseInt(c.slice(5, 7), 16) < 0xb6), 'o culoare: 3 nuanțe mai deschise, 2 mai închise: ' + s);
ok(shadesOf('#ffffff').every((c) => c !== '#ffffff') && shadesOf('#000000').every((c) => c !== '#000000'), 'la alb doar mai închise, la negru doar mai deschise');
let t = themeColumns(undefined);
ok(t.name === 'Albastru' && t.colors.join(',') === '#000000,#ffffff,#1f4e79,#2e75b6,#1f3763', 'fără temă: albastru: ' + t.colors);
t = themeColumns(withThemeColors(undefined, 'verde'));
ok(t.name === 'Verde' && t.colors[2] === '#385723', 'cu Culorile temei: Verde, paleta ia verdele: ' + t.colors);
t = themeColumns(withThemeColors(undefined, 'negru'));
ok(t.colors.join(',') === '#000000,#ffffff', 'Alb-negru: fără dubluri: ' + t.colors);
ok(pushRecent(['#111111', '#222222'], '#222222').join(',') === '#222222,#111111' && pushRecent(Array.from({ length: 10 }, (_, i) => '#00000' + i), '#ABCDEF').length === 10, 'recente: fără dubluri, cel mult 10, cea nouă prima');
ok(STANDARD_COLORS.length === 10 && HIGHLIGHT_COLORS.length === 15, '10 culori standard, 15 de evidențiere');
console.log(bad ? `${bad} greșeli` : 'OK: paleta de culori din Docs.');
process.exit(bad ? 1 : 0);

// Test pentru Docs → temele documentului (panoul Stiluri): temele gata făcute, fonturile temei și culorile temei.
// Rulare (în suite/): node tests/docs-themes.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const out = join(tmpdir(), `suite-themes-${process.pid}.mjs`);
await build({
  stdin: { contents: "export * from './src/docs/docStyles.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
});
const { THEMES, THEME_FONTS, THEME_COLORS, applyTheme, themeOf, withThemeFonts, withThemeColors, themeFontsOf, themeColorsOf, styleSet, styleSetOf, cleanStyles } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

const errors = [];
const ok = (c, m) => { if (!c) errors.push(m); };
ok(THEMES.length >= 8 && THEME_FONTS.length >= 8 && THEME_COLORS.length >= 8, 'prea puține teme / fonturi / culori');
for (const [id, , , f, c] of THEMES) {
  const st = applyTheme(id);
  ok(themeOf(st) === id, `tema ${id} nu se recunoaște după aplicare`);
  ok(themeFontsOf(st) === f && themeColorsOf(st) === c, `tema ${id}: fonturile / culorile nu se recunosc`);
  ok(JSON.stringify(cleanStyles(st)) === JSON.stringify(st), `tema ${id} are câmpuri greșite`);
}
ok(new Set(THEMES.map(([id]) => JSON.stringify(applyTheme(id)))).size === THEMES.length, 'două teme arată la fel');
ok(themeOf(undefined) === '' && themeFontsOf(undefined) === '' && themeColorsOf(undefined) === '', 'documentul fără stiluri nu are temă');

// Fonturile: titlurile iau primul font, textul pe al doilea; mărimea și aldinul setului rămân.
const cl = styleSet('clasic');
const g = withThemeFonts(cl, 'georgia');
ok(g.h1.font === 'Georgia' && g.title.font === 'Georgia' && g.h3.font === 'Georgia' && g.normal.font === 'Calibri', 'fonturile Georgia / Calibri: ' + JSON.stringify(g));
ok(g.h1.size === cl.h1.size && g.h1.bold === true && g.h1.color === cl.h1.color, 'mărimea, aldinul și culoarea setului rămân');
ok(themeFontsOf(g) === 'georgia' && styleSetOf(g) === '', 'fonturile recunoscute; setul devine particularizat');
ok(withThemeFonts(cl, 'nu-exista') === cl, 'fonturi necunoscute: nimic schimbat');

// Culorile: doar titlurile; textul normal rămâne.
const r = withThemeColors(withThemeFonts(undefined, 'arial'), 'rosu');
ok(r.title.color === '#9c1c1c' && r.h1.color === '#9c1c1c' && r.h2.color === '#c0392b' && r.h3.color === '#701414', 'culorile roșii pe titluri: ' + JSON.stringify(r));
ok(r.normal.color === undefined && r.normal.font === 'Arial', 'textul normal nu ia culoare');
ok(themeColorsOf(r) === 'rosu' && themeFontsOf(r) === 'arial', 'culorile și fonturile se recunosc împreună');
const r2 = withThemeColors(r, 'verde');
ok(themeColorsOf(r2) === 'verde' && themeFontsOf(r2) === 'arial', 'schimbarea culorilor păstrează fonturile');
// Stilurile proprii (custom) nu se pierd la culori / fonturi.
const withCustom = { ...styleSet('modern'), custom: [{ id: 'sabc', name: 'Notă', def: { italic: true } }] };
ok(withThemeColors(withCustom, 'gri').custom?.[0]?.name === 'Notă', 'stilurile proprii rămân');
console.log(errors.length ? 'ERORI:\n' + errors.join('\n') : 'OK');
process.exit(errors.length ? 1 : 0);

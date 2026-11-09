// Test: culorile „din temă” (theme="4" tint="0.8") și cele indexate din .xlsx se citesc ca rgb:
// luminarea / întunecarea dă tonurile cunoscute ale paletei, iar o temă proprie din theme1.xml schimbă culorile.
// Rulare (în suite/): node tests/sheets-theme-colors-xlsx.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import JSZip from 'jszip';

const dir = join(tmpdir(), `suite-thcol-${process.pid}`);
await build({ entryPoints: ['src/sheets/xlsx.ts', 'src/sheets/themeColors.ts'], bundle: true, format: 'esm', platform: 'node', outdir: dir, logLevel: 'error' });
const { readXlsx, writeXlsx } = await import(pathToFileURL(join(dir, 'xlsx.js')).href);
const { applyTint, themePalette, resolveXmlColors, DEFAULT_PALETTE, BOOK_THEMES, cleanTheme, themeColorMap, recolorStyles, sheetPalette, THEME_FONTS, DEFAULT_FONTS, refontStyles, themeFontsFromXml, themeXml } = await import(pathToFileURL(join(dir, 'themeColors.js')).href);
rmSync(dir, { recursive: true, force: true });

let fail = 0;
// Aproape egale: cel mult 1 din 255 pe fiecare canal (nu se vede cu ochiul).
const near = (x, y) => !!x && !!y && [0, 2, 4].every((i) => Math.abs(parseInt(x.replace('#', '').slice(i, i + 2), 16) - parseInt(y.replace('#', '').slice(i, i + 2), 16)) <= 1);
const ok = (c, m) => { console.log((c ? 'ok: ' : 'GREȘIT: ') + m); if (!c) fail++; };

// Tonurile cunoscute ale albastrului Accent 1 (4472c4).
for (const [t, want, name] of [[0.7999816888943144, 'd9e1f2', 'mai deschis 80%'], [0.5999938962981048, 'b4c6e7', 'mai deschis 60%'], [0.3999755851924192, '8ea9db', 'mai deschis 40%'], [-0.249977111117893, '305496', 'mai închis 25%'], [-0.4999847407452621, '203764', 'mai închis 50%']]) {
  const got = applyTint('4472c4', t);
  ok(near(got, want), `Accent 1 ${name}: ${got} (aștept ${want})`);
}
ok(near(applyTint('000000', 0.5), '7f7f7f'), 'negrul luminat 50% e gri: ' + applyTint('000000', 0.5));
ok(themePalette(null) === DEFAULT_PALETTE, 'fără temă: paleta obișnuită');
ok(resolveXmlColors('<color theme="1"/>') === '<color rgb="FF000000"/>', 'text din temă (dk1) = negru');
ok(resolveXmlColors('<bgColor indexed="64"/>') === '<bgColor indexed="64"/>', 'culoarea sistemului (64) rămâne neschimbată');
ok(resolveXmlColors('<color auto="1" theme="4"/>') === '<color auto="1" theme="4"/>', 'culoarea automată rămâne');
ok(resolveXmlColors('<x:fgColor indexed="10"/>') === '<x:fgColor rgb="FFFF0000"/>', 'indexată 10 = roșu, și cu prefix');

// Un fișier adevărat: A1 cu fundal Accent 1 deschis 80%, B1 cu text Accent 2, C1 cu fundal indexat galben, tema proprie.
const sheet = { name: 'Foaia 1', colW: {}, cells: { A1: 'a', B1: 'b', C1: 'c', D1: 'd' }, styles: { A1: { bg: '#123456' }, B1: { color: '#654321' }, C1: { bg: '#abcdef' }, D1: { color: '#fedcba' } }, tab: '#111111' };
const bytes = await writeXlsx([{ sheet, results: {} }]);
const zip = await JSZip.loadAsync(bytes);
let st = await zip.file('xl/styles.xml').async('string');
st = st.replace('rgb="FF123456"', 'theme="4" tint="0.7999816888943144"').replace('rgb="FF654321"', 'theme="5"').replace('rgb="FFABCDEF"', 'indexed="13"').replace('rgb="FFFEDCBA"', 'theme="4" tint="-0.249977111117893"');
zip.file('xl/styles.xml', st);
const ws = (await zip.file('xl/worksheets/sheet1.xml').async('string')).replace(/<tabColor [^>]*\/>/, '<tabColor theme="9"/>');
zip.file('xl/worksheets/sheet1.xml', ws);
const themed = await zip.generateAsync({ type: 'uint8array' });
const a = (await readXlsx(themed)).sheets[0];
ok(near(a.styles.A1?.bg, '#d9e1f2'), 'A1: fundal Accent 1 deschis 80% = ' + a.styles.A1?.bg);
ok(a.styles.B1?.color === '#ed7d31', 'B1: text Accent 2 = ' + a.styles.B1?.color);
ok(a.styles.C1?.bg === '#ffff00', 'C1: fundal indexat 13 (galben) = ' + a.styles.C1?.bg);
ok(near(a.styles.D1?.color, '#305496'), 'D1: text Accent 1 închis 25% = ' + a.styles.D1?.color);
ok(a.tab === '#70ad47', 'culoarea filei din temă (Accent 6) = ' + a.tab);

// Cu o temă proprie: Accent 1 verde, Accent 2 prin sysClr.
const theme = '<?xml version="1.0"?><a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:themeElements><a:clrScheme name="Al meu">'
  + '<a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1><a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>'
  + '<a:dk2><a:srgbClr val="1F497D"/></a:dk2><a:lt2><a:srgbClr val="EEECE1"/></a:lt2><a:accent1><a:srgbClr val="00B050"/></a:accent1>'
  + '<a:accent2><a:sysClr val="highlight" lastClr="C0504D"/></a:accent2><a:accent3><a:srgbClr val="9BBB59"/></a:accent3><a:accent4><a:srgbClr val="8064A2"/></a:accent4>'
  + '<a:accent5><a:srgbClr val="4BACC6"/></a:accent5><a:accent6><a:srgbClr val="F79646"/></a:accent6><a:hlink><a:srgbClr val="0000FF"/></a:hlink><a:folHlink><a:srgbClr val="800080"/></a:folHlink>'
  + '</a:clrScheme></a:themeElements></a:theme>';
zip.file('xl/theme/theme1.xml', theme);
const b = (await readXlsx(await zip.generateAsync({ type: 'uint8array' }))).sheets[0];
ok(b.styles.B1?.color === '#c0504d', 'tema proprie: Accent 2 din sysClr = ' + b.styles.B1?.color);
ok(b.styles.A1?.bg === applyTint('00b050', 0.7999816888943144).replace(/^/, '#'), 'tema proprie: Accent 1 verde deschis = ' + b.styles.A1?.bg);
ok(b.tab === '#f79646', 'tema proprie: fila Accent 6 = ' + b.tab);

// Tema registrului: harta culorilor la schimbarea temei, scrisă în .xlsx și citită înapoi.
// 31.10 seara: 12 teme, nume diferite; în fiecare, culorile 3–10 (cele care se schimbă cu tema) sunt diferite între ele și de alb / negru.
ok(BOOK_THEMES.length === 87 && new Set(BOOK_THEMES.map((t) => t.name)).size === 87 && new Set(BOOK_THEMES.map((t) => t.colors.join())).size === 87 && ['Hipodrom', 'Moară', 'Ceai', 'Argilă', 'Satin', 'Lustru', 'Piele', 'Cetină', 'Pergament', 'Carton', 'Tipar', 'Scânteie', 'Jar', 'Ipsos', 'Asfalt', 'Bistro', 'Stejar', 'Izvor', 'Cosmos', 'Smalț', 'Ger', 'Alpin', 'Bronz', 'Rubin', 'Circuit', 'Cramă', 'Marinar', 'Miere', 'Deltă', 'Mușețel', 'Scorțișoară', 'Iris', 'Vulcan', 'Abanos', 'Bujor', 'Furtună', 'Cireș', 'Auroră', 'Mandarină', 'Lagună', 'Tei', 'Caramel', 'Petrol', 'Cobalt', 'Perlă', 'Grâu', 'Fistic', 'Cerneală', 'Ametist', 'Brad', 'Rodie', 'Safir', 'Neon', 'Cupru', 'Bordo', 'Bleumarin', 'Piersică', 'Muștar', 'Teracotă', 'Turcoaz', 'Mentă', 'Ardezie', 'Salvie', 'Oțel', 'Cafea', 'Smarald', 'Cer', 'Zmeură', 'Indigo', 'Piatră', 'Chihlimbar', 'Ghețar', 'Corai', 'Prună', 'Măslin', 'Nisip'].every((n) => BOOK_THEMES.some((t) => t.name === n)), 'temele: ' + BOOK_THEMES.map((t) => t.name).join(', '));
for (const t of BOOK_THEMES) { const c = t.colors.slice(2, 10); ok(t.colors.length === 12 && t.colors.every((x) => /^[0-9a-f]{6}$/.test(x)) && new Set(c).size === 8 && !c.includes('ffffff') && !c.includes('000000'), 'tema ' + t.name + ': culori valide, fără repetări'); }
ok(THEME_FONTS.length === 10 && THEME_FONTS.some((p) => p.name === 'Elegante') && THEME_FONTS.some((p) => p.name === 'Înguste'), 'perechile de fonturi: ' + THEME_FONTS.length);
const forest = BOOK_THEMES.find((x) => x.name === 'Pădure');
const map = themeColorMap(DEFAULT_PALETTE, forest.colors);
const old = sheetPalette(DEFAULT_PALETTE), neu = sheetPalette(forest.colors);
ok(map.get('#4472c4') === '#' + forest.colors[4], 'Accent 1 trece în Accent 1 al temei noi');
ok(map.get(old.shades[4][0]) === neu.shades[4][0], 'nuanța 1 a lui Accent 1 trece în nuanța 1 nouă');
ok(!map.has('#ffffff') && !map.has('#000000'), 'albul și negrul rămân');
const rs = recolorStyles({ A1: { bg: old.shades[5][2], b: true }, A2: { color: '#123456' } }, map);
ok(rs.A1.bg === neu.shades[5][2] && rs.A1.b === true && rs.A2.color === '#123456', 'stilurile: doar culorile din paletă se schimbă');
const same = { A1: { bg: '#123456' } };
ok(recolorStyles(same, map) === same, 'fără culori din paletă: același obiect');
ok(cleanTheme({ name: 'x', colors: DEFAULT_PALETTE }) === undefined && cleanTheme({ colors: ['zz'] }) === undefined, 'tema obișnuită sau stricată = fără temă');
const wt = await writeXlsx([{ sheet: { name: 'Foaia 1', colW: {}, cells: { A1: 'a' }, styles: {} }, results: {} }], 0, [], false, undefined, undefined, undefined, [], { name: forest.name, colors: forest.colors });
const wz = await JSZip.loadAsync(wt);
ok(!!wz.file('xl/theme/theme1.xml') && (await wz.file('[Content_Types].xml').async('string')).includes('/xl/theme/theme1.xml') && (await wz.file('xl/_rels/workbook.xml.rels').async('string')).includes('theme/theme1.xml'), 'tema scrisă în .xlsx (fișier, tip, legătură)');
const back = await readXlsx(wt);
ok(back.theme?.name === 'Pădure' && back.theme.colors.join() === forest.colors.join(), 'tema citită înapoi: ' + JSON.stringify(back.theme));
ok((await readXlsx(await writeXlsx([{ sheet: { name: 'F', colW: {}, cells: { A1: 'a' }, styles: {} }, results: {} }]))).theme === undefined, 'fără temă: câmpul lipsește');

// Fonturile temei (Titluri / Corp).
ok(themeFontsFromXml(null).minor === 'Calibri' && themeFontsFromXml(null).major === 'Calibri Light', 'fără temă: fonturile obișnuite');
const carte = THEME_FONTS.find((p) => p.name === 'Carte').fonts;
ok(JSON.stringify(themeFontsFromXml(themeXml({ name: 'X', colors: DEFAULT_PALETTE, fonts: { major: 'Cambria', minor: 'Segoe UI' } }))) === JSON.stringify({ major: 'Cambria', minor: 'Segoe UI' }), 'fonturile scrise în theme1.xml se citesc înapoi');
const rf = refontStyles({ a: { font: 'Calibri Light', b: true }, b: { font: 'Calibri' }, c: { font: 'Arial' }, d: { b: true } }, DEFAULT_FONTS, carte);
ok(rf.a.font === 'Georgia' && rf.a.b && rf.b.font === undefined && rf.c.font === 'Arial' && rf.d.font === undefined, 'Titluri → Georgia, Corp scris de mână → obișnuit, Arial rămâne: ' + JSON.stringify(rf));
const st0 = { a: { font: 'Arial' } };
ok(refontStyles(st0, DEFAULT_FONTS, DEFAULT_FONTS) === st0, 'aceleași fonturi: obiectul neschimbat');
ok(cleanTheme({ name: 'Obișnuită', colors: DEFAULT_PALETTE, fonts: carte })?.fonts?.minor === 'Georgia', 'doar fonturi schimbate: tema rămâne');
ok(cleanTheme({ name: 'Obișnuită', colors: DEFAULT_PALETTE, fonts: DEFAULT_FONTS }) === undefined, 'totul obișnuit: fără temă');
const wf = await writeXlsx([{ sheet: { name: 'F', colW: {}, cells: { A1: 'a', A2: 'b' }, styles: { A2: { b: true } } }, results: {} }], 0, [], false, undefined, undefined, undefined, [], { name: 'Obișnuită', colors: DEFAULT_PALETTE, fonts: carte });
const wfz = await JSZip.loadAsync(wf), stx = await wfz.file('xl/styles.xml').async('string');
ok(stx.includes('<font><sz val="11"/><name val="Georgia"/><scheme val="minor"/></font>'), 'fontul obișnuit din styles.xml e Corpul temei (Georgia)');
const rb = await readXlsx(wf);
ok(rb.theme?.fonts?.major === 'Georgia' && rb.theme?.fonts?.minor === 'Georgia', 'fonturile temei citite înapoi din .xlsx: ' + JSON.stringify(rb.theme?.fonts));

console.log(fail ? `\n${fail} GREȘELI` : '\nTOATE OK');
process.exit(fail ? 1 : 0);

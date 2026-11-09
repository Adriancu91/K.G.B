// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Culorile „din temă” și „indexate” din .xlsx, transformate în culori obișnuite (#rrggbb).
// Fișierele salvate de programul de tabele cunoscut scriu des <fgColor theme="4" tint="0.79"/> în loc de rgb:
// culoarea vine din paleta temei (xl/theme/theme1.xml), luminată sau întunecată cu „tint”.

/** Paleta temei în ordinea indicilor din styles.xml: lt1, dk1, lt2, dk2, accent1…6, hlink, folHlink. */
export type ThemePalette = string[];

/** Paleta temei obișnuite (când fișierul n-are temă). */
export const DEFAULT_PALETTE: ThemePalette = ['ffffff', '000000', 'e7e6e6', '44546a', '4472c4', 'ed7d31', 'a5a5a5', 'ffc000', '5b9bd5', '70ad47', '0563c1', '954f72'];

/** Cele 64 de culori vechi (indexed="0"…"63"); 64 și 65 sunt culorile sistemului și rămân neschimbate. */
export const INDEXED: string[] = [
  '000000', 'ffffff', 'ff0000', '00ff00', '0000ff', 'ffff00', 'ff00ff', '00ffff',
  '000000', 'ffffff', 'ff0000', '00ff00', '0000ff', 'ffff00', 'ff00ff', '00ffff',
  '800000', '008000', '000080', '808000', '800080', '008080', 'c0c0c0', '808080',
  '9999ff', '993366', 'ffffcc', 'ccffff', '660066', 'ff8080', '0066cc', 'ccccff',
  '000080', 'ff00ff', 'ffff00', '00ffff', '800080', '800000', '008080', '0000ff',
  '00ccff', 'ccffff', 'ccffcc', 'ffff99', '99ccff', 'ff99cc', 'cc99ff', 'ffcc99',
  '3366ff', '33cccc', '99cc00', 'ffcc00', 'ff9900', 'ff6600', '666699', '969696',
  '003366', '339966', '003300', '333300', '993300', '993366', '333399', '333333',
];

const HEX6 = /^[0-9a-f]{6}$/i;

/** Paleta din theme1.xml (clrScheme); lipsă sau stricată = paleta obișnuită. */
export function themePalette(xml: string | null | undefined): ThemePalette {
  const scheme = xml?.match(/<(?:\w+:)?clrScheme\b[\s\S]*?<\/(?:\w+:)?clrScheme>/)?.[0];
  if (!scheme) return DEFAULT_PALETTE;
  const get = (name: string): string | undefined => {
    const m = scheme.match(new RegExp(`<(?:\\w+:)?${name}\\b[^>]*>([\\s\\S]*?)</(?:\\w+:)?${name}>`));
    if (!m) return undefined;
    const v = m[1].match(/<(?:\w+:)?srgbClr\b[^>]*\bval="([0-9a-fA-F]{6})"/)?.[1] ?? m[1].match(/<(?:\w+:)?sysClr\b[^>]*\blastClr="([0-9a-fA-F]{6})"/)?.[1];
    return v?.toLowerCase();
  };
  const order = ['lt1', 'dk1', 'lt2', 'dk2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink'];
  return order.map((n, i) => get(n) ?? DEFAULT_PALETTE[i]);
}

/** Culorile indexate proprii ale fișierului (<colors><indexedColors>), peste cele vechi. */
export function indexedPalette(stylesXml: string | null | undefined): string[] {
  const block = stylesXml?.match(/<(?:\w+:)?indexedColors\b[^>]*>([\s\S]*?)<\/(?:\w+:)?indexedColors>/)?.[1];
  if (!block) return INDEXED;
  const own = [...block.matchAll(/<(?:\w+:)?rgbColor\b[^>]*\brgb="([0-9a-fA-F]{6,8})"/g)].map((m) => m[1].slice(-6).toLowerCase());
  return own.length ? INDEXED.map((c, i) => own[i] ?? c) : INDEXED;
}

/**
 * Luminează (tint > 0) sau întunecă (tint < 0) culoarea în HLS, cu treptele întregi 0–240 ale programului de tabele cunoscut
 * (așa ies nuanțele lui din paletă, de exemplu albastrul Accent 1 „mai închis 25%” = 305496; cel mult ±1 pe canal la câteva).
 */
export function applyTint(hex: string, tint: number): string {
  if (!HEX6.test(hex) || !Number.isFinite(tint) || tint === 0) return hex.toLowerCase();
  const t = Math.max(-1, Math.min(1, tint));
  const M = 240, R = 255, div = (x: number, y: number) => Math.floor(x / y);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let L = div((max + min) * M + R, 2 * R), S = 0, H = (M * 2) / 3;
  if (max !== min) {
    S = L <= M / 2 ? div((max - min) * M + div(max + min, 2), max + min) : div((max - min) * M + div(2 * R - max - min, 2), 2 * R - max - min);
    const delta = (c: number) => div((max - c) * (M / 6) + div(max - min, 2), max - min);
    H = r === max ? delta(b) - delta(g) : g === max ? M / 3 + delta(r) - delta(b) : (2 * M) / 3 + delta(g) - delta(r);
    if (H < 0) H += M;
    if (H > M) H -= M;
  }
  L = Math.round(t < 0 ? L * (1 + t) : L * (1 - t) + M * t);
  const hue = (n1: number, n2: number, h: number) => {
    if (h < 0) h += M;
    if (h > M) h -= M;
    if (h < M / 6) return n1 + div((n2 - n1) * h + M / 12, M / 6);
    if (h < M / 2) return n2;
    if (h < (M * 2) / 3) return n1 + div((n2 - n1) * ((M * 2) / 3 - h) + M / 12, M / 6);
    return n1;
  };
  let out: number[];
  if (S === 0) out = [div(L * R, M), div(L * R, M), div(L * R, M)];
  else {
    const m2 = L <= M / 2 ? div(L * (M + S) + M / 2, M) : L + S - div(L * S + M / 2, M);
    const m1 = 2 * L - m2;
    out = [H + M / 3, H, H - M / 3].map((h) => div(hue(m1, m2, h) * R + M / 2, M));
  }
  return out.map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');
}

/** Culoarea din atributele unui element de culoare (rgb / theme / indexed, cu tint), ca „rrggbb”; undefined = automată sau necunoscută. */
export function colorFromAttrs(attrs: Record<string, string | undefined>, pal: ThemePalette = DEFAULT_PALETTE, indexed: string[] = INDEXED): string | undefined {
  let hex: string | undefined;
  const rgb = attrs.rgb;
  if (rgb && /^[0-9a-f]{6,8}$/i.test(rgb)) hex = rgb.slice(-6).toLowerCase();
  else if (attrs.theme !== undefined && /^\d{1,2}$/.test(attrs.theme)) hex = pal[Number(attrs.theme)];
  else if (attrs.indexed !== undefined && /^\d{1,2}$/.test(attrs.indexed)) hex = indexed[Number(attrs.indexed)];
  if (!hex) return undefined;
  const tint = Number(attrs.tint);
  return attrs.tint !== undefined && Number.isFinite(tint) ? applyTint(hex, tint) : hex;
}

const COLOR_TAG = /<((?:\w+:)?(?:color|fgColor|bgColor|tabColor))\b([^>]*?)(\/?)>/g;
const ATTR = /([\w:]+)\s*=\s*"([^"]*)"/g;

/**
 * Rescrie în XML culorile din temă / indexate / cu tint ca rgb="FF…", ca restul citirii să le vadă ca pe oricare altele.
 * Culorile automate (auto="1", indexed 64 / 65) rămân cum sunt.
 */
export function resolveXmlColors(xml: string | null, pal: ThemePalette = DEFAULT_PALETTE, indexed: string[] = INDEXED): string | null {
  if (!xml || !/\b(?:theme|indexed|tint)="/.test(xml)) return xml;
  return xml.replace(COLOR_TAG, (all, tag: string, body: string, close: string) => {
    if (!/\b(?:theme|indexed|tint)="/.test(body)) return all;
    const attrs: Record<string, string> = {};
    for (const m of body.matchAll(ATTR)) attrs[m[1]] = m[2];
    if (attrs.auto === '1' || attrs.auto === 'true') return all;
    const hex = colorFromAttrs(attrs, pal, indexed);
    if (!hex) return all;
    return `<${tag} rgb="FF${hex.toUpperCase()}"${close}>`;
  });
}

// Nuanțele din paleta de culori (5 rânduri sub fiecare culoare a temei), cu luminările programului de tabele cunoscut.
const TINTS_NORMAL = [0.7999816888943144, 0.5999938962981048, 0.3999755851924192, -0.249977111117893, -0.4999847407452621];
const TINTS_WHITE = [-0.0499893185216834, -0.1499984740745262, -0.249977111117893, -0.3499862666707358, -0.499984740745262];
const TINTS_BLACK = [0.499984740745262, 0.3499862666707358, 0.249977111117893, 0.1499984740745262, 0.0499893185216834];
const TINTS_LIGHT = [-0.0999786370433668, -0.249977111117893, -0.499984740745262, -0.749992370372631, -0.8999908444471572];

/** Luminările celor 5 nuanțe ale unei culori din temă: albul doar se întunecă, negrul doar se luminează, culorile foarte deschise mult mai închise. */
export function shadeTints(hex: string): number[] {
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const l = (Math.max(r, g, b) + Math.min(r, g, b)) / 510;
  return l >= 0.98 ? TINTS_WHITE : l <= 0.1 ? TINTS_BLACK : l > 0.8 ? TINTS_LIGHT : TINTS_NORMAL;
}

/** Paleta de culori din Sheets: cele 10 culori ale temei (fundal, text, fundal 2, text 2, accent 1–6) și nuanțele lor, ca „#rrggbb”. */
export function sheetPalette(pal: ThemePalette = DEFAULT_PALETTE, name = 'Obișnuită'): { name: string; colors: string[]; shades: string[][] } {
  const cols = pal.slice(0, 10).map((c) => (HEX6.test(c) ? c.toLowerCase() : '000000'));
  const shades = cols.map((c) => shadeTints(c).map((t) => '#' + applyTint(c, t)));
  return { name, colors: cols.map((c) => '#' + c), shades };
}

/** Tema registrului (Aspect pagină → Teme): numele și cele 12 culori (lt1, dk1, lt2, dk2, accent1…6, hlink, folHlink), „rrggbb”. */
export interface BookTheme { name: string; colors: string[]; fonts?: ThemeFonts }

/** Fonturile temei: Titluri (major) și Corp (minor); Corp e fontul obișnuit al celulelor. */
export interface ThemeFonts { major: string; minor: string }
export const DEFAULT_FONTS: ThemeFonts = { major: 'Calibri Light', minor: 'Calibri' };

/** Perechile de fonturi din Aspect pagină → Fonturi (doar fonturi care vin cu Windows). */
export const THEME_FONTS: { name: string; fonts: ThemeFonts }[] = [
  { name: 'Obișnuite', fonts: DEFAULT_FONTS },
  { name: 'Clasice', fonts: { major: 'Cambria', minor: 'Calibri' } },
  { name: 'Carte', fonts: { major: 'Georgia', minor: 'Georgia' } },
  { name: 'Tradiționale', fonts: { major: 'Times New Roman', minor: 'Times New Roman' } },
  { name: 'Moderne', fonts: { major: 'Segoe UI Semibold', minor: 'Segoe UI' } },
  { name: 'Simple', fonts: { major: 'Arial', minor: 'Arial' } },
  { name: 'Rotunde', fonts: { major: 'Trebuchet MS', minor: 'Verdana' } },
  { name: 'Tehnice', fonts: { major: 'Consolas', minor: 'Segoe UI' } },
  { name: 'Elegante', fonts: { major: 'Palatino Linotype', minor: 'Palatino Linotype' } },
  { name: 'Înguste', fonts: { major: 'Bahnschrift', minor: 'Segoe UI' } },
];

const FONT_NAME = /^[\p{L}\d .\-]{1,48}$/u;
const sameFonts = (a: ThemeFonts, b: ThemeFonts) => a.major === b.major && a.minor === b.minor;
/** Fonturile temei registrului (cele obișnuite când nu are). */
export const themeFontsOf = (t: BookTheme | undefined): ThemeFonts => t?.fonts ?? DEFAULT_FONTS;

/** Fonturile temei din theme1.xml (a:majorFont / a:minorFont → a:latin); lipsă = cele obișnuite. */
export function themeFontsFromXml(xml: string | null | undefined): ThemeFonts {
  const face = (tag: string) => xml?.match(new RegExp('<(?:\\w+:)?' + tag + '\\b[^>]*>\\s*<(?:\\w+:)?latin\\b[^>]*\\btypeface="([^"]*)"'))?.[1]?.trim();
  const major = face('majorFont'), minor = face('minorFont');
  return { major: major && FONT_NAME.test(major) ? major : DEFAULT_FONTS.major, minor: minor && FONT_NAME.test(minor) ? minor : DEFAULT_FONTS.minor };
}

/**
 * Schimbarea fonturilor temei: celulele cu fontul de Titluri vechi iau fontul de Titluri nou; cele cu fontul de Corp scris
 * de mână îl pierd (urmează fontul obișnuit, adică noul Corp). Celelalte fonturi rămân. Același obiect când nimic nu se schimbă.
 */
export function refontStyles<S extends { font?: string }>(styles: Record<string, S>, from: ThemeFonts, to: ThemeFonts): Record<string, S> {
  if (sameFonts(from, to)) return styles;
  let out: Record<string, S> | null = null;
  for (const [id, st] of Object.entries(styles)) {
    if (!st.font) continue;
    if (st.font === from.major && from.major !== from.minor) { out ??= { ...styles }; out[id] = { ...st, font: to.major }; }
    else if (st.font === from.minor) { out ??= { ...styles }; const n = { ...st }; delete n.font; out[id] = n; }
  }
  return out ?? styles;
}

/** Temele din listă: prima e cea obișnuită (paleta fișierelor fără temă); celelalte sunt ale noastre. */
export const BOOK_THEMES: BookTheme[] = [
  { name: 'Obișnuită', colors: DEFAULT_PALETTE },
  { name: 'Marin', colors: ['ffffff', '000000', 'e6eef2', '1d3b4f', '1b6f9e', '2aa198', 'f2a541', '5b8cb8', '7fb3c9', 'c8553d', '0b67a3', '6a4c93'] },
  { name: 'Pădure', colors: ['ffffff', '000000', 'eef2e6', '2f3e2a', '4f7a3a', '8aa64a', 'c9a227', '6b8e7f', 'a0522d', '3d6b5e', '2e6f40', '7a5c2e'] },
  { name: 'Apus', colors: ['ffffff', '000000', 'f6ece6', '4a2c2a', 'd9573b', 'f29e4c', 'f1c453', '9c3d54', '6d597a', 'b56576', 'c0392b', '7d3c98'] },
  { name: 'Lavandă', colors: ['ffffff', '000000', 'efeaf4', '3b2f4f', '7d5ba6', 'b07cc6', 'e09fbf', '5a7bb5', '8fb8a8', 'c9a66b', '6c4ab6', '9a6fb0'] },
  { name: 'Grafit', colors: ['ffffff', '000000', 'ececec', '2b2b2b', '5f6b73', '8c9aa3', 'b8b8b8', '3e7cb1', 'd08c2f', '6f9e5a', '3e7cb1', '7a7a7a'] },
  { name: 'Cald', colors: ['ffffff', '000000', 'f5efe3', '4b3621', 'b5651d', 'd4a017', '8b5a2b', 'c0504d', '9c8c5a', '6b8e23', 'a0522d', '8b4513'] },
  { name: 'Viu', colors: ['ffffff', '000000', 'eeeeee', '222831', 'e63946', 'f4a261', '2a9d8f', '457b9d', '8338ec', 'ffbe0b', '1d4ed8', '9d174d'] },
  { name: 'Turcoaz', colors: ['ffffff', '000000', 'e6f4f3', '134e4a', '0f9488', '14b8a6', '0284c7', 'f59e0b', '64748b', 'e11d48', '0e7490', '6d28d9'] },
  { name: 'Pastel', colors: ['ffffff', '000000', 'f3f0f7', '3f3d56', '8ecae6', 'f4acb7', 'b8e0d2', 'ffd6a5', 'cdb4db', 'a3c4f3', '4a7fc1', '9c6fb6'] },
  // Contrast mare: culori închise, ușor de deosebit și pe hârtie alb-negru (și pentru cine vede mai greu culorile).
  { name: 'Contrast mare', colors: ['ffffff', '000000', 'f2f2f2', '1f1f1f', '0050b3', 'c2410c', '15803d', '7e22ce', 'a16207', 'be123c', '0050b3', '6b21a8'] },
  { name: 'Vin', colors: ['ffffff', '000000', 'f5ecee', '3d1f26', '8c1c3a', 'b5485d', 'd9a441', '6b4c5a', '9e7b6b', '4f6d7a', '8c1c3a', '5e3a6e'] },
  // 31.10 seara: Mentă (verde proaspăt cu albastru) și Ardezie (gri-albăstrui liniștit, cu accente calde).
  { name: 'Mentă', colors: ['ffffff', '000000', 'eaf7f1', '17382b', '10b981', '34d399', '0ea5e9', 'f59e0b', '8b5cf6', 'ef4444', '047857', '6d28d9'] },
  { name: 'Ardezie', colors: ['ffffff', '000000', 'e8ecef', '1f2d3a', '4a6274', '7a93a8', 'c08457', '5e8c6a', 'a65e5e', 'd4b483', '2f6690', '6b5b95'] },
  // 31.10, 20:20: Salvie (verde-gri liniștit, cu cărămiziu) și Oțel (albastru-gri, cu portocaliu), perechile temelor din Slides.
  { name: 'Salvie', colors: ['ffffff', '000000', 'eef2ec', '1f2d23', '5b7f68', '8fae8b', 'b5651d', 'c9a227', '6f8fa6', '9b6b8e', '3f6e5a', '7a5c7e'] },
  { name: 'Oțel', colors: ['ffffff', '000000', 'e6ebf0', '1c2733', '3d5a73', 'f97316', '38bdf8', '94a3b8', 'facc15', 'e11d48', '0369a1', '7c3aed'] },
  // 02.11: Cafea (maro cald, cu crem și oliv) și Smarald (verde închis, cu auriu), perechile temelor din Slides.
  { name: 'Cafea', colors: ['ffffff', '000000', 'f5ece1', '2b1d16', '8b5e3c', 'd4a373', '6b8e23', 'c0504d', '5e7a8c', 'b08968', '7a4a26', '6b4c7a'] },
  { name: 'Smarald', colors: ['ffffff', '000000', 'e6f2ed', '0b3b2e', '13795b', 'e9c46a', '2a9d8f', 'c0504d', '457b9d', '8d6a9f', '0b6e4f', '7a5c2e'] },
  // 02.11: Cer (albastru deschis), Zmeură (roz-roșu), Indigo (albastru-violet) și Piatră (gri cald cu roșu-cireașă), tot din Slides.
  { name: 'Cer', colors: ['ffffff', '000000', 'eef6fd', '1e3a5f', '1d8fe1', '0b4f8a', '38bdf8', 'f59e0b', '10b981', 'ef4444', '0b62b0', '7c3aed'] },
  { name: 'Zmeură', colors: ['ffffff', '000000', 'fff5f8', '3a1a26', 'db2777', '9d174d', 'f472b6', 'f59e0b', '0ea5e9', '65a30d', 'be185d', '7e22ce'] },
  { name: 'Indigo', colors: ['ffffff', '000000', 'e0e7ff', '1e1b4b', '4f46e5', 'a5b4fc', '06b6d4', 'f59e0b', 'ec4899', '10b981', '4338ca', '7c3aed'] },
  { name: 'Piatră', colors: ['ffffff', '000000', 'f5f5f4', '292524', '78716c', 'be123c', 'a8a29e', '0f766e', 'b45309', '1d4ed8', 'be123c', '57534e'] },
  // 02.11: Chihlimbar (galben-portocaliu cald) și Ghețar (turcoaz rece), din Slides.
  { name: 'Chihlimbar', colors: ['ffffff', '000000', 'fdf3e1', '24170a', 'f59e0b', 'b45309', 'fcd34d', '7c2d12', '0f766e', '6b7280', 'b45309', '7c3aed'] },
  { name: 'Ghețar', colors: ['ffffff', '000000', 'e8f7fa', '14323d', '06a3b7', '0e5566', '67e8f9', 'f59e0b', '64748b', 'e11d48', '0e7490', '6d28d9'] },
  // 02.11: Corai (piersică și roșu-corai), Prună (violet închis cu roz), Măslin (verde-oliv cu auriu) și Nisip (bej cald cu maro), din Slides.
  { name: 'Corai', colors: ['ffffff', '000000', 'fff4ef', '3b2622', 'e8553e', '9f2d20', 'f4a261', '2a9d8f', '457b9d', 'e9c46a', 'c2410c', '7c3aed'] },
  { name: 'Prună', colors: ['ffffff', '000000', 'f3e8f7', '2a1533', '7b2d8e', 'f08bc0', 'c084fc', 'f59e0b', '0ea5e9', '65a30d', 'a21caf', '6d28d9'] },
  { name: 'Măslin', colors: ['ffffff', '000000', 'f4f3e8', '2f3220', '6b7a1f', '8a7a1e', 'c9a227', 'a0522d', '4f6d7a', '9c6b8e', '556b2f', '7a5c2e'] },
  { name: 'Nisip', colors: ['ffffff', '000000', 'f3e7d3', '3f3a33', 'b7791f', '7c4a1e', 'd9b97a', '5e8c6a', '4f7c99', 'a65e5e', '8b5a2b', '6b4c7a'] },
  // 02.11, 16:20: Teracotă (crem cald cu cărămiziu), din Slides (Turcoaz există mai sus).
  { name: 'Teracotă', colors: ['ffffff', '000000', 'fbf1ea', '3f2a1f', 'c2410c', '9a3412', 'e9a178', '0f766e', 'b45309', '6b7280', '9a3412', '7c2d12'] },
  // 02.11, 19:00: Muștar (crem cu galben-muștar și gri-cărbune), din Slides.
  { name: 'Muștar', colors: ['ffffff', '000000', 'fbf7e9', '2b2a24', 'c99a06', '6b5d2f', 'e6c65c', '4b6584', '8a6d00', '7d7a6e', '8a6d00', '5c4a00'] },
  // 03.11: Piersică (crem-piersică, portocaliu-somon și cărămiziu), din Slides.
  { name: 'Piersică', colors: ['ffffff', '000000', 'fff4ec', '3d2b25', 'e8784d', '7a2e1b', 'f4a27f', '0f766e', 'b4532a', '8c7b74', 'b4532a', '7a2e1b'] },
  // 03.11, 08:45: Bleumarin (bleumarin cu auriu, roșu închis și verde), din Slides.
  { name: 'Bleumarin', colors: ['ffffff', '000000', 'eef1f7', '1b2a4a', '2f4a7a', 'c9a227', '4a6fa5', 'b91c1c', '2f855a', '7c8aa5', '2b4c8c', '7a5c00'] },
  // 03.11, 11:10: Bordo (bordo cu auriu vechi, cărămiziu și verde închis), din Slides.
  // 03.11, 17:39: Cupru (cupru cu antracit, albastru-petrol și verde stins), din Slides.
  { name: 'Cupru', colors: ['ffffff', '000000', 'f5ede6', '2a2f35', 'b87333', '3d5a6c', 'd9a066', '7c3f1d', '6b8f71', 'a0522d', 'b87333', '7c3f1d'] },
  // 03.11, 23:26: Neon (cyan și verde-lime pe bleumarin aproape negru, cu violet și roz aprins), din Slides.
  // 04.11, 03:30: Safir (albastru-safir cu auriu, albastru deschis și chihlimbar), din Slides.
  { name: 'Safir', colors: ['ffffff', '000000', 'eaf0fb', '0c1a3d', '1e40af', 'd4a017', '3b82f6', 'b45309', '0f766e', '64748b', '1d4ed8', '7c3aed'] },
  // 04.11, 04:25: Rodie (roșu-rodie cu verde-petrol, roz și auriu), din Slides.
  { name: 'Rodie', colors: ['ffffff', '000000', 'fdf2f4', '4c0519', '9f1239', '0f766e', 'fb7185', 'ca8a04', '2563eb', '78716c', 'be123c', '0d9488'] },
  // 04.11, 05:15: Brad (verde de brad cu chihlimbar, mușchi și scoarță), din Slides.
  { name: 'Brad', colors: ['ffffff', '000000', 'f0f5ee', '052e16', '14532d', 'b45309', '65a30d', '78350f', '0e7490', '57534e', '15803d', 'd97706'] },
  // 04.11, 06:25: Ametist (violet-ametist cu verde-apă, liliac și auriu), din Slides.
  { name: 'Ametist', colors: ['ffffff', '000000', 'f5f0fb', '2e1065', '6b21a8', '0d9488', 'a855f7', 'ca8a04', 'db2777', '64748b', '7e22ce', '14b8a6'] },
  // 04.11, 07:08: Cerneală (albastru-cerneală cu roșu de sigiliu, ardezie și auriu), din Slides.
  { name: 'Cerneală', colors: ['ffffff', '000000', 'f7f5ef', '0f172a', '1e293b', 'b91c1c', '475569', 'a16207', '0f766e', '7c3aed', '1d4ed8', '7f1d1d'] },
  // 05.11, 03:18: Fistic (verde-fistic cu maro de coajă, verde crud și auriu), din Slides.
  { name: 'Fistic', colors: ['ffffff', '000000', 'f2f6e6', '2b3320', '3d6b21', 'a05a2c', '93c572', 'c9a227', '0f766e', '6b7280', '65a30d', '7c3f1d'] },
  // 05.11, 04:14: Grâu (auriu de spic cu verde de câmp, galben copt și maro de pâine), din Slides.
  { name: 'Grâu', colors: ['ffffff', '000000', 'fbf6e6', '33291a', '8a5a00', '4d7c2a', 'd9a520', 'b45309', '0f766e', '6b7280', 'a3b818', '7c4a1e'] },
  // 05.11, 04:42: Perlă (gri-albăstrui cu roz-auriu, gri-perlă și bleu-cenușiu), din Slides.
  // 05.11, 04:59: Cobalt (albastru-cobalt cu portocaliu, albastru deschis și galben-auriu), din Slides.
  // 05.11, 05:27: Petrol (albastru-petrol cu roșu-coral, verde-albastru deschis și galben-miere), din Slides.
  // 05.11, 06:25: Caramel (maro-caramel cu verde-albastru, ocru și cărămiziu), din Slides.
  // 05.11, 08:31: Tei (verde-crud cu prună, verde-lămâie și portocaliu-miere), din Slides.
  // 05.11, 08:58: Lagună (verde-albastru adânc cu coral, turcoaz deschis și galben-nisip), din Slides.
  // 05.11, 10:08: Cireș (roz-cireașă cu verde de frunză, roz deschis și verde crud), din Slides.
  { name: 'Cireș', colors: ['ffffff', '000000', 'fdf0f3', '2b1d22', 'b0305c', '3f7d3a', 'f48fb1', '8fbc5a', 'e6a23c', '7a6a70', '5b6fb5', '7a1f40'] },
  // 05.11, 10:30: Furtună (albastru-ardezie cu galben de fulger, gri de nor și albastru de ploaie), din Slides.
  { name: 'Furtună', colors: ['ffffff', '000000', 'eef1f5', '1c2430', '33415c', 'e0b000', '7d8ca3', '4a90c2', 'c0504d', '5a6270', '6b5b95', '1f2a3d'] },
  // 05.11, 13:10: Deltă (verde-albăstrui de baltă cu auriu de stuf, verde de papură și albastru de apă), din Slides.
  { name: 'Deltă', colors: ['ffffff', '000000', 'eef4f2', '1a2a2a', '1d5c63', 'a8862d', '6b9e78', '4f8fb0', 'c06a3b', '5f6f6a', '2f7f9e', '14403f'] },
  // 05.11, 14:15: Marinar (bleumarin de uniformă cu roșu de colac de salvare, albastru de mare, bej de frânghie și verde-turcoaz), din Slides.
  { name: 'Marinar', colors: ['ffffff', '000000', 'eef3f8', '10213a', '0f3460', 'c8102e', '5b8db8', 'd9b98a', '2a9d8f', '6b7a8f', 'e07a1f', '0a2540'] },
  // 05.11, 15:05: Cramă (vânăt de struguri copți cu verde de viță, roz de vin, auriu de pai, maro de butoi de stejar), din Slides.
  { name: 'Cramă', colors: ['ffffff', '000000', 'f6f1ea', '2a1a28', '4a1d4a', '6b8e23', '8e3b5f', 'c9a66b', '7a4b2a', '8b7d8b', 'b5523b', '3a1638'] },
  // 05.11, 17:12: Ger (albastru de gheață cu roșu de fular, albastru de cer de iarnă, gri de zăpadă murdară, verde de brad, auriu de lumini, violet de amurg), din Slides.
  { name: 'Ger', colors: ['ffffff', '000000', 'edf2f8', '17212e', '2b4c7e', 'b3263c', '7fb3d5', '9aa7b5', '2f6b4f', 'd4a72c', '6c5b9e', '1d6f8f'] },
  // 05.11, 17:43: Smalț (verde-albastru de cabinet cu corai, turcoaz deschis, gri de instrument, verde de mentă, galben de semnal, albastru de halat), din Slides.
  { name: 'Smalț', colors: ['ffffff', '000000', 'e9f4f4', '18282b', '0e6e78', 'e0675a', '7cc7c9', 'a4b3b5', '3d8f5f', 'e3b341', '5b6fb0', '2a9bb0'] },
  // 05.11, 18:51: Stejar (maro de stejar cu verde de frunză, lemn deschis, gri de rumeguș, galben de lac, albastru de atelier, roșu de cărămidă, violet de prună), din Slides.
  // 05.11, 20:35: Jar (roșu-brun de carne afumată cu portocaliu de jar, crem de hârtie de măcelărie, gri de cărbune, roz de șuncă, verde de pătrunjel, galben de muștar, albastru de oțel, maro de lemn), din Slides.
  { name: 'Jar', colors: ['ffffff', '000000', 'f5ebe2', '2a1a16', '7a2318', 'e8913a', '4a4542', 'd98c86', '5e8a3a', 'd9b23a', '4f6f8f', '8a5a3a'] },
  // 05.11, 21:00: Scânteie (bleumarin de oțel cu albastru de arc electric, gri-albăstrui de tablă, gri de oțel, portocaliu de scântei, galben de avertizare, verde, roșu de rugină, violet), din Slides.
  { name: 'Scânteie', colors: ['ffffff', '000000', 'e6ebf2', '1b2130', '25304a', '2f8fd8', '6b7480', 'f08a24', 'f2c230', '3a8f5a', 'b23a3a', '7a5aa8'] },
  // 05.11, 21:25: Tipar (negru de cerneală cu cele trei culori de tipar: cyan, magenta, galben; plus gri, verde, portocaliu, violet), din Slides.
  { name: 'Tipar', colors: ['ffffff', '000000', 'f2f2ee', '16181d', '2b2f36', '00a0d6', 'd61a7f', 'ffd400', '6b7280', '2e9b4f', 'e85d1f', '6a3fa0'] },
  // 05.11, 22:52: Pergament (maro-roșcat de cerneală veche cu auriu-ocru, hârtie veche, sepia; plus verde de copertă, roșu de sigiliu, albastru de cerneală, violet, bronz), din Slides.
  { name: 'Pergament', colors: ['ffffff', '000000', 'f3e9d2', '3a2e22', '6b2a1a', '9a7b2a', '3f4a2a', '7a2e1d', 'b08d57', '2f4a6b', '5a3d8a', '7a5a14'] },
  // 05.11, 23:30: Cetină (verde de pădure deasă și de ace tinere, cu portocaliu de rășină; plus verde de mușchi, albastru de munte, galben de rumeguș, roșu de scoarță, gri de piatră, verde-albastru de izvor), din Slides.
  { name: 'Cetină', colors: ['ffffff', '000000', 'e6ecdc', '16271f', '1f4d3a', 'b0602a', '6a8f3a', '3a6f8f', 'd9a23a', '8a3a2a', '5a6b4a', '2f7a6a'] },
  // 05.11, 23:50: Piele (maro de piele coniac și maro închis, cu roșu de frizerie; plus albastru-petrol, caramel, verde de măsline, maro de nuc, gri-cărbune, alamă), din Slides.
  { name: 'Piele', colors: ['ffffff', '000000', 'f1e6d6', '2a1a12', '7a3e1d', 'a32a22', '1f4a5a', 'c58a4a', '4a5a3a', '8a6a4a', '2f2f3a', 'b8862f'] },
  // 06.11, 00:15: Lustru (negru de cremă de ghete și gri-argintiu, cu roșu-vișiniu de piele lustruită; plus gri-albastru, maro de calapod, verde închis, maro-gri, argintiu, violet-cărbune), din Slides.
  { name: 'Lustru', colors: ['ffffff', '000000', 'ecebe8', '15171b', '2a2e36', '8c2a32', '5a6a7a', 'a8783a', '3a5a4a', '7a6a5a', 'c8ced6', '4a3a5a'] },
  // 06.11, 00:30: Satin (roz pal de satin și prună, cu roz închis și roz-ciclam; plus violet de scenă, auriu, verde-salvie, maro-piersică, gri-lavandă, roz de poante), din Slides.
  { name: 'Satin', colors: ['ffffff', '000000', 'fbf1f2', '3a2a30', '9c3a5e', 'c0507a', '5a4a8a', 'd9b24a', '7a9a8a', 'b07a5a', '8a8a9a', 'e08aa0'] },
  // 06.11, 00:55: Argilă (gri-bej de lut crud și maro de lut ars, cu albastru de glazură; plus ocru, verde de oxid, portocaliu de teracotă, gri de piatră, albastru de cobalt, sienna), din Slides.
  { name: 'Argilă', colors: ['ffffff', '000000', 'f2ede6', '38302a', '7a4e32', '3f7a86', 'b98a5e', '6f8f5a', 'c2703c', '8a8178', '2f5d8a', 'a0522d'] },
  // 06.11, 01:47: Hipodrom (alb-verzui de pajiște și verde închis de pistă, cu roșu de jocheu; plus maro de șa, auriu de trofeu, albastru de mătase, gri de nisip, verde crud, mov), din Slides.
  { name: 'Hipodrom', colors: ['ffffff', '000000', 'f3f6f1', '1f2a22', '1f5a3a', 'a0302a', '7a4a24', 'c08a2a', '2f5a9a', '9a948a', '6a9a3a', '6a3a7a'] },
  // 06.11, 01:35: Moară (gri de piatră de moară și maro de lemn vechi, cu auriu de grâu; plus albastru de iaz, gri de făină, verde de câmp, roșu de cărămidă, albastru închis, mov), din Slides.
  { name: 'Moară', colors: ['ffffff', '000000', 'eef0f1', '25272a', '4a3a2a', 'b8901f', '3f6f8f', '8a8f94', '6f8f4a', 'a05a3a', '2f5d8a', '7a5a9a'] },
  // 06.11, 01:10: Ceai (verde pal de ceai și verde de frunză, cu chihlimbar de miere; plus mov de lavandă, galben de mușețel, verde de mentă, roșu de măceș, gri de ierburi uscate, albastru de nalbă), din Slides.
  { name: 'Ceai', colors: ['ffffff', '000000', 'f1f4e8', '2f3424', '4f6a2a', 'b0742a', '8a5a9a', 'd9c25a', '6f9a8a', 'a04a3a', '8a8f7a', '3f6f9a'] },
  // 05.11, 22:25: Carton (maro de carton kraft cu verdele de reciclare și culorile pubelelor: albastru, galben; plus roșu, oliv, verde-albastru, maro), din Slides.
  { name: 'Carton', colors: ['ffffff', '000000', 'efe3cc', '3a2c1f', '4a3523', 'a0662b', '2e8b57', '2f6fae', 'e0b020', 'b23a2e', '6f7f4f', '1f7a6d'] },
  // 05.11, 20:10: Ipsos (albastru-gri de zugrav cu ocru, alb cald de tencuială, albastru deschis de lavabilă, gri de chit, verde de salvie, roșu de cărămidă, violet de lavandă, galben de var), din Slides.
  { name: 'Ipsos', colors: ['ffffff', '000000', 'f3eee6', '2a2622', '3d5a73', 'd98a2b', '8fa7b8', 'b8aea0', '6f8f5a', 'c4564a', '7a6a9a', 'e0c35a'] },
  // 05.11, 19:37: Asfalt (gri antracit cu portocaliu de semnalizare, gri de beton, gri de oțel, galben de marcaj, albastru de indicator, roșu de stop, verde de semafor), din Slides.
  { name: 'Asfalt', colors: ['ffffff', '000000', 'eceef0', '1b1e22', '2f343a', 'e8701a', '5f6b78', 'a9b0b8', 'f2b705', '2f6fa8', 'b8322a', '4f8a3c'] },
  // 05.11, 19:16: Bistro (roșu de ketchup cu galben de muștar, crem de chiflă, maro de cafea, verde de salată, portocaliu de cartofi, albastru de tavă, vișiniu, violet), din Slides.
  { name: 'Bistro', colors: ['ffffff', '000000', 'fbf3e4', '2b1a12', 'b3261e', 'e0a526', '6a8f3a', '8a7a6a', 'd9682b', '3d6c8f', '7a2e1f', '5b4a8e'] },
  { name: 'Stejar', colors: ['ffffff', '000000', 'f3ede2', '221a12', '6b4423', '4f7a3a', 'c08a4f', 'a39a8c', 'd4a72c', '3f6f8f', '9e3b2e', '7a5a8e'] },
  // 05.11, 18:27: Izvor (albastru de izvor cu arămiu de țeavă, albastru deschis de apă, gri de faianță, verde-turcoaz de alge, galben de alamă, albastru-violet, roșu de robinet de apă caldă), din Slides.
  { name: 'Izvor', colors: ['ffffff', '000000', 'eaf4f8', '14242c', '1c6a8f', 'c46a2b', '6fc0dc', '9fb0b8', '2f8f7f', 'e0b43a', '5b6fb0', 'b03a48'] },
  // 05.11, 18:02: Cosmos (albastru de cer înstelat cu auriu de stea, albastru de nebuloasă, gri de lună, violet de galaxie, turcoaz de planetă, roșu de Marte, verde de auroră), din Slides.
  { name: 'Cosmos', colors: ['ffffff', '000000', 'ecedf6', '151a30', '1f2a5c', 'd99a1e', '6c7fd8', '9ea3b8', '7a4fa3', '3fa7c4', 'c4574f', '4d8f6a'] },
  // 05.11, 16:50: Alpin (albastru de creastă cu portocaliu de foc de tabără, verde de brad, gri de stâncă, albastru de cer, galben de marcaj, maro de bocanc, violet de amurg), din Slides.
  { name: 'Alpin', colors: ['ffffff', '000000', 'eef3f6', '1a2530', '24506b', 'e06a2c', '3f7d4e', '8fa3b1', '6b9ac4', 'd4a72c', '7a5c45', '6a5a9e'] },
  // 05.11, 16:10: Bronz (arămiu-bronz cu verde de patină, bronz lucios, gri cald, albastru de vitrină, roșu de cărămidă, auriu vechi), din Slides.
  { name: 'Bronz', colors: ['ffffff', '000000', 'f3ede4', '241c14', '7a4a1c', '3f8f7a', 'cd7f32', '8c7b6b', '4a6fa5', 'a8433a', 'b8963e', '5b5f97'] },
  // 05.11, 15:50: Rubin (roșu-rubin cu auriu, roz de rubin deschis, gri cald, albastru de safir, verde de măslin), din Slides.
  { name: 'Rubin', colors: ['ffffff', '000000', 'f7eef0', '2b0d14', '9b1b30', 'b8860b', 'e05a72', '5b4a4e', '2f5d8a', '7a8b3c', 'c2410c', '6d28d9'] },
  // 05.11, 15:20: Circuit (verde de placă electronică cu aramă, verde de led, gri de siliciu, albastru de cablu și auriu de contacte), din Slides.
  { name: 'Circuit', colors: ['ffffff', '000000', 'eef5f0', '10261a', '14532d', 'b87333', '22c55e', '6b7b8c', '2563a8', 'd4a017', '0e7490', '7c3aed'] },
  // 05.11, 13:50: Miere (maro-miere cu galben de fagure, verde de salcâm și maro de ceară), din Slides.
  { name: 'Miere', colors: ['ffffff', '000000', 'fdf7e8', '2b1f0e', '8a5300', 'e0a100', '6b8e23', '5c4a1e', 'c2410c', '6f6656', '2f6f8f', '7a4800'] },
  // 05.11, 12:40: Mușețel (verde-măsliniu cu galben-auriu, crem pal, verde de frunză și alb-gălbui), din Slides.
  { name: 'Mușețel', colors: ['ffffff', '000000', 'fbf8e6', '23281a', '4a6b1f', 'd9a400', '9bbf5a', 'f2d16b', 'b07a3a', '6d725c', '3f8f8a', '33491a'] },
  // 05.11, 12:20: Scorțișoară (maro-scorțișoară cu verde-albăstrui, crem, caramel și galben de miere), din Slides.
  { name: 'Scorțișoară', colors: ['ffffff', '000000', 'f7ece0', '2a1e17', '7b3f1d', '1f8a84', 'c08552', 'e3b04b', '8c9a5b', '6e5a4d', 'b5524a', '4a2412'] },
  // 05.11, 12:00: Iris (violet-albăstrui cu galben de polen, liliachiu pal și verde de tulpină), din Slides.
  { name: 'Iris', colors: ['ffffff', '000000', 'f1effa', '1c1a2e', '4338a0', 'd4a017', '8e86c9', '6aa84f', 'e57373', '6b6880', '2f8fbf', '2e2670'] },
  // 05.11, 11:40: Vulcan (gri-cărbune cu portocaliu de lavă, galben de jar și roșu închis), din Slides.
  { name: 'Vulcan', colors: ['ffffff', '000000', 'f2eeeb', '211d1b', '3a3330', 'd9480f', '8a817c', 'f59f00', 'c92a2a', '5c5552', '2b6cb0', '7a2e0e'] },
  // 05.11, 11:20: Abanos (negru-cafeniu cu auriu, bej de fildeș și verde-oliv închis), din Slides.
  { name: 'Abanos', colors: ['ffffff', '000000', 'f6f1e6', '1c1a17', '2b2622', 'b8892b', '8c7a5b', 'e3c278', '4f6d5a', '6b6259', '7a4a2a', '5c4a1e'] },
  // 05.11, 10:55: Bujor (roșu de bujor cu verde închis de frunză, roz pal și verde de câmp), din Slides.
  { name: 'Bujor', colors: ['ffffff', '000000', 'fdf3ef', '24201c', 'c62828', '2e5e3e', 'ef9a9a', '7fa66b', 'f2b134', '6d6460', '4a6fa5', '8e1c1c'] },
  // 05.11, 09:40: Auroră (verde-albastru cu violet, turcoaz deschis și lavandă), din Slides.
  { name: 'Auroră', colors: ['ffffff', '000000', 'f2f5fa', '1b2330', '0f766e', '6d28d9', '14b8a6', 'a78bfa', 'e0a100', '64748b', '0e7490', 'be185d'] },
  // 05.11, 09:20: Mandarină (portocaliu-închis cu bleumarin, galben-auriu și verde-măsliniu), din Slides.
  { name: 'Mandarină', colors: ['ffffff', '000000', 'fff4e8', '2a1f17', 'c2560a', '1e3a5f', 'f0a830', '6b8e23', 'd97757', '7a6e64', '3d6fa8', '8a3b12'] },
  { name: 'Lagună', colors: ['ffffff', '000000', 'eef7f7', '16292b', '00727a', 'e8684a', '4fb3b0', 'f2b84b', '3d6b8c', '6b7a7a', '0b8f6e', 'a8432e'] },
  { name: 'Tei', colors: ['ffffff', '000000', 'f4f8e8', '1f2a14', '4d7c0f', '7c3a6b', 'a3c23a', 'd9822b', '2f6f8a', '6b7262', '3b7a1e', '8a4a7a'] },
  { name: 'Caramel', colors: ['ffffff', '000000', 'f7efe4', '2e2218', '8b4513', '1f7a7a', 'd99a4e', 'b5523b', '6b8e4e', '7a6a5a', '2f5d8a', '9c6b2f'] },
  { name: 'Petrol', colors: ['ffffff', '000000', 'edf4f5', '1b2a2e', '0e4a5a', 'd1495b', '3a8c9a', 'e8a33d', '5c7a4a', '6b7280', '0f766e', '8a2a3a'] },
  { name: 'Cobalt', colors: ['ffffff', '000000', 'eef3fa', '1c2433', '0047ab', 'e07a1f', '4f86d9', 'f2b134', '0f766e', '6b7280', '2563eb', '9a4a0c'] },
  { name: 'Perlă', colors: ['ffffff', '000000', 'f4f3f1', '2d2f36', '3b4252', 'a8576a', 'b8b2a7', '7d8ba1', 'c9a27e', '5e6b5a', '6d7f99', '8a4a5a'] },
  { name: 'Neon', colors: ['ffffff', '000000', 'e6f7fb', '0f172a', '06b6d4', '84cc16', '8b5cf6', 'f43f5e', 'f59e0b', '10b981', '0891b2', '7c3aed'] },
  { name: 'Bordo', colors: ['ffffff', '000000', 'f8eee8', '6b1d2a', '8e2a3b', 'b08d57', 'c2563f', '5c7a4a', '7a5a6a', 'd9a441', '8e2a3b', '6b4a2f'] },
];

const SAME = (a: string[], b: string[]) => a.length === b.length && a.every((c, i) => c === b[i]);

/** Tema din fișierul .ssheet (verificată); lipsă / stricată = undefined (tema obișnuită). */
export function cleanTheme(t: unknown): BookTheme | undefined {
  if (!t || typeof t !== 'object') return undefined;
  const o = t as { name?: unknown; colors?: unknown };
  if (!Array.isArray(o.colors) || o.colors.length !== 12 || !o.colors.every((c) => typeof c === 'string' && HEX6.test(c))) return undefined;
  const colors = (o.colors as string[]).map((c) => c.toLowerCase());
  const fo = (t as { fonts?: { major?: unknown; minor?: unknown } }).fonts;
  const fonts = fo && typeof fo.major === 'string' && typeof fo.minor === 'string' && FONT_NAME.test(fo.major) && FONT_NAME.test(fo.minor)
    && !sameFonts(fo as ThemeFonts, DEFAULT_FONTS) ? { major: fo.major, minor: fo.minor } : undefined;
  if (SAME(colors, DEFAULT_PALETTE) && !fonts) return undefined;
  return { name: typeof o.name === 'string' && o.name.trim() ? o.name.trim().slice(0, 60) : 'Tema fișierului', colors, ...(fonts ? { fonts } : {}) };
}

/** Paleta temei registrului (cea obișnuită când nu are). */
export const themeColorsOf = (t: BookTheme | undefined): ThemePalette => t?.colors ?? DEFAULT_PALETTE;

/**
 * Harta culorilor la schimbarea temei: fiecare culoare a temei vechi și fiecare nuanță a ei (din paletă) → cea din același loc
 * în tema nouă, ca celulele colorate din paletă să se schimbe împreună cu tema. Culorile alese altfel rămân.
 */
export function themeColorMap(from: ThemePalette, to: ThemePalette): Map<string, string> {
  const m = new Map<string, string>();
  const a = sheetPalette(from), b = sheetPalette(to);
  // Albul și negrul (primele două) rămân; restul, cu nuanțele lor.
  for (let i = 2; i < 10; i++) {
    if (!m.has(a.colors[i])) m.set(a.colors[i], b.colors[i]);
    for (let r = 0; r < 5; r++) if (!m.has(a.shades[i][r])) m.set(a.shades[i][r], b.shades[i][r]);
  }
  for (const [k, v] of [...m]) if (k === v) m.delete(k);
  return m;
}

/** Recolorează stilurile unei foi după hartă (fundal, text, chenar); întoarce același obiect când nimic nu se schimbă. */
export function recolorStyles<S extends { bg?: string; color?: string; bdColor?: string }>(styles: Record<string, S>, map: Map<string, string>): Record<string, S> {
  if (!map.size) return styles;
  let out: Record<string, S> | null = null;
  for (const [id, st] of Object.entries(styles)) {
    const bg = st.bg && map.get(st.bg.toLowerCase()), color = st.color && map.get(st.color.toLowerCase()), bd = st.bdColor && map.get(st.bdColor.toLowerCase());
    if (!bg && !color && !bd) continue;
    out ??= { ...styles };
    out[id] = { ...st, ...(bg ? { bg } : {}), ...(color ? { color } : {}), ...(bd ? { bdColor: bd } : {}) };
  }
  return out ?? styles;
}

const XML_ESC = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** xl/theme/theme1.xml cu culorile și fonturile temei (umplerile și liniile cele mai simple, cum cere formatul). */
export function themeXml(t: BookTheme): string {
  const c = t.colors.map((x) => x.toUpperCase());
  const f = themeFontsOf(t);
  const clr = (tag: string, v: string) => `<a:${tag}><a:srgbClr val="${v}"/></a:${tag}>`;
  const ph = '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>';
  const ln = (w: number) => `<a:ln w="${w}" cap="flat" cmpd="sng" algn="ctr">${ph}<a:prstDash val="solid"/><a:miter lim="800000"/></a:ln>`;
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
    + `<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="${XML_ESC(t.name)}"><a:themeElements>`
    + `<a:clrScheme name="${XML_ESC(t.name)}">${clr('dk1', c[1])}${clr('lt1', c[0])}${clr('dk2', c[3])}${clr('lt2', c[2])}`
    + [4, 5, 6, 7, 8, 9].map((i) => clr('accent' + (i - 3), c[i])).join('') + clr('hlink', c[10]) + clr('folHlink', c[11]) + '</a:clrScheme>'
    + `<a:fontScheme name="Suite"><a:majorFont><a:latin typeface="${XML_ESC(f.major)}"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont>`
    + `<a:minorFont><a:latin typeface="${XML_ESC(f.minor)}"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme>`
    + `<a:fmtScheme name="Suite"><a:fillStyleLst>${ph}${ph}${ph}</a:fillStyleLst>`
    + `<a:lnStyleLst>${ln(6350)}${ln(12700)}${ln(19050)}</a:lnStyleLst>`
    + '<a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>'
    + `<a:bgFillStyleLst>${ph}${ph}${ph}</a:bgFillStyleLst></a:fmtScheme>`
    + '</a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/></a:theme>';
}

/** Numele schemei de culori din theme1.xml (pentru tema citită din fișier). */
export function themeName(xml: string | null | undefined): string | undefined {
  const n = xml?.match(/<(?:\w+:)?clrScheme\b[^>]*\bname="([^"]{1,60})"/)?.[1]?.trim();
  return n || undefined;
}

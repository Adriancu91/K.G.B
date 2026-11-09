// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Stilurile documentului (Word: Modificare stil): cum arată Text normal, Titlu document și Titlu 1–3 în TOT documentul
// (font, mărime, culoare, aldin, cursiv). Se țin în .sdoc (page.styles), se văd în editor printr-o foaie de stil
// și intră în .docx ca stilurile Normal / Title / Heading1–3, ca să arate la fel în orice program.

export type StyleKey = 'normal' | 'title' | 'h1' | 'h2' | 'h3';
export const STYLE_KEYS: [StyleKey, string][] = [['normal', 'Text normal'], ['title', 'Titlu document'], ['h1', 'Titlu 1'], ['h2', 'Titlu 2'], ['h3', 'Titlu 3']];
export interface StyleDef { font?: string; /** puncte */ size?: number; /** #rrggbb */ color?: string; bold?: boolean; italic?: boolean }
/** Un stil nou, creat de utilizator (Word: Creare stil): un nume și cum arată textul; se pune pe paragraf prin atributul cstyle. */
export interface CustomStyle { id: string; name: string; def: StyleDef }
export type DocStyles = Partial<Record<StyleKey, StyleDef>> & { custom?: CustomStyle[] };
export const MAX_CUSTOM = 40;
const NAME_OK = /^[^<>"&]{1,40}$/;
export function cleanCustom(v: unknown): CustomStyle[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const seen = new Set<string>();
  const out = v.flatMap((x): CustomStyle[] => {
    if (!x || typeof x !== 'object') return [];
    const o = x as Record<string, unknown>;
    const id = typeof o.id === 'string' && /^[a-z0-9]{1,12}$/.test(o.id) ? o.id : '';
    const name = typeof o.name === 'string' ? o.name.trim() : '';
    if (!id || seen.has(id) || !NAME_OK.test(name)) return [];
    seen.add(id);
    return [{ id, name, def: cleanStyle(o.def) ?? {} }];
  }).slice(0, MAX_CUSTOM);
  return out.length ? out : undefined;
}
/** Un identificator nou, scurt, pentru un stil creat acum. */
export const newStyleId = (taken: CustomStyle[] = []) => { let id = ''; do id = 's' + Math.random().toString(36).slice(2, 8); while (taken.some((c) => c.id === id)); return id; };

const FONT_OK = /^[\p{L}\p{N} .,'-]{1,60}$/u;
/** O definiție de stil curățată (fără câmpuri greșite); undefined dacă nu schimbă nimic. */
export function cleanStyle(v: unknown): StyleDef | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const d = v as Record<string, unknown>, out: StyleDef = {};
  if (typeof d.font === 'string' && FONT_OK.test(d.font.trim())) out.font = d.font.trim();
  const size = Number(d.size);
  if (Number.isFinite(size) && size >= 6 && size <= 96) out.size = Math.round(size * 2) / 2;
  if (typeof d.color === 'string' && /^#[0-9a-f]{6}$/i.test(d.color)) out.color = d.color.toLowerCase();
  if (typeof d.bold === 'boolean') out.bold = d.bold;
  if (typeof d.italic === 'boolean') out.italic = d.italic;
  return Object.keys(out).length ? out : undefined;
}
export function cleanStyles(v: unknown): DocStyles | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const out: DocStyles = {};
  for (const [k] of STYLE_KEYS) { const s = cleanStyle((v as Record<string, unknown>)[k]); if (s) out[k] = s; }
  const custom = cleanCustom((v as Record<string, unknown>).custom);
  if (custom) out.custom = custom;
  return Object.keys(out).length ? out : undefined;
}

/** Unde se aplică fiecare stil în editor (în interiorul `scope`). */
const SELECTORS: Record<StyleKey, string> = {
  normal: '.ProseMirror', title: '.ProseMirror p[data-pstyle="title"]', h1: '.ProseMirror h1', h2: '.ProseMirror h2', h3: '.ProseMirror h3',
};
const cssFont = (f: string) => `"${f.replace(/["\\]/g, '')}", sans-serif`;
/** Foaia de stil pentru editor: regulile stilurilor schimbate, doar în documentul `scope` (alte taburi rămân neatinse). */
export function stylesCss(st: DocStyles | undefined, scope: string): string {
  if (!st) return '';
  const all: [string, StyleDef | undefined][] = [...STYLE_KEYS.map(([k]): [string, StyleDef | undefined] => [SELECTORS[k], st[k]]),
    ...(st.custom ?? []).map((c): [string, StyleDef] => [`.ProseMirror [data-cstyle="${c.id}"]`, c.def])];
  return all.flatMap(([sel, s]) => {
    if (!s) return [];
    const p = [
      s.font && `font-family: ${cssFont(s.font)}`, s.size && `font-size: ${s.size}pt`, s.color && `color: ${s.color}`,
      s.bold !== undefined && `font-weight: ${s.bold ? 700 : 400}`, s.italic !== undefined && `font-style: ${s.italic ? 'italic' : 'normal'}`,
    ].filter(Boolean);
    return p.length ? [`${scope} ${sel} { ${p.join('; ')}; }`] : [];
  }).join('\n');
}

/** Formatul de rând pentru .docx (mărimea în jumătăți de punct, culoarea fără #). */
export function docxRun(s: StyleDef | undefined): { font?: string; size?: number; color?: string; bold?: boolean; italics?: boolean } {
  if (!s) return {};
  return {
    ...(s.font ? { font: s.font } : {}), ...(s.size ? { size: Math.round(s.size * 2) } : {}), ...(s.color ? { color: s.color.slice(1).toUpperCase() } : {}),
    ...(s.bold !== undefined ? { bold: s.bold } : {}), ...(s.italic !== undefined ? { italics: s.italic } : {}),
  };
}

/** Stilul luat din textul selectat (Word: Actualizează stilul ca să se potrivească selecției). */
export function styleFromMarks(m: { fontFamily?: string | null; fontSize?: string | null; color?: string | null; bold?: boolean; italic?: boolean }): StyleDef {
  const size = Number(String(m.fontSize ?? '').replace('pt', ''));
  // Culoarea poate veni și ca rgb(31, 78, 121) (așa o dă navigatorul din textul lipit / importat).
  const rgb = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(String(m.color ?? ''));
  const color = rgb ? '#' + rgb.slice(1, 4).map((x) => Math.min(255, Number(x)).toString(16).padStart(2, '0')).join('') : m.color;
  return cleanStyle({
    font: m.fontFamily ? String(m.fontFamily).split(',')[0].replace(/["']/g, '').trim() : undefined,
    size: size || undefined, color: color ?? undefined, bold: m.bold, italic: m.italic,
  }) ?? {};
}

/** Seturile de stiluri (Word: Proiectare → Seturi de stiluri): schimbă dintr-o dată cum arată textul și titlurile din tot documentul. */
export const STYLE_SETS: [string, string, DocStyles | undefined][] = [
  ['implicit', 'Implicit', undefined],
  ['clasic', 'Clasic', {
    normal: { font: 'Times New Roman', size: 12 }, title: { font: 'Times New Roman', size: 28, bold: true, color: '#1f2a44' },
    h1: { font: 'Times New Roman', size: 16, bold: true, color: '#1f2a44' }, h2: { font: 'Times New Roman', size: 14, bold: true, color: '#1f2a44' },
    h3: { font: 'Times New Roman', size: 12, bold: true, italic: true, color: '#1f2a44' },
  }],
  ['modern', 'Modern', {
    normal: { font: 'Segoe UI', size: 11 }, title: { font: 'Segoe UI', size: 30, bold: false, color: '#1f6fb2' },
    h1: { font: 'Segoe UI', size: 18, bold: false, color: '#1f6fb2' }, h2: { font: 'Segoe UI', size: 14, bold: false, color: '#1f6fb2' },
    h3: { font: 'Segoe UI', size: 12, bold: true, color: '#404040' },
  }],
  ['elegant', 'Elegant', {
    normal: { font: 'Georgia', size: 11, color: '#333333' }, title: { font: 'Georgia', size: 32, italic: true, bold: false, color: '#7a5c2e' },
    h1: { font: 'Georgia', size: 18, italic: true, bold: false, color: '#7a5c2e' }, h2: { font: 'Georgia', size: 14, italic: true, bold: false, color: '#7a5c2e' },
    h3: { font: 'Georgia', size: 12, bold: true, color: '#555555' },
  }],
  ['compact', 'Compact', {
    normal: { font: 'Calibri', size: 10 }, title: { font: 'Calibri', size: 20, bold: true },
    h1: { font: 'Calibri', size: 13, bold: true }, h2: { font: 'Calibri', size: 11, bold: true }, h3: { font: 'Calibri', size: 10, bold: true, italic: true },
  }],
  ['contrast', 'Contrast puternic', {
    normal: { font: 'Arial', size: 12, color: '#000000' }, title: { font: 'Arial', size: 32, bold: true, color: '#000000' },
    h1: { font: 'Arial', size: 20, bold: true, color: '#000000' }, h2: { font: 'Arial', size: 16, bold: true, color: '#000000' },
    h3: { font: 'Arial', size: 13, bold: true, color: '#000000' },
  }],
];

// cleanStyle pune câmpurile mereu în aceeași ordine, deci textul JSON e de ajuns pentru comparație.
const sameStyle = (a: StyleDef | undefined, b: StyleDef | undefined) => JSON.stringify(cleanStyle(a) ?? {}) === JSON.stringify(cleanStyle(b) ?? {});
/** Ce set de stiluri are documentul acum ('' dacă stilurile au fost schimbate de mână). */
export function styleSetOf(st: DocStyles | undefined): string {
  const found = STYLE_SETS.find(([, , set]) => STYLE_KEYS.every(([k]) => sameStyle(st?.[k], set?.[k])));
  return found ? found[0] : '';
}
/** Stilurile documentului după alegerea unui set (o copie, ca schimbările ulterioare să nu atingă setul). */
export function styleSet(id: string): DocStyles | undefined {
  const set = STYLE_SETS.find(([k]) => k === id)?.[2];
  return set ? cleanStyles(JSON.parse(JSON.stringify(set))) : undefined;
}

// Temele documentului (Word: Proiectare → Teme, Culori, Fonturi): peste setul de stiluri se pot alege, separat,
// fonturile temei (unul pentru titluri, unul pentru text) și culorile temei (titlurile). O temă = set + fonturi + culori.
const HEADS: StyleKey[] = ['title', 'h1', 'h2', 'h3'];

/** Fonturile temei: [id, nume, fontul titlurilor, fontul textului]. */
export const THEME_FONTS: [string, string, string, string][] = [
  ['calibri', 'Calibri / Calibri', 'Calibri', 'Calibri'],
  ['segoe', 'Segoe UI / Segoe UI', 'Segoe UI', 'Segoe UI'],
  ['arial', 'Arial / Arial', 'Arial', 'Arial'],
  ['georgia', 'Georgia / Calibri', 'Georgia', 'Calibri'],
  ['cambria', 'Cambria / Calibri', 'Cambria', 'Calibri'],
  ['times', 'Times New Roman / Arial', 'Times New Roman', 'Arial'],
  ['trebuchet', 'Trebuchet MS / Georgia', 'Trebuchet MS', 'Georgia'],
  ['verdana', 'Verdana / Verdana', 'Verdana', 'Verdana'],
  ['palatino', 'Palatino Linotype / Palatino Linotype', 'Palatino Linotype', 'Palatino Linotype'],
  ['tahoma', 'Tahoma / Segoe UI', 'Tahoma', 'Segoe UI'],
];

/** Culorile temei: [id, nume, culoarea titlurilor mari (Titlu document, Titlu 1), a lui Titlu 2, a lui Titlu 3]. */
export const THEME_COLORS: [string, string, string, string, string][] = [
  ['albastru', 'Albastru', '#1f4e79', '#2e75b6', '#1f3763'],
  ['albastru-verde', 'Albastru-verde', '#0f6f73', '#17979c', '#0b4f52'],
  ['verde', 'Verde', '#385723', '#548235', '#2a4119'],
  ['rosu', 'Roșu', '#9c1c1c', '#c0392b', '#701414'],
  ['portocaliu', 'Portocaliu', '#b4540a', '#e07b14', '#7f3b07'],
  ['violet', 'Violet', '#5b2c86', '#7e4bb0', '#3f1e5e'],
  ['auriu', 'Auriu', '#7a5c2e', '#a67c3d', '#57411f'],
  ['gri', 'Gri', '#404040', '#595959', '#262626'],
  ['negru', 'Alb-negru', '#000000', '#000000', '#000000'],
  ['salvie', 'Salvie', '#3f6e5a', '#5b7f68', '#2c4d3f'],
  ['otel', 'Oțel', '#2c3e50', '#3d5a73', '#1c2733'],
  ['cafea', 'Cafea', '#6f4e37', '#8b5e3c', '#4b3221'],
  ['smarald', 'Smarald', '#0b5d45', '#13795b', '#073d2e'],
  ['cer', 'Cer', '#0b4f8a', '#1d8fe1', '#0a3a66'],
  ['zmeura', 'Zmeură', '#9d174d', '#db2777', '#6b0f34'],
  ['indigo', 'Indigo', '#312e81', '#4f46e5', '#1e1b4b'],
  ['piatra', 'Piatră', '#1c1917', '#be123c', '#44403c'],
  ['menta', 'Mentă', '#065f46', '#0f9d76', '#064e3b'],
  ['ardezie', 'Ardezie', '#2f3e46', '#52796f', '#1f2a30'],
  ['lavanda', 'Lavandă', '#4c1d95', '#7c3aed', '#3b0764'],
  ['grafit', 'Grafit', '#1f2933', '#2f8f6f', '#111820'],
  ['chihlimbar', 'Chihlimbar', '#92400e', '#d97706', '#78350f'],
  ['ghetar', 'Ghețar', '#0e5566', '#06a3b7', '#0b3f4c'],
  ['corai', 'Corai', '#9f2d20', '#e8553e', '#6e1f16'],
  ['pruna', 'Prună', '#4a1d5c', '#c0347e', '#2a1533'],
  ['maslin', 'Măslin', '#3f4a12', '#8a7a1e', '#2f3220'],
  ['nisip', 'Nisip', '#7c4a1e', '#b7791f', '#5a3412'],
  ['teracota', 'Teracotă', '#9a3412', '#c2410c', '#7c2d12'],
  ['turcoaz', 'Turcoaz', '#0f3d3e', '#0f766e', '#062426'],
  ['mustar', 'Muștar', '#2b2a24', '#9a7400', '#4a4636'],
  ['piersica', 'Piersică', '#7a2e1b', '#c4552e', '#5a2214'],
  ['bleumarin', 'Bleumarin', '#1b2a4a', '#8a6a0a', '#14213d'],
  ['bordo', 'Bordo', '#6b1d2a', '#8a6a2f', '#561622'],
  ['cupru', 'Cupru', '#7c3f1d', '#b4652e', '#5c2e15'],
  ['neon', 'Neon', '#0e7490', '#4d7c0f', '#155e75'],
  ['safir', 'Safir', '#1e3a8a', '#a16207', '#172554'],
  ['rodie', 'Rodie', '#9f1239', '#0f766e', '#4c0519'],
  ['brad', 'Brad', '#14532d', '#b45309', '#052e16'],
  ['ametist', 'Ametist', '#6b21a8', '#0d9488', '#3b0764'],
  ['cerneala', 'Cerneală', '#1e293b', '#b91c1c', '#0f172a'],
  ['fistic', 'Fistic', '#3d6b21', '#a05a2c', '#2a4a16'],
  ['grau', 'Grâu', '#8a5a00', '#4d7c2a', '#5c3d00'],
  ['perla', 'Perlă', '#3b4252', '#a8576a', '#2b303b'],
  ['cobalt', 'Cobalt', '#0047ab', '#c2610f', '#00337a'],
  ['petrol', 'Petrol', '#0e4a5a', '#c23b4e', '#08323d'],
  ['caramel', 'Caramel', '#8b4513', '#1f6f6f', '#5e2e0c'],
  ['tei', 'Tei', '#4d7c0f', '#7c3a6b', '#355a08'],
  ['laguna', 'Lagună', '#00727a', '#d4553a', '#00545a'],
  ['mandarina', 'Mandarină', '#c2560a', '#1e3a5f', '#8a3b06'],
  ['aurora', 'Auroră', '#0f766e', '#6d28d9', '#0b5751'],
  ['cires', 'Cireș', '#b0305c', '#3f7d3a', '#7a1f40'],
  ['furtuna', 'Furtună', '#33415c', '#b8860b', '#1f2a3d'],
  ['bujor', 'Bujor', '#c62828', '#2e5e3e', '#8e1c1c'],
  ['abanos', 'Abanos', '#2b2622', '#8a6516', '#1a1714'],
  ['vulcan', 'Vulcan', '#3a3330', '#c2410c', '#7a2e0e'],
  ['iris', 'Iris', '#4338a0', '#8a6d00', '#2e2670'],
  ['scortisoara', 'Scorțișoară', '#7b3f1d', '#1f6f6b', '#5a2d14'],
  ['musetel', 'Mușețel', '#4a6b1f', '#8a6a00', '#33491a'],
  ['delta', 'Deltă', '#1d5c63', '#7a5f12', '#14403f'],
  ['miere', 'Miere', '#8a5300', '#5c4a1e', '#5e3800'],
  ['marinar', 'Marinar', '#0f3460', '#a50d26', '#0a2540'],
  ['crama', 'Cramă', '#4a1d4a', '#4f6b1e', '#3a1638'],
  ['circuit', 'Circuit', '#14532d', '#8a5a14', '#0f3d22'],
  ['rubin', 'Rubin', '#9b1b30', '#7a5a10', '#6e1222'],
  ['bronz', 'Bronz', '#7a4a1c', '#2f6b5c', '#5a3614'],
  ['alpin', 'Alpin', '#24506b', '#a8481a', '#183a50'],
  ['ger', 'Ger', '#2b4c7e', '#a3253a', '#1e3760'],
  ['smalt', 'Smalț', '#0e6e78', '#b8473b', '#0a4f57'],
  ['cosmos', 'Cosmos', '#1f2a5c', '#9a6a0e', '#151d42'],
  ['izvor', 'Izvor', '#1c6a8f', '#a5521a', '#134d69'],
  ['stejar', 'Stejar', '#6b4423', '#3f6b2e', '#4e3119'],
  ['bistro', 'Bistro', '#a3241b', '#8a6411', '#741a13'],
  ['asfalt', 'Asfalt', '#2f343a', '#b4520f', '#1f2327'],
  ['ipsos', 'Ipsos', '#3d5a73', '#9a5b14', '#2b4153'],
  ['jar', 'Jar', '#7a2318', '#a3561a', '#5a190f'],
  ['scanteie', 'Scânteie', '#25304a', '#1f6fae', '#18203a'],
  ['tipar', 'Tipar', '#16181d', '#b3166f', '#0b6d96'],
  ['carton', 'Carton', '#5c3d1e', '#1e6b40', '#3f2a14'],
  ['pergament', 'Pergament', '#6b2a1a', '#7a5a14', '#4a3020'],
  ['cetina', 'Cetină', '#1f4d3a', '#8a4a1e', '#163a2b'],
  ['piele', 'Piele', '#6a3418', '#a32a22', '#4a2410'],
  ['lustru', 'Lustru', '#22262e', '#8c2a32', '#1a1d23'],
  ['satin', 'Satin', '#8a2f52', '#5a4a8a', '#5e1f38'],
  ['argila', 'Argilă', '#7a4e32', '#3f7a86', '#5a3824'],
  ['ceai', 'Ceai', '#4f6a2a', '#b0742a', '#3a4f1e'],
  ['moara', 'Moară', '#4a3a2a', '#3f6f8f', '#3a2c1f'],
  ['hipodrom', 'Hipodrom', '#1f5a3a', '#a0302a', '#17432b'],
];

/** Stilurile cu fonturile temei puse: titlurile iau primul font, textul normal pe al doilea (restul rămâne). */
export function withThemeFonts(st: DocStyles | undefined, id: string): DocStyles | undefined {
  const f = THEME_FONTS.find(([k]) => k === id);
  if (!f) return st;
  const out: DocStyles = { ...(st ?? {}) };
  out.normal = { ...(st?.normal ?? {}), font: f[3] };
  for (const k of HEADS) out[k] = { ...(st?.[k] ?? {}), font: f[2] };
  return cleanStyles(out);
}

/** Stilurile cu culorile temei puse pe titluri (textul normal rămâne cum e). */
export function withThemeColors(st: DocStyles | undefined, id: string): DocStyles | undefined {
  const c = THEME_COLORS.find(([k]) => k === id);
  if (!c) return st;
  const col: Record<string, string> = { title: c[2], h1: c[2], h2: c[3], h3: c[4] };
  const out: DocStyles = { ...(st ?? {}) };
  for (const k of HEADS) out[k] = { ...(st?.[k] ?? {}), color: col[k] };
  return cleanStyles(out);
}

/** Ce fonturi ale temei are documentul ('' dacă nu se potrivesc cu niciun rând din listă). */
export function themeFontsOf(st: DocStyles | undefined): string {
  const f = THEME_FONTS.find(([, , h, b]) => st?.normal?.font === b && HEADS.every((k) => st?.[k]?.font === h));
  return f ? f[0] : '';
}
/** Ce culori ale temei are documentul ('' dacă nu se potrivesc). */
export function themeColorsOf(st: DocStyles | undefined): string {
  const c = THEME_COLORS.find(([, , a, b, d]) => st?.title?.color === a && st?.h1?.color === a && st?.h2?.color === b && st?.h3?.color === d);
  return c ? c[0] : '';
}

/** Temele gata făcute: [id, nume, setul de stiluri, fonturile, culorile]. */
export const THEMES: [string, string, string, string, string][] = [
  ['birou', 'Birou', 'implicit', 'calibri', 'albastru'],
  ['raport', 'Raport', 'clasic', 'cambria', 'albastru'],
  ['proaspat', 'Proaspăt', 'modern', 'segoe', 'albastru-verde'],
  ['natura', 'Natură', 'modern', 'trebuchet', 'verde'],
  ['energic', 'Energic', 'implicit', 'arial', 'portocaliu'],
  ['regal', 'Regal', 'elegant', 'georgia', 'violet'],
  ['retro', 'Retro', 'elegant', 'palatino', 'auriu'],
  ['sobru', 'Sobru', 'compact', 'tahoma', 'gri'],
  ['scrisoare', 'Scrisoare', 'clasic', 'times', 'negru'],
  ['aprins', 'Aprins', 'implicit', 'verdana', 'rosu'],
  // 31.10, 20:25: perechile temelor Salvie și Oțel din Slides și Sheets.
  ['salvie', 'Salvie', 'modern', 'georgia', 'salvie'],
  ['otel', 'Oțel', 'implicit', 'segoe', 'otel'],
  // 02.11: perechile temelor Cafea și Smarald din Slides (și din Sheets).
  ['cafea', 'Cafea', 'elegant', 'georgia', 'cafea'],
  ['smarald', 'Smarald', 'clasic', 'cambria', 'smarald'],
  // 02.11: și perechile temelor Cer, Zmeură, Indigo și Piatră din Slides.
  ['cer', 'Cer', 'modern', 'segoe', 'cer'],
  ['zmeura', 'Zmeură', 'implicit', 'trebuchet', 'zmeura'],
  ['indigo', 'Indigo', 'elegant', 'calibri', 'indigo'],
  ['piatra', 'Piatră', 'compact', 'tahoma', 'piatra'],
  // 02.11: Mentă, Ardezie, Lavandă și Grafit, ca în Slides și Sheets.
  ['menta', 'Mentă', 'modern', 'trebuchet', 'menta'],
  ['ardezie', 'Ardezie', 'compact', 'calibri', 'ardezie'],
  ['lavanda', 'Lavandă', 'elegant', 'palatino', 'lavanda'],
  ['grafit', 'Grafit', 'implicit', 'tahoma', 'grafit'],
  ['chihlimbar', 'Chihlimbar', 'implicit', 'segoe', 'chihlimbar'],
  ['ghetar', 'Ghețar', 'modern', 'calibri', 'ghetar'],
  // 02.11: Corai, Prună, Măslin și Nisip, perechile temelor din Slides.
  ['corai', 'Corai', 'modern', 'trebuchet', 'corai'],
  ['pruna', 'Prună', 'elegant', 'georgia', 'pruna'],
  ['maslin', 'Măslin', 'clasic', 'cambria', 'maslin'],
  ['nisip', 'Nisip', 'implicit', 'palatino', 'nisip'],
  // 02.11, 16:20: Teracotă și Turcoaz, perechile temelor din Slides.
  ['teracota', 'Teracotă', 'elegant', 'georgia', 'teracota'],
  ['turcoaz', 'Turcoaz', 'modern', 'segoe', 'turcoaz'],
  // 02.11, 19:00: Muștar, perechea temei din Slides și Sheets.
  ['mustar', 'Muștar', 'compact', 'trebuchet', 'mustar'],
  // 03.11: Piersică, perechea temei din Slides și Sheets.
  ['piersica', 'Piersică', 'modern', 'calibri', 'piersica'],
  // 03.11, 08:45: Bleumarin, perechea temei din Slides și Sheets.
  ['bleumarin', 'Bleumarin', 'clasic', 'cambria', 'bleumarin'],
  // 03.11, 11:10: Bordo, perechea temei din Slides și Sheets.
  ['bordo', 'Bordo', 'elegant', 'georgia', 'bordo'],
  // 03.11, 17:39: Cupru, perechea temei din Slides și Sheets.
  ['cupru', 'Cupru', 'modern', 'palatino', 'cupru'],
  // 03.11, 23:26: Neon, perechea temei din Slides și Sheets (pe hârtie albă, cu cyan și verde-lime închise, ca să se citească).
  ['neon', 'Neon', 'modern', 'verdana', 'neon'],
  // 04.11, 03:30: Safir, perechea temei din Slides și Sheets (titluri albastru-safir, Titlu 2 auriu închis).
  ['safir', 'Safir', 'elegant', 'georgia', 'safir'],
  // 04.11, 04:25: Rodie, perechea temei din Slides și Sheets (titluri Palatino roșu-rodie, Titlu 2 verde-petrol).
  ['rodie', 'Rodie', 'clasic', 'palatino', 'rodie'],
  // 04.11, 05:15: Brad, perechea temei din Slides și Sheets (titluri Cambria verde de brad, Titlu 2 chihlimbar).
  ['brad', 'Brad', 'modern', 'cambria', 'brad'],
  // 04.11, 06:25: Ametist, perechea temei din Slides și Sheets (titluri Georgia violet-ametist, Titlu 2 verde-apă).
  ['ametist', 'Ametist', 'elegant', 'georgia', 'ametist'],
  // 04.11, 07:08: Cerneală, perechea temei din Slides și Sheets (titluri Palatino albastru-cerneală, Titlu 2 roșu de sigiliu).
  ['cerneala', 'Cerneală', 'clasic', 'palatino', 'cerneala'],
  // 05.11, 03:18: Fistic, perechea temei din Slides și Sheets (titluri Trebuchet verde-fistic, Titlu 2 maro de coajă).
  ['fistic', 'Fistic', 'modern', 'trebuchet', 'fistic'],
  // 05.11, 04:14: Grâu, perechea temei din Slides și Sheets (titluri Palatino auriu de spic, Titlu 2 verde de câmp).
  ['grau', 'Grâu', 'clasic', 'palatino', 'grau'],
  // 05.11, 04:42: Perlă, perechea temei din Slides și Sheets (titluri Georgia gri-albăstrui, Titlu 2 roz-auriu).
  ['perla', 'Perlă', 'modern', 'georgia', 'perla'],
  // 05.11, 04:59: Cobalt, perechea temei din Slides și Sheets (titluri Tahoma albastru-cobalt, Titlu 2 portocaliu ars).
  ['cobalt', 'Cobalt', 'modern', 'tahoma', 'cobalt'],
  // 05.11, 05:27: Petrol, perechea temei din Slides și Sheets (titluri Verdana albastru-petrol, Titlu 2 roșu-coral).
  ['petrol', 'Petrol', 'modern', 'verdana', 'petrol'],
  // 05.11, 06:25: Caramel, perechea temei din Slides și Sheets (titluri Trebuchet maro-caramel, Titlu 2 verde-albastru).
  ['caramel', 'Caramel', 'modern', 'trebuchet', 'caramel'],
  // 05.11, 08:31: Tei, perechea temei din Slides și Sheets (titluri Cambria verde-crud, Titlu 2 prună).
  ['tei', 'Tei', 'modern', 'cambria', 'tei'],
  // 05.11, 08:58: Lagună, perechea temei din Slides și Sheets (titluri Georgia verde-albastru adânc, Titlu 2 coral).
  ['laguna', 'Lagună', 'modern', 'georgia', 'laguna'],
  // 05.11, 09:20: Mandarină, perechea temei din Slides și Sheets (titluri Trebuchet portocaliu-închis, Titlu 2 bleumarin).
  ['mandarina', 'Mandarină', 'modern', 'trebuchet', 'mandarina'],
  // 05.11, 09:40: Auroră, perechea temei din Slides și Sheets (titluri Segoe UI verde-albastru, Titlu 2 violet).
  ['aurora', 'Auroră', 'modern', 'segoe', 'aurora'],
  // 05.11, 10:08: Cireș, perechea temei din Slides și Sheets (titluri Palatino roz-cireașă, Titlu 2 verde de frunză).
  ['cires', 'Cireș', 'modern', 'palatino', 'cires'],
  // 05.11, 10:30: Furtună, perechea temei din Slides și Sheets (titluri Verdana albastru-ardezie, Titlu 2 galben-fulger închis).
  ['furtuna', 'Furtună', 'modern', 'verdana', 'furtuna'],
  // 05.11, 10:55: Bujor, perechea temei din Slides și Sheets (titluri Georgia roșu de bujor, Titlu 2 verde închis de frunză).
  ['bujor', 'Bujor', 'modern', 'georgia', 'bujor'],
  // 05.11, 11:20: Abanos, perechea temei din Slides și Sheets (titluri Cambria negru-cafeniu, Titlu 2 auriu închis, ca să se citească pe alb).
  ['abanos', 'Abanos', 'clasic', 'cambria', 'abanos'],
  // 05.11, 11:40: Vulcan, perechea temei din Slides și Sheets (titluri Trebuchet gri-cărbune, Titlu 2 portocaliu de lavă închis).
  ['vulcan', 'Vulcan', 'modern', 'trebuchet', 'vulcan'],
  // 05.11, 12:00: Iris, perechea temei din Slides și Sheets (titluri Palatino violet-albăstrui, Titlu 2 galben de polen închis, ca să se citească pe alb).
  ['iris', 'Iris', 'elegant', 'palatino', 'iris'],
  // 05.11, 12:20: Scorțișoară, perechea temei din Slides și Sheets (titluri Calibri maro-scorțișoară, Titlu 2 verde-albăstrui închis).
  ['scortisoara', 'Scorțișoară', 'modern', 'calibri', 'scortisoara'],
  // 05.11, 12:40: Mușețel, perechea temei din Slides și Sheets (titluri Georgia verde-măsliniu, Titlu 2 galben-auriu închis, ca să se citească pe alb).
  ['musetel', 'Mușețel', 'elegant', 'georgia', 'musetel'],
  // 05.11, 13:10: Deltă, perechea temei din Slides și Sheets (titluri Cambria verde-albăstrui de baltă, Titlu 2 auriu de stuf închis, ca să se citească pe alb).
  ['delta', 'Deltă', 'clasic', 'cambria', 'delta'],
  // 05.11, 13:50: Miere, perechea temei din Slides și Sheets (titluri Palatino maro-miere, Titlu 2 maro de ceară închis, ca să se citească pe alb).
  ['miere', 'Miere', 'elegant', 'palatino', 'miere'],
  // 05.11, 14:15: Marinar, perechea temei din Slides și Sheets (titluri Tahoma bleumarin, Titlu 2 roșu de colac de salvare închis, ca să se citească pe alb).
  ['marinar', 'Marinar', 'modern', 'tahoma', 'marinar'],
  // 05.11, 15:05: Cramă, perechea temei din Slides și Sheets (titluri Palatino vânăt de struguri copți, Titlu 2 verde de viță).
  ['crama', 'Cramă', 'elegant', 'palatino', 'crama'],
  // 05.11, 15:20: Circuit, perechea temei din Slides și Sheets (titluri Segoe UI verde de placă electronică, Titlu 2 arămiu închis, ca să se citească pe alb).
  ['circuit', 'Circuit', 'modern', 'segoe', 'circuit'],
  // 05.11, 15:50: Rubin, perechea temei din Slides și Sheets (titluri Georgia roșu-rubin, Titlu 2 auriu închis, ca să se citească pe alb).
  ['rubin', 'Rubin', 'elegant', 'georgia', 'rubin'],
  // 05.11, 16:10: Bronz, perechea temei din Slides și Sheets (titluri Cambria arămiu-bronz, Titlu 2 verde de patină închis, ca să se citească pe alb).
  ['bronz', 'Bronz', 'clasic', 'cambria', 'bronz'],
  // 05.11, 16:50: Alpin, perechea temei din Slides și Sheets (titluri Trebuchet albastru de creastă, Titlu 2 portocaliu de foc de tabără închis, ca să se citească pe alb).
  ['alpin', 'Alpin', 'modern', 'trebuchet', 'alpin'],
  // 05.11, 17:12: Ger, perechea temei din Slides și Sheets (titluri Verdana albastru de gheață, Titlu 2 roșu de fular închis).
  ['ger', 'Ger', 'modern', 'verdana', 'ger'],
  // 05.11, 17:43: Smalț, perechea temei din Slides și Sheets (titluri Tahoma verde-albastru de cabinet, Titlu 2 corai închis, ca să se citească pe alb).
  ['smalt', 'Smalț', 'modern', 'tahoma', 'smalt'],
  // 05.11, 18:02: Cosmos, perechea temei din Slides și Sheets (titluri Trebuchet albastru de cer înstelat, Titlu 2 auriu închis, ca să se citească pe alb).
  ['cosmos', 'Cosmos', 'modern', 'trebuchet', 'cosmos'],
  // 05.11, 18:27: Izvor, perechea temei din Slides și Sheets (titluri Verdana albastru de izvor, Titlu 2 arămiu închis, ca să se citească pe alb).
  ['izvor', 'Izvor', 'modern', 'verdana', 'izvor'],
  // 05.11, 18:51: Stejar, perechea temei din Slides și Sheets (titluri Cambria maro de stejar, Titlu 2 verde de frunză închis, ca să se citească pe alb).
  ['stejar', 'Stejar', 'modern', 'cambria', 'stejar'],
  // 05.11, 19:16: Bistro, perechea temei din Slides și Sheets (titluri Arial roșu de ketchup, Titlu 2 galben de muștar închis, ca să se citească pe alb).
  ['bistro', 'Bistro', 'modern', 'arial', 'bistro'],
  // 05.11, 19:37: Asfalt, perechea temei din Slides și Sheets (titluri Segoe UI gri antracit, Titlu 2 portocaliu închis, ca să se citească pe alb).
  ['asfalt', 'Asfalt', 'modern', 'segoe', 'asfalt'],
  // 05.11, 20:10: Ipsos, perechea temei din Slides și Sheets (titluri Georgia albastru-gri de zugrav, Titlu 2 ocru închis, ca să se citească pe alb).
  ['ipsos', 'Ipsos', 'modern', 'georgia', 'ipsos'],
  // 05.11, 20:35: Jar, perechea temei din Slides și Sheets (titluri Verdana roșu-brun, Titlu 2 portocaliu de jar închis, ca să se citească pe alb).
  ['jar', 'Jar', 'modern', 'verdana', 'jar'],
  // 05.11, 21:00: Scânteie, perechea temei din Slides și Sheets (titluri Tahoma bleumarin de oțel, Titlu 2 albastru de arc electric închis, ca să se citească pe alb).
  ['scanteie', 'Scânteie', 'modern', 'tahoma', 'scanteie'],
  // 05.11, 21:25: Tipar, perechea temei din Slides și Sheets (titluri Arial negru de cerneală, Titlu 2 magenta închis, ca să se citească pe alb).
  ['tipar', 'Tipar', 'modern', 'arial', 'tipar'],
  // 05.11, 22:25: Carton, perechea temei din Slides și Sheets (titluri Verdana maro de carton, Titlu 2 verde de reciclare).
  ['carton', 'Carton', 'modern', 'verdana', 'carton'],
  // 05.11, 22:52: Pergament, perechea temei din Slides și Sheets (titluri Palatino maro-roșcat de cerneală, Titlu 2 auriu-ocru).
  ['pergament', 'Pergament', 'elegant', 'palatino', 'pergament'],
  // 05.11, 23:30: Cetină, perechea temei din Slides și Sheets (titluri Trebuchet verde de pădure, Titlu 2 maro de rășină, ca să se citească pe alb).
  ['cetina', 'Cetină', 'modern', 'trebuchet', 'cetina'],
  // 05.11, 23:50: Piele, perechea temei din Slides și Sheets (titluri Georgia maro de piele, Titlu 2 roșu de frizerie, ca să se citească pe alb).
  ['piele', 'Piele', 'elegant', 'georgia', 'piele'],
  // 06.11, 00:15: Lustru, perechea temei din Slides și Sheets (titluri Cambria aproape negre, Titlu 2 roșu-vișiniu de piele lustruită, ca să se citească pe alb).
  ['lustru', 'Lustru', 'elegant', 'cambria', 'lustru'],
  // 06.11, 00:30: Satin, perechea temei din Slides și Sheets (titluri Palatino roz închis, Titlu 2 violet de scenă, ca să se citească pe alb).
  ['satin', 'Satin', 'elegant', 'palatino', 'satin'],
  // 06.11, 00:55: Argilă, perechea temei din Slides și Sheets (titluri Cambria maro de lut ars, Titlu 2 albastru de glazură).
  ['argila', 'Argilă', 'clasic', 'cambria', 'argila'],
  // 06.11, 01:10: Ceai, perechea temei din Slides și Sheets (titluri Trebuchet MS verde de frunză, Titlu 2 chihlimbar de miere).
  ['ceai', 'Ceai', 'implicit', 'trebuchet', 'ceai'],
  // 06.11, 01:35: Moară, perechea temei din Slides și Sheets (titluri Georgia maro de lemn vechi, Titlu 2 albastru de iaz).
  ['moara', 'Moară', 'clasic', 'georgia', 'moara'],
  // 06.11, 01:47: Hipodrom, perechea temei din Slides și Sheets (titluri Palatino verde închis de pistă, Titlu 2 roșu de jocheu).
  ['hipodrom', 'Hipodrom', 'elegant', 'palatino', 'hipodrom'],
];

/** Stilurile documentului după alegerea unei teme (setul, apoi fonturile, apoi culorile). */
export function applyTheme(id: string): DocStyles | undefined {
  const t = THEMES.find(([k]) => k === id);
  if (!t) return undefined;
  return withThemeColors(withThemeFonts(styleSet(t[2]), t[3]), t[4]);
}
/** Ce temă are documentul ('' dacă stilurile au fost schimbate altfel). */
export function themeOf(st: DocStyles | undefined): string {
  const t = THEMES.find(([k]) => STYLE_KEYS.every(([s]) => sameStyle(st?.[s], applyTheme(k)?.[s])));
  return t ? t[0] : '';
}

// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Limba interfeței (PLAN, „Finalul cerut” b): Română (implicit) sau English.
// Textele aplicației sunt scrise în română direct în cod; în engleză, un observator traduce pe loc textele și titlurile
// din rama aplicației (bara din stânga, taburile, panglicile, meniurile, paleta de comenzi), după dicționarul din i18n-en.ts.
// Conținutul utilizatorului (documente, celule, notițe, diapozitive) nu se atinge: se traduc doar zonele din ROOTS, iar în ele
// se sar câmpurile de scris și zonele editabile. Înapoi la română, textele traduse își primesc originalul.
import { useEffect, useState } from 'react';
import { api } from './api';
import { EN, EN_TRANSITIONS } from './i18n-en';
import { EN_IMAGES } from './i18n-en-images';
import { EN_VIDEO } from './i18n-en-video';
import { EN_DOCS_DLG } from './i18n-en-docs-dlg';
import { EN_SHEETS_DLG } from './i18n-en-sheets-dlg';
import { EN_SLIDES_DLG } from './i18n-en-slides-dlg';
import { EN_PDF_DLG } from './i18n-en-pdf-dlg';
import { EN_STATUS, STATUS_PATTERNS } from './i18n-en-status';
import { EN_ALERTS, ALERT_PATTERNS } from './i18n-en-alerts';
import { EN_ERRORS, ERROR_PATTERNS } from './i18n-en-errors';
import { EXTRA } from './i18n-extra';

// Mesajele de eroare ale cititorilor de fișiere pot apărea oriunde (fereastră mică, stare, dialog): stau în dicționarul de bază.
Object.assign(EN, EN_ERRORS);

export type Lang = 'ro' | 'en';

/** Zonele traduse: toată fereastra (23.10: înainte doar rama, iar ecranele de start, meniurile de clic dreapta, listele și
 *  textele de pe pagină rămâneau în română). Textul utilizatorului se ocolește prin SKIP. */
const ROOTS = 'body';
/** Zonele care țin text al utilizatorului: câmpurile de scris, celulele, notițele, casetele de pe slide, paginile PDF, numele fișierelor. */
const SKIP = '[contenteditable="true"], textarea, input:not([type=range]):not([type=color]):not([type=checkbox]):not([type=radio]), .no-i18n, .ribbon-recent-item, .pic-layer-name, [data-prop="name"], .vd-lib-name, .vd-music-name, .vd-prompter, .vd-cue-text, .sl-show-all-grid, table.grid td, .sheet-tab, .notes-item-title, .notes-item-text, .note-title, .sl-el, .sl-pgnum, .textLayer, .pdf-page-box, .recent-name, .recent-path, .ProseMirror';
/** Pentru titluri: numele stratului și valoarea câmpurilor sunt ale utilizatorului, dar explicațiile de pe ele („Dublu-click: redenumește”, „Grosimea conturului”) sunt ale noastre. */
const SKIP_ATTR = '[contenteditable="true"], .no-i18n, .toolbar-file, .ribbon-recent-item, [data-prop="name"]';
/** Textele de umplutură din căsuțele goale („Click și scrie titlul”) se traduc și pe zonele editabile. */
const PH_ATTRS = new Set(['placeholder', 'data-ph', 'data-placeholder']);
// label: titlurile grupurilor din liste (<optgroup label=…>).
const ATTRS = ['title', 'aria-label', 'label', 'placeholder', 'data-ph', 'data-placeholder', 'data-txt', 'data-otxt', 'data-mtxt', 'data-htxt', 'data-mlabel'] as const;

/** Dicționarele adăugate după verificarea completă (src/i18n-extra): pe aplicație și comune. */
const MOD_EXTRA: Record<string, Record<string, string>> = {};
const COMMON_EXTRA: Record<string, string> = {};
const ALL_EXTRA: Record<string, string> = {};
const EXTRA_PATTERNS: Pattern[] = [];
const escRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Ca la traducere: fără semnele de la început (pictograme, ghilimele) și fără „…”, „:”, „▾” și spațiile de la capăt. */
const bare = (x: string) => x.trim().replace(/^[^\p{L}\p{N}{]+/u, '').replace(/[\s▾▸…:]+$/, '');
for (const { modules, data } of EXTRA) {
  const d: Record<string, string> = { ...(data.dict ?? {}) };
  // Bucățile de frază („ (obișnuite)”, „Exportul .odt a eșuat: ”) se caută fără spațiile și semnele de la capete.
  for (const [k, v] of Object.entries(data.dict ?? {})) { const b = bare(k); if (b && b !== k && !(b in d)) d[b] = bare(v) || v.trim(); }
  if (!modules) Object.assign(COMMON_EXTRA, d);
  else for (const m of modules) Object.assign((MOD_EXTRA[m] ??= {}), d);
  for (const [k, v] of Object.entries(d)) if (!(k in ALL_EXTRA)) ALL_EXTRA[k] = v;
  // Șabloanele „Pagina {0} din {1}” devin tipare; bucățile se traduc dacă se pot, altfel rămân cum sunt (numere, nume).
  for (const [k0, v0] of Object.entries(data.templates ?? {})) {
    const k = bare(k0) || k0.trim(), v = bare(v0) || v0.trim();
    // Tiparele cu prea puțin text fix („{0} și {1}”, „{0} {1}”) s-ar potrivi cu orice frază: nu se folosesc
    // (cele care încep cu un cuvânt, ca „Pagina {0} din {1}”, sunt sigure).
    const letters = (x: string) => (x.match(/\p{L}/gu) ?? []).length;
    if (letters(k.replace(/\{\d+\}/g, '')) < 4) continue;
    const parts = k.split(/\{(\d+)\}/);
    const order: number[] = [];
    let re = '^';
    parts.forEach((p, i) => { if (i % 2) { order.push(+p); re += '(.+?)'; } else re += escRe(p); });
    const quoted = new Set(order.filter((n) => new RegExp('[„"“«(]\\{' + n + '\\}[”"»)]').test(k)));
    EXTRA_PATTERNS.push([new RegExp(re + '$', 's'), (m, tr) => {
      let bad = false;
      const r = v.replace(/\{(\d+)\}/g, (_, n: string) => {
        const g = m[order.indexOf(+n) + 1] ?? '';
        if (!/[A-Za-zĂÂÎȘȚăâîșț]/.test(g) || quoted.has(+n)) return g;
        const t = tr(g);
        // O frază românească netradusă în locul bucății: tiparul nu se potrivește (altfel ar ieși jumătate-jumătate).
        if (t === g && (g.trim().split(/\s+/).length > 1 || /[ăâîșțĂÂÎȘȚ]/.test(g))) bad = true;
        return t;
      });
      return bad ? null : r;
    }]);
  }
}

let lang: Lang = 'ro';
let observer: MutationObserver | null = null;
/** Textul original (românesc) și traducerea pusă de noi, pentru fiecare nod de text / atribut schimbat. */
const textOrig = new WeakMap<Text, { ro: string; en: string }>();
const attrOrig = new WeakMap<Element, Record<string, { ro: string; en: string }>>();

/** Scurtătura de la capăt: „Aldin (Ctrl+B)”. */
const KBD_TAIL = /^(.*?)(\s*\((?:Ctrl|Alt|Shift|F\d|Esc|Tab|Enter|Delete|Backspace|Space|[A-Z](?=\)))[^)]*\))$/s;

/** Cuvinte românești rămase într-o traducere (litere românești sau cuvintele de legătură cele mai dese). */
const RO_LEFT = /[ăâîșțĂÂÎȘȚ]|\b(și|sau|pentru|din|pe|la|cu|de|ale|unui|unei|celule|coloane|rânduri|foi|poze|clipuri|grupuri|exemplare|exemplar|medie|zone|pagini|fișiere|slide-uri)\b/;

/** Tiparele titlurilor făcute din bucăți („Comenzile din grupul Font”): partea din paranteză se traduce și ea. */
/** Un tipar: textul englez cu $1 (bucata tradusă), $R1… (bucăți lăsate cum sunt) sau o funcție care compune textul (tr traduce o bucată, altfel o lasă). */
export type Pattern = [RegExp, string | ((m: RegExpExecArray, tr: (x: string) => string) => string | null)];
const WORK: Record<string, string> = { tabelul: 'spreadsheet', documentul: 'document', diapozitivul: 'slide', pagina: 'page' };
const PATTERNS: Pattern[] = [
  [/^Poster: pagina curentă \((\d+)\) mărită pe mai multe foi, pe care le lipești$/s, 'Poster: the current page ($1) enlarged over several sheets that you stick together'],
  [/^Comenzile din grupul (.+)$/s, 'Commands in the $1 group'],
  [/^Grupul (.+)$/s, '$1 group'],
  [/^(.+): variante$/s, '$1: options'],
  [/^Toate opțiunile: (.+)$/s, 'All options: $1'],
  [/^Uneltele pentru (.+)$/s, 'Tools for $1'],
  [/^(.+): pune ultima culoare aleasă$/s, '$1: apply the last color chosen'],
  [/^(.+): alege din paletă$/s, '$1: choose from the palette'],
  [/^Paleta: (.+)$/s, 'Palette: $1'],
  [/^Număr de cuvinte \(Ctrl\+Shift\+G\): ([\d.]+) cuvinte; fereastra arată și caracterele, paragrafele și paginile$/s, 'Word Count (Ctrl+Shift+G): $1 words; the window also shows characters, paragraphs and pages'],
  [/^Mărimea paginii pe ecran \(acum (\d+)%; Ctrl \+ rotița mouse-ului\); tipărirea nu se schimbă$/s, 'Page size on screen (now $1%; Ctrl + mouse wheel); printing does not change'],
  [/^(.+): alege întâi o casetă de text$/s, '$1: select a text box first'],
  [/^(.+): alege întâi o casetă de text sau o formă$/s, '$1: select a text box or a shape first'],
  [/^Altă culoare: (.+)$/s, 'More colors: $1'],
  [/^(.+): pentru text, bife, desen și forme \(și pentru elementul ales\)$/s, '$1: for text, check marks, drawing and shapes (and for the selected item)'],
  [/^Tema (.+): culorile și fonturile ei pe toată prezentarea \(slide-urile cu fundal ales de mână îl păstrează\)$/s, 'The $1 theme: its colors and fonts on the whole presentation (slides with a hand-picked background keep it)'],
  [/^Tema (.+)$/s, '$1 theme'],
  [/^Varianta (\d+) a temei: aceleași fonturi, alte culori \(slide-urile cu fundal ales de mână îl păstrează\)$/s, 'Theme variant $1: the same fonts, other colors (slides with a hand-picked background keep it)'],
  [/^Varianta (\d+)$/s, 'Variant $1'],
  [/^Potrivit \((\d+)%\)$/s, 'Fit ($1%)'],
  [/^Închide panoul (.+)$/s, 'Close the $1 panel'],
  [/^Versiune de test: mai merge ([0-9]+) zile[.]$/s, 'Test version: $R1 days left.'],
  [/^Citesc textul din poză, pe calculator [(]nimic nu pleacă pe internet[)]… ([0-9]+)%$/s, 'Reading the text in the picture, on this computer (nothing goes to the internet)… $R1%'],
  [/^Textul a fost salvat în (.+)$/s, 'The text was saved in $R1'],
  [/^([0-9]+) cuvinte citite nesigur [(]încadrate cu portocaliu pe poză[)][.] Clic pe unul ca să-l găsești în text$/s, '$R1 words read with low confidence (framed in orange on the picture). Click one to find it in the text'],
  // Taburile de sus: „Închide Notițe” / „Închide raport.docx” (numele aplicației se traduce, al fișierului nu).
  [/^Închide (Acasă|Notițe|Docs|Sheets|PDF|Imagini|Slides|Video|Observații|Studio de documente|.+[.][A-Za-z0-9]{2,5})$/s, (m, tr) => 'Close ' + tr(m[1])],
  // Titlul tabului „PDF: Document nou.pdf (nesalvat)” și întrebarea de la închidere: numele fișierului rămâne (afară de cele puse de noi).
  [/^(.+?): (.+) [(]nesalvat[)]$/s, (m, tr) => tr(m[1]) + ': ' + (look(m[2]) ?? m[2]) + ' (unsaved)'],
  [/^Ai modificări nesalvate în (.+?)(?: [(]„(.+)”[)])?[.] Dacă închizi tabul, se pierd[.]$/s, (m, tr) => 'You have unsaved changes in ' + tr(m[1]) + (m[2] ? ' (“' + (look(m[2]) ?? m[2]) + '”)' : '') + '. If you close the tab, they will be lost.'],
  [/^(.+): alege varianta$/s, '$1: choose an option'],
  // Cele două variante ale meniului („Un rând subțire de meniuri…”, „Sus meniurile…”) au la capăt numele locului de lucru.
  [/^Un rând subțire de meniuri [(]Fișier, Pornire, Inserare…[)]; fiecare se deschide ca listă, cu scurtăturile scrise în dreapta, iar (tabelul|documentul|diapozitivul|pagina) are mai mult loc$/s, (m) => 'A thin row of menus (File, Home, Insert…); each opens as a list, with the shortcuts written on the right, and the ' + WORK[m[1]] + ' has more room'],
  [/^Sus meniurile și o singură bară subțire cu butoanele folosite des [(]Pornire[)]; comenzile rare stau în meniuri, iar Ctrl[+]F1 ascunde bara, ca (tabelul|documentul|diapozitivul|pagina) să aibă tot locul$/s, (m) => 'Menus at the top and a single thin bar with the frequently used buttons (Home); rare commands are in the menus, and Ctrl+F1 hides the bar so the ' + WORK[m[1]] + ' has all the room'],
  [/^Mostra (#[0-9a-fA-F]{3,8})$/s, 'Swatch $1'],
  [/^Filtrele din grupul (.+): se deschide panoul 🌀 Filtre cu filtrul ales$/s, 'Filters in the $1 group: the 🌀 Filters panel opens with the chosen filter'],
  [/^Adaugă pixelii vecini cu selecția care au culori din gama celor selectate \(cu toleranța baghetei: (\d+)\) \(Grow\)$/s, 'Adds the pixels next to the selection whose colors are in the range of the selected ones (with the magic wand tolerance: $1)'],
  [/^Adaugă toți pixelii din poză cu culori din gama celor selectate, oriunde ar fi \(cu toleranța baghetei: (\d+)\) \(Similar\)$/s, 'Adds all pixels in the picture with colors in the range of the selected ones, wherever they are (with the magic wand tolerance: $1)'],
  [/^(.+): cum apare slide-ul acesta în prezentare \(se păstrează și în \.pptx\)$/s, (m, tr) => tr(m[1]) + ': how this slide appears in the show (kept in .pptx too)'],
  [/^Rotește vederea cu 90° \(Ctrl\+Shift\+\+ \/ Ctrl\+Shift\+-\): doar pe ecran, fișierul nu se schimbă\. Clic dreapta: înapoi drept\. Acum: (\d+)°\.$/s, 'Rotate View by 90° (Ctrl+Shift++ / Ctrl+Shift+-): only on screen, the file does not change. Right-click: back upright. Now: $1°.'],
  [/^Stilul „(.+)”: clic îl pune pe paragrafele selectate$/s, 'The “$1” style: click to apply it to the selected paragraphs'],
  // Imagini, panourile Straturi, Canale și Histogramă (fără „\”: parantezele și punctul stau între [ ]).
  [/^(.+): mută stratul ales în poză [(]după pixelii lui vizibili[)]; dacă e legat cu 🔗, aliniază între ele toate straturile legate$/s, '$1: move the selected layer in the picture (by its visible pixels); if it is linked with 🔗, align all linked layers to each other'],
  [/^(.+): mută stratul ales în selecție [(]după pixelii lui vizibili[)]; dacă e legat cu 🔗, aliniază între ele toate straturile legate$/s, '$1: move the selected layer in the selection (by its visible pixels); if it is linked with 🔗, align all linked layers to each other'],
  [/^Doar canalul (.+): se vede alb-negru și numai el se modifică [(]Shift[+]clic: adaugă alt canal; Ctrl[+]clic: selecție din el[)]$/s, 'Only the $1 channel: it shows in black and white and only it changes (Shift+click: add another channel; Ctrl+click: selection from it)'],
  [/^Selecție din (.+)$/s, 'Selection from $1'],
  [/^Culoarea: (.+)$/s, 'Color: $1'],
  [/^Culoarea (#[0-9a-fA-F]{3,8})$/s, 'Color $1'],
  [/^Media [(]([0-9]+)[)]$/s, 'Media ($1)'],
  [/^Ancora ([1-9])$/s, 'Anchor $1'],
  // Docs, ferestrele Mergi la și Etichete.
  [/^([0-9]+) în document$/s, '$1 in the document'],
  [/^Pe toată foaia [(]([0-9]+)[)]$/s, 'The whole sheet ($1)'],
  // Slides, Verifică accesibilitatea.
  [/^Am găsit ([0-9]+) (?:lucru|lucruri) de îmbunătățit, ca prezentarea să poată fi urmărită și cu un cititor de ecran sau de cine vede mai greu[.] Click pe unul te duce la el[.]$/s, 'Found $1 thing(s) to improve, so the presentation can be followed with a screen reader or by people who see less well. Click one to go to it.'],
  [/^Încadrare: (.+)[.] Clic: următoarea [(]umple cadrul [/] întreagă pe fundal estompat [/] cu margini negre[)]$/s, 'Fit: $1. Click: the next one (fill the frame / whole on a blurred background / with black bars)'],
  [/^Rotește cu 90° [(]acum ([0-9]+)°[)]$/s, 'Rotate by 90° (now $1°)'],
  [/^Expunere: (.+) [(]ca la aparatul foto: o treaptă dublează lumina[)]$/s, 'Exposure: $1 (as on a camera: one stop doubles the light)'],
  [/^([+−][0-9,]+) trepte$/s, '$1 stops'],
  [/^Opacitate: ([0-9]+)% [(]mai puțin = mai transparentă, peste negru[)]$/s, 'Opacity: $1% (less = more transparent, over black)'],
  [/^Rotire fină [(]pentru un orizont strâmb[)]: (-?[0-9.]+)°; poza se mărește singură ca să nu rămână colțuri goale[.] Dublu-clic: 0°$/s, 'Fine rotation (for a crooked horizon): $1°; the photo enlarges by itself so no empty corners remain. Double-click: 0°'],
  [/^Mărimea: ([0-9]+)% din cea a stilului$/s, 'Size: $1% of the style size'],
  [/^(.+) [(]doar la clipuri video[)]$/s, '$1 (video clips only)'],
  [/^([0-9.]+)% din poză e alb pur: luminile sunt arse [(]scade Expunerea sau Luminile[)][.]$/s, '$1% of the picture is pure white: the highlights are blown out (lower the Exposure or the Highlights).'],
  [/^([0-9.]+)% din poză e negru pur: umbrele sunt înecate [(]ridică Umbrele[)][.]$/s, '$1% of the picture is pure black: the shadows are crushed (raise the Shadows).'],
  [/^Poza e întunecată [(]media e la ([0-9]+)% din alb[)][.]$/s, 'The picture is dark (the mean is at $1% of white).'],
  [/^Poza e foarte deschisă [(]media e la ([0-9]+)% din alb[)][.]$/s, 'The picture is very light (the mean is at $1% of white).'],
  ...STATUS_PATTERNS,
  ...ALERT_PATTERNS,
  ...ERROR_PATTERNS,
  // Șabloanele din src/i18n-extra, după cele vechi (care știu pluralul românesc).
  ...EXTRA_PATTERNS,
];
const EN_VALUES = new Set([...Object.values(EN), ...Object.values(EN_IMAGES), ...Object.values(EN_VIDEO), ...Object.values(EN_STATUS), ...Object.values(EN_DOCS_DLG), ...Object.values(EN_SHEETS_DLG), ...Object.values(EN_SLIDES_DLG), ...Object.values(EN_PDF_DLG), ...Object.values(EN_ALERTS), ...Object.values(ALL_EXTRA)]);
/** Textele puse deja de noi (pentru testul care caută ce a rămas netradus). */
const produced = new Set<string>();

/** Dicționarele care au întâietate într-o anumită zonă (același cuvânt românesc, alt sens: „Ștergere” e Delete, dar ca tranziție e Wipe). */
const CONTEXTS: [string, Record<string, string>][] = [
  // Barele de stare: înaintea modulelor, ca „din” / „Pagina” să aibă sensul de acolo și în Imagini.
  ['.statusbar, .status-msg', EN_STATUS],
  ['.sl-tr-card, .sl-tr-gallery, .sl-tr-menu', EN_TRANSITIONS],
  // Imagini are termenii ei (Contur = Stroke, Margine = Border, Relief = Emboss): doar în modulul Imagini.
  ['.module-pane[data-module="images"]', EN_IMAGES],
  ['.module-pane[data-module="video"]', EN_VIDEO],
  // Ferestrele din Docs: cuvinte scurte cu sensul lor de acolo („Funcția” = Title la linia de semnătură).
  ['.module-pane[data-module="doc"] [role="dialog"], .module-pane[data-module="doc"] .searchbar, .chart-dlg', EN_DOCS_DLG],
  ['.module-pane[data-module="sheets"] [role="dialog"]', EN_SHEETS_DLG],
  ['.module-pane[data-module="slides"] [role="dialog"], .sl-show-tool', EN_SLIDES_DLG],
  ['.module-pane[data-module="pdf"] [role="dialog"]', EN_PDF_DLG],
];
let ctx: Record<string, string> | null = null;
/** Dicționarul aplicației în care e textul (din src/i18n-extra), după cel al zonei. */
let modCtx: Record<string, string> | null = null;
/** Ultima variantă: dicționarele zonelor, unite (un buton „Nou” din meniul Fișier e tradus doar în dicționarul ferestrelor). */
const ZONES_ALL: Record<string, string> = {};
for (const [, d] of CONTEXTS) for (const [k, v] of Object.entries(d)) if (!(k in ZONES_ALL)) ZONES_ALL[k] = v;
const look = (k: string): string | undefined => ctx?.[k] ?? modCtx?.[k] ?? EN[k] ?? COMMON_EXTRA[k] ?? ALL_EXTRA[k] ?? ZONES_ALL[k];
const ctxOf = (el: Element | null) => (el && CONTEXTS.find(([sel]) => el.closest(sel))?.[1]) || null;
const modOf = (el: Element | null) => { const m = (el?.closest('.module-pane') as HTMLElement | null)?.dataset.module; return (m && MOD_EXTRA[m]) || null; };

/** Traducerea unui text întreg sau null. Păstrează pictogramele din față, „▾ … :” de la capăt și scurtătura dintre paranteze. */
export function translate(s: string): string | null {
  const t = s.trim();
  if (!t || !/[A-Za-zĂÂÎȘȚăâîșț]/.test(t)) return null;
  const whole = look(t);
  if (whole !== undefined) return s.replace(t, whole);
  const lead = /^[^\p{L}\p{N}]*/u.exec(t)![0];
  const rest = t.slice(lead.length);
  const tail = /[\s▾▸…:]*$/.exec(rest)![0];
  const core = rest.slice(0, rest.length - tail.length);
  if (core && look(core) !== undefined) return s.replace(t, lead + look(core) + tail);
  const k = KBD_TAIL.exec(core);
  if (k) {
    const base = k[1].replace(/[…\s]+$/, '');
    if (look(base) !== undefined) return s.replace(t, lead + look(base) + k[1].slice(base.length) + k[2] + tail);
  }
  // Un tipar al cărui rezultat a lăsat cuvinte românești („Made 12 exemplare”) cedează locul următorului; dacă niciunul nu dă
  // un rezultat curat, rămâne primul.
  let first: string | null = null;
  const done = (r: string) => { if (!RO_LEFT.test(r)) return r; first ??= r; return null; };
  for (const [re, out] of PATTERNS) {
    const m = re.exec(core);
    if (!m) continue;
    // „$R1”, „$R2”: bucata rămâne cum e (nume de fișier, text al utilizatorului), fără traducere.
    if (typeof out === 'function') { const r = out(m, (x) => look(x) ?? translate(x) ?? x); if (r === null) continue; const ok = done(s.replace(t, lead + r + tail)); if (ok !== null) return ok; continue; }
    if (m[1] === undefined) return s.replace(t, lead + out + tail);
    if (out.includes('$R')) { const ok = done(s.replace(t, lead + out.replace(/[$]R([0-9])/g, (_, i: string) => m[+i] ?? '') + tail)); if (ok !== null) return ok; continue; }
    // Numerele („100”, „1.234”) trec neschimbate.
    const inner = look(m[1]) ?? look(m[1].charAt(0).toUpperCase() + m[1].slice(1)) ?? translate(m[1]) ?? (/^([\d.,:]+|#[0-9a-fA-F]{3,8})$/.test(m[1]) ? m[1] : null);
    if (inner !== null && inner !== undefined) { const ok = done(s.replace(t, lead + out.replace('$1', inner.trim()) + tail)); if (ok !== null) return ok; }
  }
  if (first !== null) return first;
  // „Temă: luminoasă”: fiecare parte, dacă se cunosc amândouă.
  const c = core.indexOf(': ');
  if (c > 0) {
    const a = look(core.slice(0, c)), after = core.slice(c + 2);
    // „Lumină: 100%”: partea fără litere (numere, procente) rămâne cum e.
    const b = translate(after) ?? (/[A-Za-zĂÂÎȘȚăâîșț]/.test(after) ? null : after);
    if (a !== undefined && b !== null) return s.replace(t, lead + a + ': ' + b + tail);
  }
  return null;
}

/** Pentru teste: traducerea cu oricare dicționar (de bază sau al unei zone), sau null dacă textul nu e în niciunul. */
export function translateAny(s: string): string | null {
  const prev = ctx;
  try {
    for (const d of [null, ...CONTEXTS.map(([, x]) => x), ...Object.values(MOD_EXTRA)]) { ctx = d; const r = translate(s); if (r !== null) return r; }
    return null;
  } finally { ctx = prev; }
}

// Mesajul de stare de lângă numele fișierului (.status-msg, în Slides și Video) se traduce, deși numele de lângă el nu.
const skipped = (el: Element | null, skip = SKIP) => !el || !el.closest(ROOTS) || (!!el.closest(skip) && !el.closest('.status-msg'));

/** Siguranță: un nod pe care altcineva îl pune mereu înapoi în română nu se mai traduce după 25 de încercări (fără bucle fără sfârșit). */
const flips = new WeakMap<Node, number>();
const tooMany = (n: Node) => { const c = (flips.get(n) ?? 0) + 1; flips.set(n, c); return c > 25; };
function doText(n: Text) {
  const o = textOrig.get(n);
  if (o && o.en === n.data) return;
  if (skipped(n.parentElement)) return;
  ctx = ctxOf(n.parentElement); modCtx = modOf(n.parentElement);
  const t = translate(n.data);
  ctx = null; modCtx = null;
  if (t !== null && t !== n.data) { if (tooMany(n)) return; textOrig.set(n, { ro: n.data, en: t }); produced.add(t.trim()); n.data = t; }
}
function doAttrs(el: Element) {
  if (!el.closest(ROOTS) || el.closest('.no-i18n, .ProseMirror')) return;
  const skip = skipped(el, SKIP_ATTR);
  for (const a of ATTRS) {
    const v = el.getAttribute(a);
    if (!v || (skip && !PH_ATTRS.has(a))) continue;
    const rec = attrOrig.get(el);
    if (rec?.[a]?.en === v) continue;
    ctx = ctxOf(el); modCtx = modOf(el);
    // „Anulează” e Cancel în ferestre, dar pe butonul ↶ e Undo.
    const t = v === 'Anulează' && el.textContent?.trim() === '↶' ? 'Undo' : translate(v);
    ctx = null; modCtx = null;
    if (t !== null && t !== v) { if (tooMany(el)) return; const r = rec ?? {}; r[a] = { ro: v, en: t }; attrOrig.set(el, r); produced.add(t.trim()); el.setAttribute(a, t); }
  }
}
function walk(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) { doText(root as Text); return; }
  if (!(root instanceof Element)) return;
  doAttrs(root);
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    if (n.nodeType === Node.TEXT_NODE) doText(n as Text); else doAttrs(n as Element);
  }
}
function restore() {
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    if (n.nodeType === Node.TEXT_NODE) { const o = textOrig.get(n as Text); if (o && o.en === (n as Text).data) (n as Text).data = o.ro; textOrig.delete(n as Text); }
    else { const el = n as Element, rec = attrOrig.get(el); if (rec) { for (const [a, o] of Object.entries(rec)) if (el.getAttribute(a) === o.en) el.setAttribute(a, o.ro); attrOrig.delete(el); } }
  }
}

function apply(next: Lang) {
  lang = next;
  document.documentElement.lang = next;
  observer?.disconnect();
  observer = null;
  if (next === 'ro') { restore(); return; }
  walk(document.body);
  observer = new MutationObserver((list) => {
    for (const m of list) {
      if (m.type === 'characterData') doText(m.target as Text);
      else if (m.type === 'attributes') doAttrs(m.target as Element);
      else m.addedNodes.forEach(walk);
    }
  });
  observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...ATTRS] });
}

const EVT = 'suite-lang';
let started = false;
/** Pornește limba din setări (o dată, la începutul aplicației). */
export function startLang() {
  if (started) return;
  started = true;
  void api.getSettings().then((s) => { if (s.lang === 'en') { apply('en'); window.dispatchEvent(new CustomEvent(EVT)); } }).catch(() => {});
}
export function currentLang(): Lang { return lang; }
/** Schimbă limba (se ține minte în setări). */
export function setLang(next: Lang) {
  if (next === lang) return;
  apply(next);
  void api.setSettings({ lang: next }).catch(() => {});
  window.dispatchEvent(new CustomEvent(EVT));
}
/** Limba de acum, pentru butoanele care o arată. */
export function useLang(): Lang {
  const [l, setL] = useState(lang);
  useEffect(() => { const on = () => setL(lang); window.addEventListener(EVT, on); return () => window.removeEventListener(EVT, on); }, []);
  return l;
}

/** Ferestrele mici de mesaj (alert / confirm / prompt): în EN, textul trece prin traducător, rând cu rând. */
const MSG_CTX: Record<string, string> = { ...EN_STATUS, ...EN_ALERTS };
const NL = String.fromCharCode(10);
export function translateMsg(s: string): string {
  if (lang !== 'en' || typeof s !== 'string') return s;
  const prev = ctx;
  ctx = MSG_CTX;
  try { return s.split(NL).map((l) => translate(l) ?? l).join(NL); } finally { ctx = prev; }
}
{
  const nativeAlert = window.alert.bind(window), nativeConfirm = window.confirm.bind(window), nativePrompt = window.prompt.bind(window);
  window.alert = (m?: unknown) => nativeAlert(typeof m === 'string' ? translateMsg(m) : m);
  // Semnul suiteWrapped: ask.tsx recunoaște confirm() al nostru (nu unul înlocuit de un test) și arată fereastra proprie.
  window.confirm = Object.assign((m?: string) => nativeConfirm(typeof m === 'string' ? translateMsg(m) : m), { suiteWrapped: true });
  window.prompt = (m?: string, d?: string) => nativePrompt(typeof m === 'string' ? translateMsg(m) : m, d);
}

declare global { interface Window { __suiteLang?: { set(l: Lang): void; get(): Lang; translate(s: string): string | null; translateMsg(s: string): string; isEnglish(s: string): boolean } } }
window.__suiteLang = { set: setLang, get: currentLang, translate, translateMsg, isEnglish: (s: string) => EN_VALUES.has(s.trim()) || produced.has(s.trim()) };

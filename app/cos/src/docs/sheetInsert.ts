// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Inserare → ▦ Foaie de calcul…: o foaie dintr-un .xlsx / .ods / .csv pusă la cursor ca tabel de document, cu valorile
// calculate ale formulelor și formatarea din Sheets (sumele în formatul lor, aldin, cursiv, culori, fundal, aliniere, font,
// celule îmbinate, lățimile coloanelor). Dacă fișierul are mai multe foi, Docs întreabă care. Tabelul rămâne legat de fișier
// (calea și numele foii pe tabel, linkPath / linkSheet): ↻ Actualizează foile legate îl citește din nou, ca Update Links din Word. Tabelul „ca în Sheets” vine din pdf/sheetPages.ts;
// aici stilurile celulei se mută acolo unde le citește editorul (fundalul pe celulă, restul pe text). Testat în
// tests/cdp/cdp-docs-sheet.mjs.
import type { Editor } from '@tiptap/react';
import { DOMParser as PmDOMParser, type Node as PmNode } from '@tiptap/pm/model';
import { api } from '../api';
import type { SheetHtml } from '../pdf/sheetPages';

/** Lățimea de scris a paginii A4 din Docs, în pixeli (cât încape un tabel fără să iasă din pagină). */
const PAGE_W = 640;
const GRID = '#d0d0d0';
const TEXT_PROPS =['color', 'font-weight', 'font-style', 'text-decoration', 'text-decoration-line', 'font-family', 'font-size'];

/** O culoare CSS („rgb(…)”, „#abc”, „#aabbcc”) ca #rrggbb; altfel negru. */
function hexColor(v: string): string {
  const s = v.trim().toLowerCase();
  const rgb = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(s);
  if (rgb) return '#' + [rgb[1], rgb[2], rgb[3]].map((x) => Math.min(255, Number(x)).toString(16).padStart(2, '0')).join('');
  if (/^#[0-9a-f]{6}$/.test(s)) return s;
  if (/^#[0-9a-f]{3}$/.test(s)) return '#' + [...s.slice(1)].map((c) => c + c).join('');
  return '#000000';
}

/** Tabelul HTML din Sheets → tabelul pe care îl citește editorul de documente. */
export function docsTableHtml(html: string, pageW = PAGE_W, link?: { path: string; sheet: string }): string {
  const d = new DOMParser().parseFromString(html, 'text/html');
  const table = d.querySelector('table');
  if (!table) return html;
  const widths = [...table.querySelectorAll('col')].map((c) => parseFloat((c as HTMLElement).style.width) || 64);
  const total = widths.reduce((s, w) => s + w, 0);
  const k = total > pageW ? pageW / total : 1;
  // Grila ocupată de celule (cu îmbinările), ca fiecare celulă să-și știe coloana de început.
  const taken: boolean[][] = [];
  const rows = [...table.querySelectorAll('tr')];
  const out = d.createElement('table');
  // Legătura cu fișierul doar cu calea întreagă de pe disc (în browser vine doar numele, nu se poate citi din nou).
  if (link && /[\\/]/.test(link.path)) { out.setAttribute('data-link-path', link.path); out.setAttribute('data-link-sheet', link.sheet); }
  rows.forEach((tr, r) => {
    const ntr = d.createElement('tr');
    let c = 0;
    for (const td of [...tr.children] as HTMLTableCellElement[]) {
      while (taken[r]?.[c]) c++;
      const cs = Math.max(1, td.colSpan || 1), rs = Math.max(1, td.rowSpan || 1);
      for (let y = r; y < r + rs; y++) for (let x = c; x < c + cs; x++) (taken[y] ??= [])[x] = true;
      const ntd = d.createElement('td');
      if (cs > 1) ntd.colSpan = cs;
      if (rs > 1) ntd.rowSpan = rs;
      if (widths.length) ntd.setAttribute('colwidth', widths.slice(c, c + cs).map((w) => Math.max(24, Math.round(w * k))).join(','));
      const st = td.style;
      const bg = st.backgroundColor;
      if (bg && bg !== 'transparent') ntd.style.backgroundColor = bg;
      if (st.verticalAlign) ntd.style.verticalAlign = st.verticalAlign;
      // Chenarele din Sheets → liniile celulei din Docs (data-cl: „fel #culoare” pe sus|dreapta|jos|stânga, cellLines.ts).
      const cl = (['Top', 'Right', 'Bottom', 'Left'] as const).map((side) => {
        const bs = st.getPropertyValue(`border-${side.toLowerCase()}-style`);
        if (!bs || bs === 'none' || bs === 'hidden') return '';
        const w = parseFloat(st.getPropertyValue(`border-${side.toLowerCase()}-width`)) || 1;
        const kind = bs === 'double' ? 'double' : bs === 'dashed' ? 'dashed' : bs === 'dotted' ? 'dotted' : w >= 2 ? 'thick' : 'single';
        const color = hexColor(st.getPropertyValue(`border-${side.toLowerCase()}-color`));
        // Linia gri subțire e grila foii (sheets/paste.ts styleToCss), nu un chenar: rămâne după liniile tabelului din Docs.
        return kind === 'single' && color === GRID ? '' : `${kind} ${color}`;
      });
      if (cl.some(Boolean)) ntd.setAttribute('data-cl', cl.join('|'));
      const lines = td.innerHTML.split(/<br\s*\/?>/i);
      for (const line of lines) {
        const p = d.createElement('p');
        const al = st.textAlign;
        if (al === 'right' || al === 'center' || al === 'justify') p.style.textAlign = al;
        const span = d.createElement('span');
        span.innerHTML = line;
        for (const prop of TEXT_PROPS) {
          const v = st.getPropertyValue(prop);
          if (v && !(prop === 'font-weight' && (v === 'normal' || v === '400')) && !(prop.startsWith('text-decoration') && v === 'none')) span.style.setProperty(prop, v);
        }
        let inner: HTMLElement = span;
        // Aldinul și cursivul ca etichete, ca editorul să le recunoască sigur.
        if (/^(bold|[6-9]00)$/.test(st.fontWeight)) { const b = d.createElement('strong'); b.appendChild(inner); inner = b; }
        if (st.fontStyle === 'italic') { const i = d.createElement('em'); i.appendChild(inner); inner = i; }
        if (span.textContent) p.appendChild(inner);
        ntd.appendChild(p);
      }
      ntr.appendChild(ntd);
      c += cs;
    }
    out.appendChild(ntr);
  });
  return out.outerHTML;
}

export interface SheetFile { file: string; path: string; list: SheetHtml[]; active: number }

/**
 * Alegi un .xlsx / .ods / .csv și se citesc foile lui (cu formulele calculate). null dacă ai renunțat; aruncă o eroare
 * dacă fișierul nu se poate citi sau e gol.
 */
export async function pickSheetFile(): Promise<SheetFile | null> {
  const file = await api.importFile('sheettable');
  if (!file) return null;
  const name = file.path.split(/[\\/]/).pop() ?? file.path;
  const { sheetTables } = await import('../pdf/sheetPages');
  const list = await sheetTables(name, file.data);
  if (!list.length) throw new Error('tabelul e gol');
  return { file: name, path: file.path, list, active: Math.max(0, list.findIndex((x) => x.active)) };
}

/** Foaia aleasă intră la cursor ca tabel; întoarce mesajul pentru bara de jos. */
export function insertSheet(editor: Editor, f: SheetFile, i: number): string {
  const t = f.list[i] ?? f.list[0];
  editor.chain().focus().insertContent(docsTableHtml(t.html, PAGE_W, { path: f.path, sheet: t.name })).run();
  return `Am pus foaia „${t.name}” din ${f.file}${t.cut ? '; tabelul e tăiat la 2000 de rânduri și 40 de coloane' : ''}.`;
}

/** Tabelele legate de fișiere din document (cu locul lor, și cele puse într-o celulă), de la sfârșit spre început. */
export function linkedTables(editor: Editor): { pos: number; node: PmNode; path: string; sheet: string }[] {
  const out: { pos: number; node: PmNode; path: string; sheet: string }[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'table' && node.attrs.linkPath) out.push({ pos, node, path: String(node.attrs.linkPath), sheet: String(node.attrs.linkSheet ?? '') });
    return true;
  });
  return out.reverse();
}

/**
 * ✎ Deschide foaia legată: fișierul tabelului legat în care e cursorul (cel mai dinăuntru); fără cursor într-unul, fișierul
 * tuturor tabelelor legate dacă e unul singur. null = nu e clar care (sau documentul n-are tabele legate).
 */
export function linkedFileAtCursor(editor: Editor): { path: string; sheet: string } | null {
  const $from = editor.state.selection.$from;
  for (let d = $from.depth; d > 0; d--) {
    const n = $from.node(d);
    if (n.type.name === 'table' && n.attrs.linkPath) return { path: String(n.attrs.linkPath), sheet: String(n.attrs.linkSheet ?? '') };
  }
  const all = linkedTables(editor);
  return all.length && all.every((t) => t.path === all[0].path) ? { path: all[0].path, sheet: all[0].sheet } : null;
}

/** Tabelele legate citite din nou din fișiere: înlocuirile de făcut și numărătorile pentru mesaj (fără să schimbe documentul). */
async function readLinked(editor: Editor, tables: ReturnType<typeof linkedTables>) {
  const { sheetTables } = await import('../pdf/sheetPages');
  const cache = new Map<string, SheetHtml[] | null>();
  const parser = PmDOMParser.fromSchema(editor.schema);
  const reps: { pos: number; size: number; node: PmNode }[] = [];
  let same = 0, gone = 0, kept = 0;
  for (const t of tables) {
    // Un tabel legat în care ai pus alt tabel (într-o celulă) rămâne cum e, ca să nu se piardă ce ai pus în el.
    let nested = false;
    t.node.descendants((n) => { if (n.type.name === 'table') nested = true; return !nested; });
    if (nested) { kept++; continue; }
    let list = cache.get(t.path);
    if (list === undefined) {
      try {
        const f = await api.readBinary(t.path, 'sheettable' as never);
        list = await sheetTables(t.path.split(/[\\/]/).pop() ?? t.path, f.data);
      } catch { list = null; }
      cache.set(t.path, list);
    }
    const sh = list?.find((x) => x.name === t.sheet) ?? (list?.length === 1 ? list[0] : undefined);
    if (!sh) { gone++; continue; }
    const dom = new DOMParser().parseFromString(docsTableHtml(sh.html, PAGE_W, { path: t.path, sheet: sh.name }), 'text/html');
    const fresh = parser.parse(dom.body).firstChild;
    if (!fresh || fresh.type.name !== 'table') { gone++; continue; }
    // Ce ai ales pe tabel în document (borduri, aliniere, încadrare, text alternativ) rămâne; doar conținutul vine din fișier.
    const node = fresh.type.create({ ...t.node.attrs, linkPath: t.path, linkSheet: sh.name }, fresh.content);
    if (node.content.eq(t.node.content)) { same++; continue; }
    reps.push({ pos: t.pos, size: t.node.nodeSize, node });
  }
  return { reps, same, gone, kept };
}

/**
 * La deschiderea documentului: câte tabele legate s-au schimbat în fișierele lor (documentul rămâne neatins; le aduce la zi
 * ↻ Actualizează foile legate). 0 dacă nu are tabele legate sau nu s-a schimbat nimic.
 */
export async function staleLinkedSheets(editor: Editor): Promise<number> {
  const tables = linkedTables(editor);
  if (!tables.length) return 0;
  try { return (await readLinked(editor, tables)).reps.length; } catch { return 0; }
}

/**
 * ↻ Actualizează foile legate: fiecare tabel pus din fișier se citește din nou (aceeași foaie, după nume) și ia locul celui vechi,
 * cu așezarea lui (bordurile, alinierea, textul alternativ) păstrată. Întoarce mesajul pentru bara de jos.
 */
export async function refreshLinkedSheets(editor: Editor): Promise<string> {
  const tables = linkedTables(editor);
  if (!tables.length) return 'Documentul nu are tabele legate de fișiere. Pune unul cu Inserare → ▦ Foaie de calcul….';
  const { reps, same, gone, kept } = await readLinked(editor, tables);
  if (reps.length) {
    // Pozițiile sunt de la sfârșit spre început și trec prin înlocuirile de dinainte, ca să nu se mute una pe alta.
    const tr = editor.state.tr;
    for (const r of reps) tr.replaceWith(tr.mapping.map(r.pos), tr.mapping.map(r.pos + r.size), r.node);
    editor.view.dispatch(tr);
  }
  const n = reps.length;
  // „Foile legate: …; ….”, ca fiecare bucată să se traducă singură pe ecran (tiparele din i18n).
  return 'Foile legate: ' + [
    n ? (n === 1 ? 'un tabel e adus la zi din fișier' : `${n} tabele sunt aduse la zi din fișiere`) : '',
    same ? (same === 1 ? 'un tabel era deja la zi' : `${same} tabele erau deja la zi`) : '',
    kept ? (kept === 1 ? 'un tabel cu alt tabel în el rămâne cum e' : `${kept} tabele cu alte tabele în ele rămân cum sunt`) : '',
    gone ? (gone === 1 ? 'un fișier nu s-a putut citi (mutat, șters sau cu foaia redenumită)' : `${gone} fișiere nu s-au putut citi (mutate, șterse sau cu foi redenumite)`) : '',
  ].filter(Boolean).join('; ') + '.';
}

// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Comentariile cu fir de discuție ale celulelor (Revizuire → Comentariu nou): un comentariu + răspunsuri, cu autor și oră,
// marcat „rezolvat” când discuția s-a încheiat. Diferit de notă (o căsuță galbenă simplă, fără autor).
// În .xlsx se scriu ca în Excel 365 (xl/threadedComments + xl/persons), plus un comentariu clasic cu tot textul,
// ca programele mai vechi să-l arate măcar ca notă.

export interface CellComment {
  /** Autorul. */
  a: string;
  /** Ora (ISO). */
  t: string;
  /** Textul. */
  x: string;
}

export const MAX_COMMENTS = 50;
export const MAX_COMMENT = 2000;

/** Firul dintr-un JSON citit de pe disc (fișierul nostru), curățat; null dacă nu e bun. */
export function cleanThread(raw: unknown): CellComment[] | null {
  if (!Array.isArray(raw)) return null;
  const out: CellComment[] = [];
  for (const c of raw.slice(0, MAX_COMMENTS)) {
    if (!c || typeof c !== 'object') continue;
    const { a, t, x } = c as Record<string, unknown>;
    if (typeof x !== 'string' || !x.trim()) continue;
    out.push({ a: typeof a === 'string' ? a.slice(0, 80) : '', t: typeof t === 'string' && !isNaN(Date.parse(t)) ? t : '', x: x.slice(0, MAX_COMMENT) });
  }
  return out.length ? out : null;
}

/** Ora unui comentariu, pe scurt: „27.10.2026, 08:15”. */
export function commentTime(t: string): string {
  const d = new Date(t);
  if (isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}, ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Tot firul ca text simplu (pentru căsuța de la trecerea mouse-ului, .ods și comentariul clasic din .xlsx). */
export function threadText(th: CellComment[], done?: boolean): string {
  return th.map((c, i) => `${i ? '↩ ' : ''}${c.a || 'Autor'}: ${c.x}`).join('\n') + (done ? '\n✓ Rezolvat' : '');
}

// ---------- .xlsx ----------

const TC_NS = 'http://schemas.microsoft.com/office/spreadsheetml/2018/threadedcomments';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Un GUID stabil (cu acolade, litere mari), scos dintr-un text: același autor primește mereu același id. */
export function guidOf(seed: string): string {
  let h1 = 0x811c9dc5, h2 = 0x01000193, h3 = 0x9e3779b9, h4 = 0x85ebca6b;
  for (let i = 0; i < seed.length; i++) {
    const k = seed.charCodeAt(i);
    h1 = Math.imul(h1 ^ k, 16777619); h2 = Math.imul(h2 ^ k, 2246822519); h3 = Math.imul(h3 ^ k, 3266489917); h4 = Math.imul(h4 ^ k, 668265263);
  }
  const hex = [h1, h2, h3, h4].map((h) => (h >>> 0).toString(16).padStart(8, '0').toUpperCase()).join('');
  return `{${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}}`;
}

export interface ThreadCell { id: string; th: CellComment[]; done?: boolean }

/** Autorii tuturor firelor din registru (xl/persons/person.xml). */
export function personsXml(names: string[]): string {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
    + `<personList xmlns="${TC_NS}" xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main">`
    + names.map((n) => `<person displayName="${esc(n || 'Autor')}" id="${guidOf('p:' + n)}" userId="${esc(n || 'Autor')}" providerId="None"/>`).join('')
    + '</personList>';
}

/** Firele unei foi (xl/threadedComments/threadedCommentN.xml). Id-ul primului comentariu e cel din comentariul clasic. */
export function threadedXml(cells: ThreadCell[], sheetN: number): string {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
    + `<ThreadedComments xmlns="${TC_NS}" xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main">`
    + cells.map((c) => {
      const root = topId(c.id, sheetN);
      return c.th.map((m, i) => {
        const id = i ? guidOf(`r:${sheetN}:${c.id}:${i}`) : root;
        const when = m.t && !isNaN(Date.parse(m.t)) ? new Date(m.t).toISOString().replace(/Z$/, '') : '2026-01-01T00:00:00.00';
        return `<threadedComment ref="${c.id}" dT="${when}" personId="${guidOf('p:' + m.a)}" id="${id}"${i ? ` parentId="${root}"` : c.done ? ' done="1"' : ''}>`
          + `<text>${esc(m.x)}</text></threadedComment>`;
      }).join('');
    }).join('')
    + '</ThreadedComments>';
}

/** Id-ul primului comentariu din fir (și autorul „tc=…” al comentariului clasic). */
export function topId(cell: string, sheetN: number): string {
  return guidOf(`t:${sheetN}:${cell}`);
}

/** Textul comentariului clasic pentru un fir, cum îl scrie Excel pentru versiunile care nu știu de fire. */
export function legacyThreadText(th: CellComment[]): string {
  return '[Threaded comment]\n\nYour version of Excel allows you to read this threaded comment; however, any edits to it will get removed if the file is opened in a newer version of Excel. Learn more: https://go.microsoft.com/fwlink/?linkid=870924\n\n'
    + th.map((c, i) => `${i ? 'Reply' : 'Comment'}:\n    ${c.x.replace(/\n/g, '\n    ')}`).join('\n');
}

/** Este textul unui comentariu clasic doar locul unui fir (care se citește din threadedComments)? */
export function isThreadStub(text: string): boolean {
  return /^\[Threaded comment\]/.test(text.trim());
}

type XNode = { name: string; attrs: Record<string, string>; kids: XNode[]; text: string };

/** Firele dintr-un threadedComments.xml, cu numele autorilor din persons (id → nume). */
export function threadsFromXml(root: XNode, persons: Record<string, string>): Record<string, { th: CellComment[]; done?: boolean }> {
  const all: XNode[] = [];
  const walk = (n: XNode) => { if (n.name === 'threadedComment') all.push(n); else n.kids.forEach(walk); };
  walk(root);
  const textOf = (n: XNode): string => (n.name === 'text' ? n.text || n.kids.map(textOf).join('') : n.kids.map(textOf).join(''));
  const tops = new Map<string, { ref: string; th: CellComment[]; done?: boolean }>();
  const out: Record<string, { th: CellComment[]; done?: boolean }> = {};
  const item = (n: XNode): CellComment => {
    // Ora din fișier e UTC, scrisă fără „Z”.
    const dT = n.attrs.dT && !/(Z|[+-]\d\d:?\d\d)$/.test(n.attrs.dT) ? n.attrs.dT + 'Z' : n.attrs.dT;
    const t = dT && !isNaN(Date.parse(dT)) ? new Date(dT).toISOString() : '';
    const body = n.kids.find((k) => k.name === 'text');
    return { a: (persons[n.attrs.personId ?? ''] ?? '').slice(0, 80), t, x: (body ? textOf(body) : '').replace(/\r\n?/g, '\n').slice(0, MAX_COMMENT) };
  };
  for (const n of all) {
    const ref = (n.attrs.ref ?? '').toUpperCase();
    if (n.attrs.parentId || !/^[A-Z]{1,3}[1-9]\d*$/.test(ref) || !n.attrs.id) continue;
    const top = { ref, th: [item(n)], ...(n.attrs.done === '1' || n.attrs.done === 'true' ? { done: true } : {}) };
    tops.set(n.attrs.id, top);
  }
  for (const n of all) {
    const top = n.attrs.parentId ? tops.get(n.attrs.parentId) : undefined;
    if (top && top.th.length < MAX_COMMENTS) top.th.push(item(n));
  }
  for (const top of tops.values()) {
    const th = top.th.filter((c) => c.x.trim());
    if (th.length && !out[top.ref]) out[top.ref] = { th, ...(top.done ? { done: true } : {}) };
  }
  return out;
}

/** Autorii din persons.xml: id → nume. */
export function personsFromXml(root: XNode): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (n: XNode) => { if (n.name === 'person' && n.attrs.id) out[n.attrs.id] = n.attrs.displayName ?? ''; else n.kids.forEach(walk); };
  walk(root);
  return out;
}

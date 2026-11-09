// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Comentariile slide-urilor în .pptx.
// Scriere: formatul clasic (ppt/commentAuthors.xml + ppt/comments/commentN.xml, legate din slide), pe care îl citesc toate
// programele de prezentări; răspunsurile au p15:threadingInfo cu comentariul-părinte. „Rezolvat” nu are loc în formatul clasic.
// Citire: formatul clasic și formatul nou (ppt/authors.xml + ppt/comments/modernComment_*.xml, cu răspunsuri și status="resolved").
import type JSZipType from 'jszip';
import type { Deck } from './model';
import type { SlideComment } from './comments';

const P = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const T_AUTHORS = `${REL}/commentAuthors`;
const T_COMMENTS = `${REL}/comments`;
const CT_AUTHORS = 'application/vnd.openxmlformats-officedocument.presentationml.commentAuthors+xml';
const CT_COMMENTS = 'application/vnd.openxmlformats-officedocument.presentationml.comments+xml';
const THREAD_URI = '{C676402C-5697-4E1C-873F-D02D1690AC5C}';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// Data fără „Z” (așa o scrie programul de prezentări), cu milisecunde.
const dt = (iso: string) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? new Date().toISOString().slice(0, 23) : d.toISOString().slice(0, 23); };
const initials = (name: string) => name.split(/\s+/).filter(Boolean).map((w) => w[0]).join('').slice(0, 3).toUpperCase() || 'E';

/** Adaugă comentariile în arhiva .pptx scrisă (slide-urile sunt ppt/slides/slideN.xml, în ordinea prezentării). */
export async function addCommentsToZip(zip: JSZipType, deck: Deck): Promise<void> {
  if (!deck.slides.some((s) => s.comments?.length)) return;
  const authors: string[] = [];
  const last = new Map<number, number>();
  const authorId = (name: string) => { const n = name.trim() || 'Eu'; let i = authors.indexOf(n); if (i < 0) { authors.push(n); i = authors.length - 1; } return i; };
  const nextIdx = (a: number) => { const v = (last.get(a) ?? 0) + 1; last.set(a, v); return v; };
  let ct = await zip.file('[Content_Types].xml')!.async('string');
  let file = 0;
  for (let n = 0; n < deck.slides.length; n++) {
    const list = deck.slides[n].comments ?? [];
    const slidePath = `ppt/slides/slide${n + 1}.xml`;
    if (!list.length || !zip.file(slidePath)) continue;
    const cms: string[] = [];
    list.forEach((c, k) => {
      const a = authorId(c.author), idx = nextIdx(a);
      // Comentariile stau unul sub altul în colțul din stânga sus (pos e în unități de 1/8 pt).
      const pos = `<p:pos x="10" y="${10 + k * 80}"/>`;
      cms.push(`<p:cm authorId="${a}" dt="${dt(c.date)}" idx="${idx}">${pos}<p:text>${esc(c.text)}</p:text></p:cm>`);
      for (const r of c.replies ?? []) {
        const ra = authorId(r.author), ri = nextIdx(ra);
        cms.push(`<p:cm authorId="${ra}" dt="${dt(r.date)}" idx="${ri}">${pos}<p:text>${esc(r.text)}</p:text>`
          + `<p:extLst><p:ext uri="${THREAD_URI}"><p15:threadingInfo xmlns:p15="http://schemas.microsoft.com/office/powerpoint/2012/main" timeZoneBias="0">`
          + `<p15:parentCm authorId="${a}" idx="${idx}"/></p15:threadingInfo></p:ext></p:extLst></p:cm>`);
      }
    });
    file++;
    const name = `comment${file}.xml`;
    zip.file(`ppt/comments/${name}`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<p:cmLst xmlns:p="${P}">${cms.join('')}</p:cmLst>`);
    ct = ct.replace('</Types>', `<Override PartName="/ppt/comments/${name}" ContentType="${CT_COMMENTS}"/></Types>`);
    const relsPath = `ppt/slides/_rels/slide${n + 1}.xml.rels`;
    const rels = (await zip.file(relsPath)?.async('string')) ?? `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`;
    zip.file(relsPath, rels.replace('</Relationships>', `<Relationship Id="rIdSuiteCm" Type="${T_COMMENTS}" Target="../comments/${name}"/></Relationships>`));
  }
  const list = authors.map((a, i) => `<p:cmAuthor id="${i}" name="${esc(a)}" initials="${esc(initials(a))}" lastIdx="${last.get(i) ?? 0}" clrIdx="${i % 8}"/>`).join('');
  zip.file('ppt/commentAuthors.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<p:cmAuthorLst xmlns:p="${P}">${list}</p:cmAuthorLst>`);
  ct = ct.replace('</Types>', `<Override PartName="/ppt/commentAuthors.xml" ContentType="${CT_AUTHORS}"/></Types>`);
  zip.file('[Content_Types].xml', ct);
  const presRels = 'ppt/_rels/presentation.xml.rels';
  const pr = await zip.file(presRels)?.async('string');
  if (pr && !pr.includes(T_AUTHORS)) zip.file(presRels, pr.replace('</Relationships>', `<Relationship Id="rIdSuiteCmA" Type="${T_AUTHORS}" Target="commentAuthors.xml"/></Relationships>`));
}

const els = (n: Element | Document | null | undefined, name: string) => (n ? [...(n as Element).getElementsByTagName('*')].filter((e) => e.localName === name) : []);
const kids = (n: Element | null | undefined, name: string) => (n ? [...n.childNodes].filter((c): c is Element => c.nodeType === 1 && (c as Element).localName === name) : []);
const isoOf = (s: string | null) => { const d = s ? new Date(/Z|[+-]\d\d:?\d\d$/.test(s) ? s : s + 'Z') : null; return d && !Number.isNaN(d.getTime()) ? d.toISOString() : new Date().toISOString(); };
const txt = (n: Element | null | undefined) => (n ? kids(n, 'p').map((p) => els(p, 't').map((t) => t.textContent ?? '').join('')).join('\n') : '').trim();

/** Autorii din prezentare: id → nume (formatul clasic: număr; formatul nou: {GUID}). */
export function authorsOf(classic: Document | null, modern: Document | null): Map<string, string> {
  const m = new Map<string, string>();
  for (const a of els(classic, 'cmAuthor')) m.set(a.getAttribute('id') ?? '', a.getAttribute('name') ?? '');
  for (const a of els(modern, 'author')) m.set(a.getAttribute('id') ?? '', a.getAttribute('name') ?? '');
  return m;
}

/** Comentariile unui slide dintr-un fișier de comentarii (clasic sau nou). */
export function readCommentsXml(doc: Document | null, authors: Map<string, string>): SlideComment[] {
  if (!doc) return [];
  const out: SlideComment[] = [];
  const root = doc.documentElement;
  const id = () => Math.random().toString(36).slice(2, 10);
  if (root.localName === 'cmLst' && kids(root, 'cm').some((c) => c.getAttribute('authorId') !== null && kids(c, 'text').length)) {
    // Formatul clasic: răspunsurile arată spre părinte prin threadingInfo/parentCm (autor + idx).
    const byKey = new Map<string, SlideComment>();
    for (const c of kids(root, 'cm')) {
      const text = (kids(c, 'text')[0]?.textContent ?? '').trim();
      if (!text) continue;
      const a = c.getAttribute('authorId') ?? '';
      const author = authors.get(a) ?? '', date = isoOf(c.getAttribute('dt'));
      const parent = els(c, 'parentCm')[0];
      const pc = parent ? byKey.get(`${parent.getAttribute('authorId')}:${parent.getAttribute('idx')}`) : undefined;
      if (pc) { (pc.replies ??= []).push({ author, text, date }); continue; }
      const cm: SlideComment = { id: id(), author, text, date };
      byKey.set(`${a}:${c.getAttribute('idx')}`, cm);
      out.push(cm);
    }
    return out;
  }
  // Formatul nou: <p188:cm authorId="{…}" created="…" status="resolved"> cu txBody și replyLst.
  for (const c of kids(root, 'cm')) {
    const text = txt(kids(c, 'txBody')[0]);
    if (!text) continue;
    const replies = kids(kids(c, 'replyLst')[0], 'reply').map((r) => ({ author: authors.get(r.getAttribute('authorId') ?? '') ?? '', text: txt(kids(r, 'txBody')[0]), date: isoOf(r.getAttribute('created')) })).filter((r) => r.text);
    out.push({
      id: id(), author: authors.get(c.getAttribute('authorId') ?? '') ?? '', text, date: isoOf(c.getAttribute('created')),
      ...(/^(resolved|closed)$/i.test(c.getAttribute('status') ?? '') ? { done: true } : {}),
      ...(replies.length ? { replies } : {}),
    });
  }
  return out;
}

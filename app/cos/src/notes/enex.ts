// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Import din Evernote: fișierul .enex (Evernote → Export notes). Se aduc titlul, textul (cu rânduri și liste),
// listele de bifat (☐/☑), etichetele (devin #etichete), datele, pozele și PDF-urile atașate.
// Un import repetat nu dublează notițele (fiecare notiță își ține minte sursa).
import { api } from '../api';
import { newNote, Note, NoteFile } from './store';
import { BOX, DONE } from './checklist';
import { MAX_IMAGES, shrinkImage } from './images';
import type { KeepImport } from './keep';

const BLOCK = new Set(['DIV', 'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'TR', 'BLOCKQUOTE', 'PRE', 'HR', 'TABLE', 'UL', 'OL']);

/** „20231005T143000Z” → ISO. */
function enDate(s: string | null | undefined): string | undefined {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(s?.trim() ?? '');
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6])).toISOString() : undefined;
}

/** Textul simplu din conținutul ENML (HTML-ul Evernote): blocurile devin rânduri, bifele devin ☐/☑, listele „• ”. */
export function enmlToText(enml: string): string {
  const doc = new DOMParser().parseFromString(enml.replace(/<!DOCTYPE[^>]*>/i, ''), 'text/html');
  let out = '';
  const nl = () => { if (out && !out.endsWith('\n')) out += '\n'; };
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) { out += (node.textContent ?? '').replace(/\s+/g, ' '); return; }
    if (!(node instanceof Element)) return;
    const tag = node.tagName;
    if (tag === 'BR') { out += '\n'; return; }
    // În HTML, <en-todo/> nu e închis singur, deci textul de după el ajunge înăuntrul lui: îl parcurgem și pe acela.
    if (tag === 'EN-TODO') { nl(); out += (node.getAttribute('checked') === 'true' ? DONE : BOX) + ' '; node.childNodes.forEach(walk); return; }
    if (tag === 'EN-MEDIA' || tag === 'SCRIPT' || tag === 'STYLE') return;
    const block = BLOCK.has(tag);
    if (block) nl();
    if (tag === 'LI') out += '• ';
    if (tag === 'TD' || tag === 'TH') out += out.endsWith('\n') || !out ? '' : '\t';
    node.childNodes.forEach(walk);
    if (block) nl();
  };
  walk(doc.body);
  return out.split('\n').map((l) => l.replace(/^ +| +$/g, '').replace(/^(☐|☑) +/, '$1 ')).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64.replace(/\s+/g, ''));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Citește un fișier .enex. `known` = sursele notițelor deja aduse (nu se aduc din nou). */
export async function importEnex(text: string, fileName: string, known: Set<string>): Promise<KeepImport> {
  const xml = new DOMParser().parseFromString(text, 'application/xml');
  if (xml.querySelector('parsererror') || xml.documentElement.tagName !== 'en-export') throw new Error('Fișierul nu pare un export de notițe .enex.');
  const out: KeepImport = { notes: [], trashed: 0, failed: 0 };
  const notes = [...xml.documentElement.getElementsByTagName('note')];
  for (const [i, el] of notes.entries()) {
    const get = (t: string) => el.getElementsByTagName(t)[0]?.textContent ?? '';
    const title = get('title').trim();
    const created = enDate(get('created'));
    // Sursa: fișierul, data creării și titlul (Evernote nu dă un id stabil în .enex).
    const source = `enex:${fileName}:${get('created') || i}:${title}`;
    if (known.has(source)) continue;
    try {
      const tags = [...el.getElementsByTagName('tag')].map((t) => '#' + (t.textContent ?? '').trim().replace(/\s+/g, '_').replace(/[^\p{L}\p{N}_-]/gu, '')).filter((t) => t.length > 1);
      const body = [enmlToText(get('content')), tags.join(' ')].filter(Boolean).join('\n\n');
      const images: string[] = [];
      const files: NoteFile[] = [];
      for (const r of el.getElementsByTagName('resource')) {
        const mime = r.getElementsByTagName('mime')[0]?.textContent?.trim() ?? '';
        const b64 = r.getElementsByTagName('data')[0]?.textContent ?? '';
        if (!b64) continue;
        try {
          if (/^image\//.test(mime) && images.length < MAX_IMAGES) {
            images.push(await shrinkImage(new Blob([base64ToBytes(b64) as BlobPart], { type: mime })));
          } else if (mime === 'application/pdf') {
            const data = base64ToBytes(b64);
            const name = r.getElementsByTagName('file-name')[0]?.textContent?.trim() || `Atașament ${files.length + 1}.pdf`;
            files.push({ id: await api.addAttachment(data), name, size: data.length });
          }
        } catch { /* atașament stricat: îl sărim */ }
      }
      const updated = enDate(get('updated')) ?? created;
      const n: Note = newNote({ title, body, source, ...(created ? { created } : {}), ...(updated ? { updated } : {}) });
      if (images.length) n.images = images;
      if (files.length) n.files = files;
      out.notes.push(n);
    } catch {
      out.failed++;
    }
  }
  return out;
}

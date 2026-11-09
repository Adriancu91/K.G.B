// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Import din Google Keep: arhiva din Google Takeout (takeout-….zip, cu dosarul Keep) sau fișierul .json al unei notițe.
// Se aduc titlul, textul, listele de bifat, etichetele (devin #etichete), culoarea, fixarea, datele și pozele.
// Notițele din coșul Keep se sar; cele arhivate ajung în Arhivă. Un import repetat nu dublează notițele.
import { newNote, Note } from './store';
import { BOX, DONE } from './checklist';
import { MAX_IMAGES, shrinkImage } from './images';

const KEEP_COLORS: Record<string, string> = {
  RED: 'rosu', PINK: 'rosu', ORANGE: 'portocaliu', BROWN: 'portocaliu', YELLOW: 'galben',
  GREEN: 'verde', TEAL: 'verde', BLUE: 'albastru', CERULEAN: 'albastru', PURPLE: 'mov', GRAY: 'gri',
};

interface KeepJson {
  title?: string; textContent?: string; listContent?: { text?: string; isChecked?: boolean }[];
  labels?: { name?: string }[]; color?: string; isPinned?: boolean; isArchived?: boolean; isTrashed?: boolean;
  createdTimestampUsec?: number; userEditedTimestampUsec?: number;
  attachments?: { filePath?: string; mimetype?: string }[];
}

export interface KeepImport { notes: Note[]; trashed: number; failed: number }

const usecToIso = (u: unknown) => (typeof u === 'number' && u > 0 ? new Date(u / 1000).toISOString() : undefined);
const tag = (name: string) => '#' + name.trim().replace(/\s+/g, '_').replace(/[^\p{L}\p{N}_-]/gu, '');

/** Notița noastră dintr-o notiță Keep (fără poze); null dacă nu e o notiță Keep sau e în coș. */
export function fromKeep(j: KeepJson, source: string): Note | null | 'trashed' {
  if (!j || typeof j !== 'object' || !('textContent' in j || 'listContent' in j || 'title' in j)) return null;
  if (j.isTrashed) return 'trashed';
  const parts: string[] = [];
  if (j.textContent?.trim()) parts.push(j.textContent.replace(/\r\n/g, '\n').trimEnd());
  if (Array.isArray(j.listContent) && j.listContent.length) {
    parts.push(j.listContent.map((it) => `${it.isChecked ? DONE : BOX} ${String(it.text ?? '').replace(/\n/g, ' ')}`).join('\n'));
  }
  const tags = [...(j.labels ?? []).map((l) => (l.name ? tag(l.name) : '')).filter((t) => t.length > 1)];
  if (tags.length) parts.push(tags.join(' '));
  const created = usecToIso(j.createdTimestampUsec);
  const updated = usecToIso(j.userEditedTimestampUsec) ?? created;
  const color = KEEP_COLORS[String(j.color ?? '').toUpperCase()];
  return newNote({
    title: String(j.title ?? '').trim(),
    body: parts.join('\n\n'),
    source,
    ...(created ? { created } : {}),
    ...(updated ? { updated } : {}),
    ...(j.isPinned && !j.isArchived ? { pinned: true } : {}),
    ...(j.isArchived ? { archived: true } : {}),
    ...(color ? { color } : {}),
  });
}

/** Citește arhiva Takeout (.zip) sau un .json Keep. `known` = sursele notițelor deja aduse (nu se aduc din nou). */
export async function importKeep(data: Uint8Array, fileName: string, known: Set<string>): Promise<KeepImport> {
  const out: KeepImport = { notes: [], trashed: 0, failed: 0 };
  const isZip = data[0] === 0x50 && data[1] === 0x4b;
  if (!isZip) {
    const n = fromKeep(JSON.parse(new TextDecoder().decode(data)), 'keep:' + fileName);
    if (n === 'trashed') out.trashed++;
    else if (!n) throw new Error('Fișierul nu pare o notiță exportată (.json).');
    else if (!known.has(n.source!)) out.notes.push(n);
    return out;
  }
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(data);
  const all = Object.values(zip.files).filter((f) => !f.dir);
  // În Takeout notițele sunt în „Takeout/Keep/*.json” (numele dosarului poate fi tradus, de exemplu „Păstrează”).
  let jsons = all.filter((f) => /(^|\/)Keep\/[^/]+\.json$/i.test(f.name));
  if (!jsons.length) jsons = all.filter((f) => /\.json$/i.test(f.name));
  // Pozele: după nume, fără extensie (Keep scrie uneori „.jpg” în JSON, dar fișierul e „.jpeg”).
  const byBase = new Map(all.map((f) => [f.name.replace(/^.*\//, '').replace(/\.[^.]+$/, '').toLowerCase(), f]));
  for (const f of jsons) {
    const source = 'keep:' + f.name.replace(/^.*\//, '');
    if (known.has(source)) continue;
    try {
      const j = JSON.parse(await f.async('string')) as KeepJson;
      const n = fromKeep(j, source);
      if (n === 'trashed') { out.trashed++; continue; }
      if (!n) continue;
      const images: string[] = [];
      for (const a of j.attachments ?? []) {
        if (!a.filePath || !/^image\//.test(a.mimetype ?? 'image/') || images.length >= MAX_IMAGES) continue;
        const file = byBase.get(a.filePath.replace(/^.*\//, '').replace(/\.[^.]+$/, '').toLowerCase());
        if (!file) continue;
        try { images.push(await shrinkImage(await file.async('blob'))); } catch { /* poză stricată: o sărim */ }
      }
      if (images.length) n.images = images;
      out.notes.push(n);
    } catch {
      out.failed++;
    }
  }
  if (!out.notes.length && !out.trashed && !jsons.length) throw new Error('Arhiva nu conține notițe exportate (.json).');
  return out;
}

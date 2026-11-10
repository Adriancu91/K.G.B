// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Import din OneNote (și din orice document Word): OneNote exportă o pagină ca .docx (Fișier → Export → Pagină → Document Word).
// Documentul devine HTML cu mammoth (BSD, deja folosit de Docs), apoi text simplu cu rânduri și liste, plus pozele lui.
// Titlul notiței e numele fișierului (OneNote îl pune după titlul paginii).
import { newNote, plain } from './store';
import { enmlToText } from './enex';
import { MAX_IMAGES, shrinkImage } from './images';
import type { KeepImport } from './keep';

export async function importDocx(data: Uint8Array, fileName: string, known: Set<string>): Promise<KeepImport> {
  const source = `docx:${fileName}:${data.length}`;
  if (known.has(source)) return { notes: [], trashed: 0, failed: 0 };
  // @ts-expect-error mammoth nu are tipuri pentru varianta de browser
  const { default: mammoth } = await import('mammoth/mammoth.browser.js');
  const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  const { value: html } = (await mammoth.convertToHtml({ arrayBuffer: buffer })) as { value: string };
  const doc = new DOMParser().parseFromString(html, 'text/html');
  // Pozele (mammoth le pune ca „data:”) se micșorează ca toate pozele din notițe.
  const images: string[] = [];
  for (const img of [...doc.querySelectorAll('img')]) {
    const src = img.getAttribute('src') ?? '';
    img.remove();
    if (!src.startsWith('data:image/') || images.length >= MAX_IMAGES) continue;
    try {
      // Fără fetch(): regulile de securitate ale aplicației nu permit cereri spre „data:”.
      const [head, b64] = src.split(',');
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      images.push(await shrinkImage(new Blob([bytes], { type: head.slice(5).split(';')[0] })));
    } catch { /* poză stricată: o sărim */ }
  }
  const title = fileName.replace(/\.docx$/i, '').trim();
  let body = enmlToText(doc.body.innerHTML);
  if (!body && !images.length) throw new Error('Documentul nu are text sau poze.');
  // OneNote pune titlul paginii și ca prim rând al documentului: nu-l repetăm în text.
  const [first, ...rest] = body.split('\n');
  if (plain(first.trim()) === plain(title)) body = rest.join('\n').trim();
  const n = newNote({ title, body, source });
  if (images.length) n.images = images;
  return { notes: [n], trashed: 0, failed: 0 };
}

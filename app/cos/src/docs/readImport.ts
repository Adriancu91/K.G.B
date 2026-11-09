// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Citirea unui document de pe disc ca HTML pentru editor, după extensie: .odt / .fodt, .doc, .rtf, .txt, altfel .docx.
// Folosită la Import (document nou) și la „Text din fișier…” (conținutul pus la cursor). Cititorii se încarcă doar când e nevoie.
import type { BinaryFile } from '../api';
import type { Editor } from '@tiptap/react';
import { api } from '../api';

export async function readImportedDoc(file: BinaryFile) {
  if (/[.](eml|msg)$/i.test(file.path)) return mailToHtml(file);
  if (/\.f?odt$/i.test(file.path)) return (await import('./odtImport')).odtToHtml(file.data);
  if (/\.doc$/i.test(file.path)) return (await import('./docImport')).docToHtml(file.data);
  if (/\.rtf$/i.test(file.path)) return (await import('./rtfImport')).rtfToHtml(file.data);
  if (/\.txt$/i.test(file.path)) return (await import('./txtImport')).txtToHtml(file.data);
  return (await import('./docxImport')).docxToHtml(file.data);
}

/**
 * Un e-mail (.eml, sau .msg din programul de e-mail) ca document: subiectul ca titlu, tabelul cu antetul (De la, Către, Data…),
 * lista atașamentelor și textul mesajului, cu pozele din el. Citirea mesajului e cea din PDF → ⧉ Combină (pdf/emlPage.ts).
 */
async function mailToHtml(file: BinaryFile) {
  const eml = /[.]msg$/i.test(file.path) ? await (await import('../pdf/msgMail')).msgToEml(file.data) : file.data;
  const { emlToHtml } = await import('../pdf/emlPage');
  const base = file.path.split('/').pop()!.split(String.fromCharCode(92)).pop()!;
  const stem = base.replace(/[.][^.]*$/, '');
  const doc = new DOMParser().parseFromString(emlToHtml(eml, stem), 'text/html');
  const title = (doc.querySelector('title')?.textContent ?? '').trim() || stem;
  doc.querySelectorAll('style, title, hr.mail-sep').forEach((el) => el.remove());
  // Subiectul e deja titlul: rândul lui din antet ar fi de două ori.
  doc.querySelectorAll('table.mail-head tr').forEach((tr) => { if (tr.querySelector('td')?.textContent?.trim() === title) tr.remove(); });
  const h = document.createElement('h2');
  h.textContent = title;
  return { html: h.outerHTML + doc.body.innerHTML, warnings: 0, comments: [] as never[], changes: [] as never[], simplified: false, repaired: false };
}

/**
 * Text din fișier: alegi un document (.docx, .odt, .rtf, .txt, .doc, sau un e-mail .eml / .msg) și tot conținutul lui (cu formatarea, tabelele și pozele)
 * intră la cursor, în documentul deschis. Fișierul ales rămâne neatins. Întoarce numele fișierului, sau null dacă ai renunțat.
 */
export async function insertFromFile(editor: Editor): Promise<string | null> {
  const file = await api.importFile('docx');
  if (!file) return null;
  try {
    const { html } = await readImportedDoc(file);
    editor.chain().focus().insertContent(html).run();
    return file.path.split(/[\\/]/).pop() ?? file.path;
  } catch (e) {
    alert('Fișierul nu a putut fi citit: ' + (e as Error).message);
    return null;
  }
}

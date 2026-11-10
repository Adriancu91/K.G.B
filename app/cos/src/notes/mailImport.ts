// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Un e-mail tras în notiță (.eml, sau .msg din programul de e-mail): subiectul îngroșat, antetul (De la, Către, Data…) și
// textul mesajului, scrise la cursor ca text de notiță (cu listele, legăturile și tabelele păstrate, ca la lipirea din pagini web);
// pozele din mesaj și atașamentele lui intră în notiță ca poze și fișiere atașate. Citirea mesajului e cea din PDF → ⧉ Combină.
import { emlAttachments, emlToHtml } from '../pdf/emlPage';
import { htmlToNoteText } from './htmlpaste';

export const MAIL_FILE = /[.](eml|msg)$/i;

export interface MailNote { text: string; html: string; files: { name: string; type: string; data: Uint8Array }[] }

/** Mesajul ca text de notiță, plus HTML-ul lui (pentru poze) și atașamentele. */
export async function mailToNote(name: string, data: Uint8Array): Promise<MailNote> {
  const eml = /[.]msg$/i.test(name) ? await (await import('../pdf/msgMail')).msgToEml(data) : data;
  const stem = name.replace(/^.*[\\/]/, '').replace(/[.][^.]*$/, '');
  const html = emlToHtml(eml, stem);
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const title = (doc.querySelector('title')?.textContent ?? '').trim() || stem;
  const head = [...doc.querySelectorAll('table.mail-head tr')]
    .map((tr) => [tr.querySelector('th')?.textContent?.trim() ?? '', tr.querySelector('td')?.textContent?.trim() ?? ''])
    .filter(([, v]) => v && v !== title)
    .map(([k, v]) => `${k} ${v}`);
  const att = doc.querySelector('.mail-att')?.textContent?.replace(/\s+/g, ' ').trim();
  doc.querySelectorAll('table.mail-head, .mail-att, hr.mail-sep, style, title').forEach((el) => el.remove());
  const bodyHtml = doc.body.innerHTML;
  const body = (htmlToNoteText(bodyHtml) ?? doc.body.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim();
  const lines = [`**✉ ${title}**`, ...head, ...(att ? [att] : []), '', body];
  return { text: lines.join('\n').trimEnd() + '\n', html: bodyHtml, files: emlAttachments(eml) };
}

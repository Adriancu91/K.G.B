// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// „✉ Trimite prin e-mail”: notița ca mesaj nou în programul de e-mail al utilizatorului (adresă mailto:, fără internet de la noi).
// Subiectul = titlul, corpul = textul fără semnele de formatare; listele, bulinele și bifele rămân. Pozele nu încap într-o adresă
// mailto:, așa că mesajul spune câte sunt (le trimiți cu Export PDF ca atașament). Nu se trimite nimic singur: doar se deschide mesajul.
import { headingLevel, parseInline } from './inline';
import { shownTitle, type Note } from './store';

/** Cât text intră în mesaj: programele de e-mail și Windows taie adresele mailto: prea lungi. */
export const MAIL_MAX = 1500;

/** Textul notiței pentru e-mail: titlurile fără „#”, fără **…**, {mare:…}, ++…++ și celelalte semne. */
export function noteMailText(n: Note): string {
  return n.body.split('\n').map((line) => {
    const h = headingLevel(line);
    const t = h ? line.slice(h + 1) : line;
    return parseInline(t).map((sp) => sp.s).join('');
  }).join('\n').trim();
}

export function noteMailto(n: Note): string {
  let body = noteMailText(n);
  if (body.length > MAIL_MAX) body = body.slice(0, MAIL_MAX).trimEnd() + '…\n\n(Textul e mai lung; restul e în notița din Cyber Office Studio.)';
  const pics = n.images?.length ?? 0;
  if (pics) body += `\n\n(${pics === 1 ? 'O poză' : `${pics} poze`} în notiță: le trimiți ca atașament cu Fișier → Export PDF.)`;
  const enc = (s: string) => encodeURIComponent(s.split('\n').join('\r\n'));
  return `mailto:?subject=${enc(shownTitle(n))}&body=${enc(body)}`;
}

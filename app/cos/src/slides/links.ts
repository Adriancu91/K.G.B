// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Legături pe casete (ca Link / Action din PowerPoint): în prezentare, click pe casetă deschide o adresă web / e-mail
// sau sare la alt slide. Se păstrează ca text în `SlideEl.link`:
//   https://…, http://…, mailto:…   adresă (se deschide în browserul obișnuit)
//   #next, #prev, #first, #last     slide-ul următor / anterior / primul / ultimul
//   #s:<id slide>                    un anumit slide (rămâne corect și după mutarea slide-urilor)
import type { Deck } from './model';

export type Jump = 'next' | 'prev' | 'first' | 'last';
export const JUMPS: [Jump, string][] = [['next', 'Slide-ul următor'], ['prev', 'Slide-ul anterior'], ['first', 'Primul slide'], ['last', 'Ultimul slide']];

const isUrl = (v: string) => /^(https?:\/\/[^\s"<>]+|mailto:[^\s"<>]+)$/i.test(v);

/** Legătura curățată, sau undefined dacă nu e una pe care o știm (fără javascript:, file: etc.). */
export function cleanLink(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const s = v.trim();
  if (!s || s.length > 2000) return undefined;
  if (/^#(next|prev|first|last)$/.test(s) || /^#s:[\w-]{1,64}$/.test(s)) return s;
  return isUrl(s) ? s : undefined;
}

/** Ce scrie omul („exemplu.ro”, „nume@firma.ro”) devine adresă: https:// sau mailto: în față. */
export function normalizeUrl(v: string): string | undefined {
  const s = v.trim();
  if (!s) return undefined;
  if (/^(https?:|mailto:)/i.test(s)) return cleanLink(s);
  if (/^[^\s@/]+@[^\s@/]+\.[a-z]{2,}$/i.test(s)) return cleanLink('mailto:' + s);
  if (/^(www\.)?[^\s/@]+\.[a-z]{2,}(\/\S*)?$/i.test(s)) return cleanLink('https://' + s);
  return undefined;
}

export const isWebLink = (link: string) => !link.startsWith('#');

/** Unde sare legătura (indicele slide-ului) sau null dacă e o adresă / un slide care nu mai există. */
export function jumpIndex(deck: Pick<Deck, 'slides'>, link: string, cur: number): number | null {
  const n = deck.slides.length;
  if (!n || isWebLink(link)) return null;
  if (link === '#next') return Math.min(n, cur + 1);
  if (link === '#prev') return Math.max(0, cur - 1);
  if (link === '#first') return 0;
  if (link === '#last') return n - 1;
  const j = deck.slides.findIndex((s) => s.id === link.slice(3));
  return j < 0 ? null : j;
}

/** Textul scurt arătat în editor: adresa sau „→ Slide 3”. */
export function linkLabel(deck: Pick<Deck, 'slides'>, link: string): string {
  if (isWebLink(link)) return link.replace(/^mailto:/i, '');
  const j = JUMPS.find(([k]) => link === '#' + k);
  if (j) return '→ ' + j[1];
  const i = deck.slides.findIndex((s) => s.id === link.slice(3));
  return i < 0 ? '→ slide șters' : `→ Slide ${i + 1}`;
}

// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Comentariile din Slides (ca Revizuire → Comentariu nou din PowerPoint): pe fiecare slide, cu răspunsuri și „Rezolvat”.
// Nu apar pe slide, în prezentare sau la tipărire; se păstrează în fișierul prezentării.
import type { Deck, Slide } from './model';

export interface CommentReply { author: string; text: string; date: string }
export interface SlideComment {
  id: string;
  author: string;
  text: string;
  /** Data (ISO) la care a fost scris. */
  date: string;
  /** Rezolvat: rămâne în listă, estompat, dar nu mai e numărat ca deschis. */
  done?: boolean;
  replies?: CommentReply[];
}

const MAX_TEXT = 4000;
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
const date = (v: unknown) => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : new Date().toISOString());

/** Comentariile citite dintr-un fișier: fără câmpuri stricate, fără comentarii goale. */
export function cleanComments(v: unknown): SlideComment[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: SlideComment[] = [];
  for (const c of v) {
    if (!c || typeof c !== 'object') continue;
    const o = c as Record<string, unknown>;
    const text = str(o.text, MAX_TEXT).trim();
    if (!text) continue;
    const replies = Array.isArray(o.replies)
      ? o.replies.filter((r) => r && typeof r === 'object' && str((r as Record<string, unknown>).text, MAX_TEXT).trim())
        .map((r) => { const x = r as Record<string, unknown>; return { author: str(x.author, 60), text: str(x.text, MAX_TEXT).trim(), date: date(x.date) }; })
      : [];
    out.push({
      id: typeof o.id === 'string' && o.id ? o.id.slice(0, 40) : Math.random().toString(36).slice(2, 10),
      author: str(o.author, 60), text, date: date(o.date),
      ...(o.done === true ? { done: true } : {}),
      ...(replies.length ? { replies } : {}),
    });
  }
  return out.length ? out : undefined;
}

const withComments = (s: Slide, list: SlideComment[]): Slide => {
  const { comments: _, ...rest } = s;
  return list.length ? { ...rest, comments: list } : rest;
};
const onSlide = (deck: Deck, slideId: string, f: (list: SlideComment[]) => SlideComment[]): Deck => ({
  ...deck, slides: deck.slides.map((s) => (s.id === slideId ? withComments(s, f(s.comments ?? [])) : s)),
});

export function addComment(deck: Deck, slideId: string, author: string, text: string, now = new Date()): Deck {
  const t = text.trim().slice(0, MAX_TEXT);
  if (!t) return deck;
  return onSlide(deck, slideId, (l) => [...l, { id: Math.random().toString(36).slice(2, 10), author: author.trim().slice(0, 60), text: t, date: now.toISOString() }]);
}
export function replyComment(deck: Deck, slideId: string, id: string, author: string, text: string, now = new Date()): Deck {
  const t = text.trim().slice(0, MAX_TEXT);
  if (!t) return deck;
  return onSlide(deck, slideId, (l) => l.map((c) => (c.id === id ? { ...c, replies: [...(c.replies ?? []), { author: author.trim().slice(0, 60), text: t, date: now.toISOString() }] } : c)));
}
export function setCommentDone(deck: Deck, slideId: string, id: string, done: boolean): Deck {
  return onSlide(deck, slideId, (l) => l.map((c) => (c.id !== id ? c : done ? { ...c, done: true } : (({ done: _, ...r }) => r)(c))));
}
export function removeComment(deck: Deck, slideId: string, id: string): Deck {
  return onSlide(deck, slideId, (l) => l.filter((c) => c.id !== id));
}
/** Șterge toate comentariile din prezentare (ca „Șterge toate comentariile din prezentare”). */
export function removeAllComments(deck: Deck): Deck {
  return { ...deck, slides: deck.slides.map((s) => withComments(s, [])) };
}

/** Câte comentarii nerezolvate are slide-ul / prezentarea. */
export const openComments = (s: Pick<Slide, 'comments'>) => (s.comments ?? []).filter((c) => !c.done).length;
export const deckComments = (d: Deck) => d.slides.reduce((n, s) => n + (s.comments?.length ?? 0), 0);

/** Data scurtă, în română: „azi, 14:05”, „ieri, 09:10” sau „12.10.2026”. */
export function commentWhen(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const hm = d.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / 86400000);
  if (diff === 0) return `azi, ${hm}`;
  if (diff === 1) return `ieri, ${hm}`;
  return d.toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

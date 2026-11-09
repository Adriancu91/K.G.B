// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Pliante (Print Handouts din PowerPoint): 2, 3, 4, 6 sau 9 slide-uri pe o pagină A4 în picioare; la 3, cu rânduri pentru notițe alături.
import type { Size, Slide } from './model';

export type Handout = 2 | 3 | 4 | 6 | 9;
export const HANDOUTS: Handout[] = [2, 3, 4, 6, 9];

/** Slide-urile împărțite pe pagini. */
export function handoutPages(slides: Slide[], per: Handout): Slide[][] {
  const pages: Slide[][] = [];
  for (let i = 0; i < slides.length; i += per) pages.push(slides.slice(i, i + per));
  return pages;
}

/** Cât de mic e fiecare slide: o pagină A4 cu margini de 15 mm are ~680 × 1000 px. */
export function handoutScale(per: Handout, size: Size): number {
  const [w, h] = per === 2 ? [680, 470] : per === 3 ? [330, 310] : per === 4 ? [330, 470] : per === 6 ? [330, 310] : [210, 310];
  return Math.min(w / size.w, h / size.h);
}

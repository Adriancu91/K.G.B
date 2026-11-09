// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Fundaluri ilustrate pentru notițe (ca în Google Keep): un model discret, desenat cu semne (emoji) într-un SVG mic care se repetă.
// Nu folosesc poze: modelul se face din text, deci nu ocupă loc în caiet (se păstrează doar cheia).

export const BACKGROUNDS: Record<string, [string, string, string]> = {
  cumparaturi: ['Cumpărături', '🛒', '🥕'],
  mancare: ['Mâncare', '🍴', '🍰'],
  muzica: ['Muzică', '🎵', '🎶'],
  calatorie: ['Călătorie', '✈️', '🧭'],
  petrecere: ['Petrecere', '🎉', '🎈'],
  locuri: ['Locuri', '📍', '🏠'],
  idei: ['Idei', '💡', '✏️'],
  natura: ['Natură', '🌿', '🌸'],
};

const cache = new Map<string, string>();

/** Imaginea de fundal (CSS) pentru cheia dată; „” pentru o cheie necunoscută. */
export function backgroundImage(key: string | undefined): string {
  const bg = key ? BACKGROUNDS[key] : undefined;
  if (!bg) return '';
  let url = cache.get(key!);
  if (!url) {
    const [, a, b] = bg;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><g opacity="0.16" font-size="34" font-family="Segoe UI Emoji, Apple Color Emoji, Noto Color Emoji, sans-serif">`
      + `<text x="14" y="50" transform="rotate(-14 30 40)">${a}</text><text x="96" y="132" transform="rotate(12 110 120)">${b}</text></g></svg>`;
    url = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
    cache.set(key!, url);
  }
  return url;
}

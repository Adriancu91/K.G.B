// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Recunoașterea limbii unui paragraf (Revizuire → 🌐 Detectează limba), scrisă de la zero, fără internet: numără cuvintele
// mărunte foarte dese (conjuncții, prepoziții, articole, verbe ajutătoare) din fiecare limbă și literele care apar doar într-una.
// Cuvintele care sunt în mai multe liste (de exemplu „de”, „a”, „in”) nu se numără, ca să nu încurce limbile între ele.
import type { Editor } from '@tiptap/core';

/** Codurile sunt cele din lista „Limba textului ales” (PROOF_LANGS), plus „ro” pentru română. */
const WORDS: Record<string, string> = {
  ro: 'și si să sa este sunt care pentru nu cu din pe la un o ale lui mai sau dar fost acest această aceasta acesta ca ce către catre despre între intre foarte cum unde când cand după dupa prin am avem vă va ne le își isi fie poate trebuie doar dacă daca însă insa iar cât cat sunteți ați ati vom vor fi ei ele noi voi lor fără fara asupra până pana deci atunci încă inca acum aici unei unui unor celor nici chiar',
  'en-US': 'the and of to is are was were be been this that these those with for from by have has had not but or which who what when where will would can could should there their they it its an as at on we you he she his her our your than then also into about after before because only more such some any all do does did',
  'fr-FR': 'le les des du et est sont une un pour pas dans sur avec qui que ce cette ces nous vous ils elles mais ou où au aux leur leurs été être avoir fait plus comme par sans très tout tous aussi même où',
  'de-DE': 'der die das und ist sind nicht ein eine einen mit für auf dem den des sich auch es wir sie ich du er von zu im bei aus nach wie oder aber wird werden wurde haben hat noch nur schon sehr über',
  'it-IT': 'il lo gli della delle degli del che è sono non per una uno con sul nella nel alla alle agli anche come più ma questo questa questi sono essere stato hanno ha già molto tutto tutti dove quando perché dalle dal dagli sulla negli',
  'es-ES': 'el los las del y es son una por para con que se su sus está están pero como más muy todo todos esta este estos también cuando donde porque sin sobre fue ser hay tiene han',
  'hu-HU': 'és az egy hogy nem van volt meg már csak még ez azt ami aki mint vagy de ha mert minden lesz lett kell itt ott nagyon sem így úgy pedig vagyok vannak',
  'pt-PT': 'não é são uma um com os as do da dos das no na nos nas pelo pela mas também ainda muito estão foi ter tem isso você ele ela eles elas seu sua mais quando onde porque já sobre entre até pelos pelas',
  'nl-NL': 'het een en van dat niet zijn op met voor maar ook als bij nog wel naar wordt worden hebben heeft werd zich deze dit om uit door kan geen meer hij zij wij jullie onze ons waren',
  'pl-PL': 'w z na się nie że jest są od jak ale tak dla przez przy jego jej ich być było był może tylko już bardzo który która które oraz czy także został jako jednak',
};
/** Literele care apar doar într-o limbă din listă: fiecare numără cât două cuvinte. */
const LETTERS: [RegExp, string][] = [
  [/[ăîșțşţ]/g, 'ro'], [/[őű]/g, 'hu-HU'], [/[ßä]/g, 'de-DE'], [/[öü]/g, 'de-DE hu-HU'], [/[ñ¿¡]/g, 'es-ES'], [/[çêœ]/g, 'fr-FR'],
  [/è/g, 'fr-FR it-IT'], [/[ãõ]/g, 'pt-PT'], [/[ąęłńśźżć]/g, 'pl-PL'],
];

const LISTS: Map<string, Set<string>> = (() => {
  const seen = new Map<string, number>();
  const sets = Object.entries(WORDS).map(([k, v]) => [k, new Set(v.split(' '))] as const);
  for (const [, s] of sets) for (const w of s) seen.set(w, (seen.get(w) ?? 0) + 1);
  return new Map(sets.map(([k, s]) => [k, new Set([...s].filter((w) => seen.get(w) === 1))]));
})();

/**
 * Limba textului („ro”, „en-US”, „fr-FR”…) sau null dacă textul e prea scurt ori nu se poate spune sigur.
 * `loose` (pentru DETECTLANGUAGE din Sheets): ghicește și din texte scurte, cu un singur semn, dacă e limpede înaintea celorlalte.
 */
export function detectLang(text: string, loose = false): string | null {
  const words = text.toLowerCase().match(/[\p{L}']+/gu) ?? [];
  if (words.length < (loose ? 1 : 4)) return null;
  const score = new Map<string, number>();
  for (const w of words) for (const [k, s] of LISTS) if (s.has(w)) score.set(k, (score.get(k) ?? 0) + 1);
  const low = text.toLowerCase();
  // „ö / ü” sunt și în germană, și în maghiară; „è” și în franceză, și în italiană: contează pentru amândouă.
  for (const [re, ks] of LETTERS) { const n = low.match(re)?.length ?? 0; if (n) for (const k of ks.split(' ')) score.set(k, (score.get(k) ?? 0) + 2 * n); }
  const best = [...score.entries()].sort((a, b) => b[1] - a[1]);
  if (!best.length) return null;
  const [lang, top] = best[0], second = best[1]?.[1] ?? 0;
  // Cel puțin două semne și clar înaintea limbii a doua; la texte lungi cel puțin un semn la 12 cuvinte.
  if (loose ? top <= second : top < 2 || top < second * 1.5 || top < words.length / 12) return null;
  return lang;
}

/**
 * Pune limba găsită pe paragrafele scrise în altă limbă decât româna (cel puțin 4 cuvinte), ca verificarea ortografică
 * și gramaticală în română să nu le mai sublinieze. Paragrafele care au deja o limbă aleasă de mână rămân cum sunt.
 * Întoarce câte paragrafe s-au schimbat, pe limbi.
 */
export function detectDocLangs(editor: Editor, range?: { from: number; to: number }, history = true): Record<string, number> {
  const { state } = editor;
  const type = state.schema.marks.textStyle;
  const out: Record<string, number> = {};
  if (!type) return out;
  const tr = state.tr;
  state.doc.descendants((node, pos) => {
    if (range && (pos + node.nodeSize < range.from || pos > range.to)) return false;
    if (!node.isTextblock) return true;
    let marked = false;
    node.forEach((c) => { if (c.marks.some((m) => m.attrs.proofLang)) marked = true; });
    if (marked) return false;
    const lang = detectLang(node.textContent);
    if (!lang || lang === 'ro') return false;
    // Fiecare bucată de text își păstrează celelalte setări de literă (font, mărime, culoare); se adaugă doar limba.
    node.forEach((c, off) => {
      if (!c.isText) return;
      const from = pos + 1 + off, to = from + c.nodeSize;
      const old = c.marks.find((m) => m.type === type);
      tr.addMark(from, to, type.create({ ...(old?.attrs ?? {}), proofLang: lang }));
    });
    out[lang] = (out[lang] ?? 0) + 1;
    return false;
  });
  if (!history) tr.setMeta('addToHistory', false);
  if (tr.docChanged) editor.view.dispatch(tr);
  return out;
}

/**
 * La cursorul dintr-un paragraf gol (de obicei cel nou, de după Enter): scoate din literele moștenite limba pe care
 * o putem recunoaște singuri, ca paragraful să primească limba textului scris în el. Restul setărilor de literă rămân.
 */
export function dropAutoLang(editor: Editor): boolean {
  const { state } = editor;
  const { $from, empty } = state.selection;
  if (!empty || $from.parent.textContent) return false;
  const marks = state.storedMarks ?? $from.marks();
  const old = marks.find((m) => m.type.name === 'textStyle' && m.attrs.proofLang && m.attrs.proofLang !== 'ro' && m.attrs.proofLang in WORDS);
  if (!old) return false;
  const attrs = { ...old.attrs, proofLang: null };
  const keep = marks.filter((m) => m !== old);
  if (Object.values(attrs).some((v) => v != null)) keep.push(old.type.create(attrs));
  editor.view.dispatch(state.tr.setStoredMarks(keep).setMeta('addToHistory', false));
  return true;
}

// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Majuscule mici (Word: „Small caps”), MAJUSCULE afișate (Word: „All caps”) și spațierea literelor (Word: „Spacing”),
// ca atribute ale stilului de text, la fel ca mărimea. Se importă și se exportă în .docx și se citesc din .odt.
// Tot aici: efectele de text (Word: Font → Efecte: contur, umbră, relief, gravat), și ele în .docx și .odt,
// și limba de verificare a textului ales (Word: Set Proofing Language, cu „Nu verifica ortografia”), în .docx w:lang / w:noProof.
// Ligaturile (Word: Font → Advanced → Ligatures), pe ecran cu font-variant-ligatures, în .docx w14:ligatures.
import { Extension } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    letterFormat: {
      toggleSmallCaps: () => ReturnType;
      /** MAJUSCULE afișate: textul rămâne scris cum e, doar se vede cu litere mari (Word: „All caps”). */
      toggleAllCaps: () => ReturnType;
      /** Spațierea literelor în puncte (de exemplu „1pt”, „-0.5pt”); null = normală. */
      setLetterSpacing: (spacing: string | null) => ReturnType;
      /** Efectul de text (contur, umbră, relief, gravat); null = fără. */
      setTextEffect: (effect: TextEffect | null) => ReturnType;
      /** Limba de verificare a textului ales („en-US”…, „none” = nu se verifică ortografia); null = a documentului. */
      setProofLang: (lang: string | null) => ReturnType;
      /** Ligaturile (fi, fl, ff… legate într-un singur semn); null = cum vrea fontul. */
      setLigatures: (lig: Ligatures | null) => ReturnType;
    };
  }
}

/** Variantele din lista „Spațiere litere” (ca în Word: Condensat / Extins). */
export const LETTER_SPACINGS: [string, string][] = [
  ['', 'Litere'], ['-0.5pt', 'Condensat (−0,5 pt)'], ['1pt', 'Extins 1 pt'], ['2pt', 'Extins 2 pt'], ['3pt', 'Extins 3 pt'],
];

/** Efectele de text: cele din Word (w:outline, w:shadow, w:emboss, w:imprint), cu un nume și cum arată pe ecran. */
export type TextEffect = 'outline' | 'shadow' | 'outline-shadow' | 'emboss' | 'imprint' | 'glow';
export const TEXT_EFFECTS: [TextEffect, string][] = [
  ['outline', 'Contur (litere goale)'], ['shadow', 'Umbră'], ['outline-shadow', 'Contur cu umbră'], ['emboss', 'Relief'], ['imprint', 'Gravat'], ['glow', 'Strălucire'],
];
const SHADOW = 'text-shadow: 0.06em 0.06em 0.08em rgba(0, 0, 0, 0.45)';
const OUTLINE = '-webkit-text-stroke: 0.04em currentColor; -webkit-text-fill-color: transparent';
/** CSS-ul efectului, cu „--text-effect” după care îl recunoaștem la lipire și la import. */
export function effectCss(e: unknown): string {
  const css: Record<TextEffect, string> = {
    outline: OUTLINE,
    shadow: SHADOW,
    'outline-shadow': OUTLINE + '; ' + SHADOW,
    emboss: 'text-shadow: -0.04em -0.04em 0 rgba(255, 255, 255, 0.9), 0.05em 0.05em 0.02em rgba(0, 0, 0, 0.45)',
    imprint: 'text-shadow: 0.04em 0.04em 0 rgba(255, 255, 255, 0.9), -0.05em -0.05em 0.02em rgba(0, 0, 0, 0.45)',
    // Strălucirea: un halou auriu în jurul literelor (ca w14:glow cu raza de 8 pt, auriu, 60% opac).
    glow: 'text-shadow: 0 0 0.12em rgba(255, 192, 0, 0.95), 0 0 0.3em rgba(255, 192, 0, 0.6)',
  };
  return isTextEffect(e) ? `--text-effect: ${e}; ${css[e]}` : '';
}
/** Ligaturile, cu valorile din .docx (w14:ligatures) și CSS-ul de pe ecran. */
export type Ligatures = 'none' | 'standard' | 'standardContextual' | 'historicalDiscretional' | 'all';
export const LIGATURES: [Ligatures, string, string][] = [
  ['none', 'Fără', 'none'],
  ['standard', 'Doar cele standard', 'common-ligatures no-contextual'],
  ['standardContextual', 'Standard și contextuale', 'common-ligatures contextual'],
  ['historicalDiscretional', 'Istorice și opționale', 'no-common-ligatures discretionary-ligatures historical-ligatures'],
  ['all', 'Toate', 'common-ligatures discretionary-ligatures historical-ligatures contextual'],
];
export const isLigatures = (v: unknown): v is Ligatures => LIGATURES.some(([k]) => k === v);
/** CSS-ul ligaturilor, cu „--ligatures” după care le recunoaștem la lipire și la import. */
export const ligaturesCss = (v: unknown): string => {
  const l = LIGATURES.find(([k]) => k === v);
  return l ? `--ligatures: ${l[0]}; font-variant-ligatures: ${l[2]}` : '';
};
/** Valoarea din .docx (w14:ligatures w14:val, de exemplu „standardContextual” sau „contextualHistorical”) → una din variantele noastre. */
export function ligaturesOf(v: unknown): Ligatures | null {
  const t = String(v ?? '');
  if (!t) return null;
  if (isLigatures(t)) return t;
  const old = /Discretional|Historical|^historical|^discretional/.test(t);
  if (old) return /standard/.test(t) ? 'all' : 'historicalDiscretional';
  return /standard|contextual/.test(t) ? 'standardContextual' : null;
}
/** Limbile din lista „Limba textului ales” (codul din .docx și numele). */
export const PROOF_LANGS: [string, string][] = [
  ['en-US', 'Engleză (SUA)'], ['en-GB', 'Engleză (Marea Britanie)'], ['fr-FR', 'Franceză'], ['de-DE', 'Germană'], ['it-IT', 'Italiană'],
  ['es-ES', 'Spaniolă'], ['hu-HU', 'Maghiară'], ['pt-PT', 'Portugheză'], ['nl-NL', 'Olandeză'], ['pl-PL', 'Poloneză'], ['ro-MD', 'Română (Republica Moldova)'], ['none', 'Nu verifica ortografia'],
];
/** Un cod de limbă ca „en-US” / „fr” sau „none”; altceva → null. */
export const proofLangOf = (v: unknown): string | null => {
  const t = String(v ?? '').trim();
  return t === 'none' || /^[a-z]{2,3}(?:-[A-Za-z]{2,4})?$/.test(t) ? t : null;
};
export const isTextEffect = (e: unknown): e is TextEffect => TEXT_EFFECTS.some(([k]) => k === e);
/** Efectul din comutatoarele Word / ODF (contur, umbră, relief, gravat) și din w14:glow (strălucire). */
export function effectOf(o: { outline?: boolean; shadow?: boolean; emboss?: boolean; imprint?: boolean; glow?: boolean }): TextEffect | null {
  if (o.outline) return o.shadow ? 'outline-shadow' : 'outline';
  if (o.shadow) return 'shadow';
  if (o.emboss) return 'emboss';
  if (o.imprint) return 'imprint';
  if (o.glow) return 'glow';
  return null;
}

export const LetterFormat = Extension.create({
  name: 'letterFormat',
  addGlobalAttributes() {
    return [{
      types: ['textStyle'],
      attributes: {
        fontVariant: {
          default: null,
          parseHTML: (el) => (el.style.fontVariant === 'small-caps' || el.style.fontVariantCaps === 'small-caps' ? 'small-caps' : null),
          renderHTML: (attrs) => (attrs.fontVariant ? { style: `font-variant: ${attrs.fontVariant}` } : {}),
        },
        textTransform: {
          default: null,
          parseHTML: (el) => (el.style.textTransform === 'uppercase' ? 'uppercase' : null),
          renderHTML: (attrs) => (attrs.textTransform ? { style: `text-transform: ${attrs.textTransform}` } : {}),
        },
        letterSpacing: {
          default: null,
          parseHTML: (el) => (el.style.letterSpacing && el.style.letterSpacing !== 'normal' ? el.style.letterSpacing : null),
          renderHTML: (attrs) => (attrs.letterSpacing ? { style: `letter-spacing: ${attrs.letterSpacing}` } : {}),
        },
        proofLang: {
          default: null,
          parseHTML: (el) => proofLangOf(el.getAttribute('data-proof') ?? el.style.getPropertyValue('--proof-lang')),
          renderHTML: (attrs) => {
            const v = proofLangOf(attrs.proofLang);
            return !v ? {} : v === 'none' ? { 'data-proof': 'none', spellcheck: 'false' } : { 'data-proof': v, lang: v };
          },
        },
        ligatures: {
          default: null,
          parseHTML: (el) => { const v = el.style.getPropertyValue('--ligatures').trim(); return isLigatures(v) ? v : null; },
          renderHTML: (attrs) => (isLigatures(attrs.ligatures) ? { style: ligaturesCss(attrs.ligatures) } : {}),
        },
        textEffect: {
          default: null,
          parseHTML: (el) => { const v = el.style.getPropertyValue('--text-effect').trim(); return isTextEffect(v) ? v : null; },
          renderHTML: (attrs) => (isTextEffect(attrs.textEffect) ? { style: effectCss(attrs.textEffect) } : {}),
        },
      },
    }];
  },
  addCommands() {
    return {
      toggleSmallCaps: () => ({ editor, chain }) => {
        const on = editor.getAttributes('textStyle').fontVariant === 'small-caps';
        return chain().setMark('textStyle', { fontVariant: on ? null : 'small-caps' }).removeEmptyTextStyle().run();
      },
      toggleAllCaps: () => ({ editor, chain }) => {
        const on = editor.getAttributes('textStyle').textTransform === 'uppercase';
        return chain().setMark('textStyle', { textTransform: on ? null : 'uppercase' }).removeEmptyTextStyle().run();
      },
      setLetterSpacing: (spacing) => ({ chain }) => chain().setMark('textStyle', { letterSpacing: spacing || null }).removeEmptyTextStyle().run(),
      setTextEffect: (effect) => ({ chain }) => chain().setMark('textStyle', { textEffect: effect || null }).removeEmptyTextStyle().run(),
      setLigatures: (lig) => ({ chain }) => chain().setMark('textStyle', { ligatures: isLigatures(lig) ? lig : null }).removeEmptyTextStyle().run(),
      setProofLang: (lang) => ({ chain }) => chain().setMark('textStyle', { proofLang: proofLangOf(lang) }).removeEmptyTextStyle().run(),
    };
  },
  addKeyboardShortcuts() {
    // Aceleași scurtături ca în Word.
    return {
      'Mod-Shift-k': () => this.editor.commands.toggleSmallCaps(),
      'Mod-Shift-a': () => this.editor.commands.toggleAllCaps(),
    };
  },
});

/** „1.5pt” / „2px” / „0.1em” → puncte (pentru Word); null dacă nu se poate citi. */
export function spacingPt(v: unknown): number | null {
  const m = /^(-?\d+(?:\.\d+)?)(pt|px|em)?$/.exec(String(v ?? '').trim());
  if (!m) return null;
  const n = Number(m[1]);
  return m[2] === 'px' ? n * 0.75 : m[2] === 'em' ? n * 11 : n;
}

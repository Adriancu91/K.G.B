// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Felurile întreruperii de secțiune și numele lor, fără editor (folosite și la export / import .docx).

export type SectionKind = 'nextPage' | 'continuous' | 'evenPage' | 'oddPage';
export const SECTION_KINDS: SectionKind[] = ['nextPage', 'continuous', 'evenPage', 'oddPage'];

/** Numele felului, cum apare pe ecran (pe linia din document și în meniu). */
export const SECTION_LABEL: Record<SectionKind, string> = {
  nextPage: 'Pagina următoare',
  continuous: 'Continuu',
  evenPage: 'Pagină pară',
  oddPage: 'Pagină impară',
};

/** Rândurile din meniul Întreruperi și eticheta liniei din document, scrise întregi (ca să le găsească traducerea). */
export const SECTION_MENU: Record<SectionKind, string> = {
  nextPage: 'Secțiune: Pagina următoare',
  continuous: 'Secțiune: Continuu',
  evenPage: 'Secțiune: Pagină pară',
  oddPage: 'Secțiune: Pagină impară',
};
export const SECTION_LINE: Record<SectionKind, string> = {
  nextPage: 'Întrerupere de secțiune (Pagina următoare)',
  continuous: 'Întrerupere de secțiune (Continuu)',
  evenPage: 'Întrerupere de secțiune (Pagină pară)',
  oddPage: 'Întrerupere de secțiune (Pagină impară)',
};
export const SECTION_TIPS: Record<SectionKind, string> = {
  nextPage: 'Secțiune nouă, care începe pe pagina următoare',
  continuous: 'Secțiune nouă, care începe pe aceeași pagină, imediat sub text',
  evenPage: 'Secțiune nouă, care începe pe următoarea pagină pară',
  oddPage: 'Secțiune nouă, care începe pe următoarea pagină impară',
};

/** Felul citit dintr-un text (din .docx: w:type), cu „Pagina următoare” când lipsește sau e necunoscut. */
export function sectionKind(v: unknown): SectionKind {
  return SECTION_KINDS.includes(v as SectionKind) ? (v as SectionKind) : 'nextPage';
}

/** Secțiunea nouă începe pe o pagină nouă (toate felurile, în afară de „Continuu”). */
export const sectionNewPage = (k: SectionKind) => k !== 'continuous';

/**
 * Orientarea secțiunii care începe după întrerupere: '' = ca a documentului (Aspect → Orientare),
 * altfel doar secțiunea aceasta e în picioare sau culcată (Aspect → Orientare → Doar secțiunea aceasta).
 */
export type SectionOrient = '' | 'portrait' | 'landscape';
export function sectionOrient(v: unknown): SectionOrient {
  return v === 'portrait' || v === 'landscape' ? v : '';
}
/** Numele orientării pe linia din document (aceleași cuvinte ca în meniul Orientare). */
export const ORIENT_LINE: Record<'portrait' | 'landscape', string> = { portrait: 'Verticală', landscape: 'Orizontală (peisaj)' };
export const SECTION_ORIENT_MENU: Record<'portrait' | 'landscape', string> = {
  portrait: 'Doar secțiunea aceasta: Verticală',
  landscape: 'Doar secțiunea aceasta: Orizontală (peisaj)',
};

/** Marginile secțiunii care începe după întrerupere, în mm, la fel pe toate laturile (Aspect → Margini → Doar secțiunea aceasta);
 *  0 = ca ale documentului. Doar valori între 5 și 60 mm. */
export function sectionMargin(v: unknown): number {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 5 && n <= 60 ? n : 0;
}
/** Antetul / subsolul propriu al secțiunii care începe după întrerupere (ca „Legat de anterior” oprit); null = ca al secțiunii
 *  de dinainte. Text pe un rând, cel mult 200 de caractere. */
export function sectionHf(v: unknown): string | null {
  return typeof v === 'string' ? v.replace(/[\r\n]+/g, ' ').slice(0, 200) : null;
}
/** Antetul și subsolul fiecărei secțiuni de după o întrerupere (în ordine), cu cele legate luate de la secțiunea de dinainte;
 *  prima secțiune are antetul documentului. Gol dacă nicio secțiune nu are antet / subsol propriu. */
export function sectionHfList(breaks: { hdr: unknown; ftr: unknown }[], header: string, footer: string): { header: string; footer: string }[] {
  if (!breaks.some((b) => sectionHf(b.hdr) !== null || sectionHf(b.ftr) !== null)) return [];
  let h = header, f = footer;
  return breaks.map((b) => ({ header: (h = sectionHf(b.hdr) ?? h), footer: (f = sectionHf(b.ftr) ?? f) }));
}
/** Semnul invizibil de la începutul fiecărei secțiuni, la tipărire (o legătură de 1 px pe care o caută și o scoate Export PDF,
 *  ca să afle pe ce pagină începe secțiunea): …/<numărul secțiunii>/<p = pagină nouă, c = continuu>. */
export const SECTION_MARK = 'https://sectiune.invalid/';
/** Eticheta de pe linia întreruperii când secțiunea are antetul sau subsolul ei. */
export const HF_LINE = 'Antet / subsol propriu';
/** Hex din UTF-8 și înapoi (textul antetului trece așa prin semnul de secțiune de la importul .docx). */
export const toHex = (s: string) => [...new TextEncoder().encode(s)].map((b) => b.toString(16).padStart(2, '0')).join('');
export const fromHex = (h: string) => new TextDecoder().decode(Uint8Array.from(h.match(/../g) ?? [], (x) => parseInt(x, 16)));

/** Textul de pe linia întreruperii, de exemplu „Margini de 1,5 cm”. */
export const marginLine = (mm: number) => `Margini de ${(mm / 10).toLocaleString('ro-RO')} cm`;
/** Clasa paragrafelor unei secțiuni cu orientarea și / sau marginile ei (pagina cu numele ăsta, la tipărire și PDF). */
export function sectionClass(orient: SectionOrient, margin: number): string {
  if (!margin) return orient ? `doc-sect-${orient}` : '';
  return `doc-sect-${orient || 'same'}-m${margin}`;
}

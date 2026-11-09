// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// ♿ Verifică accesibilitatea notiței: ce îi încurcă pe cei care o citesc cu un cititor de ecran sau cu vederea slabă.
// Fiecare problemă are locul ei în text (poziția), ca un clic să ducă acolo.
import { contrast } from '../docs/accessibility';
import { headingLevel, parseInline } from './inline';

export interface NoteIssue { pos: number; text: string; tip: string }

const NL = String.fromCharCode(10);
const short = (t: string) => (t.length > 40 ? t.slice(0, 40) + '…' : t);
/** Textul legăturilor care nu spune unde duc („aici”, „click”). */
const VAGUE = ['aici', 'click', 'clic', 'apasă aici', 'link', 'linkul', 'legătura', 'acesta', 'asta', 'mai mult', 'detalii', 'here', 'click here', 'more'];

export function checkNote(title: string, body: string): NoteIssue[] {
  const out: NoteIssue[] = [];
  if (!title.trim()) out.push({ pos: 0, text: 'Notița nu are titlu', tip: 'Scrie un titlu: cititoarele de ecran și lista de notițe îl folosesc ca nume.' });
  let pos = 0;
  let prev = 0;
  let inTable = false, tableHasHead = false, tableAt = 0, tableRows = 0;
  const lines = body.split(NL);
  const endTable = () => {
    if (inTable && !tableHasHead && tableRows > 1) out.push({ pos: tableAt, text: 'Tabel fără rând de cap', tip: 'Pune sub primul rând „| --- | --- |”, ca primul rând să fie capul tabelului (numele coloanelor).' });
    inTable = false;
  };
  lines.forEach((line, i) => {
    const t = line.trim();
    // Titlurile: fără text sau care sar un nivel (# apoi ###).
    const lv = headingLevel(line);
    if (lv) {
      if (!line.slice(lv + 1).trim()) out.push({ pos, text: `Titlu ${lv} gol`, tip: 'Scrie textul titlului sau scoate semnele „#”.' });
      else if (lv > prev + 1) out.push({ pos, text: `„${short(line.slice(lv + 1).trim())}” sare de la ${prev ? 'Titlu ' + prev : 'început'} la Titlu ${lv}`, tip: `Folosește Titlu ${prev + 1}, ca ordinea titlurilor să fie clară.` });
      prev = lv;
    }
    // Tabelele „| a | b |”: primul rând e cap doar dacă sub el e „| --- |”.
    if (t.startsWith('|') && t.length > 1) {
      if (!inTable) { inTable = true; tableHasHead = false; tableAt = pos; tableRows = 0; }
      tableRows++;
      if (tableRows === 2 && /^\|[\s:|-]+\|?$/.test(t) && t.includes('-')) tableHasHead = true;
    } else endTable();
    // Legăturile „text (adresă)” cu text neclar.
    for (const m of line.matchAll(/([^\s()][^()]{0,40}?)\s*\((https?:\/\/[^\s)]+|www\.[^\s)]+)\)/g)) {
      const label = m[1].trim().replace(/^[„"]|[”"]$/g, '').toLocaleLowerCase('ro-RO');
      const vague = VAGUE.find((v) => label === v || label.endsWith(' ' + v));
      if (vague) out.push({ pos: pos + (m.index ?? 0), text: `Legătura „${vague}” nu spune unde duce`, tip: 'Scrie în locul ei numele paginii (de exemplu „programul de la primărie”).' });
    }
    // Textul colorat greu de citit pe fundal alb.
    for (const sp of parseInline(line)) {
      if (sp.c && contrast(sp.c, '#ffffff') < 4.5) out.push({ pos, text: `Text colorat greu de citit: „${short(sp.s)}”`, tip: `Contrast ${contrast(sp.c, '#ffffff').toFixed(1)}:1 (trebuie cel puțin 4,5:1): alege o culoare mai închisă.` });
    }
    // Un rând lung scris doar cu MAJUSCULE se citește greu (și unele cititoare de ecran îl citesc literă cu literă).
    const letters = t.replace(/[^\p{L}]/gu, '');
    if (letters.length >= 20 && letters === letters.toLocaleUpperCase('ro-RO') && letters !== letters.toLocaleLowerCase('ro-RO')) {
      out.push({ pos, text: `Rând scris doar cu MAJUSCULE: „${short(t)}”`, tip: 'Scrie-l cu litere obișnuite; pentru accent folosește aldinul (B) sau un titlu.' });
    }
    pos += line.length + (i < lines.length - 1 ? 1 : 0);
  });
  endTable();
  return out;
}

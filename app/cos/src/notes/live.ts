// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Formatarea arătată direct în câmpul de scris: textul notiței rămâne exact cum e (cu semnele lui), dar sub el se desenează
// același text cu aldin, cursiv, tăiat, subliniat, evidențiat, culori și titluri, iar semnele (**, {roșu:…}, „# ”) se văd estompate.
// Nimic nu are voie să schimbe lățimea literelor (altfel cursorul n-ar mai cădea pe literă): mărimile și fonturile pe text se
// desenează peste locul cuvântului, potrivite la lățimea lui (LiveBody.tsx, fitWords), iar ecuațiile desenate în locul textului lor (eqFit); întocmai se văd în Lectură, Docs și .html.
import { headingLevel, parseInline, type Span } from './inline';

const NL = String.fromCharCode(10);

/** O bucată din câmpul de scris: textul ei exact și cum se arată. */
export type LivePart = Span & { hd?: number };

/** Rândurile notiței împărțite în bucăți; lipite la loc, dau exact textul. */
export function liveLines(body: string): LivePart[][] {
  return body.split(NL).map((line) => {
    const lv = headingLevel(line);
    if (!lv) return parseInline(line, {}, true);
    // „# Titlu”: semnul estompat, titlul aldin (fără să crească, ca rândurile să rămână la locul lor).
    const parts: LivePart[] = [{ s: line.slice(0, lv + 1), m: true, hd: lv }];
    for (const p of parseInline(line.slice(lv + 1), { b: true }, true)) parts.push({ ...p, hd: lv });
    return parts;
  });
}

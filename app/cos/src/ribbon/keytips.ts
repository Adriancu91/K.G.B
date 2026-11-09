// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Tastele de acces ale panglicii (Alt, apoi litere): literele filelor ca în programele de birou cunoscute
// (Pornire H, Inserare N, Aspect pagină P, Formule M, Date A, Revizuire R, Vizualizare W…) și alegerea literelor
// pentru butoane: întâi cea pusă de modul (`data-keytip`), apoi o literă din numele butonului, apoi două litere.
// Un cod nu poate fi începutul altuia (după „F” nu mai așteptăm „FP”), ca tasta să lucreze imediat.

/** Literele filelor, după id-ul filei (aceleași în toate aplicațiile). */
export const TAB_TIPS: Record<string, string> = {
  home: 'H', insert: 'N', draw: 'JI', design: 'G', layout: 'P', refs: 'S', mail: 'M', formulas: 'M', data: 'A',
  review: 'R', view: 'W', help: 'Y', transitions: 'K', animations: 'A', show: 'S', record: 'C',
  tabledesign: 'JT', table: 'JT', tablelayout: 'JL', hf: 'JH', chart: 'JC', image: 'JP', photo: 'JP',
  // Filele obiectelor din Slides (Format formă, Proiectare tabel + Aspect, Proiectare diagramă + Format, Format imagine, Format video + Redare).
  'obj-text': 'JD', 'obj-shape': 'JD', 'obj-table': 'JT', 'obj-table2': 'JL', 'obj-chart': 'JC', 'obj-chart2': 'JO', 'obj-image': 'JP', 'obj-media': 'JV', 'obj-media2': 'JN',
};

/** Literele mari fără diacritice dintr-un nume („Îmbinare și centrare” → „IMBINARESICENTRARE”). */
export function tipLetters(label: string): string {
  return label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

const clash = (code: string, taken: string[]) => taken.some((t) => t.startsWith(code) || code.startsWith(t));

/** Câte un cod pentru fiecare element, în ordine; `fixed` e codul dorit (folosit dacă nu se calcă cu altul). */
export function assignTips(items: { label: string; fixed?: string }[], reserved: string[] = []): string[] {
  const taken = [...reserved];
  const out: string[] = items.map(() => '');
  items.forEach((it, i) => {
    const f = it.fixed?.toUpperCase();
    if (f && !clash(f, taken)) { out[i] = f; taken.push(f); }
  });
  // Întâi o singură literă din nume (prima posibilă), pentru toate; Y și Z rămân începutul codurilor din două litere,
  // ca să ajungă pentru oricâte butoane.
  items.forEach((it, i) => {
    if (out[i]) return;
    for (const ch of tipLetters(it.label)) if (ch !== 'Y' && ch !== 'Z' && !clash(ch, taken)) { out[i] = ch; taken.push(ch); return; }
  });
  // …apoi două litere: prima literă a numelui și una din restul lui, sau orice pereche liberă.
  const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  items.forEach((it, i) => {
    if (out[i]) return;
    const L = tipLetters(it.label) || 'Y';
    const firsts = [...new Set([...L, ...ABC])];
    for (const a of firsts) {
      for (const b of [...L.slice(1), ...ABC]) {
        const c = a + b;
        if (!clash(c, taken)) { out[i] = c; taken.push(c); return; }
      }
    }
  });
  return out;
}

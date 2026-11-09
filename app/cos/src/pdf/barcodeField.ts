// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Câmpul cod de bare al formularului (Pregătire formular → ▭ Câmp de completat → ▣ Cod de bare): un cod QR care ține
// datele completate în formular, ca cine primește formularul tipărit să le poată citi cu un cititor de coduri, fără să le
// mai scrie de mână. Datele sunt pe două rânduri, despărțite prin Tab: numele câmpurilor, apoi valorile lor.
// În PDF e un buton doar de citit, cu aspectul desenat din pătrate (vectorial, se tipărește clar la orice mărime), iar în
// dicționarul lui ținem /SuiteBarcode cu lista câmpurilor (goală = toate). La fiecare salvare din Suite codul se refă
// cu valorile de acum (refreshBarcodes). Testat în tests/pdf-barcode-field.test.mjs.
import { PDFArray, PDFButton, PDFCheckBox, PDFDict, PDFDocument, PDFDropdown, PDFHexString, PDFName, PDFOptionList, PDFPage, PDFRadioGroup, PDFString, PDFTextField } from 'pdf-lib';
import { makeQr, QrCode } from '../qr';

export const BARCODE_KEY = 'SuiteBarcode';

/** Numele câmpurilor puse în cod (din „Nume, Data, Total”); listă goală = toate câmpurile formularului. */
export function barcodeFields(opts: string | undefined): string[] {
  return (opts ?? '').split(',').map((s) => s.trim()).filter(Boolean);
}

/** Textul din cod: rândul cu numele câmpurilor și rândul cu valorile, despărțite prin Tab (Tab-urile / rândurile din valori devin spații). */
export function barcodeText(values: { name: string; value: string }[]): string {
  const clean = (s: string) => s.replace(/[\t\r\n]+/g, ' ');
  return values.map((v) => clean(v.name)).join('\t') + '\n' + values.map((v) => clean(v.value)).join('\t');
}

/** Pătratele codului ca desen PDF (fundal alb, marginea albă de 4 module), centrat în dreptunghiul w × h. */
export function barcodeOps(q: QrCode, w: number, h: number): string {
  const n = q.size + 8, s = Math.min(w, h) / n;
  const ox = (w - n * s) / 2, oy = (h - n * s) / 2;
  const f = (v: number) => +v.toFixed(3);
  let ops = `q 1 g ${f(ox)} ${f(oy)} ${f(n * s)} ${f(n * s)} re f 0 g\n`;
  for (let r = 0; r < q.size; r++) {
    // Pătratele negre alăturate de pe un rând se unesc într-un singur dreptunghi (desen mai mic).
    for (let c = 0; c < q.size; c++) {
      if (!q.dark[r][c]) continue;
      let e = c;
      while (e + 1 < q.size && q.dark[r][e + 1]) e++;
      ops += `${f(ox + (c + 4) * s)} ${f(oy + (n - 5 - r) * s)} ${f((e - c + 1) * s)} ${f(s)} re\n`;
      c = e;
    }
  }
  return ops + 'f Q';
}

const asText = (f: unknown): string | null => {
  try {
    if (f instanceof PDFTextField) return f.getText() ?? '';
    if (f instanceof PDFCheckBox) return f.isChecked() ? 'Da' : 'Nu';
    if (f instanceof PDFRadioGroup) return f.getSelected() ?? '';
    if (f instanceof PDFDropdown || f instanceof PDFOptionList) return f.getSelected().join('; ');
  } catch { /* câmp stricat */ }
  return null;
};

/** Desenează din nou codul pe toate locurile câmpului, cu textul dat. false dacă textul nu încape într-un cod QR. */
function paint(doc: PDFDocument, field: PDFButton, text: string): boolean {
  // Nivelul L (cel mai mult text); dacă nu încape, codul vechi rămâne.
  const q = makeQr(text, text.length < 120 ? 'M' : 'L');
  if (!q) return false;
  const ctx = doc.context;
  for (const wd of field.acroField.getWidgets()) {
    const r = wd.getRectangle();
    const w = Math.max(1, r.width), h = Math.max(1, r.height);
    const ap = ctx.register(ctx.stream(barcodeOps(q, w, h), { Type: 'XObject', Subtype: 'Form', BBox: [0, 0, w, h] }));
    wd.dict.set(PDFName.of('AP'), ctx.obj({ N: ap }));
  }
  return true;
}

/** Câmpurile cod de bare din document (cu dicționarul nostru). */
function barcodeButtons(doc: PDFDocument): PDFButton[] {
  try {
    return doc.getForm().getFields().filter((f): f is PDFButton => f instanceof PDFButton && f.acroField.dict.get(PDFName.of(BARCODE_KEY)) instanceof PDFDict);
  } catch { return []; }
}

/** Valorile puse în codul unui câmp: câmpurile alese (în ordinea scrisă) sau toate, fără butoane și fără alte coduri. */
function valuesFor(doc: PDFDocument, field: PDFButton): { name: string; value: string }[] {
  const d = field.acroField.dict.get(PDFName.of(BARCODE_KEY)) as PDFDict;
  const list = d.lookup(PDFName.of('Fields'));
  const wanted = list instanceof PDFArray ? list.asArray().map((x) => (x instanceof PDFString || x instanceof PDFHexString ? x.decodeText() : '')).filter(Boolean) : [];
  const fields = doc.getForm().getFields();
  const out: { name: string; value: string }[] = [];
  if (wanted.length) {
    for (const name of wanted) {
      const f = fields.find((x) => x.getName() === name);
      out.push({ name, value: f ? asText(f) ?? '' : '' });
    }
    return out;
  }
  for (const f of fields) {
    const v = asText(f);
    if (v !== null) out.push({ name: f.getName(), value: v });
  }
  return out;
}

/** Pune un câmp cod de bare nou pe pagină, în dreptunghiul dat (în puncte PDF), și îl desenează cu valorile de acum. */
export function addBarcodeField(doc: PDFDocument, page: PDFPage, place: { x: number; y: number; width: number; height: number }, name: string, fields: string[]): PDFButton {
  const ctx = doc.context;
  const btn = doc.getForm().createButton(name);
  btn.addToPage('', page, { ...place, borderWidth: 0 });
  btn.enableReadOnly();
  btn.acroField.dict.set(PDFName.of(BARCODE_KEY), ctx.obj({ Fields: fields.map((f) => PDFHexString.fromText(f)), Kind: PDFName.of('QRCode'), Data: PDFName.of('Tab') }));
  btn.acroField.dict.set(PDFName.of('TU'), PDFHexString.fromText(`Cod de bare cu datele formularului${fields.length ? ': ' + fields.join(', ') : ''}`));
  for (const wd of btn.acroField.getWidgets()) wd.dict.set(PDFName.of('MK'), ctx.obj({}));
  paint(doc, btn, barcodeText(valuesFor(doc, btn)));
  return btn;
}

/**
 * Reface toate codurile de bare ale formularului cu valorile de acum. Întoarce documentul nou (sau null dacă nu are
 * coduri) și numele codurilor în care datele n-au încăput.
 */
export async function refreshBarcodes(bytes: Uint8Array): Promise<{ bytes: Uint8Array; tooLong: string[] } | null> {
  let doc: PDFDocument;
  try { doc = await PDFDocument.load(bytes, { ignoreEncryption: true }); } catch { return null; }
  const list = barcodeButtons(doc);
  if (!list.length) return null;
  const tooLong: string[] = [];
  for (const b of list) if (!paint(doc, b, barcodeText(valuesFor(doc, b)))) tooLong.push(b.getName());
  return { bytes: await doc.save({ updateFieldAppearances: false }), tooLong };
}


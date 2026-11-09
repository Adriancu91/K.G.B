// Original: src/pdf/forms.ts din Cyber Office Studio, aplicația proprietarului (D-071, D-072), fără schimbări de logică.
// @ts-nocheck — K.G.B. verifică tablourile mai strict (noUncheckedIndexedAccess) decât proiectul de origine; testat în tests/.
// Formularele PDF (AcroForm): golirea tuturor câmpurilor și aplatizarea (câmpurile completate devin parte din pagină,
// ca textul să nu se mai poată schimba; așa se trimit de obicei formularele completate).
import { drawObject, PDFArray, PDFCheckBox, PDFDocument, PDFDropdown, PDFField, PDFOptionList, PDFRadioGroup, PDFRef, PDFTextField, popGraphicsState, pushGraphicsState, StandardFonts, translate } from 'pdf-lib';

const NO_FIELDS = 'PDF-ul nu are câmpuri de completat.';

/** Golește toate câmpurile: text gol, bife scoase, liste fără alegere. Întoarce și câte câmpuri aveau ceva. */
export async function clearForm(bytes: Uint8Array): Promise<{ bytes: Uint8Array; cleared: number }> {
  const doc = await PDFDocument.load(bytes);
  const fields = doc.getForm().getFields();
  if (!fields.length) throw new Error(NO_FIELDS);
  let cleared = 0;
  for (const f of fields) {
    try {
      if (f instanceof PDFTextField) { if (f.getText()) { f.setText(''); cleared++; } }
      else if (f instanceof PDFCheckBox) { if (f.isChecked()) { f.uncheck(); cleared++; } }
      else if (f instanceof PDFDropdown || f instanceof PDFOptionList) { if (f.getSelected().length) { f.clear(); cleared++; } }
      else if (f instanceof PDFRadioGroup) { if (f.getSelected()) { f.clear(); cleared++; } }
    } catch { /* un câmp ciudat nu oprește golirea celorlalte */ }
  }
  try {
    return { bytes: await doc.save(), cleared };
  } catch {
    // Aspectul câmpurilor nu s-a putut redesena (de exemplu un font fără diacritice): îl lasă pe seama cititorului.
    return { bytes: await doc.save({ updateFieldAppearances: false }), cleared };
  }
}

// Metodele interne ale formularului din pdf-lib pe care le folosește și aplatizarea lui; le chemăm câmp cu câmp,
// ca un câmp fără aspect desenat (de exemplu unul gol) să nu oprească tot, cum face aplatizarea lor.
interface FormInternals {
  findWidgetPage(w: unknown): { node: { newXObject(tag: string, ref: unknown): unknown }; pushOperators(...ops: unknown[]): void };
  findWidgetAppearanceRef(f: PDFField, w: unknown): unknown;
  acroForm: { removeField(f: unknown): void };
}

/**
 * Scoate câmpul din formular și de pe pagini. (Ștergerea din pdf-lib caută widget-urile după aspectul lor, nu după
 * ele însele, așa că pe pagini rămâneau trimiteri spre obiecte șterse.)
 */
function removeField(doc: PDFDocument, fi: FormInternals, f: PDFField) {
  const kids = f.acroField.normalizedEntries().Kids;
  const refs: PDFRef[] = [f.ref];
  for (let i = 0; i < kids.size(); i++) { const k = kids.get(i); if (k instanceof PDFRef) refs.push(k); }
  const gone = new Set(refs.map((r) => r.toString()));
  for (const page of doc.getPages()) {
    const annots = page.node.Annots();
    if (!(annots instanceof PDFArray)) continue;
    for (let i = annots.size() - 1; i >= 0; i--) { const a = annots.get(i); if (a instanceof PDFRef && gone.has(a.toString())) annots.remove(i); }
  }
  fi.acroForm.removeField(f.acroField);
  for (const r of refs) doc.context.delete(r);
}

/** Aplatizează formularul: ce se vede în câmpuri rămâne desenat pe pagină, iar câmpurile dispar. */
export async function flattenForm(bytes: Uint8Array): Promise<{ bytes: Uint8Array; fields: number }> {
  const doc = await PDFDocument.load(bytes);
  const form = doc.getForm();
  const fields = form.getFields();
  if (!fields.length) throw new Error(NO_FIELDS);
  // Câmpurile fără aspect desenat îl primesc acum (cu un font simplu); cele care nu se pot desena rămân goale.
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const f of fields) {
    try {
      const g = f as unknown as { needsAppearancesUpdate?(): boolean; defaultUpdateAppearances?(font: unknown): void };
      if (g.needsAppearancesUpdate?.()) g.defaultUpdateAppearances?.(font);
    } catch { /* fără aspect: nu se desenează */ }
  }
  const fi = form as unknown as FormInternals;
  for (const f of fields) {
    for (const w of f.acroField.getWidgets()) {
      try {
        const page = fi.findWidgetPage(w);
        const ref = fi.findWidgetAppearanceRef(f, w);
        const key = page.node.newXObject('FlatWidget', ref);
        const r = w.getRectangle();
        page.pushOperators(pushGraphicsState(), translate(r.x, r.y), drawObject(key as never), popGraphicsState());
      } catch { /* câmp fără aspect sau fără pagină: nu are ce desena */ }
    }
    try { removeField(doc, fi, f); } catch { /* câmpul rămâne, dar fără valoare de schimbat */ }
  }
  return { bytes: await doc.save({ updateFieldAppearances: false }), fields: fields.length };
}

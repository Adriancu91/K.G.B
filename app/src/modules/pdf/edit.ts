// Din Cyber Office Studio (src/pdf/edit.ts, D-071): doar ce folosesc uneltele copiate (deschiderea cu pdf-lib);
// restul fișierului (rotire, ștergere…) K.G.B. le face în Rust.
import { PDFDocument } from 'pdf-lib';

/** Mesajul pentru PDF-urile criptate: pdf-lib nu le poate rescrie fără să le strice conținutul. */
export const ENCRYPTED_MSG = 'PDF-ul e protejat (criptat): îl poți citi, căuta, tipări și completa formularele. '
  + 'Ca să-i modifici paginile (rotire, ștergere, semnătură…), apasă „Elimină parola”.';

export async function open(bytes: Uint8Array): Promise<PDFDocument> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  // Și PDF-urile doar „cu restricții” (fără parolă de deschidere) sunt criptate: rescrise de pdf-lib, nu se mai deschid.
  if (doc.isEncrypted) throw new Error(ENCRYPTED_MSG);
  return doc;
}

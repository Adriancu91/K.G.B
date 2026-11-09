// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Salvarea cu parolă a fișierelor .docx / .xlsx / .pptx: cere parola de două ori, apoi criptează arhiva (vezi officeCrypto.ts).
import { askPassword } from './ask';

/** Parola nouă, scrisă de două ori la fel (null = Renunță). */
export async function askNewPassword(kind: string): Promise<string | null> {
  let note = '';
  for (;;) {
    const a = await askPassword('Salvează cu parolă', `${note}Fișierul .${kind} se va deschide doar cu această parolă, în Cyber Office Studio și în celelalte programe de birou. Literele mari și mici contează. Dacă uiți parola, fișierul nu mai poate fi deschis de nimeni.`, 'Mai departe');
    if (a === null) return null;
    if (!a) { note = 'Scrie o parolă. '; continue; }
    const b = await askPassword('Scrie parola încă o dată', 'Ca să fim siguri că n-ai greșit o literă.', 'Salvează');
    if (b === null) return null;
    if (a === b) return a;
    note = 'Parolele nu erau la fel. Încearcă din nou. ';
  }
}

/** Arhiva criptată cu parola cerută acum, sau null dacă s-a renunțat. */
export async function lockOffice(data: Uint8Array, kind: string): Promise<Uint8Array | null> {
  const pw = await askNewPassword(kind);
  if (pw === null) return null;
  const { encryptOffice } = await import('./officeCrypto');
  return encryptOffice(data, pw);
}

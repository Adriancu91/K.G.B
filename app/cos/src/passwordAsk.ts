// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Cine cere parola fișierelor protejate (fereastra din aplicație, pusă de AskHost); `wrong` = parola de dinainte n-a fost bună.
// Stă separat, ca fereastra de întrebare să nu încarce la pornire și codul pentru arhive.
// Fără el (de exemplu în testul de compatibilitate), fișierele cu parolă se refuză cu un mesaj clar.
export type PasswordAsker = (kind: string, wrong: boolean) => Promise<string | null>;
let asker: PasswordAsker | null = null;
export const setPasswordAsker = (f: PasswordAsker | null) => { asker = f; };
export const passwordAsker = () => asker;

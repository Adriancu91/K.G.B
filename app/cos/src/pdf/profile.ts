// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Profilul de date pentru formulare (Top 10 PDF): numele, CNP-ul, adresa… scrise o singură dată și puse singure în
// câmpurile cu nume potrivit („Nume”, „CNP”, „Adresa domiciliu”). Profilul stă doar pe acest calculator.

export interface Profile {
  nume: string;
  prenume: string;
  cnp: string;
  adresa: string;
  localitate: string;
  judet: string;
  telefon: string;
  email: string;
  firma: string;
  cui: string;
  iban: string;
}

export const PROFILE_FIELDS: [keyof Profile, string][] = [
  ['nume', 'Nume'], ['prenume', 'Prenume'], ['cnp', 'CNP'], ['adresa', 'Adresa (stradă, număr)'], ['localitate', 'Localitatea'],
  ['judet', 'Județul'], ['telefon', 'Telefon'], ['email', 'E-mail'], ['firma', 'Firma'], ['cui', 'CUI / CIF firmă'], ['iban', 'IBAN'],
];

const KEY = 'suite.pdf.profil';

export function emptyProfile(): Profile {
  return Object.fromEntries(PROFILE_FIELDS.map(([k]) => [k, ''])) as unknown as Profile;
}

export function loadProfile(): Profile | null {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    return p ? { ...emptyProfile(), ...p } : null;
  } catch {
    return null;
  }
}

export function saveProfile(p: Profile) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* fără loc: rămâne până închizi */ }
}

/** „Numele și Prenumele:” → „numelesiprenumele” (fără diacritice, spații și semne). */
export function norm(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

type Kind = keyof Profile | 'numecomplet' | 'data';

/**
 * Ce date se potrivesc unui câmp după numele lui (sau textul de ajutor). Ordinea contează: întâi cele mai precise
 * („nume și prenume” înaintea lui „nume”, „cod fiscal” înaintea lui „cod”).
 */
export function fieldKind(name: string): Kind | null {
  const n = norm(name);
  if (!n) return null;
  const rules: [RegExp, Kind][] = [
    [/cnp|codnumericpersonal/, 'cnp'],
    [/iban/, 'iban'],
    [/cui|cif|codfiscal|codunicdeinregistrare/, 'cui'],
    [/email|mail/, 'email'],
    [/telefon|^tel|phone|mobil/, 'telefon'],
    [/numesiprenume|numeleprenumele|numelesiprenumele|numeprenume|fullname|numecomplet|subsemnatul/, 'numecomplet'],
    [/prenume|firstname|givenname/, 'prenume'],
    [/firma|societate|companie|denumire|company/, 'firma'],
    [/^nume|numele|lastname|surname|familie/, 'nume'],
    [/judet|county|sector/, 'judet'],
    [/localitate|oras|municipiu|comuna|city/, 'localitate'],
    [/adresa|domiciliu|strada|address|sediu/, 'adresa'],
    [/^data$|^datazilei|^date$/, 'data'],
  ];
  return rules.find(([re]) => re.test(n))?.[1] ?? null;
}

/** Valoarea pentru un câmp, sau null dacă profilul nu are ce pune în el. */
export function valueFor(kind: Kind, p: Profile, today: string): string | null {
  const v = kind === 'numecomplet' ? `${p.nume} ${p.prenume}`.trim() : kind === 'data' ? today : p[kind];
  return v?.trim() ? v.trim() : null;
}

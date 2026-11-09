// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Verificarea codurilor românești folosite des în tabele: CNP, CUI (cod fiscal) și IBAN.
// Se verifică cifra de control (o greșeală de tastare la o cifră e prinsă aproape mereu), nu și dacă persoana
// sau firma există.

const digits = (s: string) => s.replace(/\s+/g, '');

/** CNP: 13 cifre, prima 1–9, luna și ziua posibile, județul cunoscut și cifra de control corectă. */
export function validCnp(raw: string): boolean {
  const s = digits(raw);
  if (!/^[1-9]\d{12}$/.test(s)) return false;
  const month = Number(s.slice(3, 5));
  const day = Number(s.slice(5, 7));
  const county = Number(s.slice(7, 9));
  if (month < 1 || month > 12 || day < 1) return false;
  const century = { 1: 1900, 2: 1900, 3: 1800, 4: 1800, 5: 2000, 6: 2000 }[Number(s[0])];
  // Pentru străini (7, 8, 9) secolul nu reiese din cod, deci se verifică doar ziua ≤ 31.
  const daysIn = century ? new Date(century + Number(s.slice(1, 3)), month, 0).getDate() : 31;
  if (day > daysIn) return false;
  if (!((county >= 1 && county <= 48) || county === 51 || county === 52 || county === 70)) return false;
  const key = '279146358279';
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(s[i]) * Number(key[i]);
  const ctrl = sum % 11 === 10 ? 1 : sum % 11;
  return ctrl === Number(s[12]);
}

/** CUI / CIF: 2–10 cifre (cu sau fără „RO” în față), ultima fiind cifra de control. */
export function validCui(raw: string): boolean {
  const s = digits(raw).toUpperCase().replace(/^RO/, '');
  if (!/^\d{2,10}$/.test(s)) return false;
  const body = s.slice(0, -1).padStart(9, '0');
  const key = '753217532';
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(body[i]) * Number(key[i]);
  const ctrl = (sum * 10) % 11 === 10 ? 0 : (sum * 10) % 11;
  return ctrl === Number(s[s.length - 1]);
}

/** IBAN: lungimea potrivită (24 de caractere pentru RO) și verificarea „mod 97” din standard. */
export function validIban(raw: string): boolean {
  const s = digits(raw).toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(s)) return false;
  if (s.startsWith('RO') && s.length !== 24) return false;
  const moved = s.slice(4) + s.slice(0, 4);
  let rest = 0;
  for (const ch of moved) {
    const v = ch >= 'A' ? String(ch.charCodeAt(0) - 55) : ch;
    for (const d of v) rest = (rest * 10 + Number(d)) % 97;
  }
  return rest === 1;
}

// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Notițe blocate cu parolă: textul, pozele și atașamentele notiței se criptează cu AES-256-GCM, cu o cheie făcută din parolă
// (PBKDF2-SHA-256, 310.000 de pași, sare aleatorie). Totul cu WebCrypto din Chromium, local; parola nu se păstrează nicăieri.
// Titlul rămâne vizibil, ca notița să poată fi găsită în listă.
import type { NoteFile } from './store';
import type { CanvasBox } from './freeCanvas';

export interface Secret { v: 1; salt: string; iv: string; data: string }
/** Ce se ascunde dintr-o notiță blocată. */
export interface SecretPayload { body: string; images?: string[]; imageText?: (string | null)[]; imageInk?: (string | null)[]; imageDiagram?: (string | null)[]; files?: NoteFile[]; boxes?: CanvasBox[] }
export interface OpenSecret { key: CryptoKey; salt: string; plain: SecretPayload }

const ITERATIONS = 310000;

const toB64 = (b: Uint8Array) => {
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
};
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export function isSecret(x: unknown): x is Secret {
  const s = x as Secret;
  return !!s && s.v === 1 && typeof s.salt === 'string' && typeof s.iv === 'string' && typeof s.data === 'string';
}

export async function deriveKey(password: string, salt: string): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password.normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: fromB64(salt), iterations: ITERATIONS },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export const newSalt = () => toB64(crypto.getRandomValues(new Uint8Array(16)));

/** Criptează conținutul cu cheia dată; fiecare salvare are un IV nou. */
export async function seal(key: CryptoKey, salt: string, plain: SecretPayload): Promise<Secret> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(plain))));
  return { v: 1, salt, iv: toB64(iv), data: toB64(data) };
}

/** Deschide notița; aruncă eroare la parolă greșită (AES-GCM verifică singur integritatea). */
export async function unseal(password: string, s: Secret): Promise<OpenSecret> {
  const key = await deriveKey(password, s.salt);
  let bytes: ArrayBuffer;
  try {
    bytes = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(s.iv) }, key, fromB64(s.data));
  } catch {
    throw new Error('Parola nu e bună.');
  }
  const p = JSON.parse(new TextDecoder().decode(bytes)) as SecretPayload;
  return { key, salt: s.salt, plain: { body: String(p.body ?? ''), ...(p.images ? { images: p.images } : {}), ...(p.imageText ? { imageText: p.imageText } : {}), ...(Array.isArray(p.imageInk) ? { imageInk: p.imageInk } : {}), ...(Array.isArray(p.imageDiagram) ? { imageDiagram: p.imageDiagram } : {}), ...(p.files ? { files: p.files } : {}) } };
}

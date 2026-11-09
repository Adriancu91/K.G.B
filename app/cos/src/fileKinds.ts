// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Ce aplicație deschide un fișier, după extensie: folosit la fișierele trase în fereastră (App.tsx) și la fișierele aflate
// în interiorul altora (de exemplu atașamentele unui PDF sau un portofoliu PDF), care se deschid fiecare în aplicația lui.
import type { ModuleId } from './modules';

/** Fișierele trase în fereastră (pe Acasă, pe bara de taburi sau într-o aplicație care nu le folosește): aplicația lor și dacă
 *  sunt fișiere Suite (text) sau se aduc din octeți (.docx, .xlsx, .pptx, PDF, poze…). Aceleași ca la „Deschide un fișier…”. */
export const DROP_KINDS: [ModuleId, string[], boolean][] = [
  ['doc', ['sdoc'], true], ['sheets', ['ssheet'], true], ['slides', ['sslides'], true], ['video', ['svideo'], true], ['pdf', ['pdf'], false],
  ['doc', ['docx', 'docm', 'doc', 'odt', 'fodt', 'rtf', 'txt', 'eml', 'msg'], false], ['sheets', ['xlsx', 'xlsm', 'xls', 'xlsb', 'ods', 'fods', 'csv', 'tsv', 'tab', 'prn'], false],
  ['slides', ['pptx', 'ppt', 'odp', 'fodp', 'ppsx', 'potx', 'pptm', 'ppsm', 'potm'], false],
  ['images', ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif', 'ico', 'avif', 'svg', 'tif', 'tiff', 'heic', 'heif', 'psd', 'psb', 'tga'], false],
  ['video', ['mp4', 'm4v', 'mov', 'webm', 'mkv', 'avi', '3gp', 'ogv', 'mp3', 'm4a', 'aac', 'wav', 'ogg', 'oga', 'opus', 'flac', 'wma'], false],
];
/** Clipurile și sunetele: în Video, ca proiect nou (doar calea). */
export const isMedia = (kind: ModuleId, name: string) => kind === 'video' && !/.svideo$/i.test(name);
export const dropKind = (name: string) => {
  const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : '';
  return DROP_KINDS.find(([, list]) => list.includes(ext)) ?? null;
};

/** Evenimentul prin care o aplicație cere deschiderea unor octeți (cu numele lor) într-un tab nou, în aplicația potrivită. */
export const OPEN_BYTES = 'suite:open-bytes';
export interface OpenBytes { name: string; data: Uint8Array }
/** Fișierele care sunt programe sau scripturi (și documentele cu macro-uri): nu se deschid din Suite, doar se salvează, cu avertisment. */
export function isRisky(name: string): boolean {
  return /\.(exe|com|bat|cmd|scr|pif|msi|msp|ps1|psm1|vbs|vbe|js|jse|wsf|wsh|hta|jar|lnk|reg|dll|cpl|docm|xlsm|pptm)$/i.test(name.trim());
}
/** Se poate deschide din octeți (fără cale pe disc)? Clipurile și sunetele nu: Video le cere de pe disc. */
export function canOpenBytes(name: string): boolean {
  const k = dropKind(name);
  return !!k && !isMedia(k[0], name);
}
/** Evenimentul prin care o aplicație cere deschiderea unui fișier de pe disc (după cale), în aplicația lui (App.tsx). */
export const OPEN_PATH = 'suite:open-path';
export interface OpenPath { path: string; sheet?: string }
/** Deschide fișierul de la calea dată în aplicația lui (de exemplu foaia unui tabel legat, din Docs / Slides); dacă e deja deschis, treci la tabul lui. */
export function openPath(path: string, sheet?: string) {
  window.dispatchEvent(new CustomEvent<OpenPath>(OPEN_PATH, { detail: { path, sheet } }));
}
/** Evenimentul trimis când o aplicație a scris un fișier înapoi pe disc (de exemplu Sheets peste un .xlsx / .ods / .csv). */
export const FILE_SAVED = 'suite:file-saved';
export interface FileSaved { path: string }
export function fileSaved(path: string) {
  window.dispatchEvent(new CustomEvent<FileSaved>(FILE_SAVED, { detail: { path } }));
}
/** Aceeași cale pe Windows: fără deosebire între litere mari și mici și între cele două feluri de bare. */
const normPath = (p: string) => p.replace(/[\\/]+/g, '/').toLowerCase();
export const samePath = (a: string, b: string) => normPath(a) === normPath(b);
/** Deschide fișierul (de exemplu un atașament) într-un tab nou al aplicației lui. */
export function openBytes(name: string, data: Uint8Array) {
  window.dispatchEvent(new CustomEvent<OpenBytes>(OPEN_BYTES, { detail: { name, data } }));
}

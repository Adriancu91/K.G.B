// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Zoom (ca glisorul din colțul lui Word și Excel): pagina sau tabelul se vede mai mare sau mai mică, fără să se schimbe fișierul.
// Tipărirea și PDF-ul rămân la mărimea reală. Alegerea se ține minte pe acest calculator, separat pentru fiecare modul.

export const ZOOM_MIN = 50;
export const ZOOM_MAX = 200;
const STEPS = [50, 67, 75, 80, 90, 100, 110, 125, 150, 175, 200];

export const clampZoom = (z: number) => Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z)));

/** Treapta următoare (dir = 1) sau anterioară (dir = -1), ca în Chrome: 90 → 100 → 110 → 125. */
export function nextZoom(z: number, dir: 1 | -1): number {
  if (dir > 0) return STEPS.find((s) => s > z) ?? ZOOM_MAX;
  return [...STEPS].reverse().find((s) => s < z) ?? ZOOM_MIN;
}

/** Zoom-ul la care pagina (lată de `pageW` la 100%) încape în lățimea `areaW`, cu puțin loc pe margini. */
export function fitZoom(areaW: number, pageW: number): number {
  if (!(areaW > 0 && pageW > 0)) return 100;
  return clampZoom(Math.floor(((areaW - 48) / pageW) * 100));
}

/** Zoom-ul la care o pagină întreagă (`pageW` × `pageH` la 100%) încape în zona `areaW` × `areaH` (ca „O pagină” din Word). */
export function fitPageZoom(areaW: number, areaH: number, pageW: number, pageH: number): number {
  if (!(areaW > 0 && areaH > 0 && pageW > 0 && pageH > 0)) return 100;
  return clampZoom(Math.floor(Math.min((areaW - 48) / pageW, (areaH - 32) / pageH) * 100));
}

export function loadZoom(key = 'suite.docs.zoom'): number {
  try {
    const v = Number(localStorage.getItem(key));
    return v ? clampZoom(v) : 100;
  } catch {
    return 100;
  }
}

export function saveZoom(z: number, key = 'suite.docs.zoom') {
  try { localStorage.setItem(key, String(z)); } catch { /* fără memorie: rămâne doar până la închidere */ }
}

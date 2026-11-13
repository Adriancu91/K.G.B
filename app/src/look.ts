// The look of the window on this PC (cerere 13.11): „Clasic” or a style with buttons in relief and colour
// gradients. Kept in the PC's preferences (desktop.json, like the language), applied as `data-look` on <html>;
// the WebView's storage is only a hint for the first paint.
import { invoke } from "@tauri-apps/api/core";

export const LOOKS: [string, string][] = [
  ["clasic", "Clasic"],
  ["ocean", "Ocean"],
  ["aurora", "Aurora"],
  ["chihlimbar", "Chihlimbar"],
];
const KEY = "kgb.look";
const ids = LOOKS.map(([id]) => id);

let look = (() => {
  try {
    const v = localStorage.getItem(KEY) ?? "clasic";
    return ids.includes(v) ? v : "clasic";
  } catch {
    return "clasic";
  }
})();

function paint(id: string) {
  if (id === "clasic") delete document.documentElement.dataset.look;
  else document.documentElement.dataset.look = id;
}

export const currentLook = () => look;

/** Changes the look now and remembers it on this PC. */
export function applyLook(id: string) {
  if (!ids.includes(id)) return;
  look = id;
  paint(id);
  try {
    localStorage.setItem(KEY, id);
  } catch {
    // Only the hint for the first paint.
  }
  invoke("stil_set", { stil: id }).catch(() => {
    // Not saved: the choice lasts until the app closes.
  });
}

/** Once, at start: the look saved on this PC. */
export function startLook() {
  paint(look);
  invoke<string>("stil_get").then(
    (saved) => {
      if (ids.includes(saved) && saved !== look) {
        look = saved;
        paint(saved);
        try {
          localStorage.setItem(KEY, saved);
        } catch {
          // hint only
        }
      }
    },
    () => {},
  );
}

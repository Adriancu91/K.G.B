// The app in English (WORKLIST 7.4l-0f): the same translator as Cyber Office Studio (app/cos/src/i18n.ts)
// translates the whole window from Romanian, by dictionaries; the app's own texts are in kgb-en.json
// (added with `addExtra`). It is loaded only when English is chosen, so the Romanian start stays light.
// The windows copied from COS (Sheets, Docs) follow the same choice through the host (components/cosHost.ts).
// The choice is kept in the preferences of this PC (`desktop.json` next to the data, `lang_get` / `lang_set`):
// the WebView's own storage reaches the disk only some time later (a choice made just before closing was
// lost) and is shared by every K.G.B. on the computer. localStorage stays only as a hint for the first paint.
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export type Lang = "ro" | "en";
const KEY = "kgb.lang";
const EVT = "kgb-lang";

function stored(): Lang {
  try {
    return localStorage.getItem(KEY) === "en" ? "en" : "ro";
  } catch {
    return "ro";
  }
}

let lang: Lang = stored();
let translator: Promise<typeof import("../../cos/src/i18n")> | null = null;
const load = () =>
  // The translator and the app's dictionary come together, only when English is chosen.
  (translator ??= Promise.all([import("../../cos/src/i18n"), import("./kgb-en.json")]).then(([m, kgbEn]) => {
    m.addExtra([{ group: "kgb", modules: null, data: kgbEn.default }]);
    return m;
  }));

async function apply(next: Lang) {
  document.documentElement.lang = next;
  if (next === "en") (await load()).setLang("en");
  else if (translator) (await translator).setLang("ro");
}

export const currentLang = (): Lang => lang;

/** Changes the language of the app (remembered on this computer) and of the open windows. */
export function setLang(next: Lang) {
  if (next === lang) return;
  change(next);
  invoke("lang_set", { limba: next }).catch(() => {
    // Not saved: the choice lasts until the app closes.
  });
}

function change(next: Lang) {
  lang = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    // Only the hint for the first paint.
  }
  void apply(next);
  window.dispatchEvent(new CustomEvent(EVT));
}

/** Once, at start: the language saved on this PC. */
export function startLang() {
  if (lang === "en") void apply("en");
  invoke<string>("lang_get").then(
    (saved) => {
      const l: Lang = saved === "en" ? "en" : "ro";
      if (l !== lang) change(l);
    },
    () => {},
  );
}

/** Calls `f` with each new language (the frames of the COS windows listen). */
export function onLang(f: (l: Lang) => void): () => void {
  const on = () => f(lang);
  window.addEventListener(EVT, on);
  return () => window.removeEventListener(EVT, on);
}

export function useLang(): Lang {
  const [l, setL] = useState(lang);
  useEffect(() => onLang(setL), []);
  return l;
}

// The app in English (WORKLIST 7.4l-0f): the same translator as Cyber Office Studio (app/cos/src/i18n.ts)
// translates the whole window from Romanian, by dictionaries; the app's own texts are in kgb-en.json
// (added with `addExtra`). It is loaded only when English is chosen, so the Romanian start stays light.
// The windows copied from COS (Sheets, Docs) follow the same choice through the host (components/cosHost.ts).
import { useEffect, useState } from "react";
import kgbEn from "./kgb-en.json";

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
  (translator ??= import("../../cos/src/i18n").then((m) => {
    m.addExtra([{ group: "kgb", modules: null, data: kgbEn }]);
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
  lang = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    // Without storage the choice lasts until the app closes.
  }
  void apply(next);
  window.dispatchEvent(new CustomEvent(EVT));
}

/** Once, at start: English if it was chosen last time. */
export function startLang() {
  if (lang === "en") void apply("en");
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

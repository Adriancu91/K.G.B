// The PDF of the pages of a COS window (D-081), for the print preview, Page layout and Export PDF.
// COS made it with Electron's printToPDF of its own window, with the header / footer drawn by Chromium's
// templates. Here:
// 1) `snapshot` takes a picture of the frame's document as HTML: its styles, the current values of the
//    fields, canvases turned into pictures, blob: pictures into data: (the hidden window cannot read them);
// 2) the app prints it in a hidden window with WebView2 (`print_pdf`, src-tauri/src/print.rs), which loads
//    it with `showSnapshot` after `clean` has removed everything that could run or reach outside;
// 3) `stamp` draws the header, the footer and the page numbers on the PDF with pdf-lib, as COS did
//    (main.cjs: headerFooter, firstPage, evenPage, sections), since WebView2 has no such templates.
import { PDFDict, PDFDocument, PDFHexString, PDFName, PDFString, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
// Inlined: the app's content policy lets the page fetch nothing (connect-src is only the IPC).
import regularFont from "pdfjs-dist/standard_fonts/LiberationSans-Regular.ttf?inline";
import type { PagePrint } from "../../cos/src/api";

export interface Snapshot {
  /** The stylesheets of the frame (same app), by address. */
  links: string[];
  /** The text of its <style> elements. */
  styles: string[];
  htmlClass: string;
  bodyClass: string;
  lang: string;
  body: string;
}
export interface Paper {
  width_mm: number;
  height_mm: number;
  landscape: boolean;
  margins_mm: [number, number, number, number];
}

// ---------- 1) the picture of the document ----------

const blobPicture = (src: string) =>
  new Promise<string>((ok, fail) => {
    const i = new Image();
    i.onload = () => {
      const c = document.createElement("canvas");
      c.width = i.naturalWidth;
      c.height = i.naturalHeight;
      c.getContext("2d")?.drawImage(i, 0, 0);
      ok(c.toDataURL("image/png"));
    };
    i.onerror = () => fail(new Error("picture"));
    i.src = src;
  });

/** The paper and margins of the document's own `@page` rule (Docs writes one), else A4 with 20 mm. */
function paperOf(styles: string[], landscape: boolean): Paper {
  const p: Paper = { width_mm: 210, height_mm: 297, landscape, margins_mm: [20, 20, 20, 20] };
  const rule = styles.map((s) => /@page\s*\{([^}]*)\}/.exec(s)?.[1]).find(Boolean);
  const size = rule && /size:\s*([\d.]+)mm\s+([\d.]+)mm/.exec(rule);
  if (size) {
    p.width_mm = Number(size[1]);
    p.height_mm = Number(size[2]);
    p.landscape = p.width_mm > p.height_mm;
  }
  const m = rule && /margin:\s*([\d.]+)mm(?:\s+([\d.]+)mm)?(?:\s+([\d.]+)mm)?(?:\s+([\d.]+)mm)?/.exec(rule);
  if (m) {
    const v = m.slice(1).filter(Boolean).map(Number);
    const t = v[0] ?? 20, r = v[1] ?? t, b = v[2] ?? t, l = v[3] ?? r;
    p.margins_mm = [t, r, b, l];
  }
  return p;
}

export async function snapshot(doc: Document, page?: PagePrint): Promise<{ snapshot: Snapshot; paper: Paper }> {
  const clone = doc.body.cloneNode(true) as HTMLElement;
  // What the user has typed lives in the fields' properties, not in the HTML.
  const live = [...doc.body.querySelectorAll("input, textarea, select")];
  [...clone.querySelectorAll("input, textarea, select")].forEach((el, i) => {
    const src = live[i] as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | undefined;
    if (!src) return;
    if (el instanceof HTMLTextAreaElement) el.textContent = src.value;
    else if (el instanceof HTMLSelectElement) [...el.options].forEach((o, k) => o.toggleAttribute("selected", (src as HTMLSelectElement).options[k]?.selected));
    else if (el instanceof HTMLInputElement) {
      el.setAttribute("value", src.value);
      el.toggleAttribute("checked", (src as HTMLInputElement).checked);
    }
  });
  // Canvases (charts, PDF pages) become pictures.
  const canvases = [...doc.body.querySelectorAll("canvas")];
  [...clone.querySelectorAll("canvas")].forEach((c, i) => {
    const img = doc.createElement("img");
    try {
      img.src = canvases[i]?.toDataURL("image/png") ?? "";
    } catch {
      // A canvas that cannot be read stays empty.
    }
    img.setAttribute("style", c.getAttribute("style") ?? "");
    img.className = c.className;
    img.width = c.width;
    img.height = c.height;
    c.replaceWith(img);
  });
  // blob: pictures belong to the frame's document: they travel as data:.
  // (through a canvas: the content policy allows no fetch)
  for (const img of clone.querySelectorAll<HTMLImageElement>("img[src^='blob:']")) {
    img.src = await blobPicture(img.src).catch(() => "");
    if (!img.src) img.removeAttribute("src");
  }
  const styles = [...doc.querySelectorAll("style")].map((s) => s.textContent ?? "");
  const links = [...doc.querySelectorAll<HTMLLinkElement>("link[rel='stylesheet']")]
    .map((l) => l.getAttribute("href") ?? "")
    .filter((h) => h.startsWith("/") || h.startsWith("./") || /^[\w-]+\//.test(h));
  const shot: Snapshot = {
    links,
    styles,
    htmlClass: doc.documentElement.className,
    bodyClass: doc.body.className,
    lang: doc.documentElement.lang,
    body: clone.innerHTML,
  };
  return { snapshot: shot, paper: paperOf(styles, !!page?.landscape) };
}

// ---------- 2) in the hidden window: clean and show it ----------

/** Elements that could run something or bring in another page. */
const DROP = "script, iframe, frame, frameset, object, embed, applet, base, meta, link, portal, noscript, template";
const URL_ATTRS = ["src", "href", "xlink:href", "poster", "srcset", "background", "data", "action", "formaction", "ping", "lowsrc", "dynsrc"];
/** Only data:, blob: and the app's own addresses (relative, or the same origin) are kept. */
export function safeUrl(v: string, origin: string): boolean {
  const t = v.trim();
  if (!t || t.startsWith("#")) return true;
  if (/^(data|blob):/i.test(t)) return /^data:(image|font)\//i.test(t) || /^blob:/i.test(t);
  if (/^[a-z][a-z0-9+.-]*:/i.test(t)) return t.startsWith(origin + "/");
  return !t.startsWith("//");
}

/** Removes scripts, event handlers, frames, objects and outside addresses from the snapshot's HTML. */
export function clean(html: string, origin: string): DocumentFragment {
  // DOMParser runs nothing: scripts and handlers stay inert until removed here.
  const parsed = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  parsed.body.querySelectorAll(DROP).forEach((e) => e.remove());
  for (const el of parsed.body.querySelectorAll("*")) {
    for (const a of [...el.attributes]) {
      const n = a.name.toLowerCase();
      if (n.startsWith("on") || n === "srcdoc" || n === "is" || n === "http-equiv") el.removeAttribute(a.name);
      else if (URL_ATTRS.includes(n) && (n === "srcset" ? a.value.split(",").some((p) => !safeUrl(p.trim().split(/\s+/)[0] ?? "", origin)) : !safeUrl(a.value, origin)))
        el.removeAttribute(a.name);
      else if (n === "style" && /url\(\s*['"]?\s*(?!data:|blob:|#)[a-z][a-z0-9+.-]*:/i.test(a.value)) el.removeAttribute(a.name);
    }
    // SVG animations can set attributes (href) after the cleaning.
    if (/^(animate|set|animatetransform|animatemotion)$/i.test(el.tagName)) el.remove();
  }
  const frag = document.createDocumentFragment();
  for (const n of [...parsed.body.childNodes]) frag.appendChild(document.importNode(n, true));
  return frag;
}

const safeClass = (c: string) => c.replace(/[^\w\s-]/g, "").slice(0, 500);
/** Outside addresses in a stylesheet (@import, url()) are dropped; the app's own stay. */
const cleanCss = (css: string, origin: string) =>
  css
    .replace(/@import[^;]*;/gi, (m) => (/url\(\s*['"]?(https?:)?\/\//i.test(m) && !m.includes(origin) ? "" : m))
    .replace(/url\(\s*(['"]?)([^)'"]*)\1\s*\)/gi, (m, _q, u: string) => (safeUrl(u, origin) ? m : "none"));

/** The hidden window shows the cleaned snapshot and waits for its fonts and pictures. */
export async function showSnapshot(s: Snapshot): Promise<void> {
  const origin = location.origin;
  document.documentElement.className = safeClass(s.htmlClass);
  document.documentElement.lang = /^[a-z-]{2,10}$/i.test(s.lang) ? s.lang : "ro";
  for (const href of s.links) {
    if (!safeUrl(href, origin)) continue;
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = href;
    document.head.appendChild(l);
  }
  for (const css of s.styles) {
    const st = document.createElement("style");
    st.textContent = cleanCss(css, origin);
    document.head.appendChild(st);
  }
  document.body.className = safeClass(s.bodyClass);
  document.body.replaceChildren(clean(s.body, origin));
  await Promise.all([
    ...[...document.querySelectorAll<HTMLLinkElement>("link[rel='stylesheet']")].map(
      (l) => new Promise<void>((ok) => (l.sheet ? ok() : ((l.onload = () => ok()), (l.onerror = () => ok())))),
    ),
    ...[...document.images].map((i) => (i.complete ? Promise.resolve() : new Promise<void>((ok) => ((i.onload = () => ok()), (i.onerror = () => ok()))))),
  ]);
  await document.fonts.ready;
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
}

// ---------- 3) the header, the footer and the page numbers ----------

type Extra = PagePrint & {
  numStyle?: string;
  headerImage?: string;
  evenPage?: { header: string; footer: string };
};
const NUM_TOKENS: Record<string, string[]> = {
  full: ["Pagina ", "P", " din ", "T"],
  page: ["Pagina ", "P"],
  num: ["P"],
  slash: ["P", " / ", "T"],
};
const SEC_MARK = "https://sectiune.invalid/";
const MM = 72 / 25.4;

/** The section marks of a page (1-pixel links to SEC_MARK, see cos/src/docs/sectionKinds.ts). */
function secMarks(p: PDFPage): { i: number; text: string }[] {
  const annots = p.node.Annots();
  const out: { i: number; text: string }[] = [];
  if (!annots) return out;
  for (let i = 0; i < annots.size(); i++) {
    const a = annots.lookup(i);
    const act = a instanceof PDFDict ? a.lookup(PDFName.of("A")) : null;
    const uri = act instanceof PDFDict ? act.lookup(PDFName.of("URI")) : null;
    const text = uri instanceof PDFString || uri instanceof PDFHexString ? uri.decodeText() : "";
    if (text.startsWith(SEC_MARK)) out.push({ i, text: text.slice(SEC_MARK.length) });
  }
  return out;
}

/** The section of every page (0 = the first); a „Continuous” section that starts mid-page takes the next page. */
function secPages(doc: PDFDocument, n: number): number[] {
  const starts: { k: number; from: number }[] = [];
  doc.getPages().forEach((p, q) =>
    secMarks(p).forEach(({ text }) => {
      const m = /^([0-9]+)[/]([pc])$/.exec(text);
      if (m) starts.push({ k: Number(m[1]), from: m[2] === "c" ? q + 1 : q });
    }),
  );
  starts.sort((a, b) => a.k - b.k);
  const of = new Array<number>(n).fill(0);
  for (const { k, from } of starts) for (let i = from; i < n; i++) of[i] = k;
  return of;
}

let fontBytes: Uint8Array | null = null;
const dataBytes = (url: string) => Uint8Array.from(atob(url.slice(url.indexOf(",") + 1)), (c) => c.charCodeAt(0));

/** Draws the header, footer and numbers on every page, as COS's templates did (9 px, grey, 20 mm from the sides). */
export async function stamp(pdf: Uint8Array, page?: Extra): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdf);
  const pages = doc.getPages();
  const n = pages.length;
  const of = page?.sections?.length ? secPages(doc, n) : new Array<number>(n).fill(0);
  let marks = false;
  for (const p of pages) {
    const m = secMarks(p);
    const annots = p.node.Annots();
    if (annots && m.length) {
      for (const { i } of [...m].reverse()) annots.remove(i);
      marks = true;
    }
  }
  const any = (h?: { header?: string; footer?: string; numbers?: boolean }) => !!(h && (String(h.header ?? "").trim() || String(h.footer ?? "").trim() || h.numbers));
  const logo = typeof page?.headerImage === "string" && /^data:image\/(png|jpeg);base64,/.test(page.headerImage) ? page.headerImage : "";
  if (!page || page.raw || (!any(page) && !any(page.firstPage) && !any(page.evenPage) && !page.sections?.some(any) && !logo)) {
    return marks ? doc.save() : pdf;
  }
  doc.registerFontkit(fontkit);
  fontBytes ??= dataBytes(regularFont);
  const font = await doc.embedFont(fontBytes, { subset: true });
  const image = logo ? await (logo.startsWith("data:image/png") ? doc.embedPng(logo) : doc.embedJpg(logo)) : null;
  const at = /^[tb][lcr]$/.test(page.numAt ?? "") ? (page.numAt as string) : "br";
  const tokens: string[] = NUM_TOKENS[page.numStyle ?? ""] ?? ["Pagina ", "P", " din ", "T"];
  pages.forEach((p, i) => {
    const k = of[i] ?? 0;
    const s = k > 0 ? page.sections?.[k - 1] : undefined;
    let h: { header: string; footer: string; numbers: boolean } = { header: page.header, footer: page.footer, numbers: page.numbers };
    if (s && (s.header !== page.header || s.footer !== page.footer)) h = { header: s.header, footer: s.footer, numbers: page.numbers };
    if (i % 2 === 1 && page.evenPage) h = { header: page.evenPage.header, footer: page.evenPage.footer, numbers: page.numbers };
    if (i === 0 && page.firstPage) h = page.firstPage;
    const num = h.numbers ? tokens.map((t) => (t === "P" ? String(i + 1) : t === "T" ? String(n) : t)).join("") : "";
    row(p, font, String(h.header ?? "").trim(), num && at[0] === "t" ? num : "", at[1] ?? "r", true, image);
    row(p, font, String(h.footer ?? "").trim(), num && at[0] === "b" ? num : "", at[1] ?? "r", false, null);
  });
  return doc.save();
}

/** One row: the text (header centred, footer on the left), the number in its place, the logo on the left of the header. */
function row(p: PDFPage, font: PDFFont, text: string, num: string, numAt: string, top: boolean, image: Awaited<ReturnType<PDFDocument["embedPng"]>> | null) {
  const { width, height } = p.getSize();
  const size = 6.75; // 9 px
  const color = rgb(0x55 / 255, 0x55 / 255, 0x55 / 255);
  const y = top ? height - 10 * MM - size / 2 : 10 * MM - size / 2;
  const left = 20 * MM;
  const right = width - 20 * MM;
  const slots: [string, boolean][] = [
    ["", false],
    ["", false],
    ["", false],
  ];
  slots[top ? 1 : 0]![0] = text;
  if (num) slots[{ l: 0, c: 1, r: 2 }[numAt as "l" | "c" | "r"] ?? 2]![1] = true;
  let x0 = left;
  if (top && image) {
    const h = 10 * MM;
    const w = Math.min(63 * MM, (image.width / image.height) * h);
    p.drawImage(image, { x: left, y: height - 5 * MM - h, width: w, height: h });
    x0 = left + w + 6;
  }
  slots.forEach(([t, withNum], k) => {
    const s = `${t}${t && withNum ? " · " : ""}${withNum ? num : ""}`;
    if (!s) return;
    const w = font.widthOfTextAtSize(s, size);
    const x = k === 0 ? x0 : k === 1 ? (x0 + right) / 2 - w / 2 : right - w;
    p.drawText(s, { x, y, size, font, color });
  });
}


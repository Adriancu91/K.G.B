// Editing the text of a page on click, as in Cyber Office Studio (7.4l-0b, D-078): the big page carries COS's
// "Editează text" layer (TextEdit.tsx, unchanged): a click on a line or a paragraph opens it for writing,
// Enter keeps the new text, Delete removes it, Esc gives up. The old text is taken out of the page's content
// (textRemove.ts) and the new one written in its place with its colours, size and style (replaceText.ts,
// paragraphs.ts); here the same steps as COS's editBlock (Pdf.tsx) run on the version without its stamps, the
// stamps are put back, and the result goes through the PDF module's checks and a preview, as a new version.
import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { TextItem } from "pdfjs-dist/types/src/display/api";
import { fontStyleOf, replaceTextPdf, segOf } from "../../../cos/src/pdf/replaceText";
import { TextEditLayer, type EditStyle, type inkColors, type TextBlock } from "../../../cos/src/pdf/TextEdit";
import "../../../cos/src/pdf/marks.css";
import "../../../cos/src/pdf/textedit.css";
import textFontUrl from "pdfjs-dist/standard_fonts/LiberationSans-Regular.ttf?url";
import boldFontUrl from "pdfjs-dist/standard_fonts/LiberationSans-Bold.ttf?url";
import italicFontUrl from "pdfjs-dist/standard_fonts/LiberationSans-Italic.ttf?url";
import boldItalicFontUrl from "pdfjs-dist/standard_fonts/LiberationSans-BoldItalic.ttf?url";
import { BIG_WIDTH, pageSize, stampMarks, type Mark } from "./StampEdit";
import { drawPage } from "./pdfjs";

/** COS's editBlock: the new text of block `b` on page `n` written into `bytes` (the version without stamps). */
export async function editedPdf(
  doc: PDFDocumentProxy,
  bytes: Uint8Array,
  n: number,
  b: TextBlock,
  text: string,
  colors: ReturnType<typeof inkColors>,
  style?: EditStyle,
): Promise<Uint8Array | null> {
  const pg = await doc.getPage(n);
  const items = (await pg.getTextContent()).items.filter((x): x is TextItem => "str" in x);
  // A paragraph: all its pieces are taken out and the new text is laid out on its width (replaceTextPdf with `para`).
  const parts = b.lines ?? [b];
  const its = parts.map((p) => items[p.i]);
  if (its.some((it, k) => !it || it.str !== parts[k]!.str)) return null;
  const all = its as TextItem[];
  const segs = all.map((x, k) => segOf(x, 0, x.str.length, n, !k));
  const seg = segs[0]!;
  const styleOf = (x: TextItem) => {
    try {
      return fontStyleOf((pg.commonObjs.get(x.fontName) as { name?: string })?.name ?? "");
    } catch {
      return null; // the font is not loaded yet
    }
  };
  if (!b.lines) {
    const st = styleOf(all[0]!);
    if (st) Object.assign(seg, st);
  } else {
    // The paragraph's style is the one of most of its letters; pieces written otherwise (a bold word) keep theirs.
    const sts = all.map(styleOf);
    const count = new Map<string, number>();
    const key = (s: ReturnType<typeof styleOf>) => (s ? `${!!s.bold}/${!!s.italic}/${s.font ?? ""}` : "");
    all.forEach((x, k) => count.set(key(sts[k] ?? null), (count.get(key(sts[k] ?? null)) ?? 0) + x.str.trim().length));
    const main = [...count].sort((a, c) => c[1] - a[1])[0]?.[0] ?? "";
    const st0 = sts.find((s) => key(s) === main);
    if (st0) Object.assign(seg, st0);
    segs.forEach((s, k) => {
      s.str = all[k]!.str;
      const st = sts[k];
      if (st && key(st) !== main && all[k]!.str.trim()) s.run = { bold: st.bold, italic: st.italic, font: st.font };
    });
  }
  if (colors) for (const s of segs) {
    s.color = colors.color;
    s.bg = colors.bg;
  }
  // The format chosen in the box's bar: another bold / italic means another font (the original one no longer fits).
  if (style?.color) seg.color = style.color;
  if (style?.size) seg.textSize = style.size;
  if (style?.family) {
    seg.family = style.family === "serif" || style.family === "mono" ? style.family : undefined;
    seg.font = undefined;
  }
  if (style?.bold !== undefined && style.bold !== !!seg.bold) {
    seg.bold = style.bold;
    seg.font = undefined;
  }
  if (style?.italic !== undefined && style.italic !== !!seg.italic) {
    seg.italic = style.italic;
    seg.font = undefined;
  }
  const font = async (u: string) => (await fetch(u)).arrayBuffer();
  const fonts = {
    regular: await font(textFontUrl),
    bold: await font(boldFontUrl),
    italic: await font(italicFontUrl),
    boldItalic: await font(boldItalicFontUrl),
  };
  return replaceTextPdf(bytes, segs, text, fonts, b.lines ? b.align ?? true : false);
}

/** The big page with COS's "Editează text" layer; every change is handed over as the whole new PDF (with the stamps). */
export function TextEditPage(props: {
  doc: PDFDocumentProxy;
  page: number;
  base: Uint8Array;
  marks: Mark[];
  busy: boolean;
  onEdited: (out: Uint8Array, what: string) => void;
  onError: (e: string) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [working, setWorking] = useState(false);
  useEffect(() => {
    let live = true;
    pageSize(props.doc, props.page).then(
      (s) => live && setSize(s),
      (e: unknown) => props.onError(String(e)),
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.doc, props.page]);
  useEffect(() => {
    if (size && ref.current) drawPage(props.doc, props.page, ref.current, BIG_WIDTH).catch((e: unknown) => props.onError(String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.doc, props.page, size]);
  if (!size) return <p className="muted">…</p>;
  const zoom = BIG_WIDTH / size.w;
  const commit = (b: TextBlock, text: string, colors: ReturnType<typeof inkColors>, style?: EditStyle) => {
    setWorking(true);
    editedPdf(props.doc, props.base, props.page, b, text, colors, style)
      .then(async (out) => {
        if (!out) throw new Error("Pagina s-a schimbat între timp: deschide-o din nou.");
        const withStamps = props.marks.length ? await stampMarks(out, props.marks) : out;
        const old = b.str.replace(/\s+/g, " ").trim();
        const short = (s: string) => (s.length > 40 ? `${s.slice(0, 40)}…` : s);
        props.onEdited(withStamps, text ? `textul „${short(old)}” schimbat pe pagina ${props.page}` : `textul „${short(old)}” scos de pe pagina ${props.page}`);
      })
      .catch((e: unknown) => props.onError(e instanceof Error ? e.message : String(e)))
      .finally(() => setWorking(false));
  };
  return (
    <div className="pdf-stamp-scroll">
      <div className="pdf-page-box" style={{ width: BIG_WIDTH, height: size.h * zoom }}>
        <canvas ref={ref} aria-label={`Pagina ${props.page}`} style={{ width: BIG_WIDTH, height: size.h * zoom }} />
        <TextEditLayer doc={props.doc} n={props.page} zoom={zoom} busy={props.busy || working} onCommit={commit} />
      </div>
    </div>
  );
}

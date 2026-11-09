// Stamps that stay editable, as in Cyber Office Studio (7.4l-0a, D-078): the big page carries COS's mark layer
// (Marks.tsx, unchanged), so a stamp is moved, resized, changed on double-click and deleted on the page. Saving
// writes them with COS's stampMarks (a real /Stamp annotation plus its data); on reopening, extractStamps turns
// them back into editable stamps.
import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { MarkLayer } from "../../../cos/src/pdf/Marks";
import { stampSize, type Mark } from "../../../cos/src/pdf/sign";
import "../../../cos/src/pdf/marks.css";
import { drawPage } from "./pdfjs";

export type { Mark };
export { extractStamps } from "../../../cos/src/pdf/stampAnnot";
export { stampMarks } from "../../../cos/src/pdf/sign";

/** The width of the big page on screen (CSS pixels). */
export const BIG_WIDTH = 720;

/** The stamp chosen in the panel, waiting to be put on a page: a text stamp or one from „Ștampilele mele”. */
export interface Armed {
  text: string;
  sub?: string;
  color?: string;
  opacity?: number;
  /** Own stamp: the picture (data URL), width / height and the width on the page (points). */
  img?: string;
  ratio?: number;
  widthPt?: number;
}

/** A new stamp mark centred at (x, y) on a page of size s (points, as the page is seen), kept inside the page. */
export function stampMark(a: Armed, id: number, page: number, x: number, y: number, s: { w: number; h: number }): Mark {
  let m: Mark;
  if (a.img && a.ratio) {
    const w = Math.min(a.widthPt ?? 140, s.w, s.h * a.ratio);
    const h = w / a.ratio;
    m = { id, page, x: x - w / 2, y: y - h / 2, w, h, kind: "stamp", img: a.img, text: a.text };
  } else {
    const sub = a.sub ?? "";
    const box = stampSize(a.text, sub);
    m = { id, page, x: x - box.w / 2, y: y - box.h / 2, ...box, kind: "stamp", text: a.text, sub, color: a.color };
  }
  if (a.opacity !== undefined && a.opacity < 1) m.opacity = a.opacity;
  return { ...m, x: Math.max(0, Math.min(s.w - m.w, m.x)), y: Math.max(0, Math.min(s.h - m.h, m.y)) };
}

/** Where a stamp goes for „sus-stanga” … „jos-dreapta”: its centre, 28 points from the edges. */
export function placeCentre(place: string, s: { w: number; h: number }, m: { w: number; h: number }): [number, number] {
  const edge = 28;
  const [row, col] = place === "centru" ? ["mijloc", "centru"] : place.split("-");
  const x = col === "stanga" ? edge + m.w / 2 : col === "dreapta" ? s.w - edge - m.w / 2 : s.w / 2;
  const y = row === "sus" ? edge + m.h / 2 : row === "jos" ? s.h - edge - m.h / 2 : s.h / 2;
  return [x, y];
}

export async function pageSize(doc: PDFDocumentProxy, n: number): Promise<{ w: number; h: number }> {
  const vp = (await doc.getPage(n)).getViewport({ scale: 1 });
  return { w: vp.width, h: vp.height };
}

export function StampPage(props: {
  doc: PDFDocumentProxy;
  page: number;
  marks: Mark[];
  armed: boolean;
  selected: number | null;
  editing: number | null;
  onPlace(x: number, y: number, size: { w: number; h: number }): void;
  onChange(m: Mark): void;
  onRemove(id: number): void;
  onSelect(id: number | null): void;
  onEdit(id: number | null): void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    setSize(null);
    pageSize(props.doc, props.page).then(
      (s) => live && setSize(s),
      (e: unknown) => live && setErr(String(e)),
    );
    return () => {
      live = false;
    };
  }, [props.doc, props.page]);
  useEffect(() => {
    if (size && ref.current) drawPage(props.doc, props.page, ref.current, BIG_WIDTH).catch((e: unknown) => setErr(String(e)));
  }, [props.doc, props.page, size]);
  if (err) return <p className="error">Pagina nu se poate afișa: {err}</p>;
  if (!size) return <p className="muted">…</p>;
  const zoom = BIG_WIDTH / size.w;
  return (
    <div className="pdf-stamp-scroll">
      <div className="pdf-page-box" style={{ width: BIG_WIDTH, height: size.h * zoom }}>
        <canvas ref={ref} aria-label={`Pagina ${props.page}`} style={{ width: BIG_WIDTH, height: size.h * zoom }} />
        <MarkLayer
          marks={props.marks.filter((m) => m.page === props.page)}
          zoom={zoom}
          pw={size.w}
          ph={size.h}
          tool={props.armed ? "stamp" : null}
          selected={props.selected}
          onPlace={(x: number, y: number) => props.onPlace(x, y, size)}
          onPlaceRect={() => undefined}
          onPlaceDraw={() => undefined}
          onChange={props.onChange}
          onRemove={props.onRemove}
          onSelect={props.onSelect}
          editing={props.editing}
          onEdit={props.onEdit}
        />
      </div>
    </div>
  );
}

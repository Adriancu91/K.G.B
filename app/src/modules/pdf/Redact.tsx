// Hiding data for good (Etapa 7, step 7.4l-1c): zones drawn on the page
// with the mouse, or found by „Caută” (CNP, e-mail, phone, IBAN, words —
// redactFind.ts from Cyber Office Studio, D-071). The pages with zones become
// images with black over them, in a new version, after a preview.
import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { PDFDocument, rgb } from "pdf-lib";
import { api } from "../../api";
import { drawPage, fromBase64, openPdf } from "./pdfjs";
import { dropAnnotsIn, dropUnreachable, redactKeepText } from "./redactKeep";
import { findBoxes, REDACT_KINDS, type RedactKind, viewportOf } from "./redactFind";

type Box = [number, number, number, number];

const toB64 = (b: Uint8Array) => {
  let s = "";
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
};

/**
 * The finer way of Cyber Office Studio (redactKeep.ts, D-071/D-072): only the letters under the zones leave the page,
 * the rest stays text; black is drawn over the zones; then pdf.js checks nothing can be read under them any more.
 * null when that is not sure (an image, a drawing or a shared field under a zone, a turned page): then the page
 * becomes an image instead (the safe way).
 */
async function keepText(view: PDFDocumentProxy, docId: string, version: number, zones: Zone[]): Promise<Uint8Array | null> {
  const r = await api.moduleCall<{ data: string }>("kgb.pdf", "read", { id: docId, version });
  const doc = await PDFDocument.load(fromBase64(r.data));
  const byPage = new Map<number, Box[]>();
  for (const z of zones) {
    const vp = (await view.getPage(z.page)).getViewport({ scale: 1 });
    if (vp.rotation % 360 !== 0) return null;
    const [ax, ay] = vp.convertToPdfPoint(z.x, z.y) as [number, number];
    const [bx, by] = vp.convertToPdfPoint(z.x + z.w, z.y + z.h) as [number, number];
    const list = byPage.get(z.page) ?? [];
    list.push([Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by)]);
    byPage.set(z.page, list);
  }
  for (const [n, boxes] of byPage) {
    if (dropAnnotsIn(doc, n - 1, boxes) === null) return null;
    if (redactKeepText(doc, n - 1, boxes) === null) return null;
    const page = doc.getPage(n - 1);
    for (const b of boxes) page.drawRectangle({ x: b[0], y: b[1], width: b[2] - b[0], height: b[3] - b[1], color: rgb(0, 0, 0) });
  }
  dropUnreachable(doc);
  const out = await doc.save();
  // The check: no readable text left under a zone.
  const check = await openPdf(out.slice());
  for (const [n, boxes] of byPage) {
    const items = (await (await check.getPage(n)).getTextContent()).items;
    for (const it of items) {
      if (!("str" in it) || !it.str.trim()) continue;
      const [a, , c, d, e, f] = it.transform as number[];
      const h = Math.hypot(c ?? 0, d ?? 0) || 10;
      const per = (it.width || 0) / Math.max(1, it.str.length);
      const dir = Math.sign(a ?? 1) || 1;
      // Letter by letter (spaces left out): a letter whose middle is still under a zone means the safe way instead.
      for (let k = 0; k < it.str.length; k++) {
        if (!it.str[k]?.trim()) continue;
        const cx = (e ?? 0) + dir * per * (k + 0.5);
        const cy = (f ?? 0) + h * 0.3;
        if (boxes.some((z) => cx > z[0] && cx < z[2] && cy > z[1] && cy < z[3])) return null;
      }
    }
  }
  return out;
}

const WIDTH = 560;

interface Zone {
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export function RedactPanel(props: {
  view: PDFDocumentProxy;
  docId: string;
  version: number;
  busy: boolean;
  ask: (title: string, command: string, args: Record<string, unknown>) => Promise<void>;
}) {
  const pages = props.view.numPages;
  const [page, setPage] = useState(1);
  const [zones, setZones] = useState<Zone[]>([]);
  const [scale, setScale] = useState(1);
  const [drag, setDrag] = useState<{ x: number; y: number; x2: number; y2: number } | null>(null);
  const [kinds, setKinds] = useState<RedactKind[]>(["cnp"]);
  const [words, setWords] = useState("");
  const [found, setFound] = useState<string | null>(null);
  const [way, setWay] = useState<"text" | "image" | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let gone = false;
    void (async () => {
      const p = await props.view.getPage(page);
      if (gone || !canvas.current) return;
      setScale(WIDTH / p.getViewport({ scale: 1 }).width);
      await drawPage(props.view, page, canvas.current, WIDTH);
    })();
    return () => {
      gone = true;
    };
  }, [props.view, page]);

  const at = (e: React.MouseEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const here = zones.filter((z) => z.page === page);

  const search = async () => {
    const all: Zone[] = [];
    for (let n = 1; n <= pages; n++) {
      const p = await props.view.getPage(n);
      const items = (await p.getTextContent()).items.filter((it) => "str" in it);
      for (const b of findBoxes(items as never, viewportOf(p.getViewport({ scale: 1 })), kinds, words)) all.push({ page: n, x: b.x, y: b.y, w: b.w, h: b.h });
    }
    setZones([...zones, ...all]);
    setFound(all.length ? `Găsite: ${all.length} (pe ${new Set(all.map((z) => z.page)).size} pagini). Verifică-le pe pagini înainte de previzualizare.` : "Nu s-a găsit nimic.");
  };

  return (
    <div className="card pdf-redact">
      <p className="muted small">
        Trage cu mouse-ul dreptunghiuri peste ce vrei ascuns, sau caută. Literele de sub zone ies de tot din fișier (nu doar acoperite), iar restul paginii
        rămâne text; când asta nu e sigur (o imagine sau un desen sub zonă), pagina devine imagine cu negru peste zone. Comentariile și câmpurile de
        formular de peste zone se scot și ele.
      </p>
      <div className="row wrap">
        {REDACT_KINDS.map(([k, label]) => (
          <label key={k} className="small">
            <input type="checkbox" aria-label={`Caută ${label}`} checked={kinds.includes(k)} onChange={(e) => setKinds(e.target.checked ? [...kinds, k] : kinds.filter((x) => x !== k))} /> {label}
          </label>
        ))}
        <input
          aria-label="Cuvinte de ascuns"
          placeholder="și cuvintele (despărțite prin virgulă)"
          value={words}
          onChange={(e) => {
            setWords(e.target.value);
            const on = e.target.value.trim() !== "";
            setKinds(on ? [...kinds.filter((k) => k !== "words"), "words"] : kinds.filter((k) => k !== "words"));
          }}
        />
        <button disabled={!kinds.length} onClick={() => void search()}>
          Caută
        </button>
      </div>
      {found && <p className="small">{found}</p>}
      <div className="row">
        <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
          ‹
        </button>
        <span>
          pagina {page} din {pages} · {here.length} zone aici, {zones.length} în total
        </span>
        <button disabled={page >= pages} onClick={() => setPage(page + 1)}>
          ›
        </button>
        {zones.length > 0 && (
          <button className="link" onClick={() => setZones(zones.filter((z) => z.page !== page))}>
            șterge zonele de pe pagină
          </button>
        )}
      </div>
      <div
        className="redact-page"
        aria-label="Pagina pe care se trag zonele"
        style={{ position: "relative", display: "inline-block", cursor: "crosshair" }}
        onMouseDown={(e) => {
          const p = at(e);
          setDrag({ x: p.x, y: p.y, x2: p.x, y2: p.y });
        }}
        onMouseMove={(e) => drag && setDrag({ ...drag, ...((p) => ({ x2: p.x, y2: p.y }))(at(e)) })}
        onMouseUp={() => {
          if (drag) {
            const [x, y, w, h] = [Math.min(drag.x, drag.x2), Math.min(drag.y, drag.y2), Math.abs(drag.x2 - drag.x), Math.abs(drag.y2 - drag.y)];
            if (w > 4 && h > 4) setZones([...zones, { page, x: x / scale, y: y / scale, w: w / scale, h: h / scale }]);
          }
          setDrag(null);
        }}
      >
        <canvas ref={canvas} aria-label={`Pagina ${page}`} />
        {here.map((z, i) => (
          <div key={i} className="redact-zone" style={{ position: "absolute", left: z.x * scale, top: z.y * scale, width: z.w * scale, height: z.h * scale }} />
        ))}
        {drag && (
          <div
            className="redact-zone drawing"
            style={{ position: "absolute", left: Math.min(drag.x, drag.x2), top: Math.min(drag.y, drag.y2), width: Math.abs(drag.x2 - drag.x), height: Math.abs(drag.y2 - drag.y) }}
          />
        )}
      </div>
      <div className="row">
        <button
          className="primary"
          disabled={props.busy || zones.length === 0}
          onClick={() =>
            void (async () => {
              const zonePages = [...new Set(zones.map((z) => z.page))];
              let kept: Uint8Array | null = null;
              try {
                kept = await keepText(props.view, props.docId, props.version, zones);
              } catch {
                kept = null;
              }
              if (kept) {
                const same = Array.from({ length: pages }, (_, i) => i + 1).filter((p) => !zonePages.includes(p));
                setWay("text");
                await props.ask("Ascunde datele (restul paginii rămâne text)", "save_edit", {
                  id: props.docId,
                  based_on: props.version,
                  data: toB64(kept),
                  summary: `${zones.length === 1 ? "1 zonă ascunsă" : `${zones.length} zone ascunse`} pe ${zonePages.length === 1 ? "1 pagină" : `${zonePages.length} pagini`} (restul paginii rămâne text)`,
                  same_text_pages: same,
                });
              } else {
                setWay("image");
                await props.ask("Ascunde datele (pagina devine imagine)", "redact", { id: props.docId, based_on: props.version, zone: zones.map((z) => ({ page: z.page, x: z.x, y: z.y, w: z.w, h: z.h })) });
              }
            })()
          }
        >
          Previzualizează ascunderea ({zones.length} zone)
        </button>
      </div>
      {way === "image" && (
        <p className="muted small">
          Pe paginile acestea nu e sigur că doar literele de sub zone se pot scoate (o imagine, un desen sau un câmp sub zonă, ori o pagină rotită): pagina
          devine imagine, ca nimic să nu rămână.
        </p>
      )}
    </div>
  );
}

// Hiding data for good (Etapa 7, step 7.4l-1c): zones drawn on the page
// with the mouse, or found by „Caută” (CNP, e-mail, phone, IBAN, words —
// redactFind.ts from Cyber Office Studio, D-071). The pages with zones become
// images with black over them, in a new version, after a preview.
import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { drawPage } from "./pdfjs";
import { findBoxes, REDACT_KINDS, type RedactKind, viewportOf } from "./redactFind";

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
        Trage cu mouse-ul dreptunghiuri peste ce vrei ascuns, sau caută. Paginile cu zone devin imagini cu negru peste zone: textul lor iese de tot din fișier
        (nu doar acoperit), celelalte pagini rămân cum sunt. Comentariile și câmpurile de formular de peste zone se scot și ele.
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
          onClick={() => void props.ask("Ascunde datele", "redact", { id: props.docId, based_on: props.version, zone: zones.map((z) => ({ page: z.page, x: z.x, y: z.y, w: z.w, h: z.h })) })}
        >
          Previzualizează ascunderea ({zones.length} zone)
        </button>
      </div>
    </div>
  );
}

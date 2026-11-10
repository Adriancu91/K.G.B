// Pages on a sheet, booklet, poster, smaller file (Etapa 7, step 7.4l-1d):
// the tools of Cyber Office Studio (nup.ts, compress.ts, optimize.ts; D-071,
// D-072) run here on the current version; the result goes through the PDF
// module's checks (save_new / save_edit), then a preview, then a new document
// or version.
import { useState } from "react";
import { api } from "../../api";
import { fromBase64 } from "./pdfjs";
import { bookletPdf, nUpPdf, NUP_GRID, posterPdf } from "./nup";
import { compressPdf, LEVELS, sizeText } from "./compress";
import { OPTIMIZE_DEFAULT, optimizePdf } from "./optimize";
// 7.4l-1f (D-075): the searchable PDF of COS (ocrPdf.ts, textlayer.ts, ocr.ts, unchanged), with the language data in
// the app (tessdata/), nothing downloaded.
import { OCR_LANGS, ocrLang, setOcrLang, stopOcr } from "../../../cos/src/pdf/ocr";

const toB64 = (b: Uint8Array) => {
  let s = "";
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
};

export function ToolsPanel(props: {
  docId: string;
  version: number;
  name: string;
  pages: number;
  selected: number[];
  busy: boolean;
  ask: (title: string, command: string, args: Record<string, unknown>) => Promise<void>;
  onError: (e: string | null) => void;
}) {
  const [per, setPer] = useState(4);
  const [frame, setFrame] = useState(true);
  const [grid, setGrid] = useState({ cols: 2, rows: 2 });
  const [level, setLevel] = useState(1);
  const [opt, setOpt] = useState(OPTIMIZE_DEFAULT);
  const [working, setWorking] = useState<string | null>(null);
  const [lang, setLang] = useState(ocrLang());
  const [ocrStatus, setOcrStatus] = useState<string | null>(null);
  const base = props.name.replace(/\.pdf$/i, "");
  const all = Array.from({ length: props.pages }, (_, i) => i + 1);

  const run = async (what: string, f: (bytes: Uint8Array) => Promise<void>) => {
    setWorking(what);
    props.onError(null);
    try {
      const r = await api.moduleCall<{ data: string }>("kgb.pdf", "read", { id: props.docId, version: props.version });
      await f(fromBase64(r.data));
    } catch (e) {
      props.onError(e instanceof Error ? e.message : String(e));
    } finally {
      setWorking(null);
    }
  };
  const asNew = (title: string, name: string, summary: string, out: Uint8Array) =>
    props.ask(title, "save_new", { id: props.docId, version: props.version, data: toB64(out), name, summary });
  const asVersion = (title: string, summary: string, out: Uint8Array) =>
    props.ask(title, "save_edit", { id: props.docId, based_on: props.version, data: toB64(out), summary, same_text_pages: all });

  return (
    <div className="card pdf-tools">
      <h4>Mai multe pagini pe o foaie</h4>
      <div className="row wrap">
        <select aria-label="Pagini pe foaie" value={per} onChange={(e) => setPer(Number(e.target.value))}>
          {Object.keys(NUP_GRID).map((k) => (
            <option key={k} value={k}>
              {k} pe foaie
            </option>
          ))}
        </select>
        <label className="small">
          <input type="checkbox" aria-label="Chenar în jurul paginilor" checked={frame} onChange={(e) => setFrame(e.target.checked)} /> chenar
        </label>
        <button
          disabled={props.busy || !!working}
          onClick={() => void run("nup", async (b) => asNew(`${per} pagini pe foaie`, `${base} - ${per} pe foaie`, `${per} pagini pe foaie, din ${props.name}`, await nUpPdf(b, per, frame)))}
        >
          Previzualizează
        </button>
        <button
          disabled={props.busy || !!working}
          onClick={() => void run("broșură", async (b) => asNew("Broșură", `${base} - broșură`, `broșură (A4 îndoit în două), din ${props.name}`, await bookletPdf(b, frame)))}
        >
          Broșură
        </button>
      </div>

      <h4>Poster (o pagină mărită pe mai multe foi)</h4>
      <div className="row wrap">
        <span className="small">pagina {props.selected[0] ?? 1}</span>
        <label className="small">
          coloane <input aria-label="Coloanele posterului" type="number" min={1} max={8} value={grid.cols} onChange={(e) => setGrid({ ...grid, cols: Number(e.target.value) || 1 })} />
        </label>
        <label className="small">
          rânduri <input aria-label="Rândurile posterului" type="number" min={1} max={8} value={grid.rows} onChange={(e) => setGrid({ ...grid, rows: Number(e.target.value) || 1 })} />
        </label>
        <button
          disabled={props.busy || !!working}
          onClick={() =>
            void run("poster", async (b) => {
              const page = props.selected[0] ?? 1;
              await asNew(`Poster ${grid.cols} × ${grid.rows}`, `${base} - poster p${page}`, `poster din pagina ${page}, ${grid.cols} × ${grid.rows} foi A4`, await posterPdf(b, page - 1, grid.cols, grid.rows));
            })
          }
        >
          Previzualizează posterul
        </button>
      </div>

      <h4>Fișier mai mic</h4>
      <div className="row wrap">
        <select aria-label="Cât de tare se comprimă pozele" value={level} onChange={(e) => setLevel(Number(e.target.value))}>
          {LEVELS.map((l, i) => (
            <option key={l.label} value={i}>
              {l.label}
            </option>
          ))}
        </select>
        <button
          disabled={props.busy || !!working}
          onClick={() =>
            void run("comprimare", async (b) => {
              const lv = LEVELS[level] ?? LEVELS[1]!;
              const r = await compressPdf(b, lv);
              if (r.images === 0) throw new Error("Nu s-a găsit nicio poză care să se poată micșora: fișierul rămâne cum e.");
              await asVersion("Comprimarea pozelor", `${r.images === 1 ? "1 poză micșorată" : `${r.images} poze micșorate`}: ${sizeText(b.length)} → ${sizeText(r.data.length)}`, r.data);
            })
          }
        >
          Comprimă pozele
        </button>
      </div>
      <div className="row wrap">
        <label className="small">
          <input type="checkbox" aria-label="Scoate dublurile" checked={opt.duplicates} onChange={(e) => setOpt({ ...opt, duplicates: e.target.checked })} /> dublurile
        </label>
        <label className="small">
          <input type="checkbox" aria-label="Comprimă fluxurile" checked={opt.compress} onChange={(e) => setOpt({ ...opt, compress: e.target.checked })} /> fluxurile necomprimate
        </label>
        <label className="small">
          <input type="checkbox" aria-label="Scoate datele în plus" checked={opt.extras} onChange={(e) => setOpt({ ...opt, extras: e.target.checked })} /> datele în plus (miniaturi, informații de editare)
        </label>
        <button
          disabled={props.busy || !!working}
          onClick={() =>
            void run("optimizare", async (b) => {
              const r = await optimizePdf(b, opt);
              await asVersion("Optimizarea fișierului", `optimizat: ${sizeText(r.report.before)} → ${sizeText(r.report.after)}`, r.bytes);
            })
          }
        >
          Optimizează
        </button>
      </div>
      <h4>Text din scanări (OCR)</h4>
      <div className="row wrap">
        <select
          aria-label="Limba textului"
          value={lang}
          onChange={(e) => {
            setOcrLang(e.target.value);
            setLang(e.target.value);
          }}
        >
          {OCR_LANGS.map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
        <button
          disabled={props.busy || !!working}
          title="Paginile scanate (fără text) se citesc pe calculator, fără internet; textul recunoscut se pune invizibil peste poză, deci merg căutarea și copierea. Paginile care au deja text rămân neatinse."
          onClick={() =>
            void run("OCR", async (b) => {
              // The pages that already have text must stay exactly as they were: the module checks it.
              const texts = await api.moduleCall<string[]>("kgb.pdf", "text", { id: props.docId, version: props.version });
              const kept = texts.flatMap((t, i) => (t.replace(/s/g, "").length > 20 ? [i + 1] : []));
              try {
                const { ocrPdf } = await import("../../../cos/src/pdf/ocrPdf");
                const r = await ocrPdf(b, setOcrStatus);
                if (!r.words) {
                  props.onError(r.skipped ? "Toate paginile au deja text: nu e nimic de recunoscut." : "Nu s-a găsit niciun text în paginile scanate.");
                  return;
                }
                await props.ask("PDF căutabil", "save_edit", {
                  id: props.docId,
                  based_on: props.version,
                  data: toB64(r.bytes),
                  summary: `text recunoscut (OCR) pe ${r.pages} ${r.pages === 1 ? "pagină" : "pagini"}, ${r.words} cuvinte`,
                  same_text_pages: kept,
                });
              } finally {
                setOcrStatus(null);
                await stopOcr();
              }
            })
          }
        >
          Fă PDF-ul căutabil
        </button>
      </div>
      {ocrStatus && <p className="muted small" role="status">{ocrStatus}</p>}
      {working && <p className="muted small">Se lucrează ({working})…</p>}
      <p className="muted small">Uneltele din Cyber Office Studio. Paginile pe foaie, broșura și posterul fac un document nou; comprimarea și optimizarea, o versiune nouă.</p>
    </div>
  );
}

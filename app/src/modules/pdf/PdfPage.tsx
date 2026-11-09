// Interface of the kgb.pdf module (Etapa 3, step 3.5). Every change goes
// through the module: first a preview, then — only after "Aplică" — a new
// version or a new document. The imported original is never changed (D-034).
import { useCallback, useEffect, useRef, useState } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { api, message } from "../../api";
import { Confirm } from "../../components/Confirm";
import { drawPage, fromBase64, openPdf } from "./pdfjs";
import { RedactPanel } from "./Redact";
import { ToolsPanel } from "./Tools";
import { FormPanel } from "./Form";
import { StampsPanel } from "./Stamps";
import { extractStamps, pageSize, placeCentre, StampPage, stampMark, stampMarks, type Armed, type Mark } from "./StampEdit";

const ID = "kgb.pdf";
const THUMBS_AT_ONCE = 60;

interface Doc {
  id: string;
  name: string;
  current: number;
  updated_ms: number;
}

interface Version {
  number: number;
  note: string;
  size: number;
  created_ms: number;
}

interface Info {
  id: string;
  name: string;
  version: number;
  status: "intact" | "deteriorat" | "criptat";
  reason: string;
  pages: number | null;
  rotations: number[];
  versions: Version[];
}

interface Preview {
  title: string;
  command: string;
  args: Record<string, unknown>;
  summary: string;
  pages: number;
  doc: PDFDocumentProxy;
}

const toB64 = (b: Uint8Array) => {
  let s = "";
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
};
const pages = (n: number) => (n === 1 ? "1 pagină" : `${n} pagini`);
const when = (ms: number) => new Date(ms).toLocaleString("ro-RO");
const kb = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1048576).toFixed(1)} MB`);

function Thumb({ docId, version, page }: { docId: string; version: number; page: number }) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    setSrc(null);
    setFailed(false);
    api
      .moduleCall<{ png: string }>(ID, "thumb", { id: docId, version, page, width: 160 })
      .then((r) => live && setSrc(`data:image/png;base64,${r.png}`))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [docId, version, page]);
  if (failed) return <div className="thumb-empty">fără imagine</div>;
  return src ? <img src={src} alt={`Pagina ${page}`} /> : <div className="thumb-empty">…</div>;
}

function Canvas({ doc, page, width }: { doc: PDFDocumentProxy; page: number; width: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (ref.current) drawPage(doc, page, ref.current, width).catch((e) => setErr(message(e)));
  }, [doc, page, width]);
  return err ? <p className="error">Pagina nu se poate afișa: {err}</p> : <canvas ref={ref} aria-label={`Pagina ${page}`} />;
}

export function PdfPage({ onError }: { onError: (e: string | null) => void }) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [version, setVersion] = useState<number | null>(null);
  const [info, setInfo] = useState<Info | null>(null);
  const [view, setView] = useState<PDFDocumentProxy | null>(null);
  const [viewError, setViewError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [big, setBig] = useState<number | null>(null);
  const [checked, setChecked] = useState<string[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [toDelete, setToDelete] = useState<Doc | null>(null);
  const [busy, setBusy] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // Text over the pages (7.4l-1a).
  const [stamp, setStamp] = useState<{ open: boolean; filigran: string; antet: string; subsol: string }>({ open: false, filigran: "", antet: "", subsol: "" });
  // Stamps as in Cyber Office Studio (7.4l-1b2).
  const [stampsOpen, setStampsOpen] = useState(false);
  // Hiding data for good (7.4l-1c).
  const [redactOpen, setRedactOpen] = useState(false);
  // Pages on a sheet, booklet, poster, smaller file (7.4l-1d).
  const [toolsOpen, setToolsOpen] = useState(false);
  // PDF forms (7.4l-1e).
  const [formOpen, setFormOpen] = useState(false);
  // Editable stamps (7.4l-0a): the version without them (what the page shows), the stamps as marks, what was saved.
  const [base, setBase] = useState<Uint8Array | null>(null);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [savedMarks, setSavedMarks] = useState("[]");
  const [armed, setArmed] = useState<Armed | null>(null);
  const [selMark, setSelMark] = useState<number | null>(null);
  const [editMark, setEditMark] = useState<number | null>(null);
  const markId = useRef(1);

  const refresh = useCallback(async () => {
    try {
      setDocs(await api.moduleCall<Doc[]>(ID, "list"));
    } catch (e) {
      onError(message(e));
    }
  }, [onError]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const load = useCallback(
    async (id: string, v: number | null) => {
      try {
        const i = { ...(await api.moduleCall<Omit<Info, "id">>(ID, "info", { id, version: v })), id };
        setInfo(i);
        setVersion(i.version);
        setSelected([]);
        setBig(null);
        setShowAll(false);
        setViewError(null);
        setView(null);
        setBase(null);
        setMarks([]);
        setSavedMarks("[]");
        setArmed(null);
        setSelMark(null);
        setEditMark(null);
        const r = await api.moduleCall<{ data: string }>(ID, "read", { id, version: i.version });
        try {
          let bytes = fromBase64(r.data);
          let found: Mark[] = [];
          // Stamps put earlier come back as editable stamps; the page is shown without them (they sit on top).
          const ex = i.status === "intact" ? await extractStamps(bytes).catch(() => null) : null;
          if (ex) {
            bytes = ex.bytes;
            found = ex.marks.map((m, k) => ({ ...m, id: k + 1 }));
          }
          markId.current = found.length + 1;
          setMarks(found);
          setSavedMarks(JSON.stringify(found));
          setBase(i.status === "intact" ? bytes : null);
          // pdf.js takes over the bytes it is given: it gets a copy.
          setView(await openPdf(bytes.slice()));
        } catch (e) {
          setViewError(message(e));
        }
        onError(null);
      } catch (e) {
        onError(message(e));
      }
    },
    [onError],
  );

  useEffect(() => {
    if (current) void load(current, null);
  }, [current, load]);

  const run = async (f: () => Promise<void>) => {
    setBusy(true);
    try {
      await f();
      onError(null);
    } catch (e) {
      onError(message(e));
    } finally {
      setBusy(false);
    }
  };

  const onImport = () =>
    run(async () => {
      const picked = await open({ multiple: true, filters: [{ name: "PDF", extensions: ["pdf"] }] });
      if (!picked) return;
      const paths = Array.isArray(picked) ? picked : [picked];
      const notes: string[] = [];
      let last: string | null = null;
      for (const path of paths) {
        const r = await api.importFile<{ document: Doc; status: string; reason: string }>(ID, path);
        last = r.document.id;
        if (r.status !== "intact") notes.push(`${r.document.name}: ${r.reason}`);
      }
      setNotice(notes.length ? `Importat doar pentru citire — ${notes.join("; ")}` : `${paths.length} fișier(e) importat(e).`);
      await refresh();
      if (last) setCurrent(last);
    });

  const isCurrent = info !== null && current !== null && version === docs.find((d) => d.id === current)?.current;
  const editable = info?.status === "intact" && isCurrent;

  const ask = (title: string, command: string, args: Record<string, unknown>) =>
    run(async () => {
      const r = await api.moduleCall<{ preview: string; summary: string; pages: number }>(ID, command, { ...args, apply: false });
      setPreview({ title, command, args, summary: r.summary, pages: r.pages, doc: await openPdf(fromBase64(r.preview)) });
    });

  const apply = () =>
    run(async () => {
      if (!preview) return;
      const r = await api.moduleCall<{ version?: number; document?: Doc; summary: string }>(ID, preview.command, {
        ...preview.args,
        apply: true,
      });
      setPreview(null);
      setNotice(r.document ? `Document nou: ${r.document.name} (${r.summary}).` : `Salvat ca versiunea ${r.version} (${r.summary}).`);
      await refresh();
      if (r.document) setCurrent(r.document.id);
      else if (current) await load(current, null);
    });

  const onExport = () =>
    run(async () => {
      if (!current || !info || version === null) return;
      const base = info.name.replace(/\.pdf$/i, "");
      const dest = await save({
        defaultPath: version === docs.find((d) => d.id === current)?.current ? `${base}.pdf` : `${base} (v${version}).pdf`,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });
      if (!dest) return;
      // The system dialog itself asks before replacing an existing file.
      await api.moduleCall(ID, "export", { id: current, version, dest, overwrite: true });
      setNotice(`Copie salvată: ${dest}`);
    });

  const marksDirty = JSON.stringify(marks) !== savedMarks;
  const saveStamps = async () => {
    if (!base || !current || version === null) return;
    try {
      const out = await stampMarks(base, marks);
      const n = marks.length;
      await ask("Ștampilele de pe pagini", "save_edit", {
        id: current,
        based_on: version,
        data: toB64(out),
        summary: n ? `${n === 1 ? "1 ștampilă" : `${n} ștampile`} pe pagini` : "ștampilele scoase",
        same_text_pages: Array.from({ length: view?.numPages ?? 0 }, (_, i) => i + 1),
      });
    } catch (e) {
      onError(message(e));
    }
  };
  const placeAll = (a: Armed, place: string) =>
    void run(async () => {
      if (!view) return;
      const targets = selected.length ? selected : Array.from({ length: view.numPages }, (_, i) => i + 1);
      const added: Mark[] = [];
      for (const p of targets) {
        const s = await pageSize(view, p);
        const [x, y] = placeCentre(place, s, stampMark(a, 0, p, 0, 0, s));
        added.push(stampMark(a, markId.current++, p, x, y, s));
      }
      setMarks((all) => [...all, ...added]);
      setBig(targets[0] ?? 1);
      setNotice(`${added.length === 1 ? "1 ștampilă pusă" : `${added.length} ștampile puse`}: le poți muta sau schimba, apoi „Salvează ștampilele”.`);
    });

  // Keys as in COS: Esc stops placing, Delete removes the chosen stamp, Ctrl+S saves the stamps.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target;
      const typing = t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement;
      if (e.key === "Escape" && armed) setArmed(null);
      else if (!typing && selMark !== null && editMark === null && (e.key === "Delete" || e.key === "Backspace")) {
        e.preventDefault();
        setMarks((all) => all.filter((m) => m.id !== selMark));
        setSelMark(null);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s" && marksDirty && !busy) {
        e.preventDefault();
        void saveStamps();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const toggle = (p: number) => setSelected((s) => (s.includes(p) ? s.filter((x) => x !== p) : [...s, p].sort((a, b) => a - b)));
  const pageCount = view?.numPages ?? info?.pages ?? 0;
  const shown = showAll ? pageCount : Math.min(pageCount, THUMBS_AT_ONCE);
  const doc = docs.find((d) => d.id === current);

  return (
    <section className="pdf">
      <p className="muted">
        Modul beta. Originalul importat nu se modifică niciodată: fiecare schimbare devine o versiune nouă, după
        previzualizare. PDF-urile deteriorate sau criptate se deschid doar pentru citire.
      </p>
      <div className="row wrap">
        <button className="primary" onClick={() => void onImport()} disabled={busy}>
          Importă PDF…
        </button>
        <button
          disabled={busy || checked.length < 2}
          onClick={() => void ask(`Unește ${checked.length} documente`, "merge", { ids: checked, name: "Documente unite" })}
          title="Bifează cel puțin două documente din listă"
        >
          Unește documentele bifate ({checked.length})
        </button>
        {notice && <span className="muted grow">{notice}</span>}
      </div>

      <div className="pdf-layout">
        <ul className="list pdf-docs" aria-label="Documente PDF">
          {docs.length === 0 && <li className="muted">Niciun document. Importă un PDF.</li>}
          {docs.map((d) => (
            <li key={d.id} className={d.id === current ? "active" : ""}>
              <input
                type="checkbox"
                aria-label={`Bifează ${d.name} pentru unire`}
                checked={checked.includes(d.id)}
                onChange={() => setChecked((c) => (c.includes(d.id) ? c.filter((x) => x !== d.id) : [...c, d.id]))}
              />
              <button className="link grow" onClick={() => setCurrent(d.id)}>
                {d.name}
              </button>
              <span className="muted">v{d.current}</span>
            </li>
          ))}
        </ul>

        {doc && info && info.id === doc.id && (
          <div className="pdf-doc grow">
            <header className="row wrap">
              <h2 className="grow">{info.name}</h2>
              <span className={`badge ${info.status === "intact" ? "stable" : "disabled"}`}>{info.status}</span>
              <label>
                Versiunea{" "}
                <select value={version ?? ""} onChange={(e) => void load(doc.id, Number(e.target.value))}>
                  {[...info.versions].reverse().map((v) => (
                    <option key={v.number} value={v.number}>
                      {v.number} — {v.note} ({when(v.created_ms)}, {kb(v.size)})
                    </option>
                  ))}
                </select>
              </label>
              {!isCurrent && version !== null && (
                <button
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      const r = await api.moduleCall<{ number: number }>(ID, "restore", { id: doc.id, version });
                      setNotice(`Versiunea ${version} a devenit versiunea ${r.number}.`);
                      await refresh();
                      await load(doc.id, null);
                    })
                  }
                >
                  Restaurează această versiune
                </button>
              )}
              <button disabled={busy} onClick={() => void onExport()}>
                Exportă o copie…
              </button>
              <button className="danger-text" disabled={busy} onClick={() => setToDelete(doc)}>
                Șterge
              </button>
            </header>
            {info.reason && <p className="warn">{info.reason}</p>}
            {!isCurrent && <p className="muted">Vezi o versiune mai veche: modificările se fac doar pe versiunea curentă.</p>}
            {viewError && <p className="error">Afișarea nu a reușit: {viewError}</p>}

            <div className="row wrap">
              <span className="muted">
                {pages(pageCount)} · {selected.length} selectate
              </span>
              <button disabled={!editable || busy || !selected.length} onClick={() => void ask("Rotire la dreapta", "rotate", { id: doc.id, based_on: version, pages: selected, angle: 90 })}>
                Rotește ↻
              </button>
              <button disabled={!editable || busy || !selected.length} onClick={() => void ask("Rotire la stânga", "rotate", { id: doc.id, based_on: version, pages: selected, angle: 270 })}>
                Rotește ↺
              </button>
              <button
                disabled={!editable || busy || !selected.length || selected.length === pageCount}
                onClick={() => void ask("Scoate paginile selectate", "delete_pages", { id: doc.id, based_on: version, pages: selected })}
              >
                Scoate paginile
              </button>
              <button
                disabled={info.status !== "intact" || busy || !selected.length}
                onClick={() =>
                  void ask("Extrage într-un document nou", "extract", {
                    id: doc.id,
                    version,
                    pages: selected,
                    name: `${info.name.replace(/\.pdf$/i, "")} - extras`,
                  })
                }
              >
                Extrage în document nou
              </button>
              <button disabled={!editable || busy} onClick={() => setStamp({ ...stamp, open: !stamp.open })}>
                Filigran, antet, subsol…
              </button>
              <button disabled={!editable || busy} onClick={() => setStampsOpen(!stampsOpen)}>
                Ștampilă…
              </button>
              <button disabled={!editable || busy || !view} onClick={() => setRedactOpen(!redactOpen)}>
                Ascunde date…
              </button>
              <button disabled={info.status !== "intact" || busy} onClick={() => setToolsOpen(!toolsOpen)}>
                Pagini pe foaie, mărime…
              </button>
              <button disabled={!editable || busy} onClick={() => setFormOpen(!formOpen)}>
                Formular…
              </button>
              {selected.length > 0 && (
                <button className="link" onClick={() => setSelected([])}>
                  Deselectează
                </button>
              )}
            </div>
            {formOpen && editable && (
              <FormPanel key={`${doc.id}-${version}`} docId={doc.id} version={version} name={info.name} pages={pageCount} busy={busy} ask={ask} onError={onError} onNotice={setNotice} />
            )}
            {toolsOpen && info.status === "intact" && (
              <ToolsPanel docId={doc.id} version={version ?? info.version} name={info.name} pages={pageCount} selected={selected} busy={busy} ask={ask} onError={onError} />
            )}
            {redactOpen && editable && view && <RedactPanel key={`${doc.id}-${version}`} view={view} docId={doc.id} version={version} busy={busy} ask={ask} />}
            {stampsOpen && editable && (
              <StampsPanel
                selected={selected}
                busy={busy || !base}
                onArm={(a) => {
                  setArmed(a);
                  if (big === null) setBig(selected[0] ?? 1);
                }}
                onPlaceAll={placeAll}
                onError={onError}
              />
            )}
            {editable && (marksDirty || armed) && (
              <div className="row wrap pdf-stamp-bar">
                {armed && <span className="warn">Fă clic pe pagină unde pui ștampila „{armed.text}” (Esc = renunți).</span>}
                {marksDirty && <span className="muted">Ștampilele s-au schimbat și nu sunt salvate.</span>}
                {marksDirty && (
                  <button className="primary" disabled={busy} onClick={() => void saveStamps()}>
                    Salvează ștampilele
                  </button>
                )}
                {marksDirty && (
                  <button
                    className="link"
                    onClick={() => {
                      setMarks(JSON.parse(savedMarks) as Mark[]);
                      setSelMark(null);
                      setEditMark(null);
                    }}
                  >
                    Renunță la schimbări
                  </button>
                )}
              </div>
            )}
            {stamp.open && editable && (
              <div className="card pdf-stamp">
                <label>
                  Filigran (pe diagonală, semitransparent)
                  <input aria-label="Filigranul" maxLength={120} placeholder="de ex. COPIE sau CONFIDENȚIAL" value={stamp.filigran} onChange={(e) => setStamp({ ...stamp, filigran: e.target.value })} />
                </label>
                <label>
                  Antet (sus, centrat)
                  <input aria-label="Antetul" maxLength={120} value={stamp.antet} onChange={(e) => setStamp({ ...stamp, antet: e.target.value })} />
                </label>
                <label>
                  Subsol (jos, centrat; {"{n}"} = numărul paginii, {"{total}"} = câte pagini sunt)
                  <input aria-label="Subsolul" maxLength={120} value={stamp.subsol} onChange={(e) => setStamp({ ...stamp, subsol: e.target.value })} />
                </label>
                <div className="row wrap">
                  <button className="link" onClick={() => setStamp({ ...stamp, subsol: "Pagina {n} din {total}" })}>
                    numerotează paginile
                  </button>
                  <button
                    className="primary"
                    disabled={busy || !(stamp.filigran.trim() || stamp.antet.trim() || stamp.subsol.trim())}
                    onClick={() =>
                      void ask(selected.length ? "Text pe paginile selectate" : "Text pe toate paginile", "stamp", {
                        id: doc.id,
                        based_on: version,
                        pages: selected,
                        filigran: stamp.filigran,
                        antet: stamp.antet,
                        subsol: stamp.subsol,
                      })
                    }
                  >
                    {selected.length ? `Previzualizează pe ${pages(selected.length)}` : "Previzualizează pe toate paginile"}
                  </button>
                </div>
                <p className="muted small">Textul paginilor rămâne neschimbat; rezultatul e o versiune nouă, originalul se păstrează.</p>
              </div>
            )}

            {big !== null && view && (
              <div className="pdf-big">
                <button className="link" onClick={() => setBig(null)}>
                  ← Înapoi la pagini
                </button>
                {editable && base ? (
                  <StampPage
                    doc={view}
                    page={big}
                    marks={marks}
                    armed={armed !== null}
                    selected={selMark}
                    editing={editMark}
                    onPlace={(x, y, s) => {
                      if (!armed) return;
                      const m = stampMark(armed, markId.current++, big, x, y, s);
                      setMarks((all) => [...all, m]);
                      setSelMark(m.id);
                      setArmed(null);
                    }}
                    onChange={(m) => setMarks((all) => all.map((x) => (x.id === m.id ? m : x)))}
                    onRemove={(id) => {
                      setMarks((all) => all.filter((x) => x.id !== id));
                      setSelMark(null);
                    }}
                    onSelect={setSelMark}
                    onEdit={setEditMark}
                  />
                ) : (
                  <Canvas doc={view} page={big} width={720} />
                )}
              </div>
            )}
            {big === null && version !== null && (
              <ol className="pdf-pages" aria-label="Pagini">
                {Array.from({ length: shown }, (_, i) => i + 1).map((p) => (
                  <li key={`${doc.id}-${version}-${p}`} className={selected.includes(p) ? "selected" : ""}>
                    <button className="thumb" onClick={() => setBig(p)} title="Deschide pagina">
                      <Thumb docId={doc.id} version={version} page={p} />
                    </button>
                    <label>
                      <input type="checkbox" checked={selected.includes(p)} onChange={() => toggle(p)} /> {p}
                      {info.rotations[p - 1] ? ` · ${info.rotations[p - 1]}°` : ""}
                    </label>
                  </li>
                ))}
              </ol>
            )}
            {big === null && shown < pageCount && (
              <button className="link" onClick={() => setShowAll(true)}>
                Arată toate cele {pageCount} pagini
              </button>
            )}
          </div>
        )}
      </div>

      {preview && (
        <div className="overlay" role="presentation" onClick={() => setPreview(null)}>
          <div className="dialog wide" role="dialog" aria-modal="true" aria-labelledby="pv-title" onClick={(e) => e.stopPropagation()}>
            <h2 id="pv-title">Previzualizare: {preview.title}</h2>
            <p>
              {preview.summary}.{" "}
              {preview.command === "save_new"
                ? `Documentul nou are ${pages(preview.pages)} și a fost verificat (se redeschide întreg); originalul rămâne cum e.`
                : "Rezultatul a fost verificat (se redeschide, paginile și textul lor s-au păstrat)."}
              {preview.command === "merge" && " Semnele de carte și formularele din documentele unite nu se preiau."}
            </p>
            <div className="pdf-preview">
              {Array.from({ length: Math.min(preview.pages, 12) }, (_, i) => (
                <Canvas key={i} doc={preview.doc} page={i + 1} width={120} />
              ))}
              {preview.pages > 12 && <span className="muted">… și încă {preview.pages - 12} pagini</span>}
            </div>
            <div className="dialog-actions">
              <button onClick={() => setPreview(null)}>Renunță</button>
              <button className="primary" disabled={busy} onClick={() => void apply()}>
                {preview.command === "extract" || preview.command === "merge" || preview.command === "save_new" ? "Creează documentul" : "Salvează ca versiune nouă"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toDelete && (
        <Confirm
          title="Ștergi documentul?"
          confirmLabel="Șterge"
          danger
          onCancel={() => setToDelete(null)}
          onConfirm={() =>
            void run(async () => {
              await api.moduleCall(ID, "delete", { id: toDelete.id });
              setToDelete(null);
              setCurrent(null);
              setInfo(null);
              setChecked((c) => c.filter((x) => x !== toDelete.id));
              await refresh();
            })
          }
        >
          „{toDelete.name}” și toate cele {toDelete.current} versiuni dispar din listă. Conținutul rămâne pe disc până la
          colectarea fișierelor din „Date și backup” (și în backupurile făcute până acum).
        </Confirm>
      )}
    </section>
  );
}

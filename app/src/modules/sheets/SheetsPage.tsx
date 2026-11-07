// Interface of the kgb.sheets module (Etapa 3, step 3.6). The grid loads only
// the rows on screen (100k-row sheets scroll smoothly). Edits are collected
// locally; "Previzualizează salvarea" asks the module what would change and
// what would be lost, and only "Salvează ca versiune nouă" writes — a new
// version; the imported original never changes (D-034).
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { api, message } from "../../api";
import { Confirm } from "../../components/Confirm";

const ID = "kgb.sheets";
const ROW_H = 26;
const BLOCK = 200;
const MAX_COLS = 100;

interface Doc {
  id: string;
  name: string;
  current: number;
}
interface SheetInfo {
  name: string;
  rows: number;
  cols: number;
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
  format: string;
  editable: boolean;
  reason: string;
  version: number;
  versions: Version[];
  sheets: SheetInfo[];
}
interface Cell {
  v: string;
  k: string;
  f: string | null;
}
interface Preview {
  summary: string;
  lost: string[];
  uncertain: string[];
}

const when = (ms: number) => new Date(ms).toLocaleString("ro-RO");
const kb = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1048576).toFixed(1)} MB`);
const colName = (c: number) => {
  let s = "";
  for (let n = c; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};

export function SheetsPage({ onError }: { onError: (e: string | null) => void }) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [current, setCurrent] = useState<string | null>(null);
  const [info, setInfo] = useState<Info | null>(null);
  const [sheet, setSheet] = useState<string>("");
  const [blocks, setBlocks] = useState<Record<number, (Cell | null)[][]>>({});
  const [scroll, setScroll] = useState(0);
  const [sel, setSel] = useState<{ r: number; c: number } | null>(null);
  const [input, setInput] = useState("");
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<Preview | null>(null);
  const [accept, setAccept] = useState(false);
  const [toDelete, setToDelete] = useState<Doc | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const loading = useRef(new Set<number>());

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
    async (id: string, version: number | null, keepSheet?: string) => {
      try {
        const i = { ...(await api.moduleCall<Omit<Info, "id">>(ID, "info", { id, version })), id };
        setInfo(i);
        setSheet(keepSheet && i.sheets.some((s) => s.name === keepSheet) ? keepSheet : (i.sheets[0]?.name ?? ""));
        setBlocks({});
        loading.current.clear();
        setSel(null);
        setEdits({});
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
  useEffect(() => {
    setBlocks({});
    loading.current.clear();
    setSel(null);
    setScroll(0);
  }, [sheet]);

  const sh = info?.sheets.find((s) => s.name === sheet);
  // Data size, plus empty rows and columns after it so new cells can be filled.
  const dataRows = sh?.rows ?? 0;
  const rows = dataRows + 20;
  const cols = Math.min(Math.max((sh?.cols ?? 0) + 5, 8), MAX_COLS);
  const isCurrent = info !== null && info.version === docs.find((d) => d.id === info.id)?.current;
  const editable = !!info?.editable && isCurrent;

  // Load the blocks of rows that are on screen.
  const first = Math.floor(scroll / ROW_H);
  const visible = 40;
  useEffect(() => {
    if (!info || !sh) return;
    for (const b of new Set([Math.floor(first / BLOCK), Math.floor((first + visible) / BLOCK)])) {
      if (blocks[b] || loading.current.has(b) || b * BLOCK >= dataRows) continue;
      loading.current.add(b);
      api
        .moduleCall<{ rows: (Cell | null)[][] }>(ID, "cells", { id: info.id, version: info.version, sheet: sh.name, row0: b * BLOCK, rows: BLOCK, col0: 0, cols })
        .then((w) => setBlocks((old) => ({ ...old, [b]: w.rows })))
        .catch((e) => onError(message(e)))
        .finally(() => loading.current.delete(b));
    }
  }, [first, info, sh, dataRows, cols, blocks, onError]);

  const cellAt = (r: number, c: number): Cell | null => blocks[Math.floor(r / BLOCK)]?.[r % BLOCK]?.[c] ?? null;
  const key = (r: number, c: number) => `${sheet}!${colName(c + 1)}${r + 1}`;

  const select = (r: number, c: number) => {
    setSel({ r, c });
    const k = key(r, c);
    const cell = cellAt(r, c);
    setInput(edits[k] ?? cell?.f ?? cell?.v ?? "");
  };

  const commit = () => {
    if (!sel || !editable) return;
    const k = key(sel.r, sel.c);
    const cell = cellAt(sel.r, sel.c);
    const original = cell?.f ?? cell?.v ?? "";
    setEdits((e) => {
      const n = { ...e };
      if (input === original) delete n[k];
      else n[k] = input;
      return n;
    });
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      commit();
      if (sel && sel.r + 1 < rows) select(sel.r + 1, sel.c);
    } else if (e.key === "Escape" && sel) select(sel.r, sel.c);
  };

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

  const editList = () =>
    Object.entries(edits).map(([k, v]) => {
      const i = k.lastIndexOf("!");
      return { sheet: k.slice(0, i), cell: k.slice(i + 1), input: v };
    });

  const onImport = () =>
    run(async () => {
      const picked = await open({
        multiple: true,
        filters: [{ name: "Foi de calcul", extensions: ["xlsx", "xlsm", "xls", "xlsb", "ods", "csv"] }],
      });
      if (!picked) return;
      let last: string | null = null;
      for (const path of Array.isArray(picked) ? picked : [picked]) {
        last = (await api.importFile<{ document: Doc }>(ID, path)).document.id;
      }
      await refresh();
      if (last) setCurrent(last);
    });

  const onPreview = () =>
    run(async () => {
      if (!info) return;
      setAccept(false);
      setPreview(await api.moduleCall<Preview>(ID, "save", { id: info.id, based_on: info.version, edits: editList() }));
    });

  const onSave = () =>
    run(async () => {
      if (!info || !preview) return;
      const r = await api.moduleCall<{ version: number; summary: string }>(ID, "save", {
        id: info.id,
        based_on: info.version,
        edits: editList(),
        apply: true,
        accept_losses: accept,
      });
      setPreview(null);
      setNotice(`Salvat ca versiunea ${r.version} (${r.summary}).`);
      await refresh();
      await load(info.id, null, sheet);
    });

  const onExport = () =>
    run(async () => {
      if (!info) return;
      const ext = info.name.split(".").pop() ?? "xlsx";
      const base = info.name.slice(0, -(ext.length + 1));
      const dest = await save({
        defaultPath: isCurrent ? info.name : `${base} (v${info.version}).${ext}`,
        filters: [{ name: ext.toUpperCase(), extensions: [ext] }],
      });
      if (!dest) return;
      // The system dialog itself asks before replacing an existing file.
      await api.moduleCall(ID, "export", { id: info.id, version: info.version, dest, overwrite: true });
      setNotice(`Copie salvată: ${dest}`);
    });

  const pending = Object.keys(edits).length;
  const doc = docs.find((d) => d.id === current);
  const selCell = sel ? cellAt(sel.r, sel.c) : null;
  const shown = Array.from({ length: Math.min(visible + 2, Math.max(0, rows - first)) }, (_, i) => first + i);

  return (
    <section className="sheets">
      <p className="muted">
        Modul beta. Deschide .xlsx, .xlsm, .xls, .xlsb, .ods și .csv; modifică doar .xlsx. Fiecare salvare devine o
        versiune nouă, după o previzualizare care arată ce s-ar pierde. Formulele se scriu cu nume englezești și virgulă
        între argumente (ex. =SUM(B2:B6)).
      </p>
      <div className="row wrap">
        <button className="primary" onClick={() => void onImport()} disabled={busy}>
          Importă foi de calcul…
        </button>
        {notice && <span className="muted grow">{notice}</span>}
      </div>

      <div className="pdf-layout">
        <ul className="list pdf-docs" aria-label="Foi de calcul">
          {docs.length === 0 && <li className="muted">Nimic importat încă.</li>}
          {docs.map((d) => (
            <li key={d.id} className={d.id === current ? "active" : ""}>
              <button
                className="link grow"
                onClick={() => {
                  if (pending && !window.confirm("Ai modificări nesalvate. Renunți la ele?")) return;
                  setCurrent(d.id);
                }}
              >
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
              <label>
                Versiunea{" "}
                <select value={info.version} disabled={pending > 0} onChange={(e) => void load(doc.id, Number(e.target.value), sheet)}>
                  {[...info.versions].reverse().map((v) => (
                    <option key={v.number} value={v.number}>
                      {v.number} — {v.note} ({when(v.created_ms)}, {kb(v.size)})
                    </option>
                  ))}
                </select>
              </label>
              {!isCurrent && (
                <button
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      const r = await api.moduleCall<{ number: number }>(ID, "restore", { id: doc.id, version: info.version });
                      setNotice(`Versiunea ${info.version} a devenit versiunea ${r.number}.`);
                      await refresh();
                      await load(doc.id, null, sheet);
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

            <div className="sheet-tabs" role="tablist">
              {info.sheets.map((s) => (
                <button key={s.name} role="tab" aria-selected={s.name === sheet} className={s.name === sheet ? "active" : ""} onClick={() => setSheet(s.name)}>
                  {s.name}
                </button>
              ))}
            </div>

            <div className="formula-bar row">
              <code className="cell-ref">{sel ? `${colName(sel.c + 1)}${sel.r + 1}` : "—"}</code>
              <input
                aria-label="Conținutul celulei"
                value={input}
                readOnly={!editable || !sel}
                placeholder={editable ? "Alege o celulă; Enter salvează în lista de modificări" : "Doar citire"}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKey}
                onBlur={commit}
              />
              {selCell?.f && !(sel && key(sel.r, sel.c) in edits) && <span className="muted">= {selCell.v}</span>}
            </div>

            <div className="row wrap">
              <span className="muted">
                {dataRows.toLocaleString("ro-RO")} rânduri × {sh?.cols ?? 0} coloane
                {(sh?.cols ?? 0) > MAX_COLS && ` (se afișează primele ${MAX_COLS})`}
              </span>
              <button className="primary" disabled={!pending || busy} onClick={() => void onPreview()}>
                Previzualizează salvarea ({pending})
              </button>
              {pending > 0 && (
                <button className="link" onClick={() => setEdits({})}>
                  Renunță la modificări
                </button>
              )}
            </div>

            <div className="grid" onScroll={(e) => setScroll(e.currentTarget.scrollTop)} aria-label="Tabel">
              <div style={{ height: (rows + 1) * ROW_H, position: "relative", width: 68 + cols * 110 }}>
                <div className="grid-row grid-head" style={{ top: scroll }}>
                  <span className="rh" />
                  {Array.from({ length: cols }, (_, c) => (
                    <span key={c}>{colName(c + 1)}</span>
                  ))}
                </div>
                {shown.map((r) => (
                  <div key={r} className="grid-row" style={{ top: (r + 1) * ROW_H }}>
                    <span className="rh">{r + 1}</span>
                    {Array.from({ length: cols }, (_, c) => {
                      const k = key(r, c);
                      const cell = cellAt(r, c);
                      const edited = k in edits;
                      const isSel = sel?.r === r && sel?.c === c;
                      return (
                        <span
                          key={c}
                          className={`k-${cell?.k ?? "s"}${edited ? " edited" : ""}${isSel ? " sel" : ""}${cell?.f ? " formula" : ""}`}
                          title={cell?.f ?? undefined}
                          onClick={() => {
                            commit();
                            select(r, c);
                          }}
                        >
                          {edited ? edits[k] : (cell?.v ?? "")}
                        </span>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {preview && (
        <div className="overlay" role="presentation" onClick={() => setPreview(null)}>
          <div className="dialog wide" role="dialog" aria-modal="true" aria-labelledby="sv-title" onClick={(e) => e.stopPropagation()}>
            <h2 id="sv-title">Previzualizare: salvare ca versiune nouă</h2>
            <p>
              {preview.summary}. Rezultatul a fost verificat: celulele nemodificate și formulele au rămas la fel. Originalul
              rămâne neatins.
            </p>
            {preview.lost.length > 0 && (
              <p className="warn">Salvarea ar pierde: {preview.lost.join(", ")}. (Biblioteca de salvare nu le poate păstra.)</p>
            )}
            {preview.uncertain.length > 0 && (
              <p className="warn">
                {preview.uncertain.length} formule afectate nu pot fi recalculate sigur aici și își păstrează valoarea veche
                până le recalculează programul de calcul: {preview.uncertain.slice(0, 8).join(", ")}
                {preview.uncertain.length > 8 ? "…" : ""}
              </p>
            )}
            {(preview.lost.length > 0 || preview.uncertain.length > 0) && (
              <label className="check">
                <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} /> Am înțeles și salvez
                totuși (versiunile vechi rămân disponibile)
              </label>
            )}
            <div className="dialog-actions">
              <button onClick={() => setPreview(null)}>Renunță</button>
              <button
                className="primary"
                disabled={busy || ((preview.lost.length > 0 || preview.uncertain.length > 0) && !accept)}
                onClick={() => void onSave()}
              >
                Salvează ca versiune nouă
              </button>
            </div>
          </div>
        </div>
      )}

      {toDelete && (
        <Confirm
          title="Ștergi foaia de calcul?"
          confirmLabel="Șterge"
          danger
          onCancel={() => setToDelete(null)}
          onConfirm={() =>
            void run(async () => {
              await api.moduleCall(ID, "delete", { id: toDelete.id });
              setToDelete(null);
              setCurrent(null);
              setInfo(null);
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

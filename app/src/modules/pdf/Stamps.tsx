// Stamps as in Cyber Office Studio (Etapa 7, step 7.4l-1b2; D-071): the ready
// stamps PLĂTIT … CONFIDENȚIAL or a text of your own, the line under them
// (date, on request the time and a name — fixed when the stamp is put),
// four colours, opacity, where on the page; and „Ștampilele mele” made from a
// photo (StampDialog, paper removed by stampBg). The stamp becomes a real
// /Stamp annotation in a new version, after a preview.
import { useCallback, useEffect, useState } from "react";
import { api, message } from "../../api";
import { StampDialog } from "./StampDialog";

const ID = "kgb.pdf";
/** Din Cyber Office Studio (sign.ts): ștampilele gata făcute și culorile lor. */
export const STAMPS = ["PLĂTIT", "PRIMIT", "APROBAT", "RESPINS", "COPIE", "CONFIDENȚIAL"];
export const STAMP_COLORS: [string, string][] = [
  ["#c62828", "Roșu"],
  ["#1a237e", "Albastru"],
  ["#2e7d32", "Verde"],
  ["#000000", "Negru"],
];
const PLACES: [string, string][] = [
  ["sus-stanga", "sus, stânga"],
  ["sus-centru", "sus, centru"],
  ["sus-dreapta", "sus, dreapta"],
  ["mijloc-stanga", "mijloc, stânga"],
  ["centru", "centru"],
  ["mijloc-dreapta", "mijloc, dreapta"],
  ["jos-stanga", "jos, stânga"],
  ["jos-centru", "jos, centru"],
  ["jos-dreapta", "jos, dreapta"],
];

/** Rândul de sub ștampilă (din sign.ts): data, la cerere ora și numele, fixate când se pune ștampila. */
export function stampLine(d: Date, opts: { time?: boolean; name?: string }): string {
  const p = (n: number) => String(n).padStart(2, "0");
  const date = `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}` + (opts.time ? ` ${p(d.getHours())}:${p(d.getMinutes())}` : "");
  return opts.name?.trim() ? `${opts.name.trim()} · ${date}` : date;
}

interface MyStamp {
  id: string;
  nume: string;
  raport: number;
  png: string;
}

export function StampsPanel(props: {
  docId: string;
  version: number;
  selected: number[];
  busy: boolean;
  ask: (title: string, command: string, args: Record<string, unknown>) => Promise<void>;
  onError: (e: string | null) => void;
}) {
  const [label, setLabel] = useState("PLĂTIT");
  const [own, setOwn] = useState("");
  const [line, setLine] = useState({ date: true, time: false, name: false, who: "" });
  const [color, setColor] = useState("#c62828");
  const [opacity, setOpacity] = useState(100);
  const [place, setPlace] = useState("jos-dreapta");
  const [mine, setMine] = useState<MyStamp[]>([]);
  const [chosen, setChosen] = useState<string | null>(null);
  const [width, setWidth] = useState("40");
  const [file, setFile] = useState<File | null>(null);

  const load = useCallback(async () => {
    try {
      setMine(await api.moduleCall<MyStamp[]>(ID, "stampile"));
    } catch (e) {
      props.onError(message(e));
    }
  }, [props]);
  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const text = (label === "" ? own : label).trim();
  const sub = line.date ? stampLine(new Date(), { time: line.time, name: line.name ? line.who : "" }) : line.name ? line.who.trim() : "";
  const where = props.selected.length ? `pe ${props.selected.length === 1 ? "1 pagină" : `${props.selected.length} pagini`}` : "pe toate paginile";
  const common = { id: props.docId, based_on: props.version, pages: props.selected, pozitie: place };
  const mineChosen = mine.find((m) => m.id === chosen);

  return (
    <div className="card pdf-stamps">
      <div className="row wrap presets" role="group" aria-label="Ștampilele gata făcute">
        {STAMPS.map((s) => (
          <button key={s} className={!chosen && label === s ? "active" : ""} onClick={() => (setLabel(s), setChosen(null))}>
            {s}
          </button>
        ))}
        <input aria-label="Ștampilă cu textul meu" placeholder="sau textul tău" maxLength={40} value={own} onFocus={() => (setLabel(""), setChosen(null))} onChange={(e) => (setOwn(e.target.value), setLabel(""))} />
      </div>
      {!chosen && (
        <>
          <div className="row wrap">
            <label className="small">
              <input type="checkbox" aria-label="Data sub ștampilă" checked={line.date} onChange={(e) => setLine({ ...line, date: e.target.checked })} /> data
            </label>
            <label className="small">
              <input type="checkbox" aria-label="Ora sub ștampilă" checked={line.time} disabled={!line.date} onChange={(e) => setLine({ ...line, time: e.target.checked })} /> ora
            </label>
            <label className="small">
              <input type="checkbox" aria-label="Numele sub ștampilă" checked={line.name} onChange={(e) => setLine({ ...line, name: e.target.checked })} /> numele
            </label>
            {line.name && <input aria-label="Numele de pe ștampilă" placeholder="de ex. Ion Pop" maxLength={60} value={line.who} onChange={(e) => setLine({ ...line, who: e.target.value })} />}
            <span className="muted small">sub ștampilă: {sub || "—"}</span>
          </div>
          <div className="row wrap">
            {STAMP_COLORS.map(([c, n]) => (
              <button key={c} className={`swatch${color === c ? " active" : ""}`} style={{ background: c }} aria-label={`Culoarea ${n.toLowerCase()}`} title={n} onClick={() => setColor(c)} />
            ))}
            <label className="small">
              opacitate{" "}
              <input type="range" min={20} max={100} step={5} value={opacity} aria-label="Opacitatea ștampilei" onChange={(e) => setOpacity(Number(e.target.value))} /> {opacity}%
            </label>
          </div>
        </>
      )}
      <div className="row wrap">
        <select aria-label="Locul ștampilei" value={place} onChange={(e) => setPlace(e.target.value)}>
          {PLACES.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        {chosen ? (
          <button
            className="primary"
            disabled={props.busy}
            onClick={() => void props.ask(`Ștampila „${mineChosen?.nume}”`, "stamp_annot", { ...common, biblioteca: chosen, latime_mm: Number.parseFloat(width.replace(",", ".")) || 40 })}
          >
            Previzualizează {where}
          </button>
        ) : (
          <button
            className="primary"
            disabled={props.busy || !text}
            onClick={() => void props.ask(`Ștampila „${text}”`, "stamp_annot", { ...common, text, sub, culoare: color, opacitate: opacity / 100, autor: line.name ? line.who : "" })}
          >
            Previzualizează {where}
          </button>
        )}
      </div>

      <h4>Ștampilele mele</h4>
      <div className="pdf-mystamps">
        {mine.map((m) => (
          <figure key={m.id} className={chosen === m.id ? "active" : ""} data-mystamp={m.nume}>
            <img src={`data:image/png;base64,${m.png}`} alt={m.nume} onClick={() => setChosen(chosen === m.id ? null : m.id)} />
            <figcaption className="small">{m.nume}</figcaption>
            <button className="link" onClick={() => setChosen(chosen === m.id ? null : m.id)}>
              {chosen === m.id ? "aleasă" : "alege"}
            </button>{" "}
            <button
              className="link danger-text"
              onClick={() =>
                void api.moduleCall(ID, "stampila_delete", { id: m.id }).then(
                  () => (setChosen(null), load()),
                  (e: unknown) => props.onError(message(e)),
                )
              }
            >
              șterge
            </button>
          </figure>
        ))}
        {mine.length === 0 && <p className="muted small">Nicio ștampilă proprie încă.</p>}
      </div>
      {chosen && (
        <label className="small">
          lățimea pe pagină (mm) <input aria-label="Lățimea ștampilei mele" size={4} value={width} onChange={(e) => setWidth(e.target.value)} />
        </label>
      )}
      <label className="small">
        Ștampilă nouă din poză (ștampila firmei, o semnătură pe hârtie albă):{" "}
        <input aria-label="Poza ștampilei" type="file" accept="image/png,image/jpeg" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </label>
      <p className="muted small">Ștampila e o adnotare adevărată (/Stamp): se vede în orice program de PDF și se poate muta sau șterge acolo. Rezultatul e o versiune nouă.</p>
      {file && (
        <StampDialog
          file={file}
          onCancel={() => setFile(null)}
          onDone={(s) =>
            void api.moduleCall<{ id: string }>(ID, "stampila_save", { nume: s.name, date: s.png }).then(
              (r) => (setFile(null), setChosen(r.id), load()),
              (e: unknown) => props.onError(message(e)),
            )
          }
        />
      )}
    </div>
  );
}

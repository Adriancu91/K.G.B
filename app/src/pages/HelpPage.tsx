// „Ajutor” (8.9): the user's guide inside the app, searchable, in Romanian and (through the translation layer) in
// English. General chapters written here; one chapter per module, from the module's own description, with a link
// to open it. „Salvează ghidul ca PDF” writes the same text into a PDF the person keeps or prints.
import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { message, type ModulesReply } from "../api";
import { guidePdf } from "./helpPdf";

export interface Chapter {
  id: string;
  title: string;
  paras: string[];
}

export const GUIDE: Chapter[] = [
  {
    id: "primii-pasi",
    title: "Primii pași",
    paras: [
      "K.G.B. ține totul pe acest calculator, în dosarul aplicației. Pentru lucrul de zi cu zi nu ai nevoie de cont și nici de internet.",
      "La prima pornire alegi tipul de activitate al firmei. K.G.B. pornește modulele potrivite și îți propune modelele de documente și avizele de care ai nevoie. Le poți schimba oricând din „Catalog module”.",
      "Datele firmei le completezi o singură dată, apoi apar singure în documente. Le poți lua și din certificatul constatator, în „Depozitul de documente”.",
      "Pe Acasă ai panourile zilei: bani, de rezolvat, agenda, știri, radio. Muți un panou trăgând de titlu și îl mărești din colț. „Revino la implicit” pune panourile din fabrică.",
    ],
  },
  {
    id: "backup",
    title: "Datele tale, backup și restaurare",
    paras: [
      "Backupul automat se face zilnic și înainte de orice schimbare a formatului datelor. Din „Date și backup” faci oricând un backup manual, într-un dosar ales de tine, de preferat pe un stick sau pe alt disc.",
      "Restaurarea deschide backupul ca spațiu de lucru nou, fără să atingă spațiul actual: verifici întâi, apoi treci pe el.",
      "La dezinstalare datele rămân pe calculator, dacă nu bifezi tu ștergerea lor.",
    ],
  },
  {
    id: "fisiere",
    title: "Fișierele tale",
    paras: [
      "Ce imporți (.docx, .xlsx, PDF) rămâne neatins; fiecare salvare e o versiune nouă, pe care o poți reface din „Versiuni”. Ca să dai un fișier altcuiva, folosești „Exportă” și alegi dosarul.",
    ],
  },
  {
    id: "doua-pc",
    title: "Două sau mai multe calculatoare",
    paras: [
      "Din „Organizație” creezi organizația firmei, apoi din „Dispozitive și sincronizare” inviți celelalte calculatoare cu un cod. Fiecare persoană vede doar ce îi permite rolul ei.",
      "Sincronizarea merge și fără internet, în aceeași rețea. Ce s-a lucrat separat se unește; unde două persoane au schimbat același lucru, apare în „Conflicte” și alegi tu.",
    ],
  },
  {
    id: "telefon",
    title: "Telefonul",
    paras: [
      "Din „Telefon” pornești pagina pentru telefoane. Telefonul, în aceeași rețea Wi-Fi, se conectează scanând codul afișat pe PC. Pe telefon ai recepțiile, inventarul, pontajul, livrările, taskurile și mesajele.",
    ],
  },
  {
    id: "internet",
    title: "Internetul și sursele externe",
    paras: [
      "K.G.B. nu trimite nimic singur pe internet. Cursul BNR, vremea, știrile, radioul și căutarea la ANAF merg doar după ce pornești sursa lor în „Surse externe” și cât timp „Setări › Internet” e pornit.",
      "„Ferestre web” îți arată live o parte dintr-o pagină (curs valutar, bursă, știri), într-o fereastră mică, separată de datele K.G.B.",
      "Radioul de pe Acasă cântă posturi care transmit gratuit pe internet, din catalogul public Radio Browser.",
    ],
  },
  {
    id: "intrebari",
    title: "Întrebări frecvente",
    paras: [
      "Unde sunt datele mele? În dosarul aplicației de pe acest calculator; calea o vezi în „Diagnostic”. Nu pleacă nicăieri fără tine.",
      "Am șters ceva din greșeală. Multe module păstrează versiunile sau au coș. Altfel, restaurează un backup ca spațiu nou și copiază de acolo ce îți trebuie.",
      "De ce avertizează Windows la instalare? Programul nu e încă semnat digital; semnarea vine la lansare.",
      "Cum cer ajutor? Cu „Trimite o observație”, din stânga jos, sau cu raportul salvat din „Diagnostic”. Raportul nu conține date personale.",
    ],
  },
];

const fold = (t: string) =>
  t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ș/g, "s")
    .replace(/ț/g, "t");

export function HelpPage({ modules, focus, onOpen, onError }: { modules: ModulesReply; focus: string | null; onOpen: (page: string) => void; onError: (e: string | null) => void }) {
  const [q, setQ] = useState("");
  const [saved, setSaved] = useState<string | null>(null);
  const top = useRef<HTMLDivElement>(null);
  const mods = useMemo(() => [...modules.modules].sort((a, b) => Number(b.enabled) - Number(a.enabled) || a.name.localeCompare(b.name, "ro")), [modules]);
  const chapters: Chapter[] = useMemo(
    () => [...GUIDE, ...mods.map((m) => ({ id: `modul-${m.id}`, title: m.name, paras: [m.description] }))],
    [mods],
  );
  const shown = q.trim() ? chapters.filter((c) => fold(`${c.title} ${c.paras.join(" ")}`).includes(fold(q.trim()))) : chapters;

  useEffect(() => {
    if (!focus) return;
    document.getElementById(`ajutor-modul-${focus}`)?.scrollIntoView({ block: "start" });
  }, [focus]);

  const pdf = async () => {
    try {
      const dest = (window as { __kgbE2eSave?: string }).__kgbE2eSave ?? (await save({ defaultPath: "Ghidul K.G.B..pdf", filters: [{ name: "PDF", extensions: ["pdf"] }] }));
      if (!dest) return;
      // Every chapter on the page, so the PDF takes the text as shown (in the language chosen).
      setQ("");
      await new Promise((r) => setTimeout(r, 50));
      const bytes = await guidePdf(chapters);
      let bin = "";
      for (const b of bytes) bin += String.fromCharCode(b);
      await invoke("help_pdf_save", { dest, data: btoa(bin) });
      setSaved(dest);
      onError(null);
    } catch (e) {
      onError(message(e));
    }
  };

  return (
    <section className="help" ref={top}>
      <div className="row wrap">
        <input aria-label="Caută în ghid" placeholder="caută în ghid…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button onClick={() => void pdf()}>Salvează ghidul ca PDF</button>
      </div>
      {saved && (
        <p className="muted">
          Ghid salvat în <code>{saved}</code>
        </p>
      )}
      {!q.trim() && (
        <nav className="help-toc" aria-label="Cuprinsul ghidului">
          {chapters.map((c) => (
            <a key={c.id} href={`#ajutor-${c.id}`}>
              {c.title}
            </a>
          ))}
        </nav>
      )}
      {shown.length === 0 && <p className="muted">Nimic găsit în ghid.</p>}
      {shown.map((c) => {
        const m = c.id.startsWith("modul-") ? mods.find((x) => `modul-${x.id}` === c.id) : undefined;
        return (
          <article key={c.id} id={`ajutor-${c.id}`} className="card help-chapter" data-chapter={c.id}>
            <h2>{c.title}</h2>
            {c.paras.map((p) => (
              <p key={p}>{p}</p>
            ))}
            {m &&
              (m.enabled ? (
                <button className="link" onClick={() => onOpen(m.id)}>
                  Deschide „{m.name}”
                </button>
              ) : (
                <button className="link" onClick={() => onOpen("catalog")}>
                  Pornește-l din „Catalog module”
                </button>
              ))}
          </article>
        );
      })}
    </section>
  );
}

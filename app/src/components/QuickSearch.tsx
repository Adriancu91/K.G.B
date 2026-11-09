// Ctrl+K: quick search and commands everywhere in the app (Etapa 7, step
// 7.4j). Pages, partners from the directory and a few actions, by typing a
// few letters (without diacritics); arrows choose, Enter opens, Esc closes.
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Partner } from "../pages/PartnersPage";
import { setIntent } from "../intent";
import { isoToday } from "./AnafLookup";

interface Item {
  key: string;
  label: string;
  kind: string;
  run: () => void;
}

const fold = (s: string) =>
  s
    .toLowerCase()
    .replace(/[ăâ]/g, "a")
    .replace(/î/g, "i")
    .replace(/[șş]/g, "s")
    .replace(/[țţ]/g, "t")
    .trim();

export function QuickSearch({ pages, onOpen }: { pages: { id: string; label: string }[]; onOpen: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [partners, setPartners] = useState<Partner[]>([]);
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    if (open) {
      setQ("");
      setSel(0);
      setTimeout(() => input.current?.focus(), 0);
    }
  }, [open]);
  useEffect(() => {
    if (!open || fold(q).length < 2) {
      setPartners([]);
      return;
    }
    let live = true;
    const t = setTimeout(() => {
      invoke<{ items: Partner[] }>("partners_list", { cauta: q, inactivi: false, azi: isoToday() })
        .then((r) => live && setPartners(r.items.slice(0, 6)))
        .catch(() => live && setPartners([]));
    }, 120);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q, open]);

  const go = (id: string, intent?: string) => {
    if (intent) setIntent(id, intent);
    onOpen(id);
    setOpen(false);
  };
  const items = useMemo<Item[]>(() => {
    const f = fold(q);
    const has = (id: string) => pages.some((p) => p.id === id);
    const actions: Item[] = [
      { key: "a:partner", label: "Partener nou", kind: "acțiune", run: () => go("partners", "nou") },
      ...(has("kgb.business")
        ? [
            { key: "a:factura", label: "Factură nouă", kind: "acțiune", run: () => go("kgb.business", "facturare") },
            { key: "a:scadentar", label: "Scadențar (de încasat, de plătit)", kind: "acțiune", run: () => go("kgb.business", "scadentar") },
            { key: "a:casa", label: "Încasare / plată", kind: "acțiune", run: () => go("kgb.business", "casa") },
          ]
        : []),
      { key: "a:mesaj", label: "Mesaj echipei", kind: "acțiune", run: () => go("chat") },
    ];
    const pageItems: Item[] = pages.map((p) => ({ key: `p:${p.id}`, label: p.label, kind: "pagină", run: () => go(p.id) }));
    const partnerItems: Item[] = partners.map((p) => ({
      key: `c:${p.id}`,
      label: `${p.denumire}${p.cui ? ` · ${p.cui}` : ""}${p.localitate ? ` · ${p.localitate}` : ""}`,
      kind: "partener",
      run: () => go("partners", `fisa:${p.id}`),
    }));
    const match = (i: Item) => !f || fold(i.label).split(/[^\p{L}\p{N}]+/u).some((w) => w.startsWith(f)) || fold(i.label).startsWith(f);
    return [...pageItems.filter(match), ...actions.filter(match), ...partnerItems].slice(0, 14);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, pages, partners]);

  if (!open) return null;
  return (
    <div className="overlay" role="presentation" onClick={() => setOpen(false)}>
      <div className="dialog quick-search" role="dialog" aria-modal="true" aria-label="Căutare rapidă" onClick={(e) => e.stopPropagation()}>
        <input
          ref={input}
          aria-label="Caută o pagină, un partener sau o acțiune"
          placeholder="Caută o pagină, un partener sau o acțiune…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setSel(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
            else if (e.key === "ArrowDown") {
              e.preventDefault();
              setSel((s) => Math.min(items.length - 1, s + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setSel((s) => Math.max(0, s - 1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              items[sel]?.run();
            }
          }}
        />
        <ul className="qs-list" role="listbox">
          {items.length === 0 && <li className="muted">Nimic găsit.</li>}
          {items.map((i, n) => (
            <li key={i.key} role="option" aria-selected={n === sel}>
              <button className={n === sel ? "sel" : ""} onMouseEnter={() => setSel(n)} onClick={i.run}>
                <span>{i.label}</span>
                <span className="muted small">{i.kind}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="muted small">↑ ↓ alege · Enter deschide · Esc închide · Ctrl+K oriunde în aplicație</p>
      </div>
    </div>
  );
}

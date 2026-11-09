// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Panglica comună a modulelor (INTERFATA.md): bara rapidă, Fișier, rândul de file, caseta „Caută o comandă”, ˄ Strânge,
// iar dedesubt un singur rând cu grupurile filei alese (numele grupului scris mărunt sub el).
// Toate filele rămân în pagină (cele neselectate au `hidden`), ca starea lor să nu se piardă și ca paleta Ctrl+K și
// testele să găsească butoanele și pe filele ascunse. Când nu e loc, grupurile se strâng de la dreapta spre stânga
// într-un singur buton cu listă („Paragraf ▾”), deci panglica nu trece niciodată pe al doilea rând.
import { ReactNode, createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { api, type FileKind, type RecentFile } from '../api';
import './ribbon.css';
import { assignTips, TAB_TIPS, tipLetters } from './keytips';
import { SIMPLE_MODES } from '../profiles';

export interface RibbonTab {
  id: string;
  label: string;
  /** Filă care apare doar la selecție (Tabel, Imagine…): colorată, în dreapta. */
  contextual?: boolean;
  /** Pentru filele contextuale: se vede acum (de exemplu cursorul e într-un tabel). */
  shown?: boolean;
  /** Fila contextuală se deschide singură când apare (Imagine, Formă); Tabel doar se evidențiază. */
  autoOpen?: boolean;
  /** În modul „tools”: fila se arată ca bară orizontală sub bara globală (ca unealta de comentarii din programul de PDF
   *  cunoscut), nu în panoul din stânga; „✕ Închide” de la capătul ei revine la „Toate uneltele”. */
  bar?: boolean;
  /** În modul „menus”: fila nu are meniul ei, ci stă în meniul filei cu id-ul acesta (Ajustări în Imagine). */
  menu?: string;
  /** Litera filei la Alt (în locul celei din TAB_TIPS). */
  keytip?: string;
  content: ReactNode;
}

interface Props {
  /** Modulul („docs”): fila aleasă se ține minte pentru fiecare modul, în setări. */
  module: string;
  tabs: RibbonTab[];
  /** Bara rapidă din stânga sus (Salvează, Anulează, Refă). */
  quick?: ReactNode;
  /** Pagina Fișier (lista mare de comenzi peste modul). */
  file?: ReactNode;
  /** În dreapta rândului de file (de exemplu numele fișierului). */
  right?: ReactNode;
  /** Fișierele recente de felul acesta, în dreapta paginii Fișier; `open` primește calea aleasă. */
  recent?: { kind: FileKind; open(path: string): void };
  /** Clase în plus pe panglică (de exemplu numele vechilor bare, ca testele vechi să le găsească). */
  className?: string;
  /** „tools”: fără rândul de file; bara globală subțire (☰ Meniu + butoanele din `globals`) și un panou de unelte în stânga,
   *  în care se deschide „Toate uneltele” (`toolList`) sau conținutul unei file (așezarea programului de PDF cunoscut).
   *  „menus”: în locul panglicii, un rând de meniuri (Fișier, Editare, Imagine…) ca la editorul foto cunoscut; fiecare filă se
   *  deschide ca listă sub numele ei, cu grupurile una sub alta și scurtăturile scrise în dreapta.
   *  „airy” (Aerisit): rândul de meniuri, iar fila Pornire stă dedesubt ca o singură bară subțire (butoanele folosite des);
   *  restul filelor se deschid ca liste din meniuri. Ctrl+F1 (sau ˄) ascunde bara, ca documentul să aibă tot locul.
   *  „simple” (Simplu): în locul filelor, câteva moduri de lucru (Scrie, Inserează…, din SIMPLE_MODES); se vede doar bara subțire
   *  a modului ales, iar celelalte file stau în „Mai mult ▾”. */
  layout?: 'tools' | 'menus' | 'airy' | 'simple';
  /** Clase în plus pe bara globală (în modul „tools”). */
  barClass?: string;
  /** Butoanele mari ale barei globale: `id` = o filă sau `ALL` (Toate uneltele); `keytip` = litera lor la Alt. */
  globals?: { id: string; label: string; title: string; keytip: string; icon?: string }[];
  /** În modul „tools”: butoanele din `globals` stau într-o coloană îngustă în stânga (pictogramă + nume), lângă panoul de unelte,
   *  nu în bara de sus (profilul „Panouri laterale” din PDF). */
  taskRail?: boolean;
  /** Lista „Toate uneltele”: fiecare unealtă deschide o filă în panou (`tab`) sau pornește o comandă (`run`). */
  toolList?: { label: string; icon: string; title: string; tab?: string; run?: () => void }[];
  /** Se cheamă când alegi o filă (de exemplu PDF deschide lista comentariilor odată cu bara lor). */
  onTab?: (id: string) => void;
  /** Numele listei tuturor uneltelor în capul panoului (implicit „Toate uneltele”; profilul Aerisit din PDF: „Avansat”). */
  allLabel?: string;
}

/** Scurtătura scrisă în titlul unui buton: „Ctrl+Shift+N”, „Alt+Ctrl+I”, „F12”. */
const KBD_RE = /(?:(?:Ctrl|Alt|Shift)\+)+(?:F\d{1,2}\b|Backspace|Delete|Enter|Space|[A-Za-z0-9'";[\]=+-](?![A-Za-zăâîșț]))|\bF\d{1,2}\b/;

/** Scurtătura comenzii din titlu, doar când e chiar a ei: la început sau între paranteze („(Ctrl+J)”, „Ctrl+P: …”),
 *  nu una pomenită în treacăt („(Ctrl+Z îl readuce)”). */
function menuKbd(title: string): string {
  const re = new RegExp(KBD_RE.source, 'g');
  for (let m = re.exec(title); m; m = re.exec(title)) {
    const pre = title.slice(0, m.index).trimEnd(), post = title.slice(m.index + m[0].length);
    if ((pre === '' || pre.endsWith('(')) && /^($|[):,])/.test(post)) return m[0];
  }
  return '';
}

/** Id-ul listei „Toate uneltele” în modul „tools”. */
export const ALL_TOOLS = '__all';
/** Un buton global cu id-ul acesta închide panoul de unelte (modul „Citește” din profilul Simplu al PDF-ului). */
export const NO_TOOLS = '__none';
/** Lățimea coloanei de sarcini (`taskRail`). */
const RAIL_W = 76;

const remembered: Record<string, string> = {};
let loaded: Promise<void> | null = null;
function loadRemembered() {
  loaded ??= api.getSettings().then((s) => { Object.assign(remembered, s.ribbon ?? {}); }).catch(() => {});
  return loaded;
}

/** Panglicile din pagină (una pe tab de modul); ajutorul pentru teste lucrează cu cea vizibilă. */
interface Handle { root: HTMLElement; relayout(): void; select(id: string): void; current(): string; tabs(): { id: string; label: string; shown: boolean; contextual: boolean }[] }
const live = new Set<Handle>();
const visible = () => [...live].find((h) => h.root.isConnected && h.root.offsetParent !== null) ?? [...live][0];

/** Arată butonul (deschide fila lui, grupul strâns sau „⋯” în care stă). Folosit de paleta Ctrl+K înainte de clic. */
export function revealInRibbon(el: Element): boolean {
  const panel = el.closest<HTMLElement>('.ribbon-panel');
  const root = el.closest<HTMLElement>('.ribbon');
  if (!panel || !root) return false;
  const h = [...live].find((x) => x.root === root);
  if (h && panel.dataset.tab) h.select(panel.dataset.tab);
  const group = el.closest<HTMLElement>('.ribbon-group');
  // Și pe o filă abia aleasă: grupul se poate strânge abia la așezarea ei, iar „open” îl ține desfăcut (pe un grup nestrâns nu schimbă nimic).
  if (group) group.classList.add('open');
  const more = el.closest<HTMLElement>('.ribbon-more');
  if (more) more.classList.add('open');
  return true;
}

/** Unde stă un buton din panglică: „Pornire › Font” (pentru paleta Ctrl+K). */
export function ribbonPlace(el: Element): string {
  const panel = el.closest<HTMLElement>('.ribbon-panel');
  if (!panel) return el.closest('.ribbon-backstage') ? 'Fișier' : '';
  const group = el.closest<HTMLElement>('.ribbon-group');
  return [panel.dataset.label, group?.dataset.label].filter(Boolean).join(' › ');
}

declare global { interface Window { __suiteRibbon?: unknown } }
window.__suiteRibbon = {
  tabs: () => visible()?.tabs() ?? [],
  current: () => visible()?.current() ?? '',
  select: (id: string) => visible()?.select(id),
  relayout: () => visible()?.relayout(),
  /** Găsește butonul după începutul titlului, după nume (aria) sau după text și îi deschide fila. */
  reveal: (text: string) => {
    const h = visible();
    if (!h) return false;
    const el = [...h.root.querySelectorAll<HTMLElement>('button, select')].find((b) =>
      b.title.startsWith(text) || b.getAttribute('aria-label') === text || (b.textContent ?? '').trim() === text);
    return el ? revealInRibbon(el) : false;
  },
};

const Ctx = createContext<{ closeAll(): void }>({ closeAll: () => {} });

/** Locul literei `ch` în numele butonului (prima apariție, de preferat la început de cuvânt), pentru linia de sub ea. */
function underlineAt(el: HTMLElement, ch: string): { x: number; y: number; w: number } | undefined {
  const plain = (c: string) => tipLetters(c);
  const nodes: Text[] = [];
  const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) nodes.push(n as Text);
  let best: { node: Text; i: number } | undefined;
  for (const node of nodes) {
    const s = node.data;
    for (let i = 0; i < s.length; i++) {
      if (plain(s[i]) !== ch) continue;
      const start = i === 0 || !/\p{L}|\d/u.test(s[i - 1]);
      if (start) { best = { node, i }; break; }
      if (!best) best = { node, i };
    }
    if (best && (best.i === 0 || !/\p{L}|\d/u.test(best.node.data[best.i - 1]))) break;
  }
  if (!best) return undefined;
  const range = document.createRange();
  range.setStart(best.node, best.i); range.setEnd(best.node, best.i + 1);
  const r = range.getBoundingClientRect();
  return r.width > 0 ? { x: r.left, y: r.bottom - 2, w: r.width } : undefined;
}

export default function Ribbon({ module, tabs, quick, file, right, className, recent, layout, barClass, globals, toolList, onTab, allLabel = 'Toate uneltele', taskRail }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const tools = layout === 'tools';
  const airy = layout === 'airy';
  const simple = layout === 'simple';
  const modes = simple ? (SIMPLE_MODES[module] ?? []).filter((m) => tabs.some((t) => t.id === m.id)) : [];
  const menus = layout === 'menus' || airy;
  // Modul „airy”: fila care stă ca bară sub meniuri (Pornire), nu în listele lor.
  const pinned = airy ? tabs.find((t) => t.id === 'home')?.id : undefined;
  // Modul „menus”: lista meniului ales e deschisă (altfel nu se vede niciun rând de butoane).
  const [menuOpen, setMenuOpen] = useState(false);
  const [cur, setCur] = useState<string>(tools ? ALL_TOOLS : remembered[module] ?? 'home');
  // Panoul de unelte (modul „tools”): deschis la pornire, ca „Toate uneltele” să se vadă; se ține minte dacă l-ai închis.
  const [toolsOpen, setToolsOpenState] = useState(remembered[module + ':panou'] !== '0');
  const setToolsOpen = useCallback((v: boolean) => {
    setToolsOpenState(v);
    remembered[module + ':panou'] = v ? '1' : '0';
    void api.setSettings({ ribbon: { ...remembered } }).catch(() => {});
  }, [module]);
  const [fileOpen, setFileOpen] = useState(false);
  const [recentList, setRecentList] = useState<RecentFile[]>([]);
  const recentKind = recent?.kind;
  // La fiecare deschidere a paginii Fișier se citește din nou lista (ca să apară și fișierele deschise între timp).
  useEffect(() => {
    if (!fileOpen || !recentKind) return;
    void api.getSettings().then((st) => setRecentList((st.recent ?? []).filter((r) => r.kind === recentKind).slice(0, 12))).catch(() => setRecentList([]));
  }, [fileOpen, recentKind]);
  const [min, setMin] = useState(false);
  const [peek, setPeek] = useState(false);
  const prevRef = useRef(cur);
  const shownTabs = tabs.filter((t) => !t.contextual || t.shown);
  const active = shownTabs.some((t) => t.id === cur) ? cur : (shownTabs.find((t) => t.id === prevRef.current)?.id ?? shownTabs[0]?.id);

  useEffect(() => { void loadRemembered().then(() => {
    if (tools) { if (remembered[module + ':panou'] === '0') setToolsOpenState(false); }
    else if (remembered[module]) setCur(remembered[module]);
  }); }, [module, tools]);

  const choose = useCallback((id: string, remember = true) => {
    setCur(id);
    onTab?.(id);
    if (tools) { setToolsOpen(true); if (id === ALL_TOOLS) return; }
    const t = tabs.find((x) => x.id === id);
    if (remember && t && !t.contextual) {
      prevRef.current = id;
      remembered[module] = id;
      void api.setSettings({ ribbon: { ...remembered } }).catch(() => {});
    }
  }, [tabs, module, tools, setToolsOpen, onTab]);

  // Filele contextuale care se deschid singure: la apariție trec în față, la dispariție revine fila de dinainte.
  const autoKey = tabs.filter((t) => t.contextual && t.autoOpen && t.shown).map((t) => t.id).join(',');
  useEffect(() => { const first = autoKey.split(',')[0]; if (first) { setCur(first); if (tools) setToolsOpenState(true); } }, [autoKey, tools]);

  // Ajutorul pentru teste și paletă.
  const stateRef = useRef({ active, tabs: shownTabs, all: tabs });
  stateRef.current = { active, tabs: shownTabs, all: tabs };
  useEffect(() => {
    const h: Handle = {
      get root() { return rootRef.current!; },
      relayout: () => relayoutRef.current(),
      select: (id) => { setFileOpen(false); if (id === pinned) { setMin(false); setMenuOpen(false); } else if (min) setPeek(true); choose(id); if (menus && id !== pinned) setMenuOpen(true); },
      current: () => stateRef.current.active ?? '',
      tabs: () => stateRef.current.all.map((t) => ({ id: t.id, label: t.label, contextual: !!t.contextual, shown: !t.contextual || !!t.shown })),
    };
    live.add(h);
    return () => { live.delete(h); };
  }, [choose, min, menus, pinned]);

  // Modul „menus”: lista se închide la clic în afara meniurilor, la Esc și când pleci din modul.
  useEffect(() => {
    if (!menus || !menuOpen) return;
    const down = (e: MouseEvent) => {
      const t = e.target as Element | null;
      const root = rootRef.current;
      if (!root || !t) return;
      if (root.querySelector(':scope > .ribbon-tabs')?.contains(t) || root.querySelector(':scope > .ribbon-body')?.contains(t)) return;
      setMenuOpen(false);
    };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setMenuOpen(false); } };
    window.addEventListener('mousedown', down, true);
    window.addEventListener('keydown', key, true);
    return () => { window.removeEventListener('mousedown', down, true); window.removeEventListener('keydown', key, true); };
  }, [menus, menuOpen]);

  // Ctrl+F1 strânge / desface panglica (doar în modulul din față).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F1' && e.ctrlKey && rootRef.current?.offsetParent) { e.preventDefault(); setMin((m) => !m); setPeek(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Grupurile și listele „⋯” deschise se închid la clic în afara lor.
  const closeAll = useCallback(() => {
    rootRef.current?.querySelectorAll('.ribbon-group.open, .ribbon-more.open').forEach((g) => g.classList.remove('open'));
  }, []);
  useEffect(() => {
    const down = (e: MouseEvent) => {
      const t = e.target as Element | null;
      const root = rootRef.current;
      if (!root) return;
      root.querySelectorAll('.ribbon-group.open, .ribbon-more.open').forEach((g) => { if (!g.contains(t)) g.classList.remove('open'); });
      if (peek && t && !root.contains(t)) setPeek(false);
    };
    window.addEventListener('mousedown', down, true);
    return () => window.removeEventListener('mousedown', down, true);
  }, [peek]);

  const relayoutRef = useRef<() => void>(() => {});
  // Modul „tools”: panoul stă lângă document, sub bara globală; lățimea lui ajunge în --tools-w pe fereastra modulului
  // (CSS-ul modulului mută documentul la dreapta cu atât). O filă cu `bar` stă în schimb ca bară orizontală sub bara globală.
  // Fără „Toate uneltele” printre butoanele globale (profilul Simplu din PDF), lista mare nu se arată: panoul stă închis până alegi un mod.
  const noAll = !!globals && !globals.some((g) => g.id === ALL_TOOLS);
  const panelOn = tools && toolsOpen && !(noAll && cur === ALL_TOOLS);
  const barOn = panelOn && cur !== ALL_TOOLS && !!tabs.find((t) => t.id === active)?.bar;
  useCollapse(rootRef, active, relayoutRef, (tools && !barOn) || (menus && !airy), airy);
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!tools || !root) return;
    const host = root.parentElement;
    const place = () => {
      const rail = taskRail ? RAIL_W : 0;
      host?.style.setProperty('--tools-w', (panelOn && !barOn ? 264 : 0) + rail + 'px');
      const body = root.querySelector<HTMLElement>(':scope > .ribbon-side');
      if (body) { body.style.top = root.offsetTop + root.offsetHeight + 'px'; body.style.left = rail ? rail + 'px' : ''; }
      const col = root.querySelector<HTMLElement>(':scope > .ribbon-taskrail');
      if (col) col.style.top = root.offsetTop + root.offsetHeight + 'px';
    };
    place();
    const ro = new ResizeObserver(place);
    ro.observe(root);
    return () => { ro.disconnect(); };
  }, [tools, panelOn, barOn, taskRail]);
  const shownAt = tools && cur === ALL_TOOLS ? ALL_TOOLS : active;
  // Modul „menus”: meniul în care stă fila aleasă (Ajustări → Imagine) și locul listei, sub numele lui.
  const menuOf = (id: string | undefined) => tabs.find((t) => t.id === id)?.menu ?? id;
  const openMenu = menuOf(shownAt);
  const [dropLeft, setDropLeft] = useState(0);
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!menus || !menuOpen || !root) return;
    const btn = root.querySelector<HTMLElement>(`[data-tab-btn="${openMenu}"]`);
    const drop = root.querySelector<HTMLElement>(':scope > .ribbon-body');
    // Butoanele cu doar o pictogramă („B”, „⤒”) primesc în listă și numele lor (din aria-label / titlu), ca rândurile unui meniu clasic.
    drop?.querySelectorAll<HTMLElement>('.ribbon-panel:not([hidden]) button, .ribbon-panel:not([hidden]) label.color-pick').forEach((b) => {
      const txt = (b.textContent ?? '').replace(/[▾\s]/g, '');
      const name = (b.getAttribute('aria-label') || b.title.split(/ \(|:/)[0] || '').replace(/\s*▾$/, '').trim();
      if (txt.length <= 3 && name && name !== txt && !b.classList.contains('ribbon-menu-item') && !b.classList.contains('rb-drop') && !b.classList.contains('clr-drop') && !b.dataset.txt) b.dataset.mlabel = name;
      else delete b.dataset.mlabel;
    });
    // O listă mai înaltă decât fereastra se așază pe mai multe coloane (grupurile întregi), ca să nu iasă din ecran.
    if (drop) {
      delete drop.dataset.cols;
      const avail = window.innerHeight - drop.getBoundingClientRect().top - 12;
      const cols = Math.min(4, Math.ceil(drop.scrollHeight / Math.max(200, avail)));
      if (cols > 1) drop.dataset.cols = String(cols);
    }
    // Lista nu iese din fereastra modulului: lângă marginea din dreapta se mută spre stânga.
    if (btn) setDropLeft(Math.max(0, Math.min(btn.getBoundingClientRect().left - root.getBoundingClientRect().left, root.clientWidth - (drop?.offsetWidth ?? 0) - 2)));
    // Scurtătura din titlul butonului („… (Ctrl+L)”) se scrie în dreapta rândului din meniu.
    root.querySelectorAll<HTMLElement>(':scope > .ribbon-body .ribbon-panel:not([hidden]) button').forEach((b) => {
      const k = menuKbd(b.title);
      if (k) b.dataset.kbd = k; else delete b.dataset.kbd;
    });
  });

  // Tastele de acces (KeyTips): Alt apăsat și lăsat singur (sau F10) arată literele filelor; litera unei file o deschide și
  // arată literele butoanelor ei; litera unui buton îl apasă. Esc urcă un nivel, Alt din nou (sau un clic) le ascunde.
  // `mouse`: lista din modul „menus” deschisă cu mouse-ul; literele lucrează și atunci (subliniate), dar Esc închide meniul.
  const [tips, setTips] = useState<null | { level: 'tabs' | 'panel'; buf: string; mouse?: boolean; items: { code: string; el: HTMLElement; x: number; y: number; u?: { x: number; y: number; w: number } }[] }>(null);
  const tipsRef = useRef(tips);
  tipsRef.current = tips;
  const kbdOpenRef = useRef(false);
  const showTips = useCallback((level: 'tabs' | 'panel', mouse = false, pop?: HTMLElement | null) => {
    const root = rootRef.current;
    if (!root) return;
    const seen = (el: HTMLElement) => el.offsetParent !== null && !(el as HTMLButtonElement).disabled && el.getBoundingClientRect().width > 0;
    const label = (el: HTMLElement) => el.getAttribute('aria-label') || el.title || (el.textContent ?? '').trim();
    let els: HTMLElement[]; let fixed: (string | undefined)[];
    if (pop) {
      els = [...pop.querySelectorAll<HTMLElement>('button')].filter((el) => el.offsetParent !== null && !(el as HTMLButtonElement).disabled);
      fixed = els.map((el) => el.dataset.keytip);
    } else if (level === 'tabs') {
      const quick = [...root.querySelectorAll<HTMLElement>('.ribbon-quick button')].filter(seen).slice(0, 9);
      const file = [...root.querySelectorAll<HTMLElement>('.ribbon-file-btn')].filter(seen);
      const tabsEls = [...root.querySelectorAll<HTMLElement>('.ribbon-tablist [data-tab-btn], .ribbon-globals [data-global]')].filter(seen);
      // Barele modulului din afara panglicii (de exemplu bara rapidă din PDF), cu literele lor puse în data-keytip.
      const pane = root.closest('.module-pane') ?? root.parentElement;
      const extra = pane ? [...pane.querySelectorAll<HTMLElement>('[data-keytips-extra] button[data-keytip]')].filter(seen) : [];
      els = [...quick, ...file, ...tabsEls, ...extra];
      fixed = [...quick.map((_, i) => String(i + 1)), ...file.map(() => (root.classList.contains('ribbon-tools') ? 'M' : 'F')),
        ...tabsEls.map((t) => t.dataset.keytip ?? TAB_TIPS[t.dataset.tabBtn ?? '']), ...extra.map((el) => el.dataset.keytip)];
    } else {
      // Cu o listă deschisă (meniuri, Aerisit) literele sunt doar ale ei, nu și ale barei de sub meniuri.
      const drop = root.classList.contains('ribbon-menus') && root.querySelector(':scope > .ribbon-body:not([hidden])') ? ':scope > .ribbon-body ' : '';
      els = [...root.querySelectorAll<HTMLElement>(`${drop}.ribbon-panel:not([hidden]) button, ${drop}.ribbon-panel:not([hidden]) select, .ribbon-side-head button`)].filter(seen);
      fixed = els.map((el) => el.dataset.keytip);
    }
    const codes = assignTips(els.map((el, i) => ({ label: label(el), fixed: fixed[i] })));
    // La meniurile de sus, litera unei comenzi se subliniază în numele ei (ca în meniurile clasice), în loc de eticheta neagră.
    const dropdown = level === 'panel' && root.classList.contains('ribbon-menus') && !!root.querySelector(':scope > .ribbon-body:not([hidden])');
    const items = els.map((el, i) => {
      const r = el.getBoundingClientRect();
      const u = dropdown && codes[i].length === 1 && el.tagName === 'BUTTON' ? underlineAt(el, codes[i]) : undefined;
      return { code: codes[i], el, x: r.left + r.width / 2, y: level === 'tabs' ? r.bottom - 4 : r.bottom - 6, u };
    });
    if (mouse && !items.length) return;
    setTips({ level, buf: '', items, mouse });
  }, []);
  // Lista deschisă cu mouse-ul (sau trecând cu mouse-ul pe alt meniu) primește și ea literele subliniate.
  useEffect(() => {
    if (!menus || !menuOpen) return;
    let a = 0, b = 0;
    a = requestAnimationFrame(() => { b = requestAnimationFrame(() => showTips('panel', !kbdOpenRef.current)); });
    return () => { cancelAnimationFrame(a); cancelAnimationFrame(b); };
  }, [menus, menuOpen, openMenu, showTips]);
  useEffect(() => { if (menus && !menuOpen) { kbdOpenRef.current = false; if (tipsRef.current?.level === 'panel') setTips(null); } }, [menus, menuOpen]);
  useEffect(() => {
    let armed = false;
    const mine = () => !!rootRef.current && visible()?.root === rootRef.current;
    const down = (e: KeyboardEvent) => {
      if (!mine()) { if (tipsRef.current) setTips(null); return; }
      const t = tipsRef.current;
      if (e.key === 'Alt') { if (!e.ctrlKey && !e.shiftKey && !e.metaKey && !e.repeat) armed = true; if (t) e.preventDefault(); return; }
      armed = false;
      if (!t) {
        if (e.key === 'F10' && !e.ctrlKey && !e.altKey && !e.shiftKey) { e.preventDefault(); showTips('tabs'); }
        // La meniurile de sus (layout=menus): Alt+litera ținute împreună deschid direct meniul (Alt+F Fișier, Alt+I Imagine…), fără AltGr.
        if (menus && e.altKey && !e.ctrlKey && !e.shiftKey && !e.metaKey && !e.getModifierState?.('AltGraph') && /^Key[A-Z]$/.test(e.code) && rootRef.current) {
          const letter = e.code.slice(3), root = rootRef.current;
          const seen = (el: HTMLElement) => el.offsetParent !== null;
          const tabEl = [...root.querySelectorAll<HTMLElement>('.ribbon-tablist [data-tab-btn]')].filter(seen).find((el) => (el.dataset.keytip ?? TAB_TIPS[el.dataset.tabBtn ?? '']) === letter);
          const fileEl = !tabEl && letter === 'F' ? [...root.querySelectorAll<HTMLElement>('.ribbon-file-btn')].find(seen) : undefined;
          if (tabEl || fileEl) {
            e.preventDefault(); e.stopPropagation();
            if (fileEl) { fileEl.click(); return; }
            setFileOpen(false); setMin(false); setPeek(false); choose(tabEl!.dataset.tabBtn!); setMenuOpen(true); kbdOpenRef.current = true;
            requestAnimationFrame(() => requestAnimationFrame(() => showTips('panel')));
            return;
          }
        }
        return;
      }
      if (t.mouse) {
        // Meniul deschis cu mouse-ul: scurtăturile (Ctrl+…), săgețile și câmpurile de scris merg mai departe; Esc închide meniul.
        const tg = e.target as HTMLElement | null;
        if (e.ctrlKey || e.altKey || e.metaKey || e.key.length !== 1 || (tg && /^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName))) {
          if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setMenuOpen(false); }
          setTips(null); return;
        }
      }
      e.preventDefault(); e.stopPropagation();
      if (e.key === 'Escape') { if (t.level === 'panel') showTips('tabs'); else setTips(null); return; }
      const ch = /^Key[A-Z]$/.test(e.code) ? e.code.slice(3) : /^(Digit|Numpad)\d$/.test(e.code) ? e.code.slice(-1) : e.key.length === 1 ? e.key.toUpperCase() : '';
      if (!ch || e.ctrlKey || e.altKey) { setTips(null); return; }
      const buf = t.buf + ch;
      const hit = t.items.find((it) => it.code === buf);
      if (!hit) { if (t.items.some((it) => it.code.startsWith(buf))) setTips({ ...t, buf }); return; }
      const el = hit.el;
      const tab = el.dataset.tabBtn ?? el.dataset.global;
      if (tab) { setFileOpen(false); setMin(false); setPeek(false); choose(tab); if (menus) { setMenuOpen(true); kbdOpenRef.current = true; } setTips(null); requestAnimationFrame(() => requestAnimationFrame(() => showTips('panel'))); return; }
      setTips(null);
      // Butoanele cu litere sunt deja la vedere (fără revealInRibbon, care ar deschide lista și clicul ar închide-o la loc).
      if (el.tagName === 'SELECT') { el.focus(); return; }
      el.click();
      // O literă care deschide o listă („Format ▾”): literele trec pe rândurile listei (Alt H O I).
      if (el.getAttribute('aria-haspopup') === 'menu') {
        requestAnimationFrame(() => requestAnimationFrame(() => {
          const pop = el.parentElement?.querySelector<HTMLElement>(':scope > [role="menu"], :scope > .ribbon-more-pop');
          if (pop && pop.offsetParent !== null) showTips('panel', false, pop);
        }));
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key !== 'Alt') return;
      if (armed && mine()) { e.preventDefault(); if (tipsRef.current) setTips(null); else showTips('tabs'); }
      armed = false;
    };
    const off = () => { armed = false; if (tipsRef.current) setTips(null); };
    window.addEventListener('keydown', down, true);
    window.addEventListener('keyup', up, true);
    window.addEventListener('mousedown', off, true);
    window.addEventListener('blur', off);
    window.addEventListener('resize', off);
    return () => {
      window.removeEventListener('keydown', down, true); window.removeEventListener('keyup', up, true);
      window.removeEventListener('mousedown', off, true); window.removeEventListener('blur', off); window.removeEventListener('resize', off);
    };
  }, [showTips, choose, menus]);

  const globalBtns = tools ? (
    <div className={'ribbon-globals' + (taskRail ? ' ribbon-taskrail' : '')} role={taskRail ? 'toolbar' : undefined} aria-label={taskRail ? 'Sarcinile' : undefined} aria-orientation={taskRail ? 'vertical' : undefined}>
      {(globals ?? []).map((g) => {
        const none = g.id === NO_TOOLS;
        const can = none || g.id === ALL_TOOLS || tabs.some((t) => t.id === g.id);
        const on = none ? !panelOn : panelOn && shownAt === g.id;
        return (
          <button key={g.id} data-global={g.id} data-keytip={g.keytip} className={'ribbon-global' + (on ? ' on' : '')} disabled={!can} title={g.title} aria-pressed={on}
            onClick={() => { setFileOpen(false); if (none || on) setToolsOpen(false); else choose(g.id); }}>
            {taskRail && g.icon ? <><span className="ribbon-task-ico" aria-hidden="true">{g.icon}</span><span className="ribbon-task-txt">{g.label}</span></> : g.label}
          </button>
        );
      })}
      {shownTabs.filter((t) => t.contextual).map((t) => (
        <button key={t.id} data-global={t.id} className={'ribbon-global ctx' + (panelOn && shownAt === t.id ? ' on' : '')}
          title={`Uneltele pentru ${t.label.toLowerCase()}`} onClick={() => { setFileOpen(false); choose(t.id); }}>{t.label}</button>
      ))}
    </div>
  ) : null;
  const openPalette = () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'q', code: 'KeyQ', altKey: true, bubbles: true }));
  const panelsShown = !min || peek;

  return (
    <Ctx.Provider value={{ closeAll }}>
      <div className={`ribbon${tools ? ' ribbon-tools' : ''}${menus ? ' ribbon-menus' : ''}${airy || simple ? ' ribbon-airy' : ''}${simple ? ' ribbon-simple' : ''}${className ? ' ' + className : ''}${min && !tools && !menus ? ' ribbon-min' : ''}`} ref={rootRef}>
        <div className={`ribbon-tabs${tools ? ' ribbon-globalbar' : ''}${menus ? ' menubar' : ''}${tools && barClass ? ' ' + barClass : ''}`} role={menus ? 'menubar' : 'tablist'} aria-label={tools ? 'Bara globală' : menus ? 'Meniuri' : 'File'}
          onKeyDown={(e) => {
            if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
            const bar = menus ? shownTabs.filter((t) => !t.menu && t.id !== pinned) : shownTabs;
            const i = bar.findIndex((t) => t.id === (menus ? openMenu : active));
            const n = bar[(i + (e.key === 'ArrowRight' ? 1 : bar.length - 1)) % bar.length];
            if (n) { e.preventDefault(); choose(n.id); rootRef.current?.querySelector<HTMLElement>(`[data-tab-btn="${n.id}"]`)?.focus(); }
          }}>
          {quick && !menus && <div className="ribbon-quick" aria-label="Bara rapidă">{quick}</div>}
          {file && (
            <button className={`ribbon-file-btn${fileOpen ? ' on' : ''}`} onClick={() => { setMenuOpen(false); setFileOpen(!fileOpen); }} aria-expanded={fileOpen}
              onMouseEnter={() => { if (menus && menuOpen) { setMenuOpen(false); setFileOpen(true); } }}
              title={tools ? 'Meniu: nou, deschide, salvează, comprimă, tipărește, proprietăți document' : 'Fișier: nou, deschide, salvează, import, export, tipărește, proprietăți'}>{tools ? '☰ Meniu' : 'Fișier'}</button>
          )}
          {tools && !taskRail && globalBtns}
          <div className="ribbon-tablist" hidden={tools}>
          {menus ? shownTabs.filter((t) => !t.menu && t.id !== pinned).map((t) => (
            <button key={t.id} role="menuitem" data-tab-btn={t.id} data-keytip={t.keytip} aria-haspopup="menu" aria-expanded={menuOpen && t.id === openMenu}
              className={`ribbon-tab menubar-item${menuOpen && t.id === openMenu ? ' on' : ''}${t.contextual ? ' ctx' : ''}`}
              onClick={() => { setFileOpen(false); if (menuOpen && t.id === openMenu) setMenuOpen(false); else { choose(t.id); setMenuOpen(true); } }}
              onMouseEnter={() => { if ((menuOpen || fileOpen) && t.id !== openMenu) { setFileOpen(false); choose(t.id); setMenuOpen(true); } else if (fileOpen) { setFileOpen(false); setMenuOpen(true); } }}>
              {t.label}
            </button>
          )) : simple ? <>
            {modes.map((m) => (
              <button key={m.id} role="tab" data-tab-btn={m.id} data-keytip={tabs.find((t) => t.id === m.id)?.keytip} aria-selected={m.id === active && panelsShown}
                className={`ribbon-tab ribbon-mode${m.id === active ? ' on' : ''}`} title={m.title}
                onClick={() => { setFileOpen(false); if (min) setPeek(!(peek && m.id === active)); choose(m.id); }}>{m.label}</button>
            ))}
            {shownTabs.filter((t) => t.contextual || (t.id === active && !modes.some((m) => m.id === t.id))).map((t) => (
              <button key={t.id} role="tab" data-tab-btn={t.id} data-keytip={t.keytip} aria-selected={t.id === active && panelsShown}
                className={`ribbon-tab${t.id === active ? ' on' : ''}${t.contextual ? ' ctx' : ''}`}
                onClick={() => { setFileOpen(false); if (min) setPeek(!(peek && t.id === active)); choose(t.id); }}>{t.label}</button>
            ))}
            <RMenu label="Mai mult" title="Celelalte file, cu toate comenzile lor (se deschid în bara de dedesubt)"
              items={shownTabs.filter((t) => !t.contextual && !modes.some((m) => m.id === t.id)).map((t) => ({ label: t.label, checked: t.id === active, run: () => { setFileOpen(false); setMin(false); choose(t.id); } }))} />
          </> : shownTabs.map((t) => (
            <button key={t.id} role="tab" data-tab-btn={t.id} data-keytip={t.keytip} aria-selected={t.id === active && panelsShown}
              className={`ribbon-tab${t.id === active ? ' on' : ''}${t.contextual ? ' ctx' : ''}`}
              onClick={() => { setFileOpen(false); if (min) setPeek(!(peek && t.id === active)); choose(t.id); }}
              onDoubleClick={() => { setMin((m) => !m); setPeek(false); }}>
              {t.label}
            </button>
          ))}
          </div>
          {quick && menus && <div className="ribbon-quick" aria-label="Bara rapidă">{quick}</div>}
          <span className="ribbon-fill" />
          <button className="ribbon-search" onClick={openPalette} title="Caută orice comandă după nume și o pornește (Alt+Q sau Ctrl+Shift+P)">🔍 Caută o comandă <kbd>Alt+Q</kbd></button>
          {right}
          {!tools && (!menus || airy) && <button className="ribbon-min-btn" onClick={() => { setMin(!min); setPeek(false); }} aria-pressed={min}
            title={airy ? (min ? 'Arată bara cu butoanele folosite des (Ctrl+F1)' : 'Ascunde bara cu butoanele folosite des: rămân doar meniurile (Ctrl+F1)') : min ? 'Arată panglica tot timpul (Ctrl+F1)' : 'Strânge panglica: rămân doar numele filelor (Ctrl+F1)'}>{min ? '˅' : '˄'}</button>}
        </div>
        {pinned && (() => { const t = tabs.find((x) => x.id === pinned)!; return (
          <div className="ribbon-airybar" hidden={min} aria-label="Bara cu butoanele folosite des">
            <div className="ribbon-panel" role="tabpanel" data-tab={t.id} data-label={t.label}>{t.content}</div>
          </div>
        ); })()}
        <div className={`ribbon-body${tools ? (barOn ? ' ribbon-toolbar' : ' ribbon-side') : ''}${menus ? ' ribbon-dropdown' : ''}${simple ? ' ribbon-airybar' : ''}${min && !tools && !menus ? ' peek' : ''}`}
          hidden={tools ? !panelOn : menus ? !menuOpen : !panelsShown} role={menus ? 'menu' : undefined} style={menus ? { left: dropLeft } : undefined}
          onClick={menus ? (e) => {
            // Un clic pe o comandă închide meniul; nu și pe butoanele care deschid o listă (▾) sau pe liste / căsuțe.
            const b = (e.target as Element).closest('button');
            if (!b || b.disabled || b.getAttribute('aria-haspopup') || b.classList.contains('ribbon-more-btn') || b.classList.contains('ribbon-group-toggle')) return;
            setTimeout(() => setMenuOpen(false), 0);
          } : undefined}>
          {tools && !barOn && (
            <div className="ribbon-side-head">
              {shownAt !== ALL_TOOLS && <button className="ribbon-side-back" onClick={() => choose(ALL_TOOLS)} title="Înapoi la lista tuturor uneltelor">‹</button>}
              <b>{shownAt === ALL_TOOLS ? allLabel : tabs.find((t) => t.id === shownAt)?.label}</b>
              <button className="ribbon-side-close" onClick={() => setToolsOpen(false)} title="Închide panoul de unelte (se redeschide din bara de sus)" aria-label="Închide panoul de unelte">✕</button>
            </div>
          )}
          {tools && (
            <div className="ribbon-panel ribbon-toollist" role="tabpanel" data-tab={ALL_TOOLS} data-label={allLabel} hidden={shownAt !== ALL_TOOLS}>
              {(toolList ?? []).filter((it) => it.run || tabs.some((t) => t.id === it.tab)).map((it) => (
                <button key={it.label} className="ribbon-tool" title={it.title} onClick={() => { if (it.tab) choose(it.tab); else it.run?.(); }}>
                  <span className="ribbon-tool-ico" aria-hidden="true">{it.icon}</span><span>{it.label}</span>
                </button>
              ))}
            </div>
          )}
          {tabs.filter((t) => t.id !== pinned).map((t) => (
            <div key={t.id} className="ribbon-panel" role="tabpanel" data-tab={t.id} data-label={t.label}
              hidden={(menus ? menuOf(t.id) !== openMenu : t.id !== shownAt) || (t.contextual && !t.shown)}
              onClick={(e) => { if (peek && (e.target as Element).closest('button')) setTimeout(() => setPeek(false), 0); }}>
              {(!t.contextual || t.shown) && t.content}
              {barOn && t.id === shownAt && (
                <button className="ribbon-toolbar-close" onClick={() => choose(ALL_TOOLS)} title={`Închide grupul de unelte ${t.label} și revino la lista tuturor uneltelor`}>✕ Închide</button>
              )}
            </div>
          ))}
        </div>
        {tools && taskRail && globalBtns}
        {tips && (
          <div className="keytips-layer" aria-hidden="true">
            {tips.items.filter((it) => it.code.startsWith(tips.buf) && (it.u || !tips.mouse)).map((it) => it.u
              ? <span key={it.code} className="keytip-u" data-code={it.code} style={{ left: it.u.x, top: it.u.y, width: it.u.w }} />
              : <span key={it.code} className="keytip" style={{ left: it.x, top: it.y }}>{it.code}</span>)}
          </div>
        )}
        {file && (
          <div className={`ribbon-backstage${menus ? ' ribbon-filemenu' : ''}`} hidden={!fileOpen} role="dialog" aria-label="Fișier"
            onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); setFileOpen(false); } }}
            onClick={(e) => { const b = (e.target as Element).closest('button'); if (b && !b.classList.contains('ribbon-keep')) setFileOpen(false); }}
            onChange={() => setFileOpen(false)}>
            <div className="ribbon-backstage-list">
              <button className="ribbon-back ribbon-keep" onClick={() => setFileOpen(false)} title="Înapoi la document (Esc)">← Înapoi</button>
              {file}
            </div>
            <div className="ribbon-backstage-rest" onMouseDown={() => setFileOpen(false)}>
              {recent && (
                <div className="ribbon-recent" onMouseDown={(e) => e.stopPropagation()} aria-label="Fișiere recente">
                  <div className="ribbon-head">Recente</div>
                  {recentList.length ? recentList.map((r) => {
                    const name = r.path.split(/[\\/]/).pop() ?? r.path;
                    return (
                      <button key={r.path} className="ribbon-recent-item" title={r.path} onClick={() => { setFileOpen(false); recent.open(r.path); }}>
                        <span>{name}</span><small>{r.path.slice(0, Math.max(0, r.path.length - name.length - 1))}</small>
                      </button>
                    );
                  }) : <p className="muted">Niciun fișier deschis de curând.</p>}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Ctx.Provider>
  );
}

/** Un grup din panglică, cu numele lui dedesubt. `keep`: se strânge ultimul (Clipboard).
 *  `launcher`: butonul mic ⇲ din colțul de jos al grupului, care deschide fereastra cu toate opțiunile grupului. */
export function RGroup({ label, children, keep, className, launcher }: { label: string; children: ReactNode; keep?: boolean; className?: string; launcher?: { title: string; run(): void } }) {
  return (
    <div className={'ribbon-group' + (className ? ' ' + className : '')} data-label={label} data-keep={keep ? '1' : undefined}>
      <div className="ribbon-group-body">{children}</div>
      <button className="ribbon-group-toggle" onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => { const g = (e.currentTarget.parentElement as HTMLElement); g.classList.toggle('open'); }}
        title={`Comenzile din grupul ${label}`} aria-label={`Grupul ${label}`}>{label} ▾</button>
      <div className="ribbon-group-label">{label}</div>
      {launcher && (
        <button className="ribbon-launcher" onMouseDown={(e) => e.preventDefault()} onClick={launcher.run} title={launcher.title} aria-label={`Toate opțiunile: ${label}`}>⇲</button>
      )}
    </div>
  );
}

/** Buton mare împărțit (pictogramă sus, nume jos): partea de sus face acțiunea, ▾ de dedesubt deschide variantele. */
export function RSplit({ icon, label, title, run, items, keytip }: { icon: ReactNode; label: string; title: string; run?: () => void; items: RMenuItem[]; keytip?: string }) {
  const { closeAll } = useContext(Ctx);
  // Fără `run`, și partea de sus deschide lista (ca „Format ▾”).
  const toggle = (b: HTMLElement) => { const m = b.parentElement as HTMLElement; const was = m.classList.contains('open'); closeAll(); if (!was) m.classList.add('open'); };
  return (
    <span className="ribbon-more ribbon-menu rb-split">
      <button className="rb-big" onMouseDown={(e) => e.preventDefault()} onClick={(e) => { if (run) { closeAll(); run(); } else toggle(e.currentTarget); }} title={title} aria-label={label}>
        <span className="rb-ico">{icon}</span><span className="rb-txt">{label}</span>
      </button>
      <button className="rb-drop" data-keytip={keytip} onMouseDown={(e) => e.preventDefault()} aria-haspopup="menu" title={`${label}: variante`} aria-label={`${label} ▾`}
        onClick={(e) => { const m = e.currentTarget.parentElement as HTMLElement; const was = m.classList.contains('open'); closeAll(); if (!was) m.classList.add('open'); }}>▾</button>
      <span className="ribbon-more-pop" role="menu" aria-label={label}>
        {items.map((it, i) => (
          <button key={i} role={it.checked === undefined ? 'menuitem' : 'menuitemradio'} aria-checked={it.checked} data-keytip={it.keytip}
            className={`ribbon-menu-item${it.checked ? ' on' : ''}${it.sep ? ' sep' : ''}`} title={it.title ?? it.label}
            onMouseDown={(e) => e.preventDefault()} onClick={() => { closeAll(); it.run(); }}>
            <span className="ribbon-menu-check">{it.checked ? '✓' : ''}</span>{it.label}
          </button>
        ))}
      </span>
    </span>
  );
}

/** „⋯” la capătul unui grup: restul comenzilor lui, cu text. */
export function RMore({ children, label = 'Mai multe' }: { children: ReactNode; label?: string }) {
  const { closeAll } = useContext(Ctx);
  return (
    <span className="ribbon-more">
      <button className="fmt ribbon-more-btn" onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => { const m = e.currentTarget.parentElement as HTMLElement; const was = m.classList.contains('open'); closeAll(); if (!was) m.classList.add('open'); }}
        title={`${label}: restul comenzilor din grup`} aria-label={label}>⋯</button>
      <span className="ribbon-more-pop">{children}</span>
    </span>
  );
}

/** Buton mic cu listă al cărei conținut e liber („Borduri ▾”: variante + liste / culori); clicul pe un `.ribbon-menu-item` o închide. */
export function RPop({ icon, label, title, keytip, children }: { icon: ReactNode; label: string; title: string; keytip?: string; children: ReactNode }) {
  const { closeAll } = useContext(Ctx);
  return (
    <span className="ribbon-more ribbon-menu">
      <button className="fmt" data-keytip={keytip} onMouseDown={(e) => e.preventDefault()} aria-haspopup="menu" title={title} aria-label={label}
        onClick={(e) => { const m = e.currentTarget.parentElement as HTMLElement; const was = m.classList.contains('open'); closeAll(); if (!was) m.classList.add('open'); }}>
        {icon} ▾
      </button>
      <span className="ribbon-more-pop" role="menu" aria-label={label}
        onClick={(e) => { if ((e.target as HTMLElement).closest('.ribbon-menu-item')) closeAll(); }}>{children}</span>
    </span>
  );
}

export interface RMenuItem { label: string; title?: string; checked?: boolean; run(): void; sep?: boolean; /** Litera la Alt (ca în programul cunoscut), altfel una aleasă din nume. */ keytip?: string }

/** Buton cu listă („Margini ▾”): alegerile rapide; un clic pe rând îl aplică și închide lista. */
export function RMenu({ label, title, items, active, keytip, ariaLabel, disabled }: { label: string; title: string; items: RMenuItem[]; active?: boolean; keytip?: string; ariaLabel?: string; disabled?: boolean }) {
  const { closeAll } = useContext(Ctx);
  return (
    <span className="ribbon-more ribbon-menu">
      <button className={active ? 'active' : ''} data-keytip={keytip} disabled={disabled} onMouseDown={(e) => e.preventDefault()} aria-haspopup="menu" title={title} aria-label={ariaLabel}
        onClick={(e) => { const m = e.currentTarget.parentElement as HTMLElement; const was = m.classList.contains('open'); closeAll(); if (!was) m.classList.add('open'); }}>
        {label} ▾
      </button>
      <span className="ribbon-more-pop" role="menu" aria-label={label}>
        {items.map((it, i) => (
          <button key={i} role="menuitemradio" aria-checked={!!it.checked} className={`ribbon-menu-item${it.checked ? ' on' : ''}${it.sep ? ' sep' : ''}`}
            title={it.title ?? it.label} onMouseDown={(e) => e.preventDefault()} data-keytip={it.keytip}
            onClick={() => { closeAll(); it.run(); }}>
            <span className="ribbon-menu-check">{it.checked ? '✓' : ''}</span>{it.label}
          </button>
        ))}
      </span>
    </span>
  );
}

/** Grupurile filei vizibile se strâng de la dreapta spre stânga până încape rândul (cele cu `keep` la urmă). */
function useCollapse(rootRef: React.RefObject<HTMLDivElement>, active: string | undefined, relayoutRef: { current: () => void }, off = false, airy = false) {
  useLayoutEffect(() => {
    const root = rootRef.current;
    // În panoul de unelte (modul „tools”) grupurile stau unul sub altul și nu se strâng.
    if (!root) return;
    // Fără strângere (unelte, meniuri): treptele rămase din panglică (compact, wrap, grupuri strânse) se scot, altfel listele le moștenesc.
    if (off) {
      root.querySelectorAll<HTMLElement>('.ribbon-panel').forEach((p) => p.classList.remove('compact', 'wrap', 'tight'));
      root.querySelectorAll<HTMLElement>('.ribbon-group.collapsed').forEach((g) => g.classList.remove('collapsed'));
      return;
    }
    // Aerisit: se strânge doar bara de sub meniuri; listele meniurilor pierd treptele rămase din panglică.
    if (airy) {
      root.querySelectorAll<HTMLElement>(':scope > .ribbon-body .ribbon-panel').forEach((p) => p.classList.remove('compact', 'wrap', 'tight'));
      root.querySelectorAll<HTMLElement>(':scope > .ribbon-body .ribbon-group.collapsed').forEach((g) => g.classList.remove('collapsed'));
    }
    let frame = 0;
    const layout = () => {
      frame = 0;
      const panel = root.querySelector<HTMLElement>(airy ? ':scope > .ribbon-airybar:not([hidden]) > .ribbon-panel' : '.ribbon-panel:not([hidden])');
      if (!panel) return;
      const groups = [...panel.querySelectorAll<HTMLElement>(':scope > .ribbon-group, :scope > .ribbon-slot .ribbon-group')];
      const open = new Set(groups.filter((g) => g.classList.contains('open')));
      groups.forEach((g) => g.classList.remove('collapsed'));
      panel.classList.remove('compact', 'wrap', 'tight');
      const close = panel.querySelector<HTMLElement>(':scope > .ribbon-toolbar-close');
      const avail = panel.clientWidth - (close ? close.offsetWidth + 12 : 0);
      const gap = 1;
      const widths = () => groups.map((g) => g.offsetWidth + gap);
      let full = widths();
      let total = full.reduce((a, b) => a + b, 0);
      // Prima treaptă, ca în programele cunoscute: butoanele mici își pierd textul (.rb-opt), abia apoi se strâng grupurile.
      if (total > avail && panel.querySelector('.rb-opt')) { panel.classList.add('compact'); full = widths(); total = full.reduce((a, b) => a + b, 0); }
      // A doua treaptă: numele butoanelor mari se rup pe două rânduri („Formatare / condiționată”), ca în programele cunoscute.
      if (total > avail && panel.querySelector('.rb-big .rb-txt')) { panel.classList.add('wrap'); full = widths(); total = full.reduce((a, b) => a + b, 0); }
      if (total <= avail) { open.forEach((g) => g.classList.remove('open')); return; }
      // Un grup strâns rămâne un buton mare: pictograma primului lui buton, cu numele grupului dedesubt.
      groups.forEach((g) => {
        const t = g.querySelector<HTMLElement>(':scope > .ribbon-group-toggle');
        const ico = g.querySelector('.ribbon-group-body .rb-ico, .ribbon-group-body .rb-small')?.textContent?.trim() ?? '';
        const first = [...ico][0] ?? '';
        if (t && t.dataset.ico !== first) t.dataset.ico = first;
      });
      const order = [...groups.keys()].reverse().sort((a, b) => Number(!!groups[a].dataset.keep) - Number(!!groups[b].dataset.keep));
      for (const i of order) {
        if (total <= avail) break;
        groups[i].classList.add('collapsed');
        const small = groups[i].offsetWidth + gap;
        if (small >= full[i]) { groups[i].classList.remove('collapsed'); continue; }
        total += small - full[i];
      }
      // Ultima treaptă, când nici strânse nu încap: butoanele mari rămân doar cu pictograma (numele e în titlu),
      // apoi grupurile se strâng din nou, de la dreapta, doar cât e nevoie.
      if (total > avail && panel.querySelector('.rb-big')) {
        groups.forEach((g) => g.classList.remove('collapsed'));
        panel.classList.add('tight');
        full = widths(); total = full.reduce((a, b) => a + b, 0);
        for (const i of order) {
          if (total <= avail) break;
          groups[i].classList.add('collapsed');
          const small = groups[i].offsetWidth + gap;
          if (small >= full[i]) { groups[i].classList.remove('collapsed'); continue; }
          total += small - full[i];
        }
      }
      groups.forEach((g) => { if (!g.classList.contains('collapsed')) g.classList.remove('open'); });
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(layout); };
    layout();
    relayoutRef.current = layout;
    const ro = new ResizeObserver(schedule);
    ro.observe(root);
    root.querySelectorAll('.ribbon-panel:not([hidden]) .ribbon-group-body').forEach((b) => ro.observe(b));
    return () => { ro.disconnect(); if (frame) cancelAnimationFrame(frame); };
  });
  void active;
}

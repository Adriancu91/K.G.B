// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Modul prezentare: slide-urile pe tot ecranul, unul câte unul.
// Înainte: →, ↓, Spațiu, Enter, PageDown, click. Înapoi: ←, ↑, Backspace, PageUp. Home / End, B = ecran negru, W = ecran alb, Esc = ieșire.
// G (sau −) arată toate slide-urile, ca să sari la oricare. Număr + Enter sare la slide-ul acela (și la unul ascuns). Slide-urile ascunse se sar la Înainte / Înapoi.
// V comută vizualizarea prezentatorului: slide-ul curent, următorul, notițele, cronometrul și ora (Alt+F5 pornește direct așa).
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { api } from '../api';
import SlideView from './SlideView';
import { isVideo } from './media';
import { playTrSound } from './trSound';
import { startNarration, type Narration } from './narration';
import { isWebLink, jumpIndex } from './links';
import { sectionEnd } from './sections';
import { animCount, Deck, deckSize, showProps, nextShown, prevShown, Slide, slideMarks, deckTheme, triggers, morphPairs, trSeconds, trStyle } from './model';

/** Primul slide care se arată (sare peste cele ascunse de la început). */
const firstShown = (deck: Deck) => (deck.slides[0]?.hidden ? nextShown(deck, 0) : 0);

interface Props {
  deck: Deck;
  start: number;
  presenter?: boolean;
  /** ⏱ Repetiție: măsoară cât stai pe fiecare slide (fără avans automat); la ieșire dă timpii, în secunde, pe id-ul slide-ului. */
  rehearse?: boolean;
  /** 🎙 Înregistrare cu narațiune (merge împreună cu `rehearse`): vocea de la microfon, slide cu slide; la ieșire dă bucățile pe id-ul slide-ului. */
  narrate?: boolean;
  /** Vizualizarea citire: prezentarea în fereastră (fără ecran complet), cu o bară jos pentru slide-uri. */
  windowed?: boolean;
  /** Ecranul publicului: 'auto' (celălalt monitor), 'none' (doar ecranul acesta) sau id-ul monitorului ales. */
  monitor?: string;
  /** ink: desenele făcute cu creionul / markerul, ca poze, pe id-ul slide-ului (doar dacă s-a desenat ceva). */
  onExit(at: number, times?: Record<string, number>, ink?: Record<string, InkPic>, narr?: Record<string, Blob[]>): void;
}

/** O linie desenată în prezentare: traseul (în coordonatele slide-ului), culoarea, grosimea și opacitatea (markerul e pe jumătate transparent). */
export interface Stroke { d: string; c: string; w: number; o: number }
/** Desenele păstrate după prezentare: poza (PNG transparent) și locul ei pe slide. */
export interface InkPic { src: string; x: number; y: number; w: number; h: number }
export const PEN_COLORS = ['#e11d48', '#2563eb', '#16a34a', '#111111', '#ffffff'];
export const MARK_COLORS = ['#facc15', '#4ade80', '#38bdf8', '#f472b6'];
const COLOR_NAMES: Record<string, string> = { '#e11d48': 'roșu', '#2563eb': 'albastru', '#16a34a': 'verde', '#111111': 'negru', '#ffffff': 'alb', '#facc15': 'galben', '#4ade80': 'verde deschis', '#38bdf8': 'bleu', '#f472b6': 'roz' };

/** Desenele unui slide ca poză PNG transparentă, tăiată cât ocupă liniile (plus grosimea lor). */
export function inkPic(strokes: Stroke[], W: number, H: number): InkPic | null {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const st of strokes) {
    const v = st.d.match(/-?[0-9.]+/g)?.map(Number) ?? [];
    for (let k = 0; k + 1 < v.length; k += 2) {
      x0 = Math.min(x0, v[k] - st.w); x1 = Math.max(x1, v[k] + st.w);
      y0 = Math.min(y0, v[k + 1] - st.w); y1 = Math.max(y1, v[k + 1] + st.w);
    }
  }
  x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0)); x1 = Math.min(W, Math.ceil(x1)); y1 = Math.min(H, Math.ceil(y1));
  if (!(x1 > x0 && y1 > y0)) return null;
  const c = document.createElement('canvas');
  c.width = x1 - x0; c.height = y1 - y0;
  const g = c.getContext('2d');
  if (!g) return null;
  g.translate(-x0, -y0);
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const st of strokes) { g.globalAlpha = st.o; g.strokeStyle = st.c; g.lineWidth = st.w; g.stroke(new Path2D(st.d)); }
  return { src: c.toDataURL('image/png'), x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

const two = (x: number) => String(x).padStart(2, '0');
function clock(sec: number) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h ? `${h}:${two(m)}:${two(s)}` : `${two(m)}:${two(s)}`;
}

export default function Show({ deck, start, presenter: startPresenter = false, rehearse = false, narrate = false, windowed = false, monitor, onExit }: Props) {
  const n = deck.slides.length;
  // i === n înseamnă ecranul negru de final („Sfârșitul prezentării”), ca în PowerPoint.
  // „De la început” sare peste slide-urile ascunse de la început; un slide ascuns ales anume se arată.
  const [i, setI] = useState(() => (start === 0 && deck.slides[0]?.hidden ? Math.min(nextShown(deck, 0), n - 1) : Math.min(start, n - 1)));
  // Câte casete cu animație au apărut pe slide-ul curent (fiecare click în plus mai arată una).
  const [step, setStep] = useState(0);
  // Declanșatoarele apăsate pe slide-ul curent (casetele care au pornit animațiile legate de ele); se golesc la alt slide.
  const [fired, setFired] = useState<string[]>([]);
  const go = (to: number, st = 0) => { setScreen(null); setI(to); setStep(st); setFired([]); };
  // Zoom de slide: după slide-ul la care a dus miniatura, prezentarea revine la slide-ul cu miniatura (ca „Revenire la zoom”).
  const [ret, setRet] = useState<{ from: number; step: number; to: number } | null>(null);
  // Ecranul negru (B) sau alb (W) acoperă slide-ul până la următoarea apăsare.
  const [screen, setScreen] = useState<'black' | 'white' | null>(null);
  const black = screen !== null;
  const toggle = (c: 'black' | 'white') => setScreen(screen === c ? null : c);
  // „Vezi toate slide-urile” (G sau −): grila din care sari la orice slide.
  const [all, setAll] = useState(false);
  // Cifrele scrise pentru „număr + Enter” (dispar după 3 secunde).
  const [typed, setTyped] = useState('');
  // Unelte în prezentare, ca în PowerPoint: indicatorul laser (Ctrl+L) și creionul (Ctrl+P; E șterge desenul de pe slide, Esc oprește unealta).
  // Markerul (Ctrl+I) desenează gros și pe jumătate transparent. Culorile se aleg din bulinele de lângă unealtă.
  // Desenele țin cât durează prezentarea, pe fiecare slide; la ieșire poți să le păstrezi pe slide-uri (ca poze).
  const [tool, setTool] = useState<null | 'laser' | 'pen' | 'marker'>(null);
  const drawTool = tool === 'pen' || tool === 'marker';
  const [penColor, setPenColor] = useState(PEN_COLORS[0]);
  const [markColor, setMarkColor] = useState(MARK_COLORS[0]);
  const [ink, setInk] = useState<Record<number, Stroke[]>>({});
  const inkRef = useRef(ink);
  inkRef.current = ink;
  const exited = useRef(false);
  const [laserAt, setLaserAt] = useState<{ x: number; y: number } | null>(null);
  const drawing = useRef(false);
  const typedTimer = useRef<number>();
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  const SZ = deckSize(deck);
  const [cursor, setCursor] = useState(true);
  const [presenter, setPresenter] = useState(startPresenter);
  // Cronometrul: secundele scurse (fără pauze); „now” ține ora afișată.
  const [now, setNow] = useState(Date.now());
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [noteSize, setNoteSize] = useState(22);

  useEffect(() => { root.current?.focus(); }, [presenter]);

  // Sunetele cu „Continuă pe slide-urile următoare” le redă prezentarea, nu slide-ul, ca să nu se oprească la slide-ul următor.
  // Un sunet nou de același fel îl înlocuiește pe cel vechi; la ieșirea din prezentare se oprește.
  const bg = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    const el = i < n ? deck.slides[i]?.els.find((e) => e.kind === 'media' && e.across && e.src && !isVideo(e)) : undefined;
    if (!el || bg.current?.dataset.el === el.id) return;
    bg.current?.pause();
    bg.current?.remove();
    const a = document.createElement('audio');
    a.className = 'sl-bg-audio';
    a.dataset.el = el.id;
    a.src = el.src!;
    a.loop = !!el.loop;
    a.volume = Math.max(0, Math.min(1, el.vol ?? 1));
    a.hidden = true;
    document.body.appendChild(a);
    bg.current = a;
    a.play().catch(() => { /* fără voie de redare: tăcere */ });
  }, [i]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { bg.current?.pause(); bg.current?.remove(); bg.current = null; }, []);
  // Sunetul tranziției: se aude când slide-ul intră (la fiecare intrare, ca în PowerPoint).
  useEffect(() => { if (i < n) playTrSound(deck.slides[i]?.trSound); }, [i]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const t = window.setInterval(() => {
      setNow(Date.now());
      if (!paused) setElapsed((x) => x + 1);
    }, 1000);
    return () => window.clearInterval(t);
  }, [paused]);
  const root = useRef<HTMLDivElement>(null);
  const iRef = useRef(i);
  iRef.current = i;
  // Repetiția: milisecundele petrecute pe fiecare slide. `seg` = bucata de acum (slide-ul, de când, dacă era pe pauză).
  const times = useRef<Record<string, number>>({});
  const seg = useRef({ i, t: Date.now(), p: paused });
  const flush = () => {
    const s = seg.current, t = Date.now(), id = deck.slides[s.i]?.id;
    if (id && !s.p) times.current[id] = (times.current[id] ?? 0) + t - s.t;
    seg.current = { i: iRef.current, t, p: paused };
  };
  useEffect(() => { flush(); }, [i, paused]); // eslint-disable-line react-hooks/exhaustive-deps
  // Narațiunea: microfonul pornește odată cu prezentarea; fiecare slide primește bucata lui, pauza oprește și înregistrarea.
  const nar = useRef<Narration | null>(null);
  const [narErr, setNarErr] = useState('');
  const [narOn, setNarOn] = useState(false);
  useEffect(() => {
    if (!narrate) return;
    let dead = false;
    startNarration().then((r) => {
      if (dead || exited.current) { r.cancel(); return; }
      nar.current = r;
      if (seg.current.p) r.pause();
      r.switchTo(deck.slides[iRef.current]?.id ?? null);
      setNarOn(true);
    }, (e) => setNarErr(e instanceof Error ? e.message : 'Microfonul nu se poate folosi.'));
    return () => { dead = true; if (!exited.current) nar.current?.cancel(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const r = nar.current;
    if (!r) return;
    if (paused) r.pause(); else r.resume();
    r.switchTo(i < n ? deck.slides[i]?.id ?? null : null);
  }, [i, paused]); // eslint-disable-line react-hooks/exhaustive-deps
  const exit = () => {
    if (exited.current) return;
    exited.current = true;
    flush();
    const secs: Record<string, number> = {};
    for (const [id, ms] of Object.entries(times.current)) if (ms >= 500) secs[id] = Math.round(ms / 100) / 10;
    const pics: Record<string, InkPic> = {};
    for (const [k, l] of Object.entries(inkRef.current)) {
      const id = deck.slides[+k]?.id;
      const p = id && l.length ? inkPic(l, SZ.w, SZ.h) : null;
      if (id && p) pics[id] = p;
    }
    const done = (narr?: Record<string, Blob[]>) => onExit(Math.min(iRef.current, n - 1), rehearse ? secs : undefined, Object.keys(pics).length ? pics : undefined, narr && Object.keys(narr).length ? narr : undefined);
    const r = nar.current;
    nar.current = null;
    if (r) r.finish().then(done, () => done()); else done();
  };

  useEffect(() => {
    const el = root.current;
    el?.focus();
    // Ecran complet adevărat (fără bara ferestrei); dacă Windows nu-l permite, rămâne pe toată fereastra.
    // Pe toată pagina, nu pe element: comutarea cu V înlocuiește elementul și n-ar trebui să iasă din ecranul complet.
    if (!windowed) document.documentElement.requestFullscreen?.().catch(() => {});
    const onFs = () => { if (!document.fullscreenElement && !windowed) exit(); };
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    document.addEventListener('fullscreenchange', onFs);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('fullscreenchange', onFs);
      window.removeEventListener('resize', onResize);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Săgeata mouse-ului dispare după 2 secunde fără mișcare.
  const hideTimer = useRef<number>();
  const wake = () => {
    setCursor(true);
    window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setCursor(false), 2000);
  };
  useEffect(() => { wake(); return () => window.clearTimeout(hideTimer.current); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const next = () => {
    const s = deck.slides[i];
    if (s && step < animCount(s)) { setScreen(null); setStep(step + 1); return; }
    if (i >= n) { exit(); return; }
    if (ret && ret.to === i) { setRet(null); go(ret.from, ret.step); return; }
    const j = nextShown(deck, i);
    // În buclă (kiosk), după ultimul slide o ia de la capăt.
    go(j >= n && (deck.loop || deck.kiosk) && firstShown(deck) < n ? firstShown(deck) : j);
  };
  // Click pe o casetă cu legătură: adresa se deschide în browser, saltul duce la slide; altfel, click = înainte.
  // Acțiunea casetei (la clic sau la trecerea mouse-ului): sunetul ei, apoi legătura; true dacă s-a făcut ceva.
  // Zoom de secțiune: revenirea vine după ultimul slide neascuns al secțiunii (cel puțin slide-ul la care s-a sărit).
  const zoomEnd = (j: number) => { let e = sectionEnd(deck.slides, j); while (e > j && deck.slides[e]?.hidden) e--; return e; };
  const act = (box: Element): boolean => {
    const snd = box.getAttribute('data-snd');
    if (snd) playTrSound(snd);
    const link = box.getAttribute('data-link');
    if (link) {
      if (isWebLink(link)) { window.open(link, '_blank'); return true; }
      // Următorul / anteriorul sar peste slide-urile ascunse, ca în PowerPoint.
      const j = link === '#next' ? nextShown(deck, i) : link === '#prev' ? Math.max(0, prevShown(deck, i)) : jumpIndex(deck, link, i);
      if (j !== null) { setRet(box.hasAttribute('data-zoom') && j !== i ? { from: i, step, to: box.getAttribute('data-zoom') === 'sec' ? zoomEnd(j) : j } : null); go(j); return true; }
    }
    return !!snd;
  };
  // Trecerea mouse-ului: acțiunea pornește o dată la intrarea pe casetă (din nou doar după ce mouse-ul a ieșit de pe ea).
  const hoverBox = useRef<Element | null>(null);
  // Doar o mișcare adevărată a mouse-ului pornește acțiunea: dacă slide-ul apare sub un mouse care stă pe loc (de exemplu
  // la ▶ De la început, cu mouse-ul exact unde e titlul), prezentarea nu mai sare singură la slide-ul următor.
  const movedOnSlide = useRef(false);
  useEffect(() => { movedOnSlide.current = false; hoverBox.current = null; }, [i]);
  const onShowOver = (e: { target: EventTarget }) => {
    if (!movedOnSlide.current) return;
    const box = (e.target as HTMLElement).closest?.('[data-hover]') ?? null;
    if (box === hoverBox.current) return;
    hoverBox.current = box;
    if (box && !deck.kiosk) act(box);
  };
  const onShowClick = (e: { target: EventTarget }) => {
    const box = (e.target as HTMLElement).closest?.('[data-link], [data-snd]');
    if (box && !box.hasAttribute('data-hover') && act(box)) return;
    // Click pe un declanșator: pornește animațiile legate de el, fără să treacă mai departe.
    const tb = (e.target as HTMLElement).closest?.('[data-el]')?.getAttribute('data-el');
    const cur = deck.slides[i];
    if (tb && cur && !fired.includes(tb) && triggers(cur.els).includes(tb)) { setScreen(null); setFired([...fired, tb]); return; }
    // La chioșc, clicul pe slide nu mută prezentarea (merge singură).
    if (!deck.kiosk) next();
  };
  // Înapoi: întâi ascunde ultima casetă apărută, apoi trece la slide-ul anterior cu tot ce era pe el.
  const prev = () => {
    const j = prevShown(deck, i);
    if (step > 0) { setScreen(null); setStep(step - 1); } else if (j >= 0) go(j, animCount(deck.slides[j])); else setScreen(null);
  };

  // Avans automat: după secundele slide-ului trece mai departe (pe ecran negru / alb și cât cronometrul e oprit, așteaptă).
  const nextRef = useRef(next);
  nextRef.current = next;
  const autoSec = i < n && !black && !paused && !all && !rehearse && !(deck.noTimings && !deck.kiosk) ? deck.slides[i]?.advance : undefined;
  useEffect(() => {
    if (!autoSec) return;
    const t = window.setTimeout(() => nextRef.current(), autoSec * 1000);
    return () => window.clearTimeout(t);
  }, [autoSec, i, step]);

  // Întoarce false pentru tastele care nu țin de prezentare.
  const handleKey = (k: string) => {
    // La chioșc merge doar Esc (oprește prezentarea); celelalte taste nu fac nimic.
    if (deck.kiosk) { if (k === 'Escape') exit(); return true; }
    if (/^[0-9]$/.test(k)) {
      setTyped((t) => (t + k).slice(-4));
      window.clearTimeout(typedTimer.current);
      typedTimer.current = window.setTimeout(() => setTyped(''), 3000);
      return true;
    }
    // Grila „Toate slide-urile” deschisă: Esc / G / − o închid, restul tastelor nu mută prezentarea pe dedesubt.
    if (all) {
      if (['Escape', 'g', 'G', '-'].includes(k)) setAll(false);
      return true;
    }
    if (k === 'Enter' && typed) {
      const to = Math.min(Math.max(+typed, 1), n) - 1;
      setTyped('');
      go(to);
      return true;
    }
    if (typed) setTyped('');
    if (k === 'Escape' && tool) { setTool(null); return true; }
    if ((k === 'e' || k === 'E') && ink[i]?.length) { setInk((m) => ({ ...m, [i]: [] })); return true; }
    if (['ArrowRight', 'ArrowDown', ' ', 'Enter', 'PageDown', 'n', 'N'].includes(k)) next();
    else if (['ArrowLeft', 'ArrowUp', 'Backspace', 'PageUp', 'p', 'P'].includes(k)) prev();
    else if (k === 'Home') go(deck.slides[0]?.hidden ? Math.min(nextShown(deck, 0), n - 1) : 0);
    else if (k === 'End') { const j = Math.max(0, prevShown(deck, n)); go(j, animCount(deck.slides[j])); }
    else if (k === 'b' || k === 'B' || k === '.') toggle('black');
    else if (k === 'w' || k === 'W' || k === ',') toggle('white');
    else if (k === 'v' || k === 'V') setPresenter(!presenter);
    else if (k === 'g' || k === 'G' || k === '-') setAll(true);
    else if (k === 'Escape') exit();
    else return false;
    return true;
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.ctrlKey && /^[lLpPiIaA]$/.test(e.key)) {
      // Ctrl+L laser, Ctrl+P creion, Ctrl+I marker, Ctrl+A înapoi la săgeată (ca în PowerPoint).
      e.preventDefault();
      const kk = e.key.toLowerCase();
      const t = kk === 'l' ? 'laser' : kk === 'p' ? 'pen' : kk === 'i' ? 'marker' : null;
      setTool((cur) => (t && cur !== t ? t : null));
      return;
    }
    if (e.altKey && (e.key === 'End' || e.key === 'Home') && jumpBookmark(e.key === 'End')) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (!handleKey(e.key)) return;
    e.preventDefault();
    e.stopPropagation();
  };
  /** Alt+End / Alt+Home: clipul de pe slide (cel care rulează, altfel primul cu semne) sare la semnul de carte următor / anterior. */
  const jumpBookmark = (next: boolean) => {
    const all = [...(root.current?.querySelectorAll<HTMLMediaElement>('video[data-bmk], audio[data-bmk]') ?? [])];
    const m = all.find((x) => !x.paused) ?? all[0];
    if (!m) return false;
    const marks = (m.dataset.bmk ?? '').split(' ').map(Number).filter((t) => Number.isFinite(t));
    const now = m.currentTime;
    const t = next ? marks.find((x) => x > now + 0.05) : [...marks].reverse().find((x) => x < now - 0.3);
    if (t === undefined) return true;
    m.currentTime = t;
    return true;
  };

  // Al doilea monitor (proiector): publicul vede doar slide-ul acolo, iar aici rămâne vizualizarea prezentatorului.
  // Cu un singur ecran, `open` întoarce false și totul rămâne ca înainte.
  const [twoScreens, setTwoScreens] = useState(false);
  const keyRef = useRef(handleKey);
  keyRef.current = handleKey;
  useEffect(() => {
    const a = api.audience;
    if (!a) return;
    let alive = true;
    const offs = [a.onKey((k) => keyRef.current(k)), a.onClosed(() => setTwoScreens(false))];
    a.open(monitor).then((ok) => {
      if (!alive || !ok) return;
      a.send({ deck, i: iRef.current, step: 0, black: false, white: false });
      setTwoScreens(true);
      setPresenter(true);
    });
    return () => { alive = false; offs.forEach((off) => off()); a.close(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (twoScreens) api.audience?.send({ i, step, fired, black: screen === 'black', white: screen === 'white' }); }, [twoScreens, i, step, fired, screen]);

  const slide = deck.slides[i];
  const theme = deckTheme(deck);
  // Slide-ul de dinainte rămâne pe ecran cât ține tranziția noului slide (Împingere, Acoperire, Descoperire, Estompare peste el).
  // Se schimbă chiar în timpul desenării, ca să nu apară niciun cadru gol între ele.
  const [shown, setShown] = useState<{ cur?: Slide; old?: Slide }>({ cur: slide });
  if (shown.cur?.id !== slide?.id) setShown({ cur: slide, old: slide && shown.cur && slide.transition !== 'none' ? shown.cur : undefined });
  useEffect(() => {
    if (!shown.old || !shown.cur) return;
    const t = window.setTimeout(() => setShown((x) => ({ cur: x.cur })), trSeconds(shown.cur) * 1000 + 60);
    return () => window.clearTimeout(t);
  }, [shown]);
  // Transformare: elementele care apar pe ambele slide-uri pornesc din locul, mărimea și rotirea de pe slide-ul vechi și alunecă
  // spre cele noi; elementele noi apar treptat, iar restul slide-ului vechi se stinge (slides.css, out-morph).
  const curBox = useRef<HTMLDivElement>(null), oldBox = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const cur = shown.cur, old = shown.old;
    if (!cur || !old || cur.transition !== 'morph' || !curBox.current || !oldBox.current) return;
    const ms = trSeconds(cur) * 1000;
    const pairs = morphPairs(old, cur);
    const from = new Map(pairs.map(([a, b]) => [b, old.els.find((e) => e.id === a)!]));
    const anims: Animation[] = [];
    for (const [a] of pairs) oldBox.current.querySelector(`[data-el="${CSS.escape(a)}"]`)?.setAttribute('data-morphed', '');
    for (const n of cur.els) {
      const node = curBox.current.querySelector<HTMLElement>(`[data-el="${CSS.escape(n.id)}"]`);
      if (!node || !node.animate) continue;
      const o = from.get(n.id);
      if (!o) { anims.push(node.animate([{ opacity: 0 }, { opacity: 1 }], { duration: ms, easing: 'ease' })); continue; }
      // Elementele stau în slide-ul mărit (scale pe ramă), deci deplasarea e în unitățile slide-ului.
      const dx = o.x + o.w / 2 - (n.x + n.w / 2), dy = o.y + o.h / 2 - (n.y + n.h / 2);
      const sx = n.w > 0 ? o.w / n.w : 1, sy = n.h > 0 ? o.h / n.h : 1;
      const end = getComputedStyle(node).transform;
      const rest = end && end !== 'none' ? end : '';
      const turn = ((o.rot ?? 0) - (n.rot ?? 0));
      anims.push(node.animate([
        { transform: `translate(${dx}px, ${dy}px) rotate(${turn}deg) scale(${sx}, ${sy}) ${rest}`.trim() },
        { transform: rest || 'none' },
      ], { duration: ms, easing: 'ease-in-out' }));
    }
    return () => anims.forEach((x) => x.cancel());
  }, [shown]);
  // Grila „Toate slide-urile” (pe ecranul publicului rămâne slide-ul curent).
  const gridScale = Math.min(220 / SZ.w, 220 / SZ.h);
  const allGrid = all && (
    <div className="sl-show-all" role="dialog" aria-label="Toate slide-urile" onClick={(e) => e.stopPropagation()} onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}>
      <div className="sl-show-all-head">
        Toate slide-urile: click pe unul ca să sari la el
        <button onClick={() => setAll(false)} title="Esc">✕ Închide</button>
      </div>
      <div className="sl-show-all-grid">
        {deck.slides.map((s, j) => (
          <button key={s.id} className={`sl-show-all-item ${j === i ? 'on' : ''} ${s.hidden ? 'hidden-slide' : ''}`} onClick={() => { setAll(false); go(j); }}>
            <SlideView slide={s} {...slideMarks(deck, s)} theme={theme} scale={gridScale} size={SZ} />
            <span>{j + 1}{s.hidden ? ' (ascuns)' : ''}</span>
          </button>
        ))}
      </div>
    </div>
  );

  // Laserul și creionul: punctul de pe slide (în coordonatele slide-ului), atât pe tot ecranul cât și în vizualizarea prezentatorului.
  const slidePt = (e: { clientX: number; clientY: number }) => {
    const r = root.current?.querySelector('.sl-show-slide, .sl-pres-cur .sl-pres-frame')?.getBoundingClientRect();
    return r ? `${Math.round(((e.clientX - r.left) / r.width) * SZ.w)} ${Math.round(((e.clientY - r.top) / r.height) * SZ.h)}` : null;
  };
  const penDown = (e: React.PointerEvent) => {
    if (!drawTool || e.button !== 0 || !slide) return;
    const pt = slidePt(e);
    if (!pt) return;
    drawing.current = true;
    const d = `M${pt} L${pt}`;
    const st: Stroke = tool === 'marker' ? { d, c: markColor, w: 24, o: 0.4 } : { d, c: penColor, w: 5, o: 1 };
    setInk((m) => ({ ...m, [i]: [...(m[i] ?? []), st] }));
  };
  const penMove = (e: React.PointerEvent) => {
    if (tool === 'laser') setLaserAt({ x: e.clientX, y: e.clientY });
    if (!drawing.current || !drawTool) return;
    const pt = slidePt(e);
    if (pt) setInk((m) => { const l = (m[i] ?? []).slice(); const z = l[l.length - 1]; if (z) l[l.length - 1] = { ...z, d: z.d + ' ' + pt }; return { ...m, [i]: l }; });
  };
  const inkSvg = !!ink[i]?.length && (
    <svg className="sl-ink" viewBox={`0 0 ${SZ.w} ${SZ.h}`} aria-hidden="true">
      {ink[i].map((st, k) => <path key={k} d={st.d} style={{ stroke: st.c, strokeWidth: st.w, strokeOpacity: st.o }} />)}
    </svg>
  );
  const laserDot = tool === 'laser' && laserAt && <div className="sl-laser" style={{ left: laserAt.x, top: laserAt.y }} />;
  // Bulinele de culoare ale creionului / markerului (nu pornesc desenul și nu iau focusul).
  const swatches = drawTool && (
    <span className="sl-ink-colors" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.preventDefault()}>
      {(tool === 'marker' ? MARK_COLORS : PEN_COLORS).map((c) => {
        const on = c === (tool === 'marker' ? markColor : penColor);
        return <button key={c} className={on ? 'on' : ''} style={{ background: c }} aria-pressed={on} title={'Culoarea: ' + COLOR_NAMES[c]} aria-label={'Culoarea ' + COLOR_NAMES[c]}
          onClick={() => (tool === 'marker' ? setMarkColor(c) : setPenColor(c))} />;
      })}
    </span>
  );
  const toolHint = tool && (
    <div className="sl-show-tool">
      {tool === 'pen' ? '✏ Creion' : tool === 'marker' ? '🖍 Marker' : '🔴 Laser · Esc oprește'}
      {swatches}
      {drawTool && 'E șterge · Esc oprește'}
    </div>
  );
  if (presenter) {
    // Stânga: slide-ul curent, mare. Dreapta: următorul slide și notițele. Sus: cronometrul, ora și poziția.
    const side = Math.max(240, Math.min(size.w * 0.32, 520));
    const curScale = Math.max(0.1, Math.min((size.w - side - 72) / SZ.w, (size.h - 150) / SZ.h));
    const nextScale = Math.min(side / SZ.w, side / SZ.h);
    const nxt = deck.slides[nextShown(deck, i)];
    const d = new Date(now);
    return (
      <div ref={root} className="sl-show sl-pres" tabIndex={-1} onKeyDown={onKey} role="presentation"
        // Butoanele nu iau focusul, ca Spațiul și Enter să meargă tot la slide-ul următor.
        onMouseDown={(e) => { if ((e.target as HTMLElement).closest('button')) e.preventDefault(); }}
        aria-label={`Vizualizarea prezentatorului, slide ${Math.min(i + 1, n)} din ${n}`}>
        <div className="sl-pres-top">
          <span className="sl-pres-timer" title="Timpul scurs de la pornire">{clock(elapsed)}</span>
          <button onClick={() => setPaused(!paused)}>{paused ? '▶ Continuă' : '⏸ Pauză'}</button>
          <button onClick={() => setElapsed(0)} title="Cronometrul pornește de la zero">↺ De la zero</button>
          <span className="sl-pres-clock" title="Ora">{two(d.getHours())}:{two(d.getMinutes())}</span>
          <span className="sl-pres-pos">Slide {Math.min(i + 1, n)} din {n}{slide?.hidden ? ' (ascuns)' : ''}</span>
          {typed && <span className="sl-pres-pos" title="Enter sare la slide-ul acesta">Mergi la slide-ul {typed} (Enter)</span>}
          {autoSec ? <span className="sl-pres-pos" title="Slide-ul trece singur mai departe; ⏸ Pauză îl oprește">⏱ Avans automat: {String(autoSec).replace('.', ',')} s</span> : null}
          {deck.kiosk ? <span className="sl-pres-pos" title="Merge singură, în buclă; clicurile nu o mută; Esc o oprește">🖥 Chioșc</span> : deck.loop && <span className="sl-pres-pos" title="După ultimul slide o ia de la capăt, până la Esc">🔁 În buclă</span>}
          {slide && animCount(slide) > step && <span className="sl-pres-pos">Încă {animCount(slide) - step} {animCount(slide) - step === 1 ? 'animație' : 'animații'} pe slide</span>}
          {twoScreens && <span className="sl-pres-pos" title="Doar tu vezi ecranul acesta">📽 Publicul vede slide-ul pe al doilea ecran</span>}
          <span className="sl-pres-grow" />
          <button onClick={() => toggle('black')} title="B">{screen === 'black' ? 'Arată slide-ul' : '■ Ecran negru'}</button>
          <button onClick={() => toggle('white')} title="W">{screen === 'white' ? 'Arată slide-ul' : '□ Ecran alb'}</button>
          <button onClick={() => setPresenter(false)} title="V: doar slide-ul, pe tot ecranul">Doar slide-ul</button>
          <button onClick={() => setAll(true)} title="G: toate slide-urile, ca să sari la oricare (publicul nu vede grila)">▦ Toate</button>
          <button className={tool === 'laser' ? 'on' : ''} onClick={() => setTool(tool === 'laser' ? null : 'laser')} title="Ctrl+L: indicatorul laser pe slide-ul curent">🔴 Laser</button>
          <button className={tool === 'pen' ? 'on' : ''} onClick={() => setTool(tool === 'pen' ? null : 'pen')} title="Ctrl+P: desenezi pe slide-ul curent; E șterge desenul">✏ Creion</button>
          <button className={tool === 'marker' ? 'on' : ''} onClick={() => setTool(tool === 'marker' ? null : 'marker')} title="Ctrl+I: marker gros, transparent, ca să scoți în evidență; E șterge desenul">🖍 Marker</button>
          <button onClick={exit} title="Esc">✕ Termină</button>
        </div>
        <div className="sl-pres-main">
          <div className="sl-pres-cur">
            <div
              className={`sl-pres-frame ${tool ? `tool-${tool}` : ''}`}
              style={{ width: SZ.w * curScale, height: SZ.h * curScale }}
              onPointerDown={penDown}
              onPointerMove={penMove}
              onPointerUp={() => { drawing.current = false; }}
              onPointerLeave={() => { drawing.current = false; setLaserAt(null); }}
            >
              {black ? <div className={`sl-pres-black ${screen === 'white' ? 'white' : ''}`}>{screen === 'white' ? 'Ecran alb (W)' : 'Ecran negru (B)'}</div> : slide ? (
                <SlideView {...slideMarks(deck, slide)} theme={theme} scale={curScale} size={SZ} {...showProps(slide, step, fired)} quiet={twoScreens} />
              ) : <div className="sl-pres-black">Sfârșitul prezentării</div>}
              {!black && inkSvg}
            </div>
            <div className="sl-pres-nav">
              <button onClick={prev} disabled={i === 0}>◀ Înapoi</button>
              <button className="primary" onClick={next}>{i >= n ? 'Ieșire' : 'Înainte ▶'}</button>
            </div>
          </div>
          <div className="sl-pres-side" style={{ width: side }}>
            <div className="sl-pres-label">Urmează</div>
            <div className="sl-pres-frame" style={{ width: SZ.w * nextScale, height: SZ.h * nextScale }}>
              {nxt ? <SlideView slide={nxt} {...slideMarks(deck, nxt)} theme={theme} scale={nextScale} size={SZ} />
                : <div className="sl-pres-black">{i < n ? 'Sfârșitul prezentării' : ''}</div>}
            </div>
            <div className="sl-pres-label">
              Notițe
              <span className="sl-pres-grow" />
              <button onClick={() => setNoteSize(Math.max(14, noteSize - 4))} title="Text mai mic">A−</button>
              <button onClick={() => setNoteSize(Math.min(48, noteSize + 4))} title="Text mai mare">A+</button>
            </div>
            <div className="sl-pres-notes" style={{ fontSize: noteSize }}>
              {slide?.notes.trim() ? slide.notes : <span className="sl-pres-empty">Fără notițe la acest slide.</span>}
            </div>
          </div>
        </div>
        {laserDot}
        {toolHint}
        {allGrid}
      </div>
    );
  }

  // În citire, jos rămâne loc pentru bara cu slide-urile.
  const READ_BAR = 44;
  const scale = Math.min(size.w / SZ.w, (size.h - (windowed ? READ_BAR : 0)) / SZ.h);
  return (
    <div
      ref={root}
      className={`sl-show${windowed ? ' sl-reading' : ''} ${cursor || windowed ? '' : 'no-cursor'} ${screen === 'white' ? 'white' : ''} ${tool ? `tool-${tool}` : ''}`}
      tabIndex={-1}
      onKeyDown={onKey}
      onMouseMove={(e) => { wake(); if (!movedOnSlide.current && (e.movementX || e.movementY)) { movedOnSlide.current = true; if (!drawTool) onShowOver(e); } }}
      onPointerDown={penDown}
      onPointerMove={penMove}
      onPointerUp={() => { drawing.current = false; }}
      onPointerLeave={() => setLaserAt(null)}
      onClick={(e) => { if (!drawTool) onShowClick(e); }}
      onMouseOver={(e) => { if (!drawTool) onShowOver(e); }}
      onContextMenu={(e) => { e.preventDefault(); if (!deck.kiosk) prev(); }}
      role="presentation"
      aria-label={`Slide ${Math.min(i + 1, n)} din ${n}`}
    >
      {black ? null : slide ? (
        <>
        <div key={slide.id} ref={curBox} className={`sl-show-slide tr-${slide.transition ?? 'fade'}`} style={trStyle(slide)}>
          <SlideView {...slideMarks(deck, slide)} theme={theme} scale={scale} size={SZ} {...showProps(slide, step, fired)} />
          {inkSvg}
        </div>
        {shown.old && shown.old.id !== slide.id && (
          <div key={'old-' + shown.old.id} ref={oldBox} className={`sl-show-slide sl-show-old out-${slide.transition ?? 'fade'}`} style={trStyle(slide)} aria-hidden="true">
            <SlideView slide={shown.old} {...slideMarks(deck, shown.old)} theme={theme} scale={scale} size={SZ} />
          </div>
        )}
        </>
      ) : (
        <div className="sl-show-end">Sfârșitul prezentării. Click sau Esc pentru ieșire.</div>
      )}
      {typed && <div className="sl-show-goto" aria-live="polite">Slide {typed} ↵</div>}
      {rehearse && i < n && (() => {
        // Cât stai pe slide-ul acesta (cu ce s-a strâns înainte, dacă te-ai întors la el) și totalul.
        const id = deck.slides[i]?.id ?? '';
        const here = Math.floor(((times.current[id] ?? 0) + (seg.current.p || seg.current.i !== i ? 0 : now - seg.current.t)) / 1000);
        return (
          <div className="sl-rehearse" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()} onMouseDown={(e) => e.preventDefault()}>
            <span title="Cât ai stat pe slide-ul acesta">⏱ <b className="sl-rehearse-slide">{clock(Math.max(0, here))}</b></span>
            <button onClick={() => setPaused(!paused)} title="Oprește / pornește cronometrul">{paused ? '▶' : '⏸'}</button>
            <button onClick={() => { times.current[id] = 0; seg.current = { i, t: Date.now(), p: paused }; setNow(Date.now()); }} title="Măsoară din nou slide-ul acesta">↺</button>
            <span title="Timpul total al prezentării">Total <b className="sl-rehearse-total">{clock(elapsed)}</b></span>
            {narrate && (narErr ? <span className="sl-narr-err" title={narErr}>🎙 fără microfon</span>
              : <span className={'sl-narr' + (narOn && !paused ? ' on' : '')} title="Vocea de la microfon se înregistrează pe slide-ul acesta (pauza oprește și înregistrarea)">{narOn ? (paused ? '🎙 pauză' : '● Se înregistrează') : '🎙 …'}</span>)}
          </div>
        );
      })()}
      {windowed && (
        <div className="sl-read-bar" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()} onMouseDown={(e) => e.preventDefault()}
          onContextMenu={(e) => e.stopPropagation()}>
          <button onClick={prev} disabled={i === 0 && step === 0} title="Înapoi (←)" aria-label="Înapoi">◀</button>
          <span className="sl-read-pos">{i < n ? `Slide ${i + 1} din ${n}` : 'Sfârșit'}</span>
          <button onClick={next} disabled={i >= n} title="Înainte (→, Spațiu, clic pe slide)" aria-label="Înainte">▶</button>
          <button onClick={() => setAll(true)} title="Toate slide-urile (G)">▦</button>
          <button className="sl-read-close" onClick={exit} title="Închide citirea (Esc)">✕ Închide</button>
        </div>
      )}
      {laserDot}
      {toolHint}
      {allGrid}
    </div>
  );
}

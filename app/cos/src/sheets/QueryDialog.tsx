// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Fereastra „Editor de interogare” (Date → Preluare date → Din tabel / zonă…): pașii aplicați datelor, cu previzualizarea
// rezultatului după fiecare schimbare; „Închide și încarcă” pune rezultatul pe o foaie nouă (vezi query.ts).
import { useMemo, useState } from 'react';
import { MAX_QSTEPS, parseQExpr, Q_AGGS, Q_CALC_OPS, Q_CASES, Q_EXTRACTS, Q_JOINS, Q_DATES, Q_MATH_NOARG, Q_MATHS, Q_MOVES, Q_OPS, Q_ROUNDS, Q_TYPES, QAgg, QCalcOp, QCase, QDate, QExtract, QGroupAgg, QJoin, QMath, QMove, QOp, QRound, QOther, QStep, QTable, QType, runQuery, stepLabel } from './query';

const PREVIEW = 50;
type Kind = QStep['k'];
// Pașii pe grupe, ca lista „Pas nou” (aproape 40 de pași) să se citească ușor.
const KIND_GROUPS: [string, [Kind, string][]][] = [
  ['Rânduri', [
    ['filter', 'Filtrează rândurile'], ['sort', 'Sortează'], ['dedupe', 'Elimină dublurile'], ['keepdup', 'Păstrează doar dublurile'],
    ['noblank', 'Elimină rândurile goale'], ['noerr', 'Elimină rândurile cu erori'], ['top', 'Păstrează primele rânduri'], ['range', 'Păstrează un interval de rânduri'],
    ['skip', 'Elimină primele rânduri'], ['skipb', 'Elimină ultimele rânduri'], ['reverse', 'Inversează rândurile'], ['fill', 'Umple celulele goale'],
  ]],
  ['Coloane', [
    ['keep', 'Alege coloanele'], ['drop', 'Elimină coloanele'], ['rename', 'Redenumește o coloană'], ['move', 'Mută coloana'], ['dup', 'Duplică coloana'], ['mcols', 'Îmbină coloanele'],
    ['split', 'Împarte coloana după separator'], ['calc', 'Coloană calculată'], ['custom', 'Coloană personalizată (formulă)'], ['cond', 'Coloană condițională'], ['index', 'Coloană index'], ['type', 'Schimbă tipul'],
  ]],
  ['Text', [['replace', 'Înlocuiește valorile'], ['case', 'Formatează textul'], ['extract', 'Extrage din text']]],
  ['Numere și date', [['math', 'Calcul pe coloană'], ['round', 'Rotunjește'], ['date', 'Din dată']]],
  ['Tabel', [
    ['group', 'Grupează după'], ['pivot', 'Pivotează coloana'], ['unpivot', 'Anulează pivotarea coloanelor'], ['transpose', 'Transpune'],
    ['promote', 'Primul rând ca nume de coloane'],
  ]],
  ['Combină', [['merge', 'Îmbină cu alt tabel'], ['append', 'Adaugă dedesubt alt tabel']]],
];

export default function QueryDialog({ source, table, initial, sources, other, onLoad, onClose, fileSheets, fileSheet, onFileSheet }: {
  source: string; table: QTable; initial?: QStep[]; sources: string[]; other: QOther; onLoad(steps: QStep[]): void; onClose(): void;
  /** Sursa e un registru de pe calculator: foile lui, cea folosită acum și schimbarea ei (pașii rămân). */
  fileSheets?: string[]; fileSheet?: string; onFileSheet?(name: string): void;
}) {
  const [steps, setSteps] = useState<QStep[]>(initial ?? []);
  const [kind, setKind] = useState<Kind>('filter');
  const { table: out, skipped } = useMemo(() => runQuery(table, steps, other), [table, steps, other]);
  const head = out.head;
  const [col, setCol] = useState('');
  const [op, setOp] = useState<QOp>('eq');
  const [val, setVal] = useState('');
  const [desc, setDesc] = useState(false);
  const [to, setTo] = useState('');
  const [n, setN] = useState('10');
  const [keep, setKeep] = useState<string[] | null>(null);
  const [agg, setAgg] = useState<QAgg>('sum');
  const [of, setOf] = useState('');
  const [cop, setCop] = useState<QCalcOp>('*');
  const [bCol, setBCol] = useState(true);
  const [b, setB] = useState('');
  const [cname, setCname] = useState('');
  const [rFrom, setRFrom] = useState('');
  const [rTo, setRTo] = useState('');
  const [whole, setWhole] = useState(false);
  const [sep, setSep] = useState(',');
  const [cs, setCs] = useState<QCase>('title');
  const [src2, setSrc2] = useState('');
  const [col2, setCol2] = useState('');
  const [how, setHow] = useState<QJoin>('left');
  const [mcols, setMcols] = useState<string[] | null>(null);
  const [up, setUp] = useState(false);
  const [upc, setUpc] = useState<string[]>([]);
  const [ifrom, setIfrom] = useState('1');
  const [thenV, setThenV] = useState('');
  const [elseV, setElseV] = useState('');
  const [ty, setTy] = useState<QType>('dec');
  const [mc, setMc] = useState<string[]>([]);
  const [ex, setEx] = useState<QExtract>('first');
  const [gby, setGby] = useState<string[]>([]);
  const [gmore, setGmore] = useState<QGroupAgg[]>([]);
  const [rh, setRh] = useState<QRound>('round');
  const [rn, setRn] = useState('2');
  const [dh, setDh] = useState<QDate>('year');
  const [mo, setMo] = useState<QMath>('add');
  const [mv, setMv] = useState('');
  const [mto, setMto] = useState<QMove>('first');
  const [rfrom, setRfrom] = useState('1');
  const [dropc, setDropc] = useState<string[]>([]);
  const [expr, setExpr] = useState('');
  const exprChk = useMemo(() => { const r = parseQExpr(expr); return 'err' in r ? r.err : r.cols.filter((x) => !head.includes(x)).map((x) => `Nu există coloana „${x}”`)[0] ?? ''; }, [expr, head]);
  // Celălalt tabel: cel ales sau primul din listă; coloana lui de potrivire: cea aleasă, cea cu același nume sau prima.
  const s2 = sources.includes(src2) ? src2 : sources[0] ?? '';
  const head2 = useMemo(() => (s2 ? other(s2)?.head ?? [] : []), [s2, other]);
  const c = head.includes(col) ? col : head[0] ?? '';
  const kept = keep ?? head;
  // O coloană aleasă din listă: dacă nu mai există (după alți pași), prima coloană.
  const pick = (h: string) => (head.includes(h) ? h : head[0] ?? '');
  const k2 = head2.includes(col2) ? col2 : head2.includes(c) ? c : head2[0] ?? '';
  const brought = mcols ?? head2.filter((h) => h !== k2);

  const add = () => {
    let s: QStep | null = null;
    if (kind === 'keep') s = kept.length ? { k: 'keep', cols: head.filter((h) => kept.includes(h)) } : null;
    else if (kind === 'filter') s = { k: 'filter', col: c, op, v: val };
    else if (kind === 'sort') s = { k: 'sort', col: c, desc };
    else if (kind === 'rename') s = to.trim() ? { k: 'rename', col: c, to: to.trim() } : null;
    else if (kind === 'top') s = Number(n) >= 0 ? { k: 'top', n: Math.floor(Number(n)) } : null;
    else if (kind === 'group') {
      const by = head.filter((h) => h !== c && gby.includes(h));
      const more = gmore.map((m) => (m.agg === 'count' ? { agg: m.agg } : { agg: m.agg, of: pick(m.of ?? '') }));
      s = { k: 'group', col: c, agg, ...(agg === 'count' ? {} : { of: pick(of) }), ...(by.length ? { by } : {}), ...(more.length ? { more } : {}) };
    }
    else if (kind === 'replace') s = rFrom !== '' ? { k: 'replace', col: c, from: rFrom, to: rTo, whole } : null;
    else if (kind === 'case') s = { k: 'case', col: c, how: cs };
    else if (kind === 'split') s = sep !== '' ? { k: 'split', col: c, sep } : null;
    else if (kind === 'merge') s = s2 && k2 && (how === 'anti' || brought.length) ? { k: 'merge', src: s2, col: c, col2: k2, how, cols: brought.length === head2.length - 1 && !brought.includes(k2) ? [] : head2.filter((h) => brought.includes(h)) } : null;
    else if (kind === 'append') s = s2 ? { k: 'append', src: s2 } : null;
    else if (kind === 'pivot') { const v = pick(of); s = v && v !== c ? { k: 'pivot', col: c, val: v, agg } : null; }
    else if (kind === 'cond') s = cname.trim() ? { k: 'cond', name: cname.trim(), col: c, op, v: val, then: thenV, else: elseV } : null;
    else if (kind === 'type') s = { k: 'type', col: c, to: ty };
    else if (kind === 'mcols') { const u = head.filter((h) => mc.includes(h)); s = u.length > 1 ? { k: 'mcols', cols: u, sep, name: cname.trim() || 'Îmbinat' } : null; }
    else if (kind === 'dup') s = { k: 'dup', col: c };
    else if (kind === 'date') s = { k: 'date', col: c, how: dh };
    else if (kind === 'round') s = rn.trim() !== '' && Number.isFinite(Number(rn)) ? { k: 'round', col: c, how: rh, n: Math.floor(Number(rn)) } : null;
    else if (kind === 'extract') {
      const byN = ex === 'first' || ex === 'last', bySep = ex === 'before' || ex === 'after';
      s = byN && !(Number(n) >= 0) ? null : bySep && sep === '' ? null : { k: 'extract', col: c, how: ex, v: byN ? String(Math.floor(Number(n))) : bySep ? sep : '' };
    }
    else if (kind === 'skip') s = Number(n) >= 0 ? { k: 'skip', n: Math.floor(Number(n)) } : null;
    else if (kind === 'skipb') s = Number(n) >= 0 ? { k: 'skipb', n: Math.floor(Number(n)) } : null;
    else if (kind === 'reverse') s = { k: 'reverse' };
    else if (kind === 'noerr') s = { k: 'noerr' };
    else if (kind === 'custom') s = cname.trim() && !exprChk && !head.includes(cname.trim()) ? { k: 'custom', name: cname.trim(), expr: expr.trim() } : null;
    else if (kind === 'drop') { const u = head.filter((h) => dropc.includes(h)); s = u.length && u.length < head.length ? { k: 'drop', cols: u } : null; }
    else if (kind === 'move') s = { k: 'move', col: c, to: mto };
    else if (kind === 'keepdup') s = { k: 'keepdup', col: c };
    else if (kind === 'range') s = Number(rfrom) >= 1 && Number(n) >= 0 ? { k: 'range', from: Math.floor(Number(rfrom)), n: Math.floor(Number(n)) } : null;
    else if (kind === 'math') {
      const noArg = Q_MATH_NOARG.includes(mo), txt = mo === 'prefix' || mo === 'suffix';
      s = noArg ? { k: 'math', col: c, op: mo, v: '' } : txt ? (mv !== '' ? { k: 'math', col: c, op: mo, v: mv } : null)
        : mv.trim() !== '' && Number.isFinite(Number(mv.replace(',', '.'))) ? { k: 'math', col: c, op: mo, v: mv.trim() } : null;
    }
    else if (kind === 'fill') s = { k: 'fill', col: c, up };
    else if (kind === 'unpivot') { const u = head.filter((h) => upc.includes(h)); s = u.length && u.length < head.length ? { k: 'unpivot', cols: u } : null; }
    else if (kind === 'index') s = ifrom.trim() !== '' && Number.isFinite(Number(ifrom)) ? { k: 'index', from: Math.floor(Number(ifrom)) } : null;
    else if (kind === 'calc') s = cname.trim() && (bCol || b !== '') ? { k: 'calc', name: cname.trim(), a: c, op: cop, b: bCol ? pick(b) : b, bCol } : null;
    else s = { k: kind };
    if (!s || steps.length >= MAX_QSTEPS) return;
    setSteps([...steps, s]);
    setKeep(null); setTo(''); setVal(''); setCname(''); setMcols(null); setRFrom(''); setRTo(''); setUpc([]); setThenV(''); setElseV(''); setMc([]); setGby([]); setGmore([]);
  };

  const colPick = (
    <label className="print-row"><span className="print-label">Coloana</span>
      <select aria-label="Coloana" value={c} onChange={(e) => setCol(e.target.value)}>
        {head.map((h) => <option key={h} value={h}>{h}</option>)}
      </select>
    </label>
  );

  return (
    <div className="print-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="print-dlg" role="dialog" aria-label="Editor de interogare" data-testid="query-dlg" style={{ width: 'min(980px, 96vw)', maxHeight: '92vh', overflow: 'auto' }}
        onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } }}>
        <h3>Editor de interogare</h3>
        <p className="print-info">Sursa: {source} ({table.rows.length} {table.rows.length === 1 ? 'rând' : 'rânduri'}, {table.head.length} coloane). Sursa rămâne neatinsă; rezultatul merge pe o foaie nouă și se face din nou cu Date → Reîmprospătare totală.</p>
        {fileSheets && fileSheets.length > 1 && onFileSheet && (
          <label className="print-row"><span className="print-label">Foaia din registru</span>
            <select aria-label="Foaia din registru" data-testid="query-fsheet" value={fileSheet ?? ''} onChange={(e) => onFileSheet(e.target.value)}>
              {fileSheets.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </label>
        )}
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 260, flex: '0 0 300px' }}>
            <b>Pașii aplicați</b>
            <ol data-testid="query-steps" style={{ margin: '6px 0', paddingLeft: 22 }}>
              <li>Sursa</li>
              {steps.map((s, i) => (
                <li key={i} style={skipped.includes(i + 1) ? { color: '#b45309' } : undefined}
                  title={skipped.includes(i + 1) ? 'Pasul e sărit: coloana lui nu mai există (sau numele nou e deja folosit)' : undefined}>
                  {stepLabel(s)}{' '}
                  <button aria-label={`Șterge pasul ${i + 1}`} title="Șterge pasul" onClick={() => setSteps(steps.filter((_, j) => j !== i))}>×</button>
                </li>
              ))}
            </ol>
            <label className="print-row"><span className="print-label">Pas nou</span>
              <select aria-label="Pas nou" data-testid="query-kind" value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
                {KIND_GROUPS.map(([g, ks]) => (
                  <optgroup key={g} label={g}>{ks.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</optgroup>
                ))}
              </select>
            </label>
            {kind === 'custom' && (<>
              <label className="print-row"><span className="print-label">Numele coloanei noi</span>
                <input aria-label="Numele coloanei noi" placeholder="Total" value={cname} onChange={(e) => setCname(e.target.value)} />
              </label>
              <label className="print-row"><span className="print-label">Formula</span>
                <input aria-label="Formula" data-testid="query-expr" placeholder="[Preț] * [Cantitate] * 1.19" value={expr} onChange={(e) => setExpr(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(); }} />
              </label>
              <div style={{ fontSize: 12, opacity: 0.8, margin: '2px 0 4px' }}>
                Coloanele în paranteze drepte, + − * / ^, text între ghilimele, & lipește textul. Clic pe o coloană o pune în formulă:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxHeight: 90, overflow: 'auto' }}>
                {head.map((h) => <button key={h} type="button" className="mini" onClick={() => setExpr((x) => `${x}${x && !/\s$/.test(x) ? ' ' : ''}[${h}]`)}>{h}</button>)}
              </div>
              {expr.trim() !== '' && exprChk && <div role="alert" style={{ color: 'var(--danger, #b00020)', fontSize: 12, marginTop: 4 }}>{exprChk}</div>}
            </>)}
            {kind === 'drop' && (
              <div data-testid="query-drop" style={{ maxHeight: 160, overflow: 'auto', margin: '4px 0' }}>
                {head.map((h) => (
                  <label key={h} className="print-row"><input type="checkbox" checked={dropc.includes(h)}
                    onChange={(e) => setDropc(e.target.checked ? [...dropc, h] : dropc.filter((x) => x !== h))} /> {h}</label>
                ))}
              </div>
            )}
            {kind === 'keep' && (
              <div style={{ maxHeight: 160, overflow: 'auto', margin: '4px 0' }}>
                {head.map((h) => (
                  <label key={h} className="print-row"><input type="checkbox" checked={kept.includes(h)}
                    onChange={(e) => setKeep(e.target.checked ? [...kept, h] : kept.filter((x) => x !== h))} /> {h}</label>
                ))}
              </div>
            )}
            {(kind === 'filter' || kind === 'sort' || kind === 'rename' || kind === 'group' || kind === 'calc' || kind === 'merge' || kind === 'replace' || kind === 'split' || kind === 'case' || kind === 'fill' || kind === 'pivot' || kind === 'cond' || kind === 'type' || kind === 'extract' || kind === 'dup' || kind === 'round' || kind === 'date' || kind === 'math' || kind === 'move' || kind === 'keepdup') && colPick}
            {kind === 'type' && (
              <label className="print-row"><span className="print-label">Tipul nou</span>
                <select aria-label="Tipul nou" value={ty} onChange={(e) => setTy(e.target.value as QType)}>
                  {Q_TYPES.map(([t, l]) => <option key={t} value={t}>{l}</option>)}
                </select>
              </label>
            )}
            {kind === 'pivot' && (<>
              <label className="print-row"><span className="print-label">Valorile din coloana</span>
                <select aria-label="Valorile din coloana" value={pick(of)} onChange={(e) => setOf(e.target.value)}>
                  {head.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </label>
              <label className="print-row"><span className="print-label">Calculează</span>
                <select aria-label="Calculează" value={agg} onChange={(e) => setAgg(e.target.value as QAgg)}>
                  {Q_AGGS.map(([a, l]) => <option key={a} value={a}>{l}</option>)}
                </select>
              </label>
              <p className="print-info">Fiecare valoare din coloana aleasă devine o coloană nouă.</p>
            </>)}
            {kind === 'fill' && (
              <label className="print-row"><input type="checkbox" checked={up} onChange={(e) => setUp(e.target.checked)} /> În sus (valoarea de dedesubt; altfel valoarea de deasupra)</label>
            )}
            {kind === 'unpivot' && (
              <div data-testid="query-unpivot" style={{ maxHeight: 160, overflow: 'auto', margin: '4px 0' }}>
                <span className="print-label">Coloanele care devin rânduri (Atribut / Valoare)</span>
                {head.map((h) => (
                  <label key={h} className="print-row"><input type="checkbox" checked={upc.includes(h)}
                    onChange={(e) => setUpc(e.target.checked ? [...upc, h] : upc.filter((x) => x !== h))} /> {h}</label>
                ))}
              </div>
            )}
            {kind === 'index' && (
              <label className="print-row"><span className="print-label">Începe de la</span>
                <input aria-label="Începe de la" type="number" value={ifrom} onChange={(e) => setIfrom(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(); }} />
              </label>
            )}
            {kind === 'case' && (
              <label className="print-row"><span className="print-label">Cum</span>
                <select aria-label="Cum se formatează" value={cs} onChange={(e) => setCs(e.target.value as QCase)}>
                  {Q_CASES.map(([h, l]) => <option key={h} value={h}>{l}</option>)}
                </select>
              </label>
            )}
            {kind === 'replace' && (<>
              <label className="print-row"><span className="print-label">Caută</span>
                <input aria-label="Valoarea de căutat" value={rFrom} onChange={(e) => setRFrom(e.target.value)} />
              </label>
              <label className="print-row"><span className="print-label">Înlocuiește cu</span>
                <input aria-label="Înlocuiește cu" value={rTo} onChange={(e) => setRTo(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(); }} />
              </label>
              <label className="print-row"><input type="checkbox" checked={whole} onChange={(e) => setWhole(e.target.checked)} /> Doar celulele cu toată valoarea la fel (altfel și bucăți din text)</label>
            </>)}
            {kind === 'mcols' && (<>
              <div data-testid="query-mcols" style={{ maxHeight: 160, overflow: 'auto', margin: '4px 0' }}>
                <span className="print-label">Coloanele de îmbinat (în ordinea bifării)</span>
                {head.map((h) => (
                  <label key={h} className="print-row"><input type="checkbox" checked={mc.includes(h)}
                    onChange={(e) => setMc(e.target.checked ? [...mc, h] : mc.filter((x) => x !== h))} /> {h}</label>
                ))}
              </div>
              <label className="print-row"><span className="print-label">Numele coloanei noi</span>
                <input aria-label="Numele coloanei noi" placeholder="Îmbinat" value={cname} onChange={(e) => setCname(e.target.value)} />
              </label>
            </>)}
            {kind === 'date' && (
              <label className="print-row"><span className="print-label">Ce iau din dată</span>
                <select aria-label="Ce iau din dată" value={dh} onChange={(e) => setDh(e.target.value as QDate)}>
                  {Q_DATES.map(([h, l]) => <option key={h} value={h}>{l}</option>)}
                </select>
              </label>
            )}
            {kind === 'round' && (<>
              <label className="print-row"><span className="print-label">Cum</span>
                <select aria-label="Cum se rotunjește" value={rh} onChange={(e) => setRh(e.target.value as QRound)}>
                  {Q_ROUNDS.map(([h, l]) => <option key={h} value={h}>{l}</option>)}
                </select>
              </label>
              <label className="print-row" title="0 = număr întreg; −1 = la zeci, −2 = la sute"><span className="print-label">Zecimale</span>
                <input aria-label="Zecimale" type="number" min={-10} max={10} value={rn} onChange={(e) => setRn(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(); }} />
              </label>
            </>)}
            {kind === 'extract' && (<>
              <label className="print-row"><span className="print-label">Ce extrag</span>
                <select aria-label="Ce extrag" value={ex} onChange={(e) => setEx(e.target.value as QExtract)}>
                  {Q_EXTRACTS.map(([h, l]) => <option key={h} value={h}>{l}</option>)}
                </select>
              </label>
              {(ex === 'first' || ex === 'last') && (
                <label className="print-row"><span className="print-label">Câte caractere</span>
                  <input aria-label="Câte caractere" type="number" min={0} value={n} onChange={(e) => setN(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(); }} />
                </label>
              )}
            </>)}
            {(kind === 'split' || kind === 'mcols' || (kind === 'extract' && (ex === 'before' || ex === 'after'))) && (
              <label className="print-row"><span className="print-label">Separatorul</span>
                <select aria-label="Separatorul" value={[',', ';', ' ', '-', '/', '|'].includes(sep) ? sep : 'alt'} onChange={(e) => setSep(e.target.value === 'alt' ? '' : e.target.value)}>
                  <option value=",">virgulă ,</option><option value=";">punct și virgulă ;</option><option value=" ">spațiu</option>
                  <option value="-">cratimă -</option><option value="/">bară /</option><option value="|">bară verticală |</option><option value="alt">altul…</option>
                </select>
                {![',', ';', ' ', '-', '/', '|'].includes(sep) && <input aria-label="Alt separator" value={sep} onChange={(e) => setSep(e.target.value)} style={{ width: 60 }} />}
              </label>
            )}
            {(kind === 'merge' || kind === 'append') && (sources.length ? (
              <label className="print-row"><span className="print-label">Celălalt tabel</span>
                <select aria-label="Celălalt tabel" data-testid="query-src2" value={s2} onChange={(e) => { setSrc2(e.target.value); setMcols(null); }}>
                  {sources.map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
              </label>
            ) : <p className="print-info">Registrul nu are alt tabel sau altă foaie cu date.</p>)}
            {kind === 'merge' && s2 && (<>
              <label className="print-row"><span className="print-label">Potrivește cu coloana</span>
                <select aria-label="Potrivește cu coloana" data-testid="query-col2" value={k2} onChange={(e) => { setCol2(e.target.value); setMcols(null); }}>
                  {head2.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
              </label>
              <label className="print-row"><span className="print-label">Felul îmbinării</span>
                <select aria-label="Felul îmbinării" data-testid="query-how" value={how} onChange={(e) => setHow(e.target.value as QJoin)}>
                  {Q_JOINS.map(([j, l]) => <option key={j} value={j}>{l}</option>)}
                </select>
              </label>
              {how !== 'anti' && (
                <div style={{ maxHeight: 140, overflow: 'auto', margin: '4px 0' }}>
                  <span className="print-label">Coloanele aduse</span>
                  {head2.filter((h) => h !== k2).map((h) => (
                    <label key={h} className="print-row"><input type="checkbox" checked={brought.includes(h)}
                      onChange={(e) => setMcols(e.target.checked ? [...brought, h] : brought.filter((x) => x !== h))} /> {h}</label>
                  ))}
                </div>
              )}
            </>)}
            {kind === 'group' && (<>
              <label className="print-row"><span className="print-label">Calculează</span>
                <select aria-label="Calculează" value={agg} onChange={(e) => setAgg(e.target.value as QAgg)}>
                  {Q_AGGS.map(([a, l]) => <option key={a} value={a}>{l}</option>)}
                </select>
              </label>
              {agg !== 'count' && (
                <label className="print-row"><span className="print-label">Din coloana</span>
                  <select aria-label="Din coloana" value={pick(of)} onChange={(e) => setOf(e.target.value)}>
                    {head.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </label>
              )}
              {gmore.map((m, j) => (
                <div key={j} className="print-row" data-testid="query-gmore">
                  <select aria-label={`Calculează ${j + 2}`} value={m.agg} onChange={(e) => setGmore(gmore.map((x, k) => (k === j ? { ...x, agg: e.target.value as QAgg } : x)))}>
                    {Q_AGGS.map(([a, l]) => <option key={a} value={a}>{l}</option>)}
                  </select>
                  {m.agg !== 'count' && (
                    <select aria-label={`Din coloana ${j + 2}`} value={pick(m.of ?? '')} onChange={(e) => setGmore(gmore.map((x, k) => (k === j ? { ...x, of: e.target.value } : x)))}>
                      {head.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                  )}
                  <button aria-label={`Scoate calculul ${j + 2}`} title="Scoate calculul" onClick={() => setGmore(gmore.filter((_, k) => k !== j))}>×</button>
                </div>
              ))}
              {gmore.length < 10 && <button data-testid="query-gmore-add" onClick={() => setGmore([...gmore, { agg: 'sum', of: pick(of) }])}>＋ Încă un calcul</button>}
              {head.length > 1 && (
                <div data-testid="query-gby" style={{ maxHeight: 120, overflow: 'auto', margin: '4px 0' }}>
                  <span className="print-label">Grupează și după (opțional)</span>
                  {head.filter((h) => h !== c).map((h) => (
                    <label key={h} className="print-row"><input type="checkbox" checked={gby.includes(h)}
                      onChange={(e) => setGby(e.target.checked ? [...gby, h] : gby.filter((x) => x !== h))} /> {h}</label>
                  ))}
                </div>
              )}
            </>)}
            {kind === 'calc' && (<>
              <label className="print-row"><span className="print-label">Operația</span>
                <select aria-label="Operația" value={cop} onChange={(e) => setCop(e.target.value as QCalcOp)}>
                  {Q_CALC_OPS.map(([o, l]) => <option key={o} value={o}>{l}</option>)}
                </select>
              </label>
              <label className="print-row"><input type="checkbox" checked={bCol} onChange={(e) => setBCol(e.target.checked)} /> Cu altă coloană (altfel cu un număr / text)</label>
              {bCol ? (
                <label className="print-row"><span className="print-label">A doua coloană</span>
                  <select aria-label="A doua coloană" value={pick(b)} onChange={(e) => setB(e.target.value)}>
                    {head.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </label>
              ) : (
                <label className="print-row"><span className="print-label">Valoarea</span>
                  <input aria-label="Valoarea" value={b} onChange={(e) => setB(e.target.value)} />
                </label>
              )}
              <label className="print-row"><span className="print-label">Numele coloanei noi</span>
                <input aria-label="Numele coloanei noi" value={cname} onChange={(e) => setCname(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(); }} />
              </label>
            </>)}
            {(kind === 'filter' || kind === 'cond') && (<>
              <label className="print-row"><span className="print-label">Condiția</span>
                <select aria-label="Condiția" value={op} onChange={(e) => setOp(e.target.value as QOp)}>
                  {Q_OPS.map(([o, l]) => <option key={o} value={o}>{l}</option>)}
                </select>
              </label>
              {op !== 'empty' && op !== 'full' && (
                <label className="print-row"><span className="print-label">Valoarea</span>
                  <input aria-label="Valoarea" data-testid="query-val" value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(); }} />
                </label>
              )}
            </>)}
            {kind === 'cond' && (<>
              <label className="print-row"><span className="print-label">Atunci</span>
                <input aria-label="Atunci" value={thenV} onChange={(e) => setThenV(e.target.value)} />
              </label>
              <label className="print-row"><span className="print-label">Altfel</span>
                <input aria-label="Altfel" value={elseV} onChange={(e) => setElseV(e.target.value)} />
              </label>
              <label className="print-row"><span className="print-label">Numele coloanei noi</span>
                <input aria-label="Numele coloanei noi" value={cname} onChange={(e) => setCname(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(); }} />
              </label>
            </>)}
            {kind === 'sort' && (
              <label className="print-row"><input type="checkbox" checked={desc} onChange={(e) => setDesc(e.target.checked)} /> Descrescător (de la mare la mic, Z → A)</label>
            )}
            {kind === 'rename' && (
              <label className="print-row"><span className="print-label">Numele nou</span>
                <input aria-label="Numele nou" value={to} onChange={(e) => setTo(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(); }} />
              </label>
            )}
            {kind === 'math' && (<>
              <label className="print-row"><span className="print-label">Calculul</span>
                <select aria-label="Calculul" value={mo} onChange={(e) => setMo(e.target.value as QMath)}>
                  {Q_MATHS.map(([o, l]) => <option key={o} value={o}>{l}</option>)}
                </select>
              </label>
              {!Q_MATH_NOARG.includes(mo) && (
                <label className="print-row"><span className="print-label">{mo === 'prefix' || mo === 'suffix' ? 'Textul' : 'Numărul'}</span>
                  <input aria-label="Numărul sau textul" value={mv} onChange={(e) => setMv(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(); }} />
                </label>
              )}
            </>)}
            {kind === 'move' && (
              <label className="print-row"><span className="print-label">Unde</span>
                <select aria-label="Unde se mută" value={mto} onChange={(e) => setMto(e.target.value as QMove)}>
                  {Q_MOVES.map(([m, l]) => <option key={m} value={m}>{l}</option>)}
                </select>
              </label>
            )}
            {kind === 'range' && (<>
              <label className="print-row"><span className="print-label">De la rândul</span>
                <input aria-label="De la rândul" type="number" min={1} value={rfrom} onChange={(e) => setRfrom(e.target.value)} />
              </label>
              <label className="print-row"><span className="print-label">Câte rânduri</span>
                <input aria-label="Câte rânduri" type="number" min={0} value={n} onChange={(e) => setN(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(); }} />
              </label>
            </>)}
            {kind === 'skipb' && (
              <label className="print-row"><span className="print-label">Câte rânduri</span>
                <input aria-label="Câte rânduri" type="number" min={0} value={n} onChange={(e) => setN(e.target.value)} />
              </label>
            )}
            {kind === 'skip' && (
              <label className="print-row"><span className="print-label">Câte rânduri</span>
                <input aria-label="Câte rânduri" type="number" min={0} value={n} onChange={(e) => setN(e.target.value)} />
              </label>
            )}
            {kind === 'top' && (
              <label className="print-row"><span className="print-label">Câte rânduri</span>
                <input aria-label="Câte rânduri" type="number" min={0} value={n} onChange={(e) => setN(e.target.value)} />
              </label>
            )}
            <button data-testid="query-add" onClick={add} disabled={!head.length || steps.length >= MAX_QSTEPS}>＋ Adaugă pasul</button>
          </div>
          <div style={{ flex: 1, minWidth: 300, overflow: 'auto', maxHeight: '60vh', border: '1px solid var(--line, #ccc)' }}>
            <table data-testid="query-preview" style={{ borderCollapse: 'collapse', fontSize: 12, width: '100%' }}>
              <thead><tr>{head.map((h) => <th key={h} style={{ textAlign: 'left', padding: '2px 6px', borderBottom: '1px solid #999', position: 'sticky', top: 0, background: 'var(--panel, #f3f3f3)' }}>{h}</th>)}</tr></thead>
              <tbody>
                {out.rows.slice(0, PREVIEW).map((r, i) => (
                  <tr key={i}>{r.map((v, j) => <td key={j} style={{ padding: '2px 6px', textAlign: typeof v === 'number' ? 'right' : 'left' }}>{String(v)}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <p className="print-info" data-testid="query-count">Rezultat: {out.rows.length} {out.rows.length === 1 ? 'rând' : 'rânduri'}, {head.length} coloane{out.rows.length > PREVIEW ? ` (se văd primele ${PREVIEW})` : ''}.</p>
        <div className="print-actions">
          <button onClick={onClose}>Renunță</button>
          <button className="primary" data-testid="query-load" autoFocus disabled={!head.length} onClick={() => onLoad(steps)}>Închide și încarcă</button>
        </div>
      </div>
    </div>
  );
}

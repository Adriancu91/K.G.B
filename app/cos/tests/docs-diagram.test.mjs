// Test pentru diagramele din Docs (diagram.ts): descrierea, elementele scrise pe rânduri, desenul fiecărui fel (SVG valid) și textul rupt pe rânduri.
// Rulare (în suite/): node tests/docs-diagram.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import { DOMParser } from '@xmldom/xmldom';

const out = join(tmpdir(), `suite-ddiag-${process.pid}.mjs`);
await build({ entryPoints: ['src/docs/diagram.ts'], bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const { parseDiagram, itemsFromText, levelsFromText, diagramText, diagramSvg, wrapText, diagramAlt, DOC_DIAGRAMS, newDiagram } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

let fail = 0;
const ok = (c, m) => { console.log((c ? 'ok: ' : 'GREȘIT: ') + m); if (!c) fail++; };
const N = String.fromCharCode(10), CR = String.fromCharCode(13);
ok(parseDiagram(JSON.stringify(newDiagram()))?.items.length === 4, 'diagrama nouă se citește înapoi');
ok(parseDiagram('{x') === null && parseDiagram({ items: [] }) === null && parseDiagram({ items: ['  '] }) === null, 'descrierile goale sau stricate sunt respinse');
const p = parseDiagram({ k: 'necunoscut', color: 'roșu', items: Array.from({ length: 20 }, (_, i) => `  Pas   ${i} `) });
ok(p.k === 'process' && p.color === '#4f6bed' && p.items.length === 8 && p.items[0] === 'Pas 0', 'fel / culoare greșite → implicite; cel mult 8 elemente, spațiile curățate');
ok(JSON.stringify(itemsFromText(['Unu', '', '  Doi  ', 'Trei'].join(CR + N))) === '["Unu","Doi","Trei"]', 'elementele, câte unul pe rând');
const w = wrapText('Un text destul de lung care trebuie rupt pe mai multe rânduri fără să iasă din cutie', 120, 14);
ok(w.length <= 3 && w.every((l) => l.length <= Math.floor(120 / (14 * 0.56))), 'textul se rupe în cutie: ' + JSON.stringify(w));
for (const [k] of DOC_DIAGRAMS) for (const n of [1, 2, 3, 5, 8]) {
  const d = { k, color: '#19a979', items: Array.from({ length: n }, (_, i) => `Element <${i}> & „ă”`) };
  const { svg, h } = diagramSvg(d);
  let errs = 0;
  const doc = new DOMParser({ onError: () => { errs++; } }).parseFromString(svg, 'image/svg+xml');
  const texts = doc.getElementsByTagName('text').length;
  // Formele încap în desen (dreptunghiurile și cercurile, cu o toleranță de 1 px), iar cercurile nu sunt goale.
  const W = Number(doc.documentElement.getAttribute('width')), num = (e, a) => Number(e.getAttribute(a) || 0);
  const all = (tag) => Array.from({ length: doc.getElementsByTagName(tag).length }, (_, i) => doc.getElementsByTagName(tag).item(i));
  const outside = all('rect').filter((e) => num(e, 'x') < -1 || num(e, 'y') < -1 || num(e, 'x') + num(e, 'width') > W + 1 || num(e, 'y') + num(e, 'height') > h + 1)
    .concat(all('circle').filter((e) => num(e, 'r') < 20 || num(e, 'cx') - num(e, 'r') < -1 || num(e, 'cy') - num(e, 'r') < -1 || num(e, 'cx') + num(e, 'r') > W + 1 || num(e, 'cy') + num(e, 'r') > h + 1));
  ok(!outside.length, `${k} cu ${n}: formele încap în desen`);
  ok(!errs && h > 50 && h < 600 && texts >= n && !svg.includes('NaN'), `${k} cu ${n}: SVG valid, ${texts} texte, înalt ${h}`);
}
// Ierarhia pe niveluri: rândurile începute cu spații / tab coboară sub elementul de deasupra.
const TAB = String.fromCharCode(9);
const TXT = ['Director', 'Ana', '  Bogdan', TAB + TAB + 'Cristi', 'Dan', '      Elena'].join(N);
const lvT = levelsFromText(TXT);
ok(lvT.join() === '0,1,2,3,1,2', 'nivelurile din text (salturile îndreptate): ' + lvT.join());
const tree = parseDiagram({ k: 'hierarchy', color: '#4f6bed', items: itemsFromText(TXT), lv: lvT });
ok(tree.lv?.join() === '0,1,2,3,1,2', 'nivelurile trec prin salvare / citire');
ok(diagramText(tree).split(N).map((l) => l.length - l.trimStart().length).join() === '0,0,2,4,0,2', 'textul ferestrei are câte două spații pe nivel');
ok(parseDiagram({ k: 'process', color: '#4f6bed', items: ['A', 'B'], lv: [0, 2] }).lv === undefined && parseDiagram({ k: 'hierarchy', color: '#4f6bed', items: ['A', 'B'], lv: [0, 1] }).lv === undefined, 'fără niveluri la alte feluri sau la ierarhia pe un rând');
{
  const { svg, h } = diagramSvg(tree);
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  const rects = Array.from({ length: doc.getElementsByTagName('rect').length }, (_, i) => doc.getElementsByTagName('rect').item(i)).map((e) => ({ x: +e.getAttribute('x'), y: +e.getAttribute('y'), w: +e.getAttribute('width') }));
  const ys = [...new Set(rects.map((r) => r.y))];
  ok(ys.length === 4 && h > 300 && rects.every((r) => r.x >= 9 && r.x + r.w <= 561), `ierarhia pe 4 rânduri, în desen (${ys.length} rânduri, înaltă ${h})`);
  const cxOf = (i) => rects[i].x + rects[i].w / 2;
  ok(Math.abs(cxOf(1) - cxOf(2)) < 1 && Math.abs(cxOf(2) - cxOf(3)) < 1 && rects[3].y > rects[2].y && rects[2].y > rects[1].y, 'Ana → Bogdan → Cristi unul sub altul');
}
// Felurile noi (30.10): proces vertical (cutiile una sub alta), proces șerpuit (rândul al doilea de la dreapta la stânga), cerc împărțit (câte o felie pe element).
{
  const items = (n) => Array.from({ length: n }, (_, i) => 'P' + i);
  const rectsOf = (svg) => { const doc = new DOMParser().parseFromString(svg, 'image/svg+xml'), r = doc.getElementsByTagName('rect'); return Array.from({ length: r.length }, (_, i) => ({ x: +r.item(i).getAttribute('x'), y: +r.item(i).getAttribute('y') })); };
  const v = rectsOf(diagramSvg({ k: 'vprocess', color: '#4f6bed', items: items(4) }).svg);
  ok(v.length === 4 && new Set(v.map((r) => r.x)).size === 1 && v.every((r, i) => !i || r.y > v[i - 1].y), 'proces vertical: 4 cutii una sub alta');
  const b = rectsOf(diagramSvg({ k: 'bending', color: '#4f6bed', items: items(5) }).svg);
  ok(b.length === 5 && b[3].y > b[2].y && Math.abs(b[3].x - b[2].x) < 1 && b[4].x < b[3].x, 'proces șerpuit: al 4-lea sub al 3-lea, al 5-lea la stânga lui');
  const sg = diagramSvg({ k: 'segments', color: '#4f6bed', items: items(6) }).svg;
  ok((sg.match(/<path /g) || []).length === 6 && (sg.match(/<text /g) || []).length === 6, 'cerc împărțit: 6 felii cu 6 texte');
}
// Ecuația: până la 5 elemente, cercuri pe un rând cu câte un semn (+ sau =, din câte 2 dreptunghiuri) între ele; de la 6, cele adunate
// unul sub altul în stânga și rezultatul într-un cerc în dreapta.
{
  const cnt = (svg, t) => (svg.match(new RegExp('<' + t + ' ', 'g')) || []).length;
  const e3 = diagramSvg({ k: 'equation', color: '#4f6bed', items: ['A', 'B', 'C'] }).svg;
  ok(cnt(e3, 'circle') === 3 && cnt(e3, 'rect') === 4 && cnt(e3, 'text') === 3, 'ecuație cu 3: 3 cercuri, + și =');
  const e7 = diagramSvg({ k: 'equation', color: '#4f6bed', items: Array.from({ length: 7 }, (_, i) => 'E' + i) }).svg;
  ok(cnt(e7, 'circle') === 1 && cnt(e7, 'rect') === 6 + 5 * 2 + 2 && e7.lastIndexOf('E6') > e7.lastIndexOf('<circle'), 'ecuație cu 7: 6 cutii cu + între ele, = și rezultatul în cerc');
}
{
  const doc = new DOMParser().parseFromString(diagramSvg({ k: 'hhierarchy', color: '#4f6bed', items: ['Șef', 'A', 'B', 'C'] }).svg, 'image/svg+xml'), r = doc.getElementsByTagName('rect');
  const rs = Array.from({ length: r.length }, (_, i) => ({ x: +r.item(i).getAttribute('x'), y: +r.item(i).getAttribute('y'), w: +r.item(i).getAttribute('width') }));
  ok(rs.length === 4 && rs.slice(1).every((k, i) => k.x > rs[0].x + rs[0].w && (!i || k.y > rs[i].y)) && doc.getElementsByTagName('path').length === 1, 'ierarhie orizontală: primul în stânga, 3 unul sub altul în dreapta, legați');
}
{
  const doc = new DOMParser().parseFromString(diagramSvg({ k: 'arrowprocess', color: '#4f6bed', items: ['A', 'B', 'C'] }).svg, 'image/svg+xml'), r = doc.getElementsByTagName('rect');
  const rs = Array.from({ length: r.length }, (_, i) => ({ x: +r.item(i).getAttribute('x'), w: +r.item(i).getAttribute('width') }));
  ok(rs.length === 3 && rs.every((k, i) => !i || k.x > rs[i - 1].x + rs[i - 1].w) && doc.getElementsByTagName('path').length === 1, 'săgeată continuă: săgeata și 3 pași în rând pe ea');
  ok(diagramAlt({ k: 'arrowprocess', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (săgeată continuă): A, B', 'săgeată continuă: textul alternativ');
}
{
  const doc = new DOMParser().parseFromString(diagramSvg({ k: 'converge', color: '#4f6bed', items: ['Scop', 'A', 'B', 'C'] }).svg, 'image/svg+xml');
  ok(doc.getElementsByTagName('polygon').length === 3 && doc.getElementsByTagName('circle').length === 1 && doc.getElementsByTagName('rect').length === 3, 'radial convergent: scopul în cerc, 3 căsuțe cu câte o săgeată');
  ok(diagramAlt({ k: 'converge', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (radial convergent): A, B', 'radial convergent: textul alternativ');
}
{
  const doc = new DOMParser().parseFromString(diagramSvg({ k: 'stepdown', color: '#4f6bed', items: ['A', 'B', 'C'] }).svg, 'image/svg+xml'), r = doc.getElementsByTagName('rect');
  const rs = Array.from({ length: r.length }, (_, i) => ({ x: +r.item(i).getAttribute('x'), y: +r.item(i).getAttribute('y'), h: +r.item(i).getAttribute('height') }));
  ok(rs.length === 3 && rs.every((k, i) => !i || (k.x > rs[i - 1].x && k.y > rs[i - 1].y + rs[i - 1].h)) && doc.getElementsByTagName('polygon').length === 2, 'trepte în jos: 3 pași în scară, 2 săgeți îndoite');
}
for (const k of ['honeycomb', 'gears']) {
  const doc = new DOMParser().parseFromString(diagramSvg({ k, color: '#4f6bed', items: ['A', 'B', 'C', 'D'] }).svg, 'image/svg+xml'), pg = doc.getElementsByTagName('polygon');
  const first = (i) => +pg.item(i).getAttribute('points').split(' ')[0].split(',')[1];
  ok(pg.length === 4 && first(1) > first(0) && first(2) === first(0) && first(3) === first(1), k + ': 4 forme în zigzag');
}
{
  // 31.10: Proces cu cercuri: 4 cercuri la fel de mari pe un rând și 3 săgeți între ele.
  const doc = new DOMParser().parseFromString(diagramSvg({ k: 'circleprocess', color: '#4f6bed', items: ['A', 'B', 'C', 'D'] }).svg, 'image/svg+xml'), c = doc.getElementsByTagName('circle');
  const cs = Array.from({ length: c.length }, (_, i) => ({ x: +c.item(i).getAttribute('cx'), y: +c.item(i).getAttribute('cy'), r: +c.item(i).getAttribute('r') }));
  ok(cs.length === 4 && cs.every((k, i) => !i || (k.y === cs[0].y && k.r === cs[0].r && k.x - cs[i - 1].x > 2 * k.r)) && doc.getElementsByTagName('path').length === 3, 'proces cu cercuri: 4 cercuri pe rând, 3 săgeți');
  ok(diagramAlt({ k: 'circleprocess', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (proces cu cercuri): A, B', 'proces cu cercuri: textul alternativ');
}
{
  // 31.10: Lista cu etape: o săgeată și o bară pe fiecare rând, rândurile unul sub altul.
  const doc = new DOMParser().parseFromString(diagramSvg({ k: 'chevronlist', color: '#4f6bed', items: ['A', 'B', 'C'] }).svg, 'image/svg+xml'), pg = doc.getElementsByTagName('polygon'), rc = doc.getElementsByTagName('rect');
  const ys = Array.from({ length: rc.length }, (_, i) => +rc.item(i).getAttribute('y'));
  ok(pg.length === 3 && rc.length === 3 && ys.every((y, i) => !i || y > ys[i - 1]), 'listă cu etape: 3 săgeți și 3 bare, una sub alta');
}
{
  // 02.11: Lista cu hexagoane: un hexagon (6 colțuri) și o bandă pe fiecare rând, rândurile unul sub altul, textul alternativ.
  for (const n of [3, 6]) {
    const items = 'ABCDEF'.slice(0, n).split(''), r = diagramSvg({ k: 'hexlist', color: '#4f6bed', items }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml'), pg = doc.getElementsByTagName('polygon'), rc = doc.getElementsByTagName('rect');
    const ys = Array.from({ length: rc.length }, (_, i) => +rc.item(i).getAttribute('y'));
    const six = Array.from({ length: pg.length }, (_, i) => pg.item(i).getAttribute('points').trim().split(/\s+/).length === 6);
    ok(pg.length === n && rc.length === n && six.every(Boolean) && ys.every((y, i) => !i || y > ys[i - 1]) && ys.every((y) => y + 48 <= r.h), 'listă cu hexagoane (' + n + '): hexagoane și benzi, una sub alta');
  }
  ok(diagramAlt({ k: 'hexlist', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (listă cu hexagoane): A, B', 'listă cu hexagoane: textul alternativ');
}
{
  // 02.11: Lista cu cercuri: un cerc și o bandă pe fiecare rând, rândurile unul sub altul, totul în desen.
  for (const n of [3, 6]) {
    const items = 'ABCDEF'.slice(0, n).split(''), r = diagramSvg({ k: 'circlelist', color: '#4f6bed', items }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml'), ci = doc.getElementsByTagName('circle'), rc = doc.getElementsByTagName('rect');
    const cy = Array.from({ length: ci.length }, (_, i) => +ci.item(i).getAttribute('cy'));
    ok(ci.length === n && rc.length === n && doc.getElementsByTagName('text').length === 2 * n && cy.every((y, i) => !i || y > cy[i - 1]) && cy.every((y) => y + 24 <= r.h), 'listă cu cercuri (' + n + '): cercuri și benzi, una sub alta');
  }
  ok(diagramAlt({ k: 'circlelist', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (listă cu cercuri): A, B', 'listă cu cercuri: textul alternativ');
  // 02.11: Lista cu romburi: un romb (4 colțuri) și o bandă pe fiecare rând, rândurile unul sub altul, totul în desen.
  for (const n of [3, 6]) {
    const items = 'ABCDEF'.slice(0, n).split(''), r = diagramSvg({ k: 'diamondlist', color: '#4f6bed', items }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml'), pg = doc.getElementsByTagName('polygon'), rc = doc.getElementsByTagName('rect');
    const pts = Array.from({ length: pg.length }, (_, i) => pg.item(i).getAttribute('points').trim().split(/\s+/).map((p) => p.split(',').map(Number)));
    ok(pg.length === n && rc.length === n && doc.getElementsByTagName('text').length === 2 * n && pts.every((p) => p.length === 4) && pts.every((p, i) => !i || p[0][1] > pts[i - 1][0][1]) && pts.every((p) => p.every(([x, y]) => x >= 0 && x <= 560 && y >= 0 && y <= r.h)), 'listă cu romburi (' + n + '): romburi și benzi, una sub alta');
  }
  ok(diagramAlt({ k: 'diamondlist', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (listă cu romburi): A, B', 'listă cu romburi: textul alternativ');
  // 02.11: Lista cu stele: o stea (10 colțuri: 5 vârfuri și 5 adâncituri) și o bandă pe fiecare rând, una sub alta, totul în desen.
  for (const n of [3, 6]) {
    const items = 'ABCDEF'.slice(0, n).split(''), r = diagramSvg({ k: 'starlist', color: '#4f6bed', items }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml'), pg = doc.getElementsByTagName('polygon'), rc = doc.getElementsByTagName('rect');
    const pts = Array.from({ length: pg.length }, (_, i) => pg.item(i).getAttribute('points').trim().split(/\s+/).map((p) => p.split(',').map(Number)));
    ok(pg.length === n && rc.length === n && doc.getElementsByTagName('text').length === 2 * n && pts.every((p) => p.length === 10) && pts.every((p, i) => !i || p[0][1] > pts[i - 1][0][1]) && pts.every((p) => p.every(([x, y]) => x >= 0 && x <= 560 && y >= 0 && y <= r.h)), 'listă cu stele (' + n + '): stele și benzi, una sub alta');
  }
  ok(diagramAlt({ k: 'starlist', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (listă cu stele): A, B', 'listă cu stele: textul alternativ');
  // 02.11: Listele cu pentagoane (5 colțuri) și octogoane (8 colțuri): poligonul și banda pe fiecare rând, una sub alta, totul în desen.
  for (const [k, m, name] of [['pentagonlist', 5, 'pentagoane'], ['octagonlist', 8, 'octogoane'], ['trianglelist', 3, 'triunghiuri'], ['squarelist', 4, 'pătrate']]) {
    for (const n of [3, 6]) {
      const items = 'ABCDEF'.slice(0, n).split(''), r = diagramSvg({ k, color: '#4f6bed', items }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml'), pg = doc.getElementsByTagName('polygon'), rc = doc.getElementsByTagName('rect');
      const pts = Array.from({ length: pg.length }, (_, i) => pg.item(i).getAttribute('points').trim().split(/\s+/).map((p) => p.split(',').map(Number)));
      ok(pg.length === n && rc.length === n && doc.getElementsByTagName('text').length === 2 * n && pts.every((p) => p.length === m) && pts.every((p, i) => !i || p[0][1] > pts[i - 1][0][1]) && pts.every((p) => p.every(([x, y]) => x >= 0 && x <= 560 && y >= 0 && y <= r.h)), 'listă cu ' + name + ' (' + n + '): poligoane și benzi, una sub alta');
    }
    ok(diagramAlt({ k, color: '#000000', items: ['A', 'B'] }) === 'Diagramă (listă cu ' + name + '): A, B', 'listă cu ' + name + ': textul alternativ');
  }
  // 03.11: Lista cu bife: pe fiecare rând banda și căsuța (2 dreptunghiuri), bifa desenată ca linie (fără literă), doar textul ideii.
  for (const n of [3, 6]) {
    const items = 'ABCDEF'.slice(0, n).split(''), r = diagramSvg({ k: 'checklist', color: '#4f6bed', items }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml'), rc = doc.getElementsByTagName('rect'), ph = doc.getElementsByTagName('path'), tx = doc.getElementsByTagName('text');
    const boxes = Array.from({ length: rc.length }, (_, i) => rc.item(i)).filter((e) => e.getAttribute('width') === e.getAttribute('height'));
    ok(rc.length === 2 * n && boxes.length === n && ph.length === n && tx.length === n && boxes.every((b, i) => !i || +b.getAttribute('y') > +boxes[i - 1].getAttribute('y')) && boxes.every((b) => +b.getAttribute('y') + +b.getAttribute('height') <= r.h), 'listă cu bife (' + n + '): căsuțe bifate și benzi, una sub alta');
  }
  ok(diagramAlt({ k: 'checklist', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (listă cu bife): A, B', 'listă cu bife: textul alternativ');
  // 03.11: Lista cu inimi: pe fiecare rând banda și inima (un traseu închis), cu numărul și textul; rândurile una sub alta, în desen.
  for (const n of [3, 6]) {
    const items = 'ABCDEF'.slice(0, n).split(''), r = diagramSvg({ k: 'heartlist', color: '#4f6bed', items }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml'), rc = doc.getElementsByTagName('rect'), ph = doc.getElementsByTagName('path'), tx = doc.getElementsByTagName('text');
    const ds = Array.from({ length: ph.length }, (_, i) => ph.item(i).getAttribute('d')), nums = ds.map((d) => (d.match(/-?[0-9.]+/g) || []).map(Number));
    const ys = nums.map((v) => v.filter((_, j) => j % 2 === 1));
    ok(rc.length === n && ph.length === n && tx.length === 2 * n && ds.every((d) => /^M.* A.* A.* Z$/.test(d)) && nums.every((v, i) => !i || v[1] > nums[i - 1][1]) && nums.every((v) => v.every((x) => x >= 0 && x <= Math.max(560, r.h))) && ys.every((v) => Math.max(...v) <= r.h), 'listă cu inimi (' + n + '): inimi și benzi, una sub alta');
  }
  ok(diagramAlt({ k: 'heartlist', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (listă cu inimi): A, B', 'listă cu inimi: textul alternativ');
  // 03.11: Lista cu nori: pe fiecare rând banda și norul (un traseu din 7 arce), cu numărul și textul, una sub alta, în desen.
  for (const n of [3, 6]) {
    const items = 'ABCDEF'.slice(0, n).split(''), r = diagramSvg({ k: 'cloudlist', color: '#4f6bed', items }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml'), rc = doc.getElementsByTagName('rect'), ph = doc.getElementsByTagName('path'), tx = doc.getElementsByTagName('text');
    const ds = Array.from({ length: ph.length }, (_, i) => ph.item(i).getAttribute('d')), first = ds.map((d) => (d.match(/-?[0-9.]+/g) || []).map(Number));
    ok(rc.length === n && ph.length === n && tx.length === 2 * n && ds.every((d) => (d.match(/A/g) || []).length === 7 && d.endsWith('Z')) && first.every((v, i) => !i || v[1] > first[i - 1][1]) && first.every((v) => v[1] <= r.h), 'listă cu nori (' + n + '): nori și benzi, una sub alta');
  }
  ok(diagramAlt({ k: 'cloudlist', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (listă cu nori): A, B', 'listă cu nori: textul alternativ');
  // 03.11: Lista cu picături: pe fiecare rând banda și picătura (un traseu cu 2 laturi drepte și 3 arce), cu numărul și textul, una sub alta, în desen.
  for (const n of [3, 6]) {
    const items = 'ABCDEF'.slice(0, n).split(''), r = diagramSvg({ k: 'droplist', color: '#4f6bed', items }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml'), rc = doc.getElementsByTagName('rect'), ph = doc.getElementsByTagName('path'), tx = doc.getElementsByTagName('text');
    const ds = Array.from({ length: ph.length }, (_, i) => ph.item(i).getAttribute('d')), first = ds.map((d) => (d.match(/-?[0-9.]+/g) || []).map(Number));
    ok(rc.length === n && ph.length === n && tx.length === 2 * n && ds.every((d) => (d.match(/A/g) || []).length === 3 && (d.match(/L/g) || []).length === 2 && d.endsWith('Z')) && first.every((v, i) => !i || v[1] > first[i - 1][1]) && first.every((v) => v.every((x) => x >= 0 && x <= Math.max(560, r.h))), 'listă cu picături (' + n + '): picături și benzi, una sub alta');
  }
  ok(diagramAlt({ k: 'droplist', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (listă cu picături): A, B', 'listă cu picături: textul alternativ');
  // 03.11: Lista cu plăcuțe: pe fiecare rând banda și plăcuța (4 laturi și 4 arce), cu numărul și textul, una sub alta, în desen.
  for (const n of [3, 6]) {
    const items = 'ABCDEF'.slice(0, n).split(''), r = diagramSvg({ k: 'plaquelist', color: '#4f6bed', items }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml'), rc = doc.getElementsByTagName('rect'), ph = doc.getElementsByTagName('path'), tx = doc.getElementsByTagName('text');
    const ds = Array.from({ length: ph.length }, (_, i) => ph.item(i).getAttribute('d')), first = ds.map((d) => (d.match(/-?[0-9.]+/g) || []).map(Number));
    ok(rc.length === n && ph.length === n && tx.length === 2 * n && ds.every((d) => (d.match(/A/g) || []).length === 4 && (d.match(/L/g) || []).length === 4 && d.endsWith('Z')) && first.every((v, i) => !i || v[1] > first[i - 1][1]) && first.every((v) => v.every((x) => x >= 0 && x <= Math.max(560, r.h))), 'listă cu plăcuțe (' + n + '): plăcuțe și benzi, una sub alta');
  }
  ok(diagramAlt({ k: 'plaquelist', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (listă cu plăcuțe): A, B', 'listă cu plăcuțe: textul alternativ');
  // 03.11: Lista cu sigilii: pe fiecare rând banda și sigiliul (24 de puncte, 23 de laturi), cu numărul și textul, una sub alta, în desen.
  for (const n of [3, 6]) {
    const items = 'ABCDEF'.slice(0, n).split(''), r = diagramSvg({ k: 'seallist', color: '#4f6bed', items }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml'), rc = doc.getElementsByTagName('rect'), ph = doc.getElementsByTagName('path'), tx = doc.getElementsByTagName('text');
    const ds = Array.from({ length: ph.length }, (_, i) => ph.item(i).getAttribute('d')), first = ds.map((d) => (d.match(/-?[0-9.]+/g) || []).map(Number));
    ok(rc.length === n && ph.length === n && tx.length === 2 * n && ds.every((d) => (d.match(/L/g) || []).length === 23 && d.endsWith('Z')) && first.every((v, i) => !i || v[1] > first[i - 1][1]) && first.every((v) => v.every((x) => x >= 0 && x <= Math.max(560, r.h))), 'listă cu sigilii (' + n + '): sigilii și benzi, una sub alta');
  }
  ok(diagramAlt({ k: 'seallist', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (listă cu sigilii): A, B', 'listă cu sigilii: textul alternativ');
  // 04.11: Lista cu roți dințate: pe fiecare rând banda, roata (32 de puncte: 8 dinți), cu numărul și textul, una sub alta, în desen.
  for (const n of [3, 6]) {
    const items = 'ABCDEF'.slice(0, n).split(''), r = diagramSvg({ k: 'gearlist', color: '#4f6bed', items }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml'), rc = doc.getElementsByTagName('rect'), pg = doc.getElementsByTagName('polygon'), ci = doc.getElementsByTagName('circle'), tx = doc.getElementsByTagName('text');
    const ps = Array.from({ length: pg.length }, (_, i) => pg.item(i).getAttribute('points').trim().split(/ +/).map((q) => q.split(',').map(Number)));
    ok(rc.length === n && pg.length === n && !ci.length && tx.length === 2 * n && ps.every((p) => p.length === 32) && ps.every((p, i) => !i || p[0][1] > ps[i - 1][0][1]) && ps.every((p) => p.every(([x, y]) => x >= 0 && y >= 0 && y <= r.h)), 'listă cu roți dințate (' + n + '): roți și benzi, una sub alta');
  }
  ok(diagramAlt({ k: 'gearlist', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (listă cu roți dințate): A, B', 'listă cu roți dințate: textul alternativ');
  // 04.11: Lista cu documente: pe fiecare rând banda și foaia (două laturi drepte și marginea de jos din două curbe), cu numărul și textul, una sub alta, în desen.
  for (const n of [3, 6]) {
    const items = 'ABCDEF'.slice(0, n).split(''), r = diagramSvg({ k: 'doclist', color: '#4f6bed', items }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml'), rc = doc.getElementsByTagName('rect'), ph = doc.getElementsByTagName('path'), tx = doc.getElementsByTagName('text');
    const ds = Array.from({ length: ph.length }, (_, i) => ph.item(i).getAttribute('d')), first = ds.map((d) => (d.match(/-?[0-9.]+/g) || []).map(Number));
    ok(rc.length === n && ph.length === n && tx.length === 2 * n && ds.every((d) => (d.match(/C/g) || []).length === 2 && (d.match(/L/g) || []).length === 2 && d.endsWith('Z')) && first.every((v, i) => !i || v[1] > first[i - 1][1]) && first.every((v) => v.every((x) => x >= 0 && x <= Math.max(560, r.h))), 'listă cu documente (' + n + '): foi și benzi, una sub alta');
  }
  ok(diagramAlt({ k: 'doclist', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (listă cu documente): A, B', 'listă cu documente: textul alternativ');
  // 04.11: Lista cu cuburi: pe fiecare rând banda, conturul cubului (6 colțuri) și muchiile dinăuntru, cu numărul și textul, una sub alta, în desen.
  for (const n of [3, 6]) {
    const items = 'ABCDEF'.slice(0, n).split(''), r = diagramSvg({ k: 'cubelist', color: '#4f6bed', items }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml'), rc = doc.getElementsByTagName('rect'), pg = doc.getElementsByTagName('polygon'), ph = doc.getElementsByTagName('path'), tx = doc.getElementsByTagName('text');
    const ps = Array.from({ length: pg.length }, (_, i) => pg.item(i).getAttribute('points').trim().split(/ +/).map((q) => q.split(',').map(Number)));
    ok(rc.length === n && pg.length === n && ph.length === n && tx.length === 2 * n && ps.every((p) => p.length === 6) && ps.every((p, i) => !i || p[0][1] > ps[i - 1][0][1]) && ps.every((p) => p.every(([x, y]) => x >= 0 && y >= 0 && y <= r.h)), 'listă cu cuburi (' + n + '): cuburi și benzi, una sub alta');
  }
  ok(diagramAlt({ k: 'cubelist', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (listă cu cuburi): A, B', 'listă cu cuburi: textul alternativ');
  // 04.11: Lista cu inele: pe fiecare rând banda, golul alb și inelul (două cercuri din arce, cu evenodd), cu numărul și textul, una sub alta, în desen.
  for (const n of [3, 6]) {
    const items = 'ABCDEF'.slice(0, n).split(''), r = diagramSvg({ k: 'donutlist', color: '#4f6bed', items }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml'), rc = doc.getElementsByTagName('rect'), ph = doc.getElementsByTagName('path'), tx = doc.getElementsByTagName('text');
    const ps = Array.from({ length: ph.length }, (_, i) => ph.item(i)), rings = ps.filter((e) => e.getAttribute('fill-rule') === 'evenodd'), ys = rings.map((e) => Number(e.getAttribute('d').split(',')[1].split(' ')[0]));
    ok(rc.length === n && ph.length === 2 * n && rings.length === n && tx.length === 2 * n && rings.every((e) => (e.getAttribute('d').match(/A/g) || []).length === 4) && ys.every((v, i) => !i || v > ys[i - 1]) && ys.every((v) => v > 0 && v < r.h), 'listă cu inele (' + n + '): inele și benzi, una sub alta');
  }
  ok(diagramAlt({ k: 'donutlist', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (listă cu inele): A, B', 'listă cu inele: textul alternativ');
  // 04.11: Lista cu stegulețe: pe fiecare rând banda, bățul și steagul cu unde (două curbe C), cu numărul și textul, una sub alta, în desen.
  for (const n of [3, 6]) {
    const items = 'ABCDEF'.slice(0, n).split(''), r = diagramSvg({ k: 'flaglist', color: '#4f6bed', items }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml'), rc = doc.getElementsByTagName('rect'), ph = doc.getElementsByTagName('path'), tx = doc.getElementsByTagName('text');
    const ps = Array.from({ length: ph.length }, (_, i) => ph.item(i)), ys = ps.map((e) => Number(e.getAttribute('d').split(',')[1].split(' ')[0]));
    ok(rc.length === 2 * n && ph.length === n && tx.length === 2 * n && ps.every((e) => (e.getAttribute('d').match(/C/g) || []).length === 2) && ys.every((v, i) => !i || v > ys[i - 1]) && ys.every((v) => v > 0 && v < r.h), 'listă cu stegulețe (' + n + '): steaguri și benzi, una sub alta');
  }
  ok(diagramAlt({ k: 'flaglist', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (listă cu stegulețe): A, B', 'listă cu stegulețe: textul alternativ');
  // 04.11: Listă cu panglici: pe fiecare rând banda, panglica și cele două capete crestate, cu numărul și textul, una sub alta, în desen.
  for (const n of [3, 6]) {
    const items = 'ABCDEF'.slice(0, n).split(''), r = diagramSvg({ k: 'ribbonlist', color: '#4f6bed', items }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml'), rc = doc.getElementsByTagName('rect'), ph = doc.getElementsByTagName('path'), tx = doc.getElementsByTagName('text');
    const ts = Array.from({ length: tx.length }, (_, i) => tx.item(i)), ys = ts.filter((_, i) => i % 2 === 1).map((e) => Number(e.getAttribute('y')));
    ok(rc.length === 2 * n && ph.length === 2 * n && tx.length === 2 * n && ys.every((v, i) => !i || v > ys[i - 1]) && ys.every((v) => v > 0 && v < r.h), 'listă cu panglici (' + n + '): forme și benzi, una sub alta');
  }
  ok(diagramAlt({ k: 'ribbonlist', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (listă cu panglici): A, B', 'listă cu panglici: textul alternativ');
  // 04.11: Listă cu suluri: pe fiecare rând banda, foaia și cele două suluri de la capete, cu numărul și textul, una sub alta, în desen.
  for (const n of [3, 6]) {
    const items = 'ABCDEF'.slice(0, n).split(''), r = diagramSvg({ k: 'scrolllist', color: '#4f6bed', items }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml'), rc = doc.getElementsByTagName('rect'), ph = doc.getElementsByTagName('path'), tx = doc.getElementsByTagName('text');
    const ts = Array.from({ length: tx.length }, (_, i) => tx.item(i)), ys = ts.filter((_, i) => i % 2 === 1).map((e) => Number(e.getAttribute('y')));
    ok(rc.length === 4 * n && ph.length === 0 * n && tx.length === 2 * n && ys.every((v, i) => !i || v > ys[i - 1]) && ys.every((v) => v > 0 && v < r.h), 'listă cu suluri (' + n + '): forme și benzi, una sub alta');
  }
  ok(diagramAlt({ k: 'scrolllist', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (listă cu suluri): A, B', 'listă cu suluri: textul alternativ');
  // 04.11: Listă cu felii: pe fiecare rând banda și felia (cercul fără un sfert, un arc mare), cu numărul și textul, una sub alta, în desen.
  for (const n of [3, 6]) {
    const items = 'ABCDEF'.slice(0, n).split(''), r = diagramSvg({ k: 'pielist', color: '#4f6bed', items }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml'), rc = doc.getElementsByTagName('rect'), ph = doc.getElementsByTagName('path'), tx = doc.getElementsByTagName('text');
    const ts = Array.from({ length: tx.length }, (_, i) => tx.item(i)), ys = ts.filter((_, i) => i % 2 === 1).map((e) => Number(e.getAttribute('y')));
    ok(rc.length === 1 * n && ph.length === 1 * n && tx.length === 2 * n && ys.every((v, i) => !i || v > ys[i - 1]) && ys.every((v) => v > 0 && v < r.h), 'listă cu felii (' + n + '): forme și benzi, una sub alta');
  }
  ok(diagramAlt({ k: 'pielist', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (listă cu felii): A, B', 'listă cu felii: textul alternativ');
  // 04.11: Listă cu fișe: pe fiecare rând banda și fișa cu colțul tăiat (5 laturi), cu numărul și textul, una sub alta, în desen.
  for (const n of [3, 6]) {
    const items = 'ABCDEF'.slice(0, n).split(''), r = diagramSvg({ k: 'cardlist', color: '#4f6bed', items }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml'), rc = doc.getElementsByTagName('rect'), ph = doc.getElementsByTagName('path'), tx = doc.getElementsByTagName('text');
    const ts = Array.from({ length: tx.length }, (_, i) => tx.item(i)), ys = ts.filter((_, i) => i % 2 === 1).map((e) => Number(e.getAttribute('y')));
    ok(rc.length === 1 * n && ph.length === 1 * n && tx.length === 2 * n && ys.every((v, i) => !i || v > ys[i - 1]) && ys.every((v) => v > 0 && v < r.h), 'listă cu fișe (' + n + '): forme și benzi, una sub alta');
  }
  ok(diagramAlt({ k: 'cardlist', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (listă cu fișe): A, B', 'listă cu fișe: textul alternativ');
  // 04.11: Listă cu explozii: pe fiecare rând banda și explozia (un contur cu 12 colțuri ascuțite), cu numărul și textul, una sub alta, în desen.
  for (const n of [3, 6]) {
    const items = 'ABCDEF'.slice(0, n).split(''), r = diagramSvg({ k: 'burstlist', color: '#4f6bed', items }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml'), rc = doc.getElementsByTagName('rect'), ph = doc.getElementsByTagName('path'), tx = doc.getElementsByTagName('text');
    const ts = Array.from({ length: tx.length }, (_, i) => tx.item(i)), ys = ts.filter((_, i) => i % 2 === 1).map((e) => Number(e.getAttribute('y')));
    ok(rc.length === 1 * n && ph.length === 1 * n && tx.length === 2 * n && ys.every((v, i) => !i || v > ys[i - 1]) && ys.every((v) => v > 0 && v < r.h), 'listă cu explozii (' + n + '): forme și benzi, una sub alta');
  }
  ok(diagramAlt({ k: 'burstlist', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (listă cu explozii): A, B', 'listă cu explozii: textul alternativ');
  // 04.11: Listă cu semicercuri: pe fiecare rând banda și forma dreaptă la stânga și rotunjită la dreapta (un arc), cu numărul și textul, una sub alta, în desen.
  for (const n of [3, 6]) {
    const items = 'ABCDEF'.slice(0, n).split(''), r = diagramSvg({ k: 'halfcirclelist', color: '#4f6bed', items }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml'), rc = doc.getElementsByTagName('rect'), ph = doc.getElementsByTagName('path'), tx = doc.getElementsByTagName('text');
    const ts = Array.from({ length: tx.length }, (_, i) => tx.item(i)), ys = ts.filter((_, i) => i % 2 === 1).map((e) => Number(e.getAttribute('y')));
    ok(rc.length === 1 * n && ph.length === 1 * n && tx.length === 2 * n && ys.every((v, i) => !i || v > ys[i - 1]) && ys.every((v) => v > 0 && v < r.h), 'listă cu semicercuri (' + n + '): forme și benzi, una sub alta');
  }
  ok(diagramAlt({ k: 'halfcirclelist', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (listă cu semicercuri): A, B', 'listă cu semicercuri: textul alternativ');
  // 04.11: Blocuri în zigzag: câte un bloc pentru fiecare pas, de la stânga la dreapta, pe rând sus și jos; cele de pe același rând nu se ating.
  for (const n of [2, 5, 8]) {
    const items = 'ABCDEFGH'.slice(0, n).split(''), r = diagramSvg({ k: 'zigzagblocks', color: '#4f6bed', items }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml'), rc = doc.getElementsByTagName('rect');
    const bs = Array.from({ length: rc.length }, (_, i) => ['x', 'y', 'width', 'height'].map((a) => Number(rc.item(i).getAttribute(a))));
    ok(rc.length === n && bs.every((b, i) => !i || (b[0] > bs[i - 1][0] && (b[1] > bs[i - 1][1]) === (i % 2 === 1))) && bs.every((b, i) => i < 2 || b[0] >= bs[i - 2][0] + bs[i - 2][2]) && bs.every((b) => b[0] + b[2] <= 550.5), 'blocuri în zigzag (' + n + '): sus și jos, de la stânga la dreapta');
  }
  ok(diagramAlt({ k: 'zigzagblocks', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (blocuri în zigzag): A, B', 'blocuri în zigzag: textul alternativ');
  // 04.11: Piramidă din blocuri: rânduri de 1, 2, 3… blocuri (piramida întreagă), cu textul doar în primele n.
  for (const [n, rows] of [[2, 2], [3, 2], [6, 3], [7, 4], [8, 4]]) {
    const items = 'ABCDEFGH'.slice(0, n).split(''), r = diagramSvg({ k: 'brickpyramid', color: '#4f6bed', items }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml'), rc = doc.getElementsByTagName('rect'), tx = doc.getElementsByTagName('text');
    const ys = [...new Set(Array.from({ length: rc.length }, (_, i) => Number(rc.item(i).getAttribute('y'))))];
    ok(rc.length === (rows * (rows + 1)) / 2 && tx.length === n && ys.length === rows, 'piramidă din blocuri (' + n + '): ' + rows + ' rânduri, ' + rc.length + ' blocuri');
  }
  ok(diagramAlt({ k: 'brickpyramid', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (piramidă din blocuri): A, B', 'piramidă din blocuri: textul alternativ');
  // 04.11: Scară: două bare și o treaptă pentru fiecare pas, primul jos; Coloane pe o bază: o coloană pentru fiecare idee și bara de jos.
  for (const n of [2, 5, 8]) {
    const items = 'ABCDEFGH'.slice(0, n).split(''), r = diagramSvg({ k: 'ladder', color: '#4f6bed', items }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml'), rc = doc.getElementsByTagName('rect'), tx = doc.getElementsByTagName('text');
    const st = Array.from({ length: rc.length }, (_, i) => Number(rc.item(i).getAttribute('y'))).slice(2);
    ok(rc.length === n + 2 && st.every((y, i) => !i || y < st[i - 1]) && tx.item(0).textContent === 'A' && Number(tx.item(0).getAttribute('y')) > Number(tx.item(tx.length - 1).getAttribute('y')), 'scară (' + n + '): treptele de jos în sus');
    const q = diagramSvg({ k: 'pillars', color: '#4f6bed', items }), qd = new DOMParser().parseFromString(q.svg, 'image/svg+xml'), qr = qd.getElementsByTagName('rect');
    const cs = Array.from({ length: qr.length - 1 }, (_, i) => ['x', 'width', 'height'].map((k) => Number(qr.item(i).getAttribute(k))));
    ok(qr.length === n + 1 && cs.every((c, i) => !i || c[0] >= cs[i - 1][0] + cs[i - 1][1]) && cs.every((c) => c[0] + c[1] <= 550.5) && Number(qr.item(n).getAttribute('width')) > cs.at(-1)[0] + cs.at(-1)[1] - cs[0][0] && cs.every((c) => c[2] > c[1]), 'coloane pe o bază (' + n + '): alăturate, cu bara de jos');
  }
  ok(diagramAlt({ k: 'ladder', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (scară cu trepte): A, B' && diagramAlt({ k: 'pillars', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (coloane pe o bază): A, B', 'scară / coloane pe o bază: textul alternativ');
  // 04.11: Săgeți crescătoare: o săgeată pe rând, fiecare mai lungă; Bară cu etape: segmente lipite, de aceeași lățime, pe toată lățimea.
  for (const n of [2, 5, 8]) {
    const items = 'ABCDEFGH'.slice(0, n).split(''), r = diagramSvg({ k: 'incarrows', color: '#4f6bed', items }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml'), pg = doc.getElementsByTagName('polygon');
    const ends = Array.from({ length: pg.length }, (_, i) => Math.max(...pg.item(i).getAttribute('points').split(' ').map((q) => Number(q.split(',')[0]))));
    ok(pg.length === n && ends.every((e, i) => !i || e > ends[i - 1]) && ends[n - 1] <= 550.5, 'săgeți crescătoare (' + n + '): fiecare mai lungă');
    const q = diagramSvg({ k: 'phasebar', color: '#4f6bed', items }), qd = new DOMParser().parseFromString(q.svg, 'image/svg+xml');
    ok(qd.getElementsByTagName('path').length === n && qd.getElementsByTagName('rect').length === n - 1 && qd.getElementsByTagName('text').length >= n, 'bară cu etape (' + n + '): segmentele și despărțiturile');
  }
  ok(diagramAlt({ k: 'incarrows', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (săgeți crescătoare): A, B' && diagramAlt({ k: 'phasebar', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (bară cu etape): A, B', 'săgeți crescătoare / bară cu etape: textul alternativ');
  // 04.11: Radial cu blocuri: o linie și un bloc pentru fiecare element din jur, plus blocul din mijloc; blocurile nu se suprapun și stau în desen.
  for (const n of [3, 5, 8]) {
    const items = 'ABCDEFGH'.slice(0, n).split(''), r = diagramSvg({ k: 'radialcluster', color: '#4f6bed', items }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml'), rc = doc.getElementsByTagName('rect'), ph = doc.getElementsByTagName('path'), tx = doc.getElementsByTagName('text');
    const bs = Array.from({ length: rc.length }, (_, i) => ['x', 'y', 'width', 'height'].map((a) => Number(rc.item(i).getAttribute(a))));
    const apart = bs.every((a, i) => bs.every((b, j) => j <= i || a[0] + a[2] <= b[0] + 0.5 || b[0] + b[2] <= a[0] + 0.5 || a[1] + a[3] <= b[1] + 0.5 || b[1] + b[3] <= a[1] + 0.5));
    ok(rc.length === n && ph.length === n - 1 && tx.length === n && apart && bs.every((b) => b[0] >= 0 && b[1] >= 0 && b[0] + b[2] <= 560 && b[1] + b[3] <= r.h), 'radial cu blocuri (' + n + '): mijlocul, blocurile din jur și liniile, fără suprapuneri');
  }
  ok(diagramAlt({ k: 'radialcluster', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (radial cu blocuri): A, B', 'radial cu blocuri: textul alternativ');
  // 04.11: Grilă cu axe: axa verticală și câte o axă între rânduri, sub căsuțe; căsuțele câte două pe rând, ultima singură la mijloc când sunt impare.
  for (const n of [2, 4, 5, 8]) {
    const items = 'ABCDEFGH'.slice(0, n).split(''), r = diagramSvg({ k: 'gridaxes', color: '#4f6bed', items }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml'), rc = doc.getElementsByTagName('rect'), tx = doc.getElementsByTagName('text');
    const rows = Math.ceil(n / 2), bs = Array.from({ length: rc.length }, (_, i) => ['x', 'y', 'width', 'height'].map((a) => Number(rc.item(i).getAttribute(a)))), boxes = bs.slice(rows), axes = bs.slice(0, rows);
    const last = boxes[n - 1], mid = n % 2 ? Math.abs(last[0] + last[2] / 2 - 280) < 1 : true;
    ok(rc.length === rows + n && tx.length === n && axes[0][2] === 4 && axes.slice(1).every((a) => a[3] === 4) && boxes.every((b, i) => i % 2 === 0 || b[0] > boxes[i - 1][0] + boxes[i - 1][2]) && mid, 'grilă cu axe (' + n + '): axele și căsuțele câte două');
  }
  ok(diagramAlt({ k: 'gridaxes', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (grilă cu axe): A, B', 'grilă cu axe: textul alternativ');
  // 04.11: Plăcintă: câte o felie (un drum din centru cu un arc) și un text pentru fiecare element, textele în cerc, în desen.
  for (const n of [2, 3, 6]) {
    const items = 'ABCDEF'.slice(0, n).split(''), r = diagramSvg({ k: 'basicpie', color: '#4f6bed', items }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml'), ph = doc.getElementsByTagName('path'), tx = doc.getElementsByTagName('text');
    const ds = Array.from({ length: ph.length }, (_, i) => ph.item(i).getAttribute('d'));
    const ts = Array.from({ length: tx.length }, (_, i) => tx.item(i)), xs = ts.map((e) => Number(e.getAttribute('x'))), ys = ts.map((e) => Number(e.getAttribute('y')));
    ok(ph.length === n && tx.length === n && ds.every((d) => d.startsWith('M280 170 L') && d.includes(' A')) && xs.every((v) => v > 110 && v < 450) && ys.every((v) => v > 0 && v < r.h), 'plăcintă (' + n + '): felii din centru, textul în cerc');
  }
  { const r = diagramSvg({ k: 'basicpie', color: '#4f6bed', items: ['Tot'] }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml');
    ok(doc.getElementsByTagName('circle').length === 1 && doc.getElementsByTagName('path').length === 0, 'plăcintă (1): un cerc întreg'); }
  ok(diagramAlt({ k: 'basicpie', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (plăcintă): A, B', 'plăcintă: textul alternativ');
  // 04.11: Țintă cu dreptunghiuri: câte un dreptunghi pentru fiecare element, fiecare în interiorul celui dinainte, textele de sus în jos.
  for (const n of [2, 4, 8]) {
    const items = 'ABCDEFGH'.slice(0, n).split(''), r = diagramSvg({ k: 'nestedtarget', color: '#4f6bed', items }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml'), rc = doc.getElementsByTagName('rect'), tx = doc.getElementsByTagName('text');
    const bs = Array.from({ length: rc.length }, (_, i) => ['x', 'y', 'width', 'height'].map((a) => Number(rc.item(i).getAttribute(a))));
    const inside = bs.every((b, i) => !i || (b[0] > bs[i - 1][0] && b[1] > bs[i - 1][1] && b[0] + b[2] < bs[i - 1][0] + bs[i - 1][2] && b[1] + b[3] <= bs[i - 1][1] + bs[i - 1][3] + 0.01 && b[2] > 40 && b[3] > 40));
    const ys = Array.from({ length: tx.length }, (_, i) => Number(tx.item(i).getAttribute('y')));
    ok(rc.length === n && tx.length === n && inside && ys.every((v, i) => !i || v > ys[i - 1]) && bs.every((b) => b[0] + b[2] <= 560 && b[1] + b[3] <= r.h), 'țintă cu dreptunghiuri (' + n + '): unul în altul, textele de sus în jos');
  }
  ok(diagramAlt({ k: 'nestedtarget', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (țintă cu dreptunghiuri): A, B', 'țintă cu dreptunghiuri: textul alternativ');
  // 04.11: Listă cu capsule: pe fiecare rând banda și capsula (două arce la capete), cu numărul și textul, una sub alta, în desen.
  for (const n of [3, 6]) {
    const items = 'ABCDEF'.slice(0, n).split(''), r = diagramSvg({ k: 'pilllist', color: '#4f6bed', items }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml'), rc = doc.getElementsByTagName('rect'), ph = doc.getElementsByTagName('path'), tx = doc.getElementsByTagName('text');
    const ts = Array.from({ length: tx.length }, (_, i) => tx.item(i)), ys = ts.filter((_, i) => i % 2 === 1).map((e) => Number(e.getAttribute('y')));
    ok(rc.length === 1 * n && ph.length === 1 * n && tx.length === 2 * n && ys.every((v, i) => !i || v > ys[i - 1]) && ys.every((v) => v > 0 && v < r.h), 'listă cu capsule (' + n + '): forme și benzi, una sub alta');
  }
  ok(diagramAlt({ k: 'pilllist', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (listă cu capsule): A, B', 'listă cu capsule: textul alternativ');
  // 04.11: Listă cu decagoane: pe fiecare rând banda și decagonul (10 colțuri), cu numărul și textul, una sub alta, în desen.
  for (const n of [3, 6]) {
    const items = 'ABCDEF'.slice(0, n).split(''), r = diagramSvg({ k: 'decagonlist', color: '#4f6bed', items }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml'), rc = doc.getElementsByTagName('rect'), ph = doc.getElementsByTagName('path'), tx = doc.getElementsByTagName('text');
    const ts = Array.from({ length: tx.length }, (_, i) => tx.item(i)), ys = ts.filter((_, i) => i % 2 === 1).map((e) => Number(e.getAttribute('y')));
    ok(rc.length === 1 * n && ph.length === 1 * n && tx.length === 2 * n && ys.every((v, i) => !i || v > ys[i - 1]) && ys.every((v) => v > 0 && v < r.h), 'listă cu decagoane (' + n + '): forme și benzi, una sub alta');
  }
  ok(diagramAlt({ k: 'decagonlist', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (listă cu decagoane): A, B', 'listă cu decagoane: textul alternativ');
  // 04.11: Listă cu plusuri: pe fiecare rând banda și semnul plus (12 colțuri), cu numărul și textul, una sub alta, în desen.
  for (const n of [3, 6]) {
    const items = 'ABCDEF'.slice(0, n).split(''), r = diagramSvg({ k: 'pluslist', color: '#4f6bed', items }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml'), rc = doc.getElementsByTagName('rect'), ph = doc.getElementsByTagName('path'), tx = doc.getElementsByTagName('text');
    const ts = Array.from({ length: tx.length }, (_, i) => tx.item(i)), ys = ts.filter((_, i) => i % 2 === 1).map((e) => Number(e.getAttribute('y')));
    ok(rc.length === n && ph.length === n && ph.item(0).getAttribute('d').split('L').length === 12 && tx.length === 2 * n && ys.every((v, i) => !i || v > ys[i - 1]) && ys.every((v) => v > 0 && v < r.h), 'listă cu plusuri (' + n + '): forme și benzi, una sub alta');
  }
  ok(diagramAlt({ k: 'pluslist', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (listă cu plusuri): A, B', 'listă cu plusuri: textul alternativ');
  // 04.11: Os de pește: capul (problema) în dreapta, cauzele în căsuțe pe rând sus și jos, fiecare cu un os spre șira spinării, înaintea capului.
  for (const n of [2, 5, 8]) {
    const items = 'PABCDEFG'.slice(0, n).split(''), r = diagramSvg({ k: 'fishbone', color: '#4f6bed', items }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml'), rc = doc.getElementsByTagName('rect'), ph = doc.getElementsByTagName('path'), tx = doc.getElementsByTagName('text');
    const R = Array.from({ length: rc.length }, (_, i) => ['x', 'y', 'width', 'height'].map((k) => Number(rc.item(i).getAttribute(k)))), head = R.at(-1), causes = R.slice(1, -1);
    const T = Array.from({ length: tx.length }, (_, i) => tx.item(i).textContent);
    ok(rc.length === n + 1 && ph.length === n && T.at(-1) === 'P' && causes.every((c, i) => c[0] + c[2] <= head[0] && (i % 2 ? c[1] > r.h / 2 : c[1] + c[3] < r.h / 2) && (i < 2 || c[0] > causes[i - 2][0])) && head[0] + head[2] <= 550.5, 'os de pește (' + n + '): capul în dreapta, cauzele sus și jos');
  }
  ok(diagramAlt({ k: 'fishbone', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (os de pește): A, B', 'os de pește: textul alternativ');
  // 04.11: Hartă mentală: ovalul cu subiectul în mijloc, ramurile în dreapta (1, 3, 5…) și în stânga (2, 4…), una sub alta, fiecare cu o linie curbă.
  for (const n of [2, 5, 8]) {
    const items = 'SABCDEFG'.slice(0, n).split(''), r = diagramSvg({ k: 'mindmap', color: '#4f6bed', items }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml'), rc = doc.getElementsByTagName('rect'), ph = doc.getElementsByTagName('path'), el = doc.getElementsByTagName('ellipse'), tx = doc.getElementsByTagName('text');
    const R = Array.from({ length: rc.length }, (_, i) => ['x', 'y', 'width', 'height'].map((k) => Number(rc.item(i).getAttribute(k)))), cx = Number(el.item(0)?.getAttribute('cx'));
    ok(rc.length === n - 1 && ph.length === n - 1 && el.length === 1 && tx.item(tx.length - 1).textContent === 'S' && R.every((c, i) => (i % 2 ? c[0] + c[2] < cx - 75 : c[0] > cx + 75) && (i < 2 || c[1] > R[i - 2][1]) && c[1] >= 0 && c[1] + c[3] <= r.h), 'hartă mentală (' + n + '): ramurile în dreapta și în stânga');
  }
  ok(diagramAlt({ k: 'mindmap', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (hartă mentală): A, B', 'hartă mentală: textul alternativ');
  // 04.11: Listă cu paralelograme / cu heptagoane: pe fiecare rând banda și forma (4 / 7 colțuri), cu numărul și textul, una sub alta, în desen.
  for (const [k, nm, np] of [['parallelogramlist', 'paralelograme', 4], ['heptagonlist', 'heptagoane', 7], ['dodecagonlist', 'dodecagoane', 12], ['signlist', 'indicatoare', 5], ['calloutlist', 'bule de vorbire', 7], ['star6list', 'stele în șase colțuri', 12], ['star8list', 'rozete', 16], ['sparklist', 'sclipiri', 8], ['notchlist', 'săgeți crestate', 8], ['boltlist', 'fulgere', 7], ['setsquarelist', 'echere', 3], ['trapezoidlist', 'trapeze numerotate', 4], ['star10list', 'stele în zece colțuri', 20], ['star7list', 'stele în șapte colțuri', 14], ['star16list', 'stele în șaisprezece colțuri', 32], ['star24list', 'stele în douăzeci și patru de colțuri', 48], ['star32list', 'stele în treizeci și două de colțuri', 64], ['badgelist', 'ecusoane', 5], ['sniplist', 'plăcuțe teșite', 6], ['round1list', 'plăcuțe rotunjite', 8], ['snipdiaglist', 'plăcuțe cu colțuri opuse tăiate', 6], ['rounddiaglist', 'plăcuțe cu colțuri opuse rotunjite', 12], ['quarterlist', 'sferturi de cerc', 10], ['sniproundlist', 'plăcuțe cu un colț tăiat și unul rotunjit', 9], ['ovalcalloutlist', 'bule ovale', 24], ['roundcalloutlist', 'bule rotunjite', 19], ['chordlist', 'segmente de cerc', 13], ['displaylist', 'ecrane', 12], ['mergelist', 'triunghiuri întoarse', 3], ['cornerlist', 'colțare', 6], ['desklist', 'pupitre', 4], ['stripelist', 'benzi oblice', 4], ['halfframelist', 'jumătăți de cadru', 6], ['storagelist', 'date stocate', 18], ['rightcalloutlist', 'casete cu săgeată', 11], ['downcalloutlist', 'casete cu săgeată în jos', 11], ['upcalloutlist', 'casete cu săgeată în sus', 11], ['burst2list', 'explozii mari', 28], ['lrcalloutlist', 'casete cu săgeți în ambele părți', 18], ['quadcalloutlist', 'casete cu săgeți în patru părți', 32]]) {
    for (const n of [3, 8]) {
      const items = 'ABCDEFGH'.slice(0, n).split(''), r = diagramSvg({ k, color: '#4f6bed', items }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml'), rc = doc.getElementsByTagName('rect'), ph = doc.getElementsByTagName('path'), tx = doc.getElementsByTagName('text');
      const ts = Array.from({ length: tx.length }, (_, i) => tx.item(i)), ys = ts.filter((_, i) => i % 2 === 1).map((e) => Number(e.getAttribute('y'))), corners = ph.item(0).getAttribute('d').split('L').length;
      ok(rc.length === n && ph.length === n && tx.length === 2 * n && corners === np && ys.every((v, i) => !i || v > ys[i - 1]) && ys.every((v) => v > 0 && v < r.h), 'listă cu ' + nm + ' (' + n + '): forme și benzi, una sub alta');
    }
    ok(diagramAlt({ k, color: '#000000', items: ['A', 'B'] }) === 'Diagramă (listă cu ' + nm + '): A, B', 'listă cu ' + nm + ': textul alternativ');
  }
  // 04.11: Listă cu semilune: pe fiecare rând banda și semiluna (două arce), cu numărul și textul, una sub alta, în desen.
  for (const n of [3, 8]) {
    const items = 'ABCDEFGH'.slice(0, n).split(''), r = diagramSvg({ k: 'moonlist', color: '#4f6bed', items }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml'), rc = doc.getElementsByTagName('rect'), ph = doc.getElementsByTagName('path'), tx = doc.getElementsByTagName('text');
    const ts = Array.from({ length: tx.length }, (_, i) => tx.item(i)), ys = ts.filter((_, i) => i % 2 === 1).map((e) => Number(e.getAttribute('y'))), arcs = ph.item(0).getAttribute('d').split('A').length - 1;
    ok(rc.length === n && ph.length === n && tx.length === 2 * n && arcs === 2 && ts[1].textContent === '1' && ys.every((v, i) => !i || v > ys[i - 1]) && ys.every((v) => v > 0 && v < r.h), 'listă cu semilune (' + n + '): forme și benzi, una sub alta');
  }
  ok(diagramAlt({ k: 'moonlist', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (listă cu semilune): A, B', 'listă cu semilune: textul alternativ');
  // 04.11: Drum cu borne: drumul și linia lui, câte o bornă, o linie și o căsuță pentru fiecare etapă; căsuțele pe rând deasupra și dedesubt, în desen, fără să se atingă.
  for (const n of [2, 5, 7, 8]) {
    const items = 'ABCDEFGH'.slice(0, n).split(''), r = diagramSvg({ k: 'roadmap', color: '#4f6bed', items }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml'), rc = doc.getElementsByTagName('rect'), ci = doc.getElementsByTagName('ellipse'), ph = doc.getElementsByTagName('path');
    const C = Array.from({ length: ci.length }, (_, i) => ['cx', 'cy'].map((k) => Number(ci.item(i).getAttribute(k)))), R = Array.from({ length: rc.length }, (_, i) => ['x', 'y', 'width', 'height'].map((k) => Number(rc.item(i).getAttribute(k))));
    ok(ph.length === 2 + n && ci.length === n && rc.length === n && C.every((c, i) => !i || c[0] > C[i - 1][0]) && R.every((b, i) => b[0] >= 0 && b[0] + b[2] <= 560 && b[1] >= 0 && b[1] + b[3] <= r.h && (i % 2 ? b[1] > C[i][1] + 10 : b[1] + b[3] < C[i][1] - 10) && (i < 2 || b[0] >= R[i - 2][0] + R[i - 2][2])), 'drum cu borne (' + n + '): bornele pe drum, căsuțele sus și jos');
  }
  ok(diagramAlt({ k: 'roadmap', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (drum cu borne): A, B', 'drum cu borne: textul alternativ');
  // 04.11: Munte cu etape: muntele, zăpada, steagul, poteca și câte o linie pentru fiecare etapă; punctele urcă, ultimul pe vârf; căsuțele pe rând în stânga și în dreapta, în afara muntelui, fără să se atingă.
  for (const n of [2, 5, 8]) {
    const items = 'ABCDEFGH'.slice(0, n).split(''), r = diagramSvg({ k: 'mountain', color: '#4f6bed', items }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml'), rc = doc.getElementsByTagName('rect'), ci = doc.getElementsByTagName('ellipse'), ph = doc.getElementsByTagName('path'), tx = doc.getElementsByTagName('text');
    const C = Array.from({ length: ci.length }, (_, i) => ['cx', 'cy'].map((k) => Number(ci.item(i).getAttribute(k)))), R = Array.from({ length: rc.length }, (_, i) => ['x', 'y', 'width', 'height'].map((k) => Number(rc.item(i).getAttribute(k)))), top = Math.min(...ph.item(0).getAttribute('d').match(/-?[\d.]+/g).map(Number).filter((_, i) => i % 2));
    ok(ph.length === 4 + n && ci.length === n && rc.length === n && tx.length === n && C.every((c, i) => !i || c[1] < C[i - 1][1]) && Math.abs(C[n - 1][1] - top) < 0.5 && Math.abs(C[n - 1][0] - 280) < 0.5
      && R.every((b, i) => b[0] >= 0 && b[0] + b[2] <= 560 && b[1] >= 0 && b[1] + b[3] <= r.h && (i % 2 ? b[0] > C[i][0] : b[0] + b[2] < C[i][0]) && (i < 2 || b[1] + b[3] <= R[i - 2][1])), 'munte cu etape (' + n + '): punctele urcă spre vârf, căsuțele pe rând în stânga și în dreapta');
  }
  ok(diagramAlt({ k: 'mountain', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (munte cu etape): A, B', 'munte cu etape: textul alternativ');
  // 04.11: Termometru: tubul și coloana (2 dreptunghiuri), rezervorul (2 cercuri), câte o gradație și o căsuță pe nivel; nivelurile de jos în sus, în dreapta tubului, fără să se atingă.
  for (const n of [2, 5, 8]) {
    const items = 'ABCDEFGH'.slice(0, n).split(''), r = diagramSvg({ k: 'thermometer', color: '#4f6bed', items }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml'), rc = doc.getElementsByTagName('rect'), ci = doc.getElementsByTagName('ellipse'), ph = doc.getElementsByTagName('path'), tx = doc.getElementsByTagName('text');
    const R = Array.from({ length: rc.length }, (_, i) => ['x', 'y', 'width', 'height'].map((k) => Number(rc.item(i).getAttribute(k)))), tube = R[0], col = R[1], B = R.slice(2);
    ok(rc.length === n + 2 && ci.length === 2 && ph.length === n && tx.length === n && tx.item(0).textContent === 'A' && col[1] <= B[n - 1][1] + B[n - 1][3] / 2 && col[1] >= tube[1]
      && B.every((b, i) => b[0] > tube[0] + tube[2] && b[0] + b[2] <= 560 && b[1] >= 0 && b[1] + b[3] <= r.h && (!i || b[1] + b[3] <= B[i - 1][1])), 'termometru (' + n + '): nivelurile de jos în sus, coloana până la ultimul');
  }
  ok(diagramAlt({ k: 'thermometer', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (termometru): A, B', 'termometru: textul alternativ');
  // 04.11: Pod: apa, cele două maluri cu primul și ultimul element, stâlpii și podul, pașii dintre ele deasupra podului, fără să se atingă.
  for (const n of [2, 4, 5, 8]) {
    const items = 'ABCDEFGH'.slice(0, n).split(''), r = diagramSvg({ k: 'bridge', color: '#4f6bed', items }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml'), rc = doc.getElementsByTagName('rect'), ph = doc.getElementsByTagName('path'), tx = doc.getElementsByTagName('text');
    const R = Array.from({ length: rc.length }, (_, i) => ['x', 'y', 'width', 'height'].map((k) => Number(rc.item(i).getAttribute(k)))), banks = R.slice(1, 3), mid = R.slice(3);
    const apart = (a, b) => a[0] + a[2] <= b[0] || b[0] + b[2] <= a[0] || a[1] + a[3] <= b[1] || b[1] + b[3] <= a[1];
    ok(rc.length === n + 1 && ph.length === 8 && tx.length === n && tx.item(0).textContent === 'A' && tx.item(1).textContent === items[n - 1] && banks[0][0] === 0 && banks[1][0] + banks[1][2] === 560
      && mid.every((b) => b[1] >= 0 && b[1] + b[3] < banks[0][1] && b[0] >= banks[0][2] - 40 && b[0] + b[2] <= 560 - banks[1][2] + 40 && mid.every((o) => o === b || apart(b, o))), 'pod (' + n + '): malurile, pașii pe pod');
  }
  ok(diagramAlt({ k: 'bridge', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (pod): A, B', 'pod: textul alternativ');
  // 04.11: Piese de puzzle: câte o piesă (un traseu) și un text pe idee; nodul pe dreapta și scobitura pe stânga doar între piesele de pe același rând; pe două rânduri peste 4.
  for (const n of [2, 4, 5, 8]) {
    const items = 'ABCDEFGH'.slice(0, n).split(''), r = diagramSvg({ k: 'puzzle', color: '#4f6bed', items }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml'), ph = doc.getElementsByTagName('path'), tx = doc.getElementsByTagName('text');
    const cols = n > 4 ? Math.ceil(n / 2) : n, D = Array.from({ length: ph.length }, (_, i) => ph.item(i).getAttribute('d')), arcs = D.map((s) => (s.match(/A/g) || []).length);
    const cmd = D.map((s) => [...s.matchAll(/([MHV])(-?[\d.]+)(?: (-?[\d.]+))?/g)]), xs = cmd.map((c) => c.filter((m) => m[1] !== 'V').map((m) => Number(m[2]))), ys = cmd.map((c) => c.flatMap((m) => m[1] === 'V' ? [Number(m[2])] : m[1] === 'M' ? [Number(m[3])] : []));
    ok(ph.length === n && tx.length === n && tx.item(0).textContent === 'A' && arcs.every((a, i) => a === (i % cols ? 1 : 0) + (i % cols < cols - 1 && i < n - 1 ? 1 : 0))
      && ys.every((y) => Math.min(...y) >= 0 && Math.max(...y) <= r.h) && xs.every((x) => Math.min(...x) >= 0 && Math.max(...x) <= 560) && (n > 4) === (Math.max(...ys[n - 1]) > Math.max(...ys[0]) + 20), 'piese de puzzle (' + n + '): piesele se îmbină pe rând');
  }
  ok(diagramAlt({ k: 'puzzle', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (piese de puzzle): A, B', 'piese de puzzle: textul alternativ');
  // 04.11: Copac: trunchiul și rădăcina (2 dreptunghiuri), coroana și câte o frunză pe idee (n − 1), câte o ramură pe frunză; frunzele în coroană, fără să se atingă; rădăcina sub coroană.
  for (const n of [2, 4, 5, 8]) {
    const items = 'ABCDEFGH'.slice(0, n).split(''), r = diagramSvg({ k: 'tree', color: '#4f6bed', items }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml'), rc = doc.getElementsByTagName('rect'), ci = doc.getElementsByTagName('ellipse'), ph = doc.getElementsByTagName('path'), tx = doc.getElementsByTagName('text');
    const E = Array.from({ length: ci.length }, (_, i) => ['cx', 'cy', 'rx', 'ry'].map((k) => Number(ci.item(i).getAttribute(k)))), crown = E[0], L = E.slice(1), base = ['x', 'y', 'width', 'height'].map((k) => Number(rc.item(1).getAttribute(k)));
    const inCrown = (x, y) => ((x - crown[0]) / crown[2]) ** 2 + ((y - crown[1]) / crown[3]) ** 2 <= 1;
    ok(rc.length === 2 && ci.length === n && ph.length === n - 1 && tx.length === n && tx.item(tx.length - 1).textContent === 'A' && base[1] >= crown[1] + crown[3] && base[1] + base[3] <= r.h
      && L.every((l, i) => inCrown(l[0] - l[2], l[1]) && inCrown(l[0] + l[2], l[1]) && inCrown(l[0], l[1] - l[3]) && inCrown(l[0], l[1] + l[3]) && L.every((o, j) => j === i || Math.abs(o[0] - l[0]) >= o[2] + l[2] || Math.abs(o[1] - l[1]) >= o[3] + l[3])), 'copac (' + n + '): frunzele în coroană, rădăcina jos');
  }
  ok(diagramAlt({ k: 'tree', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (copac): A, B', 'copac: textul alternativ');
  // 04.11: Bec cu idei: sticla (un cerc) cu primul element, câte o căsuță și o rază pe celelalte; căsuțele nu ating becul și nici una pe alta.
  for (const n of [2, 4, 5, 8]) {
    const items = 'ABCDEFGH'.slice(0, n).split(''), r = diagramSvg({ k: 'bulb', color: '#4f6bed', items }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml'), rc = doc.getElementsByTagName('rect'), ci = doc.getElementsByTagName('circle'), ph = doc.getElementsByTagName('path'), tx = doc.getElementsByTagName('text');
    const B = Array.from({ length: n - 1 }, (_, i) => ['x', 'y', 'width', 'height'].map((k) => Number(rc.item(i).getAttribute(k)))), c = ['cx', 'cy', 'r'].map((k) => Number(ci.item(0).getAttribute(k)));
    const apart = (a, b) => a[0] + a[2] <= b[0] || b[0] + b[2] <= a[0] || a[1] + a[3] <= b[1] || b[1] + b[3] <= a[1];
    ok(ci.length === 1 && rc.length === n + 1 && ph.length === n && tx.length === n && tx.item(tx.length - 1).textContent === 'A' && c[1] + c[2] + 44 <= r.h
      && B.every((b, i) => (b[0] + b[2] <= c[0] - c[2] || b[0] >= c[0] + c[2]) && b[1] >= 0 && b[1] + b[3] <= r.h && B.every((o, j) => j === i || apart(b, o))), 'bec cu idei (' + n + '): căsuțele în jurul becului');
  }
  ok(diagramAlt({ k: 'bulb', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (bec cu idei): A, B', 'bec cu idei: textul alternativ');
  // 04.11: Busolă: steaua și cercul cu primul element în mijloc, câte o rază și o căsuță pe direcție; căsuțele nu ating cercul, steaua sau una pe alta.
  for (const n of [2, 5, 6, 8]) {
    const items = 'ABCDEFGH'.slice(0, n).split(''), r = diagramSvg({ k: 'compass', color: '#4f6bed', items }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml'), rc = doc.getElementsByTagName('rect'), ci = doc.getElementsByTagName('circle'), pg = doc.getElementsByTagName('polygon'), ph = doc.getElementsByTagName('path'), tx = doc.getElementsByTagName('text');
    const B = Array.from({ length: rc.length }, (_, i) => ['x', 'y', 'width', 'height'].map((k) => Number(rc.item(i).getAttribute(k)))), S = pg.item(0).getAttribute('points').split(' ').map((p) => p.split(',').map(Number));
    const sx = S.map((p) => p[0]), sy = S.map((p) => p[1]), star = [Math.min(...sx), Math.min(...sy), Math.max(...sx) - Math.min(...sx), Math.max(...sy) - Math.min(...sy)];
    const apart = (a, b) => a[0] + a[2] <= b[0] || b[0] + b[2] <= a[0] || a[1] + a[3] <= b[1] || b[1] + b[3] <= a[1];
    const nearStar = (b) => S.some(([x, y]) => x > b[0] && x < b[0] + b[2] && y > b[1] && y < b[1] + b[3]);
    ok(ci.length === 1 && pg.length === 1 && rc.length === n - 1 && ph.length === n - 1 && tx.length === n && tx.item(0).textContent === 'A' && star[2] > 2 * Number(ci.item(0).getAttribute('r'))
      && B.every((b, i) => b[0] >= 0 && b[1] >= 0 && b[0] + b[2] <= 560 && b[1] + b[3] <= r.h && !nearStar(b) && apart(b, [star[0] + star[2] * 0.3, star[1] + star[3] * 0.3, star[2] * 0.4, star[3] * 0.4]) && B.every((o, j) => j === i || apart(b, o))), 'busolă (' + n + '): căsuțele pe direcții, fără să se atingă');
  }
  ok(diagramAlt({ k: 'compass', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (busolă): A, B', 'busolă: textul alternativ');
  // 04.11: Aisberg: apa, partea de sub apă, valul, vârful; vârful deasupra liniei apei, benzile (n − 1) sub ea, una sub alta, în desen.
  for (const n of [2, 5, 8]) {
    const items = 'ABCDEFGH'.slice(0, n).split(''), r = diagramSvg({ k: 'iceberg', color: '#4f6bed', items }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml'), rc = doc.getElementsByTagName('rect'), ph = doc.getElementsByTagName('path'), tx = doc.getElementsByTagName('text');
    const R = Array.from({ length: rc.length }, (_, i) => ['x', 'y', 'width', 'height'].map((k) => Number(rc.item(i).getAttribute(k)))), yw = R[0][1], tip = ph.item(2).getAttribute('d').match(/-?[\d.]+/g).map(Number);
    const tipYs = tip.filter((_, i) => i % 2), rows = R.slice(1);
    ok(rc.length === n && ph.length === 3 && tx.length === n && tx.item(0).textContent === 'A' && Math.max(...tipYs) === yw && Math.min(...tipYs) >= 0 && rows.every((b, i) => b[1] > yw && b[1] + b[3] <= r.h && b[0] >= 0 && b[0] + b[2] <= 560 && (!i || b[1] >= rows[i - 1][1] + rows[i - 1][3])), 'aisberg (' + n + '): vârful deasupra apei, benzile sub ea');
  }
  ok(diagramAlt({ k: 'iceberg', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (aisberg): A, B', 'aisberg: textul alternativ');
  // 04.11: Curbă de creștere: o curbă, câte o bulină și o căsuță pentru fiecare idee; bulinele urcă de la stânga la dreapta, căsuțele sub bulină, în dreapta ei, alăturate.
  for (const n of [2, 5, 8]) {
    const items = 'ABCDEFGH'.slice(0, n).split(''), r = diagramSvg({ k: 'growthcurve', color: '#4f6bed', items }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml'), rc = doc.getElementsByTagName('rect'), ci = doc.getElementsByTagName('ellipse'), ph = doc.getElementsByTagName('path');
    const C = Array.from({ length: ci.length }, (_, i) => ['cx', 'cy'].map((k) => Number(ci.item(i).getAttribute(k)))), R = Array.from({ length: rc.length }, (_, i) => ['x', 'y', 'width', 'height'].map((k) => Number(rc.item(i).getAttribute(k))));
    ok(ph.length === 1 && ci.length === n && rc.length === n && C.every((c, i) => !i || (c[0] > C[i - 1][0] && c[1] < C[i - 1][1])) && R.every((b, i) => b[0] >= 0 && b[0] + b[2] <= 560 && b[1] >= 0 && b[1] + b[3] <= r.h && b[1] > C[i][1] && b[0] > C[i][0] && (!i || b[0] >= R[i - 1][0] + R[i - 1][2])), 'curbă de creștere (' + n + '): bulinele urcă, căsuțele sub curbă, în desen');
  }
  ok(diagramAlt({ k: 'growthcurve', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (curbă de creștere): A, B', 'curbă de creștere: textul alternativ');
  // 04.11: Lista cu rame: pe fiecare rând banda, golul alb și rama (două contururi, cu evenodd), cu numărul și textul, una sub alta, în desen.
  for (const n of [3, 6]) {
    const items = 'ABCDEF'.slice(0, n).split(''), r = diagramSvg({ k: 'framelist', color: '#4f6bed', items }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml'), rc = doc.getElementsByTagName('rect'), ph = doc.getElementsByTagName('path'), tx = doc.getElementsByTagName('text');
    const ds = Array.from({ length: ph.length }, (_, i) => ph.item(i)), ys = ds.map((e) => Number(e.getAttribute('d').split(',')[1].split(' ')[0]));
    ok(rc.length === 2 * n && ph.length === n && tx.length === 2 * n && ds.every((e) => e.getAttribute('fill-rule') === 'evenodd' && (e.getAttribute('d').match(/Z/g) || []).length === 2) && ys.every((v, i) => !i || v > ys[i - 1]) && ys.every((v) => v >= 0 && v < r.h), 'listă cu rame (' + n + '): rame și benzi, una sub alta');
  }
  ok(diagramAlt({ k: 'framelist', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (listă cu rame): A, B', 'listă cu rame: textul alternativ');
  // 04.11: Lista cu sori: pe fiecare rând banda, cercul și cele 8 raze (triunghiuri), cu numărul și textul, una sub alta, în desen.
  for (const n of [3, 6]) {
    const items = 'ABCDEF'.slice(0, n).split(''), r = diagramSvg({ k: 'sunlist', color: '#4f6bed', items }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml'), rc = doc.getElementsByTagName('rect'), pg = doc.getElementsByTagName('polygon'), ci = doc.getElementsByTagName('ellipse'), tx = doc.getElementsByTagName('text');
    const ps = Array.from({ length: pg.length }, (_, i) => pg.item(i).getAttribute('points').trim().split(/ +/).map((q) => q.split(',').map(Number))), cys = Array.from({ length: ci.length }, (_, i) => Number(ci.item(i).getAttribute('cy')));
    ok(rc.length === n && ci.length === n && pg.length === 8 * n && tx.length === 2 * n && ps.every((p) => p.length === 3) && cys.every((v, i) => !i || v > cys[i - 1]) && ps.every((p) => p.every(([x, y]) => x >= 0 && y >= 0 && y <= r.h)), 'listă cu sori (' + n + '): sori cu raze și benzi, una sub alta');
  }
  ok(diagramAlt({ k: 'sunlist', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (listă cu sori): A, B', 'listă cu sori: textul alternativ');
  // 04.11: Lista cu butoane: pe fiecare rând banda, pătratul mare, fața din mijloc și cele 4 muchii, cu numărul și textul, una sub alta, în desen.
  for (const n of [3, 6]) {
    const items = 'ABCDEF'.slice(0, n).split(''), r = diagramSvg({ k: 'bevellist', color: '#4f6bed', items }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml'), rc = doc.getElementsByTagName('rect'), ph = doc.getElementsByTagName('path'), tx = doc.getElementsByTagName('text');
    const ds = Array.from({ length: ph.length }, (_, i) => ph.item(i).getAttribute('d'));
    const sq = Array.from({ length: rc.length }, (_, i) => rc.item(i)).filter((e) => !e.getAttribute('rx')).map((e) => ['x', 'y', 'width', 'height'].map((a) => Number(e.getAttribute(a))));
    ok(rc.length === 3 * n && sq.length === 2 * n && ph.length === n && tx.length === 2 * n && ds.every((d) => (d.match(/M/g) || []).length === 4) && sq.every((q) => q[2] === q[3] && q[1] >= 0 && q[1] + q[3] <= r.h) && sq.every((q, i) => i < 2 || q[1] > sq[i - 2][1]), 'listă cu butoane (' + n + '): butoane teșite și benzi, una sub alta');
  }
  ok(diagramAlt({ k: 'bevellist', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (listă cu butoane): A, B', 'listă cu butoane: textul alternativ');
  // 04.11: Lista cu notițe: pe fiecare rând banda, foaia cu 5 colțuri și îndoitura cu 3, cu numărul și textul, una sub alta, în desen.
  for (const n of [3, 6]) {
    const items = 'ABCDEF'.slice(0, n).split(''), r = diagramSvg({ k: 'notelist', color: '#4f6bed', items }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml'), rc = doc.getElementsByTagName('rect'), pg = doc.getElementsByTagName('polygon'), tx = doc.getElementsByTagName('text');
    const ps = Array.from({ length: pg.length }, (_, i) => pg.item(i).getAttribute('points').trim().split(/ +/).map((q) => q.split(',').map(Number)));
    const sheets = ps.filter((p) => p.length === 5), folds = ps.filter((p) => p.length === 3);
    ok(rc.length === n && sheets.length === n && folds.length === n && tx.length === 2 * n && sheets.every((p, i) => !i || p[0][1] > sheets[i - 1][0][1]) && ps.every((p) => p.every(([x, y]) => x >= 0 && y >= 0 && y <= r.h)), 'listă cu notițe (' + n + '): foi cu colțul îndoit și benzi, una sub alta');
  }
  ok(diagramAlt({ k: 'notelist', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (listă cu notițe): A, B', 'listă cu notițe: textul alternativ');
  // 04.11: Lista cu cilindri: pe fiecare rând banda, corpul cilindrului (cu două arce) și capacul (elipsa), cu numărul și textul, una sub alta, în desen.
  for (const n of [3, 6]) {
    const items = 'ABCDEF'.slice(0, n).split(''), r = diagramSvg({ k: 'canlist', color: '#4f6bed', items }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml'), rc = doc.getElementsByTagName('rect'), ph = doc.getElementsByTagName('path'), el = doc.getElementsByTagName('ellipse'), tx = doc.getElementsByTagName('text');
    const ds = Array.from({ length: ph.length }, (_, i) => ph.item(i).getAttribute('d')), cys = Array.from({ length: el.length }, (_, i) => Number(el.item(i).getAttribute('cy')));
    ok(rc.length === n && ph.length === n && el.length === n && tx.length === 2 * n && ds.every((d) => (d.match(/A/g) || []).length === 2 && d.endsWith('Z')) && cys.every((v, i) => !i || v > cys[i - 1]) && cys.every((v) => v > 0 && v < r.h), 'listă cu cilindri (' + n + '): cilindri și benzi, una sub alta');
  }
  ok(diagramAlt({ k: 'canlist', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (listă cu cilindri): A, B', 'listă cu cilindri: textul alternativ');
}
{
  // 31.10: Radial divergent: mijlocul în cerc, 3 căsuțe, 3 săgeți cu vârful (primul punct) spre căsuță.
  const doc = new DOMParser().parseFromString(diagramSvg({ k: 'diverge', color: '#4f6bed', items: ['Idee', 'A', 'B', 'C'] }).svg, 'image/svg+xml'), pg = doc.getElementsByTagName('polygon');
  const c = doc.getElementsByTagName('circle').item(0), cx = +c.getAttribute('cx'), cy = +c.getAttribute('cy');
  const far = (i) => { const p = pg.item(i).getAttribute('points').split(' ').map((q) => q.split(',').map(Number)), d = p.map(([x, y]) => Math.hypot(x - cx, y - cy)); return d[0] === Math.max(...d); };
  ok(pg.length === 3 && doc.getElementsByTagName('circle').length === 1 && doc.getElementsByTagName('rect').length === 3 && [0, 1, 2].every(far), 'radial divergent: 3 căsuțe, săgețile pleacă din mijloc');
  ok(diagramAlt({ k: 'diverge', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (radial divergent): A, B', 'radial divergent: textul alternativ');
}
{
  // 31.10: Venn stivuit: 4 cercuri tot mai mici, cu aceeași margine de jos.
  const doc = new DOMParser().parseFromString(diagramSvg({ k: 'stackvenn', color: '#4f6bed', items: ['A', 'B', 'C', 'D'] }).svg, 'image/svg+xml'), c = doc.getElementsByTagName('circle');
  const cs = Array.from({ length: c.length }, (_, i) => ({ y: +c.item(i).getAttribute('cy'), r: +c.item(i).getAttribute('r') }));
  ok(cs.length === 4 && cs.every((k, i) => !i || (k.r < cs[i - 1].r && Math.abs(k.y + k.r - cs[0].y - cs[0].r) < 0.2)), 'Venn stivuit: 4 cercuri tot mai mici, pe aceeași bază');
  ok(diagramAlt({ k: 'stackvenn', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (venn stivuit): A, B', 'Venn stivuit: textul alternativ');
}
{
  // 31.10: Listă în piramidă: 3 niveluri (vârful sus, tot mai late) și 3 bare cu text, în dreapta piramidei.
  const doc = new DOMParser().parseFromString(diagramSvg({ k: 'pyramidlist', color: '#4f6bed', items: ['A', 'B', 'C'] }).svg, 'image/svg+xml'), pg = doc.getElementsByTagName('polygon'), rc = doc.getElementsByTagName('rect');
  const wd = Array.from({ length: pg.length }, (_, i) => { const xs = pg.item(i).getAttribute('points').split(' ').map((q) => +q.split(',')[0]); return Math.max(...xs) - Math.min(...xs); });
  const right = Math.max(...Array.from({ length: pg.length }, (_, i) => Math.max(...pg.item(i).getAttribute('points').split(' ').map((q) => +q.split(',')[0]))));
  ok(pg.length === 3 && rc.length === 3 && wd.every((w, i) => !i || w > wd[i - 1]) && Array.from({ length: 3 }, (_, i) => +rc.item(i).getAttribute('x')).every((x) => x > right), 'listă în piramidă: 3 niveluri și 3 bare alături');
  ok(diagramAlt({ k: 'pyramidlist', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (listă în piramidă): A, B', 'listă în piramidă: textul alternativ');
}
{
  // 01.11: Săgeată ascendentă: banda, vârful și câte un punct pe ea pentru fiecare pas, tot mai sus spre dreapta, toate în desen.
  const r = diagramSvg({ k: 'uparrow', color: '#4f6bed', items: ['A', 'B', 'C', 'D'] }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml');
  const c = doc.getElementsByTagName('rect'), cs = Array.from({ length: c.length }, (_, i) => [+c.item(i).getAttribute('x') + 9, +c.item(i).getAttribute('y') + 9]);
  const tip = doc.getElementsByTagName('polygon').item(0).getAttribute('points').split(' ').map((q) => q.split(',').map(Number));
  ok(doc.getElementsByTagName('polyline').length === 1 && cs.length === 4 && cs.every((p, i) => p[1] > 0 && p[1] < r.h && (!i || (p[0] > cs[i - 1][0] && p[1] < cs[i - 1][1])))
    && tip.every((p) => p[0] <= 560 && p[1] >= 0), 'săgeată ascendentă: 4 puncte tot mai sus spre dreapta, vârful în desen ' + JSON.stringify(cs));
  ok(diagramAlt({ k: 'uparrow', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (săgeată ascendentă): A, B', 'săgeată ascendentă: textul alternativ');
}
{
  // 01.11: Săgeți în sens opus: 2 săgeți (sus spre dreapta, jos spre stânga), 3 idei → 2 pe cea de sus, 1 pe cea de jos.
  const r = diagramSvg({ k: 'opposing', color: '#4f6bed', items: ['A', 'B', 'C'] }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml');
  const pg = doc.getElementsByTagName('polygon'), tx = doc.getElementsByTagName('text');
  const pts = (i) => pg.item(i).getAttribute('points').split(' ').map((q) => q.split(',').map(Number)), ty = (i) => +tx.item(i).getAttribute('y');
  ok(pg.length === 2 && tx.length === 3 && pts(0)[3][0] === 550 && pts(1)[3][0] === 10 && pts(1)[3][1] > pts(0)[3][1] && ty(0) === ty(1) && ty(2) > ty(0)
    && Math.max(...pts(1).map((p) => p[1])) <= r.h, 'săgeți în sens opus: sus spre dreapta cu 2 idei, jos spre stânga cu 1');
  ok(diagramAlt({ k: 'opposing', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (săgeți în sens opus): A, B', 'săgeți în sens opus: textul alternativ');
}
{
  // 02.11: Săgeți față în față: 2 săgeți pe același rând, vârfurile aproape de mijloc (stânga spre dreapta, dreapta spre stânga);
  // 5 idei → 3 pe săgeata din stânga, 2 pe cea din dreapta, toate pe același rând și în ordine.
  const r = diagramSvg({ k: 'meetarrows', color: '#4f6bed', items: ['A', 'B', 'C', 'D', 'E'] }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml');
  const pg = doc.getElementsByTagName('polygon'), tx = doc.getElementsByTagName('text');
  const pts = (i) => pg.item(i).getAttribute('points').split(' ').map((q) => q.split(',').map(Number)), tX = (i) => +tx.item(i).getAttribute('x'), tY = (i) => +tx.item(i).getAttribute('y');
  const tipL = pts(0)[3], tipR = pts(1)[3];
  ok(pg.length === 2 && tx.length === 5 && tipL[0] < 280 && tipL[0] > 260 && tipR[0] > 280 && tipR[0] < 300 && tipL[1] === tipR[1]
    && [0, 1, 2, 3, 4].every((i) => tY(i) === tY(0) && (!i || tX(i) > tX(i - 1))) && tX(2) < tipL[0] && tX(3) > tipR[0]
    && [0, 1].every((i) => pts(i).every((p) => p[0] >= 0 && p[0] <= 560 && p[1] >= 0 && p[1] <= r.h)), 'săgeți față în față: vârfurile la mijloc, 3 idei în stânga, 2 în dreapta ' + JSON.stringify([tipL, tipR]));
  ok(diagramAlt({ k: 'meetarrows', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (săgeți față în față): A, B', 'săgeți față în față: textul alternativ');
}
{
  // 02.11: Plus și minus: 2 cercuri sus (+ cu 2 bare, − cu una), 5 idei → 3 în coloana din stânga, 2 în dreapta, una sub alta, toate în desen.
  const r = diagramSvg({ k: 'plusminus', color: '#4f6bed', items: ['A', 'B', 'C', 'D', 'E'] }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml');
  const ci = doc.getElementsByTagName('circle'), tx = doc.getElementsByTagName('text'), rc = doc.getElementsByTagName('rect');
  const tX = (i) => +tx.item(i).getAttribute('x'), tY = (i) => +tx.item(i).getAttribute('y');
  ok(ci.length === 2 && tx.length === 5 && rc.length === 3 + 5 && +ci.item(0).getAttribute('cx') < 280 && +ci.item(1).getAttribute('cx') > 280
    && tX(0) === tX(1) && tX(1) === tX(2) && tY(1) > tY(0) && tY(2) > tY(1) && tX(3) === tX(4) && tX(3) > 280 && tY(3) === tY(0) && tY(4) === tY(1)
    && Array.from({ length: rc.length }, (_, i) => rc.item(i)).every((e) => +e.getAttribute('y') + +e.getAttribute('height') <= r.h && +e.getAttribute('x') + +e.getAttribute('width') <= 560), 'plus și minus: 3 idei sub plus, 2 sub minus');
  ok(diagramAlt({ k: 'plusminus', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (plus și minus): A, B', 'plus și minus: textul alternativ');
}
{
  // 03.11: Bule de dialog: 4 bule una sub alta, pe rând în stânga și în dreapta, fiecare cu coada ei (path), toate în desen.
  const r = diagramSvg({ k: 'bubbles', color: '#4f6bed', items: ['A', 'B', 'C', 'D'] }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml');
  const tx = doc.getElementsByTagName('text'), pa = doc.getElementsByTagName('path'), rc = doc.getElementsByTagName('rect');
  const tX = (i) => +tx.item(i).getAttribute('x'), tY = (i) => +tx.item(i).getAttribute('y');
  ok(tx.length === 4 && pa.length === 4 && rc.length === 8 && tX(0) < 280 && tX(1) > 280 && tX(2) === tX(0) && tX(3) === tX(1) && [1, 2, 3].every((i) => tY(i) > tY(i - 1))
    && Array.from({ length: rc.length }, (_, i) => rc.item(i)).every((e) => +e.getAttribute('y') + +e.getAttribute('height') <= r.h && +e.getAttribute('x') >= 0 && +e.getAttribute('x') + +e.getAttribute('width') <= 560), 'bule de dialog: pe rând stânga / dreapta, de sus în jos');
  ok(diagramAlt({ k: 'bubbles', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (bule de dialog): A, B', 'bule de dialog: textul alternativ');
}
{
  // 03.11: Podium: 3 blocuri pe aceeași linie de jos; primul loc în mijloc, cel mai înalt, al doilea în stânga, al treilea în dreapta.
  const r = diagramSvg({ k: 'podium', color: '#4f6bed', items: ['Aur', 'Argint', 'Bronz'] }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml');
  const rc = doc.getElementsByTagName('rect'), tx = doc.getElementsByTagName('text'), R = (i) => rc.item(i), A = (e, k) => +e.getAttribute(k), bot = (e) => A(e, 'y') + A(e, 'height');
  ok(rc.length === 3 && tx.length === 6 && tx.item(0).textContent === '1' && tx.item(1).textContent === 'Aur'
    && A(R(1), 'x') < A(R(0), 'x') && A(R(2), 'x') > A(R(0), 'x') && A(R(0), 'height') > A(R(1), 'height') && A(R(1), 'height') > A(R(2), 'height')
    && Math.abs(A(R(2), 'height') - A(R(0), 'height') / 2) < 1 && [1, 2].every((i) => Math.abs(bot(R(i)) - bot(R(0))) < 0.5)
    && Array.from({ length: rc.length }, (_, i) => rc.item(i)).every((e) => A(e, 'y') > 0 && bot(e) <= r.h && A(e, 'x') >= 0 && A(e, 'x') + A(e, 'width') <= 560), 'podium: primul în mijloc, cel mai înalt, ceilalți de o parte și de alta, pe aceeași linie');
  ok(diagramAlt({ k: 'podium', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (podium): A, B', 'podium: textul alternativ');
}
{
  // 03.11: Clepsidră: 5 benzi una sub alta; cea din mijloc e cea mai îngustă (are și talia, 6 colțuri), sus și jos la fel de late.
  const r = diagramSvg({ k: 'hourglass', color: '#4f6bed', items: ['Idei', 'Filtru', 'Alegerea', 'Plan', 'Rezultate'] }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml');
  const pg = doc.getElementsByTagName('polygon'), tx = doc.getElementsByTagName('text');
  const pts = (i) => pg.item(i).getAttribute('points').trim().split(' ').map((q) => q.split(',').map(Number));
  const wTop = (i) => { const q = pts(i); return Math.max(...q.map((a) => a[0])) - Math.min(...q.map((a) => a[0])); };
  const minW = (i) => { const q = pts(i), ys = [...new Set(q.map((a) => a[1]))]; return Math.min(...ys.map((y) => { const xs = q.filter((a) => a[1] === y).map((a) => a[0]); return Math.max(...xs) - Math.min(...xs); })); };
  ok(pg.length === 5 && tx.length === 5 && tx.item(2).textContent === 'Alegerea' && pts(2).length === 6 && [0, 1, 3, 4].every((i) => pts(i).length === 4)
    && minW(2) < minW(1) && minW(1) < minW(0) && minW(2) < minW(3) && minW(3) < minW(4) && Math.abs(wTop(0) - wTop(4)) < 1
    && [0, 1, 2, 3, 4].every((i) => pts(i).every(([x, y]) => x >= 0 && x <= 560 && y > 0 && y <= r.h)), 'clepsidră: benzile se îngustează spre mijloc și se lărgesc la loc, în desen');
  ok(diagramAlt({ k: 'hourglass', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (clepsidră): A, B', 'clepsidră: textul alternativ');
}
{
  // 03.11: Bare în clasament: 4 benzi una sub alta, din aceeași margine, fiecare mai scurtă; în față cercul cu locul.
  const r = diagramSvg({ k: 'rankbars', color: '#4f6bed', items: ['A', 'B', 'C', 'D'] }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml');
  const tx = doc.getElementsByTagName('text'), rc = doc.getElementsByTagName('rect'), ci = doc.getElementsByTagName('circle');
  const R = (i) => rc.item(i), A = (e, k) => +e.getAttribute(k);
  ok(tx.length === 8 && rc.length === 4 && ci.length === 4 && tx.item(0).textContent === '1' && tx.item(6).textContent === '4'
    && [1, 2, 3].every((i) => A(R(i), 'x') === A(R(0), 'x') && A(R(i), 'width') < A(R(i - 1), 'width') && A(R(i), 'y') > A(R(i - 1), 'y') + A(R(i - 1), 'height'))
    && Math.abs(A(R(3), 'width') - A(R(0), 'width') / 2) < 1 && A(ci.item(0), 'cx') < A(R(0), 'x')
    && Array.from({ length: rc.length }, (_, i) => rc.item(i)).every((e) => A(e, 'y') + A(e, 'height') <= r.h && A(e, 'x') + A(e, 'width') <= 560), 'bare în clasament: 4 benzi tot mai scurte, cu locul în față');
  ok(diagramAlt({ k: 'rankbars', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (bare în clasament): A, B', 'bare în clasament: textul alternativ');
}
{
  // 03.11: Listă tabel: titlul într-o bandă lată sus, 4 idei în coloane egale dedesubt, temelia jos.
  const r = diagramSvg({ k: 'tablelist', color: '#4f6bed', items: ['T', 'A', 'B', 'C', 'D'] }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml');
  const tx = doc.getElementsByTagName('text'), rc = doc.getElementsByTagName('rect');
  const tY = (i) => +tx.item(i).getAttribute('y'), R = (i) => rc.item(i), A = (e, k) => +e.getAttribute(k);
  ok(tx.length === 5 && rc.length === 1 + 4 + 1 && [1, 2, 3, 4].every((i) => tY(i) > tY(0) && tY(i) === tY(1)) && A(R(0), 'width') > 500
    && [1, 2, 3, 4].every((i) => A(R(i), 'y') > A(R(0), 'y') + A(R(0), 'height') && A(R(i), 'width') === A(R(1), 'width') && (i === 1 || A(R(i), 'x') > A(R(i - 1), 'x') + A(R(i - 1), 'width')))
    && A(R(5), 'y') > A(R(1), 'y') + A(R(1), 'height') && A(R(5), 'width') === A(R(0), 'width')
    && Array.from({ length: rc.length }, (_, i) => rc.item(i)).every((e) => A(e, 'y') + A(e, 'height') <= r.h && A(e, 'x') + A(e, 'width') <= 560), 'listă tabel: titlul sus, 4 coloane, temelia');
  ok(diagramAlt({ k: 'tablelist', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (listă tabel): A, B', 'listă tabel: textul alternativ');
}
{
  // 03.11: Listă cu linii: titlul într-o bandă colorată în stânga, bara în sus, 4 idei una sub alta în dreapta, fiecare cu o linie dedesubt.
  const r = diagramSvg({ k: 'linedlist', color: '#4f6bed', items: ['T', 'A', 'B', 'C', 'D'] }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml');
  const tx = doc.getElementsByTagName('text'), rc = doc.getElementsByTagName('rect');
  const tX = (i) => +tx.item(i).getAttribute('x'), tY = (i) => +tx.item(i).getAttribute('y'), R = (i) => rc.item(i), A = (e, k) => +e.getAttribute(k);
  ok(tx.length === 5 && rc.length === 2 + 4 && tX(0) < 200 && [1, 2, 3].every((i) => tX(i + 1) === tX(1) && tY(i + 1) > tY(i)) && tX(1) > 200
    && [2, 3, 4, 5].every((i) => A(R(i), 'height') === 2 && A(R(i), 'x') > A(R(1), 'x') + 5) && A(R(0), 'height') === A(R(1), 'height')
    && Array.from({ length: rc.length }, (_, i) => rc.item(i)).every((e) => A(e, 'y') + A(e, 'height') <= r.h && A(e, 'x') + A(e, 'width') <= 560), 'listă cu linii: titlul în stânga, 4 idei cu linii în dreapta');
  ok(diagramAlt({ k: 'linedlist', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (listă cu linii): A, B', 'listă cu linii: textul alternativ');
}
{
  // 01.11: Bandă înclinată: 3 paralelograme una lângă alta (sus mutat spre dreapta), cu textul în ele, toate în desen.
  const r = diagramSvg({ k: 'slanted', color: '#4f6bed', items: ['A', 'B', 'C'] }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml');
  const pg = doc.getElementsByTagName('polygon'), tx = doc.getElementsByTagName('text');
  const P = (i) => pg.item(i).getAttribute('points').split(' ').map((q) => q.split(',').map(Number));
  ok(pg.length === 3 && tx.length === 3 && [0, 1, 2].every((i) => { const p = P(i); return p[0][0] > p[3][0] && Math.abs((p[1][0] - p[0][0]) - (p[2][0] - p[3][0])) < 0.5 && p[2][1] <= r.h && p[1][0] <= 600 && (!i || p[3][0] > P(i - 1)[2][0]); }),
    'bandă înclinată: paralelograme aplecate spre dreapta, una lângă alta');
  ok(diagramAlt({ k: 'slanted', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (bandă înclinată): A, B', 'bandă înclinată: textul alternativ');
}
{
  // 01.11: Templu: acoperișul (un triunghi), 3 coloane cu text una lângă alta sub el și temelia dedesubt, toate în desen.
  const r = diagramSvg({ k: 'temple', color: '#4f6bed', items: ['A', 'B', 'C'] }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml');
  const pg = doc.getElementsByTagName('polygon'), rc = doc.getElementsByTagName('rect'), tx = doc.getElementsByTagName('text'), a = (i, k) => +rc.item(i).getAttribute(k);
  const roofY = Math.max(...pg.item(0).getAttribute('points').split(' ').map((q) => +q.split(',')[1]));
  ok(pg.length === 1 && rc.length === 4 && tx.length === 3 && [0, 1, 2].every((i) => a(i, 'y') > roofY && a(i, 'y') + a(i, 'height') < a(3, 'y') && (!i || a(i, 'x') > a(i - 1, 'x') + a(i - 1, 'width'))) && a(3, 'y') + a(3, 'height') <= r.h,
    'templu: acoperiș, coloanele una lângă alta, temelia dedesubt');
  ok(diagramAlt({ k: 'temple', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (templu): A, B', 'templu: textul alternativ');
}
{
  // 01.11: Arc: un semicerc (path) și 5 cercuri cu text, de la stânga la dreapta, cel din mijloc mai sus decât capetele, toate în desen.
  const r = diagramSvg({ k: 'arc', color: '#4f6bed', items: ['A', 'B', 'C', 'D', 'E'] }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml');
  const c = doc.getElementsByTagName('circle'), tx = doc.getElementsByTagName('text'), a = (i, k) => +c.item(i).getAttribute(k);
  ok(doc.getElementsByTagName('path').length === 1 && c.length === 5 && tx.length === 5 && [1, 2, 3, 4].every((i) => a(i, 'cx') > a(i - 1, 'cx')) && a(2, 'cy') < a(1, 'cy') && a(1, 'cy') < a(0, 'cy') && Math.abs(a(0, 'cy') - a(4, 'cy')) < 0.5 && [0, 1, 2, 3, 4].every((i) => a(i, 'cy') - a(i, 'r') >= 0 && a(i, 'cy') + a(i, 'r') <= r.h),
    'arc: cercurile pe semicerc, mijlocul sus, capetele jos');
  ok(diagramAlt({ k: 'arc', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (arc): A, B', 'arc: textul alternativ');
}
{
  // 01.11: Cercuri crescătoare: 5 cercuri cu text, de la stânga la dreapta, fiecare mai mare, toate pe aceeași linie de jos, în desen.
  const r = diagramSvg({ k: 'growing', color: '#4f6bed', items: ['A', 'B', 'C', 'D', 'E'] }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml');
  const c = doc.getElementsByTagName('circle'), tx = doc.getElementsByTagName('text'), a = (i, k) => +c.item(i).getAttribute(k), bot = (i) => a(i, 'cy') + a(i, 'r');
  ok(c.length === 5 && tx.length === 5 && [1, 2, 3, 4].every((i) => a(i, 'cx') - a(i, 'r') >= a(i - 1, 'cx') + a(i - 1, 'r') && a(i, 'r') > a(i - 1, 'r') && Math.abs(bot(i) - bot(0)) < 0.5) && Math.abs(a(0, 'r') * 2 - a(4, 'r')) < 0.5 && [0, 1, 2, 3, 4].every((i) => a(i, 'cx') - a(i, 'r') >= 0 && a(i, 'cx') + a(i, 'r') <= 600 && a(i, 'cy') - a(i, 'r') >= 0 && bot(i) <= r.h),
    'cercuri crescătoare: tot mai mari, pe aceeași linie, fără suprapuneri');
  ok(diagramAlt({ k: 'growing', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (cercuri crescătoare): A, B', 'cercuri crescătoare: textul alternativ');
}
{
  // 01.11: Piramidă din triunghiuri: 5 idei → 3 rânduri (1 + 3 + 5 = 9 triunghiuri), 5 texte; toate în desen, vârful sus la mijloc.
  const r = diagramSvg({ k: 'trigrid', color: '#4f6bed', items: ['A', 'B', 'C', 'D', 'E'] }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml');
  const pg = doc.getElementsByTagName('polygon'), P = (i) => pg.item(i).getAttribute('points').split(' ').map((p) => p.split(',').map(Number));
  const all = Array.from({ length: pg.length }, (_, i) => P(i));
  ok(pg.length === 9 && doc.getElementsByTagName('text').length === 5 && Math.abs(P(0)[0][0] - 280) < 0.5 && P(0)[0][1] === 10 && all.every((q) => q.every(([x, y]) => x >= 0 && x <= 560 && y >= 0 && y <= r.h))
    && Math.abs(P(2)[2][0] - P(0)[0][0]) < 0.5 && Math.abs(P(4)[1][1] - r.h + 10) < 1, 'piramidă din triunghiuri: 3 rânduri, vârful sus, triunghiul întors sub vârf');
  { const r4 = diagramSvg({ k: 'trigrid', color: '#4f6bed', items: ['A', 'B', 'C', 'D'] }); ok(new DOMParser().parseFromString(r4.svg, 'image/svg+xml').getElementsByTagName('polygon').length === 4, 'piramidă din triunghiuri: 4 idei → 2 rânduri, fără locuri goale'); }
  ok(diagramAlt({ k: 'trigrid', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (piramidă din triunghiuri): A, B', 'piramidă din triunghiuri: textul alternativ');
}
{
  // 01.11: Cruce de idei: 7 idei; prima la mijloc, apoi sus, dreapta, jos, stânga, apoi colțurile dreapta sus și dreapta jos; 6 linii spre mijloc.
  const r = diagramSvg({ k: 'cross', color: '#4f6bed', items: ['M', 'S', 'D', 'J', 'St', 'DS', 'DJ'] }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml');
  const rc = doc.getElementsByTagName('rect'), C = (i) => { const e = rc.item(i); return [Number(e.getAttribute('x')) + Number(e.getAttribute('width')) / 2, Number(e.getAttribute('y')) + Number(e.getAttribute('height')) / 2]; };
  const m = C(0);
  ok(rc.length === 7 && doc.getElementsByTagName('line').length === 6 && Math.abs(m[0] - 280) < 0.5 && Math.abs(C(1)[0] - m[0]) < 0.5 && C(1)[1] < m[1] && C(2)[0] > m[0] && C(2)[1] === m[1] && C(3)[1] > m[1] && C(4)[0] < m[0]
    && C(5)[0] > m[0] && C(5)[1] < m[1] && C(6)[0] > m[0] && C(6)[1] > m[1] && Array.from({ length: rc.length }, (_, i) => rc.item(i)).every((e) => Number(e.getAttribute('y')) + Number(e.getAttribute('height')) <= r.h), 'cruce de idei: mijlocul, crucea, apoi colțurile');
  ok(diagramAlt({ k: 'cross', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (cruce de idei): A, B', 'cruce de idei: textul alternativ');
}
{
  // 01.11: Listă cu acoladă: ideea principală în stânga, la mijloc pe înălțime; celelalte una sub alta în dreapta; o acoladă între ele.
  const r = diagramSvg({ k: 'bracket', color: '#4f6bed', items: ['Rezumat', 'A', 'B', 'C'] }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml');
  const rc = doc.getElementsByTagName('rect'), R = (i) => ['x', 'y', 'width', 'height'].map((a) => Number(rc.item(i).getAttribute(a)));
  const m = R(0), k = [R(1), R(2), R(3)];
  ok(rc.length === 4 && doc.getElementsByTagName('path').length === 1 && doc.getElementsByTagName('text').length === 4 && m[0] === 10
    && k.every((b) => b[0] > m[0] + m[2] + 20 && b[0] === k[0][0] && b[1] + b[3] <= r.h) && k[1][1] > k[0][1] && k[2][1] > k[1][1]
    && Math.abs(m[1] + m[3] / 2 - r.h / 2) < 1, 'listă cu acoladă: ideea principală în stânga, restul în dreapta, cu acoladă');
  const one = diagramSvg({ k: 'bracket', color: '#4f6bed', items: ['Singur'] }), d1 = new DOMParser().parseFromString(one.svg, 'image/svg+xml');
  ok(d1.getElementsByTagName('rect').length === 1 && !d1.getElementsByTagName('path').length, 'listă cu acoladă: o singură idee, fără acoladă');
  ok(diagramAlt({ k: 'bracket', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (listă cu acoladă): A, B', 'listă cu acoladă: textul alternativ');
}
{
  // 01.11: Cercuri în grilă: cercuri la fel de mari; la 4 idei două rânduri de câte două, la 5 trei sus și două jos (centrate), toate în desen.
  for (const n of [4, 5]) {
    const items = 'ABCDE'.slice(0, n).split(''), r = diagramSvg({ k: 'circlegrid', color: '#4f6bed', items }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml');
    const el = doc.getElementsByTagName('circle'), cs = [...Array(el.length).keys()].map((i) => ['cx', 'cy', 'r'].map((a) => Number(el.item(i).getAttribute(a))));
    const top = cs.filter((c) => c[1] === cs[0][1]).length, mid = cs.reduce((s, c) => s + c[0], 0) / cs.length;
    ok(cs.length === n && doc.getElementsByTagName('text').length === n && cs.every((c) => c[2] === cs[0][2] && c[0] - c[2] >= 9 && c[0] + c[2] <= 611 && c[1] + c[2] <= r.h)
      && top === (n === 4 ? 2 : 3) && cs.every((c, i) => cs.every((d, j) => i === j || Math.hypot(c[0] - d[0], c[1] - d[1]) >= c[2] * 2)), `cercuri în grilă (${n}): rânduri, fără suprapuneri, în desen ` + JSON.stringify(cs));
    ok(Math.abs(cs.slice(top).reduce((s, c) => s + c[0], 0) / (n - top) - cs.slice(0, top).reduce((s, c) => s + c[0], 0) / top) < 1, `cercuri în grilă (${n}): rândul de jos centrat sub cel de sus ` + mid);
  }
  ok(diagramAlt({ k: 'circlegrid', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (cercuri în grilă): A, B', 'cercuri în grilă: textul alternativ');
}
{
  // 02.11: Listă cu buline pe linie: o linie verticală, n buline pe ea, n benzi una sub alta, în dreapta bulinelor, toate în desen.
  for (const n of [2, 6]) {
    const items = 'ABCDEF'.slice(0, n).split(''), r = diagramSvg({ k: 'beadlist', color: '#4f6bed', items }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml');
    const cs = [...Array(doc.getElementsByTagName('circle').length).keys()].map((i) => ['cx', 'cy', 'r'].map((a) => Number(doc.getElementsByTagName('circle').item(i).getAttribute(a))));
    const rs = [...Array(doc.getElementsByTagName('rect').length).keys()].map((i) => ['x', 'y', 'width', 'height'].map((a) => Number(doc.getElementsByTagName('rect').item(i).getAttribute(a)))).filter((q) => q[3] < r.h);
    const ln = doc.getElementsByTagName('line').item(0);
    ok(cs.length === n && rs.length === n && doc.getElementsByTagName('text').length === n && ln && Number(ln.getAttribute('x1')) === cs[0][0]
      && cs.every((c, i) => c[0] === cs[0][0] && Math.abs(c[1] - (rs[i][1] + rs[i][3] / 2)) < 0.5 && c[0] + c[2] < rs[i][0])
      && rs.every((q, i) => q[2] > 400 && q[0] + q[2] <= 611 && q[1] + q[3] <= r.h && (!i || q[1] >= rs[i - 1][1] + rs[i - 1][3])), `listă cu buline pe linie (${n}): buline pe linie, benzi una sub alta ` + JSON.stringify([cs, rs]));
  }
  ok(diagramAlt({ k: 'beadlist', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (listă cu buline pe linie): A, B', 'listă cu buline pe linie: textul alternativ');
}
{
  // 02.11: Fișe cu file: n fișe la fel de late, una lângă alta, fiecare cu fila deasupra, în stânga ei, toate în desen.
  for (const n of [2, 6]) {
    const items = 'ABCDEF'.slice(0, n).split(''), r = diagramSvg({ k: 'tabs', color: '#4f6bed', items }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml');
    const rs = [...Array(doc.getElementsByTagName('rect').length).keys()].map((i) => ['x', 'y', 'width', 'height'].map((a) => Number(doc.getElementsByTagName('rect').item(i).getAttribute(a)))).filter((q) => q[3] < r.h);
    const tabs = rs.filter((_, i) => i % 2 === 0), cards = rs.filter((_, i) => i % 2 === 1);
    ok(rs.length === 2 * n && doc.getElementsByTagName('text').length === n
      && cards.every((c, i) => Math.abs(c[2] - cards[0][2]) < 0.2 && c[1] === cards[0][1] && c[0] + c[2] <= 611 && c[1] + c[3] <= r.h && (!i || c[0] > cards[i - 1][0] + cards[i - 1][2]))
      && tabs.every((t, i) => t[0] === cards[i][0] && t[2] < cards[i][2] && t[1] < cards[i][1] && t[1] + t[3] > cards[i][1]), `fișe cu file (${n}): fișe alăturate, fila deasupra fiecăreia ` + JSON.stringify(rs));
  }
  ok(diagramAlt({ k: 'tabs', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (fișe cu file): A, B', 'fișe cu file: textul alternativ');
}
{
  // 02.11: Cronologie verticală: linia din mijloc, câte o bulină și o casetă pentru fiecare moment, casetele pe rând în dreapta și în stânga.
  for (const n of [2, 5, 8]) {
    const items = 'ABCDEFGH'.slice(0, n).split(''), r = diagramSvg({ k: 'vtimeline', color: '#4f6bed', items }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml');
    const rs = [...Array(doc.getElementsByTagName('rect').length).keys()].map((i) => ['x', 'y', 'width', 'height'].map((a) => Number(doc.getElementsByTagName('rect').item(i).getAttribute(a)))).filter((q) => q[2] > 40 && q[3] > 20 && q[3] < r.h);
    const side = rs.map((q) => q[0] + q[2] / 2 > 280);
    ok(rs.length === n && doc.getElementsByTagName('rect').length === 1 + 3 * n && doc.getElementsByTagName('text').length === n && side.every((s, i) => s === (i % 2 === 0))
      && rs.every((q, i) => !i || q[1] > rs[i - 1][1]) && rs.every((q) => q[0] >= 0 && q[0] + q[2] <= 560 && q[1] + q[3] <= r.h), 'cronologie verticală (' + n + '): casete pe rând dreapta / stânga ' + JSON.stringify(rs));
  }
  ok(diagramAlt({ k: 'vtimeline', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (cronologie verticală): A, B', 'cronologie verticală: textul alternativ');
}
{
  // 02.11: Ciclu cu blocuri: n dreptunghiuri la fel de mari, fără suprapuneri, primul sus, câte o săgeată pentru fiecare, toate în desen.
  for (const n of [2, 4, 6, 8]) {
    const items = 'ABCDEFGH'.slice(0, n).split(''), r = diagramSvg({ k: 'blockcycle', color: '#4f6bed', items }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml');
    const rs = [...Array(doc.getElementsByTagName('rect').length).keys()].map((i) => ['x', 'y', 'width', 'height'].map((a) => Number(doc.getElementsByTagName('rect').item(i).getAttribute(a)))).filter((q) => q[3] < r.h);
    const over = rs.some((q, i) => rs.some((o, j) => j > i && q[0] < o[0] + o[2] && o[0] < q[0] + q[2] && q[1] < o[1] + o[3] && o[1] < q[1] + q[3]));
    const arrows = doc.getElementsByTagName('polygon').length;
    ok(rs.length === n && arrows === n && doc.getElementsByTagName('text').length === n && !over && rs[0][1] === Math.min(...rs.map((q) => q[1]))
      && rs.every((q) => q[0] >= 0 && q[1] >= 0 && q[0] + q[2] <= 560 && q[1] + q[3] <= r.h), 'ciclu cu blocuri (' + n + '): ' + n + ' blocuri și ' + arrows + ' săgeți, fără suprapuneri ' + JSON.stringify(rs));
  }
  for (const n of [1, 3, 5, 8]) {
    const items = 'ABCDEFGH'.slice(0, n).split(''), r = diagramSvg({ k: 'radialvenn', color: '#4f6bed', items }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml');
    const c = Array.from(doc.getElementsByTagName('circle')).map((e) => ({ x: +e.getAttribute('cx'), y: +e.getAttribute('cy'), r: +e.getAttribute('r') })), m = c[0], o = c.slice(1);
    const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    ok(c.length === n && o.every((e) => d(e, m) < e.r + m.r - 3 && d(e, m) > m.r && e.x - e.r >= 0 && e.x + e.r <= 560 && e.y - e.r >= 0 && e.y + e.r <= r.h)
      && o.every((e, i) => o.every((q, j) => j <= i || d(e, q) >= e.r + q.r - 1)) && (!o.length || o[0].y < m.y) && doc.getElementsByTagName('text').length === n,
      'Venn radial ' + n + ': mijlocul și cercurile din jur care îl ating, fără suprapuneri între ele, în desen');
  }
  for (const n of [1, 2, 4, 5, 8]) {
    const items = 'ABCDEFGH'.slice(0, n).split(''), r = diagramSvg({ k: 'titledmatrix', color: '#4f6bed', items }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml');
    const rc = Array.from(doc.getElementsByTagName('rect')).map((e) => ({ x: +e.getAttribute('x'), y: +e.getAttribute('y'), w: +e.getAttribute('width'), h: +e.getAttribute('height') })), m = rc[rc.length - 1], g = rc.slice(0, -1);
    const ov = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    ok(rc.length === Math.max(2, n) && (n > 5 ? g.some((e) => ov(e, m)) : g.every((e) => ov(e, m))) && g.every((e, i) => g.every((o, j) => j <= i || !ov(e, o))) && rc.every((e) => e.x >= 0 && e.y >= 0 && e.x + e.w <= 560 && e.y + e.h <= r.h)
      && doc.getElementsByTagName('text').length === n, 'matrice cu titlu ' + n + ': grila sub titlu, fără suprapuneri între căsuțe, în desen');
  }
  ok(diagramAlt({ k: 'titledmatrix', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (matrice cu titlu): A, B', 'matrice cu titlu: textul alternativ');
  ok(diagramAlt({ k: 'radialvenn', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (venn radial): A, B', 'Venn radial: textul alternativ');
  ok(diagramAlt({ k: 'blockcycle', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (ciclu cu blocuri): A, B', 'ciclu cu blocuri: textul alternativ');
}
{
  // 02.11: Ciclu continuu: un inel (elipsă fără umplere, cu contur gros) și n dreptunghiuri la fel de mari pe el, fără suprapuneri, primul sus, toate în desen.
  for (const n of [2, 4, 6, 8]) {
    const items = 'ABCDEFGH'.slice(0, n).split(''), r = diagramSvg({ k: 'ringcycle', color: '#4f6bed', items }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml');
    const rs = [...Array(doc.getElementsByTagName('rect').length).keys()].map((i) => ['x', 'y', 'width', 'height'].map((a) => Number(doc.getElementsByTagName('rect').item(i).getAttribute(a)))).filter((q) => q[3] < r.h);
    const over = rs.some((q, i) => rs.some((o, j) => j > i && q[0] < o[0] + o[2] && o[0] < q[0] + q[2] && q[1] < o[1] + o[3] && o[1] < q[1] + q[3]));
    const el = doc.getElementsByTagName('ellipse'), ring = el.item(0);
    const cx = +ring.getAttribute('cx'), cy = +ring.getAttribute('cy'), rx = +ring.getAttribute('rx'), ry = +ring.getAttribute('ry');
    const onRing = rs.every((q) => Math.abs(((q[0] + q[2] / 2 - cx) / rx) ** 2 + ((q[1] + q[3] / 2 - cy) / ry) ** 2 - 1) < 0.01);
    ok(el.length === 1 && ring.getAttribute('fill') === 'none' && +ring.getAttribute('stroke-width') >= 15 && rs.length === n && onRing && doc.getElementsByTagName('text').length === n && !over
      && rs[0][1] === Math.min(...rs.map((q) => q[1])) && rs.every((q) => q[0] >= 0 && q[1] >= 0 && q[0] + q[2] <= 560 && q[1] + q[3] <= r.h), 'ciclu continuu (' + n + '): inelul și ' + n + ' blocuri pe el, fără suprapuneri ' + JSON.stringify(rs));
  }
  ok(diagramAlt({ k: 'ringcycle', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (ciclu continuu): A, B', 'ciclu continuu: textul alternativ');
}
{
  // 02.11: Blocuri în grilă: 4 idei = 2 × 2, 5 idei = 3 + 2 (ultimul rând centrat), blocuri la fel de mari, fără suprapuneri, în desen.
  for (const [n, rowsWant] of [[4, [2, 2]], [5, [3, 2]], [8, [3, 3, 2]]]) {
    const items = 'ABCDEFGH'.slice(0, n).split(''), r = diagramSvg({ k: 'blockgrid', color: '#4f6bed', items }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml');
    const rs = [...Array(doc.getElementsByTagName('rect').length).keys()].map((i) => ['x', 'y', 'width', 'height'].map((a) => Number(doc.getElementsByTagName('rect').item(i).getAttribute(a)))).filter((q) => q[3] < r.h);
    const ys = [...new Set(rs.map((q) => q[1]))], rows = ys.map((y) => rs.filter((q) => q[1] === y));
    const mids = rows.map((row) => (row[0][0] + row[row.length - 1][0] + row[0][2]) / 2), centered = mids.every((m) => Math.abs(m - mids[0]) < 1);
    ok(rs.length === n && doc.getElementsByTagName('text').length === n && JSON.stringify(rows.map((x) => x.length)) === JSON.stringify(rowsWant) && centered
      && rs.every((q) => Math.abs(q[2] - rs[0][2]) < 0.2 && q[3] === rs[0][3] && q[0] >= 9 && q[0] + q[2] <= 611 && q[1] + q[3] <= r.h)
      && rows.every((row) => row.every((q, i) => !i || q[0] > row[i - 1][0] + row[i - 1][2])), 'blocuri în grilă (' + n + '): rânduri ' + JSON.stringify(rowsWant) + ', centrate ' + JSON.stringify(rs));
  }
  ok(diagramAlt({ k: 'blockgrid', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (blocuri în grilă): A, B', 'blocuri în grilă: textul alternativ');
}
{
  // 01.11: Ovale în cascadă: ovale la fel de mari, fiecare mai la dreapta și mai jos decât cel dinainte, suprapuse puțin, toate în desen.
  const r = diagramSvg({ k: 'cascade', color: '#4f6bed', items: ['A', 'B', 'C', 'D'] }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml');
  const el = doc.getElementsByTagName('ellipse'), E = (i) => ['cx', 'cy', 'rx', 'ry'].map((a) => Number(el.item(i).getAttribute(a)));
  const es = [0, 1, 2, 3].map(E);
  ok(el.length === 4 && doc.getElementsByTagName('text').length === 4 && es.every((e, i) => e[2] === es[0][2] && e[3] === es[0][3] && e[0] - e[2] >= 9 && e[0] + e[2] <= 611 && e[1] + e[3] <= r.h
    && (!i || (e[0] > es[i - 1][0] && e[1] > es[i - 1][1] && e[0] - es[i - 1][0] < 2 * e[2] && e[1] - es[i - 1][1] < 2 * e[3]))), 'ovale în cascadă: în diagonală, suprapuse, în desen ' + JSON.stringify(es));
  ok(diagramAlt({ k: 'cascade', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (ovale în cascadă): A, B', 'ovale în cascadă: textul alternativ');
}
{
  // 01.11: Triunghiuri alternante: 5 triunghiuri pe o bandă, pe rând cu vârful sus și jos, lipite; textul în centrul fiecăruia.
  const r = diagramSvg({ k: 'triangles', color: '#4f6bed', items: ['A', 'B', 'C', 'D', 'E'] }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml');
  const pg = doc.getElementsByTagName('polygon'), tx = doc.getElementsByTagName('text'), P = (i) => pg.item(i).getAttribute('points').split(' ').map((p) => p.split(',').map(Number));
  const ys = (i) => P(i).map((p) => p[1]), top = Math.min(...ys(0)), bot = Math.max(...ys(0));
  ok(pg.length === 5 && tx.length === 5 && [0, 1, 2, 3, 4].every((i) => Math.min(...ys(i)) === top && Math.max(...ys(i)) === bot && P(i).every(([x, y]) => x >= 0 && x <= 560 && y >= 0 && y <= r.h))
    && P(0)[0][1] === top && P(1)[2][1] === bot && Math.abs(P(1)[0][0] - P(0)[0][0]) < 0.5 && Math.abs(P(1)[1][0] - P(0)[1][0] - (P(0)[1][0] - P(0)[2][0]) / 2) < 0.5
    && Number(tx.item(0).getAttribute('y')) > Number(tx.item(1).getAttribute('y')), 'triunghiuri alternante: sus / jos, lipite, textul spre baza fiecăruia');
  ok(diagramAlt({ k: 'triangles', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (triunghiuri alternante): A, B', 'triunghiuri alternante: textul alternativ');
}
{
  // 01.11: Romburi în zigzag: 6 romburi, fiecare cu o jumătate de lățime mai la dreapta și pe rând sus / jos; totul în desen.
  const r = diagramSvg({ k: 'diamonds', color: '#4f6bed', items: ['A', 'B', 'C', 'D', 'E', 'F'] }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml');
  const pg = doc.getElementsByTagName('polygon'), P = (i) => pg.item(i).getAttribute('points').split(' ').map((p) => p.split(',').map(Number));
  const w = P(0)[1][0] - P(0)[3][0];
  ok(pg.length === 6 && doc.getElementsByTagName('text').length === 6 && [1, 2, 3, 4, 5].every((i) => Math.abs(P(i)[0][0] - P(i - 1)[0][0] - w / 2) < 0.5 && Math.abs(Math.abs(P(i)[0][1] - P(i - 1)[0][1]) - w / 2) < 0.5) && P(1)[0][1] > P(0)[0][1]
    && [0, 1, 2, 3, 4, 5].every((i) => P(i).every(([x, y]) => x >= 0 && x <= 560 && y >= 0 && y <= r.h)) && Math.abs((P(0)[3][0] + P(5)[1][0]) / 2 - 280) < 0.5, 'romburi în zigzag: lipite latură pe latură, sus / jos, la mijloc');
  ok(diagramAlt({ k: 'diamonds', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (romburi în zigzag): A, B', 'romburi în zigzag: textul alternativ');
}
{
  // 01.11: Radial cu hexagoane: 7 hexagoane cu text; primul la mijloc, celelalte 6 la aceeași distanță de el (lipite, fără suprapuneri), toate în desen.
  const r = diagramSvg({ k: 'hexradial', color: '#4f6bed', items: ['A', 'B', 'C', 'D', 'E', 'F', 'G'] }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml');
  const pg = doc.getElementsByTagName('polygon'), tx = doc.getElementsByTagName('text'), P = (i) => pg.item(i).getAttribute('points').split(' ').map((p) => p.split(',').map(Number));
  const C = (i) => { const p = P(i); return [p.reduce((s, q) => s + q[0], 0) / 6, p.reduce((s, q) => s + q[1], 0) / 6]; }, dist = (i) => Math.hypot(C(i)[0] - C(0)[0], C(i)[1] - C(0)[1]);
  const hh = P(0)[5][1] - P(0)[1][1];
  ok(pg.length === 7 && tx.length === 7 && Math.abs(C(0)[0] - 280) < 0.5 && [1, 2, 3, 4, 5, 6].every((i) => Math.abs(dist(i) - hh) < 0.5) && C(1)[1] < C(0)[1] && Math.abs(C(1)[0] - C(0)[0]) < 0.5 && [0, 1, 2, 3, 4, 5, 6].every((i) => P(i).every(([x, y]) => x >= 0 && x <= 560 && y >= 0 && y <= r.h)),
    'radial cu hexagoane: centrul la mijloc, cele 6 lipite în jur, primul sus');
  { const r9 = diagramSvg({ k: 'hexradial', color: '#4f6bed', items: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'] }), d9 = new DOMParser().parseFromString(r9.svg, 'image/svg+xml'), q = d9.getElementsByTagName('polygon');
    const c9 = (i) => { const p = q.item(i).getAttribute('points').split(' ').map((s) => s.split(',').map(Number)); return [p.reduce((s, v) => s + v[0], 0) / 6, p.reduce((s, v) => s + v[1], 0) / 6, p[5][1] - p[1][1]]; };
    ok(q.length === 9 && [1, 2, 3, 4, 5, 6, 7].every((i) => Math.hypot(c9(i + 1)[0] - c9(i)[0], c9(i + 1)[1] - c9(i)[1]) >= c9(0)[2] - 0.5), 'radial cu hexagoane: cu 8 în jur, inelul se depărtează (vecinii nu se suprapun)'); }
  ok(diagramAlt({ k: 'hexradial', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (radial cu hexagoane): A, B', 'radial cu hexagoane: textul alternativ');
}
{
  // 01.11: Blocuri descrescătoare: 3 coloane cu aceeași margine de jos, tot mai scunde spre dreapta, toate în desen.
  const r = diagramSvg({ k: 'descending', color: '#4f6bed', items: ['A', 'B', 'C'] }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml');
  const rc = doc.getElementsByTagName('rect'), tx = doc.getElementsByTagName('text'), a = (i, k) => +rc.item(i).getAttribute(k);
  ok(rc.length === 3 && tx.length === 3 && [0, 1, 2].every((i) => Math.abs(a(i, 'y') + a(i, 'height') - (a(0, 'y') + a(0, 'height'))) < 0.5 && a(i, 'y') + a(i, 'height') <= r.h && (!i || (a(i, 'height') < a(i - 1, 'height') && a(i, 'x') > a(i - 1, 'x') + a(i - 1, 'width')))),
    'blocuri descrescătoare: coloanele pe aceeași linie de jos, tot mai scunde spre dreapta');
  ok(diagramAlt({ k: 'descending', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (blocuri descrescătoare): A, B', 'blocuri descrescătoare: textul alternativ');
}
{
  // 01.11: Listă cu trapeze: 3 trapeze una lângă alta, fiecare mai îngust sus, cu textul în el, toate în desen.
  const r = diagramSvg({ k: 'trapezoids', color: '#4f6bed', items: ['A', 'B', 'C'] }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml');
  const pg = doc.getElementsByTagName('polygon'), tx = doc.getElementsByTagName('text');
  const P = (i) => pg.item(i).getAttribute('points').split(' ').map((q) => q.split(',').map(Number));
  ok(pg.length === 3 && tx.length === 3 && [0, 1, 2].every((i) => { const p = P(i); return p[1][0] - p[0][0] < p[2][0] - p[3][0] && p[2][1] <= r.h && (!i || p[3][0] > P(i - 1)[2][0]) && Math.abs(+tx.item(i).getAttribute('x') - (p[3][0] + p[2][0]) / 2) < 1; }),
    'listă cu trapeze: trapezele una lângă alta, mai înguste sus, cu textul în mijloc');
  ok(diagramAlt({ k: 'trapezoids', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (listă cu trapeze): A, B', 'listă cu trapeze: textul alternativ');
}
{
  // 01.11: Listă pe săgeată: săgeata în jos în stânga, 3 pași unul sub altul în dreapta ei, toți în desen.
  const r = diagramSvg({ k: 'arrowlist', color: '#4f6bed', items: ['A', 'B', 'C'] }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml');
  const pg = doc.getElementsByTagName('polygon'), rc = doc.getElementsByTagName('rect'), tx = doc.getElementsByTagName('text');
  const pts = pg.item(0).getAttribute('points').split(' ').map((q) => q.split(',').map(Number)), ty = (i) => +tx.item(i).getAttribute('y');
  const ax = Math.max(...pts.map((p) => p[0])), tip = pts.reduce((a, p) => (p[1] > a[1] ? p : a));
  ok(pg.length === 1 && rc.length === 3 && tx.length === 3 && ty(1) > ty(0) && ty(2) > ty(1) && [0, 1, 2].every((i) => +rc.item(i).getAttribute('x') > ax)
    && tip[1] <= r.h && tip[1] > +rc.item(2).getAttribute('y'), 'listă pe săgeată: săgeata în jos în stânga, pașii unul sub altul în dreapta');
  ok(diagramAlt({ k: 'arrowlist', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (listă pe săgeată): A, B', 'listă pe săgeată: textul alternativ');
}
{
  // 01.11: Proces alternant: o săgeată, 4 pași pe rând sus / jos, fiecare cu linia lui spre săgeată, toți în desen.
  const r = diagramSvg({ k: 'alternating', color: '#4f6bed', items: ['A', 'B', 'C', 'D'] }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml');
  const pg = doc.getElementsByTagName('polygon'), rc = doc.getElementsByTagName('rect'), tx = doc.getElementsByTagName('text');
  const ty = (i) => +tx.item(i).getAttribute('y'), tX = (i) => +tx.item(i).getAttribute('x');
  const boxes = [...Array(rc.length).keys()].map((i) => rc.item(i)).filter((e) => +e.getAttribute('width') > 3);
  ok(pg.length === 1 && rc.length === 8 && tx.length === 4 && ty(0) === ty(2) && ty(1) === ty(3) && ty(1) > ty(0) && [1, 2, 3].every((i) => tX(i) > tX(i - 1))
    && boxes.every((e) => +e.getAttribute('x') >= 0 && +e.getAttribute('x') + +e.getAttribute('width') <= 560 && +e.getAttribute('y') + +e.getAttribute('height') <= r.h), 'proces alternant: săgeata, pașii 1 și 3 sus, 2 și 4 jos, de la stânga la dreapta');
  ok(diagramAlt({ k: 'alternating', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (proces alternant): A, B', 'proces alternant: textul alternativ');
}
{
  // 01.11: Balanță: 3 idei → 2 pe talerul din stânga, 1 în dreapta; brațul se înclină spre stânga (capătul stâng mai jos), toate în desen.
  const r = diagramSvg({ k: 'balance', color: '#4f6bed', items: ['A', 'B', 'C'] }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml');
  const c = doc.getElementsByTagName('rect'), rc = Array.from({ length: c.length }, (_, i) => [+c.item(i).getAttribute('x'), +c.item(i).getAttribute('y')]);
  const pg = doc.getElementsByTagName('polygon'), beam = pg.item(1).getAttribute('points').split(' ').map((q) => q.split(',').map(Number));
  ok(pg.length === 2 && rc.length === 3 && rc[0][0] === rc[1][0] && rc[1][1] < rc[0][1] && rc[2][0] > rc[0][0] && beam[0][1] > beam[1][1]
    && rc.every(([x, y]) => x >= 0 && y >= 0 && x + 170 <= 560 && y < r.h), 'balanță: 2 idei stivuite în stânga, 1 în dreapta, brațul înclinat spre stânga ' + JSON.stringify(rc));
  const e = diagramSvg({ k: 'balance', color: '#4f6bed', items: ['A', 'B', 'C', 'D'] }), de = new DOMParser().parseFromString(e.svg, 'image/svg+xml');
  const be = de.getElementsByTagName('polygon').item(1).getAttribute('points').split(' ').map((q) => q.split(',').map(Number));
  ok(Math.abs(be[0][1] - be[1][1]) < 0.01, 'balanță: la număr egal brațul e drept');
  ok(diagramAlt({ k: 'balance', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (balanță): A, B', 'balanță: textul alternativ');
}
{
  // 01.11: Venn liniar: 3 cercuri egale pe un rând, vecinii suprapuși, pe jumătate transparente, toate în desen.
  const r = diagramSvg({ k: 'linearvenn', color: '#4f6bed', items: ['A', 'B', 'C'] }), doc = new DOMParser().parseFromString(r.svg, 'image/svg+xml'), c = doc.getElementsByTagName('circle');
  const cs = Array.from({ length: c.length }, (_, i) => ['cx', 'cy', 'r', 'fill-opacity'].map((a) => +c.item(i).getAttribute(a)));
  ok(cs.length === 3 && cs.every((q) => q[1] === cs[0][1] && q[2] === cs[0][2] && q[3] === 0.55 && q[0] - q[2] >= 0 && q[0] + q[2] <= 560 && q[1] + q[2] <= r.h)
    && cs.every((q, i) => !i || (q[0] > cs[i - 1][0] && q[0] - cs[i - 1][0] < 2 * q[2])), 'Venn liniar: 3 cercuri egale pe un rând, suprapuse ' + JSON.stringify(cs));
  ok(diagramAlt({ k: 'linearvenn', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (venn liniar): A, B', 'Venn liniar: textul alternativ');
}
{
  // 01.11: Piramidă inversată: 4 niveluri, primul cel mai lat (sus), tot mai înguste, ultimul se strânge într-un vârf jos.
  const doc = new DOMParser().parseFromString(diagramSvg({ k: 'invpyramid', color: '#4f6bed', items: ['A', 'B', 'C', 'D'] }).svg, 'image/svg+xml'), pg = doc.getElementsByTagName('polygon');
  const pts = Array.from({ length: pg.length }, (_, i) => pg.item(i).getAttribute('points').split(' ').map((q) => q.split(',').map(Number)));
  const topW = pts.map((p) => p[1][0] - p[0][0]), last = pts[pts.length - 1];
  ok(pg.length === 4 && topW.every((w, i) => !i || (w < topW[i - 1] && pts[i][0][1] > pts[i - 1][0][1])) && Math.abs(last[2][0] - last[3][0]) < 0.5, 'piramidă inversată: 4 niveluri tot mai înguste, vârful jos');
  ok(diagramAlt({ k: 'invpyramid', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (piramidă inversată): A, B', 'piramidă inversată: textul alternativ');
}
ok(diagramAlt({ k: 'gears', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (roți dințate): A, B', 'roți dințate: textul alternativ');
ok(diagramAlt({ k: 'cycle', color: '#000000', items: ['A', 'B'] }) === 'Diagramă (ciclu): A, B', 'textul alternativ');
console.log(fail ? `\n${fail} verificări greșite` : '\nToate verificările au trecut.');
process.exit(fail ? 1 : 0);

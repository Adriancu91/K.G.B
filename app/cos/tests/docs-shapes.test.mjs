// Test pentru formele din Docs: fiecare formă are un desen SVG valid, în interiorul suprafeței, iar descrierea formei se citește în siguranță.
// Rulare (în suite/): node tests/docs-shapes.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import { DOMParser } from '@xmldom/xmldom';

const out = join(tmpdir(), `suite-docsshape-${process.pid}.mjs`);
await build({ stdin: { contents: "export * from './src/docs/shapes.ts'; export { addOp, sizeAfter, cropRect, clampInsets } from './src/docs/imageTransform.ts';", resolveDir: process.cwd(), loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error' });
const { SHAPES, shapeSvg, parseShape, shapeSize, addOp, sizeAfter, cropRect, clampInsets } = await import(pathToFileURL(out).href);
rmSync(out, { force: true });

let fail = 0;
const check = (name, ok, info = '') => { console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ' ' + info}`); if (!ok) fail++; };

check('22 de forme în meniu', SHAPES.length === 22, String(SHAPES.length));
for (const s of SHAPES) {
  const svg = shapeSvg({ k: s.k, fill: '#5b8def', stroke: '#1e3a8a', sw: 2 }, s.w, s.h);
  let errs = 0;
  const doc = new DOMParser({ onError: () => { errs++; } }).parseFromString(svg, 'image/svg+xml');
  const g = doc.getElementsByTagName('g')[0];
  const nums = (svg.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
  const pts = [...svg.matchAll(/points="([^"]+)"/g)].flatMap((m) => m[1].split(' ').map((p) => p.split(',').map(Number)));
  const inside = pts.every(([x, y]) => x >= 0 && x <= s.w && y >= 0 && y <= s.h);
  check(`${s.name}: SVG valid cu desen`, !errs && g && g.childNodes.length === 1 && nums.every(Number.isFinite), svg.slice(0, 200));
  check(`${s.name}: în interiorul suprafeței`, inside, JSON.stringify(pts));
}
{
  const svg = shapeSvg({ k: 'rect', fill: '', stroke: '#ff0000', sw: 3 }, 200, 120);
  check('fără umplere → fill="none"', svg.includes('fill="none"') && svg.includes('stroke="#ff0000"'));
  const line = shapeSvg({ k: 'line', fill: '', stroke: '#00ff00', sw: 4 }, 240, 16);
  check('linia folosește culoarea conturului', line.includes('stroke="#00ff00"') && line.includes('fill="none"'));
}
check('descriere bună citită', JSON.stringify(parseShape('{"k":"star","fill":"#ABCDEF","stroke":"","sw":2}')) === '{"k":"star","fill":"#abcdef","stroke":"","sw":2}');
check('felul necunoscut respins', parseShape('{"k":"<script>","fill":"#000000"}') === null);
check('culori stricate golite', parseShape('{"k":"rect","fill":"red\\" onload=\\"x","stroke":"#123456","sw":99}')?.fill === '' && parseShape('{"k":"rect","sw":99}')?.sw === 20);
check('text stricat → null', parseShape('{nu e json') === null && parseShape(null) === null);
check('mărimea de pornire', shapeSize('arrowUp').h === 180 && shapeSize('rect').w === 200);
check('rotirile se adună', addOp('r', 'r') === 'rr' && addOp('rrr', 'r') === '' && addOp('r', 'l') === '' && addOp('h', 'h') === '' && addOp('hr', 'v') === 'hrv');
check('rotirea schimbă lățimea cu înălțimea', JSON.stringify(sizeAfter('r', 200, 100)) === '{"w":100,"h":200}' && JSON.stringify(sizeAfter('h', 200, 100)) === '{"w":200,"h":100}');
check('operațiile formei se citesc', parseShape('{"k":"rect","t":"rx<h"}')?.t === 'rh');
check('decupare: dreptunghiul păstrat', JSON.stringify(cropRect(200, 100, { l: 0.25, t: 0.1, r: 0.25, b: 0 })) === JSON.stringify({ sx: 50, sy: 10, sw: 100, sh: 90 }));
check('decupare: rămâne cel puțin 5%', (() => { const c = clampInsets({ l: 0.9, t: -1, r: 0.9, b: NaN }); return Math.abs(1 - c.l - c.r - 0.05) < 1e-9 && c.t === 0 && c.b === 0; })());
// Efectele formei: umbră, strălucire, margini estompate (filtre SVG); forma se strânge ca efectul să încapă.
check('efectul se citește; unul necunoscut se ignoră', parseShape('{"k":"rect","fill":"#ff0000","fx":"glow"}')?.fx === 'glow' && parseShape('{"k":"rect","fx":"x"}')?.fx === undefined);
for (const fx of ['shadow', 'glow', 'soft']) {
  const svg = shapeSvg({ k: 'rect', fill: '#5b8def', stroke: '', sw: 0, fx }, 200, 120);
  let errs = 0;
  const doc = new DOMParser({ onError: () => { errs++; } }).parseFromString(svg, 'image/svg+xml');
  const r = doc.getElementsByTagName('rect')[0];
  check(`efect ${fx}: SVG valid, cu filtru pe formă`, !errs && doc.getElementsByTagName('filter').length === 1 && doc.getElementsByTagName('g')[0].getAttribute('filter') === 'url(#fx)', svg);
  check(`efect ${fx}: forma lasă loc efectului`, Number(r.getAttribute('x')) >= 8 && Number(r.getAttribute('width')) <= 184, svg);
}
check('strălucirea are culoarea formei', shapeSvg({ k: 'ellipse', fill: '#10b981', stroke: '', sw: 0, fx: 'glow' }, 140, 140).includes('flood-color="#10b981"'));
check('fără efect: fără filtru', !shapeSvg({ k: 'rect', fill: '#5b8def', stroke: '', sw: 0 }, 200, 120).includes('filter'));
console.log(fail ? `${fail} greșeli` : 'Toate verificările au trecut.');
process.exit(fail ? 1 : 0);

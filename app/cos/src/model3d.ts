// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Modele 3D (Inserare → 🧊 Model 3D): citirea fișierelor .stl (binar și text), .obj, .glb / .gltf și .ply, apoi desenul lor pe o pânză 2D,
// rotit după unghiurile alese, cu fețele umbrite după lumină și desenate de la cea mai depărtată la cea mai apropiată.
// Fără WebGL (merge și pe plăcile video integrate). Scris de la zero.

export interface Mesh {
  /** Triunghiurile, câte 9 numere (x, y, z pentru fiecare colț), deja centrate și aduse la raza 1. */
  tri: Float32Array;
  count: number;
}

/** Cel mult atâtea triunghiuri (peste, modelul se rărește la desen, ca să rămână ușor). */
export const MAX_TRIS = 300000;

function finish(list: number[] | Float32Array, count: number): Mesh {
  if (!count) throw new Error('Fișierul nu are nicio față de desenat.');
  const tri = list instanceof Float32Array ? list : Float32Array.from(list);
  let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < count * 9; i += 3) {
    const x = tri[i], y = tri[i + 1], z = tri[i + 2];
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) continue;
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, cz = (minZ + maxZ) / 2;
  let r = 0;
  for (let i = 0; i < count * 9; i += 3) {
    tri[i] -= cx; tri[i + 1] -= cy; tri[i + 2] -= cz;
    const d = Math.hypot(tri[i], tri[i + 1], tri[i + 2]);
    if (d > r) r = d;
  }
  if (!(r > 0)) throw new Error('Modelul nu are mărime (toate punctele sunt în același loc).');
  for (let i = 0; i < count * 9; i++) tri[i] = Number.isFinite(tri[i]) ? tri[i] / r : 0;
  return { tri, count };
}

/** .stl: binar (antet de 80 de octeți, numărul de fețe, 50 de octeți pe față) sau text („solid … facet … vertex”). */
export function parseStl(data: Uint8Array): Mesh {
  if (data.length >= 84) {
    const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const n = dv.getUint32(80, true);
    if (84 + n * 50 === data.length) {
      const count = Math.min(n, MAX_TRIS);
      const tri = new Float32Array(count * 9);
      for (let f = 0; f < count; f++) for (let k = 0; k < 9; k++) tri[f * 9 + k] = dv.getFloat32(84 + f * 50 + 12 + k * 4, true);
      return finish(tri, count);
    }
  }
  const text = new TextDecoder('latin1').decode(data);
  const v: number[] = [];
  for (const m of text.matchAll(/vertex\s+(\S+)\s+(\S+)\s+(\S+)/gi)) {
    v.push(+m[1], +m[2], +m[3]);
    if (v.length >= MAX_TRIS * 9) break;
  }
  if (!v.length) throw new Error('Fișierul .stl nu poate fi citit (nu e nici binar, nici text cu „vertex”).');
  const count = Math.floor(v.length / 9);
  return finish(v.slice(0, count * 9), count);
}

/** .obj: punctele „v x y z” și fețele „f a b c …” (indici de la 1 sau negativi, cu /vt/vn); fețele mari se taie în triunghiuri. */
export function parseObj(text: string): Mesh {
  const pts: number[] = [];
  const tri: number[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith('v ')) {
      const p = line.slice(2).trim().split(/\s+/);
      pts.push(+p[0], +p[1], +p[2]);
    } else if (line.startsWith('f ')) {
      const n = pts.length / 3;
      const idx = line.slice(2).trim().split(/\s+/).map((t) => { const i = parseInt(t, 10); return i < 0 ? n + i : i - 1; });
      if (idx.some((i) => !(i >= 0 && i < n))) continue;
      for (let k = 1; k + 1 < idx.length; k++) {
        for (const i of [idx[0], idx[k], idx[k + 1]]) tri.push(pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2]);
      }
      if (tri.length >= MAX_TRIS * 9) break;
    }
  }
  if (!tri.length) throw new Error('Fișierul .obj nu are fețe („f …”) de desenat.');
  return finish(tri, tri.length / 9);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;
type M4 = number[];
const ID4: M4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
/** a × b, matrici 4×4 pe coloane (ca în glTF). */
function mul(a: M4, b: M4): M4 {
  const r = new Array(16).fill(0);
  for (let c = 0; c < 4; c++) for (let row = 0; row < 4; row++) {
    let s = 0;
    for (let k = 0; k < 4; k++) s += a[k * 4 + row] * b[c * 4 + k];
    r[c * 4 + row] = s;
  }
  return r;
}
/** Matricea unui nod: „matrix” sau mutare × rotire (cuaternion) × mărime. */
function nodeMatrix(n: Json): M4 {
  if (Array.isArray(n.matrix) && n.matrix.length === 16) return n.matrix.map(Number);
  const [tx, ty, tz] = n.translation ?? [0, 0, 0];
  const [x, y, z, w] = n.rotation ?? [0, 0, 0, 1];
  const [sx, sy, sz] = n.scale ?? [1, 1, 1];
  return [
    (1 - 2 * (y * y + z * z)) * sx, (2 * (x * y + z * w)) * sx, (2 * (x * z - y * w)) * sx, 0,
    (2 * (x * y - z * w)) * sy, (1 - 2 * (x * x + z * z)) * sy, (2 * (y * z + x * w)) * sy, 0,
    (2 * (x * z + y * w)) * sz, (2 * (y * z - x * w)) * sz, (1 - 2 * (x * x + y * y)) * sz, 0,
    tx, ty, tz, 1,
  ];
}

function base64Bytes(s: string): Uint8Array {
  const bin = atob(s.replace(/[^A-Za-z0-9+/=]/g, ''));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** glTF 2.0: .glb (antet „glTF”, bucata JSON și bucata BIN) sau .gltf (JSON, cu datele scrise în el ca data:…;base64).
 *  Se iau triunghiurile tuturor obiectelor din scenă, cu mutările / rotirile / mărimile nodurilor. */
export function parseGltf(data: Uint8Array): Mesh {
  const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
  let json: Json = null;
  let bin: Uint8Array | null = null;
  try {
    if (data.length >= 20 && dv.getUint32(0, true) === 0x46546c67) {
      for (let off = 12; off + 8 <= data.length;) {
        const len = dv.getUint32(off, true), type = dv.getUint32(off + 4, true);
        const chunk = data.subarray(off + 8, off + 8 + len);
        if (type === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(chunk));
        else if (type === 0x004e4942 && !bin) bin = chunk;
        off += 8 + len;
      }
    } else json = JSON.parse(new TextDecoder().decode(data));
  } catch { json = null; }
  if (!json || typeof json !== 'object') throw new Error('Fișierul glTF nu poate fi citit.');
  if (!Array.isArray(json.meshes) || !json.meshes.length) throw new Error('Fișierul glTF nu are niciun obiect de desenat.');
  const used: string[] = [...(json.extensionsRequired ?? []), ...(json.extensionsUsed ?? [])];
  const buffers: (Uint8Array | null)[] = (json.buffers ?? []).map((b: Json, i: number) => {
    if (b?.uri === undefined) return i === 0 ? bin : null;
    const uri = String(b.uri);
    const comma = uri.indexOf(',');
    if (!uri.startsWith('data:') || comma < 0 || !/;base64$/i.test(uri.slice(0, comma))) return null;
    return base64Bytes(uri.slice(comma + 1));
  });
  let missing = false;
  const SIZE: Record<number, number> = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
  const COMPS: Record<string, number> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
  /** Valorile unui „accessor”, câte „comps” pe element. */
  const read = (ai: number): { v: Float64Array; comps: number } | null => {
    const a = json.accessors?.[ai];
    const view = a && json.bufferViews?.[a.bufferView];
    const buf = view && buffers[view.buffer];
    if (!a || !view) return null;
    if (!buf) { missing = true; return null; }
    const size = SIZE[a.componentType], comps = COMPS[a.type];
    if (!size || !comps) return null;
    const count = a.count | 0;
    const stride = view.byteStride || size * comps;
    const base = (view.byteOffset || 0) + (a.byteOffset || 0);
    const bdv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    const v = new Float64Array(count * comps);
    for (let i = 0; i < count; i++) for (let k = 0; k < comps; k++) {
      const p = base + i * stride + k * size;
      if (p + size > buf.byteLength) return null;
      let x: number;
      switch (a.componentType) {
        case 5120: x = bdv.getInt8(p); if (a.normalized) x = Math.max(x / 127, -1); break;
        case 5121: x = bdv.getUint8(p); if (a.normalized) x /= 255; break;
        case 5122: x = bdv.getInt16(p, true); if (a.normalized) x = Math.max(x / 32767, -1); break;
        case 5123: x = bdv.getUint16(p, true); if (a.normalized) x /= 65535; break;
        case 5125: x = bdv.getUint32(p, true); break;
        default: x = bdv.getFloat32(p, true);
      }
      v[i * comps + k] = x;
    }
    return { v, comps };
  };
  const tri: number[] = [];
  const addMesh = (mi: number, m: M4) => {
    for (const prim of json.meshes[mi]?.primitives ?? []) {
      if (tri.length >= MAX_TRIS * 9) return;
      const mode = prim.mode ?? 4;
      if (mode < 4 || mode > 6) continue;
      const pos = read(prim.attributes?.POSITION);
      if (!pos || pos.comps !== 3) continue;
      const n = pos.v.length / 3;
      const ix = prim.indices !== undefined ? read(prim.indices)?.v : null;
      if (prim.indices !== undefined && !ix) continue;
      const idx = ix ?? Float64Array.from({ length: n }, (_, i) => i);
      const put = (a: number, b: number, c: number) => {
        if (!(a < n && b < n && c < n)) return;
        for (const i of [a, b, c]) {
          const x = pos.v[i * 3], y = pos.v[i * 3 + 1], z = pos.v[i * 3 + 2];
          tri.push(m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]);
        }
      };
      if (mode === 4) for (let i = 0; i + 2 < idx.length; i += 3) put(idx[i], idx[i + 1], idx[i + 2]);
      else if (mode === 5) for (let i = 0; i + 2 < idx.length; i++) i % 2 ? put(idx[i + 1], idx[i], idx[i + 2]) : put(idx[i], idx[i + 1], idx[i + 2]);
      else for (let i = 1; i + 1 < idx.length; i++) put(idx[0], idx[i], idx[i + 1]);
    }
  };
  const nodes: Json[] = json.nodes ?? [];
  const seen = new Set<number>();
  const walk = (ni: number, parent: M4) => {
    const node = nodes[ni];
    if (!node || seen.has(ni)) return;
    seen.add(ni);
    const m = mul(parent, nodeMatrix(node));
    if (node.mesh !== undefined) addMesh(node.mesh, m);
    for (const c of node.children ?? []) walk(c, m);
  };
  const scene = json.scenes?.[json.scene ?? 0];
  if (scene?.nodes?.length) for (const ni of scene.nodes) walk(ni, ID4);
  else if (nodes.length) {
    const child = new Set<number>(nodes.flatMap((n) => n?.children ?? []));
    nodes.forEach((_, i) => { if (!child.has(i)) walk(i, ID4); });
  } else json.meshes.forEach((_: Json, i: number) => addMesh(i, ID4));
  if (!tri.length) {
    if (used.includes('KHR_draco_mesh_compression') || used.includes('EXT_meshopt_compression'))
      throw new Error('Modelul glTF e comprimat (Draco / meshopt) și nu poate fi citit; salvează-l din programul 3D fără comprimare.');
    if (missing) throw new Error('Datele modelului sunt într-un fișier separat (.bin) lângă .gltf; alege varianta .glb, cu totul într-un fișier.');
    throw new Error('Fișierul glTF nu are triunghiuri de desenat.');
  }
  const count = Math.min(Math.floor(tri.length / 9), MAX_TRIS);
  return finish(tri.slice(0, count * 9), count);
}

/** .ply (scanări 3D): antetul „ply … end_header”, apoi punctele și fețele, ca text sau binar (little / big endian). */
export function parsePly(data: Uint8Array): Mesh {
  const latin = new TextDecoder('latin1').decode(data.subarray(0, Math.min(data.length, 65536)));
  const end = latin.indexOf('end_header');
  if (!/^ply/.test(latin) || end < 0) throw new Error('Fișierul .ply nu poate fi citit (lipsește antetul „ply … end_header”).');
  let bodyAt = end + 'end_header'.length;
  if (latin[bodyAt] === String.fromCharCode(13)) bodyAt++;
  if (latin[bodyAt] === String.fromCharCode(10)) bodyAt++;
  type Prop = { name: string; type: string; list?: string };
  const elems: { name: string; count: number; props: Prop[] }[] = [];
  let format = 'ascii';
  for (const raw of latin.slice(0, end).split(/[\r\n]+/)) {
    const w = raw.trim().split(/[ \t]+/);
    if (w[0] === 'format') format = w[1];
    else if (w[0] === 'element') elems.push({ name: w[1], count: parseInt(w[2], 10) || 0, props: [] });
    else if (w[0] === 'property' && elems.length) {
      const props = elems[elems.length - 1].props;
      if (w[1] === 'list') props.push({ name: w[4], type: w[3], list: w[2] });
      else props.push({ name: w[2], type: w[1] });
    }
  }
  const vEl = elems.find((e) => e.name === 'vertex');
  if (!vEl || !vEl.count) throw new Error('Fișierul .ply nu are puncte.');
  const pts = new Float64Array(vEl.count * 3);
  const faces: number[] = [];
  const xyz = ['x', 'y', 'z'].map((k) => vEl.props.findIndex((p) => p.name === k));
  const fidx = (e: { props: Prop[] }) => e.props.findIndex((p) => p.list && /^vertex_ind(ex|ices)$/.test(p.name));
  const addFace = (ids: number[]) => { for (let k = 1; k + 1 < ids.length; k++) faces.push(ids[0], ids[k], ids[k + 1]); };
  if (format === 'ascii') {
    const nums = new TextDecoder('latin1').decode(data.subarray(bodyAt)).split(/[ \t\r\n]+/).filter(Boolean).map(Number);
    let at = 0;
    for (const e of elems) {
      const fi = e.name === 'face' ? fidx(e) : -1;
      for (let i = 0; i < e.count && at < nums.length; i++) {
        e.props.forEach((p, pi) => {
          if (p.list) {
            const n = nums[at++] | 0;
            const ids = Array.from(nums.slice(at, at + n));
            at += n;
            if (pi === fi) addFace(ids);
          } else {
            const x = nums[at++];
            if (e === vEl) { const k = xyz.indexOf(pi); if (k >= 0) pts[i * 3 + k] = x; }
          }
        });
      }
      if (e.name === 'face') break;
    }
  } else {
    const le = format === 'binary_little_endian';
    const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
    let at = bodyAt;
    const one = (t: string): number => {
      let x: number;
      switch (t) {
        case 'char': case 'int8': x = dv.getInt8(at); at += 1; break;
        case 'uchar': case 'uint8': x = dv.getUint8(at); at += 1; break;
        case 'short': case 'int16': x = dv.getInt16(at, le); at += 2; break;
        case 'ushort': case 'uint16': x = dv.getUint16(at, le); at += 2; break;
        case 'int': case 'int32': x = dv.getInt32(at, le); at += 4; break;
        case 'uint': case 'uint32': x = dv.getUint32(at, le); at += 4; break;
        case 'double': case 'float64': x = dv.getFloat64(at, le); at += 8; break;
        case 'float': case 'float32': x = dv.getFloat32(at, le); at += 4; break;
        default: throw new Error('Fișierul .ply are un tip de date necunoscut.');
      }
      return x;
    };
    try {
      for (const e of elems) {
        const fi = e.name === 'face' ? fidx(e) : -1;
        for (let i = 0; i < e.count; i++) {
          e.props.forEach((p, pi) => {
            if (p.list) {
              const n = one(p.list) | 0;
              const ids: number[] = [];
              for (let k = 0; k < n; k++) ids.push(one(p.type));
              if (pi === fi) addFace(ids);
            } else {
              const x = one(p.type);
              if (e === vEl) { const k = xyz.indexOf(pi); if (k >= 0) pts[i * 3 + k] = x; }
            }
          });
          if (faces.length >= MAX_TRIS * 3) break;
        }
        if (e.name === 'face') break;
      }
    } catch (err) {
      if (!(err instanceof RangeError)) throw err; // fișier tăiat: se desenează ce s-a citit
    }
  }
  if (!faces.length) throw new Error('Fișierul .ply are doar puncte (o scanare fără fețe), nu și fețe de desenat.');
  const n = vEl.count;
  const tri: number[] = [];
  for (let f = 0; f + 2 < faces.length && tri.length < MAX_TRIS * 9; f += 3) {
    const a = faces[f], b = faces[f + 1], c = faces[f + 2];
    if (!(a >= 0 && b >= 0 && c >= 0 && a < n && b < n && c < n)) continue;
    for (const i of [a, b, c]) tri.push(pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2]);
  }
  return finish(tri, tri.length / 9);
}

/** Modelul din fișier, după extensie (sau după conținut, dacă extensia lipsește). */
export function readModel(name: string, data: Uint8Array): Mesh {
  if (/\.obj$/i.test(name)) return parseObj(new TextDecoder().decode(data));
  if (/\.stl$/i.test(name)) return parseStl(data);
  if (/\.(glb|gltf)$/i.test(name)) return parseGltf(data);
  if (/\.ply$/i.test(name)) return parsePly(data);
  if (data.length >= 4 && data[0] === 0x67 && data[1] === 0x6c && data[2] === 0x54 && data[3] === 0x46) return parseGltf(data);
  const head = new TextDecoder('latin1').decode(data.subarray(0, 512));
  if (/^ply/.test(head)) return parsePly(data);
  if (/^\s*[{]/.test(head) && /"asset"/.test(head + new TextDecoder('latin1').decode(data.subarray(512, 4096)))) return parseGltf(data);
  return /^\s*(#|v |o |g |mtllib)/m.test(head) && !/^\s*solid/.test(head) ? parseObj(new TextDecoder().decode(data)) : parseStl(data);
}

export interface View3D {
  /** Rotirea în jurul axei verticale și a celei orizontale, în grade. */
  yaw: number;
  pitch: number;
  /** Culoarea modelului (#rrggbb). */
  color: string;
  /** Modelul e cu „sus” pe axa Z (cum salvează multe programe de proiectare); altfel Y e sus. */
  zUp?: boolean;
}

const hex = (c: string) => { const m = /^#?([0-9a-f]{6})$/i.exec(c); const n = m ? parseInt(m[1], 16) : 0x4a90d9; return [n >> 16, (n >> 8) & 255, n & 255]; };

/** Desenează modelul pe pânză (fundal transparent), cât să încapă cu o mică margine. */
export function drawModel(ctx: CanvasRenderingContext2D, mesh: Mesh, view: View3D, w: number, h: number): void {
  ctx.clearRect(0, 0, w, h);
  const a = (view.yaw * Math.PI) / 180, b = (view.pitch * Math.PI) / 180;
  const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
  const step = Math.max(1, Math.ceil(mesh.count / 120000));
  const n = Math.ceil(mesh.count / step);
  const sx = new Float32Array(n * 3), sy = new Float32Array(n * 3), depth = new Float32Array(n), shade = new Float32Array(n);
  const vis = new Uint8Array(n);
  const scale = Math.min(w, h) * 0.45, D = 4; // perspectivă ușoară: camera la distanța 4 (modelul are raza 1)
  const L = [-0.4, 0.55, 0.73]; // lumina vine din stânga sus, din față
  const t = mesh.tri;
  const P = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (let j = 0, f = 0; f < mesh.count; f += step, j++) {
    for (let k = 0; k < 3; k++) {
      let x = t[f * 9 + k * 3], y = t[f * 9 + k * 3 + 1], z = t[f * 9 + k * 3 + 2];
      if (view.zUp) { const yy = z; z = -y; y = yy; }
      const x1 = x * ca + z * sa, z1 = -x * sa + z * ca; // rotirea în jurul lui Y
      const y2 = y * cb - z1 * sb, z2 = y * sb + z1 * cb; // apoi în jurul lui X
      P[k * 3] = x1; P[k * 3 + 1] = y2; P[k * 3 + 2] = z2;
      const s = D / (D - z2);
      sx[j * 3 + k] = w / 2 + x1 * scale * s;
      sy[j * 3 + k] = h / 2 - y2 * scale * s;
    }
    const ux = P[3] - P[0], uy = P[4] - P[1], uz = P[5] - P[2], vx = P[6] - P[0], vy = P[7] - P[1], vz = P[8] - P[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz);
    if (!(len > 0)) continue;
    nx /= len; ny /= len; nz /= len;
    // Fețele întoarse spre spate se desenează și ele (multe modele au normalele amestecate), dar cu partea spre noi luminată.
    if (nz < 0) { nx = -nx; ny = -ny; nz = -nz; }
    shade[j] = 0.28 + 0.72 * Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
    depth[j] = (P[2] + P[5] + P[8]) / 3;
    vis[j] = 1;
  }
  const order: number[] = [];
  for (let j = 0; j < n; j++) if (vis[j]) order.push(j);
  order.sort((p, q) => depth[p] - depth[q]);
  const [r, g, bl] = hex(view.color);
  for (const j of order) {
    const k = shade[j];
    const fill = `rgb(${Math.round(r * k)},${Math.round(g * k)},${Math.round(bl * k)})`;
    ctx.fillStyle = fill;
    ctx.strokeStyle = fill; // o linie subțire de aceeași culoare acoperă crăpăturile dintre triunghiuri
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(sx[j * 3], sy[j * 3]);
    ctx.lineTo(sx[j * 3 + 1], sy[j * 3 + 1]);
    ctx.lineTo(sx[j * 3 + 2], sy[j * 3 + 2]);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

/** Modelul ținut lângă poza de pe slide: fișierul (base64) și rotirea, ca să poată fi rotit din nou după inserare. */
export interface Model3DKeep { name: string; data: string; yaw: number; pitch: number; color: string; zUp?: boolean }
/** Fișierele mai mari nu se țin lângă poză (prezentarea ar crește prea mult); poza rămâne, dar nu se mai rotește. */
export const MODEL3D_KEEP_MAX = 4 * 1024 * 1024;

export function keepModel(name: string, data: Uint8Array, view: View3D, max = MODEL3D_KEEP_MAX): Model3DKeep | undefined {
  if (data.length > max) return undefined;
  let bin = '';
  for (let i = 0; i < data.length; i += 0x8000) bin += String.fromCharCode(...data.subarray(i, i + 0x8000));
  return { name: name.slice(0, 200), data: btoa(bin), yaw: view.yaw, pitch: view.pitch, color: view.color, ...(view.zUp ? { zUp: true } : {}) };
}

export function keptModel(k: Model3DKeep): { name: string; data: Uint8Array; view: View3D } {
  return { name: k.name, data: base64Bytes(k.data), view: { yaw: k.yaw, pitch: k.pitch, color: k.color, ...(k.zUp ? { zUp: true } : {}) } };
}

/** Câmpul m3d citit dintr-un fișier: doar dacă are forma bună. */
export function cleanM3d(v: unknown): Model3DKeep | undefined {
  const k = v as Model3DKeep;
  if (!k || typeof k !== 'object' || typeof k.name !== 'string' || typeof k.data !== 'string' || !k.data || k.data.length > MODEL3D_KEEP_MAX * 1.4) return undefined;
  if (!/^[A-Za-z0-9+/=]+$/.test(k.data)) return undefined;
  const num = (x: unknown, lo: number, hi: number) => (typeof x === 'number' && Number.isFinite(x) ? Math.max(lo, Math.min(hi, x)) : 0);
  return { name: k.name.slice(0, 200), data: k.data, yaw: num(k.yaw, -180, 180), pitch: num(k.pitch, -89, 89),
    color: typeof k.color === 'string' && /^#[0-9a-f]{6}$/i.test(k.color) ? k.color : '#4a90d9', ...(k.zUp === true ? { zUp: true } : {}) };
}

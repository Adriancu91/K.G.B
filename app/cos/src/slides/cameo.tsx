// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// 📷 Cameo: imaginea live de la camera web, într-o formă de pe slide (cerc, dreptunghi rotunjit…), ca prezentatorul
// să apară pe slide în timpul prezentării. Camera pornește doar cât se vede o formă cu cameră în editor sau în prezentare
// (nu și în miniaturi) și se oprește singură când nu mai e nevoie de ea. Nimic nu se înregistrează și nu se salvează.

import { useEffect, useRef, useState } from 'react';

let stream: MediaStream | null = null;
let pending: Promise<MediaStream | null> | null = null;
let users = 0;
let stopTimer: ReturnType<typeof setTimeout> | undefined;
/** Formele care arată camera; la schimbarea camerei, fiecare o cere din nou. */
const watchers = new Set<() => void>();
const DEVICE_KEY = 'suite.slides.cameoDevice';

/** Camera aleasă pe acest calculator (lipsă = cea implicită); ține de calculator, nu de prezentare. */
export function cameoDevice(): string {
  try { return localStorage.getItem(DEVICE_KEY) ?? ''; } catch { return ''; }
}

/** Altă cameră: cea veche se oprește, iar formele cu cameră o arată pe cea nouă. */
export function setCameoDevice(id: string) {
  try { if (id) localStorage.setItem(DEVICE_KEY, id); else localStorage.removeItem(DEVICE_KEY); } catch { /* fără stocare: doar acum */ }
  if (stream) for (const t of stream.getTracks()) t.stop();
  stream = null;
  for (const w of watchers) w();
}

/** Camera, pornită o singură dată pentru toate formele cu cameră; null dacă nu există sau nu e voie. */
function acquire(): Promise<MediaStream | null> {
  users++;
  clearTimeout(stopTimer);
  if (stream && stream.getVideoTracks().some((t) => t.readyState === 'live')) return Promise.resolve(stream);
  if (!pending) {
    pending = navigator.mediaDevices?.getUserMedia
      ? (() => {
        const size = { width: { ideal: 1280 }, height: { ideal: 720 } }, dev = cameoDevice();
        // Camera aleasă poate lipsi (scoasă din USB): atunci cea implicită.
        return navigator.mediaDevices.getUserMedia({ video: dev ? { ...size, deviceId: { exact: dev } } : size, audio: false })
          .catch(() => (dev ? navigator.mediaDevices.getUserMedia({ video: size, audio: false }) : Promise.reject(new Error('fără cameră'))));
      })().then((s) => { stream = s; return s; }, () => null)
        .finally(() => { pending = null; })
      : Promise.resolve(null);
  }
  return pending;
}

/** O formă nu mai are nevoie de cameră; după o secundă fără nicio formă, camera se oprește (lumina ei se stinge). */
function release() {
  users = Math.max(0, users - 1);
  if (users) return;
  clearTimeout(stopTimer);
  stopTimer = setTimeout(() => {
    if (users || !stream) return;
    for (const t of stream.getTracks()) t.stop();
    stream = null;
  }, 1000);
}

/** Lista camerelor din calculator, pentru alegerea din fila formei (numele apar după ce camera a pornit o dată). */
export function CameoDevicePicker() {
  const [list, setList] = useState<{ id: string; name: string }[]>([]);
  const [cur, setCur] = useState(cameoDevice);
  useEffect(() => {
    let alive = true;
    const load = () => void navigator.mediaDevices?.enumerateDevices?.().then((ds) => {
      if (alive) setList(ds.filter((d) => d.kind === 'videoinput').map((d, i) => ({ id: d.deviceId, name: d.label || `Camera ${i + 1}` })));
    }).catch(() => { /* fără listă */ });
    load();
    navigator.mediaDevices?.addEventListener?.('devicechange', load);
    return () => { alive = false; navigator.mediaDevices?.removeEventListener?.('devicechange', load); };
  }, []);
  return (
    <select className="sl-cameo-dev" value={list.some((d) => d.id === cur) ? cur : ''} aria-label="Camera"
      title="Camera arătată în formele Cameo (se ține minte pe acest calculator)"
      onChange={(e) => { setCur(e.target.value); setCameoDevice(e.target.value); }}>
      <option value="">📷 Camera implicită</option>
      {list.filter((d) => d.id && d.id !== 'default').map((d) => <option key={d.id} value={d.id}>📷 {d.name}</option>)}
    </select>
  );
}

/** Câte forme folosesc camera acum (pentru teste). */
export const cameoUsers = () => users;

/**
 * Imaginea camerei peste umplerea formei, tăiată după forma ei (`clip`: colțuri rotunjite sau poligon) și oglindită,
 * ca într-o oglindă. Fără cameră rămâne umplerea formei, cu un mesaj mic.
 */
export function CameoView({ on, clip }: { on: boolean; clip: React.CSSProperties }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<'wait' | 'on' | 'none'>('wait');
  const [ver, setVer] = useState(0);
  useEffect(() => { const w = () => setVer((v) => v + 1); watchers.add(w); return () => { watchers.delete(w); }; }, []);
  useEffect(() => {
    if (!on) return;
    let alive = true;
    void acquire().then((s) => {
      if (!alive) return;
      if (!s || !ref.current) { setState('none'); return; }
      ref.current.srcObject = s;
      void ref.current.play().catch(() => { /* pornește la primul cadru */ });
      setState('on');
    });
    return () => { alive = false; release(); };
  }, [on, ver]);
  return (
    <>
      <video ref={ref} className="sl-cameo" data-state={on ? state : 'off'} muted playsInline aria-hidden="true"
        style={{ ...clip, display: on && state === 'on' ? undefined : 'none' }} />
      {(!on || state !== 'on') && <span className="sl-cameo-off" aria-hidden="true">📷{on && state === 'none' ? ' Camera nu e disponibilă' : ''}</span>}
    </>
  );
}

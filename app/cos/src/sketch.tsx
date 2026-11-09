// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// ✏ Desen (Docs, Sheets): o foaie albă pe care desenezi cu creionul, markerul și radiera din Slides (fila Draw);
// la „✓ Gata” desenul devine o poză PNG transparentă, tăiată cât liniile. `drawSketch()` întoarce poza sau null dacă ai renunțat;
// `<SketchHost />` stă o singură dată în App, ca la screenshot.tsx. Fereastra propriu-zisă se încarcă doar la prima folosire.
import { lazy, Suspense, useEffect, useState } from 'react';
import type { SketchShape } from './SketchDialog';

/** Ce iese din fereastră: poza desenului și, dacă desenul e o singură formă recunoscută (◇ În formă), forma ei. */
export interface SketchResult { blob: Blob; shape?: SketchShape }
interface Request { done: (r: SketchResult | null) => void }
let show: ((r: Request | null) => void) | null = null;

export function drawSketch(): Promise<Blob | null> {
  return drawSketchEx().then((r) => r?.blob ?? null);
}

/** Ca drawSketch, dar spune și forma, când desenul e o singură formă recunoscută (Docs o pune ca formă adevărată). */
export function drawSketchEx(): Promise<SketchResult | null> {
  return new Promise((resolve) => {
    if (!show) { resolve(null); return; }
    show({ done: resolve });
  });
}

const SketchDialog = lazy(() => import('./SketchDialog'));

export function SketchHost() {
  const [req, setReq] = useState<Request | null>(null);
  useEffect(() => { show = setReq; return () => { show = null; }; }, []);
  if (!req) return null;
  return (
    <Suspense fallback={null}>
      <SketchDialog onDone={(r) => { setReq(null); req.done(r); }} />
    </Suspense>
  );
}

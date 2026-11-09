// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Culoarea și grosimea liniei unei pictograme deja puse (Docs, Sheets): culoarea se aplică o singură dată, când închizi
// paleta (evenimentul nativ `change`), nu la fiecare mișcare a mausului, ca Anulează să aibă un singur pas.
import { useEffect, useRef } from 'react';
import { ICON_STROKES, IconSpec } from './iconLib';

export function IconColor({ value, onPick }: { value: string; onPick(c: string): void }) {
  const ref = useRef<HTMLInputElement>(null);
  const pick = useRef(onPick);
  pick.current = onPick;
  useEffect(() => {
    const n = ref.current;
    const on = () => n && pick.current(n.value.toLowerCase());
    n?.addEventListener('change', on);
    return () => n?.removeEventListener('change', on);
  }, []);
  // Valoarea arătată se schimbă doar când paleta nu e deschisă.
  useEffect(() => { if (ref.current && document.activeElement !== ref.current) ref.current.value = value; });
  return <input ref={ref} type="color" aria-label="Culoarea pictogramei" data-icon-color defaultValue={value} />;
}

export function IconStroke({ value, onPick }: { value: number; onPick(s: number): void }) {
  return (
    <select className="shape-sw" aria-label="Grosimea liniei pictogramei" data-icon-stroke title="Grosimea liniei" value={value}
      onMouseDown={(e) => e.stopPropagation()} onChange={(e) => onPick(Number(e.target.value))}>
      {ICON_STROKES.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
    </select>
  );
}

/** Bara mică de sub o pictogramă aleasă (Sheets). */
export default function IconRecolorBar({ spec, onChange }: { spec: IconSpec; onChange(p: Partial<IconSpec>): void }) {
  return (
    <span className="icon-recolor" role="group" aria-label="Pictogramă" title="Culoarea pictogramei (se desenează din nou, la fel de clară)"
      onPointerDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}
      style={{ position: 'absolute', left: 0, top: '100%', marginTop: 4, display: 'flex', gap: 4, alignItems: 'center', padding: '2px 4px', background: 'var(--panel, #fff)', border: '1px solid var(--border, #ccc)', borderRadius: 4, zIndex: 5, whiteSpace: 'nowrap', cursor: 'default' }}>
      <IconColor value={spec.c} onPick={(c) => onChange({ c })} />
      <IconStroke value={spec.s} onPick={(s) => onChange({ s })} />
    </span>
  );
}

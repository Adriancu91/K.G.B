// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Rigla din Slides (Vizualizare → Riglă): centimetrii slide-ului sus și în stânga, cu semne la fiecare jumătate de centimetru
// și cu locul casetei alese colorat. Nu apare în prezentare și nici în fișier.
export const PX_CM = 96 / 2.54;
const T = 18;

/** Semnele riglei pentru o lungime (în pixelii slide-ului): poziția pe ecran, dacă e un centimetru întreg și numărul lui. */
export function rulerTicks(len: number, scale: number): { at: number; cm: number | null }[] {
  const out: { at: number; cm: number | null }[] = [];
  // Când slide-ul e foarte mic pe ecran, numerele se scriu din 2 în 2 (sau din 5 în 5) centimetri, ca să nu se suprapună.
  const every = PX_CM * scale >= 18 ? 1 : PX_CM * scale >= 8 ? 2 : 5;
  for (let h = 0; h * PX_CM / 2 <= len + 0.01; h++) {
    const whole = h % 2 === 0;
    out.push({ at: (h * PX_CM * scale) / 2, cm: whole && (h / 2) % every === 0 ? h / 2 : null });
  }
  return out;
}

export default function Ruler({ dir, len, scale, mark }: { dir: 'h' | 'v'; len: number; scale: number; mark?: [number, number] | null }) {
  const L = len * scale;
  const h = dir === 'h';
  return (
    <svg className={`sl-ruler ${dir}`} width={h ? L : T} height={h ? T : L} aria-hidden="true">
      {mark && <rect className="sl-ruler-mark" x={h ? mark[0] * scale : 0} y={h ? 0 : mark[0] * scale} width={h ? Math.max(1, (mark[1] - mark[0]) * scale) : T} height={h ? T : Math.max(1, (mark[1] - mark[0]) * scale)} />}
      {rulerTicks(len, scale).map((t, i) => {
        const k = t.cm !== null ? 8 : i % 2 === 0 ? 6 : 4;
        return (
          <g key={i}>
            {h ? <line x1={t.at} x2={t.at} y1={T} y2={T - k} /> : <line y1={t.at} y2={t.at} x1={T} x2={T - k} />}
            {t.cm !== null && t.cm > 0 && (h
              ? <text x={t.at + 2} y={9}>{t.cm}</text>
              : <text x={2} y={t.at - 2} >{t.cm}</text>)}
          </g>
        );
      })}
    </svg>
  );
}

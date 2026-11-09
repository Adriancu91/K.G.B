// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// „Verifică accesibilitatea” (Word: Revizuire → Verificare accesibilitate): ce îi încurcă pe cei care citesc documentul
// cu un cititor de ecran sau cu vederea slabă. Fiecare problemă are locul ei în document, ca să poată fi aleasă cu un click.
import type { Node as PMNode } from '@tiptap/pm/model';

export interface A11yIssue { kind: 'alt' | 'heading' | 'emptyHeading' | 'tableHeader' | 'contrast' | 'link'; pos: number; text: string; tip: string }

/** Luminanța relativă (WCAG) a unei culori #rrggbb. */
function luminance(hex: string): number {
  const v = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
}

/** Contrastul dintre două culori (1–21); textul obișnuit are nevoie de cel puțin 4,5. */
export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

const hex6 = (c: unknown) => {
  const s = String(c ?? '').trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(s)) return s;
  if (/^#[0-9a-f]{3}$/.test(s)) return '#' + [...s.slice(1)].map((x) => x + x).join('');
  const m = /^rgb\(\s*(\d+),\s*(\d+),\s*(\d+)\s*\)$/.exec(s);
  return m ? '#' + [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('') : null;
};

const short = (t: string) => (t.length > 40 ? t.slice(0, 40) + '…' : t);

export function checkAccessibility(doc: PMNode, pageColor?: string): A11yIssue[] {
  const out: A11yIssue[] = [];
  const bg = hex6(pageColor) ?? '#ffffff';
  let lastLevel = 0;
  let images = 0;
  doc.descendants((node, pos) => {
    const name = node.type.name;
    if (name === 'image') {
      images++;
      if (!String(node.attrs.alt ?? '').trim()) {
        out.push({ kind: 'alt', pos, text: `Poza ${images}`, tip: 'Nu are text alternativ: click pe poză → Alt și scrie ce arată.' });
      }
      return false;
    }
    if (name === 'heading') {
      const level = Number(node.attrs.level) || 1;
      const text = node.textContent.trim();
      if (!text) out.push({ kind: 'emptyHeading', pos, text: `Titlu ${level} gol`, tip: 'Un titlu fără text apare gol în cuprins și la navigare; scrie-l sau fă-l paragraf.' });
      else if (lastLevel && level > lastLevel + 1) {
        out.push({ kind: 'heading', pos, text: short(text), tip: `Sare de la Titlu ${lastLevel} la Titlu ${level}; folosește Titlu ${lastLevel + 1}, ca ordinea să fie clară.` });
      }
      if (text) lastLevel = level;
    }
    if (name === 'table') {
      const first = node.firstChild;
      let header = false;
      first?.forEach((cell) => { if (cell.type.name === 'tableHeader') header = true; });
      if (!header) out.push({ kind: 'tableHeader', pos, text: short(node.textContent.trim() || 'Tabel'), tip: 'Tabelul nu are rând de antet: cititoarele de ecran nu știu ce înseamnă coloanele.' });
    }
    if (node.isTextblock) {
      // În fiecare paragraf: cel mult o problemă de contrast și legăturile care arată adresa întreagă.
      let low = false;
      node.forEach((child, off) => {
        if (!child.isText) return;
        const at = pos + 1 + off;
        const style = child.marks.find((m) => m.type.name === 'textStyle');
        const fg = hex6(style?.attrs.color);
        const under = hex6(child.marks.find((m) => m.type.name === 'highlight')?.attrs.color) ?? bg;
        if (!low && fg && contrast(fg, under) < 4.5) {
          low = true;
          out.push({ kind: 'contrast', pos: at, text: short(child.text ?? ''), tip: `Culoarea textului se vede greu pe fundal (contrast ${contrast(fg, under).toFixed(1).replace('.', ',')}:1, trebuie cel puțin 4,5:1).` });
        }
        const t = (child.text ?? '').trim();
        if (child.marks.some((m) => m.type.name === 'link') && /^(https?:[/][/]|www[.])/i.test(t) && t.length > 30) {
          out.push({ kind: 'link', pos: at, text: short(t), tip: 'Legătura arată adresa întreagă; un text care spune unde duce se citește mai ușor.' });
        }
      });
      return false;
    }
    return true;
  });
  return out;
}

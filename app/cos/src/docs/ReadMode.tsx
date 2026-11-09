// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Mod citire în Docs: textul se așază pe coloane cât ecranul și se dă pagina cu ‹ › / săgeți / PageDown / spațiu, ca într-o carte.
// Documentul nu se poate modifica cât timp citești; Esc sau „✕ Ieși” te întorc la editare.
import { useCallback, useEffect, useState } from 'react';
import type { Editor } from '@tiptap/react';

export default function ReadBar({ editor, page, onExit }: { editor: Editor; page: () => HTMLElement | null; onExit(): void }) {
  const [at, setAt] = useState({ screen: 1, screens: 1 });

  const measure = useCallback(() => {
    const el = page();
    if (!el || !el.clientWidth) return;
    const screens = Math.max(1, Math.round(el.scrollWidth / el.clientWidth));
    setAt({ screen: Math.min(screens, Math.round(el.scrollLeft / el.clientWidth) + 1), screens });
  }, [page]);

  const go = useCallback((dir: number) => {
    const el = page();
    if (!el) return;
    el.scrollTo({ left: Math.max(0, Math.round(el.scrollLeft / el.clientWidth) + dir) * el.clientWidth });
    window.setTimeout(measure, 50);
  }, [page, measure]);

  useEffect(() => {
    editor.setEditable(false);
    const el = page();
    el?.scrollTo({ left: 0 });
    const t = window.setTimeout(measure, 50);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onExit(); }
      else if (['ArrowRight', 'PageDown', ' ', 'ArrowDown'].includes(e.key)) { e.preventDefault(); go(1); }
      else if (['ArrowLeft', 'PageUp', 'ArrowUp'].includes(e.key)) { e.preventDefault(); go(-1); }
      else if (e.key === 'Home') { e.preventDefault(); go(-1e6); }
      else if (e.key === 'End') { e.preventDefault(); go(1e6); }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', measure);
    el?.addEventListener('scroll', measure);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', measure);
      el?.removeEventListener('scroll', measure);
      editor.setEditable(true);
    };
  }, [editor, page, measure, go, onExit]);

  return (
    <div className="docs-read-bar" role="toolbar" aria-label="Mod citire">
      <button onClick={() => go(-1)} disabled={at.screen <= 1} title="Înapoi (←, PageUp)" aria-label="Înapoi">‹</button>
      <span className="docs-read-pos" role="status">Ecranul {at.screen} din {at.screens}</span>
      <button onClick={() => go(1)} disabled={at.screen >= at.screens} title="Înainte (→, PageDown, spațiu)" aria-label="Înainte">›</button>
      <button className="docs-read-exit" onClick={onExit} title="Înapoi la editare (Esc)">✕ Ieși</button>
    </div>
  );
}

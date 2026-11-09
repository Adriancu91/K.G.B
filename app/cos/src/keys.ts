// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Potrivirea scurtăturilor ca în listele oficiale ale programelor de birou cunoscute (scrise pentru tastatura US),
// astfel încât să meargă și pe tastatura românească (INTERFATA-FAMILIARA.md, 0.1):
// - literele și cifrele după tasta fizică (`e.code`), ca Ctrl+B să meargă și cu diacriticele active;
// - semnele în ambele forme: după tasta fizică din lista oficială (Ctrl+; = tasta `Semicolon`, adică Ctrl+ș pe RO Standard)
//   și după caracterul scris (pe RO Standard „;” se scrie cu Shift+, , deci Ctrl+Shift+, dă tot Ctrl+;);
// - semnele care pe US se scriu cu Shift (Ctrl+Shift+: , Ctrl+Shift+$ …) cer Shift pe tasta lor fizică;
// - AltGr (care trimite Ctrl+Alt) nu declanșează scurtăturile Ctrl+Alt.

export interface KeyLike {
  key: string; code: string;
  ctrlKey: boolean; shiftKey: boolean; altKey: boolean; metaKey?: boolean;
  getModifierState?(k: string): boolean;
}

/** Semnul de bază (fără Shift, pe tastatura US) → tasta fizică. */
const BASE: Record<string, string> = {
  ';': 'Semicolon', "'": 'Quote', '`': 'Backquote', '[': 'BracketLeft', ']': 'BracketRight', '\\': 'Backslash',
  '=': 'Equal', '-': 'Minus', ',': 'Comma', '.': 'Period', '/': 'Slash',
};
/** Semnul scris cu Shift (pe tastatura US) → tasta fizică. */
const SHIFTED: Record<string, string> = {
  ':': 'Semicolon', '"': 'Quote', '~': 'Backquote', '{': 'BracketLeft', '}': 'BracketRight', '|': 'Backslash',
  '+': 'Equal', '_': 'Minus', '<': 'Comma', '>': 'Period', '?': 'Slash',
  '!': 'Digit1', '@': 'Digit2', '#': 'Digit3', '$': 'Digit4', '%': 'Digit5', '^': 'Digit6', '&': 'Digit7', '*': 'Digit8', '(': 'Digit9', ')': 'Digit0',
};
/** Numele tastelor speciale din scurtături → `e.key`. */
const NAMED: Record<string, string> = { esc: 'Escape', escape: 'Escape', space: ' ', enter: 'Enter', tab: 'Tab', del: 'Delete', delete: 'Delete',
  backspace: 'Backspace', home: 'Home', end: 'End', pageup: 'PageUp', pagedown: 'PageDown', insert: 'Insert',
  up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };

interface Combo { ctrl: boolean; shift: boolean; alt: boolean; key: string }

const cache = new Map<string, Combo>();
/** „Ctrl+Shift+:” → { ctrl, shift, alt, key: ':' }. Ultimul „+” gol înseamnă tasta „+” („Ctrl++”). */
export function parseCombo(s: string): Combo {
  let c = cache.get(s);
  if (c) return c;
  const parts = s.split('+');
  let key = parts.pop() ?? '';
  if (key === '' && parts[parts.length - 1] === '') { parts.pop(); key = '+'; }
  const mods = parts.map((p) => p.trim().toLowerCase());
  c = { ctrl: mods.includes('ctrl'), shift: mods.includes('shift'), alt: mods.includes('alt'), key };
  cache.set(s, c);
  return c;
}

/** Tasta apăsată se potrivește cu scurtătura scrisă ca în listele oficiale („Ctrl+;”, „Ctrl+Shift+$”, „Alt+F1”, „Ctrl+B”). */
export function matches(e: KeyLike, combo: string): boolean {
  const c = parseCombo(combo);
  const ctrl = e.ctrlKey || !!e.metaKey;
  if (ctrl !== c.ctrl || e.altKey !== c.alt) return false;
  if (c.ctrl && c.alt && e.getModifierState?.('AltGraph')) return false;
  const k = c.key;
  // Litere și cifre: tasta fizică, sau caracterul (pe alte așezări ale tastelor), cu Shift exact ca în scurtătură.
  if (/^[a-z]$/i.test(k)) return e.shiftKey === c.shift && (e.code === 'Key' + k.toUpperCase() || e.key.toLowerCase() === k.toLowerCase());
  if (/^\d$/.test(k)) return e.shiftKey === c.shift && (e.code === 'Digit' + k || e.code === 'Numpad' + k);
  if (/^f\d{1,2}$/i.test(k)) return e.shiftKey === c.shift && e.key.toUpperCase() === k.toUpperCase();
  const named = NAMED[k.toLowerCase()];
  if (named) return e.shiftKey === c.shift && (e.key === named || (named === ' ' && e.code === 'Space'));
  // Semne: întâi tasta fizică din lista oficială…
  if (BASE[k] && e.code === BASE[k] && e.shiftKey === c.shift) return true;
  if (SHIFTED[k] && e.code === SHIFTED[k] && e.shiftKey) return true;
  // …apoi caracterul scris, oricum s-ar fi ajuns la el (Shift nu contează: pe alte tastaturi semnul cere sau nu Shift).
  return e.key === k;
}

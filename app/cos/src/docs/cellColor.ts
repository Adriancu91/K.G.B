// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Culoarea de fundal a celulelor de tabel (ca „Umbrire” din Word).
import { Extension } from '@tiptap/core';

/** Culori deschise, potrivite sub text negru; prima înseamnă „fără culoare”. */
export const CELL_COLORS = ['', '#f3f4f6', '#fee2e2', '#ffedd5', '#fef9c3', '#dcfce7', '#dbeafe', '#ede9fe', '#d1d5db'];

export const CellColor = Extension.create({
  name: 'cellColor',
  addGlobalAttributes() {
    return [{
      types: ['tableCell', 'tableHeader'],
      attributes: {
        backgroundColor: {
          default: null,
          parseHTML: (el) => el.getAttribute('data-bg') || el.style.backgroundColor || null,
          renderHTML: (a) => (a.backgroundColor ? { 'data-bg': a.backgroundColor, style: `background-color: ${a.backgroundColor}` } : {}),
        },
      },
    }];
  },
});

/** Alinierea verticală a textului în celule (sus / mijloc / jos, ca în Word); implicit sus. */
export const CellVAlign = Extension.create({
  name: 'cellVAlign',
  addGlobalAttributes() {
    return [{
      types: ['tableCell', 'tableHeader'],
      attributes: {
        verticalAlign: {
          default: null,
          parseHTML: (el) => {
            const v = el.getAttribute('data-valign') || el.style.verticalAlign;
            return v === 'middle' || v === 'center' ? 'middle' : v === 'bottom' ? 'bottom' : null;
          },
          renderHTML: (a) => (a.verticalAlign ? { 'data-valign': a.verticalAlign, style: `vertical-align: ${a.verticalAlign}` } : {}),
        },
      },
    }];
  },
});

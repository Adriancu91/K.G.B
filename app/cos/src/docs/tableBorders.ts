// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Tabel fără borduri (ca „Fără borduri” din Word): bun pentru așezarea textului pe coloane, de exemplu antete de cerere
// sau semnături una lângă alta. În editor liniile rămân punctate și discrete; la tipărire, PDF și Word nu se văd deloc.
import { Extension } from '@tiptap/core';
import type { Node as PmNode } from '@tiptap/pm/model';
import { TableView } from '@tiptap/extension-table';
import { lineAttributes, markLines } from './tableLines';

/** Un număr de centimetri între 0 și 10 (cu două zecimale) sau null. */
export function cmAttr(v: string | null | undefined): number | null {
  const n = Number(v);
  return v !== null && v !== undefined && v !== '' && Number.isFinite(n) && n >= 0 ? Math.min(10, Math.round(n * 100) / 100) : null;
}

/** Textul alternativ curățat (fără spații la capete, cel mult 2000 de semne) sau null când e gol. */
export function altAttr(v: string | null | undefined): string | null {
  const t = (v ?? '').trim().slice(0, 2000);
  return t || null;
}

export const TableBorders = Extension.create({
  name: 'tableBorders',
  addGlobalAttributes() {
    return [{
      types: ['table'],
      attributes: {
        borders: {
          default: null,
          parseHTML: (el) => (el.getAttribute('data-borders') === 'none' ? 'none' : null),
          renderHTML: (a) => (a.borders === 'none' ? { 'data-borders': 'none' } : {}),
        },
        // Așezarea pe pagină a tabelului mai îngust decât pagina: la centru sau la dreapta (implicit la stânga).
        align: {
          default: null,
          parseHTML: (el) => { const a = el.getAttribute('data-align'); return a === 'center' || a === 'right' ? a : null; },
          renderHTML: (a) => (a.align ? { 'data-align': a.align } : {}),
        },
        // Potrivit conținutului (AutoFit): tabelul cât textul, nu pe toată lățimea.
        fit: {
          default: null,
          parseHTML: (el) => (el.getAttribute('data-fit') === 'content' ? 'content' : null),
          renderHTML: (a) => (a.fit === 'content' ? { 'data-fit': 'content' } : {}),
        },
        // Indentarea de la stânga (cm) a tabelului așezat la stânga și marginile celulelor (cm, pe toate laturile).
        indent: {
          default: null,
          parseHTML: (el) => cmAttr(el.getAttribute('data-indent')),
          renderHTML: (a) => (a.indent ? { 'data-indent': String(a.indent), style: `--tbl-indent: ${a.indent}cm` } : {}),
        },
        pad: {
          default: null,
          parseHTML: (el) => cmAttr(el.getAttribute('data-pad')),
          renderHTML: (a) => (a.pad !== null && a.pad !== undefined ? { 'data-pad': String(a.pad), style: `--cell-pad: ${a.pad}cm` } : {}),
        },
        // Încadrarea textului în jurul tabelului (tabel „plutitor”, text wrapping = Around): textul de după curge pe lângă el.
        wrap: {
          default: null,
          parseHTML: (el) => (el.getAttribute('data-wrap') === 'around' ? 'around' : null),
          renderHTML: (a) => (a.wrap === 'around' ? { 'data-wrap': 'around' } : {}),
        },
        // Textul alternativ (titlul și descrierea), citit de cititoarele de ecran; în .docx w:tblCaption / w:tblDescription.
        altTitle: {
          default: null,
          parseHTML: (el) => altAttr(el.getAttribute('data-alt-title')),
          renderHTML: (a) => (a.altTitle ? { 'data-alt-title': a.altTitle } : {}),
        },
        altDesc: {
          default: null,
          parseHTML: (el) => altAttr(el.getAttribute('data-alt-desc')),
          renderHTML: (a) => (a.altDesc ? { 'data-alt-desc': a.altDesc } : {}),
        },
        // Legătura cu fișierul din care a venit tabelul (Inserare → ▦ Foaie de calcul…): calea întreagă și numele foii (sheetInsert.ts).
        linkPath: {
          default: null,
          parseHTML: (el) => el.getAttribute('data-link-path') || null,
          renderHTML: (a) => (a.linkPath ? { 'data-link-path': a.linkPath } : {}),
        },
        linkSheet: {
          default: null,
          parseHTML: (el) => el.getAttribute('data-link-sheet') || null,
          renderHTML: (a) => (a.linkSheet ? { 'data-link-sheet': a.linkSheet } : {}),
        },
        // Care linii se văd, felul și culoarea lor (tableLines.ts).
        ...lineAttributes,
      },
    }];
  },
});

/** Vederea tabelului din editor (cu redimensionarea coloanelor) care arată și atributul „fără borduri”. */
export class BorderTableView extends TableView {
  constructor(node: PmNode, cellMinWidth: number) {
    super(node, cellMinWidth);
    this.mark(node);
  }

  update(node: PmNode) {
    const ok = super.update(node);
    if (ok) this.mark(node);
    return ok;
  }

  private mark(node: PmNode) {
    if (node.attrs.borders === 'none') this.table.setAttribute('data-borders', 'none');
    else this.table.removeAttribute('data-borders');
    if (node.attrs.align) this.table.setAttribute('data-align', node.attrs.align);
    else this.table.removeAttribute('data-align');
    if (node.attrs.fit === 'content') this.table.setAttribute('data-fit', 'content');
    else this.table.removeAttribute('data-fit');
    if (node.attrs.indent) { this.table.setAttribute('data-indent', String(node.attrs.indent)); this.table.style.setProperty('--tbl-indent', node.attrs.indent + 'cm'); }
    else { this.table.removeAttribute('data-indent'); this.table.style.removeProperty('--tbl-indent'); }
    if (node.attrs.pad !== null && node.attrs.pad !== undefined) { this.table.setAttribute('data-pad', String(node.attrs.pad)); this.table.style.setProperty('--cell-pad', node.attrs.pad + 'cm'); }
    else { this.table.removeAttribute('data-pad'); this.table.style.removeProperty('--cell-pad'); }
    // Plutirea se pune și pe învelișul tabelului, ca textul de după să curgă pe lângă el.
    for (const el of [this.table, this.dom as HTMLElement]) {
      if (node.attrs.wrap === 'around') el.setAttribute('data-wrap', 'around'); else el.removeAttribute('data-wrap');
    }
    if (node.attrs.wrap === 'around' && node.attrs.align) (this.dom as HTMLElement).setAttribute('data-align', node.attrs.align);
    else (this.dom as HTMLElement).removeAttribute('data-align');
    const alt = [node.attrs.altTitle, node.attrs.altDesc].filter(Boolean).join(': ');
    if (alt) this.table.setAttribute('aria-label', alt);
    else this.table.removeAttribute('aria-label');
    markLines(this.table, node.attrs);
  }
}

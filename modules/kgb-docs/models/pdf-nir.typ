// Model PDF (Typst): notă de intrare-recepție (NIR) (7.4i). Recepțiile cu
// stocuri se fac în Business; acesta e documentul tipărit.
#set page(paper: "a4", flipped: true, margin: (x: 1.6cm, y: 1.6cm), footer: context align(center, text(8pt)[pagina #counter(page).display() din #counter(page).final().first()]))
#set text(lang: "ro", size: 10pt)
#grid(columns: (1fr, auto), [*{{firma.nume}}* · CUI {{firma.cui}} \ {{firma.adresa}}], align(right)[Gestiunea: {{gestiunea}}])
#v(0.5cm)
#align(center, text(14pt)[*NOTĂ DE INTRARE-RECEPȚIE ȘI CONSTATARE DE DIFERENȚE*])
#align(center)[Nr. {{numar}} din {{data}}]
#v(0.4cm)
Furnizor: *{{furnizor}}*, CUI {{furnizor.cui}} · Document de însoțire: {{document_insotire}}
#v(0.3cm)
#table(columns: (auto, 1fr, auto, auto, auto, auto, auto), inset: 6pt, stroke: 0.5pt,
  table.header([*Nr.*], [*Denumirea bunurilor*], [*U.M.*], [*Cantitate din document*], [*Cantitate primită*], [*Preț unitar*], [*Valoare*]),
  [1], [{{bunuri}}], [{{um}}], [{{cantitate_document}}], [{{cantitate_primita}}], [{{pret_unitar}}], [{{valoare}}])
Diferențe constatate: {{diferente}}
#v(1cm)
#grid(columns: (1fr, 1fr, 1fr),
  [*Comisia de recepție* \ {{comisia}}],
  [*Gestionar* \ {{gestionar}}],
  [*Data recepției* \ {{data}}])

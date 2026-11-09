// Model PDF (Typst): proces-verbal de predare-primire (7.4i).
#set page(paper: "a4", margin: (x: 2.2cm, y: 2cm), footer: context align(center, text(8pt)[pagina #counter(page).display() din #counter(page).final().first()]))
#set text(lang: "ro", size: 10.5pt)
#set par(justify: true)
[*{{firma.nume}}*] · CUI {{firma.cui}} · {{firma.adresa}}
#v(1cm)
#align(center, text(14pt)[*PROCES-VERBAL DE PREDARE-PRIMIRE*])
#align(center)[Nr. {{numar}} din {{data}}]
#v(0.6cm)
Încheiat astăzi, {{data}}, la {{locatie}}, între *{{firma.nume}}*, prin {{firma.reprezentant}}, în calitate de predător, și *{{partener}}*, prin {{partener.reprezentant}}, în calitate de primitor.

Predătorul predă, iar primitorul primește:
#table(columns: (1fr, auto, auto), inset: 7pt, stroke: 0.5pt,
  table.header([*Bunuri / documente*], [*Cantitate*], [*Stare*]),
  [{{bunuri}}], [{{cantitate}}], [{{stare}}])
Observații: {{observatii}}

Primitorul declară că a verificat bunurile și nu are obiecții, cu excepția celor de mai sus.
#v(1.5cm)
#grid(columns: (1fr, 1fr),
  [*Am predat,* \ {{firma.nume}} \ {{firma.reprezentant}}],
  [*Am primit,* \ {{partener}} \ {{partener.reprezentant}}])

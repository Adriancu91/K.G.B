// Model PDF (Typst): proces-verbal de recepție.
#set page(paper: "a4", margin: (x: 2.2cm, y: 2cm), footer: context align(center, text(8pt)[pagina #counter(page).display() din #counter(page).final().first()]))
#set text(lang: "ro", size: 10.5pt)
#set par(justify: true)
[*{{firma.nume}}*] · CUI {{firma.cui}} · {{firma.adresa}}
#v(1cm)
#align(center, text(14pt)[*PROCES-VERBAL DE RECEPȚIE*])
#align(center)[Nr. {{numar}} din {{data}}]
#v(0.6cm)
Încheiat astăzi, {{data}}, la {{locatie}}, între *{{firma.nume}}*, reprezentată de {{firma.reprezentant}}, și *{{client}}*, reprezentată de {{client.reprezentant}}.

Comisia a verificat:
#table(columns: (1fr, 1.4fr), inset: 7pt, stroke: 0.5pt,
  table.header([*Lucrare / echipament*], [*Constatări*]),
  [{{obiect}}], [{{constatari}}])
Concluzie: {{concluzie}}
#v(1.5cm)
#grid(columns: (1fr, 1fr),
  [*Am predat,* \ {{firma.nume}} \ {{firma.reprezentant}}],
  [*Am primit,* \ {{client}} \ {{client.reprezentant}}])

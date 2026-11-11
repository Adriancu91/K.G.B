// Model PDF (Typst): proces-verbal de constatare — o defecțiune, o pagubă, o neconformitate la livrare (7.9d).
#set page(paper: "a4", margin: (x: 2.2cm, y: 2cm))
#set text(lang: "ro", size: 10.5pt)
#set par(justify: true)
[*{{firma.nume}}*] · CUI {{firma.cui}} · {{firma.adresa}}
#v(1cm)
#align(center, text(14pt)[*PROCES-VERBAL DE CONSTATARE*])
#align(center)[Nr. {{numar}} din {{data}}]
#v(0.6cm)
Încheiat astăzi, {{data}}, ora {{ora}}, la {{locatie}}, de către comisia formată din:

{{membrii_comisiei}}

în prezența {{partener}}, prin {{partener.reprezentant}}.

*Obiectul constatării:* {{obiect}}

*Constatări:* {{constatari}}

*Măsuri propuse:* {{masuri}}

Prezentul proces-verbal a fost încheiat în {{numar_exemplare}} exemplare, câte unul pentru fiecare parte.
#v(1.5cm)
#grid(columns: (1fr, 1fr),
  [*Pentru {{firma.nume}},* \ {{firma.reprezentant}}],
  [*Pentru {{partener}},* \ {{partener.reprezentant}}])

// Model PDF (Typst): împuternicire (7.4i). Model orientativ.
#set page(paper: "a4", margin: (x: 2.2cm, y: 2cm))
#set text(lang: "ro", size: 10.5pt)
#set par(justify: true)
[*{{firma.nume}}*] · CUI {{firma.cui}} · Reg. Com. {{firma.reg_com}} \ {{firma.adresa}}
#v(1cm)
#align(center, text(14pt)[*ÎMPUTERNICIRE*])
#align(center)[Nr. {{numar}} din {{data}}]
#v(0.6cm)
*{{firma.nume}}*, cu sediul în {{firma.adresa}}, CUI {{firma.cui}}, reprezentată legal de {{firma.reprezentant}}, în calitate de {{firma.functie_reprezentant}},

împuternicește pe *{{imputernicit}}*, act de identitate {{act_identitate}},

să {{obiectul_imputernicirii}}

în fața {{institutia}}.

Împuternicirea este valabilă până la {{valabila_pana_la}}.
#v(1.5cm)
#align(right)[{{firma.functie_reprezentant}}, \ {{firma.reprezentant}} \ (semnătura și ștampila)]

// Model PDF (Typst): decizie internă a administratorului (7.4i). Model orientativ.
#set page(paper: "a4", margin: (x: 2.2cm, y: 2cm))
#set text(lang: "ro", size: 10.5pt)
#set par(justify: true)
[*{{firma.nume}}*] · CUI {{firma.cui}} · Reg. Com. {{firma.reg_com}} \ {{firma.adresa}}
#v(1cm)
#align(center, text(14pt)[*DECIZIE*])
#align(center)[Nr. {{numar}} din {{data}}]
#v(0.6cm)
Subsemnatul {{firma.reprezentant}}, în calitate de {{firma.functie_reprezentant}} al {{firma.nume}},

având în vedere {{temei}},

*DECID:*

*Art. 1.* {{decizia}}

*Art. 2.* Prezenta decizie intră în vigoare la data de {{data_intrarii_in_vigoare}}.

*Art. 3.* De aducerea la îndeplinire a prezentei decizii răspunde {{responsabil}}.
#v(1.5cm)
#align(right)[{{firma.functie_reprezentant}}, \ {{firma.reprezentant}}]
#v(1cm)
#text(8pt, fill: gray)[Model orientativ generat de K.G.B.]

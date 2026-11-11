// Model PDF (Typst): declarație pe propria răspundere a reprezentantului firmei (7.9d).
#set page(paper: "a4", margin: (x: 2.2cm, y: 2cm))
#set text(lang: "ro", size: 10.5pt)
#set par(justify: true)
[*{{firma.nume}}*] · CUI {{firma.cui}} · Reg. Com. {{firma.reg_com}} \ {{firma.adresa}}
#v(1.2cm)
#align(center, text(14pt)[*DECLARAȚIE PE PROPRIA RĂSPUNDERE*])
#v(0.8cm)
Subsemnatul/Subsemnata *{{firma.reprezentant}}*, act de identitate {{act_identitate}}, în calitate de {{firma.functie_reprezentant}} al *{{firma.nume}}*, cu sediul în {{firma.adresa}}, CUI {{firma.cui}},

cunoscând prevederile art. 326 din Codul penal privind falsul în declarații, declar pe propria răspundere că:

{{declaratia}}

Prezenta declarație este dată pentru a servi la {{institutia}}, în vederea {{scopul}}.
#v(1cm)
Data: {{data}}
#v(1cm)
#align(right)[{{firma.reprezentant}} \ (semnătura)]

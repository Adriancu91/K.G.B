// Model PDF (Typst): notificare către un partener — de exemplu încetarea sau neprelungirea unui contract, o
// schimbare de date, o neconformitate (7.9d).
#set page(paper: "a4", margin: (x: 2.2cm, y: 2cm))
#set text(lang: "ro", size: 10.5pt)
#set par(justify: true)
[*{{firma.nume}}*] · CUI {{firma.cui}} · Reg. Com. {{firma.reg_com}} \ {{firma.adresa}}
#v(1cm)
Către: *{{partener}}*, CUI {{partener.cui}} \ {{partener.adresa}} \ În atenția: {{partener.reprezentant}}
#v(0.8cm)
#align(center, text(14pt)[*NOTIFICARE*])
#align(center)[Nr. {{numar}} din {{data}}]
#v(0.6cm)
*Referitor la:* {{obiect}}

Stimate partener,

prin prezenta vă notificăm că {{continutul_notificarii}}

{{solicitare}}

Pentru orice clarificare ne puteți contacta la {{firma.telefon}} sau {{firma.email}}.
#v(1.2cm)
#align(right)[Cu stimă, \ {{firma.functie_reprezentant}}, \ {{firma.reprezentant}}]

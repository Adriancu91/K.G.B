// Model PDF (Typst): comandă către furnizor (8.15). Codul civil, art. 1.182, 1.186, 1.188, 1.196–1.197
// (verificat 13.11.2026): comanda e o ofertă; contractul se încheie la acceptarea ei fără modificări.
#set page(paper: "a4", margin: (x: 2.2cm, y: 2cm))
#set text(lang: "ro", size: 10.5pt)
#set par(justify: true)
[*{{firma.nume}}*] · CUI {{firma.cui}} · Reg. Com. {{firma.reg_com}} \ {{firma.adresa}}
#v(0.8cm)
Către: *{{furnizor}}*, CUI {{furnizor.cui}} \ {{furnizor.adresa}}
#v(0.6cm)
#align(center, text(14pt)[*COMANDĂ*])
#align(center)[Nr. {{numar}} din {{data}}]
#v(0.5cm)
Vă rugăm să ne livrați:
#v(0.2cm)
#table(columns: (auto, 1fr, auto, auto, auto), inset: 6pt, stroke: 0.5pt,
  table.header([*Nr.*], [*Produs / serviciu*], [*U.M.*], [*Cantitate*], [*Preț unitar fără TVA*]),
  [1], [{{produse}}], [{{um}}], [{{cantitate}}], [{{pret_unitar}}])
#v(0.3cm)
*Termen de livrare:* {{termen_livrare}} \ *Locul livrării:* {{locul_livrarii}} \ *Condiții de plată:* {{conditii_plata}} \ *Persoană de contact:* {{contact}}

Vă rugăm să confirmați comanda în scris în {{termen_confirmare}}. O confirmare cu alte condiții (preț, cantitate, termen) nu valorează acceptare, ci o nouă ofertă, pe care o vom analiza.
#v(1cm)
#align(right)[{{firma.functie_reprezentant}}, \ {{firma.reprezentant}}]
#v(0.8cm)
#text(8pt, fill: gray)[Model orientativ generat de K.G.B.; verificați-l cu un jurist înainte de semnare.]

// Model PDF (Typst): factură proformă (8.15). Proforma nu e factură fiscală: Codul fiscal nu o reglementează,
// iar facturile între firme din România se emit prin RO e-Factura (Codul fiscal, art. 319 alin. (1^1); verificat 13.11.2026).
#set page(paper: "a4", margin: (x: 2.2cm, y: 2cm))
#set text(lang: "ro", size: 10.5pt)
#set par(justify: true)
#grid(columns: (1fr, 1fr), [*Furnizor:* {{firma.nume}} \ CUI {{firma.cui}} · Reg. Com. {{firma.reg_com}} \ {{firma.adresa}} \ IBAN {{firma.iban}}, {{firma.banca}}],
  [*Client:* {{client}} \ CUI {{client.cui}} \ {{client.adresa}}])
#v(0.8cm)
#align(center, text(14pt)[*FACTURĂ PROFORMĂ*])
#align(center)[Nr. {{numar}} din {{data}}]
#v(0.5cm)
#table(columns: (auto, 1fr, auto, auto, auto, auto), inset: 6pt, stroke: 0.5pt,
  table.header([*Nr.*], [*Produs / serviciu*], [*U.M.*], [*Cantitate*], [*Preț unitar fără TVA*], [*Valoare fără TVA*]),
  [1], [{{produse}}], [{{um}}], [{{cantitate}}], [{{pret_unitar}}], [{{valoare}}])
#v(0.3cm)
#align(right)[TVA ({{cota_tva}}): {{tva}} \ *Total de plată: {{total}}*]
#v(0.4cm)
*Valabilă până la:* {{valabila_pana_la}} \ *Condiții de plată:* {{conditii_plata}}
#v(0.6cm)
#text(9pt)[Documentul nu este factură fiscală și nu se înregistrează în contabilitate ca factură. După plată sau livrare se emite factura fiscală.]
#v(1cm)
#align(right)[{{firma.nume}} \ {{firma.reprezentant}}]
#v(0.8cm)
#text(8pt, fill: gray)[Model orientativ generat de K.G.B.]

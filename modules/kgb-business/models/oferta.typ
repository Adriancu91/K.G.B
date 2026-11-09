// Oferta (Typst), 7.4k-1. Datele vin din `__kgb` (sys.inputs) ca text: nu pot rula cod.
#let d = __kgb
#let linii = json(bytes(d.at("linii")))
#set page(paper: "a4", margin: (x: 1.8cm, y: 1.6cm), footer: context align(center, text(8pt)[Ofertă generată cu K.G.B. · pagina #counter(page).display() din #counter(page).final().first()]))
#set text(lang: "ro", size: 9.5pt)
#grid(columns: (1fr, 1fr), gutter: 1.5em,
  [
    *Ofertant:* #d.at("firma_nume") \
    CUI: #d.at("firma_cui") \
    Reg. Com.: #d.at("firma_reg_com") \
    Sediu: #d.at("firma_adresa") \
    IBAN: #d.at("firma_iban") \
    Banca: #d.at("firma_banca")
  ],
  [
    *Către:* #d.at("client_nume") \
    CUI: #d.at("client_cui") \
    Reg. Com.: #d.at("client_reg_com") \
    Adresa: #d.at("client_adresa")
  ])
#v(0.8cm)
#align(center)[#text(16pt)[*OFERTĂ*] \ Nr.: *#d.at("numar")* · Data: #d.at("data") · Valabilă până la: *#d.at("valabil_pana")*]
#v(0.5cm)
#table(
  columns: (auto, 1fr, auto, auto, auto, auto, auto, auto),
  align: (center, left, center, right, right, right, right, right),
  inset: 5pt, stroke: 0.5pt,
  table.header([*Nr.*], [*Denumire*], [*UM*], [*Cant.*], [*Preț unitar (fără TVA)*], [*Cota TVA*], [*Valoare*], [*TVA*]),
  ..linii.enumerate().map(((k, l)) => ([#(k + 1)], ..l.map(x => [#x]))).flatten()
)
#v(0.3cm)
#align(right, table(columns: (auto, auto), inset: 5pt, stroke: none, align: (left, right),
  [Total fără TVA:], [#d.at("total_fara_tva") lei],
  [TVA:], [#d.at("total_tva") lei],
  [*Total:*], [*#d.at("total") lei*]))
#if d.at("nota") != "" [#v(0.3cm) #text(8.5pt)[#d.at("nota")]]
#v(0.6cm)
#text(8.5pt)[Prețurile sunt valabile până la data de mai sus. După această dată oferta nu mai este valabilă.]

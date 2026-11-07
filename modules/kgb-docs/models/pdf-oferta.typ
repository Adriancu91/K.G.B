// Model PDF (Typst): ofertă comercială. Câmpurile {{…}} se completează din
// formular; valorile sunt puse ca text, nu ca cod.
#set page(paper: "a4", margin: (x: 2.2cm, y: 2cm), footer: context align(center, text(8pt)[{{firma.nume}} · CUI {{firma.cui}} · pagina #counter(page).display() din #counter(page).final().first()]))
#set text(lang: "ro", size: 10.5pt)
#grid(columns: (1fr, auto), gutter: 1em,
  [*{{firma.nume}}* \ {{firma.adresa}} \ CUI {{firma.cui}} · Reg. Com. {{firma.reg_com}} \ {{firma.telefon}} · {{firma.email}}],
  align(right)[*OFERTĂ COMERCIALĂ* \ Nr. {{numar}} din {{data}}])
#v(1.2cm)
Către: *{{client}}*
#v(0.4cm)
Vă transmitem oferta noastră:
#v(0.2cm)
#table(columns: (1fr, auto), inset: 7pt, stroke: 0.5pt,
  table.header([*Descriere*], [*Valoare*]),
  [{{obiect}}], [{{valoare}}])
#v(0.4cm)
#grid(columns: (auto, 1fr), gutter: 0.6em,
  [Termen de livrare:], [{{termen_livrare}}],
  [Condiții de plată:], [{{conditii_plata}}],
  [Valabilă până la:], [{{valabil_pana_la}}])
#v(1.5cm)
#align(right)[{{firma.reprezentant}} \ {{firma.functie_reprezentant}}]

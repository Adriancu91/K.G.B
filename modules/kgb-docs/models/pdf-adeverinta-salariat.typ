// Model PDF (Typst): adeverință de salariat.
#set page(paper: "a4", margin: (x: 2.5cm, y: 2.2cm))
#set text(lang: "ro", size: 11pt)
#set par(justify: true, leading: 0.8em)
[*{{firma.nume}}*] \ CUI {{firma.cui}} · Reg. Com. {{firma.reg_com}} \ {{firma.adresa}}
#v(0.4cm)
#align(right)[Nr. {{numar}} / {{data}}]
#v(1cm)
#align(center, text(15pt)[*ADEVERINȚĂ*])
#v(0.8cm)
Prin prezenta se adeverește că *{{angajat}}* este angajat(ă) al(a) {{firma.nume}}, CUI {{firma.cui}}, în funcția de {{functie}}, cu contract individual de muncă pe durată {{durata_contract}}, începând cu data de {{data_angajarii}}.

Adeverința se eliberează pentru a-i servi la {{scop}}.
#v(2cm)
#grid(columns: (1fr, 1fr),
  [Data: {{data}}],
  align(right)[{{firma.reprezentant}} \ {{firma.functie_reprezentant}} \ #v(0.6cm) Semnătura și ștampila])

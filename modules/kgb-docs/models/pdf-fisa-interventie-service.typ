// Model PDF (Typst): fișă de intervenție service (8.15). Document comercial între părți, fără model legal impus.
#set page(paper: "a4", margin: (x: 2.2cm, y: 2cm))
#set text(lang: "ro", size: 10.5pt)
#set par(justify: true)
[*{{firma.nume}}*] · CUI {{firma.cui}} · Reg. Com. {{firma.reg_com}} \ {{firma.adresa}}
#v(0.8cm)
#align(center, text(14pt)[*FIȘĂ DE INTERVENȚIE*])
#align(center)[Nr. {{numar}} din {{data}}]
#v(0.5cm)
#table(columns: (auto, 1fr), inset: 6pt, stroke: 0.5pt,
  [*Client*], [{{client}}],
  [*Adresa intervenției*], [{{locatie}}],
  [*Echipament*], [{{echipament}}],
  [*Serie / nr. inventar*], [{{serie}}],
  [*Defect semnalat*], [{{defect_semnalat}}],
  [*Ora sosirii / ora plecării*], [{{ora_sosirii}} – {{ora_plecarii}}])
#v(0.4cm)
*Constatări:* {{constatari}}

*Lucrări efectuate:* {{lucrari_efectuate}}

*Piese înlocuite:* {{piese}}

*Starea echipamentului la plecare:* {{starea_finala}}

*Recomandări:* {{recomandari}}
#v(1cm)
#grid(columns: (1fr, 1fr),
  [*Tehnician,* \ {{tehnician}}],
  [*Client (am primit lucrarea),* \ {{reprezentant_client}}])
#v(0.8cm)
#text(8pt, fill: gray)[Model orientativ generat de K.G.B.]

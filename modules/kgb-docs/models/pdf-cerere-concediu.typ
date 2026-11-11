// Model PDF (Typst): cererea unui salariat pentru concediu de odihnă (7.9d).
#set page(paper: "a4", margin: (x: 2.2cm, y: 2cm))
#set text(lang: "ro", size: 10.5pt)
#set par(justify: true)
#v(1cm)
Către: *{{firma.nume}}* \ În atenția: {{firma.reprezentant}}, {{firma.functie_reprezentant}}
#v(1cm)
#align(center, text(14pt)[*CERERE DE CONCEDIU DE ODIHNĂ*])
#v(0.8cm)
Subsemnatul/Subsemnata *{{angajat}}*, angajat/angajată în funcția de {{functie}}, în cadrul {{compartiment}},

vă rog să-mi aprobați efectuarea a {{numar_zile}} zile lucrătoare de concediu de odihnă, în perioada {{de_la}} – {{pana_la}}, din concediul aferent anului {{anul}}.

Pe durata concediului, atribuțiile mele vor fi preluate de {{inlocuitor}}.
#v(1cm)
Data: {{data}}
#v(0.6cm)
#grid(columns: (1fr, 1fr),
  [Semnătura salariatului, \ {{angajat}}],
  [*Aprobat,* \ {{firma.reprezentant}}])

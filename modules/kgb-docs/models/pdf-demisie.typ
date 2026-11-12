// Model PDF (Typst): notificare de demisie (8.15). Codul muncii, art. 81 (consolidare 27.04.2026, verificat
// 13.11.2026): nu trebuie motivată; preaviz de cel mult 20 de zile lucrătoare (execuție) sau 45 (conducere).
#set page(paper: "a4", margin: (x: 2.2cm, y: 2cm))
#set text(lang: "ro", size: 10.5pt)
#set par(justify: true)
#v(1cm)
Către: *{{firma.nume}}* \ În atenția: {{firma.reprezentant}}, {{firma.functie_reprezentant}}
#v(1cm)
#align(center, text(14pt)[*DEMISIE*])
#v(0.8cm)
Subsemnatul/Subsemnata *{{angajat}}*, angajat/angajată în funcția de {{functie}}, cu contractul individual de muncă nr. {{numar_contract}},

vă notific, în temeiul art. 81 din Codul muncii, încetarea contractului individual de muncă prin demisie.

Voi respecta termenul de preaviz de {{preaviz}} zile lucrătoare, prevăzut în contractul individual de muncă sau în contractul colectiv aplicabil, astfel încât ultima zi de lucru va fi {{ultima_zi}}, dacă nu renunțați la preaviz.

Vă rog să înregistrați prezenta demisie și să-mi comunicați numărul de înregistrare.
#v(1cm)
Data: {{data}}
#v(0.6cm)
#grid(columns: (1fr, 1fr),
  [Semnătura salariatului, \ {{angajat}}],
  [*Înregistrată la nr.* ............ \ din ............])
#v(0.8cm)
#text(8pt, fill: gray)[Model orientativ generat de K.G.B. Preavizul nu se datorează dacă angajatorul nu și-a îndeplinit obligațiile din contract (Codul muncii, art. 81 alin. (8)).]

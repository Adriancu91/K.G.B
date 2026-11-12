// Model PDF (Typst): act adițional la contractul individual de muncă (8.15). Codul muncii, art. 17 alin. (5),
// art. 41 (consolidare 27.04.2026, verificat 13.11.2026): se încheie înainte de producerea modificării.
#set page(paper: "a4", margin: (x: 2.2cm, y: 2cm))
#set text(lang: "ro", size: 10.5pt)
#set par(justify: true)
[*{{firma.nume}}*] · CUI {{firma.cui}} · Reg. Com. {{firma.reg_com}} \ {{firma.adresa}}
#v(0.8cm)
#align(center, text(14pt)[*ACT ADIȚIONAL nr. {{numar}}*])
#align(center)[la contractul individual de muncă nr. {{numar_contract}} din {{data_contract}}]
#v(0.5cm)
Încheiat astăzi, {{data}}, între:

*{{firma.nume}}*, cu sediul în {{firma.adresa}}, CUI {{firma.cui}}, reprezentată de {{firma.reprezentant}}, în calitate de angajator,

și

*{{angajat}}*, în calitate de salariat,

în temeiul art. 17 alin. (5) și al art. 41 alin. (1) și (3) din Codul muncii, părțile convin modificarea contractului individual de muncă după cum urmează:

*Art. 1.* Începând cu data de {{data_aplicarii}}, {{elementul_modificat}} se modifică astfel: {{modificarea}}.

*Art. 2.* Celelalte clauze ale contractului individual de muncă rămân neschimbate.

*Art. 3.* Prezentul act adițional s-a încheiat în două exemplare, câte unul pentru fiecare parte, înainte de data de la care se aplică modificarea. Modificarea se transmite în registrul general de evidență a salariaților în termenul prevăzut de lege.
#v(1.2cm)
#grid(columns: (1fr, 1fr),
  [*Angajator,* \ {{firma.nume}} \ {{firma.reprezentant}}],
  [*Salariat,* \ {{angajat}}])
#v(0.8cm)
#text(8pt, fill: gray)[Model orientativ generat de K.G.B.; verificați-l cu un jurist înainte de semnare.]

// Model PDF (Typst): fișa postului (8.15). Codul muncii, art. 17 alin. (3) lit. d); anexă la contractul
// individual de muncă potrivit modelului-cadru din Ordinul 2.171/2022, pct. K (verificat 13.11.2026).
#set page(paper: "a4", margin: (x: 2.2cm, y: 2cm))
#set text(lang: "ro", size: 10.5pt)
#set par(justify: true)
[*{{firma.nume}}*] · CUI {{firma.cui}} · Reg. Com. {{firma.reg_com}} \ {{firma.adresa}}
#v(0.8cm)
#align(center, text(14pt)[*FIȘA POSTULUI*])
#align(center)[Anexă la contractul individual de muncă nr. {{numar_contract}}]
#v(0.5cm)
#table(columns: (auto, 1fr), inset: 6pt, stroke: 0.5pt,
  [*Denumirea postului*], [{{postul}}],
  [*Cod COR*], [{{cod_cor}}],
  [*Compartimentul*], [{{compartiment}}],
  [*Se subordonează*], [{{subordonare}}],
  [*Are în subordine*], [{{in_subordine}}],
  [*Înlocuiește / e înlocuit de*], [{{inlocuitor}}],
  [*Studii și calificări cerute*], [{{cerinte}}],
  [*Programul de lucru*], [{{program}}],
  [*Locul de muncă*], [{{locul_muncii}}])
#v(0.4cm)
*Atribuțiile postului*

{{atributii}}

*Responsabilități și limite de competență*

{{responsabilitati}}

*Securitate și sănătate în muncă:* salariatul respectă instrucțiunile primite la instruire și folosește echipamentul de protecție pus la dispoziție.

Fișa postului se poate actualiza când se schimbă atribuțiile; schimbarea felului muncii se face prin act adițional (Codul muncii, art. 41).
#v(1cm)
#grid(columns: (1fr, 1fr),
  [*Angajator,* \ {{firma.nume}} \ {{firma.reprezentant}}],
  [*Am primit un exemplar și am luat la cunoștință,* \ {{angajat}} \ Data: {{data}}])
#v(0.8cm)
#text(8pt, fill: gray)[Model orientativ generat de K.G.B.; verificați-l cu un jurist înainte de semnare.]

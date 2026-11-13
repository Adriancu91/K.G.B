// Model PDF (Typst): proces-verbal de lucrări ce devin ascunse (8.15). Codul amenajării teritoriului,
// urbanismului și construcțiilor (Legea 169/2026, în vigoare din 25.08.2026), art. 520 alin. (4) lit. b);
// HG 273/1994, regulamentul de recepție, art. 15 alin. (3) lit. d) și anexa 6 pct. 8 lit. b) (verificat 13.11.2026).
#set page(paper: "a4", margin: (x: 2.2cm, y: 2cm))
#set text(lang: "ro", size: 10.5pt)
#set par(justify: true)
[*{{firma.nume}}*] · CUI {{firma.cui}} · Reg. Com. {{firma.reg_com}} \ {{firma.adresa}}
#v(0.8cm)
#align(center, text(14pt)[*PROCES-VERBAL DE LUCRĂRI CE DEVIN ASCUNSE*])
#align(center)[Nr. {{numar}} din {{data}}]
#v(0.5cm)
#table(columns: (auto, 1fr), inset: 6pt, stroke: 0.5pt,
  [*Obiectivul*], [{{obiectivul}}],
  [*Adresa*], [{{adresa_santierului}}],
  [*Beneficiar*], [{{beneficiar}}],
  [*Executant*], [{{firma.nume}}],
  [*Autorizația de construire*], [{{autorizatia}}])
#v(0.4cm)
Comisia, formată din reprezentanții semnatari, a verificat lucrările care urmează să devină ascunse:

{{lucrarile_verificate}}

*Documente examinate* (proiect, detalii, buletine de încercare, certificate de calitate ale materialelor): {{documente_examinate}}

*Constatări:* {{constatari}}

*Concluzie:* lucrările {{concluzie}} și se poate trece la faza următoare: {{faza_urmatoare}}.

Procesul-verbal se păstrează în cartea tehnică a construcției și se prezintă comisiei de recepție.
#v(1cm)
#grid(columns: (1fr, 1fr, 1fr),
  [*Executant* \ (responsabil tehnic cu execuția) \ {{rte}}],
  [*Beneficiar* \ (diriginte de șantier) \ {{diriginte}}],
  [*Proiectant* \ (când e cazul) \ {{proiectant}}])
#v(0.8cm)
#text(8pt, fill: gray)[Model orientativ generat de K.G.B.; verificați-l cu un jurist înainte de semnare.]

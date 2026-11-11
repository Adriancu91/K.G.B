// Model PDF (Typst): adresă oficială a firmei către o instituție sau un partener — o informare, o solicitare
// de date, un răspuns la o adresă primită (7.9d).
#set page(paper: "a4", margin: (x: 2.2cm, y: 2cm))
#set text(lang: "ro", size: 10.5pt)
#set par(justify: true)
[*{{firma.nume}}*] · CUI {{firma.cui}} · Reg. Com. {{firma.reg_com}} \ {{firma.adresa}} · {{firma.telefon}} · {{firma.email}}
#v(0.4cm)
Nr. {{numar}} din {{data}}
#v(0.8cm)
Către: *{{destinatar}}* \ {{adresa_destinatarului}}
#v(0.8cm)
*Referitor la:* {{obiect}}
#v(0.4cm)
Stimată doamnă / Stimate domn,

{{continut}}

Vă mulțumim și rămânem la dispoziție pentru orice informație suplimentară.
#v(1.2cm)
#align(right)[Cu stimă, \ {{firma.functie_reprezentant}}, \ {{firma.reprezentant}}]

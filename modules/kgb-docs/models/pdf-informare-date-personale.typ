// Model PDF (Typst): notă de informare privind prelucrarea datelor personale (8.15). Regulamentul (UE)
// 2016/679, art. 13 alin. (1) și (2) (text în limba română, verificat 13.11.2026).
#set page(paper: "a4", margin: (x: 2.2cm, y: 2cm))
#set text(lang: "ro", size: 10.5pt)
#set par(justify: true)
[*{{firma.nume}}*] · CUI {{firma.cui}} · Reg. Com. {{firma.reg_com}} \ {{firma.adresa}}
#v(0.8cm)
#align(center, text(14pt)[*NOTĂ DE INFORMARE PRIVIND PRELUCRAREA DATELOR CU CARACTER PERSONAL*])
#align(center)[pentru: {{pentru_cine}}]
#v(0.5cm)
Potrivit art. 13 din Regulamentul (UE) 2016/679, vă informăm:

*1. Cine prelucrează datele.* {{firma.nume}}, CUI {{firma.cui}}, cu sediul în {{firma.adresa}}, telefon {{firma.telefon}}, e-mail {{firma.email}}. Responsabil cu protecția datelor: {{responsabil_date}}.

*2. Ce date și în ce scop.* {{datele_si_scopul}}

*3. Temeiul juridic.* {{temeiul}}

*4. Cui le transmitem.* {{destinatari}}

*5. Transferuri în afara Spațiului Economic European.* {{transferuri}}

*6. Cât timp le păstrăm.* {{perioada_stocarii}}

*7. Drepturile dumneavoastră.* Aveți dreptul să cereți accesul la date, rectificarea sau ștergerea lor, restricționarea prelucrării, dreptul de a vă opune prelucrării și dreptul la portabilitatea datelor. Dacă prelucrarea se bazează pe consimțământ, îl puteți retrage oricând, fără a afecta prelucrarea făcută înainte. Puteți depune plângere la Autoritatea Națională de Supraveghere a Prelucrării Datelor cu Caracter Personal.

*8. Dacă sunteți obligat să ne dați datele.* {{obligatia_furnizarii}}

*9. Decizii automate.* {{decizii_automate}}
#v(1cm)
#grid(columns: (1fr, 1fr),
  [*{{firma.nume}}* \ {{firma.reprezentant}}],
  [*Am primit și am citit,* \ {{persoana}} \ Data: {{data}}])
#v(0.8cm)
#text(8pt, fill: gray)[Model orientativ generat de K.G.B.; verificați-l cu un jurist înainte de semnare.]

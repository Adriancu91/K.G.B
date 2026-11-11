// Model PDF (Typst): cerere către o instituție pentru un aviz, o autorizație sau un acord (7.9d). Formularul
// oficial al instituției, unde există, are întâietate; acesta e pentru instituțiile care primesc cerere liberă.
#set page(paper: "a4", margin: (x: 2.2cm, y: 2cm))
#set text(lang: "ro", size: 10.5pt)
#set par(justify: true)
[*{{firma.nume}}*] · CUI {{firma.cui}} · Reg. Com. {{firma.reg_com}} \ {{firma.adresa}} · {{firma.telefon}} · {{firma.email}}
#v(1cm)
Către: *{{institutia}}*
#v(0.8cm)
#align(center, text(14pt)[*CERERE*])
#v(0.6cm)
Subscrisa *{{firma.nume}}*, cu sediul în {{firma.adresa}}, CUI {{firma.cui}}, înregistrată la Registrul Comerțului sub nr. {{firma.reg_com}}, reprezentată legal de {{firma.reprezentant}}, în calitate de {{firma.functie_reprezentant}},

vă rugăm să ne eliberați *{{documentul_solicitat}}*

pentru {{obiectul_cererii}},

la adresa / amplasamentul {{amplasament}}.

Anexăm documentele enumerate în opisul alăturat ({{numar_anexe}} file).

Vă rugăm să ne comunicați răspunsul la adresa de mai sus sau prin e-mail, la {{firma.email}}.
#v(1cm)
Data: {{data}}
#v(1cm)
#align(right)[{{firma.functie_reprezentant}}, \ {{firma.reprezentant}} \ (semnătura și ștampila)]

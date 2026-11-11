// Model PDF (Typst): somație de plată către un client (7.9d). Pentru ordonanța de plată, somația se comunică prin
// executor judecătoresc sau prin scrisoare recomandată cu conținut declarat și confirmare de primire.
#set page(paper: "a4", margin: (x: 2.2cm, y: 2cm))
#set text(lang: "ro", size: 10.5pt)
#set par(justify: true)
[*{{firma.nume}}*] · CUI {{firma.cui}} · Reg. Com. {{firma.reg_com}} \ {{firma.adresa}} · IBAN {{firma.iban}}, {{firma.banca}}
#v(1cm)
Către: *{{partener}}*, CUI {{partener.cui}} \ {{partener.adresa}}
#v(0.8cm)
#align(center, text(14pt)[*SOMAȚIE DE PLATĂ*])
#align(center)[Nr. {{numar}} din {{data}}]
#v(0.6cm)
Subscrisa *{{firma.nume}}*, prin reprezentant legal {{firma.reprezentant}}, vă aducem la cunoștință că, potrivit {{temei_creantei}}, figurați în evidențele noastre cu următoarele sume neachitate la scadență:

{{facturile_neachitate}}

Totalul datorat este de *{{suma_datorata}} lei*.

În temeiul art. 1014 din Codul de procedură civilă, vă somăm să achitați suma de mai sus în termen de 15 zile de la primirea prezentei, în contul {{firma.iban}}, deschis la {{firma.banca}}.

În cazul neachitării în acest termen, ne rezervăm dreptul de a ne adresa instanței pentru recuperarea sumei, a accesoriilor și a cheltuielilor de judecată.
#v(1.2cm)
#align(right)[{{firma.functie_reprezentant}}, \ {{firma.reprezentant}} \ (semnătura și ștampila)]

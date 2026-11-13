// Model PDF (Typst): contract de comodat (împrumut de folosință, gratuit) (8.15).
// Codul civil, art. 2.146–2.157 (consolidare 03.05.2026, verificat 13.11.2026).
#set page(paper: "a4", margin: (x: 2.2cm, y: 2cm), footer: context align(center, text(8pt)[Contract de comodat nr. {{numar}} din {{data}} · pagina #counter(page).display() din #counter(page).final().first()]))
#set text(lang: "ro", size: 10.5pt)
#set par(justify: true)
#align(center, text(14pt)[*CONTRACT DE COMODAT*])
#align(center)[Nr. {{numar}} din {{data}}]
#v(0.5cm)
*1. Părțile*

*{{firma.nume}}*, cu sediul în {{firma.adresa}}, CUI {{firma.cui}}, reprezentată de {{firma.reprezentant}}, în calitate de *Comodant*,

și

*{{comodatar}}*, cu sediul/domiciliul în {{comodatar.adresa}}, CUI/CNP {{comodatar.cui}}, reprezentat(ă) de {{comodatar.reprezentant}}, în calitate de *Comodatar*.

*2. Obiectul.* Comodantul dă Comodatarului, spre folosință gratuită, următorul bun: {{bunul}}, situat/aflat la {{locul_bunului}}, pentru {{destinatia}} (Codul civil, art. 2.146).

*3. Durata.* Bunul se folosește pe {{durata}}, începând cu {{data_inceperii}}, și se restituie la expirarea acestui termen (art. 2.155).

*4. Gratuitatea.* Pentru folosința bunului nu se plătește nicio sumă. Cheltuielile făcute pentru folosirea bunului (de exemplu utilitățile) sunt ale Comodatarului (art. 2.151 alin. (1)): {{cheltuieli}}.

*5. Obligațiile Comodatarului:* să păzească și să conserve bunul cu prudența și diligența unui bun proprietar, să-l folosească numai pentru destinația de mai sus și să nu-l lase altei persoane fără acordul prealabil al Comodantului (art. 2.148); să-l restituie la termen, în starea în care l-a primit, mai puțin uzura normală.

*6. Restituirea anticipată.* Comodantul poate cere bunul înapoi înainte de termen dacă are el însuși o nevoie urgentă și neprevăzută de bun, dacă Comodatarul decedează sau dacă își încalcă obligațiile (art. 2.156).

*7. Predarea și restituirea* se fac pe bază de proces-verbal de predare-primire, care arată starea bunului.

Contractul s-a încheiat în două exemplare, câte unul pentru fiecare parte. Încheiat prin înscris cu dată certă, el este titlu executoriu pentru restituirea bunului la expirarea termenului (art. 2.157).
#v(1.2cm)
#grid(columns: (1fr, 1fr),
  [*Comodant,* \ {{firma.nume}} \ {{firma.reprezentant}}],
  [*Comodatar,* \ {{comodatar}} \ {{comodatar.reprezentant}}])
#v(0.8cm)
#text(8pt, fill: gray)[Model orientativ generat de K.G.B.; verificați-l cu un jurist înainte de semnare.]

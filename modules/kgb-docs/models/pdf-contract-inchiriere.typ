// Model PDF (Typst): contract de închiriere (7.4i). Model orientativ.
#set page(paper: "a4", margin: (x: 2.2cm, y: 2cm), footer: context align(center, text(8pt)[Contract nr. {{numar}} din {{data}} · pagina #counter(page).display() din #counter(page).final().first()]))
#set text(lang: "ro", size: 10.5pt)
#set par(justify: true)
#align(center, text(14pt)[*CONTRACT DE ÎNCHIRIERE*])
#align(center)[Nr. {{numar}} din {{data}}]
#v(0.5cm)
*1. Părțile*

*{{firma.nume}}*, cu sediul în {{firma.adresa}}, CUI {{firma.cui}}, reprezentată de {{firma.reprezentant}}, numită în continuare *Locator*,

și

*{{chirias}}*, cu sediul în {{chirias.adresa}}, CUI {{chirias.cui}}, reprezentată de {{chirias.reprezentant}}, numită în continuare *Chiriaș*.

*2. Obiectul.* Locatorul dă în folosință Chiriașului: {{bunul_inchiriat}}, situat la {{adresa_bunului}}, pentru {{destinatia}}.

*3. Durata.* Contractul se încheie pe {{durata}}, începând cu {{data_inceperii}}.

*4. Chiria* este de {{chiria}} pe lună și se plătește până la data de {{ziua_platii}} a fiecărei luni. Utilitățile se plătesc {{utilitati}}.

*5. Garanția.* Chiriașul plătește o garanție de {{garantie}}, restituită la încetarea contractului, după predarea bunului în starea în care l-a primit, mai puțin uzura normală.

*6. Obligațiile Locatorului:* să predea bunul în stare corespunzătoare și să asigure folosința lui liniștită pe durata contractului.

*7. Obligațiile Chiriașului:* să folosească bunul potrivit destinației, să plătească chiria la termen, să nu subînchirieze fără acordul scris al Locatorului și să restituie bunul la încetarea contractului.

*8. Încetarea.* Contractul încetează la expirarea duratei, prin acordul părților sau prin denunțare unilaterală cu un preaviz de {{preaviz}}.

*9. Predarea și restituirea* bunului se fac pe bază de proces-verbal de predare-primire.

Contractul s-a încheiat în două exemplare, câte unul pentru fiecare parte.
#v(1.2cm)
#grid(columns: (1fr, 1fr),
  [*Locator,* \ {{firma.nume}} \ {{firma.reprezentant}}],
  [*Chiriaș,* \ {{chirias}} \ {{chirias.reprezentant}}])
#v(0.8cm)
#text(8pt, fill: gray)[Model orientativ generat de K.G.B.; verificați-l cu un jurist înainte de semnare.]

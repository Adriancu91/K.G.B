// Model PDF (Typst): contract de arendare (8.15). Codul civil, art. 1.777–1.778, 1.836–1.850
// (consolidare 03.05.2026, verificat 13.11.2026). Forma scrisă e obligatorie (art. 1.838 alin. (1)).
#set page(paper: "a4", margin: (x: 2.2cm, y: 2cm), footer: context align(center, text(8pt)[Contract de arendare nr. {{numar}} din {{data}} · pagina #counter(page).display() din #counter(page).final().first()]))
#set text(lang: "ro", size: 10.5pt)
#set par(justify: true)
#align(center, text(14pt)[*CONTRACT DE ARENDARE*])
#align(center)[Nr. {{numar}} din {{data}}]
#v(0.5cm)
*1. Părțile*

*{{arendator}}*, cu domiciliul/sediul în {{arendator.adresa}}, CNP/CUI {{arendator.cui}}, în calitate de *Arendator*,

și

*{{firma.nume}}*, cu sediul în {{firma.adresa}}, CUI {{firma.cui}}, reprezentată de {{firma.reprezentant}}, în calitate de *Arendaș*.

*2. Obiectul.* Arendatorul dă în arendă Arendașului bunurile agricole: {{bunurile_arendate}}, situate în {{localitatea}}, identificate prin {{identificare_cadastrala}} (Codul civil, art. 1.836).

*3. Durata.* Contractul se încheie pe {{durata}}, începând cu {{data_inceperii}} (cel mult 49 de ani, art. 1.783).

*4. Arenda* este de {{arenda}}, plătită {{modul_platii}}, până la {{termenul_platii}} (art. 1.780 alin. (1), art. 1.796 lit. b)). Impozitul pe venitul din arendă se reține la sursă de Arendaș, ca plătitor al venitului (Codul fiscal, art. 84 alin. (8)); impozitul pe teren rămâne al proprietarului (Codul fiscal, art. 463 alin. (1)).

*5. Obligațiile Arendașului:* să folosească bunurile ca un bun proprietar și potrivit destinației lor; să nu schimbe categoria de folosință a terenului fără acordul prealabil scris al Arendatorului (art. 1.839); să asigure bunurile pentru riscul pierderii recoltei sau al animalelor din calamități naturale (art. 1.840); să nu subarendeze (art. 1.847).

*6. Înregistrarea.* Arendașul depune câte un exemplar al contractului la consiliul local al fiecărei localități în care se află bunurile, pentru înregistrarea în registrul special; cheltuielile de încheiere și înregistrare sunt ale Arendașului (art. 1.838 alin. (2), (3), (5)).

*7. Reînnoirea.* Contractul se reînnoiește de drept pentru aceeași durată, dacă niciuna dintre părți nu comunică în scris refuzul cu cel puțin un an înainte de expirare (pentru terenurile agricole); dacă durata e de cel mult un an, termenul se înjumătățește (art. 1.848).

*8. Alte clauze:* {{alte_clauze}}

Contractul s-a încheiat în {{numar_exemplare}} exemplare.
#v(1.2cm)
#grid(columns: (1fr, 1fr),
  [*Arendator,* \ {{arendator}}],
  [*Arendaș,* \ {{firma.nume}} \ {{firma.reprezentant}}])
#v(0.8cm)
#text(8pt, fill: gray)[Model orientativ generat de K.G.B.; verificați-l cu un jurist înainte de semnare.]

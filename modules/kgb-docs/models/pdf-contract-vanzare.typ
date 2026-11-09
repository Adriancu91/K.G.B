// Model PDF (Typst): contract de vânzare-cumpărare (7.4i). Model orientativ,
// scris de K.G.B.; se verifică de un jurist înainte de folosire.
#set page(paper: "a4", margin: (x: 2.2cm, y: 2cm), footer: context align(center, text(8pt)[Contract nr. {{numar}} din {{data}} · pagina #counter(page).display() din #counter(page).final().first()]))
#set text(lang: "ro", size: 10.5pt)
#set par(justify: true)
#align(center, text(14pt)[*CONTRACT DE VÂNZARE-CUMPĂRARE*])
#align(center)[Nr. {{numar}} din {{data}}]
#v(0.5cm)
*1. Părțile*

*{{firma.nume}}*, cu sediul în {{firma.adresa}}, CUI {{firma.cui}}, nr. Reg. Com. {{firma.reg_com}}, reprezentată de {{firma.reprezentant}}, în calitate de {{firma.functie_reprezentant}}, numită în continuare *Vânzător*,

și

*{{cumparator}}*, cu sediul în {{cumparator.adresa}}, CUI {{cumparator.cui}}, reprezentată de {{cumparator.reprezentant}}, numită în continuare *Cumpărător*,

au încheiat prezentul contract.

*2. Obiectul contractului.* Vânzătorul vinde, iar Cumpărătorul cumpără: {{obiect}}.

*3. Prețul.* Prețul total este de {{pret}}. Plata se face {{conditii_plata}}.

*4. Livrarea.* Bunurile se predau la {{locul_livrarii}}, în termen de {{termen_livrare}}, pe bază de proces-verbal de predare-primire și factură.

*5. Transferul proprietății și al riscurilor* are loc la data semnării procesului-verbal de predare-primire.

*6. Garanția.* Vânzătorul garantează bunurile vândute pentru {{garantie}}, potrivit legii.

*7. Răspunderea.* Partea care nu își execută obligațiile la termen datorează penalități de {{penalitati}} pe zi de întârziere, fără a depăși valoarea obligației neexecutate.

*8. Forța majoră* exonerează de răspundere partea care o invocă, dacă o notifică celeilalte părți în cel mult 5 zile.

*9. Litigiile* se soluționează pe cale amiabilă, iar în caz contrar de instanțele competente din România.

Contractul s-a încheiat în două exemplare, câte unul pentru fiecare parte.
#v(1.2cm)
#grid(columns: (1fr, 1fr),
  [*Vânzător,* \ {{firma.nume}} \ {{firma.reprezentant}}],
  [*Cumpărător,* \ {{cumparator}} \ {{cumparator.reprezentant}}])
#v(0.8cm)
#text(8pt, fill: gray)[Model orientativ generat de K.G.B.; verificați-l cu un jurist înainte de semnare.]

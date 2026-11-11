// Model PDF (Typst): proces-verbal al unei ședințe interne — ordinea de zi, discuțiile, hotărârile (7.9d).
#set page(paper: "a4", margin: (x: 2.2cm, y: 2cm))
#set text(lang: "ro", size: 10.5pt)
#set par(justify: true)
[*{{firma.nume}}*] · CUI {{firma.cui}} · {{firma.adresa}}
#v(1cm)
#align(center, text(14pt)[*PROCES-VERBAL DE ȘEDINȚĂ*])
#align(center)[din {{data}}]
#v(0.6cm)
Ședința a avut loc la {{locatie}}, începând cu ora {{ora}}, fiind condusă de {{presedinte}}.

*Participanți:* {{participanti}}

*Ordinea de zi:* {{ordinea_de_zi}}

*Discuții:* {{discutii}}

*Hotărâri și responsabili:* {{hotarari}}

*Termen pentru următoarea ședință:* {{urmatoarea_sedinta}}
#v(1.5cm)
#grid(columns: (1fr, 1fr),
  [Președinte de ședință, \ {{presedinte}}],
  [Întocmit, \ {{intocmit}}])

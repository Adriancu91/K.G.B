# Cercetare: cum arată „centrul de control” în programele de birou ale firmelor mari

**Data:** 8 nov. 2026 · Cerut de proprietar: idei de așezare și funcții, **fără cod copiat**. Surse: documentația oficială a producătorilor (lista la final). Paginile SAP și o parte din NetSuite au refuzat accesul automat (403); pentru ele s-au folosit doar extrase din căutare.

## Ce folosesc firmele mari
| Program | Idei de așezare |
|---|---|
| Microsoft Dynamics 365 Business Central (Role Center) | o pagină de pornire pe fiecare rol: titlu cu informații („headline”), apoi plăci cu numere („cues”) care deschid lista filtrată, apoi restul; bara de acțiuni în ordinea Creează → Procesează → Rapoarte; mod „Personalizează” (muți, ascunzi) și „Revino la implicit”; orice pagină se poate fixa pe pornire |
| SAP Fiori (My Home) | spații → pagini → secțiuni → plăci, după rol; „De făcut”, „Aplicații”, „Indicatori”; plăci KPI cu cifre mari și un singur clic |
| Odoo | ecran de pornire cu aplicații; clopoțel de activități cu număr; aceleași culori peste tot: roșu = întârziat, portocaliu = azi, verde = viitor |
| Salesforce Lightning | pagina de pornire construită din componente trase cu mouse-ul, alta pe fiecare rol; „Asistentul” = lista „de rezolvat” (întârziate, noi azi); obiectiv vs. realizat |
| Oracle NetSuite | panouri cu meniu propriu: memento-uri cu numere („5 facturi de aprobat”), indicatori cu prag verde/galben/roșu, comparații cu perioada trecută, adăugare rapidă, căutare rapidă |
| Zoho Books | de încasat / de plătit, separat curent și restant; numerele deschid scadențarul; „+ Nou” pe fiecare card; perioadă aleasă pe fiecare grafic; listă „Primii pași” pentru firme noi |
| Grafana / ServiceNow (camere de control) | de la general la detaliu; culoarea doar pentru praguri; „ale mele”, aprobări în așteptare, favorite |

## Propunerea pentru Acasă în K.G.B.
1. **Bandă de sus:** salut, data, firma, starea sincronizării („3 PC-uri conectate”), 1–2 informații importante („3 autorizații expiră săptămâna asta”).
2. **Bara de acțiuni rapide:** „+ Nou” (factură, încasare, partener, task) → operații (casă, recepție) → rapoarte.
3. **Rândul banilor:** de încasat și de plătit (curent / restant), sold casă și bancă; fiecare sumă deschide lista filtrată.
4. **Plăci cu numere:** facturi neîncasate, stoc sub minim, taskuri azi, documente de semnat, mesaje necitite; pragurile de culoare le alege utilizatorul.
5. **„De rezolvat”:** o singură listă cu tot ce expiră sau e întârziat, ordonată după urgență, cu „amână” și „ascunde”.
6. **Coloana din dreapta:** agenda de azi, activitatea recentă, echipa (doar administratori).
7. **Personalizare:** panouri mutate, ascunse, redimensionate; „revino la implicit”; administratorul poate da o pagină implicită fiecărui rol.

**Navigare:** Ctrl+K pentru căutare și comenzi; pornire după rol; fixarea oricărei liste pe Acasă; elemente recente; mod compact; clopoțel cu număr.

## Primele 10 idei, după folos pentru firme mici
1. Plăci cu numere care deschid lista filtrată.
2. O singură listă „De rezolvat”.
3. De încasat / de plătit, curent și restant, plus banii din casă.
4. Bara de acțiuni Creează → Procesează → Rapoarte.
5. Aceleași culori de stare peste tot (roșu întârziat, portocaliu azi, verde viitor), mereu însoțite de text.
6. Ctrl+K: căutare și comenzi.
7. Pornire diferită pe rol, cu personalizare și revenire.
8. Fixarea oricărei pagini/liste pe Acasă.
9. Listă „Primii pași” pentru o firmă nouă.
10. Panou cu echipa și sincronizarea (administratori) și panouri libere.

**Principii comune:** cel mai important sus-stânga; rezumat întâi, detaliu la clic; cifre mari, cu moneda și perioada scrise; numerele aliniate la dreapta; culoarea doar pentru stare și niciodată singură; fiecare panou cu stările „se încarcă” și „gol”; totul accesibil din tastatură.

## Surse
- https://learn.microsoft.com/en-us/dynamics365/business-central/dev-itpro/developer/devenv-designing-role-centers
- https://learn.microsoft.com/en-us/dynamics365/business-central/dev-itpro/developer/devenv-cues-action-tiles
- https://learn.microsoft.com/en-us/dynamics365/business-central/ui-personalization-user
- https://www.sap.com/design-system/fiori-design-web/v1-96/foundations/integration-and-services/sap-fiori-launchpad/sap-fiori-launchpad-my-home (doar extras)
- https://www.sap.com/design-system/fiori-design-web/v1-139/foundations/integration-and-services/sap-fiori-launchpad/sap-fiori-launchpad-spaces (doar extras)
- https://www.odoo.com/documentation/18.0/applications/essentials/activities.html
- https://trailhead.salesforce.com/en/lightning_app_builder/lightning_app_builder_homepage
- https://docs.oracle.com/en/cloud/saas/netsuite/ns-online-help/section_N581550.html
- https://www.zoho.com/in/books/help/dashboard
- https://help.zoho.com/portal/en/kb/one/user-guide/unified-ui/widgets/articles/finance-widgets
- https://grafana.com/docs/grafana/latest/dashboards/build-dashboards/best-practices/

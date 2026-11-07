# Șabloane de calcul (Etapa 3, pasul 3.7)

**Regula (D-036, Master Plan §6.3):**
- originalele sunt protejate: sunt scrise în codul modulului `kgb.sheets` (`modules/kgb-sheets/src/templates.rs`) și nu se pot modifica din aplicație;
- „Folosește” creează **o copie a utilizatorului**, un document nou cu versiunile lui; editarea copiei nu atinge șablonul;
- fiecare formulă e documentată aici și **verificată cu valori calculate de mână** în `modules/kgb-sheets/tests/templates.rs`, independent de programul de calcul.

**Cum se construiește un șablon:**
1. Se scrie registrul cu formulele (rust_xlsxwriter).
2. IronCalc îl calculează.
3. Se scrie din nou cu rezultatele salvate în fișier, ca valorile corecte să apară și în programe care nu recalculează.

Fiecare șablon poartă nota: *„Model orientativ… nu înlocuiește un program de contabilitate autorizat.”*

**Formulele în română:** în fișier, formulele sunt în forma standard a formatului .xlsx (`SUM`, `IF`, `ROUND`, `PMT`). Programele de calcul în română le afișează automat cu numele și separatorii limbii lor; fișierul e același.

## 1. Buget lunar (Financiar)
| Celule | Formulă | Ce face |
|---|---|---|
| D (fiecare rând) | `=C−B` | diferența realizat − planificat |
| E (fiecare rând) | `=IF(B=0,"",C/B)` | procentul de realizare; gol când nu s-a planificat nimic |
| rândurile de total | `=SUM(...)` | totalul venituri / cheltuieli |
| Sold | `=Total venituri − Total cheltuieli` | pe planificat, realizat și diferență |

**Verificat:**
- venituri 8.500 / 8.500;
- cheltuieli 5.600 / 5.310 (diferență −290);
- sold 2.900 / 3.190 (diferență 290);
- Utilități 650/600 = 108,33%.

## 2. Factură (Facturare)
| Celule | Formulă | Ce face |
|---|---|---|
| B8 | 21% | cota TVA, o singură celulă (cota standard din 1 aug. 2025; se poate schimba) |
| F (pe linie) | `=ROUND(Cantitate × Preț, 2)` | valoarea fără TVA, rotunjită la bani |
| G (pe linie) | `=ROUND(Valoare × $B$8, 2)` | TVA-ul liniei, rotunjit la bani |
| F20 / F21 / F22 | `=SUM(F11:F18)` / `=SUM(G11:G18)` / `=F20+F21` | total fără TVA, total TVA, total de plată |

**Verificat:**
- 12 × 85,50 = 1.026,00 (TVA 215,46);
- 1 × 250 = 250,00 (TVA 52,50);
- 40 × 3,25 = 130,00 (TVA 27,30);
- **totaluri 1.406,00 + 295,26 = 1.701,26.**

**Notă:** TVA-ul se calculează pe fiecare linie și apoi se adună. La unele facturi, TVA-ul calculat pe total poate diferi cu 1–2 bani.

## 3. Registru de casă (Contabilitate primară)
| Celule | Formulă | Ce face |
|---|---|---|
| D3 | — | soldul inițial |
| F5 | `=$D$3 + D5 − E5` | soldul după prima operațiune |
| F6…F34 | `=F(rândul anterior) + D − E` | soldul curge rând cu rând (și peste rândurile goale) |
| D35 / E35 | `=SUM(...)` | total încasări / plăți |
| F36 | `=F34` | soldul final |
| F37 | `=D3 + D35 − E35` | verificare: sold inițial + încasări − plăți |
| F38 | `=IF(ROUND(F36−F37,2)=0,"corect","DIFERENȚĂ")` | cele două solduri trebuie să coincidă |

**Verificat:**
- 1.000 + 500 − 200 + 1.200 − 350,50 − 100 + 75,25 = **2.124,75**;
- încasări 1.775,25, plăți 650,50, verificare „corect”.

## 4. Cost pe kilometru (Transport)
| Celule | Formulă | Ce face |
|---|---|---|
| B12 | `=ROUND(Distanță × Consum / 100, 2)` | litri consumați |
| B13 | `=ROUND(Litri × Preț, 2)` | costul combustibilului |
| B14 | `=Combustibil + Taxe + Alte costuri` | costul total al cursei |
| B15 | `=IF(Distanță=0,"",ROUND(Total / Distanță, 2))` | lei pe kilometru |

**Verificat:**
- 450 km × 7,5 l/100 km = 33,75 l;
- 33,75 l × 7,20 lei = 243,00;
- 243,00 + 35 + 40 = 318,00;
- **318,00 / 450 = 0,71 lei/km.**

## 5. Rate credit (Credite)
| Celule | Formulă | Ce face |
|---|---|---|
| B8 | `=ROUND(PMT(Dobândă/12, Luni, −Sumă), 2)` | rata lunară constantă (anuitate) |
| A13…A372 | `=IF(m <= Luni, m, "")` | luna (până la 360; după termen rândurile rămân goale) |
| B | sold la început = soldul final al lunii anterioare (luna 1: suma) | — |
| D | `=ROUND(Sold × Dobândă/12, 2)` | dobânda lunii |
| E | `=IF(ultima lună, Sold, Rată − Dobândă)` | principalul; în ultima lună se plătește exact restul (fără rest de rotunjire) |
| C | `=Dobândă + Principal` | rata efectivă a lunii |
| F | `=ROUND(Sold − Principal, 2)` | sold la final |
| B9 / B10 | `=SUM(C…)` / `=SUM(D…)` | total de plată / total dobândă |

**Verificat:**
- 50.000 lei, 8% pe an, 60 de luni → rata = 50.000 × r / (1 − (1 + r)^−60), cu r = 0,08/12 → **1.013,82 lei**, valoarea din manuale;
- testul recalculează independent **fiecare lună din cele 60** (sold, dobândă, principal) și totalurile;
- soldul ajunge exact la 0.

**Limită:** rata constantă (anuitate). Ratele descrescătoare, comisioanele și dobânda variabilă nu sunt modelate.

## Ce urmează
Master Plan §6.3 cere mai multe categorii: cash-flow, P&L, stocuri, HR, proiecte, construcții etc. Acestea **nu sunt făcute** în Etapa 3. Primele cinci acoperă câte un șablon din categoriile cele mai folosite. Restul se adaugă pe aceeași regulă: formule documentate aici și verificate cu valori de mână.

# K.G.B. — Ghid de instalare și administrare

Pentru cine instalează K.G.B. într-o firmă și are grijă de calculatoarele ei. Ghidul utilizatorului e în aplicație, la „Ajutor”, și se poate salva ca PDF.

## Ce îi trebuie calculatorului
- **Windows 10 sau 11, pe 64 de biți.**
- **WebView2**, componenta Microsoft care desenează ferestrele. Windows 11 și Windows 10 la zi îl au deja. Dacă lipsește, installerul îl aduce de la Microsoft (D-095); pentru asta e nevoie de internet la instalare.
- **Fără internet și fără WebView2**, installerul spune ce lipsește. Atunci se instalează întâi „Microsoft Edge WebView2 Runtime” de pe site-ul Microsoft, apoi K.G.B.
- **Spațiu pe disc:** installerul are aproximativ 42 MB; programul instalat ocupă ceva mai mult, iar datele firmei cresc cu folosirea.

## Instalarea
1. Rulați `KGB_<versiune>_x64-setup.exe`. Programul se instalează doar pentru utilizatorul Windows curent și **nu cere drepturi de administrator**.
2. **Programul nu e încă semnat digital** (pasul 8.5): Windows poate afișa „editor necunoscut”. Apăsați „Mai multe informații” → „Rulați oricum” doar dacă installerul vine de la furnizorul vostru.
3. La prima pornire alegeți tipul de activitate al firmei. K.G.B. pornește modulele potrivite.

**Unde stă totul:**
- programul: `%LOCALAPPDATA%\KGB`;
- datele: `%LOCALAPPDATA%\ro.kronos.kgb` (spațiul de lucru, backupurile automate, jurnalul). Calea exactă apare în „Diagnostic”.

## Actualizarea
Deocamdată instalați versiunea nouă peste cea veche, cu același installer. Datele rămân, iar înaintea oricărei schimbări a formatului datelor se face automat un backup. Actualizarea din aplicație („Caută actualizări”) vine în pasul 8.6.

## Dezinstalarea
Din „Setări Windows › Aplicații” sau din meniul Start.
- **Datele rămân implicit** (D-097). Bifa „Șterge și datele K.G.B. de pe acest PC” le șterge definitiv; puneți-o doar după un backup.
- Dosarele alese de om în afara datelor aplicației (exporturi, backupuri pe stick) nu se ating niciodată.

## Backup
- **Automat:** zilnic și înainte de schimbările de format, în dosarul aplicației.
- **Manual:** din „Date și backup”. Recomandat: săptămânal, pe un stick sau pe alt disc, păstrat în alt loc decât calculatorul.
- **Restaurarea** deschide backupul ca spațiu de lucru nou, fără să atingă spațiul curent.

## Mai multe calculatoare (organizația)
1. Pe calculatorul administratorului: „Organizație” → creați organizația și rolurile.
2. „Dispozitive și sincronizare” → „Invită”: codul se introduce pe celălalt calculator. Codul conține adresa din rețeaua locală; nu îl trimiteți pe canale publice.
3. Sincronizarea merge în aceeași rețea și fără internet. Între sedii diferite folosește internetul, criptat; serverul releu pentru producție e o decizie a proprietarului (D-017).
4. **Firewall-ul Windows** poate întreba la prima pornire dacă K.G.B. are voie în rețea. Răspunsul îl dă administratorul calculatorului; K.G.B. nu schimbă setările de securitate.
5. **Un dispozitiv pierdut sau furat** se revocă din „Organizație”.

## Telefoanele
„Telefon” pornește pagina locală pentru telefoane pe calculatorul ales. Telefoanele trebuie să fie în aceeași rețea Wi-Fi. Fiecare telefon e aprobat o dată, de pe PC.

## Internetul
- K.G.B. nu trimite nimic singur (D-096).
- Sursele externe (cursul BNR, vremea, știrile, radioul, ANAF) sunt oprite din fabrică; le pornește administratorul, în „Surse externe”.
- „Setări › Internet” oprește toate cererile spre internet. Într-o organizație, îl schimbă doar administratorul.

## Când ceva nu merge
1. „Diagnostic” → „Salvează raportul într-un fișier”. Raportul nu conține date personale (8.10) și îl trimiteți voi furnizorului.
2. „Trimite o observație” (stânga jos) salvează observația, cu o captură a ferestrei, pe calculator.
3. „Probleme cunoscute” apare tot în „Diagnostic”.

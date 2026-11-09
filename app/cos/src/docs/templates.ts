// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Șabloane românești pentru Docs: documente gata așezate, în care înlocuiești textele dintre [ ].
// Sunt modele orientative (nu sfat juridic); fiecare se deschide ca document nou, nesalvat.

import type { Node as PMNode } from '@tiptap/pm/model';

export interface DocTemplate {
  id: string;
  name: string;
  desc: string;
  html: string;
}

const sign = (left: string, right: string) => `
<table><tbody><tr>
<td><p style="text-align: center"><strong>${left}</strong></p><p style="text-align: center">[Nume și prenume]</p><p style="text-align: center">Semnătura: ____________</p></td>
<td><p style="text-align: center"><strong>${right}</strong></p><p style="text-align: center">[Nume și prenume]</p><p style="text-align: center">Semnătura: ____________</p></td>
</tr></tbody></table>`;

const party = (role: string) =>
  `<strong>[Nume și prenume / Denumirea firmei]</strong>, cu domiciliul / sediul în [localitatea, strada, nr., județul], ` +
  `CNP / CUI [cod], [nr. Registrul Comerțului, dacă e firmă], cont IBAN [IBAN], deschis la [banca], ` +
  `reprezentată de [nume], în calitate de [funcția], denumit(ă) în continuare <strong>${role}</strong>`;

export const DOC_TEMPLATES: DocTemplate[] = [
  {
    id: 'prestari',
    name: 'Contract de prestări servicii',
    desc: 'Părți, obiect, preț, durată, obligații, încetare',
    html: `
<h1 style="text-align: center">CONTRACT DE PRESTĂRI SERVICII</h1>
<p style="text-align: center">nr. [nr.] din [data]</p>
<h2>1. Părțile contractului</h2>
<p>1.1. ${party('Prestatorul')},</p>
<p>și</p>
<p>1.2. ${party('Beneficiarul')},</p>
<p>au convenit încheierea prezentului contract, cu respectarea următoarelor clauze.</p>
<h2>2. Obiectul contractului</h2>
<p>2.1. Prestatorul se obligă să presteze pentru Beneficiar următoarele servicii: [descrierea serviciilor].</p>
<h2>3. Prețul și modalitatea de plată</h2>
<p>3.1. Prețul serviciilor este de [suma] lei ([suma în litere]), [plus TVA / TVA inclus / neplătitor de TVA].</p>
<p>3.2. Plata se face prin transfer bancar, în termen de [nr.] zile de la emiterea facturii.</p>
<p>3.3. Întârzierea la plată atrage penalități de [0,1]% pe zi din suma datorată, fără a depăși suma datorată.</p>
<h2>4. Durata contractului</h2>
<p>4.1. Contractul intră în vigoare la data semnării și este valabil până la [data / finalizarea serviciilor].</p>
<h2>5. Obligațiile părților</h2>
<p>5.1. Prestatorul se obligă să presteze serviciile la timp, cu profesionalism și să păstreze confidențialitatea informațiilor primite.</p>
<p>5.2. Beneficiarul se obligă să pună la dispoziție informațiile necesare și să plătească prețul la termen.</p>
<h2>6. Încetarea contractului</h2>
<p>6.1. Contractul încetează: la expirarea duratei, prin acordul părților sau prin denunțare unilaterală, cu un preaviz scris de [nr.] zile.</p>
<p>6.2. Neîndeplinirea obligațiilor dă dreptul părții nemulțumite să ceară rezilierea și daune-interese.</p>
<h2>7. Forța majoră</h2>
<p>7.1. Forța majoră, notificată în scris în [5] zile de la apariție, exonerează de răspundere partea care o invocă.</p>
<h2>8. Litigii și dispoziții finale</h2>
<p>8.1. Neînțelegerile se rezolvă pe cale amiabilă, iar dacă nu e posibil, de instanțele competente de la sediul [Prestatorului / Beneficiarului].</p>
<p>8.2. Prezentul contract a fost încheiat astăzi, [data], în două exemplare originale, câte unul pentru fiecare parte.</p>
${sign('PRESTATOR', 'BENEFICIAR')}`,
  },
  {
    id: 'inchiriere',
    name: 'Contract de închiriere',
    desc: 'Locuință: chirie, garanție, utilități, predare',
    html: `
<h1 style="text-align: center">CONTRACT DE ÎNCHIRIERE</h1>
<p style="text-align: center">nr. [nr.] din [data]</p>
<h2>1. Părțile</h2>
<p>1.1. [Nume și prenume], CNP [CNP], cu domiciliul în [adresa], posesor al C.I. seria [serie] nr. [număr], în calitate de <strong>Proprietar</strong>,</p>
<p>și</p>
<p>1.2. [Nume și prenume], CNP [CNP], cu domiciliul în [adresa], posesor al C.I. seria [serie] nr. [număr], în calitate de <strong>Chiriaș</strong>.</p>
<h2>2. Obiectul contractului</h2>
<p>2.1. Proprietarul dă în folosință Chiriașului locuința din [adresa completă], compusă din [nr.] camere și dependințe, mobilată / nemobilată, conform procesului-verbal de predare-primire anexat.</p>
<h2>3. Durata</h2>
<p>3.1. Închirierea se face pe [nr.] luni, de la [data] până la [data], cu posibilitate de prelungire prin act adițional.</p>
<h2>4. Chiria și garanția</h2>
<p>4.1. Chiria lunară este de [suma] [lei / euro], plătită până la data de [zi] a fiecărei luni, în numerar sau în contul [IBAN].</p>
<p>4.2. La semnare, Chiriașul plătește o garanție de [suma], restituită la încetarea contractului, după scăderea eventualelor daune sau datorii.</p>
<h2>5. Utilitățile</h2>
<p>5.1. Cheltuielile cu energia electrică, gazul, apa, întreținerea, internetul și [altele] sunt plătite de [Chiriaș / Proprietar].</p>
<h2>6. Obligațiile părților</h2>
<p>6.1. Proprietarul predă locuința în stare bună și asigură folosința ei liniștită pe durata contractului.</p>
<p>6.2. Chiriașul folosește locuința cu grijă, nu o subînchiriază fără acord scris și o predă la final în starea în care a primit-o, cu uzura normală.</p>
<h2>7. Încetarea</h2>
<p>7.1. Contractul încetează la expirarea duratei, prin acordul părților sau prin denunțare unilaterală, cu un preaviz de [30] de zile.</p>
<p>7.2. Neplata chiriei timp de [2] luni consecutive dă Proprietarului dreptul de a rezilia contractul.</p>
<h2>8. Dispoziții finale</h2>
<p>8.1. Contractul se înregistrează la ANAF de către Proprietar, conform legii. S-a încheiat astăzi, [data], în două exemplare.</p>
${sign('PROPRIETAR', 'CHIRIAȘ')}`,
  },
  {
    id: 'cerere',
    name: 'Cerere',
    desc: 'Cerere tip către o instituție sau o firmă',
    html: `
<p style="text-align: right">Nr. înregistrare: ________ / ________</p>
<p><strong>Către: [Instituția / Firma]</strong></p>
<p><strong>În atenția: [persoana sau compartimentul]</strong></p>
<p></p>
<h1 style="text-align: center">CERERE</h1>
<p></p>
<p>Subsemnatul/Subsemnata <strong>[Nume și prenume]</strong>, domiciliat(ă) în [localitatea, strada, nr., bl., sc., ap., județul], CNP [CNP], telefon [telefon], e-mail [e-mail],</p>
<p>vă rog să binevoiți a-mi aproba / elibera [ce soliciți], pentru [motivul solicitării].</p>
<p>Anexez la prezenta cerere: [documente anexate].</p>
<p>Vă mulțumesc.</p>
<p></p>
<table><tbody><tr>
<td><p>Data: [data]</p></td>
<td><p style="text-align: right">Semnătura: ____________</p></td>
</tr></tbody></table>`,
  },
  {
    id: 'pv',
    name: 'Proces-verbal de predare-primire',
    desc: 'Bunuri, chei sau documente, cu tabel și semnături',
    html: `
<h1 style="text-align: center">PROCES-VERBAL DE PREDARE-PRIMIRE</h1>
<p style="text-align: center">încheiat astăzi, [data], la [locul]</p>
<p>Subsemnații:</p>
<ol><li><p>[Nume și prenume / firma], CNP / CUI [cod], în calitate de <strong>predator</strong>,</p></li>
<li><p>[Nume și prenume / firma], CNP / CUI [cod], în calitate de <strong>primitor</strong>,</p></li></ol>
<p>am procedat la predarea, respectiv primirea următoarelor [bunuri / documente / chei], în baza [contractului nr. … / motivul]:</p>
<table><tbody>
<tr><th><p>Nr.</p></th><th><p>Denumire</p></th><th><p>Cantitate</p></th><th><p>Stare / observații</p></th></tr>
<tr><td><p>1</p></td><td><p>[denumire]</p></td><td><p>[cant.]</p></td><td><p>[stare]</p></td></tr>
<tr><td><p>2</p></td><td><p></p></td><td><p></p></td><td><p></p></td></tr>
<tr><td><p>3</p></td><td><p></p></td><td><p></p></td><td><p></p></td></tr>
</tbody></table>
<p>Indexuri contoare (dacă e cazul): energie electrică [index], gaz [index], apă rece [index], apă caldă [index].</p>
<p>Primitorul declară că a verificat cele de mai sus și nu are obiecții, în afară de: [obiecții / nu este cazul].</p>
<p>Prezentul proces-verbal s-a încheiat în două exemplare, câte unul pentru fiecare parte.</p>
${sign('AM PREDAT', 'AM PRIMIT')}`,
  },
  {
    id: 'imputernicire',
    name: 'Împuternicire',
    desc: 'Cineva te reprezintă la o instituție',
    html: `
<h1 style="text-align: center">ÎMPUTERNICIRE</h1>
<p></p>
<p>Subsemnatul/Subsemnata <strong>[Nume și prenume]</strong>, CNP [CNP], domiciliat(ă) în [adresa], posesor/posesoare al/a C.I. seria [serie] nr. [număr],</p>
<p>împuternicesc prin prezenta pe <strong>[Nume și prenume]</strong>, CNP [CNP], domiciliat(ă) în [adresa], posesor/posesoare al/a C.I. seria [serie] nr. [număr],</p>
<p>să mă reprezinte la [instituția], pentru [scopul: depunerea / ridicarea documentelor …], să semneze în numele meu și să îndeplinească toate formalitățile necesare în acest scop.</p>
<p>Prezenta împuternicire este valabilă până la [data / îndeplinirea scopului].</p>
<p></p>
<table><tbody><tr>
<td><p>Data: [data]</p></td>
<td><p style="text-align: right">Semnătura: ____________</p></td>
</tr></tbody></table>`,
  },
  {
    id: 'oferta',
    name: 'Ofertă de preț',
    desc: 'Produse sau servicii, prețuri, valabilitate',
    html: `
<p><strong>[Denumirea firmei]</strong><br>CUI [CUI] · [Nr. Registrul Comerțului]<br>[Adresa] · [telefon] · [e-mail]</p>
<h1 style="text-align: center">OFERTĂ DE PREȚ</h1>
<p style="text-align: center">nr. [nr.] din [data]</p>
<p>Către: <strong>[Client]</strong></p>
<p>Stimate/Stimată [nume], vă mulțumim pentru interes. Vă transmitem mai jos oferta noastră pentru [ce se oferă]:</p>
<table><tbody>
<tr><th><p>Nr.</p></th><th><p>Produs / serviciu</p></th><th><p>U.M.</p></th><th><p>Cantitate</p></th><th><p>Preț unitar (lei)</p></th><th><p>Valoare (lei)</p></th></tr>
<tr><td><p>1</p></td><td><p>[produs]</p></td><td><p>buc.</p></td><td><p>[cant.]</p></td><td><p>[preț]</p></td><td><p>[valoare]</p></td></tr>
<tr><td><p>2</p></td><td><p></p></td><td><p></p></td><td><p></p></td><td><p></p></td><td><p></p></td></tr>
<tr><td><p></p></td><td><p><strong>Total</strong></p></td><td><p></p></td><td><p></p></td><td><p></p></td><td><p><strong>[total]</strong></p></td></tr>
</tbody></table>
<ul><li><p>Prețurile [includ / nu includ] TVA.</p></li>
<li><p>Termen de livrare / execuție: [nr.] zile de la confirmarea comenzii.</p></li>
<li><p>Condiții de plată: [avans …% / la livrare / în … zile].</p></li>
<li><p>Oferta este valabilă până la [data].</p></li></ul>
<p>Pentru orice întrebare ne puteți contacta la [telefon] sau [e-mail].</p>
<p>Cu stimă,<br>[Nume și prenume], [funcția]</p>`,
  },
  {
    id: 'cv',
    name: 'CV',
    desc: 'Curriculum vitae clar, pe secțiuni (stil Europass)',
    html: `
<h1>[Nume și prenume]</h1>
<p>[Localitatea] · [telefon] · [e-mail] · [link LinkedIn / site, opțional]</p>
<hr>
<h2>Despre mine</h2>
<p>[2-3 propoziții: ce faci, ce știi bine și ce fel de post cauți.]</p>
<h2>Experiență profesională</h2>
<h3>[Funcția] — [Angajatorul], [localitatea]</h3>
<p><em>[luna anul] – [luna anul / prezent]</em></p>
<ul><li><p>[Responsabilitate sau realizare, cu cifre dacă se poate]</p></li><li><p>[Responsabilitate sau realizare]</p></li></ul>
<h3>[Funcția] — [Angajatorul], [localitatea]</h3>
<p><em>[luna anul] – [luna anul]</em></p>
<ul><li><p>[Responsabilitate sau realizare]</p></li></ul>
<h2>Educație și formare</h2>
<h3>[Diploma / specializarea] — [Instituția]</h3>
<p><em>[anul] – [anul]</em></p>
<h2>Competențe</h2>
<table><tbody>
<tr><th><p>Limba maternă</p></th><td><p>română</p></td></tr>
<tr><th><p>Limbi străine</p></th><td><p>[limba]: [nivel A1–C2]</p></td></tr>
<tr><th><p>Calculator</p></th><td><p>[programe și unelte]</p></td></tr>
<tr><th><p>Permis de conducere</p></th><td><p>[categoria / nu]</p></td></tr>
</tbody></table>
<h2>Alte informații</h2>
<p>[Voluntariat, certificări, proiecte, hobby-uri relevante]</p>`,
  },
  {
    id: 'intentie',
    name: 'Scrisoare de intenție',
    desc: 'Pentru un post: de ce tu, ce aduci, încheiere',
    html: `
<p><strong>[Nume și prenume]</strong><br>[Adresa] · [telefon] · [e-mail]</p>
<p>[Localitatea], [data]</p>
<p>Către: <strong>[Firma]</strong><br>În atenția: [numele persoanei care face angajarea / Departamentul de resurse umane]</p>
<p><strong>Privind: candidatura pentru postul de [funcția]</strong> ([unde ați văzut anunțul, referința anunțului])</p>
<p>Stimată doamnă / Stimate domnule [nume],</p>
<p>Vă scriu pentru a-mi exprima interesul pentru postul de [funcția] din cadrul [firma]. [O frază despre ce vă atrage la firmă sau la post.]</p>
<p>În ultimii [x] ani am lucrat ca [funcția] la [angajatorul], unde [realizarea cea mai potrivită pentru acest post, cu cifre dacă se poate]. [A doua realizare sau competență cerută în anunț.]</p>
<p>Cred că pot contribui la echipa dumneavoastră prin [ce aduceți: experiență, competențe, felul de a lucra].</p>
<p>Vă mulțumesc pentru timpul acordat. Atașez CV-ul și aș fi bucuros/bucuroasă să discutăm la un interviu, la data care vă convine.</p>
<p>Cu stimă,<br>[Nume și prenume]</p>`,
  },
  {
    id: 'demisie',
    name: 'Demisie',
    desc: 'Notificarea angajatorului, cu termenul de preaviz',
    html: `
<p>Către: <strong>[Denumirea angajatorului]</strong><br>În atenția: [Directorul general / Departamentul de resurse umane]</p>
<p>Nr. înregistrare: ________ / data: ________</p>
<h1 style="text-align: center">DEMISIE</h1>
<p></p>
<p>Subsemnatul/Subsemnata <strong>[Nume și prenume]</strong>, angajat(ă) al/a [denumirea angajatorului] în funcția de [funcția], în baza contractului individual de muncă nr. [nr.] din [data],</p>
<p>vă aduc la cunoștință, prin prezenta, decizia mea de a înceta contractul individual de muncă prin demisie, conform art. 81 din Codul muncii.</p>
<p>Voi respecta termenul de preaviz de [numărul] zile lucrătoare, prevăzut în contract, astfel încât ultima zi de lucru va fi [data]. [Sau: Vă rog să aprobați renunțarea la preaviz / reducerea lui.]</p>
<p>Vă mulțumesc pentru colaborare.</p>
<p></p>
<table><tbody><tr>
<td><p>Data: [data]</p></td>
<td><p style="text-align: right">Semnătura: ____________</p></td>
</tr></tbody></table>`,
  },
  {
    id: 'declaratie',
    name: 'Declarație pe propria răspundere',
    desc: 'Ce declari, cu datele tale și semnătura',
    html: `
<h1 style="text-align: center">DECLARAȚIE PE PROPRIA RĂSPUNDERE</h1>
<p></p>
<p>Subsemnatul/Subsemnata <strong>[Nume și prenume]</strong>, CNP [CNP], domiciliat(ă) în [adresa], posesor/posesoare al/a C.I. seria [serie] nr. [număr], eliberată de [autoritatea] la data de [data],</p>
<p>cunoscând prevederile Codului penal privind falsul în declarații, declar pe propria răspundere că:</p>
<p>[ce declarați, de exemplu: nu am datorii la …, locuiesc la adresa …, venitul meu lunar este de …]</p>
<p>Prezenta declarație îmi este necesară pentru [scopul: dosarul de …, instituția …].</p>
<p></p>
<table><tbody><tr>
<td><p>Data: [data]</p></td>
<td><p style="text-align: right">Semnătura: ____________</p></td>
</tr></tbody></table>`,
  },
  {
    id: 'minuta',
    name: 'Minută de ședință',
    desc: 'Participanți, subiecte discutate, hotărâri, responsabili',
    html: `
<h1 style="text-align: center">MINUTA ȘEDINȚEI</h1>
<p style="text-align: center">[Echipa / departamentul] · [data], ora [ora] · [sala / online]</p>
<p><strong>Participanți:</strong> [Nume], [Nume], [Nume]<br><strong>Absenți:</strong> [Nume]<br><strong>A condus ședința:</strong> [Nume] · <strong>A redactat:</strong> [Nume]</p>
<h2>Ordinea de zi</h2>
<ol><li><p>[Subiectul 1]</p></li><li><p>[Subiectul 2]</p></li><li><p>Diverse</p></li></ol>
<h2>Discuții</h2>
<p><strong>1. [Subiectul 1]</strong>: [ce s-a discutat, pe scurt, și ce variante au fost].</p>
<p><strong>2. [Subiectul 2]</strong>: [ce s-a discutat].</p>
<h2>Hotărâri și sarcini</h2>
<table><tbody>
<tr><th><p>Nr.</p></th><th><p>Ce s-a hotărât</p></th><th><p>Responsabil</p></th><th><p>Termen</p></th></tr>
<tr><td><p>1</p></td><td><p>[hotărârea]</p></td><td><p>[nume]</p></td><td><p>[data]</p></td></tr>
<tr><td><p>2</p></td><td><p>[hotărârea]</p></td><td><p>[nume]</p></td><td><p>[data]</p></td></tr>
</tbody></table>
<p><strong>Următoarea ședință:</strong> [data], ora [ora].</p>`,
  },
  {
    id: 'concediu',
    name: 'Cerere de concediu',
    desc: 'Concediu de odihnă: perioada, înlocuitorul, aprobarea șefului',
    html: `
<p>Către: <strong>[Denumirea angajatorului]</strong><br>În atenția: [Șeful direct / Departamentul de resurse umane]</p>
<p>Nr. înregistrare: ________ / data: ________</p>
<h1 style="text-align: center">CERERE DE CONCEDIU DE ODIHNĂ</h1>
<p></p>
<p>Subsemnatul/Subsemnata <strong>[Nume și prenume]</strong>, angajat(ă) în funcția de [funcția], în cadrul [departamentul / compartimentul],</p>
<p>vă rog să-mi aprobați efectuarea a [numărul] zile lucrătoare de concediu de odihnă, în perioada [data de început] – [data de sfârșit], din concediul aferent anului [anul].</p>
<p>În această perioadă voi fi înlocuit(ă) de [numele colegului], care a fost de acord. [Sarcinile urgente au fost predate / se pot amâna până la întoarcere.]</p>
<p>Mă voi prezenta la serviciu în data de [data].</p>
<p></p>
<table><tbody><tr>
<td><p>Data: [data]</p></td>
<td><p style="text-align: right">Semnătura: ____________</p></td>
</tr></tbody></table>
<p></p>
<table><tbody><tr>
<td><p><strong>Aprob,</strong></p><p>[Șeful direct]</p><p>Semnătura: ____________</p></td>
<td><p><strong>Înlocuitor,</strong></p><p>[Nume și prenume]</p><p>Semnătura: ____________</p></td>
</tr></tbody></table>`,
  },
  {
    id: 'notificare',
    name: 'Notificare de plată',
    desc: 'Somație amiabilă pentru o factură neplătită, cu termen',
    html: `
<p><strong>[Denumirea firmei tale]</strong><br>[Adresa] · CUI [cod] · [telefon] · [e-mail]</p>
<p>Către: <strong>[Denumirea clientului]</strong><br>[Adresa clientului] · CUI [cod]</p>
<p>Nr. [nr.] / [data]</p>
<h1 style="text-align: center">NOTIFICARE DE PLATĂ</h1>
<p></p>
<p>Stimate client,</p>
<p>Vă aducem la cunoștință că, potrivit evidențelor noastre, următoarele facturi au ajuns la scadență și nu au fost achitate:</p>
<table><tbody>
<tr><th><p>Factura</p></th><th><p>Data emiterii</p></th><th><p>Scadența</p></th><th><p>Suma de plată</p></th></tr>
<tr><td><p>[seria și nr.]</p></td><td><p>[data]</p></td><td><p>[data]</p></td><td><p>[suma] lei</p></td></tr>
<tr><td><p>[seria și nr.]</p></td><td><p>[data]</p></td><td><p>[data]</p></td><td><p>[suma] lei</p></td></tr>
<tr><td><p><strong>Total</strong></p></td><td><p></p></td><td><p></p></td><td><p><strong>[total] lei</strong></p></td></tr>
</tbody></table>
<p>Vă rugăm să achitați suma totală de <strong>[total] lei</strong> până la data de <strong>[termenul]</strong>, în contul IBAN [IBAN], deschis la [banca], cu mențiunea „[numerele facturilor]”.</p>
<p>Dacă plata a fost deja făcută, vă rugăm să ne trimiteți dovada și să considerați această notificare fără obiect. Pentru orice neclaritate ne puteți contacta la [telefon / e-mail].</p>
<p>Dacă suma nu va fi achitată până la termenul de mai sus, ne rezervăm dreptul de a calcula penalitățile prevăzute în contract și de a recupera creanța pe cale legală.</p>
<p>Cu stimă,<br>[Nume și prenume], [funcția]</p>`,
  },
  {
    id: 'vanzareauto',
    name: 'Contract de vânzare-cumpărare auto',
    desc: 'Vânzarea unui autovehicul între persoane fizice: date, preț, predare',
    html: `
<h1 style="text-align: center">CONTRACT DE VÂNZARE-CUMPĂRARE</h1>
<p style="text-align: center">a unui autovehicul · încheiat azi, [data], la [localitatea]</p>
<h2>1. Părțile</h2>
<p>1.1. <strong>[Nume și prenume]</strong>, CNP [CNP], domiciliat(ă) în [adresa], C.I. seria [serie] nr. [număr], în calitate de <strong>Vânzător</strong>,</p>
<p>și</p>
<p>1.2. <strong>[Nume și prenume]</strong>, CNP [CNP], domiciliat(ă) în [adresa], C.I. seria [serie] nr. [număr], în calitate de <strong>Cumpărător</strong>.</p>
<h2>2. Obiectul contractului</h2>
<p>2.1. Vânzătorul vinde, iar Cumpărătorul cumpără autovehiculul cu următoarele date:</p>
<table><tbody>
<tr><td><p>Marca și modelul</p></td><td><p>[marca, modelul]</p></td></tr>
<tr><td><p>Număr de înmatriculare</p></td><td><p>[nr.]</p></td></tr>
<tr><td><p>Serie șasiu (VIN)</p></td><td><p>[seria]</p></td></tr>
<tr><td><p>Anul fabricației / culoarea</p></td><td><p>[anul] / [culoarea]</p></td></tr>
<tr><td><p>Kilometri la bord</p></td><td><p>[km]</p></td></tr>
<tr><td><p>Carte de identitate a vehiculului</p></td><td><p>seria [serie] nr. [număr]</p></td></tr>
</tbody></table>
<h2>3. Prețul și plata</h2>
<p>3.1. Prețul este de [suma] lei ([suma în litere]), plătit [integral la semnare / în numerar / prin transfer în contul IBAN …].</p>
<h2>4. Predarea</h2>
<p>4.1. Autovehiculul se predă la data semnării, împreună cu: cartea de identitate a vehiculului, certificatul de înmatriculare, [nr.] chei, [alte acte: ITP, asigurare, istoric service].</p>
<p>4.2. Vânzătorul declară că autovehiculul îi aparține, nu este gajat, sechestrat sau furat și nu are datorii la impozit.</p>
<p>4.3. Cumpărătorul declară că a văzut autovehiculul, l-a încercat și îl cumpără în starea în care se află: [observații despre stare].</p>
<h2>5. Alte prevederi</h2>
<p>5.1. Cumpărătorul se obligă să înmatriculeze autovehiculul pe numele său în termenul prevăzut de lege; până atunci răspunde de amenzile primite după predare.</p>
<p>5.2. Contractul s-a încheiat în [3] exemplare, câte unul pentru fiecare parte și unul pentru [autoritatea fiscală / înmatriculare].</p>
${sign('VÂNZĂTOR', 'CUMPĂRĂTOR')}`,
  },
  {
    id: 'comodat',
    name: 'Contract de comodat',
    desc: 'Folosința gratuită a unei locuințe sau a unui spațiu, de exemplu pentru sediul unei firme',
    html: `
<h1 style="text-align: center">CONTRACT DE COMODAT</h1>
<p style="text-align: center">(împrumut de folosință, fără plată) · Nr. [nr.] / [data]</p>
<h2>1. Părțile</h2>
<p>1.1. ${party('Comodant')} (cel care dă bunul în folosință),</p>
<p>și</p>
<p>1.2. ${party('Comodatar')} (cel care primește bunul în folosință).</p>
<h2>2. Obiectul contractului</h2>
<p>2.1. Comodantul dă Comodatarului, spre folosință gratuită, imobilul situat în [localitatea, strada, nr., bloc, scara, etaj, ap., județul], înscris în cartea funciară nr. [nr.] a localității [localitatea], număr cadastral [nr.], format din [descrierea: încăperi, suprafața utilă de … mp].</p>
<p>2.2. Imobilul se folosește ca [locuință / sediu social / punct de lucru al firmei …], fără altă destinație decât cu acordul scris al Comodantului.</p>
<p>2.3. Comodantul declară că este proprietarul imobilului și că acesta nu este grevat de sarcini care să împiedice folosința.</p>
<h2>3. Durata</h2>
<p>3.1. Contractul se încheie pe o perioadă de [nr.] ani, de la [data] până la [data], și se poate prelungi prin act adițional.</p>
<p>3.2. Comodantul poate cere înapoi imobilul înainte de termen doar dacă are o nevoie urgentă și neprevăzută de el sau dacă Comodatarul nu își respectă obligațiile, cu o înștiințare scrisă de cel puțin [30] de zile.</p>
<h2>4. Obligațiile Comodatarului</h2>
<p>4.1. Să folosească imobilul cu grijă, potrivit destinației de la punctul 2.2, și să-l păstreze în starea în care l-a primit, în afara uzurii normale.</p>
<p>4.2. Să plătească utilitățile pe care le consumă ([energie electrică, gaze, apă, internet, întreținere]), pe baza facturilor sau a contoarelor.</p>
<p>4.3. Să nu dea imobilul altcuiva în folosință, total sau parțial, fără acordul scris al Comodantului.</p>
<p>4.4. Să permită Comodantului să verifice starea imobilului, după o înștiințare făcută cu [nr.] zile înainte.</p>
<p>4.5. La încetarea contractului, să predea imobilul liber și curat, pe bază de proces-verbal de predare-primire.</p>
<h2>5. Încetarea contractului</h2>
<p>5.1. Contractul încetează la sfârșitul duratei, prin acordul părților, prin denunțarea lui potrivit punctului 3.2 sau dacă una dintre părți nu își respectă obligațiile, după o notificare scrisă rămasă fără efect [15] zile.</p>
<h2>6. Alte prevederi</h2>
<p>6.1. Folosința este gratuită: Comodatarul nu plătește chirie sau altă sumă pentru folosința imobilului.</p>
<p>6.2. Neînțelegerile se rezolvă pe cale amiabilă; altfel, de către instanța competentă de la locul imobilului.</p>
<p>6.3. Contractul s-a încheiat în [2] exemplare, câte unul pentru fiecare parte[, plus un exemplar pentru Registrul Comerțului].</p>
${sign('COMODANT', 'COMODATAR')}`,
  },
  {
    id: 'adeverinta',
    name: 'Adeverință de salariat',
    desc: 'Firma confirmă că o persoană e angajată, cu funcția și venitul, de exemplu pentru bancă sau medic',
    html: `
<p><strong>[Denumirea firmei]</strong><br>[Adresa sediului] · CUI [cod] · Nr. Registrul Comerțului [J../…/…]<br>[telefon] · [e-mail]</p>
<p>Nr. [nr.] / [data]</p>
<h1 style="text-align: center">ADEVERINȚĂ</h1>
<p></p>
<p>Prin prezenta se adeverește că <strong>[Nume și prenume]</strong>, CNP [CNP], domiciliat(ă) în [adresa], este angajat(ă) al(a) societății noastre din data de [data angajării], cu contract individual de muncă pe durată [nedeterminată / determinată, până la data …], cu normă [întreagă / parțială de … ore pe zi], în funcția de <strong>[funcția]</strong>.</p>
<p>Contractul de muncă este înregistrat în registrul general de evidență a salariaților și [nu se află / se află] în perioadă de probă sau de încetare.</p>
<p>Veniturile salariale realizate în ultimele [3 / 6] luni:</p>
<table><tbody>
<tr><th><p>Luna</p></th><th><p>Salariu brut</p></th><th><p>Salariu net</p></th></tr>
<tr><td><p>[luna, anul]</p></td><td><p>[suma] lei</p></td><td><p>[suma] lei</p></td></tr>
<tr><td><p>[luna, anul]</p></td><td><p>[suma] lei</p></td><td><p>[suma] lei</p></td></tr>
<tr><td><p>[luna, anul]</p></td><td><p>[suma] lei</p></td><td><p>[suma] lei</p></td></tr>
<tr><td><p><strong>Media lunară</strong></p></td><td><p><strong>[suma] lei</strong></p></td><td><p><strong>[suma] lei</strong></p></td></tr>
</tbody></table>
<p>Pe numele salariatului(ei) [nu există / există] popriri sau rețineri din salariu[: …].</p>
<p>Eliberăm prezenta adeverință pentru a-i servi la [bancă / medicul de familie / școală / grădiniță / ambasadă …].</p>
<p>Răspundem pentru exactitatea datelor de mai sus, conform evidențelor firmei.</p>
<p></p>
<table><tbody><tr>
<td><p style="text-align: center"><strong>Administrator / Director</strong></p><p style="text-align: center">[Nume și prenume]</p><p style="text-align: center">Semnătura și ștampila: ____________</p></td>
<td><p style="text-align: center"><strong>Întocmit</strong> (resurse umane / contabilitate)</p><p style="text-align: center">[Nume și prenume]</p><p style="text-align: center">Semnătura: ____________</p></td>
</tr></tbody></table>`,
  },  {
    id: 'recomandare',
    name: 'Scrisoare de recomandare',
    desc: 'Un fost șef, profesor sau coleg recomandă o persoană pentru un loc de muncă, o bursă sau o facultate',
    html: `
<p><strong>[Nume și prenume]</strong><br>[Funcția] · [Firma / instituția]<br>[telefon] · [e-mail]</p>
<p>[Localitatea], [data]</p>
<p>Către: [firma / comisia de admitere / persoana căreia îi scrieți]</p>
<h1 style="text-align: center">SCRISOARE DE RECOMANDARE</h1>
<p></p>
<p>Prin prezenta o / îl recomand cu toată încrederea pe <strong>[Nume și prenume]</strong> pentru [postul de … / bursa … / programul de studii …].</p>
<h2>Cum ne cunoaștem</h2>
<p>Am lucrat împreună [la firma … / în cadrul …] în perioada [de la … până la …], unde [Numele] a fost [funcția, clasa sau rolul], iar eu [șeful direct / profesorul / coordonatorul] său.</p>
<h2>Ce a făcut</h2>
<ul>
<li><p>[o sarcină sau un proiect important, cu rezultatul lui]</p></li>
<li><p>[o realizare concretă, de exemplu cu cifre]</p></li>
<li><p>[o responsabilitate pe care a preluat-o singur(ă)]</p></li>
</ul>
<h2>Calități</h2>
<p>[Numele] este [o persoană serioasă, punctuală, care învață repede …]. Am apreciat în mod deosebit [o calitate, cu un exemplu].</p>
<p>Sunt convins(ă) că va fi un câștig pentru [firma / instituția] dumneavoastră și o / îl recomand fără rezerve. Vă stau la dispoziție pentru orice detalii, la telefon sau prin e-mail.</p>
<p></p>
<p>Cu stimă,</p>
<p><strong>[Nume și prenume]</strong><br>[Funcția]<br>Semnătura: ____________</p>`,
  },

  {
    id: 'reclamatie',
    name: 'Reclamație',
    desc: 'Către un magazin sau un furnizor: ce ai cumpărat, ce s-a întâmplat, ce ceri (reparare, înlocuire, banii înapoi) și în cât timp',
    html: `
<p><strong>[Nume și prenume]</strong><br>[Adresa]<br>[telefon] · [e-mail]</p>
<p>Către: <strong>[Firma / magazinul]</strong><br>[Adresa firmei sau a magazinului]</p>
<p>[Localitatea], [data]</p>
<h1 style="text-align: center">RECLAMAȚIE</h1>
<p></p>
<p>Subsemnatul(a) <strong>[Nume și prenume]</strong>, vă aduc la cunoștință următoarea problemă cu un produs / serviciu cumpărat de la dumneavoastră.</p>
<h2>Ce am cumpărat</h2>
<ul>
<li><p>Produsul / serviciul: [denumirea, modelul, seria]</p></li>
<li><p>Data cumpărării: [data] · Bonul / factura nr.: [număr]</p></li>
<li><p>Prețul plătit: [suma] lei · Garanția: [luni] luni</p></li>
</ul>
<h2>Ce s-a întâmplat</h2>
<p>[Descrieți pe scurt problema: de când apare, ce nu funcționează, ce ați încercat deja, cu cine ați vorbit la magazin și când.]</p>
<h2>Ce vă cer</h2>
<p>În temeiul legislației privind protecția consumatorilor și al garanției produsului, vă rog să [repararea produsului / înlocuirea lui cu unul nou / restituirea banilor / reducerea prețului] în cel mult [15] zile de la primirea acestei reclamații.</p>
<p>Dacă nu primesc un răspuns în acest termen, mă voi adresa autorității pentru protecția consumatorilor.</p>
<h2>Atașez</h2>
<ul>
<li><p>copia bonului / facturii</p></li>
<li><p>copia certificatului de garanție</p></li>
<li><p>[fotografii cu defectul, alte documente]</p></li>
</ul>
<p></p>
<p>Vă rog să-mi răspundeți în scris, la adresa sau e-mailul de mai sus.</p>
<p>Cu stimă,</p>
<p><strong>[Nume și prenume]</strong><br>Semnătura: ____________</p>`,
  },
  {
    id: 'imprumut',
    name: 'Contract de împrumut',
    desc: 'O sumă de bani împrumutată între persoane sau firme: suma în cifre și în litere, când și cum se dă înapoi, cu sau fără dobândă',
    html: `
<h1 style="text-align: center">CONTRACT DE ÎMPRUMUT</h1>
<p style="text-align: center">(împrumut de bani) · Nr. [nr.] / [data]</p>
<h2>1. Părțile</h2>
<p>1.1. ${party('Împrumutător')} (cel care dă banii),</p>
<p>și</p>
<p>1.2. ${party('Împrumutat')} (cel care primește banii).</p>
<h2>2. Obiectul contractului</h2>
<p>2.1. Împrumutătorul îi împrumută Împrumutatului suma de <strong>[suma] lei</strong> (adică [suma în litere] lei), pe care Împrumutatul se obligă să o dea înapoi în condițiile de mai jos.</p>
<p>2.2. Suma se dă [în numerar, la semnarea contractului / prin transfer în contul IBAN al Împrumutatului, în cel mult [nr.] zile de la semnare]. Semnarea contractului ține loc de dovadă a primirii banilor în numerar.</p>
<h2>3. Dobânda</h2>
<p>3.1. Împrumutul se acordă [fără dobândă / cu o dobândă de [procent] % pe an, calculată la suma rămasă de dat înapoi].</p>
<h2>4. Restituirea</h2>
<p>4.1. Împrumutatul dă înapoi suma [o dată, până la data de [data] / în [nr.] rate lunare de câte [suma] lei, până pe [ziua] a fiecărei luni, începând cu [luna, anul]].</p>
<p>4.2. Plata se face [în numerar, cu chitanță / prin transfer în contul IBAN al Împrumutătorului]. Împrumutatul poate da banii înapoi și mai devreme, fără penalități.</p>
<h2>5. Întârzierea la plată</h2>
<p>5.1. Pentru fiecare zi de întârziere, Împrumutatul plătește penalități de [procent] % din suma neplătită la timp, fără ca penalitățile să depășească suma datorată.</p>
<p>5.2. Dacă Împrumutatul întârzie mai mult de [nr.] zile cu o rată, Împrumutătorul poate cere toată suma rămasă, după o notificare scrisă.</p>
<h2>6. Alte prevederi</h2>
<p>6.1. Neînțelegerile se rezolvă pe cale amiabilă; altfel, de către instanța competentă.</p>
<p>6.2. Contractul s-a încheiat în [2] exemplare, câte unul pentru fiecare parte.</p>
${sign('ÎMPRUMUTĂTOR', 'ÎMPRUMUTAT')}`,
  },
  {
    id: 'confidentialitate',
    name: 'Acord de confidențialitate',
    desc: 'Înainte de o colaborare sau o ofertă: ce informații rămân secrete, cât timp, ce nu intră aici și ce se întâmplă dacă sunt divulgate',
    html: `
<h1 style="text-align: center">ACORD DE CONFIDENȚIALITATE</h1>
<p style="text-align: center">Nr. [nr.] / [data]</p>
<h2>1. Părțile</h2>
<p>1.1. ${party('Partea care dezvăluie')} (cea care dă informațiile),</p>
<p>și</p>
<p>1.2. ${party('Partea care primește')} (cea care primește informațiile).</p>
<h2>2. Scopul</h2>
<p>2.1. Părțile discută despre [colaborarea / proiectul / oferta: descrieți pe scurt] și, pentru asta, Partea care dezvăluie îi dă Părții care primește informații care nu sunt publice. Acordul spune cum se păstrează aceste informații.</p>
<h2>3. Ce informații sunt confidențiale</h2>
<p>3.1. Sunt confidențiale toate informațiile date în scris, pe e-mail, în fișiere sau verbal, legate de scopul de mai sus, de exemplu: [prețuri, clienți și furnizori, planuri de afaceri, date tehnice, cod, desene, rețete, date personale].</p>
<p>3.2. Nu sunt confidențiale informațiile care: erau deja publice sau devin publice fără vina Părții care primește; erau cunoscute de ea dinainte, cu dovadă; le-a primit legal de la altcineva; trebuie dezvăluite prin lege sau la cererea unei autorități (caz în care o anunță imediat pe cealaltă parte).</p>
<h2>4. Obligațiile Părții care primește</h2>
<p>4.1. Folosește informațiile doar pentru scopul de la punctul 2 și nu le dă altor persoane, în afară de angajații sau colaboratorii care au nevoie de ele și care s-au obligat la fel.</p>
<p>4.2. Le păstrează cu cel puțin aceeași grijă cu care își păstrează propriile informații secrete.</p>
<p>4.3. La cererea Părții care dezvăluie sau la sfârșitul colaborării, îi dă înapoi sau șterge informațiile primite, cu toate copiile, în cel mult [10] zile.</p>
<h2>5. Durata</h2>
<p>5.1. Acordul intră în vigoare la data semnării. Obligația de confidențialitate durează [2] ani după încheierea colaborării sau după ultima informație primită.</p>
<h2>6. Încălcarea acordului</h2>
<p>6.1. Dacă dezvăluie informațiile fără drept, Partea care primește plătește daunele produse [și o sumă de [suma] lei, stabilită de acum].</p>
<h2>7. Alte prevederi</h2>
<p>7.1. Acordul nu obligă părțile să încheie vreun alt contract și nu dă niciun drept asupra informațiilor primite.</p>
<p>7.2. Neînțelegerile se rezolvă pe cale amiabilă; altfel, de către instanța competentă. Acordul s-a încheiat în [2] exemplare, câte unul pentru fiecare parte.</p>
${sign('PARTEA CARE DEZVĂLUIE', 'PARTEA CARE PRIMEȘTE')}`,
  },
  {
    id: 'reziliere',
    name: 'Cerere de reziliere',
    desc: 'Încetarea unui abonament sau contract (internet, telefon, sală, asigurare): ce contract, de când, cu ce preaviz, ce echipamente se returnează și confirmarea în scris',
    html: `
<p>Către: <strong>[Denumirea furnizorului]</strong></p>
<p>[Adresa furnizorului / adresa de e-mail pentru reclamații și rezilieri]</p>
<p style="text-align: right">[Localitatea], [data]</p>
<h1 style="text-align: center">CERERE DE REZILIERE A CONTRACTULUI</h1>
<p>Subsemnatul / Subsemnata <strong>[Nume și prenume]</strong>, cu domiciliul în [localitatea, strada, nr., județul], CNP [cod], telefon [telefon], e-mail [e-mail], titular al contractului nr. <strong>[nr. contract]</strong> din [data contractului], pentru serviciul [internet / telefonie / televiziune / abonament la sală / asigurare / alt serviciu], cod client [cod client],</p>
<p>vă rog să luați act că <strong>doresc încetarea acestui contract</strong> începând cu data de <strong>[data încetării]</strong>, cu respectarea perioadei de preaviz de [30] de zile prevăzute în contract.</p>
<h2>Motivul (opțional)</h2>
<p>[mă mut la altă adresă / nu mai folosesc serviciul / serviciul nu funcționează corespunzător / alt motiv]</p>
<h2>Vă rog</h2>
<ul>
<li><p>să nu mai emiteți facturi după data încetării și să-mi trimiteți factura finală, cu toate sumele calculate până la acea dată;</p></li>
<li><p>să-mi spuneți unde și până când predau echipamentele primite în folosință: [router / decodor / cartelă / card de acces], ca să le pot preda pe bază de proces-verbal;</p></li>
<li><p>să returnați garanția sau sumele plătite în avans pentru perioada de după încetare în contul IBAN [IBAN], deschis la [banca], pe numele [titularul contului];</p></li>
<li><p>să-mi confirmați în scris (pe e-mail sau prin poștă) primirea acestei cereri și data la care contractul încetează.</p></li>
</ul>
<p>Dacă din contract rezultă o perioadă minimă sau penalități pentru încetarea înainte de termen, vă rog să mi le comunicați în scris, cu calculul lor.</p>
<p>Anexez: [copie după contract / ultima factură / copie după actul de identitate, dacă o cere contractul].</p>
<p>&nbsp;</p>
<p>Cu stimă,</p>
<p>[Nume și prenume]</p>
<p>Semnătura: ____________</p>`,
  },
  {
    id: 'plangere-amenda',
    name: 'Plângere împotriva unei amenzi',
    desc: 'Contestația la judecătorie a unui proces-verbal de amendă (circulație, parcare, alte contravenții): în 15 zile de la primire, cu motivele, probele și anexele',
    html: `
<p style="text-align: center"><strong>DOMNULE PREȘEDINTE AL JUDECĂTORIEI [LOCALITATEA]</strong></p>
<p style="text-align: right">[Localitatea], [data]</p>
<h1 style="text-align: center">PLÂNGERE CONTRAVENȚIONALĂ</h1>
<p>Subsemnatul / Subsemnata <strong>[Nume și prenume]</strong>, cu domiciliul în [localitatea, strada, nr., județul], CNP [cod], telefon [telefon], e-mail [e-mail], în calitate de <strong>petent</strong>,</p>
<p>în contradictoriu cu <strong>[instituția agentului: Inspectoratul de Poliție Județean / Poliția Locală / altă instituție]</strong>, cu sediul în [adresa instituției], în calitate de <strong>intimat</strong>,</p>
<p>formulez prezenta <strong>plângere împotriva procesului-verbal de constatare a contravenției seria [seria] nr. [număr] din [data]</strong>, pe care l-am primit la data de [data primirii], prin care mi s-a aplicat [amenda de ... lei / avertisment / puncte de penalizare / suspendarea permisului], solicitându-vă:</p>
<ul>
<li><p>în principal, <strong>anularea procesului-verbal</strong> și exonerarea mea de plata amenzii și de celelalte sancțiuni;</p></li>
<li><p>în subsidiar, înlocuirea amenzii cu <strong>avertisment</strong> sau reducerea ei la minimul prevăzut de lege.</p></li>
</ul>
<h2>Motivele plângerii</h2>
<p><strong>În fapt</strong>, [povestește pe scurt ce s-a întâmplat: locul, ora, ce a reținut agentul și de ce nu e adevărat sau nu e corect].</p>
<p>[Neregulile procesului-verbal, dacă există: lipsește data, locul faptei, numele sau semnătura agentului, descrierea faptei; nu mi s-a citit / nu mi s-a înmânat; martorul lipsește.]</p>
<p>[Dacă fapta există, dar e de mică gravitate: nu am mai fost sancționat, nu s-a produs nicio pagubă, am îndreptat imediat situația.]</p>
<p><strong>În drept</strong>, îmi întemeiez plângerea pe art. 31–36 din Ordonanța Guvernului nr. 2/2001 privind regimul juridic al contravențiilor și pe [actul normativ în baza căruia s-a dat amenda].</p>
<h2>Probe</h2>
<p>Solicit încuviințarea probei cu înscrisuri (cele anexate), proba cu martorul [nume], cu domiciliul în [adresa], [fotografii / înregistrări video], precum și orice altă probă rezultată din dezbateri. Solicit intimatului să depună la dosar [înregistrarea radar / fotografiile / raportul agentului].</p>
<p>Solicit judecarea cauzei și în lipsa mea, potrivit art. 411 alin. (1) pct. 2 din Codul de procedură civilă.</p>
<h2>Anexe</h2>
<ul>
<li><p>copia procesului-verbal seria [seria] nr. [număr] și dovada datei la care l-am primit;</p></li>
<li><p>dovada plății taxei judiciare de timbru de [20] lei;</p></li>
<li><p>copie după actul de identitate și [alte înscrisuri / fotografii];</p></li>
<li><p>câte o copie a plângerii și a anexelor pentru intimat.</p></li>
</ul>
<p><em>De reținut: plângerea se depune în 15 zile de la primirea procesului-verbal, la judecătoria din raza locului unde s-a săvârșit fapta. Este un model orientativ; verificați termenele și taxa la judecătorie.</em></p>
<p>&nbsp;</p>
<p>Cu stimă,</p>
<p>[Nume și prenume]</p>
<p>Semnătura: ____________</p>`,
  },  {
    id: 'constatare-paguba',
    name: 'Proces-verbal de constatare a pagubei',
    desc: 'Când apa de la vecin, o țeavă spartă, un incendiu sau o lucrare ți-au stricat ceva: ce s-a întâmplat, ce s-a stricat, cauza, cine răspunde, cu semnăturile celor de față (bun pentru asigurare)',
    html: `
<p style="text-align: right">[Localitatea], [data]</p>
<h1 style="text-align: center">PROCES-VERBAL DE CONSTATARE A PAGUBEI</h1>
<p>Încheiat astăzi, [data], ora [ora], la adresa [localitatea, strada, nr., bloc, scara, etaj, ap.], de către:</p>
<ul>
<li><p><strong>[Nume și prenume]</strong>, proprietarul / locatarul locuinței în care s-a produs paguba (<strong>păgubitul</strong>), telefon [telefon];</p></li>
<li><p><strong>[Nume și prenume]</strong>, proprietarul / locatarul locuinței de la [etajul / apartamentul] de unde se pare că a pornit paguba (<strong>vecinul</strong>), telefon [telefon];</p></li>
<li><p>[Nume și prenume], [administratorul / președintele asociației de proprietari / un martor / reprezentantul asigurătorului].</p></li>
</ul>
<h2>1. Ce s-a întâmplat</h2>
<p>La data de [data], în jurul orei [ora], [s-a observat apă care curge din tavan / s-a spart o țeavă / a izbucnit un incendiu / altă situație]. [Descrie pe scurt cum a fost descoperită paguba și ce s-a făcut imediat: s-a oprit apa, s-a chemat instalatorul, pompierii.]</p>
<h2>2. Cauza constatată</h2>
<p>[De exemplu: furtunul mașinii de spălat din apartamentul [nr.] s-a desprins / țeava de pe coloana comună s-a fisurat / cauza nu s-a putut stabili încă.]</p>
<h2>3. Ce s-a stricat</h2>
<table><tbody>
<tr><td><p><strong>Încăperea</strong></p></td><td><p><strong>Ce s-a stricat</strong></p></td><td><p><strong>Cât de grav</strong></p></td><td><p><strong>Valoarea estimată</strong></p></td></tr>
<tr><td><p>[Baia]</p></td><td><p>[tavanul și peretele: pete, tencuială căzută]</p></td><td><p>[de reparat / de înlocuit]</p></td><td><p>[0] lei</p></td></tr>
<tr><td><p>[Holul]</p></td><td><p>[parchetul umflat pe aproximativ [0] m²]</p></td><td><p>[de reparat / de înlocuit]</p></td><td><p>[0] lei</p></td></tr>
<tr><td><p>[Camera]</p></td><td><p>[mobilă, aparatură, alte bunuri]</p></td><td><p>[de reparat / de înlocuit]</p></td><td><p>[0] lei</p></td></tr>
</tbody></table>
<p>S-au făcut [număr] fotografii / înregistrări video, care se anexează la acest proces-verbal.</p>
<h2>4. Cine răspunde și ce urmează</h2>
<p>[Vecinul recunoaște / nu recunoaște] că paguba a pornit din locuința sa. Părțile au convenit: [vecinul repară pe cheltuiala sa până la data de ... / paguba se declară la asigurarea locuinței, polița nr. ..., asigurător ... / se cere o expertiză / altă înțelegere].</p>
<p>Paguba trebuie anunțată la asigurător cât mai repede, în termenul scris în poliță. Acest proces-verbal nu înlocuiește constatarea făcută de asigurător sau de un expert.</p>
<p>Procesul-verbal s-a încheiat în [3] exemplare, câte unul pentru fiecare semnatar.</p>
${sign('PĂGUBITUL', 'VECINUL')}
<p style="text-align: center"><strong>MARTOR / ADMINISTRATOR</strong></p>
<p style="text-align: center">[Nume și prenume]</p>
<p style="text-align: center">Semnătura: ____________</p>`,
  },  {
    id: 'retragere',
    name: 'Notificare de retragere (retur online)',
    desc: 'Pentru o comandă online pe care vrei s-o returnezi în 14 zile: produsele, numărul comenzii, cum le trimiți înapoi și unde vrei banii',
    html: `
<p><strong>[Nume și prenume]</strong><br>[Adresa]<br>[telefon] · [e-mail]</p>
<p>Către: <strong>[Firma / magazinul online]</strong><br>[Adresa firmei] · [e-mailul pentru retururi]</p>
<p>[Localitatea], [data]</p>
<h1 style="text-align: center">NOTIFICARE DE RETRAGERE DIN CONTRACT</h1>
<p style="text-align: center">(retur pentru o comandă făcută online sau la distanță)</p>
<p>Subsemnatul(a) <strong>[Nume și prenume]</strong> vă anunț că mă retrag din contractul de vânzare pentru produsele de mai jos, în termenul de 14 zile de la primire, în temeiul Ordonanței de urgență a Guvernului nr. 34/2014 privind drepturile consumatorilor.</p>
<h2>Comanda</h2>
<table><tbody>
<tr><td><p><strong>Produsul</strong></p></td><td><p><strong>Cod / model</strong></p></td><td><p><strong>Cantitatea</strong></p></td><td><p><strong>Prețul</strong></p></td></tr>
<tr><td><p>[denumirea produsului]</p></td><td><p>[cod]</p></td><td><p>[1]</p></td><td><p>[0] lei</p></td></tr>
<tr><td><p>[denumirea produsului]</p></td><td><p>[cod]</p></td><td><p>[1]</p></td><td><p>[0] lei</p></td></tr>
</tbody></table>
<ul>
<li><p>Numărul comenzii: [număr] · Data comenzii: [data]</p></li>
<li><p>Data la care am primit produsele: [data]</p></li>
<li><p>Factura nr.: [număr]</p></li>
</ul>
<h2>Cum trimit produsele înapoi</h2>
<p>[Prin curier, cu ridicare de la adresa de mai sus / le predau la punctul de retur ... / le trimit prin poștă], în cel mult 14 zile de la această notificare.</p>
<h2>Banii înapoi</h2>
<p>Vă rog să-mi restituiți suma plătită, inclusiv costul livrării standard, în cel mult 14 zile de la primirea acestei notificări, [în contul IBAN [IBAN], titular [nume] / pe cardul cu care am plătit].</p>
<p>Nu e nevoie să motivez retragerea. [Opțional: motivul, de exemplu mărimea nu se potrivește.]</p>
<p>Unele produse nu se pot returna (de exemplu cele făcute la comandă, cele care se strică repede sau cele sigilate din motive de igienă, odată desigilate); verificați condițiile magazinului.</p>
<p></p>
<p>Cu stimă,</p>
<p><strong>[Nume și prenume]</strong><br>Semnătura: ____________ (doar dacă o trimiteți pe hârtie)</p>`,
  },
  {
    id: 'garantie-chirie',
    name: 'Cerere de restituire a garanției',
    desc: 'Când te muți din chirie: ceri proprietarului garanția înapoi, cu contractul, data predării cheilor, contorii și contul în care vrei banii',
    html: `
<p><strong>[Nume și prenume]</strong> (chiriaș)<br>[Adresa nouă]<br>[telefon] · [e-mail]</p>
<p>Către: <strong>[Nume și prenume / firma]</strong> (proprietar)<br>[Adresa proprietarului]</p>
<p>[Localitatea], [data]</p>
<h1 style="text-align: center">CERERE DE RESTITUIRE A GARANȚIEI</h1>
<p>Subsemnatul(a) <strong>[Nume și prenume]</strong>, chiriaș în locuința din <strong>[adresa locuinței închiriate]</strong>, conform contractului de închiriere nr. [număr] din [data], vă rog să-mi restituiți garanția de <strong>[suma] lei</strong>, plătită la semnarea contractului.</p>
<h2>Încetarea închirierii</h2>
<ul>
<li><p>Contractul a încetat la data de [data] ([la termen / prin acordul părților / prin denunțare, cu preaviz trimis pe [data]]).</p></li>
<li><p>Am predat locuința și cheile pe [data], conform procesului-verbal de predare-primire semnat de amândoi.</p></li>
<li><p>Chiria este plătită integral până la data de [data].</p></li>
</ul>
<h2>Contorii la predare</h2>
<table><tbody>
<tr><td><p><strong>Utilitatea</strong></p></td><td><p><strong>Indexul la predare</strong></p></td><td><p><strong>Plătit până la</strong></p></td></tr>
<tr><td><p>Energie electrică</p></td><td><p>[index]</p></td><td><p>[data]</p></td></tr>
<tr><td><p>Gaze</p></td><td><p>[index]</p></td><td><p>[data]</p></td></tr>
<tr><td><p>Apă rece / caldă</p></td><td><p>[index]</p></td><td><p>[data]</p></td></tr>
<tr><td><p>Întreținere (asociația de proprietari)</p></td><td><p>–</p></td><td><p>[luna]</p></td></tr>
</tbody></table>
<h2>Starea locuinței</h2>
<p>Locuința a fost predată în starea în care am primit-o, cu uzura normală a folosinței. [Dacă e cazul: lipsurile constatate și suma reținută pentru ele, de comun acord: [descriere], [suma] lei.]</p>
<h2>Banii înapoi</h2>
<p>Vă rog să-mi restituiți suma de <strong>[suma] lei</strong> în cel mult [10] zile de la primirea acestei cereri, [în contul IBAN [IBAN], titular [nume], deschis la [banca] / în numerar, cu chitanță].</p>
<p>Anexez: copia contractului de închiriere, procesul-verbal de predare-primire, [fotografiile locuinței la predare], [ultimele facturi achitate].</p>
<p></p>
<p>Cu stimă,</p>
<p><strong>[Nume și prenume]</strong><br>Semnătura: ____________</p>`,
  },
  {
    id: 'invitatie-nunta',
    name: 'Invitație de nuntă',
    desc: 'Invitația pentru nuntă, de tipărit sau de trimis: mirii, nașii și părinții, cununia religioasă și petrecerea, cu ora și locul, și până când confirmați',
    html: `
<p style="text-align: center"><em>Cu bucurie în suflet, vă invităm să fiți alături de noi în ziua în care ne unim destinele</em></p>
<h1 style="text-align: center">[Nume mireasă] &amp; [Nume mire]</h1>
<p style="text-align: center"><strong>[ziua săptămânii], [data] [anul]</strong></p>
<p style="text-align: center">Împreună cu părinții noștri,<br>[Nume și Nume] și [Nume și Nume],</p>
<p style="text-align: center">și cu nașii noștri,<br><strong>[Nume și Nume]</strong>,</p>
<h2 style="text-align: center">Cununia religioasă</h2>
<p style="text-align: center">la ora [ora], la [Biserica ...], [adresa]</p>
<h2 style="text-align: center">Petrecerea</h2>
<p style="text-align: center">de la ora [ora], la [Restaurantul ...], [adresa]</p>
<p></p>
<p style="text-align: center">Vă rugăm să ne confirmați prezența până la <strong>[data]</strong>,<br>la [telefon] ([Nume]) sau [telefon] ([Nume]).</p>
<p style="text-align: center"><em>[Un rând al vostru, de exemplu: „Două inimi, un singur drum.”]</em></p>`,
  },
  {
    id: 'invitatie-botez',
    name: 'Invitație la botez',
    desc: 'Invitația pentru botezul copilului, de tipărit sau de trimis: numele copilului, părinții și nașii, slujba de la biserică și petrecerea, cu ora și locul, și până când confirmați',
    html: `
<p style="text-align: center"><em>Am venit pe lume de curând și vreau să vă cunosc!</em></p>
<p style="text-align: center">Vă invit cu drag la botezul meu,</p>
<h1 style="text-align: center">[Numele copilului]</h1>
<p style="text-align: center"><strong>[ziua săptămânii], [data] [anul]</strong></p>
<p style="text-align: center">Alături de mine vor fi părinții mei,<br>[Nume mamă] și [Nume tată],</p>
<p style="text-align: center">și nașii mei,<br><strong>[Nume și Nume]</strong>.</p>
<h2 style="text-align: center">Slujba de botez</h2>
<p style="text-align: center">la ora [ora], la [Biserica ...], [adresa]</p>
<h2 style="text-align: center">Petrecerea</h2>
<p style="text-align: center">de la ora [ora], la [Restaurantul ...], [adresa]</p>
<p></p>
<p style="text-align: center">Vă rugăm să confirmați prezența până la <strong>[data]</strong>,<br>la [telefon] ([Nume]) sau [telefon] ([Nume]).</p>
<p style="text-align: center"><em>[Un rând al vostru, de exemplu: „Cel mai frumos dar e să fiți alături de noi.”]</em></p>`,
  },
  {
    id: 'referat-necesitate',
    name: 'Referat de necesitate',
    desc: 'Pentru instituții și firme: ceri aprobarea unei achiziții, cu motivul, lista produselor sau serviciilor și valoarea estimată, termenul, sursa de finanțare și semnăturile',
    html: `
<p><strong>[Denumirea instituției / firmei]</strong><br>[Compartimentul / serviciul]<br>Nr. [număr] / [data]</p>
<p style="text-align: right">Aprobat,<br><strong>[Funcția conducătorului]</strong><br>[Nume și prenume]<br>Semnătura: ____________</p>
<h1 style="text-align: center">REFERAT DE NECESITATE</h1>
<p style="text-align: center">privind [achiziția de produse / servicii / lucrări]: [obiectul pe scurt]</p>
<h2>1. De ce este nevoie</h2>
<p>[Descrieți situația de acum și motivul cererii, de exemplu: echipamentele existente sunt uzate, s-a mărit numărul de angajați, o cerință legală nouă.]</p>
<h2>2. Ce trebuie cumpărat</h2>
<table><tbody>
<tr><td><p><strong>Nr.</strong></p></td><td><p><strong>Denumirea produsului / serviciului</strong></p></td><td><p><strong>U.M.</strong></p></td><td><p><strong>Cantitatea</strong></p></td><td><p><strong>Preț unitar estimat (lei, fără TVA)</strong></p></td><td><p><strong>Valoare estimată (lei, fără TVA)</strong></p></td></tr>
<tr><td><p>1</p></td><td><p>[denumirea și caracteristicile minime]</p></td><td><p>[buc.]</p></td><td><p>[cantitate]</p></td><td><p>[preț]</p></td><td><p>[valoare]</p></td></tr>
<tr><td><p>2</p></td><td><p>[denumirea și caracteristicile minime]</p></td><td><p>[buc.]</p></td><td><p>[cantitate]</p></td><td><p>[preț]</p></td><td><p>[valoare]</p></td></tr>
<tr><td><p></p></td><td><p><strong>TOTAL</strong></p></td><td><p></p></td><td><p></p></td><td><p></p></td><td><p><strong>[total] lei fără TVA</strong></p></td></tr>
</tbody></table>
<h2>3. Valoarea estimată și cum s-a stabilit</h2>
<p>Valoarea totală estimată este de <strong>[suma] lei fără TVA</strong> ([suma] lei cu TVA), stabilită pe baza [ofertelor de preț primite / prețurilor din catalogul electronic / achizițiilor anterioare similare / studiului de piață din [data]].</p>
<h2>4. Termen și loc de livrare</h2>
<p>Produsele / serviciile sunt necesare până la data de <strong>[data]</strong>, la [adresa / locul de livrare sau de prestare].</p>
<h2>5. Sursa de finanțare</h2>
<p>Cheltuiala se suportă din [bugetul propriu / bugetul de stat / bugetul local / fonduri europene, proiectul [cod]], capitolul [capitol], articolul [articol], și este cuprinsă în [planul anual de achiziții / bugetul pe anul [anul]].</p>
<h2>6. Propunere privind modul de achiziție</h2>
<p>Propunem [achiziție directă / procedură simplificată / cumpărare din catalogul electronic], conform prevederilor legale privind achizițiile, [cu [3] oferte de preț solicitate].</p>
<p>Anexez: [specificațiile tehnice / caietul de sarcini], [ofertele de preț], [alte documente].</p>
<p></p>
<table><tbody><tr>
<td><p style="text-align: center"><strong>Întocmit,</strong></p><p style="text-align: center">[Nume și prenume]<br>[Funcția]</p><p style="text-align: center">Semnătura: ____________</p></td>
<td><p style="text-align: center"><strong>Șef compartiment,</strong></p><p style="text-align: center">[Nume și prenume]</p><p style="text-align: center">Semnătura: ____________</p></td>
<td><p style="text-align: center"><strong>Viză financiar-contabil,</strong></p><p style="text-align: center">[Nume și prenume]</p><p style="text-align: center">Semnătura: ____________</p></td>
</tr></tbody></table>`,
  },
  {
    id: 'decizie',
    name: 'Decizie internă',
    desc: 'Pentru firme și instituții: hotărârea scrisă a conducătorului (numirea unei comisii, inventarierea, programul de lucru), cu temeiul, articolele și semnăturile celor care au luat la cunoștință',
    html: `
<p><strong>[Denumirea firmei / instituției]</strong><br>Sediul: [localitatea, strada, nr., județul]<br>CUI [cod], [nr. Registrul Comerțului]</p>
<h1 style="text-align: center">DECIZIA nr. [număr]</h1>
<p style="text-align: center">din [data]</p>
<p style="text-align: center">privind [numirea comisiei de recepție / inventarierea / stabilirea programului de lucru / alt subiect]</p>
<p>Subsemnatul / Subsemnata, [nume și prenume], în calitate de [administrator / director] al [denumirea firmei / instituției],</p>
<p>având în vedere [nevoia / referatul nr. [număr] din [data] / prevederile contractului nr. [număr]],</p>
<p>în temeiul [actului constitutiv / regulamentului intern / prevederilor legale aplicabile],</p>
<p style="text-align: center"><strong>DECID:</strong></p>
<p><strong>Art. 1.</strong> [Ce se hotărăște, de exemplu: Se numește comisia de recepție formată din:]</p>
<ol><li><p>[Nume și prenume], [funcția], președinte</p></li><li><p>[Nume și prenume], [funcția], membru</p></li><li><p>[Nume și prenume], [funcția], membru</p></li></ol>
<p><strong>Art. 2.</strong> [Atribuțiile, termenul sau modul de lucru, de exemplu: Comisia verifică produsele, serviciile și lucrările primite și încheie procesul-verbal de recepție.]</p>
<p><strong>Art. 3.</strong> Prezenta decizie intră în vigoare la data de [data] și se aplică până la [data / revocarea ei].</p>
<p><strong>Art. 4.</strong> [Compartimentul / persoanele] de la art. 1 duc la îndeplinire prezenta decizie, care li se comunică prin grija [compartimentului / persoanei].</p>
<p></p>
<table><tbody><tr>
<td><p style="text-align: center"><strong>[Administrator / Director],</strong></p><p style="text-align: center">[Nume și prenume]</p><p style="text-align: center">Semnătura și ștampila: ____________</p></td>
<td><p style="text-align: center"><strong>Am luat la cunoștință,</strong></p><p style="text-align: center">[Nume și prenume]: ____________<br>[Nume și prenume]: ____________<br>[Nume și prenume]: ____________</p></td>
</tr></tbody></table>`,
  },
  {
    id: 'felicitare',
    name: 'Felicitare de sărbători',
    desc: 'Felicitare de Crăciun și Anul Nou pentru colegi, clienți sau parteneri: urarea, mulțumirile pentru anul care trece, programul de sărbători și semnătura',
    html: `
<p style="text-align: right">[Localitatea], [data]</p>
<h1 style="text-align: center">Sărbători fericite!</h1>
<p style="text-align: center"><em>Crăciun fericit și un An Nou plin de sănătate, bucurii și împliniri!</em></p>
<p>Dragă [numele colegului / clientului / partenerului],</p>
<p>Anul care se încheie ne-a adus [proiecte frumoase / provocări depășite împreună / colaborarea noastră]. Vă mulțumim pentru [încredere / sprijin / munca alături de noi] și pentru tot ce am reușit împreună.</p>
<p>Vă dorim ca sărbătorile de iarnă să le petreceți alături de cei dragi, în liniște și căldură, iar anul [anul care vine] să vă aducă [sănătate, succes și noi realizări].</p>
<h2>Programul nostru de sărbători</h2>
<ul><li><p>[24 decembrie – 2 ianuarie]: [închis / program redus]</p></li><li><p>Pentru urgențe: [telefon / e-mail]</p></li><li><p>Revenim la programul obișnuit din [data].</p></li></ul>
<p>Cu drag,</p>
<p><strong>[Nume și prenume]</strong><br>[Funcția], [Denumirea firmei]</p>`,
  },
  {
    id: 'pv-receptie',
    name: 'Proces-verbal de recepție',
    desc: 'Pentru instituții și firme: comisia primește produsele, serviciile sau lucrările cumpărate, verifică dacă sunt cele comandate și scrie ce s-a primit, ce lipsește și dacă recepția e admisă',
    html: `
<p><strong>[Denumirea instituției / firmei]</strong><br>[Compartimentul / serviciul]<br>Nr. [număr] / [data]</p>
<h1 style="text-align: center">PROCES-VERBAL DE RECEPȚIE</h1>
<p style="text-align: center">privind [produsele / serviciile / lucrările] livrate de [denumirea furnizorului]</p>
<p>Încheiat astăzi, [data], la [locul recepției], de comisia de recepție numită prin [decizia / dispoziția] nr. [număr] din [data], formată din:</p>
<ol><li><p>[Nume și prenume], [funcția], președinte</p></li><li><p>[Nume și prenume], [funcția], membru</p></li><li><p>[Nume și prenume], [funcția], membru</p></li></ol>
<p>în prezența reprezentantului furnizorului, [nume și prenume], [funcția].</p>
<h2>1. Documentele recepției</h2>
<p>Recepția se face pe baza [contractului / comenzii] nr. [număr] din [data], a facturii nr. [număr] din [data] și a avizului de însoțire nr. [număr] din [data].</p>
<h2>2. Ce s-a primit</h2>
<table><tbody>
<tr><td><p><strong>Nr.</strong></p></td><td><p><strong>Denumirea produsului / serviciului</strong></p></td><td><p><strong>U.M.</strong></p></td><td><p><strong>Cantitatea comandată</strong></p></td><td><p><strong>Cantitatea primită</strong></p></td><td><p><strong>Valoare (lei, cu TVA)</strong></p></td><td><p><strong>Observații</strong></p></td></tr>
<tr><td><p>1</p></td><td><p>[denumirea]</p></td><td><p>[buc.]</p></td><td><p>[cantitate]</p></td><td><p>[cantitate]</p></td><td><p>[valoare]</p></td><td><p>[conform / neconform]</p></td></tr>
<tr><td><p>2</p></td><td><p>[denumirea]</p></td><td><p>[buc.]</p></td><td><p>[cantitate]</p></td><td><p>[cantitate]</p></td><td><p>[valoare]</p></td><td><p>[conform / neconform]</p></td></tr>
<tr><td><p></p></td><td><p><strong>TOTAL</strong></p></td><td><p></p></td><td><p></p></td><td><p></p></td><td><p><strong>[total] lei</strong></p></td><td><p></p></td></tr>
</tbody></table>
<h2>3. Constatările comisiei</h2>
<p>Comisia a verificat cantitatea, calitatea, starea ambalajelor, documentele de însoțire (certificate de conformitate, garanție, instrucțiuni) și [punerea în funcțiune / probele de funcționare] și constată că [produsele / serviciile / lucrările] [corespund / nu corespund] cerințelor din [contract / comandă / caietul de sarcini].</p>
<p>Lipsuri sau defecte constatate: [nu este cazul / descrierea lor]. Furnizorul se obligă să le remedieze până la data de [data].</p>
<h2>4. Concluzia</h2>
<p>Recepția se declară <strong>[admisă / admisă cu obiecții / respinsă]</strong>. Bunurile au fost predate gestionarului [nume și prenume] și se înregistrează în evidența [gestiunii / mijloacelor fixe / obiectelor de inventar].</p>
<p>Prezentul proces-verbal a fost încheiat în [2] exemplare, câte unul pentru fiecare parte.</p>
<p></p>
<table><tbody><tr>
<td><p style="text-align: center"><strong>Comisia de recepție,</strong></p><p style="text-align: center">[Nume și prenume], președinte: ____________<br>[Nume și prenume], membru: ____________<br>[Nume și prenume], membru: ____________</p></td>
<td><p style="text-align: center"><strong>Pentru furnizor,</strong></p><p style="text-align: center">[Nume și prenume]<br>[Funcția]</p><p style="text-align: center">Semnătura: ____________</p></td>
<td><p style="text-align: center"><strong>Gestionar,</strong></p><p style="text-align: center">[Nume și prenume]</p><p style="text-align: center">Semnătura: ____________</p></td>
</tr></tbody></table>`,
  },
  {
    id: 'voluntariat',
    name: 'Contract de voluntariat',
    desc: 'Pentru asociații, fundații, școli și instituții care primesc voluntari: activitatea, programul, durata, coordonatorul, drepturile și obligațiile fiecăruia, cheltuielile decontate și încetarea contractului',
    html: `
<h1 style="text-align: center">CONTRACT DE VOLUNTARIAT</h1>
<p style="text-align: center">nr. [număr] din [data]</p>
<h2>1. Părțile</h2>
<p>${party('ORGANIZAȚIA-GAZDĂ')},</p>
<p>și</p>
<p><strong>[Nume și prenume]</strong>, născut(ă) la [data nașterii], cu domiciliul în [localitatea, strada, nr., județul], act de identitate [CI seria, nr.], CNP [cod], telefon [telefon], e-mail [e-mail], denumit(ă) în continuare <strong>VOLUNTARUL</strong>,</p>
<p>au încheiat prezentul contract de voluntariat, în temeiul legii voluntariatului în vigoare.</p>
<h2>2. Obiectul contractului</h2>
<p>Voluntarul desfășoară, din proprie inițiativă și fără să primească bani pentru aceasta, următoarea activitate de interes public: [descrierea activității, de exemplu: sprijin la organizarea evenimentelor / meditații pentru elevi / îngrijirea animalelor din adăpost].</p>
<p>Locul activității: [adresa / online]. Programul: [zilele și orele], în total cel mult [număr] ore pe săptămână.</p>
<h2>3. Durata</h2>
<p>Contractul se încheie pe o perioadă [determinată, de la [data] până la [data] / nedeterminată, începând cu [data]].</p>
<h2>4. Coordonatorul voluntarului</h2>
<p>Activitatea voluntarului este coordonată de [nume și prenume], [funcția], telefon [telefon], e-mail [e-mail], care îi dă sarcinile și îi semnează fișa de prezență.</p>
<h2>5. Drepturile și obligațiile voluntarului</h2>
<ul><li><p>să primească o fișă de voluntariat cu sarcinile lui, instruirea de care are nevoie și echipamentul de protecție, unde e cazul;</p></li><li><p>să fie tratat cu respect și să-și poată spune părerea despre activitate;</p></li><li><p>să primească, la cerere, un certificat de voluntariat cu activitatea, perioada, numărul de ore și competențele dobândite;</p></li><li><p>să-și facă sarcinile la timp și să anunțe din vreme când nu poate veni;</p></li><li><p>să păstreze confidențialitatea datelor și informațiilor la care are acces;</p></li><li><p>să aibă grijă de bunurile organizației primite pentru activitate.</p></li></ul>
<h2>6. Drepturile și obligațiile organizației-gazdă</h2>
<ul><li><p>să-i asigure voluntarului condiții de lucru sigure și instruirea de securitate și sănătate în muncă;</p></li><li><p>să-i ramburseze cheltuielile făcute pentru activitate (transport, masă, materiale), pe bază de documente, până la [suma] lei pe lună: [da / nu];</p></li><li><p>[să-l asigure împotriva accidentelor și bolilor / nu este cazul];</p></li><li><p>să țină evidența orelor de voluntariat și să elibereze certificatul de voluntariat;</p></li><li><p>să nu-i ceară voluntarului activități care nu sunt în fișa lui.</p></li></ul>
<h2>7. Încetarea contractului</h2>
<p>Contractul încetează la sfârșitul perioadei, prin acordul părților sau prin denunțarea lui de oricare dintre părți, cu o notificare scrisă trimisă cu [15] zile înainte. Organizația poate denunța contractul imediat dacă voluntarul nu își respectă obligațiile.</p>
<h2>8. Alte prevederi</h2>
<p>[Clauze suplimentare, de exemplu: drepturile asupra materialelor create, folosirea fotografiilor de la activități.] Neînțelegerile se rezolvă pe cale amiabilă, iar dacă nu e posibil, de instanța competentă.</p>
<p>Prezentul contract a fost încheiat astăzi, [data], în [2] exemplare, câte unul pentru fiecare parte. Fișa de voluntariat face parte din contract.</p>
<p></p>
${sign('ORGANIZAȚIA-GAZDĂ,', 'VOLUNTARUL,')}`,
  },
  {
    id: 'pv-locuinta',
    name: 'Proces-verbal de predare a locuinței',
    desc: 'La începutul sau la sfârșitul unei chirii: starea fiecărei camere, indexurile contoarelor, cheile, mobila și aparatele predate, ce e de reparat și garanția',
    html: `
<h1 style="text-align: center">PROCES-VERBAL DE PREDARE-PRIMIRE A LOCUINȚEI</h1>
<p style="text-align: center">încheiat astăzi, [data], ora [ora], la adresa [adresa locuinței]</p>
<p>Subsemnații:</p>
<ol><li><p><strong>[Nume și prenume]</strong>, CNP [cod], în calitate de <strong>proprietar / locator</strong>,</p></li>
<li><p><strong>[Nume și prenume]</strong>, CNP [cod], în calitate de <strong>chiriaș / locatar</strong>,</p></li></ol>
<p>în baza contractului de închiriere nr. [număr] din [data], am procedat la [predarea locuinței către chiriaș, la începutul chiriei / predarea locuinței înapoi proprietarului, la sfârșitul chiriei].</p>
<h2>1. Starea locuinței, pe camere</h2>
<table><tbody>
<tr><th><p>Camera</p></th><th><p>Pereți, pardoseală, uși, ferestre</p></th><th><p>Observații (zgârieturi, pete, defecte)</p></th></tr>
<tr><td><p>Hol</p></td><td><p>[bună / cu defecte]</p></td><td><p></p></td></tr>
<tr><td><p>Sufragerie</p></td><td><p>[bună / cu defecte]</p></td><td><p></p></td></tr>
<tr><td><p>Dormitor</p></td><td><p>[bună / cu defecte]</p></td><td><p></p></td></tr>
<tr><td><p>Bucătărie</p></td><td><p>[bună / cu defecte]</p></td><td><p></p></td></tr>
<tr><td><p>Baie</p></td><td><p>[bună / cu defecte]</p></td><td><p></p></td></tr>
<tr><td><p>Balcon</p></td><td><p>[bună / cu defecte]</p></td><td><p></p></td></tr>
</tbody></table>
<h2>2. Indexurile contoarelor</h2>
<table><tbody>
<tr><th><p>Contorul</p></th><th><p>Seria contorului</p></th><th><p>Indexul</p></th></tr>
<tr><td><p>Energie electrică</p></td><td><p>[seria]</p></td><td><p>[index] kWh</p></td></tr>
<tr><td><p>Gaze naturale</p></td><td><p>[seria]</p></td><td><p>[index] m³</p></td></tr>
<tr><td><p>Apă rece</p></td><td><p>[seria]</p></td><td><p>[index] m³</p></td></tr>
<tr><td><p>Apă caldă</p></td><td><p>[seria]</p></td><td><p>[index] m³</p></td></tr>
<tr><td><p>Repartitoare de căldură</p></td><td><p>[seria]</p></td><td><p>[index]</p></td></tr>
</tbody></table>
<h2>3. Cheile predate</h2>
<p>Ușa de la intrare: [număr] chei; interfonul / cartela: [număr]; cutia poștală: [număr]; boxa / garajul: [număr]; telecomanda porții: [număr].</p>
<h2>4. Mobila, aparatele și obiectele din locuință</h2>
<table><tbody>
<tr><th><p>Nr.</p></th><th><p>Denumire</p></th><th><p>Bucăți</p></th><th><p>Stare / observații</p></th></tr>
<tr><td><p>1</p></td><td><p>[de exemplu: frigider]</p></td><td><p>[1]</p></td><td><p>[funcționează]</p></td></tr>
<tr><td><p>2</p></td><td><p>[de exemplu: mașină de spălat]</p></td><td><p>[1]</p></td><td><p>[funcționează]</p></td></tr>
<tr><td><p>3</p></td><td><p></p></td><td><p></p></td><td><p></p></td></tr>
<tr><td><p>4</p></td><td><p></p></td><td><p></p></td><td><p></p></td></tr>
<tr><td><p>5</p></td><td><p></p></td><td><p></p></td><td><p></p></td></tr>
</tbody></table>
<h2>5. Ce trebuie reparat sau înlocuit</h2>
<p>[Defectele găsite, cine le repară și până când / nu este cazul.]</p>
<h2>6. Garanția și plățile</h2>
<p>Garanția de [suma] lei, plătită la semnarea contractului, [se păstrează pe durata chiriei / se restituie integral / se restituie mai puțin [suma] lei pentru: [motivul]]. Facturile la utilități sunt plătite până la data de [data]; consumul de după această dată, pe baza indexurilor de mai sus, îl plătește [proprietarul / chiriașul].</p>
<p>Ambele părți declară că au verificat împreună locuința și sunt de acord cu cele scrise mai sus. Se pot atașa fotografii datate ale fiecărei camere și ale contoarelor, care fac parte din prezentul proces-verbal.</p>
<p>Prezentul proces-verbal s-a încheiat în două exemplare, câte unul pentru fiecare parte.</p>
<p></p>
${sign('PROPRIETARUL,', 'CHIRIAȘUL,')}`,
  },
  {
    id: 'sediu-nou',
    name: 'Anunț de schimbare a sediului',
    desc: 'Scrisoare pentru clienți, furnizori și parteneri: de când vă mutați, adresa nouă, ce se schimbă pe facturi și în contracte, ce rămâne la fel și programul din zilele mutării',
    html: `
<p><strong>[Denumirea firmei]</strong><br>CUI [cod] · Nr. Reg. Com. [J../..../....]<br>[Adresa veche] · [telefon] · [e-mail]</p>
<p style="text-align: right">[Localitatea], [data]</p>
<p>Către: <strong>[clienții, furnizorii și partenerii noștri / denumirea firmei destinatare]</strong></p>
<p><strong>Subiect: schimbarea sediului [social / punctului de lucru] al [denumirea firmei]</strong></p>
<p>Stimate partener,</p>
<p>Vă anunțăm că, începând cu data de <strong>[data]</strong>, [sediul social / punctul de lucru / depozitul] al firmei noastre se mută la adresa de mai jos. Schimbarea [a fost înregistrată la Registrul Comerțului prin mențiunea nr. [număr] din [data] / este în curs de înregistrare la Registrul Comerțului].</p>
<h2>Adresa veche și adresa nouă</h2>
<table><tbody>
<tr><th><p></p></th><th><p>Până la [data]</p></th><th><p>Din [data]</p></th></tr>
<tr><td><p>Adresa</p></td><td><p>[strada, numărul, localitatea, județul]</p></td><td><p>[strada, numărul, localitatea, județul]</p></td></tr>
<tr><td><p>Adresa de livrare a mărfii</p></td><td><p>[adresa]</p></td><td><p>[adresa / rampa, poarta]</p></td></tr>
<tr><td><p>Adresa pentru corespondență</p></td><td><p>[adresa]</p></td><td><p>[adresa]</p></td></tr>
<tr><td><p>Programul</p></td><td><p>[luni–vineri, 8–16]</p></td><td><p>[luni–vineri, 8–16]</p></td></tr>
</tbody></table>
<h2>Ce rămâne la fel</h2>
<ul><li><p>Codul fiscal (CUI) și numărul de la Registrul Comerțului</p></li><li><p>Contul bancar: [IBAN], deschis la [banca]</p></li><li><p>Telefoanele și adresele de e-mail: [telefon] · [e-mail]</p></li><li><p>Persoanele de contact și condițiile contractelor în curs</p></li></ul>
<h2>Ce vă rugăm să schimbați</h2>
<ul><li><p>Adresa noastră pe facturile, comenzile și avizele emise după [data]</p></li><li><p>Adresa de livrare a mărfii și a coletelor</p></li><li><p>Adresa din contractele care o cer; vă trimitem, la cerere, actul adițional sau certificatul constatator nou</p></li></ul>
<h2>Zilele mutării</h2>
<p>În perioada [data] – [data] vom lucra cu program redus; [livrările / ridicările de marfă] se fac doar [cu programare / de la adresa veche / de la adresa nouă]. Pentru urgențe ne găsiți la [telefon].</p>
<p>Vă mulțumim pentru înțelegere și vă așteptăm cu drag la noul sediu.</p>
<p>Cu stimă,</p>
<p><strong>[Nume și prenume]</strong><br>[Funcția], [Denumirea firmei]</p>`,
  },
  {
    id: 'fisa-postului',
    name: 'Fișa postului',
    desc: 'Anexa la contractul de muncă: datele postului într-un tabel (cod COR, șeful direct, programul), scopul, atribuțiile, cerințele, relațiile de muncă, limitele de competență și semnăturile',
    html: `
<p><strong>[Denumirea firmei]</strong><br>CUI [cod] · Nr. Reg. Com. [J../..../....]<br>[Adresa] · [telefon] · [e-mail]</p>
<h1 style="text-align: center">FIȘA POSTULUI</h1>
<p style="text-align: center">Anexă la contractul individual de muncă nr. [număr] din [data]</p>
<table><tbody>
<tr><td><p>Numele și prenumele salariatului</p></td><td><p>[nume și prenume]</p></td></tr>
<tr><td><p>Denumirea postului</p></td><td><p>[de exemplu: operator introducere date]</p></td></tr>
<tr><td><p>Cod COR</p></td><td><p>[cod din Clasificarea ocupațiilor din România]</p></td></tr>
<tr><td><p>Departamentul / compartimentul</p></td><td><p>[departamentul]</p></td></tr>
<tr><td><p>Locul de muncă</p></td><td><p>[sediul / punctul de lucru, adresa]</p></td></tr>
<tr><td><p>Este subordonat direct</p></td><td><p>[funcția șefului direct]</p></td></tr>
<tr><td><p>Are în subordine</p></td><td><p>[funcțiile / nu are]</p></td></tr>
<tr><td><p>Îl înlocuiește în concediu pe / este înlocuit de</p></td><td><p>[funcția] / [funcția]</p></td></tr>
<tr><td><p>Programul de lucru</p></td><td><p>[8 ore pe zi, luni–vineri, 8–16]</p></td></tr>
</tbody></table>
<h2>1. Scopul postului</h2>
<p>[Pe scurt, de ce există postul: de exemplu, ține la zi evidența documentelor de livrare și a facturilor emise.]</p>
<h2>2. Atribuții și responsabilități</h2>
<ul><li><p>[atribuția principală, cu ce face, cât de des și pentru cine]</p></li><li><p>[a doua atribuție]</p></li><li><p>[a treia atribuție]</p></li><li><p>Respectă regulamentul intern, normele de securitate și sănătate în muncă și pe cele de apărare împotriva incendiilor</p></li><li><p>Păstrează confidențialitatea datelor firmei și a datelor personale la care are acces</p></li><li><p>Îndeplinește și alte sarcini legate de post, date de șeful direct</p></li></ul>
<h2>3. Cerințele postului</h2>
<ul><li><p>Studii: [medii / superioare, domeniul]</p></li><li><p>Experiență: [ani, în ce domeniu / nu se cere]</p></li><li><p>Cunoștințe: [programe folosite, limbi străine, legislație]</p></li><li><p>Alte cerințe: [permis de conducere categoria …, aviz medical, autorizații]</p></li></ul>
<h2>4. Relații de muncă</h2>
<ul><li><p>Ierarhice: [cu cine raportează și cine îi raportează]</p></li><li><p>De colaborare: [departamentele cu care lucrează]</p></li><li><p>Cu terții: [clienți, furnizori, instituții / nu are]</p></li></ul>
<h2>5. Limite de competență</h2>
<p>[Ce poate decide singur (de exemplu, comenzi până la … lei) și ce aprobă șeful direct.]</p>
<h2>6. Evaluarea activității</h2>
<p>Activitatea se evaluează [anual / semestrial] după criteriile: [calitatea lucrului, respectarea termenelor, cantitatea de lucru, lucrul în echipă].</p>
<p>Fișa postului se poate actualiza când se schimbă atribuțiile, cu acordul ambelor părți.</p>
<p></p>
<table><tbody>
<tr><td><p><strong>ANGAJATORUL,</strong></p><p>[Denumirea firmei]</p><p>prin [nume și prenume], [funcția]</p><p>Semnătura și ștampila</p></td><td><p><strong>SALARIATUL,</strong></p><p>Am primit un exemplar și mă oblig să respect fișa postului.</p><p>[Nume și prenume]</p><p>Semnătura și data</p></td></tr>
</tbody></table>`,
  },
  {
    id: 'incetare-acord',
    name: 'Acord de încetare a contractului de muncă',
    desc: 'Încetarea contractului de muncă prin acordul părților (art. 55 lit. b din Codul muncii): data ultimei zile lucrate, ce se plătește la lichidare, predarea bunurilor firmei și semnăturile',
    html: `
<p><strong>[Denumirea firmei]</strong><br>CUI [cod] · Nr. Reg. Com. [J../..../....]<br>[Adresa] · [telefon] · [e-mail]</p>
<p>Nr. [număr] / [data]</p>
<h1 style="text-align: center">ACORD DE ÎNCETARE A CONTRACTULUI INDIVIDUAL DE MUNCĂ</h1>
<p style="text-align: center">prin acordul părților, în temeiul art. 55 lit. b) din Codul muncii</p>
<h2>1. Părțile</h2>
<p><strong>[Denumirea firmei]</strong>, cu sediul în [adresa], CUI [cod], reprezentată de [nume și prenume], în calitate de [funcția], numită în continuare <strong>angajatorul</strong>,</p>
<p>și</p>
<p><strong>[Nume și prenume]</strong>, domiciliat(ă) în [adresa], CNP [cod numeric personal], angajat(ă) pe postul de [denumirea postului], numit(ă) în continuare <strong>salariatul</strong>,</p>
<p>au convenit următoarele:</p>
<h2>2. Încetarea contractului</h2>
<p>Contractul individual de muncă nr. [număr] din [data], înregistrat în registrul general de evidență a salariaților, încetează prin acordul părților la data de <strong>[data încetării]</strong>. Ultima zi lucrată este [data].</p>
<h2>3. Drepturile salariatului la încetare</h2>
<table><tbody>
<tr><td><p>Salariul pentru zilele lucrate în luna [luna]</p></td><td><p>[suma] lei</p></td></tr>
<tr><td><p>Concediul de odihnă neefectuat ([număr] zile), compensat în bani</p></td><td><p>[suma] lei</p></td></tr>
<tr><td><p>Alte sume (prime, ore suplimentare, compensații convenite)</p></td><td><p>[suma] lei / nu este cazul</p></td></tr>
<tr><td><p>Data plății</p></td><td><p>[cel târziu la data încetării / data]</p></td></tr>
</tbody></table>
<h2>4. Predarea bunurilor și a lucrărilor</h2>
<p>Până la data încetării, salariatul predă [laptopul, telefonul, cheile, cardul de acces, documentele] și lucrările în curs către [funcția / persoana], pe bază de proces-verbal de predare-primire.</p>
<p>Angajatorul eliberează la cerere adeverința de vechime și închide accesul la conturile de lucru la data încetării.</p>
<h2>5. Alte prevederi</h2>
<ul><li><p>Obligația de confidențialitate a salariatului rămâne valabilă și după încetarea contractului, conform [contractului / acordului de confidențialitate].</p></li><li><p>După primirea sumelor de mai sus, părțile declară că nu mai au alte pretenții una față de cealaltă legate de contractul de muncă.</p></li><li><p>Încetarea se înregistrează în registrul general de evidență a salariaților cel târziu în ziua lucrătoare dinaintea datei încetării.</p></li></ul>
<p>Prezentul acord s-a încheiat astăzi, [data], în două exemplare, câte unul pentru fiecare parte.</p>
<p></p>
<table><tbody>
<tr><td><p><strong>ANGAJATORUL,</strong></p><p>[Denumirea firmei]</p><p>prin [nume și prenume], [funcția]</p><p>Semnătura și ștampila</p></td><td><p><strong>SALARIATUL,</strong></p><p>[Nume și prenume]</p><p>Semnătura și data</p></td></tr>
</tbody></table>`,
  },
  {
    id: 'fisa-evaluare',
    name: 'Fișa de evaluare a performanțelor',
    desc: 'Evaluarea anuală a unui salariat: obiectivele cu rezultatul, criteriile cu nota de la 1 la 5, calificativul final, obiectivele pentru anul viitor, cursurile, părerea salariatului și semnăturile',
    html: `
<p><strong>[Denumirea firmei]</strong><br>[Departamentul]</p>
<h1 style="text-align: center">FIȘA DE EVALUARE A PERFORMANȚELOR PROFESIONALE</h1>
<p style="text-align: center">Perioada evaluată: [01.01.anul] – [31.12.anul]</p>
<table><tbody>
<tr><td><p>Numele și prenumele salariatului</p></td><td><p>[nume și prenume]</p></td></tr>
<tr><td><p>Postul / funcția</p></td><td><p>[postul, conform fișei postului]</p></td></tr>
<tr><td><p>Evaluatorul</p></td><td><p>[nume și prenume, funcția]</p></td></tr>
<tr><td><p>Data discuției de evaluare</p></td><td><p>[data]</p></td></tr>
</tbody></table>
<h2>1. Obiectivele perioadei</h2>
<table><tbody>
<tr><td><p><strong>Obiectivul</strong></p></td><td><p><strong>Ce s-a obținut</strong></p></td><td><p><strong>Nota (1–5)</strong></p></td></tr>
<tr><td><p>[obiectivul 1]</p></td><td><p>[rezultatul, cu cifre]</p></td><td><p>[nota]</p></td></tr>
<tr><td><p>[obiectivul 2]</p></td><td><p>[rezultatul]</p></td><td><p>[nota]</p></td></tr>
<tr><td><p>[obiectivul 3]</p></td><td><p>[rezultatul]</p></td><td><p>[nota]</p></td></tr>
</tbody></table>
<h2>2. Criteriile de evaluare</h2>
<p>Nota: 1 = nesatisfăcător, 2 = sub așteptări, 3 = corespunzător, 4 = bine, 5 = foarte bine.</p>
<table><tbody>
<tr><td><p><strong>Criteriul</strong></p></td><td><p><strong>Nota</strong></p></td><td><p><strong>Un exemplu concret</strong></p></td></tr>
<tr><td><p>Cunoștințe și abilități profesionale</p></td><td><p>[nota]</p></td><td><p>[exemplu]</p></td></tr>
<tr><td><p>Calitatea lucrului</p></td><td><p>[nota]</p></td><td><p>[exemplu]</p></td></tr>
<tr><td><p>Respectarea termenelor</p></td><td><p>[nota]</p></td><td><p>[exemplu]</p></td></tr>
<tr><td><p>Lucrul în echipă și comunicarea</p></td><td><p>[nota]</p></td><td><p>[exemplu]</p></td></tr>
<tr><td><p>Inițiativă și disponibilitate de a învăța</p></td><td><p>[nota]</p></td><td><p>[exemplu]</p></td></tr>
<tr><td><p>Respectarea regulamentului intern și a normelor de securitate</p></td><td><p>[nota]</p></td><td><p>[exemplu]</p></td></tr>
</tbody></table>
<h2>3. Calificativul final</h2>
<p>Media notelor: [media] · Calificativul: [foarte bine / bine / satisfăcător / nesatisfăcător]</p>
<h2>4. Obiectivele pentru perioada următoare</h2>
<ul><li><p>[Obiectivul 1: ce, cât, până când]</p></li><li><p>[Obiectivul 2]</p></li><li><p>[Obiectivul 3]</p></li></ul>
<h2>5. Dezvoltare profesională</h2>
<p>Cursuri, instruiri sau responsabilități noi propuse: [de exemplu: curs de …, până în luna …]</p>
<h2>6. Părerea salariatului</h2>
<p>[Ce spune salariatul despre evaluare, ce ajutor îi trebuie, ce își dorește.]</p>
<p></p>
<table><tbody>
<tr><td><p><strong>EVALUATORUL,</strong></p><p>[Nume și prenume], [funcția]</p><p>Semnătura și data</p></td><td><p><strong>SALARIATUL,</strong></p><p>Am luat la cunoștință rezultatul evaluării.</p><p>[Nume și prenume]</p><p>Semnătura și data</p></td></tr>
</tbody></table>`,
  },
  {
    id: 'felicitare-zi',
    name: 'Felicitare de ziua de naștere',
    desc: 'Felicitarea colegilor pentru un coleg sărbătorit: urarea, invitația la tort și un tabel în care fiecare coleg își scrie urarea și semnează',
    html: `
<h1 style="text-align: center">La mulți ani, [numele colegului]!</h1>
<p style="text-align: center"><em>Din partea colegilor de la [Denumirea firmei / departamentul], de ziua ta, [data]</em></p>
<p>Dragă [numele colegului],</p>
<p>Astăzi împlinești [numărul] de ani și ne bucurăm să sărbătorim alături de tine. Îți mulțumim pentru [buna dispoziție / sprijinul de fiecare zi / tot ce am lucrat împreună] și îți dorim un an nou de viață plin de sănătate, bucurii și împliniri, acasă și la serviciu.</p>
<p>Te rugăm să primești din partea noastră [cadoul] și să ne fii alături la [tort / o cafea], azi la ora [ora], în [locul].</p>
<h2>Urările colegilor</h2>
<table><tbody>
<tr><td><p><strong>Colegul</strong></p></td><td><p><strong>Urarea</strong></p></td><td><p><strong>Semnătura</strong></p></td></tr>
<tr><td><p>[Nume și prenume]</p></td><td><p>[urarea]</p></td><td><p></p></td></tr>
<tr><td><p>[Nume și prenume]</p></td><td><p>[urarea]</p></td><td><p></p></td></tr>
<tr><td><p>[Nume și prenume]</p></td><td><p>[urarea]</p></td><td><p></p></td></tr>
<tr><td><p>[Nume și prenume]</p></td><td><p>[urarea]</p></td><td><p></p></td></tr>
<tr><td><p>[Nume și prenume]</p></td><td><p>[urarea]</p></td><td><p></p></td></tr>
<tr><td><p>[Nume și prenume]</p></td><td><p>[urarea]</p></td><td><p></p></td></tr>
</tbody></table>
<p style="text-align: center"><em>Cu drag, colegii tăi</em></p>`,
  },
  {
    id: 'esalonare',
    name: 'Cerere de eșalonare a plății',
    desc: 'Către un furnizor: recunoști suma datorată și propui plata în rate, cu tabelul ratelor, motivul și locul în care furnizorul își dă acordul',
    html: `
<p><strong>[Denumirea firmei tale]</strong><br>[Adresa] · CUI [cod] · [telefon] · [e-mail]</p>
<p>Către: <strong>[Denumirea furnizorului]</strong><br>[Adresa furnizorului] · CUI [cod]</p>
<p>Nr. [nr.] / [data]</p>
<h1 style="text-align: center">CERERE DE EȘALONARE A PLĂȚII</h1>
<p></p>
<p>Stimate partener,</p>
<p>Recunoaștem că avem de achitat către dumneavoastră următoarele facturi, ajunse sau care ajung curând la scadență:</p>
<table><tbody>
<tr><th><p>Factura</p></th><th><p>Data emiterii</p></th><th><p>Scadența</p></th><th><p>Rest de plată</p></th></tr>
<tr><td><p>[seria și nr.]</p></td><td><p>[data]</p></td><td><p>[data]</p></td><td><p>[suma] lei</p></td></tr>
<tr><td><p>[seria și nr.]</p></td><td><p>[data]</p></td><td><p>[data]</p></td><td><p>[suma] lei</p></td></tr>
<tr><td><p><strong>Total datorat</strong></p></td><td><p></p></td><td><p></p></td><td><p><strong>[total] lei</strong></p></td></tr>
</tbody></table>
<p>Din cauza [motivul: întârzierea încasărilor de la clienți / o scădere temporară a vânzărilor / o cheltuială neprevăzută], nu putem achita acum întreaga sumă. Pentru a ne respecta obligația față de dumneavoastră, vă propunem plata eșalonată, astfel:</p>
<table><tbody>
<tr><th><p>Rata</p></th><th><p>Data plății</p></th><th><p>Suma</p></th></tr>
<tr><td><p>1</p></td><td><p>[data]</p></td><td><p>[suma] lei</p></td></tr>
<tr><td><p>2</p></td><td><p>[data]</p></td><td><p>[suma] lei</p></td></tr>
<tr><td><p>3</p></td><td><p>[data]</p></td><td><p>[suma] lei</p></td></tr>
<tr><td><p>4</p></td><td><p>[data]</p></td><td><p>[suma] lei</p></td></tr>
<tr><td><p><strong>Total</strong></p></td><td><p></p></td><td><p><strong>[total] lei</strong></p></td></tr>
</tbody></table>
<p>Plățile se vor face în contul IBAN [IBAN], deschis la [banca], cu mențiunea „[numerele facturilor] – rata [nr.]”. Dacă o rată nu este plătită la data stabilită, suma rămasă devine scadentă integral.</p>
<p>Vă rugăm să ne comunicați acordul dumneavoastră până la data de [data], prin semnarea acestei cereri sau printr-un răspuns la [e-mail]. Vă mulțumim pentru înțelegere și pentru colaborare.</p>
${sign('SOLICITANTUL,', 'DE ACORD, FURNIZORUL,')}`,
  },
  {
    id: 'compensare',
    name: 'Proces-verbal de compensare',
    desc: 'Două firme care își datorează bani una alteia sting datoriile reciproce până la suma cea mai mică: facturile fiecăreia, suma compensată și soldul rămas de plată',
    html: `
<h1 style="text-align: center">PROCES-VERBAL DE COMPENSARE A DATORIILOR RECIPROCE</h1>
<p style="text-align: center">Nr. [nr.] din [data]</p>
<p></p>
<p>Încheiat între:</p>
<p>1. <strong>[Denumirea firmei A]</strong>, cu sediul în [adresa], CUI [cod], Nr. Reg. Com. [J../..../....], cont IBAN [IBAN], reprezentată de [nume și prenume], în calitate de [funcția], numită în continuare <strong>Firma A</strong>,</p>
<p>2. <strong>[Denumirea firmei B]</strong>, cu sediul în [adresa], CUI [cod], Nr. Reg. Com. [J../..../....], cont IBAN [IBAN], reprezentată de [nume și prenume], în calitate de [funcția], numită în continuare <strong>Firma B</strong>.</p>
<p>Părțile constată că, la data de [data], își datorează reciproc următoarele sume, certe, lichide și exigibile:</p>
<h2>1. Facturile emise de Firma A către Firma B (Firma B datorează)</h2>
<table><tbody>
<tr><th><p>Factura</p></th><th><p>Data emiterii</p></th><th><p>Scadența</p></th><th><p>Rest de plată</p></th></tr>
<tr><td><p>[seria și nr.]</p></td><td><p>[data]</p></td><td><p>[data]</p></td><td><p>[suma] lei</p></td></tr>
<tr><td><p>[seria și nr.]</p></td><td><p>[data]</p></td><td><p>[data]</p></td><td><p>[suma] lei</p></td></tr>
<tr><td><p><strong>Total</strong></p></td><td><p></p></td><td><p></p></td><td><p><strong>[total A] lei</strong></p></td></tr>
</tbody></table>
<h2>2. Facturile emise de Firma B către Firma A (Firma A datorează)</h2>
<table><tbody>
<tr><th><p>Factura</p></th><th><p>Data emiterii</p></th><th><p>Scadența</p></th><th><p>Rest de plată</p></th></tr>
<tr><td><p>[seria și nr.]</p></td><td><p>[data]</p></td><td><p>[data]</p></td><td><p>[suma] lei</p></td></tr>
<tr><td><p>[seria și nr.]</p></td><td><p>[data]</p></td><td><p>[data]</p></td><td><p>[suma] lei</p></td></tr>
<tr><td><p><strong>Total</strong></p></td><td><p></p></td><td><p></p></td><td><p><strong>[total B] lei</strong></p></td></tr>
</tbody></table>
<h2>3. Compensarea</h2>
<p>Părțile sunt de acord să compenseze datoriile reciproce până la concurența sumei celei mai mici, adică <strong>[suma compensată] lei</strong> ([suma în litere]). Prin compensare, datoriile ambelor părți se sting până la această sumă, la data semnării prezentului proces-verbal.</p>
<p>După compensare rămâne de plată suma de <strong>[soldul] lei</strong>, datorată de <strong>[Firma A / Firma B]</strong>, care se va achita până la data de [data], în contul de mai sus al celeilalte părți.</p>
<p>Fiecare parte va înregistra compensarea în contabilitatea proprie, pe baza acestui proces-verbal.</p>
<p>Prezentul proces-verbal s-a încheiat în două exemplare, câte unul pentru fiecare parte.</p>
<p></p>
${sign('FIRMA A,', 'FIRMA B,')}`,
  },
  {
    id: 'casare',
    name: 'Proces-verbal de casare',
    desc: 'Scoaterea din folosință a mijloacelor fixe sau a obiectelor de inventar uzate ori stricate: comisia, lista cu valoarea de intrare, amortizarea și valoarea rămasă, motivul, ce se face cu ele și semnăturile',
    html: `
<h1 style="text-align: center">PROCES-VERBAL DE CASARE</h1>
<p style="text-align: center">Nr. [nr.] din [data]</p>
<p></p>
<p><strong>[Denumirea firmei]</strong>, cu sediul în [adresa], CUI [cod], Nr. Reg. Com. [J../..../....].</p>
<p>Comisia de casare, numită prin decizia nr. [nr.] din [data], formată din:</p>
<p>1. [Nume și prenume], [funcția], președinte;</p>
<p>2. [Nume și prenume], [funcția], membru;</p>
<p>3. [Nume și prenume], [funcția], membru,</p>
<p>a analizat, la data de [data], în [locul: sediul / punctul de lucru], starea bunurilor de mai jos și a constatat că acestea nu mai pot fi folosite.</p>
<h2>1. Bunurile propuse pentru casare</h2>
<table><tbody>
<tr><th><p>Nr.</p></th><th><p>Denumirea</p></th><th><p>Nr. inventar</p></th><th><p>Data punerii în funcțiune</p></th><th><p>Valoare de intrare</p></th><th><p>Amortizare cumulată</p></th><th><p>Valoare rămasă</p></th></tr>
<tr><td><p>[nr.]</p></td><td><p>[denumirea]</p></td><td><p>[nr. inventar]</p></td><td><p>[data]</p></td><td><p>[suma] lei</p></td><td><p>[suma] lei</p></td><td><p>[suma] lei</p></td></tr>
<tr><td><p>[nr.]</p></td><td><p>[denumirea]</p></td><td><p>[nr. inventar]</p></td><td><p>[data]</p></td><td><p>[suma] lei</p></td><td><p>[suma] lei</p></td><td><p>[suma] lei</p></td></tr>
<tr><td><p>[nr.]</p></td><td><p>[denumirea]</p></td><td><p>[nr. inventar]</p></td><td><p>[data]</p></td><td><p>[suma] lei</p></td><td><p>[suma] lei</p></td><td><p>[suma] lei</p></td></tr>
<tr><td><p></p></td><td><p><strong>Total</strong></p></td><td><p></p></td><td><p></p></td><td><p><strong>[total] lei</strong></p></td><td><p><strong>[total] lei</strong></p></td><td><p><strong>[total] lei</strong></p></td></tr>
</tbody></table>
<p>Valorile se iau din registrul mijloacelor fixe (Sheets → Șabloane → Registrul mijloacelor fixe), la data casării.</p>
<h2>2. Motivul casării</h2>
<p>[motivul: uzură, defecțiune care nu se mai poate repara, bun depășit sau distrus]. Reparația nu mai merită făcută: [costul estimat al reparației față de prețul unui bun nou], conform constatării tehnice / devizului de reparație nr. [nr.] din [data].</p>
<h2>3. Ce se face cu bunurile casate</h2>
<p>Piesele și materialele care se mai pot folosi se trec în gestiune: [lista pieselor recuperate și valoarea lor estimată, sau „nu este cazul”].</p>
<p>Restul se predă, pe bază de document, unui operator autorizat pentru colectarea deșeurilor: [denumirea operatorului], [nr. autorizației], până la data de [data].</p>
<p>Datele de pe echipamentele de calcul (calculatoare, telefoane, imprimante cu memorie) au fost șterse sau suporturile de date au fost distruse: [da / nu este cazul].</p>
<h2>4. Concluzia comisiei</h2>
<p>Comisia propune casarea bunurilor de mai sus și scoaterea lor din evidența contabilă, cu valoarea rămasă de <strong>[valoarea rămasă totală] lei</strong> ([suma în litere]) trecută pe cheltuieli, conform legii.</p>
<p>Prezentul proces-verbal s-a încheiat în [nr.] exemplare.</p>
<p></p>
<table><tbody><tr>
<td><p style="text-align: center"><strong>[Funcția]</strong></p><p style="text-align: center">[Nume și prenume]</p><p style="text-align: center">Semnătura: ____________</p></td>
<td><p style="text-align: center"><strong>[Funcția]</strong></p><p style="text-align: center">[Nume și prenume]</p><p style="text-align: center">Semnătura: ____________</p></td>
<td><p style="text-align: center"><strong>[Funcția]</strong></p><p style="text-align: center">[Nume și prenume]</p><p style="text-align: center">Semnătura: ____________</p></td>
</tr></tbody></table>
<p></p>
<p><strong>Aprobat,</strong> [Administrator / Director], [Nume și prenume], semnătura: ____________</p>`,
  },
  {
    id: 'inventariere',
    name: 'Proces-verbal de inventariere',
    desc: 'Rezultatul inventarierii unei gestiuni: comisia, ce s-a numărat, valoarea scriptică și faptică, plusurile și lipsurile cu explicațiile gestionarului, propunerile comisiei și semnăturile',
    html: `
<h1 style="text-align: center">PROCES-VERBAL DE INVENTARIERE</h1>
<p style="text-align: center">Nr. [nr.] din [data]</p>
<p></p>
<p><strong>[Denumirea firmei]</strong>, cu sediul în [adresa], CUI [cod], Nr. Reg. Com. [J../..../....].</p>
<p>Comisia de inventariere, numită prin decizia nr. [nr.] din [data], formată din [Nume și prenume] (președinte), [Nume și prenume] și [Nume și prenume] (membri), a inventariat, în perioada [data] – [data], gestiunea <strong>[denumirea gestiunii]</strong>, aflată în răspunderea gestionarului [Nume și prenume].</p>
<h2>1. Ce s-a inventariat</h2>
<p>[mijloacele fixe / mărfurile și materialele / obiectele de inventar / numerarul], prin numărare, cântărire sau măsurare, pe listele de inventariere nr. [nr.] – [nr.], anexate.</p>
<h2>2. Rezultatul</h2>
<table><tbody>
<tr><th><p></p></th><th><p>Valoare</p></th></tr>
<tr><td><p>Valoarea din evidență (scriptică)</p></td><td><p>[suma] lei</p></td></tr>
<tr><td><p>Valoarea găsită la numărare (faptică)</p></td><td><p>[suma] lei</p></td></tr>
<tr><td><p>Plusuri</p></td><td><p>[suma] lei</p></td></tr>
<tr><td><p>Lipsuri</p></td><td><p>[suma] lei</p></td></tr>
</tbody></table>
<p>Valorile se iau din Sheets → Șabloane → Listă de inventariere (căsuța „Pe scurt”).</p>
<h2>3. Diferențele găsite</h2>
<table><tbody>
<tr><th><p>Nr.</p></th><th><p>Denumirea</p></th><th><p>UM</p></th><th><p>Plus / lipsă (cantitate)</p></th><th><p>Valoare</p></th><th><p>Explicația gestionarului</p></th></tr>
<tr><td><p>1</p></td><td><p>[denumirea]</p></td><td><p>[UM]</p></td><td><p>[cantitate]</p></td><td><p>[suma] lei</p></td><td><p>[explicația gestionarului]</p></td></tr>
<tr><td><p>2</p></td><td><p>[denumirea]</p></td><td><p>[UM]</p></td><td><p>[cantitate]</p></td><td><p>[suma] lei</p></td><td><p>[explicația gestionarului]</p></td></tr>
<tr><td><p>3</p></td><td><p>[denumirea]</p></td><td><p>[UM]</p></td><td><p>[cantitate]</p></td><td><p>[suma] lei</p></td><td><p>[explicația gestionarului]</p></td></tr>
</tbody></table>
<p>Gestionarul a dat o declarație scrisă despre diferențe, anexată: [da / nu].</p>
<h2>4. Propunerile comisiei</h2>
<p>Plusurile se înregistrează în evidență ca intrări. Lipsurile, în valoare de [suma] lei, [se impută gestionarului / se trec pe cheltuieli / se compensează cu plusurile] (pe cheltuieli doar în limita perisabilităților legale).</p>
<p>Bunurile uzate sau stricate găsite la inventariere se propun pentru casare (Docs → Proces-verbal de casare): [lista sau „nu este cazul”].</p>
<p>Prezentul proces-verbal s-a încheiat în [nr.] exemplare, astăzi, [data].</p>
<p></p>
<table><tbody><tr>
<td><p style="text-align: center"><strong>[Funcția]</strong></p><p style="text-align: center">[Nume și prenume]</p><p style="text-align: center">Semnătura: ____________</p></td>
<td><p style="text-align: center"><strong>[Funcția]</strong></p><p style="text-align: center">[Nume și prenume]</p><p style="text-align: center">Semnătura: ____________</p></td>
<td><p style="text-align: center"><strong>[Funcția]</strong></p><p style="text-align: center">[Nume și prenume]</p><p style="text-align: center">Semnătura: ____________</p></td>
</tr></tbody></table>
<p></p>
<p><strong>Gestionar,</strong> [Nume și prenume], semnătura: ____________</p>
<p><strong>Aprobat,</strong> [Administrator / Director], [Nume și prenume], semnătura: ____________</p>`,
  },
  {
    id: 'deplasare',
    name: 'Ordin de deplasare (delegație)',
    desc: 'Trimiterea unui angajat în interes de serviciu: unde și de ce merge, perioada și mijlocul de transport, confirmarea la destinație, decontul cheltuielilor (transport, cazare, diurnă, avans) și semnăturile',
    html: `
<h1 style="text-align: center">ORDIN DE DEPLASARE (DELEGAȚIE)</h1>
<p style="text-align: center">Nr. [nr.] din [data]</p>
<p></p>
<p><strong>[Denumirea firmei]</strong>, cu sediul în [adresa], CUI [cod], Nr. Reg. Com. [J../..../....].</p>
<p>Domnul / Doamna <strong>[Nume și prenume]</strong>, având funcția de [funcția], act de identitate [seria și nr.], este delegat(ă) să se deplaseze la <strong>[localitatea, firma / instituția]</strong>, pentru [scopul deplasării: livrare, ridicare de marfă, ședință, instruire, montaj, service].</p>
<h2>1. Perioada și mijlocul de transport</h2>
<table><tbody>
<tr><td><p>Plecare (data și ora)</p></td><td><p>[data], ora [ora]</p></td></tr>
<tr><td><p>Sosire la destinație</p></td><td><p>[data], ora [ora]</p></td></tr>
<tr><td><p>Plecare de la destinație</p></td><td><p>[data], ora [ora]</p></td></tr>
<tr><td><p>Întoarcere (data și ora)</p></td><td><p>[data], ora [ora]</p></td></tr>
<tr><td><p>Mijlocul de transport</p></td><td><p>[autoturismul firmei nr. … / autoturism propriu / tren / autocar / avion]</p></td></tr>
</tbody></table>
<p>Avans primit pentru deplasare: [suma] lei, cu dispoziția de plată nr. [nr.] din [data].</p>
<h2>2. Confirmarea la destinație</h2>
<table><tbody>
<tr><th><p>Localitatea / unitatea vizitată</p></th><th><p>Sosit (data, ora)</p></th><th><p>Plecat (data, ora)</p></th><th><p>Semnătura și ștampila</p></th></tr>
<tr><td><p>[localitatea, unitatea]</p></td><td><p>[data], ora [ora]</p></td><td><p>[data], ora [ora]</p></td><td><p></p></td></tr>
<tr><td><p>[localitatea, unitatea]</p></td><td><p>[data], ora [ora]</p></td><td><p>[data], ora [ora]</p></td><td><p></p></td></tr>
</tbody></table>
<h2>3. Decontul cheltuielilor</h2>
<table><tbody>
<tr><th><p>Felul cheltuielii</p></th><th><p>Documentul (nr., data)</p></th><th><p>Suma</p></th></tr>
<tr><td><p>Transport</p></td><td><p>[bilet / bon de combustibil]</p></td><td><p>[suma] lei</p></td></tr>
<tr><td><p>Cazare</p></td><td><p>[factura nr., data]</p></td><td><p>[suma] lei</p></td></tr>
<tr><td><p>Diurnă: [nr. zile] zile × [suma] lei / zi</p></td><td><p>—</p></td><td><p>[suma] lei</p></td></tr>
<tr><td><p>Alte cheltuieli (taxe de drum, parcare)</p></td><td><p>[documentul]</p></td><td><p>[suma] lei</p></td></tr>
<tr><td><p><strong>Total cheltuieli</strong></p></td><td><p></p></td><td><p><strong>[total] lei</strong></p></td></tr>
<tr><td><p>Avans primit</p></td><td><p></p></td><td><p>[suma] lei</p></td></tr>
<tr><td><p><strong>Diferența de primit / de restituit</strong></p></td><td><p></p></td><td><p><strong>[suma] lei</strong></p></td></tr>
</tbody></table>
<p>Diurna se acordă după regulamentul intern al firmei (de regulă pentru deplasările mai lungi de 12 ore). Plafonul până la care diurna nu se impozitează se schimbă prin lege: verificați-l cu contabilul înainte de decont.</p>
<p>Documentele justificative (bilete, bonuri, facturi de cazare) se anexează la acest ordin, în original. Pentru calculul decontului: Sheets → Șabloane → Decont de deplasare.</p>
<p></p>
<table><tbody><tr>
<td><p style="text-align: center"><strong>Aprobat,</strong></p><p style="text-align: center">[Administrator / Director]</p><p style="text-align: center">[Nume și prenume]</p><p style="text-align: center">Semnătura: ____________</p></td>
<td><p style="text-align: center"><strong>Persoana delegată,</strong></p><p style="text-align: center">[Nume și prenume]</p><p style="text-align: center">Semnătura: ____________</p></td>
<td><p style="text-align: center"><strong>Verificat decont,</strong></p><p style="text-align: center">[Contabil]</p><p style="text-align: center">[Nume și prenume]</p><p style="text-align: center">Semnătura: ____________</p></td>
</tr></tbody></table>`,
  },
  {
    id: 'actaditional',
    name: 'Act adițional la contract',
    desc: 'Schimbarea unui contract în vigoare (prelungirea duratei, alt preț, alt obiect, altă adresă): contractul de bază, clauzele schimbate cu forma veche și cea nouă, de când se aplică, ce rămâne la fel și semnăturile',
    html: `
<h1 style="text-align: center">ACT ADIȚIONAL NR. [nr.]</h1>
<p style="text-align: center">la contractul de [felul contractului] nr. [nr.] din [data]</p>
<p style="text-align: center">încheiat astăzi, [data]</p>
<h2>1. Părțile</h2>
<p>1.1. ${party('[Partea 1, de exemplu Prestatorul]')},</p>
<p>și</p>
<p>1.2. ${party('[Partea 2, de exemplu Beneficiarul]')},</p>
<p>părți ale contractului de mai sus (denumit în continuare <strong>Contractul</strong>), au convenit de comun acord modificarea lui, după cum urmează.</p>
<h2>2. Ce se schimbă</h2>
<table><tbody>
<tr><th><p>Clauza din Contract</p></th><th><p>Forma de până acum</p></th><th><p>Forma nouă</p></th></tr>
<tr><td><p>Art. [nr.]: durata</p></td><td><p>[până la data …]</p></td><td><p>[se prelungește până la data …]</p></td></tr>
<tr><td><p>Art. [nr.]: prețul</p></td><td><p>[suma] lei / [lună / lucrare]</p></td><td><p>[suma nouă] lei / [lună / lucrare]</p></td></tr>
<tr><td><p>Art. [nr.]: [altă clauză]</p></td><td><p>[textul vechi]</p></td><td><p>[textul nou]</p></td></tr>
</tbody></table>
<p>2.1. Motivul modificării: [de exemplu: prelungirea colaborării, actualizarea prețului cu inflația, schimbarea sediului unei părți].</p>
<h2>3. De când se aplică</h2>
<p>3.1. Modificările de mai sus se aplică începând cu data de <strong>[data]</strong>. Pentru perioada de dinainte rămân valabile clauzele vechi.</p>
<h2>4. Ce rămâne la fel</h2>
<p>4.1. Celelalte clauze ale Contractului rămân neschimbate și se aplică în continuare.</p>
<p>4.2. Prezentul act adițional face parte integrantă din Contract. Dacă o clauză de aici e în contradicție cu Contractul, se aplică cea din actul adițional.</p>
<p>4.3. Actul adițional s-a încheiat în [2] exemplare originale, câte unul pentru fiecare parte.</p>
<p>Tip: treceți actul adițional și în Sheets → Șabloane → Evidența contractelor (noua dată de sfârșit și valoarea), ca să vedeți la timp când trebuie reînnoit.</p>
<p></p>
${sign('[PARTEA 1],', '[PARTEA 2],')}`,
  },
  {
    id: 'cerereoferta',
    name: 'Cerere de ofertă',
    desc: 'Pentru furnizori, înainte de o achiziție: ce vreți să cumpărați (produsele sau serviciile, cantitățile, cerințele), condițiile de livrare și de plată, până când și cum se trimite oferta și cine răspunde la întrebări',
    html: `
<p><strong>[Denumirea firmei]</strong><br>CUI [cod] · [adresa sediului]<br>Telefon [telefon] · E-mail [e-mail]</p>
<p>Nr. [nr.] / [data]</p>
<p>Către: <strong>[Denumirea furnizorului]</strong>, [adresa / e-mail]</p>
<h1 style="text-align: center">CERERE DE OFERTĂ</h1>
<p>Stimate partener,</p>
<p>Vă rugăm să ne trimiteți o ofertă de preț pentru produsele / serviciile de mai jos, de care avem nevoie pentru [scopul achiziției, de exemplu: dotarea biroului nou, lucrarea de la …].</p>
<h2>1. Ce dorim să cumpărăm</h2>
<table><tbody>
<tr><th><p>Nr.</p></th><th><p>Produsul / serviciul</p></th><th><p>Cantitatea</p></th><th><p>U.M.</p></th><th><p>Cerințe (marcă, dimensiuni, calitate)</p></th></tr>
<tr><td><p>1</p></td><td><p>[denumirea]</p></td><td><p>[cantitatea]</p></td><td><p>[buc. / kg / oră]</p></td><td><p>[cerințele]</p></td></tr>
<tr><td><p>2</p></td><td><p>[denumirea]</p></td><td><p>[cantitatea]</p></td><td><p>[buc. / kg / oră]</p></td><td><p>[cerințele]</p></td></tr>
<tr><td><p>3</p></td><td><p>[denumirea]</p></td><td><p>[cantitatea]</p></td><td><p>[buc. / kg / oră]</p></td><td><p>[cerințele]</p></td></tr>
<tr><td><p>4</p></td><td><p>[denumirea]</p></td><td><p>[cantitatea]</p></td><td><p>[buc. / kg / oră]</p></td><td><p>[cerințele]</p></td></tr>
</tbody></table>
<h2>2. Condițiile noastre</h2>
<table><tbody>
<tr><td><p><strong>Termenul de livrare</strong></p></td><td><p>[în cel mult … zile de la comandă / până la data …]</p></td></tr>
<tr><td><p><strong>Locul de livrare</strong></p></td><td><p>[adresa], transportul inclus în preț: [da / nu]</p></td></tr>
<tr><td><p><strong>Plata</strong></p></td><td><p>[prin ordin de plată, în … zile de la factură / avans …%]</p></td></tr>
<tr><td><p><strong>Garanția</strong></p></td><td><p>[cel puțin … luni]</p></td></tr>
<tr><td><p><strong>Valabilitatea ofertei</strong></p></td><td><p>[cel puțin … zile]</p></td></tr>
</tbody></table>
<h2>3. Ce trebuie să cuprindă oferta</h2>
<p>3.1. Prețul pe unitate și valoarea totală, fără TVA și cu TVA, în lei.</p>
<p>3.2. Termenul de livrare pe care îl puteți respecta și condițiile de plată propuse.</p>
<p>3.3. Fișele tehnice sau pozele produselor, dacă oferiți alte mărci decât cele cerute.</p>
<h2>4. Până când și cum</h2>
<p>4.1. Vă rugăm să trimiteți oferta până la data de <strong>[data]</strong>, ora [ora], la adresa de e-mail [e-mail] sau la sediul nostru.</p>
<p>4.2. Pentru întrebări: [nume și prenume], [funcția], telefon [telefon].</p>
<p>4.3. Cererea nu ne obligă să cumpărăm; vă vom anunța în [… zile] dacă oferta dumneavoastră a fost aleasă.</p>
<p>Tip: când primiți ofertele, puneți-le alături în Sheets, ca să alegeți ușor prețul și termenul cel mai bun; pentru oferta voastră către clienți folosiți șablonul Ofertă de preț.</p>
<p></p>
<p>Cu stimă,</p>
<p><strong>[Nume și prenume]</strong><br>[Funcția]<br>Semnătura: ____________</p>`,
  },
  {
    id: 'comandafurnizor',
    name: 'Comandă către furnizor',
    desc: 'După ce ați ales oferta: ce comandați (cantități, prețuri, valoarea fără și cu TVA), după oferta nr. din data, termenul și locul de livrare, plata, penalitățile pentru întârziere, documentele cerute la livrare și confirmarea furnizorului',
    html: `
<p><strong>[Denumirea firmei]</strong><br>CUI [cod] · [adresa sediului]<br>Telefon [telefon] · E-mail [e-mail]</p>
<p>Către: <strong>[Denumirea furnizorului]</strong>, CUI [cod], [adresa / e-mail]</p>
<h1 style="text-align: center">COMANDĂ NR. [nr.] / [data]</h1>
<p style="text-align: center">după oferta dumneavoastră nr. [nr.] din [data]</p>
<p>Vă rugăm să ne livrați produsele / serviciile de mai jos, la prețurile și în condițiile din oferta dumneavoastră.</p>
<h2>1. Ce comandăm</h2>
<table><tbody>
<tr><th><p>Nr.</p></th><th><p>Produsul / serviciul</p></th><th><p>Cantitatea</p></th><th><p>U.M.</p></th><th><p>Preț unitar (fără TVA)</p></th><th><p>Valoare (fără TVA)</p></th></tr>
<tr><td><p>1</p></td><td><p>[denumirea]</p></td><td><p>[cantitatea]</p></td><td><p>[buc.]</p></td><td><p>[preț] lei</p></td><td><p>[valoare] lei</p></td></tr>
<tr><td><p>2</p></td><td><p>[denumirea]</p></td><td><p>[cantitatea]</p></td><td><p>[buc.]</p></td><td><p>[preț] lei</p></td><td><p>[valoare] lei</p></td></tr>
<tr><td><p>3</p></td><td><p>[denumirea]</p></td><td><p>[cantitatea]</p></td><td><p>[buc.]</p></td><td><p>[preț] lei</p></td><td><p>[valoare] lei</p></td></tr>
<tr><td><p></p></td><td><p><strong>Total fără TVA</strong></p></td><td><p></p></td><td><p></p></td><td><p></p></td><td><p><strong>[total] lei</strong></p></td></tr>
<tr><td><p></p></td><td><p><strong>TVA [21]%</strong></p></td><td><p></p></td><td><p></p></td><td><p></p></td><td><p>[TVA] lei</p></td></tr>
<tr><td><p></p></td><td><p><strong>Total de plată</strong></p></td><td><p></p></td><td><p></p></td><td><p></p></td><td><p><strong>[total cu TVA] lei</strong></p></td></tr>
</tbody></table>
<h2>2. Livrarea și plata</h2>
<table><tbody>
<tr><td><p><strong>Termenul de livrare</strong></p></td><td><p>[cel târziu la data …]</p></td></tr>
<tr><td><p><strong>Locul de livrare</strong></p></td><td><p>[adresa], persoana de contact [nume], telefon [telefon]</p></td></tr>
<tr><td><p><strong>Plata</strong></p></td><td><p>[prin ordin de plată, în … zile de la primirea facturii]</p></td></tr>
<tr><td><p><strong>Garanția</strong></p></td><td><p>[… luni de la livrare]</p></td></tr>
</tbody></table>
<h2>3. Condiții</h2>
<p>3.1. Pentru fiecare zi de întârziere a livrării, furnizorul datorează penalități de [0,1]% din valoarea produselor nelivrate.</p>
<p>3.2. La livrare, marfa va fi însoțită de factură sau aviz de însoțire, certificatul de garanție și, unde e cazul, declarația de conformitate.</p>
<p>3.3. Recepția se face la locul de livrare; lipsurile și defectele se trec într-un proces-verbal semnat de ambele părți.</p>
<p>3.4. Vă rugăm să ne confirmați comanda în scris, în cel mult [2] zile lucrătoare.</p>
<p>Tip: comanda urmează după Docs → Cerere de ofertă și Sheets → Compararea ofertelor; la primirea mărfii folosiți Docs → Proces-verbal de recepție.</p>
<p></p>
${sign('CUMPĂRĂTOR,', 'FURNIZOR (confirmare, data),')}`,
  },
  {
    id: 'neconformitate',
    name: 'Notificare de neconformitate la livrare',
    desc: 'Când marfa primită nu e cea din factură: produsele cu lipsuri, plusuri sau defecte (cantitatea facturată, cea primită, diferența și ce s-a constatat), ce cereți furnizorului (completarea livrării, înlocuirea, factura de corecție), termenul de răspuns și documentele anexate',
    html: `
<p><strong>[Denumirea firmei]</strong><br>CUI [cod] · [adresa sediului]<br>Telefon [telefon] · E-mail [e-mail]</p>
<p>Nr. [nr.] / [data]</p>
<p>Către: <strong>[Denumirea furnizorului]</strong>, CUI [cod], [adresa / e-mail]</p>
<h1 style="text-align: center">NOTIFICARE DE NECONFORMITATE LA LIVRARE</h1>
<p>Vă aducem la cunoștință că, la recepția mărfii livrate pe [data], cu factura / avizul nr. [nr.] din [data], după comanda noastră nr. [nr.] din [data], am constatat următoarele diferențe, trecute în procesul-verbal de recepție nr. [nr.] din [data]:</p>
<h2>1. Ce am constatat</h2>
<table><tbody>
<tr><th><p>Nr.</p></th><th><p>Produsul</p></th><th><p>Cantitatea facturată</p></th><th><p>Cantitatea primită</p></th><th><p>Diferența</p></th><th><p>Ce s-a constatat</p></th></tr>
<tr><td><p>1</p></td><td><p>[denumirea]</p></td><td><p>[cantitatea]</p></td><td><p>[cantitatea]</p></td><td><p>[– …]</p></td><td><p>[lipsă / în plus / deteriorat / alt produs decât cel comandat]</p></td></tr>
<tr><td><p>2</p></td><td><p>[denumirea]</p></td><td><p>[cantitatea]</p></td><td><p>[cantitatea]</p></td><td><p>[– …]</p></td><td><p>[lipsă / în plus / deteriorat / alt produs decât cel comandat]</p></td></tr>
<tr><td><p>3</p></td><td><p>[denumirea]</p></td><td><p>[cantitatea]</p></td><td><p>[cantitatea]</p></td><td><p>[– …]</p></td><td><p>[lipsă / în plus / deteriorat / alt produs decât cel comandat]</p></td></tr>
<tr><td><p></p></td><td><p><strong>Valoarea diferențelor (cu TVA)</strong></p></td><td><p></p></td><td><p></p></td><td><p></p></td><td><p><strong>[valoare] lei</strong></p></td></tr>
</tbody></table>
<h2>2. Ce vă cerem</h2>
<p>☐ să completați livrarea cu produsele lipsă, cel târziu la data de [data];</p>
<p>☐ să înlocuiți produsele deteriorate sau neconforme, pe cheltuiala dumneavoastră;</p>
<p>☐ să emiteți factura de corecție (storno) pentru diferența de [valoare] lei;</p>
<p>☐ să ridicați produsele livrate în plus sau să ne trimiteți factura pentru ele, dacă le păstrăm.</p>
<p>Până la rezolvare, plata facturii se face doar pentru produsele recepționate fără obiecții, adică [valoare] lei.</p>
<h2>3. Termenul de răspuns</h2>
<p>Vă rugăm să ne răspundeți în scris în cel mult [5] zile lucrătoare de la primirea acestei notificări. Produsele neconforme rămân la dispoziția dumneavoastră, la [adresa], până la data de [data].</p>
<h2>4. Anexe</h2>
<p>– copia procesului-verbal de recepție nr. [nr.] din [data];<br>– copia facturii / avizului de însoțire nr. [nr.];<br>– fotografiile produselor deteriorate și ale ambalajelor ([număr] fotografii).</p>
<p>Tip: diferențele le calculați în Sheets → Notă de recepție, iar procesul-verbal îl faceți din Docs → Proces-verbal de recepție.</p>
<p></p>
${sign('CUMPĂRĂTOR,', 'Am primit (furnizorul, data),')}`,
  },
  {
    id: 'eliminare-arhiva',
    name: 'Proces-verbal de eliminare din arhivă',
    desc: 'Dosarele din arhiva firmei al căror termen de păstrare a trecut: comisia, lista dosarelor (conținutul, anii, termenul, filele), verificarea că nu mai sunt cerute de un control sau un litigiu, cum se distrug sau cui se predau și semnăturile',
    html: `
<h1 style="text-align: center">PROCES-VERBAL DE ELIMINARE A DOCUMENTELOR DIN ARHIVĂ</h1>
<p style="text-align: center">Nr. [nr.] din [data]</p>
<p></p>
<p><strong>[Denumirea firmei]</strong>, cu sediul în [adresa], CUI [cod], Nr. Reg. Com. [J../..../....].</p>
<p>Comisia de selecționare a documentelor, numită prin decizia nr. [nr.] din [data], formată din:</p>
<p>1. [Nume și prenume], [funcția], președinte;</p>
<p>2. [Nume și prenume], [funcția], membru;</p>
<p>3. [Nume și prenume], [funcția], secretar (persoana care răspunde de arhivă),</p>
<p>a verificat, la data de [data], dosarele din arhiva firmei, după nomenclatorul arhivistic și evidența arhivei, și a constatat că dosarele de mai jos au termenul de păstrare împlinit.</p>
<h2>1. Dosarele propuse pentru eliminare</h2>
<table><tbody>
<tr><th><p>Nr.</p></th><th><p>Nr. dosar</p></th><th><p>Conținutul dosarului</p></th><th><p>Anii</p></th><th><p>Termen de păstrare (ani)</p></th><th><p>Nr. file</p></th><th><p>Poziția în nomenclator</p></th></tr>
<tr><td><p>1</p></td><td><p>[nr. dosar]</p></td><td><p>[ce conține]</p></td><td><p>[anul / anii]</p></td><td><p>[ani]</p></td><td><p>[nr. file]</p></td><td><p>[nr. din nomenclator]</p></td></tr>
<tr><td><p>2</p></td><td><p>[nr. dosar]</p></td><td><p>[ce conține]</p></td><td><p>[anul / anii]</p></td><td><p>[ani]</p></td><td><p>[nr. file]</p></td><td><p>[nr. din nomenclator]</p></td></tr>
<tr><td><p>3</p></td><td><p>[nr. dosar]</p></td><td><p>[ce conține]</p></td><td><p>[anul / anii]</p></td><td><p>[ani]</p></td><td><p>[nr. file]</p></td><td><p>[nr. din nomenclator]</p></td></tr>
<tr><td><p>4</p></td><td><p>[nr. dosar]</p></td><td><p>[ce conține]</p></td><td><p>[anul / anii]</p></td><td><p>[ani]</p></td><td><p>[nr. file]</p></td><td><p>[nr. din nomenclator]</p></td></tr>
<tr><td><p></p></td><td><p><strong>Total</strong></p></td><td><p><strong>[nr.] dosare</strong></p></td><td><p></p></td><td><p></p></td><td><p><strong>[nr.] file</strong></p></td><td><p></p></td></tr>
</tbody></table>
<p>Lista se ia din Sheets → Șabloane → Evidența arhivei: dosarele cu starea „De eliminat” (în roșu).</p>
<h2>2. Verificări făcute înainte de eliminare</h2>
<p>☐ termenul de păstrare al fiecărui dosar a trecut, socotit de la sfârșitul anului în care s-a încheiat dosarul;</p>
<p>☐ dosarele nu sunt cerute într-un control fiscal sau al altei autorități, care e în curs sau anunțat;</p>
<p>☐ dosarele nu privesc un litigiu, o executare sau o reclamație încă nerezolvată;</p>
<p>☐ dosarele nu conțin documente care se păstrează permanent (de exemplu statele de plată, registrul jurnal, registrul inventar, actele firmei);</p>
<p>☐ s-a cerut, unde legea o cere, acordul arhivelor statului: [nr. și data confirmării / nu este cazul].</p>
<h2>3. Cum se elimină</h2>
<p>Dosarele de mai sus, în total [nr.] file (aproximativ [greutatea] kg), se elimină prin [tocare la sediu / predare spre distrugere / predare spre reciclare] la data de [data].</p>
<p>Unde se predau: [denumirea operatorului autorizat], CUI [cod], cu documentul de predare nr. [nr.] din [data]. Documentele cu date personale se distrug astfel încât să nu mai poată fi citite.</p>
<p>Copiile digitale ale acestor dosare (din calculator, server sau copii de siguranță) se șterg la aceeași dată: [da / nu este cazul].</p>
<h2>4. Concluzia comisiei</h2>
<p>Comisia propune eliminarea dosarelor de mai sus din arhivă. După eliminare, în evidența arhivei fiecare dosar se marchează „Eliminat” (coloana Eliminat = „Da”), cu numărul acestui proces-verbal.</p>
<p>Prezentul proces-verbal s-a încheiat în [nr.] exemplare și se păstrează permanent.</p>
<p></p>
<table><tbody><tr>
<td><p style="text-align: center"><strong>Președinte</strong></p><p style="text-align: center">[Nume și prenume]</p><p style="text-align: center">Semnătura: ____________</p></td>
<td><p style="text-align: center"><strong>Membru</strong></p><p style="text-align: center">[Nume și prenume]</p><p style="text-align: center">Semnătura: ____________</p></td>
<td><p style="text-align: center"><strong>Secretar</strong></p><p style="text-align: center">[Nume și prenume]</p><p style="text-align: center">Semnătura: ____________</p></td>
</tr></tbody></table>
<p></p>
<p><strong>Aprobat,</strong> [Administrator / Director], [Nume și prenume], semnătura: ____________</p>`,
  },
  {
    id: 'nota-gestionar',
    name: 'Notă explicativă a gestionarului',
    desc: 'După inventariere, gestionarul explică în scris plusurile și lipsurile găsite: produsele cu diferențe (scriptic, faptic, valoarea), cauza fiecăreia, documentele care o dovedesc, dacă recunoaște lipsurile și cum le acoperă, data și semnătura',
    html: `
<p><strong>[Denumirea firmei]</strong><br>CUI [cod] · [adresa sediului]</p>
<p>Către: Comisia de inventariere numită prin decizia nr. [nr.] din [data]</p>
<h1 style="text-align: center">NOTĂ EXPLICATIVĂ</h1>
<p style="text-align: center">privind diferențele constatate la inventarierea din [data]</p>
<p>Subsemnatul / Subsemnata <strong>[Nume și prenume]</strong>, [funcția], gestionar al [gestiunea: magazie / depozit / magazin / casierie] din [locul], cu contractul de muncă nr. [nr.] din [data], vă prezint mai jos explicațiile pentru diferențele găsite de comisie între stocul din evidență și cel numărat.</p>
<h2>1. Diferențele constatate</h2>
<table><tbody>
<tr><th><p>Nr.</p></th><th><p>Produsul</p></th><th><p>Cantitatea scriptică</p></th><th><p>Cantitatea faptică</p></th><th><p>Diferența</p></th><th><p>Valoarea</p></th><th><p>Explicația</p></th></tr>
<tr><td><p>1</p></td><td><p>[denumirea]</p></td><td><p>[cantitatea]</p></td><td><p>[cantitatea]</p></td><td><p>[+ / – …]</p></td><td><p>[suma] lei</p></td><td><p>[de unde vine diferența]</p></td></tr>
<tr><td><p>2</p></td><td><p>[denumirea]</p></td><td><p>[cantitatea]</p></td><td><p>[cantitatea]</p></td><td><p>[+ / – …]</p></td><td><p>[suma] lei</p></td><td><p>[de unde vine diferența]</p></td></tr>
<tr><td><p>3</p></td><td><p>[denumirea]</p></td><td><p>[cantitatea]</p></td><td><p>[cantitatea]</p></td><td><p>[+ / – …]</p></td><td><p>[suma] lei</p></td><td><p>[de unde vine diferența]</p></td></tr>
<tr><td><p></p></td><td><p><strong>Total plusuri / lipsuri</strong></p></td><td><p></p></td><td><p></p></td><td><p></p></td><td><p><strong>[+ suma] / [– suma] lei</strong></p></td><td><p></p></td></tr>
</tbody></table>
<p>Cifrele sunt cele din lista de inventariere (Sheets → Listă de inventariere) și din procesul-verbal de inventariere nr. [nr.] din [data].</p>
<h2>2. Cauzele diferențelor</h2>
<p>☐ documente de intrare sau de ieșire care nu au fost înregistrate la timp: [numărul și data documentelor];</p>
<p>☐ produse asemănătoare încurcate între ele (sortimente, mărimi, coduri): [care produse];</p>
<p>☐ greșeli de unitate de măsură sau de ambalaj (bucată / cutie / kilogram): [unde];</p>
<p>☐ perisabilități, deteriorări sau produse expirate: [care, cât, constatate de cine];</p>
<p>☐ altă cauză: [descrierea].</p>
<h2>3. Ce recunosc și cum acopăr lipsurile</h2>
<p>☐ Recunosc lipsurile în valoare de [suma] lei ([suma în litere]) și sunt de acord să fie acoperite [prin plata la casierie / prin reținere din salariu, în [nr.] rate lunare], conform legii.</p>
<p>☐ Nu recunosc lipsurile în valoare de [suma] lei, pentru că [motivul], și cer verificarea [documentelor / gestiunii] de către [comisie / contabilitate].</p>
<h2>4. Documente anexate</h2>
<p>– [copiile documentelor de intrare / ieșire neînregistrate];<br>– [procesele-verbale de constatare a deteriorărilor];<br>– [alte acte care susțin explicațiile].</p>
<p>Declar că cele de mai sus sunt adevărate.</p>
<p></p>
<table><tbody><tr>
<td><p style="text-align: center"><strong>Gestionar,</strong></p><p style="text-align: center">[Nume și prenume]</p><p style="text-align: center">Data: [data] · Semnătura: ____________</p></td>
<td><p style="text-align: center"><strong>Primit, pentru comisie,</strong></p><p style="text-align: center">[Nume și prenume, președintele comisiei]</p><p style="text-align: center">Data: [data] · Semnătura: ____________</p></td>
</tr></tbody></table>`,
  },
  {
    id: 'confirmare-sold',
    name: 'Confirmare de sold',
    desc: 'Scrisoare către un client sau un furnizor la închiderea anului (sau oricând): soldul din evidența firmei la o dată, cu facturile neachitate în tabel; partenerul bifează dacă e de acord sau scrie diferențele și o trimite înapoi semnată',
    html: `
<p><strong>[Denumirea firmei]</strong><br>CUI [cod] · Nr. Reg. Com. [J../..../....] · [adresa sediului]<br>Telefon [telefon] · E-mail [e-mail]</p>
<p>Nr. [nr.] / [data]</p>
<p>Către: <strong>[Denumirea partenerului]</strong>, CUI [cod], [adresa]<br>În atenția: [persoana de contact / departamentul financiar]</p>
<h1 style="text-align: center">CONFIRMARE DE SOLD</h1>
<p style="text-align: center">la data de [data]</p>
<p>Stimate partener,</p>
<p>În vederea [închiderii exercițiului financiar / inventarierii anuale / verificării reciproce a decontărilor], vă rugăm să confirmați soldul de mai jos, așa cum rezultă din evidența noastră contabilă la data de [data].</p>
<h2>1. Soldul din evidența noastră</h2>
<p>Din evidența noastră, la data de [data], <strong>[Denumirea partenerului]</strong> are față de noi un sold <strong>[debitor (ne datorați) / creditor (vă datorăm)]</strong> de <strong>[suma] lei</strong> ([suma în litere]), compus din documentele de mai jos.</p>
<table><tbody>
<tr><th><p>Nr.</p></th><th><p>Documentul (factură, avans, notă)</p></th><th><p>Data</p></th><th><p>Scadența</p></th><th><p>Valoarea</p></th><th><p>Achitat</p></th><th><p>Rest</p></th></tr>
<tr><td><p>1</p></td><td><p>[seria și nr.]</p></td><td><p>[data]</p></td><td><p>[data]</p></td><td><p>[suma] lei</p></td><td><p>[suma] lei</p></td><td><p>[suma] lei</p></td></tr>
<tr><td><p>2</p></td><td><p>[seria și nr.]</p></td><td><p>[data]</p></td><td><p>[data]</p></td><td><p>[suma] lei</p></td><td><p>[suma] lei</p></td><td><p>[suma] lei</p></td></tr>
<tr><td><p>3</p></td><td><p>[seria și nr.]</p></td><td><p>[data]</p></td><td><p>[data]</p></td><td><p>[suma] lei</p></td><td><p>[suma] lei</p></td><td><p>[suma] lei</p></td></tr>
<tr><td><p></p></td><td><p><strong>Sold total</strong></p></td><td><p></p></td><td><p></p></td><td><p></p></td><td><p></p></td><td><p><strong>[suma] lei</strong></p></td></tr>
</tbody></table>
<p>Lista facturilor neîncasate se ia din Sheets → Șabloane → Vechimea creanțelor (la clienți) sau Facturi de la furnizori (la furnizori).</p>
<h2>2. Răspunsul dumneavoastră</h2>
<p>Vă rugăm să bifați una dintre variante, să semnați și să ne trimiteți confirmarea în [nr.] zile de la primire, la adresa de e-mail [e-mail] sau la sediul nostru.</p>
<p>☐ <strong>Suntem de acord</strong> cu soldul de [suma] lei la data de [data].</p>
<p>☐ <strong>Nu suntem de acord.</strong> În evidența noastră soldul este de [suma] lei. Diferența de [suma] lei provine din:</p>
<table><tbody>
<tr><th><p>Documentul</p></th><th><p>Data</p></th><th><p>Suma</p></th><th><p>Explicația (neînregistrat la noi / la dumneavoastră, plată în tranzit, altă cauză)</p></th></tr>
<tr><td><p>[seria și nr.]</p></td><td><p>[data]</p></td><td><p>[suma] lei</p></td><td><p>[explicația]</p></td></tr>
<tr><td><p>[seria și nr.]</p></td><td><p>[data]</p></td><td><p>[suma] lei</p></td><td><p>[explicația]</p></td></tr>
</tbody></table>
<p>Dacă nu primim răspuns până la data de [data], vom considera soldul de mai sus acceptat. Această confirmare nu înlocuiește plata facturilor scadente.</p>
<p></p>
<table><tbody><tr>
<td><p style="text-align: center"><strong>Pentru [Denumirea firmei],</strong></p><p style="text-align: center">[Nume și prenume, funcția]</p><p style="text-align: center">Semnătura și ștampila: ____________</p></td>
<td><p style="text-align: center"><strong>Confirmat, pentru [Denumirea partenerului],</strong></p><p style="text-align: center">[Nume și prenume, funcția]</p><p style="text-align: center">Data: [data] · Semnătura și ștampila: ____________</p></td>
</tr></tbody></table>`,
  },
  {
    id: 'raport-agent',
    name: 'Raportul lunar al agentului de vânzări',
    desc: 'Raportul pe care agentul îl dă la sfârșitul lunii: vânzările față de țintă, vizitele și ofertele, clienții noi și cei pierduți, facturile restante ale clienților lui, ce n-a mers și ce face luna viitoare',
    html: `
<p><strong>[Denumirea firmei]</strong> · Departamentul vânzări</p>
<h1 style="text-align: center">RAPORT LUNAR DE ACTIVITATE</h1>
<p style="text-align: center">al agentului de vânzări · luna [luna] [anul]</p>
<p>Agentul: <strong>[Nume și prenume]</strong> · Zona / canalul: [zona, județele sau tipul de clienți] · Șeful direct: [nume]</p>
<h2>1. Vânzările lunii</h2>
<table><tbody>
<tr><th><p>Indicatorul</p></th><th><p>Ținta</p></th><th><p>Realizat</p></th><th><p>Realizarea</p></th></tr>
<tr><td><p>Vânzări fără TVA</p></td><td><p>[suma] lei</p></td><td><p>[suma] lei</p></td><td><p>[…%]</p></td></tr>
<tr><td><p>Încasări de la clienții mei</p></td><td><p>[suma] lei</p></td><td><p>[suma] lei</p></td><td><p>[…%]</p></td></tr>
<tr><td><p>Clienți noi</p></td><td><p>[nr.]</p></td><td><p>[nr.]</p></td><td><p>[…%]</p></td></tr>
<tr><td><p>Vizite / întâlniri</p></td><td><p>[nr.]</p></td><td><p>[nr.]</p></td><td><p>[…%]</p></td></tr>
</tbody></table>
<p>Cifrele de vânzări și comisionul se iau din Sheets → Șabloane → Comisioanele agenților.</p>
<h2>2. Ofertele trimise</h2>
<table><tbody>
<tr><th><p>Clientul</p></th><th><p>Valoarea ofertei</p></th><th><p>Data</p></th><th><p>Starea (acceptată / în discuție / refuzată și de ce)</p></th></tr>
<tr><td><p>[clientul]</p></td><td><p>[suma] lei</p></td><td><p>[data]</p></td><td><p>[starea]</p></td></tr>
<tr><td><p>[clientul]</p></td><td><p>[suma] lei</p></td><td><p>[data]</p></td><td><p>[starea]</p></td></tr>
<tr><td><p>[clientul]</p></td><td><p>[suma] lei</p></td><td><p>[data]</p></td><td><p>[starea]</p></td></tr>
</tbody></table>
<h2>3. Clienții</h2>
<p><strong>Clienți noi:</strong> [denumirea, ce au cumpărat, valoarea primei comenzi].</p>
<p><strong>Clienți pierduți sau care cumpără mai puțin:</strong> [denumirea și motivul: preț, concurență, calitate, livrare].</p>
<p><strong>Facturi restante la clienții mei</strong> (din Sheets → Șabloane → Vechimea creanțelor): [clientul, suma, de câte zile e întârziată, ce am stabilit cu el].</p>
<h2>4. Ce n-a mers și de ce am nevoie</h2>
<p>[Probleme cu stocul, prețurile, livrările, reclamațiile clienților; ce ajutor îmi trebuie de la firmă].</p>
<h2>5. Planul pentru luna următoare</h2>
<p>Ținta propusă: [suma] lei · Clienții pe care îi vizitez: [lista] · Ofertele de urmărit: [lista] · Altele: [instruiri, târguri, promoții].</p>
<p></p>
<table><tbody><tr>
<td><p style="text-align: center"><strong>Agentul de vânzări,</strong></p><p style="text-align: center">[Nume și prenume]</p><p style="text-align: center">Data: [data] · Semnătura: ____________</p></td>
<td><p style="text-align: center"><strong>Văzut, șeful vânzărilor,</strong></p><p style="text-align: center">[Nume și prenume]</p><p style="text-align: center">Data: [data] · Semnătura: ____________</p></td>
</tr></tbody></table>`,
  },
  {
    id: 'raspuns-reclamatie',
    name: 'Răspuns la reclamația unui client',
    desc: 'Scrisoarea firmei către clientul care a făcut o reclamație: ce s-a verificat, dacă reclamația e întemeiată și cum se rezolvă (reparare, înlocuire, banii înapoi, reducere de preț) sau de ce e respinsă, cu termenul și persoana de contact',
    html: `
<p><strong>[Denumirea firmei]</strong><br>CUI [cod] · Nr. Reg. Com. [J../..../....] · [adresa sediului]<br>Telefon [telefon] · E-mail [e-mail]</p>
<p>Nr. [nr.] / [data]</p>
<p>Către: <strong>[Numele clientului / denumirea firmei client]</strong>, [adresa]<br>Referitor la: reclamația dumneavoastră nr. [nr.] din [data], privind [produsul / serviciul] de pe factura [seria și nr.] din [data]</p>
<h1 style="text-align: center">RĂSPUNS LA RECLAMAȚIE</h1>
<p>Stimate client,</p>
<p>Vă mulțumim că ne-ați semnalat problema și ne cerem scuze pentru neplăcerile create. Vă comunicăm mai jos rezultatul verificării și soluția propusă.</p>
<h2>1. Ce ați reclamat</h2>
<p>[Pe scurt, cu cuvintele clientului: ce s-a întâmplat, când a observat, ce a cerut].</p>
<h2>2. Ce am verificat</h2>
<table><tbody>
<tr><th><p>Verificarea</p></th><th><p>Data</p></th><th><p>Rezultatul</p></th></tr>
<tr><td><p>[Produsul primit înapoi / pozele trimise / documentele de livrare]</p></td><td><p>[data]</p></td><td><p>[ce s-a constatat]</p></td></tr>
<tr><td><p>[Discuția cu transportatorul / cu furnizorul / cu echipa noastră]</p></td><td><p>[data]</p></td><td><p>[ce s-a constatat]</p></td></tr>
<tr><td><p>[Altă verificare: test, expertiză, condițiile de garanție]</p></td><td><p>[data]</p></td><td><p>[ce s-a constatat]</p></td></tr>
</tbody></table>
<p>Constatarea scrisă se face în Docs → Șabloane → Proces-verbal de constatare a pagubei; reclamația se trece în Sheets → Șabloane → Registrul reclamațiilor.</p>
<h2>3. Concluzia</h2>
<p>☐ <strong>Reclamația este întemeiată.</strong> Cauza: [transportul / produsul defect / greșeala noastră].</p>
<p>☐ <strong>Reclamația nu este întemeiată</strong>, pentru că [produsul a fost folosit altfel decât scrie în instrucțiuni / garanția a expirat / defectul nu s-a confirmat]. Dacă nu sunteți de acord, ne puteți scrie din nou sau vă puteți adresa autorității pentru protecția consumatorilor.</p>
<h2>4. Ce facem</h2>
<table><tbody>
<tr><th><p>Soluția</p></th><th><p>Ce primiți</p></th><th><p>Până când</p></th></tr>
<tr><td><p>☐ Repararea</p></td><td><p>[ce se repară, unde și pe costul cui]</p></td><td><p>[data]</p></td></tr>
<tr><td><p>☐ Înlocuirea cu un produs nou</p></td><td><p>[produsul, livrarea gratuită]</p></td><td><p>[data]</p></td></tr>
<tr><td><p>☐ Banii înapoi</p></td><td><p>[suma] lei, în contul [IBAN-ul clientului] / prin factura de stornare [seria și nr.]</p></td><td><p>[data]</p></td></tr>
<tr><td><p>☐ Reducere de preț</p></td><td><p>[suma] lei sau [..%], prin factura [seria și nr.]</p></td><td><p>[data]</p></td></tr>
</tbody></table>
<p>Pentru orice întrebare despre această reclamație, persoana de contact este [Nume și prenume], telefon [telefon], e-mail [e-mail].</p>
<p>Cu stimă,</p>
<p></p>
<table><tbody><tr>
<td><p style="text-align: center"><strong>Pentru [Denumirea firmei],</strong></p><p style="text-align: center">[Nume și prenume, funcția]</p><p style="text-align: center">Semnătura și ștampila: ____________</p></td>
<td><p style="text-align: center"><strong>Am primit răspunsul,</strong></p><p style="text-align: center">[Numele clientului]</p><p style="text-align: center">Data: [data] · Semnătura: ____________</p></td>
</tr></tbody></table>`,
  },
  {
    id: 'pv-instruire',
    name: 'Proces-verbal de instruire în protecția muncii',
    desc: 'Dovada scrisă că oamenii au fost instruiți (protecția muncii, stingerea incendiilor, prim ajutor): felul instruirii, data și durata, cine a ținut-o, ce s-a prezentat, cum s-a verificat și lista participanților cu semnăturile lor',
    html: `
<p><strong>[Denumirea firmei]</strong><br>CUI [cod] · [adresa punctului de lucru]</p>
<h1 style="text-align: center">PROCES-VERBAL DE INSTRUIRE</h1>
<p style="text-align: center">în domeniul securității și sănătății în muncă și al situațiilor de urgență · nr. [nr.] / [data]</p>
<h2>1. Datele instruirii</h2>
<table><tbody>
<tr><td><p><strong>Felul instruirii</strong></p></td><td><p>☐ introductiv-generală (la angajare) · ☐ la locul de muncă · ☐ periodică · ☐ suplimentară (după un accident, o schimbare de lucru sau o absență lungă) · ☐ stingerea incendiilor și evacuarea · ☐ prim ajutor</p></td></tr>
<tr><td><p><strong>Data și durata</strong></p></td><td><p>[data], de la ora [ora] la ora [ora] ([nr.] ore)</p></td></tr>
<tr><td><p><strong>Locul</strong></p></td><td><p>[sediul / punctul de lucru / atelierul / sala]</p></td></tr>
<tr><td><p><strong>A ținut instruirea</strong></p></td><td><p>[Nume și prenume], [funcția: conducătorul locului de muncă / responsabilul cu protecția muncii / serviciul extern]</p></td></tr>
<tr><td><p><strong>Materialele folosite</strong></p></td><td><p>[instrucțiunile proprii, fișele de lucru, prezentarea din Slides → Șabloane → Instruire de protecția muncii, filme, demonstrații]</p></td></tr>
</tbody></table>
<h2>2. Ce s-a prezentat</h2>
<p>1. [Riscurile locului de muncă și cum ne ferim de ele].</p>
<p>2. [Echipamentul de protecție: ce se poartă, când și cum se păstrează].</p>
<p>3. [Ce facem la incendiu: stingătoarele, căile de evacuare, locul de adunare, numărul 112].</p>
<p>4. [Primul ajutor: trusa, cine dă primul ajutor, pe cine anunțăm].</p>
<p>5. [Ce facem la un accident sau la un incident periculos și cui îl spunem imediat].</p>
<h2>3. Cum s-a verificat ce au înțeles</h2>
<p>☐ test scris · ☐ întrebări și răspunsuri · ☐ demonstrație practică (de exemplu, folosirea stingătorului). Cine nu a trecut verificarea repetă instruirea până la [data] și nu lucrează singur până atunci.</p>
<h2>4. Participanții</h2>
<table><tbody>
<tr><th><p>Nr.</p></th><th><p>Nume și prenume</p></th><th><p>Funcția / locul de muncă</p></th><th><p>Rezultatul verificării</p></th><th><p>Semnătura</p></th></tr>
<tr><td><p>1</p></td><td><p>[Nume și prenume]</p></td><td><p>[funcția]</p></td><td><p>☐ admis · ☐ de repetat</p></td><td><p>____________</p></td></tr>
<tr><td><p>2</p></td><td><p>[Nume și prenume]</p></td><td><p>[funcția]</p></td><td><p>☐ admis · ☐ de repetat</p></td><td><p>____________</p></td></tr>
<tr><td><p>3</p></td><td><p>[Nume și prenume]</p></td><td><p>[funcția]</p></td><td><p>☐ admis · ☐ de repetat</p></td><td><p>____________</p></td></tr>
<tr><td><p>4</p></td><td><p>[Nume și prenume]</p></td><td><p>[funcția]</p></td><td><p>☐ admis · ☐ de repetat</p></td><td><p>____________</p></td></tr>
<tr><td><p>5</p></td><td><p>[Nume și prenume]</p></td><td><p>[funcția]</p></td><td><p>☐ admis · ☐ de repetat</p></td><td><p>____________</p></td></tr>
</tbody></table>
<p>Prin semnătură, fiecare participant confirmă că a primit instruirea, a înțeles-o și se obligă să respecte instrucțiunile. Instruirea se trece și în fișa individuală de instruire a fiecăruia, iar data următoarei instruiri periodice se urmărește în Sheets → Șabloane → Termenele de protecția muncii.</p>
<p></p>
<table><tbody><tr>
<td><p style="text-align: center"><strong>Am ținut instruirea,</strong></p><p style="text-align: center">[Nume și prenume, funcția]</p><p style="text-align: center">Semnătura: ____________</p></td>
<td><p style="text-align: center"><strong>Văzut, conducătorul locului de muncă,</strong></p><p style="text-align: center">[Nume și prenume]</p><p style="text-align: center">Data: [data] · Semnătura: ____________</p></td>
</tr></tbody></table>`,
  },
  {
    id: 'hotarare-aga',
    name: 'Hotărârea adunării generale a asociaților',
    desc: 'Hotărârea asociaților unei firme (SRL): cine a participat și cu ce părți sociale, ordinea de zi și ce s-a hotărât la fiecare punct (situațiile financiare, profitul, administratorul, sediul, alte schimbări), cu voturile și semnăturile',
    html: `
<p><strong>[Denumirea firmei] S.R.L.</strong><br>CUI [cod] · Nr. Reg. Com. [J../..../....] · sediul în [adresa sediului]</p>
<h1 style="text-align: center">HOTĂRÂREA NR. [nr.] / [data]</h1>
<p style="text-align: center">a adunării generale a asociaților</p>
<p>Adunarea generală a asociaților s-a întrunit astăzi, [data], la ora [ora], la [sediul firmei / alt loc], ☐ la convocarea administratorului din [data] · ☐ fără convocare, toți asociații fiind de față.</p>
<h2>1. Asociații prezenți</h2>
<table><tbody>
<tr><th><p>Asociatul</p></th><th><p>Părți sociale</p></th><th><p>Din capitalul social</p></th><th><p>Prezent / reprezentat prin</p></th></tr>
<tr><td><p>[Nume și prenume / denumirea firmei], CNP / CUI [cod]</p></td><td><p>[nr.]</p></td><td><p>[..%]</p></td><td><p>[personal / împuternicit: nume, împuternicirea nr. ..]</p></td></tr>
<tr><td><p>[Nume și prenume / denumirea firmei], CNP / CUI [cod]</p></td><td><p>[nr.]</p></td><td><p>[..%]</p></td><td><p>[personal / împuternicit]</p></td></tr>
<tr><td><p>[Nume și prenume / denumirea firmei], CNP / CUI [cod]</p></td><td><p>[nr.]</p></td><td><p>[..%]</p></td><td><p>[personal / împuternicit]</p></td></tr>
</tbody></table>
<p>Sunt prezenți asociați care dețin [..%] din capitalul social, așa că adunarea poate hotărî potrivit actului constitutiv. Ședința este condusă de [nume], iar procesul-verbal îl scrie [nume].</p>
<h2>2. Ordinea de zi</h2>
<p>1. [Aprobarea situațiilor financiare pe anul [anul] și a raportului administratorului].</p>
<p>2. [Repartizarea profitului: dividende, rezerve, profit nerepartizat / acoperirea pierderii].</p>
<p>3. [Descărcarea de gestiune a administratorului / numirea unui administrator nou / prelungirea mandatului].</p>
<p>4. [Alt punct: schimbarea sediului, un punct de lucru nou, o activitate nouă, cesiunea de părți sociale].</p>
<h2>3. Ce s-a hotărât</h2>
<table><tbody>
<tr><th><p>Punctul</p></th><th><p>Hotărârea</p></th><th><p>Pentru</p></th><th><p>Împotrivă / abțineri</p></th></tr>
<tr><td><p>1</p></td><td><p>Se aprobă situațiile financiare pe anul [anul], cu cifra de afaceri de [suma] lei și [profitul / pierderea] de [suma] lei.</p></td><td><p>[..%]</p></td><td><p>[..%]</p></td></tr>
<tr><td><p>2</p></td><td><p>Din profitul net de [suma] lei se dau dividende [suma] lei, împărțite după părțile sociale și plătite până la [data]; restul de [suma] lei rămâne [la rezerve / nerepartizat].</p></td><td><p>[..%]</p></td><td><p>[..%]</p></td></tr>
<tr><td><p>3</p></td><td><p>[Se descarcă de gestiune administratorul [nume] pentru anul [anul] / se numește administrator [nume], CNP [cod], pe [durata]].</p></td><td><p>[..%]</p></td><td><p>[..%]</p></td></tr>
<tr><td><p>4</p></td><td><p>[Ce s-a hotărât la punctul 4; de când se aplică].</p></td><td><p>[..%]</p></td><td><p>[..%]</p></td></tr>
</tbody></table>
<p>Se împuternicește [nume și prenume] să semneze actele necesare și să depună hotărârea la Registrul Comerțului, acolo unde e cazul (de exemplu, pentru schimbarea administratorului sau a sediului). Dividendele și impozitul pe dividende se trec în contabilitatea lunii în care s-au hotărât.</p>
<p>Hotărârea a fost scrisă în [nr.] exemplare originale și se păstrează în registrul hotărârilor adunării generale.</p>
<p></p>
<table><tbody><tr>
<td><p style="text-align: center"><strong>Asociat,</strong></p><p style="text-align: center">[Nume și prenume]</p><p style="text-align: center">Semnătura: ____________</p></td>
<td><p style="text-align: center"><strong>Asociat,</strong></p><p style="text-align: center">[Nume și prenume]</p><p style="text-align: center">Semnătura: ____________</p></td>
<td><p style="text-align: center"><strong>Asociat,</strong></p><p style="text-align: center">[Nume și prenume]</p><p style="text-align: center">Semnătura: ____________</p></td>
</tr></tbody></table>`,
  },
  {
    id: 'decizie-asociat-unic',
    name: 'Decizia asociatului unic',
    desc: 'Pentru SRL-ul cu un singur asociat, în locul hotărârii adunării generale: ce decide asociatul unic (situațiile financiare, dividendele, administratorul, sediul, alte schimbări), punct cu punct, cu împuternicirea pentru Registrul Comerțului și semnătura lui',
    html: `
<p><strong>[Denumirea firmei] S.R.L.</strong><br>CUI [cod] · Nr. Reg. Com. [J../..../....] · sediul în [adresa sediului]</p>
<h1 style="text-align: center">DECIZIA NR. [nr.] / [data]</h1>
<p style="text-align: center">a asociatului unic</p>
<p>Subsemnatul / subsemnata <strong>[Nume și prenume]</strong>, CNP [cod], cu domiciliul în [adresa] (sau firma <strong>[denumirea]</strong>, CUI [cod], reprezentată de [nume]), în calitate de <strong>asociat unic</strong> al [Denumirea firmei] S.R.L., deținând toate cele [nr.] părți sociale (capital social [suma] lei), în temeiul legii societăților și al actului constitutiv,</p>
<h2 style="text-align: center">DECID:</h2>
<table><tbody>
<tr><th><p>Art.</p></th><th><p>Ce decid</p></th></tr>
<tr><td><p>1</p></td><td><p>Aprob situațiile financiare pe anul [anul], cu cifra de afaceri de [suma] lei și [profitul / pierderea] de [suma] lei, și raportul administratorului.</p></td></tr>
<tr><td><p>2</p></td><td><p>Din profitul net de [suma] lei îmi distribui dividende de [suma] lei, plătite până la [data]; restul de [suma] lei rămâne [la rezerve / nerepartizat]. Impozitul pe dividende se reține la plată.</p></td></tr>
<tr><td><p>3</p></td><td><p>[Descarc de gestiune administratorul [nume] pentru anul [anul] / numesc administrator pe [nume], CNP [cod], pe [durata] / prelungesc mandatul administratorului până la [data]].</p></td></tr>
<tr><td><p>4</p></td><td><p>[Alt punct: mut sediul la [adresa nouă] / deschid un punct de lucru la [adresa] / adaug activitatea [codul CAEN și denumirea]], începând cu [data].</p></td></tr>
<tr><td><p>5</p></td><td><p>Împuternicesc pe [nume și prenume] să semneze actele necesare și să depună această decizie la Registrul Comerțului, acolo unde e cazul.</p></td></tr>
</tbody></table>
<p>Decizia a fost scrisă în [nr.] exemplare originale și se păstrează în registrul deciziilor asociatului unic. Dacă firma are mai mulți asociați, se folosește Docs → Șabloane → Hotărârea adunării generale a asociaților.</p>
<p></p>
<p style="text-align: right"><strong>Asociat unic,</strong><br>[Nume și prenume]<br>Semnătura: ____________</p>`,
  },
  {
    id: 'convocare-aga',
    name: 'Convocarea adunării generale a asociaților',
    desc: 'Convocatorul trimis de administrator fiecărui asociat al unui SRL cu cel puțin 10 zile înainte: data, ora și locul adunării, ordinea de zi, ce documente se pot vedea înainte, a doua convocare și cum votează un asociat care nu poate veni, cu dovada trimiterii',
    html: `
<p><strong>[Denumirea firmei] S.R.L.</strong><br>CUI [cod] · Nr. Reg. Com. [J../..../....] · sediul în [adresa sediului]<br>Nr. [nr. de înregistrare] / [data]</p>
<p>Către: <strong>[Nume și prenume / denumirea firmei asociate]</strong>, asociat, cu [nr.] părți sociale<br>Adresa: [adresa din registrul asociaților]</p>
<h1 style="text-align: center">CONVOCARE</h1>
<p style="text-align: center">a adunării generale a asociaților</p>
<p>Subsemnatul / subsemnata <strong>[Nume și prenume]</strong>, administrator al [Denumirea firmei] S.R.L., în temeiul legii societăților și al actului constitutiv, convoc <strong>adunarea generală a asociaților</strong>:</p>
<table><tbody>
<tr><th><p>Data și ora</p></th><td><p>[ziua, data], ora [ora]</p></td></tr>
<tr><th><p>Locul</p></th><td><p>[sediul firmei / altă adresă / prin videoconferință, la legătura: ...]</p></td></tr>
<tr><th><p>A doua convocare</p></th><td><p>dacă la prima nu se adună asociații care dețin cel puțin [jumătate / cât cere actul constitutiv] din capitalul social: [data], ora [ora], în același loc</p></td></tr>
</tbody></table>
<h2>Ordinea de zi</h2>
<p>1. [Aprobarea situațiilor financiare pe anul [anul] și a raportului administratorului].</p>
<p>2. [Repartizarea profitului pe anul [anul]: dividende, rezerve, profit nerepartizat / acoperirea pierderii].</p>
<p>3. [Descărcarea de gestiune a administratorului / numirea unui administrator / prelungirea mandatului].</p>
<p>4. [Alt punct: schimbarea sediului, un punct de lucru nou, o activitate nouă, cesiunea de părți sociale; la schimbarea actului constitutiv se scrie aici textul propus].</p>
<p>5. Împuternicirea unei persoane pentru semnarea actelor și pentru Registrul Comerțului.</p>
<h2>Documentele adunării</h2>
<p>Situațiile financiare, raportul administratorului, propunerea de repartizare a profitului și [alte documente] se pot vedea la sediul firmei de la data acestei convocări, în zilele lucrătoare, între orele [ora] și [ora], sau se trimit la cerere pe e-mail, la [adresa de e-mail].</p>
<h2>Dacă nu puteți veni</h2>
<p>Puteți fi reprezentat de alt asociat sau de o altă persoană, cu o împuternicire scrisă (procură specială) pentru această adunare, adusă în original la începutul ședinței. [Dacă actul constitutiv permite: votul se poate trimite și prin corespondență, până la [data], la sediul firmei.]</p>
<p>Hotărârile se iau cu votul asociaților care dețin [majoritatea absolută / cât cere actul constitutiv] din capitalul social; pentru schimbarea actului constitutiv e nevoie de votul tuturor asociaților, dacă actul constitutiv nu spune altfel.</p>
<p></p>
<p style="text-align: right"><strong>Administrator,</strong><br>[Nume și prenume]<br>Semnătura: ____________</p>
<h2>Dovada trimiterii</h2>
<table><tbody>
<tr><th><p>Asociatul</p></th><th><p>Cum s-a trimis</p></th><th><p>Data trimiterii</p></th><th><p>Dovada</p></th></tr>
<tr><td><p>[Nume și prenume]</p></td><td><p>[scrisoare recomandată / predat sub semnătură / e-mail, dacă e prevăzut în actul constitutiv]</p></td><td><p>[data]</p></td><td><p>[nr. recipisei / semnătura de primire]</p></td></tr>
<tr><td><p>[Nume și prenume]</p></td><td><p>[scrisoare recomandată / predat sub semnătură / e-mail]</p></td><td><p>[data]</p></td><td><p>[nr. recipisei / semnătura de primire]</p></td></tr>
<tr><td><p>[Nume și prenume]</p></td><td><p>[scrisoare recomandată / predat sub semnătură / e-mail]</p></td><td><p>[data]</p></td><td><p>[nr. recipisei / semnătura de primire]</p></td></tr>
</tbody></table>
<p>Convocarea se trimite cu cel puțin 10 zile înainte de adunare, dacă actul constitutiv nu prevede alt termen. Ce s-a hotărât se scrie apoi în Docs → Șabloane → Hotărârea adunării generale a asociaților.</p>`,
  },
  {
    id: 'cesiune-parti-sociale',
    name: 'Contract de cesiune de părți sociale',
    desc: 'Vânzarea părților sociale ale unui asociat dintr-un SRL către alt asociat sau către o persoană nouă: părțile, câte părți sociale și cu ce preț, când se plătește, de când devine asociat cumpărătorul, ce declară fiecare, acordul asociaților și pașii la Registrul Comerțului, cu semnăturile',
    html: `
<h1 style="text-align: center">CONTRACT DE CESIUNE DE PĂRȚI SOCIALE</h1>
<p style="text-align: center">nr. [nr.] din [data]</p>
<h2>1. Părțile</h2>
<p><strong>[Nume și prenume / denumirea firmei]</strong>, CNP / CUI [cod], cu domiciliul / sediul în [adresa], act de identitate [seria, nr.], asociat al [Denumirea firmei] S.R.L., în calitate de <strong>cedent</strong> (cel care vinde),</p>
<p>și</p>
<p><strong>[Nume și prenume / denumirea firmei]</strong>, CNP / CUI [cod], cu domiciliul / sediul în [adresa], act de identitate [seria, nr.], în calitate de <strong>cesionar</strong> (cel care cumpără), [asociat al firmei / persoană din afara firmei],</p>
<p>au încheiat acest contract, cu respectarea legii societăților și a actului constitutiv.</p>
<h2>2. Ce se vinde</h2>
<table><tbody>
<tr><th><p>Firma</p></th><td><p>[Denumirea firmei] S.R.L., CUI [cod], Nr. Reg. Com. [J../..../....], sediul în [adresa sediului]</p></td></tr>
<tr><th><p>Capitalul social</p></th><td><p>[suma] lei, împărțit în [nr.] părți sociale a câte [valoarea] lei</p></td></tr>
<tr><th><p>Părțile sociale vândute</p></th><td><p>[nr.] părți sociale, adică [..%] din capitalul social (cedentul are acum [nr.] părți sociale; după cesiune rămâne cu [nr.])</p></td></tr>
<tr><th><p>Prețul</p></th><td><p>[suma] lei (în litere: [suma în litere]), adică [suma] lei pentru o parte socială</p></td></tr>
<tr><th><p>Plata</p></th><td><p>[la semnare, în numerar, cu chitanță / prin transfer în contul [IBAN], până la [data] / în rate: ...]</p></td></tr>
</tbody></table>
<h2>3. De când are efect</h2>
<p>Cesionarul devine proprietarul părților sociale la data semnării, iar față de firmă și de alte persoane de la data înscrierii cesiunii în registrul asociaților și la Registrul Comerțului. De la această dată are toate drepturile și obligațiile unui asociat, inclusiv dreptul la dividendele hotărâte după data cesiunii.</p>
<h2>4. Ce declară părțile</h2>
<p>Cedentul declară că părțile sociale sunt ale lui, sunt plătite integral și nu sunt gajate, sechestrate sau promise altcuiva. Cesionarul declară că a cunoscut actul constitutiv și situația financiară a firmei la [data ultimei situații financiare] și le acceptă.</p>
<h2>5. Acordul asociaților</h2>
<p>Dacă cesionarul nu este asociat, cesiunea are nevoie de acordul asociaților care dețin cel puțin trei pătrimi din capitalul social, dat prin hotărârea adunării generale a asociaților nr. [nr.] / [data] (Docs → Șabloane → Hotărârea adunării generale a asociaților), dacă actul constitutiv nu prevede altceva. Hotărârea se publică în Monitorul Oficial, iar creditorii firmei pot face opoziție în 30 de zile de la publicare.</p>
<h2>6. Pașii de după semnare</h2>
<p>Administratorul trece cesiunea în registrul asociaților (Sheets → Registrul asociaților), actualizează actul constitutiv și depune la Registrul Comerțului actele pentru înregistrarea schimbării. Cheltuielile cu acești pași le suportă [cedentul / cesionarul / amândoi, în părți egale]. Câștigul cedentului din vânzare se declară la ANAF prin declarația unică, dacă e cazul.</p>
<h2>7. Alte clauze</h2>
<p>Neînțelegerile se rezolvă pe cale amiabilă, iar dacă nu se poate, de instanța competentă de la sediul firmei. Contractul a fost încheiat în [nr.] exemplare originale, câte unul pentru fiecare parte, unul pentru firmă și unul pentru Registrul Comerțului.</p>
<p></p>
<table><tbody><tr>
<td><p style="text-align: center"><strong>CEDENT,</strong></p><p style="text-align: center">[Nume și prenume]</p><p style="text-align: center">Semnătura: ____________</p></td>
<td><p style="text-align: center"><strong>CESIONAR,</strong></p><p style="text-align: center">[Nume și prenume]</p><p style="text-align: center">Semnătura: ____________</p></td>
</tr></tbody></table>`,
  },
  {
    id: 'sponsorizare',
    name: 'Contract de sponsorizare',
    desc: 'O firmă sprijină cu bani, produse sau servicii o asociație, o fundație, o școală, un club sportiv sau o parohie: părțile, ce se dă și când, pentru ce se folosește, cum se face cunoscut sponsorul, dovada folosirii și verificarea în registrul entităților la ANAF, cu semnăturile',
    html: `
<h1 style="text-align: center">CONTRACT DE SPONSORIZARE</h1>
<p style="text-align: center">nr. [nr.] din [data]</p>
<h2>1. Părțile</h2>
<p><strong>[Denumirea firmei]</strong>, CUI [cod], Nr. Reg. Com. [J../..../....], cu sediul în [adresa], cont [IBAN] la [banca], reprezentată de [Nume și prenume], [funcția], în calitate de <strong>sponsor</strong>,</p>
<p>și</p>
<p><strong>[Denumirea beneficiarului]</strong> ([asociație / fundație / unitate de învățământ / club sportiv / unitate de cult]), cod fiscal [cod], înscrisă în [registrul asociațiilor și fundațiilor / alt registru] sub nr. [nr.], cu sediul în [adresa], cont [IBAN] la [banca], reprezentată de [Nume și prenume], [funcția], în calitate de <strong>beneficiar</strong>,</p>
<p>au încheiat acest contract, potrivit legii privind sponsorizarea.</p>
<h2>2. Ce se dă</h2>
<table><tbody>
<tr><th><p>Felul sponsorizării</p></th><td><p>[bani / produse / servicii]</p></td></tr>
<tr><th><p>Valoarea</p></th><td><p>[suma] lei (în litere: [suma în litere]); pentru produse și servicii, valoarea din documentele sponsorului, fără TVA: [suma] lei</p></td></tr>
<tr><th><p>Ce anume</p></th><td><p>[ce produse sau servicii și în ce cantitate]</p></td></tr>
<tr><th><p>Când și cum</p></th><td><p>[într-o singură tranșă, până la [data] / în tranșe: ...], [prin transfer în contul beneficiarului / predare cu proces-verbal]</p></td></tr>
</tbody></table>
<h2>3. Pentru ce se folosește</h2>
<p>Beneficiarul folosește sponsorizarea numai pentru [scopul: proiectul sau acțiunea, de exemplu tabăra de vară a copiilor], care se desfășoară între [data] și [data], în [locul]. Folosirea în alt scop se face doar cu acordul scris al sponsorului.</p>
<h2>4. Cum se face cunoscut sponsorul</h2>
<p>Beneficiarul poate face cunoscut numele sau marca sponsorului [pe afișe, pe site, în comunicate, pe echipamente: ...], fără ca aceasta să fie publicitate pentru produsele sponsorului. [Sponsorul nu dorește să fie făcut cunoscut.]</p>
<h2>5. Dovada folosirii</h2>
<p>Până la [data], beneficiarul trimite sponsorului un raport scurt cu ce s-a făcut și copii după documentele cheltuielilor ([facturi, chitanțe, fotografii]). Dacă sponsorizarea nu se folosește pentru scopul de mai sus, beneficiarul restituie partea nefolosită în [nr.] zile de la cererea sponsorului.</p>
<h2>6. Ce declară beneficiarul</h2>
<p>Beneficiarul declară că la data semnării este înscris în registrul entităților / unităților de cult pentru care se acordă deduceri fiscale, ținut de ANAF (sponsorul verifică pe site-ul ANAF și păstrează dovada), și că sponsorizarea nu se întoarce, direct sau indirect, la sponsor.</p>
<h2>7. Alte clauze</h2>
<p>Contractul intră în vigoare la data semnării și se încheie după ce beneficiarul trimite dovada folosirii. Neînțelegerile se rezolvă pe cale amiabilă, iar dacă nu se poate, de instanța competentă de la sediul sponsorului. Contractul a fost încheiat în 2 exemplare originale, câte unul pentru fiecare parte.</p>
<p>Sponsorul trece sponsorizarea în Sheets → Șabloane → Evidența sponsorizărilor, ca să vadă cât mai poate scădea din impozit în anul acesta.</p>
<p></p>
<table><tbody><tr>
<td><p style="text-align: center"><strong>SPONSOR,</strong></p><p style="text-align: center">[Denumirea firmei]</p><p style="text-align: center">[Nume și prenume], [funcția]</p><p style="text-align: center">Semnătura și ștampila: ____________</p></td>
<td><p style="text-align: center"><strong>BENEFICIAR,</strong></p><p style="text-align: center">[Denumirea beneficiarului]</p><p style="text-align: center">[Nume și prenume], [funcția]</p><p style="text-align: center">Semnătura și ștampila: ____________</p></td>
</tr></tbody></table>`,
  },
  {
    id: 'cerere-sponsorizare',
    name: 'Cerere de sponsorizare',
    desc: 'Scrisoarea unei asociații, fundații, școli sau a unui club sportiv către o firmă: cine suntem, proiectul pentru care cerem sprijin, de ce avem nevoie și cât costă, ce primește sponsorul în schimb, dovada că suntem în registrul ANAF și cum ținem legătura',
    html: `
<p><strong>[Denumirea organizației]</strong><br>Cod fiscal [cod], [adresa]<br>Telefon [telefon], e-mail [e-mail]</p>
<p style="text-align: right">Nr. [nr.] / [data]</p>
<p>Către: <strong>[Denumirea firmei]</strong><br>În atenția: [Nume și prenume], [funcția]</p>
<p><strong>Subiect: Cerere de sponsorizare pentru [numele proiectului]</strong></p>
<p>Stimate domnule / Stimată doamnă [Nume],</p>
<p>Vă scriem din partea [Denumirea organizației], [asociație / fundație / școală / club sportiv] care din [anul] [ce face organizația, pe scurt]. Vă rugăm să ne sprijiniți în proiectul de mai jos.</p>
<h2>Proiectul</h2>
<table><tbody>
<tr><th><p>Numele proiectului</p></th><td><p>[numele proiectului]</p></td></tr>
<tr><th><p>Ce facem</p></th><td><p>[ce se face, pe scurt]</p></td></tr>
<tr><th><p>Pentru cine</p></th><td><p>[cine se bucură de proiect și câte persoane]</p></td></tr>
<tr><th><p>Când și unde</p></th><td><p>[perioada], [locul]</p></td></tr>
<tr><th><p>Costul total</p></th><td><p>[suma] lei, din care avem deja [suma] lei din [alte surse]</p></td></tr>
</tbody></table>
<h2>Ce vă cerem</h2>
<table><tbody>
<tr><th><p>Ce anume</p></th><th><p>Cantitatea</p></th><th><p>Valoarea (lei)</p></th></tr>
<tr><td><p>[bani / produse / servicii]</p></td><td><p>[cantitatea]</p></td><td><p>[suma]</p></td></tr>
<tr><td><p>[bani / produse / servicii]</p></td><td><p>[cantitatea]</p></td><td><p>[suma]</p></td></tr>
<tr><td><p><strong>Total</strong></p></td><td><p></p></td><td><p><strong>[suma]</strong></p></td></tr>
</tbody></table>
<h2>Ce primiți în schimb</h2>
<p>Facem cunoscut sprijinul dumneavoastră [pe afișe, pe site și pe paginile noastre, la eveniment], cu numele și sigla firmei, dacă doriți. După proiect vă trimitem un raport cu ce s-a făcut, cu fotografii și cu documentele cheltuielilor.</p>
<p>Organizația noastră este înscrisă în registrul entităților / unităților de cult pentru care se acordă deduceri fiscale, ținut de ANAF (îl puteți verifica pe site-ul ANAF), așa că firma poate scădea sponsorizarea din impozit, în limitele legii.</p>
<h2>Cum continuăm</h2>
<p>Dacă sunteți de acord, vă trimitem contractul de sponsorizare (Docs → Șabloane → Contract de sponsorizare) și datele noastre bancare: [IBAN] la [banca]. Vă stăm la dispoziție cu orice detaliu la [telefon] sau [e-mail]; persoana de contact este [Nume și prenume].</p>
<p>Vă mulțumim pentru timpul acordat și sperăm să lucrăm împreună.</p>
<p>Cu stimă,</p>
<p>[Nume și prenume]<br>[funcția], [Denumirea organizației]</p>
<p>Semnătura și ștampila: ____________</p>
<p><em>Anexe: [prezentarea organizației, bugetul proiectului, dovada din registrul ANAF]</em></p>`,
  },
  {
    id: 'somatie-plata',
    name: 'Somație de plată',
    desc: 'Pasul obligatoriu înainte de ordonanța de plată: facturile neplătite (sume certe, lichide și exigibile), contractul din care vin, penalitățile sau dobânda legală, cele 40 de euro pe factură pentru recuperare, termenul de 15 zile și cum se trimite (executor sau scrisoare recomandată cu confirmare de primire)',
    html: `
<p><strong>[Denumirea firmei tale]</strong><br>CUI [cod], Nr. Reg. Com. [J../..../....], [adresa]<br>IBAN [IBAN], deschis la [banca] · [telefon] · [e-mail]</p>
<p style="text-align: right">Nr. [nr.] / [data]</p>
<p>Către: <strong>[Denumirea debitorului]</strong><br>CUI [cod], Nr. Reg. Com. [J../..../....], cu sediul în [adresa]<br>Reprezentată de [Nume și prenume], [funcția]</p>
<h1 style="text-align: center">SOMAȚIE DE PLATĂ</h1>
<p style="text-align: center">potrivit art. 1015 din Codul de procedură civilă</p>
<p></p>
<p>Subscrisa <strong>[Denumirea firmei tale]</strong>, în calitate de creditor, vă punem în vedere să plătiți, <strong>în termen de 15 zile de la primirea acestei somații</strong>, suma de <strong>[total] lei</strong>, pe care ne-o datorați din [contractul nr. ... din data ... / comenzile nr. ...], după cum urmează:</p>
<table><tbody>
<tr><th><p>Factura</p></th><th><p>Data emiterii</p></th><th><p>Scadența</p></th><th><p>Suma facturată (lei)</p></th><th><p>Rest neplătit (lei)</p></th></tr>
<tr><td><p>[seria și nr.]</p></td><td><p>[data]</p></td><td><p>[data]</p></td><td><p>[suma]</p></td><td><p>[suma]</p></td></tr>
<tr><td><p>[seria și nr.]</p></td><td><p>[data]</p></td><td><p>[data]</p></td><td><p>[suma]</p></td><td><p>[suma]</p></td></tr>
<tr><td><p><strong>Total debit principal</strong></p></td><td><p></p></td><td><p></p></td><td><p></p></td><td><p><strong>[suma]</strong></p></td></tr>
</tbody></table>
<h2>1. De unde vine datoria</h2>
<p>1.1. Am livrat produsele / am prestat serviciile din [contract / comenzi], iar dumneavoastră le-ați primit fără obiecții, după cum arată [avizele de însoțire / procesele-verbale de recepție / confirmările de primire] semnate de reprezentanții dumneavoastră.</p>
<p>1.2. Facturile au fost [trimise prin e-Factura / predate / trimise prin e-mail] și au ajuns la scadență. Suma este certă (rezultă din facturi și din [contract]), lichidă (se cunoaște exact) și exigibilă (termenul de plată a trecut).</p>
<p>1.3. Până azi ați plătit [nimic / suma de ... lei, cu ordinul de plată nr. ... din data ...], iar restul a rămas neachitat, deși v-am trimis [notificarea de plată nr. ... din data ... / mesajele din datele de ...].</p>
<h2>2. Ce se adaugă la debit</h2>
<p>2.1. <strong>Penalități de întârziere</strong>, potrivit art. [nr.] din contract: [procent] % pe zi din suma neplătită, calculate de la scadența fiecărei facturi până azi, în sumă de <strong>[suma] lei</strong> (calculul este anexat; în Sheets → Șabloane → Penalități de întârziere). <em>[Dacă în contract nu sunt prevăzute penalități, scrieți în loc: dobânda legală penalizatoare, adică dobânda de referință a BNR plus 8 puncte procentuale pe an între profesioniști, potrivit OG nr. 13/2011, în sumă de ... lei.]</em></p>
<p>2.2. <strong>Cheltuielile de recuperare</strong>: suma fixă echivalentă în lei a 40 de euro pentru fiecare factură neplătită la termen, cuvenită fără altă cerere, potrivit Legii nr. 72/2013, adică [nr. facturi] × 40 euro = <strong>[suma] lei</strong>.</p>
<p>2.3. Penalitățile / dobânda continuă să curgă până la plata integrală.</p>
<table><tbody>
<tr><th><p>Ce datorați</p></th><th><p>Suma (lei)</p></th></tr>
<tr><td><p>Debit principal</p></td><td><p>[suma]</p></td></tr>
<tr><td><p>Penalități / dobânda legală până la [data]</p></td><td><p>[suma]</p></td></tr>
<tr><td><p>Cheltuieli de recuperare (40 euro pe factură)</p></td><td><p>[suma]</p></td></tr>
<tr><td><p><strong>Total de plată</strong></p></td><td><p><strong>[total]</strong></p></td></tr>
</tbody></table>
<h2>3. Cum plătiți</h2>
<p>3.1. Plata se face în contul IBAN [IBAN], deschis la [banca], pe numele [Denumirea firmei tale], cu mențiunea „[numerele facturilor]”.</p>
<p>3.2. Dacă ați plătit deja, vă rugăm să ne trimiteți dovada plății la [e-mail] și să considerați această somație fără obiect. Dacă vreți să plătiți în rate, ne puteți propune un grafic în scris, în același termen (Docs → Șabloane → Cerere de eșalonare a plății).</p>
<h2>4. Ce urmează dacă nu plătiți</h2>
<p>4.1. Dacă în 15 zile de la primire suma nu este plătită și nici nu ajungem la o înțelegere scrisă, vom cere instanței <strong>emiterea unei ordonanțe de plată</strong> (art. 1014–1025 din Codul de procedură civilă), iar după aceea executarea silită. Cheltuielile de judecată și de executare vor fi tot în sarcina dumneavoastră.</p>
<p>4.2. Această somație ține loc de punere în întârziere și suspendă cursul prescripției dreptului nostru de a cere plata, dacă cererea în instanță urmează în cel mult 6 luni (art. 2540 din Codul civil).</p>
<p>Cu stimă,</p>
<p><strong>[Denumirea firmei tale]</strong>, prin [Nume și prenume], [funcția]</p>
<p>Semnătura și ștampila: ____________</p>
<p><em>Anexe: copiile facturilor, [contractul / comenzile], [avizele / procesele-verbale de recepție], [notificarea de plată trimisă înainte], calculul penalităților.</em></p>
<p><em>Cum se trimite: prin executor judecătoresc sau prin scrisoare recomandată cu conținut declarat și confirmare de primire. Păstrați recipisa poștei, lista cu conținutul declarat și confirmarea de primire: ziua primirii arată de când curg cele 15 zile și sunt dovada de care are nevoie instanța.</em></p>`,
  },
  {
    id: 'ordonanta-plata',
    name: 'Cerere de ordonanță de plată',
    desc: 'Cererea către judecătorie după ce somația de plată a rămas fără răspuns 15 zile: creditorul și debitorul, suma (debitul, penalitățile, dobânda), de unde vine datoria, somația și dovada primirii, înscrisurile anexate, taxa de timbru și câte exemplare se depun',
    html: `
<p>Către,<br><strong>JUDECĂTORIA [localitatea]</strong> <em>[tribunalul, dacă suma depășește 200.000 lei]</em></p>
<p style="text-align: right">Dosar nr. ____________ (se completează de instanță)</p>
<h1 style="text-align: center">CERERE DE EMITERE A UNEI ORDONANȚE DE PLATĂ</h1>
<p style="text-align: center">potrivit art. 1014–1025 din Codul de procedură civilă</p>
<h2>1. Părțile</h2>
<table><tbody>
<tr><th><p></p></th><th><p>Creditor</p></th><th><p>Debitor</p></th></tr>
<tr><td><p>Denumirea</p></td><td><p>[Denumirea firmei tale]</p></td><td><p>[Denumirea debitorului]</p></td></tr>
<tr><td><p>CUI și Nr. Reg. Com.</p></td><td><p>[CUI], [J../..../....]</p></td><td><p>[CUI], [J../..../....]</p></td></tr>
<tr><td><p>Sediul</p></td><td><p>[adresa]</p></td><td><p>[adresa]</p></td></tr>
<tr><td><p>Reprezentant</p></td><td><p>[Nume și prenume], [funcția / avocat]</p></td><td><p>[Nume și prenume], [funcția]</p></td></tr>
<tr><td><p>Telefon / e-mail</p></td><td><p>[telefon], [e-mail]</p></td><td><p>[telefon], [e-mail]</p></td></tr>
</tbody></table>
<p>Adresa la care primim actele de procedură: [adresa / e-mail].</p>
<h2>2. Ce cerem</h2>
<p>Vă rugăm să emiteți o ordonanță de plată prin care să îi cereți debitorului să ne plătească, în termenul pe care îl veți stabili (între 10 și 30 de zile de la comunicare):</p>
<table><tbody>
<tr><th><p>Ce se cere</p></th><th><p>Suma (lei)</p></th></tr>
<tr><td><p>Debitul principal (facturile neplătite)</p></td><td><p>[suma]</p></td></tr>
<tr><td><p>Penalitățile din contract / dobânda legală penalizatoare, calculate până la [data]</p></td><td><p>[suma]</p></td></tr>
<tr><td><p>Cheltuielile de recuperare (40 de euro pe factură, Legea nr. 72/2013)</p></td><td><p>[suma]</p></td></tr>
<tr><td><p><strong>Total</strong></p></td><td><p><strong>[total]</strong></p></td></tr>
</tbody></table>
<p>Cerem și penalitățile / dobânda de la [data] până la plata efectivă, precum și cheltuielile de judecată (taxa de timbru și, dacă este cazul, onorariul avocatului).</p>
<h2>3. De ce cerem</h2>
<p>3.1. Între noi și debitor s-a încheiat [contractul nr. ... din data ... / comenzile nr. ...], prin care ne-am obligat să [livrăm produsele / prestăm serviciile], iar debitorul să plătească prețul în [nr.] zile de la factură.</p>
<p>3.2. Ne-am îndeplinit obligația, după cum arată [avizele / procesele-verbale de recepție / confirmările] semnate de debitor, și am emis facturile [seriile și numerele], cu scadențele [datele].</p>
<p>3.3. Debitorul nu a plătit [nimic / decât suma de ... lei]. Creanța este certă, lichidă și exigibilă: rezultă din înscrisuri semnate de debitor, suma se cunoaște exact, iar termenele de plată au trecut.</p>
<p>3.4. I-am comunicat debitorului somația nr. [nr.] din [data], prin [executorul judecătoresc ... / scrisoare recomandată cu conținut declarat și confirmare de primire], primită la data de <strong>[data primirii]</strong>. Au trecut mai mult de 15 zile de la primire, iar debitorul nu a plătit și nu a răspuns [sau: a răspuns fără să conteste datoria].</p>
<h2>4. Temeiul legal</h2>
<p>Art. 1014–1025 din Codul de procedură civilă; art. [nr.] din contract; OG nr. 13/2011 (dobânda legală); Legea nr. 72/2013 (combaterea întârzierii la plată).</p>
<h2>5. Dovezile</h2>
<p>Înscrisurile de mai jos, în copii certificate „conform cu originalul”:</p>
<p>☐ contractul / comenzile<br>☐ facturile<br>☐ avizele, procesele-verbale de recepție, confirmările de primire<br>☐ somația de plată, recipisa poștei, lista cu conținutul declarat și confirmarea de primire<br>☐ calculul penalităților / dobânzii (Sheets → Penalități de întârziere)<br>☐ extrasul de la Registrul Comerțului pentru debitor<br>☐ dovada plății taxei de timbru<br>☐ împuternicirea avocatului / delegația reprezentantului</p>
<h2>6. Taxa de timbru și exemplarele</h2>
<p>Am plătit taxa judiciară de timbru de <strong>[200] lei</strong>, cu [chitanța / ordinul de plată] nr. [nr.] din [data], în contul [contul primăriei de la sediul debitorului / al instanței].</p>
<p>Depunem cererea și anexele în [3] exemplare: câte unul pentru fiecare parte și unul pentru instanță.</p>
<p>Data: [data]</p>
<p>Creditor, <strong>[Denumirea firmei tale]</strong>, prin [Nume și prenume], [funcția]</p>
<p>Semnătura și ștampila: ____________</p>
<p><em>Bine de știut: ordonanța de plată se cere doar pentru sume care rezultă din contracte și din înscrisuri. Dacă debitorul contestă serios datoria, instanța poate respinge cererea și rămâne calea unui proces obișnuit. Verificați taxa de timbru și instanța competentă înainte de depunere; e bine să vorbiți și cu un avocat.</em></p>`,
  },
  {
    id: 'predare-gestiune',
    name: 'Proces-verbal de predare-primire a gestiunii',
    desc: 'Schimbarea gestionarului: cine predă și cine primește, inventarierea făcută la predare, valoarea predată, diferențele găsite, actele, cheile și sigiliile predate, ce rămâne de rezolvat și semnăturile',
    html: `
<h1 style="text-align: center">PROCES-VERBAL DE PREDARE-PRIMIRE A GESTIUNII</h1>
<p style="text-align: center">Nr. [nr.] din [data]</p>
<p></p>
<p><strong>[Denumirea firmei]</strong>, cu sediul în [adresa], CUI [cod], Nr. Reg. Com. [J../..../....].</p>
<p>Astăzi, [data], în prezența comisiei numite prin decizia nr. [nr.] din [data], formată din [Nume și prenume] (președinte) și [Nume și prenume] (membru), s-a făcut predarea-primirea gestiunii <strong>[denumirea gestiunii]</strong>, din [adresa depozitului / magazinului], de la gestionarul care predă către gestionarul care primește:</p>
<table><tbody>
<tr><th><p></p></th><th><p>Predă</p></th><th><p>Primește</p></th></tr>
<tr><td><p>Nume și prenume</p></td><td><p>[Nume și prenume]</p></td><td><p>[Nume și prenume]</p></td></tr>
<tr><td><p>Funcția</p></td><td><p>[funcția]</p></td><td><p>[funcția]</p></td></tr>
<tr><td><p>Act de identitate</p></td><td><p>CI seria [serie] nr. [nr.]</p></td><td><p>CI seria [serie] nr. [nr.]</p></td></tr>
<tr><td><p>Motivul</p></td><td><p>[încetarea contractului / mutarea pe alt post / concediu]</p></td><td><p>[numirea prin decizia nr. ... din ...]</p></td></tr>
</tbody></table>
<h2>1. Inventarierea la predare</h2>
<p>Înainte de predare, comisia a inventariat gestiunea în perioada [data] – [data], prin numărare, cântărire sau măsurare, în prezența ambilor gestionari. Rezultatul e în listele de inventariere nr. [nr.] – [nr.] (Sheets → Șabloane → Listă de inventariere) și în procesul-verbal de inventariere nr. [nr.] (Docs → Proces-verbal de inventariere), anexate.</p>
<h2>2. Ce s-a predat</h2>
<table><tbody>
<tr><th><p></p></th><th><p>Valoare</p></th></tr>
<tr><td><p>Valoarea din evidență (scriptică) la [data]</p></td><td><p>[suma] lei</p></td></tr>
<tr><td><p>Valoarea găsită la numărare (faptică)</p></td><td><p>[suma] lei</p></td></tr>
<tr><td><p>Plusuri</p></td><td><p>[suma] lei</p></td></tr>
<tr><td><p>Lipsuri</p></td><td><p>[suma] lei</p></td></tr>
<tr><td><p><strong>Valoarea predată și primită</strong></p></td><td><p><strong>[suma] lei</strong></p></td></tr>
</tbody></table>
<p>Diferențele găsite: [nu sunt / sunt trecute în procesul-verbal de inventariere, cu explicațiile gestionarului care predă (Docs → Notă explicativă a gestionarului)].</p>
<h2>3. Ce se mai predă</h2>
<ul>
<li><p>Documentele gestiunii: fișele de magazie, notele de recepție, avizele și facturile din ultima lună, registrul de casă: [lista].</p></li>
<li><p>Bunurile primite în custodie sau în consignație, ale altor firme: [lista sau „nu este cazul”].</p></li>
<li><p>Cheile: [nr.] chei de la [ușile / dulapurile / seiful], codul alarmei schimbat pe [data].</p></li>
<li><p>Sigiliile și ștampila gestiunii: [lista].</p></li>
<li><p>Numerarul din casă: [suma] lei, numărat în fața comisiei.</p></li>
</ul>
<h2>4. Ce rămâne de rezolvat</h2>
<p>[Bunurile cu termen de garanție aproape expirat, mărfurile stricate propuse pentru casare (Docs → Proces-verbal de casare), livrările în curs, retururile la furnizori; sau „nu este cazul”].</p>
<p>De la data semnării, răspunderea pentru gestiune trece la gestionarul care primește. Gestionarul care predă răspunde în continuare pentru lipsurile găsite la această inventariere, până la rezolvarea lor.</p>
<p>Prezentul proces-verbal s-a încheiat în [nr.] exemplare, câte unul pentru fiecare gestionar și unul pentru contabilitate, astăzi, [data].</p>
<p></p>
<table><tbody><tr>
<td><p style="text-align: center"><strong>Am predat,</strong></p><p style="text-align: center">[Nume și prenume]</p><p style="text-align: center">Semnătura: ____________</p></td>
<td><p style="text-align: center"><strong>Am primit,</strong></p><p style="text-align: center">[Nume și prenume]</p><p style="text-align: center">Semnătura: ____________</p></td>
</tr></tbody></table>
<p></p>
<table><tbody><tr>
<td><p style="text-align: center"><strong>[Funcția]</strong></p><p style="text-align: center">[Nume și prenume]</p><p style="text-align: center">Semnătura: ____________</p></td>
<td><p style="text-align: center"><strong>[Funcția]</strong></p><p style="text-align: center">[Nume și prenume]</p><p style="text-align: center">Semnătura: ____________</p></td>
</tr></tbody></table>
<p></p>
<p><strong>Aprobat,</strong> [Administrator / Director], [Nume și prenume], semnătura: ____________</p>`,
  },
  {
    id: 'numire-gestionar',
    name: 'Decizie de numire a gestionarului',
    desc: 'Numirea unui angajat ca gestionar al unui depozit sau magazin: gestiunea, data de la care răspunde, garanția materială, ce are de ținut la zi, cine îl înlocuiește în concediu și comisia care face predarea-primirea',
    html: `
<p><strong>[Denumirea firmei]</strong><br>[Adresa sediului] · CUI [cod] · Nr. Reg. Com. [J../..../....]</p>
<h1 style="text-align: center">DECIZIA nr. [nr.] din [data]</h1>
<p style="text-align: center">privind numirea gestionarului [denumirea gestiunii]</p>
<p></p>
<p>[Nume și prenume], în calitate de [administrator / director general] al [denumirea firmei], având în vedere:</p>
<ul>
<li><p>contractul individual de muncă nr. [nr.] din [data] al salariatului [Nume și prenume] și fișa postului de gestionar, semnată;</p></li>
<li><p>necesitatea ca bunurile din gestiunea [denumirea gestiunii] să fie primite, păstrate și eliberate de o persoană care răspunde de ele;</p></li>
<li><p>prevederile legale privind gestionarii, angajarea lor și garanțiile materiale, precum și regulamentul intern al firmei,</p></li>
</ul>
<p><strong>DECIDE:</strong></p>
<p><strong>Art. 1.</strong> Începând cu data de [data], domnul / doamna <strong>[Nume și prenume]</strong>, CNP [CNP], angajat(ă) în funcția de [funcția], se numește gestionar al gestiunii:</p>
<table><tbody>
<tr><td><p>Gestiunea</p></td><td><p>[depozitul / magazinul / magazia]</p></td></tr>
<tr><td><p>Adresa</p></td><td><p>[adresa punctului de lucru]</p></td></tr>
<tr><td><p>Ce bunuri cuprinde</p></td><td><p>[mărfuri / materii prime / materiale / obiecte de inventar]</p></td></tr>
<tr><td><p>Primită prin</p></td><td><p>procesul-verbal de predare-primire nr. [nr.] din [data] (Docs → Proces-verbal de predare-primire a gestiunii)</p></td></tr>
</tbody></table>
<p><strong>Art. 2.</strong> Gestionarul răspunde de primirea, păstrarea și eliberarea bunurilor din gestiune și are următoarele sarcini:</p>
<ul>
<li><p>primește marfa numai cu document (factură, aviz) și întocmește nota de recepție (Sheets → Notă de recepție);</p></li>
<li><p>eliberează bunurile numai pe bază de document semnat: bon de consum, bon de transfer, aviz sau factură (Sheets → Bon de consum, Bon de transfer);</p></li>
<li><p>ține la zi fișele de magazie, pe fiecare produs (Sheets → Fișa de magazie), și le predă lunar la contabilitate, cu documentele lunii;</p></li>
<li><p>păstrează bunurile în condițiile cerute (temperatură, umiditate, ordine), anunță imediat lipsurile, stricăciunile și bunurile care expiră;</p></li>
<li><p>participă la inventarieri și explică în scris diferențele găsite (Docs → Notă explicativă a gestionarului).</p></li>
</ul>
<p><strong>Art. 3.</strong> Gestionarul constituie garanția materială în forma și în suma stabilite de lege și de contractul de garanție: [în numerar, prin rețineri lunare din salariu / altă formă], în valoare de [suma] lei, depusă în contul [banca, IBAN] pe numele gestionarului. Suma și modul de constituire se verifică împreună cu contabilul.</p>
<p><strong>Art. 4.</strong> În lipsa gestionarului (concediu, boală), gestiunea este preluată de <strong>[Nume și prenume]</strong>, numai cu proces-verbal de predare-primire și, dacă e nevoie, cu inventariere.</p>
<p><strong>Art. 5.</strong> Predarea-primirea gestiunii se face de comisia formată din [Nume și prenume] (președinte), [Nume și prenume] și [Nume și prenume], care va inventaria gestiunea la data de [data].</p>
<p><strong>Art. 6.</strong> Decizia se comunică gestionarului, înlocuitorului, comisiei și compartimentului de contabilitate. Un exemplar se păstrează la dosarul de personal.</p>
<p></p>
<table><tbody><tr>
<td><p style="text-align: center"><strong>[Administrator / Director general],</strong></p><p style="text-align: center">[Nume și prenume]</p><p style="text-align: center">Semnătura și ștampila: ____________</p></td>
<td><p style="text-align: center"><strong>Am luat la cunoștință, gestionar,</strong></p><p style="text-align: center">[Nume și prenume]</p><p style="text-align: center">Data și semnătura: ____________</p></td>
</tr></tbody></table>
<p></p>
<p><em>Textul este un model general. Forma garanției, suma ei și reținerile din salariu se stabilesc după legea în vigoare: verifică-le cu contabilul sau cu un avocat.</em></p>`,
  },
  {
    id: 'evaluare-paguba-salariat',
    name: 'Notă de constatare și evaluare a pagubei',
    desc: 'Când un salariat (de exemplu gestionarul, cu o lipsă peste normă la inventar) a produs o pagubă firmei: ce s-a constatat, cum s-a calculat suma, termenul de cel puțin 30 de zile și acordul salariatului pentru plata de bunăvoie sau prin rețineri din salariu',
    html: `
<p><strong>[Denumirea firmei]</strong><br>[Adresa sediului] · CUI [cod] · Nr. Reg. Com. [J../..../....]</p>
<p style="text-align: right">Nr. [nr.] din [data]</p>
<h1 style="text-align: center">NOTĂ DE CONSTATARE ȘI EVALUARE A PAGUBEI</h1>
<p style="text-align: center">pentru recuperarea pagubei prin acordul părților</p>
<p></p>
<p>Către: domnul / doamna <strong>[Nume și prenume]</strong>, angajat(ă) în funcția de [funcția], cu contractul individual de muncă nr. [nr.] din [data].</p>
<p><strong>1. Ce s-a constatat.</strong> La [inventarierea gestiunii / verificarea] din data de [data], consemnată în procesul-verbal de inventariere nr. [nr.] din [data], s-a constatat următoarea pagubă produsă din vina dumneavoastră și în legătură cu munca: [descrierea pe scurt: lipsă în gestiune peste norma de perisabilitate / bun deteriorat / altele].</p>
<p>Ați dat o notă explicativă în data de [data] (Docs → Notă explicativă a gestionarului), din care reiese: [pe scurt, ce a explicat salariatul].</p>
<p><strong>2. Cum s-a calculat paguba.</strong></p>
<table><tbody>
<tr><td><p><strong>Bunul / produsul</strong></p></td><td><p><strong>Cantitatea</strong></p></td><td><p><strong>Prețul unitar (lei)</strong></p></td><td><p><strong>Valoarea (lei)</strong></p></td></tr>
<tr><td><p>[produsul]</p></td><td><p>[cantitatea peste normă]</p></td><td><p>[preț]</p></td><td><p>[valoare]</p></td></tr>
<tr><td><p>[produsul]</p></td><td><p>[cantitatea peste normă]</p></td><td><p>[preț]</p></td><td><p>[valoare]</p></td></tr>
<tr><td><p><strong>Total pagubă</strong></p></td><td><p></p></td><td><p></p></td><td><p><strong>[total] lei</strong></p></td></tr>
</tbody></table>
<p>Lipsurile din limita normelor de perisabilitate nu vi se impută; calculul pe produse este în Sheets → Perisabilități (coloana „De imputat”).</p>
<p><strong>3. Ce vă propunem.</strong> Vă solicităm recuperarea sumei de <strong>[total] lei</strong> prin acordul părților, în termen de [cel puțin 30] de zile de la data comunicării acestei note, astfel:</p>
<ul>
<li><p>☐ plata integrală, la casieria firmei sau în contul [IBAN], până la data de [data];</p></li>
<li><p>☐ prin rețineri din salariu, în [număr] rate lunare de [suma] lei, începând cu salariul lunii [luna];</p></li>
<li><p>☐ altă modalitate: [descrierea].</p></li>
</ul>
<p>Suma recuperată prin acord nu poate depăși echivalentul a 5 salarii minime brute pe economie. Dacă nu sunteți de acord, firma se poate adresa instanței.</p>
<p></p>
<table><tbody><tr>
<td><p style="text-align: center"><strong>[Administrator / Director general],</strong></p><p style="text-align: center">[Nume și prenume]</p><p style="text-align: center">Semnătura și ștampila: ____________</p></td>
<td><p style="text-align: center"><strong>Am primit nota,</strong></p><p style="text-align: center">[Nume și prenume salariat]</p><p style="text-align: center">Data și semnătura: ____________</p></td>
</tr></tbody></table>
<p></p>
<h2>Acordul salariatului</h2>
<p>Subsemnatul(a) [Nume și prenume], CNP [CNP], ☐ sunt de acord / ☐ nu sunt de acord cu recuperarea sumei de [total] lei în modalitatea bifată mai sus.</p>
<p>Data: [data] · Semnătura: ____________</p>
<p></p>
<p><em>Textul este un model general. Termenul, plafonul și reținerile din salariu se stabilesc după legea în vigoare: verifică-le cu contabilul sau cu un avocat înainte de a comunica nota.</em></p>`,
  },
  {
    id: 'contract-garantie-gestionar',
    name: 'Contract de garanție materială',
    desc: 'Între firmă și gestionarul numit: suma garanției, cum se constituie (depunere la început și rețineri lunare din salariu), contul în care stă, cum se folosește dacă apar pagube și când se restituie, la plecarea din gestiune',
    html: `
<p><strong>[Denumirea firmei]</strong><br>[Adresa sediului] · CUI [cod] · Nr. Reg. Com. [J../..../....]</p>
<h1 style="text-align: center">CONTRACT DE GARANȚIE MATERIALĂ</h1>
<p style="text-align: center">nr. [nr.] din [data]</p>
<p></p>
<p><strong>1. Părțile.</strong></p>
<ul>
<li><p><strong>[Denumirea firmei]</strong>, cu sediul în [adresa], CUI [cod], reprezentată de [Nume și prenume], [administrator / director general], numită în continuare <strong>angajatorul</strong>;</p></li>
<li><p><strong>[Nume și prenume]</strong>, CNP [CNP], domiciliat(ă) în [adresa], angajat(ă) cu contractul individual de muncă nr. [nr.] din [data] și numit(ă) gestionar prin decizia nr. [nr.] din [data] (Docs → Decizie de numire a gestionarului), numit(ă) în continuare <strong>gestionarul</strong>.</p></li>
</ul>
<p><strong>2. Obiectul.</strong> Gestionarul constituie o garanție materială pentru bunurile din gestiunea <strong>[denumirea gestiunii]</strong>, de la adresa [adresa punctului de lucru], pe care le primește, le păstrează și le eliberează.</p>
<p><strong>3. Suma și modul de constituire.</strong></p>
<table><tbody>
<tr><td><p>Suma garanției</p></td><td><p>[suma] lei</p></td></tr>
<tr><td><p>Depusă la semnare</p></td><td><p>[suma] lei, la data de [data]</p></td></tr>
<tr><td><p>Reținere lunară din salariu</p></td><td><p>[suma] lei, începând cu salariul lunii [luna], până la constituirea întregii sume</p></td></tr>
<tr><td><p>Contul garanției</p></td><td><p>[banca], IBAN [IBAN], deschis pe numele gestionarului</p></td></tr>
</tbody></table>
<p>Sumele depuse și reținute se urmăresc în Sheets → Garanțiile gestionarilor. Dobânda cuvenită pentru suma din cont aparține gestionarului.</p>
<p><strong>4. Folosirea garanției.</strong> Dacă la inventariere sau la un control se constată o pagubă în gestiune produsă din vina gestionarului, peste normele de perisabilitate (Sheets → Perisabilități), aceasta se recuperează mai întâi prin acordul părților (Docs → Notă de constatare și evaluare a pagubei) sau prin hotărâre judecătorească, iar garanția se poate folosi pentru acoperirea ei numai în condițiile legii.</p>
<p><strong>5. Restituirea.</strong> La încetarea calității de gestionar, după predarea-primirea gestiunii (Docs → Proces-verbal de predare-primire a gestiunii) și dacă nu s-au constatat pagube, garanția se restituie gestionarului, cu dobânda, în cel mult [număr] zile.</p>
<p><strong>6. Obligațiile gestionarului.</strong> Să țină la zi evidența gestiunii, să anunțe imediat orice lipsă sau stricăciune și să participe la inventarieri.</p>
<p><strong>7. Dispoziții finale.</strong> Contractul s-a încheiat în două exemplare, câte unul pentru fiecare parte, și intră în vigoare la data semnării. Orice modificare se face prin act adițional.</p>
<p></p>
<table><tbody><tr>
<td><p style="text-align: center"><strong>Angajatorul,</strong></p><p style="text-align: center">[Nume și prenume]</p><p style="text-align: center">Semnătura și ștampila: ____________</p></td>
<td><p style="text-align: center"><strong>Gestionarul,</strong></p><p style="text-align: center">[Nume și prenume]</p><p style="text-align: center">Semnătura: ____________</p></td>
</tr></tbody></table>
<p></p>
<p><em>Textul este un model general. Suma maximă a garanției, reținerile din salariu, contul și folosirea garanției se stabilesc după legea în vigoare privind gestionarii: verifică-le cu contabilul sau cu un avocat.</em></p>`,
  },
  {
    id: 'contract-cadru-furnizare',
    name: 'Contract-cadru de furnizare',
    desc: 'Cu un furnizor de la care cumperi des: produsele și prețurile din anexă, cum se fac comenzile (fiecare comandă devine parte din contract), termenul de livrare, recepția și reclamarea diferențelor, plata la termen, penalitățile și durata, cu prelungire',
    html: `
<p><strong>[Denumirea firmei]</strong><br>[Adresa sediului] · CUI [cod] · Nr. Reg. Com. [J../..../....]</p>
<h1 style="text-align: center">CONTRACT-CADRU DE FURNIZARE</h1>
<p style="text-align: center">nr. [nr.] din [data]</p>
<p></p>
<p><strong>1. Părțile.</strong></p>
<ul>
<li><p><strong>[Denumirea furnizorului]</strong>, cu sediul în [adresa], CUI [cod], Nr. Reg. Com. [J../..../....], cont [IBAN] la [banca], reprezentată de [Nume și prenume], [funcția], numită în continuare <strong>furnizorul</strong>;</p></li>
<li><p><strong>[Denumirea firmei]</strong>, cu sediul în [adresa], CUI [cod], Nr. Reg. Com. [J../..../....], cont [IBAN] la [banca], reprezentată de [Nume și prenume], [funcția], numită în continuare <strong>cumpărătorul</strong>.</p></li>
</ul>
<p><strong>2. Obiectul.</strong> Furnizorul vinde cumpărătorului, pe toată durata contractului, produsele din Anexa 1 (lista de produse și prețuri), în cantitățile cerute prin comenzi. Contractul nu obligă cumpărătorul la o cantitate minimă, în afară de cea scrisă în anexă.</p>
<p><strong>3. Comenzile.</strong> Cumpărătorul trimite comenzi scrise (Docs → Comandă către furnizor), prin e-mail la [adresa de e-mail] sau pe hârtie. Furnizorul confirmă comanda în cel mult [număr] zile lucrătoare; fără răspuns în acest termen, comanda se consideră acceptată. Fiecare comandă confirmată face parte din contract.</p>
<p><strong>4. Livrarea.</strong></p>
<table><tbody>
<tr><td><p>Termenul de livrare</p></td><td><p>[număr] zile lucrătoare de la confirmarea comenzii</p></td></tr>
<tr><td><p>Locul de livrare</p></td><td><p>[adresa depozitului / punctului de lucru]</p></td></tr>
<tr><td><p>Transportul și descărcarea</p></td><td><p>[în sarcina furnizorului / a cumpărătorului]</p></td></tr>
<tr><td><p>Documentele la livrare</p></td><td><p>factura, avizul de însoțire, certificatul de calitate sau declarația de conformitate</p></td></tr>
</tbody></table>
<p>Termenul de livrare intră în calculul stocului de siguranță din Sheets → Necesar de aprovizionare.</p>
<p><strong>5. Recepția.</strong> Marfa se numără și se verifică la primire, pe nota de recepție (Sheets → Notă de recepție). Lipsurile vizibile se trec pe documentul de livrare; viciile ascunse se anunță în scris în [număr] zile de la descoperire (Docs → Notificare de neconformitate la livrare). Furnizorul înlocuiește sau completează marfa în [număr] zile sau emite factura de stornare.</p>
<p><strong>6. Prețurile și plata.</strong> Prețurile sunt cele din Anexa 1, fără TVA, și se pot schimba numai prin act adițional, anunțat cu cel puțin [număr] zile înainte (Docs → Act adițional la contract). Plata se face prin transfer bancar în [număr] zile de la data facturii.</p>
<p><strong>7. Penalitățile.</strong> Pentru întârzierea livrării, furnizorul plătește [procent]% pe zi din valoarea mărfii nelivrate; pentru întârzierea plății, cumpărătorul plătește [procent]% pe zi din suma neachitată (Sheets → Penalități de întârziere). Penalitățile nu pot trece de valoarea sumei pentru care se calculează.</p>
<p><strong>8. Durata.</strong> Contractul se încheie pe [număr] luni, de la [data] până la [data], și se prelungește singur cu câte [număr] luni dacă niciuna dintre părți nu anunță în scris, cu cel puțin [număr] zile înainte, că nu dorește prelungirea (Sheets → Evidența contractelor).</p>
<p><strong>9. Forța majoră.</strong> Partea care nu își poate îndeplini obligațiile din cauza unui caz de forță majoră anunță cealaltă parte în cel mult [număr] zile și nu răspunde pentru întârziere cât durează acesta.</p>
<p><strong>10. Litigiile.</strong> Neînțelegerile se rezolvă pe cale amiabilă; dacă nu se poate, de instanța competentă de la sediul [furnizorului / cumpărătorului].</p>
<p><strong>11. Dispoziții finale.</strong> Contractul s-a încheiat în două exemplare, câte unul pentru fiecare parte, cu Anexa 1 (lista de produse și prețuri), și intră în vigoare la data semnării. Orice modificare se face prin act adițional.</p>
<p></p>
<table><tbody><tr>
<td><p style="text-align: center"><strong>Furnizorul,</strong></p><p style="text-align: center">[Nume și prenume]</p><p style="text-align: center">Semnătura și ștampila: ____________</p></td>
<td><p style="text-align: center"><strong>Cumpărătorul,</strong></p><p style="text-align: center">[Nume și prenume]</p><p style="text-align: center">Semnătura și ștampila: ____________</p></td>
</tr></tbody></table>
<p></p>
<h2>Anexa 1. Lista de produse și prețuri</h2>
<table><tbody>
<tr><td><p><strong>Nr.</strong></p></td><td><p><strong>Produsul</strong></p></td><td><p><strong>U.M.</strong></p></td><td><p><strong>Preț unitar (fără TVA)</strong></p></td><td><p><strong>Cantitatea minimă pe comandă</strong></p></td></tr>
<tr><td><p>1</p></td><td><p>[produsul]</p></td><td><p>[U.M.]</p></td><td><p>[preț] lei</p></td><td><p>[cantitate]</p></td></tr>
<tr><td><p>2</p></td><td><p>[produsul]</p></td><td><p>[U.M.]</p></td><td><p>[preț] lei</p></td><td><p>[cantitate]</p></td></tr>
<tr><td><p>3</p></td><td><p>[produsul]</p></td><td><p>[U.M.]</p></td><td><p>[preț] lei</p></td><td><p>[cantitate]</p></td></tr>
</tbody></table>
<p></p>
<p><em>Textul este un model general. Termenele, penalitățile și clauzele de răspundere se stabilesc după legea în vigoare și după înțelegerea cu furnizorul: verifică-le cu contabilul sau cu un avocat înainte de semnare.</em></p>`,
  },
  {
    id: 'evaluare-furnizor',
    name: 'Scrisoare cu rezultatul evaluării furnizorului',
    desc: 'Către un furnizor, după evaluarea anuală sau trimestrială: livrările la termen și cele fără neconformități, notele pentru preț și colaborare, punctajul și clasa A / B / C, ce trebuie îmbunătățit și până când, cu planul de măsuri cerut',
    html: `
<p><strong>[Denumirea firmei]</strong><br>[Adresa sediului] · CUI [cod] · Nr. Reg. Com. [J../..../....]<br>Telefon [telefon] · E-mail [e-mail]</p>
<p>Nr. [nr.] din [data]</p>
<p></p>
<p>Către: <strong>[Denumirea furnizorului]</strong><br>[Adresa furnizorului] · CUI [cod]<br>În atenția: [Nume și prenume, funcția]</p>
<p></p>
<h1 style="text-align: center">REZULTATUL EVALUĂRII FURNIZORULUI</h1>
<p style="text-align: center">pentru perioada [de la data] – [până la data]</p>
<p></p>
<p>Stimată doamnă / Stimate domn,</p>
<p>Vă mulțumim pentru colaborarea din perioada de mai sus, în baza contractului nr. [nr.] din [data] (Docs → Contract-cadru de furnizare). Ca în fiecare [an / trimestru], am evaluat toți furnizorii noștri după aceleași criterii, din notele de recepție și din notificările de neconformitate (Sheets → Evaluarea furnizorilor). Rezultatul pentru firma dumneavoastră este următorul:</p>
<table><tbody>
<tr><td><p><strong>Criteriul</strong></p></td><td><p><strong>Rezultatul</strong></p></td><td><p><strong>Ponderea</strong></p></td></tr>
<tr><td><p>Livrări la termen</p></td><td><p>[nr.] din [nr.] livrări ([procent]%)</p></td><td><p>35%</p></td></tr>
<tr><td><p>Livrări fără neconformități</p></td><td><p>[nr.] din [nr.] livrări ([procent]%)</p></td><td><p>35%</p></td></tr>
<tr><td><p>Prețul</p></td><td><p>nota [1–5]</p></td><td><p>20%</p></td></tr>
<tr><td><p>Colaborarea (răspunsuri, documente, reclamații)</p></td><td><p>nota [1–5]</p></td><td><p>10%</p></td></tr>
<tr><td><p><strong>Punctajul total</strong></p></td><td><p><strong>[punctaj] din 100 · clasa [A / B / C]</strong></p></td><td><p>100%</p></td></tr>
</tbody></table>
<p>Clasele: <strong>A</strong> (de la 85 de puncte), furnizor preferat; <strong>B</strong> (70–84), furnizor acceptat; <strong>C</strong> (sub 70), furnizor de înlocuit dacă rezultatele nu se îmbunătățesc.</p>
<p><strong>Ce a mers bine:</strong> [de exemplu: livrările complete, facturile corecte, răspunsul rapid la cereri].</p>
<p><strong>Ce trebuie îmbunătățit:</strong></p>
<ul>
<li><p>[de exemplu: [nr.] livrări au întârziat cu [nr.] zile față de termenul confirmat în comandă];</p></li>
<li><p>[de exemplu: la [nr.] livrări au lipsit certificatele de calitate sau au fost diferențe de cantitate];</p></li>
<li><p>[alt punct].</p></li>
</ul>
<p>[Pentru clasa B sau C:] Vă rugăm să ne trimiteți până la data de <strong>[data]</strong> un plan de măsuri pentru punctele de mai sus, cu termenele și persoana responsabilă. Vom urmări rezultatele la următoarea evaluare, din [luna, anul]. [Pentru clasa C: dacă rezultatele nu se îmbunătățesc, ne rezervăm dreptul de a reduce comenzile sau de a nu prelungi contractul, potrivit clauzelor acestuia.]</p>
<p>[Pentru clasa A:] Vă rămânem parteneri pentru perioada următoare și vă vom invita cu prioritate la cererile noastre de ofertă.</p>
<p>Pentru orice întrebare despre evaluare ne puteți contacta la [telefon] sau [e-mail].</p>
<p></p>
<p>Cu stimă,</p>
<p><strong>[Nume și prenume]</strong><br>[Funcția: responsabil aprovizionare / administrator]<br>Semnătura: ____________</p>
<p></p>
<p><em>Criteriile și ponderile sunt cele din Sheets → Evaluarea furnizorilor; dacă le-ați schimbat acolo, schimbați-le și în tabelul de mai sus.</em></p>`,
  },
  {
    id: 'retur-furnizor',
    name: 'Proces-verbal de retur al mărfii către furnizor',
    desc: 'Marfa dată înapoi furnizorului: documentul cu care a intrat, produsele returnate cu cantitatea, valoarea și motivul, cine o predă și cine o primește, cu cererea notei de credit (factura cu minus) în termenul stabilit',
    html: `
<p><strong>[Denumirea firmei]</strong><br>[Adresa sediului] · CUI [cod] · Nr. Reg. Com. [J../..../....]</p>
<p>Nr. [nr.] din [data]</p>
<p></p>
<h1 style="text-align: center">PROCES-VERBAL DE RETUR AL MĂRFII</h1>
<p style="text-align: center">către furnizorul [Denumirea furnizorului], CUI [cod]</p>
<p></p>
<p>Încheiat astăzi, [data], la [locul: depozitul / magazinul], între:</p>
<ul>
<li><p><strong>[Denumirea firmei]</strong>, cumpărătorul, prin [Nume și prenume], [funcția: gestionar / responsabil aprovizionare], care predă marfa;</p></li>
<li><p><strong>[Denumirea furnizorului]</strong>, vânzătorul, prin [Nume și prenume], [funcția], delegat cu actul de identitate nr. [nr.], care primește marfa.</p></li>
</ul>
<p><strong>1. Marfa returnată.</strong> Marfa de mai jos a intrat cu factura nr. [nr.] din [data] și nota de recepție nr. [nr.] din [data] (Sheets → Notă de recepție), în baza contractului nr. [nr.] din [data] (Docs → Contract-cadru de furnizare). Neconformitatea a fost anunțată prin notificarea nr. [nr.] din [data] (Docs → Notificare de neconformitate la livrare).</p>
<table><tbody>
<tr><td><p><strong>Nr.</strong></p></td><td><p><strong>Produsul</strong></p></td><td><p><strong>U.M.</strong></p></td><td><p><strong>Cantitatea</strong></p></td><td><p><strong>Preț unitar (fără TVA)</strong></p></td><td><p><strong>Valoarea (fără TVA)</strong></p></td><td><p><strong>Motivul returului</strong></p></td></tr>
<tr><td><p>1</p></td><td><p>[produsul]</p></td><td><p>[buc]</p></td><td><p>[cantitatea]</p></td><td><p>[preț]</p></td><td><p>[valoarea]</p></td><td><p>[de exemplu: ambalaj deteriorat la transport]</p></td></tr>
<tr><td><p>2</p></td><td><p>[produsul]</p></td><td><p>[buc]</p></td><td><p>[cantitatea]</p></td><td><p>[preț]</p></td><td><p>[valoarea]</p></td><td><p>[de exemplu: livrat în plus față de comandă]</p></td></tr>
<tr><td><p></p></td><td><p><strong>Total</strong></p></td><td><p></p></td><td><p></p></td><td><p></p></td><td><p><strong>[total]</strong> + TVA [suma] = <strong>[total cu TVA]</strong></p></td><td><p></p></td></tr>
</tbody></table>
<p><strong>2. Predarea.</strong> Marfa s-a predat în [ambalajul original / alt ambalaj: …], cu avizul de însoțire nr. [nr.] din [data], cu [mijlocul de transport nr. … / curierul, AWB nr. …]. Starea ei la predare: [descriere scurtă]. Delegatul furnizorului a verificat cantitățile și [nu are obiecții / are următoarele obiecții: …].</p>
<p><strong>3. Nota de credit.</strong> Furnizorul emite pentru valoarea de mai sus nota de credit (factura de stornare) în cel mult [număr] zile de la data acestui proces-verbal (sau înlocuiește marfa cu produse conforme până la data de [data]). Suma se scade din [factura nr. … / următoarea plată] sau se restituie în contul [IBAN].</p>
<p>Procesul-verbal s-a întocmit în două exemplare, câte unul pentru fiecare parte.</p>
<p></p>
<p><strong>Am predat (cumpărătorul):</strong> [Nume și prenume] · Semnătura: ____________</p>
<p><strong>Am primit (furnizorul):</strong> [Nume și prenume] · Semnătura: ____________</p>
<p></p>
<p><em>Returul și nota de credit se urmăresc în Sheets → Retururi către furnizori. Dacă furnizorul nu trimite delegat, marfa poate pleca prin curier, iar procesul-verbal se trimite semnat de cumpărător, cu cererea de confirmare.</em></p>`,
  },
  {
    id: 'modificare-preturi',
    name: 'Proces-verbal de modificare a prețurilor',
    desc: 'Când se schimbă prețurile de vânzare ale mărfii din magazin: stocul numărat în ziua schimbării, prețul vechi și cel nou pentru fiecare produs, diferența pe bucată și pe total (în plus sau în minus), cu motivul și semnăturile comisiei și ale gestionarului',
    html: `
<p><strong>[Denumirea firmei]</strong><br>[Adresa sediului] · CUI [cod] · Nr. Reg. Com. [J../..../....]</p>
<p>Gestiunea: [magazinul / depozitul din …] · Gestionar: [Nume și prenume]</p>
<p>Nr. [nr.] din [data]</p>
<p></p>
<h1 style="text-align: center">PROCES-VERBAL DE MODIFICARE A PREȚURILOR</h1>
<p style="text-align: center">de la data de [data], ora [ora]</p>
<p></p>
<p>Încheiat astăzi, [data], de comisia numită prin decizia nr. [nr.] din [data], formată din [Nume și prenume, funcția] și [Nume și prenume, funcția], în prezența gestionarului [Nume și prenume].</p>
<p><strong>1. Motivul.</strong> Prețurile de vânzare se modifică din cauza [creșterii prețului de achiziție de la furnizor / reducerii pentru lichidarea stocului / schimbării cotei de TVA / campaniei de reduceri din perioada … ], potrivit deciziei administratorului nr. [nr.] din [data]. Prețurile noi s-au calculat din prețul de achiziție și adaosul comercial (Sheets → Calculul prețului de vânzare).</p>
<p><strong>2. Stocul și prețurile.</strong> Comisia a numărat marfa aflată în gestiune la data și ora de mai sus și a trecut-o în tabelul de mai jos, cu prețul vechi și cel nou (cu TVA, cel de pe etichetă):</p>
<table><tbody>
<tr><td><p><strong>Nr.</strong></p></td><td><p><strong>Produsul</strong></p></td><td><p><strong>U.M.</strong></p></td><td><p><strong>Cantitatea în stoc</strong></p></td><td><p><strong>Prețul vechi (cu TVA)</strong></p></td><td><p><strong>Prețul nou (cu TVA)</strong></p></td><td><p><strong>Diferența pe bucată</strong></p></td><td><p><strong>Diferența totală (+ / −)</strong></p></td></tr>
<tr><td><p>1</p></td><td><p>[produsul]</p></td><td><p>[buc]</p></td><td><p>[cantitatea]</p></td><td><p>[preț vechi]</p></td><td><p>[preț nou]</p></td><td><p>[diferența]</p></td><td><p>[cantitatea × diferența]</p></td></tr>
<tr><td><p>2</p></td><td><p>[produsul]</p></td><td><p>[buc]</p></td><td><p>[cantitatea]</p></td><td><p>[preț vechi]</p></td><td><p>[preț nou]</p></td><td><p>[diferența]</p></td><td><p>[cantitatea × diferența]</p></td></tr>
<tr><td><p></p></td><td><p><strong>Total</strong></p></td><td><p></p></td><td><p></p></td><td><p></p></td><td><p></p></td><td><p></p></td><td><p><strong>[total]</strong> lei, [în plus / în minus]</p></td></tr>
</tbody></table>
<p><strong>3. Efectul în gestiune.</strong> Valoarea stocului la preț de vânzare [crește / scade] cu <strong>[total] lei</strong> (cu TVA). Diferența se trece în evidența gestiunii (Sheets → Fișa de magazie) și în contabilitate la data de mai sus, iar marfa vândută de acum încolo se vinde la prețul nou.</p>
<p><strong>4. Etichetele și casa de marcat.</strong> Etichetele de la raft s-au schimbat la data de [data], ora [ora], iar prețurile noi s-au trecut în casa de marcat la [data], ora [ora]. Gestionarul a verificat prin sondaj că prețul de pe etichetă e același cu cel de pe bon.</p>
<p>Procesul-verbal s-a întocmit în [două] exemplare: unul pentru contabilitate, unul pentru gestiune.</p>
<p></p>
<p><strong>Comisia:</strong></p>
<p>[Nume și prenume], [funcția] · Semnătura: ____________</p>
<p>[Nume și prenume], [funcția] · Semnătura: ____________</p>
<p><strong>Gestionarul:</strong> [Nume și prenume] · Semnătura: ____________</p>
<p></p>
<p><em>Pașii schimbării prețurilor sunt în lista de bifat Notițe → Schimbarea prețurilor. Diferența în minus din reduceri nu e lipsă în gestiune, dacă e trecută în acest proces-verbal.</em></p>`,
  },
  {
    id: 'anunt-preturi',
    name: 'Anunțul modificării prețurilor către clienți',
    desc: 'Scrisoare către un client cu contract: de la ce dată se schimbă prețurile, de ce, tabelul cu prețul vechi și cel nou, reducerea lui și ce se întâmplă cu comenzile deja trimise, cu termenul în care poate răspunde',
    html: `
<p><strong>[Denumirea firmei]</strong><br>[Adresa sediului] · CUI [cod] · Nr. Reg. Com. [J../..../....]<br>Telefon [telefon] · E-mail [e-mail]</p>
<p>Nr. [nr.] din [data]</p>
<p></p>
<p>Către: <strong>[Denumirea clientului]</strong><br>[Adresa clientului] · CUI [cod]<br>În atenția: [Nume și prenume, funcția]</p>
<p></p>
<h1 style="text-align: center">ANUNȚ PRIVIND MODIFICAREA PREȚURILOR</h1>
<p style="text-align: center">de la data de [data]</p>
<p></p>
<p>Stimată doamnă / Stimate domn,</p>
<p>Vă mulțumim pentru colaborarea din contractul nr. [nr.] din [data]. Potrivit art. [nr.] din contract, vă anunțăm cu [număr] zile înainte că, de la data de <strong>[data]</strong>, prețurile produselor de mai jos se modifică din cauza [creșterii prețurilor la furnizori / creșterii costurilor de transport și energie / schimbării cotei de TVA].</p>
<table><tbody>
<tr><td><p><strong>Codul</strong></p></td><td><p><strong>Produsul</strong></p></td><td><p><strong>U.M.</strong></p></td><td><p><strong>Prețul de acum (fără TVA)</strong></p></td><td><p><strong>Prețul nou (fără TVA)</strong></p></td><td><p><strong>Diferența (%)</strong></p></td></tr>
<tr><td><p>[cod]</p></td><td><p>[produsul]</p></td><td><p>[buc]</p></td><td><p>[preț]</p></td><td><p>[preț]</p></td><td><p>[+ / − procent]</p></td></tr>
<tr><td><p>[cod]</p></td><td><p>[produsul]</p></td><td><p>[buc]</p></td><td><p>[preț]</p></td><td><p>[preț]</p></td><td><p>[+ / − procent]</p></td></tr>
<tr><td><p>[cod]</p></td><td><p>[produsul]</p></td><td><p>[buc]</p></td><td><p>[preț]</p></td><td><p>[preț]</p></td><td><p>[+ / − procent]</p></td></tr>
</tbody></table>
<p>Celelalte prețuri rămân neschimbate. Reducerea dumneavoastră de <strong>[procent]%</strong> din prețul de listă se păstrează și se aplică la prețurile noi. Lista completă de prețuri, valabilă de la data de mai sus, o găsiți atașată.</p>
<p><strong>Comenzile deja trimise.</strong> Comenzile primite până la data de [data] se livrează la prețurile de acum, chiar dacă livrarea are loc după această dată.</p>
<p>Dacă aveți întrebări sau doriți să discutăm cantitățile și prețurile pentru perioada următoare, vă rugăm să ne răspundeți până la data de [data], la [telefon] sau [e-mail].</p>
<p></p>
<p>Cu stimă,</p>
<p><strong>[Nume și prenume]</strong><br>[Funcția: administrator / director de vânzări]<br>Semnătura: ____________</p>
<p></p>
<p><em>Prețurile noi le luați din Sheets → Listă de prețuri pentru clienți (fără coloana cu prețul de achiziție). Termenul de anunțare e cel din contract; dacă nu e scris, anunțați cu cel puțin 30 de zile înainte.</em></p>`,
  },
  {
    id: 'diferenta-casa',
    name: 'Proces-verbal de constatare a diferenței de casă',
    desc: 'Când numerarul din sertar nu se potrivește cu raportul Z la închiderea zilei: casa de marcat, raportul Z, numerarul și cardul față de raport, lipsa sau plusul, explicația casierului și ce se face cu diferența',
    html: `
<p><strong>[Denumirea firmei]</strong><br>[Adresa punctului de lucru] · CUI [cod]</p>
<p></p>
<h1 style="text-align: center">PROCES-VERBAL DE CONSTATARE A DIFERENȚEI DE CASĂ</h1>
<p style="text-align: center">Nr. [nr.] din [data], ora [ora]</p>
<p></p>
<p>Subsemnații [Nume și prenume], [funcția: administrator / șef de magazin], și [Nume și prenume], casier, am verificat la închiderea zilei de [data] numerarul și plățile de la casa de marcat [modelul], seria [seria], aflată la [locul].</p>
<p><strong>1. Ce arată raportul Z și ce s-a găsit.</strong></p>
<table><tbody>
<tr><td><p><strong></strong></p></td><td><p><strong>Din raportul Z nr. [nr.] (lei)</strong></p></td><td><p><strong>Găsit / verificat (lei)</strong></p></td><td><p><strong>Diferența (lei)</strong></p></td></tr>
<tr><td><p>Numerar</p></td><td><p>[suma]</p></td><td><p>[suma numărată în sertar, fără fondul de rest]</p></td><td><p>[+ / − suma]</p></td></tr>
<tr><td><p>Card</p></td><td><p>[suma]</p></td><td><p>[suma din raportul terminalului POS]</p></td><td><p>[+ / − suma]</p></td></tr>
<tr><td><p><strong>Total</strong></p></td><td><p><strong>[suma]</strong></p></td><td><p><strong>[suma]</strong></p></td><td><p><strong>[+ / − suma]</strong></p></td></tr>
</tbody></table>
<p>S-a constatat o <strong>[lipsă / un plus]</strong> de <strong>[suma] lei</strong> (în litere: [suma în litere]). Fondul de rest de [suma] lei, primit la începutul zilei, nu intră în calcul.</p>
<p><strong>2. Explicația casierului.</strong> [de exemplu: rest dat greșit unui client / plată cu cardul înregistrată ca numerar / bon anulat după ce s-a încasat / nu știu de unde vine diferența]</p>
<p><strong>3. Ce se face cu diferența.</strong></p>
<p>☐ <strong>Lipsa</strong> se recuperează de la casier, cu acordul lui scris: [plătită azi în casierie / reținută din salariul lunii [luna]]; fără acord, se recuperează doar pe calea prevăzută de lege.</p>
<p>☐ <strong>Plusul</strong> se depune în casierie și se înregistrează la venituri, cu acest proces-verbal.</p>
<p>☐ Diferența de la card se lămurește cu banca până la data de [data].</p>
<p>Diferența se trece și în Sheets → Rapoartele Z ale casei de marcat, la ziua de mai sus. Procesul-verbal s-a întocmit în [două] exemplare: unul pentru contabilitate, unul pentru casier.</p>
<p></p>
<p><strong>Am constatat:</strong> [Nume și prenume], [funcția] · Semnătura: ____________</p>
<p><strong>Casierul:</strong> [Nume și prenume] · [De acord / Nu sunt de acord, pentru că …] · Semnătura: ____________</p>
<p></p>
<p><em>Pașii închiderii zilei sunt în lista de bifat Notițe → Închiderea zilei la casa de marcat. Pentru o lipsă găsită la inventarul mărfii folosiți Docs → Notă de constatare și evaluare a pagubei.</em></p>`,
  },
  {
    id: 'decont-avans',
    name: 'Decont al avansului de trezorerie',
    desc: 'Când un angajat justifică banii primiți din casierie: avansul primit, cheltuielile cu documentele lor, totalul justificat, ce dă înapoi sau ce mai primește, apoi verificarea, aprobarea și casieria',
    html: `
<p><strong>[Denumirea firmei]</strong><br>[Adresa sediului] · CUI [cod]</p>
<p></p>
<h1 style="text-align: center">DECONT AL AVANSULUI DE TREZORERIE</h1>
<p style="text-align: center">Nr. [nr.] din [data]</p>
<p></p>
<p>Subsemnatul [Nume și prenume], [funcția], am primit din casierie, cu dispoziția de plată nr. [nr.] din [data], un avans de <strong>[suma] lei</strong> pentru [scopul: deplasarea la … / cumpărarea de … / plăți mărunte], cu termen de justificare până la [data].</p>
<p><strong>1. Cheltuielile făcute.</strong></p>
<table><tbody>
<tr><td><p><strong>Nr.</strong></p></td><td><p><strong>Documentul (bon, factură, chitanță)</strong></p></td><td><p><strong>Nr. și data</strong></p></td><td><p><strong>Furnizorul</strong></p></td><td><p><strong>Ce s-a plătit</strong></p></td><td><p><strong>Suma (lei)</strong></p></td></tr>
<tr><td><p>1</p></td><td><p>[bon fiscal / factură]</p></td><td><p>[nr.] / [data]</p></td><td><p>[furnizorul]</p></td><td><p>[ce s-a plătit]</p></td><td><p>[suma]</p></td></tr>
<tr><td><p>2</p></td><td><p>[bon fiscal / factură]</p></td><td><p>[nr.] / [data]</p></td><td><p>[furnizorul]</p></td><td><p>[ce s-a plătit]</p></td><td><p>[suma]</p></td></tr>
<tr><td><p>3</p></td><td><p>[bon fiscal / factură]</p></td><td><p>[nr.] / [data]</p></td><td><p>[furnizorul]</p></td><td><p>[ce s-a plătit]</p></td><td><p>[suma]</p></td></tr>
<tr><td><p></p></td><td><p><strong>Total justificat</strong></p></td><td><p></p></td><td><p></p></td><td><p></p></td><td><p><strong>[suma]</strong></p></td></tr>
</tbody></table>
<p><strong>2. Diferența.</strong> Avans primit: [suma] lei · Total justificat: [suma] lei.</p>
<p>☐ <strong>Restitui în casierie</strong> [suma] lei (în litere: [suma în litere]), cu dispoziția de încasare nr. [nr.] din [data].</p>
<p>☐ <strong>Am cheltuit în plus</strong> [suma] lei, care mi se plătesc din casierie, cu dispoziția de plată nr. [nr.] din [data].</p>
<p>Documentele cheltuielilor sunt anexate, în original, în ordinea din tabel. Declar că sumele de mai sus au fost cheltuite numai pentru scopul pentru care am primit avansul.</p>
<p></p>
<p><strong>Titularul avansului:</strong> [Nume și prenume] · Data: [data] · Semnătura: ____________</p>
<p><strong>Verificat (contabilitate):</strong> [Nume și prenume] · Semnătura: ____________</p>
<p><strong>Aprobat (administrator):</strong> [Nume și prenume] · Semnătura: ____________</p>
<p><strong>Casier:</strong> [Nume și prenume] · Semnătura: ____________</p>
<p></p>
<p><em>Avansul se justifică în cel mult 3 zile lucrătoare de la întoarcere sau de la termenul stabilit. Pentru o deplasare, cheltuielile și diurna se calculează în Sheets → Decont de deplasare. Avansul și diferența se trec în Sheets → Avansuri de trezorerie și în Sheets → Registru de casă; pașii sunt în Notițe → Decontarea unui avans.</em></p>`,
  },
  {
    id: 'distributie-tichete',
    name: 'Stat de distribuire a tichetelor de masă',
    desc: 'Lista cu tichetele de masă date pe o lună: fiecare angajat cu zilele lucrate, numărul de tichete, valoarea, seriile sau cardul pe care s-au încărcat și semnătura de primire, cu totalul și semnăturile celor care le-au calculat și distribuit',
    html: `
<p><strong>[Denumirea firmei]</strong><br>[Adresa sediului] · CUI [cod]</p>
<p></p>
<h1 style="text-align: center">STAT DE DISTRIBUIRE A TICHETELOR DE MASĂ</h1>
<p style="text-align: center">pentru luna [luna] [anul]</p>
<p></p>
<p>Valoarea unui tichet: <strong>[valoarea] lei</strong> · Zile lucrătoare în lună: [numărul] · Emitentul tichetelor: [denumirea emitentului] · [Pe hârtie / Pe card electronic]</p>
<table><tbody>
<tr><td><p><strong>Nr.</strong></p></td><td><p><strong>Numele și prenumele</strong></p></td><td><p><strong>Zile lucrate</strong></p></td><td><p><strong>Număr de tichete</strong></p></td><td><p><strong>Valoarea (lei)</strong></p></td><td><p><strong>Seriile (de la – până la) sau cardul</strong></p></td><td><p><strong>Semnătura de primire</strong></p></td></tr>
<tr><td><p>1</p></td><td><p>[Nume și prenume]</p></td><td><p>[zile]</p></td><td><p>[număr]</p></td><td><p>[valoarea]</p></td><td><p>[seria] – [seria] / card nr. [nr.]</p></td><td><p></p></td></tr>
<tr><td><p>2</p></td><td><p>[Nume și prenume]</p></td><td><p>[zile]</p></td><td><p>[număr]</p></td><td><p>[valoarea]</p></td><td><p>[seria] – [seria] / card nr. [nr.]</p></td><td><p></p></td></tr>
<tr><td><p>3</p></td><td><p>[Nume și prenume]</p></td><td><p>[zile]</p></td><td><p>[număr]</p></td><td><p>[valoarea]</p></td><td><p>[seria] – [seria] / card nr. [nr.]</p></td><td><p></p></td></tr>
<tr><td><p></p></td><td><p><strong>Total</strong></p></td><td><p></p></td><td><p><strong>[număr]</strong></p></td><td><p><strong>[valoarea]</strong></p></td><td><p></p></td><td><p></p></td></tr>
</tbody></table>
<p>Tichetele s-au acordat numai pentru zilele lucrate efectiv în luna [luna], după pontaj. Diferențele față de luna trecută (tichete date în plus sau în minus) au fost regularizate: [nu au fost diferențe / angajatul [Nume și prenume]: [număr] tichete [scăzute / adăugate]].</p>
<p>Tichetele rămase nedistribuite ([număr] bucăți, seriile [seria] – [seria]) [rămân în casierie pentru luna viitoare / se restituie emitentului în termenul din contract].</p>
<p></p>
<p><strong>Întocmit (calculul tichetelor):</strong> [Nume și prenume], [funcția] · Semnătura: ____________</p>
<p><strong>Distribuit:</strong> [Nume și prenume], [funcția] · Semnătura: ____________</p>
<p><strong>Aprobat (administrator):</strong> [Nume și prenume] · Semnătura: ____________</p>
<p></p>
<p><em>Numărul de tichete cuvenite fiecărui angajat și diferențele de regularizat le calculați în Sheets → Tichete de masă; valoarea tichetelor intră în Sheets → Stat de plată pentru CASS și impozit. Pașii lunii sunt în lista de bifat Notițe → Tichetele de masă ale lunii.</em></p>`,
  },
  {
    id: 'decont-protocol',
    name: 'Decont al cheltuielilor de protocol',
    desc: 'Justificarea unei mese de afaceri, a unor cadouri sau gustări pentru parteneri: partenerul, ocazia, participanții și scopul întâlnirii, documentele cu valoarea și TVA-ul, totalul, cine a plătit și aprobarea administratorului',
    html: `
<p><strong>[Denumirea firmei]</strong><br>[Adresa sediului] · CUI [cod]</p>
<p></p>
<h1 style="text-align: center">DECONT AL CHELTUIELILOR DE PROTOCOL</h1>
<p style="text-align: center">Nr. [număr] din [data]</p>
<p></p>
<p><strong>Partenerul:</strong> [denumirea firmei partenere sau persoana] · <strong>Data întâlnirii:</strong> [data] · <strong>Locul:</strong> [localitatea, localul sau sediul]</p>
<p><strong>Ocazia și scopul:</strong> [negocierea unui contract / prezentarea unei oferte / vizita unui client / sărbătoare / altă ocazie, pe scurt]</p>
<p><strong>Participanții din partea firmei:</strong> [Nume și prenume, funcția]; [Nume și prenume, funcția]</p>
<p><strong>Participanții din partea partenerului:</strong> [Nume și prenume, funcția]; [Nume și prenume, funcția]</p>
<p></p>
<table><tbody>
<tr><td><p><strong>Nr.</strong></p></td><td><p><strong>Documentul (factură / bon, nr. și data)</strong></p></td><td><p><strong>Furnizorul</strong></p></td><td><p><strong>Felul cheltuielii</strong></p></td><td><p><strong>Valoarea fără TVA (lei)</strong></p></td><td><p><strong>TVA (lei)</strong></p></td><td><p><strong>Total (lei)</strong></p></td></tr>
<tr><td><p>1</p></td><td><p>[nr.] / [data]</p></td><td><p>[furnizorul]</p></td><td><p>[Masă de afaceri / Cadouri / Băuturi și gustări]</p></td><td><p>[valoarea]</p></td><td><p>[TVA]</p></td><td><p>[total]</p></td></tr>
<tr><td><p>2</p></td><td><p>[nr.] / [data]</p></td><td><p>[furnizorul]</p></td><td><p>[felul]</p></td><td><p>[valoarea]</p></td><td><p>[TVA]</p></td><td><p>[total]</p></td></tr>
<tr><td><p>3</p></td><td><p>[nr.] / [data]</p></td><td><p>[furnizorul]</p></td><td><p>[felul]</p></td><td><p>[valoarea]</p></td><td><p>[TVA]</p></td><td><p>[total]</p></td></tr>
<tr><td><p></p></td><td><p><strong>Total</strong></p></td><td><p></p></td><td><p></p></td><td><p><strong>[valoarea]</strong></p></td><td><p><strong>[TVA]</strong></p></td><td><p><strong>[total]</strong></p></td></tr>
</tbody></table>
<p>Cadourile date partenerilor: [nu s-au dat cadouri / [obiectul], [număr] bucăți, câte [valoarea] lei, date lui [Nume și prenume, firma]].</p>
<p>Cheltuiala a fost plătită [cu cardul firmei / din casierie / din avansul de trezorerie al lui [Nume și prenume] / de angajat, cu decontare ulterioară].</p>
<p></p>
<p><strong>Întocmit:</strong> [Nume și prenume], [funcția] · Semnătura: ____________</p>
<p><strong>Aprobat (administrator):</strong> [Nume și prenume] · Semnătura: ____________</p>
<p></p>
<p><em>Se atașează facturile și bonurile. Cheltuiala se trece în Sheets → Cheltuieli de protocol, unde se vede și limita deductibilă de 2%; dacă a fost plătită dintr-un avans, se justifică și în Docs → Decont al avansului de trezorerie. Pașii sunt în Notițe → O cheltuială de protocol.</em></p>`,
  },
  {
    id: 'parteneriat-unitate-protejata',
    name: 'Contract de parteneriat cu o unitate protejată',
    desc: 'Contractul firmei cu o unitate protejată autorizată, din care cumpără produse sau servicii făcute de persoane cu dizabilități în locul contribuției lunare pentru locurile neocupate: părțile, autorizația unității, ce se cumpără, valoarea pe lună, facturarea și plata, durata și semnăturile',
    html: `
<h1 style="text-align: center">CONTRACT DE PARTENERIAT</h1>
<p style="text-align: center">pentru achiziția de produse și servicii de la o unitate protejată autorizată</p>
<p style="text-align: center">Nr. [număr] din [data]</p>
<p></p>
<h2>1. Părțile</h2>
<p><strong>[Denumirea firmei]</strong>, cu sediul în [adresa], CUI [cod], Nr. Registrul Comerțului [J../…/….], cont IBAN [IBAN] deschis la [banca], reprezentată prin [Nume și prenume], în calitate de [administrator], numită în continuare <strong>Beneficiarul</strong>,</p>
<p>și</p>
<p><strong>[Denumirea unității protejate]</strong>, cu sediul în [adresa], CUI [cod], autorizată ca unitate protejată prin autorizația nr. [număr] din [data], valabilă până la [data], cont IBAN [IBAN] deschis la [banca], reprezentată prin [Nume și prenume], în calitate de [funcția], numită în continuare <strong>Unitatea protejată</strong>,</p>
<p>au încheiat prezentul contract de parteneriat.</p>
<h2>2. Obiectul contractului</h2>
<p>Unitatea protejată livrează Beneficiarului produse sau prestează servicii realizate prin activitatea proprie a persoanelor cu dizabilități angajate de ea, după cum urmează:</p>
<table><tbody>
<tr><td><p><strong>Nr.</strong></p></td><td><p><strong>Produsul sau serviciul</strong></p></td><td><p><strong>U.M.</strong></p></td><td><p><strong>Cantitatea pe lună</strong></p></td><td><p><strong>Prețul unitar (lei)</strong></p></td><td><p><strong>Valoarea pe lună (lei)</strong></p></td></tr>
<tr><td><p>1</p></td><td><p>[produsul / serviciul]</p></td><td><p>[buc. / ore / lună]</p></td><td><p>[cantitatea]</p></td><td><p>[preț]</p></td><td><p>[valoare]</p></td></tr>
<tr><td><p>2</p></td><td><p>[produsul / serviciul]</p></td><td><p>[buc. / ore / lună]</p></td><td><p>[cantitatea]</p></td><td><p>[preț]</p></td><td><p>[valoare]</p></td></tr>
<tr><td><p></p></td><td><p><strong>Total pe lună</strong></p></td><td><p></p></td><td><p></p></td><td><p></p></td><td><p><strong>[valoare]</strong></p></td></tr>
</tbody></table>
<h2>3. Valoarea, facturarea și plata</h2>
<p>Valoarea estimată a contractului este de [suma] lei pe lună, fără TVA. Unitatea protejată emite factura lunar, până la data de [ziua] a lunii, cu mențiunea că produsele sau serviciile sunt realizate prin activitatea proprie a persoanelor cu dizabilități angajate în unitatea protejată. Beneficiarul plătește factura în [număr] zile de la primire, prin virament bancar.</p>
<h2>4. Obligațiile părților</h2>
<p>Unitatea protejată păstrează autorizația valabilă pe toată durata contractului, anunță Beneficiarul în [5] zile despre orice schimbare a ei și livrează la termenele și calitatea stabilite. Beneficiarul primește produsele sau serviciile, le verifică la primire și plătește la termen.</p>
<h2>5. Durata contractului</h2>
<p>Contractul se încheie pe perioada [de la] – [până la] și se poate prelungi prin act adițional. Oricare parte îl poate denunța cu un preaviz de [30] de zile. Contractul încetează de drept dacă autorizația Unității protejate expiră sau este retrasă.</p>
<h2>6. Alte clauze</h2>
<p>Neînțelegerile se rezolvă pe cale amiabilă, iar dacă nu este posibil, de instanța competentă de la sediul [Beneficiarului]. Contractul s-a încheiat în două exemplare, câte unul pentru fiecare parte.</p>
<p></p>
<table><tbody>
<tr><td><p><strong>Beneficiarul</strong><br>[Denumirea firmei]<br>[Nume și prenume], [funcția]<br>Semnătura: ____________</p></td><td><p><strong>Unitatea protejată</strong><br>[Denumirea unității protejate]<br>[Nume și prenume], [funcția]<br>Semnătura: ____________</p></td></tr>
</tbody></table>
<p></p>
<p><em>Valoarea achizițiilor din fiecare lună se trece în Sheets → Contribuția pentru persoanele cu dizabilități, unde se scade din suma datorată; pașii lunii sunt în Notițe → Contribuția pentru persoanele cu dizabilități. Verificați autorizația unității în registrul unităților protejate și condițiile legale de azi cu contabilul.</em></p>`,
  },
  {
    id: 'atestare-fiscala-locala',
    name: 'Cerere pentru certificatul de atestare fiscală (impozite locale)',
    desc: 'Cererea firmei către direcția de taxe și impozite locale a primăriei pentru certificatul care arată că nu are datorii la impozitele pe clădiri, terenuri și mașini: scopul (licitație, credit, vânzarea unui bun, alt motiv), bunurile pentru care se cere, cum se ridică certificatul și actele anexate',
    html: `
<p><strong>[Denumirea firmei]</strong><br>[Adresa sediului] · CUI [cod] · Nr. Registrul Comerțului [J../…/….]<br>Telefon [telefon] · E-mail [e-mail]</p>
<p>Nr. [număr] din [data]</p>
<p></p>
<p><strong>Către: Primăria [localitatea] – Direcția de taxe și impozite locale</strong></p>
<p></p>
<h1 style="text-align: center">CERERE PENTRU ELIBERAREA CERTIFICATULUI DE ATESTARE FISCALĂ</h1>
<p></p>
<p>Subscrisa <strong>[Denumirea firmei]</strong>, cu sediul în [adresa], CUI [cod], reprezentată legal prin [Nume și prenume], în calitate de [administrator], vă rog să eliberați certificatul de atestare fiscală privind impozitele și taxele locale datorate bugetului local, necesar pentru <strong>[participarea la o licitație / obținerea unui credit / vânzarea unei clădiri sau a unui teren / înscrierea mașinii la altă adresă / alt scop]</strong>.</p>
<p></p>
<p>Bunurile pentru care se cere certificatul:</p>
<table><tbody>
<tr><td><p><strong>Nr.</strong></p></td><td><p><strong>Bunul</strong></p></td><td><p><strong>Felul</strong></p></td><td><p><strong>Adresa sau numărul de înmatriculare</strong></p></td><td><p><strong>Nr. de rol fiscal</strong></p></td></tr>
<tr><td><p>1</p></td><td><p>[bunul]</p></td><td><p>[clădire / teren / mijloc de transport]</p></td><td><p>[adresa / numărul]</p></td><td><p>[rolul]</p></td></tr>
<tr><td><p>2</p></td><td><p>[bunul]</p></td><td><p>[clădire / teren / mijloc de transport]</p></td><td><p>[adresa / numărul]</p></td><td><p>[rolul]</p></td></tr>
<tr><td><p>3</p></td><td><p>[bunul]</p></td><td><p>[clădire / teren / mijloc de transport]</p></td><td><p>[adresa / numărul]</p></td><td><p>[rolul]</p></td></tr>
</tbody></table>
<p></p>
<p>Doresc ca certificatul să fie: [ridicat de la ghișeu de [Nume și prenume], pe baza împuternicirii anexate / trimis prin poștă la adresa sediului / trimis electronic la adresa [e-mail]].</p>
<p></p>
<p>Anexez:</p>
<ul>
<li><p>copia certificatului de înregistrare a firmei;</p></li>
<li><p>împuternicirea persoanei care depune cererea și ridică certificatul, cu copia actului ei de identitate;</p></li>
<li><p>dovada plății taxei pentru eliberarea certificatului, dacă primăria o cere: [suma] lei, [documentul de plată].</p></li>
</ul>
<p></p>
<p><strong>[Denumirea firmei]</strong>, prin [Nume și prenume], [funcția]</p>
<p>Semnătura și ștampila: ____________</p>
<p></p>
<p><em>Înainte de cerere, verificați că nu sunt restanțe în Sheets → Impozite și taxe locale (starea „Restant” iese în roșu); pașii anului sunt în Notițe → Plata impozitelor locale. Termenul de eliberare, taxa și formularul cerut diferă de la o primărie la alta: întrebați la ghișeu sau pe site-ul primăriei.</em></p>`,
  },
  {
    id: 'restituire-garantie-be',
    name: 'Cerere de restituire a garanției de bună execuție',
    desc: 'Cererea firmei către client, la sfârșitul perioadei de garanție a lucrării, pentru banii reținuți din facturi ca garanție de bună execuție: contractul, recepțiile, tabelul sumelor reținute pe facturi, suma de restituit, contul în care se plătește și actele anexate',
    html: `
<p><strong>[Denumirea firmei]</strong><br>[Adresa sediului] · CUI [cod] · Nr. Registrul Comerțului [J../…/….]<br>Telefon [telefon] · E-mail [e-mail]</p>
<p>Nr. [număr] din [data]</p>
<p></p>
<p><strong>Către: [Denumirea clientului]</strong>, [adresa], CUI [cod]<br>În atenția: [Nume și prenume], [funcția]</p>
<p></p>
<h1 style="text-align: center">CERERE DE RESTITUIRE A GARANȚIEI DE BUNĂ EXECUȚIE</h1>
<p></p>
<p>Subscrisa <strong>[Denumirea firmei]</strong>, reprezentată legal prin [Nume și prenume], în calitate de [administrator], în baza contractului nr. [număr] din [data], având ca obiect <strong>[lucrarea / serviciile]</strong>, vă rog să restituiți garanția de bună execuție reținută din facturile noastre.</p>
<p></p>
<p>Lucrările au fost recepționate la terminare prin procesul-verbal nr. [număr] din [data], iar perioada de garanție de [număr] luni, prevăzută la art. [articolul] din contract, s-a încheiat la data de [data]. [Recepția finală a avut loc prin procesul-verbal nr. [număr] din [data], fără obiecții.] În perioada de garanție nu ne-au fost semnalate defecte nerezolvate.</p>
<p></p>
<p>Sumele reținute ca garanție de bună execuție:</p>
<table><tbody>
<tr><td><p><strong>Nr.</strong></p></td><td><p><strong>Factura (număr și dată)</strong></p></td><td><p><strong>Valoarea facturii (lei)</strong></p></td><td><p><strong>Procentul reținut</strong></p></td><td><p><strong>Suma reținută (lei)</strong></p></td></tr>
<tr><td><p>1</p></td><td><p>[factura]</p></td><td><p>[valoare]</p></td><td><p>[%]</p></td><td><p>[suma]</p></td></tr>
<tr><td><p>2</p></td><td><p>[factura]</p></td><td><p>[valoare]</p></td><td><p>[%]</p></td><td><p>[suma]</p></td></tr>
<tr><td><p>3</p></td><td><p>[factura]</p></td><td><p>[valoare]</p></td><td><p>[%]</p></td><td><p>[suma]</p></td></tr>
<tr><td><p></p></td><td><p><strong>Total reținut</strong></p></td><td><p></p></td><td><p></p></td><td><p><strong>[suma]</strong></p></td></tr>
</tbody></table>
<p></p>
<p>Vă rugăm să virați suma de <strong>[suma] lei</strong> ([suma în litere]) în contul nostru IBAN [IBAN], deschis la [banca], în termen de [număr] zile de la primirea cererii, cum prevede contractul. [Dacă garanția a fost constituită printr-un cont deschis la dispoziția dumneavoastră, vă rugăm să dispuneți eliberarea sumei din acel cont.]</p>
<p></p>
<p>Anexez:</p>
<ul>
<li><p>copia procesului-verbal de recepție la terminarea lucrărilor [și a procesului-verbal de recepție finală];</p></li>
<li><p>lista facturilor din care s-a reținut garanția;</p></li>
<li><p>[alte documente cerute de contract].</p></li>
</ul>
<p></p>
<p><strong>[Denumirea firmei]</strong>, prin [Nume și prenume], [funcția]</p>
<p>Semnătura și ștampila: ____________</p>
<p></p>
<p><em>Sumele reținute pe fiecare contract și data la care se eliberează sunt în Sheets → Garanții de bună execuție (starea „De cerut înapoi” iese în roșu). Condițiile de restituire (recepția finală, termenul de plată, scrisoarea de garanție bancară) sunt cele din contract: verificați-le înainte de trimitere.</em></p>`,
  },
  {
    id: 'ore-suplimentare',
    name: 'Solicitare de efectuare a orelor suplimentare',
    desc: 'Cererea firmei către angajați pentru ore lucrate peste program: motivul, zilele și orele pentru fiecare angajat, cum se compensează (timp liber în 60 de zile sau plată cu spor), acordul semnat al fiecărui angajat și aprobarea administratorului',
    html: `
<p><strong>[Denumirea firmei]</strong><br>[Adresa sediului] · CUI [cod]</p>
<p></p>
<h1 style="text-align: center">SOLICITARE DE EFECTUARE A ORELOR SUPLIMENTARE</h1>
<p style="text-align: center">Nr. [număr] din [data]</p>
<p></p>
<p>Având în vedere [volumul mare de comenzi / inventarul anual / o lucrare urgentă / înlocuirea unui coleg absent / alt motiv], vă solicităm să lucrați ore suplimentare în perioada <strong>[de la] – [până la]</strong>, după cum urmează:</p>
<table><tbody>
<tr><td><p><strong>Nr.</strong></p></td><td><p><strong>Angajatul</strong></p></td><td><p><strong>Funcția</strong></p></td><td><p><strong>Ziua (zilele)</strong></p></td><td><p><strong>Ore suplimentare</strong></p></td><td><p><strong>Compensarea</strong></p></td><td><p><strong>De acord (semnătura)</strong></p></td></tr>
<tr><td><p>1</p></td><td><p>[Nume și prenume]</p></td><td><p>[funcția]</p></td><td><p>[data / zilele]</p></td><td><p>[ore]</p></td><td><p>[timp liber / plată cu spor]</p></td><td><p></p></td></tr>
<tr><td><p>2</p></td><td><p>[Nume și prenume]</p></td><td><p>[funcția]</p></td><td><p>[data / zilele]</p></td><td><p>[ore]</p></td><td><p>[timp liber / plată cu spor]</p></td><td><p></p></td></tr>
<tr><td><p>3</p></td><td><p>[Nume și prenume]</p></td><td><p>[funcția]</p></td><td><p>[data / zilele]</p></td><td><p>[ore]</p></td><td><p>[timp liber / plată cu spor]</p></td><td><p></p></td></tr>
<tr><td><p></p></td><td><p><strong>Total</strong></p></td><td><p></p></td><td><p></p></td><td><p><strong>[ore]</strong></p></td><td><p></p></td><td><p></p></td></tr>
</tbody></table>
<p></p>
<p>Orele suplimentare se compensează cu timp liber plătit în următoarele [60] de zile calendaristice; dacă acest lucru nu este posibil, se plătesc cu un spor de [75]% din salariul de bază, odată cu salariul lunii [luna].</p>
<p>Durata muncii, inclusiv orele suplimentare, nu va depăși 48 de ore pe săptămână, calculată ca medie pe perioada de referință. Orele suplimentare se fac numai cu acordul angajatului, dat prin semnătură în tabelul de mai sus.</p>
<p></p>
<p><strong>Întocmit:</strong> [Nume și prenume], [funcția] · Semnătura: ____________</p>
<p><strong>Aprobat (administrator):</strong> [Nume și prenume] · Semnătura: ____________</p>
<p></p>
<p><em>Orele lucrate efectiv se trec în Sheets → Ore suplimentare, unde se văd termenul de compensare, orele rămase și suma de plată, și în Sheets → Pontaj lunar. Pașii de la sfârșitul lunii sunt în Notițe → Orele suplimentare ale lunii. Regulile din contractul colectiv sau din regulamentul intern pot fi mai bune pentru angajat: verificați-le cu contabilul.</em></p>`,
  },
  {
    id: 'recuperare-fnuass',
    name: 'Cerere de recuperare a indemnizațiilor din FNUASS',
    desc: 'Cererea firmei către casa de asigurări de sănătate pentru banii plătiți angajaților în concediu medical și nerecuperați din contribuții: luna, declarația 112, certificatele cu zilele și sumele din FNUASS, totalul cerut, contul bancar și actele anexate',
    html: `
<p><strong>[Denumirea firmei]</strong><br>[Adresa sediului] · CUI [cod] · Nr. Registrul Comerțului [J../…/….]<br>Telefon [telefon] · E-mail [e-mail]</p>
<p>Nr. [număr] din [data]</p>
<p></p>
<p><strong>Către: Casa de Asigurări de Sănătate a județului [județul] / a municipiului București</strong></p>
<p></p>
<h1 style="text-align: center">CERERE DE RECUPERARE A INDEMNIZAȚIILOR DE CONCEDIU MEDICAL DIN FNUASS</h1>
<p></p>
<p>Subscrisa <strong>[Denumirea firmei]</strong>, cu sediul în [adresa], CUI [cod], reprezentată legal prin [Nume și prenume], în calitate de [administrator], vă rog să aprobați restituirea sumei de <strong>[suma] lei</strong>, reprezentând indemnizațiile de concediu medical plătite angajaților noștri pentru luna <strong>[luna] [anul]</strong>, care se suportă din Fondul național unic de asigurări sociale de sănătate (FNUASS) și nu au putut fi recuperate din contribuția datorată pentru aceeași lună.</p>
<p>Indemnizațiile au fost declarate în declarația 112 nr. [număr de înregistrare] din [data depunerii].</p>
<p></p>
<table><tbody>
<tr><td><p><strong>Nr.</strong></p></td><td><p><strong>Angajatul</strong></p></td><td><p><strong>Certificatul (seria și nr.)</strong></p></td><td><p><strong>Codul indemnizației</strong></p></td><td><p><strong>Perioada</strong></p></td><td><p><strong>Zile din FNUASS</strong></p></td><td><p><strong>Suma din FNUASS (lei)</strong></p></td></tr>
<tr><td><p>1</p></td><td><p>[Nume și prenume]</p></td><td><p>[seria] [nr.]</p></td><td><p>[cod]</p></td><td><p>[de la] – [până la]</p></td><td><p>[zile]</p></td><td><p>[suma]</p></td></tr>
<tr><td><p>2</p></td><td><p>[Nume și prenume]</p></td><td><p>[seria] [nr.]</p></td><td><p>[cod]</p></td><td><p>[de la] – [până la]</p></td><td><p>[zile]</p></td><td><p>[suma]</p></td></tr>
<tr><td><p>3</p></td><td><p>[Nume și prenume]</p></td><td><p>[seria] [nr.]</p></td><td><p>[cod]</p></td><td><p>[de la] – [până la]</p></td><td><p>[zile]</p></td><td><p>[suma]</p></td></tr>
<tr><td><p></p></td><td><p><strong>Total</strong></p></td><td><p></p></td><td><p></p></td><td><p></p></td><td><p><strong>[zile]</strong></p></td><td><p><strong>[suma]</strong></p></td></tr>
</tbody></table>
<p></p>
<p>Suma de [suma] lei vă rog să o virați în contul <strong>[IBAN]</strong>, deschis la [banca], pe numele firmei.</p>
<p><strong>Anexăm:</strong></p>
<ul><li><p>copiile certificatelor de concediu medical din tabel;</p></li><li><p>copia declarației 112 pentru luna [luna] [anul], cu dovada depunerii;</p></li><li><p>situația calculului indemnizațiilor (media zilnică, procentul, zilele și sumele);</p></li><li><p>[alte acte cerute de casa de asigurări de sănătate].</p></li></ul>
<p></p>
<p><strong>Reprezentant legal:</strong> [Nume și prenume], [funcția] · Semnătura și ștampila: ____________</p>
<p><strong>Persoana de contact:</strong> [Nume și prenume], telefon [telefon]</p>
<p></p>
<p><em>Calculul se face în Sheets → Concedii medicale (coloanele Zile din FNUASS și Suma din FNUASS); pașii pentru fiecare certificat sunt în Notițe → Un concediu medical. Formularul exact, termenul de depunere și actele cerute pot diferi de la o casă de sănătate la alta: verificați-le cu contabilul sau pe pagina casei de sănătate a județului.</em></p>`,
  },
  {
    id: 'predare-efecte',
    name: 'Proces-verbal de predare-primire a biletelor la ordin',
    desc: 'Când un client dă bilete la ordin sau cecuri pentru facturile lui: fiecare bilet cu seria, banca, data emiterii, scadența, suma și factura pentru care se dă, totalul, starea în care s-au predat și semnăturile celor două părți',
    html: `
<p><strong>[Denumirea firmei]</strong><br>[Adresa sediului] · CUI [cod] · Nr. Reg. Com. [J../..../....]</p>
<p></p>
<h1 style="text-align: center">PROCES-VERBAL DE PREDARE-PRIMIRE</h1>
<p style="text-align: center">a biletelor la ordin și a cecurilor<br>Nr. [nr.] din [data]</p>
<p></p>
<p>Încheiat azi, [data], la [locul], între:</p>
<p><strong>[Denumirea clientului]</strong>, CUI [cod], cu sediul în [adresa], reprezentată de [Nume și prenume], [funcția], în calitate de <strong>predător</strong> (emitentul biletelor), și</p>
<p><strong>[Denumirea firmei]</strong>, CUI [cod], cu sediul în [adresa], reprezentată de [Nume și prenume], [funcția], în calitate de <strong>primitor</strong> (beneficiarul biletelor).</p>
<p><strong>1. Ce s-a predat.</strong> Predătorul a predat, iar primitorul a primit, în original, următoarele bilete la ordin și cecuri:</p>
<table><tbody>
<tr><td><p><strong>Nr.</strong></p></td><td><p><strong>Tipul</strong></p></td><td><p><strong>Seria și numărul</strong></p></td><td><p><strong>Banca emitentului</strong></p></td><td><p><strong>Data emiterii</strong></p></td><td><p><strong>Scadența</strong></p></td><td><p><strong>Suma (lei)</strong></p></td><td><p><strong>Pentru factura (nr. / data)</strong></p></td></tr>
<tr><td><p>1</p></td><td><p>[bilet la ordin / cec]</p></td><td><p>[seria] [nr.]</p></td><td><p>[banca]</p></td><td><p>[data]</p></td><td><p>[data]</p></td><td><p>[suma]</p></td><td><p>[nr.] / [data]</p></td></tr>
<tr><td><p>2</p></td><td><p>[bilet la ordin / cec]</p></td><td><p>[seria] [nr.]</p></td><td><p>[banca]</p></td><td><p>[data]</p></td><td><p>[data]</p></td><td><p>[suma]</p></td><td><p>[nr.] / [data]</p></td></tr>
<tr><td><p>3</p></td><td><p>[bilet la ordin / cec]</p></td><td><p>[seria] [nr.]</p></td><td><p>[banca]</p></td><td><p>[data]</p></td><td><p>[data]</p></td><td><p>[suma]</p></td><td><p>[nr.] / [data]</p></td></tr>
<tr><td><p></p></td><td><p><strong>Total</strong></p></td><td><p></p></td><td><p></p></td><td><p></p></td><td><p></p></td><td><p><strong>[suma]</strong></p></td><td><p></p></td></tr>
</tbody></table>
<p>Totalul predat: <strong>[suma] lei</strong> (în litere: [suma în litere]).</p>
<p><strong>2. Starea lor.</strong> Biletele și cecurile de mai sus au fost verificate la predare: sunt completate integral, cu suma scrisă la fel în cifre și în litere, au data și locul emiterii, scadența, locul plății, beneficiarul, semnătura și ștampila emitentului, și nu au ștersături sau corecturi.</p>
<p><strong>3. Plata facturilor.</strong> Facturile din tabel se consideră plătite numai după ce sumele de pe bilete și cecuri sunt încasate efectiv în contul primitorului. Dacă un bilet sau un cec este refuzat la plată, factura rămâne neplătită, cu penalitățile din contract, iar primitorul poate cere plata pe baza biletului refuzat.</p>
<p>Prezentul proces-verbal s-a încheiat în două exemplare, câte unul pentru fiecare parte.</p>
<p></p>
<p><strong>Am predat (predătorul):</strong> [Nume și prenume], [funcția] · Semnătura și ștampila: ____________</p>
<p><strong>Am primit (primitorul):</strong> [Nume și prenume], [funcția] · Semnătura și ștampila: ____________</p>
<p></p>
<p><em>Biletele primite se trec în Sheets → Bilete la ordin și cecuri, cu scadența fiecăruia; ce trebuie verificat la primire și la scadență e în lista de bifat Notițe → Primirea unui bilet la ordin. Pentru un bilet refuzat la plată folosiți Docs → Somație de plată.</em></p>`,
  },
  {
    id: 'decizie-promotie',
    name: 'Decizie de organizare a unei promoții',
    desc: 'Decizia administratorului pentru o promoție în magazin: perioada, unde se aplică, produsele cu prețul anterior (cel mai mic din ultimele 30 de zile) și prețul redus, stocul alocat, cum se afișează reducerea și cine răspunde de etichete și de casa de marcat',
    html: `
<p><strong>[Denumirea firmei]</strong><br>[Adresa sediului] · CUI [cod] · Nr. Reg. Com. [J../..../....]</p>
<p></p>
<h1 style="text-align: center">DECIZIA NR. [nr.]</h1>
<p style="text-align: center">din [data]<br>privind organizarea promoției „[numele promoției]”</p>
<p></p>
<p>Subsemnatul [Nume și prenume], în calitate de administrator al [denumirea firmei], având în vedere [stocul mare de / lansarea / sezonul / lichidarea] [produsele] și calculul marjelor din Sheets → Promoții și reduceri,</p>
<p style="text-align: center"><strong>DECID:</strong></p>
<p><strong>Art. 1. Perioada și locul.</strong> Se organizează promoția „[numele promoției]” în perioada <strong>[data] – [data]</strong> (inclusiv), în [toate magazinele / magazinul din …] și [în magazinul online], în limita stocului alocat.</p>
<p><strong>Art. 2. Produsele și prețurile.</strong> Reducerile se aplică produselor din tabelul de mai jos. Prețul anterior este cel mai mic preț practicat pentru același produs în ultimele 30 de zile înainte de reducere.</p>
<table><tbody>
<tr><td><p><strong>Nr.</strong></p></td><td><p><strong>Codul</strong></p></td><td><p><strong>Produsul</strong></p></td><td><p><strong>Prețul anterior (cu TVA)</strong></p></td><td><p><strong>Reducerea (%)</strong></p></td><td><p><strong>Prețul promoțional (cu TVA)</strong></p></td><td><p><strong>Stocul alocat</strong></p></td></tr>
<tr><td><p>1</p></td><td><p>[cod]</p></td><td><p>[produsul]</p></td><td><p>[preț]</p></td><td><p>[procent]</p></td><td><p>[preț]</p></td><td><p>[cantitatea]</p></td></tr>
<tr><td><p>2</p></td><td><p>[cod]</p></td><td><p>[produsul]</p></td><td><p>[preț]</p></td><td><p>[procent]</p></td><td><p>[preț]</p></td><td><p>[cantitatea]</p></td></tr>
<tr><td><p>3</p></td><td><p>[cod]</p></td><td><p>[produsul]</p></td><td><p>[preț]</p></td><td><p>[procent]</p></td><td><p>[preț]</p></td><td><p>[cantitatea]</p></td></tr>
</tbody></table>
<p><strong>Art. 3. Afișarea.</strong> Pe eticheta fiecărui produs din promoție se afișează, la vedere, prețul anterior tăiat, prețul promoțional și perioada promoției. Reducerea nu se cumulează cu alte reduceri [sau: se cumulează cu reducerea clienților cu card de fidelitate].</p>
<p><strong>Art. 4. Etichetele și casa de marcat.</strong> [Nume și prenume], [funcția], schimbă etichetele și trece prețurile promoționale în casa de marcat la începutul promoției, iar la sfârșitul ei readuce prețurile normale, pe etichete și în casa de marcat, în aceeași zi. Diferențele de preț se trec în proces-verbal (Docs → Proces-verbal de modificare a prețurilor).</p>
<p><strong>Art. 5. Urmărirea.</strong> [Nume și prenume], [funcția], urmărește zilnic vânzările și stocul produselor din promoție și prezintă la sfârșit rezultatul promoției (bucăți vândute, încasări, marja rămasă).</p>
<p><strong>Art. 6.</strong> Prezenta decizie se comunică persoanelor de mai sus și gestionarilor magazinelor, care răspund de aplicarea ei.</p>
<p></p>
<p><strong>Administrator,</strong><br>[Nume și prenume]<br>Semnătura: ____________</p>
<p></p>
<p><strong>Am luat la cunoștință:</strong></p>
<p>[Nume și prenume], [funcția] · Data: [data] · Semnătura: ____________</p>
<p>[Nume și prenume], [funcția] · Data: [data] · Semnătura: ____________</p>
<p></p>
<p><em>Marjele pe fiecare produs le vedeți în Sheets → Promoții și reduceri: produsele „Sub cost” se vând în pierdere. Pașii promoției sunt în lista de bifat Notițe → Pregătirea unei promoții.</em></p>`,
  },
  {
    id: 'sold-ambalaje',
    name: 'Confirmarea soldului de ambalaje returnabile',
    desc: 'Către un client sau un furnizor: câți paleți, navete sau lăzi ale fiecăruia sunt la celălalt la o dată, cu garanția lor, și cererea de confirmare sau de obiecții într-un termen, apoi cum se face returul sau decontarea',
    html: `
<p><strong>[Denumirea firmei]</strong><br>[Adresa sediului] · CUI [cod] · Nr. Reg. Com. [J../..../....]<br>Telefon [telefon] · E-mail [e-mail]</p>
<p>Nr. [nr.] din [data]</p>
<p></p>
<p>Către: <strong>[Denumirea partenerului]</strong><br>[Adresa partenerului] · CUI [cod]<br>În atenția: [Nume și prenume, funcția]</p>
<p></p>
<h1 style="text-align: center">CONFIRMAREA SOLDULUI DE AMBALAJE RETURNABILE</h1>
<p style="text-align: center">la data de [data]</p>
<p></p>
<p>Stimată doamnă / Stimate domn,</p>
<p>Potrivit evidenței noastre (Sheets → Ambalaje returnabile), din avizele de însoțire emise și primite până la data de mai sus, soldul ambalajelor returnabile dintre firmele noastre este următorul:</p>
<table><tbody>
<tr><td><p><strong>Ambalajul</strong></p></td><td><p><strong>Ale dumneavoastră, aflate la noi (buc.)</strong></p></td><td><p><strong>Ale noastre, aflate la dumneavoastră (buc.)</strong></p></td><td><p><strong>Garanția pe bucată (lei)</strong></p></td><td><p><strong>Valoarea soldului (lei)</strong></p></td></tr>
<tr><td><p>Palet EUR</p></td><td><p>[nr.]</p></td><td><p>[nr.]</p></td><td><p>[garanția]</p></td><td><p>[valoarea]</p></td></tr>
<tr><td><p>Navetă</p></td><td><p>[nr.]</p></td><td><p>[nr.]</p></td><td><p>[garanția]</p></td><td><p>[valoarea]</p></td></tr>
<tr><td><p>[alt ambalaj]</p></td><td><p>[nr.]</p></td><td><p>[nr.]</p></td><td><p>[garanția]</p></td><td><p>[valoarea]</p></td></tr>
<tr><td><p><strong>Total</strong></p></td><td><p><strong>[nr.]</strong></p></td><td><p><strong>[nr.]</strong></p></td><td><p></p></td><td><p><strong>[valoarea] în favoarea [firmei noastre / firmei dumneavoastră]</strong></p></td></tr>
</tbody></table>
<p>Vă rugăm să verificați soldul cu evidența dumneavoastră și să ne trimiteți până la data de <strong>[data]</strong> exemplarul de mai jos semnat sau, dacă găsiți diferențe, lista avizelor care le explică. Dacă nu primim un răspuns în acest termen, vom considera soldul confirmat.</p>
<p><strong>Returul sau decontarea.</strong> Ambalajele aflate la [noi / dumneavoastră] se vor returna până la data de [data], cu aviz de însoțire, [la sediul / depozitul din …]. Ambalajele nereturnate până atunci se vor factura la garanția de mai sus [sau: se vor scădea din următoarea plată], potrivit contractului nr. [nr.] din [data].</p>
<p>Pentru orice întrebare ne puteți contacta la [telefon] sau [e-mail].</p>
<p></p>
<p>Cu stimă,</p>
<p><strong>[Nume și prenume]</strong><br>[Funcția: gestionar / responsabil logistică / contabil]<br>Semnătura: ____________</p>
<p></p>
<p>---------------------------------------------------------------</p>
<p><strong>Răspunsul partenerului:</strong> ☐ Confirmăm soldul de mai sus. ☐ Nu confirmăm; diferențele sunt explicate în lista atașată.</p>
<p>[Denumirea partenerului] · [Nume și prenume, funcția] · Data: [data] · Semnătura: ____________</p>
<p></p>
<p><em>Soldurile pe fiecare ambalaj și pe fiecare partener se văd în Sheets → Ambalaje returnabile → Soldul unui partener. Pentru soldul facturilor, folosiți Docs → Confirmare de sold.</em></p>`,
  },
  {
    id: 'programare-concedii',
    name: 'Decizie privind programarea concediilor de odihnă',
    desc: 'Decizia administratorului, dată până la sfârșitul anului, cu programarea concediilor de odihnă ale angajaților pe anul următor: zilele cuvenite, perioadele fiecăruia, înlocuitorii, cum se cere o schimbare și cum se face concediul rămas',
    html: `
<p><strong>[Denumirea firmei]</strong><br>[Adresa sediului] · CUI [cod] · Nr. Reg. Com. [J../..../....]</p>
<p></p>
<h1 style="text-align: center">DECIZIA NR. [număr]</h1>
<p style="text-align: center">din [data]</p>
<p style="text-align: center"><strong>privind programarea concediilor de odihnă pe anul [anul]</strong></p>
<p></p>
<p>[Nume și prenume], în calitate de [administrator] al <strong>[Denumirea firmei]</strong>,</p>
<p>având în vedere prevederile Codului muncii privind concediul de odihnă anual și obligația angajatorului de a programa concediile până la sfârșitul anului calendaristic pentru anul următor,</p>
<p>după consultarea [sindicatului / reprezentanților salariaților / salariaților], ale căror cereri au fost primite până la data de [data],</p>
<p></p>
<p style="text-align: center"><strong>DECIDE:</strong></p>
<p></p>
<p><strong>Art. 1.</strong> Se aprobă programarea concediilor de odihnă pe anul [anul] pentru angajații firmei, după cum urmează:</p>
<table><tbody>
<tr><td><p><strong>Nr.</strong></p></td><td><p><strong>Nume și prenume</strong></p></td><td><p><strong>Funcția</strong></p></td><td><p><strong>Zile cuvenite (lucrătoare)</strong></p></td><td><p><strong>Zile rămase din anul trecut</strong></p></td><td><p><strong>Perioada 1</strong></p></td><td><p><strong>Perioada 2</strong></p></td><td><p><strong>Înlocuit de</strong></p></td></tr>
<tr><td><p>1</p></td><td><p>[Nume și prenume]</p></td><td><p>[funcția]</p></td><td><p>[zile]</p></td><td><p>[zile]</p></td><td><p>[de la – până la]</p></td><td><p>[de la – până la]</p></td><td><p>[Nume și prenume]</p></td></tr>
<tr><td><p>2</p></td><td><p>[Nume și prenume]</p></td><td><p>[funcția]</p></td><td><p>[zile]</p></td><td><p>[zile]</p></td><td><p>[de la – până la]</p></td><td><p>[de la – până la]</p></td><td><p>[Nume și prenume]</p></td></tr>
<tr><td><p>3</p></td><td><p>[Nume și prenume]</p></td><td><p>[funcția]</p></td><td><p>[zile]</p></td><td><p>[zile]</p></td><td><p>[de la – până la]</p></td><td><p>[de la – până la]</p></td><td><p>[Nume și prenume]</p></td></tr>
</tbody></table>
<p></p>
<p><strong>Art. 2.</strong> Fiecare angajat va avea într-un an cel puțin 10 zile lucrătoare de concediu neîntrerupt. Perioadele au fost stabilite astfel încât activitatea să nu se oprească: în aceeași perioadă nu lipsesc în același timp [doi angajați din același compartiment / gestionarul și înlocuitorul lui].</p>
<p><strong>Art. 3.</strong> [Concediul colectiv: între [data] și [data] activitatea firmei se întrerupe, iar toți angajații efectuează concediul de odihnă în această perioadă.]</p>
<p><strong>Art. 4.</strong> Concediul se efectuează pe baza cererii de concediu aprobate, depuse cu cel puțin [număr] zile înainte de începerea lui. Mutarea unei perioade la cererea angajatului se aprobă numai dacă nu se suprapune cu concediul înlocuitorului; la cererea firmei, numai cu acordul angajatului.</p>
<p><strong>Art. 5.</strong> Zilele rămase din anul trecut se vor efectua până la data de [data], cel târziu în termenul prevăzut de lege. Indemnizația de concediu se plătește cu cel puțin 5 zile lucrătoare înainte de plecarea în concediu.</p>
<p><strong>Art. 6.</strong> Prezenta decizie se aduce la cunoștința angajaților prin [afișare la sediu / e-mail / semnătură pe lista anexată], iar de aducerea ei la îndeplinire răspunde [Nume și prenume], [funcția: responsabil resurse umane / contabil].</p>
<p></p>
<p><strong>[Administrator]</strong>,<br>[Nume și prenume]<br>Semnătura și ștampila: ____________</p>
<p></p>
<p>Am luat la cunoștință:</p>
<table><tbody>
<tr><td><p><strong>Nume și prenume</strong></p></td><td><p><strong>Data</strong></p></td><td><p><strong>Semnătura</strong></p></td></tr>
<tr><td><p>[Nume și prenume]</p></td><td><p>[data]</p></td><td><p></p></td></tr>
<tr><td><p>[Nume și prenume]</p></td><td><p>[data]</p></td><td><p></p></td></tr>
</tbody></table>
<p></p>
<p><em>Zilele cuvenite, luate și rămase ale fiecărui angajat se țin în Sheets → Evidență concedii; cererea fiecărei perioade se face cu Docs → Cerere de concediu. Numărul minim de zile, fracționarea și termenul pentru zilele rămase sunt cele din Codul muncii și din contractul colectiv sau regulamentul intern: verificați-le înainte de semnare.</em></p>`,
  },
  {
    id: 'convocare-disciplinara',
    name: 'Convocare la cercetarea disciplinară prealabilă',
    desc: 'Convocarea scrisă a angajatului la cercetarea disciplinară: fapta de care e acuzat, data, ora și locul întrevederii, comisia sau persoana care face cercetarea, drepturile lui (apărări, probe, asistență) și ce se întâmplă dacă nu se prezintă; cu dovada primirii',
    html: `
<p><strong>[Denumirea firmei]</strong><br>[Adresa sediului] · CUI [cod] · Nr. Reg. Com. [J../..../....]</p>
<p>Nr. [număr] / [data]</p>
<p></p>
<p>Către: <strong>[Nume și prenume angajat]</strong>, [funcția], [compartimentul]<br>Domiciliul: [adresa]</p>
<p></p>
<h1 style="text-align: center">CONVOCARE</h1>
<p style="text-align: center"><strong>la cercetarea disciplinară prealabilă</strong></p>
<p></p>
<p>În temeiul prevederilor Codului muncii privind cercetarea disciplinară prealabilă, al Regulamentului intern și al [Deciziei nr. [număr] din [data] privind numirea comisiei de cercetare disciplinară / împuternicirea persoanei care face cercetarea],</p>
<p>vă convocăm la întrevederea pentru cercetarea disciplinară prealabilă, care va avea loc:</p>
<table><tbody>
<tr><td><p><strong>Data</strong></p></td><td><p>[data]</p></td></tr>
<tr><td><p><strong>Ora</strong></p></td><td><p>[ora]</p></td></tr>
<tr><td><p><strong>Locul</strong></p></td><td><p>[adresa, sala / biroul]</p></td></tr>
<tr><td><p><strong>Cercetarea o face</strong></p></td><td><p>[comisia formată din: Nume și prenume, funcția; … / Nume și prenume, funcția]</p></td></tr>
</tbody></table>
<p></p>
<p><strong>Obiectul cercetării.</strong> Sunteți cercetat(ă) pentru următoarea faptă, care poate constitui abatere disciplinară:</p>
<p>[descrierea faptei: ce s-a întâmplat, data și locul, cum a fost constatată]</p>
<p>Fapta încalcă [articolul din Regulamentul intern / fișa postului / contractul individual de muncă / dispoziția scrisă], care prevede că [obligația încălcată].</p>
<p></p>
<p><strong>Drepturile dumneavoastră.</strong> La întrevedere aveți dreptul să formulați și să susțineți toate apărările în favoarea dumneavoastră, să prezentați probe (înscrisuri, martori) și explicațiile pe care le considerați necesare. La cererea dumneavoastră, puteți fi asistat(ă) de [un reprezentant al sindicatului al cărui membru sunteți / un avocat].</p>
<p>Puteți depune o notă explicativă scrisă până la data de [data] sau la întrevedere.</p>
<p></p>
<p><strong>Dacă nu vă prezentați.</strong> Neprezentarea la convocare fără un motiv obiectiv dă dreptul angajatorului să dispună sancționarea fără efectuarea cercetării disciplinare prealabile. Dacă aveți un motiv obiectiv (de exemplu concediu medical), anunțați-l cât mai repede la [telefon / e-mail], cu dovada lui, pentru stabilirea unei alte date.</p>
<p></p>
<p><strong>[Administrator / Președintele comisiei]</strong>,<br>[Nume și prenume]<br>Semnătura și ștampila: ____________</p>
<p></p>
<p><strong>Dovada primirii</strong> (se completează de angajat, pe exemplarul care rămâne la firmă):</p>
<table><tbody>
<tr><td><p><strong>Am primit un exemplar</strong></p></td><td><p><strong>Data și ora primirii</strong></p></td><td><p><strong>Semnătura</strong></p></td></tr>
<tr><td><p>[Nume și prenume angajat]</p></td><td><p>[data, ora]</p></td><td><p></p></td></tr>
</tbody></table>
<p>[Sau: trimisă prin scrisoare recomandată cu confirmare de primire nr. [număr] din [data] / refuzul primirii constatat de [Nume și prenume, funcția] la [data, ora]]</p>
<p></p>
<p><em>După cercetare se face un proces-verbal cu ce s-a constatat și cu apărările angajatului; sancțiunea se dă prin decizie scrisă (Docs → Decizie de sancționare disciplinară), în termenul din Codul muncii socotit de la data la care firma a aflat de faptă și de la data faptei. Formularea drepturilor și termenele se verifică cu Codul muncii în vigoare, cu Regulamentul intern și cu contractul colectiv înainte de trimitere.</em></p>`,
  },
  {
    id: 'pv-cercetare-disciplinara',
    name: 'Proces-verbal al cercetării disciplinare prealabile',
    desc: 'Ce s-a petrecut la întrevederea de cercetare disciplinară: cine a participat, cum a fost convocat angajatul, fapta cercetată, întrebările și răspunsurile, apărările și probele lui, ce a constatat comisia și ce sancțiune propune; semnat de comisie și de angajat',
    html: `
<p><strong>[Denumirea firmei]</strong><br>[Adresa sediului] · CUI [cod] · Nr. Reg. Com. [J../..../....]</p>
<p>Nr. [număr] / [data]</p>
<p></p>
<h1 style="text-align: center">PROCES-VERBAL</h1>
<p style="text-align: center"><strong>al cercetării disciplinare prealabile</strong></p>
<p></p>
<p>Încheiat astăzi, [data], ora [ora], la [adresa, sala / biroul], de [comisia de cercetare disciplinară / persoana împuternicită] numită prin [Decizia nr. [număr] din [data]], în cercetarea disciplinară prealabilă a angajatului [Nume și prenume], [funcția], [compartimentul].</p>
<p></p>
<p><strong>1. Cine a participat</strong></p>
<table><tbody>
<tr><td><p><strong>Calitatea</strong></p></td><td><p><strong>Nume și prenume</strong></p></td><td><p><strong>Funcția</strong></p></td></tr>
<tr><td><p>Președintele comisiei</p></td><td><p>[Nume și prenume]</p></td><td><p>[funcția]</p></td></tr>
<tr><td><p>Membru</p></td><td><p>[Nume și prenume]</p></td><td><p>[funcția]</p></td></tr>
<tr><td><p>Membru</p></td><td><p>[Nume și prenume]</p></td><td><p>[funcția]</p></td></tr>
<tr><td><p>Angajatul cercetat</p></td><td><p>[Nume și prenume]</p></td><td><p>[funcția]</p></td></tr>
<tr><td><p>Asistat de (la cererea angajatului)</p></td><td><p>[Nume și prenume / nu a cerut asistență]</p></td><td><p>[reprezentant al sindicatului / avocat]</p></td></tr>
</tbody></table>
<p></p>
<p><strong>2. Convocarea.</strong> Angajatul a fost convocat prin Convocarea nr. [număr] din [data], primită la [data] [/ trimisă prin scrisoare recomandată nr. [număr], primită la [data]]. Angajatul [s-a prezentat / nu s-a prezentat, fără un motiv obiectiv / nu s-a prezentat, din motivul: [motivul], iar întrevederea s-a mutat la [data]].</p>
<p></p>
<p><strong>3. Fapta cercetată.</strong> [descrierea faptei: ce s-a întâmplat, data și locul, cum a fost constatată], care poate încălca [articolul din Regulamentul intern / fișa postului / contractul individual de muncă / dispoziția scrisă].</p>
<p></p>
<p><strong>4. Întrebările puse și răspunsurile angajatului</strong></p>
<table><tbody>
<tr><td><p><strong>Întrebarea</strong></p></td><td><p><strong>Răspunsul angajatului</strong></p></td></tr>
<tr><td><p>[întrebarea]</p></td><td><p>[răspunsul, cât mai aproape de cuvintele lui]</p></td></tr>
<tr><td><p>[întrebarea]</p></td><td><p>[răspunsul]</p></td></tr>
<tr><td><p>[întrebarea]</p></td><td><p>[răspunsul]</p></td></tr>
</tbody></table>
<p></p>
<p><strong>5. Apărările și probele angajatului.</strong> [Nota explicativă depusă la [data] / susținută verbal]: [pe scurt, ce a spus în apărarea lui]. Probe depuse: [înscrisuri, martori audiați, alte probe / nu a depus probe].</p>
<p></p>
<p><strong>6. Ce a constatat comisia.</strong> Pe baza celor de mai sus, comisia constată că [fapta s-a produs / nu s-a produs / nu se poate dovedi]. Comisia a ținut seama de împrejurările în care s-a petrecut fapta, de gradul de vinovăție al angajatului, de urmările abaterii, de comportarea lui generală la serviciu și de eventualele sancțiuni disciplinare primite anterior: [pe scurt, pentru fiecare].</p>
<p>Apărările angajatului [se rețin / nu se rețin], pentru că [motivele].</p>
<p></p>
<p><strong>7. Propunerea comisiei.</strong> [Nicio sancțiune / avertisment scris / retrogradarea temporară din funcție / reducerea salariului de bază pe o perioadă determinată / desfacerea disciplinară a contractului individual de muncă], în limitele prevăzute de Codul muncii și de Regulamentul intern.</p>
<p></p>
<p>Procesul-verbal a fost citit celor prezenți și s-a încheiat în [două] exemplare, unul pentru angajat.</p>
<table><tbody>
<tr><td><p><strong>Comisia</strong> (nume, prenume, semnătura)</p></td><td><p><strong>Angajatul</strong> (am citit și am primit un exemplar)</p></td></tr>
<tr><td><p>[Nume și prenume] ____________<br>[Nume și prenume] ____________<br>[Nume și prenume] ____________</p></td><td><p>[Nume și prenume] ____________<br>[Sau: angajatul a refuzat să semneze, constatat de [Nume și prenume] la [data, ora]]</p></td></tr>
</tbody></table>
<p></p>
<p><em>Sancțiunea se dă prin decizie scrisă (Docs → Decizie de sancționare disciplinară), în termenul din Codul muncii socotit de la data la care firma a aflat de faptă și de la data faptei; decizia cuprinde descrierea faptei, regula încălcată, motivele pentru care apărările au fost înlăturate, temeiul legal, termenul și instanța la care poate fi contestată. Formularea, sancțiunile și termenele se verifică cu Codul muncii în vigoare, cu Regulamentul intern și cu contractul colectiv, de preferat cu un jurist.</em></p>`,
  },
  {
    id: 'decizie-sanctiune-disciplinara',
    name: 'Decizie de sancționare disciplinară',
    desc: 'Decizia prin care firma aplică o sancțiune după cercetarea disciplinară: sancțiunea aleasă (de bifat), fapta, regula încălcată, de ce au fost înlăturate apărările, temeiul legal, termenul și instanța de contestare; cu semnătura de primire',
    html: `
<p><strong>[Denumirea firmei]</strong><br>[Adresa sediului] · CUI [cod] · Nr. Reg. Com. [J../..../....]</p>
<p>Nr. [număr] / [data]</p>
<p></p>
<h1 style="text-align: center">DECIZIE</h1>
<p style="text-align: center"><strong>privind sancționarea disciplinară a angajatului [Nume și prenume]</strong></p>
<p></p>
<p>[Denumirea firmei], reprezentată de [Nume și prenume], în calitate de [administrator / director general],</p>
<p>având în vedere:</p>
<ul>
<li><p>[Referatul / sesizarea / nota de constatare] nr. [număr] din [data], prin care firma a aflat de faptă la data de [data];</p></li>
<li><p>Convocarea la cercetarea disciplinară prealabilă nr. [număr] din [data] și Procesul-verbal al cercetării nr. [număr] din [data] [/ faptul că angajatul nu s-a prezentat la convocare fără un motiv obiectiv];</p></li>
<li><p>Contractul individual de muncă nr. [număr] din [data], fișa postului și Regulamentul intern;</p></li>
<li><p>prevederile Codului muncii privind răspunderea disciplinară (art. 247–252),</p></li>
</ul>
<p></p>
<p style="text-align: center"><strong>DECIDE:</strong></p>
<p></p>
<p><strong>Art. 1.</strong> Se aplică angajatului [Nume și prenume], [funcția], [compartimentul], sancțiunea disciplinară bifată mai jos:</p>
<table><tbody>
<tr><td><p>☐</p></td><td><p>Avertisment scris</p></td></tr>
<tr><td><p>☐</p></td><td><p>Retrogradarea din funcție pe [număr] zile (cel mult 60), cu salariul funcției în care se face retrogradarea: [funcția]</p></td></tr>
<tr><td><p>☐</p></td><td><p>Reducerea salariului de bază cu [5–10] % pe [1–3] luni, de la [data]</p></td></tr>
<tr><td><p>☐</p></td><td><p>Reducerea salariului de bază și a indemnizației de conducere cu [5–10] % pe [1–3] luni, de la [data]</p></td></tr>
<tr><td><p>☐</p></td><td><p>Desfacerea disciplinară a contractului individual de muncă, de la data de [data]</p></td></tr>
</tbody></table>
<p></p>
<p><strong>Art. 2. Fapta.</strong> [descrierea faptei: ce s-a întâmplat, data și locul, cum a fost constatată și ce urmări a avut].</p>
<p><strong>Art. 3. Regula încălcată.</strong> Prin fapta de mai sus angajatul a încălcat [articolul din Regulamentul intern / punctul din fișa postului / clauza din contractul individual de muncă / dispoziția scrisă a conducerii nr. [număr] din [data]].</p>
<p><strong>Art. 4. Apărările angajatului.</strong> [Pe scurt, ce a susținut angajatul.] Apărările au fost înlăturate pentru că [motivele]. [Sau: angajatul nu s-a prezentat la convocarea din [data] fără un motiv obiectiv, așa că sancțiunea s-a dat fără cercetarea în fața comisiei.]</p>
<p><strong>Art. 5. Ce s-a avut în vedere.</strong> La alegerea sancțiunii s-au avut în vedere împrejurările în care s-a petrecut fapta, gradul de vinovăție, urmările abaterii, comportarea generală a angajatului la serviciu și sancțiunile disciplinare primite anterior: [pe scurt].</p>
<p><strong>Art. 6. Temeiul legal.</strong> Art. 247, art. 248 alin. (1) lit. [a–e], art. 250 și art. 252 din Codul muncii, [articolul din Regulamentul intern] și [clauza din contractul colectiv de muncă, dacă există].</p>
<p><strong>Art. 7. Contestarea.</strong> Angajatul poate contesta decizia în termen de 30 de zile calendaristice de la comunicare, la Tribunalul [județul] (tribunalul în a cărui rază are domiciliul angajatul).</p>
<p><strong>Art. 8. Comunicarea.</strong> Decizia se predă angajatului sub semnătură de primire sau, dacă refuză primirea, se trimite prin scrisoare recomandată la domiciliul [adresa din contract], în cel mult 5 zile calendaristice de la emitere, și produce efecte de la data comunicării. Compartimentul [resurse umane / salarizare] aduce la îndeplinire prevederile ei.</p>
<p></p>
<table><tbody>
<tr><td><p><strong>Pentru firmă</strong> (nume, funcția, semnătura, ștampila)</p></td><td><p><strong>Am primit un exemplar</strong> (angajatul)</p></td></tr>
<tr><td><p>[Nume și prenume], [funcția]<br>____________</p></td><td><p>[Nume și prenume], data [data] ____________<br>[Sau: a refuzat primirea; trimisă prin scrisoare recomandată nr. [număr] din [data]]</p></td></tr>
</tbody></table>
<p></p>
<p><em>Decizia se emite în cel mult 30 de zile calendaristice de la data la care firma a aflat de faptă, dar nu mai târziu de 6 luni de la data faptei. În afară de avertismentul scris, nicio sancțiune nu se poate da fără cercetarea disciplinară prealabilă (Docs → Convocare la cercetarea disciplinară prealabilă, apoi Proces-verbal al cercetării disciplinare prealabile). Pentru aceeași faptă se dă o singură sancțiune, iar sancțiunea se șterge de drept după 12 luni dacă angajatul nu primește alta în acest timp (Docs → Decizie de constatare a radierii sancțiunii disciplinare). Formularea, sancțiunile și termenele se verifică cu Codul muncii în vigoare, cu Regulamentul intern și cu contractul colectiv, de preferat cu un jurist.</em></p>`,
  },
  {
    id: 'decizie-radiere-sanctiune',
    name: 'Decizie de constatare a radierii sancțiunii disciplinare',
    desc: 'Decizia prin care firma constată că o sancțiune disciplinară s-a șters de drept, după 12 luni fără o nouă sancțiune: sancțiunea radiată, datele, verificarea, mențiunea în dosarul angajatului; cu semnătura de primire',
    html: `
<p><strong>[Denumirea firmei]</strong><br>[Adresa sediului] · CUI [cod] · Nr. Reg. Com. [J../..../....]</p>
<p>Nr. [număr] / [data]</p>
<p></p>
<h1 style="text-align: center">DECIZIE</h1>
<p style="text-align: center"><strong>privind constatarea radierii sancțiunii disciplinare aplicate angajatului [Nume și prenume]</strong></p>
<p></p>
<p>[Denumirea firmei], reprezentată de [Nume și prenume], în calitate de [administrator / director general],</p>
<p>având în vedere:</p>
<ul>
<li><p>Decizia de sancționare disciplinară nr. [număr] din [data], comunicată angajatului la data de [data];</p></li>
<li><p>faptul că de la data aplicării sancțiunii au trecut 12 luni și, în acest timp, angajatului nu i s-a aplicat o nouă sancțiune disciplinară (verificare făcută de [compartimentul resurse umane] în [registrul deciziilor / dosarul personal]);</p></li>
<li><p>prevederile art. 248 alin. (3) din Codul muncii, potrivit cărora sancțiunea disciplinară se radiază de drept în termen de 12 luni de la aplicare, dacă salariatului nu i se aplică o nouă sancțiune în acest termen, iar radierea se constată prin decizie scrisă a angajatorului,</p></li>
</ul>
<p></p>
<p style="text-align: center"><strong>DECIDE:</strong></p>
<p></p>
<p><strong>Art. 1.</strong> Se constată radierea de drept, începând cu data de [data: 12 luni de la aplicare], a sancțiunii disciplinare aplicate angajatului [Nume și prenume], [funcția], [compartimentul]:</p>
<table><tbody>
<tr><td><p>Sancțiunea</p></td><td><p>[avertisment scris / retrogradare / reducerea salariului de bază ...]</p></td></tr>
<tr><td><p>Decizia de sancționare</p></td><td><p>nr. [număr] din [data]</p></td></tr>
<tr><td><p>Data aplicării</p></td><td><p>[data]</p></td></tr>
<tr><td><p>Radiată de drept la</p></td><td><p>[data]</p></td></tr>
</tbody></table>
<p></p>
<p><strong>Art. 2.</strong> De la data radierii, sancțiunea nu mai produce niciun efect și nu mai poate fi luată în seamă la o eventuală abatere viitoare, la evaluarea performanțelor, la promovare sau la acordarea primelor și a altor drepturi.</p>
<p><strong>Art. 3.</strong> Compartimentul [resurse umane] trece mențiunea radierii în dosarul personal al angajatului și în [registrul deciziilor / evidența internă a sancțiunilor] și păstrează un exemplar al acestei decizii lângă decizia de sancționare.</p>
<p><strong>Art. 4.</strong> Decizia se comunică angajatului sub semnătură de primire [sau prin scrisoare recomandată la domiciliul din contract] și intră în vigoare la data comunicării.</p>
<p></p>
<table><tbody>
<tr><td><p><strong>Pentru firmă</strong> (nume, funcția, semnătura, ștampila)</p></td><td><p><strong>Am primit un exemplar</strong> (angajatul)</p></td></tr>
<tr><td><p>[Nume și prenume], [funcția]<br>____________</p></td><td><p>[Nume și prenume], data [data] ____________</p></td></tr>
</tbody></table>
<p></p>
<p><em>Radierea are loc de drept, chiar dacă firma întârzie decizia; decizia doar o constată în scris, ca dosarul angajatului să fie la zi. Dacă în cele 12 luni angajatul a primit o nouă sancțiune, prima nu se radiază acum (se verifică cu juristul de la ce dată curge din nou termenul). Desfacerea disciplinară a contractului nu se radiază, fiindcă raportul de muncă a încetat. Formularea și termenele se verifică cu Codul muncii în vigoare și cu Regulamentul intern, de preferat cu un jurist.</em></p>`,
  },
  {
    id: 'act-aditional-telemunca',
    name: 'Act adițional pentru telemuncă',
    desc: 'Actul adițional la contractul de muncă prin care angajatul lucrează de acasă (sau din alt loc ales de el) o parte din timp sau tot timpul: zilele și locul, programul și evidența orelor, echipamentele, cheltuielile, protecția muncii, datele; cu semnăturile',
    html: `
<p><strong>[Denumirea firmei]</strong><br>[Adresa sediului] · CUI [cod] · Nr. Reg. Com. [J../..../....]</p>
<p>Nr. [număr] / [data]</p>
<p></p>
<h1 style="text-align: center">ACT ADIȚIONAL nr. [număr]</h1>
<p style="text-align: center"><strong>la contractul individual de muncă nr. [număr] din [data], privind munca în regim de telemuncă</strong></p>
<p></p>
<p>Între <strong>[Denumirea firmei]</strong>, cu sediul în [adresa], CUI [cod], reprezentată de [Nume și prenume], în calitate de [administrator / director general], ca <strong>angajator</strong>,</p>
<p>și <strong>[Nume și prenume]</strong>, domiciliat(ă) în [adresa], CNP [cod numeric personal], angajat(ă) în funcția de [funcția], ca <strong>salariat</strong>,</p>
<p>a intervenit, cu acordul ambelor părți și în temeiul Legii nr. 81/2018 privind reglementarea activității de telemuncă și al art. 17 și art. 41 din Codul muncii, prezentul act adițional:</p>
<p></p>
<p><strong>Art. 1. Felul muncii.</strong> Începând cu data de [data], salariatul își îndeplinește atribuțiile din fișa postului și în regim de telemuncă, adică în afara locului de muncă organizat de angajator, folosind tehnologia informației și a comunicațiilor, [cel puțin o zi pe lună / în zilele de mai jos / tot timpul].</p>
<table><tbody>
<tr><td><p>Zilele de telemuncă</p></td><td><p>[de exemplu: luni și vineri / toate zilele lucrătoare / stabilite lunar, de comun acord]</p></td></tr>
<tr><td><p>Locul (locurile) de telemuncă</p></td><td><p>[domiciliul din contract / altă adresă: ...]</p></td></tr>
<tr><td><p>Programul de lucru</p></td><td><p>[de la ora .. la ora ..; pauza de masă ..; sau program flexibil, cu prezența obligatorie între orele .. și ..]</p></td></tr>
<tr><td><p>Evidența orelor lucrate</p></td><td><p>[foaia de pontaj trimisă săptămânal / aplicația de pontaj / e-mail la începutul și la sfârșitul zilei]</p></td></tr>
<tr><td><p>Durata</p></td><td><p>[pe durată nedeterminată / până la data de ...]</p></td></tr>
</tbody></table>
<p></p>
<p><strong>Art. 2. Controlul activității.</strong> Angajatorul verifică activitatea salariatului prin [rapoartele de activitate / sarcinile din aplicația de lucru / ședințele online / alte mijloace], fără să monitorizeze permanent salariatul prin cameră sau prin alte mijloace care îi încalcă viața privată. La locul de telemuncă, angajatorul și reprezentanții salariaților pot verifica condițiile de muncă numai cu anunț prealabil și cu acordul salariatului.</p>
<p><strong>Art. 3. Echipamentele.</strong> Angajatorul pune la dispoziția salariatului: [laptop / telefon / monitor / acces la internet / programe], predate pe bază de proces-verbal, care rămân proprietatea angajatorului și se folosesc doar pentru serviciu. [Sau: salariatul folosește echipamentele proprii, iar angajatorul îi plătește cheltuielile de la art. 4.] Salariatul anunță imediat orice defecțiune și restituie echipamentele la încetarea telemuncii.</p>
<p><strong>Art. 4. Cheltuielile.</strong> Angajatorul suportă cheltuielile legate de telemuncă, astfel: [o sumă lunară de [suma] lei, pentru energie, internet și uzura echipamentelor proprii / decontarea pe bază de documente / nu se acordă sumă, pentru că angajatorul asigură toate echipamentele și accesul la internet]. Suma se plătește odată cu salariul, proporțional cu zilele de telemuncă din lună.</p>
<p><strong>Art. 5. Securitatea și sănătatea în muncă.</strong> Angajatorul instruiește salariatul în domeniul securității și sănătății în muncă pentru locul de telemuncă și verifică, cu acordul lui, că locul îndeplinește condițiile minime (mobilier, iluminat, instalația electrică). Salariatul respectă măsurile primite și anunță de îndată orice accident petrecut în timpul programului de telemuncă.</p>
<p><strong>Art. 6. Protecția datelor și confidențialitatea.</strong> Salariatul păstrează confidențialitatea informațiilor firmei, nu lasă documentele și echipamentele la îndemâna altor persoane, folosește doar conexiunile și programele aprobate de angajator și respectă regulile interne de protecție a datelor cu caracter personal.</p>
<p><strong>Art. 7. Drepturile salariatului.</strong> Salariatul în telemuncă are aceleași drepturi ca salariații care lucrează la sediu (salariu, concedii, formare profesională, promovare). Telemunca se poate încheia la cererea oricăreia dintre părți, cu un preaviz de [număr] zile, iar salariatul revine la locul de muncă de la [adresa sediului / punctului de lucru].</p>
<p><strong>Art. 8.</strong> Celelalte clauze ale contractului individual de muncă rămân neschimbate. Actul adițional s-a încheiat în două exemplare, câte unul pentru fiecare parte, și se înregistrează în registrul general de evidență a salariaților (Revisal) înainte de data de la art. 1.</p>
<p></p>
<table><tbody>
<tr><td><p><strong>Angajator</strong> (nume, funcția, semnătura, ștampila)</p></td><td><p><strong>Salariat</strong> (nume, semnătura, data)</p></td></tr>
<tr><td><p>[Nume și prenume], [funcția]<br>____________</p></td><td><p>[Nume și prenume], data [data]<br>____________</p></td></tr>
</tbody></table>
<p></p>
<p><em>Telemunca se face numai cu acordul salariatului: refuzul lui nu poate fi motiv de sancționare. Suma pentru cheltuieli e neimpozabilă doar în limita stabilită de Codul fiscal pentru zilele de telemuncă (se verifică cu contabilul suma în vigoare). Dacă echipamentele se predau, se poate folosi Docs → Proces-verbal de predare-primire. Se verifică cu juristul înainte de folosire.</em></p>
`,
  },
  {
    id: 'decizie-suspendare-cim',
    name: 'Decizie de suspendare a contractului de muncă',
    desc: 'Decizia prin care se suspendă contractul individual de muncă al unui angajat (concediu fără plată, concediu pentru creșterea copilului, detașare, întreruperea activității): motivul, temeiul, perioada, documentul justificativ, ce se întâmplă cu drepturile; cu semnăturile',
    html: `
<p><strong>[Denumirea firmei]</strong><br>[Adresa sediului] · CUI [cod] · Nr. Reg. Com. [J../..../....]</p>
<p>Nr. [număr] / [data]</p>
<p></p>
<h1 style="text-align: center">DECIZIE nr. [număr]</h1>
<p style="text-align: center"><strong>privind suspendarea contractului individual de muncă</strong></p>
<p></p>
<p>[Nume și prenume], în calitate de [administrator / director general] al <strong>[Denumirea firmei]</strong>,</p>
<p>având în vedere [cererea salariatului nr. [număr] din [data] / documentul nr. [număr] din [data] / situația de la art. 1],</p>
<p>în temeiul art. 49–54 din Codul muncii [și al art. 153–154, pentru concediul fără plată],</p>
<p style="text-align: center"><strong>DECIDE:</strong></p>
<p><strong>Art. 1.</strong> Se suspendă contractul individual de muncă nr. [număr] din [data] al salariatului <strong>[Nume și prenume]</strong>, CNP [cod numeric personal], angajat în funcția de [funcția], în [compartimentul / punctul de lucru], după cum urmează:</p>
<table><tbody>
<tr><td><p>Motivul suspendării</p></td><td><p>[concediu fără plată pentru interese personale / concediu pentru creșterea copilului / detașare / întreruperea temporară a activității angajatorului / altul: ...]</p></td></tr>
<tr><td><p>Felul suspendării</p></td><td><p>[de drept / prin acordul părților / la inițiativa salariatului / la inițiativa angajatorului]</p></td></tr>
<tr><td><p>Data de început</p></td><td><p>[data]</p></td></tr>
<tr><td><p>Data de sfârșit</p></td><td><p>[data / până la încetarea motivului suspendării]</p></td></tr>
<tr><td><p>Documentul justificativ</p></td><td><p>[cererea salariatului / decizia de acordare a indemnizației / actul de detașare / alt document]</p></td></tr>
</tbody></table>
<p></p>
<p><strong>Art. 2.</strong> Pe durata suspendării nu se prestează muncă și, de regulă, nu se plătește salariul; drepturile salariatului care decurg din alte temeiuri (de exemplu indemnizațiile plătite de stat) rămân neatinse. Perioada [se ia / nu se ia] în calcul la vechimea în muncă și la dreptul la concediul de odihnă, după cum prevede legea pentru motivul de la art. 1.</p>
<p><strong>Art. 3.</strong> Pe durata suspendării, angajatorul nu poate concedia salariatul pentru motivele în care legea interzice concedierea (de exemplu în timpul concediului pentru creșterea copilului), iar locul de muncă al salariatului se păstrează.</p>
<p><strong>Art. 4.</strong> La încetarea motivului suspendării, salariatul se prezintă la locul de muncă în prima zi lucrătoare de după data de la art. 1 [sau anunță angajatorul cu [număr] zile înainte, dacă revine mai devreme]. Dacă nu se prezintă și nu anunță un motiv, angajatorul poate lua măsurile prevăzute de lege și de Regulamentul intern.</p>
<p><strong>Art. 5.</strong> Compartimentul de resurse umane [sau persoana care ține evidența salariaților] înregistrează suspendarea în registrul general de evidență a salariaților (Revisal), în termenul legal, și o trece în dosarul personal al salariatului.</p>
<p><strong>Art. 6.</strong> Decizia se comunică salariatului sub semnătură de primire [sau prin scrisoare recomandată la domiciliul din contract].</p>
<p></p>
<table><tbody>
<tr><td><p><strong>Pentru firmă</strong> (nume, funcția, semnătura, ștampila)</p></td><td><p><strong>Am primit un exemplar</strong> (salariatul)</p></td></tr>
<tr><td><p>[Nume și prenume], [funcția]<br>____________</p></td><td><p>[Nume și prenume], data [data] ____________</p></td></tr>
</tbody></table>
<p></p>
<p><em>Concediul fără plată se acordă doar la cererea scrisă a salariatului, iar durata lui se stabilește prin contractul colectiv sau prin Regulamentul intern. Pentru concediul de creștere a copilului, data de început e cea din decizia de acordare a indemnizației. Ce perioade intră în vechime și în dreptul la concediu de odihnă diferă după motiv: se verifică cu Codul muncii în vigoare și cu contabilul sau juristul înainte de folosire.</em></p>
`,
  },
  {
    id: 'decizie-delegare',
    name: 'Decizie de delegare a salariatului',
    desc: 'Decizia prin care un angajat e trimis să lucreze temporar în altă localitate sau la alt loc (delegare): unde, perioada, sarcinile, transportul, cazarea, diurna și avansul; cu semnăturile și luarea la cunoștință',
    html: `
<p><strong>[Denumirea firmei]</strong><br>[Adresa sediului] · CUI [cod] · Nr. Reg. Com. [J../..../....]</p>
<p>Nr. [număr] / [data]</p>
<p></p>
<h1 style="text-align: center">DECIZIE nr. [număr]</h1>
<p style="text-align: center"><strong>privind delegarea salariatului</strong></p>
<p></p>
<p>[Nume și prenume], în calitate de [administrator / director general] al <strong>[Denumirea firmei]</strong>,</p>
<p>având în vedere [referatul / nevoia de serviciu nr. [număr] din [data]: lucrarea, întâlnirea sau livrarea care trebuie făcută la alt loc],</p>
<p>în temeiul art. 42–44 din Codul muncii și al prevederilor privind indemnizația de delegare [din contractul colectiv / Regulamentul intern],</p>
<p style="text-align: center"><strong>DECIDE:</strong></p>
<p><strong>Art. 1.</strong> Se deleagă salariatul <strong>[Nume și prenume]</strong>, angajat în funcția de [funcția], în [compartimentul / punctul de lucru], cu contractul individual de muncă nr. [număr] din [data], după cum urmează:</p>
<table><tbody>
<tr><td><p>Locul delegării</p></td><td><p>[localitatea, adresa / firma la care merge]</p></td></tr>
<tr><td><p>Perioada</p></td><td><p>de la [data] până la [data] ([număr] zile)</p></td></tr>
<tr><td><p>Sarcinile de serviciu</p></td><td><p>[ce are de făcut: montaj, service, instruire, livrare, negociere, inventar ...]</p></td></tr>
<tr><td><p>Mijlocul de transport</p></td><td><p>[autoturismul firmei, nr. [număr] / tren / autobuz / avion / autoturismul propriu]</p></td></tr>
<tr><td><p>Cazarea</p></td><td><p>[asigurată de firmă / decontată pe bază de factură, cel mult [suma] lei pe noapte / nu e cazul]</p></td></tr>
<tr><td><p>Indemnizația de delegare (diurna)</p></td><td><p>[suma] lei pe zi</p></td></tr>
</tbody></table>
<p></p>
<p><strong>Art. 2.</strong> Pe durata delegării, salariatul își păstrează funcția și salariul și primește, pe lângă acestea, indemnizația de delegare de la art. 1 și decontarea cheltuielilor de transport și cazare, pe baza documentelor justificative.</p>
<p><strong>Art. 3.</strong> Salariatul primește un avans de [suma] lei pentru cheltuielile delegării, din casierie [sau prin virament în contul de card]. Ordinul de deplasare se vizează la locul delegării, cu data sosirii și a plecării.</p>
<p><strong>Art. 4.</strong> La întoarcere, în cel mult [3] zile lucrătoare, salariatul depune decontul cheltuielilor, împreună cu ordinul de deplasare vizat și documentele justificative (bilete, facturi de cazare, bonuri de combustibil), și restituie avansul necheltuit.</p>
<p><strong>Art. 5.</strong> Delegarea poate fi prelungită, cu acordul salariatului, cu perioade de cel mult 60 de zile calendaristice. Peste 60 de zile într-un an, delegarea se face numai cu acordul salariatului; refuzul lui nu poate fi motiv de sancționare.</p>
<p><strong>Art. 6.</strong> Decizia se comunică salariatului și compartimentului financiar-contabil.</p>
<p></p>
<table><tbody>
<tr><td><p><strong>Pentru firmă</strong> (nume, funcția, semnătura, ștampila)</p></td><td><p><strong>Am luat la cunoștință</strong> (salariatul)</p></td></tr>
<tr><td><p>[Nume și prenume], [funcția]<br>____________</p></td><td><p>[Nume și prenume], data [data] ____________</p></td></tr>
</tbody></table>
<p></p>
<p><em>Delegarea e temporară și nu schimbă locul de muncă din contract (pentru schimbarea locului de muncă la alt angajator se face detașare, cu act adițional). Diurna e neimpozabilă doar în limita stabilită de Codul fiscal (se verifică cu contabilul suma în vigoare). Pentru avans și decont se pot folosi Docs → Ordin de deplasare (delegație) și Decont al avansului de trezorerie. Se verifică cu juristul înainte de folosire.</em></p>
`,
  },
  {
    id: 'decizie-detasare',
    name: 'Decizie de detașare a salariatului',
    desc: 'Decizia prin care un angajat e trimis temporar să lucreze la alt angajator (detașare): firma primitoare, perioada, funcția, cine plătește salariul, indemnizația, transportul și cazarea; cu semnăturile celor două firme și ale salariatului',
    html: `
<p><strong>[Denumirea firmei]</strong><br>[Adresa sediului] · CUI [cod] · Nr. Reg. Com. [J../..../....]</p>
<p>Nr. [număr] / [data]</p>
<p></p>
<h1 style="text-align: center">DECIZIE nr. [număr]</h1>
<p style="text-align: center"><strong>privind detașarea salariatului</strong></p>
<p></p>
<p>[Nume și prenume], în calitate de [administrator / director general] al <strong>[Denumirea firmei]</strong>,</p>
<p>având în vedere [solicitarea / acordul de colaborare nr. [număr] din [data]] cu <strong>[Denumirea firmei primitoare]</strong>, pentru executarea unor lucrări în interesul acesteia,</p>
<p>în temeiul art. 45–47 din Codul muncii,</p>
<p style="text-align: center"><strong>DECIDE:</strong></p>
<p><strong>Art. 1.</strong> Se detașează salariatul <strong>[Nume și prenume]</strong>, angajat în funcția de [funcția], cu contractul individual de muncă nr. [număr] din [data], la angajatorul de mai jos:</p>
<table><tbody>
<tr><td><p>Angajatorul la care e detașat</p></td><td><p>[Denumirea firmei primitoare], CUI [cod], [adresa]</p></td></tr>
<tr><td><p>Locul de muncă</p></td><td><p>[localitatea, adresa, punctul de lucru]</p></td></tr>
<tr><td><p>Perioada</p></td><td><p>de la [data] până la [data] (cel mult un an)</p></td></tr>
<tr><td><p>Funcția și sarcinile</p></td><td><p>[funcția în care lucrează la firma primitoare și ce are de făcut]</p></td></tr>
<tr><td><p>Salariul plătit de</p></td><td><p>[firma primitoare / firma noastră, cu decontarea între firme]</p></td></tr>
<tr><td><p>Indemnizația de detașare</p></td><td><p>[suma] lei pe zi</p></td></tr>
<tr><td><p>Transportul și cazarea</p></td><td><p>[asigurate de / decontate de [firma], pe bază de documente justificative]</p></td></tr>
</tbody></table>
<p></p>
<p><strong>Art. 2.</strong> Pe durata detașării, salariatul își păstrează contractul individual de muncă cu firma noastră. Drepturile salariale se acordă de angajatorul la care e detașat; salariatul primește drepturile care îi sunt mai favorabile, fie cele de la firma noastră, fie cele de la firma primitoare.</p>
<p><strong>Art. 3.</strong> Firma noastră urmărește ca firma primitoare să își îndeplinească la timp toate obligațiile față de salariat. Dacă firma primitoare nu le îndeplinește, ele se îndeplinesc de firma noastră.</p>
<p><strong>Art. 4.</strong> Detașarea poate fi prelungită în mod excepțional, pentru motive obiective, cu acordul ambelor firme și al salariatului, din 6 în 6 luni.</p>
<p><strong>Art. 5.</strong> Salariatul poate refuza detașarea numai în mod excepțional și pentru motive personale temeinice, comunicate în scris în [3] zile de la primirea deciziei.</p>
<p><strong>Art. 6.</strong> Detașarea se înregistrează în registrul general de evidență a salariaților (Revisal) înainte de începerea ei. Decizia se comunică salariatului, firmei primitoare și compartimentului de resurse umane.</p>
<p></p>
<table><tbody>
<tr><td><p><strong>Pentru firma care detașează</strong> (nume, funcția, semnătura, ștampila)</p></td><td><p><strong>Pentru firma primitoare</strong> (nume, funcția, semnătura, ștampila)</p></td></tr>
<tr><td><p>[Nume și prenume], [funcția]<br>____________</p></td><td><p>[Nume și prenume], [funcția]<br>____________</p></td></tr>
<tr><td><p><strong>Am luat la cunoștință</strong> (salariatul)</p></td><td><p>[Nume și prenume], data [data] ____________</p></td></tr>
</tbody></table>
<p></p>
<p><em>Detașarea e la alt angajator; pentru o lucrare la alt loc pentru firma noastră se face delegare (Docs → Decizie de delegare a salariatului). Pentru detașarea în altă țară din Uniunea Europeană există reguli în plus (formularul A1 pentru asigurări, salariul minim din țara gazdă, declararea la autorități): se verifică cu contabilul. Plafonul indemnizației neimpozabile se verifică în Codul fiscal în vigoare. Se verifică cu juristul înainte de folosire.</em></p>
`,
  },
  {
    id: 'pv-echipament-protectie',
    name: 'Proces-verbal de predare-primire a echipamentului de protecție',
    desc: 'Echipamentul individual de protecție dat unui angajat (cască, mănuși, bocanci, vestă, ochelari…): un tabel cu bucățile, mărimea, cantitatea și cât timp se folosesc, plus obligațiile salariatului și semnăturile',
    html: `
<p><strong>[Denumirea firmei]</strong><br>[Adresa sediului] · CUI [cod] · Nr. Reg. Com. [J../..../....]</p>
<p>Nr. [număr] / [data]</p>
<p></p>
<h1 style="text-align: center">PROCES-VERBAL</h1>
<p style="text-align: center"><strong>de predare-primire a echipamentului individual de protecție</strong></p>
<p></p>
<p>Încheiat astăzi, [data], la [locul de muncă / punctul de lucru], între:</p>
<p><strong>Predător:</strong> [Nume și prenume], [funcția: responsabil cu securitatea și sănătatea în muncă / gestionar], din partea <strong>[Denumirea firmei]</strong>;</p>
<p><strong>Primitor:</strong> [Nume și prenume], salariat în funcția de [funcția], la [compartimentul / locul de muncă], marca [număr].</p>
<p>În temeiul Legii securității și sănătății în muncă nr. 319/2006 și al HG nr. 1048/2006 privind utilizarea echipamentelor individuale de protecție la locul de muncă, salariatul primește gratuit echipamentul de mai jos, potrivit riscurilor postului său:</p>
<table><tbody>
<tr><td><p><strong>Nr.</strong></p></td><td><p><strong>Echipamentul</strong></p></td><td><p><strong>Mărimea</strong></p></td><td><p><strong>Cantitatea</strong></p></td><td><p><strong>Durata de folosire</strong></p></td></tr>
<tr><td><p>1</p></td><td><p>[Cască de protecție]</p></td><td><p>[–]</p></td><td><p>[1 buc.]</p></td><td><p>[24 de luni]</p></td></tr>
<tr><td><p>2</p></td><td><p>[Mănuși de protecție]</p></td><td><p>[9]</p></td><td><p>[2 perechi]</p></td><td><p>[3 luni]</p></td></tr>
<tr><td><p>3</p></td><td><p>[Bocanci de protecție]</p></td><td><p>[42]</p></td><td><p>[1 pereche]</p></td><td><p>[12 luni]</p></td></tr>
<tr><td><p>4</p></td><td><p>[Vestă reflectorizantă]</p></td><td><p>[L]</p></td><td><p>[1 buc.]</p></td><td><p>[12 luni]</p></td></tr>
<tr><td><p>5</p></td><td><p>[Ochelari de protecție]</p></td><td><p>[–]</p></td><td><p>[1 buc.]</p></td><td><p>[12 luni]</p></td></tr>
</tbody></table>
<p></p>
<p><strong>Salariatul se obligă:</strong></p>
<ul>
<li><p>să poarte echipamentul pe toată durata lucrului, acolo unde e cerut, și să îl folosească doar pentru munca la care a fost dat;</p></li>
<li><p>să îl păstreze curat și în stare bună și să anunțe îndată conducătorul locului de muncă dacă se strică, se pierde sau nu mai protejează;</p></li>
<li><p>să îl predea la încetarea contractului de muncă sau la schimbarea locului de muncă, dacă nu și-a încheiat durata de folosire;</p></li>
<li><p>să nu îl înstrăineze și să nu îl dea altei persoane.</p></li>
</ul>
<p>Salariatul declară că a fost instruit cum se poartă și cum se întreține echipamentul primit și că acesta i se potrivește.</p>
<p>Prezentul proces-verbal s-a încheiat în două exemplare, câte unul pentru fiecare parte; o copie se păstrează la dosarul de securitate și sănătate în muncă al salariatului.</p>
<p></p>
<table><tbody>
<tr><td><p><strong>Am predat</strong> (nume, funcția, semnătura)</p></td><td><p><strong>Am primit</strong> (nume, semnătura)</p></td></tr>
<tr><td><p>[Nume și prenume], [funcția]<br>____________</p></td><td><p>[Nume și prenume]<br>____________</p></td></tr>
</tbody></table>
<p></p>
<p><em>Echipamentul se alege după evaluarea riscurilor postului; duratele din tabel sunt doar exemple și se stabilesc de firmă (de obicei în normativul intern de acordare). Echipamentul individual de protecție se dă gratuit; nu se reține din salariu. Se verifică cu responsabilul cu securitatea și sănătatea în muncă înainte de folosire.</em></p>
`,
  },
];

/** Un câmp de completat: text scurt între paranteze drepte, pe un singur rând. */
export const PLACEHOLDER_RE = /\[[^[\]\n]{1,80}\]/g;

/** Găsește următorul text de tipul [ ... ] după poziția `from` (sau de la început) și întoarce pozițiile lui. */
export function nextPlaceholder(doc: PMNode, from: number): { from: number; to: number } | null {
  let first: { from: number; to: number } | null = null;
  let found: { from: number; to: number } | null = null;
  doc.descendants((node, pos) => {
    if (found) return false;
    if (!node.isText || !node.text) return true;
    const re = new RegExp(PLACEHOLDER_RE.source, 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(node.text))) {
      const r = { from: pos + m.index, to: pos + m.index + m[0].length };
      if (!first) first = r;
      if (r.from >= from) { found = r; return false; }
    }
    return true;
  });
  return found ?? first;
}

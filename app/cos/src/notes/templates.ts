// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Șabloane de notițe (ca „Șabloane de pagină” din OneNote): o notiță nouă care vine deja cu titlul și structura potrivite.
// Folosesc semnele obișnuite ale notițelor: ☐ (de bifat), • (buline), 1. (numerotare), ❓ (întrebare).
import { dateStamp } from './checklist';

export interface NoteTemplate { key: string; label: string; make(now: Date): { title: string; body: string; paper?: 'lines' | 'grid' } }

const DAYS = ['Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă', 'Duminică'];

/** Lunea săptămânii în care e `d` (săptămâna începe luni, ca în România). */
export function mondayOf(d: Date): Date {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
  return m;
}

export const TEMPLATES: NoteTemplate[] = [
  {
    key: 'sedinta', label: '👥 Ședință (proces-verbal)',
    make: (d) => ({
      title: `Ședință ${dateStamp(d, 'date')}`,
      body: `Data: ${dateStamp(d, 'both')}\nLoc: \nParticipanți:\n• \n\nSubiecte:\n1. \n\nDiscuții:\n\nDecizii:\n• \n\nDe făcut (cine, până când):\n☐ \n`,
    }),
  },
  {
    key: 'cumparaturi', label: '🛒 Listă de cumpărături',
    make: () => ({ title: 'Cumpărături', body: `Alimente:\n☐ \n\nCasă:\n☐ \n\nAltele:\n☐ \n` }),
  },
  {
    key: 'saptamana', label: '📅 Plan săptămânal',
    make: (d) => {
      const mon = mondayOf(d);
      const day = (i: number) => { const x = new Date(mon); x.setDate(mon.getDate() + i); return x; };
      const body = DAYS.map((name, i) => `${name}, ${dateStamp(day(i), 'date')}\n☐ \n`).join('\n') + `\nDe ținut minte săptămâna asta:\n📌 \n`;
      return { title: `Săptămâna ${dateStamp(mon, 'date')} – ${dateStamp(day(6), 'date')}`, body };
    },
  },
  {
    key: 'jurnal', label: '📔 Jurnal zilnic',
    make: (d) => ({
      title: `Jurnal ${dateStamp(d, 'date')}`,
      body: `Cum mă simt:\n\nCe s-a întâmplat azi:\n\nPentru ce sunt recunoscător:\n• \n\nCe am învățat:\n\nMâine:\n☐ \n`,
      paper: 'lines',
    }),
  },
  {
    key: 'reteta', label: '🍲 Rețetă',
    make: () => ({ title: 'Rețetă nouă', body: `Porții: \nTimp: \n\nIngrediente:\n☐ \n\nMod de preparare:\n1. \n\nSfaturi:\n💡 \n` }),
  },
  {
    key: 'proiect', label: '🎯 Proiect',
    make: (d) => ({ title: 'Proiect nou', body: `Început: ${dateStamp(d, 'date')}\nTermen: \nScop:\n\nPași:\n☐ \n\nResurse și legături:\n• \n\nProbleme / întrebări:\n❓ \n` }),
  },
  {
    key: 'curs', label: '🎓 Curs / prelegere',
    make: (d) => ({
      title: `Curs ${dateStamp(d, 'date')}`,
      body: `Materia: \nProfesor: \n\nIdei principale:\n• \n\nDefiniții:\n\nÎntrebări:\n❓ \n\nRezumat (cu cuvintele mele):\n\nDe recitit / de făcut:\n☐ \n`,
      paper: 'lines',
    }),
  },
  {
    key: 'calatorie', label: '🧳 Bagaj pentru călătorie',
    make: () => ({ title: 'Bagaj', body: `Acte:\n☐ buletin / pașaport\n☐ bilete\n☐ card și bani\n\nHaine:\n☐ \n\nIgienă:\n☐ periuță și pastă\n☐ medicamente\n\nElectronice:\n☐ telefon și încărcător\n` }),
  },
  {
    key: 'apel', label: '📞 Apel telefonic',
    make: (d) => ({
      title: `Apel ${dateStamp(d, 'both')}`,
      body: `Cu cine: \nTelefon: \nData: ${dateStamp(d, 'both')}\n\nDespre ce:\n\nCe am stabilit:\n• \n\nDe făcut după apel:\n☐ \n\nSun din nou pe: \n`,
    }),
  },
  {
    key: 'prioritati', label: '🚦 Sarcini pe priorități',
    make: (d) => ({
      title: `Priorități ${dateStamp(d, 'date')}`,
      body: `🔴 Urgent și important (fac acum):\n☐ \n\n🟡 Important, dar nu urgent (programez):\n☐ \n\n🟠 Urgent, dar nu important (las altcuiva):\n☐ \n\n⚪ Nici urgent, nici important (renunț):\n☐ \n`,
    }),
  },
  {
    key: 'carte', label: '📚 Carte citită',
    make: (d) => ({
      title: 'Carte citită',
      body: `Autor: \nTerminată: ${dateStamp(d, 'date')}\nNota mea: ☆☆☆☆☆\n\nDespre ce e (pe scurt):\n\nIdei de ținut minte:\n• \n\nCitate preferate (pagina):\n💬 \n\nCe aplic de aici:\n☐ \n`,
      paper: 'lines',
    }),
  },
  {
    key: 'medic', label: '🩺 Programare la medic',
    make: (d) => ({
      title: `Medic ${dateStamp(d, 'date')}`,
      body: `Medicul / clinica: \nData și ora: \n\nCe simt și de când:\n• \n\nÎntrebări pentru medic:\n❓ \n\nCe mi-a spus:\n\nTratament (ce, cât, cât timp):\n• \n\nDe făcut:\n☐ analize\n☐ control din nou pe \n`,
    }),
  },
  {
    key: 'antrenament', label: '🏋 Antrenament',
    make: (d) => ({
      title: `Antrenament ${dateStamp(d, 'date')}`,
      body: `Data: ${dateStamp(d, 'both')}\nDurata: \nCum m-am simțit: \n\nÎncălzire:\n☐ \n\nExerciții (serii × repetări, greutate):\n☐ \n☐ \n☐ \n\nRelaxare:\n☐ întinderi\n\nData viitoare:\n• \n`,
    }),
  },
  {
    key: 'cadouri', label: '🎁 Idei de cadouri',
    make: () => ({
      title: 'Idei de cadouri',
      body: `Pentru cine / ocazia / data:\n• \n\nIdei:\n☐ \n☐ \n\nBuget: \nUnde găsesc: \n\nCumpărate:\n• \n`,
    }),
  },
  {
    key: 'reparatii', label: '🔧 Reparații și întreținere',
    make: (d) => ({
      title: `Reparații ${dateStamp(d, 'date')}`,
      body: `Ce (casă / mașină / aparat): \nProblema:\n\nMeșter / service: \nTelefon: \nPreț cerut: \n\nDe făcut:\n☐ \n\nFăcut pe: \nGaranție până la: \nUrmătoarea verificare: \n`,
    }),
  },
  {
    key: 'mutare', label: '🚚 Mutare',
    make: (d) => ({
      title: `Mutare ${dateStamp(d, 'date')}`,
      body: `Data mutării: \nAdresa nouă: \n\nÎnainte:\n☐ anunț proprietarul / vecinii\n☐ firma de mutări sau mașina\n☐ cutii, bandă adezivă, etichete\n☐ cutiile numerotate și trecute în tabel (Sheets → Mutare: cutii și cheltuieli)\n☐ garanția și prima chirie plătite, cu chitanță\n\nContoare (la plecare / la sosire):\n• curent: \n• gaz: \n• apă: \n\nSchimb adresa la:\n☐ buletin\n☐ bancă\n☐ furnizori (curent, gaz, internet)\n☐ medicul de familie\n\nLucruri de găsit primele (cutia „întâi”):\n• \n`,
    }),
  },
  {
    key: 'animal', label: '🐾 Animal de companie',
    make: (d) => ({
      title: `Animal de companie ${dateStamp(d, 'date')}`,
      body: `Nume: \nSpecia și rasa: \nData nașterii: \nMicrocip / pașaport: \n\nMedicul veterinar: \nTelefon: \n\nVaccinuri și tratamente (data / următoarea):\n☐ vaccin antirabic: \n☐ vaccin polivalent: \n☐ deparazitare internă: \n☐ deparazitare externă (purici, căpușe): \n\nHrana:\n• ce mănâncă: \n• cât și de câte ori pe zi: \n\nAlergii, boli, medicamente:\n• \n`,
    }),
  },
  {
    key: 'petrecere', label: '🎉 Petrecere',
    make: (d) => ({
      title: `Petrecere ${dateStamp(d, 'date')}`,
      body: `Data și ora: \nLocul: \nCâți invitați: \nBuget: \n\nInvitații (☐ = a confirmat):\n☐ \n☐ \n☐ \n\nMeniul:\n• aperitive: \n• felul principal: \n• tortul / desertul: \n• băuturi: \n\nDe pregătit:\n☐ rezervarea sau curățenia\n☐ cumpărăturile\n☐ decorul și muzica\n☐ cadourile sau mărturiile\n\nCine ce aduce:\n• \n`,
    }),
  },
  {
    key: 'gradina', label: '🌱 Grădină și plante',
    make: (d) => ({
      title: `Grădină ${dateStamp(d, 'date')}`,
      body: `Locul: (balcon / grădină / casă)\n\nCe am plantat (planta / data / unde):\n• \n• \n• \n\nUdat:\n☐ luni\n☐ miercuri\n☐ vineri\n☐ sâmbătă (cele din ghiveci)\n\nDe făcut în sezon:\n☐ îngrășământ\n☐ tăiat / ciupit vârfurile\n☐ tratament contra dăunătorilor\n\nRecoltat (ce / cât / data):\n• \n`,
    }),
  },
  {
    key: 'mese', label: '🍽 Plan de mese',
    make: (d) => ({
      title: `Mese ${dateStamp(d, 'date')}`,
      body: `Săptămâna: \nCâte persoane: \n\nLuni:\n• prânz: \n• cină: \n\nMarți:\n• prânz: \n• cină: \n\nMiercuri:\n• prânz: \n• cină: \n\nJoi:\n• prânz: \n• cină: \n\nVineri:\n• prânz: \n• cină: \n\nSâmbătă:\n• prânz: \n• cină: \n\nDuminică:\n• prânz: \n• cină: \n\nDe cumpărat pentru toată săptămâna:\n☐ \n☐ \n☐ \n☐ \n\nDe pregătit dinainte (duminică seara):\n☐ \n`,
    }),
  },
  {
    key: 'economii', label: '💰 Economii pentru un obiectiv',
    make: (d) => ({
      title: `Economii ${dateStamp(d, 'date')}`,
      body: `Ce vreau să-mi cumpăr / să fac: \nCât costă: \nPână când: \nCât pun deoparte pe lună: \nUnde țin banii: (cont de economii / pușculiță / depozit)\n\nDepunerile (☐ = am pus banii):\n☐ luna 1: \n☐ luna 2: \n☐ luna 3: \n☐ luna 4: \n☐ luna 5: \n☐ luna 6: \n\nStrâns până acum: \nMai am de strâns: \n\nDe unde pot economisi:\n• \n• \n`,
    }),
  },
  {
    key: 'interviu', label: '🤝 Interviu de angajare',
    make: (d) => ({
      title: `Interviu ${dateStamp(d, 'date')}`,
      body: `Firma: \nPostul: \nData și ora: \nUnde: (adresa / legătura video)\nCu cine: \n\nDespre firmă (ce fac, de ce vreau acolo):\n• \n• \n\nCe aduc eu (exemple concrete):\n• \n• \n\nÎntrebări pe care le pun eu:\n❓ \n❓ \n\nDe pregătit:\n☐ CV-ul tipărit\n☐ actele / diplomele\n☐ drumul (cât fac până acolo)\n☐ hainele\n\nDupă interviu (ce s-a discutat, salariul, pașii următori):\n• \n\n☐ mulțumire trimisă\n`,
    }),
  },
  {
    key: 'curatenie', label: '🧹 Curățenie',
    make: (d) => ({
      title: `Curățenie ${dateStamp(d, 'date')}`,
      body: `Săptămâna: \nCine ajută: \n\nBucătărie:\n☐ vasele și chiuveta\n☐ aragazul și blatul\n☐ frigiderul (aruncat ce a expirat)\n☐ gunoiul\n\nBaie:\n☐ cada / dușul\n☐ chiuveta și oglinda\n☐ toaleta\n☐ prosoape curate\n\nCamere:\n☐ praful\n☐ aspiratorul\n☐ spălat pe jos\n☐ lenjeria de pat schimbată\n\nRufe:\n☐ spălat\n☐ călcat și pus la loc\n\nO dată pe lună:\n• geamurile, cuptorul, sub mobilă\n\nDe cumpărat (detergenți, saci, bureți):\n☐ \n`,
    }),
  },
  {
    key: 'drum-lung', label: '🚗 Drum lung cu mașina',
    make: (d) => ({
      title: `Drum lung ${dateStamp(d, 'date')}`,
      body: `Unde: \nCând plecăm: \nCine conduce / cu cine: \nKm de mers: \n\nMașina (cu o zi înainte):\n☐ presiunea în roți (și roata de rezervă)\n☐ uleiul și lichidul de răcire\n☐ lichidul de parbriz\n☐ plinul făcut\n\nActe:\n☐ permisul și buletinul\n☐ talonul și asigurarea RCA (carte verde în străinătate)\n☐ rovinieta și vigneta țărilor prin care trecem\n\nÎn portbagaj:\n☐ trusa medicală, triunghiurile, vesta, extinctorul\n☐ cablurile de pornire\n☐ apă și ceva de mâncare\n☐ încărcătorul de telefon\n\nPe drum:\n• pauză la 2 ore\n• opriri: \n• unde dormim: \n`,
    }),
  },
  {
    key: 'comenzi', label: '📦 Comenzi online',
    make: (d) => ({
      title: `Comenzi online ${dateStamp(d, 'date')}`,
      body: `Comanda 1: \nMagazinul: \nData comenzii: \nPlătit: card / ramburs\nLivrare (curier, AWB): \n☐ confirmarea primită pe e-mail\n☐ coletul a ajuns\n☐ verificat produsul (merge, e complet)\n☐ factura și garanția păstrate\n\nRetur (14 zile de la primire):\nPână la: \n☐ cererea de retur trimisă\n☐ coletul predat curierului\n☐ banii primiți înapoi\n\nComanda 2: \nMagazinul: \n☐ coletul a ajuns\n☐ verificat produsul\n`,
    }),
  },
  {
    key: 'scoala', label: '🎒 Început de an școlar',
    make: (d) => ({
      title: `An școlar ${dateStamp(d, 'date')}`,
      body: `Clasa: \nȘcoala / dirigintele: \nPrima zi: \n\nRechizite:\n☐ caiete și coperți\n☐ pixuri, creioane, radieră\n☐ trusa de geometrie și calculatorul\n☐ ghiozdanul\n\nHaine:\n☐ uniforma / ținuta pentru școală\n☐ echipamentul și încălțămintea de sport\n\nActe și plăți:\n☐ adeverința medicală\n☐ fondul clasei / al școlii\n☐ abonamentul de transport\n\nOrarul:\n• luni: \n• marți: \n• miercuri: \n• joi: \n• vineri: \n\nȘedința cu părinții: \n`,
    }),
  },  {
    key: 'plecare', label: '🔒 Casa înainte de plecare',
    make: (d) => ({
      title: `Plecare ${dateStamp(d, 'date')}`,
      body: `Plecăm: \nNe întoarcem: \nCine are cheia de rezervă: \n\nApă, gaz, curent:\n☐ robinetul de apă închis\n☐ gazul oprit / centrala pe modul vacanță\n☐ aparatele scoase din priză (televizor, router, încărcătoare)\n☐ frigiderul golit de ce se strică\n\nCasa:\n☐ geamurile și ușa de la balcon închise\n☐ gunoiul dus\n☐ plantele udate sau lăsate la vecini\n☐ cineva ia poșta din cutie\n\nAnimale:\n☐ cine are grijă de ele: \n\nNumere utile:\n• vecin: \n• administrator: \n`,
    }),
  },  {
    key: 'spital', label: '🏥 Internare în spital',
    make: (d) => ({
      title: `Internare ${dateStamp(d, 'date')}`,
      body: `Spitalul / secția: \nMedicul: \nData internării: \nTelefonul secției: \n\nActe:\n☐ buletinul și cardul de sănătate\n☐ biletul de trimitere\n☐ analizele și scrisorile medicale mai vechi\n☐ lista medicamentelor pe care le iei\n\nHaine:\n☐ pijama, halat și papuci\n☐ haine de schimb pentru ieșire\n\nIgienă:\n☐ periuța și pasta de dinți, săpunul\n☐ prosopul\n\nAltele:\n☐ încărcătorul de telefon\n☐ ochelarii / aparatul auditiv\n\nCine trebuie anunțat:\n• \n• \n\nÎntrebări pentru medic:\n• \n`,
    }),
  },  {
    key: 'accident', label: '🚗 Accident auto',
    make: (d) => ({
      title: `Accident ${dateStamp(d, 'date')}`,
      body: `Data și ora: \nLocul: \n\nLa fața locului:\n☐ avariile pornite și triunghiul pus\n☐ dacă e cineva rănit: 112\n☐ poze cu ambele mașini, numerele și locul\n☐ formularul de constatare amiabilă completat și semnat de amândoi\n☐ datele martorilor\n\nCelălalt șofer:\n• nume și telefon: \n• numărul mașinii: \n• asigurarea RCA (firma, nr. poliței): \n\nDupă:\n☐ anunțat asigurătorul (în termenul din poliță)\n☐ programarea la constatarea daunei\n☐ service-ul ales: \n\nNumărul dosarului de daună: \n`,
    }),
  },
  {
    key: 'masina', label: '🚙 Mașina: acte și revizii',
    make: (d) => ({
      title: `Mașina ${dateStamp(d, 'date')}`,
      body: `Mașina: \nNumărul: \n\nActe și termene:\n☐ RCA valabil până la: \n☐ ITP valabil până la: \n☐ rovinieta valabilă până la: \n☐ CASCO (dacă ai) până la: \n\nRevizie:\n☐ uleiul și filtrele (la km: )\n☐ plăcuțele de frână\n☐ lichidul de parbriz\n\nIarna:\n☐ anvelopele de iarnă puse\n☐ trusa medicală și extinctorul în termen\n\nKilometrajul acum: \n`,
    }),
  },
  {
    key: 'nunta', label: '💍 Pregătiri de nuntă',
    make: (d) => ({
      title: `Nunta ${dateStamp(d, 'date')}`,
      body: `Data nunții: \nRestaurantul: \nBiserica / primăria: \n\nCu 6–12 luni înainte:\n☐ restaurantul rezervat (avans dat)\n☐ nașii întrebați\n☐ formația sau DJ-ul\n☐ fotograful și filmarea\n\nCu 3–6 luni înainte:\n☐ actele pentru cununia civilă depuse la primărie\n☐ rochia și costumul\n☐ verighetele\n☐ invitațiile trimise\n\nCu o lună înainte:\n☐ lista invitaților confirmată (Sheets → Listă de invitați)\n☐ așezarea la mese\n☐ tortul și aranjamentele florale comandate\n☐ banii pentru plățile din ziua nunții puși deoparte\n\nCine se ocupă de ce în ziua nunții: \n`,
    }),
  },
  {
    key: 'botez', label: '👶 Botez',
    make: (d) => ({
      title: `Botez ${dateStamp(d, 'date')}`,
      body: `Copilul: \nData botezului: \nBiserica și preotul: \nRestaurantul: \n\nActe:\n☐ certificatul de naștere al copilului (copie)\n☐ actele nașilor (căsătoriți religios, dacă cere parohia)\n☐ programarea la biserică făcută\n\nDe la nași (obiceiul locului):\n☐ lumânarea de botez\n☐ trusoul (hăinuța, prosopul, scutecul)\n☐ cristelnița sau cadoul\n\nCe pregătim noi:\n☐ invitațiile trimise (Sheets → Listă de invitați)\n☐ mărturiile\n☐ tortul\n☐ fotograful\n\nCine aduce ce în ziua botezului: \n`,
    }),
  },
  {
    key: 'craciun', label: '🎄 Crăciun',
    make: (d) => ({
      title: `Crăciun ${dateStamp(d, 'date')}`,
      body: `Unde petrecem: \nCâți suntem: \nBuget: \n\nCadouri (☐ = cumpărat):\n☐ \n☐ \n☐ \n\nMeniul:\n• sarmalele și friptura: \n• cozonacul și prăjiturile: \n• băuturi: \n\nDe pregătit:\n☐ bradul și ornamentele\n☐ luminițele\n☐ felicitările\n☐ cumpărăturile pentru masă\n☐ curățenia\n\nColinde și vizite:\n• \n`,
    }),
  },
  {
    // Din octombrie încolo obiectivele sunt pentru anul care vine.
    key: 'obiective', label: '🎯 Obiective pentru anul nou',
    make: (d) => ({
      title: `Obiective ${d.getFullYear() + (d.getMonth() >= 9 ? 1 : 0)}`,
      body: `Ce a mers bine anul acesta:\n• \n\nCe vreau să schimb:\n• \n\nObiectivele mele (☐ = atins):\n☐ sănătate: \n☐ bani și economii: \n☐ muncă și carieră: \n☐ familie și prieteni: \n☐ ceva nou de învățat: \n\nPrimul pas pentru fiecare, în ianuarie:\n• \n\nVerific cum stau:\n☐ la sfârșitul lui martie\n☐ la sfârșitul lui iunie\n☐ la sfârșitul lui septembrie\n☐ în decembrie\n`,
    }),
  },
  {
    key: 'angajat', label: '👋 Angajat nou',
    make: (d) => ({
      title: `Angajat nou ${dateStamp(d, 'date')}`,
      body: `Numele: \nPostul: \nPrima zi: \nCine îl însoțește în prima săptămână: \n\nÎnainte de prima zi:\n☐ contractul de muncă semnat și trimis în REVISAL\n☐ fișa postului pregătită (Docs → Fișa postului)\n☐ fișa de aptitudini de la medicina muncii\n☐ instructajul de securitate a muncii și PSI programat\n☐ biroul, calculatorul și telefonul pregătite\n☐ contul de e-mail și parolele de acces făcute\n\nÎn prima zi:\n☐ prezentat echipei și turul firmei\n☐ cheile, ecusonul și echipamentul de protecție primite\n☐ regulamentul intern citit și semnat\n\nÎn prima lună:\n☐ discuție la sfârșitul primei săptămâni\n☐ evaluarea de la sfârșitul perioadei de probă\n\nNote: `,
    }),
  },
  {
    key: 'birou', label: '🏢 Mutarea biroului',
    make: (d) => ({
      title: `Mutarea biroului ${dateStamp(d, 'date')}`,
      body: `Data mutării: \nAdresa nouă: \nCine coordonează: \n\nÎnainte:\n☐ contractul pentru noul sediu semnat\n☐ firma de mutări programată\n☐ echipa anunțată (Slides → Mutarea biroului)\n☐ cutii și etichete pentru fiecare coleg\n☐ clienții și furnizorii anunțați (Docs → Anunț de schimbare a sediului)\n☐ schimbarea sediului la Registrul Comerțului\n☐ internetul și telefoanele mutate\n\nÎn ziua mutării:\n☐ calculatoarele mutate de IT, dosarele în cutii sigilate\n☐ cheile și ecusoanele noi împărțite\n\nDupă:\n☐ adresa nouă pe facturi, avize și site\n☐ sediul vechi predat (contoarele, cheile)\n\nNote: `,
    }),
  },
  {
    key: 'voluntariat', label: '💚 Acțiune de voluntariat',
    make: (d) => ({
      title: `Acțiune de voluntariat ${dateStamp(d, 'date')}`,
      body: `Acțiunea: \nData și ora: \nLocul: \nCoordonatorul: \nCâți voluntari ne trebuie: \n\nÎnainte:\n☐ voluntarii anunțați și confirmați\n☐ contractele de voluntariat semnate (Docs → Contract de voluntariat)\n☐ instruirea de protecția muncii făcută\n☐ materialele și echipamentul pregătite\n☐ transportul organizat\n☐ apă și gustări\n\nÎn ziua acțiunii:\n☐ lista de prezență semnată\n☐ pozele făcute (cu acordul celor din ele)\n\nDupă:\n☐ orele trecute în evidență (Sheets → Evidența orelor de voluntariat)\n☐ cheltuielile decontate, cu bonurile\n☐ mulțumiri trimise voluntarilor și partenerilor\n\nCe a mers bine / ce schimbăm data viitoare:\n• \n`,
    }),
  },
  {
    key: 'plecareangajat', label: '🚪 Plecarea unui angajat',
    make: (d) => ({
      title: `Plecarea unui angajat ${dateStamp(d, 'date')}`,
      body: `Numele: \nPostul: \nUltima zi lucrată: \nCum încetează: (acordul părților / demisie / altul)\n\nActele:\n☐ actul de încetare semnat (Docs → Acord de încetare a contractului de muncă)\n☐ încetarea trecută în REVISAL, la timp\n☐ concediul de odihnă rămas socotit (plătit sau efectuat)\n☐ lichidarea calculată și plătită\n☐ adeverința de vechime eliberată\n\nPredarea:\n☐ laptopul, telefonul și încărcătoarele predate\n☐ cheile, ecusonul și cardul de acces predate\n☐ lucrările în curs predate colegului care preia\n☐ proces-verbal de predare-primire semnat\n\nAccesul:\n☐ contul de e-mail închis (cu răspuns automat și redirecționare)\n☐ parolele comune schimbate\n☐ accesul la programe, bancă și SPV oprit\n\nLa sfârșit:\n☐ discuția de plecare (ce a mers bine, ce putem schimba)\n☐ clienții și furnizorii anunțați de noul om de contact\n\nNote: `,
    }),
  },
  {
    key: 'evaluare', label: '🗣 Discuția de evaluare',
    make: (d) => ({
      title: `Discuția de evaluare ${dateStamp(d, 'date')}`,
      body: `Colegul: \nData discuției: \nSala / unde: \n\nÎnainte:\n☐ fișa postului recitită (Docs → Fișa postului)\n☐ obiectivele de anul trecut și ce s-a obținut, cu cifre\n☐ notele trecute în tabel (Sheets → Evaluările anuale ale echipei)\n☐ prezentarea pregătită (Slides → Evaluarea anuală a angajatului)\n☐ colegul anunțat cu o săptămână înainte\n\nÎn discuție:\n☐ întâi ce a mers bine, cu exemple\n☐ ce putem îmbunătăți și ce ajutor îi trebuie\n☐ obiectivele pentru anul viitor, stabilite împreună\n☐ ce cursuri sau responsabilități noi își dorește\n\nDupă:\n☐ fișa de evaluare semnată de amândoi (Docs → Fișa de evaluare a performanțelor)\n☐ cursurile cerute trecute în buget\n☐ următoarea discuție scurtă în calendar\n\nCe a spus colegul:\n• `,
    }),
  },
  {
    key: 'zicoleg', label: '🎂 Ziua unui coleg',
    make: (d) => ({
      title: `Ziua unui coleg ${dateStamp(d, 'date')}`,
      body: `Sărbătoritul: \nZiua: \nCâți ani împlinește: \n\nCu o săptămână înainte:\n☐ ziua văzută în tabel (Sheets → Zilele de naștere ale colegilor)\n☐ colegii anunțați, fără ca sărbătoritul să afle\n☐ suma pe om stabilită și strânsă\n☐ cadoul ales (Notițe → Idei de cadouri)\n\nCu o zi înainte:\n☐ tortul sau prăjiturile comandate\n☐ felicitarea semnată de toți\n☐ filmulețul de felicitare gata (Video → Carton → stilul Aniversare)\n\nÎn ziua cea mare:\n☐ masa pregătită, lumânările și farfuriile\n☐ cadoul și felicitarea date\n☐ „Felicitat” trecut pe Da în tabel\n\nBanii strânși:\n• `,
    }),
  },
  {
    key: 'platifurnizori', label: '💸 Plăți către furnizori',
    make: (d) => ({
      title: `Plăți către furnizori ${dateStamp(d, 'date')}`,
      body: `Săptămâna: \nBani în cont: \n\nÎnainte de plată:\n☐ facturile primite trecute în tabel (Sheets → Facturi de la furnizori)\n☐ întâi cele întârziate (în roșu), apoi cele de plătit în 7 zile (în galben)\n☐ suma de plată comparată cu banii din cont\n☐ IBAN-ul și CUI-ul fiecărui furnizor verificate pe factură\n\nPlățile:\n☐ ordinele de plată făcute în bancă\n☐ la fiecare, numărul facturii scris în detaliile plății\n☐ suma plătită trecută în tabel, la „Plătit”\n\nDupă:\n☐ dovezile de plată salvate lângă facturi\n☐ furnizorii cu care am amânat plata anunțați\n☐ facturile rămase mutate pe săptămâna viitoare\n\nDe plătit săptămâna asta:\n• `,
    }),
  },
  {
    key: 'inchidereluna', label: '🧾 Închiderea lunii',
    make: (d) => ({
      title: `Închiderea lunii ${dateStamp(d, 'date')}`,
      body: `Luna: \nContabilul: \nTermenul de predare a actelor: \n\nActele lunii:\n☐ toate facturile emise, cu numerele la rând (Sheets → Evidență facturi emise)\n☐ facturile primite de la furnizori (Sheets → Facturi de la furnizori)\n☐ extrasele de cont de la bancă\n☐ registrul de casă și chitanțele (Sheets → Registru de casă)\n☐ bonurile de carburant și deconturile de deplasare\n☐ pontajul și cererile de concediu, pentru salarii\n\nVerificări:\n☐ TVA-ul lunii trecut în tabel (Sheets → Evidența TVA pe luni)\n☐ soldul real din cont comparat cu cel estimat (Sheets → Flux de numerar pe 12 luni)\n☐ facturile neîncasate de la clienți: notificări trimise (Docs → Notificare de plată)\n\nPredare:\n☐ actele trimise contabilului\n☐ declarațiile primite de la contabil verificate și depuse\n☐ taxele plătite până pe 25\n\nDe întrebat la contabil:\n• `,
    }),
  },
  {
    key: 'inventariere', label: '📦 Inventarierea anuală',
    make: (d) => ({
      title: `Inventarierea anuală ${dateStamp(d, 'date')}`,
      body: `Anul: \nComisia de inventariere (decizia nr. / data): \nData inventarierii: \n\nÎnainte:\n☐ decizia de numire a comisiei semnată de administrator\n☐ lista mijloacelor fixe tipărită (Sheets → Registrul mijloacelor fixe)\n☐ stocul scriptic tipărit (Sheets → Inventar / stoc)\n☐ gestionarii anunțați; documentele de intrare și ieșire închise la zi\n\nNumărarea:\n☐ fiecare mijloc fix găsit la locul lui, cu numărul de inventar pe el\n☐ echipamentele aflate la angajați confirmate (Sheets → Echipamente date angajaților)\n☐ stocul numărat pe raft și trecut în listele de inventariere\n☐ numerarul din casă numărat și comparat cu registrul de casă (Sheets → Registru de casă)\n☐ soldurile cu clienții și furnizorii confirmate (Sheets → Facturi de la furnizori)\n\nDupă:\n☐ diferențele (plusuri și lipsuri) trecute într-un proces-verbal, cu explicațiile gestionarilor\n☐ bunurile uzate sau stricate propuse pentru casare (Docs → Proces-verbal de casare)\n☐ listele și procesul-verbal semnate de comisie și predate contabilului\n☐ registrul mijloacelor fixe și stocul actualizate\n\nDiferențe găsite:\n• `,
    }),
  },
  {
    key: 'achizitie', label: '🛒 Achiziție de la furnizori',
    make: (d) => ({
      title: `Achiziție ${dateStamp(d, 'date')}`,
      body: `Ce cumpărăm: \nPentru (lucrarea / departamentul): \nBugetul aprobat: \n\nCererea de ofertă:\n☐ lista produselor scrisă (cantități, cerințe), cu acordul celui care le folosește\n☐ cererea de ofertă trimisă la cel puțin 3 furnizori (Docs → Cerere de ofertă)\n☐ termenul de răspuns notat; furnizorii care n-au răspuns sunați\n\nAlegerea:\n☐ ofertele puse alături (Sheets → Compararea ofertelor), cu termenul, plata și garanția\n☐ ales furnizorul (cea mai mică ofertă completă sau motivul altei alegeri, scris)\n☐ comanda trimisă și confirmată în scris (prețul, termenul, locul de livrare)\n\nLa primire:\n☐ marfa verificată la livrare: cantitatea, calitatea, avizul sau factura\n☐ nota de recepție (NIR) făcută; diferențele trecute într-un proces-verbal (Docs → Proces-verbal de recepție)\n☐ factura plătită la termen (Sheets → Facturi de la furnizori)\n☐ garanția și documentele păstrate la dosar\n`,
    }),
  },
  {
    key: 'reinnoirecontract', label: '📑 Reînnoirea unui contract',
    make: (d) => ({
      title: `Reînnoirea contractului ${dateStamp(d, 'date')}`,
      body: `Contractul (partener, nr. și data): \nSfârșitul de acum: \nPreavizul (zile): \n\nCu o lună înainte:\n☐ contractul găsit în Sheets → Evidența contractelor (zilele rămase, starea De reînnoit)\n☐ citit ce spune contractul despre prelungire și preaviz\n☐ hotărât: prelungim, schimbăm condițiile sau încetăm\n☐ cerută oferta nouă / prețul nou de la partener (sau trimisă a noastră)\n\nDacă prelungim sau schimbăm:\n☐ actul adițional scris (Docs → Act adițional la contract)\n☐ actul adițional semnat de ambele părți, câte un exemplar\n☐ noua dată de sfârșit și valoarea trecute în Evidența contractelor\n\nDacă încetăm:\n☐ notificarea trimisă în termenul de preaviz (Docs → Cerere de reziliere)\n☐ confirmarea primirii păstrată (registratură, e-mail sau poștă cu confirmare)\n☐ ultimele plăți și predările făcute; contractul trecut ca încheiat`,
    }),
  },
  {
    key: 'arhivare', label: '🗄 Arhivarea documentelor anului',
    make: (d) => ({
      title: `Arhivarea documentelor ${dateStamp(d, 'date')}`,
      body: `Anul arhivat: 
Cine răspunde de arhivă: 
Locul arhivei (dulap / cameră): 

Adunarea:
☐ facturile emise și primite, pe luni, cu extrasele de cont alături
☐ registrul de casă și chitanțele închise la 31 decembrie (Sheets → Registru de casă)
☐ contractele încheiate sau expirate în anul acesta (Sheets → Evidența contractelor)
☐ corespondența intrată și ieșită, după registru (Sheets → Registru de intrări-ieșiri)
☐ statele de plată, pontajele și dosarele de concediu

Arhivarea:
☐ fiecare dosar cu eticheta lui: anul, felul documentelor, perioada
☐ lista dosarelor (nomenclatorul) scrisă și pusă în primul bibliorafit (Docs → Proces-verbal de predare-primire)
☐ copiile digitale salvate în dosarul anului și într-o copie de siguranță

Cât se păstrează:
☐ termenele de păstrare notate pe fiecare dosar (documentele contabile 5 ani, statele de plată 50 de ani)
☐ dosarele cu termenul trecut propuse pentru eliminare, cu proces-verbal (Sheets → Evidența arhivei, Docs → Proces-verbal de eliminare din arhivă)

Dosare lipsă sau incomplete:
• `,
    }),
  },
  {
    key: 'obiectivelunii', label: '📈 Ședința lunară pe obiective',
    make: (d) => ({
      title: `Obiectivele lunii ${dateStamp(d, 'date')}`,
      body: `Luna:
Cine participă:

Înainte de ședință:
☐ fiecare responsabil a scris „Realizat acum” în Sheets → Urmărirea obiectivelor
☐ obiectivele în urmă (în galben) și cele întârziate (în roșu) notate mai jos
☐ cifrele lunii trecute pregătite (vânzări, costuri, clienți)

În ședință:
☐ progresul mediu și câte obiective sunt pe drum, în urmă, întârziate
☐ pentru fiecare obiectiv în urmă: de ce, ce facem și până când
☐ ce ajutor cere fiecare responsabil (oameni, bani, decizii)
☐ obiectivele care nu mai au sens: schimbate sau scoase, cu motivul

După ședință:
☐ minuta trimisă participanților (Docs → Minută de ședință)
☐ termenele și țintele schimbate trecute în Urmărirea obiectivelor
☐ data ședinței următoare stabilită

Obiective în urmă și ce facem:
• `,
    }),
  },
  {
    key: 'incasaricreante', label: '💰 Încasarea facturilor restante',
    make: (d) => ({
      title: `Facturi restante ${dateStamp(d, 'date')}`,
      body: `Clientul:
Persoana de contact:
Suma restantă:
Cea mai veche factură:

Verificări:
☐ restul de încasat și vechimea din Sheets → Vechimea creanțelor
☐ plățile din extrasul de cont căutate (să nu fie deja plătite)
☐ soldul confirmat cu clientul (Docs → Confirmare de sold)

Pași de încasare:
☐ telefon sau e-mail prietenos, la câteva zile după scadență
☐ notificare scrisă la peste 30 de zile (Docs → Notificare de plată)
☐ eșalonare propusă, dacă clientul cere (Docs → Cerere de eșalonare a plății)
☐ livrările noi oprite până la plată, la peste 60 de zile
☐ penalitățile sau dobânda legală calculate (Sheets → Penalități de întârziere)
☐ somația de plată trimisă recomandat, cu confirmare de primire (Docs → Somație de plată)
☐ după 15 zile de la primirea somației fără plată: ordonanța de plată, cu avocatul

După încasare:
☐ plata trecută în Sheets → Evidență facturi emise
☐ soldul clientului verificat din nou

Ce s-a vorbit și când:
• `,
    }),
  },
  {
    key: 'vanzarilunii', label: '🤝 Ședința lunară de vânzări',
    make: (d) => ({
      title: `Vânzările lunii ${dateStamp(d, 'date')}`,
      body: `Luna:
Cine participă:

Înainte de ședință:
☐ vânzările și ținta fiecărui agent trecute în Sheets → Comisioanele agenților
☐ facturile neîncasate ale clienților fiecărui agent (Sheets → Vechimea creanțelor)
☐ ofertele trimise și încă fără răspuns, pe agenți

În ședință:
☐ realizarea fiecărui agent față de țintă și cei sub 80%
☐ clienții noi și clienții pierduți în lună
☐ restanțele mari: cine sună și până când
☐ țintele pentru luna următoare

După ședință:
☐ comisioanele și bonusurile trimise la salarii (Sheets → Stat de plată)
☐ țintele noi trecute în tabel

Ce a mers bine și ce schimbăm:
• `,
    }),
  },
  {
    key: 'reclamatieclient', label: '📣 Reclamația unui client',
    make: (d) => ({
      title: `Reclamație ${dateStamp(d, 'date')}`,
      body: `Clientul și telefonul:
Factura / comanda:
Ce reclamă:

La primire:
☐ reclamația scrisă, cu data și ora (registrul de reclamații)
☐ pozele sau produsul primite de la client
☐ clientului i s-a spus în cât timp primește răspuns

Verificarea:
☐ produsul și factura verificate
☐ dacă e vina transportului: Docs → Proces-verbal de constatare a pagubei
☐ dacă e vina furnizorului: Docs → Notificare de neconformitate la livrare

Rezolvarea:
☐ ce primește clientul: reparare, înlocuire, banii înapoi sau reducere
☐ răspunsul trimis clientului în scris
☐ factura de stornare sau produsul nou trimis
☐ reclamația închisă în registru

Ce schimbăm ca să nu se repete:
• `,
    }),
  },
  {
    key: 'adunareasociati', label: '🏛 Adunarea asociaților',
    make: (d) => ({
      title: `Adunarea asociaților ${dateStamp(d, 'date')}`,
      body: `Data, ora și locul:
Asociații și părțile lor sociale:

Înainte de adunare:
☐ situațiile financiare ale anului, primite de la contabil
☐ ordinea de zi scrisă și trimisă asociaților (convocarea)
☐ împuternicirile pentru asociații care nu vin personal
☐ propunerea pentru profit: dividende, rezerve, profit nerepartizat

La adunare:
☐ prezența și procentul din capital, ca adunarea să poată hotărî
☐ votul pe fiecare punct din ordinea de zi
☐ hotărârea scrisă și semnată (Docs → Hotărârea adunării generale a asociaților; la un singur asociat, Docs → Decizia asociatului unic)

După adunare:
☐ hotărârea trecută în registrul hotărârilor
☐ depunerea la Registrul Comerțului, dacă s-a schimbat administratorul, sediul sau activitatea
☐ dividendele plătite și impozitul pe dividende declarat și plătit la termen

Ce rămâne de făcut și cine se ocupă:
• `,
    }),
  },
  {
    key: 'verificaressm', label: '🧯 Verificarea de protecția muncii',
    make: (d) => ({
      title: `Verificare protecția muncii ${dateStamp(d, 'date')}`,
      body: `Locul de muncă / punctul de lucru:
Cine face verificarea:

Instruirea oamenilor:
☐ fișele de instruire semnate de toți angajații (și de cei noi)
☐ instruirea periodică făcută la termen (Slides → Instruire de protecția muncii)
☐ angajații noi au făcut instruirea la angajare

Stingerea incendiilor și evacuarea:
☐ stingătoarele la locul lor, cu verificarea la zi
☐ căile de evacuare și ieșirile libere, cu indicatoare
☐ planul de evacuare afișat la vedere

Prim ajutor și echipamente:
☐ trusa de prim ajutor completă, fără produse expirate
☐ echipamentul de protecție dat și purtat (mănuși, ochelari, încălțăminte)
☐ prizele, cablurile și aparatele fără defecte

Ce trebuie reparat și până când:
• `,
    }),
  },
  {
    key: 'predareechip', label: '🦺 Predarea echipamentului de protecție',
    make: (d) => ({
      title: `Echipament de protecție ${dateStamp(d, 'date')}`,
      body: `Angajatul:
Locul de muncă / postul:
Cine predă echipamentul:

Înainte de predare:
☐ ce echipament îi trebuie pe postul lui, după lista responsabilului cu securitatea muncii
☐ mărimile cerute angajatului (îmbrăcăminte, încălțăminte, mănuși)
☐ bucățile luate din magazie și trecute pe fișa de magazie (Sheets → Fișa de magazie)

La predare:
☐ fiecare bucată arătată și verificată că e nouă și fără defecte
☐ angajatul instruit cum se poartă și cum se păstrează echipamentul
☐ procesul-verbal completat și semnat de amândoi (Docs → Proces-verbal de predare-primire a echipamentului de protecție)
☐ un exemplar dat angajatului, unul pus la dosarul lui

După predare:
☐ fiecare bucată trecută în evidență, cu data primirii și durata de folosire (Sheets → Evidența echipamentului de protecție)
☐ data de înlocuire notată în calendar pentru bucățile care se uzează repede

Bucăți predate:
• 

Observații:
• `,
    }),
  },
  {
    key: 'lucrariagricole', label: '🚜 Lucrările agricole ale sezonului',
    make: (d) => ({
      title: `Lucrări agricole ${dateStamp(d, 'date')}`,
      body: `Ferma / parcela:
Cultura:
Suprafața (ha):

Pregătirea:
☐ planul culturilor pe parcele, cu rotația față de anul trecut
☐ sămânța, îngrășămintele și tratamentele cumpărate și trecute în magazie (Sheets → Fișa de magazie)
☐ utilajele verificate (tractor, semănătoare, mașina de stropit), cu reviziile la zi

În câmp:
☐ terenul arat și pregătit
☐ semănatul făcut, cu data și cantitatea de sămânță pe hectar
☐ tratamentele făcute, fiecare cu produsul, doza și data, trecute în registrul de tratamente
☐ irigarea, după vreme

La recoltare:
☐ recolta cântărită și trecută în evidență, pe parcele
☐ vânzarea sau depozitarea, cu actele de însoțire a mărfii
☐ cererile de sprijin și termenele lor notate în calendar
☐ cheltuielile sezonului adunate pe cultură, ca să se vadă câștigul pe hectar

Cheltuieli:
•

Observații:
• `,
    }),
  },
  {
    key: 'revelion', label: '🎆 Revelionul',
    make: (d) => ({
      title: `Revelion ${dateStamp(d, 'date')}`,
      body: `Unde:
Câte persoane:
Bugetul:

Cu o lună înainte:
☐ locul ales (acasă, la cabană, la restaurant) și rezervarea făcută
☐ lista invitaților, cu confirmările lor
☐ meniul hotărât: aperitive, felul principal, desertul, tortul de la miezul nopții
☐ transportul și cazarea pentru cei care vin de departe

Cu o săptămână înainte:
☐ cumpărăturile mari făcute (Notițe → 🛒 Listă de cumpărături)
☐ băuturile și șampania pentru miezul nopții
☐ muzica pregătită și boxele încercate
☐ decorațiunile: globuri, ghirlande, baloane

În ziua de 31:
☐ masa pusă și mâncarea pregătită
☐ artificii doar dintre cele vândute liber, aprinse afară, departe de oameni, de animale și de mașini
☐ cine conduce spre casă nu bea (sau taxiul chemat dinainte)
☐ invitațiile și felicitările trimise (Docs → Inserare → ☺ Pictograme → Sărbători și petreceri)

Cheltuieli:
•

Observații:
• `,
    }),
  },
  {
    key: 'stupina', label: '🐝 Verificarea stupinei',
    make: (d) => ({
      title: `Verificarea stupinei ${dateStamp(d, 'date')}`,
      body: `Stupina (locul):
Data și vremea:
Câte familii am verificat:

La fiecare stup:
☐ matca văzută sau ouă proaspete în celule
☐ puietul compact, fără celule goale printre el
☐ hrana: câte rame cu miere și cu păstură
☐ semne de roire (botci pe marginea ramelor)
☐ varroa: numărătoarea pe fundul cu plasă, tratamentul la zi
☐ urdinișul curat, fără albine moarte în fața stupului

După vizită:
☐ ramele noi sau faguri artificiali puși unde trebuie
☐ hrănirea (sirop sau turtă) notată pe stup
☐ data următoarei vizite

Stupi care au nevoie de ceva:
•

Observații:
• `,
    }),
  },
  {
    key: 'instalator', label: '🔧 Vizita instalatorului',
    make: (d) => ({
      title: `Vizita instalatorului ${dateStamp(d, 'date')}`,
      body: `Instalatorul (nume, telefon):
Data și ora:
Ce nu merge (o țeavă care curge, scurgerea înfundată, boilerul, apometrul):

Înainte să vină:
☐ apa oprită de la robinetul general, dacă e o scurgere
☐ poze cu locul și cu plăcuța boilerului sau a aparatului
☐ locul golit (sub chiuvetă, lângă boiler, la apometru)
☐ întrebat cât costă deplasarea și ora de lucru

Când lucrează:
☐ cerut prețul piesei înainte de montaj
☐ întrebat dacă lucrarea are garanție și cât
☐ verificat împreună că nu mai curge nimic, cu apa pornită

După:
☐ indexul apometrului notat, dacă a fost schimbat sau mutat
☐ chitanța sau factura păstrată

Ce s-a reparat, piesele și cât am plătit:
•

Ce trebuie urmărit de acum (îmbinări, presiunea, curățarea sifonului):
• `,
    }),
  },
  {
    key: 'comandamancare', label: '🍕 Comandă de mâncare la birou',
    make: (d) => ({
      title: `Comandă de mâncare la birou ${dateStamp(d, 'date')}`,
      body: `Comanda (de la ce local, telefon sau aplicație):
Cine strânge banii:
Ora până la care se adună comenzile:

Înainte de comandă:
☐ întrebați toți colegii, și cei plecați pe teren
☐ notate alergiile și cine nu mănâncă de post sau fără carne
☐ verificat dacă localul livrează până la birou și cât costă livrarea
☐ ales cum se plătește: la livrare, cu cardul sau cu tichete de masă

Cine ce vrea (nume, ce, sosuri, băutură, preț):
•
•
•

La livrare:
☐ comanda verificată cu lista, înainte să plece curierul
☐ bonul fiscal păstrat (pentru decont, dacă plătește firma)
☐ fiecare și-a dat banii

Total comandă:
Ce n-a mers de data asta (lipsuri, întârziere, alt local data viitoare):
• `,
    }),
  },
  {
    key: 'poartametalica', label: '🔩 Comandă de poartă metalică',
    make: (d) => ({
      title: `Comandă de poartă metalică ${dateStamp(d, 'date')}`,
      body: `Ce se face (poartă, gard, balustradă, grilaj) și unde:
Atelierul (nume, telefon) și prețul cerut:
Avans dat / rest de plată:
Gata până la:

Înainte de comandă:
☐ măsurat golul (lățimea, înălțimea, denivelarea terenului)
☐ ales modelul (desen sau poză) și grosimea profilelor
☐ hotărât cum se deschide (batantă, culisantă) și pe ce parte
☐ stabilit vopseaua (grund anticoroziv, culoarea, câte straturi)
☐ cerut oferta scrisă, cu montajul și transportul incluse

La montaj:
☐ stâlpii fixați drept și turnați în beton
☐ poarta se închide ușor, fără să se frece
☐ sudurile curățate și vopsite, fără rugină la colțuri
☐ broasca și cheile primite (câte chei)

Ce a costat în total (material, manoperă, montaj):
Garanția (cât timp, ce acoperă):
Ce trebuie retușat sau uns peste un an:
• `,
    }),
  },
  {
    key: 'tipografie', label: '🖨 Comandă la tipografie',
    make: (d) => ({
      title: `Comandă la tipografie ${dateStamp(d, 'date')}`,
      body: `Ce se tipărește (cărți de vizită, pliante, afișe, roll-up, broșuri) și câte bucăți:
Tipografia (nume, telefon) și prețul cerut:
Avans dat / rest de plată:
Gata până la:

Înainte de trimis:
☐ textul citit de două ori (nume, telefoane, adrese, prețuri)
☐ formatul și hârtia alese (dimensiunea, grosimea, lucioasă sau mată)
☐ fișierul salvat în PDF, cu fonturile incluse și margine de tăiere
☐ culorile în CMYK și pozele la cel puțin 300 dpi
☐ sigla și culorile firmei ca pe celelalte materiale

Înainte de tipar:
☐ proba (bun de tipar) primită și verificată pe hârtie sau pe ecran
☐ confirmat în scris „bun de tipar”

La ridicare:
☐ numărat bucățile și verificat câteva din fiecare pachet
☐ factura primită

Ce a costat în total (tipar, finisare, transport):
Fișierele finale păstrate în:
Ce schimbăm la următoarea comandă:
• `,
    }),
  },
  {
    key: 'spectacoldans', label: '💃 Spectacolul de dans',
    make: (d) => ({
      title: `Spectacolul de dans ${dateStamp(d, 'date')}`,
      body: `Școala sau clubul de dans:
Sala și adresa:
Data și ora (repetiția generală / spectacolul):

Grupa și dansul:
• grupa (vârsta, nivelul) și instructorul:
• numele dansului și muzica:
• locul în program (al câtelea număr):

Cu o săptămână înainte:
☐ costumul gata, încercat și cu numele scris pe el
☐ încălțămintea potrivită (poante, pantofi de step, pantofi de dans) curată
☐ taxa pentru spectacol și pentru costum plătită
☐ biletele sau invitațiile pentru familie luate
☐ ora repetiției generale știută

În ziua spectacolului:
☐ sosiți la sală cu cel puțin o oră înainte
☐ părul și machiajul făcute după cerința instructorului
☐ apă, o gustare și haine de schimb în geantă
☐ copilul predat în culise și ora de ridicare stabilită

Cum a mers și ce reținem pentru anul viitor:
• `,
    }),
  },
  {
    key: 'cursolarit', label: '🏺 Curs de olărit',
    make: (d) => ({
      title: `Curs de olărit ${dateStamp(d, 'date')}`,
      body: `Atelierul de ceramică:
Adresa și telefonul:
Ziua și ora cursului:

Ce lucrăm:
• obiectul (cană, bol, vas, farfurie):
• tehnica (la roată / modelat cu mâna / din plăci de lut):
• culorile glazurii alese:

Înainte de curs:
☐ haine vechi sau un șorț care se poate murdări
☐ unghiile scurte, fără inele și brățări
☐ taxa pentru curs și pentru material plătită
☐ un prosop și o cutie pentru piesele duse acasă

După curs:
☐ piesa lăsată la uscat, cu numele scris pe fund
☐ data primei arderi aflată
☐ glazura pusă după prima ardere
☐ data la care piesa e gata de ridicat

Ce a ieșit bine și ce încercăm data viitoare:
• `,
    }),
  },
  {
    key: 'culesplante', label: '🌿 Culesul plantelor medicinale',
    make: (d) => ({
      title: `Culesul plantelor medicinale ${dateStamp(d, 'date')}`,
      body: `Locul culesului (pajiștea, marginea pădurii):
Data și vremea:
Cine merge:

Ce culegem:
• planta și partea folosită (flori, frunze, rădăcini):
• cât adunăm (mănunchiuri, coșuri):
• unde le punem la uscat:

Înainte de plecare:
☐ plantele recunoscute sigur (cu o carte sau un om care le știe)
☐ locul departe de drumuri, câmpuri stropite și fabrici
☐ foarfecă sau cuțit mic, coș sau saci de pânză (nu de plastic)
☐ mănuși, apă și haine potrivite

La cules și după:
☐ cules doar într-o zi uscată, după ce s-a dus roua
☐ lăsat cel puțin o treime din plante pe loc, ca să crească din nou
☐ plantele întinse la uscat la umbră, într-un strat subțire
☐ borcanele etichetate cu numele plantei și data culesului

Ce am cules și ce reținem pentru anul viitor:
• `,
    }),
  },
  {
    key: 'macinat', label: '🌾 Grâul dus la moară',
    make: (d) => ({
      title: `Grâul dus la moară ${dateStamp(d, 'date')}`,
      body: `Moara (numele, satul, telefonul morarului):
Ziua și ora la rând:
Cine duce sacii și cu ce mașină:

Ce ducem:
• grâu de măcinat (câți saci, cât cântăresc):
• porumb de măcinat (câți saci, cât cântăresc):
• ce vrem să iasă (făină albă, făină neagră, mălai, tărâțe):
• cum plătim (bani sau uium, cât se oprește la sută):

Înainte de plecare:
☐ boabele bine uscate și vânturate, fără pietre și pleavă
☐ sacii întregi, curați și legați bine
☐ sacii cântăriți acasă și greutatea notată
☐ saci goi în plus pentru tărâțe

La moară:
☐ sacii cântăriți la moară, greutatea scrisă pe bon
☐ uiumul sau prețul măcinatului înțeles dinainte
☐ făina și mălaiul cântărite la ieșire și puse în saci etichetați
☐ sacii puși acasă la loc uscat și răcoros, feriți de șoareci

Ce am primit (făină, mălai, tărâțe) și ce reținem pentru data viitoare:
• `,
    }),
  },
  {
    key: 'calarie', label: '🐎 Lecția de călărie',
    make: (d) => ({
      title: `Lecția de călărie ${dateStamp(d, 'date')}`,
      body: `Clubul sau herghelia (adresa, telefonul):
Ziua și ora lecției:
Instructorul:
Calul primit (numele, cât de liniștit e):

Lecția de azi:
• ce exersăm (pas, trap, galop, sărituri):
• cât durează și cât costă:
• ce ne-a spus instructorul să lucrăm:

Înainte de lecție:
☐ cască de călărie potrivită pe cap și prinsă sub bărbie
☐ cizme sau ghete cu toc mic, pantaloni lungi, mănuși
☐ calul țesălat și copitele curățate, cu ajutorul îngrijitorului
☐ șaua și chinga verificate, scările potrivite la lungimea piciorului

La lecție și după:
☐ apropiere de cal din față și din lateral, niciodată din spate
☐ urcat și coborât doar pe partea stângă, cu instructorul lângă
☐ calul plimbat la pas la sfârșit, să se liniștească
☐ calul răsplătit și harnașamentul pus la loc, curat

Ce a mers bine și ce lucrăm data viitoare:
• `,
    }),
  },
  {
    key: 'cizmarie', label: '👞 Pantofi duși la reparat',
    make: (d) => ({
      title: `Pantofi la reparat ${dateStamp(d, 'date')}`,
      body: `Atelierul (cizmăria):
Telefonul și programul:
Numărul bonului de primire:

Ce am lăsat:
• perechea (pantofi, ghete, cizme, sandale) și culoarea:
• ce trebuie făcut (talpă, tocuri, cusătură, fermoar, lărgit, vopsit):
• prețul spus la primire:
• avansul dat:

La predare:
☐ bonul de primire luat, cu ce s-a lăsat și prețul scris pe el
☐ ce trebuie reparat spus clar și arătat pe pantof
☐ urmele vechi (zgârieturi, pete) arătate și trecute pe bon
☐ data la care sunt gata stabilită
☐ întrebat dacă se poate și lustruit sau schimbat șiretul

La ridicare:
☐ reparația verificată pe loc: talpa lipită bine, tocurile drepte, cusătura curată
☐ pantofii încercați în picioare înainte de plată
☐ bonul sau chitanța primită pentru restul de plată
☐ întrebat cât ține garanția reparației

Ce s-a făcut și cât am plătit în total:
• `,
    }),
  },
  {
    key: 'lemnefoc', label: '🪵 Comandă de lemne de foc',
    make: (d) => ({
      title: `Lemne de foc ${dateStamp(d, 'date')}`,
      body: `Furnizorul (firma sau ocolul silvic):
Telefonul:
Adresa de livrare:

Lemnele comandate:
• esența (fag, stejar, carpen, salcâm, amestec):
• cantitatea (metri steri sau metri cubi):
• lungimea bucăților (1 m, 33 cm, 25 cm):
• prețul pe unitate și transportul:

Înainte de livrare:
☐ prețul stabilit pe metru ster sau pe metru cub, nu pe „căruță” sau „remorcă”
☐ lemnele uscate cel puțin un an sau uscate în uscător
☐ data și ora livrării stabilite
☐ loc liber pentru mașină și pentru descărcare

La livrare:
☐ avizul de însoțire primit, cu codul de verificare a transportului
☐ cantitatea măsurată la descărcare: lungime × lățime × înălțime
☐ lemnele verificate: fără putregai, fără prea multe bucăți subțiri
☐ chitanța sau factura primită
☐ lemnele stivuite sub acoperiș, ferite de ploaie și de pământ

Cât a ieșit măsurat și ce plătim:
• `,
    }),
  },
  {
    key: 'predarelapte', label: '🥛 Predarea laptelui la colectare',
    make: (d) => ({
      title: `Predarea laptelui ${dateStamp(d, 'date')}`,
      body: `Ferma / crescătorul:
Centrul de colectare:
Numărul de animale mulse:

Laptele predat:
• cantitatea (litri):
• temperatura la predare:
• ora predării:

Înainte de predare:
☐ ugerele spălate și primele jeturi aruncate
☐ laptele strecurat și răcit sub 6 °C, cât mai repede după muls
☐ bidoanele spălate, clătite și uscate
☐ laptele de la animalele tratate cu medicamente pus deoparte, până trece termenul de așteptare
☐ capacele bidoanelor bine închise

La centrul de colectare:
☐ laptele cântărit sau măsurat de față cu noi
☐ proba luată pentru analize (grăsime, proteine, germeni)
☐ bonul de predare primit, cu cantitatea și data
☐ cantitatea trecută în carnetul fermei

Rezultatele analizelor și plata pe luna aceasta:
• 
`,
    }),
  },
  {
    key: 'imprumutbiblioteca', label: '📚 Împrumuturi de la bibliotecă',
    make: (d) => ({
      title: `Împrumuturi de la bibliotecă ${dateStamp(d, 'date')}`,
      body: `Biblioteca:
Numărul permisului de bibliotecă:
Programul (zilele și orele):

Cărțile împrumutate (titlul, autorul, data de returnare):
• 
• 
• 

Înainte de termen:
☐ datele de returnare trecute în calendar
☐ prelungirea cerută la timp (la ghișeu, la telefon sau pe site)
☐ cărțile verificate să nu aibă pagini îndoite sau notițe pe ele
☐ semnele de carte și foile proprii scoase dintre pagini

La bibliotecă:
☐ cărțile predate la ghișeu sau puse în cutia de returnare
☐ returnarea confirmată (bonul sau mesajul primit)
☐ penalitățile de întârziere plătite, dacă sunt
☐ cărțile rezervate ridicate
☐ permisul de bibliotecă reînnoit, dacă expiră

Ce vreau să citesc data viitoare:
• 
`,
    }),
  },
  {
    key: 'deseuri', label: '♻ Predarea deșeurilor la colectare',
    make: (d) => ({
      title: `Predarea deșeurilor ${dateStamp(d, 'date')}`,
      body: `Data predării:
Punctul de colectare / firma care ridică:
Cine predă:

Ce predăm (cantitatea aproximativă):
• hârtie și carton:
• plastic și metal:
• sticlă:
• electronice uzate (DEEE):
• baterii și becuri:

Înainte de predare:
☐ deșeurile sortate pe feluri, în saci sau cutii separate
☐ cartonul pliat și legat, fără bandă adezivă sau folie
☐ electronicele întregi, cu datele șterse de pe calculatoare și telefoane
☐ bateriile puse separat, în cutia de colectare
☐ cartușele de toner și becurile puse deoparte, nu la gunoi

La predare:
☐ deșeurile cântărite sau numărate de față cu noi
☐ formularul de predare-primire semnat și primit
☐ cantitățile trecute în evidența deșeurilor a firmei
☐ data următoarei ridicări stabilită

Observații (ce nu s-a primit și de ce):
•
`,
    }),
  },
  {
    key: 'turabenzinarie', label: '⛽ Predarea turei la benzinărie',
    make: (d) => ({
      title: `Predarea turei la benzinărie ${dateStamp(d, 'date')}`,
      body: `Tura (de la ora / până la ora):
Predă: 
Primește: 

Indexurile pompelor (la predare):
• pompa 1: 
• pompa 2: 

La predare:
☐ indexurile pompelor citite și trecute mai sus
☐ nivelul din rezervoare măsurat (litri pe fiecare carburant)
☐ numerarul din casă numărat și raportul Z sau X scos
☐ bonurile, facturile și plățile cu cardul puse deoparte
☐ pistoalele de alimentare la locul lor, fără scurgeri

Siguranța și curățenia:
☐ stingătoarele la locul lor, cu sigiliul pus
☐ nisipul sau materialul absorbant pentru scurgeri la îndemână
☐ pista și toaletele curate, coșurile golite
☐ aerul pentru roți și aspiratorul merg

Probleme în tură (defecte, clienți, livrări de carburant):
• 

Semnături (predă / primește):
`,
    }),
  },
  {
    key: 'renovarecamera', label: '🎨 Renovarea unei camere',
    make: (d) => ({
      title: `Renovarea unei camere ${dateStamp(d, 'date')}`,
      body: `Camera (care, suprafața pereților și a tavanului):
Cine lucrează (echipa, telefon) și prețul cerut:
Început / gata până la:

Înainte să înceapă:
☐ mobila scoasă sau strânsă la mijloc și acoperită cu folie
☐ prizele și întrerupătoarele protejate cu bandă, curentul oprit unde se lucrează
☐ culoarea aleasă și încercată pe o bucată de perete
☐ calculat câtă vopsea, glet și grund trebuie (cu 10% în plus)

Materiale cumpărate (ce, cât, preț, de unde):
•
•
•

Pe parcurs:
☐ fisurile reparate, gletuite și apoi șlefuite
☐ grundul dat înainte de vopsea
☐ al doilea strat dat după ce s-a uscat primul

La final:
☐ pereții verificați în lumină (pete, urme de trafalet, colțuri)
☐ curățenia făcută și resturile duse la container

Cât a costat în total (manoperă și materiale):
Ce culoare și ce cod de vopsea am folosit (pentru retușuri):
• `,
    }),
  },
  {
    key: 'stomatolog', label: '🦷 Vizita la stomatolog',
    make: (d) => ({
      title: `Vizita la stomatolog ${dateStamp(d, 'date')}`,
      body: `Cabinetul și medicul:
Data și ora programării:
De ce merg (control, detartraj, o durere, o plombă căzută):

Înainte de programare:
☐ programarea confirmată cu o zi înainte
☐ lista cu medicamentele pe care le iau și cu alergiile
☐ radiografiile vechi sau fișa de la alt cabinet, dacă le am
☐ întrebat dacă tratamentul se decontează prin casa de asigurări

La cabinet:
☐ spus medicului de sarcină, tensiune, boli de inimă sau medicamente care subțiază sângele
☐ cerut planul de tratament în scris, cu prețul fiecărei etape
☐ întrebat câte ședințe sunt și cât durează fiecare

După:
☐ fără mâncare și băutură fierbinte cât a spus medicul
☐ următoarea programare trecută în calendar

Ce s-a făcut și cât am plătit:
•

Sfaturile medicului (periaj, ață dentară, ce evit):
• `,
    }),
  },
  {
    key: 'drumetiemunte', label: '🥾 Drumeție la munte',
    make: (d) => ({
      title: `Drumeție la munte ${dateStamp(d, 'date')}`,
      body: `Traseul (de unde plec, până unde, marcajul):
Data, ora plecării și ora la care trebuie să fiu înapoi:
Cine merge (și un telefon de urgență):

Cu o zi înainte:
☐ prognoza meteo verificată pentru munte (vânt, ploaie, ceață)
☐ traseul și timpul de mers văzute pe hartă, cu un punct de întoarcere
☐ cineva de acasă știe traseul și ora la care mă întorc
☐ telefonul încărcat, o baterie externă și numărul Salvamont salvat

În rucsac:
☐ apă (cel puțin 1,5 litri) și ceva de mâncare
☐ haină de ploaie și un strat cald, chiar dacă e soare jos
☐ lanternă frontală și trusa mică de prim ajutor
☐ bocanci purtați înainte, nu noi

Pe traseu:
☐ marcajul urmărit; la cel lipsă, înapoi la ultimul văzut
☐ întoarcerea la ora stabilită, chiar dacă nu am ajuns sus

Cât am mers (ore, kilometri, diferență de nivel):
•

Observații (izvoare, locuri de popas, ce aș lua data viitoare):
• `,
    }),
  },
  {
    key: 'calatorietren', label: '🚆 Călătorie cu trenul',
    make: (d) => ({
      title: `Călătorie cu trenul ${dateStamp(d, 'date')}`,
      body: `Ruta (de unde, până unde, unde schimb trenul):
Data, ora plecării și numărul trenului:
Vagonul și locul:

Înainte de plecare:
☐ biletul cumpărat (sau pe telefon) și locul rezervat
☐ legăturile verificate: cât timp am între trenuri la schimbare
☐ actul de identitate și cardul de reducere, dacă am
☐ telefonul încărcat și o baterie externă
☐ apă și ceva de mâncare pentru drum

În gară:
☐ linia de plecare văzută pe tabelă, cu cel puțin 15 minute înainte
☐ locul vagonului găsit pe peron (după numărul vagonului)

La sosire:
☐ bagajele luate toate de pe raft
☐ drumul de la gară până la destinație știut (autobuz, taxi, pe jos)

Cât a costat și cât a durat drumul:
•

Observații:
• `,
    }),
  },
  {
    key: 'culesviei', label: '🍇 Culesul viei',
    make: (d) => ({
      title: `Culesul viei ${dateStamp(d, 'date')}`,
      body: `Parcela și soiul:
Ziua culesului și câți culegători vin:
Zahărul din struguri (refractometru) și vremea:

Înainte de cules:
☐ găleți, foarfeci și lăzi spălate, câte ajung pentru toți culegătorii
☐ teascul, zdrobitorul și vasele pentru must curățate și clătite
☐ butoaiele spălate, verificate să nu curgă și pregătite
☐ masa și apa pentru culegători, cine aduce ce

La cules:
☐ boabele mucegăite sau stricate scoase din ciorchine
☐ lăzile numărate sau cântărite la capătul fiecărui rând
☐ strugurii duși la teasc în aceeași zi

După cules:
☐ mustul pus în vase, cu data și cantitatea scrise pe fiecare
☐ uneltele spălate și puse la uscat

Cât s-a cules (kg) și cât must a ieșit (litri):
•

Observații:
• `,
    }),
  },
  {
    key: 'iesirebarca', label: '⛵ Ieșire cu barca',
    make: (d) => ({
      title: `Ieșire cu barca ${dateStamp(d, 'date')}`,
      body: `Barca și locul de plecare:
Ora plecării și ora întoarcerii:
Câte persoane la bord:
Prognoza (vânt, valuri):

Înainte de plecare:
☐ vestă de salvare pentru fiecare om de la bord
☐ colacul de salvare și parâma la îndemână
☐ motorul pornit la mal, combustibil dus-întors și o rezervă
☐ telefonul încărcat, într-o pungă impermeabilă
☐ cineva de pe mal știe traseul și ora întoarcerii
☐ actele bărcii și permisul de conducere a ambarcațiunii la bord

La întoarcere:
☐ barca legată, motorul oprit și cheia scoasă
☐ apa scoasă din barcă, echipamentul pus la uscat
☐ ce s-a stricat sau lipsește, notat mai jos

De reparat sau de cumpărat:
•

Observații:
• `,
    }),
  },
  {
    key: 'concurspescuit', label: '🎣 Concurs de pescuit',
    make: (d) => ({
      title: `Concurs de pescuit ${dateStamp(d, 'date')}`,
      body: `Balta și organizatorul:
Data și orele (start, încheiere):
Taxa de participare:
Premiile:

Înainte de concurs:
☐ regulamentul scris și afișat (momeala permisă, câte lansete, cu reținere sau cu eliberarea peștelui)
☐ standurile numerotate și trase la sorți
☐ cântarul verificat și juriul ales
☐ lista participanților, cu taxa încasată
☐ minciog și saltea de primire la fiecare stand

În ziua concursului:
☐ semnalul de start și de încheiere, la ora anunțată
☐ capturile cântărite, trecute pe fișa standului și semnate de pescar
☐ peștele eliberat în baltă după cântărire, dacă așa scrie în regulament
☐ clasamentul afișat și premiile înmânate

Clasamentul:
•

Observații:
• `,
    }),
  },
  {
    key: 'florieveniment', label: '💐 Flori pentru un eveniment',
    make: (d) => ({
      title: `Flori pentru eveniment ${dateStamp(d, 'date')}`,
      body: `Clientul și telefonul:
Evenimentul (nuntă, botez, aniversare, comemorare, firmă):
Data, ora și locul:
Bugetul:

Stabilit cu clientul:
☐ culorile și florile preferate (și cele de evitat, de exemplu alergii)
☐ ce se face: buchete, aranjamente de masă, decor pentru sală, coroane sau jerbe
☐ câte bucăți din fiecare și mărimea lor
☐ textul de pe panglici sau felicitări, scris corect
☐ avansul primit și restul de plată

Înainte de eveniment:
☐ florile comandate la furnizor, cu 3–5 zile înainte
☐ vazele, suporturile, buretele floral și panglicile pregătite
☐ ora livrării confirmată cu clientul sau cu sala
☐ poze cu aranjamentele gata, înainte de livrare

Ce s-a comandat:
•

Observații:
• `,
    }),
  },
  {
    key: 'masuratori', label: '📐 Măsurători pentru mobilă la comandă',
    make: (d) => ({
      title: `Măsurători mobilă ${dateStamp(d, 'date')}`,
      body: `Clientul și telefonul:
Adresa:
Ce se face (bucătărie, dulap, comodă, birou):

Înainte de plecare:
☐ ruleta, nivela, telefonul pentru poze și mostrele de culori în geantă
☐ ora stabilită cu clientul și adresa verificată

La client:
☐ lățimea, înălțimea și adâncimea locului, măsurate în mai multe puncte (pereții nu sunt drepți)
☐ prizele, întrerupătoarele, țevile și caloriferele însemnate pe schiță
☐ ușa, fereastra și plintele însemnate (deschiderea ușilor, pervazul)
☐ pe unde intră mobila: ușa de la intrare, liftul, scara
☐ materialul, culoarea și mânerele alese împreună cu clientul
☐ poze cu locul, din față și din colțuri

După:
☐ comanda scrisă în Sheets → Comenzi de mobilier, cu termenul și avansul

Dimensiunile (L × Î × A, în cm):
•

Ce mai trebuie întrebat sau adus:
• `,
    }),
  },
  {
    key: 'evacuare', label: '🧯 Exercițiul de evacuare',
    make: (d) => ({
      title: `Exercițiu de evacuare ${dateStamp(d, 'date')}`,
      body: `Clădirea / punctul de lucru:
Cine a condus exercițiul:
Ora alarmei:
Ora la care ultimul om a ajuns la punctul de adunare:

Înainte:
☐ oamenii anunțați (sau nu, dacă exercițiul e neanunțat) și cei care conduc evacuarea pe fiecare etaj numiți
☐ căile de evacuare și ieșirile de urgență libere, cu indicatoarele la vedere
☐ stingătoarele la locul lor și verificate (Sheets → Evidența stingătoarelor, nimic în roșu)
☐ planul de evacuare afișat, cu punctul de adunare marcat

În timpul exercițiului:
☐ alarma s-a auzit în toate încăperile
☐ toți au ieșit pe traseul din plan, fără lift
☐ la punctul de adunare s-a făcut prezența, după lista oamenilor de azi (și a vizitatorilor)
☐ cei care au nevoie de ajutor (persoane cu dizabilități, vizitatori) au fost însoțiți

După:
☐ procesul-verbal al exercițiului scris și semnat

Cât a durat evacuarea:
Oameni evacuați:
Ce n-a mers (ușă blocată, alarmă care nu s-a auzit, cine a întârziat):
•

De făcut până la exercițiul următor:
• `,
    }),
  },
  {
    key: 'valabilitate', label: '💊 Verificarea termenelor de valabilitate',
    make: (d) => ({
      title: `Verificare termene ${dateStamp(d, 'date')}`,
      body: `Gestiunea / raftul verificat:
Cine a verificat:

La raft și în depozit:
☐ produsele expirate scoase de la raft și puse deoparte, cu eticheta „Nu se vinde”
☐ produsele care expiră în 30 de zile (galben în Sheets → Termene de valabilitate pe loturi) aduse în față
☐ loturile noi trecute în tabel, cu lotul și data expirării de pe ambalaj
☐ produsele cu ambalaj deteriorat sau păstrate greșit (frig, căldură, umezeală) puse deoparte

Ce faci cu ce expiră:
☐ furnizorii întrebați de retur sau de schimb, înainte de termen
☐ promoție sau reducere pentru ce expiră curând
☐ cele expirate predate pentru distrugere, cu procesul-verbal semnat
☐ în tabel: Retras = Da la loturile scoase din raft

Pe scurt:
Valoarea expirată:
Valoarea care expiră în 30 de zile:

De comandat mai puțin (se vinde greu):
• `,
    }),
  },
  {
    key: 'termeninstanta', label: '📂 Pregătirea unui termen în instanță',
    make: (d) => ({
      title: `Termen ${dateStamp(d, 'date')}`,
      body: `Numărul dosarului:
Instanța și sala:
Data și ora termenului:
Clientul:
Partea adversă:
Stadiul (fond, apel, recurs):

Înainte de termen:
☐ dosarul verificat pe portalul instanței (soluția de la termenul trecut, actele depuse de cealaltă parte)
☐ întâmpinarea, cererile sau concluziile scrise depuse la timp
☐ actele noi și dovezile trimise și părții adverse
☐ taxa judiciară de timbru plătită și dovada atașată
☐ martorii anunțați (numele, ora, adresa instanței)
☐ clientul anunțat și împuternicirea sau delegația la dosar

După termen:
☐ soluția sau amânarea notată, cu data noului termen în Sheets → Termenele dosarelor
☐ clientul informat; ce e de făcut până la termenul următor

Ce s-a întâmplat la termen:
•

De făcut până la următorul termen:
☐ `,
    }),
  },
  {
    key: 'vizionare', label: '🏠 Vizionarea unei locuințe',
    make: (d) => ({
      title: `Vizionare ${dateStamp(d, 'date')}`,
      body: `Adresa:
Anunțul (link / agenția):
Prețul cerut:
Data și ora vizionării:
Persoana de contact:

Înainte de vizionare:
☐ anunțul trecut în Sheets → Compararea locuințelor (prețul și suprafața utilă)
☐ întrebat de cheltuielile lunare (întreținere, căldură) și de restanțele la asociație
☐ drumul până la serviciu încercat la ora de vârf

La vizionare:
☐ umezeală, mucegai, fisuri (colțuri, baie, sub geamuri)
☐ geamurile, ușa de intrare și instalațiile (apă, curent, gaz, centrala)
☐ zgomotul, vecinii, lumina naturală și locul de parcare
☐ actele: extrasul de carte funciară, certificatul energetic, planul cadastral

După vizionare:
☐ nota mea (1–10) trecută în Sheets → Compararea locuințelor și „Da” la Am vizitat-o

Ce mi-a plăcut:
•

Ce nu mi-a plăcut:
•

Întrebări de pus:
❓ `,
    }),
  },
  {
    key: 'inchidereore', label: '⏱ Închiderea lunii pentru un client',
    make: (d) => ({
      title: `Ore de facturat ${dateStamp(d, 'date')}`,
      body: `Clientul:
Luna:
Proiectul / dosarul:
Tariful convenit (lei / oră):

Înainte de factură:
☐ toate orele lunii trecute în Sheets → Ore lucrate pe clienți (data, de la – până la, pauza)
☐ orele care nu se plătesc trecute cu „Nu” la Facturabil
☐ la Clientul ales scris numele clientului: orele și suma de facturat verificate
☐ lista orelor trimisă clientului spre confirmare, dacă așa e înțelegerea

Factura:
☐ factura emisă (Sheets → Factură (e-Factura)), cu orele și tariful pe rând
☐ factura trimisă și, unde e cazul, încărcată în SPV
☐ în Sheets → Ore lucrate pe clienți ales „Da” la Facturat și scris numărul facturii
☐ termenul de plată notat; la întârziere, Sheets → Penalități de întârziere

Ore lucrate (pe scurt):
•

Ce urmează luna viitoare:
•

Observații:
• `,
    }),
  },
  {
    key: 'intretinerebloc', label: '🏢 Întreținerea blocului pe luna aceasta',
    make: (d) => ({
      title: `Întreținere bloc ${dateStamp(d, 'date')}`,
      body: `Luna:
Blocul / scara:
Termenul de plată afișat:

Până la întocmirea listei:
☐ citirile contoarelor de apă strânse de la toate apartamentele (sau estimate, cu mențiune)
☐ facturile lunii primite: apă, curent pe părțile comune, gaz, lift, salubritate
☐ schimbările de persoane pe apartament anunțate și trecute
☐ cheltuielile trecute în Sheets → Lista de plată a întreținerii (pe persoane, pe cota-parte, apa, fondul de reparații)
☐ restanțele din luna trecută trecute la Restanțe

După întocmire:
☐ lista verificată de cenzor și semnată de președinte
☐ lista afișată la avizier (Docs → Inserare → ☺ Pictograme → Utilități pentru anunț)
☐ încasările trecute la Plătit, pe măsură ce vin
☐ cei cu restanțe anunțați înainte de penalități

Facturi plătite de asociație:
•

Lucrări și reparații în bloc:
•

Observații:
• `,
    }),
  },
  {
    key: 'preparatnou', label: '🍰 Un preparat nou în meniu',
    make: (d) => ({
      title: `Preparat nou ${dateStamp(d, 'date')}`,
      body: `Preparatul:
Categoria din meniu (cafea, desert, fel principal…):
Porții din rețetă:
Prețul ales (cu TVA):

Înainte de a-l pune în meniu:
☐ rețeta încercată de cel puțin două ori, cu cantitățile scrise exact
☐ costul calculat în Sheets → Rețetă cu costul pe porție (cu pierderile la curățare)
☐ prețul ales după „Prețul recomandat” și verificat față de concurență
☐ alergenii notați mai jos (gluten, lapte, ouă, nuci, soia…)
☐ o poză făcută pentru meniu și pentru afiș

La lansare:
☐ trecut în meniu și în Sheets → Listă de prețuri pentru clienți
☐ personalul a gustat preparatul și știe ce să spună despre el
☐ ingredientele noi trecute la Sheets → Necesar de aprovizionare

Alergeni:
•

Ce au spus primii clienți:
•

Observații:
• `,
    }),
  },
  {
    key: 'reinnoire', label: '🎫 Reînnoirea unui abonament',
    make: (d) => ({
      title: `Reînnoire abonament ${dateStamp(d, 'date')}`,
      body: `Clientul:
Telefonul:
Abonamentul de acum (felul, prețul):
Expiră la:
Ședințe rămase:

Înainte de expirare (în ultimele 7 zile, când iese galben în Sheets → Abonamentele clienților):
☐ clientul sunat sau anunțat prin mesaj că abonamentul se termină
☐ întrebat ce i-a plăcut și ce ar vrea altfel (notat mai jos)
☐ propus abonamentul potrivit (lunar, trimestrial, cu ședințe) și o eventuală reducere de fidelitate
☐ restul de plată de pe abonamentul vechi încasat, dacă mai era

La reînnoire:
☐ rând nou în Sheets → Abonamentele clienților: data începerii, zilele, ședințele, prețul
☐ plata încasată și trecută la „Plătit”, cu bonul sau chitanța date
☐ prima ședință din abonamentul nou programată (Sheets → Programări clienți)
☐ fișa clientului actualizată (Notițe → Din șablon → Fișa unui client)

Ce a spus clientul:
•

Observații:
• `,
    }),
  },
  {
    key: 'fisaclient', label: '💇 Fișa unui client',
    make: (d) => ({
      title: `Fișa clientului ${dateStamp(d, 'date')}`,
      body: `Numele:
Telefonul:
De când vine:
Cum preferă să fie anunțat (telefon, mesaj):

Bine de știut:
• alergii sau sensibilități:
• ce îi place / ce nu îi place:
• produsele folosite ultima dată:

La fiecare vizită:
☐ programarea trecută în Sheets → Programări clienți (data, ora, serviciul, prețul)
☐ programarea confirmată cu o zi înainte
☐ alergiile și preferințele de mai sus recitite înainte de începere
☐ serviciul făcut și produsele folosite notate mai jos
☐ plata încasată și „Realizată” aleasă la Starea, în Programări clienți
☐ următoarea programare propusă înainte să plece

Istoricul vizitelor (data, serviciul, produsele, prețul):
•

Observații:
• `,
    }),
  },
  {
    key: 'reviziautilaj', label: '🛠 Revizia unui utilaj',
    make: (d) => ({
      title: `Revizie utilaj ${dateStamp(d, 'date')}`,
      body: `Utilajul (stivuitor, cântar, compresor…):
Nr. de inventar / serie:
Lucrarea (revizie, verificare ISCIR, verificare metrologică, schimb de ulei):
Cine o face (firma de service, persoana):

Înainte:
☐ data stabilită cu firma de service și utilajul oprit din lucru la ora aceea
☐ cartea tehnică și fișa ultimei revizii scoase la îndemână
☐ defectele observate de la ultima revizie notate mai jos

La revizie:
☐ lucrările făcute trecute pe rând în raportul de service
☐ piesele schimbate notate (ce, câte, prețul)
☐ etichetele de verificare sau sigiliile puse acolo unde se cer
☐ utilajul încercat după revizie, de față cu cine îl folosește

După:
☐ raportul de service și factura puse la dosarul utilajului
☐ data nouă trecută în Sheets → Plan de mentenanță a utilajelor (Ultima intervenție)
☐ data următoarei revizii notată în calendar

Defecte observate:
•

Piese schimbate și cost:
•

Observații:
• `,
    }),
  },
  {
    key: 'vizitaclient', label: '🚗 Vizită la un client',
    make: (d) => ({
      title: `Vizită la client ${dateStamp(d, 'date')}`,
      body: `Clientul:
Persoana de contact și telefonul:
Adresa și ora:

Înainte de vizită:
☐ ce a cumpărat clientul până acum și cât de des
☐ facturile lui neîncasate (Sheets → Vechimea creanțelor)
☐ oferta sau lista de prețuri de dus (Docs → Ofertă de preț)
☐ mostrele, cataloagele și cărțile de vizită

La client:
☐ ce îi trebuie acum și ce nu i-a plăcut data trecută
☐ restanțele: când plătește
☐ comanda sau termenul pentru răspuns la ofertă

După vizită:
☐ comanda trimisă la livrări sau oferta trimisă pe e-mail
☐ vânzarea trecută în Sheets → Comisioanele agenților
☐ vizita scrisă în Docs → Raportul lunar al agentului de vânzări

Ce s-a stabilit:
• `,
    }),
  },
  {
    key: 'predaregestiune', label: '🔑 Predarea gestiunii',
    make: (d) => ({
      title: `Predarea gestiunii ${dateStamp(d, 'date')}`,
      body: `Gestiunea:
Predă:
Primește:
Comisia:

Înainte de predare:
☐ decizia de numire a comisiei și a gestionarului nou semnată
☐ toate intrările și ieșirile trecute în evidență până în ziua predării
☐ listele de inventariere pregătite (Sheets → Listă de inventariere)

La predare:
☐ bunurile numărate de comisie, cu ambii gestionari de față
☐ diferențele explicate în scris (Docs → Notă explicativă a gestionarului)
☐ procesul-verbal de inventariere semnat (Docs → Proces-verbal de inventariere)
☐ documentele, cheile, sigiliile și numerarul predate
☐ codul alarmei schimbat
☐ procesul-verbal de predare-primire semnat de toți (Docs → Proces-verbal de predare-primire a gestiunii)

După predare:
☐ un exemplar dat la contabilitate
☐ lipsurile rămase rezolvate (imputate sau trecute pe cheltuieli)

Ce a rămas de rezolvat:
• `,
    }),
  },
  {
    key: 'magazielunar', label: '🏬 Magazia la sfârșit de lună',
    make: (d) => ({
      title: `Magazia la sfârșit de lună ${dateStamp(d, 'date')}`,
      body: `Gestiunea:
Luna:
Gestionarul:

Documentele lunii:
☐ toate notele de recepție trecute în fișele de magazie (Sheets → Notă de recepție)
☐ bonurile de consum semnate și scăzute din fișe (Sheets → Bon de consum)
☐ transferurile trimise confirmate de gestiunea care le-a primit (Sheets → Bon de transfer)
☐ avizele și facturile de vânzare scăzute din fișe

Fișele de magazie:
☐ fiecare fișă are stocul la zi (Sheets → Fișa de magazie)
☐ nicio fișă cu stoc negativ (dacă apare, lipsește un document de intrare)
☐ produsele sub stocul minim trecute pe lista de comandat
☐ câteva produse numărate prin sondaj și potrivite cu fișa

La contabilitate:
☐ documentele lunii predate, cu borderou
☐ stocul la zi confirmat cu evidența contabilă
☐ diferențele găsite explicate în scris (Docs → Notă explicativă a gestionarului)

De comandat:
•

Observații:
• `,
    }),
  },
  {
    key: 'lipsainventar', label: '⚖ Lipsă la inventar',
    make: (d) => ({
      title: `Lipsă la inventar ${dateStamp(d, 'date')}`,
      body: `Gestiunea:
Gestionarul:
Data inventarului:
Valoarea lipsei:

Calculul:
☐ lipsurile din lista de inventariere, pe produse (Sheets → Listă de inventariere)
☐ plusurile și lipsurile la produse asemănătoare verificate înainte de imputare
☐ lipsa admisă calculată din ieșiri și cotele firmei (Sheets → Perisabilități)
☐ suma peste normă, de imputat, verificată cu contabilul

Cu gestionarul:
☐ nota explicativă cerută și primită în scris (Docs → Notă explicativă a gestionarului)
☐ procesul-verbal de inventariere semnat de comisie și de gestionar (Docs → Proces-verbal de inventariere)
☐ nota de evaluare a pagubei comunicată, cu cel puțin 30 de zile pentru plată (Docs → Notă de constatare și evaluare a pagubei)
☐ acordul gestionarului primit (plată sau rețineri din salariu) sau refuzul notat

La contabilitate:
☐ lipsa din limita normei trecută pe cheltuieli
☐ suma de imputat înregistrată și ratele trecute pe statul de plată (Sheets → Stat de plată)

Termene:
• comunicarea notei:
• plata sau prima rată:

Observații:
• `,
    }),
  },
  {
    key: 'evalfurnizori', label: '🏅 Evaluarea furnizorilor',
    make: (d) => ({
      title: `Evaluarea furnizorilor ${dateStamp(d, 'date')}`,
      body: `Perioada evaluată:
Cine evaluează:
Furnizori de evaluat:

Datele:
☐ livrările din perioadă și cele întârziate, numărate din notele de recepție (Sheets → Notă de recepție)
☐ neconformitățile numărate din notificările trimise (Docs → Notificare de neconformitate la livrare)
☐ notele pentru preț și colaborare date de cine lucrează cu furnizorul

Evaluarea:
☐ cifrele trecute în tabel, punctajul și clasa calculate (Sheets → Evaluarea furnizorilor)
☐ furnizorii din clasa C discutați cu administratorul: plan de măsuri sau furnizor nou
☐ pentru furnizorii de înlocuit, oferte noi cerute (Docs → Cerere de ofertă) și comparate (Sheets → Compararea ofertelor)

Comunicarea:
☐ scrisoarea cu rezultatul trimisă fiecărui furnizor (Docs → Scrisoare cu rezultatul evaluării furnizorului)
☐ planurile de măsuri primite de la furnizorii din clasele B și C
☐ contractele de prelungit sau de oprit notate (Sheets → Evidența contractelor)

Rezultate:
• clasa A:
• clasa B:
• clasa C:

Observații:
• `,
    }),
  },
  {
    key: 'returfurnizor', label: '↩ Returul mărfii la furnizor',
    make: (d) => ({
      title: `Retur la furnizor ${dateStamp(d, 'date')}`,
      body: `Furnizorul:
Factura și nota de recepție:
Ce se returnează și de ce:

Înainte de retur:
☐ neconformitatea anunțată furnizorului în scris (Docs → Notificare de neconformitate la livrare)
☐ răspunsul furnizorului: acceptă returul, cu termenul și felul transportului
☐ marfa pusă deoparte, numărată și fotografiată, separat de stocul bun

Predarea:
☐ procesul-verbal completat și semnat de ambele părți (Docs → Proces-verbal de retur al mărfii către furnizor)
☐ avizul de însoțire sau factura de retur emisă, ieșirea trecută în gestiune (Sheets → Fișa de magazie)
☐ returul trecut în evidență, cu valoarea și motivul (Sheets → Retururi către furnizori)

După retur:
☐ nota de credit primită și verificată față de procesul-verbal
☐ suma scăzută din factura de plătit sau primită în cont (Sheets → Facturi de la furnizori)
☐ returul notat pentru evaluarea furnizorului (Sheets → Evaluarea furnizorilor)

Nota de credit:
• numărul și data:
• suma:

Observații:
• `,
    }),
  },
  {
    key: 'returclient', label: '🔄 Retur de la un client',
    make: (d) => ({
      title: `Retur de la client ${dateStamp(d, 'date')}`,
      body: `Clientul:
Factura inițială:
Ce aduce înapoi și de ce:

Primirea:
☐ marfa verificată la primire: cantitatea, starea, ambalajul, accesoriile
☐ returul trecut în evidență, cu motivul (Sheets → Retururi de la clienți)
☐ la cumpărăturile online: anunțul de retragere primit în 14 zile (Docs → Notificare de retragere (retur online))

Banii:
☐ factura storno emisă către client
☐ banii dați înapoi pe același drum (cont, card, numerar), în cel mult 14 zile la cele online
☐ suma restituită trecută în tabel, starea „Închis”

Marfa:
☐ repusă în vânzare și trecută înapoi în gestiune (Sheets → Fișa de magazie)
☐ cea defectă de la furnizor dată înapoi (Sheets → Retururi către furnizori)
☐ cea stricată de tot pusă deoparte pentru casare (Docs → Proces-verbal de casare)

Răspunsul către client:
•

Observații:
• `,
    }),
  },
  {
    key: 'preturi', label: '🏷 Schimbarea prețurilor',
    make: (d) => ({
      title: `Schimbarea prețurilor ${dateStamp(d, 'date')}`,
      body: `Ce se schimbă și de ce:
Produsele:
De la data:

Calculul:
☐ prețurile noi calculate din prețul de achiziție și adaos (Sheets → Calculul prețului de vânzare)
☐ niciun produs în pierdere sau sub adaosul minim
☐ lista prețurilor noi aprobată de administrator

În magazin:
☐ stocul numărat în ziua schimbării, la prețul vechi
☐ diferența de preț trecută în proces-verbal (Docs → Proces-verbal de modificare a prețurilor)
☐ etichetele noi puse la raft
☐ prețurile schimbate și în casa de marcat

Clienții:
☐ lista de prețuri pentru clienți refăcută
☐ clienții cu contract anunțați din timp, cum scrie în contract (Docs → Anunțul modificării prețurilor către clienți)

Observații:
• `,
    }),
  },
  {
    key: 'raportz', label: '🧾 Închiderea zilei la casa de marcat',
    make: (d) => ({
      title: `Închiderea zilei ${dateStamp(d, 'date')}`,
      body: `Casa de marcat:
Casierul:

La închidere:
☐ raportul Z scos și păstrat (nr. raportului: )
☐ numerarul din sertar numărat și egal cu numerarul din raportul Z
☐ plățile cu cardul egale cu raportul de la terminalul POS (închiderea lotului)
☐ vânzările zilei și plățile trecute în tabel (Sheets → Rapoartele Z ale casei de marcat)

Banii:
☐ numerarul predat în casierie, cu dispoziție de încasare, sau depus la bancă
☐ suma trecută în registrul de casă (Sheets → Registru de casă)
☐ fondul de rest lăsat în sertar pentru ziua următoare: lei

Dacă ceva nu se potrivește:
☐ diferența anunțată administratorului și trecută în proces-verbal (Docs → Proces-verbal de constatare a diferenței de casă)

Observații:
• `,
    }),
  },
  {
    key: 'tichete', label: '🍽 Tichetele de masă ale lunii',
    make: (d) => ({
      title: `Tichete de masă ${dateStamp(d, 'date')}`,
      body: `Luna:
Valoarea unui tichet: lei
Comanda la emitent: nr. din

La început de lună:
☐ zilele lucrătoare și concediile planificate luate din pontaj (Sheets → Pontaj lunar)
☐ tichetele cuvenite calculate pentru fiecare angajat (Sheets → Tichete de masă)
☐ diferențele de luna trecută adăugate sau scăzute
☐ comanda trimisă emitentului, cu valoarea verificată pentru anul acesta

La distribuire:
☐ tichetele date sau cardurile încărcate, cu semnătura fiecărui angajat (Docs → Stat de distribuire a tichetelor de masă)
☐ tichetele date trecute în tabel: starea „În regulă” sau diferența

La sfârșit de lună:
☐ concediile și delegațiile neplanificate trecute, ca diferența să se regularizeze luna viitoare
☐ valoarea tichetelor trimisă la salarii, pentru CASS și impozit (Sheets → Stat de plată)

Observații:
• `,
    }),
  },
  {
    key: 'protocol', label: '🥂 O cheltuială de protocol',
    make: (d) => ({
      title: `Protocol ${dateStamp(d, 'date')}`,
      body: `Partenerul:
Ocazia:
Valoarea: lei

Înainte:
☐ cheltuiala aprobată de administrator (cine participă, cât se poate cheltui)

După:
☐ factura sau bonul fiscal pe firmă, cu CUI-ul firmei
☐ decontul scris, cu participanții și scopul întâlnirii (Docs → Decont al cheltuielilor de protocol)
☐ cadourile date trecute pe nume, cu valoarea fiecăruia
☐ cheltuiala trecută în tabel, la felul ei (Sheets → Cheltuieli de protocol)
☐ dacă s-a plătit din casierie: decontul avansului făcut (Notițe → Decontarea unui avans)

La sfârșit de lună:
☐ limita de 2% verificată în tabel: „În limită” sau „Peste limită”
☐ documentele date contabilului, cu decontul atașat

Observații:
• `,
    }),
  },
  {
    key: 'valuta', label: '💶 O factură în valută',
    make: (d) => ({
      title: `Factură în valută ${dateStamp(d, 'date')}`,
      body: `Factura: nr. din
Partenerul:
Valoarea: în (EUR / USD / altă monedă)

La factură:
☐ cursul BNR al zilei luat de pe site și scris pe factură, cu valoarea în lei
☐ factura trecută în tabel, cu felul ei și cursul (Sheets → Facturi în valută și diferențe de curs)
☐ contul în valută al partenerului verificat (IBAN-ul și banca)

La plată sau încasare:
☐ extrasul de cont cu suma primită sau plătită, în valută
☐ cursul din ziua plății trecut în tabel: se vede diferența de curs
☐ dacă s-a plătit în tranșe: fiecare tranșă pe un rând

La sfârșit de lună:
☐ facturile încă deschise date contabilului, pentru reevaluarea la cursul BNR
☐ diferențele de curs ale lunii verificate cu contabilul („Pe scurt”: venituri, cheltuieli, rezultatul net)

Observații:
• `,
    }),
  },
  {
    key: 'implocale', label: '🏛 Plata impozitelor locale',
    make: (d) => ({
      title: `Impozite locale ${dateStamp(d, 'date')}`,
      body: `Anul:
Primăria:

La început de an:
☐ deciziile de impunere primite pentru clădiri, terenuri și mașini
☐ sumele trecute în tabel, pe fiecare bun (Sheets → Impozite și taxe locale)
☐ hotărâtă plata întreagă până pe 31 martie, pentru bonificație, sau în două rate

Plățile:
☐ rata 1 (sau tot, cu bonificația) plătită până pe 31 martie
☐ rata 2 plătită până pe 30 septembrie
☐ dovezile de plată păstrate și sumele trecute în tabel

Când se schimbă ceva:
☐ o clădire, un teren sau o mașină cumpărată ori vândută declarată la primărie în 30 de zile
☐ „Restant” verificat în tabel și plătit cu majorările cerute de primărie

Observații:
• `,
    }),
  },
  {
    key: 'dizab', label: '♿ Contribuția pentru persoanele cu dizabilități',
    make: (d) => ({
      title: `Contribuția pentru persoanele cu dizabilități ${dateStamp(d, 'date')}`,
      body: `Luna:
Numărul mediu de salariați:

Verificat:
☐ numărul mediu de salariați al lunii luat de la contabil sau din pontaj
☐ persoanele cu dizabilități angajate, cu certificatul valabil la dosar
☐ locurile obligatorii și cele neocupate calculate (Sheets → Contribuția pentru persoanele cu dizabilități)

Dacă sunt locuri neocupate:
☐ achizițiile de la unitățile protejate autorizate, cu facturile și autorizația unității
☐ suma rămasă de plată, după achiziții

Pentru contabil:
☐ suma trecută în declarația lunară, până pe 25 ale lunii următoare
☐ plata făcută și „Plătit” pus pe „Da” în tabel
☐ un post nou pentru o persoană cu dizabilități de anunțat, dacă e cazul (Notițe → Angajat nou)

Observații:
• `,
    }),
  },
  {
    key: 'oresupl', label: '⏱ Orele suplimentare ale lunii',
    make: (d) => ({
      title: `Ore suplimentare ${dateStamp(d, 'date')}`,
      body: `Luna:
Angajații cu ore suplimentare:

Înainte:
☐ solicitarea scrisă, cu acordul semnat al fiecărui angajat (Docs → Solicitare de efectuare a orelor suplimentare)
☐ verificat că nimeni nu trece de 48 de ore pe săptămână în medie

La sfârșitul lunii:
☐ orele lucrate trecute în tabel, cu felul compensării (Sheets → Ore suplimentare)
☐ orele trecute și în pontaj (Sheets → Pontaj lunar)
☐ zilele libere pentru compensare programate înainte de termen
☐ orele cu „Termen depășit” trecute la plată, cu spor

Pentru contabil:
☐ suma de plată din „Pe scurt” trecută în statul de plată (Sheets → Stat de plată)
☐ solicitările semnate puse la dosarul de personal

Observații:
• `,
    }),
  },
  {
    key: 'concmed', label: '🤒 Un concediu medical',
    make: (d) => ({
      title: `Concediu medical ${dateStamp(d, 'date')}`,
      body: `Angajatul:
Certificatul (seria și nr.):
Codul indemnizației:
Perioada:

Primirea certificatului:
☐ seria, numărul, codul și perioada verificate pe certificat
☐ certificatul primit cel târziu pe 5 ale lunii următoare (după aceea nu se mai plătește)
☐ zilele trecute ca CM în pontaj (Sheets → Pontaj lunar)

Calculul:
☐ media zilnică făcută din veniturile ultimelor 6 luni
☐ indemnizația și împărțirea între angajator și FNUASS calculate (Sheets → Concedii medicale)
☐ indemnizația trecută în statul de plată al lunii (Sheets → Stat de plată)

Pentru contabil:
☐ certificatul și calculul date contabilului pentru declarația 112
☐ suma din FNUASS urmărită: se scade din contribuția datorată sau se cere înapoi de la casa de sănătate

Observații:
• `,
    }),
  },
  {
    key: 'autoluna', label: '🚘 Mașinile firmei la sfârșit de lună',
    make: (d) => ({
      title: `Mașinile firmei ${dateStamp(d, 'date')}`,
      body: `Luna:
Mașinile:

Documentele:
☐ bonurile de carburant și facturile de service strânse, pe firmă și cu numărul mașinii
☐ toate trecute în tabel, cu felul și folosința (Sheets → Cheltuieli auto (TVA și deductibilitate))
☐ foile de parcurs completate pentru mașinile „Exclusiv pentru firmă” (Sheets → Foaie de parcurs)

Verificări:
☐ consumul lunii comparat cu kilometrii parcurși (Sheets → Consum carburant)
☐ ITP-ul, RCA-ul și rovinieta valabile și luna viitoare (Notițe → Mașina: acte și revizii)
☐ revizia următoare programată, după kilometri (Sheets → Revizii și reparații auto)

Pentru contabil:
☐ TVA-ul de dedus și cel nedeductibil din „Pe scurt” trimise contabilului
☐ documentele date contabilului, cu foile de parcurs

Observații:
• `,
    }),
  },
  {
    key: 'efect', label: '🖋 Primirea unui bilet la ordin',
    make: (d) => ({
      title: `Bilet la ordin ${dateStamp(d, 'date')}`,
      body: `Clientul:
Biletul la ordin sau cecul (seria și numărul):
Suma: lei
Scadența:
Pentru factura:

Când îl primești, verifici că are:
☐ scris „bilet la ordin” (sau „cec”) în text și suma, în cifre și în litere, la fel
☐ scadența, locul plății și numele firmei tale ca beneficiar
☐ data și locul emiterii, semnătura și ștampila clientului (la cec și banca lui)
☐ nicio ștersătură sau corectură; altfel ceri altul
☐ trecut în tabel (Sheets → Bilete la ordin și cecuri), cu factura pentru care l-ai primit; primirea, într-un proces-verbal (Docs → Proces-verbal de predare-primire a biletelor la ordin)

La scadență:
☐ depus la bancă la timp (biletul la ordin în ziua scadenței sau în următoarele 2 zile lucrătoare, cecul în 8 zile de la emitere)
☐ încasarea trecută în tabel și la factură (Sheets → Evidență facturi emise): starea „Încasat”
☐ dacă a fost refuzat: originalul și refuzul băncii păstrate, „Da” la „Refuzat la plată” și clientul anunțat (Docs → Somație de plată)

Observații:
• `,
    }),
  },
  {
    key: 'avans', label: '💵 Decontarea unui avans',
    make: (d) => ({
      title: `Decont avans ${dateStamp(d, 'date')}`,
      body: `Angajatul:
Avansul primit: lei, pe data de
Scopul:
Termenul de justificare:

La acordare:
☐ avansul vechi al angajatului justificat (Sheets → Avansuri de trezorerie)
☐ banii dați cu dispoziție de plată și trecuți în registrul de casă (Sheets → Registru de casă)
☐ avansul trecut în tabel, cu termenul de justificare

La întoarcere (cel mult 3 zile lucrătoare):
☐ bonurile, facturile și chitanțele strânse, în original
☐ decontul completat și semnat (Docs → Decont al avansului de trezorerie; pentru o deplasare și Sheets → Decont de deplasare)
☐ decontul verificat de contabilitate și aprobat de administrator
☐ restul dat înapoi în casierie sau suma cheltuită în plus plătită angajatului
☐ cheltuielile și restul trecute în tabel: starea „Decontat”

Observații:
• `,
    }),
  },
  {
    key: 'promotie', label: '🎯 Pregătirea unei promoții',
    make: (d) => ({
      title: `Promoție ${dateStamp(d, 'date')}`,
      body: `Numele promoției:
Perioada:
Produsele:

Înainte:
☐ produsele, reducerile și marja calculate (Sheets → Promoții și reduceri)
☐ niciun produs sub cost, în afară de lichidări aprobate
☐ prețul anterior verificat: cel mai mic din ultimele 30 de zile
☐ stocul alocat comandat sau rezervat
☐ decizia semnată de administrator (Docs → Decizie de organizare a unei promoții)

În prima zi:
☐ etichetele de promoție puse, cu prețul anterior tăiat și perioada
☐ prețurile promoționale trecute în casa de marcat și verificate pe un bon

La sfârșit:
☐ prețurile normale puse înapoi, pe etichete și în casa de marcat
☐ bucățile vândute și încasările trecute în tabel, apoi rezultatul prezentat (Slides → Rezultatele promoției)

Observații:
• `,
    }),
  },
  {
    key: 'ambalaje', label: '🧺 Ambalajele la sfârșit de lună',
    make: (d) => ({
      title: `Ambalaje returnabile ${dateStamp(d, 'date')}`,
      body: `Luna:
Cine verifică:
Depozitul:

Evidența:
☐ toate avizele lunii cu ambalaje trecute în tabel (Sheets → Ambalaje returnabile)
☐ paleții, navetele și lăzile numărate în depozit și comparate cu soldurile pe fel de ambalaj
☐ ambalajele stricate puse deoparte și notate, cu cine le-a stricat

Partenerii:
☐ soldul trimis partenerilor cu multe ambalaje de dat sau de primit (Docs → Confirmarea soldului de ambalaje returnabile)
☐ răspunsurile primite și diferențele lămurite cu avizele
☐ returul programat pentru ambalajele altora aflate la noi de mult timp

Decontarea:
☐ ambalajele nereturnate în termen facturate la garanție (Sheets → Factură (e-Factura))
☐ garanțiile primite sau plătite trecute la facturi (Sheets → Facturi de la furnizori)
☐ ambalajele noi cumpărate sau scoase din uz trecute în gestiune (Sheets → Fișa de magazie)

De urmărit luna viitoare:
•

Observații:
• `,
    }),
  },
  {
    key: 'aprovizionare', label: '🚚 Aprovizionarea săptămânală',
    make: (d) => ({
      title: `Aprovizionare ${dateStamp(d, 'date')}`,
      body: `Gestiunea:
Cine comandă:
Bugetul săptămânii:

Ce lipsește:
☐ stocul la zi verificat pe fișele de magazie (Sheets → Fișa de magazie)
☐ consumul mediu și ce e deja pe drum completate (Sheets → Necesar de aprovizionare)
☐ produsele „De comandat” și „Lipsă din stoc” trecute pe lista de mai jos

Comenzile:
☐ prețuri cerute de la cel puțin doi furnizori, pentru produsele mari (Docs → Cerere de ofertă)
☐ ofertele comparate (Sheets → Compararea ofertelor)
☐ comanda trimisă furnizorului ales, cu termenul de livrare (Docs → Comandă către furnizor)
☐ confirmarea furnizorului primită și termenul notat mai jos

La primire:
☐ marfa numărată și comparată cu factura (Sheets → Notă de recepție)
☐ diferențele anunțate furnizorului în scris (Docs → Notificare de neconformitate la livrare)
☐ intrările trecute pe fișele de magazie

De comandat:
• 

Livrări așteptate:
• 

Observații:
• `,
    }),
  },
];

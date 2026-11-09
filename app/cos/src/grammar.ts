// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Verificarea gramaticală în română, cu reguli locale (fără servicii web): cuvinte repetate („de de”), spații duble sau
// puse înainte de semne, lipsa spațiului după virgulă / punct, literă mică la început de propoziție, scrierea veche cu „î”
// în mijlocul cuvântului („cînd”), forme greșite des întâlnite („să aibe”, „vroiam”, „vre-un”, „propietar”, „complectez”)
// pleonasme („a reveni înapoi”, „a colabora împreună”, „mai superior”) și acordul verbului cu pronumele („noi este” → „noi suntem”).
// checkGrammar(text) întoarce problemele unui paragraf, cu locul lor și, unde se poate, cu forma corectă.

export interface GrammarIssue {
  from: number;
  to: number;
  kind: 'repeat' | 'space' | 'punct' | 'capital' | 'oldI' | 'form' | 'pleonasm' | 'agree';
  /** Textul greșit, cum e în document. */
  text: string;
  /** Ce se pune în loc (lipsă = doar sfat). */
  fix?: string;
  msg: string;
}

const L = '§p{L}';
const re = (s: string, f = 'gu') => new RegExp(s.split('§').join(String.fromCharCode(92)), f);

/** Pune majusculele cuvântului vechi pe cuvântul nou (Cînd → Când, CÎND → CÂND). */
function sameCase(old: string, neu: string) {
  if (old.length > 1 && old === old.toLocaleUpperCase('ro-RO')) return neu.toLocaleUpperCase('ro-RO');
  if (old[0] && old[0] !== old[0].toLocaleLowerCase('ro-RO')) return neu[0].toLocaleUpperCase('ro-RO') + neu.slice(1);
  return neu;
}

// Repetări care sunt corecte în română.
const REPEAT_OK = new Set(['încet', 'ușor', 'puțin', 'câte', 'cât', 'mai', 'foarte', 'hai', 'da', 'nu', 'ha', 'na', 'bla', 'tic', 'cioc', 'pic', 'zi']);
// Prescurtări după care urmează des literă mică.
const ABBR = new Set(['etc', 'nr', 'str', 'dl', 'dna', 'd-na', 'd-l', 'ex', 'pag', 'art', 'alin', 'lit', 'prof', 'dr', 'ing', 'bd', 'bl', 'sc', 'ap', 'et', 'jud', 'sect', 'tel', 'fig', 'cap', 'vol', 'ed', 'cca', 'aprox', 'resp', 'pct', 'cf', 'vs', 'max', 'min', 'sec', 'buc', 'lei', 'kg', 'km', 'ș.a', 'ș.a.m.d', 'a.m', 'p.m', 'i.e', 'e.g', 'n.r', 'n.n', 'op', 'cit', 'id', 'loc', 'sg', 'pl']);
// Forme greșite des întâlnite → forma corectă (cuvinte întregi).
const FORMS: Record<string, string> = {
  aibe: 'aibă', continuie: 'continue', vroiam: 'voiam', vroiai: 'voiai', vroia: 'voia', vroiați: 'voiați', vroiau: 'voiau',
  vroiaţi: 'voiați', creiez: 'creez', creiezi: 'creezi', creiem: 'creăm', creiați: 'creați', sînt: 'sunt', sîntem: 'suntem',
  sînteți: 'sunteți', deabia: 'abia', oricînd: 'oricând', decît: 'decât', dupăce: 'după ce', deasemenea: 'de asemenea',
  deaceea: 'de aceea', deacea: 'de aceea', dealtfel: 'de altfel', deadreptul: 'de-a dreptul', înafară: 'în afară', șiașa: 'și așa',
  propietar: 'proprietar', propietară: 'proprietară', propietari: 'proprietari', propietarul: 'proprietarul', propietate: 'proprietate',
  propietatea: 'proprietatea', propietăți: 'proprietăți', propietățile: 'proprietățile',
  complect: 'complet', complectă: 'completă', complecte: 'complete', complectez: 'completez', complectezi: 'completezi',
  complectează: 'completează', complectăm: 'completăm', complectați: 'completați', complectat: 'completat', complectată: 'completată',
  complecteze: 'completeze', necomplect: 'incomplet', incomplect: 'incomplet',
  întradevăr: 'într-adevăr', întrun: 'într-un', întro: 'într-o', dintrun: 'dintr-un', dintro: 'dintr-o', dintrodată: 'dintr-odată',
  greșală: 'greșeală', greșala: 'greșeala', repercursiune: 'repercusiune', repercursiunea: 'repercusiunea', repercursiuni: 'repercusiuni',
  repercursiunile: 'repercusiunile', șaptisprezece: 'șaptesprezece', cinsprezece: 'cincisprezece', creiază: 'creează', creiat: 'creat',
  creiată: 'creată', creiate: 'create',
  suscint: 'succint', suscintă: 'succintă', suscinte: 'succinte', frustant: 'frustrant', frustantă: 'frustrantă', frustante: 'frustrante',
  areoport: 'aeroport', areoportul: 'aeroportul', areoporturi: 'aeroporturi', deterjent: 'detergent', deterjentul: 'detergentul',
  piuneză: 'pioneză', piuneze: 'pioneze', biblotecă: 'bibliotecă', bibloteca: 'biblioteca', vroisem: 'voisem', vroise: 'voise',
  sîmbătă: 'sâmbătă', deaorece: 'deoarece', acelaș: 'același', aceeaș: 'aceeași', totuș: 'totuși', întotdeuna: 'întotdeauna',
};
// Pleonasme și greșeli de mai multe cuvinte: [model, ce se pune în loc ($1 = primul grup; gol = doar sfatul), explicația].
const PHRASES: [string, string, string][] = [
  ['(reven' + L + '*|revin' + L + '*) înapoi', '$1', 'Pleonasm: „a reveni” înseamnă deja „a veni înapoi”.'],
  ['(urc' + L + '*) sus', '$1', 'Pleonasm: „a urca” înseamnă deja „a merge în sus”.'],
  ['(cobor' + L + '*) jos', '$1', 'Pleonasm: „a coborî” înseamnă deja „a merge în jos”.'],
  ['(ceia) ce', 'ceea ce', 'Se scrie „ceea ce”.'],
  ['(să) ști', 'să știi', 'Cu „să”, verbul „a ști” se scrie „să știi”.'],
  ['(?<!nu )(?<!n-)(?<!mai )(am|ai|are|avem|aveți|au) decât', '', '„Decât” se folosește cu negație („nu am decât”); fără negație se spune „doar” sau „numai”.'],
  ['(prima) premieră', 'premieră', 'Pleonasm: „premieră” înseamnă deja „prima reprezentație”.'],
  ['(cel mai|foarte) optim', 'optim', '„Optim” înseamnă deja „cel mai bun”; nu are grade de comparație.'],
  ['(cel mai|foarte) maxim', 'maxim', '„Maxim” nu are grade de comparație.'],
  ['(cel mai|foarte) minim', 'minim', '„Minim” nu are grade de comparație.'],
  ['(mi|ți|i|ne|v|le)-ar place', '$1-ar plăcea', 'Forma corectă a verbului este „a plăcea”: „mi-ar plăcea”.'],
  ['(a|să) place', '$1 plăcea', 'Forma corectă a verbului este „a plăcea”.'],
  ['(au|a|am|ați|ai) aparut', '$1 apărut', 'Lipsește diacritica: „apărut”.'],
  ['(și) cu mine', '$1 eu', 'Ca subiect se spune „eu”: „tu și eu” / „noi doi”.'],
  ['(conform) cu', '', 'După „conform” nu se pune „cu” (de exemplu „conform legii”).'],
  ['(datorită) (lipsei|absenței|întârzierii|accidentului|erorii|greșelii)', 'din cauza $2', '„Datorită” se folosește pentru lucruri bune; pentru cele rele: „din cauza”.'],
  ['(vre|nici)-(un|o)', '$1$2', 'Se scrie legat: „vreun”, „vreo”, „niciun”, „nicio”.'],
  ['(colabor' + L + '*|conlucr' + L + '*) împreună', '$1', 'Pleonasm: „a colabora” înseamnă deja „a lucra împreună”.'],
  ['(avans' + L + '*) înainte(?!§s+de)', '$1', 'Pleonasm: „a avansa” înseamnă deja „a merge înainte”.'],
  ['(prevăz' + L + '*|preved' + L + '*|prevăd' + L + '*) dinainte', '$1', 'Pleonasm: „a prevedea” înseamnă deja „a vedea dinainte”.'],
  ['(protagonist' + L + '*) principal' + L + '*', '$1', 'Pleonasm: protagonistul este deja personajul principal.'],
  ['(persoan' + L + '*) uman' + L + '*', '$1', 'Pleonasm: o persoană este deja o ființă umană.'],
  ['mai ((?:superio|inferio|preferabil)' + L + '*)', '$1', '„Superior”, „inferior” și „preferabil” arată deja comparația; fără „mai”.'],
  ['(?:cel mai|foarte) (perfect' + L + '*)', '$1', '„Perfect” nu are grade de comparație.'],
  ['(?:aproximativ|circa) (în jur de)', '$1', 'Pleonasm: „aproximativ” și „în jur de” spun același lucru.'],
  ['și (etc)', '$1', 'Înainte de „etc.” nu se pune „și” (înseamnă deja „și celelalte”).'],
  ['(etc)[.]{3}', '$1.', 'După „etc.” nu se pun puncte de suspensie.'],
  ['(ie[șs]' + L + '*) afară', '$1', 'Pleonasm: „a ieși” înseamnă deja „a merge afară”.'],
  ['(intr' + L + '*) înăuntru', '$1', 'Pleonasm: „a intra” înseamnă deja „a merge înăuntru”.'],
  ['(repet' + L + '*) din nou', '$1', 'Pleonasm: „a repeta” înseamnă deja „a face din nou”.'],
  ['(adăug' + L + '*) în plus', '$1', 'Pleonasm: „a adăuga” înseamnă deja „a pune în plus”.'],
  ['(întoar' + L + '*|întors' + L + '*|întorc' + L + '*|retrag' + L + '*|retras' + L + '*) înapoi', '$1', 'Pleonasm: „a se întoarce” și „a se retrage” înseamnă deja „a merge înapoi”.'],
  ['(hemoragi' + L + '*) de sânge', '$1', 'Pleonasm: „hemoragie” înseamnă deja „pierdere de sânge”.'],
  ['(monopol' + L + '*) exclusiv' + L + '*', '$1', 'Pleonasm: un monopol este deja exclusiv.'],
  ['(a|voi|vei|va|vom|veți|vor|ar|aș|poate|pot|poți|putem|puteți|putea|trebuie) fii', '$1 fi', 'După „a”, după viitor („vei”, „vom”), condițional („ar”, „aș”) și după „poate” / „trebuie” se scrie „fi” cu un singur „i”.'],
  ['(să) fii (fost)', '$1 fi $2', 'În „să fi fost” se scrie „fi” cu un singur „i”.'],
  ['(ori)-(ce|cine|cum|când|unde|care|câte|câți)', '$1$2', 'Se scrie legat: „orice”, „oricine”, „oricum”, „oricând”, „oriunde”, „oricare”.'],
];

// Acordul subiect–predicat cu pronumele personale: [pronumele, forma corectă, formele greșite]. Doar cu „a fi”, cu
// auxiliarul „a avea” (am / ai / a / au / ați) și cu auxiliarele viitorului (voi / vei / vom / veți / vor) și condiționalului
// (aș / ai / ar / am / ați), unde greșeala e sigură; „a” lipsește (poate fi „a doua”), „va” lipsește (poate fi „vă” scris fără
// diacritice: „eu va rog”), iar „ei” lipsește (poate fi „ei” = „ei îi”, ca în „ei este greu”).
const AGREE: [string, string, string[]][] = [
  ['eu', 'sunt', ['este', 'ești', 'suntem', 'sunteți']], ['eu', 'am', ['ai', 'au', 'ați']],
  ['tu', 'ești', ['sunt', 'este', 'suntem', 'sunteți']], ['tu', 'ai', ['am', 'au', 'ați']],
  ['el|ea', 'este', ['sunt', 'ești', 'suntem', 'sunteți']], ['el|ea', 'a', ['am', 'au', 'ați']],
  ['noi', 'suntem', ['sunt', 'este', 'ești', 'sunteți']], ['noi', 'am', ['au', 'ați']],
  ['voi', 'sunteți', ['sunt', 'este', 'ești', 'suntem']], ['voi', 'ați', ['au', 'am']],
  ['ele', 'sunt', ['este', 'ești', 'suntem', 'sunteți']], ['ele', 'au', ['am', 'ați']],
  ['eu', 'voi', ['vei', 'vom', 'veți', 'vor']], ['tu', 'vei', ['vom', 'veți', 'vor']], ['el|ea', 'va', ['voi', 'vei', 'vom', 'veți', 'vor']],
  ['noi', 'vom', ['vei', 'veți', 'vor']], ['voi', 'veți', ['vei', 'vom', 'vor']], ['ele', 'vor', ['vei', 'vom', 'veți']],
  ['eu', 'aș', ['ar']], ['tu', 'ai', ['aș', 'ar']], ['el|ea', 'ar', ['aș']], ['noi', 'am', ['aș', 'ar']], ['voi', 'ați', ['aș', 'ar']], ['ele', 'ar', ['aș']],
];
// După aceste cuvinte pronumele nu e subiectul singur („pe el este”, „ca el sunt mulți”, „eu și ea suntem”).
const NOT_SUBJ = new Set(['pe', 'cu', 'de', 'la', 'pentru', 'despre', 'fără', 'prin', 'între', 'după', 'către', 'sub', 'spre', 'lângă', 'din', 'dintre', 'ca', 'decât', 'și', 'sau', 'ori', 'nici', 'cât', 'nu']);

// Cuvintele după care „noi” e pronumele subiect („acum noi este”); după alte cuvinte e adjectivul („fonturile noi”).
const NOI_AFTER = new Set(['acum', 'apoi', 'atunci', 'ieri', 'azi', 'astăzi', 'mâine', 'deci', 'dar', 'iar', 'însă', 'totuși', 'că', 'dacă', 'când', 'unde', 'cum', 'oare', 'poate', 'doar', 'chiar', 'deja', 'încă', 'desigur', 'probabil', 'sigur', 'fiindcă', 'deoarece', 'deși', 'bine', 'aici', 'acolo', 'atât', 'mereu', 'niciodată', 'totdeauna', 'întotdeauna', 'uneori', 'adică']);
// Prepoziții în plus față de NOT_SUBJ: substantivul de după ele nu e subiectul („în casele vechi era frig”).
const PREP = new Set(['în', 'in', 'asupra', 'contra', 'împotriva', 'printre', 'peste', 'până', 'dinspre', 'înspre', 'deasupra', 'datorită', 'conform', 'potrivit', 'grație', 'a', 'al', 'ai', 'ale', 'precum']);
// Cuvinte cu -ele / -ile care nu sunt substantive la plural.
const PLURAL_NOT = new Set(['acele', 'astfele', 'dumneale', 'vasile']);
// Substantive la singular care, cu articol, se termină tot în -ele („câinele”, „numele”, „președintele”).
const SING_E = new Set(['câine', 'frate', 'nume', 'prenume', 'pronume', 'soare', 'lapte', 'pește', 'dinte', 'sânge', 'munte', 'perete',
  'părinte', 'șarpe', 'iepure', 'vierme', 'fluture', 'burete', 'pântece', 'spate', 'arbore', 'rege', 'președinte', 'vicepreședinte',
  'principe', 'duce', 'conte', 'mire', 'șoarece', 'purice', 'ciorchine', 'pepene', 'oaspete', 'pieptene', 'dulce']);
// Cuvinte care deschid o propoziție secundară: substantivul de după ele e de obicei complementul ei („cine a citit cărțile este”).
const CLAUSE = new Set(['care', 'ce', 'cine', 'cât', 'câtă', 'câți', 'câte', 'când', 'unde', 'cum', 'dacă', 'deși', 'decât', 'încât', 'tot', 'toată']);
// Cuvinte cu -ul după care verbul la plural nu e neapărat greșit („restul au plecat”, „tot timpul au lucrat”).
const SING_NOT = new Set(['restul', 'timpul', 'totul', 'grosul', 'destul', 'weekendul', 'nul',
  // Cuvinte în -a care nu sunt subiectul la singular: adverbe, pronume, zile și părți ale zilei / anului („seara au venit”),
  // „majoritatea / mulțimea au votat” (acordul după înțeles e primit).
  'deja', 'cumva', 'undeva', 'altundeva', 'ceva', 'cineva', 'altceva', 'careva', 'acuma', 'aiurea', 'pururea', 'totdeauna',
  'întotdeauna', 'adesea', 'aievea', 'prea', 'așa', 'gata', 'asta', 'aia', 'aceasta', 'aceea', 'una', 'alta', 'asemenea', 'contra',
  'extra', 'ultra', 'via', 'numa', 'lunea', 'marțea', 'miercurea', 'joia', 'vinerea', 'sâmbăta', 'duminica', 'seara', 'dimineața',
  'noaptea', 'ziua', 'vara', 'iarna', 'toamna', 'primăvara', 'săptămâna', 'luna', 'majoritatea', 'mulțimea', 'jumătatea', 'lumea']);
// Cuvintele care pot sta înaintea subiectului în -ii la început de propoziție („toți copiii”, „ieri elevii”).
const II_BEFORE = new Set(['toți', 'ambii', 'acești', 'acei', 'mulți', 'câțiva', 'unii', 'ieri', 'azi', 'astăzi', 'mâine', 'acum', 'apoi', 'dar', 'iar', 'deci', 'însă', 'totuși', 'atunci']);
/** Cuvintele bucății de propoziție de dinainte, de la ultimul semn de punctuație. */
const clauseWords = (before: string): string[] => {
  const part = before.slice(Math.max(...['.', '!', '?', ';', ':', ',', '…', '(', '„', '"'].map((c) => before.lastIndexOf(c))) + 1);
  return part.toLocaleLowerCase('ro-RO').split(re('[^' + L + '-]+', 'u')).filter(Boolean);
};
/** Adevărat dacă în bucata de propoziție de dinainte (până la semnul de punctuație) e un cuvânt care deschide o secundară. */
const inClause = (before: string): boolean => {
  const part = before.slice(Math.max(...['.', '!', '?', ';', ':', ',', '…'].map((c) => before.lastIndexOf(c))) + 1);
  return part.toLocaleLowerCase('ro-RO').split(re('[^' + L + '-]+', 'u')).some((w) => CLAUSE.has(w));
};
// Cuvinte după care posesivul vine corect fără articol („dragi mei”, „toți ai mei”, „ce mele”).
const POSS_NOT = new Set(['dragi', 'scumpi', 'scumpe', 'iubiți', 'iubite', 'toți', 'toate', 'mulți', 'multe', 'câți', 'câte', 'alți', 'alte', 'puțini', 'puține', 'unii', 'niște', 'tine', 'mine', 'sine', 'fiindcă', 'deoarece', 'dacă', 'încât', 'care', 'oare', 'unde']);

export function checkGrammar(text: string): GrammarIssue[] {
  const out: GrammarIssue[] = [];
  const add = (x: GrammarIssue) => { if (!out.some((o) => o.from < x.to && x.from < o.to)) out.push(x); };
  let m: RegExpExecArray | null;

  // Forme greșite și scrierea veche (cuvânt cu cuvânt).
  for (const w of text.matchAll(re(L + '+'))) {
    const s = w[0], at = w.index!, low = s.toLocaleLowerCase('ro-RO');
    // „ş” și „ţ” cu sedilă (din tastaturile și fonturile vechi) în loc de „ș” și „ț” cu virgulă dedesubt.
    const ced = s.replace(/[şţŞŢ]/g, (c) => ({ 'ş': 'ș', 'ţ': 'ț', 'Ş': 'Ș', 'Ţ': 'Ț' } as Record<string, string>)[c]);
    if (ced !== s) {
      const f2 = FORMS[ced.toLocaleLowerCase('ro-RO')];
      add({ from: at, to: at + s.length, kind: 'form', text: s, fix: f2 ? sameCase(ced, f2) : ced, msg: `Literele cu sedilă (ş, ţ) sunt o scriere veche; în română se scrie cu virgulă dedesubt: „${f2 ?? ced}”.` });
      continue;
    }
    const f = FORMS[low];
    if (f && f !== low) { add({ from: at, to: at + s.length, kind: 'form', text: s, fix: sameCase(s, f), msg: `Formă greșită; forma corectă este „${f}”.` }); continue; }
    // „î” în mijlocul cuvântului (nu la început, nu la sfârșit, nu după un prefix: ne-, re-, pre-, bine-, sub-…).
    const i = low.slice(1, -1).indexOf('î') + 1;
    if (i > 0 && !/[aeiouăâ]/.test(low[i - 1]) && !/^(sub|dez|des|post|trans|contra|supra|extra|auto|anti)î/.test(low)) {
      const neu = low.slice(0, i) + 'â' + low.slice(i + 1);
      add({ from: at, to: at + s.length, kind: 'oldI', text: s, fix: sameCase(s, neu), msg: `În mijlocul cuvântului se scrie „â”, nu „î”: „${neu}”.` });
    }
  }

  // Pleonasme și greșeli de mai multe cuvinte.
  for (const [pat, rep, msg] of PHRASES) {
    for (const p of text.matchAll(re('(?<![' + L + '])' + pat + '(?![' + L + '])', 'giu'))) {
      const fix = rep.replace(/[$]([0-9])/g, (_, n) => p[Number(n)] ?? '');
      add({ from: p.index!, to: p.index! + p[0].length, kind: 'pleonasm', text: p[0], fix: rep ? sameCase(p[0], fix) : undefined, msg });
    }
  }

  // Acordul verbului cu pronumele: „noi este” → „noi suntem”.
  for (const [pron, good, bad] of AGREE) {
    for (const p of text.matchAll(re('(?<![' + L + '-])(' + pron + ')(§s+)(' + bad.join('|') + ')(?![' + L + '-])', 'giu'))) {
      const prev = re('(' + L + '+)[ §t]*$', 'u').exec(text.slice(0, p.index!));
      if (prev && NOT_SUBJ.has(prev[1].toLocaleLowerCase('ro-RO'))) continue;
      // „noi” după un cuvânt e de obicei adjectivul („fonturile noi sunt”, „variante noi au”), nu pronumele.
      if (prev && /^noi$/i.test(p[1]) && !NOI_AFTER.has(prev[1].toLocaleLowerCase('ro-RO'))) continue;
      const verb = p[3].toLocaleLowerCase('ro-RO');
      const v = p[3] === p[3].toLocaleUpperCase('ro-RO') && p[3].length > 1 ? good.toLocaleUpperCase('ro-RO') : good;
      add({ from: p.index!, to: p.index! + p[0].length, kind: 'agree', text: p[0], fix: p[1] + p[2] + v,
        msg: `Acordul verbului: cu „${p[1].toLocaleLowerCase('ro-RO')}” se spune „${good}”, nu „${verb}”.` });
    }
  }

  // Acordul verbului cu un substantiv la plural articulat (-ele / -ile): „mesele este” → „mesele sunt”, „florile a fost” → „au fost”.
  // „-ii” doar la începutul propoziției sau după „toți / acești / mulți…” („copiii este” → „sunt”); altfel poate fi genitiv
  // singular („directorul școlii este”). Nu se verifică substantivul de după o prepoziție („la toate
  // mesele este câte o lumânare”), numele proprii din mijlocul propoziției și „florile este bine să le uzi”.
  for (const p of text.matchAll(re('(?<![' + L + '-])(' + L + '{2,}(?:ele|ile|ii))(§s+)(este|era|a fost|va fi)(?![' + L + '-])', 'giu'))) {
    const noun = p[1].toLocaleLowerCase('ro-RO');
    if (PLURAL_NOT.has(noun) || (noun.endsWith('ele') && SING_E.has(noun.slice(0, -2)))) continue;
    const before = text.slice(0, p.index!);
    if (inClause(before)) continue;
    if (noun.endsWith('ii') && !(noun.length >= 5 && clauseWords(before).every((w) => II_BEFORE.has(w)))) continue;
    if (p[1][0] !== noun[0] && /[^\s.!?…]\s*$/u.test(before) && before.trim()) continue;
    const words = (re('((?:' + L + '+[ §t]+){0,3})$', 'u').exec(before)?.[1] ?? '').toLocaleLowerCase('ro-RO').split(/\s+/);
    if (words.some((w) => NOT_SUBJ.has(w) || PREP.has(w))) continue;
    const after = text.slice(p.index! + p[0].length).toLocaleLowerCase('ro-RO');
    if (re('^(?:[ §t]+' + L + '+){0,3}?[ §t]+să(?![' + L + '])', 'u').test(after)) continue;
    const verb = p[3].toLocaleLowerCase('ro-RO').replace(/\s+/g, ' ');
    const good = { este: 'sunt', era: 'erau', 'a fost': 'au fost', 'va fi': 'vor fi' }[verb]!;
    const v = p[3] === p[3].toLocaleUpperCase('ro-RO') ? good.toLocaleUpperCase('ro-RO') : good;
    add({ from: p.index!, to: p.index! + p[0].length, kind: 'agree', text: p[0], fix: p[1] + p[2] + v,
      msg: `Acordul verbului: „${noun}” e la plural, deci „${good}”, nu „${verb}”.` });
  }

  // Acordul cu un substantiv la singular articulat în -ul sau -a / -ea, doar înaintea unui participiu la singular („documentul au
  // fost semnat” → „a fost semnat”, „directorul au plecat” → „a plecat”, „factura au fost trimisă” → „a fost trimisă”). Cu „sunt” nu se
  // verifică: „problema sunt banii” e corect. Se sare peste -ului (genitiv), după prepoziții / „și”, după o virgulă și în secundare.
  for (const p of text.matchAll(re('(?<![' + L + '-])(' + L + '{2,}(?:ul|a))(§s+)(au fost|vor fi|au|erau)(§s+)(' + L + '{3,})(?![' + L + '-])', 'giu'))) {
    const noun = p[1].toLocaleLowerCase('ro-RO'), part = p[5].toLocaleLowerCase('ro-RO');
    const verb = p[3].toLocaleLowerCase('ro-RO').replace(/\s+/g, ' ');
    if (SING_NOT.has(noun) || !/(at|it|ut|ât|ăt|ns|rs|is|us|as|es|ată|ită|ută|âtă|să)$/.test(part) || (verb === 'au' && part === 'fost')) continue;
    const before = text.slice(0, p.index!);
    if (p[1][0] !== noun[0] && /[^\s.!?…]\s*$/u.test(before) && before.trim()) continue;
    if (/,\s*$/.test(before) || inClause(before)) continue;
    const words = (re('((?:' + L + '+[ §t]+){0,3})$', 'u').exec(before)?.[1] ?? '').toLocaleLowerCase('ro-RO').split(/\s+/);
    if (words.some((w) => NOT_SUBJ.has(w) || PREP.has(w))) continue;
    const good = { 'au fost': 'a fost', 'vor fi': 'va fi', au: 'a', erau: 'era' }[verb]!;
    const v = p[3] === p[3].toLocaleUpperCase('ro-RO') ? good.toLocaleUpperCase('ro-RO') : good;
    const end = p.index! + p[1].length + p[2].length + p[3].length;
    add({ from: p.index!, to: end, kind: 'agree', text: text.slice(p.index!, end), fix: p[1] + p[2] + v,
      msg: `Acordul verbului: „${noun}” e la singular, deci „${good}”, nu „${verb}”.` });
  }

  // Articolul lipsă înainte de posesiv: „prieteni mei” → „prietenii mei”, „cărți mele” → „cărțile mele”, „case tale” → „casele tale”.
  // La masculin doar cuvintele terminate în consoană + „i” („copii mei” poate fi „copiii”, dar „prietenii” are deja articolul).
  for (const p of text.matchAll(re('(?<![' + L + '-])(' + L + '{3,})(§s+)(mei|tăi|săi|noștri|voștri|mele|tale|sale|noastre|voastre)(?![' + L + '-])', 'giu'))) {
    const w = p[1].toLocaleLowerCase('ro-RO'), poss = p[3].toLocaleLowerCase('ro-RO');
    if (POSS_NOT.has(w) || NOT_SUBJ.has(w) || PREP.has(w)) continue;
    const before = text.slice(0, p.index!);
    if (p[1][0] !== w[0] && /[^\s.!?…]\s*$/u.test(before) && before.trim()) continue;
    const masc = ['mei', 'tăi', 'săi', 'noștri', 'voștri'].includes(poss);
    // „-ei” / „-ii” e de obicei genitivul la singular („mijlocul pozei tale”, „tema prezentării mele”), nu pluralul fără articol.
    if (!masc && /(ei|ii)$/.test(w)) continue;
    const add1 = masc ? (/[^aeiouăâîi]i$/.test(w) ? 'i' : '') : (/[ei]$/.test(w) && !/le$/.test(w) ? 'le' : '');
    if (!add1) continue;
    const good = w + add1;
    add({ from: p.index!, to: p.index! + p[1].length, kind: 'agree', text: p[1], fix: p[1] + (p[1] === p[1].toLocaleUpperCase('ro-RO') && p[1].length > 1 ? add1.toLocaleUpperCase('ro-RO') : add1),
      msg: `Înaintea lui „${poss}” cuvântul se scrie cu articol: „${good} ${poss}”.` });
  }

  // Cuvânt repetat: „de de”.
  // Al doilea cuvânt e doar privit înainte (?=…), ca fiecare pereche de cuvinte vecine să fie verificată („gata de de”).
  const rep = re('(?<![' + L + '§p{N}])(' + L + '+)(§s+)(?=(' + L + '+)(?![' + L + '§p{N}]))');
  for (const r of text.matchAll(rep)) {
    if (r[1].toLocaleLowerCase('ro-RO') !== r[3].toLocaleLowerCase('ro-RO') || REPEAT_OK.has(r[1].toLocaleLowerCase('ro-RO'))) continue;
    // „verificat-o o dată” (primul „o” e lipit de verb) și „Închide închide panoul” (numele unui buton, apoi verbul).
    if (text[r.index! - 1] === '-' || (r[1][0] !== r[3][0] && /[^\s.!?…]\s*$/u.test(text.slice(0, r.index!)))) continue;
    const at = r.index! + r[1].length;
    add({ from: r.index!, to: at + r[2].length + r[3].length, kind: 'repeat', text: r[1] + r[2] + r[3], fix: r[1], msg: `Cuvânt repetat: „${r[1]}”.` });
  }

  // Spații duble între cuvinte.
  const dbl = re('(?<=§S)  +(?=§S)');
  while ((m = dbl.exec(text))) add({ from: m.index, to: m.index + m[0].length, kind: 'space', text: m[0], fix: ' ', msg: 'Spații în plus între cuvinte.' });
  // Spațiu înainte de semn: „cuvânt ,”.
  // Nu la extensii de fișier („un fișier .docx”), adrese web / e-mail, căi și formule („=Costuri!B2”, „pagina.php?id=3”).
  const tech = [...text.matchAll(re('§S*(?:://|www[.]|@|[/§§=]|![$]?[A-Z]{1,3}[$]?[0-9:])§S*'))].map((t) => [t.index!, t.index! + t[0].length]);
  const inTech = (i: number) => tech.some(([a, b]) => i >= a && i < b);
  // „4,5 : 1” (raport) și semnul pomenit singur („* și ?)”, „cu / sau : ,”) nu sunt greșeli.
  const ratio = (i: number, j: number) => /[0-9]$/.test(text.slice(0, i)) && /^ *[0-9]/.test(text.slice(j));
  const before = re('(?<=[' + L + '§p{N})”"])( +)([,;:!?]|[.](?![.' + L + ']))(?![§p{N}])');
  while ((m = before.exec(text))) if (!inTech(m.index - 1) && !(m[2] === ':' && ratio(m.index, m.index + m[0].length)) && !/^[ ]*[(),;]/.test(text.slice(m.index + m[0].length))) add({ from: m.index, to: m.index + m[0].length, kind: 'punct', text: m[0], fix: m[2], msg: `Fără spațiu înainte de „${m[2]}”.` });
  // Lipsește spațiul după virgulă, punct și virgulă, semnul întrebării / exclamării: „da,dar”.
  const after = re('(?<=[' + L + '])([,;!?])(' + L + ')');
  while ((m = after.exec(text))) if (!inTech(m.index)) add({ from: m.index, to: m.index + 1, kind: 'punct', text: m[1], fix: m[1] + ' ', msg: `Lipsește spațiul după „${m[1]}”.` });
  // Lipsește spațiul după punct, între două propoziții: „gata.Mâine” (nu „www.site.ro”, nu „S.R.L.”).
  const dot = re('(?<=§p{Ll}{2})[.](§p{Lu}§p{Ll})');
  while ((m = dot.exec(text))) if (!inTech(m.index)) add({ from: m.index, to: m.index + 1, kind: 'punct', text: '.', fix: '. ', msg: 'Lipsește spațiul după punct.' });

  // Literă mică la început de propoziție (după . ! ?, nu după prescurtări și nu după „...”).
  const cap = re('([' + L + '§p{N}.-]*)([.!?])(§s+)(§p{Ll})');
  while ((m = cap.exec(text))) {
    const prev = m[1].toLocaleLowerCase('ro-RO');
    if (m[2] === '!' && /#[A-Z0-9/]+$/.test(text.slice(0, m.index + m[1].length))) continue; // codurile de eroare din foi: „#NUM! și”
    if (m[2] === '.' && (ABBR.has(prev) || ABBR.has(prev.replace(/[.]$/, '')) || prev.length <= 1 || prev.endsWith('.') || /^[0-9]+$/.test(prev) || prev.includes('.'))) continue;
    const at = m.index + m[1].length + m[2].length + m[3].length;
    add({ from: at, to: at + 1, kind: 'capital', text: m[4], fix: m[4].toLocaleUpperCase('ro-RO'), msg: 'Propoziția începe cu literă mare.' });
  }

  return out.sort((a, b) => a.from - b.from);
}

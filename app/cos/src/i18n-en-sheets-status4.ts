// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Mesajele de stare din Sheets, partea 4: protecția, subtotalurile, seria, consolidarea, înghețarea, importul / exportul,
// mutarea, inserarea și ștergerea de celule. Celulele, zonele, foile și fișierele rămân cum sunt.
import type { Pattern } from './i18n';

const pl = (n: string, one: string, many: string) => (n === '1' ? one : many);
const re = (s: string) => new RegExp('^' + s + '$', 's');
const FNS: Record<string, string> = { 'Sumă': 'Sum', 'Număr': 'Count', 'Medie': 'Average', 'Maxim': 'Max', 'Minim': 'Min', 'Produs': 'Product' };
const SPARK: Record<string, string> = { 'Linie': 'Line', 'Coloane': 'Column', 'Câștig / pierdere': 'Win/Loss' };
// „rândurile 1–3 și coloana A” → „rows 1–3 and column A”
const frozen = (x: string) => x.split(' și ').map((p) => p
  .replace(/^rândul (.+)$/, 'row $1').replace(/^rândurile (.+)$/, 'rows $1')
  .replace(/^coloana (.+)$/, 'column $1').replace(/^coloanele (.+)$/, 'columns $1')).join(' and ');
const ins = (w: string) => (w === 'Am inserat' ? 'I inserted' : 'I deleted');
const AXIS: Record<string, string> = { 'rând': 'row', 'rânduri': 'rows', 'coloană': 'column', 'coloane': 'columns' };
const SHIFT: Record<string, string> = {
  'celulele de dedesubt au urcat': 'the cells below moved up', 'celulele din dreapta s-au mutat la stânga': 'the cells on the right moved left',
  'celulele au coborât': 'the cells moved down', 'celulele s-au mutat la dreapta': 'the cells moved right',
};

export const SHEETS_STATUS4_PATTERNS: Pattern[] = [
  [re('Foaia e protejată: (nu se poate schimba așezarea ei|celula (.+) nu se poate modifica)[.] Oprește protecția din Revizuire › Anulare protejare foaie[.]'),
    (m) => `The sheet is protected: ${m[2] ? `cell ${m[2]} cannot be changed` : 'its layout cannot be changed'}. Turn off protection from Review › Unprotect Sheet.`],
  [re('Subtotal: ([0-9]+) (grup|grupuri) după coloana ([A-Z]+), plus Total general [(]Ctrl[+]Z anulează[)]'),
    (m) => `Subtotal: ${m[1]} ${pl(m[1], 'group', 'groups')} by column ${m[3]}, plus Grand Total (Ctrl+Z undoes)`],
  [re('Tabel de date: ([0-9]+) rezultate în ([A-Z]+[0-9]+:[A-Z]+[0-9]+) [(]sunt valori; dacă schimbi formula, refă tabelul; Ctrl[+]Z anulează[)]'),
    'Data Table: $R1 results in $R2 (they are values; if you change the formula, redo the table; Ctrl+Z undoes)'],
  [re('Serie: ([0-9]+) (celulă umplută|celule umplute)(?:; ([0-9]+) (coloane|rânduri) fără număr la început au rămas cum erau)?'),
    (m) => `Series: ${m[1]} ${pl(m[1], 'cell', 'cells')} filled${m[3] ? `; ${m[3]} ${m[4] === 'coloane' ? 'columns' : 'rows'} without a number at the start stayed as they were` : ''}`],
  [re('Consolidare [(](Sumă|Număr|Medie|Maxim|Minim|Produs)[)]: ([0-9]+) zone → ([0-9]+) × ([0-9]+) celule din (.+) [(]Ctrl[+]Z anulează[)]'),
    (m) => `Consolidate (${FNS[m[1]]}): ${m[2]} ranges → ${m[3]} × ${m[4]} cells from ${m[5]} (Ctrl+Z undoes)`],
  [re('Filtru pe coloana ([A-Z]+) după (valoarea „(.+)”|culoarea celulei|culoarea fontului); Date › Golire le arată din nou pe toate'),
    (m) => `Filter on column ${m[1]} by ${m[3] !== undefined ? `the value “${m[3]}”` : m[2] === 'culoarea celulei' ? 'cell color' : 'font color'}; Data › Clear shows them all again`],
  [re('Înghețat: (.+?)( [(]cel mult ([0-9]+) de rânduri și ([0-9]+) de coloane[)])?'),
    (m) => `Frozen: ${frozen(m[1])}${m[2] ? ` (at most ${m[3]} rows and ${m[4]} columns)` : ''}`],
  [re('Numele „(.+)” înseamnă acum (.+): îl poți folosi în formule [(]=SUM[(](.+)[)][)] sau scrie-l aici ca să ajungi la zonă'),
    'The name “$R1” now means $R2: you can use it in formulas (=SUM($R3)) or type it here to go to the range'],
  [re('Minigraficul din (.+) e acum: (Linie|Coloane|Câștig / pierdere)'), (m) => `The sparkline in ${m[1]} is now: ${SPARK[m[2]]}`],
  [re('Rezumat în foaia „(.+)”: ([0-9]+) (rând|rânduri)(?: × ([0-9]+) coloane)?'),
    (m) => `Summary in sheet “${m[1]}”: ${m[2]} ${pl(m[2], 'row', 'rows')}${m[4] ? ` × ${m[4]} columns` : ''}`],
  [re('Totalul din (.+) calculează acum: (sumă|medie|număr|minim|maxim)'),
    (m) => `The total in ${m[1]} now calculates: ${({ 'sumă': 'sum', 'medie': 'average', 'număr': 'count', 'minim': 'min', 'maxim': 'max' } as Record<string, string>)[m[2]]}`],
  [re('Am scos (o evidențiere|([0-9]+) evidențieri) [(]Ctrl[+]Z le aduce înapoi[)]'),
    (m) => `I removed ${m[2] ? m[2] + ' highlights' : 'one highlight'} (Ctrl+Z brings them back)`],
  // „% ” din față e păstrat de traducător.
  [re('din total în (.+)'), 'of total in $R1'], [re('Total cumulat în (.+)'), 'Running total in $R1'],
  [re('Totalul pe rând în (.+)'), 'Row total in $R1'],
  [re('Importat din (.+): ([0-9]+) rânduri, ([0-9]+) coloane [(]separator (.+)[)](?:[.] Atenție: tabelul are loc pentru ([0-9]+) rânduri și ([0-9]+) coloane, restul nu a fost adus)?'),
    (m) => `Imported from ${m[1]}: ${m[2]} rows, ${m[3]} columns (separator ${m[4]})${m[5] ? `. Note: the sheet has room for ${m[5]} rows and ${m[6]} columns, the rest was not brought in` : ''}`],
  [re('Exportat CSV: (.+) [(]se scriu valorile, nu formulele(?:; doar foaia „(.+)”)?[)]'),
    (m) => `Exported CSV: ${m[1]} (the values are written, not the formulas${m[2] ? `; only sheet “${m[2]}”` : ''})`],
  [re('Exportat [.]([a-z]+)( cu parolă)?: (.+?)(?: [(]([0-9]+) foi[)])?'),
    (m) => `Exported .${m[1]}${m[2] ? ' with password' : ''}: ${m[3]}${m[4] ? ` (${m[4]} sheets)` : ''}`],
  [re('(Copiat|Mutat) (o celulă|([0-9]+) celule) în ([A-Z]+[0-9]+(?::[A-Z]+[0-9]+)?)(?:; (o celulă cu date a fost înlocuită|([0-9]+) celule cu date au fost înlocuite))?'),
    (m) => `${m[1] === 'Copiat' ? 'Copied' : 'Moved'} ${m[3] ? m[3] + ' cells' : 'one cell'} to ${m[4]}${m[5] ? (m[6] ? `; ${m[6]} cells with data were replaced` : '; one cell with data was replaced') : ''}`],
  [re('(Am inserat|Am șters) ([0-9]+) (rând|rânduri|coloană|coloane); formulele au fost actualizate [(]Ctrl[+]Z anulează[)]'),
    (m) => `${ins(m[1])} ${m[2]} ${AXIS[m[3]]}; the formulas were updated (Ctrl+Z undoes)`],
  [re('Nu pot muta celulele: îmbinarea (.+) e tăiată de marginea selecției[.] Selectează și coloanele [/] rândurile ei sau anulează îmbinarea[.]'),
    'I cannot move the cells: the merged range $R1 is cut by the edge of the selection. Select its columns / rows too, or unmerge it.'],
  [re('(Am șters|Am inserat) celulele (.+); (celulele de dedesubt au urcat|celulele din dreapta s-au mutat la stânga|celulele au coborât|celulele s-au mutat la dreapta), iar formulele au fost actualizate [(]Ctrl[+]Z anulează[)]'),
    (m) => `${ins(m[1])} the cells ${m[2]}; ${SHIFT[m[3]]}, and the formulas were updated (Ctrl+Z undoes)`],
];

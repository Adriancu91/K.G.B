// Test pentru șabloanele noi din Sheets (30.10): Decont de deplasare, Plan de proiect, Evidență concedii; (02.11): Calculator de credit, Consum carburant.
// Completează câteva rânduri ca un utilizator și verifică totalurile, sfârșitul sarcinilor, bara pe săptămâni și zilele de concediu.
// Rulare (în suite/): node tests/sheet-templates-more.test.mjs
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const dir = join(tmpdir(), `suite-sheettpl-${process.pid}`);
await build({ entryPoints: ['src/sheets/templates.ts', 'src/sheets/formula.ts', 'src/sheets/cond.ts'], bundle: true, format: 'esm', platform: 'node', outdir: dir, logLevel: 'error' });
const { TEMPLATES } = await import(pathToFileURL(join(dir, 'templates.js')).href);
const { evaluateAll } = await import(pathToFileURL(join(dir, 'formula.js')).href);
const { formulaMatches } = await import(pathToFileURL(join(dir, 'cond.js')).href);
rmSync(dir, { recursive: true, force: true });

let fail = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'ok ' : 'GREȘIT'} ${name}${ok ? '' : ' ' + extra}`); if (!ok) fail++; };
const sheetOf = (id) => TEMPLATES.find((t) => t.id === id)?.build().sheets[0];
const calc = (sh, put) => {
  const cells = { ...sh.cells, ...put };
  const r = evaluateAll(cells);
  return (id) => r[id];
};
const num = (v) => (v && v.num ? v.value : undefined);

check('sunt 92 de șabloane', TEMPLATES.length === 92, String(TEMPLATES.length));

// 05.11: Comenzi de mobilier: una întârziată, una în 5 zile, una peste o lună, una livrată cu rest de plată, una livrată și
// plătită, una fără termen; apoi cea livrată se plătește toată.
{
  const sh = sheetOf('mobilier');
  const today = num(calc(sh, { Z1: '=TODAY()' })('Z1'));
  check('mobilier: capul de tabel', sh.cells.A1 === 'Nr.' && sh.cells.G1 === 'Termenul de livrare' && sh.cells.M1 === 'Starea' && sh.cells.O1 === 'Pe scurt' && sh.rules?.length === 4 && sh.lists?.length === 1);
  const v0 = calc(sh, {});
  check('mobilier: gol la început', v0('A2')?.text === '' && v0('J2')?.text === '' && v0('M2')?.text === '' && num(v0('P2')) === 0 && num(v0('P5')) === 0 && v0('P8')?.text === '' && v0('P9')?.text === '', JSON.stringify(['A2', 'J2', 'M2', 'P2', 'P5', 'P8', 'P9'].map(v0)));
  const put = {
    B2: 'Pop Ana', D2: 'Bucătărie', G2: String(today - 3), H2: '8000', I2: '3000',
    B3: 'Ionescu Dan', D3: 'Dulap dormitor', G3: String(today + 5), H3: '4500', I3: '2000',
    B4: 'Marin Ioana', D4: 'Bibliotecă', G4: String(today + 30), H4: '12000', I4: '6000',
    B5: 'Dobre Vlad', D5: 'Comodă', G5: String(today - 10), H5: '3000', I5: '2000', K5: 'Da',
    B6: 'Stan Maria', D6: 'Birou', G6: String(today - 20), H6: '2500', I6: '2500', K6: 'Da',
    B7: 'Vasile Radu', D7: 'Cuier', H7: '1500',
  };
  const v = calc(sh, put);
  check('mobilier: restul, zilele și starea', num(v('J2')) === 5000 && num(v('L2')) === -3 && v('M2')?.text === 'Întârziat' && num(v('L3')) === 5 && v('M3')?.text === 'În 7 zile' && v('M4')?.text === 'În lucru' && v('L5')?.text === '' && v('M5')?.text === 'De încasat' && v('M6')?.text === 'Gata' && v('M7')?.text === 'Fără termen' && num(v('A7')) === 6 && v('M8')?.text === '',
    JSON.stringify(['J2', 'L2', 'M2', 'L3', 'M3', 'M4', 'L5', 'M5', 'M6', 'M7', 'A7', 'M8'].map(v)));
  check('mobilier: pe scurt', num(v('P2')) === 4 && num(v('P3')) === 1 && num(v('P4')) === 1 && num(v('P5')) === 26000 && num(v('P6')) === 15500 && num(v('P7')) === 16000 && num(v('P8')) === today + 5 && v('P9')?.text === 'Ionescu Dan' && v('P10')?.text === 'Dulap dormitor',
    JSON.stringify(['P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10'].map(v)));
  const vp = calc(sh, { ...put, I5: '3000' });
  check('mobilier: plătită toată, devine Gata', vp('M5')?.text === 'Gata' && num(vp('P7')) === 15000, JSON.stringify(['M5', 'P7'].map(vp)));
}

// 05.11: Evidența stingătoarelor: unul verificat acum 13 luni (expirat), unul acum 12 luni fără 10 zile (în 30 de zile), unul acum
// 2 luni (la zi), unul cu sigiliul rupt (defect), unul scos din uz și unul fără verificare; apoi verificarea la 6 luni.
{
  const sh = sheetOf('stingatoare');
  const today = num(calc(sh, { Z1: '=TODAY()' })('Z1'));
  const ago = (m, extra = 0) => num(calc(sh, { Z1: `=EDATE(TODAY();${-m})+${extra}` })('Z1'));
  check('stingătoare: capul de tabel', sh.cells.A1 === 'Nr.' && sh.cells.F1 === 'Ultima verificare' && sh.cells.K1 === 'Starea' && sh.cells.M1 === 'Pe scurt' && sh.cells.N2 === '12' && sh.rules?.length === 4 && sh.lists?.length === 3);
  const v0 = calc(sh, {});
  check('stingătoare: gol la început', v0('A2')?.text === '' && v0('G2')?.text === '' && v0('K2')?.text === '' && num(v0('N3')) === 0 && num(v0('N4')) === 0 && v0('N8')?.text === '' && v0('N9')?.text === '', JSON.stringify(['A2', 'G2', 'K2', 'N3', 'N4', 'N8', 'N9'].map(v0)));
  const put = {
    B2: 'S-101', C2: 'P6', D2: 'Parter, intrare', F2: String(ago(13)), I2: 'Da',
    B3: 'S-102', C3: 'P6', D3: 'Etaj 1, hol', F3: String(ago(12, 10)), I3: 'Da',
    B4: 'S-103', C4: 'CO2 5 kg', D4: 'Camera serverelor', F4: String(ago(2)), I4: 'Da',
    B5: 'S-104', C5: 'P2', D5: 'Bucătărie', F5: String(ago(1)), I5: 'Nu',
    B6: 'S-105', C6: 'P6', D6: 'Depozit', F6: String(ago(30)), J6: 'Da',
    B7: 'S-106', C7: 'P9', D7: 'Garaj',
  };
  const v = calc(sh, put);
  check('stingătoare: verificarea următoare, zilele și starea', num(v('G2')) === ago(1) && v('K2')?.text === 'Expirat' && num(v('H3')) === 10 && v('K3')?.text === 'În 30 de zile' && v('K4')?.text === 'La zi' && v('K5')?.text === 'Defect' && v('H6')?.text === '' && v('K6')?.text === 'Scos din uz' && v('G7')?.text === '' && v('K7')?.text === 'Fără verificare' && num(v('A7')) === 6 && v('K8')?.text === '',
    JSON.stringify(['G2', 'K2', 'H3', 'K3', 'K4', 'K5', 'H6', 'K6', 'G7', 'K7', 'A7', 'K8'].map(v)));
  check('stingătoare: pe scurt', num(v('N3')) === 5 && num(v('N4')) === 1 && num(v('N5')) === 1 && num(v('N6')) === 1 && num(v('N7')) === 1 && num(v('N8')) === today + 10 && v('N9')?.text === 'S-102' && v('N10')?.text === 'Etaj 1, hol',
    JSON.stringify(['N3', 'N4', 'N5', 'N6', 'N7', 'N8', 'N9', 'N10'].map(v)));
  const v6 = calc(sh, { ...put, N2: '6' });
  check('stingătoare: verificarea la 6 luni', num(v6('G4')) === ago(-4) && v6('K4')?.text === 'La zi' && v6('K3')?.text === 'Expirat', JSON.stringify(['G4', 'K4', 'K3'].map(v6)));
}

// 05.11: Termene de valabilitate pe loturi: un lot expirat de 5 zile, unul care expiră peste 10 zile, unul peste 60, unul peste
// 200, unul retras (expirat) și unul fără dată; zilele, valoarea, starea, valorile din dreapta și cel mai apropiat termen.
{
  const sh = sheetOf('valabilitate');
  const today = num(calc(sh, { Z1: '=TODAY()' })('Z1'));
  check('valabilitate: capul de tabel', sh.cells.A1 === 'Nr.' && sh.cells.H1 === 'Data expirării' && sh.cells.K1 === 'Starea' && sh.cells.M1 === 'Pe scurt' && sh.rules?.length === 4 && sh.lists?.length === 1);
  const v0 = calc(sh, {});
  check('valabilitate: gol la început', v0('A2')?.text === '' && v0('G2')?.text === '' && v0('K2')?.text === '' && num(v0('N2')) === 0 && num(v0('N4')) === 0 && v0('N8')?.text === '' && v0('N9')?.text === '', JSON.stringify(['A2', 'G2', 'K2', 'N2', 'N4', 'N8', 'N9'].map(v0)));
  const v = calc(sh, {
    B2: 'Paracetamol 500 mg', C2: 'L2301', E2: '10', F2: '4.5', H2: String(today - 5),
    B3: 'Sirop de tuse', C3: 'S88', E3: '4', F3: '20', H3: String(today + 10),
    B4: 'Vitamina C', C4: 'VC12', E4: '6', F4: '15', H4: String(today + 60),
    B5: 'Plasturi', C5: 'P7', E5: '20', F5: '2', H5: String(today + 200),
    B6: 'Picături de ochi', C6: 'O3', E6: '3', F6: '30', H6: String(today - 40), J6: 'Da',
    B7: 'Comprese', C7: 'C1', E7: '5', F7: '1',
  });
  check('valabilitate: zilele, valoarea și starea', num(v('I2')) === -5 && v('K2')?.text === 'Expirat' && num(v('G2')) === 45 && num(v('I3')) === 10 && v('K3')?.text === 'În 30 de zile' && v('K4')?.text === 'În 90 de zile' && v('K5')?.text === 'Valabil' && v('I6')?.text === '' && v('K6')?.text === 'Retras' && v('K7')?.text === 'Fără dată' && num(v('A7')) === 6 && v('K8')?.text === '',
    JSON.stringify(['I2', 'K2', 'G2', 'I3', 'K3', 'K4', 'K5', 'I6', 'K6', 'K7', 'A7', 'K8'].map(v)));
  check('valabilitate: pe scurt', num(v('N2')) === 5 && num(v('N3')) === 1 && num(v('N4')) === 45 && num(v('N5')) === 1 && num(v('N6')) === 80 && num(v('N7')) === 45 + 80 + 90 + 40 + 5 && num(v('N8')) === today + 10 && v('N9')?.text === 'Sirop de tuse' && v('N10')?.text === 'S88',
    JSON.stringify(['N2', 'N3', 'N4', 'N5', 'N6', 'N7', 'N8', 'N9', 'N10'].map(v)));
}

// 05.11: Termenele dosarelor: un dosar cu termen peste 3 zile, unul cu termenul trecut, unul peste 20 de zile, unul închis
// (cu termen mâine) și unul fără termen; zilele, starea, dosarele active și cel mai apropiat termen cu instanța lui.
{
  const sh = sheetOf('termenedosare');
  const today = num(calc(sh, { Z1: '=TODAY()' })('Z1'));
  check('dosare: capul de tabel', sh.cells.A1 === 'Nr.' && sh.cells.H1 === 'Termenul următor' && sh.cells.M1 === 'Starea' && sh.cells.O1 === 'Pe scurt' && sh.rules?.length === 3 && sh.lists?.length === 2);
  const v0 = calc(sh, {});
  check('dosare: gol la început', v0('A2')?.text === '' && v0('J2')?.text === '' && v0('M2')?.text === '' && num(v0('P2')) === 0 && v0('P6')?.text === '' && v0('P7')?.text === '', JSON.stringify(['A2', 'J2', 'M2', 'P2', 'P6', 'P7'].map(v0)));
  const v = calc(sh, {
    B2: '1234/3/2026', C2: 'Tribunalul București', H2: String(today + 3), G2: 'Fond',
    B3: '567/299/2026', C3: 'Judecătoria Sector 1', H3: String(today - 2), G3: 'Fond',
    B4: '89/2/2026', C4: 'Curtea de Apel București', H4: String(today + 20), G4: 'Apel',
    B5: '45/3/2025', C5: 'Tribunalul Ilfov', H5: String(today + 1), L5: 'Da',
    B6: '777/4/2026', C6: 'Judecătoria Sector 4',
  });
  check('dosare: zilele și starea', num(v('J2')) === 3 && v('M2')?.text === 'În 7 zile' && num(v('J3')) === -2 && v('M3')?.text === 'De actualizat' && num(v('J4')) === 20 && v('M4')?.text === 'În lucru' && v('J5')?.text === '' && v('M5')?.text === 'Închis' && v('J6')?.text === '' && v('M6')?.text === 'Fără termen' && num(v('A6')) === 5 && v('M7')?.text === '',
    JSON.stringify(['J2', 'M2', 'J3', 'M3', 'J4', 'M4', 'J5', 'M5', 'J6', 'M6', 'A6', 'M7'].map(v)));
  check('dosare: pe scurt', num(v('P2')) === 4 && num(v('P3')) === 1 && num(v('P4')) === 1 && num(v('P5')) === 1 && num(v('P6')) === today + 3 && v('P7')?.text === '1234/3/2026' && v('P8')?.text === 'Tribunalul București',
    JSON.stringify(['P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'].map(v)));
}

// 05.11: Compararea locuințelor: trei anunțuri (2000, 1500 și ~2143 €/mp), cu notele 8 / 6 / 9 și drumul 30 / 15 / 45 min;
// bugetul de 120.000 € lasă afară al treilea; scorul, starea și cea mai ieftină / cea mai bună din dreapta.
{
  const sh = sheetOf('locuinte');
  check('locuințe: capul de tabel', sh.cells.A1 === 'Nr.' && sh.cells.F1 === 'Preț pe mp (€)' && sh.cells.M1 === 'Scorul' && sh.cells.O1 === 'Starea' && sh.cells.Q1 === 'Pe scurt' && sh.rules?.length === 3 && sh.lists?.length === 1);
  const v0 = calc(sh, {});
  check('locuințe: gol la început', v0('A2')?.text === '' && v0('F2')?.text === '' && v0('M2')?.text === '' && v0('O2')?.text === '' && num(v0('R3')) === 0 && v0('R4')?.text === '' && v0('R7')?.text === '' && v0('R8')?.text === '', JSON.stringify(['A2', 'F2', 'M2', 'O2', 'R3', 'R4', 'R7', 'R8'].map(v0)));
  const v = calc(sh, {
    R2: '120000',
    B2: 'Ap. 2 camere Centru', D2: '100000', E2: '50', K2: '30', L2: '8', N2: 'Da',
    B3: 'Ap. 3 camere Nord', D3: '90000', E3: '60', K3: '15', L3: '6',
    B4: 'Casă cu curte', D4: '150000', E4: '70', K4: '45', L4: '9',
  });
  check('locuințe: prețul pe mp, scorul și starea', num(v('F2')) === 2000 && num(v('F3')) === 1500 && num(v('F4')) === 2143 && num(v('M2')) === 7.2 && num(v('M3')) === 8.4 && num(v('M4')) === 7.1 && v('O2')?.text === 'Vizitată' && v('O3')?.text === 'Cea mai bună' && v('O4')?.text === 'Peste buget' && num(v('A4')) === 3 && v('A5')?.text === '',
    JSON.stringify(['F2', 'F3', 'F4', 'M2', 'M3', 'M4', 'O2', 'O3', 'O4', 'A4', 'A5'].map(v)));
  check('locuințe: pe scurt', num(v('R3')) === 3 && num(v('R4')) === 1881 && num(v('R5')) === 1500 && v('R6')?.text === 'Ap. 3 camere Nord' && v('R7')?.text === 'Ap. 3 camere Nord' && num(v('R8')) === 2,
    JSON.stringify(['R3', 'R4', 'R5', 'R6', 'R7', 'R8'].map(v)));
}

// 05.11: Ore lucrate pe clienți: la Alfa 9:00 – 12:30 cu 30 min pauză la tariful obișnuit (facturat) și 13:00 – 15:15 la 200 lei / oră;
// la Beta 22:00 – 01:00 nefacturabil (trece de miezul nopții) și 10:00 – 11:00 la tariful obișnuit; totalurile și clientul ales.
{
  const sh = sheetOf('oreclienti');
  check('ore pe clienți: capul de tabel', sh.cells.A1 === 'Nr.' && sh.cells.I1 === 'Ore lucrate' && sh.cells.O1 === 'Starea' && sh.cells.Q1 === 'Pe scurt' && sh.rules?.length === 2 && sh.lists?.length === 2);
  const v0 = calc(sh, {});
  check('ore pe clienți: gol la început', v0('A2')?.text === '' && v0('I2')?.text === '' && v0('L2')?.text === '' && v0('O2')?.text === '' && num(v0('R3')) === 0 && v0('R5')?.text === '' && v0('R11')?.text === '', JSON.stringify(['A2', 'I2', 'L2', 'O2', 'R3', 'R5', 'R11'].map(v0)));
  const v = calc(sh, {
    C2: 'Alfa', F2: String(9 / 24), G2: String(12.5 / 24), H2: '30', M2: 'Da', N2: '12',
    C3: 'Alfa', F3: String(13 / 24), G3: String(15.25 / 24),  K3: '200',
    C4: 'Beta', F4: String(22 / 24), G4: String(1 / 24), J4: 'Nu',
    C5: 'Beta', F5: String(10 / 24), G5: String(11 / 24), J5: 'Da',
    R10: 'Alfa',
  });
  check('ore pe clienți: orele, valoarea și starea', num(v('I2')) === 3 && num(v('L2')) === 450 && v('O2')?.text === 'Facturat' && num(v('I3')) === 2.25 && num(v('L3')) === 450 && v('O3')?.text === 'De facturat' && num(v('I4')) === 3 && v('L4')?.text === '' && v('O4')?.text === '' && num(v('L5')) === 150 && num(v('A5')) === 4 && v('A6')?.text === '',
    JSON.stringify(['I2', 'L2', 'O2', 'I3', 'L3', 'O3', 'I4', 'L4', 'O4', 'L5', 'A5', 'A6'].map(v)));
  check('ore pe clienți: pe scurt', num(v('R3')) === 9.25 && num(v('R4')) === 6.25 && Math.abs(num(v('R5')) - 6.25 / 9.25) < 1e-9 && num(v('R6')) === 1050 && num(v('R7')) === 450 && num(v('R8')) === 600 && num(v('R11')) === 5.25 && num(v('R12')) === 450,
    JSON.stringify(['R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R11', 'R12'].map(v)));
}

// 05.11: Lista de plată a întreținerii: 3 apartamente (2 + 1 + 3 persoane, cote 40 / 25 / 35%), apă rece și caldă, fond de
// reparații; unul plătit, unul cu restanță din luna trecută, unul neplătit; împărțirea și totalurile din dreapta.
{
  const sh = sheetOf('intretinere');
  check('întreținere: capul de tabel', sh.cells.A1 === 'Nr.' && sh.cells.H1 === 'Pe persoane (lei)' && sh.cells.Q1 === 'Starea' && sh.cells.S1 === 'Cheltuielile lunii' && sh.rules?.length === 3);
  const v0 = calc(sh, {});
  check('întreținere: gol la început', v0('A2')?.text === '' && v0('L2')?.text === '' && v0('Q2')?.text === '' && num(v0('T12')) === 0 && v0('T11')?.text === '' && num(v0('T15')) === 0, JSON.stringify(['A2', 'L2', 'Q2', 'T12', 'T11', 'T15'].map(v0)));
  const v = calc(sh, {
    T3: '600', T4: '1000', T5: '10', T6: '30', T7: '20',
    B2: 'Ap. 1', D2: '2', E2: '40', F2: '3', G2: '2', O2: '1000',
    B3: 'Ap. 2', D3: '1', E3: '25', F3: '2', G3: '1', M3: '150',
    B4: 'Ap. 3', D4: '3', E4: '35', F4: '4', G4: '3',
  });
  check('întreținere: împărțirea pe apartamente', num(v('H2')) === 200 && num(v('I2')) === 400 && num(v('J2')) === 90 && num(v('K2')) === 20 && num(v('L2')) === 710
    && num(v('H3')) === 100 && num(v('I3')) === 250 && num(v('J3')) === 50 && num(v('L3')) === 420 && num(v('N3')) === 570 && num(v('A4')) === 3 && v('A5')?.text === '',
    JSON.stringify(['H2', 'I2', 'J2', 'K2', 'L2', 'H3', 'I3', 'J3', 'L3', 'N3', 'A4', 'A5'].map(v)));
  check('întreținere: starea', v('Q2')?.text === 'Plătit' && num(v('P2')) === -290 && v('Q3')?.text === 'Restanță' && v('Q4')?.text === 'De plată' && num(v('L4')) === 300 + 350 + 130 + 20,
    JSON.stringify(['P2', 'Q2', 'Q3', 'L4', 'Q4'].map(v)));
  check('întreținere: pe scurt', num(v('T9')) === 6 && num(v('T10')) === 100 && num(v('T11')) === 100 && num(v('T12')) === 710 + 570 + 800 && num(v('T13')) === 1000 && num(v('T14')) === 1080 && num(v('T15')) === 1,
    JSON.stringify(['T9', 'T10', 'T11', 'T12', 'T13', 'T14', 'T15'].map(v)));
}

// 05.11: Rețetă cu costul pe porție: cartofi cu 20% pierderi, unt, smântână; 4 porții; prețul de vânzare bun, prea mic
// (în pierdere) și puțin peste țintă; costul pe porție, procentul ingredientelor și prețul recomandat.
{
  const sh = sheetOf('retetacost');
  check('rețetă: capul de tabel', sh.cells.A1 === 'Nr.' && sh.cells.F1 === 'Cantitatea brută' && sh.cells.H1 === 'Costul (lei)' && sh.cells.K1 === 'Pe scurt' && sh.rules?.length === 3 && sh.lists?.length === 1);
  const v0 = calc(sh, {});
  check('rețetă: gol la început', v0('A2')?.text === '' && v0('F2')?.text === '' && num(v0('L4')) === 0 && v0('L9')?.text === '' && v0('L13')?.text === '', JSON.stringify(['A2', 'F2', 'L4', 'L9', 'L13'].map(v0)));
  const ing = { B2: 'Cartofi', C2: 'kg', D2: '1', E2: '20', G2: '4', B3: 'Unt', C3: 'kg', D3: '0.2', G3: '40', B4: 'Smântână', C4: 'l', D4: '0.5', G4: '14', L3: '4' };
  const v = calc(sh, { ...ing, L6: '25' });
  check('rețetă: brut, cost și pe porție', num(v('F2')) === 1.25 && num(v('H2')) === 5 && num(v('H3')) === 8 && num(v('H4')) === 7 && num(v('H42')) === 20 && num(v('I2')) === 0.25 && num(v('A4')) === 3 && v('A5')?.text === '' && num(v('L5')) === 5,
    JSON.stringify(['F2', 'H2', 'H3', 'H4', 'H42', 'I2', 'A4', 'A5', 'L5'].map(v)));
  check('rețetă: prețul bun', num(v('L8')) === 22.52 && Math.abs(num(v('L9')) - 5 / 22.52) < 1e-9 && Math.abs(num(v('L10')) - 17.52) < 1e-9 && num(v('L12')) === 18.5 && v('L13')?.text === 'Bun',
    JSON.stringify(['L8', 'L9', 'L10', 'L12', 'L13'].map(v)));
  const lo = calc(sh, { ...ing, L6: '5' });
  check('rețetă: prețul prea mic', lo('L13')?.text === 'În pierdere' && num(lo('L10')) < 0, JSON.stringify(['L8', 'L10', 'L13'].map(lo)));
  const hi = calc(sh, { ...ing, L6: '18' });
  check('rețetă: peste țintă', hi('L13')?.text === 'Peste țintă', JSON.stringify(['L8', 'L9', 'L13'].map(hi)));
}

// 05.11: Abonamentele clienților: unul lunar început acum 10 zile (12 ședințe, 4 folosite, plătit pe jumătate), unul care
// expiră peste 3 zile, unul expirat, unul cu toate ședințele folosite și unul nelimitat (fără ședințe); starea și totalurile.
{
  const sh = sheetOf('abonamenteclienti');
  const today = num(calc(sh, { Z1: '=TODAY()' })('Z1'));
  check('abonamente clienți: capul de tabel', sh.cells.A1 === 'Nr.' && sh.cells.G1 === 'Expiră la' && sh.cells.N1 === 'Starea' && sh.cells.Q1 === 'Pe scurt' && sh.rules?.length === 5 && sh.lists?.length === 1);
  const v0 = calc(sh, {});
  check('abonamente clienți: gol la început', v0('A2')?.text === '' && v0('G2')?.text === '' && v0('N2')?.text === '' && num(v0('R2')) === 0, JSON.stringify(['A2', 'G2', 'N2', 'R2'].map(v0)));
  const v = calc(sh, {
    B2: 'Ana Pop', D2: '12 ședințe', E2: String(today - 10), F2: '30', H2: '12', I2: '4', K2: '300', L2: '150',
    B3: 'Ion Ene', D3: 'Lunar', E3: String(today - 27), F3: '30', K3: '200', L3: '200',
    B4: 'Maria Dinu', D4: 'Lunar', E4: String(today - 40), F4: '30', K4: '200', L4: '200',
    B5: 'Radu Stan', D5: '8 ședințe', E5: String(today - 5), F5: '60', H5: '8', I5: '8', K5: '240', L5: '240',
    B6: 'Elena Vlad', D6: 'Nelimitat', E6: String(today), F6: '365', K6: '1500', L6: '1000',
  });
  check('abonamente clienți: expirarea, ședințele și starea', num(v('G2')) === today + 20 && num(v('J2')) === 8 && num(v('M2')) === 150 && v('N2')?.text === 'Activ' && v('N3')?.text === 'Expiră curând' && v('N4')?.text === 'Expirat' && num(v('J5')) === 0 && v('N5')?.text === 'Epuizat' && v('J6')?.text === '' && v('N6')?.text === 'Activ' && num(v('A6')) === 5 && v('N7')?.text === '',
    JSON.stringify(['G2', 'J2', 'M2', 'N2', 'N3', 'N4', 'J5', 'N5', 'J6', 'N6', 'A6', 'N7'].map(v)));
  check('abonamente clienți: pe scurt', num(v('R2')) === 5 && num(v('R3')) === 3 && num(v('R4')) === 1 && num(v('R5')) === 1 && num(v('R6')) === 1 && num(v('R7')) === 2440 && num(v('R8')) === 1790 && num(v('R9')) === 650,
    JSON.stringify(['R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9'].map(v)));
}

// 05.11: Programări clienți: una azi la 14:30 de 90 de minute (confirmată, 150 lei cu 50 avans), una ieri realizată (200 lei),
// una mâine anulată (120 lei) și una peste 3 zile programată fără avans (80 lei); ora de sfârșit, restul, „Când” și totalurile.
{
  const sh = sheetOf('programari');
  const today = num(calc(sh, { Z1: '=TODAY()' })('Z1'));
  check('programări: capul de tabel', sh.cells.A1 === 'Nr.' && sh.cells.H1 === 'Se termină la' && sh.cells.M1 === 'Când' && sh.cells.P1 === 'Pe scurt' && sh.rules?.length === 4 && sh.lists?.length === 1);
  const v0 = calc(sh, {});
  check('programări: gol la început', v0('A2')?.text === '' && v0('H2')?.text === '' && v0('M2')?.text === '' && num(v0('Q2')) === 0, JSON.stringify(['A2', 'H2', 'M2', 'Q2'].map(v0)));
  const v = calc(sh, {
    B2: String(today), C2: String(14.5 / 24), D2: 'Ana Pop', F2: 'Vopsit', G2: '90', I2: '150', J2: '50', L2: 'Confirmată',
    B3: String(today - 1), C3: String(10 / 24), D3: 'Ion Ene', F3: 'Tuns', G3: '30', I3: '200', L3: 'Realizată',
    B4: String(today + 1), D4: 'Maria Dinu', F4: 'Manichiură', I4: '120', J4: '20', L4: 'Anulată',
    B5: String(today + 3), D5: 'Radu Stan', F5: 'Tuns', I5: '80', L5: 'Programată',
  });
  check('programări: sfârșitul, restul și „Când”', Math.abs(num(v('H2')) - 16 / 24) < 1e-9 && num(v('K2')) === 100 && v('M2')?.text === 'Azi' && v('M3')?.text === 'A trecut' && v('K4')?.text === '' && v('M4')?.text === 'Urmează' && num(v('K5')) === 80 && v('H4')?.text === '' && num(v('A5')) === 4 && v('M6')?.text === '',
    JSON.stringify(['H2', 'K2', 'M2', 'M3', 'K4', 'M4', 'K5', 'H4', 'A5', 'M6'].map(v)));
  check('programări: pe scurt', num(v('Q2')) === 4 && num(v('Q3')) === 1 && num(v('Q4')) === 1 && num(v('Q5')) === 1 && num(v('Q6')) === 1 && num(v('Q7')) === 200 && num(v('Q8')) === 70 && num(v('Q9')) === 180,
    JSON.stringify(['Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8', 'Q9'].map(v)));
}

// 05.11: Plan de mentenanță a utilajelor: o revizie făcută acum 30 de zile la 180 (la zi), o verificare ISCIR făcută acum 370 de zile
// la 365 (depășită), un schimb de ulei care vine peste 10 zile (în curând), un cântar fără dată; costul intervențiilor.
{
  const sh = sheetOf('mentenanta');
  const today = num(calc(sh, { Z1: '=TODAY()' })('Z1'));
  check('mentenanță: capul de tabel', sh.cells.A1 === 'Nr.' && sh.cells.G1 === 'Următoarea' && sh.cells.I1 === 'Starea' && sh.cells.N1 === 'Pe scurt' && sh.rules?.length === 3 && sh.lists?.length === 1);
  const v0 = calc(sh, {});
  check('mentenanță: gol la început', v0('A2')?.text === '' && v0('I2')?.text === '' && num(v0('O2')) === 0, JSON.stringify(['A2', 'I2', 'O2'].map(v0)));
  const v = calc(sh, {
    B2: 'Stivuitor 1', D2: 'Revizie periodică', E2: String(today - 30), F2: '180', K2: '1200',
    B3: 'Stivuitor 1', D3: 'Verificare ISCIR', E3: String(today - 370), F3: '365', K3: '450.5',
    B4: 'Compresor', D4: 'Schimb de ulei și filtre', E4: String(today - 80), F4: '90',
    B5: 'Cântar platformă', D5: 'Verificare metrologică',
  });
  check('mentenanță: data următoare, zilele și starea', num(v('G2')) === today + 150 && num(v('H2')) === 150 && v('I2')?.text === 'La zi' && num(v('H3')) === -5 && v('I3')?.text === 'Depășită' && num(v('H4')) === 10 && v('I4')?.text === 'În curând' && v('G5')?.text === '' && v('I5')?.text === 'Fără dată' && num(v('A5')) === 4 && v('I6')?.text === '',
    JSON.stringify(['G2', 'H2', 'I2', 'H3', 'I3', 'H4', 'I4', 'G5', 'I5', 'A5', 'I6'].map(v)));
  check('mentenanță: pe scurt', num(v('O2')) === 4 && num(v('O3')) === 1 && num(v('O4')) === 1 && num(v('O5')) === 1 && num(v('O6')) === 1 && Math.abs(num(v('O7')) - 1650.5) < 1e-9, JSON.stringify(['O2', 'O3', 'O4', 'O5', 'O6', 'O7'].map(v)));
}

// 05.11: Evidența echipamentului de protecție: de înlocuit, în curând, în uz, fără dată; nesemnatele din fișă.
{
  const sh = sheetOf('echipprotectie');
  check('echipament de protecție: capul de tabel', sh.cells.A1 === 'Nr.' && sh.cells.J1 === 'Starea' && sh.cells.N1 === 'Pe scurt' && sh.lists?.length === 2 && sh.rules?.length === 4);
  const v0 = calc(sh, {});
  check('echipament de protecție: gol la început', v0('A2')?.text === '' && v0('J2')?.text === '' && num(v0('O2')) === 0, JSON.stringify(['A2', 'J2', 'O2'].map(v0)));
  const put = {
    B2: 'Ion', C2: 'Cască de protecție', F2: '=DATE(2020;1;15)', G2: '24', K2: 'Da',
    B3: 'Ion', C3: 'Mănuși de protecție', F3: '=EDATE(TODAY();-3)+10', G3: '3', K3: 'Nu',
    B4: 'Maria', C4: 'Bocanci de protecție', F4: '=TODAY()', G4: '12', K4: 'Da',
    B5: 'Maria', C5: 'Vestă reflectorizantă',
  };
  const v = calc(sh, put);
  check('echipament de protecție: data de înlocuire', num(v('H2')) === num(calc(sh, { A90: '=DATE(2022;1;15)' })('A90')) && num(v('I3')) === 10 && v('H5')?.text === '' && num(v('A5')) === 4, JSON.stringify(['H2', 'I3', 'H5', 'A5'].map(v)));
  check('echipament de protecție: starea', v('J2')?.text === 'De înlocuit' && v('J3')?.text === 'În curând' && v('J4')?.text === 'În uz' && v('J5')?.text === 'Fără dată', JSON.stringify(['J2', 'J3', 'J4', 'J5'].map(v)));
  check('echipament de protecție: pe scurt', num(v('O2')) === 4 && num(v('O3')) === 1 && num(v('O4')) === 1 && num(v('O5')) === 1 && num(v('O6')) === 1 && num(v('O7')) === 1, JSON.stringify(['O2', 'O3', 'O4', 'O5', 'O6', 'O7'].map(v)));
}

// 04.11: Garanții de bună execuție: restituită, lucrare în curs, de cerut înapoi (client), de restituit (noi), curând, în garanție; procentul și lunile din „Reguli”.
{
  const sh = sheetOf('garantiibe');
  check('garanții BE: capul de tabel', sh.cells.A1 === 'Nr.' && sh.cells.N1 === 'Starea' && sh.cells.P5 === 'Pe scurt' && sh.lists?.length === 1 && sh.rules?.length === 6);
  const v0 = calc(sh, {});
  check('garanții BE: gol la început', v0('A2')?.text === '' && v0('N2')?.text === '' && num(v0('Q6')) === 0, JSON.stringify(['A2', 'N2', 'Q6'].map(v0)));
  const put = {
    B2: 'C1', D2: 'Reținută de client', E2: '10000', F2: '0.1', H2: '=DATE(2020;1;15)', I2: '12', K2: '1000',
    B3: 'C2', D3: 'Reținută de client', E3: '20000',
    B4: 'C3', D4: 'Reținută de client', E4: '20000', H4: '=DATE(2020;1;15)',
    B5: 'C4', D5: 'Reținută de noi', E5: '8000', F5: '0.1', H5: '=DATE(2020;1;15)', I5: '6', K5: '300',
    B6: 'C5', D6: 'Reținută de client', E6: '4000', H6: '=TODAY()-10', I6: '1',
    B7: 'C6', D7: 'Reținută de noi', E7: '6000', H7: '=TODAY()', I7: '24',
  };
  const v = calc(sh, put);
  check('garanții BE: sumele', num(v('G2')) === 1000 && num(v('G3')) === 1000 && num(v('G5')) === 800 && num(v('L2')) === 0 && num(v('L5')) === 500 && num(v('A7')) === 6, JSON.stringify(['G2', 'G3', 'G5', 'L2', 'L5', 'A7'].map(v)));
  check('garanții BE: data eliberării', v('J3')?.text === '' && num(v('J4')) === num(calc(sh, { A40: '=DATE(2022;1;15)' })('A40')), JSON.stringify(['J3', 'J4'].map(v)));
  check('garanții BE: starea', v('N2')?.text === 'Restituită' && v('N3')?.text === 'Lucrare în curs' && v('N4')?.text === 'De cerut înapoi' && v('N5')?.text === 'De restituit' && v('N6')?.text === 'Se eliberează curând' && v('N7')?.text === 'În garanție', JSON.stringify(['N2', 'N3', 'N4', 'N5', 'N6', 'N7'].map(v)));
  check('garanții BE: pe scurt', num(v('Q6')) === 2200 && num(v('Q7')) === 1000 && num(v('Q8')) === 800 && num(v('Q9')) === 500 && num(v('Q10')) === 200 && num(v('Q11')) === 1300, JSON.stringify(['Q6', 'Q7', 'Q8', 'Q9', 'Q10', 'Q11'].map(v)));
}

// 04.11: Impozite și taxe locale: plătit tot cu bonificație, plătit în două rate, doar rata 1 (restant), nimic (restant cu majorări pe ambele rate), un an viitor.
{
  const sh = sheetOf('impozitelocale');
  check('impozite locale: capul de tabel', sh.cells.A1 === 'Nr.' && sh.cells.O1 === 'Starea' && sh.cells.Q5 === 'Pe scurt' && sh.lists?.length === 1 && sh.rules?.length === 4);
  const v0 = calc(sh, {});
  check('impozite locale: gol la început', v0('A2')?.text === '' && v0('O2')?.text === '' && num(v0('R6')) === 0, JSON.stringify(['A2', 'O2', 'R6'].map(v0)));
  const put = {
    B2: 'Casa', C2: 'Clădire', E2: '2025', F2: '1000', G2: '900',
    B3: 'Terenul', C3: 'Teren', E3: '2025', F3: '1000', G3: '500', H3: '500',
    B4: 'Mașina', C4: 'Mijloc de transport', E4: '2025', F4: '1000', G4: '500',
    B5: 'Depozitul', C5: 'Clădire', E5: '2025', F5: '1000',
    B6: 'Biroul', C6: 'Clădire', E6: '2099', F6: '1000',
  };
  const v = calc(sh, put);
  const now = new Date();
  const mon = (y, m) => Math.max(0, (now.getFullYear() - y) * 12 + now.getMonth() + 1 - m);
  const n4 = Math.round(500 * mon(2025, 9) * 0.01), n5 = Math.round((500 * mon(2025, 3) + 500 * mon(2025, 9)) * 0.01);
  check('impozite locale: ratele și bonificația', num(v('I2')) === 900 && num(v('J2')) === 500 && num(v('K2')) === 500 && num(v('L2')) === 100 && num(v('L3')) === 0 && num(v('A6')) === 5, JSON.stringify(['I2', 'J2', 'K2', 'L2', 'L3', 'A6'].map(v)));
  check('impozite locale: rămas și majorări', num(v('M2')) === 0 && num(v('M3')) === 0 && num(v('M4')) === 500 && num(v('M5')) === 1000 && num(v('M6')) === 1000 && num(v('N2')) === 0 && num(v('N4')) === n4 && num(v('N5')) === n5 && num(v('N6')) === 0, JSON.stringify(['M2', 'M3', 'M4', 'M5', 'M6', 'N2', 'N4', 'N5', 'N6'].map(v)) + ' ' + n4 + ' ' + n5);
  check('impozite locale: starea', v('O2')?.text === 'Plătit' && v('O3')?.text === 'Plătit' && v('O4')?.text === 'Restant' && v('O5')?.text === 'Restant' && v('O6')?.text === 'De plată', JSON.stringify(['O2', 'O3', 'O4', 'O5', 'O6'].map(v)));
  check('impozite locale: pe scurt', num(v('R6')) === 5000 && num(v('R7')) === 2400 && num(v('R8')) === 100 && num(v('R9')) === 2500 && num(v('R10')) === 1500 && num(v('R11')) === n4 + n5, JSON.stringify(['R6', 'R7', 'R8', 'R9', 'R10', 'R11'].map(v)));
}

// 04.11: Contribuția pentru persoanele cu dizabilități: plătită, sub prag, acoperită prin achiziții, locuri ocupate, termen depășit și de plată.
{
  const sh = sheetOf('dizabilitati');
  check('dizabilități: capul de tabel', sh.cells.A1 === 'Luna' && sh.cells.L1 === 'Starea' && sh.cells.N6 === 'Pe scurt' && sh.lists?.length === 1 && sh.rules?.length === 6);
  const v0 = calc(sh, {});
  check('dizabilități: gol la început', v0('F2')?.text === '' && v0('L2')?.text === '' && num(v0('O7')) === 0, JSON.stringify(['F2', 'L2', 'O7'].map(v0)));
  const put = {
    A2: '=DATE(2026;1;1)', B2: '60', C2: '1', D2: '4050', K2: 'Da',
    A3: '=DATE(2026;2;1)', B3: '40', D3: '4050',
    A4: '=DATE(2026;3;1)', B4: '120', C4: '2', D4: '4050', E4: '5000',
    A5: '=DATE(2026;4;1)', B5: '75', C5: '3', D5: '4050',
    A6: '=DATE(2026;5;1)', B6: '100', D6: '4050', E6: '1000',
    A7: '=DATE(2099;12;1)', B7: '50', D7: '4050',
  };
  const v = calc(sh, put);
  check('dizabilități: locurile', num(v('F2')) === 2 && num(v('G2')) === 1 && num(v('F3')) === 0 && num(v('F4')) === 4 && num(v('G4')) === 2 && num(v('G5')) === 0 && num(v('G6')) === 4 && num(v('F7')) === 2, JSON.stringify(['F2', 'G2', 'F3', 'F4', 'G4', 'G5', 'G6', 'F7'].map(v)));
  check('dizabilități: sumele și termenul', num(v('H2')) === 2025 && num(v('I2')) === 2025 && num(v('H4')) === 4050 && num(v('I4')) === 0 && num(v('H6')) === 8100 && num(v('I6')) === 7100 && num(v('J2')) === num(calc(sh, { X1: '=DATE(2026;2;25)' })('X1')) && num(v('J7')) === num(calc(sh, { X1: '=DATE(2100;1;25)' })('X1')), JSON.stringify(['H2', 'I2', 'H4', 'I4', 'H6', 'I6', 'J2', 'J7'].map(v)));
  check('dizabilități: starea', v('L2')?.text === 'Plătit' && v('L3')?.text === 'Nu e cazul' && v('L4')?.text === 'Acoperit prin achiziții' && v('L5')?.text === 'Locuri ocupate' && v('L6')?.text === 'Termen depășit' && v('L7')?.text === 'De plată', JSON.stringify(['L2', 'L3', 'L4', 'L5', 'L6', 'L7'].map(v)));
  check('dizabilități: pe scurt', num(v('O7')) === 18225 && num(v('O8')) === 5050 && num(v('O9')) === 2025 && num(v('O10')) === 11150 && num(v('O11')) === 7100, JSON.stringify(['O7', 'O8', 'O9', 'O10', 'O11'].map(v)));
}

// 04.11: Ore suplimentare: ore compensate complet, compensate pe jumătate (în termen), necompensate după 90 de zile (cu spor) și plătite cu spor.
{
  const sh = sheetOf('oresupl');
  check('ore suplimentare: capul de tabel', sh.cells.A1 === 'Nr.' && sh.cells.K1 === 'Starea' && sh.cells.N5 === 'Pe scurt' && sh.lists?.length === 1 && sh.rules?.length === 3);
  const v0 = calc(sh, {});
  check('ore suplimentare: gol la început', v0('A2')?.text === '' && v0('K2')?.text === '' && num(v0('O6')) === 0 && v0('O14')?.text === '', JSON.stringify(['A2', 'K2', 'O6', 'O14'].map(v0)));
  const put = {
    B2: 'Ana', C2: '=TODAY()-10', D2: '4', E2: 'Timp liber', F2: '4',
    B3: 'Ana', C3: '=TODAY()-20', D3: '6', E3: 'Timp liber', F3: '2',
    B4: 'Ion', C4: '=TODAY()-90', D4: '5', I4: '40',
    B5: 'Ion', C5: '=TODAY()-5', D5: '3', E5: 'Plătite cu spor', I5: '40',
    O13: 'Ion',
  };
  const v = calc(sh, put);
  check('ore suplimentare: orele rămase și termenul', num(v('H2')) === 0 && num(v('H3')) === 4 && num(v('H4')) === 5 && num(v('H5')) === 0 && num(v('G3')) === num(v('C3')) + 60 && v('G5')?.text === '' && num(v('A5')) === 4, JSON.stringify(['H2', 'H3', 'H4', 'H5', 'G3', 'C3', 'G5', 'A5'].map(v)));
  check('ore suplimentare: starea și suma', v('K2')?.text === 'Compensate' && v('K3')?.text === 'De compensat' && v('K4')?.text === 'Termen depășit' && v('K5')?.text === 'Plătite cu spor' && num(v('J3')) === 0 && num(v('J4')) === 350 && num(v('J5')) === 210, JSON.stringify(['K2', 'K3', 'K4', 'K5', 'J3', 'J4', 'J5'].map(v)));
  check('ore suplimentare: pe scurt și un angajat', num(v('O6')) === 18 && num(v('O7')) === 6 && num(v('O8')) === 4 && num(v('O9')) === 5 && num(v('O10')) === 560 && num(v('O14')) === 8 && num(v('O15')) === 5 && num(v('O16')) === 560, JSON.stringify(['O6', 'O7', 'O8', 'O9', 'O10', 'O14', 'O15', 'O16'].map(v)));
}

// 04.11: Concedii medicale: boală obișnuită 5 zile (55%) și 14 zile (65%, angajatorul zilele 1–5), sarcină și lăuzie o lună (85%, tot din FNUASS,
// fără 1 iunie), o continuare (tot din FNUASS) și o urgență începută sâmbăta (100%, 3 zile lucrătoare de la angajator).
{
  const sh = sheetOf('concmed');
  check('concedii medicale: capul de tabel', sh.cells.A1 === 'Nr.' && sh.cells.P1 === 'Suma din FNUASS' && sh.cells.S1 === 'Pe scurt' && sh.lists?.length === 2 && sh.lists[0].values.length === 12);
  const v0 = calc(sh, {});
  check('concedii medicale: gol la început', v0('A2')?.text === '' && v0('L2')?.text === '' && num(v0('T2')) === 0, JSON.stringify(['A2', 'L2', 'T2'].map(v0)));
  const put = {
    D2: '01 Boală obișnuită', E2: 'Inițial', F2: '=DATE(2026;5;4)', G2: '=DATE(2026;5;8)', J2: '200',
    D3: '01 Boală obișnuită', E3: 'Inițial', F3: '=DATE(2026;5;4)', G3: '=DATE(2026;5;17)', J3: '300',
    D4: '08 Sarcină și lăuzie', E4: 'Inițial', F4: '=DATE(2026;6;1)', G4: '=DATE(2026;6;30)', J4: '100',
    D5: '01 Boală obișnuită', E5: 'În continuare', F5: '=DATE(2026;5;18)', G5: '=DATE(2026;5;31)', J5: '300',
    D6: '06 Urgență medico-chirurgicală', F6: '=DATE(2026;5;9)', G6: '=DATE(2026;5;13)', J6: '150',
  };
  const v = calc(sh, put);
  check('concedii medicale: zile și procente', num(v('H2')) === 5 && num(v('I2')) === 5 && num(v('K2')) === 0.55 && num(v('H3')) === 14 && num(v('I3')) === 10 && num(v('K3')) === 0.65 && num(v('I4')) === 21 && num(v('K4')) === 0.85 && num(v('I5')) === 10 && num(v('I6')) === 3 && num(v('K6')) === 1 && num(v('A6')) === 5, JSON.stringify(['H2', 'I2', 'K2', 'H3', 'I3', 'K3', 'I4', 'K4', 'I5', 'I6', 'K6', 'A6'].map(v)));
  check('concedii medicale: indemnizația', num(v('L2')) === 550 && num(v('L3')) === 1950 && num(v('L4')) === 1785 && num(v('L5')) === 1950 && num(v('L6')) === 450, JSON.stringify(['L2', 'L3', 'L4', 'L5', 'L6'].map(v)));
  check('concedii medicale: angajator și FNUASS', num(v('M2')) === 5 && num(v('N2')) === 550 && num(v('P2')) === 0 && num(v('M3')) === 5 && num(v('N3')) === 975 && num(v('O3')) === 5 && num(v('P3')) === 975 && num(v('M4')) === 0 && num(v('P4')) === 1785 && num(v('M5')) === 0 && num(v('P5')) === 1950 && num(v('M6')) === 3 && num(v('N6')) === 450, JSON.stringify(['M2', 'N2', 'P2', 'M3', 'N3', 'O3', 'P3', 'M4', 'P4', 'M5', 'P5', 'M6', 'N6'].map(v)));
  check('concedii medicale: pe scurt', num(v('T2')) === 5 && num(v('T3')) === 49 && num(v('T4')) === 6685 && num(v('T5')) === 1975 && num(v('T6')) === 4710, JSON.stringify(['T2', 'T3', 'T4', 'T5', 'T6'].map(v)));
}

// 04.11: Cheltuieli auto: carburant la folosință mixtă (1000 + 190 TVA), o reparație exclusiv pentru firmă (500 + 95), o asigurare fără TVA la folosință goală (1200).
{
  const sh = sheetOf('cheltauto');
  check('auto: capul de tabel', sh.cells.A1 === 'Nr.' && sh.cells.N1 === 'Cheltuială nedeductibilă' && sh.cells.P1 === 'Pe scurt' && sh.lists?.length === 2);
  const v0 = calc(sh, {});
  check('auto: gol la început', v0('A2')?.text === '' && v0('J2')?.text === '' && num(v0('Q2')) === 0, JSON.stringify(['A2', 'J2', 'Q2'].map(v0)));
  const v = calc(sh, { E2: 'Carburant', F2: 'Mixtă (50%)', G2: '1000', H2: '190', E3: 'Reparații și piese', F3: 'Exclusiv pentru firmă', G3: '500', H3: '95', E4: 'Asigurări', G4: '1200' });
  check('auto: mixtă', num(v('I2')) === 1190 && num(v('J2')) === 95 && num(v('K2')) === 95 && num(v('L2')) === 1095 && num(v('M2')) === 547.5 && num(v('N2')) === 547.5, JSON.stringify(['I2', 'J2', 'K2', 'L2', 'M2', 'N2'].map(v)));
  check('auto: exclusiv pentru firmă', num(v('J3')) === 95 && num(v('K3')) === 0 && num(v('L3')) === 500 && num(v('M3')) === 500 && num(v('N3')) === 0, JSON.stringify(['J3', 'K3', 'L3', 'M3', 'N3'].map(v)));
  check('auto: folosința goală e mixtă', num(v('J4')) === 0 && num(v('L4')) === 1200 && num(v('M4')) === 600 && num(v('N4')) === 600 && num(v('A4')) === 3, JSON.stringify(['J4', 'L4', 'M4', 'N4', 'A4'].map(v)));
  check('auto: pe scurt', num(v('Q2')) === 3 && num(v('Q3')) === 2985 && num(v('Q4')) === 190 && num(v('Q5')) === 95 && num(v('Q6')) === 1647.5 && num(v('Q7')) === 1147.5 && num(v('Q10')) === 1000 && num(v('Q11')) === 500 && num(v('Q12')) === 1200, JSON.stringify(['Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q10', 'Q11', 'Q12'].map(v)));
}

// 04.11: Facturi în valută: o factură emisă încasată la un curs mai mare (venit 30), una primită plătită la un curs mai mare (cheltuială 60),
// una primită în USD plătită la un curs mai mic (venit 50), una emisă încă deschisă și una fără diferență.
{
  const sh = sheetOf('valuta');
  check('valută: capul de tabel', sh.cells.A1 === 'Nr.' && sh.cells.N1 === 'Starea' && sh.cells.Q1 === 'Pe scurt' && sh.lists?.length === 2 && sh.rules?.length === 3);
  const v0 = calc(sh, {});
  check('valută: gol la început', v0('A2')?.text === '' && v0('N2')?.text === '' && num(v0('R2')) === 0 && num(v0('R7')) === 0, JSON.stringify(['A2', 'N2', 'R2', 'R7'].map(v0)));
  const put = {
    E2: 'Emisă către client', F2: 'EUR', G2: '1000', H2: '4.97', K2: '5',
    E3: 'Primită de la furnizor', F3: 'EUR', G3: '2000', H3: '4.97', K3: '5',
    E4: 'Primită de la furnizor', F4: 'USD', G4: '500', H4: '4.6', K4: '4.5',
    E5: 'Emisă către client', F5: 'EUR', G5: '300', H5: '4.97',
    E6: 'Emisă către client', F6: 'EUR', G6: '100', H6: '5', K6: '5',
  };
  const v = calc(sh, put);
  check('valută: lei la factură și la plată', num(v('I2')) === 4970 && num(v('L2')) === 5000 && num(v('M2')) === 30 && num(v('I3')) === 9940 && num(v('M3')) === 60 && num(v('M4')) === -50 && num(v('I5')) === 1491 && v('L5')?.text === '' && num(v('A6')) === 5, JSON.stringify(['I2', 'L2', 'M2', 'I3', 'M3', 'M4', 'I5', 'L5', 'A6'].map(v)));
  check('valută: starea', v('N2')?.text === 'Venit din curs' && v('N3')?.text === 'Cheltuială din curs' && v('N4')?.text === 'Venit din curs' && v('N5')?.text === 'Deschisă' && v('N6')?.text === 'Fără diferență', JSON.stringify(['N2', 'N3', 'N4', 'N5', 'N6'].map(v)));
  check('valută: efectul', num(v('O2')) === 30 && num(v('O3')) === -60 && num(v('O4')) === 50 && v('O5')?.text === '' && v('O6')?.text === '', JSON.stringify(['O2', 'O3', 'O4', 'O5', 'O6'].map(v)));
  check('valută: pe scurt', num(v('R2')) === 5 && num(v('R3')) === 1 && num(v('R4')) === 1491 && num(v('R5')) === 80 && num(v('R6')) === 60 && num(v('R7')) === 20 && num(v('O62')) === 20, JSON.stringify(['R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'O62'].map(v)));
}

// 04.11: Cheltuieli de protocol: o masă de afaceri de 1000 lei + 190 TVA și cadouri de 500 lei; venituri 100 000, cheltuieli 80 000 (cu protocolul), impozit 2 000: baza 23 500, limita 470, nedeductibil 1 030.
{
  const sh = sheetOf('protocol');
  check('protocol: capul de tabel', sh.cells.A1 === 'Nr.' && sh.cells.I1 === 'Total' && sh.cells.K1 === 'Limita deductibilă' && sh.lists?.length === 1 && sh.rules?.length === 2);
  const v0 = calc(sh, {});
  check('protocol: gol fără venituri', v0('L7')?.text === '' && v0('L10')?.text === '' && v0('A2')?.text === '', JSON.stringify(['L7', 'L10', 'A2'].map(v0)));
  const put = { E2: 'Masă de afaceri', G2: '1000', H2: '190', E3: 'Cadouri pentru parteneri', G3: '500', L2: '100000', L3: '80000', L4: '2000' };
  const v = calc(sh, put);
  check('protocol: totaluri', num(v('I2')) === 1190 && num(v('I3')) === 500 && num(v('A3')) === 2 && num(v('G62')) === 1500 && num(v('I62')) === 1690 && num(v('L13')) === 1000 && num(v('L14')) === 500 && num(v('L17')) === 2, JSON.stringify(['I2', 'I3', 'A3', 'G62', 'I62', 'L13', 'L14', 'L17'].map(v)));
  check('protocol: limita', num(v('L6')) === 23500 && num(v('L7')) === 470 && num(v('L8')) === 470 && num(v('L9')) === 1030 && v('L10')?.text === 'Peste limită', JSON.stringify(['L6', 'L7', 'L8', 'L9', 'L10'].map(v)));
  const w = calc(sh, { ...put, L2: '200000' });
  check('protocol: în limită', num(w('L7')) === 2470 && num(w('L9')) === 0 && w('L10')?.text === 'În limită', JSON.stringify(['L7', 'L9', 'L10'].map(w)));
}
// 04.11: Tichete de masă: unul în regulă; unul cu concediu și 2 tichete de dat în plus; unul cu 3 date în plus; unul fără zile lucrate; unul fără tichete date încă; cu valoarea de 40 lei.
{
  const sh = sheetOf('tichete');
  check('tichete: capul de tabel', sh.cells.A1 === 'Nr.' && sh.cells.H1 === 'Tichete cuvenite' && sh.cells.M1 === 'Starea' && sh.cells.O5 === 'Pe scurt' && sh.cells.P3 === '40' && sh.rules?.length === 4);
  const put = {
    B2: 'Ion', C2: '21', I2: '21',
    B3: 'Ana', C3: '21', D3: '5', E3: '2', I3: '12',
    B4: 'Mihai', C4: '21', F4: '3', I4: '21',
    B5: 'Elena', C5: '21', D5: '30',
    B6: 'Dan', C6: '21',
  };
  const v = calc(sh, put);
  check('tichete: zile și diferențe', num(v('G2')) === 21 && num(v('G3')) === 14 && num(v('J3')) === 2 && num(v('G4')) === 18 && num(v('J4')) === -3 && num(v('G5')) === 0 && v('J5')?.text === '' && num(v('K3')) === 560 && num(v('L4')) === 840 && num(v('A5')) === 4 && num(v('G6')) === 21 && v('G7')?.text === '', JSON.stringify(['G2', 'G3', 'J3', 'G4', 'J4', 'G5', 'J5', 'K3', 'L4', 'A5', 'G6', 'G7'].map(v)));
  check('tichete: starea', v('M2')?.text === 'În regulă' && v('M3')?.text === 'De dat în plus' && v('M4')?.text === 'Date în plus' && v('M5')?.text === 'În regulă' && v('M6')?.text === 'De dat' && v('M7')?.text === '', JSON.stringify(['M2', 'M3', 'M4', 'M5', 'M6', 'M7'].map(v)));
  check('tichete: totaluri și pe scurt', num(v('H62')) === 74 && num(v('I62')) === 54 && num(v('K62')) === 2960 && num(v('P6')) === 5 && num(v('P10')) === 2 && num(v('P11')) === 3 && num(v('P12')) === 2, JSON.stringify(['H62', 'I62', 'K62', 'P6', 'P10', 'P11', 'P12'].map(v)));
}
// 04.11: Bilete la ordin și cecuri: unul încasat; unul în portofoliu peste 20 de zile; unul scadent în 3 zile; unul cu scadența trecută; unul refuzat; unul emis către furnizor.
{
  const sh = sheetOf('efecte');
  check('efecte: capul de tabel', sh.cells.A1 === 'Nr.' && sh.cells.M1 === 'Rest' && sh.cells.O1 === 'Starea' && sh.cells.Q1 === 'Pe scurt' && sh.lists?.length === 3 && sh.rules?.length === 7);
  const serial = (dt) => Math.round((Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()) - Date.UTC(1899, 11, 30)) / 864e5);
  const now = new Date(), day = (k) => String(serial(new Date(now.getFullYear(), now.getMonth(), now.getDate() + k)));
  const put = {
    B2: 'Bilet la ordin', C2: 'Primit de la client', D2: 'Alfa', H2: '1000', G2: day(-3), K2: '1000',
    B3: 'Bilet la ordin', C3: 'Primit de la client', D3: 'Beta', H3: '2000', G3: day(20),
    B4: 'Cec', C4: 'Primit de la client', D4: 'Alfa', H4: '500', G4: day(3),
    B5: 'Bilet la ordin', C5: 'Primit de la client', D5: 'Gama', H5: '700', G5: day(-1),
    B6: 'Cec', C6: 'Primit de la client', D6: 'Alfa', H6: '300', G6: day(-10), L6: 'Da',
    B7: 'Bilet la ordin', C7: 'Emis către furnizor', D7: 'Delta', H7: '1500', G7: day(30), K7: '500',
    R11: 'Alfa',
  };
  const v = calc(sh, put);
  check('efecte: rest și zile', num(v('M2')) === 0 && num(v('M3')) === 2000 && num(v('N3')) === 20 && num(v('N4')) === 3 && num(v('N5')) === -1 && v('N6')?.text === '' && v('N2')?.text === '' && num(v('M7')) === 1000 && num(v('A7')) === 6 && v('M8')?.text === '', JSON.stringify(['M2', 'M3', 'N3', 'N4', 'N5', 'N6', 'N2', 'M7', 'A7', 'M8'].map(v)));
  check('efecte: starea', v('O2')?.text === 'Încasat' && v('O3')?.text === 'În portofoliu' && v('O4')?.text === 'Scadent în 7 zile' && v('O5')?.text === 'Scadență depășită' && v('O6')?.text === 'Refuzat la plată' && v('O7')?.text === 'De plătit' && v('O8')?.text === '', JSON.stringify(['O2', 'O3', 'O4', 'O5', 'O6', 'O7', 'O8'].map(v)));
  check('efecte: totaluri și pe scurt', num(v('H62')) === 6000 && num(v('M62')) === 4500 && num(v('R2')) === 6 && num(v('R3')) === 3500 && num(v('R4')) === 1000 && num(v('R5')) === 1 && num(v('R6')) === 1 && num(v('R7')) === 1 && num(v('R8')) === 300 && num(v('R12')) === 800 && num(v('R13')) === 1, JSON.stringify(['H62', 'M62', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R12', 'R13'].map(v)));
}
// 04.11: Avansuri de trezorerie: unul decontat; unul în termen; unul cu termenul trecut; unul cu cheltuieli peste avans; unul cu rest de restituit; soldul Anei.
{
  const sh = sheetOf('avansuri');
  check('avansuri: capul de tabel', sh.cells.A1 === 'Nr.' && sh.cells.J1 === 'De restituit de angajat' && sh.cells.L1 === 'Starea' && sh.cells.N1 === 'Pe scurt' && sh.lists?.length === 1 && sh.rules?.length === 5);
  const serial = (dt) => Math.round((Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()) - Date.UTC(1899, 11, 30)) / 864e5);
  const now = new Date(), day = (k) => String(serial(new Date(now.getFullYear(), now.getMonth(), now.getDate() + k)));
  const put = {
    C2: 'Ion', E2: '1000', F2: day(-5), G2: day(-4), H2: '800', I2: '200',
    C3: 'Ana', E3: '500', F3: day(5),
    C4: 'Ion', E4: '300', F4: day(-2),
    C5: 'Mihai', E5: '400', G5: day(0), H5: '450',
    C6: 'Ana', E6: '200', F6: day(10), G6: day(0), H6: '150',
    O11: 'Ana',
  };
  const v = calc(sh, put);
  check('avansuri: resturile', num(v('J2')) === 0 && num(v('K2')) === 0 && num(v('J3')) === 500 && num(v('J4')) === 300 && num(v('J5')) === 0 && num(v('K5')) === 50 && num(v('J6')) === 50 && num(v('A6')) === 5 && v('J7')?.text === '', JSON.stringify(['J2', 'K2', 'J3', 'J4', 'J5', 'K5', 'J6', 'A6', 'J7'].map(v)));
  check('avansuri: starea', v('L2')?.text === 'Decontat' && v('L3')?.text === 'În termen' && v('L4')?.text === 'Termen depășit' && v('L5')?.text === 'De plătit angajatului' && v('L6')?.text === 'Rest de restituit' && v('L7')?.text === '', JSON.stringify(['L2', 'L3', 'L4', 'L5', 'L6', 'L7'].map(v)));
  check('avansuri: totaluri și pe scurt', num(v('E62')) === 2400 && num(v('H62')) === 1400 && num(v('J62')) === 850 && num(v('K62')) === 50 && num(v('O2')) === 5 && num(v('O7')) === 1 && num(v('O8')) === 3 && num(v('O12')) === 550 && num(v('O13')) === 0, JSON.stringify(['E62', 'H62', 'J62', 'K62', 'O2', 'O7', 'O8', 'O12', 'O13'].map(v)));
}
// 04.11: Rapoartele Z: o zi în regulă (121 + 111 + 10 = 242, numerar 142 + card 100, predat 142); una cu 10 lei lipsă la plăți; una cu numerarul nepredat; una cu 45 lei predați din 50.
{
  const sh = sheetOf('rapoartez');
  check('rapoarte Z: capul de tabel', sh.cells.A1 === 'Nr.' && sh.cells.G1 === 'Total vânzări' && sh.cells.N1 === 'Starea' && sh.cells.P1 === 'Pe scurt' && sh.rules?.length === 4);
  const put = {
    B2: '46000', C2: '101', D2: '121', E2: '111', F2: '10', J2: '142', K2: '100', M2: '142',
    B3: '46001', C3: '102', D3: '100', J3: '50', K3: '40', M3: '50',
    B4: '46002', C4: '103', D4: '60.5', J4: '60.5',
    B5: '46003', C5: '104', D5: '50', J5: '50', M5: '45',
  };
  const v = calc(sh, put);
  const near = (x, y) => typeof x === 'number' && Math.abs(x - y) < 0.005;
  check('rapoarte Z: totalul zilei și TVA', num(v('G2')) === 242 && near(num(v('H2')), 21) && near(num(v('I2')), 11) && num(v('L2')) === 0 && near(num(v('L3')), 10) && near(num(v('H3')), 17.36) && num(v('A5')) === 4, JSON.stringify(['G2', 'H2', 'I2', 'L2', 'L3', 'H3', 'A5'].map(v)));
  check('rapoarte Z: starea', v('N2')?.text === 'În regulă' && v('N3')?.text === 'Diferență la plăți' && v('N4')?.text === 'Numerar nepredat' && v('N5')?.text === 'Predat altă sumă' && v('N6')?.text === '', JSON.stringify(['N2', 'N3', 'N4', 'N5', 'N6'].map(v)));
  check('rapoarte Z: totaluri și pe scurt', near(num(v('G33')), 452.5) && near(num(v('Q4')), 68.54) && near(num(v('Q5')), 302.5) && num(v('Q6')) === 140 && num(v('Q2')) === 4 && num(v('Q7')) === 2 && num(v('Q8')) === 1, JSON.stringify(['G33', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8'].map(v)));
}
// 04.11: Promoții și reduceri: 121 lei − 20% (96,80, marja 12,5%, activă); 22,20 − 10% care începe peste 3 zile (viitoare); 10 lei − 50% sub achiziția de 6 lei (sub cost); 10 lei − 10% încheiată ieri.
{
  const sh = sheetOf('promotii');
  check('promoții: capul de tabel', sh.cells.A1 === 'Nr.' && sh.cells.G1 === 'Prețul promoțional (cu TVA)' && sh.cells.M1 === 'Starea' && sh.cells.O1 === 'Pe scurt' && sh.lists?.length === 1 && sh.rules?.length === 3);
  const serial = (dt) => Math.round((Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()) - Date.UTC(1899, 11, 30)) / 864e5);
  const now = new Date(), day = (k) => String(serial(new Date(now.getFullYear(), now.getMonth(), now.getDate() + k)));
  const put = {
    B2: 'Cafea', C2: day(-2), D2: day(5), E2: '121', F2: '20', H2: '21', I2: '70', K2: '10',
    B3: 'Ceai', C3: day(3), D3: day(10), E3: '22.2', F3: '10', H3: '11', I3: '15',
    B4: 'Zahăr', C4: day(-20), D4: day(-1), E4: '10', F4: '50', H4: '0', I4: '6', K4: '4',
    B5: 'Lapte', C5: day(-10), D5: day(-2), E5: '10', F5: '10',
  };
  const v = calc(sh, put);
  const near = (x, y) => typeof x === 'number' && Math.abs(x - y) < 0.0005;
  check('promoții: prețurile și marja', near(num(v('G2')), 96.8) && near(num(v('J2')), 0.125) && near(num(v('G3')), 19.98) && near(num(v('J3')), 1 / 6) && num(v('G4')) === 5 && near(num(v('J4')), -0.2) && v('J5')?.text === '' && num(v('A5')) === 4, JSON.stringify(['G2', 'J2', 'G3', 'J3', 'G4', 'J4', 'J5', 'A5'].map(v)));
  check('promoții: starea', v('M2')?.text === 'Activă' && v('M3')?.text === 'Viitoare' && v('M4')?.text === 'Sub cost' && v('M5')?.text === 'Încheiată' && v('M6')?.text === '', JSON.stringify(['M2', 'M3', 'M4', 'M5', 'M6'].map(v)));
  check('promoții: încasări și pe scurt', near(num(v('L2')), 968) && num(v('L4')) === 20 && num(v('K62')) === 14 && near(num(v('L62')), 988) && num(v('P2')) === 4 && num(v('P3')) === 1 && num(v('P4')) === 1 && num(v('P5')) === 1 && num(v('P6')) === 1 && near(num(v('P7')), 0.225) && near(num(v('P8')), 988), JSON.stringify(['L2', 'L4', 'K62', 'L62', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'].map(v)));
}
// 04.11: Listă de prețuri pentru clienți: 100 lei + 21% cu achiziția 85 (bun); 50 lei + 11% cu achiziția 48 (sub cost la A); 20 lei cu achiziția 25 (sub cost la toți).
{
  const sh = sheetOf('listapreturi');
  check('listă de prețuri: capul de tabel', sh.cells.A1 === 'Nr.' && sh.cells.H1 === 'Clienți A (fără TVA)' && sh.cells.L1 === 'Starea' && sh.cells.O3 === '10' && sh.cells.O4 === '5' && sh.lists?.length === 2 && sh.rules?.length === 3);
  const put = { C2: 'Cafea', E2: '100', F2: '21', K2: '85', C3: 'Ceai', E3: '50', F3: '11', K3: '48', C4: 'Zahăr', E4: '20', F4: '0', K4: '25', C5: 'Lapte', E5: '10' };
  const v = calc(sh, put);
  const near = (x, y) => typeof x === 'number' && Math.abs(x - y) < 0.005;
  check('listă de prețuri: prețurile', num(v('G2')) === 121 && num(v('H2')) === 90 && num(v('I2')) === 95 && num(v('J2')) === 100 && near(num(v('G3')), 55.5) && num(v('H3')) === 45 && num(v('A5')) === 4, JSON.stringify(['G2', 'H2', 'I2', 'J2', 'G3', 'H3', 'A5'].map(v)));
  check('listă de prețuri: starea și pe scurt', v('L2')?.text === 'Bun' && v('L3')?.text === 'Sub cost la clienții A' && v('L4')?.text === 'Sub cost la toți' && v('L5')?.text === '' && num(v('O8')) === 4 && num(v('O9')) === 1 && num(v('O10')) === 1, JSON.stringify(['L2', 'L3', 'L4', 'L5', 'O8', 'O9', 'O10'].map(v)));
}
// 04.11: Calculul prețului de vânzare: 100 lei + 30% + 21% (157,30); 8 lei + 5% + 11% (9,32, rotunjit 9,40, sub adaosul minim de 10%); 50 lei cu -10% (în pierdere).
{
  const sh = sheetOf('pretvanzare');
  check('preț de vânzare: capul de tabel', sh.cells.A1 === 'Nr.' && sh.cells.J1 === 'Prețul rotunjit (cu TVA)' && sh.cells.M1 === 'Starea' && sh.cells.O1 === 'Pe scurt' && sh.cells.P3 === '10' && sh.lists?.length === 2 && sh.rules?.length === 3);
  const put = { B2: 'Cafea', D2: '100', E2: '30', F2: '21', B3: 'Biscuiți', D3: '8', E3: '5', F3: '11', B4: 'Lichidare', D4: '50', E4: '-10', F4: '0' };
  const v = calc(sh, put);
  const near = (x, y) => typeof x === 'number' && Math.abs(x - y) < 0.005;
  check('preț de vânzare: prețurile', num(v('G2')) === 130 && near(num(v('H2')), 27.3) && near(num(v('I2')), 157.3) && near(num(v('J2')), 157.3) && near(num(v('G3')), 8.4) && near(num(v('I3')), 9.32) && near(num(v('J3')), 9.4) && num(v('J4')) === 45 && num(v('A4')) === 3, JSON.stringify(['G2', 'H2', 'I2', 'J2', 'G3', 'I3', 'J3', 'J4'].map(v)));
  check('preț de vânzare: adaosul și marja', near(num(v('K2')), 30) && near(num(v('L2')), 30 / 130) && near(num(v('K3')), 0.47) && near(num(v('K4')), -5), JSON.stringify(['K2', 'L2', 'K3', 'L3', 'K4'].map(v)));
  check('preț de vânzare: starea și pe scurt', v('M2')?.text === 'Bun' && v('M3')?.text === 'Sub adaosul minim' && v('M4')?.text === 'În pierdere' && num(v('P2')) === 3 && near(num(v('P4')), 25 / 3) && num(v('P6')) === 1 && num(v('P7')) === 1, JSON.stringify(['M2', 'M3', 'M4', 'P2', 'P4', 'P5', 'P6', 'P7'].map(v)));
}

// 04.11: Retururi de la clienți: 2 × 50 lei + 21% (121) cu storno și banii dați; 1 × 100 lei fără TVA, fără storno, de acum 20 de zile; 3 × 10 lei + 11% (33,30) cu storno și 10 lei dați, de casat.
{
  const sh = sheetOf('retururiclienti');
  check('retururi clienți: capul de tabel', sh.cells.A1 === 'Nr.' && sh.cells.N1 === 'Rest de restituit' && sh.cells.P1 === 'Starea' && sh.cells.R1 === 'Pe scurt' && sh.lists?.length === 3 && sh.rules?.length === 4);
  const serial = (dt) => Math.round((Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()) - Date.UTC(1899, 11, 30)) / 864e5);
  const now = new Date(), day = (k) => String(serial(new Date(now.getFullYear(), now.getMonth(), now.getDate() + k)));
  const put = {
    B2: day(-5), C2: 'Ana', E2: 'Cafea', F2: '2', G2: '50', H2: '21', L2: 'S-12', M2: '121',
    B3: day(-20), C3: 'Ion', E3: 'Ceainic', F3: '1', G3: '100', H3: '0',
    B4: day(-2), C4: 'Beta SRL', E4: 'Cani', F4: '3', G4: '10', H4: '11', K4: 'De casat', L4: 'S-13', M4: '10',
  };
  const v = calc(sh, put);
  const near = (x, y) => typeof x === 'number' && Math.abs(x - y) < 0.005;
  check('retururi clienți: valoarea și restul', num(v('I2')) === 121 && num(v('N2')) === 0 && num(v('I3')) === 100 && num(v('N3')) === 100 && near(num(v('I4')), 33.3) && near(num(v('N4')), 23.3), JSON.stringify(['I2', 'N2', 'I3', 'N3', 'I4', 'N4'].map(v)));
  check('retururi clienți: starea și zilele', v('P2')?.text === 'Închis' && v('P3')?.text === 'De emis storno' && v('P4')?.text === 'De restituit banii' && v('O2')?.text === '' && num(v('O3')) === 20 && num(v('O4')) === 2 && num(v('A4')) === 3, JSON.stringify(['P2', 'P3', 'P4', 'O2', 'O3', 'O4', 'A4'].map(v)));
  check('retururi clienți: pe scurt', num(v('S2')) === 3 && near(num(v('S3')), 254.3) && num(v('S4')) === 131 && near(num(v('S5')), 123.3) && num(v('S6')) === 1 && num(v('S7')) === 1 && near(num(v('S8')), 33.3), JSON.stringify(['S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8'].map(v)));
}

// 04.11: Ambalaje returnabile: Alfa ne dă 10 paleți EUR (40 lei bucata), noi îi dăm 5 navete (15 lei), apoi îi dăm înapoi cei 10 paleți; Beta ne dă 4 paleți EUR.
{
  const sh = sheetOf('ambalaje');
  check('ambalaje: capul de tabel', sh.cells.A1 === 'Nr.' && sh.cells.J1 === 'Soldul partenerului pe ambalaj' && sh.cells.M1 === 'Pe fel de ambalaj' && sh.cells.M4 === 'Navetă' && sh.lists?.length === 1 && sh.rules?.length === 4);
  const put = {
    C2: 'Alfa', D2: 'Palet EUR', F2: '10', H2: '40',
    C3: 'Alfa', D3: 'Navetă', G3: '5', H3: '15',
    C4: 'Beta', D4: 'Palet EUR', F4: '4', H4: '40',
    C5: 'Alfa', D5: 'Palet EUR', G5: '10', H5: '40',
    N12: 'Alfa',
  };
  const v = calc(sh, put);
  check('ambalaje: valoarea mișcărilor', num(v('I2')) === 400 && num(v('I3')) === -75 && num(v('I4')) === 160 && num(v('I5')) === -400 && num(v('A5')) === 4, JSON.stringify(['I2', 'I3', 'I4', 'I5', 'A5'].map(v)));
  check('ambalaje: soldul pe partener și ambalaj', num(v('J2')) === 10 && num(v('J3')) === -5 && num(v('J4')) === 4 && num(v('J5')) === 0, JSON.stringify(['J2', 'J3', 'J4', 'J5'].map(v)));
  check('ambalaje: starea', v('K2')?.text === 'De dat înapoi' && v('K3')?.text === 'De primit înapoi' && v('K5')?.text === 'Închis', JSON.stringify(['K2', 'K3', 'K5'].map(v)));
  check('ambalaje: pe fel de ambalaj', num(v('N2')) === 4 && num(v('O2')) === 160 && num(v('N4')) === -5 && num(v('O4')) === -75 && num(v('N9')) === -1 && num(v('O9')) === 85, JSON.stringify(['N2', 'O2', 'N4', 'O4', 'N9', 'O9'].map(v)));
  check('ambalaje: soldul unui partener', num(v('N13')) === -5 && num(v('N14')) === -75, JSON.stringify(['N13', 'N14'].map(v)));
}

// 04.11: Retururi către furnizori: 10 buc × 50 lei + 21% (605 lei) acceptat cu nota de credit întreagă; 4 kg × 25 lei + 11% (111) acceptat fără notă; 2 × 100 lei fără TVA refuzat; 5 × 10 lei + 21%, notă de credit 30 lei, de acum 40 de zile.
{
  const sh = sheetOf('retururi');
  check('retururi: capul de tabel', sh.cells.A1 === 'Nr.' && sh.cells.O1 === 'Rest de recuperat' && sh.cells.Q1 === 'Starea' && sh.cells.S1 === 'Pe scurt' && sh.lists?.length === 4 && sh.rules?.length === 5);
  const serial = (dt) => Math.round((Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()) - Date.UTC(1899, 11, 30)) / 864e5);
  const now = new Date(), day = (k) => String(serial(new Date(now.getFullYear(), now.getMonth(), now.getDate() + k)));
  const put = {
    B2: day(-5), D2: 'Cafea', F2: '10', H2: '50', I2: '21', L2: 'Acceptat', N2: '605',
    B3: day(-3), D3: 'Zahăr', F3: '4', H3: '25', I3: '11', L3: 'Acceptat',
    B4: day(-10), D4: 'Ceai', F4: '2', H4: '100', I4: '0', L4: 'Refuzat',
    B5: day(-40), D5: 'Cacao', F5: '5', H5: '10', I5: '21', N5: '30',
  };
  const v = calc(sh, put);
  check('retururi: valoarea cu TVA și restul', num(v('J2')) === 605 && num(v('O2')) === 0 && num(v('J3')) === 111 && num(v('O3')) === 111 && num(v('J4')) === 200 && num(v('O4')) === 0 && num(v('J5')) === 60.5 && num(v('O5')) === 30.5, JSON.stringify(['J2', 'O2', 'J3', 'O3', 'J4', 'O4', 'J5', 'O5'].map(v)));
  check('retururi: starea', v('Q2')?.text === 'Recuperat' && v('Q3')?.text === 'Așteaptă nota de credit' && v('Q4')?.text === 'Refuzat' && v('Q5')?.text === 'Recuperat parțial', JSON.stringify(['Q2', 'Q3', 'Q4', 'Q5'].map(v)));
  check('retururi: zilele doar la cele nerezolvate', v('P2')?.text === '' && num(v('P3')) === 3 && v('P4')?.text === '' && num(v('P5')) === 40 && num(v('A5')) === 4, JSON.stringify(['P2', 'P3', 'P4', 'P5', 'A5'].map(v)));
  check('retururi: pe scurt', num(v('T2')) === 4 && num(v('T3')) === 976.5 && num(v('T4')) === 635 && num(v('T5')) === 141.5 && num(v('T6')) === 200 && num(v('T7')) === 1, JSON.stringify(['T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map(v)));
  const w = calc(sh, { ...put, D6: 'Lapte', F6: '1', H6: '8' });
  check('retururi: fără răspuns', w('Q6')?.text === 'Fără răspuns' && num(w('J6')) === 8, JSON.stringify([w('Q6'), w('J6')]));
}

// 04.11: Evaluarea furnizorilor: Alfa 20 livrări (19 la termen, 20 conforme, preț 4, colaborare 5); Beta 10 (8, 9, 3, 3); Gama 10 (5, 7, 5, 2).
{
  const sh = sheetOf('evalfurnizori');
  check('furnizori: capul de tabel', sh.cells.A1 === 'Nr.' && sh.cells.K1 === 'Punctaj (din 100)' && sh.cells.O1 === 'Pe scurt' && sh.lists?.length === 1 && sh.rules?.length === 6);
  const put = { B2: 'Alfa', D2: '20', E2: '19', F2: '20', G2: '4', H2: '5', B3: 'Beta', D3: '10', E3: '8', F3: '9', G3: '3', H3: '3', B4: 'Gama', D4: '10', E4: '5', F4: '7', G4: '5', H4: '2' };
  const v = calc(sh, put);
  check('furnizori: procentele și punctajul', num(v('I2')) === 95 && num(v('J2')) === 100 && num(v('K2')) === 94 && num(v('K3')) === 78 && num(v('I4')) === 50 && num(v('K4')) === 66, JSON.stringify([v('I2'), v('J2'), v('K2'), v('K3'), v('I4'), v('K4')]));
  check('furnizori: clasa și decizia', v('L2')?.text === 'A' && v('M2')?.text === 'Preferat' && v('L3')?.text === 'B' && v('M3')?.text === 'Acceptat' && v('L4')?.text === 'C' && v('M4')?.text === 'De înlocuit', JSON.stringify([v('L2'), v('M3'), v('M4')]));
  check('furnizori: totalul', num(v('D22')) === 40 && num(v('I22')) === 80 && num(v('J22')) === 90, JSON.stringify([v('D22'), v('I22'), v('J22')]));
  check('furnizori: pe scurt', num(v('P2')) === 3 && num(v('P3')) === 1 && num(v('P4')) === 1 && num(v('P5')) === 1 && num(v('P6')) === 79 && v('P7')?.text === 'Alfa', JSON.stringify([v('P2'), v('P3'), v('P5'), v('P6'), v('P7')]));
  const w = calc(sh, { ...put, E4: '30' });
  check('furnizori: la termen nu trece de 100%', num(w('I4')) === 100, JSON.stringify(w('I4')));
}

// 04.11: Necesar de aprovizionare: cafea 20 în stoc, 60 pe lună, livrare 10 zile + 5 de siguranță, 30 lei; zahăr 200; ceai 0 în stoc.
{
  const sh = sheetOf('aprovizionare');
  check('aprovizionare: capul de tabel', sh.cells.A1 === 'Nr.' && sh.cells.K1 === 'Punctul de comandă' && sh.cells.Q1 === 'Pe scurt' && sh.lists?.length === 1 && sh.rules?.length === 3);
  const put = { B2: 'Cafea', E2: '20', G2: '60', H2: '10', I2: '5', M2: '30', B3: 'Zahăr', E3: '200', G3: '60', H3: '10', I3: '5', M3: '5', B4: 'Ceai', E4: '0', G4: '15', H4: '7', I4: '3', M4: '8' };
  const v = calc(sh, put);
  check('aprovizionare: punctul de comandă și cantitatea', num(v('K2')) === 30 && num(v('L2')) === 70 && num(v('N2')) === 2100 && num(v('J2')) === 10 && num(v('L3')) === 0 && num(v('J3')) === 100 && num(v('K4')) === 5 && num(v('L4')) === 20, JSON.stringify([v('K2'), v('L2'), v('N2'), v('J2'), v('L3'), v('J3'), v('K4'), v('L4')]));
  check('aprovizionare: starea', v('O2')?.text === 'De comandat' && v('O3')?.text === 'Suficient' && v('O4')?.text === 'Lipsă din stoc', JSON.stringify([v('O2'), v('O3'), v('O4')]));
  check('aprovizionare: pe scurt', num(v('R2')) === 3 && num(v('R3')) === 2 && num(v('R4')) === 1 && num(v('R5')) === 2260 && num(v('R6')) === 0, JSON.stringify([v('R2'), v('R3'), v('R4'), v('R5'), v('R6')]));
  const w = calc(sh, { ...put, F2: '80' });
  check('aprovizionare: ce e pe drum ajunge', num(w('L2')) === 0 && w('O2')?.text === 'Suficient', JSON.stringify([w('L2'), w('O2')]));
}

// 04.11: Garanțiile gestionarilor: Ion 5000 lei, 1000 depuși + 500 pe lună × 4 luni; Ana 3000, 3000 depuși; Dan 2000, nimic încă.
{
  const sh = sheetOf('garantiigest');
  check('garanțiile gestionarilor: capul de tabel', sh.cells.A1 === 'Nr.' && sh.cells.I1 === 'Constituit până acum' && sh.cells.O1 === 'Pe scurt' && sh.rules?.length === 3);
  const put = { B2: 'Ion', E2: '5000', F2: '1000', G2: '500', H2: '4', B3: 'Ana', E3: '3000', F3: '3000', B4: 'Dan', E4: '2000' };
  const v = calc(sh, put);
  check('garanțiile gestionarilor: constituit, rămas, luni', num(v('I2')) === 3000 && num(v('J2')) === 2000 && num(v('K2')) === 4 && num(v('I3')) === 3000 && num(v('J3')) === 0 && num(v('K3')) === 0 && num(v('J4')) === 2000, JSON.stringify([v('I2'), v('J2'), v('K2'), v('I3'), v('J3'), v('K3'), v('J4')]));
  check('garanțiile gestionarilor: starea', v('M2')?.text === 'În curs' && v('M3')?.text === 'Constituită' && v('M4')?.text === 'Neîncepută', JSON.stringify([v('M2'), v('M3'), v('M4')]));
  check('garanțiile gestionarilor: pe scurt', num(v('P2')) === 3 && num(v('P3')) === 1 && num(v('P4')) === 1 && num(v('P5')) === 1 && num(v('P6')) === 10000 && num(v('P7')) === 6000 && num(v('P8')) === 4000, JSON.stringify([v('P2'), v('P3'), v('P4'), v('P5'), v('P6'), v('P7'), v('P8')]));
  const w = calc(sh, { ...put, H2: '10' });
  check('garanțiile gestionarilor: nu trece de suma stabilită', num(w('I2')) === 5000 && w('M2')?.text === 'Constituită', JSON.stringify([w('I2'), w('M2')]));
}

// 04.11: Perisabilități: făină 1000 kg ieșite, cota 0,5%, lipsă 3 kg la 2 lei; zahăr 200 kg, cota 0,2%, lipsă 1 kg la 5 lei.
{
  const sh = sheetOf('perisabilitati');
  check('perisabilități: capul de tabel', sh.cells.A1 === 'Nr.' && sh.cells.G1 === 'Lipsa admisă' && sh.cells.O1 === 'Inventarul' && sh.lists?.length === 2 && sh.rules?.length === 3);
  const put = { B2: 'Făină', E2: '1000', F2: '0.5', H2: '3', J2: '2', B3: 'Zahăr', E3: '200', F3: '0.2', H3: '1', J3: '5' };
  const v = calc(sh, put);
  check('perisabilități: lipsa admisă și peste normă', num(v('G2')) === 5 && num(v('I2')) === 0 && num(v('G3')) === 0.4 && Math.abs(num(v('I3')) - 0.6) < 1e-9, JSON.stringify([v('G2'), v('I2'), v('G3'), v('I3')]));
  check('perisabilități: valorile în lei', num(v('K2')) === 6 && num(v('L2')) === 0 && num(v('K3')) === 2 && num(v('L3')) === 3, JSON.stringify([v('K2'), v('L2'), v('K3'), v('L3')]));
  check('perisabilități: pe scurt', num(v('P9')) === 2 && num(v('P10')) === 1 && num(v('P11')) === 8 && num(v('P12')) === 3 && v('P13')?.text === 'De imputat', JSON.stringify([v('P9'), v('P10'), v('P11'), v('P12'), v('P13')]));
  const w = calc(sh, { ...put, H3: '0.3' });
  check('perisabilități: în limita normei', w('P13')?.text === 'În limita normei' && num(w('P12')) === 0, JSON.stringify([w('P13'), w('P12')]));
}

// 04.11: Bon de transfer: cafea 10 trimise / 9 primite la 30 lei, zahăr 20 / 20 la 5 lei; apoi ceaiul încă neprimit.
{
  const sh = sheetOf('bontransfer');
  check('bon de transfer: capul de tabel', sh.cells.A1 === 'Nr.' && sh.cells.G1 === 'Diferența' && sh.cells.M1 === 'Transferul' && sh.lists?.length === 1 && sh.rules?.length === 5);
  const put = { C2: 'Cafea', E2: '10', F2: '9', H2: '30', C3: 'Zahăr', E3: '20', F3: '20', H3: '5' };
  const v = calc(sh, put);
  check('bon de transfer: diferențe și valori', num(v('G2')) === -1 && num(v('G3')) === 0 && num(v('I2')) === 300 && num(v('J2')) === -30 && num(v('I3')) === 100, JSON.stringify([v('G2'), v('G3'), v('I2'), v('J2'), v('I3')]));
  check('bon de transfer: pe scurt', num(v('N11')) === 2 && num(v('N12')) === 1 && num(v('N13')) === 0 && num(v('N14')) === 400 && num(v('N15')) === 30, JSON.stringify([v('N11'), v('N12'), v('N13'), v('N14'), v('N15')]));
  check('bon de transfer: primit cu diferențe', v('N16')?.text === 'Primit cu diferențe', JSON.stringify(v('N16')));
  const w = calc(sh, { ...put, F2: '10' });
  check('bon de transfer: primit complet', w('N16')?.text === 'Primit complet', JSON.stringify(w('N16')));
  const z = calc(sh, { ...put, F2: '10', C4: 'Ceai', E4: '5', H4: '8' });
  check('bon de transfer: neprimit încă', z('N16')?.text === 'Neprimit încă', JSON.stringify(z('N16')));
}

// 04.11: Bon de consum: vopsea 10 cerute / 8 date la 25 lei, diluant 5 / 5 la 12 lei, pensule 4 cerute / 4 date fără preț.
{
  const sh = sheetOf('bonconsum');
  check('bon de consum: capul de tabel', sh.cells.A1 === 'Nr.' && sh.cells.G1 === 'Neeliberat' && sh.cells.L1 === 'Bonul' && sh.lists?.length === 1 && sh.rules?.length === 1);
  const v = calc(sh, { C2: 'Vopsea', E2: '10', F2: '8', H2: '25', C3: 'Diluant', E3: '5', F3: '5', H3: '12', C5: 'Pensule', E5: '4', F5: '4' });
  check('bon de consum: neeliberat și valoarea pe rând', num(v('G2')) === 2 && num(v('G3')) === 0 && num(v('I2')) === 200 && num(v('I3')) === 60 && !num(v('I5')), JSON.stringify([v('G2'), v('G3'), v('I2'), v('I3'), v('I5')]));
  check('bon de consum: rândul gol fără număr', !num(v('A4')) && num(v('A5')) === 4, JSON.stringify([v('A4'), v('A5')]));
  check('bon de consum: pe scurt', num(v('M12')) === 3 && num(v('M13')) === 1 && num(v('M14')) === 50 && num(v('M15')) === 260, JSON.stringify([v('M12'), v('M13'), v('M14'), v('M15')]));
}

// 04.11: Fișa de magazie: stoc inițial 10, intră 50, ies 20 și 35 (cu un rând gol între ele), minim 10, preț 4 lei.
{
  const sh = sheetOf('fisamagazie');
  check('fișa de magazie: capul de tabel', sh.cells.A1 === 'Nr.' && sh.cells.H1 === 'Stocul' && sh.cells.K1 === 'Produsul' && sh.lists?.length === 2 && sh.rules?.length === 4);
  const put = { L6: '10', L7: '10', L8: '4', B2: '46000', F2: '50', G3: '20', G5: '35' };
  const v = calc(sh, put);
  check('fișa de magazie: stocul după fiecare mișcare', num(v('H2')) === 60 && num(v('H3')) === 40 && num(v('H5')) === 5, JSON.stringify([v('H2'), v('H3'), v('H5')]));
  check('fișa de magazie: rândul gol fără număr și fără stoc', !num(v('A4')) && !num(v('H4')) && num(v('A5')) === 4, JSON.stringify([v('A4'), v('H4'), v('A5')]));
  check('fișa de magazie: totaluri și valoare', num(v('L11')) === 3 && num(v('L12')) === 50 && num(v('L13')) === 55 && num(v('L14')) === 5 && num(v('L15')) === 20, JSON.stringify([v('L11'), v('L12'), v('L13'), v('L14'), v('L15')]));
  check('fișa de magazie: de comandat sub minim', v('L17')?.text === 'De comandat', JSON.stringify(v('L17')));
  const w = calc(sh, { ...put, L7: '' });
  check('fișa de magazie: suficient fără minim', w('L17')?.text === 'Suficient', JSON.stringify(w('L17')));
  const z = calc(sh, { ...put, G6: '10' });
  check('fișa de magazie: stoc negativ', num(z('H6')) === -5 && z('L17')?.text === 'Stoc negativ: verifică', JSON.stringify([z('H6'), z('L17')]));
}

// 04.11: Penalități de întârziere: 0,1% pe zi, cel mult cât suma; dobânda BNR 6,5% + 8 puncte; euro 5 lei; calcul până la 47500.
// A: 10.000 plătiți cu 30 de zile târziu; B: 1.000 neplătiți de 1.500 de zile (penalitatea oprită la 1.000); C: plătită înainte de scadență.
{
  const sh = sheetOf('penalitati');
  check('penalități: capul de tabel', sh.cells.A1 === 'Nr.' && sh.cells.G1 === 'Zile de întârziere' && sh.cells.K1 === 'De cerut' && sh.cells.N1 === 'Reglaje' && sh.rules?.length === 2 && sh.lists?.length === 1);
  const put = {
    O4: '0,065', O6: '5', O7: '47500',
    B2: 'Client A', D2: '46000', E2: '10000', F2: '46030',
    B3: 'Client B', D3: '46000', E3: '1000',
    B4: 'Client C', D4: '46100', E4: '300', F4: '46050',
  };
  const v = calc(sh, put);
  check('penalități: zilele și penalitățile', num(v('G2')) === 30 && num(v('H2')) === 300 && num(v('I2')) === 119.18 && num(v('J2')) === 200 && num(v('K2')) === 500 && num(v('L2')) === 500 && num(v('A3')) === 2,
    JSON.stringify(['G2', 'H2', 'I2', 'J2', 'K2', 'L2', 'A3'].map(v)));
  check('penalități: plafonul și factura la timp', num(v('G3')) === 1500 && num(v('H3')) === 1000 && num(v('K3')) === 1200 && num(v('L3')) === 2200 && num(v('G4')) === 0 && num(v('J4')) === 0 && num(v('L4')) === 0 && v('G5')?.text === '',
    JSON.stringify(['G3', 'H3', 'K3', 'L3', 'G4', 'J4', 'L4', 'G5'].map(v)));
  check('penalități: pe scurt', num(v('O11')) === 2 && num(v('O12')) === 1000 && num(v('O13')) === 1300 && num(v('O14')) === 400 && num(v('O15')) === 2700 && num(v('O16')) === 1500 && v('O8')?.text === 'Penalitățile din contract',
    JSON.stringify(['O11', 'O12', 'O13', 'O14', 'O15', 'O16', 'O8'].map(v)));
  const v2 = calc(sh, { ...put, O2: '0', O3: 'Nu' });
  check('penalități: fără clauză = dobânda legală', num(v2('K2')) === 319.18 && num(v2('O13')) === num(v2('I42')) && v2('O8')?.text === 'Dobânda legală', JSON.stringify(['K2', 'O13', 'I42', 'O8'].map(v2)));
  const v3 = calc(sh, { ...put, O3: 'Nu' });
  check('penalități: fără plafon', num(v3('H3')) === 1500, JSON.stringify(v3('H3')));
}

// 04.11: Evidența sponsorizărilor: cifra de afaceri 1.000.000 și impozitul 10.000 (plafonul e 2.000, din impozit); o sponsorizare
// încheiată (1.500), una plătită fără dovadă (1.000), una cu beneficiar care nu e în registru (500) și una neplătită (300).
{
  const sh = sheetOf('sponsorizari');
  check('sponsorizări: capul de tabel', sh.cells.A1 === 'Nr.' && sh.cells.I1 === 'În registrul ANAF' && sh.cells.L1 === 'Starea' && sh.cells.N1 === 'Cât se scade din impozit' && sh.rules?.length === 3 && sh.lists?.length === 3);
  const v = calc(sh, {
    O2: '1000000', O3: '10000',
    D2: 'Asociația A', H2: '1500', I2: 'Da', J2: '46000', K2: 'Da',
    D3: 'Clubul B', H3: '1000', I3: 'Da', J3: '46010',
    D4: 'Fundația C', H4: '500', I4: 'Nu', J4: '46020', K4: 'Da',
    D5: 'Școala D', H5: '300', I5: 'Da',
  });
  check('sponsorizări: starea', v('L2')?.text === 'Încheiat' && v('L3')?.text === 'Așteaptă dovada' && v('L4')?.text === 'Nu se scade' && v('L5')?.text === 'De plătit' && v('L6')?.text === '' && num(v('A5')) === 4,
    JSON.stringify(['L2', 'L3', 'L4', 'L5', 'L6', 'A5'].map(v)));
  check('sponsorizări: plafonul și ce se scade', num(v('O6')) === 2000 && num(v('O7')) === 2500 && num(v('O8')) === 2000 && num(v('O9')) === 500 && num(v('O10')) === 8000,
    JSON.stringify(['O6', 'O7', 'O8', 'O9', 'O10'].map(v)));
  check('sponsorizări: pe scurt', num(v('O13')) === 4 && num(v('O14')) === 3300 && num(v('O15')) === 300 && num(v('O16')) === 1 && num(v('O17')) === 500,
    JSON.stringify(['O13', 'O14', 'O15', 'O16', 'O17'].map(v)));
  const v2 = calc(sh, { O2: '100000', O3: '50000', D2: 'A', H2: '600', I2: 'Da', J2: '46000' });
  check('sponsorizări: plafonul din cifra de afaceri', num(v2('O6')) === 750 && num(v2('O8')) === 600 && num(v2('O9')) === 0, JSON.stringify(['O6', 'O8', 'O9'].map(v2)));
}

// 04.11: Registrul asociaților: Ana (60 părți, 600 lei) și Ion (40 părți, 400 lei) de la înființare; Ion își cedează părțile
// lui Dan (rândul lui Ion are data ieșirii, Dan intră cu 40 de părți); capitalul din actul constitutiv 1000 lei, apoi greșit 1200.
{
  const sh = sheetOf('asociati');
  check('asociați: capul de tabel', sh.cells.A1 === 'Nr.' && sh.cells.I1 === 'Din capital' && sh.cells.K1 === 'Starea' && sh.cells.N1 === 'Pe scurt' && sh.rules?.length === 3 && sh.lists?.length === 1);
  const put = { B2: 'Ana', G2: '600', H2: '60', B3: 'Ion', G3: '400', H3: '40', J3: '46000', B4: 'Dan', G4: '400', H4: '40', F4: 'Cesiune de părți sociale', O6: '1000' };
  const v = calc(sh, put);
  check('asociați: starea și procentul', v('K2')?.text === 'Asociat' && v('K3')?.text === 'Ieșit' && num(v('I2')) === 0.6 && v('I3')?.text === '' && num(v('I4')) === 0.4 && num(v('A4')) === 3 && v('K5')?.text === '',
    JSON.stringify(['K2', 'K3', 'I2', 'I3', 'I4', 'A4', 'K5'].map(v)));
  check('asociați: pe scurt', num(v('O2')) === 2 && num(v('O3')) === 1 && num(v('O4')) === 100 && num(v('O5')) === 1000 && num(v('O7')) === 0 && num(v('O8')) === 10 && Math.abs(num(v('O9')) - 1) < 1e-9,
    JSON.stringify(['O2', 'O3', 'O4', 'O5', 'O7', 'O8', 'O9'].map(v)));
  const v2 = calc(sh, { ...put, O6: '1200' });
  check('asociați: diferența față de actul constitutiv', num(v2('O7')) === -200 && num(v2('O8')) === 12, JSON.stringify(['O7', 'O8'].map(v2)));
}

// 04.11: Repartizarea profitului: profit înainte de impozit 120000, net 100000, capital 200 lei (rezerva legală plafonată la 40),
// 10000 rămân în firmă; doi asociați cu 60 și 40 de părți, primul plătit pe 15.03.2026.
{
  const sh = sheetOf('dividende');
  check('dividende: capul de tabel', sh.cells.A1 === 'Nr.' && sh.cells.D1 === 'Procent din capital' && sh.cells.J1 === 'Starea' && sh.cells.L1 === 'Profitul de repartizat' && sh.rules?.length === 3);
  const paid = num(calc(sh, { Z1: '=DATE(2026;3;15)' })('Z1'));
  const v = calc(sh, { M2: '120000', M3: '100000', M4: '200', M5: '0', M8: '10000', B2: 'Ana', C2: '60', H2: String(paid), B3: 'Ion', C3: '40' });
  check('dividende: rezerva și profitul împărțit', num(v('M6')) === 40 && num(v('M9')) === 89960 && num(v('M11')) === 2, JSON.stringify(['M6', 'M9', 'M11'].map(v)));
  check('dividende: pe asociați', num(v('D2')) === 0.6 && num(v('E2')) === 53976 && num(v('F2')) === 8636.16 && num(v('G2')) === 45339.84 && num(v('E3')) === 35984 && v('J2')?.text === 'Plătit' && v('J3')?.text === 'De plătit' && num(v('A3')) === 2 && v('J4')?.text === '',
    JSON.stringify(['D2', 'E2', 'F2', 'G2', 'E3', 'J2', 'J3', 'A3', 'J4'].map(v)));
  const due = num(calc(sh, { Z1: '=DATE(2026;4;25)' })('Z1'));
  check('dividende: termenul impozitului', num(v('I2')) === due && v('I3')?.text === '', JSON.stringify([v('I2'), due]));
  check('dividende: pe scurt', num(v('M14')) === 2 && Math.abs(num(v('M15')) - 1) < 1e-9 && num(v('M16')) === 89960 && Math.abs(num(v('M19')) - 45339.84) < 0.001 && Math.abs(num(v('M20')) - (89960 - num(v('M17')) - 45339.84)) < 0.001,
    JSON.stringify(['M14', 'M15', 'M16', 'M17', 'M18', 'M19', 'M20'].map(v)));
  const v2 = calc(sh, { M2: '1000', M3: '840', B2: 'Ana', C2: '1' });
  check('dividende: fără capital, rezerva e 5%', num(v2('M6')) === 50 && num(v2('M9')) === 790, JSON.stringify(['M6', 'M9'].map(v2)));
}

// 04.11: Termenele de protecția muncii: o instruire făcută acum 2 luni la 6 luni (la zi), un control medical făcut acum 13 luni
// la 12 luni (expirat), un stingător care expiră în cel mult 30 de zile, o trusă fără dată.
{
  const sh = sheetOf('termenessm');
  const today = num(calc(sh, { Z1: '=TODAY()' })('Z1'));
  const ed = (m) => num(calc(sh, { Z1: `=EDATE(TODAY();${m})` })('Z1'));
  check('protecția muncii: capul de tabel', sh.cells.A1 === 'Nr.' && sh.cells.F1 === 'Următoarea' && sh.cells.H1 === 'Starea' && sh.cells.L1 === 'Pe scurt' && sh.rules?.length === 3 && sh.lists?.length === 1);
  const d3 = ed(-12) + 10;
  const v = calc(sh, {
    B2: 'Instruire periodică', D2: String(ed(-2)), E2: '6',
    B3: 'Control medical', D3: String(ed(-13)), E3: '12',
    B4: 'Stingător', D4: String(d3), E4: '12',
    B5: 'Trusa de prim ajutor',
  });
  check('protecția muncii: data următoare, zilele și starea', num(v('F2')) === ed(4) && v('H2')?.text === 'La zi' && num(v('G3')) < 0 && v('H3')?.text === 'Expirat' && num(v('G4')) >= 0 && num(v('G4')) <= 30 && v('H4')?.text === 'În curând' && v('H5')?.text === 'Fără dată' && num(v('A5')) === 4 && v('H6')?.text === '',
    JSON.stringify(['F2', 'H2', 'G3', 'H3', 'G4', 'H4', 'H5', 'A5', 'H6'].map(v)) + ' ' + today);
  check('protecția muncii: pe scurt', num(v('M2')) === 4 && num(v('M3')) === 1 && num(v('M4')) === 1 && num(v('M5')) === 1 && num(v('M6')) === 1, JSON.stringify(['M2', 'M3', 'M4', 'M5', 'M6'].map(v)));
}

// 03.11: Registrul reclamațiilor: una închisă după 6 zile, una deschisă cu termenul trecut, una deschisă cu 3 zile rămase,
// una deschisă cu termen lung, una închisă după 10 zile (nejustificată).
{
  const sh = sheetOf('reclamatii');
  const today = num(calc(sh, { Z1: '=TODAY()' })('Z1'));
  check('reclamații: capul de tabel', sh.cells.A1 === 'Nr.' && sh.cells.G1 === 'Cauza' && sh.cells.L1 === 'Zile până la termen' && sh.cells.O1 === 'Pe scurt' && sh.rules?.length === 3 && sh.lists?.length === 2);
  const v = calc(sh, {
    B2: String(today - 20), C2: 'Alfa', G2: 'Transport', H2: 'Înlocuire', J2: String(today - 14),
    B3: String(today - 35), C3: 'Beta', G3: 'Produs defect',
    B4: String(today - 27), C4: 'Gama', G4: 'Greșeala noastră',
    B5: String(today - 2), C5: 'Delta',
    B6: String(today - 12), C6: 'Epsilon', G6: 'Nejustificată', H6: 'Respinsă', J6: String(today - 2),
  });
  check('reclamații: termenul, zilele și starea', num(v('I3')) === today - 5 && num(v('K2')) === 6 && num(v('K6')) === 10 && v('L2')?.text === '' && num(v('L3')) === -5 && num(v('L4')) === 3 && num(v('L5')) === 28 && v('M2')?.text === 'Închisă' && v('M3')?.text === 'Deschisă' && num(v('A6')) === 5,
    JSON.stringify(['I3', 'K2', 'K6', 'L2', 'L3', 'L4', 'L5', 'M2', 'M3', 'A6'].map(v)));
  check('reclamații: pe scurt', num(v('P2')) === 5 && num(v('P3')) === 2 && num(v('P4')) === 3 && num(v('P5')) === 1 && num(v('P6')) === 8 && Math.abs(num(v('P7')) - 0.4) < 1e-9 && num(v('P8')) === 1,
    JSON.stringify(['P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'].map(v)));
}

// 03.11: Planul vizitelor la clienți: o vizită cu comandă și următoarea peste 3 zile, una cu ofertă cerută și următoarea întârziată,
// una de revenit peste 20 de zile, una fără rezultat și fără altă vizită.
{
  const sh = sheetOf('vizite');
  const today = num(calc(sh, { Z1: '=TODAY()' })('Z1'));
  check('vizite: capul de tabel', sh.cells.A1 === 'Nr.' && sh.cells.G1 === 'Rezultatul' && sh.cells.J1 === 'Zile până atunci' && sh.cells.L1 === 'Pe scurt' && sh.rules?.length === 3 && sh.lists?.length === 2);
  const v = calc(sh, {
    B2: String(today - 10), C2: 'Ana', D2: 'Alfa', G2: 'Comandă', H2: '3000', I2: String(today + 3),
    B3: String(today - 20), C3: 'Ana', D3: 'Beta', G3: 'Ofertă cerută', I3: String(today - 2),
    B4: String(today - 5), C4: 'Bogdan', D4: 'Gama', G4: 'De revenit', I4: String(today + 20),
    B5: String(today - 1), C5: 'Bogdan', D5: 'Delta', G5: 'Fără rezultat',
    B6: String(today - 1), C6: 'Bogdan', D6: 'Epsilon', G6: 'Comandă', H6: '1000',
  });
  check('vizite: zilele până la următoarea vizită', num(v('J2')) === 3 && num(v('J3')) === -2 && num(v('J4')) === 20 && v('J5')?.text === '' && num(v('A6')) === 5,
    JSON.stringify(['J2', 'J3', 'J4', 'J5', 'A6'].map(v)));
  check('vizite: pe scurt', num(v('M2')) === 5 && num(v('M3')) === 2 && Math.abs(num(v('M4')) - 0.4) < 1e-9 && num(v('M5')) === 4000 && num(v('M6')) === 2000 && num(v('M7')) === 2 && num(v('M8')) === 1,
    JSON.stringify(['M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8'].map(v)));
}

// 03.11: Comisioanele agenților: unul sub țintă (3%), unul la țintă (5%), unul peste 120% (5% + bonus 500), unul sub 80%, unul fără țintă.
{
  const sh = sheetOf('comisioane');
  check('comisioane: capul de tabel', sh.cells.A1 === 'Nr.' && sh.cells.F1 === 'Realizare' && sh.cells.J1 === 'Total de plată' && sh.cells.M1 === 'Regulile comisionului' && sh.rules?.length === 2);
  const v = calc(sh, {
    B2: 'Ana', D2: '9000', E2: '10000',
    B3: 'Bogdan', D3: '10000', E3: '10000',
    B4: 'Cristi', D4: '13000', E4: '10000',
    B5: 'Dana', D5: '5000', E5: '10000',
    B6: 'Elena', D6: '2000',
  });
  check('comisioane: procent, comision, bonus', num(v('G2')) === 0.03 && num(v('H2')) === 270 && num(v('J2')) === 270 && num(v('G3')) === 0.05 && num(v('H3')) === 500 && v('I3')?.text === '' && num(v('I4')) === 500 && num(v('J4')) === 1150 && num(v('J5')) === 150 && v('F6')?.text === '' && num(v('J6')) === 60 && num(v('A6')) === 5,
    JSON.stringify(['G2', 'H2', 'J2', 'G3', 'H3', 'I3', 'I4', 'J4', 'J5', 'F6', 'J6', 'A6'].map(v)));
  check('comisioane: pe scurt', num(v('N8')) === 39000 && Math.abs(num(v('N9')) - 0.925) < 1e-9 && num(v('N10')) === 2 && num(v('N11')) === 1 && num(v('N12')) === 2130 && Math.abs(num(v('N13')) - 2130 / 39000) < 1e-9,
    JSON.stringify(['N8', 'N9', 'N10', 'N11', 'N12', 'N13'].map(v)));
}

// 03.11: Vechimea creanțelor: o factură nescadentă, una întârziată 10 zile, una 45, una 75, una 120, una încasată complet.
{
  const sh = sheetOf('creante');
  const today = num(calc(sh, { Z1: '=TODAY()' })('Z1'));
  check('creanțe: capul de tabel', sh.cells.A1 === 'Nr.' && sh.cells.H1 === 'Rest de încasat' && sh.cells.N1 === 'Peste 90 zile' && sh.cells.P1 === 'Pe scurt' && sh.rules?.length === 3);
  const v = calc(sh, {
    B2: 'Alfa', F2: '1000', G2: '0', E2: String(today + 5),
    B3: 'Beta', F3: '500', G3: '100', E3: String(today - 10),
    B4: 'Gama', F4: '300', E4: String(today - 45),
    B5: 'Delta', F5: '200', G5: '50', E5: String(today - 75),
    B6: 'Epsilon', F6: '600', E6: String(today - 120),
    B7: 'Zeta', F7: '400', G7: '400', E7: String(today - 200),
  });
  check('creanțe: grupele', num(v('J2')) === 1000 && num(v('K3')) === 400 && num(v('I3')) === 10 && num(v('L4')) === 300 && num(v('M5')) === 150 && num(v('N6')) === 600 && v('I7')?.text === '' && v('N7')?.text === '' && num(v('A7')) === 6,
    JSON.stringify(['J2', 'K3', 'I3', 'L4', 'M5', 'N6', 'I7', 'N7', 'A7'].map(v)));
  check('creanțe: pe scurt', num(v('Q2')) === 2450 && num(v('Q3')) === 1000 && num(v('Q7')) === 600 && num(v('Q8')) === 4 && num(v('Q9')) === 120 && Math.abs(num(v('R7')) - 600 / 2450) < 1e-9,
    JSON.stringify(['Q2', 'Q3', 'Q7', 'Q8', 'Q9', 'R7'].map(v)));
}

// 03.11: Urmărirea obiectivelor: vânzări de la 100 la 200 (realizat 150), costuri de la 100 la 80 (realizat 80, atins),
// un obiectiv cu termenul trecut, unul abia început și rămas în urmă, unul fără date.
{
  const sh = sheetOf('obiective');
  const today = num(calc(sh, { Z1: '=TODAY()' })('Z1'));
  check('obiective: capul de tabel', sh.cells.A1 === 'Nr.' && sh.cells.G1 === 'Progres' && sh.cells.L1 === 'Starea' && sh.cells.N1 === 'Pe scurt' && sh.rules?.length === 3);
  const v = calc(sh, {
    B2: 'Vânzări', D2: '100', E2: '200', F2: '150', I2: String(today - 100), J2: String(today + 100),
    B3: 'Costuri', D3: '100', E3: '80', F3: '80', I3: String(today - 100), J3: String(today + 100),
    B4: 'Clienți noi', D4: '0', E4: '10', F4: '5', I4: String(today - 200), J4: String(today - 1),
    B5: 'Site nou', D5: '0', E5: '100', F5: '10', I5: String(today - 90), J5: String(today + 10),
    B6: 'Instruiri',
  });
  check('obiective: progresul și starea', num(v('G2')) === 0.5 && v('L2')?.text === 'Pe drum' && num(v('G3')) === 1 && v('L3')?.text === 'Atins' && num(v('G4')) === 0.5 && v('L4')?.text === 'Întârziat' && num(v('K5')) === 0.9 && v('L5')?.text === 'În urmă' && v('L6')?.text === 'Fără date' && v('L7')?.text === '' && num(v('A6')) === 5,
    JSON.stringify(['G2', 'L2', 'G3', 'L3', 'G4', 'L4', 'K5', 'L5', 'L6', 'L7', 'A6'].map(v)));
  check('obiective: pe scurt', num(v('O2')) === 5 && num(v('O3')) === 1 && num(v('O4')) === 1 && num(v('O5')) === 1 && num(v('O6')) === 1 && num(v('O7')) === 1 && Math.abs(num(v('O8')) - 0.525) < 1e-9,
    JSON.stringify(['O2', 'O3', 'O4', 'O5', 'O6', 'O7', 'O8'].map(v)));
}

// 03.11: Evidența arhivei: un dosar vechi de eliminat, unul păstrat, unul permanent, unul eliminat deja și unul fără termen.
{
  const sh = sheetOf('arhiva');
  const y = new Date().getFullYear();
  check('arhiva: capul de tabel', sh.cells.A1 === 'Nr.' && sh.cells.E1 === 'Se păstrează (ani)' && sh.cells.I1 === 'Starea' && sh.cells.L1 === 'Pe scurt' && sh.rules?.length === 3);
  const v = calc(sh, {
    B2: 'Facturi 2015', D2: '2015', E2: '5', G2: '120',
    B3: 'Facturi', D3: String(y - 1), E3: '10', G3: '80',
    B4: 'Registrul de procese-verbale', D4: '2020', E4: 'Permanent', G4: '50',
    B5: 'Corespondență 2010', D5: '2010', E5: '3', G5: '30', J5: 'Da',
    B6: 'Diverse', D6: '2022',
  });
  check('arhiva: anul de eliminare și starea', num(v('H2')) === 2021 && v('I2')?.text === 'De eliminat' && num(v('H3')) === y + 10 && v('I3')?.text === 'Păstrat' && v('H4')?.text === 'Permanent' && v('I4')?.text === 'Permanent' && v('I5')?.text === 'Eliminat' && v('I6')?.text === 'Fără termen' && v('I7')?.text === '' && num(v('A6')) === 5,
    JSON.stringify(['H2', 'I2', 'H3', 'I3', 'H4', 'I4', 'I5', 'I6', 'I7', 'A6'].map(v)));
  check('arhiva: pe scurt', num(v('M2')) === 5 && num(v('M3')) === 1 && num(v('M4')) === 1 && num(v('M5')) === 1 && num(v('M6')) === 1 && num(v('M7')) === 1 && num(v('M8')) === 250,
    JSON.stringify(['M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8'].map(v)));
}

// 03.11: Notă de recepție: hârtia vine întreagă, la toner lipsesc 2, la plicuri sunt 5 în plus.
{
  const sh = sheetOf('receptie');
  check('receptie: capul de tabel', sh.cells.A1 === 'Nr.' && sh.cells.D1 === 'Cantitatea din factură' && sh.cells.E1 === 'Cantitatea recepționată' && sh.cells.M1 === 'Pe scurt' && sh.rules?.length === 2);
  const v = calc(sh, {
    N5: '0,21',
    B2: 'Hârtie A4', D2: '10', E2: '10', G2: '20',
    B3: 'Toner', D3: '5', E3: '3', G3: '300',
    B4: 'Plicuri', D4: '100', E4: '105', G4: '1',
  });
  check('receptie: diferențele pe rând', num(v('A4')) === 3 && v('A5')?.text === '' && num(v('F2')) === 0 && num(v('F3')) === -2 && num(v('F4')) === 5 && num(v('J3')) === -600 && num(v('I4')) === 105 && v('F5')?.text === '',
    JSON.stringify(['A4', 'A5', 'F2', 'F3', 'F4', 'J3', 'I4', 'F5'].map(v)));
  check('receptie: totaluri și pe scurt', num(v('H32')) === 1800 && num(v('I32')) === 1205 && num(v('J32')) === -595 && num(v('N6')) === 3 && num(v('N7')) === 1 && num(v('N8')) === 1 && num(v('N9')) === 600 && num(v('N11')) === 253.05 && num(v('N12')) === 1458.05 && num(v('N13')) === -719.95,
    JSON.stringify(['H32', 'I32', 'J32', 'N6', 'N7', 'N8', 'N9', 'N11', 'N12', 'N13'].map(v)));
}

// 03.11: Compararea ofertelor: trei produse; B nu are preț la al treilea, deci cea mai mică ofertă completă e între A și C.
{
  const sh = sheetOf('oferte');
  check('oferte: capul de tabel', sh.cells.A1 === 'Nr.' && sh.cells.E1 === 'Furnizor A' && sh.cells.J1 === 'Valoare la cel mai mic preț' && sh.cells.L1 === 'Pe scurt' && sh.rules?.length === 2);
  const v = calc(sh, {
    E1: 'Alfa SRL', F1: 'Beta SRL', G1: 'Gama SRL',
    B2: 'Hârtie A4', C2: '10', E2: '20', F2: '18', G2: '19',
    B3: 'Toner', C3: '2', E3: '300', F3: '280', G3: '310',
    B4: 'Scaun', C4: '1', E4: '500', G4: '450',
  });
  check('oferte: cel mai mic preț pe rând', num(v('A4')) === 3 && v('A5')?.text === '' && num(v('H2')) === 18 && v('I2')?.text === 'Beta SRL' && num(v('H4')) === 450 && v('I4')?.text === 'Gama SRL' && num(v('J3')) === 560 && v('H5')?.text === '',
    JSON.stringify(['A4', 'A5', 'H2', 'I2', 'H4', 'I4', 'J3', 'H5'].map(v)));
  check('oferte: totalurile și prețurile lipsă', num(v('E32')) === 1300 && num(v('F32')) === 740 && num(v('G32')) === 1260 && num(v('J32')) === 1190 && num(v('E33')) === 0 && num(v('F33')) === 1 && num(v('G33')) === 0,
    JSON.stringify(['E32', 'F32', 'G32', 'J32', 'E33', 'F33', 'G33'].map(v)));
  check('oferte: pe scurt', num(v('M2')) === 3 && num(v('M3')) === 1260 && v('M4')?.text === 'Gama SRL' && num(v('M5')) === 1190 && num(v('M6')) === 70,
    JSON.stringify(['M2', 'M3', 'M4', 'M5', 'M6'].map(v)));
}

// 03.11: Evidența contractelor: unul activ, unul de reînnoit (preaviz 60), unul expirat, unul prelungit automat, unul nedeterminat.
{
  const sh = sheetOf('contracte');
  check('contracte: capul de tabel', sh.cells.A1 === 'Nr.' && sh.cells.F1 === 'Sfârșit' && sh.cells.K1 === 'Stare' && sh.cells.M1 === 'Pe scurt' && sh.rules?.length === 3 && sh.lists?.some((l) => l.range === 'H2:H151'));
  const t = new Date(), today = Math.round((Date.UTC(t.getFullYear(), t.getMonth(), t.getDate()) - Date.UTC(1899, 11, 30)) / 864e5);
  const v = calc(sh, {
    B2: 'Client SRL', F2: String(today + 200), G2: '10000',
    B3: 'Proprietar', F3: String(today + 45), G3: '24000', I3: '60',
    B4: 'Asigurator SA', F4: String(today - 3), G4: '1500', H4: 'Nu',
    B5: 'Internet SRL', F5: String(today - 10), G5: '1200', H5: 'Da',
    B6: 'Contabil PFA', G6: '6000',
  });
  check('contracte: numerele, zilele și starea', num(v('A2')) === 1 && num(v('A6')) === 5 && v('A7')?.text === '' && num(v('J2')) === 200 && num(v('J4')) === -3 && v('J6')?.text === ''
    && v('K2')?.text === 'Activ' && v('K3')?.text === 'De reînnoit' && v('K4')?.text === 'Expirat' && v('K5')?.text === 'Prelungit automat' && v('K6')?.text === 'Nedeterminat' && v('K7')?.text === '',
    JSON.stringify(['A2', 'A6', 'A7', 'J2', 'J4', 'J6', 'K2', 'K3', 'K4', 'K5', 'K6', 'K7'].map(v)));
  check('contracte: pe scurt', num(v('N2')) === 4 && num(v('N3')) === 41200 && num(v('N4')) === 1 && num(v('N5')) === 1 && num(v('N6')) === 1, JSON.stringify(['N2', 'N3', 'N4', 'N5', 'N6'].map(v)));
}

// 03.11: Registrul de intrări-ieșiri: o intrare rezolvată, una întârziată, una cu termenul peste 2 zile, una ieșită fără termen.
{
  const sh = sheetOf('registratura');
  check('registratură: capul de tabel', sh.cells.A1 === 'Nr. înregistrare' && sh.cells.H1 === 'Termen de răspuns' && sh.cells.J1 === 'Stare' && sh.cells.L1 === 'Pe scurt' && sh.rules?.length === 3 && sh.lists?.some((l) => l.range === 'C2:C201') && sh.lists?.some((l) => l.range === 'I2:I201'));
  const t = new Date(), today = Math.round((Date.UTC(t.getFullYear(), t.getMonth(), t.getDate()) - Date.UTC(1899, 11, 30)) / 864e5);
  const v = calc(sh, {
    B2: String(today - 10), C2: 'Intrare', D2: 'Primăria', H2: String(today - 5), I2: 'Da',
    B3: String(today - 8), C3: 'Intrare', D3: 'ANAF', H3: String(today - 1), I3: 'Nu',
    B4: String(today - 1), C4: 'Intrare', D4: 'Client SRL', H4: String(today + 2),
    B5: String(today), C5: 'Ieșire', D5: 'Furnizor SRL',
  });
  check('registratură: numerele și starea', num(v('A2')) === 1 && num(v('A5')) === 4 && v('A6')?.text === '' && v('J2')?.text === 'Rezolvat' && v('J3')?.text === 'Întârziat' && v('J4')?.text === 'Termen aproape' && v('J5')?.text === 'Fără termen' && v('J6')?.text === '', JSON.stringify(['A2', 'A5', 'A6', 'J2', 'J3', 'J4', 'J5', 'J6'].map(v)));
  check('registratură: pe scurt', num(v('M2')) === t.getFullYear() && num(v('M3')) === 3 && num(v('M4')) === 1 && num(v('M5')) === 3 && num(v('M6')) === 1 && num(v('M7')) === 1, JSON.stringify(['M2', 'M3', 'M4', 'M5', 'M6', 'M7'].map(v)));
}

// 03.11, 12:52: Stat de plată: un angajat cu 6000 lei brut și 1000 avans, unul cu 4000 brut și 300 deducere; apoi un avans mai mare decât netul.
{
  const sh = sheetOf('statplata');
  check('stat de plată: capul de tabel', sh.cells.E1 === 'Salariu brut' && sh.cells.K1 === 'Salariu net' && sh.cells.M1 === 'Rest de plată' && sh.cells.O1 === 'Cost total' && sh.cells.Q1 === 'Setări și totaluri' && sh.rules?.length === 1);
  const v = calc(sh, { B2: 'Ana', E2: '6000', L2: '1000', B3: 'Ion', E3: '4000', H3: '300' });
  check('stat de plată: primul angajat', num(v('F2')) === 1500 && num(v('G2')) === 600 && num(v('I2')) === 3900 && num(v('J2')) === 390 && num(v('K2')) === 3510 && num(v('M2')) === 2510 && num(v('N2')) === 135 && num(v('O2')) === 6135 && num(v('A2')) === 1, JSON.stringify(['F2', 'G2', 'I2', 'J2', 'K2', 'M2', 'N2', 'O2', 'A2'].map(v)));
  check('stat de plată: cu deducere, fără avans', num(v('I3')) === 2300 && num(v('J3')) === 230 && num(v('K3')) === 2370 && num(v('M3')) === 2370 && num(v('N3')) === 90 && v('K4')?.text === '' && v('A4')?.text === '', JSON.stringify(['I3', 'J3', 'K3', 'M3', 'N3', 'K4', 'A4'].map(v)));
  check('stat de plată: totaluri', num(v('E42')) === 10000 && num(v('K42')) === 5880 && num(v('M42')) === 4880 && num(v('O42')) === 10225 && num(v('R7')) === 2 && num(v('R8')) === 4880 && num(v('R9')) === 4345 && num(v('R10')) === 10225, JSON.stringify(['E42', 'K42', 'M42', 'O42', 'R7', 'R8', 'R9', 'R10'].map(v)));
  const w = calc(sh, { B2: 'Dan', E2: '1000', L2: '2000' });
  check('stat de plată: avans mai mare decât netul', num(w('K2')) === 585 && num(w('M2')) === -1415 && formulaMatches?.length !== undefined, JSON.stringify(['K2', 'M2'].map(w)));
}

// 03.11, 12:40: Lista de inventariere: un articol cu plus, unul cu lipsă, unul care concordă și unul nenumărat.
{
  const sh = sheetOf('inventariere');
  check('inventariere: capul de tabel', sh.cells.E1 === 'Stoc scriptic' && sh.cells.F1 === 'Stoc faptic' && sh.cells.L1 === 'Rezultat' && sh.cells.N1 === 'Pe scurt' && sh.rules?.length === 2 && sh.lists?.some((l) => l.range === 'D2:D101'));
  const v = calc(sh, {
    B2: 'Șuruburi', E2: '100', F2: '110', G2: '0,5',
    B3: 'Vopsea', E3: '20', F3: '18', G3: '45,9',
    B4: 'Cutii', E4: '50', F4: '50', G4: '2',
    B5: 'Mănuși', E5: '30', G5: '3',
  });
  check('inventariere: plus', num(v('H2')) === 50 && num(v('I2')) === 55 && num(v('J2')) === 10 && num(v('K2')) === 5 && v('L2')?.text === 'Plus' && num(v('A2')) === 1, JSON.stringify(['H2', 'I2', 'J2', 'K2', 'L2', 'A2'].map(v)));
  check('inventariere: lipsă', num(v('H3')) === 918 && num(v('I3')) === 826.2 && num(v('J3')) === -2 && Math.abs(num(v('K3')) + 91.8) < 1e-9 && v('L3')?.text === 'Lipsă', JSON.stringify(['H3', 'I3', 'J3', 'K3', 'L3'].map(v)));
  check('inventariere: concordă / nenumărat', v('L4')?.text === 'Concordă' && num(v('K4')) === 0 && v('I5')?.text === '' && v('L5')?.text === '' && v('L6')?.text === '', JSON.stringify(['L4', 'K4', 'I5', 'L5', 'L6'].map(v)));
  check('inventariere: pe scurt', num(v('O4')) === 3 && num(v('O5')) === 1158 && num(v('O6')) === 981.2 && num(v('O7')) === 5 && Math.abs(num(v('O8')) - 91.8) < 1e-9 && Math.abs(num(v('O9')) + 86.8) < 1e-9 && num(v('O10')) === 2, JSON.stringify(['O4', 'O5', 'O6', 'O7', 'O8', 'O9', 'O10'].map(v)));
}
check('id-urile sunt diferite', new Set(TEMPLATES.map((t) => t.id)).size === TEMPLATES.length);

// 03.11, 12:25: Mijloace fixe la 3 noiembrie 2026: un laptop de 3600 lei pe 36 de luni (din iunie 2025), o mașină amortizată
// complet, un utilaj de 1000 lei pe 3 luni (ultima lună preia rotunjirea) și unul pus în funcțiune luna aceasta (neînceput).
{
  const sh = sheetOf('mijloacefixe');
  check('mijloace fixe: capul de tabel', sh.cells.B1 === 'Denumirea' && sh.cells.H1 === 'Amortizare lunară' && sh.cells.M1 === 'Stare' && sh.cells.O1 === 'Setări și totaluri' && sh.rules?.length === 2);
  const serial = (yy, mm, dd) => String(Math.round((Date.UTC(yy, mm - 1, dd) - Date.UTC(1899, 11, 30)) / 864e5));
  const put = {
    B2: 'Laptop', E2: serial(2025, 6, 10), F2: '3600', G2: '36',
    B3: 'Autoturism', E3: serial(2020, 1, 15), F3: '6000', G3: '60',
    B4: 'Utilaj', E4: serial(2026, 7, 20), F4: '1000', G4: '3',
    B5: 'Imprimantă', E5: serial(2026, 11, 1), F5: '1000', G5: '3',
  };
  const v = calc(sh, { ...put, P2: serial(2026, 11, 3) });
  check('mijloace fixe: laptopul în amortizare', num(v('H2')) === 100 && num(v('I2')) === 16 && num(v('J2')) === 1600 && num(v('K2')) === 2000 && num(v('L2')) === 1000 && v('M2')?.text === 'În amortizare', JSON.stringify(['H2', 'I2', 'J2', 'K2', 'L2', 'M2'].map(v)));
  check('mijloace fixe: mașina amortizată complet', num(v('I3')) === 60 && num(v('J3')) === 6000 && num(v('K3')) === 0 && num(v('L3')) === 0 && v('M3')?.text === 'Amortizat complet', JSON.stringify(['I3', 'J3', 'K3', 'L3', 'M3'].map(v)));
  check('mijloace fixe: rotunjirea în ultima lună', num(v('H4')) === 333.33 && num(v('I4')) === 3 && num(v('J4')) === 1000 && num(v('K4')) === 0 && num(v('L4')) === 1000, JSON.stringify(['H4', 'I4', 'J4', 'K4', 'L4'].map(v)));
  check('mijloace fixe: neînceput', num(v('I5')) === 0 && num(v('J5')) === 0 && num(v('K5')) === 1000 && v('M5')?.text === 'Neînceput' && v('M6')?.text === '' && v('A6')?.text === '', JSON.stringify(['I5', 'J5', 'K5', 'M5', 'M6', 'A6'].map(v)));
  check('mijloace fixe: totaluri', num(v('P3')) === 4 && num(v('P4')) === 11600 && num(v('P5')) === 8600 && num(v('P6')) === 3000 && num(v('P7')) === 2000 && num(v('P8')) === 100 && num(v('P9')) === 2, JSON.stringify(['P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9'].map(v)));
  const w = calc(sh, { ...put, P2: serial(2026, 11, 30) });
  check('mijloace fixe: la sfârșit de lună intră și luna curentă', num(w('I2')) === 17 && num(w('I5')) === 0, JSON.stringify(['I2', 'I5'].map(w)));
}

// 03.11, 12:05: Evidența TVA: anul de acum doi ani (termenele sunt toate trecute); ianuarie de plată, nedepus;
// februarie de recuperat, depus; decembrie are termenul pe 25 ianuarie anul următor.
{
  const sh = sheetOf('tvalunar');
  check('tva: capul de tabel și lunile', sh.cells.A2 === 'Ianuarie' && sh.cells.A13 === 'Decembrie' && sh.cells.G1 === 'Rezultat' && sh.cells.L1 === 'Setări și totaluri' && sh.lists?.some((l) => l.range === 'I2:I13'));
  const y = new Date().getFullYear() - 2;
  const serial = (yy, mm, dd) => Math.round((Date.UTC(yy, mm - 1, dd) - Date.UTC(1899, 11, 30)) / 864e5);
  const v = calc(sh, { M3: String(y), B2: '10000', D2: '5000', D3: '8000', I3: 'Da' });
  check('tva: ianuarie de plată', num(v('C2')) === 2100 && num(v('E2')) === 1050 && num(v('F2')) === 1050 && v('G2')?.text === 'De plată' && num(v('H2')) === serial(y, 2, 25) && num(v('J2')) < 0, JSON.stringify(['C2', 'E2', 'F2', 'G2', 'H2', 'J2'].map(v)));
  check('tva: februarie de recuperat, depus', v('C3')?.text === '' && num(v('F3')) === -1680 && v('G3')?.text === 'De recuperat' && v('J3')?.text === '' && v('G4')?.text === '' && v('J4')?.text === '', JSON.stringify(['C3', 'F3', 'G3', 'J3', 'G4', 'J4'].map(v)));
  check('tva: termenul din decembrie', num(v('H13')) === serial(y + 1, 1, 25), JSON.stringify(v('H13')));
  check('tva: totaluri', num(v('M4')) === 1050 && num(v('M5')) === 1680 && num(v('M6')) === -630 && num(v('M7')) === 1 && num(v('F14')) === -630 && num(v('C14')) === 2100, JSON.stringify(['M4', 'M5', 'M6', 'M7', 'F14', 'C14'].map(v)));
}

// 03.11, 11:55: Flux de numerar: sold inițial 1000, în ianuarie +500 / −800, în februarie −1000 (sold pe minus), în martie +2000.
{
  const sh = sheetOf('fluxnumerar');
  check('flux: capul de tabel și rândurile', sh.cells.B1 === 'Ian' && sh.cells.M1 === 'Dec' && sh.cells.N1 === 'Total' && sh.cells.A8 === 'Total încasări' && sh.cells.A19 === 'Total plăți' && sh.cells.A21 === 'Sold la sfârșit de lună' && sh.rules?.length === 2);
  const v = calc(sh, { B2: '1000', B4: '500', B10: '800', C10: '1000', D4: '2000' });
  check('flux: soldul trece din lună în lună', num(v('B21')) === 700 && num(v('C2')) === 700 && num(v('C21')) === -300 && num(v('D2')) === -300 && num(v('D21')) === 1700 && num(v('M21')) === 1700 && num(v('C20')) === -1000, JSON.stringify(['B21', 'C2', 'C21', 'D2', 'D21', 'M21', 'C20'].map(v)));
  check('flux: totalurile pe an', num(v('N8')) === 2500 && num(v('N19')) === 1800 && num(v('N20')) === 700 && num(v('N21')) === 1700 && num(v('N2')) === 1000, JSON.stringify(['N8', 'N19', 'N20', 'N21', 'N2'].map(v)));
  check('flux: pe scurt', num(v('Q5')) === 1700 && num(v('Q6')) === -300 && v('Q7')?.text === 'Feb' && num(v('Q8')) === 1 && num(v('Q3')) === 2500, JSON.stringify(['Q5', 'Q6', 'Q7', 'Q8', 'Q3'].map(v)));
}

// 03.11, 11:40: Facturi de la furnizori: una plătită, una plătită parțial și întârziată de 10 zile, una cu scadența peste 3 zile,
// una peste 20 de zile, una fără scadență.
{
  const sh = sheetOf('furnizori');
  check('furnizori: capul de tabel', sh.cells.B1 === 'Furnizorul' && sh.cells.J1 === 'Rest de plată' && sh.cells.L1 === 'Stare' && sh.cells.N1 === 'Pe scurt' && sh.rules?.length === 3);
  const serial = (dt) => Math.round((Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()) - Date.UTC(1899, 11, 30)) / 864e5);
  const now = new Date(), day = (k) => String(serial(new Date(now.getFullYear(), now.getMonth(), now.getDate() + k)));
  const v = calc(sh, {
    B2: 'Alfa SRL', G2: '1000', H2: '1000', F2: day(-30),
    B3: 'Beta SRL', G3: '500', H3: '200', F3: day(-10),
    B4: 'Gama SA', G4: '300', F4: day(3),
    B5: 'Delta', G5: '400', F5: day(20),
    B6: 'Epsilon', G6: '100',
  });
  check('furnizori: plătită', num(v('J2')) === 0 && v('K2')?.text === '' && v('L2')?.text === 'Plătită' && num(v('A2')) === 1, JSON.stringify(['J2', 'K2', 'L2', 'A2'].map(v)));
  check('furnizori: întârziată', num(v('J3')) === 300 && num(v('K3')) === -10 && v('L3')?.text === 'Întârziată', JSON.stringify(['J3', 'K3', 'L3'].map(v)));
  check('furnizori: în 7 zile / de plată', num(v('K4')) === 3 && v('L4')?.text === 'În 7 zile' && num(v('K5')) === 20 && v('L5')?.text === 'De plată' && v('K6')?.text === '' && v('L6')?.text === 'De plată' && v('L7')?.text === '', JSON.stringify(['K4', 'L4', 'K5', 'L5', 'K6', 'L6', 'L7'].map(v)));
  check('furnizori: pe scurt', num(v('O2')) === 5 && num(v('O3')) === 2300 && num(v('O4')) === 1200 && num(v('O5')) === 1100 && num(v('O6')) === 1 && num(v('O7')) === 300 && num(v('O8')) === 300 && num(v('O9')) === 10, JSON.stringify(['O2', 'O3', 'O4', 'O5', 'O6', 'O7', 'O8', 'O9'].map(v)));
}

// 03.11, 10:55: Zilele de naștere: unul are ziua azi, unul peste 3 zile, unul a avut-o ieri (anul viitor), un rând fără dată.
{
  const sh = sheetOf('aniversari');
  check('aniversări: capul de tabel și lista', sh.cells.B1 === 'Numele și prenumele' && sh.cells.E1 === 'Următoarea aniversare' && sh.cells.H1 === 'Când' && sh.cells.L1 === 'Pe scurt' && sh.lists?.some((l) => l.range === 'J2:J101' && l.values.join() === 'Da,Nu'));
  // Datele ca numere seriale (1 = 1.01.1900, ca în foaie): aceeași zi și lună cu azi, acum 30 de ani; peste 3 zile, acum 25 de ani; ieri, acum 40 de ani.
  const serial = (dt) => Math.round((Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()) - Date.UTC(1899, 11, 30)) / 864e5);
  const now = new Date(), y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
  const today = serial(new Date(y, m, d)), b1 = serial(new Date(y - 30, m, d)), b2 = serial(new Date(y - 25, m, d + 3)), b3 = serial(new Date(y - 40, m, d - 1));
  const in3 = serial(new Date(y, m, d + 3)), nextYear = serial(new Date(y + 1, m, d - 1));
  const v = calc(sh, { B2: 'Ion Pop', D2: String(b1), B3: 'Ana Rusu', D3: String(b2), B4: 'Dan Ene', D4: String(b3), B5: 'Maria Ilie' });
  check('aniversări: azi', num(v('E2')) === today && num(v('F2')) === 30 && num(v('G2')) === 0 && v('H2')?.text === 'Azi', JSON.stringify(['E2', 'F2', 'G2', 'H2'].map(v)));
  // Peste 3 zile poate cădea în anul următor (la sfârșitul lui decembrie); vârsta e atunci tot 25, din anul aniversării.
  check('aniversări: peste 3 zile', num(v('E3')) === in3 && num(v('F3')) === 25 && num(v('G3')) === 3 && v('H3')?.text === 'În 7 zile', JSON.stringify(['E3', 'F3', 'G3', 'H3'].map(v)));
  check('aniversări: ieri = anul viitor', num(v('E4')) === nextYear && num(v('G4')) === nextYear - today && v('H4')?.text === '' && v('E5')?.text === '' && num(v('A5')) === 4, JSON.stringify(['E4', 'F4', 'G4', 'H4', 'E5', 'A5'].map(v)));
  check('aniversări: pe scurt', num(v('M2')) === 4 && num(v('M3')) === 1 && num(v('M4')) === 2 && num(v('M5')) === 2 && v('M6')?.text === 'Ion Pop' && num(v('M7')) === today, JSON.stringify(['M2', 'M3', 'M4', 'M5', 'M6', 'M7'].map(v)));
}
// 03.11, 10:28: Evaluările anuale: unul cu 5 peste tot, unul cu media 3,5 (Bine), unul cu 1 și 2 (Nesatisfăcător), fără discuție.
{
  const sh = sheetOf('evaluari');
  check('evaluări: capul de tabel și listele', sh.cells.B1 === 'Numele și prenumele' && sh.cells.J1 === 'Media' && sh.cells.K1 === 'Calificativul' && sh.cells.N1 === 'Pe scurt' && sh.lists?.some((l) => l.range === 'D2:D51' && l.values.join() === '1,2,3,4,5') && sh.lists?.some((l) => l.range === 'L2:L51' && l.values.join() === 'Da,Nu'));
  const v = calc(sh, { B2: 'Ion Pop', D2: '5', E2: '5', F2: '5', G2: '5', H2: '5', I2: '5', L2: 'Da', B3: 'Ana Rusu', D3: '4', E3: '3', F3: '4', G3: '3', H3: '4', I3: '3', L3: 'Da', B4: 'Dan Ene', D4: '1', E4: '2', F4: '1', G4: '2', L4: 'Nu', B5: 'Maria Ilie' });
  check('evaluări: media și calificativul', num(v('J2')) === 5 && v('K2')?.text === 'Foarte bine' && num(v('J3')) === 3.5 && v('K3')?.text === 'Bine' && num(v('J4')) === 1.5 && v('K4')?.text === 'Nesatisfăcător' && v('J5')?.text === '' && v('K5')?.text === '' && num(v('A5')) === 4, JSON.stringify(['J2', 'K2', 'J3', 'K3', 'J4', 'K4', 'J5', 'A5'].map(v)));
  check('evaluări: pe scurt', num(v('O2')) === 3 && Math.abs(num(v('O3')) - 3.33) < 1e-9 && num(v('O4')) === 1 && num(v('O5')) === 1 && num(v('O6')) === 0 && num(v('O7')) === 1 && num(v('O8')) === 1, JSON.stringify(['O2', 'O3', 'O4', 'O5', 'O6', 'O7', 'O8'].map(v)));
}

// 03.11, 10:11: Echipamente date angajaților: un laptop la angajat, un telefon restituit deteriorat, o cheie în depozit fără proces-verbal.
{
  const sh = sheetOf('echipamente');
  check('echipamente: capul de tabel și listele', sh.cells.B1 === 'Angajatul' && sh.cells.I1 === 'Unde e acum' && sh.cells.L1 === 'Pe scurt' && sh.lists?.some((l) => l.range === 'C2:C101' && l.values.length === 10) && sh.lists?.some((l) => l.range === 'H2:H101' && l.values.includes('Lipsă')));
  const v = calc(sh, { B2: 'Ion Pop', C2: 'Laptop', E2: '4500', F2: '45000', J2: 'Da', B3: 'Ana Rusu', C3: 'Telefon', E3: '1200', F3: '45000', G3: '45200', H3: 'Deteriorată', J3: 'Da', C4: 'Cheie', E4: '30', J4: 'Nu' });
  check('echipamente: unde e acum', v('I2')?.text === 'La angajat' && v('I3')?.text === 'Restituit' && v('I4')?.text === 'În depozit' && v('I5')?.text === '' && num(v('A2')) === 1 && num(v('A4')) === 3 && v('A5')?.text === '', JSON.stringify(['I2', 'I3', 'I4', 'I5', 'A2', 'A4'].map(v)));
  check('echipamente: pe scurt', num(v('M2')) === 3 && num(v('M3')) === 1 && num(v('M4')) === 4500 && num(v('M5')) === 1 && num(v('M6')) === 1 && num(v('M7')) === 1, JSON.stringify(['M2', 'M3', 'M4', 'M5', 'M6', 'M7'].map(v)));
}

// 03.11, 09:55: Instruiri SSM: una din 2020 (restantă, nesemnată), una în 2100 (la zi), un rând fără perioadă.
{
  const sh = sheetOf('instruiri');
  check('instruiri: capul de tabel și listele', sh.cells.B1 === 'Numele și prenumele' && sh.cells.G1 === 'Următoarea instruire' && sh.cells.L1 === 'Pe scurt' && sh.lists?.some((l) => l.range === 'D2:D101' && l.values.length === 6) && sh.lists?.some((l) => l.range === 'J2:J101' && l.values.join() === 'Da,Nu'));
  const v = calc(sh, { B2: 'Ion Pop', E2: '43831', F2: '6', J2: 'Nu', B3: 'Ana Rusu', E3: '73051', F3: '12', J3: 'Da', B4: 'Dan Ene', E4: '45000' });
  check('instruiri: următoarea dată și starea', num(v('G2')) === 44013 && v('I2')?.text === 'Restantă' && num(v('G3')) === 73416 && v('I3')?.text === 'La zi' && v('G4')?.text === '' && v('I4')?.text === '' && num(v('A2')) === 1 && num(v('A3')) === 2 && v('A5')?.text === '', JSON.stringify(['G2', 'I2', 'G3', 'I3', 'G4', 'A2', 'A5'].map(v)));
  check('instruiri: pe scurt', num(v('M2')) === 3 && num(v('M3')) === 1 && num(v('M4')) === 0 && num(v('M5')) === 1 && num(v('M6')) === 73416, JSON.stringify(['M2', 'M3', 'M4', 'M5', 'M6'].map(v)));
}
// 03.11, 06:45: Mutare: 3 cutii (2 în bucătărie, una fragilă și ajunsă; una în dormitor), un cost estimat și real.
{
  const sh = sheetOf('mutare');
  check('mutare: capul de tabel', sh.cells.A1 === 'Cutia nr.' && sh.cells.A2 === '1' && sh.cells.A61 === '60' && sh.cells.G1 === 'Pe camere' && sh.cells.G2 === 'Bucătărie');
  check('mutare: listele', sh.lists?.some((l) => l.range === 'B2:B61' && l.values.length === 8) && sh.lists?.some((l) => l.range === 'E2:E61' && l.values.join() === 'Da,Nu'));
  const v = calc(sh, { B2: 'Bucătărie', C2: 'Farfurii', D2: 'Da', E2: 'Da', B3: 'Bucătărie', C3: 'Oale', B4: 'Dormitor', C4: 'Haine', E4: 'Nu', H17: '1500', I17: '1800', H18: '200' });
  check('mutare: pe camere', num(v('H2')) === 2 && num(v('I2')) === 1 && num(v('J2')) === 1 && num(v('H4')) === 1 && num(v('I4')) === 0 && num(v('H3')) === 0, JSON.stringify(['H2', 'I2', 'J2', 'H4', 'I4', 'H3'].map(v)));
  check('mutare: totaluri', num(v('H11')) === 3 && num(v('H12')) === 1 && num(v('H13')) === 2 && num(v('H14')) === 1, JSON.stringify(['H11', 'H12', 'H13', 'H14'].map(v)));
  check('mutare: cheltuieli', num(v('J17')) === -300 && num(v('J18')) === 200 && v('J19')?.text === '' && num(v('H24')) === 1700 && num(v('I24')) === 1800 && num(v('J24')) === -100, JSON.stringify(['J17', 'J18', 'J19', 'H24', 'I24', 'J24'].map(v)));
}

// 03.11, 06:05: Voluntariat: Ana 4 ore confirmate + 3 neconfirmate, Ion 5 ore confirmate; cheltuieli 30 + 20 lei; un nume fără ore.
{
  const sh = sheetOf('voluntariat');
  check('voluntariat: capul de tabel', sh.cells.A1 === 'Data' && sh.cells.D1 === 'Ore' && sh.cells.F1 === 'Confirmat' && sh.cells.I1 === 'Pe voluntari');
  check('voluntariat: lista Da / Nu', sh.lists?.some((l) => l.range === 'F2:F41' && l.values.join() === 'Da,Nu'));
  const v = calc(sh, { A2: '=DATE(2026;11;1)', B2: 'Ana', D2: '4', E2: '30', F2: 'Da', A3: '=DATE(2026;11;2)', B3: 'Ion', D3: '5', F3: 'Da', A4: '=DATE(2026;11;3)', B4: 'Ana', D4: '3', E4: '20', F4: 'Nu', I2: 'Ana', I3: 'Ion', I4: 'Maria' });
  check('voluntariat: pe voluntari', num(v('J2')) === 7 && num(v('K2')) === 4 && num(v('L2')) === 50 && num(v('J3')) === 5 && num(v('K3')) === 5 && num(v('J4')) === 0 && v('J5')?.text === '', JSON.stringify(['J2', 'K2', 'L2', 'J3', 'K3', 'J4', 'J5'].map(v)));
  check('voluntariat: totaluri', num(v('J13')) === 12 && num(v('J14')) === 9 && num(v('J15')) === 3 && num(v('J16')) === 50 && num(v('J17')) === 3, JSON.stringify(['J13', 'J14', 'J15', 'J16', 'J17'].map(v)));
}

// 03.11, 00:40: Bugetul nunții: o cheltuială plătită, una cu avans, una neplătită; un rând fără contract; darul estimat.
{
  const sh = sheetOf('nunta');
  check('nunta: capul de tabel', sh.cells.A1 === 'Cheltuiala' && sh.cells.F1 === 'Rest de plată (lei)' && sh.cells.G1 === 'Starea' && sh.cells.A2 === 'Restaurant (meniu × invitați)');
  const v = calc(sh, { C2: '30000', D2: '32000', E2: '10000', C3: '5000', D3: '5000', E3: '5000', C4: '4000', D4: '3500', C5: '6000', L8: '100', L9: '400' });
  check('nunta: restul de plată', num(v('F2')) === 22000 && num(v('F3')) === 0 && num(v('F4')) === 3500 && v('F5')?.text === '', JSON.stringify([v('F2'), v('F3'), v('F4'), v('F5')]));
  check('nunta: starea', v('G2')?.text === 'Avans' && v('G3')?.text === 'Plătit' && v('G4')?.text === 'Neplătit' && v('G5')?.text === '', JSON.stringify([v('G2'), v('G3'), v('G4'), v('G5')]));
  check('nunta: pe scurt', num(v('L2')) === 45000 && num(v('L3')) === 40500 && num(v('L4')) === 15000 && num(v('L5')) === 25500 && num(v('L6')) === 1500, JSON.stringify(['L2', 'L3', 'L4', 'L5', 'L6'].map(v)));
  check('nunta: darul', num(v('L10')) === 40000 && num(v('L11')) === -500, JSON.stringify(['L10', 'L11'].map(v)));
}

// Sărbători: cadouri 200 + 150 (buget 250 + 100), masa 400 (buget 500); buget total 700; 2 lucruri cumpărate din 11.
{
  const sh = sheetOf('sarbatori');
  check('sarbatori: capul de tabel', sh.cells.A1 === 'Pentru cine / ce' && sh.cells.F1 === 'Diferența (lei)' && sh.cells.A2 === 'Mama' && sh.cells.B7 === 'Masa' && sh.cells.A12 === 'Felicitările');
  const v = calc(sh, { D2: '250', E2: '200', G2: 'Da', D3: '100', E3: '150', G3: 'Da', D7: '500', E7: '400', K9: '700' });
  check('sarbatori: diferența', num(v('F2')) === 50 && num(v('F3')) === -50 && num(v('F7')) === 100 && v('F4')?.text === '', JSON.stringify([v('F2'), v('F3'), v('F7'), v('F4')]));
  check('sarbatori: pe categorii', num(v('K2')) === 350 && num(v('L2')) === 350 && num(v('K3')) === 500 && num(v('L3')) === 400 && num(v('L4')) === 0 && num(v('L7')) === 750, JSON.stringify(['K2', 'L2', 'K3', 'L3', 'L4', 'L7'].map(v)));
  check('sarbatori: rămas și de cumpărat', num(v('K10')) === 750 && num(v('K11')) === -50 && num(v('K12')) === 9, JSON.stringify(['K10', 'K11', 'K12'].map(v)));
  check('sarbatori: fără buget total, rămasul e gol', calc(sh, {})('K11')?.text === '', JSON.stringify(calc(sh, {})('K11')));
}

// 02.11, 23:59: Împrumuturi: unul dat și întârziat, unul primit în curs, unul achitat; un rând fără sumă.
{
  const sh = sheetOf('imprumuturi');
  check('împrumuturi: capul de tabel', sh.cells.A1 === 'Persoana' && sh.cells.G1 === 'Rămas (lei)' && sh.cells.H1 === 'Starea');
  check('împrumuturi: lista Dat / Primit', sh.lists?.some((l) => l.range === 'B2:B41' && l.values.join() === 'Dat,Primit'));
  const today = num(calc(sh, { Z1: '=TODAY()' })('Z1'));
  const v = calc(sh, { A2: 'Ion', B2: 'Dat', C2: '1000', F2: '300', E2: String(today - 5), A3: 'Maria', B3: 'Primit', C3: '500', E3: String(today + 30), A4: 'Vlad', B4: 'Dat', C4: '200', F4: '200', A5: 'Ana' });
  check('împrumuturi: restul', num(v('G2')) === 700 && num(v('G3')) === 500 && num(v('G4')) === 0 && v('G5')?.text === '', JSON.stringify([v('G2'), v('G3'), v('G4'), v('G5')]));
  check('împrumuturi: starea', v('H2')?.text === 'Întârziat' && v('H3')?.text === 'În curs' && v('H4')?.text === 'Achitat' && v('H5')?.text === '', JSON.stringify([v('H2'), v('H3'), v('H4'), v('H5')]));
  check('împrumuturi: pe scurt', num(v('L2')) === 700 && num(v('L3')) === 500 && num(v('L4')) === 1, JSON.stringify(['L2', 'L3', 'L4'].map(v)));
}

// 02.11, 23:35: Garanții: una expirată, una care expiră curând, una în garanție; un rând fără dată.
{
  const sh = sheetOf('garantii');
  check('garanții: capul de tabel', sh.cells.A1 === 'Produsul' && sh.cells.F1 === 'Expiră pe' && sh.cells.H1 === 'Starea');
  check('garanții: trei culori pe Starea', ['green', 'yellow', 'red'].every((k) => sh.rules?.some((r) => r.range === 'H2:H41' && r.look === k)));
  const today = num(calc(sh, { Z1: '=TODAY()' })('Z1'));
  const v = calc(sh, { A2: 'Frigider', C2: String(today - 800), D2: '2000', E2: '24', A3: 'Telefon', C3: String(today - 20), D3: '1500', E3: '1', A4: 'Laptop', C4: String(today), D4: '3000', E4: '24', A5: 'Cablu' });
  check('garanții: zilele rămase', num(v('G2')) < 0 && num(v('G3')) > 0 && num(v('G3')) <= 30 && num(v('G4')) > 700 && v('G5')?.text === '', JSON.stringify([v('G2'), v('G3'), v('G4'), v('G5')]));
  check('garanții: starea', v('H2')?.text === 'Expirată' && v('H3')?.text === 'Expiră curând' && v('H4')?.text === 'În garanție' && v('H5')?.text === '' && v('H6')?.text === '', JSON.stringify([v('H2'), v('H3'), v('H4'), v('H5'), v('H6')]));
  check('garanții: pe scurt', num(v('L2')) === 2 && num(v('L3')) === 4500 && num(v('L4')) === 1, JSON.stringify(['L2', 'L3', 'L4'].map(v)));
}

// 02.11, 23:20: Medicamente: unul ajunge 30 de zile, unul 3 zile (de cumpărat), unul expirat; un rând fără doză.
{
  const sh = sheetOf('medicamente');
  check('medicamente: capul de tabel', sh.cells.A1 === 'Medicamentul' && sh.cells.F1 === 'Zile rămase' && sh.cells.I1 === 'Starea');
  check('medicamente: trei culori pe Starea', ['green', 'yellow', 'red'].every((k) => sh.rules?.some((r) => r.range === 'I2:I41' && r.look === k)));
  const v = calc(sh, { A2: 'Vitamina D', D2: '1', E2: '30', H2: '99999', A3: 'Tensiune', D3: '2', E3: '7', A4: 'Sirop', D4: '1', E4: '20', H4: '1', A5: 'Unguent' });
  const today = num(calc(sh, { Z1: '=TODAY()' })('Z1'));
  check('medicamente: zilele rămase', num(v('F2')) === 30 && num(v('F3')) === 3 && v('F5')?.text === '', JSON.stringify([v('F2'), v('F3'), v('F5')]));
  check('medicamente: se termină pe', num(v('G2')) === today + 30 && num(v('G3')) === today + 3, JSON.stringify([v('G2'), v('G3'), today]));
  check('medicamente: starea', v('I2')?.text === 'OK' && v('I3')?.text === 'De cumpărat' && v('I4')?.text === 'Expirat' && v('I5')?.text === 'OK' && v('I6')?.text === '', JSON.stringify([v('I2'), v('I3'), v('I4'), v('I5'), v('I6')]));
  check('medicamente: pe scurt', num(v('L2')) === 1 && num(v('L3')) === 1 && num(v('L4')) === today + 3, JSON.stringify(['L2', 'L3', 'L4'].map(v)));
}

// 02.11, 22:55: Citiri contoare: trei luni de indexuri; a doua lună de consum (mult gaz) iese în roșu.
{
  const sh = sheetOf('contoare');
  check('contoare: capul de tabel', sh.cells.A1 === 'Luna' && sh.cells.C1 === 'Curent (kWh)' && sh.cells.H1 === 'Cost estimat');
  const put = { B2: '1000', D2: '500', F2: '100', B3: '1200', D3: '560', F3: '105', B4: '1350', D4: '760', F4: '110' };
  const v = calc(sh, put);
  check('contoare: consumul pe lună', v('C2') === undefined && num(v('C3')) === 200 && num(v('E3')) === 60 && num(v('G3')) === 5 && num(v('E4')) === 200 && v('C5')?.text === '', JSON.stringify([v('C2'), v('C3'), v('E3'), v('G3'), v('E4'), v('C5')]));
  check('contoare: costul estimat', v('H2')?.text === '' && num(v('H3')) === 498 && num(v('H4')) === 895, JSON.stringify([v('H2'), v('H3'), v('H4')]));
  check('contoare: pe scurt', num(v('L7')) === 350 && num(v('L8')) === 260 && num(v('L9')) === 10 && num(v('L11')) === 1393 && num(v('L12')) === 696.5, JSON.stringify(['L7', 'L8', 'L9', 'L11', 'L12'].map(v)));
  const rule = sh.rules.find((r) => r.op === 'formula');
  const red = rule && formulaMatches(rule.v1, { r0: 1, r1: 60, c0: 7, c1: 7 }, { ...sh.cells, ...put });
  check('contoare: luna scumpă iese în roșu', JSON.stringify(red) === '["H4"]', JSON.stringify(red));
}

// 02.11, 22:35: Evidența chiriilor: septembrie 2000 + 300 plătit tot, octombrie 2000 + 250 plătit 1000, noiembrie 2000 neplătit; impozit 10%.
{
  const sh = sheetOf('chirii');
  check('chirii: capul de tabel', sh.cells.A1 === 'Luna' && sh.cells.E1 === 'De plată' && sh.cells.I1 === 'Starea');
  check('chirii: trei culori pe Starea', ['green', 'yellow', 'red'].every((k) => sh.rules?.some((r) => r.range === 'I2:I121' && r.look === k)));
  const v = calc(sh, { B2: 'Ap. 5', C2: '2000', D2: '300', F2: '2300', B3: 'Ap. 5', C3: '2000', D3: '250', F3: '1000', B4: 'Ap. 5', C4: '2000' });
  check('chirii: de plată și rest', num(v('E2')) === 2300 && num(v('H2')) === 0 && num(v('H3')) === 1250 && num(v('H4')) === 2000 && v('E5')?.text === '', JSON.stringify([v('E2'), v('H2'), v('H3'), v('H4'), v('E5')]));
  check('chirii: starea', v('I2')?.text === 'Plătit' && v('I3')?.text === 'Parțial' && v('I4')?.text === 'Neplătit' && v('I5')?.text === '', JSON.stringify([v('I2'), v('I3'), v('I4'), v('I5')]));
  check('chirii: pe scurt', num(v('L2')) === 6550 && num(v('L3')) === 3300 && num(v('L4')) === 3250 && num(v('L5')) === 2, JSON.stringify(['L2', 'L3', 'L4', 'L5'].map(v)));
  check('chirii: impozitul estimat', num(v('L7')) === 6000 && num(v('L9')) === 600, JSON.stringify([v('L7'), v('L8'), v('L9')]));
}

// 02.11, 22:10: Revizii și reparații auto: schimb de ulei azi la 100.000 km (400 + 150), frâne acum doi ani (300); km acum 114.500.
{
  const sh = sheetOf('revizii');
  check('revizii: capul de tabel și lista', sh.cells.B1 === 'Km la bord' && sh.cells.G1 === 'Total' && sh.lists?.some((l) => l.range === 'C2:C151' && l.values.includes('Schimb ulei și filtre')));
  const t = new Date(), today = Math.round((Date.UTC(t.getFullYear(), t.getMonth(), t.getDate()) - Date.UTC(1899, 11, 30)) / 86400000);
  const v = calc(sh, { A2: String(today - 800), B2: '80000', C2: 'Frâne', E2: '300', A3: String(today), B3: '100000', C3: 'Schimb ulei și filtre', E3: '400', F3: '150', K6: '114500' });
  check('revizii: totalul pe rând', num(v('G2')) === 300 && num(v('G3')) === 550 && v('G4')?.text === '', JSON.stringify([v('G2'), v('G3'), v('G4')]));
  check('revizii: total, anul acesta, vizite', num(v('K2')) === 850 && num(v('K3')) === 550 && num(v('K4')) === 2, JSON.stringify([v('K2'), v('K3'), v('K4')]));
  check('revizii: uleiul', num(v('K8')) === 100000 && num(v('K9')) === 115000 && num(v('K10')) === 500, JSON.stringify([v('K8'), v('K9'), v('K10')]));
  check('revizii: roșu sub 1000 km', sh.rules?.some((r) => r.range === 'K10' && r.op === 'lt' && r.look === 'red'));
}

// 02.11: Listă de invitați: familia Pop (2 adulți, 1 copil, Da), Ana (gol = 1 adult, Da), Mihai (Nu), Ioana (2, Fără răspuns, netrimisă);
// meniul 300 lei adult, 150 copil: 3 adulți și 1 copil confirmați = 1050 lei.
{
  const sh = sheetOf('invitati');
  check('invitați: capul de tabel și listele', sh.cells.A1 === 'Nume' && sh.cells.H1 === 'Persoane' && sh.lists?.some((l) => l.range === 'E2:E201' && l.values.includes('Fără răspuns')));
  const v = calc(sh, { A2: 'Familia Pop', D2: 'Da', E2: 'Da', F2: '2', G2: '1', A3: 'Ana', D3: 'Da', E3: 'Da', A4: 'Mihai', D4: 'Da', E4: 'Nu', F4: '2', A5: 'Ioana', E5: 'Fără răspuns', F5: '2', M9: '300', M10: '150' });
  check('invitați: persoanele pe rând', num(v('H2')) === 3 && num(v('H3')) === 1 && v('H4')?.text === '' && num(v('H5')) === 2, JSON.stringify([v('H2'), v('H3'), v('H4'), v('H5')]));
  check('invitați: pe scurt', num(v('M2')) === 4 && num(v('M3')) === 4 && num(v('M4')) === 1 && num(v('M5')) === 2 && num(v('M6')) === 1 && num(v('M7')) === 1, JSON.stringify(['M2', 'M3', 'M4', 'M5', 'M6', 'M7'].map(v)));
  check('invitați: costul meselor', num(v('M11')) === 1050, JSON.stringify(v('M11')));
}

// 02.11, 20:45: Note școlare: la română 9, 10, 8 (media 9), la matematică 4 și 5 (4,5, rotunjit 5), la engleză 3 și 4 (3,5 → 4).
{
  const sh = sheetOf('note');
  check('note: capetele de tabel și materiile', sh.cells.A1 === 'Materia' && sh.cells.I1 === 'Media rotunjită' && sh.cells.A3 === 'Matematică');
  check('note: roșu sub 5', sh.rules?.some((r) => r.range === 'I2:I16' && r.op === 'lt' && r.v1 === '5' && r.look === 'red'));
  const v = calc(sh, { B2: '9', C2: '10', D2: '8', B3: '4', C3: '5', B4: '3', C4: '4' });
  check('note: media pe materie', num(v('H2')) === 9 && num(v('H3')) === 4.5 && num(v('H4')) === 3.5 && v('H5')?.text === '', JSON.stringify([v('H2'), v('H3'), v('H4'), v('H5')]));
  check('note: media rotunjită', num(v('I2')) === 9 && num(v('I3')) === 5 && num(v('I4')) === 4, JSON.stringify([v('I2'), v('I3'), v('I4')]));
  check('note: media generală și materiile sub 5', num(v('I18')) === 6 && num(v('I19')) === 1, JSON.stringify([v('I18'), v('I19')]));
}

// 02.11, 20:20: Foaie de parcurs: 120 km de serviciu, 30 personali, la 1,5 lei / km.
{
  const sh = sheetOf('parcurs');
  check('parcurs: capetele de tabel', sh.cells.B1 === 'Traseul (de la – până la)' && sh.cells.F1 === 'Km parcurși' && sh.cells.G1 === 'Tipul');
  check('parcurs: lista Serviciu / Personal', sh.lists?.some((l) => l.range === 'G2:G201' && l.values.join() === 'Serviciu,Personal'));
  const v = calc(sh, { D2: '10000', E2: '10120', G2: 'Serviciu', D3: '10120', E3: '10150', G3: 'Personal' });
  check('parcurs: km pe rând', num(v('F2')) === 120 && num(v('F3')) === 30 && v('F4')?.text === '', JSON.stringify([v('F2'), v('F3'), v('F4')]));
  check('parcurs: total, serviciu, personal', num(v('J2')) === 150 && num(v('J3')) === 120 && num(v('J4')) === 30, JSON.stringify([v('J2'), v('J3'), v('J4')]));
  check('parcurs: procent și cost', num(v('J5')) === 0.8 && num(v('J7')) === 180, JSON.stringify([v('J5'), v('J7')]));
}

// 02.11, 19:50: Împărțirea cheltuielilor: Ana a plătit 300 + 60, Mihai 90, Ioana nimic; câte 150 de persoană.
{
  const sh = sheetOf('impartire');
  check('împărțire: capetele de tabel', sh.cells.C1 === 'Cine a plătit' && sh.cells.F1 === 'Persoana' && sh.cells.I1 === 'De primit / de dat');
  check('împărțire: roșu la minus, verde la plus', sh.rules?.some((r) => r.range === 'I2:I9' && r.op === 'lt' && r.look === 'red') && sh.rules?.some((r) => r.range === 'I2:I9' && r.op === 'gt' && r.look === 'green'));
  const v = calc(sh, { B2: 'Cazare', C2: 'Ana', D2: '300', B3: 'Benzină', C3: 'Mihai', D3: '90', B4: 'Cină', C4: 'Ana', D4: '60', F2: 'Ana', F3: 'Mihai', F4: 'Ioana' });
  check('împărțire: total și pe persoană', num(v('G11')) === 450 && num(v('G12')) === 150 && num(v('G13')) === 0, JSON.stringify([v('G11'), v('G12'), v('G13')]));
  check('împărțire: cât a plătit fiecare', num(v('G2')) === 360 && num(v('G3')) === 90 && num(v('G4')) === 0, JSON.stringify([v('G2'), v('G3'), v('G4')]));
  check('împărțire: de primit / de dat', num(v('I2')) === 210 && num(v('I3')) === -60 && num(v('I4')) === -150, JSON.stringify([v('I2'), v('I3'), v('I4')]));
  check('împărțire: rândul fără nume rămâne gol', v('G5')?.text === '' && v('I5')?.text === '', JSON.stringify([v('G5'), v('I5')]));
}

// 02.11, 19:10: Acte și scadențe: ITP expirat de 5 zile, RCA care expiră peste 10 zile, pașaport valabil încă 2 ani.
{
  const sh = sheetOf('scadente');
  check('scadențe: capul de tabel', sh.cells.A1 === 'Actul' && sh.cells.D1 === 'Valabil până la' && sh.cells.F1 === 'Starea');
  check('scadențe: lista actelor', sh.lists?.some((l) => l.range === 'A2:A101' && l.values.includes('ITP') && l.values.includes('Rovinieta')));
  check('scadențe: trei culori pe Starea', ['red', 'yellow', 'green'].every((k) => sh.rules?.some((r) => r.range === 'F2:F101' && r.look === k)));
  const t = new Date(), today = Math.round((Date.UTC(t.getFullYear(), t.getMonth(), t.getDate()) - Date.UTC(1899, 11, 30)) / 86400000);
  const v = calc(sh, { A2: 'ITP', D2: '=TODAY()-5', G2: '150', A3: 'RCA', D3: '=TODAY()+10', G3: '900', A4: 'Pașaport', D4: '=TODAY()+730', G4: '258' });
  check('scadențe: zilele rămase', num(v('E2')) === -5 && num(v('E3')) === 10 && num(v('E4')) === 730, JSON.stringify([v('E2'), v('E3'), v('E4')]));
  check('scadențe: starea', v('F2')?.text === 'Expirat' && v('F3')?.text === 'Expiră curând' && v('F4')?.text === 'Valabil', JSON.stringify([v('F2'), v('F3'), v('F4')]));
  check('scadențe: rândul gol rămâne gol', v('E5')?.text === '' && v('F5')?.text === '', JSON.stringify([v('E5'), v('F5')]));
  check('scadențe: pe scurt', num(v('K2')) === 3 && num(v('K3')) === 1 && num(v('K4')) === 1 && num(v('K5')) === today + 10 && num(v('K6')) === 1308, JSON.stringify([v('K2'), v('K3'), v('K4'), v('K5'), v('K6')]));
}

// 02.11: Abonamente: lunar 50 lei pornit în 2020, anual 120 lei pornit peste 3 zile, trimestrial 90 lei oprit.
{
  const sh = sheetOf('abonamente');
  check('abonamente: capul de tabel', sh.cells.A1 === 'Serviciu' && sh.cells.F1 === 'Următoarea plată' && sh.cells.J1 === 'Activ');
  check('abonamente: listele', sh.lists?.some((l) => l.range === 'D2:D101' && l.values.join() === 'Lunar,Trimestrial,Semestrial,Anual') && sh.lists?.some((l) => l.range === 'J2:J101'));
  const t = new Date(), today = Math.round((Date.UTC(t.getFullYear(), t.getMonth(), t.getDate()) - Date.UTC(1899, 11, 30)) / 86400000);
  const v = calc(sh, { A2: 'Telefon', C2: '50', D2: 'Lunar', E2: '=DATE(2020;1;15)', A3: 'Antivirus', C3: '120', D3: 'Anual', E3: `=TODAY()+3`, A4: 'Sală', C4: '90', D4: 'Trimestrial', E4: '=DATE(2025;2;10)', J4: 'Nu' });
  const f2 = num(v('F2'));
  const d2 = f2 !== undefined ? new Date(Date.UTC(1899, 11, 30) + f2 * 86400000) : null;
  check('abonamente: următoarea plată lunară e azi sau în cel mult o lună, pe 15', f2 >= today && f2 - today <= 31 && d2?.getUTCDate() === 15, JSON.stringify(v('F2')) + ' azi ' + today);
  check('abonamente: plata anuală de peste 3 zile rămâne prima plată', num(v('F3')) === today + 3 && num(v('G3')) === 3, JSON.stringify([v('F3'), v('G3')]));
  check('abonamente: costul pe lună și pe an', num(v('H2')) === 50 && num(v('I2')) === 600 && num(v('H3')) === 10 && num(v('I3')) === 120, JSON.stringify([v('H2'), v('I2'), v('H3'), v('I3')]));
  check('abonamente: cel oprit nu se adună', v('H4')?.text === '' && v('F4')?.text === '' && num(v('M3')) === 60 && num(v('M4')) === 720 && num(v('M2')) === 2, JSON.stringify([v('H4'), v('M2'), v('M3'), v('M4')]));
  check('abonamente: plata de peste 3 zile se numără la „în 7 zile”', num(v('M5')) >= 1, JSON.stringify(v('M5')));
}
// Decont: 3 cheltuieli, avans 500.
{
  const sh = sheetOf('decont');
  check('decont: titlul', sh.cells.A1 === 'DECONT DE DEPLASARE');
  check('decont: lista de categorii', sh.lists?.some((l) => l.range === 'B8:B37' && l.values.includes('Cazare')));
  const v = calc(sh, { A8: '=DATE(2026;3;2)', B8: 'Transport', E8: '120', B9: 'Cazare', E9: '350,50', B10: 'Transport', E10: '80', H15: '500' });
  check('decont: transport adunat pe categorie', num(v('H8')) === 200, JSON.stringify(v('H8')));
  check('decont: cazare', num(v('H9')) === 350.5, JSON.stringify(v('H9')));
  check('decont: total', num(v('H14')) === 550.5, JSON.stringify(v('H14')));
  check('decont: de primit', Math.abs(num(v('H16')) - 50.5) < 1e-9, JSON.stringify(v('H16')));
}

// Plan de proiect: o sarcină de 10 zile de la 2 martie 2026 (luni).
{
  const sh = sheetOf('proiect');
  check('plan: capul de tabel', sh.cells.B1 === 'Sarcina' && sh.cells.H1 === 'Stare');
  const v = calc(sh, { B2: 'Analiza', D2: '=DATE(2026;3;2)', E2: '10', B3: 'Livrare', D3: '=DATE(2026;3;30)', E3: '3' });
  const d = (y, m, dd) => Math.round((Date.UTC(y, m - 1, dd) - Date.UTC(1899, 11, 30)) / 864e5);
  check('plan: sfârșitul = început + durată − 1', num(v('F2')) === d(2026, 3, 11), JSON.stringify(v('F2')));
  check('plan: numărul sarcinii', num(v('A3')) === 2, JSON.stringify(v('A3')));
  check('plan: rândul gol nu are număr', !v('A4')?.text, JSON.stringify(v('A4')));
  check('plan: prima săptămână = cea mai devreme dată', num(v('J1')) === d(2026, 3, 2), JSON.stringify(v('J1')));
  check('plan: săptămâna 2', num(v('K1')) === d(2026, 3, 9), JSON.stringify(v('K1')));
  check('plan: bara în săpt. 1 și 2', v('J2')?.text === '■' && v('K2')?.text === '■', JSON.stringify([v('J2'), v('K2')]));
  check('plan: fără bară în săpt. 3', v('L2')?.text === '', JSON.stringify(v('L2')));
  check('plan: a doua sarcină în săpt. 5', v('N3')?.text === '■' && v('M3')?.text === '', JSON.stringify([v('M3'), v('N3')]));
  check('plan: regula colorează bara', sh.rules?.some((r) => r.v1 === '■'));
}

// Concedii: Ana are 21 de zile; ia 4–8 mai 2026 (5 zile lucrătoare) și 28 mai – 2 iunie (1 iunie e sărbătoare).
{
  const sh = sheetOf('concedii');
  const v = calc(sh, {
    A2: 'Ana', B2: '21', C2: '2',
    G2: 'Ana', H2: '=DATE(2026;5;4)', I2: '=DATE(2026;5;8)', K2: 'Odihnă',
    G3: 'Ana', H3: '=DATE(2026;5;28)', I3: '=DATE(2026;6;2)', K3: 'Odihnă',
    G4: 'Ana', H4: '=DATE(2026;9;7)', I4: '=DATE(2026;9;8)', K4: 'Medical',
  });
  check('concedii: 5 zile lucrătoare într-o săptămână', num(v('J2')) === 5, JSON.stringify(v('J2')));
  check('concedii: fără sărbătoarea de 1 iunie', num(v('J3')) === 3, JSON.stringify(v('J3')));
  check('concedii: luate doar cele de odihnă', num(v('D2')) === 8, JSON.stringify(v('D2')));
  check('concedii: rămase', num(v('E2')) === 15, JSON.stringify(v('E2')));
  check('concedii: 16 sărbători în listă', Object.keys(sh.cells).filter((k) => /^M\d+$/.test(k) && sh.cells[k].startsWith('=DATE(')).length === 16);
}

// Credit: 12 000 lei, 12% pe an, 12 luni: rata 1066,19 lei, ultima rată închide creditul la zero.
{
  const sh = sheetOf('credit');
  const v = calc(sh, { B2: '12000', B3: '0.12', B4: '12', B5: '=DATE(2026;1;15)' });
  check('credit: rata lunară', Math.abs(num(v('B6')) - 1066.1854) < 0.001, JSON.stringify(v('B6')));
  check('credit: dobânda din prima lună', num(v('D10')) === 120, JSON.stringify(v('D10')));
  check('credit: din credit în prima lună', Math.abs(num(v('E10')) - 946.19) < 1e-6, JSON.stringify(v('E10')));
  check('credit: rămâne zero după ultima rată', Math.abs(num(v('F21'))) < 1e-6, JSON.stringify(v('F21')));
  check('credit: după ultima lună rândurile sunt goale', !v('A22')?.text && !num(v('A22')), JSON.stringify(v('A22')));
  check('credit: dobânda totală', Math.abs(num(v('B8')) - 794.2) < 0.1, JSON.stringify(v('B8')));
  check('credit: total = suma + dobânda', Math.abs(num(v('B7')) - 12000 - num(v('B8'))) < 1e-6, JSON.stringify(v('B7')));
  const d = (y, m, dd) => Math.round((Date.UTC(y, m - 1, dd) - Date.UTC(1899, 11, 30)) / 864e5);
  check('credit: a doua rată peste o lună', num(v('B11')) === d(2026, 2, 15), JSON.stringify(v('B11')));
  const z = calc(sh, { B2: '1200', B3: '0', B4: '12' });
  check('credit: fără dobândă, rata = suma / luni', num(z('B6')) === 100, JSON.stringify(z('B6')));
}

// Carburant: plin de pornire la 10 000 km, apoi 40 l după 500 km și 36 l după 450 km, 7 lei litrul.
{
  const sh = sheetOf('carburant');
  const v = calc(sh, { B2: '10000', C2: '45', D2: '7', B3: '10500', C3: '40', D3: '7', B4: '10950', C4: '36', D4: '7' });
  check('carburant: km parcurși pe rând', num(v('F3')) === 500, JSON.stringify(v('F3')));
  check('carburant: consum pe rând', num(v('G3')) === 8, JSON.stringify(v('G3')));
  check('carburant: cost pe rând', num(v('E4')) === 252, JSON.stringify(v('E4')));
  check('carburant: km total', num(v('J2')) === 950, JSON.stringify(v('J2')));
  check('carburant: consum mediu', num(v('J4')) === 8, JSON.stringify(v('J4')));
  check('carburant: cost pe km', num(v('J6')) === 0.56, JSON.stringify(v('J6')));
  check('carburant: rândul gol fără consum', !num(v('G5')), JSON.stringify(v('G5')));
}

console.log(fail ? `GREȘELI: ${fail}` : 'TOATE OK');
process.exit(fail ? 1 : 0);

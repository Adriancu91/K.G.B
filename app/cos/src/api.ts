// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Accesul la fișiere și setări, prin procesul principal Electron.
import { IMAGE_ACCEPT } from './images/decode';
export type FileKind = 'note' | 'doc' | 'sheets' | 'pdf' | 'slides' | 'video';
/** Formate de import/export în afara formatului nostru. */
export type ExportFormat = 'pptx' | 'ppsx' | 'potx' | 'docx' | 'csv' | 'xlsx' | 'png' | 'jpg' | 'webp' | 'bmp' | 'tga' | 'ico' | 'tiff' | 'gif' | 'psd' | 'pdf' | 'efactura' | 'statement' | 'image' | 'webm' | 'srt' | 'md' | 'keep' | 'voice' | 'narration' | 'media' | 'txt' | 'html' | 'webpage' | 'mht' | 'ics' | 'sheettable' | 'rtf' | 'odt' | 'ods' | 'odp' | 'reuse' | 'xfdf' | 'cer' | 'pfx' | 'p7s' | 'signed' | 'formdata' | 'fdf' | 'picture' | 'textrtf' | 'xml' | 'textdata' | 'doctables' | 'model3d' | 'eml' | 'sactions' | 'erpbackup' | 'erpzip' | 'erpinvoice' | 'any';
export interface CompanyLookup { found: boolean; source: string; name?: string; cui?: string; regCom?: string; address?: string; country?: string; phone?: string; vatPayer?: boolean; inactive?: boolean }
export type Theme = 'system' | 'light' | 'dark';

export interface RecentFile {
  path: string;
  kind: FileKind;
  openedAt: string;
}

export interface Settings {
  theme: Theme;
  recent: RecentFile[];
  /** Verificarea ortografică în română (implicit pornită). */
  spellcheck?: boolean;
  /** Taburile deschise data trecută (aplicația și fișierul salvat din ea), ca să se refacă la pornire. */
  tabs?: { id: string; path?: string }[];
  /** Tabul care era în față. */
  tab?: string;
  /** Blocurile de text din Docs (🧩 Blocuri), aceleași în toate documentele. */
  docBlocks?: import('./docs/textBlocks').DocBlock[];
  /** Fila de panglică aleasă ultima dată în fiecare modul („docs” → „insert”). */
  ribbon?: Record<string, string>;
  /** PDF: tastele simple pentru unelte, fără Ctrl / Alt (V, S, U, D, X), pornite din ☰ Meniu (implicit oprite). */
  pdfSingleKeys?: boolean;
  /** Profilul de meniu ales în fiecare aplicație („pdf” → „airy”); lipsă = așezarea implicită (profiles.ts). */
  profiles?: Record<string, string>;
  /** PDF, profilul Aerisit: barele ascunse (false = ascunsă): miniaturile, bara de unelte de sus, șina panourilor. */
  pdfAiry?: { thumbs?: boolean; quick?: boolean; rail?: boolean };
  /** Limba interfeței (i18n.ts); lipsă = română. */
  lang?: 'ro' | 'en';
  /** Sheets: încotro merge cursorul după Enter (Fișier → Opțiuni); lipsă = în jos. */
  sheetsEnter?: 'down' | 'right' | 'up' | 'left' | 'none';
  /** Sheets → Fișier → Opțiuni: completarea automată din coloană, AutoCorect în celule și salvarea automată; lipsă = pornite. */
  sheetsOpts?: { complete?: boolean; correct?: boolean; autosave?: boolean };
  /** Sheets → Vizualizare → Macrocomenzi păstrate pentru toate registrele (curățate la citire cu cleanMacros). */
  sheetsMacros?: unknown[];
  /** Docs → Vizualizare → Macrocomenzi păstrate pentru toate documentele (curățate la citire cu cleanDocMacros). */
  docsMacros?: unknown[];
  /** Slides → Vizualizare → Macrocomenzi păstrate pentru toate prezentările (curățate la citire cu cleanDeckMacros). */
  slidesMacros?: unknown[];
  /** Video → 🎨 Kit de brand: culorile, fonturile și siglele, aceleași în toate filmele (curățate la citire cu cleanBrand). */
  videoBrand?: unknown;
  /** Slides → Fișier → Opțiuni: ortografia la scris, lipirea de grilă (cu distanța în cm), ghidajele inteligente și salvarea automată; lipsă = cele implicite. */
  /** Docs → Fișier → Opțiuni: salvarea automată a documentelor cu fișier; lipsă = pornită. */
  docsOpts?: { autosave?: boolean; autoLang?: boolean };
  slidesOpts?: { spell?: boolean; snapGrid?: boolean; gridCm?: number; smart?: boolean; autosave?: boolean };
  /** Docs → ❝ Citare: lista principală de surse, aceeași în toate documentele (citation.ts). */
  citeSources?: import('./docs/citation').Source[];
}

/** O versiune mai veche a unui fișier, păstrată automat la salvare. */
/** Un certificat din Windows (Personal): amprenta, numele, emitentul, valabilitatea (AAAA-LL-ZZ), certificatul și lanțul (base64, DER). */
export interface WinCert { thumb: string; name: string; issuer: string; from: string; to: string; ec: boolean; der: string; chain: string[] }

export interface FileVersion {
  id: string;
  /** Ora la care fusese salvată, „2026-10-17T23:45:10” (ora locală). */
  time: string;
  size: number;
}

/** Antetul și subsolul paginilor la PDF și tipărire. */
export interface PagePrint { header: string; footer: string; numbers: boolean; /** Foaia pe lat (de exemplu o poză mai lată decât înaltă). */ landscape?: boolean; /** Locul numărului paginii („bc” = jos la mijloc; implicit jos-dreapta). */ numAt?: string; /** Prima pagină diferită (doar la Export PDF). */ firstPage?: { header: string; footer: string; numbers: boolean }; /** Antetul și subsolul secțiunilor de după întreruperi (doar la Export PDF și previzualizare). */ sections?: { header: string; footer: string }[]; /** Tipărire fără antet și fără margini (paginile gata făcute din rasterPrint.ts). */ raw?: boolean }

export interface OpenedFile {
  path: string;
  content: string;
  /** Are modificări nesalvate (un tab mutat în altă fereastră înainte de salvare). */
  dirty?: boolean;
  /** Un fișier de adus (.docx, .xlsx, .csv…) în locul conținutului Suite: `path` îi dă numele și felul. */
  imported?: Uint8Array;
  /** Foaia de arătat după deschidere (✎ Deschide foaia legată din Docs / Slides), după nume; lipsă = foaia activă din fișier. */
  sheet?: string;
  /** Ciorna din care vine (Fișier → Recuperează…): documentul continuă în ea până la salvare. */
  draft?: string;
  /** Un clip sau un sunet (doar calea) de pus într-un proiect Video nou (dublu-click, „Deschide un fișier…”, tragere). */
  media?: boolean;
  /** Adus din Import cu tabul ocupat: fișierul trece prin fereastra de import (de exemplu Import din text), nu direct. */
  wizard?: boolean;
}

/** O fereastră deschisă (sau un ecran) pentru captură: numele și miniatura ca adresă data:. */
export interface ScreenSource { id: string; name: string; screen: boolean; thumb: string }

/** Un tab mutat într-o fereastră nouă: aplicația, fișierul și, la Docs / Sheets, conținutul de acum. */
export interface DetachedTab { kind: string; path: string; content: string | null; dirty: boolean }
export interface WindowState { docked: boolean; onTop: boolean }
/** O notiță trimisă între ferestre (fereastra separată a notiței și caietul): titlul, textul, culoarea. */
export interface NoteSync { id: string; title: string; body: string; updated: string; color?: string; closed?: boolean }

/** Un fișier binar (de exemplu PDF): calea și octeții. */
export interface BinaryFile {
  path: string;
  data: Uint8Array;
}

/** Ce vede publicul pe al doilea monitor: prezentarea (trimisă o dată), slide-ul curent și ecranul negru. */
export interface AudienceState {
  deck?: unknown;
  i?: number;
  /** Câte casete cu animație au apărut pe slide. */
  step?: number;
  /** Declanșatoarele apăsate pe slide (casetele care au pornit animațiile legate de ele). */
  fired?: string[];
  black?: boolean;
  /** Ecran alb (W în prezentare). */
  white?: boolean;
}

export interface DisplayInfo { id: string; n: number; w: number; h: number; primary: boolean; here: boolean }

export interface AudienceBridge {
  /** Deschide fereastra pe celălalt monitor (sau pe cel ales; 'none' = fără); false dacă e un singur ecran. */
  open(pick?: string): Promise<boolean>;
  /** Monitoarele: numărul, mărimea, care e principal și pe care e fereastra aplicației. */
  displays?(): Promise<DisplayInfo[]>;
  close(): Promise<void>;
  send(st: AudienceState): void;
  getState(): Promise<AudienceState>;
  onState(cb: (st: AudienceState) => void): () => void;
  key(k: string): void;
  onKey(cb: (k: string) => void): () => void;
  onClosed(cb: () => void): () => void;
}

export interface VideoRecovery { time: string; count: number; content: string }

export interface VideoBridge {
  /** null dacă FFmpeg nu e instalat; altfel codorul folosit (de exemplu h264_qsv, al plăcii video). */
  ffmpeg(): Promise<{ encoder: string } | null>;
  /** Întreabă unde se salvează și pornește FFmpeg; null dacă s-a renunțat. */
  /** Muzica de fundal: calea pe disc și octeții (pentru ascultare); null dacă s-a renunțat. */
  pickAudio(): Promise<{ path: string; data: Uint8Array } | null>;
  /** Octeții melodiei de la o cale (la deschiderea unui proiect). */
  readAudio(path: string): Promise<Uint8Array>;
  /** Căile pozelor și clipurilor alese pentru bandă. */
  pickMedia(): Promise<string[]>;
  /** Copia de recuperare a proiectului nesalvat: fără argument o citește, cu null o șterge, cu un obiect o scrie. */
  recovery(data?: VideoRecovery | null): Promise<VideoRecovery | null>;
  mp4Start(opts: {
    width: number; height: number; fps: number; suggestedName: string;
    /** Muzica (calea pe disc, volumul 0…2) și durata videoclipului în secunde. */
    audio?: { path: string; volume: number; /** Apariția / stingerea muzicii (secunde). */ fin?: number; fout?: number }; duration?: number;
    /** Sunetul clipurilor: bucata folosită (in, dur), unde începe în videoclip (start) și volumul (0…2). */
    clips?: { path: string; in: number; dur: number; start: number; volume: number; speed?: number; /** Sunetul apare / se stinge mai lung (secunde), cu imaginea din negru. */ fin?: number; fout?: number }[];
    /** „Din negru”: sunetul apare și se stinge odată cu imaginea. */
    edges?: boolean;
    /** Animație GIF în loc de MP4 (fără sunet). */
    gif?: boolean;
    /** Doar sunetul filmului, ca MP3 (fără cadre: se cheamă direct mp4End). */
    audioOnly?: boolean;
    /** Capitolele (secunda de început și numele), scrise în MP4. */
    chapters?: { t: number; name: string }[];
  }): Promise<{ id: string; path: string } | null>;
  /** Un cadru JPEG. */
  mp4Frame(id: string, data: Uint8Array): Promise<void>;
  /** Termină fișierul (sau îl aruncă, cu cancel). */
  mp4End(id: string, cancel?: boolean): Promise<{ path: string } | null>;
  /** Copia ușoară (540p) a unui clip foarte mare, pentru previzualizare; null dacă FFmpeg lipsește. */
  proxy?(path: string): Promise<string | null>;
  /** Copie MP4 (aceeași rezoluție) pentru un clip pe care Chromium nu-l poate reda; null fără FFmpeg. */
  convert?(path: string): Promise<string | null>;
  /** Octeții unei copii AAC pentru o melodie/voce pe care Chromium n-o poate reda (IAMF, AMR…); null fără FFmpeg. */
  convertAudio?(path: string): Promise<Uint8Array | null>;
  /** Salvează bucata start…end (secunde) a clipului fără re-encodare; calea nouă sau null dacă s-a renunțat. */
  quickTrim?(opts: { filePath: string; start: number; end: number }): Promise<string | null>;
}

interface SuiteBridge {
  /** Decupare / Copiere / Lipire trimise elementului cu cursorul, ca tastele (vezi clipCmd.ts). */
  editCommand?(cmd: 'cut' | 'copy' | 'paste'): void;
  // Fișiere binare (PDF): se deschid ca octeți și intră în „Fișiere recente”.
  openBinary(kind: FileKind): Promise<BinaryFile | null>;
  /** „Deschide un fișier…” (lista ＋): orice fișier știut; `content` pentru fișierele Suite, `data` pentru PDF și cele de adus (.docx…). */
  openAny?(): Promise<{ path: string; kind: FileKind; content?: string; data?: Uint8Array; imported?: boolean; media?: boolean } | null>;
  /** Cere fișierele primite la pornire (dublu-click în Windows); ele vin apoi prin onOpenPath. Întoarce câte sunt. */
  pendingFiles?(): Promise<number>;
  onOpenPath?(cb: (f: { path: string; kind?: FileKind; content?: string; data?: Uint8Array; media?: boolean; error?: string }) => void): () => void;
  readBinary(path: string, kind: FileKind): Promise<BinaryFile>;
  /** Calea pe disc a unui fișier tras cu mouse-ul în fereastră (doar în Electron). */
  pathForFile?(file: File): string;
  getSettings(): Promise<Settings>;
  setSettings(patch: Partial<Settings>): Promise<Settings>;
  openFile(kind: FileKind): Promise<OpenedFile | null>;
  readFile(path: string, kind: FileKind): Promise<OpenedFile>;
  /** `suggestedDir`: dosarul propus în fereastra Salvează (de exemplu cel al fișierului importat). */
  saveFile(req: { path: string | null; content: string; kind: FileKind; suggestedName?: string; suggestedDir?: string }): Promise<{ path: string } | null>;
  /** „Trimite o observație”: poza ferestrei (PNG), textul și locul din aplicație, salvate local în Documente\Suite\Observații. */
  feedbackCapture(): Promise<Uint8Array | null>;
  /** Capturile la observație se pot păstra (lipsă = da); pagina web pune false. */
  feedbackImages?: boolean;
  feedbackSave(req: { text: string; module: string; file: string; png: Uint8Array | null }): Promise<{ dir: string; txt: string; png: string | null }>;
  feedbackOpenDir(): Promise<string>;
  /** „Despre”: numele, versiunea, versiunea de test (zile rămase) și dacă există fișierele de licență. */
  appInfo(): Promise<{ name: string; version: string; trial: { daysLeft: number; end: number; contact: string } | null; license: boolean; terti: boolean; extras?: string[] }>;
  /** Deschide LICENTA.txt sau LICENTE-TERTI.txt. */
  openLicense(kind: 'lic' | 'terti'): Promise<boolean>;
  /** Deschide un mesaj .eml salvat de Suite în programul de e-mail al calculatorului (ca mesaj nou, de trimis). Doar în Electron. */
  openMail?(path: string): Promise<boolean>;
  /** Scrie un mesaj .eml nou în dosarul temporar și îl deschide în programul de e-mail, fără fereastra Salvează. Doar în Electron. */
  composeMail?(name: string, data: Uint8Array): Promise<{ path: string; opened: boolean }>;
  // Salvează pagina curentă ca PDF (folosește stilurile de tipărire).
  /** `page`: antet, subsol și numere de pagină (doar documentele Docs le folosesc). */
  exportPdf(suggestedName?: string, page?: PagePrint): Promise<{ path: string } | null>;
  /** Paginile documentului ca PDF, fără să-l salveze (Previzualizare înaintea imprimării; doar în Electron). */
  docPdfBytes?(page?: PagePrint): Promise<Uint8Array>;
  // Salvează octeți într-un alt format (de exemplu .docx), cu fereastra „Salvează ca”.
  exportFile(req: { format: ExportFormat; suggestedName: string; data: Uint8Array }): Promise<{ path: string } | null>;
  /** Scrie peste un fișier existent (Ctrl+S în PDF), după ce păstrează o copie de siguranță a lui. Doar în Electron. */
  overwriteFile?(req: { path: string; format: ExportFormat; data: Uint8Array }): Promise<{ path: string }>;
  // Alege un fișier în alt format (de exemplu .docx) și îi întoarce octeții.
  /** size vine doar când fișierul n-a fost citit pentru că e prea mare (clipuri pentru Slides). */
  importFile(format: ExportFormat): Promise<{ path: string; data: Uint8Array; size?: number } | null>;
  /** Fișierul de lângă o semnătură .p7s (același nume fără .p7s), dacă există; doar în aplicația instalată. */
  signedOriginal?(sigPath: string): Promise<{ path: string; data: Uint8Array } | null>;
  /** Certificatele din Windows cu cheie (și de pe token / card), pentru semnătura digitală. Doar în Electron, pe Windows. */
  listWinCerts?(): Promise<WinCert[]>;
  /** Semnează octeții (SHA-256) cu certificatul din Windows; PIN-ul îl cere fereastra driverului, nu Suite. Semnătura EC e r||s. */
  signWinCert?(thumb: string, data: Uint8Array, ec: boolean): Promise<Uint8Array>;
  /** Decriptează (RSA PKCS #1 v1.5) cheia plicului unui PDF criptat cu certificat, cu cheia din Windows / de pe token. */
  decryptWinCert?(thumb: string, data: Uint8Array): Promise<Uint8Array>;
  /** O pagină de la scanner (fereastra de scanare a Windows-ului); null = utilizatorul a renunțat. Doar în Electron, pe Windows. */
  scanImage?(): Promise<{ data: Uint8Array; ext: string } | null>;
  /** Marca temporală: trimite cererea RFC 3161 la server și întoarce răspunsul (doar în aplicația instalată). */
  tsaStamp?(url: string, req: Uint8Array): Promise<Uint8Array>;
  /** Preluare date → Din web: o pagină citită de procesul principal (fără cookie-uri), cu tipul ei și adresa finală. */
  webGet?(url: string): Promise<{ data: Uint8Array; type: string; url: string }>;
  // Alege mai multe imagini JPG/PNG deodată (pentru Imagini → PDF).
  /** Mai multe fișiere de același fel deodată (în ordinea numelor). */
  importMany(format: ExportFormat): Promise<BinaryFile[]>;
  importImages(wide?: boolean): Promise<BinaryFile[]>;
  /** Procesare în lot: căile pozelor alese, octeții uneia, dosarul de destinație și scrierea fără suprascriere. */
  pickImagePaths(): Promise<string[]>;
  readImage(path: string): Promise<Uint8Array>;
  /** Alege un dosar; `title` e întrebarea din fereastra Windows. */
  pickFolder(title?: string): Promise<string | null>;
  writeToFolder(dir: string, name: string, data: Uint8Array): Promise<string>;
  /** PDF-urile dintr-un dosar și din subdosare (doar în Electron), pentru căutarea în dosar. */
  listPdfs?(dir: string): Promise<{ path: string; size: number; mtime?: number }[]>;
  /** Fișierele cu tabele (.csv / .txt / .xlsx / .xls / .ods) dintr-un dosar și din subdosare (doar în Electron), pentru Interogare din dosar. */
  listTables?(dir: string): Promise<string[]>;
  /** PDF → Combină → 📁 Adaugă un dosar: fișierele care se pot pune în PDF din dosar și din subdosare (doar în Electron); `more` = au mai rămas. */
  combineFolder?(dir: string): Promise<{ files: { name: string; rel: string; data: Uint8Array }[]; more: boolean }>;
  /** Indexul căutării în dosar (textul PDF-urilor, ținut în dosarul de setări al aplicației): citit, scris, șters. */
  pdfIndexGet?(dir: string): Promise<string | null>;
  pdfIndexPut?(dir: string, text: string): Promise<boolean>;
  pdfIndexDel?(dir: string): Promise<boolean>;
  /** Octeții unui PDF, fără să intre în Recente. */
  readPdfQuiet?(path: string): Promise<Uint8Array>;
  print(page?: PagePrint): Promise<boolean>;
  /** Ctrl+Alt+N apăsat oriunde (doar în Electron); întoarce funcția de dezabonare. */
  onQuickNote?(cb: () => void): () => void;
  /** Meniul de clic dreapta (doar în Electron): comenzile locului, trimise chiar înainte de meniu, și alegerea făcută în el. */
  setContextItems?(items: unknown[]): void;
  onContextCommand?(cb: (id: string) => void): () => void;
  /** Ce e nesalvat în aplicații (doar în Electron; vezi src/unsaved.ts). */
  setUnsaved?(names: string[]): void;
  /** Pagină web → PDF: un fișier .html de pe calculator, tipărit ca PDF A4 (fără scripturi și fără internet). */
  htmlToPdf?(path: string): Promise<Uint8Array>;
  /** Text formatat (HTML gata făcut, de exemplu dintr-un .rtf) → PDF A4, fără scripturi și fără internet. */
  htmlTextToPdf?(html: string, opts?: { noMargins?: boolean }): Promise<Uint8Array>;
  /** O adresă web → PDF A4 (pagina adusă fără scripturi și fără cookie-uri), cu titlul paginii. */
  urlToPdf?(url: string): Promise<{ data: Uint8Array; title: string; url: string }>;
  /** Captură de ecran: ferestrele deschise (cu o miniatură), poza mare a uneia (PNG) și tot ecranul, pentru decupare (doar în Electron). */
  screenSources?(): Promise<ScreenSource[]>;
  screenGrab?(id: string): Promise<Uint8Array>;
  screenClip?(): Promise<Uint8Array>;
  /** Ortografia unui cuvânt cu dicționarul românesc (doar în Electron): e greșit?, sugestiile și adăugarea în dicționar. */
  spellWrong?(word: string): boolean;
  spellSuggest?(word: string): string[];
  spellAdd?(word: string): Promise<boolean>;
  /** Fonturile obișnuite găsite pe calculator (doar în Electron) și octeții variantelor lor [normal, aldin, cursiv, aldin cursiv]. */
  sysFonts?(): Promise<string[]>;
  sysFontBytes?(name: string): Promise<(Uint8Array | null)[] | null>;
  /** Click pe notificarea unui memento: deschide notița cu acest id. */
  onOpenNote?(cb: (id: string) => void): () => void;
  /** Caietul de notițe: calea lui și conținutul (null dacă nu există încă). */
  loadNotes(): Promise<{ path: string; content: string | null }>;
  saveNotes(content: string): Promise<{ path: string }>;
  /** Studio de documente: fișierul cu firma, punctele de lucru, clienții și documentele (null dacă nu există încă). */
  loadStudio?(): Promise<{ path: string; content: string | null }>;
  /** ERP Suran: fișierul bazei de date SQLite (octeții întregi). */
  loadErp?(): Promise<{ path: string; data: Uint8Array | null }>;
  saveErp?(data: Uint8Array): Promise<{ path: string }>;
  /** Atașamentele ERP: fișiere lângă bază, cu id-ul dat de aplicație. */
  erpPutFile?(data: Uint8Array): Promise<string>;
  erpGetFile?(id: string): Promise<Uint8Array>;
  erpListFiles?(): Promise<string[]>;
  erpWriteFile?(id: string, data: Uint8Array): Promise<boolean>;
  erpOpenFile?(id: string, name: string): Promise<boolean>;
  saveStudio?(content: string): Promise<{ path: string }>;
  /** Datele unei firme după CUI (ANAF) sau cod de TVA european (VIES); doar în Electron, doar la cererea omului. */
  companyLookup?(code: string): Promise<CompanyLookup>;
  /** Păstrează un atașament lângă caiet și întoarce id-ul lui; `ext`: „pdf” (implicit), „webm” (înregistrare audio) sau „bin” (orice alt fișier). */
  addAttachment(data: Uint8Array, ext?: 'pdf' | 'webm' | 'bin'): Promise<string>;
  readAttachment(id: string): Promise<Uint8Array>;
  /** Șterge un atașament (după ce notița blocată și-a criptat copia); lipsă = nu se poate șterge. */
  deleteAttachment?(id: string): Promise<void>;
  /** Slide-ul pe al doilea monitor (doar în Electron). */
  audience?: AudienceBridge;
  /** Export MP4 cu FFmpeg (doar în Electron și doar dacă FFmpeg e instalat). */
  video?: VideoBridge;
  // Versiunile vechi ale unui fișier (cea mai nouă prima) și conținutul uneia.
  /** Fereastra lipită pe marginea din dreapta, mereu deasupra; false o pune înapoi (doar în Electron). */
  dockWindow?(on: boolean): Promise<WindowState | null>;
  /** Fereastra mereu deasupra celorlalte programe (doar în Electron). */
  setOnTop?(on: boolean): Promise<WindowState | null>;
  windowState?(): Promise<WindowState & { width: number } | null>;
  /** Așază toate ferestrele Cyber Office Studio pe ecran; întoarce câte sunt (doar în Electron). */
  arrangeWindows?(mode: 'tile' | 'vertical' | 'horizontal' | 'cascade'): Promise<number>;
  /** Locul și mărimea ferestrei (pentru teste și pentru aranjare). */
  windowBounds?(): Promise<{ x: number; y: number; width: number; height: number } | null>;
  /** Mută un tab într-o fereastră nouă (doar în Electron). */
  detachTab?(p: DetachedTab): Promise<boolean>;
  /** În fereastra nouă: tabul primit (o singură dată). */
  takeDetached?(id: number): Promise<DetachedTab | null>;
  /** Notițe → 🗗 Fereastră separată: o notiță singură într-o fereastră mică (doar în Electron). */
  notePopout?(note: NoteSync): Promise<boolean>;
  /** În fereastra notiței: notița primită (o singură dată). */
  noteTake?(id: number): Promise<NoteSync | null>;
  /** Fereastra are deschis caietul de notițe (el salvează schimbările venite din ferestrele notițelor). */
  noteHolder?(on: boolean): Promise<void>;
  /** Trimite schimbarea unei notițe celorlalte ferestre; întoarce câte ferestre cu caietul deschis au primit-o. */
  noteSync?(msg: NoteSync): Promise<number>;
  onNoteSync?(cb: (msg: NoteSync) => void): () => void;
  listVersions(path: string): Promise<FileVersion[]>;
  readVersion(path: string, id: string): Promise<string>;
  /** Ciorna unui document nesalvat (o copie la câteva secunde cât scrii; rămâne 7 zile). */
  putDraft(d: { id: string; kind: FileKind; title: string; content: string }): Promise<void>;
  /** Ciornele de un fel, cea mai nouă prima. */
  listDrafts(kind: FileKind): Promise<DraftInfo[]>;
  readDraft(id: string): Promise<string>;
  delDraft(id: string): Promise<void>;
}

export interface DraftInfo { id: string; kind: FileKind; title: string; /** ms de la 1970 */ time: number; size: number }

declare global {
  interface Window {
    suite?: SuiteBridge;
  }
}

// În browser (fără Electron) folosim o variantă în memorie, ca interfața să poată fi testată.
const memory: Record<string, string> = {};
const pickedImages: Record<string, File> = {};
let memErp: Uint8Array | null = null;
const memErpFiles: Record<string, Uint8Array> = {};
const memAttachments: Record<string, Uint8Array> = {};
const memVersions: Record<string, { v: FileVersion; content: string }[]> = {};
const memDrafts: Record<string, { id: string; kind: FileKind; title: string; time: number; content: string }> = {};
let memSettings: Settings = { theme: 'system', recent: [] };
const fallback: SuiteBridge = {
  getSettings: async () => memSettings,
  setSettings: async (patch) => (memSettings = { ...memSettings, ...patch }),
  openFile: async () => null,
  readFile: async (path) => ({ path, content: memory[path] ?? '' }),
  openBinary: async (kind) => fallback.importFile(kind as ExportFormat),
  readBinary: async (path) => { throw new Error('În browser fișierele recente nu se pot redeschide: ' + path); },
  feedbackCapture: async () => null,
  feedbackSave: async ({ text }) => { memory['memorie/Observații/observatie.txt'] = text; return { dir: 'memorie/Observații', txt: 'memorie/Observații/observatie.txt', png: null }; },
  feedbackOpenDir: async () => '',
  appInfo: async () => ({ name: 'Cyber Office Studio', version: '0.0.0', trial: null, license: false, terti: false, extras: ['studio'] }),
  openLicense: async () => false,
  saveFile: async ({ path, content, suggestedName }) => {
    const p = path ?? `memorie/${suggestedName ?? 'fara-titlu'}`;
    if (memory[p] !== undefined && memory[p] !== content) {
      const list = (memVersions[p] ??= []);
      const t = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 19);
      list.unshift({ v: { id: `v${list.length + 1}`, time: t, size: memory[p].length }, content: memory[p] });
    }
    memory[p] = content;
    return { path: p };
  },
  // În browser, fereastra de tipărire are și opțiunea „Salvează ca PDF”.
  exportPdf: async () => { window.print(); return null; },
  // În browser, fișierul se descarcă.
  exportFile: async ({ format, suggestedName, data }) => {
    const name = format === 'any' ? suggestedName : `${suggestedName}.${format}`;
    const url = URL.createObjectURL(new Blob([data as BlobPart]));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return { path: name };
  },
  // În browser, alegem fișierul cu fereastra obișnuită a browserului.
  importFile: (format) => new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = format === 'csv' ? '.csv,.txt' : format === 'textdata' ? '.csv,.txt,.tsv,.tab,.prn,.dat' : format === 'doctables' ? '.docx,.docm,.odt,.fodt,.doc,.rtf' : format === 'efactura' ? '.xml,.zip' : format === 'signed' ? '.p7s,.p7m,.p7c' : format === 'statement' ? '.pdf,.csv,.txt,.xlsx,.xlsm,.xls,.xlsb,.ods,.fods' : format === 'keep' ? '.zip,.json,.enex,.docx' : format === 'image' ? IMAGE_ACCEPT : format === 'picture' ? IMAGE_ACCEPT + ',.pdf,.ai,.eps' : format === 'textrtf' ? '.txt,.rtf' : format === 'media' ? '.mp4,.m4v,.webm,.ogv,.mp3,.m4a,.aac,.wav,.ogg,.opus,.flac' : format === 'xlsx' ? '.xlsx,.xlsm,.xls,.xlsb,.ods,.fods' : format === 'docx' ? '.docx,.docm,.doc,.odt,.fodt,.rtf,.txt' : format === 'pptx' ? '.pptx,.ppt,.odp,.fodp,.ppsx,.potx,.pptm,.ppsm,.potm' : format === 'reuse' ? '.sslides,.pptx,.ppt,.odp,.fodp,.ppsx,.potx,.pptm,.ppsm,.potm' : format === 'any' ? '' : format === 'erpbackup' ? '.zip,.sqlite' : '.' + format;
    input.onchange = async () => {
      const file = input.files?.[0];
      resolve(file ? { path: file.name, data: new Uint8Array(await file.arrayBuffer()) } : null);
    };
    input.click();
  }),
  importMany: (format) => new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.' + format;
    input.onchange = async () => {
      resolve(await Promise.all([...(input.files ?? [])].map(async (f) => ({ path: f.name, data: new Uint8Array(await f.arrayBuffer()) }))));
    };
    input.click();
  }),
  importImages: (wide) => new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = wide ? '.jpg,.jpeg,.png,.webp,.bmp,.gif,.avif,.tif,.tiff,.heic,.heif,.psd,.psb,.tga' : '.jpg,.jpeg,.png';
    input.onchange = async () => {
      resolve(await Promise.all([...(input.files ?? [])].map(async (f) => ({ path: f.name, data: new Uint8Array(await f.arrayBuffer()) }))));
    };
    input.click();
  }),
  print: async () => { window.print(); return true; },
  // În browser, pozele alese se țin în memorie după nume, iar rezultatele se descarcă.
  pickImagePaths: () => new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = IMAGE_ACCEPT;
    input.onchange = () => {
      const files = [...(input.files ?? [])];
      files.forEach((f) => { pickedImages[f.name] = f; });
      resolve(files.map((f) => f.name));
    };
    input.click();
  }),
  readImage: async (path) => {
    const f = pickedImages[path];
    if (!f) throw new Error('Poza nu mai e disponibilă: ' + path);
    return new Uint8Array(await f.arrayBuffer());
  },
  pickFolder: async () => 'Descărcări',
  writeToFolder: async (dir, name, data) => {
    const url = URL.createObjectURL(new Blob([data as BlobPart]));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return `${dir}/${name}`;
  },
  // În browser, caietul de notițe stă în memoria browserului (și trece prin istoricul de versiuni ca un fișier obișnuit).
  loadNotes: async () => {
    let content: string | null = null;
    try { content = localStorage.getItem('suite.notite') ?? null; } catch { /* fără memorie locală */ }
    if (content !== null) memory['memorie/Notițe.snotes'] ??= content;
    return { path: 'memorie/Notițe.snotes', content };
  },
  saveNotes: async (content) => {
    try { localStorage.setItem('suite.notite', content); } catch { /* fără memorie locală */ }
    return fallback.saveFile({ path: 'memorie/Notițe.snotes', content, kind: 'note' }) as Promise<{ path: string }>;
  },
  // În browser baza ERP stă doar în memorie (pentru încercări), până la reîncărcarea paginii.
  loadErp: async () => ({ path: 'memorie/erp.sqlite', data: memErp }),
  saveErp: async (data) => { memErp = data.slice(); return { path: 'memorie/erp.sqlite' }; },
  erpPutFile: async (data) => { const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 10); memErpFiles[id] = data.slice(); return id; },
  erpGetFile: async (id) => memErpFiles[id] ?? new Uint8Array(0),
  erpListFiles: async () => Object.keys(memErpFiles),
  erpWriteFile: async (id, data) => { memErpFiles[id] = data.slice(); return true; },
  erpOpenFile: async () => false,
  loadStudio: async () => {
    let content: string | null = null;
    try { content = localStorage.getItem('suite.studio') ?? null; } catch { /* fără memorie locală */ }
    return { path: 'memorie/studio.json', content };
  },
  saveStudio: async (content) => {
    try { localStorage.setItem('suite.studio', content); } catch { /* fără memorie locală */ }
    return { path: 'memorie/studio.json' };
  },
  addAttachment: async (data, ext) => {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8) + (ext === 'webm' || ext === 'bin' ? '.' + ext : '.pdf');
    memAttachments[id] = data.slice();
    return id;
  },
  readAttachment: async (id) => {
    if (!memAttachments[id]) throw new Error('Atașamentul nu mai e disponibil.');
    return memAttachments[id].slice();
  },
  deleteAttachment: async (id) => { delete memAttachments[id]; },
  listVersions: async (path) => (memVersions[path] ?? []).map((x) => x.v),
  readVersion: async (path, id) => memVersions[path]?.find((x) => x.v.id === id)?.content ?? '',
  putDraft: async (d) => { memDrafts[d.id] = { ...d, time: Date.now() }; },
  listDrafts: async (kind) => Object.values(memDrafts).filter((d) => d.kind === kind).sort((x, y) => y.time - x.time)
    .map(({ id, kind: k, title, time, content }) => ({ id, kind: k, title, time, size: content.length })),
  readDraft: async (id) => memDrafts[id]?.content ?? '',
  delDraft: async (id) => { delete memDrafts[id]; },
};

export const api: SuiteBridge = window.suite ?? fallback;

export function fileName(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// Textul RTF al unui e-mail .msg (proprietatea PR_RTF_COMPRESSED, 0x1009): despachetat după specificația publică
// [MS-OXRTFCP] (LZFu: un dicționar de 4096 de octeți, pornit cu un text RTF fix), apoi, dacă e HTML pus în RTF
// (cuvântul de control fromhtml1, [MS-OXRTFEX]), HTML-ul scos înapoi din el. Mesajele scrise doar în RTF merg la cititorul .rtf din Docs.
// Fără bare inverse în sursă: unele unelte de editare le strică, așa că le facem din coduri (92).

const BS = 92, LB = 123, RB = 125;
const u32 = (b: Uint8Array, i: number) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;
const ch = String.fromCharCode;

/** Textul cu care pornește dicționarul (207 octeți), cu „|” în locul barei inverse. */
const PRE = Uint8Array.from(
  '{|rtf1|ansi|mac|deff0|deftab720{|fonttbl;}{|f0|fnil |froman |fswiss |fmodern |fscript |fdecor MS Sans SerifSymbolArialTimes New RomanCourier{|colortbl|red0|green0|blue0' + ch(13, 10) + '|par |pard|plain|f0|fs20|b|i|u|tab|tx',
  (c) => (c === '|' ? BS : c.charCodeAt(0)),
);

/** RTF-ul despachetat, sau null dacă blocul nu e RTF comprimat (LZFu) ori necomprimat (MELA). */
export function decompressRtf(b: Uint8Array): Uint8Array | null {
  if (b.length < 16) return null;
  const size = u32(b, 0), raw = u32(b, 4), type = u32(b, 8);
  if (raw > 64 * 1024 * 1024) return null;
  if (type === 0x414c454d) return b.subarray(16, Math.min(b.length, 16 + raw));
  if (type !== 0x75465a4c) return null;
  const dict = new Uint8Array(4096);
  dict.set(PRE);
  let wp = PRE.length;
  const out = new Uint8Array(raw);
  let o = 0, i = 16;
  const end = Math.min(b.length, size + 4);
  while (i < end && o < raw) {
    const ctrl = b[i++];
    for (let bit = 0; bit < 8 && o < raw; bit++) {
      if (i >= end) return out.subarray(0, o);
      if (ctrl & (1 << bit)) {
        if (i + 1 >= end) return out.subarray(0, o);
        const w = (b[i] << 8) | b[i + 1];
        i += 2;
        const off = w >> 4, len = (w & 15) + 2;
        if (off === wp) return out.subarray(0, o); // capătul datelor
        for (let k = 0; k < len && o < raw; k++) {
          const v = dict[(off + k) & 4095];
          out[o++] = v;
          dict[wp] = v;
          wp = (wp + 1) & 4095;
        }
      } else {
        const v = b[i++];
        out[o++] = v;
        dict[wp] = v;
        wp = (wp + 1) & 4095;
      }
    }
  }
  return out.subarray(0, o);
}

/** Grupurile care nu sunt text (tabelele de fonturi și culori, pozele, câmpurile ascunse…). */
const SKIP = new Set(['fonttbl', 'colortbl', 'stylesheet', 'info', 'pict', 'object', 'listtable', 'listoverridetable', 'generator', 'themedata', 'datastore', 'xmlnstbl', 'rsidtbl', 'fldinst', 'header', 'footer', 'mhtmltag']);
/** Cuvintele de control care sunt un singur semn. */
const SIGN: Record<string, string> = { par: ch(10), line: ch(10), tab: ch(9), lquote: ch(0x2018), rquote: ch(0x2019), ldblquote: ch(0x201c), rdblquote: ch(0x201d), bullet: ch(0x2022), endash: ch(0x2013), emdash: ch(0x2014), emspace: ch(0x2003), enspace: ch(0x2002) };
const isLetter = (c: number) => (c >= 97 && c <= 122) || (c >= 65 && c <= 90);
const isDigit = (c: number) => c >= 48 && c <= 57;

/** E RTF cu HTML înăuntru (fromhtml1, cum îl scrie programul de e-mail)? */
export function isHtmlRtf(rtf: Uint8Array): boolean {
  const head = ch(...rtf.subarray(0, Math.min(rtf.length, 2048)));
  return head.includes(ch(BS) + 'fromhtml1');
}

/** HTML-ul scos din RTF-ul cu HTML înăuntru: textul grupurilor htmltag și textul din afara lor care nu e ascuns cu htmlrtf. */
export function htmlFromRtf(rtf: Uint8Array): string {
  interface St { skip: boolean; tag: boolean; sup: boolean; uc: number }
  let st: St = { skip: false, tag: false, sup: false, uc: 1 };
  const stack: St[] = [];
  const out: string[] = [];
  let cp = 1252, star = false, uskip = 0;
  let bytes: number[] = [];
  const flush = () => {
    if (!bytes.length) return;
    const a = Uint8Array.from(bytes);
    bytes = [];
    let t: string;
    try { t = new TextDecoder(cp === 65001 ? 'utf-8' : 'windows-' + cp).decode(a); } catch { t = new TextDecoder('windows-1252').decode(a); }
    out.push(t);
  };
  const can = () => !st.skip && (st.tag || !st.sup);
  const emit = (s: string) => { if (can()) { flush(); out.push(s); } };
  const s = rtf;
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === LB) { flush(); stack.push({ ...st }); star = false; i++; continue; }
    if (c === RB) { flush(); st = stack.pop() ?? st; i++; continue; }
    if (c === BS) {
      const n = s[i + 1];
      if (isLetter(n)) {
        let j = i + 1;
        while (j < s.length && isLetter(s[j])) j++;
        const word = ch(...s.subarray(i + 1, j));
        let k = j;
        if (s[k] === 45) k++;
        while (k < s.length && isDigit(s[k])) k++;
        const hasParam = k > j && !(k === j + 1 && s[j] === 45);
        const param = hasParam ? parseInt(ch(...s.subarray(j, k)), 10) : NaN;
        if (s[k] === 32) k++;
        i = k;
        if (star) {
          star = false;
          if (word === 'htmltag') st.tag = true;
          else st.skip = true;
          continue;
        }
        if (SKIP.has(word)) { st.skip = true; continue; }
        if (word === 'htmlrtf') { flush(); st.sup = !hasParam || param !== 0; continue; }
        if (word === 'ansicpg' && hasParam) { cp = param; continue; }
        if (word === 'uc' && hasParam) { st.uc = Math.max(0, param); continue; }
        if (word === 'u' && hasParam) { emit(ch(param < 0 ? param + 65536 : param)); uskip = st.uc; continue; }
        const sign = SIGN[word];
        if (sign) emit(sign);
        continue;
      }
      if (n === 39) { // „'” + două cifre hexa: un octet în pagina de cod
        const v = parseInt(ch(s[i + 2] ?? 0, s[i + 3] ?? 0), 16);
        i += 4;
        if (uskip) { uskip--; continue; }
        if (can() && Number.isFinite(v)) bytes.push(v);
        continue;
      }
      i += 2;
      if (n === 42) { star = true; continue; }
      if (n === BS || n === LB || n === RB) emit(ch(n));
      else if (n === 13 || n === 10) emit(ch(10));
      else if (n === 126) emit(ch(160));
      continue;
    }
    i++;
    if (c === 13 || c === 10) continue;
    if (uskip) { uskip--; continue; }
    if (can()) { if (c < 128) { flush(); out.push(ch(c)); } else bytes.push(c); }
  }
  flush();
  return out.join('');
}

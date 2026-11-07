"""Etapa 3, pasul 3.1: generează setul de fișiere de test pentru documente
și foi de calcul.

Doar biblioteca standard Python, deci fișierele NU sunt produse de
bibliotecile evaluate în S4/S5 (testul ar fi altfel circular). Ieșirea este
deterministă: aceeași versiune a scriptului dă aceiași octeți, verificați cu
SHA-256 în MANIFEST.json.

    python testdata/etapa3/generate.py            # scrie files/ și large/
    python testdata/etapa3/generate.py --check    # doar verifică hash-urile

`files/` se publică în repo. `large/` (sute de pagini, 100k rânduri, bomba
zip) se regenerează local și nu se publică.
"""

import hashlib
import io
import json
import struct
import sys
import zipfile
import zlib
from pathlib import Path

HERE = Path(__file__).resolve().parent
FILES = HERE / "files"
LARGE = HERE / "large"
ZIP_TIME = (2026, 11, 7, 12, 0, 0)

entries = []  # (path relativ la HERE, așteptări)


def emit(path: Path, data: bytes, expect: dict):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    entries.append((path, expect))


# --------------------------------------------------------------------- PDF


def pdf_str(s: str) -> bytes:
    """Șir literal PDF în WinAnsi (doar caractere Latin-1)."""
    b = s.encode("cp1252")
    return b"(" + b.replace(b"\\", b"\\\\").replace(b"(", b"\\(").replace(b")", b"\\)") + b")"


def stream(dict_body: bytes, data: bytes, compress=True) -> bytes:
    if compress:
        data = zlib.compress(data, 9)
        dict_body += b" /Filter /FlateDecode"
    return b"<< " + dict_body + b" /Length %d >>\nstream\n" % len(data) + data + b"\nendstream"


def text_content(lines, x=72, y=760, size=12) -> bytes:
    out = [b"BT /F1 %d Tf %d %d Td %d TL" % (size, x, y, size + 4)]
    for ln in lines:
        out.append(pdf_str(ln) + b" Tj T*")
    out.append(b"ET")
    return b"\n".join(out)


def classic_pdf(objs, root=1, version=b"1.4", extra_trailer=b"") -> bytes:
    """objs[i] este corpul obiectului i+1. Tabel xref clasic."""
    out = bytearray(b"%PDF-" + version + b"\n%\xe2\xe3\xcf\xd3\n")
    offsets = []
    for i, body in enumerate(objs, start=1):
        offsets.append(len(out))
        out += b"%d 0 obj\n" % i + body + b"\nendobj\n"
    xref = len(out)
    out += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objs) + 1)
    for off in offsets:
        out += b"%010d 00000 n \n" % off
    out += b"trailer\n<< /Size %d /Root %d 0 R%s >>\nstartxref\n%d\n%%%%EOF\n" % (
        len(objs) + 1,
        root,
        extra_trailer,
        xref,
    )
    return bytes(out)


FONT = b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"
A4 = b"[0 0 595 842]"


def simple_pages_pdf(page_texts, rotate=None, boxes=None, compress=True, version=b"1.4"):
    """Catalog=1, Pages=2, Font=3, apoi câte (pagină, conținut) pe pagină."""
    n = len(page_texts)
    kids = b" ".join(b"%d 0 R" % (4 + 2 * i) for i in range(n))
    objs = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [" + kids + b"] /Count %d >>" % n,
        FONT,
    ]
    for i, lines in enumerate(page_texts):
        box = boxes[i] if boxes else A4
        rot = b" /Rotate %d" % rotate[i] if rotate else b""
        objs.append(
            b"<< /Type /Page /Parent 2 0 R /MediaBox " + box + rot
            + b" /Resources << /Font << /F1 3 0 R >> >> /Contents %d 0 R >>" % (5 + 2 * i)
        )
        objs.append(stream(b"", text_content(lines), compress))
    return classic_pdf(objs, version=version)


def pdf_files():
    d = FILES / "pdf"
    emit(
        d / "simplu-1-pagina.pdf",
        simple_pages_pdf([["K.G.B. test simplu", "Prima pagina, text necomprimat."]], compress=False),
        {"kind": "pdf", "pages": 1, "text": ["K.G.B. test simplu"]},
    )
    emit(
        d / "multipagina-50.pdf",
        simple_pages_pdf([[f"Pagina {i} din 50", f"Continut unic {i * 7919}"] for i in range(1, 51)]),
        {"kind": "pdf", "pages": 50, "text": ["Pagina 1 din 50", "Pagina 50 din 50", "Continut unic 395950"]},
    )
    emit(
        d / "rotite-si-formate.pdf",
        simple_pages_pdf(
            [["A4 portret, 0 grade"], ["A4, rotita 90"], ["Letter, rotita 180"], ["A4 peisaj, rotita 270"]],
            rotate=[0, 90, 180, 270],
            boxes=[A4, A4, b"[0 0 612 792]", b"[0 0 842 595]"],
        ),
        {"kind": "pdf", "pages": 4, "rotate": [0, 90, 180, 270], "text": ["Letter, rotita 180"]},
    )
    emit(d / "actualizare-incrementala.pdf", incremental_pdf(), {
        "kind": "pdf", "pages": 3,
        "text": ["Pagina 2 MODIFICATA", "Pagina 3 adaugata"],
        "text_absent": ["Pagina 2 originala"],
        "note": "a doua revizie înlocuiește pagina 2 și adaugă pagina 3",
    })
    emit(d / "xref-stream-pdf15.pdf", xref_stream_pdf(), {
        "kind": "pdf", "pages": 3, "text": ["Obiecte comprimate 3"],
        "note": "PDF 1.5: obiecte în ObjStm, tabel xref ca flux binar",
    })
    emit(d / "formular.pdf", form_pdf(), {
        "kind": "pdf", "pages": 1, "form_fields": {"Nume": "Ion Popescu", "Acord": "Yes"},
    })
    emit(d / "cu-imagine.pdf", image_pdf(), {
        "kind": "pdf", "pages": 1, "images": 1, "text": ["Imagine 64x64"],
    })
    emit(d / "semne-de-carte-si-legaturi.pdf", outline_pdf(), {
        "kind": "pdf", "pages": 3, "outlines": ["Capitolul 1", "Capitolul 2", "Capitolul 3"],
        "links": 1, "metadata": {"Title": "Test semne de carte", "Author": "K.G.B."},
    })

    # Fișiere stricate: trebuie refuzate clar sau recuperate explicit.
    good = simple_pages_pdf([[f"Pagina {i}"] for i in range(1, 11)])
    emit(d / "stricat-trunchiat.pdf", good[: int(len(good) * 0.6)], {
        "kind": "pdf", "broken": True, "note": "tăiat la 60%: fără xref, fără %%EOF"})
    flipped = bytearray(good)
    for k in range(400, 700, 7):
        flipped[k] ^= 0x5A
    emit(d / "stricat-octeti.pdf", bytes(flipped), {
        "kind": "pdf", "broken": True, "note": "octeți alterați în primele obiecte"})
    emit(d / "stricat-xref-gresit.pdf", wrong_xref(good), {
        "kind": "pdf", "broken": True, "recoverable": True, "pages": 10,
        "note": "offseturile din xref sunt deplasate; un cititor tolerant reconstruiește"})
    emit(d / "nu-e-pdf.pdf", "Acesta e un fișier text, nu un PDF.\n".encode(), {
        "kind": "pdf", "broken": True})
    emit(d / "gol.pdf", b"", {"kind": "pdf", "broken": True})
    deep = b"[" * 200_000 + b"]" * 200_000
    emit(d / "ostil-imbricare-adanca.pdf",
         classic_pdf([b"<< /Type /Catalog /Pages 2 0 R /X " + deep + b" >>",
                      b"<< /Type /Pages /Kids [] /Count 0 >>"]),
         {"kind": "pdf", "broken": True, "hostile": True,
          "note": "200.000 de tablouri imbricate: un parser recursiv fără limită se prăbușește"})


def incremental_pdf() -> bytes:
    base = simple_pages_pdf([["Pagina 1"], ["Pagina 2 originala"]], compress=False)
    prev_xref = int(base.rsplit(b"startxref\n", 1)[1].split(b"\n")[0])
    out = bytearray(base)
    # Revizia 2: pagina 2 primește conținut nou (obiect 7), se adaugă pagina 3 (8, 9).
    new = {
        2: b"<< /Type /Pages /Kids [4 0 R 6 0 R 8 0 R] /Count 3 >>",
        7: stream(b"", text_content(["Pagina 2 MODIFICATA"]), False),
        6: b"<< /Type /Page /Parent 2 0 R /MediaBox " + A4
           + b" /Resources << /Font << /F1 3 0 R >> >> /Contents 7 0 R >>",
        8: b"<< /Type /Page /Parent 2 0 R /MediaBox " + A4
           + b" /Resources << /Font << /F1 3 0 R >> >> /Contents 9 0 R >>",
        9: stream(b"", text_content(["Pagina 3 adaugata"]), False),
    }
    offs = {}
    for num in sorted(new):
        offs[num] = len(out)
        out += b"%d 0 obj\n" % num + new[num] + b"\nendobj\n"
    xref = len(out)
    out += b"xref\n"
    for num in sorted(offs):
        out += b"%d 1\n%010d 00000 n \n" % (num, offs[num])
    out += b"trailer\n<< /Size 10 /Root 1 0 R /Prev %d >>\nstartxref\n%d\n%%%%EOF\n" % (prev_xref, xref)
    return bytes(out)


def xref_stream_pdf() -> bytes:
    # 1 Catalog, 2 Pages, 3 Font, 4..6 pagini → în ObjStm 10; conținut 7..9; xref 11.
    compressed = {
        1: b"<< /Type /Catalog /Pages 2 0 R >>",
        2: b"<< /Type /Pages /Kids [4 0 R 5 0 R 6 0 R] /Count 3 >>",
        3: FONT,
    }
    for i in range(3):
        compressed[4 + i] = (b"<< /Type /Page /Parent 2 0 R /MediaBox " + A4
                             + b" /Resources << /Font << /F1 3 0 R >> >> /Contents %d 0 R >>" % (7 + i))
    header, body = bytearray(), bytearray()
    order = sorted(compressed)
    for num in order:
        header += b"%d %d " % (num, len(body))
        body += compressed[num] + b"\n"
    objstm = stream(b"/Type /ObjStm /N %d /First %d" % (len(order), len(header)), bytes(header + body))

    out = bytearray(b"%PDF-1.5\n%\xe2\xe3\xcf\xd3\n")
    offs = {}
    for i in range(3):
        offs[7 + i] = len(out)
        out += b"%d 0 obj\n" % (7 + i) + stream(b"", text_content([f"Obiecte comprimate {i + 1}"])) + b"\nendobj\n"
    offs[10] = len(out)
    out += b"10 0 obj\n" + objstm + b"\nendobj\n"
    offs[11] = len(out)
    rows = bytearray(struct.pack(">BIH", 0, 0, 65535))
    for num in range(1, 12):
        if num in compressed:
            rows += struct.pack(">BIH", 2, 10, order.index(num))
        else:
            rows += struct.pack(">BIH", 1, offs[num], 0)
    xref = stream(b"/Type /XRef /Size 12 /W [1 4 2] /Root 1 0 R", bytes(rows))
    out += b"11 0 obj\n" + xref + b"\nendobj\nstartxref\n%d\n%%%%EOF\n" % offs[11]
    return bytes(out)


def form_pdf() -> bytes:
    objs = [
        b"<< /Type /Catalog /Pages 2 0 R /AcroForm << /Fields [5 0 R 6 0 R] /NeedAppearances true"
        b" /DR << /Font << /F1 3 0 R >> >> /DA (/F1 12 Tf 0 g) >> >>",
        b"<< /Type /Pages /Kids [4 0 R] /Count 1 >>",
        FONT,
        b"<< /Type /Page /Parent 2 0 R /MediaBox " + A4
        + b" /Resources << /Font << /F1 3 0 R >> >> /Contents 7 0 R /Annots [5 0 R 6 0 R] >>",
        b"<< /Type /Annot /Subtype /Widget /FT /Tx /T (Nume) /V (Ion Popescu) /Rect [150 700 400 720]"
        b" /P 4 0 R /DA (/F1 12 Tf 0 g) /F 4 >>",
        b"<< /Type /Annot /Subtype /Widget /FT /Btn /T (Acord) /V /Yes /AS /Yes /Rect [150 660 165 675]"
        b" /P 4 0 R /F 4 >>",
        stream(b"", text_content(["Nume:", "", "Acord:"], y=705)),
    ]
    return classic_pdf(objs)


def image_pdf() -> bytes:
    w = h = 64
    px = bytearray()
    for y in range(h):
        for x in range(w):
            px += bytes((x * 4, y * 4, 128 if (x // 8 + y // 8) % 2 else 32))
    content = b"q 256 0 0 256 72 450 cm /Im1 Do Q\n" + text_content(["Imagine 64x64"], y=420)
    objs = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [4 0 R] /Count 1 >>",
        FONT,
        b"<< /Type /Page /Parent 2 0 R /MediaBox " + A4
        + b" /Resources << /Font << /F1 3 0 R >> /XObject << /Im1 6 0 R >> >> /Contents 5 0 R >>",
        stream(b"", content),
        stream(b"/Type /XObject /Subtype /Image /Width %d /Height %d /ColorSpace /DeviceRGB"
               b" /BitsPerComponent 8" % (w, h), bytes(px)),
    ]
    return classic_pdf(objs)


def outline_pdf() -> bytes:
    # 1 Catalog, 2 Pages, 3 Font, 4/6/8 pagini, 5/7/9 conținut, 10 Outlines, 11-13 intrări, 14 Info
    objs = [
        b"<< /Type /Catalog /Pages 2 0 R /Outlines 10 0 R /PageMode /UseOutlines >>",
        b"<< /Type /Pages /Kids [4 0 R 6 0 R 8 0 R] /Count 3 >>",
        FONT,
    ]
    for i in range(3):
        annots = b" /Annots [<< /Type /Annot /Subtype /Link /Rect [72 700 300 720] /Dest [8 0 R /Fit] >>]" if i == 0 else b""
        objs.append(b"<< /Type /Page /Parent 2 0 R /MediaBox " + A4
                    + b" /Resources << /Font << /F1 3 0 R >> >> /Contents %d 0 R" % (5 + 2 * i) + annots + b" >>")
        lines = [f"Capitolul {i + 1}"] + (["Legatura catre capitolul 3"] if i == 0 else [])
        objs.append(stream(b"", text_content(lines)))
    objs.append(b"<< /Type /Outlines /First 11 0 R /Last 13 0 R /Count 3 >>")
    for i in range(3):
        prev = b" /Prev %d 0 R" % (10 + i) if i > 0 else b""
        nxt = b" /Next %d 0 R" % (12 + i) if i < 2 else b""
        objs.append(b"<< /Title " + pdf_str(f"Capitolul {i + 1}") + b" /Parent 10 0 R /Dest [%d 0 R /Fit]" % (4 + 2 * i)
                    + prev + nxt + b" >>")
    objs.append(b"<< /Title (Test semne de carte) /Author (K.G.B.) /Producer (K.G.B. generate.py) >>")
    return classic_pdf(objs, extra_trailer=b" /Info 14 0 R")


def wrong_xref(good: bytes) -> bytes:
    head, tail = good.split(b"xref\n", 1)
    lines = tail.split(b"\n")
    fixed = [lines[0], lines[1]]
    for ln in lines[2:]:
        if ln.endswith(b" n ") and len(ln) == 19:
            ln = b"%010d" % (int(ln[:10]) + 13) + ln[10:]
        fixed.append(ln)
    return head + b"xref\n" + b"\n".join(fixed)


# -------------------------------------------------------------------- XLSX


def col_name(i: int) -> str:
    s = ""
    i += 1
    while i:
        i, r = divmod(i - 1, 26)
        s = chr(65 + r) + s
    return s


def esc(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


class Book:
    """Scriitor XLSX minimal, cu structura pe care o produce Excel."""

    def __init__(self):
        self.sheets = []  # (nume, xml)
        self.strings, self.sidx = [], {}
        self.defined_names = []
        self.sheet_rels = {}

    def s(self, text: str) -> int:
        if text not in self.sidx:
            self.sidx[text] = len(self.strings)
            self.strings.append(text)
        return self.sidx[text]

    def cell(self, ref, v, style=0):
        st = f' s="{style}"' if style else ""
        if v is None:
            return f'<c r="{ref}"{st}/>'
        if isinstance(v, tuple):  # (formulă, valoare în cache)
            f, cached = v
            if isinstance(cached, str):
                return f'<c r="{ref}"{st} t="str"><f>{esc(f)}</f><v>{esc(cached)}</v></c>'
            if isinstance(cached, bool):
                return f'<c r="{ref}"{st} t="b"><f>{esc(f)}</f><v>{int(cached)}</v></c>'
            return f'<c r="{ref}"{st}><f>{esc(f)}</f><v>{num(cached)}</v></c>'
        if isinstance(v, bool):
            return f'<c r="{ref}"{st} t="b"><v>{int(v)}</v></c>'
        if isinstance(v, (int, float)):
            return f'<c r="{ref}"{st}><v>{num(v)}</v></c>'
        if isinstance(v, Inline):
            return f'<c r="{ref}"{st} t="inlineStr"><is><t>{esc(v.text)}</t></is></c>'
        if isinstance(v, Err):
            return f'<c r="{ref}"{st} t="e"><v>{v.code}</v></c>'
        return f'<c r="{ref}"{st} t="s"><v>{self.s(v)}</v></c>'

    def add_sheet(self, name, rows, extra_before="", extra_after="", cols="", styles=None):
        out = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
               '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
               'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
               extra_before, cols, "<sheetData>"]
        for r, row in enumerate(rows, start=1):
            cells = "".join(
                self.cell(f"{col_name(c)}{r}", v, (styles or {}).get((r, c), 0))
                for c, v in enumerate(row) if v is not None or (styles or {}).get((r, c))
            )
            out.append(f'<row r="{r}">{cells}</row>')
        out.append("</sheetData>")
        out.append(extra_after)
        out.append("</worksheet>")
        self.sheets.append((name, "".join(out)))

    def bytes(self) -> bytes:
        n = len(self.sheets)
        ct = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
              '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
              '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
              '<Default Extension="xml" ContentType="application/xml"/>'
              '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>']
        for i in range(1, n + 1):
            ct.append(f'<Override PartName="/xl/worksheets/sheet{i}.xml" '
                      'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>')
        ct.append('<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>'
                  '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
                  '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>'
                  '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>'
                  '</Types>')
        rels = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
                '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
                '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>'
                '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>'
                '</Relationships>')
        sheets = "".join(f'<sheet name="{esc(nm)}" sheetId="{i}" r:id="rId{i}"/>' for i, (nm, _) in enumerate(self.sheets, 1))
        dn = ""
        if self.defined_names:
            dn = "<definedNames>" + "".join(f'<definedName name="{k}">{esc(v)}</definedName>' for k, v in self.defined_names) + "</definedNames>"
        wb = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
              '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
              'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
              f'<sheets>{sheets}</sheets>{dn}<calcPr calcId="191029"/></workbook>')
        wbrels = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
                  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">']
        for i in range(1, n + 1):
            wbrels.append(f'<Relationship Id="rId{i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet{i}.xml"/>')
        wbrels.append(f'<Relationship Id="rId{n + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>'
                      f'<Relationship Id="rId{n + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
                      '</Relationships>')
        sst = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
               f'<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="{len(self.strings)}" uniqueCount="{len(self.strings)}">']
        for t in self.strings:
            sp = ' xml:space="preserve"' if t != t.strip() or "\n" in t else ""
            sst.append(f"<si><t{sp}>{esc(t)}</t></si>")
        sst.append("</sst>")
        core = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
                '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" '
                'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" '
                'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
                '<dc:creator>K.G.B. generate.py</dc:creator>'
                '<dcterms:created xsi:type="dcterms:W3CDTF">2026-11-07T12:00:00Z</dcterms:created></cp:coreProperties>')
        app = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
               '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">'
               '<Application>Microsoft Excel</Application></Properties>')
        parts = [("[Content_Types].xml", "".join(ct)), ("_rels/.rels", rels), ("docProps/core.xml", core),
                 ("docProps/app.xml", app), ("xl/workbook.xml", wb), ("xl/_rels/workbook.xml.rels", "".join(wbrels))]
        for i, (_, xml) in enumerate(self.sheets, 1):
            parts.append((f"xl/worksheets/sheet{i}.xml", xml))
            if i in self.sheet_rels:
                parts.append((f"xl/worksheets/_rels/sheet{i}.xml.rels", self.sheet_rels[i]))
        parts += [("xl/sharedStrings.xml", "".join(sst)), ("xl/styles.xml", STYLES)]
        return zip_bytes(parts)


class Inline:
    def __init__(self, text):
        self.text = text


class Err:
    def __init__(self, code):
        self.code = code


def num(v) -> str:
    if isinstance(v, int):
        return str(v)
    r = repr(round(v, 10))
    return r[:-2] if r.endswith(".0") else r


def zip_bytes(parts) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for name, data in parts:
            info = zipfile.ZipInfo(name, ZIP_TIME)
            info.compress_type = zipfile.ZIP_DEFLATED
            z.writestr(info, data.encode("utf-8") if isinstance(data, str) else data)
    return buf.getvalue()


# Stiluri: 0 implicit, 1 bold, 2 dată (zz.ll.aaaa), 3 lei cu 2 zecimale, 4 procent,
# 5 bold + fundal galben + chenar, 6 text încadrat (wrap).
STYLES = (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    '<numFmts count="2"><numFmt numFmtId="164" formatCode="dd\\.mm\\.yyyy"/>'
    '<numFmt numFmtId="165" formatCode="#,##0.00\\ &quot;lei&quot;"/></numFmts>'
    '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>'
    '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>'
    '<fill><patternFill patternType="solid"><fgColor rgb="FFFFFF00"/></patternFill></fill></fills>'
    '<borders count="2"><border/><border><left style="thin"/><right style="thin"/><top style="thin"/><bottom style="thin"/></border></borders>'
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
    '<cellXfs count="7"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
    '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>'
    '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
    '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
    '<xf numFmtId="10" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
    '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>'
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1"/></xf>'
    '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
    '<dxfs count="1"><dxf><font><color rgb="FFFF0000"/></font></dxf></dxfs></styleSheet>'
)


def pmt(rate, n, pv):
    return -pv * rate / (1 - (1 + rate) ** -n)


def xlsx_files():
    d = FILES / "xlsx"

    b = Book()
    rows = [["Produs", "Cantitate", "Pret"]] + [[f"Produs {i}", i * 3, round(i * 2.5, 2)] for i in range(1, 11)]
    b.add_sheet("Date", rows)
    emit(d / "simplu.xlsx", b.bytes(), {"kind": "xlsx", "sheets": ["Date"], "cells": {
        "Date!A1": "Produs", "Date!B11": 30, "Date!C4": 7.5}})

    b = Book()
    b.add_sheet("Ianuarie", [["Categorie", "Sumă"], ["Încasări școală", 1200.5], ["Țesături", 300]])
    b.add_sheet("Februarie", [["Categorie", "Sumă"], ["Încasări școală", 980.25], ["Țesături", 410]])
    b.add_sheet("Sumar ș ț", [["Total încasări", ("Ianuarie!B2+Februarie!B2", 2180.75)],
                              ["ĂÂÎȘȚ ăâîșț", ("SUM(Ianuarie!B2:B3,Februarie!B2:B3)", 2890.75)]])
    emit(d / "diacritice-foi-multiple.xlsx", b.bytes(), {"kind": "xlsx",
         "sheets": ["Ianuarie", "Februarie", "Sumar ș ț"], "cells": {
             "Ianuarie!A2": "Încasări școală", "'Sumar ș ț'!B1": 2180.75, "'Sumar ș ț'!A2": "ĂÂÎȘȚ ăâîșț"},
         "formulas": {"'Sumar ș ț'!B1": "Ianuarie!B2+Februarie!B2"}})

    vals = [12, 7.5, 30, 18.25, 4]
    names = ["mere", "pere", "prune", "mere", "caise"]
    rows = [["Nume", "Valoare"]] + [[n, v] for n, v in zip(names, vals)]
    s = sum(vals)
    mere = sum(v for n, v in zip(names, vals) if n == "mere")
    rate = pmt(0.08 / 12, 60, 50000)
    rows += [
        [],
        ["SUM", ("SUM(B2:B6)", s)],
        ["AVERAGE", ("AVERAGE(B2:B6)", s / 5)],
        ["IF", ('IF(B9>50,"mare","mic")', "mare" if s > 50 else "mic")],
        ["ROUND", ("ROUND(B10,1)", round(s / 5, 1))],
        ["VLOOKUP", ('VLOOKUP("prune",A2:B6,2,FALSE)', 30)],
        ["SUMIF", ('SUMIF(A2:A6,"mere",B2:B6)', mere)],
        ["COUNTIF", ('COUNTIF(B2:B6,">10")', sum(1 for v in vals if v > 10))],
        ["Concatenare", ('A2&" "&A3', "mere pere")],
        ["Absolut", ("$B$2*B3", 12 * 7.5)],
        ["PMT", ("PMT(0.08/12,60,50000)", rate)],
        ["MAX/MIN", ("MAX(B2:B6)-MIN(B2:B6)", 26)],
        ["Logic", ("AND(B2>10,B3<10)", True)],
    ]
    b = Book()
    b.add_sheet("Formule", rows)
    emit(d / "formule.xlsx", b.bytes(), {"kind": "xlsx", "sheets": ["Formule"], "cells": {
        "Formule!B8": s, "Formule!B9": s / 5, "Formule!B10": "mare", "Formule!B12": 30, "Formule!B13": mere,
        "Formule!B17": round(rate, 6), "Formule!B19": True},
        "formulas": {"Formule!B8": "SUM(B2:B6)", "Formule!B12": 'VLOOKUP("prune",A2:B6,2,FALSE)'},
        "note": "valorile din cache sunt calculate în Python; PMT rotunjit la 6 zecimale în așteptări"})

    # Formate: dată ca număr serial (46333 = 07.11.2026), lei, procent, bold, celule unite.
    b = Book()
    styles = {(1, 0): 5, (1, 1): 5, (1, 2): 5, (2, 1): 2, (2, 2): 3, (3, 1): 2, (3, 2): 3, (4, 2): 4, (6, 0): 6}
    b.add_sheet("Formate", [
        ["Document", "Data", "Suma"],
        ["Factura 1", 46333, 1234.5],
        ["Factura 2", 46334, 99.99],
        ["Marja", None, 0.1825],
        ["Titlu unit pe trei coloane", None, None],
        ["Text lung care trebuie încadrat pe mai multe rânduri în celulă", None, None],
    ], cols='<cols><col min="1" max="1" width="32" customWidth="1"/><col min="2" max="3" width="14" customWidth="1"/></cols>',
        extra_before='<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>',
        extra_after='<mergeCells count="1"><mergeCell ref="A5:C5"/></mergeCells>', styles=styles)
    emit(d / "formate.xlsx", b.bytes(), {"kind": "xlsx", "sheets": ["Formate"], "cells": {
        "Formate!B2": 46333, "Formate!C2": 1234.5}, "number_formats": {
        "Formate!B2": "dd\\.mm\\.yyyy", "Formate!C2": '#,##0.00\\ "lei"', "Formate!C4": "0.00%"},
        "merged": ["Formate!A5:C5"], "frozen_rows": 1, "col_widths": {"A": 32}})

    # Funcții pe care unele biblioteci le pierd la salvare.
    b = Book()
    b.defined_names.append(("Preturi", "Avansat!$B$2:$B$4"))
    b.add_sheet("Avansat", [
        ["Stare", "Pret", "Legatura"],
        ["activ", 10, "kronos"],
        ["inactiv", 55, None],
        ["activ", 120, None],
        ["Total", ("SUM(Preturi)", 185)],
    ], extra_after=(
        '<conditionalFormatting sqref="B2:B4"><cfRule type="cellIs" dxfId="0" priority="1" operator="greaterThan">'
        '<formula>50</formula></cfRule></conditionalFormatting>'
        '<dataValidations count="1"><dataValidation type="list" allowBlank="1" sqref="A2:A4">'
        '<formula1>"activ,inactiv"</formula1></dataValidation></dataValidations>'
        '<hyperlinks><hyperlink ref="C2" r:id="rId1"/></hyperlinks>'))
    b.sheet_rels[1] = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
                       '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                       '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" '
                       'Target="https://example.com/" TargetMode="External"/></Relationships>')
    emit(d / "functii-avansate.xlsx", b.bytes(), {"kind": "xlsx", "sheets": ["Avansat"], "cells": {"Avansat!B5": 185},
         "preserve": ["conditionalFormatting", "dataValidation", "hyperlink", "definedName Preturi"],
         "note": "măsurăm ce păstrează fiecare bibliotecă la deschidere → salvare"})

    b = Book()
    b.add_sheet("Tipuri", [
        ["inline", Inline("text inline ș")],
        ["bool", True],
        ["eroare", Err("#DIV/0!")],
        ["formula-text", ('"a"&"b"', "ab")],
        ["negativ", -0.000125],
        ["mare", 123456789012345],
        ["spatii", "  cu spații la capete  "],
        ["rand-nou", "linia 1\nlinia 2"],
    ])
    emit(d / "tipuri-celule.xlsx", b.bytes(), {"kind": "xlsx", "sheets": ["Tipuri"], "cells": {
        "Tipuri!B1": "text inline ș", "Tipuri!B2": True, "Tipuri!B3": "#DIV/0!", "Tipuri!B5": -0.000125,
        "Tipuri!B6": 123456789012345, "Tipuri!B7": "  cu spații la capete  ", "Tipuri!B8": "linia 1\nlinia 2"}})

    good = (d / "simplu.xlsx").read_bytes()
    emit(d / "stricat-trunchiat.xlsx", good[: len(good) // 2], {"kind": "xlsx", "broken": True})
    emit(d / "nu-e-zip.xlsx", b"Nu sunt o arhiva ZIP.\n", {"kind": "xlsx", "broken": True})
    emit(d / "zip-fara-workbook.xlsx", zip_bytes([("readme.txt", "gol")]), {"kind": "xlsx", "broken": True})
    flipped = bytearray(good)
    for k in range(200, len(flipped) - 200, 97):
        flipped[k] ^= 0xFF
    emit(d / "stricat-octeti.xlsx", bytes(flipped), {"kind": "xlsx", "broken": True,
         "note": "CRC-urile ZIP nu mai corespund"})


# --------------------------------------------------------------------- CSV


def csv_files():
    d = FILES / "csv"
    emit(d / "utf8-bom-virgula.csv",
         "﻿Nume,Oraș,Suma\r\nIon,București,100.5\r\nȘtefan,Țăndărei,20\r\n".encode("utf-8"),
         {"kind": "csv", "encoding": "utf-8-sig", "delimiter": ",", "rows": 3, "cells": {"B2": "București"}})
    emit(d / "ro-punct-si-virgula.csv",
         "Data;Descriere;Suma\n07.11.2026;Plată furnizor;-1.234,56\n08.11.2026;Încasare;980,00\n".encode("utf-8"),
         {"kind": "csv", "encoding": "utf-8", "delimiter": ";", "decimal": ",", "thousands": ".",
          "rows": 3, "cells": {"C2": "-1.234,56"}, "parsed": {"C2": -1234.56, "A2": "2026-11-07"}})
    emit(d / "windows-1250.csv",
         "Nume;Localitate\r\nŞtefan;Ţăndărei\r\nIoana;Brăila\r\n".encode("cp1250"),
         {"kind": "csv", "encoding": "cp1250", "delimiter": ";", "rows": 3, "cells": {"B2": "Ţăndărei"},
          "note": "codificare veche Windows; Ş/Ţ cu sedilă, cum le scriau programele vechi"})
    emit(d / "ghilimele-multilinie.csv",
         'id,text\r\n1,"are, virgulă"\r\n2,"are ""ghilimele"""\r\n3,"pe două\r\nrânduri"\r\n'.encode("utf-8"),
         {"kind": "csv", "encoding": "utf-8", "delimiter": ",", "rows": 4, "cells": {
             "B2": "are, virgulă", "B3": 'are "ghilimele"', "B4": "pe două\r\nrânduri"}})
    emit(d / "randuri-inegale.csv", b"a,b,c\n1,2\n3,4,5,6\n\n7\n",
         {"kind": "csv", "encoding": "utf-8", "delimiter": ",", "rows": 5, "ragged": True})


# ------------------------------------------------------------------- mari


def large_files():
    pages = [[f"Pagina {i} din 500", f"Rand de control {i * 31}"] + [f"Linie {k} pe pagina {i}" for k in range(30)]
             for i in range(1, 501)]
    emit(LARGE / "mare-500-pagini.pdf", simple_pages_pdf(pages),
         {"kind": "pdf", "pages": 500, "text": ["Pagina 500 din 500"], "large": True})

    b = Book()
    rows = [["id", "data", "client", "suma", "tva", "total"]]
    for i in range(1, 100_001):
        suma = (i * 37) % 10_000 / 100
        rows.append([i, 45658 + i % 365, f"Client {i % 977}", suma, ("ROUND(D%d*0.19,2)" % (i + 1), round(suma * 0.19, 2)),
                     ("D%d+E%d" % (i + 1, i + 1), round(suma + round(suma * 0.19, 2), 2))])
    b.add_sheet("Vanzari", rows)
    emit(LARGE / "100k-randuri.xlsx", b.bytes(), {"kind": "xlsx", "sheets": ["Vanzari"], "rows": 100_001,
         "cells": {"Vanzari!A100001": 100000}, "large": True})

    lines = ["id;client;suma"] + [f"{i};Client {i % 977};{(i * 37) % 10_000 / 100:.2f}".replace(".", ",") for i in range(1, 100_001)]
    emit(LARGE / "100k-randuri.csv", ("\n".join(lines) + "\n").encode(), {"kind": "csv", "delimiter": ";",
         "rows": 100_001, "large": True})

    # Bomba ZIP: o foaie de 200 MB de spații comprimată în ~200 KB.
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        base = Book()
        base.add_sheet("S", [["x"]])
        src = zipfile.ZipFile(io.BytesIO(base.bytes()))
        for name in src.namelist():
            info = zipfile.ZipInfo(name, ZIP_TIME)
            info.compress_type = zipfile.ZIP_DEFLATED
            if name == "xl/worksheets/sheet1.xml":
                with z.open(info, "w") as w:
                    w.write(b'<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>')
                    chunk = b" " * (1 << 20)
                    for _ in range(200):
                        w.write(chunk)
                    w.write(b"</sheetData></worksheet>")
            else:
                z.writestr(info, src.read(name))
    emit(LARGE / "ostil-bomba-zip.xlsx", buf.getvalue(), {"kind": "xlsx", "broken": True, "hostile": True,
         "note": "200 MB după dezarhivare; trebuie refuzat de limita de mărime, nu încărcat în memorie"})


# --------------------------------------------------------------- manifest


def sha256(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    check = "--check" in sys.argv
    if check:
        manifest = json.loads((HERE / "MANIFEST.json").read_text(encoding="utf-8"))
        bad = 0
        for f in manifest["files"]:
            p = HERE / f["path"]
            if not p.exists():
                print(f"LIPSĂ  {f['path']}" + (" (mare: rulează generate.py)" if f.get("large") else ""))
                bad += not f.get("large")
            elif sha256(p) != f["sha256"]:
                print(f"DIFERIT {f['path']}")
                bad += 1
        print("OK" if not bad else f"{bad} probleme")
        sys.exit(1 if bad else 0)

    pdf_files()
    xlsx_files()
    csv_files()
    large_files()
    files = []
    for p, expect in entries:
        rel = p.relative_to(HERE).as_posix()
        files.append({"path": rel, "size": p.stat().st_size, "sha256": sha256(p),
                      "producer": "generate.py", **expect, **({"large": True} if p.is_relative_to(LARGE) else {})})
    # Fișierele produse de Edge (motor real de tipărire PDF) se păstrează; nu sunt deterministe.
    for p in sorted((FILES / "edge").glob("*.pdf")):
        meta = json.loads(p.with_suffix(".json").read_text(encoding="utf-8"))
        files.append({"path": p.relative_to(HERE).as_posix(), "size": p.stat().st_size, "sha256": sha256(p),
                      "producer": "Microsoft Edge --print-to-pdf", **meta})
    (HERE / "MANIFEST.json").write_text(
        json.dumps({"format": 1, "generator": "testdata/etapa3/generate.py", "files": files},
                   ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{len(files)} fișiere")


if __name__ == "__main__":
    main()

"""Etapa 3: copiază fișierele publice de test din corpusul suitei de birou a
proprietarului (D-037) în `testdata/etapa3/extern/`, care NU se publică.

Sursa e doar citită: nu se modifică nimic acolo (regula proprietarului). Fiecare
fișier are proveniența în SURSE.md din corpus (Apache POI, LibreOffice, pdf.js,
Apache Commons CSV, XlsxWriter, formulare publice ANAF); lista copiată, cu
SHA-256, se scrie în `extern/MANIFEST.json`.

    python testdata/etapa3/extern.py [cale-corpus]
"""

import hashlib
import json
import shutil
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
DEFAULT = Path.home() / "Desktop" / "workspace" / "test-corpus"
KINDS = ["pdf", "xlsx", "xlsm", "xlsb", "xls", "ods", "csv"]


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT
    if not (src / "SURSE.md").exists():
        print(f"Corpusul nu există: {src}")
        sys.exit(1)
    sources = {}
    for line in (src / "SURSE.md").read_text(encoding="utf-8").splitlines():
        cells = [c.strip() for c in line.split("|")]
        if len(cells) > 3 and "/" in cells[1]:
            sources[cells[1]] = {"project": cells[2], "url": cells[3]}
    out = HERE / "extern"
    files = []
    for kind in KINDS:
        for p in sorted((src / kind).glob("*")):
            if not p.is_file():
                continue
            rel = f"{kind}/{p.name}"
            dst = out / rel
            dst.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(p, dst)
            data = dst.read_bytes()
            files.append({"path": rel, "size": len(data), "sha256": hashlib.sha256(data).hexdigest(),
                          **sources.get(rel, {"project": "necunoscut"})})
    (out / "MANIFEST.json").write_text(json.dumps({"source": str(src), "files": files}, ensure_ascii=False, indent=1) + "\n",
                                       encoding="utf-8")
    by = {}
    for f in files:
        by.setdefault(f["path"].split("/")[0], 0)
        by[f["path"].split("/")[0]] += 1
    print(f"{len(files)} fișiere copiate: {by}")
    unknown = [f["path"] for f in files if f["project"] == "necunoscut"]
    if unknown:
        print("fără proveniență în SURSE.md:", unknown)


if __name__ == "__main__":
    main()

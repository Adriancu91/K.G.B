// The digital signature of a PDF, as in Cyber Office Studio (7.4l-0c, D-078, D-085): COS's "Semnează digital"
// window (SignDigital.tsx), its signing (digisign.ts: CMS, visible or invisible field, certification) and its check
// of the signatures (signatures.ts, verifySig.ts), unchanged. K.G.B. lends it what Electron gave COS: the
// certificates of Windows and of the token (wincert.rs; the PIN is asked by Windows, never seen here). The signed
// PDF goes through the PDF module's checks and a preview and becomes a new version; the original stays.
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { api as cosApi, type WinCert } from "../../../cos/src/api";
import { signPdf } from "../../../cos/src/pdf/digisign";
import { DigiSignDialog, NEW_SPOT, sigAppearance, type SignRequest } from "../../../cos/src/pdf/SignDigital";
import { emptySigFields } from "../../../cos/src/pdf/sign";
import { readSignatures } from "../../../cos/src/pdf/signatures";
import { verifySignature } from "../../../cos/src/pdf/verifySig";
import "../../../cos/src/pdf/digisign.css";

const b64 = (b: Uint8Array) => {
  let s = "";
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
};
const unb64 = (t: string) => Uint8Array.from(atob(t), (c) => c.charCodeAt(0));

// What Electron's preload gave COS: the certificates of Windows / the token, through the core (wincert.rs).
Object.assign(cosApi, {
  listWinCerts: () => invoke<WinCert[]>("wincert_list"),
  signWinCert: async (thumb: string, data: Uint8Array, ec: boolean) => unb64(await invoke<string>("wincert_sign", { thumb, data: b64(data), ec })),
});

export { NEW_SPOT };
export type { SignRequest };

/** The signatures of a PDF and whether each one still holds (COS's check). */
export interface SigState {
  count: number;
  valid: number;
  names: string[];
  certified: boolean;
}
export async function signaturesOf(bytes: Uint8Array): Promise<SigState> {
  const sigs = readSignatures(bytes);
  const checks = await Promise.all(sigs.map((s) => verifySignature(bytes, s).catch(() => ({ ok: false }))));
  return {
    count: sigs.length,
    valid: checks.filter((c) => c.ok === true).length,
    names: sigs.map((s) => s.name || s.cert?.name || "").filter(Boolean),
    certified: sigs.some((s) => s.kind !== "sign"),
  };
}

/** COS's signing of the bytes, with the place drawn on the page when the signature is a new visible one. */
export async function signedPdf(
  bytes: Uint8Array,
  r: SignRequest,
  place?: { page: number; x: number; y: number; w: number; h: number; rot: number },
): Promise<Uint8Array> {
  if (r.tsa) throw new Error("Marca temporală nu e încă disponibilă în K.G.B.: semnează fără ea.");
  const appearance = place ? sigAppearance(r.id.owner.name, new Date(), r.reason, place.w, place.h, place.rot) : r.appearance;
  return signPdf(bytes, r.id, {
    field: r.field || undefined,
    reason: r.reason,
    location: r.location,
    ...(appearance ? { appearance } : {}),
    ...(place ? { place: { page: place.page, x: place.x, y: place.y, w: place.w, h: place.h } } : {}),
    ...(r.certify ? { certify: r.certify } : {}),
  });
}

/** The "Semnează digital" window over the PDF of the current version. */
export function DigiSignPanel(props: {
  bytes: Uint8Array;
  sigs: SigState | null;
  onSign: (r: SignRequest, fields: { name: string; page: number }[]) => Promise<void>;
  onClose: () => void;
}) {
  const [fields, setFields] = useState<{ name: string; page: number; w?: number; h?: number }[] | null>(null);
  useEffect(() => {
    emptySigFields(props.bytes).then(setFields, () => setFields([]));
  }, [props.bytes]);
  if (!fields) return null;
  return (
    <DigiSignDialog
      fields={fields}
      hasSigs={(props.sigs?.count ?? 0) > 0}
      certified={props.sigs?.certified ?? false}
      onSign={(r) => props.onSign(r, fields)}
      onClose={props.onClose}
    />
  );
}

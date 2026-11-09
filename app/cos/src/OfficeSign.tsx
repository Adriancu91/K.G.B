// Copiat neschimbat din Cyber Office Studio (aplicația proprietarului, D-071); vezi app/cos/README.md.
// @ts-nocheck
// „Export … semnat digital…” din Docs, Sheets și Slides: aceeași fereastră de semnare ca în PDF (ID-ul digital Suite, .pfx,
// certificatul de pe calculator sau de pe token), apoi fișierul exportat (.docx / .xlsx / .pptx) primește semnătura în interior
// (xmlSign.ts). Fereastra și semnarea se încarcă doar la nevoie.
import { lazy, Suspense } from 'react';
import type { DigitalId, TsaClient } from './pdf/digisign';
import { api } from './api';

const Dlg = lazy(() => import('./pdf/SignDigital').then((m) => ({ default: m.DigiSignDialog })));

export function OfficeSignDialog(props: { name: string; onSign: (id: DigitalId, tsa?: TsaClient) => Promise<void>; onClose: () => void }) {
  return (
    <Suspense fallback={null}>
      <Dlg fields={[]} file={props.name} office exporting hasSigs={false} onSign={(r) => props.onSign(r.id, r.tsa ? tsaClient(r.tsa) : undefined)} onClose={props.onClose} />
    </Suspense>
  );
}

/** Pune semnătura digitală în pachetul `data` (.docx / .xlsx / .pptx), cu marca temporală dacă s-a cerut. */
export async function signPackage(data: Uint8Array, id: DigitalId, tsa?: TsaClient): Promise<Uint8Array> {
  const { signOfficePackage } = await import('./xmlSign');
  return signOfficePackage(data, id, new Date(), tsa ? { tsa } : {});
}

/** Serverul de marcă temporală de la adresa `url`: în aplicația instalată prin procesul principal; în browser direct (dacă serverul permite). */
export function tsaClient(url: string): TsaClient {
  return (req: Uint8Array) => (api.tsaStamp
    ? api.tsaStamp(url, req).catch((e: Error) => { throw new Error(e.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')); })
    : fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/timestamp-query' }, body: req as Uint8Array<ArrayBuffer> }).then(async (x) => new Uint8Array(await x.arrayBuffer())));
}

// Opening a page at a given place (Etapa 7, step 7.4d): a start-page tile
// asks the Business page to open on "Scadențar" rather than "Stoc". The
// request is kept for the next page that asks for it, once.
const pending = new Map<string, string>();

export function setIntent(page: string, what: string) {
  pending.set(page, what);
}

export function takeIntent(page: string): string | undefined {
  const v = pending.get(page);
  pending.delete(page);
  return v;
}

/** The sending pipeline's notion of "now". A seam so the window/limit/backoff behaviour can be tested across days. */
let clock: () => Date = () => new Date();
export const now = (): Date => clock();
export function setClock(fn: (() => Date) | null): void {
  clock = fn ?? (() => new Date());
}

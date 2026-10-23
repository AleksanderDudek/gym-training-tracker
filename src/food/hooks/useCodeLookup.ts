import { useCallback, useEffect, useRef, useState } from 'react';
import type { Dictionaries, Product } from '../lib/types';
import { digitsOf, findByCode, isInStoreCode, isShopCode } from '../scan/barcode';
import { itemFromOff, itemFromProduct, type ScanItem } from '../scan/compare';
import { fetchOff } from '../scan/off';

export type Lookup =
  | { status: 'idle' }
  | { status: 'searching'; code: string }
  | { status: 'found'; code: string; item: ScanItem; product: Product | null }
  /** Nobody knows it: a shop's own code (weighed goods), or a product nobody has entered yet. */
  | { status: 'unknown'; code: string; inStore: boolean; valid: boolean }
  /** Not in the dataset, and Open Food Facts did not answer. */
  | { status: 'failed'; code: string };

const IDLE: Lookup = { status: 'idle' };

/**
 * A scanned or typed code to a product: the app's dataset first (instant, offline), then Open Food
 * Facts for what the dataset does not have. A newer code wins over a slower answer for an older one.
 * Returns the final result too, so the caller can act on it (add it to the comparison, select it).
 */
export function useCodeLookup(
  products: readonly Product[],
  dict: Dictionaries,
): [Lookup, (raw: string) => Promise<Lookup>] {
  const [lookup, setLookup] = useState<Lookup>(IDLE);
  // Built at the first scan, not whenever „Dodaj zjedzone” opens: 29 thousand codes for a scan or none.
  const index = useRef<{ of: readonly Product[]; byCode: Map<string, Product> } | null>(null);
  const latest = useRef(0);
  const pending = useRef<AbortController | null>(null);

  useEffect(() => () => pending.current?.abort(), []);

  const look = useCallback(
    async (raw: string): Promise<Lookup> => {
      const code = digitsOf(raw);
      const ticket = ++latest.current;
      pending.current?.abort();
      const settle = (result: Lookup) => {
        if (ticket === latest.current) setLookup(result);
        return result;
      };
      if (index.current?.of !== products) index.current = { of: products, byCode: new Map(products.map((p) => [p.code, p])) };
      const product = findByCode(index.current.byCode, code);
      if (product) return settle({ status: 'found', code, item: itemFromProduct(product, dict, Date.now()), product });
      if (isInStoreCode(code)) return settle({ status: 'unknown', code, inStore: true, valid: true });
      settle({ status: 'searching', code });
      const controller = new AbortController();
      pending.current = controller;
      try {
        const off = await fetchOff(code, { signal: controller.signal });
        return settle(
          off && off.name
            ? { status: 'found', code, item: itemFromOff(off, Date.now()), product: null }
            : { status: 'unknown', code, inStore: false, valid: isShopCode(code) },
        );
      } catch {
        if (controller.signal.aborted) return { status: 'idle' };
        return settle({ status: 'failed', code });
      }
    },
    [products, dict],
  );

  return [lookup, look];
}

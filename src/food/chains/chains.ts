/**
 * Store chains with product data of their own in ./data — chains you walk into (unlike the online
 * shops), whose sites publish their products with nutrition. Static, so code that only needs to
 * name them (the data footer) does not load the data. `chains.test.ts` keeps it equal to the files.
 */
export interface DataChain {
  /** Store key, as `storeKey` folds the chain's name. */
  id: string;
  name: string;
  /** Home page, https. */
  url: string;
}

export const DATA_CHAINS: readonly DataChain[] = [{ id: 'selgros', name: 'Selgros', url: 'https://www.selgros.pl' }];

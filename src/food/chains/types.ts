// The data contract of a store chain with its own product data (one JSON file per chain in ./data):
// products of a chain you walk into, read from the chain's own site. Unlike an online shop, nothing
// is delivered: the chain is a store like any other, the file only says what it sells.
import type { ShopNutrition } from '../online/types';

export interface ChainProductData {
  /** EAN-13 / EAN-8 of the unit sold one at a time; checksum-valid. */
  ean: string;
  /** The chain's own article number: its product page is `productUrl` with it. */
  id: string;
  name: string;
  brand: string | null;
  /** Net pack size: "400 g", "6 x 200 ml". */
  quantity: string | null;
  /** Open Food Facts category tags (with their parents) worked out from the chain's category and the name. */
  categories: string[];
  /** Open Food Facts allergen tags the chain's page says "Tak" to. */
  allergens: string[];
  /** Per 100 g (or 100 ml). */
  nutrition: ShopNutrition;
  /** Regular gross price in PLN on the day the data was read (not a promotion). */
  price: number | null;
  /** The price is per kilogram (sold by weight). */
  perKg?: true;
}

export interface ChainData {
  /** Store key, the same the rest of the app uses (`storeKey`): "selgros". */
  id: string;
  name: string;
  url: string;
  /** A product's page: this address with `{id}` replaced by the product's article number. */
  productUrl: string;
  /** YYYY-MM-DD */
  checked: string;
  /** The hall whose prices and stock were read. */
  hall: string | null;
  note?: string;
  /** EANs whose label does not add up (energy vs macros), kept as published. */
  inconsistent?: string[];
  products: ChainProductData[];
}

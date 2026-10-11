export interface LatLon {
  lat: number;
  lon: number;
}

/** A shop as OpenStreetMap describes it, independent of where the user stands. */
export interface Shop {
  /** `node/123`, `way/456`: unique across element types. */
  id: string;
  name: string;
  /** Our chain key (biedronka, lidl, ...) or a slug for an independent shop. */
  chain: string | null;
  lat: number;
  lon: number;
  address: string | null;
  openingHours: string | null;
}

/** A shop seen from the user's position. */
export interface PlacedShop extends Shop {
  distance: number;
}

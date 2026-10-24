/** Baza produktów wydana przez `vite/foodData.ts`; wszystkie pola `null`, gdy builda zrobiono bez niej. */
declare module 'virtual:food-data' {
  const data: { url: string | null; version: string | null; generatedAt: string | null };
  export default data;
}

/**
 * Dane OSM „W pobliżu” wydane przez `vite/osmPlaces.ts`: adres indeksu (względem `BASE_URL`), albo
 * `null` w testach i w buildzie bez danych — wtedy strona pyta Overpass jak dawniej.
 */
declare module 'virtual:osm-places' {
  const data: { index: string | null };
  export default data;
}

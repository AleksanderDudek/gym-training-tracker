/** Baza produktów wydana przez `vite/foodData.ts`; wszystkie pola `null`, gdy builda zrobiono bez niej. */
declare module 'virtual:food-data' {
  const data: { url: string | null; version: string | null; generatedAt: string | null };
  export default data;
}

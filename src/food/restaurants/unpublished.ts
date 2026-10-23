/**
 * Chains checked and found NOT to publish a nutrition table with full macros from their own
 * sources (only aggregators have numbers, or only kcal, or nothing). On the map their venues have
 * no menu here; the place card says why instead of "unknown menu". Names are proper nouns; `brands`
 * are their OpenStreetMap brand tags, matched like the menus' (`brandIndex`).
 */
export interface Unpublished {
  name: string;
  osm: { brands: string[] };
  /** What the chain does publish, when anything: only energy, only allergens, values per 100 g without portion weights. */
  partial?: 'kcal' | 'allergens' | 'per100';
  /** When it was checked (YYYY-MM). */
  checked: string;
}

export const UNPUBLISHED: Unpublished[] = [
  { name: "Domino's Pizza", osm: { brands: ["Domino's", "Domino's Pizza", "Dominos"] }, partial: 'allergens', checked: '2026-10' },
  { name: "Papa John's", osm: { brands: ["Papa John's", "Papa Johns"] }, checked: '2026-10' },
  { name: "Gruby Benek", osm: { brands: ["Gruby Benek"] }, partial: 'allergens', checked: '2026-10' },
  { name: "Tutti Santi", osm: { brands: ["Tutti Santi", "Pizzeria Tutti Santi"] }, checked: '2026-10' },
  { name: "Pizzeria 105", osm: { brands: ["Pizzeria 105", "Pizzeria Stopiątka"] }, partial: 'per100', checked: '2026-10' }, // i18n-ignore: chain name
  { name: "Fabbrica", osm: { brands: ["Fabryka Pizzy"] }, partial: 'allergens', checked: '2026-10' },
  { name: "Pizzatopia", osm: { brands: ["Pizzatopia"] }, checked: '2026-10' },
  { name: "Pizzanova", osm: { brands: ["Pizzanova"] }, checked: '2026-10' },
  { name: "Bafra Kebab", osm: { brands: ["Bafra Kebab", "Bafra"] }, partial: 'allergens', checked: '2026-10' },
  { name: "Zahir Kebab", osm: { brands: ["Zahir Kebab"] }, partial: 'kcal', checked: '2026-10' },
  { name: "Kebab King", osm: { brands: ["Kebab King"] }, checked: '2026-10' },
  { name: "Am Am Kebab", osm: { brands: ["Am Am Kebab", "AmAm Kebab"] }, partial: 'kcal', checked: '2026-10' },
  { name: "Sevi Kebab", osm: { brands: ["Sevi Kebab"] }, partial: 'allergens', checked: '2026-10' },
  { name: "Kura Warzyw", osm: { brands: ["Kura Warzyw"] }, partial: 'allergens', checked: '2026-10' },
  { name: "Koku Sushi", osm: { brands: ["Koku Sushi"] }, partial: 'allergens', checked: '2026-10' },
  { name: "Sushi Kushi", osm: { brands: ["Sushi Kushi"] }, partial: 'allergens', checked: '2026-10' },
  { name: "Sushi World", osm: { brands: ["Sushi World"] }, partial: 'allergens', checked: '2026-10' },
  { name: "Ninja Sushi", osm: { brands: ["Ninja Sushi"] }, checked: '2026-10' },
  { name: "Thai Wok", osm: { brands: ["Thai Wok"] }, checked: '2026-10' },
  { name: "Thai Thai", osm: { brands: ["Thai Thai"] }, checked: '2026-10' },
  { name: "Kurcze Pieczone", osm: { brands: ["Kurcze Pieczone", "KurczePieczone"] }, checked: '2026-10' },
  { name: "Solleim", osm: { brands: ["Solleim"] }, partial: 'allergens', checked: '2026-10' },
  { name: "Mango Mama", osm: { brands: ["Mango Mama"] }, partial: 'kcal', checked: '2026-10' },
  { name: "Crazy Bubble", osm: { brands: ["Crazy Bubble"] }, partial: 'allergens', checked: '2026-10' },
  { name: "Etno Cafe", osm: { brands: ["Etno Cafe", "Etno Café"] }, checked: '2026-10' },
  { name: "Cofix", osm: { brands: ["Cofix"] }, checked: '2026-10' },
  { name: "The White Bear Coffee", osm: { brands: ["The White Bear Coffee", "White Bear Coffee"] }, checked: '2026-10' },
  { name: "Lviv Croissants", osm: { brands: ["Lviv Croissants", "Lwowskie Croissanty"] }, checked: '2026-10' },
  { name: "Pożegnanie z Afryką", osm: { brands: ["Pożegnanie z Afryką"] }, checked: '2026-10' }, // i18n-ignore: chain name
  { name: "Coffeedesk", osm: { brands: ["Coffeedesk"] }, checked: '2026-10' },
  { name: "BuBu Bubble Tea", osm: { brands: ["BuBu Bubble Tea"] }, checked: '2026-10' },
  { name: "Boboq", osm: { brands: ["Boboq"] }, checked: '2026-10' },
  { name: "Sphinx", osm: { brands: ["Sphinx"] }, partial: 'allergens', checked: '2026-10' },
  { name: "Makarun", osm: { brands: ["Makarun"] }, partial: 'per100', checked: '2026-10' },
  { name: "Hard Rock Cafe", osm: { brands: ["Hard Rock Cafe"] }, checked: '2026-10' },
  { name: "Pierogarnia Stary Młyn", osm: { brands: ["Pierogarnia Stary Młyn"] }, partial: 'allergens', checked: '2026-10' }, // i18n-ignore: chain name
  { name: "Whiskey in the Jar", osm: { brands: ["Whiskey in the Jar"] }, partial: 'allergens', checked: '2026-10' },
  { name: "Pyra Bar", osm: { brands: ["Pyra Bar", "Pyrabar"] }, partial: 'allergens', checked: '2026-10' },
  { name: "Kuchnia Marché", osm: { brands: ["Kuchnia Marché"] }, checked: '2026-10' },
  { name: "Manekin", osm: { brands: ["Manekin"] }, checked: '2026-10' },
  { name: "Pita Bros", osm: { brands: ["Pita Bros"] }, checked: '2026-10' },
  { name: "Chinkalnia", osm: { brands: ["Chinkalnia"] }, checked: '2026-10' },
  { name: "SurfBurger", osm: { brands: ["SurfBurger", "Surf Burger"] }, checked: '2026-10' },
  { name: "Mr. Pancake", osm: { brands: ["Mr. Pancake", "Mr Pancake"] }, checked: '2026-10' },
  { name: "Spoko Taco", osm: { brands: ["Spoko Taco"] }, checked: '2026-10' },
  { name: "Pijalnia Wódki i Piwa", osm: { brands: ["Pijalnia Wódki i Piwa"] }, checked: '2026-10' }, // i18n-ignore: chain name
  { name: "Cybermachina", osm: { brands: ["Cybermachina"] }, checked: '2026-10' },
  { name: "Lepione", osm: { brands: ["Lepione"] }, checked: '2026-10' },
  { name: "Bierhalle", osm: { brands: ["Bierhalle"] }, checked: '2026-10' },
  { name: "Shell", osm: { brands: ["Shell"] }, checked: '2026-10' },
  { name: "Bobby Burger", osm: { brands: ["Bobby Burger"] }, checked: '2026-10' },
];

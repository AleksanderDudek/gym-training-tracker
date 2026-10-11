import { capitalize, decodeEntities, humanizeTag } from '../../../src/food/lib/text';

/** The shape of https://static.openfoodfacts.org/data/taxonomies/<name>.json */
export type Taxonomy = Record<string, { name?: Record<string, string> } | undefined>;

/** Tag -> display name: Polish, else English, else the tag made readable. */
export function makeNamer(taxonomy: Taxonomy | null): (tag: string) => string {
  return (tag) => {
    const names = taxonomy?.[tag]?.name;
    const name = names?.pl ?? names?.en;
    return name ? capitalize(decodeEntities(name).trim()) : humanizeTag(tag);
  };
}

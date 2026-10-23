import type { OsmSource } from '../../hooks/useOsmAround';
import { hasStaticData } from '../../nearby/staticData';
import { NT, dataDate } from './nearbyText';

/**
 * Whose data the map shows and from when — the OpenStreetMap credit the licence asks for, with the
 * ODbL notice that ships beside the app's copy of the data, and its date (or "live" for Overpass).
 */
export function OsmCredit({ source, dataAsOf }: { source: OsmSource; dataAsOf: string | null }) {
  const date = source !== 'live' ? dataDate(dataAsOf) : null;
  const tail = [date && NT.asOf(date), source === 'live' ? NT.live : source === 'mixed' ? NT.border : null].filter(Boolean);
  return (
    <p className="fd-near-credit">
      {NT.credit}{' '}
      <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
        {NT.authors}
      </a>
      {hasStaticData() && (
        <>
          {' · '}
          <a href={`${import.meta.env.BASE_URL}data/osm/v1/LICENSE.txt`} target="_blank" rel="noopener noreferrer">
            {NT.license}
          </a>
        </>
      )}
      {tail.map((t) => ` · ${t}`).join('')}
    </p>
  );
}

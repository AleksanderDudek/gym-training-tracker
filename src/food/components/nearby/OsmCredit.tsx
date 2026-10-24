import type { OsmState } from '../../hooks/useOsmAround';
import { hasStaticData } from '../../nearby/staticData';
import { NT, dataDate } from './nearbyText';

/**
 * Whose data the map shows and from when — the OpenStreetMap credit the licence asks for, with the
 * ODbL notice that ships beside the app's copy of the data. Named after the items on screen: the
 * copy's date while they are its own (the Polish side at the border too), the Overpass server while
 * they are its answer — fresh or saved, a saved one's age is in the status line.
 */
export function OsmCredit({ shown, dataAsOf }: Pick<OsmState, 'shown' | 'dataAsOf'>) {
  const date = shown === 'static' ? dataDate(dataAsOf) : null;
  const tail = shown === 'live' ? NT.overpass : date && NT.asOf(date);
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
      {tail && ` · ${tail}`}
    </p>
  );
}

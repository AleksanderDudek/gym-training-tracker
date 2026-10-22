import L from 'leaflet';
import { useEffect, useRef } from 'react';
import { text } from '../../../i18n';
import type { RankedPlace } from '../../nearby/eat';
import type { LatLon } from '../../nearby/types';
import { MapFrame, POPUP_OPTIONS, useBaseMap } from './baseMap';

const T = text({
  pl: { map: 'Mapa lokali w pobliżu', card: 'Karta miejsca' },
  en: { map: 'Map of places to eat nearby', card: 'Place card' },
});

interface Props {
  center: LatLon | null;
  radius: number;
  places: RankedPlace[];
  /** Places of the list's top rows, in order: their pins carry the row's number. */
  top: string[];
  selected: string | null;
  /** Lines under the place's name in its popup: chain · distance, open state, the best dishes. */
  describe: (place: RankedPlace) => { head: string; lines: string[] };
  onOpen: (placeId: string) => void;
  onPick: (position: LatLon) => void;
  pickOnClick: boolean;
  onViewChange?: (center: LatLon) => void;
  describedBy?: string;
}

/** Popup content: text nodes only - names come from OpenStreetMap, where anyone can type anything. */
export function placePopup(place: RankedPlace, props: Pick<Props, 'describe' | 'onOpen'>, close: () => void): HTMLElement {
  const root = document.createElement('div');
  root.className = 'fd-near-pop';
  const line = (text: string, className = '') => {
    const p = document.createElement('p');
    p.textContent = text;
    if (className) p.className = className;
    root.appendChild(p);
  };
  const { head, lines } = props.describe(place);
  line(place.place.name, 'fd-near-pop-name');
  line(head);
  lines.forEach((l, i) => line(l, i === 0 ? 'fd-near-pop-soft' : 'fd-near-pop-count'));
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn sm fd-near-pop-btn';
  button.textContent = T.card;
  button.addEventListener('click', () => {
    close();
    props.onOpen(place.place.id);
  });
  root.appendChild(button);
  return root;
}

/**
 * Places to eat on the map: the pin's colour is how well its best dish fits now (green great, gold
 * OK, orange better not), grey without menu data, faded when closed; the list's top three are
 * numbered pins on top, so the map and the list point at the same places.
 */
export function PlaceMap(props: Props) {
  const { places, top, selected, describedBy } = props;
  const { box, map, pins, you, colors, twoFingers } = useBaseMap(props);
  const latest = useRef(props);
  useEffect(() => {
    latest.current = props;
  });

  useEffect(() => {
    const group = pins.current;
    const c = colors.current;
    if (!group || !c) return;
    group.clearLayers();
    const popup = (p: RankedPlace) => () => placePopup(p, latest.current, () => map.current?.closePopup());
    const numbered = new Map(top.map((id, i) => [id, i + 1]));
    // Unnumbered first, numbered last: the canvas and the marker pane draw later ones on top.
    for (const p of places) {
      if (numbered.has(p.place.id)) continue;
      const level = p.best?.fit.level;
      const chosen = p.place.id === selected;
      L.circleMarker([p.place.lat, p.place.lon], {
        radius: chosen ? 9 : p.best ? 7 : 5,
        color: chosen ? c.ink : c.edge,
        weight: chosen ? 2.5 : 2,
        fillColor: level === 'great' ? c.great : level === 'ok' ? c.ok : level === 'avoid' ? c.avoid : c.none,
        fillOpacity: p.open && !p.open.open ? 0.35 : 0.95,
      })
        .bindPopup(popup(p), POPUP_OPTIONS)
        .addTo(group);
    }
    for (const p of places) {
      const n = numbered.get(p.place.id);
      if (!n) continue;
      const level = p.best?.fit.level ?? 'none';
      L.marker([p.place.lat, p.place.lon], {
        // A number only: the place's name goes in as an attribute (`title`), never as HTML.
        icon: L.divIcon({
          className: `fd-near-pin fd-near-pin-${level}${p.place.id === selected ? ' fd-near-pin-on' : ''}`,
          html: `<span>${n}</span>`,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        }),
        title: p.place.name,
        alt: p.place.name,
        riseOnHover: true,
      })
        .bindPopup(popup(p), POPUP_OPTIONS)
        .addTo(group);
    }
    you.current?.bringToFront();
  }, [places, top, selected, pins, colors, map, you]);

  return <MapFrame boxRef={box} twoFingers={twoFingers} label={T.map} describedBy={describedBy} />;
}

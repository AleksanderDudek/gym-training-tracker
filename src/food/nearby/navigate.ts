import type { LatLon } from './types';

/**
 * „Prowadź”: directions on foot in the device's own maps app. On an iPhone or iPad an Apple Maps link
 * opens Apple Maps; anywhere else a Google Maps directions link opens the Google Maps app when it is
 * installed (Android hands such links to it) and the website otherwise. Android also gets a `geo:`
 * link, which lets the user pick another app (OsmAnd, Waze…).
 */

export type MapsPlatform = 'ios' | 'android' | 'other';

/** iPadOS 13+ reports itself as a Mac; touch points give it away. */
export function mapsPlatform(ua: string, maxTouchPoints = 0): MapsPlatform {
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'other';
}

const at = (p: LatLon) => `${p.lat.toFixed(6)},${p.lon.toFixed(6)}`;

/** Walking directions from where the device is to the place. */
export function directionsUrl(to: LatLon, platform: MapsPlatform): string {
  if (platform === 'ios') return `https://maps.apple.com/?daddr=${at(to)}&dirflg=w`;
  return `https://www.google.com/maps/dir/?api=1&destination=${at(to)}&travelmode=walking`;
}

/** The place in any maps app on Android; the name is the pin's label. */
export function geoUri(to: LatLon, name: string): string {
  return `geo:${at(to)}?q=${at(to)}(${encodeURIComponent(name)})`;
}

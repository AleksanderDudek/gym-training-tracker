import { describe, expect, test } from 'vitest';
import { directionsUrl, geoUri, mapsPlatform } from './navigate';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1';
const IPAD = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15';
const ANDROID = 'Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36';

describe('directions in the device’s maps app', () => {
  test('the platform from the user agent; an iPad that says Mac is told apart by touch', () => {
    expect(mapsPlatform(IPHONE)).toBe('ios');
    expect(mapsPlatform(IPAD, 5)).toBe('ios');
    expect(mapsPlatform(IPAD, 0)).toBe('other');
    expect(mapsPlatform(ANDROID)).toBe('android');
  });

  test('Apple Maps on iOS, Google Maps elsewhere — on foot, to the place', () => {
    const to = { lat: 52.2297, lon: 21.0122 };
    expect(directionsUrl(to, 'ios')).toBe('https://maps.apple.com/?daddr=52.229700,21.012200&dirflg=w');
    expect(directionsUrl(to, 'android')).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=52.229700,21.012200&travelmode=walking',
    );
    expect(geoUri(to, "McDonald's")).toBe("geo:52.229700,21.012200?q=52.229700,21.012200(McDonald's)");
  });
});

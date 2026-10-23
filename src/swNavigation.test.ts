import { describe, expect, it } from 'vitest';
import { NAVIGATION_DENYLIST } from './swNavigation';

const denied = (url: string) => NAVIGATION_DENYLIST.some((re) => re.test(new URL(url).pathname));

describe('service worker navigations', () => {
  it('the app’s own pages get index.html; the privacy policy and the OSM data files open as themselves', () => {
    expect(denied('https://aleksanderdudek.github.io/gym-training-tracker/')).toBe(false);
    expect(denied('https://aleksanderdudek.github.io/gym-training-tracker/index.html')).toBe(false);
    expect(denied('https://aleksanderdudek.github.io/gym-training-tracker/#/w-poblizu')).toBe(false);
    expect(denied('https://aleksanderdudek.github.io/gym-training-tracker/privacy.html')).toBe(true);
    expect(denied('https://aleksanderdudek.github.io/gym-training-tracker/data/osm/v1/LICENSE.txt')).toBe(true);
    expect(denied('http://localhost:4173/data/osm/v1/index.json')).toBe(true);
  });
});

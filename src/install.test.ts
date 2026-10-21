import { describe, expect, it } from 'vitest';
import { installPlaceOf } from './install';

const SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1';
const CHROME =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0.7390.41 Mobile/15E148 Safari/604.1';
const FIREFOX =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/143.0 Mobile/15E148 Safari/605.1.15';
const INSTAGRAM =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 400.0.0.0 (iPhone15,2; iOS 18_6; pl_PL)';
const FACEBOOK =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/500.0.0.0;FBBV/1;FBDV/iPhone15,2]';

describe('podpowiedź „dodaj do ekranu początkowego”', () => {
  it('iPhone w karcie: Safari, inna przeglądarka albo przeglądarka wbudowana w aplikację', () => {
    expect(installPlaceOf({ ios: true, standalone: false, ua: SAFARI })).toBe('safari');
    expect(installPlaceOf({ ios: true, standalone: false, ua: CHROME })).toBe('browser');
    expect(installPlaceOf({ ios: true, standalone: false, ua: FIREFOX })).toBe('browser');
    expect(installPlaceOf({ ios: true, standalone: false, ua: INSTAGRAM })).toBe('in-app');
    expect(installPlaceOf({ ios: true, standalone: false, ua: FACEBOOK })).toBe('in-app');
  });

  it('w aplikacji z ikony i poza iOS — nic: Android pyta o instalację sam', () => {
    expect(installPlaceOf({ ios: true, standalone: true, ua: SAFARI })).toBeNull();
    expect(
      installPlaceOf({
        ios: false,
        standalone: false,
        ua: 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36',
      }),
    ).toBeNull();
  });
});

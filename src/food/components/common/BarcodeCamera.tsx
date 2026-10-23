import { Flashlight, FlashlightOff, RefreshCw, ScanBarcode } from 'lucide-react';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { text } from '../../../i18n';
import { digitsOf, isShopCode } from '../../scan/barcode';
import { getDetector, type Detector } from '../../scan/engine';
import './common.css';

const T = text({
  pl: {
    starting: 'Włączam aparat…',
    loading: 'Wczytuję skaner…',
    aim: 'Nakieruj aparat na kod kreskowy',
    denied: 'Brak zgody na aparat. Zezwól na niego w ustawieniach przeglądarki albo wpisz kod niżej.',
    none: 'Nie znalazłem aparatu. Wpisz kod niżej.',
    busy: 'Aparat jest zajęty przez inną aplikację. Zamknij ją albo wpisz kod niżej.',
    unsupported: 'Ta przeglądarka nie daje dostępu do aparatu. Wpisz kod niżej.',
    engine: 'Nie udało się wczytać skanera — sprawdź internet albo wpisz kod niżej.',
    torch: 'Latarka',
    view: 'Podgląd z aparatu',
    again: 'Włącz aparat ponownie',
  },
  en: {
    starting: 'Starting the camera…',
    loading: 'Loading the scanner…',
    aim: 'Point the camera at the barcode',
    denied: 'No permission to use the camera. Allow it in your browser settings or type the code below.',
    none: 'I couldn’t find a camera. Type the code below.',
    busy: 'Another app is using the camera. Close it or type the code below.',
    unsupported: 'This browser doesn’t give access to the camera. Type the code below.',
    engine: 'Couldn’t load the scanner — check your internet connection or type the code below.',
    torch: 'Torch',
    view: 'Camera preview',
    again: 'Start the camera again',
  },
});

type CameraState = 'starting' | 'loading' | 'scanning' | 'denied' | 'none' | 'busy' | 'unsupported' | 'engine';

const MESSAGE: Record<CameraState, string> = {
  starting: T.starting,
  loading: T.loading,
  scanning: T.aim,
  denied: T.denied,
  none: T.none,
  busy: T.busy,
  unsupported: T.unsupported,
  engine: T.engine,
};

/** A frame every this often: quick enough to feel instant, light on a phone's battery. */
const INTERVAL_MS = 180;
/** The same code is reported again only after it was out of view this long. */
const QUIET_MS = 2500;

function cameraError(error: unknown): CameraState {
  const name = error instanceof DOMException || error instanceof Error ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'denied';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'none';
  if (name === 'NotReadableError' || name === 'AbortError') return 'busy';
  return 'unsupported';
}

function subscribeVisibility(onChange: () => void): () => void {
  document.addEventListener('visibilitychange', onChange);
  return () => document.removeEventListener('visibilitychange', onChange);
}

/** Whether the page is on screen: the camera is off while it is not. */
function usePageVisible(): boolean {
  return useSyncExternalStore(
    subscribeVisibility,
    () => document.visibilityState !== 'hidden',
    () => true,
  );
}

interface Props {
  /** A new code in view: checked (GS1 check digit), reported once while it stays in view. */
  onCode: (code: string) => void;
  /** `false` turns the camera off - a product card over the scanner, a hidden list. */
  active?: boolean;
}

/**
 * The camera looking for barcodes. The back camera, a frame every 180 ms through the browser's own
 * detector or the WASM one (`getDetector`), a short vibration and a green frame on a hit. The camera
 * runs only while it is needed: it stops when the scanner closes, when something covers it and when
 * the page is hidden, and the picture never leaves the device. A torch button appears where the
 * camera has one (Android). Every failure says what to do instead: type the code below.
 */
export function BarcodeCamera({ onCode, active = true }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const track = useRef<MediaStreamTrack | null>(null);
  const report = useRef(onCode);
  const [state, setState] = useState<CameraState>('starting');
  /** `null`: no torch on this camera. */
  const [torch, setTorch] = useState<boolean | null>(null);
  const [hits, setHits] = useState(0);
  /** „Włącz aparat ponownie” after a refusal: permission may have been given in the settings since. */
  const [attempt, setAttempt] = useState(0);
  const visible = usePageVisible();
  const on = active && visible;

  useEffect(() => {
    report.current = onCode;
  }, [onCode]);

  useEffect(() => {
    if (!on) return;
    let stopped = false;
    let stream: MediaStream | null = null;
    let timer: number | undefined;
    const seen = { code: '', at: 0 };

    const scan = async (element: HTMLVideoElement, detector: Detector) => {
      if (stopped) return;
      if (element.readyState >= 2) {
        try {
          for (const found of await detector.detect(element)) {
            const code = digitsOf(found.rawValue);
            if (!isShopCode(code)) continue;
            const now = Date.now();
            const again = code === seen.code && now - seen.at < QUIET_MS;
            seen.code = code;
            seen.at = now;
            if (!again && !stopped) {
              // Chrome refuses (with an error) vibration before the first tap - the app shortcut opens straight here.
              if (navigator.userActivation?.hasBeenActive ?? true) navigator.vibrate?.(35);
              setHits((n) => n + 1);
              report.current(code);
            }
            break;
          }
        } catch {
          // A frame that cannot be read: the next one will do.
        }
      }
      timer = window.setTimeout(() => void scan(element, detector), INTERVAL_MS);
    };

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setState('unsupported');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
      } catch (error) {
        if (!stopped) setState(cameraError(error));
        return;
      }
      const element = video.current;
      if (stopped || !element) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      element.srcObject = stream;
      void element.play().catch(() => {});
      const [first] = stream.getVideoTracks();
      track.current = first ?? null;
      const capabilities = first?.getCapabilities?.() as (MediaTrackCapabilities & { torch?: boolean }) | undefined;
      setTorch(capabilities?.torch ? false : null);
      setState('loading');
      let detector: Detector;
      try {
        detector = await getDetector();
      } catch {
        if (!stopped) setState('engine');
        return;
      }
      if (stopped) return;
      setState('scanning');
      void scan(element, detector);
    };

    void start();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
      track.current = null;
    };
  }, [on, attempt]);

  const toggleTorch = async () => {
    const current = track.current;
    if (!current || torch === null) return;
    try {
      await current.applyConstraints({ advanced: [{ torch: !torch } as MediaTrackConstraintSet] });
      setTorch(!torch);
    } catch {
      setTorch(null);
    }
  };

  const failed = state !== 'starting' && state !== 'loading' && state !== 'scanning';
  return (
    <div className={`fd-cam${failed ? ' fd-cam-off' : ''}`}>
      {/* The video stays in the page after a failure, so a second try has somewhere to show. */}
      <video ref={video} className="fd-cam-video" playsInline muted autoPlay aria-label={T.view} hidden={failed} />
      {failed ? (
        <ScanBarcode className="fd-cam-icon" size={32} strokeWidth={1.75} aria-hidden />
      ) : (
        <>
          {/* A new key per hit restarts the green flash. */}
          <div key={hits} className={`fd-cam-guide${hits ? ' fd-cam-hit' : ''}`} aria-hidden="true" />
          {torch !== null && (
            <button type="button" className="fd-cam-torch" aria-pressed={torch} aria-label={T.torch} onClick={() => void toggleTorch()}>
              {torch ? <FlashlightOff size={20} strokeWidth={2} aria-hidden /> : <Flashlight size={20} strokeWidth={2} aria-hidden />}
            </button>
          )}
        </>
      )}
      <p className="fd-cam-msg" role="status">
        {MESSAGE[state]}
      </p>
      {failed && state !== 'unsupported' && (
        <button type="button" className="btn ghost sm" onClick={() => setAttempt((n) => n + 1)}>
          <RefreshCw size={16} strokeWidth={2} aria-hidden />
          {T.again}
        </button>
      )}
    </div>
  );
}

import { Camera, Flashlight, FlashlightOff, ImagePlus, RefreshCw, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { text } from '../../../i18n';
import { grabFrame } from '../../photo/frame';
import { cameraError, usePageVisible, type CameraFailure } from '../common/BarcodeCamera';
import '../common/common.css';

const T = text({
  pl: {
    starting: 'Włączam aparat…',
    aim: 'Cały talerz w kadrze, z góry albo lekko z boku',
    view: 'Podgląd z aparatu',
    shoot: 'Zrób zdjęcie',
    taking: 'Robię zdjęcie…',
    torch: 'Latarka',
    cancel: 'Anuluj',
    gallery: 'Z galerii',
    system: 'Aparat telefonu',
    again: 'Włącz aparat ponownie',
    denied: 'Brak zgody na aparat w aplikacji. Zezwól na niego w ustawieniach przeglądarki — albo zrób zdjęcie aparatem telefonu.',
    none: 'Nie znalazłem aparatu. Wybierz zdjęcie z galerii.',
    busy: 'Aparat jest zajęty przez inną aplikację. Zamknij ją albo użyj aparatu telefonu.',
    unsupported: 'Ta przeglądarka nie daje aparatu w aplikacji. Zrób zdjęcie aparatem telefonu albo wybierz z galerii.',
    shotFailed: 'Nie udało się zrobić zdjęcia — spróbuj jeszcze raz.',
  },
  en: {
    starting: 'Starting the camera…',
    aim: 'The whole plate in the frame, from above or slightly to the side',
    view: 'Camera preview',
    shoot: 'Take the photo',
    taking: 'Taking the photo…',
    torch: 'Torch',
    cancel: 'Cancel',
    gallery: 'From gallery',
    system: 'Phone camera',
    again: 'Start the camera again',
    denied: 'No permission for the camera in the app. Allow it in your browser settings — or take the photo with the phone’s camera.',
    none: 'I couldn’t find a camera. Pick a photo from the gallery.',
    busy: 'Another app is using the camera. Close it or use the phone’s camera.',
    unsupported: 'This browser has no camera inside the app. Take the photo with the phone’s camera or pick one from the gallery.',
    shotFailed: 'Couldn’t take the photo — try again.',
  },
});

const FAILURE: Record<CameraFailure, string> = { denied: T.denied, none: T.none, busy: T.busy, unsupported: T.unsupported };

interface Props {
  /** The frame, as a JPEG; the camera is off by then. */
  onShot: (photo: Blob) => void;
  /** The phone's own camera app (a file input with `capture`) — only after the in-app one failed. */
  onSystemCamera: () => void;
  onGallery: () => void;
  onCancel: () => void;
}

/**
 * The viewfinder for a meal photo, inside the page: the back camera, a round shutter, a torch where
 * there is one. Unlike the phone's camera app it never sends the browser to the background, where a
 * phone short of memory closes it and the photo is lost. The camera runs only while this is on
 * screen and the page is visible; the picture never leaves the device. When the camera cannot
 * start, it says why and offers the phone's camera and the gallery.
 */
export function PhotoCamera({ onShot, onSystemCamera, onGallery, onCancel }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const track = useRef<MediaStreamTrack | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const [state, setState] = useState<'starting' | 'live' | 'taking' | CameraFailure>('starting');
  const [torch, setTorch] = useState<boolean | null>(null);
  const [shotFailed, setShotFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const visible = usePageVisible();
  /** Gone (cancelled, gallery chosen) while a shot was being taken: that shot goes nowhere. */
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    if (!visible) return;
    let stopped = false;
    const stop = () => {
      stream.current?.getTracks().forEach((t) => t.stop());
      stream.current = null;
      track.current = null;
    };
    void (async () => {
      if (!navigator.mediaDevices?.getUserMedia) return setState('unsupported');
      let s: MediaStream;
      try {
        // 4:3 like a phone photo; the model squashes it to a square either way.
        s = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 960 } } });
      } catch (e) {
        if (!stopped) setState(cameraError(e));
        return;
      }
      const element = video.current;
      if (stopped || !element) return s.getTracks().forEach((t) => t.stop());
      stream.current = s;
      element.srcObject = s;
      const [first] = s.getVideoTracks();
      track.current = first ?? null;
      const capabilities = first?.getCapabilities?.() as (MediaTrackCapabilities & { torch?: boolean }) | undefined;
      setTorch(capabilities?.torch ? false : null);
      // The shutter waits for a real picture: before the first frame iOS gives a 0 × 0 or black one.
      const ready = () => !stopped && setState('live');
      if (element.readyState >= 2) ready();
      else element.addEventListener('playing', ready, { once: true });
      void element.play().catch(() => {});
    })();
    return () => {
      stopped = true;
      stop();
      // Hidden now: when the page is back, no shutter until the new stream shows a picture.
      setState((s) => (s === 'live' || s === 'taking' ? 'starting' : s));
    };
  }, [visible, attempt]);

  const shoot = async () => {
    const element = video.current;
    // A page that was hidden has a stopped stream until the camera is back: no frame from it.
    if (!element || state !== 'live' || !stream.current) return;
    setState('taking');
    setShotFailed(false);
    try {
      const photo = await grabFrame(element);
      if (!alive.current) return;
      // The camera goes off before the model takes the memory.
      stream.current?.getTracks().forEach((t) => t.stop());
      element.srcObject = null;
      onShot(photo);
    } catch {
      if (!alive.current) return;
      setShotFailed(true);
      setState('live');
    }
  };

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

  const failed = state !== 'starting' && state !== 'live' && state !== 'taking';
  return (
    <div className="fd-diet-shot">
      <div className={`fd-cam${failed ? ' fd-cam-off' : ''}`}>
        <video ref={video} className="fd-cam-video" playsInline muted autoPlay aria-label={T.view} hidden={failed} />
        {failed ? (
          <Camera className="fd-cam-icon" size={32} strokeWidth={1.75} aria-hidden />
        ) : (
          torch !== null && (
            <button type="button" className="fd-cam-torch" aria-pressed={torch} aria-label={T.torch} onClick={() => void toggleTorch()}>
              {torch ? <FlashlightOff size={20} strokeWidth={2} aria-hidden /> : <Flashlight size={20} strokeWidth={2} aria-hidden />}
            </button>
          )
        )}
        <p className="fd-cam-msg" role="status">
          {failed ? FAILURE[state] : shotFailed ? T.shotFailed : state === 'starting' ? T.starting : state === 'taking' ? T.taking : T.aim}
        </p>
      </div>
      <div className="fd-diet-shot-bar">
        <button type="button" className="btn ghost sm" disabled={state === 'taking'} onClick={onCancel}>
          <X aria-hidden="true" size={18} /> {T.cancel}
        </button>
        {!failed && (
          <button type="button" className="fd-diet-shutter" aria-label={T.shoot} disabled={state !== 'live'} onClick={() => void shoot()}>
            <span aria-hidden="true" />
          </button>
        )}
        <button type="button" className="btn ghost sm" disabled={state === 'taking'} onClick={onGallery}>
          <ImagePlus aria-hidden="true" size={18} /> {T.gallery}
        </button>
      </div>
      {failed && (
        <div className="fd-diet-shot-bar">
          {state !== 'none' && (
            <button type="button" className="btn sm" onClick={onSystemCamera}>
              <Camera aria-hidden="true" size={18} /> {T.system}
            </button>
          )}
          {(state === 'denied' || state === 'busy') && (
            <button
              type="button"
              className="btn ghost sm"
              onClick={() => {
                setState('starting');
                setAttempt((n) => n + 1);
              }}
            >
              <RefreshCw aria-hidden="true" size={16} /> {T.again}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

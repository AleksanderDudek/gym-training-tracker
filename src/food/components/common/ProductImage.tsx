import { ImageOff } from 'lucide-react';
import { useState } from 'react';
import { text } from '../../../i18n';
import { imageUrl, type ImageSize } from '../../lib/images';
import './common.css';

interface Props {
  path: string | null;
  size: ImageSize;
  alt: string;
  /** Rozmiar i oprawa ramki; zdjęcie zawsze mieści się w środku. */
  className?: string;
  /** Odstęp zdjęcia od krawędzi ramki. */
  padded?: boolean;
}

/**
 * Zdjęcie produktu, które w razie kłopotu zamienia się w zaślepkę, nigdy w ikonę zepsutego obrazka.
 *
 * Zdjęcie stoi w ramce, której rozmiar daje wywołujący (`className`), i jest w niej pozycjonowane
 * bezwzględnie. `<img>` jako element flex brałby minimalną wysokość z naturalnego rozmiaru zdjęcia,
 * więc wysokie i wąskie zdjęcie rozpychało kartę szerzej niż kolumna siatki; poza przepływem nie
 * wpływa na układ wcale — i nie przesuwa go, kiedy się wczyta.
 */
export function ProductImage({ path, size, alt, className = '', padded = false }: Props) {
  const [failedPath, setFailedPath] = useState<string | null>(null);
  const broken = !path || failedPath === path;
  const classes = ['fd-img', broken && 'broken', padded && 'padded', className].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      {broken ? (
        <div className="fd-img-none">
          <ImageOff size={20} strokeWidth={2} aria-hidden />
          {/* Miniatura w wierszu tabeli nie ma miejsca na podpis; ikona wystarczy. */}
          {size > 100 && <span>{text({ pl: 'Brak zdjęcia', en: 'No photo' })}</span>}
        </div>
      ) : (
        <img
          src={imageUrl(path, size)}
          alt={alt}
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          // Tryb CORS: service worker może wtedy zachować prawdziwą odpowiedź zamiast nieprzejrzystej
          // (Open Food Facts wpuszcza każde pochodzenie).
          crossOrigin="anonymous"
          onError={() => setFailedPath(path)}
        />
      )}
    </div>
  );
}

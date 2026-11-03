import { useMemo } from 'react';
import { encode } from 'uqr';

/** Kod QR jako zwykłe SVG z Reacta — z macierzy modułów, bez wstawiania gotowego znacznika. */
export function QrCode({ value, label }: { value: string; label: string }) {
  const { size, path } = useMemo(() => {
    const { data, size } = encode(value, { border: 1, ecc: 'M' });
    let d = '';
    data.forEach((row, y) => row.forEach((on, x) => on && (d += `M${x} ${y}h1v1h-1z`)));
    return { size, path: d };
  }, [value]);
  return (
    <svg className="qr" viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} shapeRendering="crispEdges">
      <rect width={size} height={size} fill="#fff" />
      <path d={path} fill="#141413" />
    </svg>
  );
}

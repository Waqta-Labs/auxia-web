import { useEffect, useRef } from 'react';

// Rampa de calor: de demanda baja (verde) a crítica (rojo). La leyenda usa la misma rampa.
export const HEAT_RAMP = [
  [0, '#bcfb89'],
  [0.4, '#f3e65b'],
  [0.65, '#ffb020'],
  [0.85, '#ff7043'],
  [1, '#ff4d4d'],
];

export const rampGradient = (angle = 90) =>
  'linear-gradient(' + angle + 'deg, ' + HEAT_RAMP.map(([stop, color]) => color + ' ' + stop * 100 + '%').join(', ') + ')';

const hex = (color) => [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16));

// Tabla intensidad (0-255) -> RGBA, calculada una sola vez.
const PALETTE = (() => {
  const table = new Uint8ClampedArray(256 * 4);
  for (let i = 0; i < 256; i += 1) {
    const t = i / 255;
    let k = 0;
    while (k < HEAT_RAMP.length - 2 && t > HEAT_RAMP[k + 1][0]) k += 1;
    const [t0, c0] = HEAT_RAMP[k];
    const [t1, c1] = HEAT_RAMP[k + 1];
    const mix = Math.min(1, Math.max(0, (t - t0) / (t1 - t0)));
    const a = hex(c0);
    const b = hex(c1);
    for (let channel = 0; channel < 3; channel += 1) table[i * 4 + channel] = a[channel] + (b[channel] - a[channel]) * mix;
    table[i * 4 + 3] = Math.round(Math.min(1, t ** 1.15 * 1.5) * 0.82 * 255);
  }
  return table;
})();

const QUALITY = 0.5; // el calor se dibuja a media resolución: es difuso y así se mueve fluido

// points: [{ lat, lng, weight (0-1), radiusM }]. Las zonas cercanas suman intensidad: más calor donde se juntan.
export default function HeatLayer({ points, view, size, toScreen, metersPerPixel, opacity = 0.75 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.w === 0 || size.h === 0) return;
    const w = Math.max(1, Math.round(size.w * QUALITY));
    const h = Math.max(1, Math.round(size.h * QUALITY));
    canvas.width = w;
    canvas.height = h;
    const g = canvas.getContext('2d', { willReadFrequently: true });
    g.clearRect(0, 0, w, h);

    const mpp = metersPerPixel;
    for (const point of points) {
      const s = toScreen(point.lat, point.lng);
      const r = Math.min(280, Math.max(40, point.radiusM / mpp)) * QUALITY; // sin tope el calor taparía todo al acercar
      const x = s.x * QUALITY;
      const y = s.y * QUALITY;
      if (x + r < 0 || y + r < 0 || x - r > w || y - r > h) continue;
      const gradient = g.createRadialGradient(x, y, 0, x, y, r);
      gradient.addColorStop(0, 'rgba(0,0,0,' + point.weight + ')');
      gradient.addColorStop(0.4, 'rgba(0,0,0,' + point.weight * 0.75 + ')');
      gradient.addColorStop(0.75, 'rgba(0,0,0,' + point.weight * 0.3 + ')');
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gradient;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }

    const image = g.getImageData(0, 0, w, h);
    const data = image.data;
    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3];
      if (alpha === 0) continue;
      const p = alpha * 4;
      data[i] = PALETTE[p];
      data[i + 1] = PALETTE[p + 1];
      data[i + 2] = PALETTE[p + 2];
      data[i + 3] = PALETTE[p + 3];
    }
    g.putImageData(image, 0, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, view.lat, view.lng, view.zoom, size.w, size.h]);

  return <canvas ref={canvasRef} className="gm__heat" style={{ width: size.w, height: size.h, opacity }} aria-hidden="true" />;
}

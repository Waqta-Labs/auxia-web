import { useEffect, useRef } from 'react';
import { project } from './mercator.js';

const clamp01 = (value) => Math.min(1, Math.max(0, value));

function trace(g, feature, scale, ox, oy) {
  for (const rings of feature.polys) {
    for (const ring of rings) {
      let lastX = 0;
      let lastY = 0;
      for (let i = 0; i < ring.length; i += 2) {
        const x = ring[i] * scale + ox;
        const y = ring[i + 1] * scale + oy;
        if (i === 0) g.moveTo(x, y);
        else if (Math.abs(x - lastX) + Math.abs(y - lastY) >= 0.7 || i >= ring.length - 2) g.lineTo(x, y);
        else continue;
        lastX = x;
        lastY = y;
      }
      g.closePath();
    }
  }
}

// Mapa base propio: dibuja los límites del Perú en un canvas (relleno, líneas por nivel y nombres).
export default function BaseLayer({ boundaries, view, size, highlight = null, lines = true, fill = true }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.w === 0 || size.h === 0) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(size.w * dpr);
    canvas.height = Math.round(size.h * dpr);
    const g = canvas.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, size.w, size.h);

    const zoom = view.zoom;
    const scale = 2 ** zoom;
    const c = project(view.lat, view.lng, 0);
    const ox = size.w / 2 - c.x * scale;
    const oy = size.h / 2 - c.y * scale;
    const visible = (features) =>
      (features ?? []).filter((f) => f.bbox[2] * scale + ox >= -20 && f.bbox[0] * scale + ox <= size.w + 20 && f.bbox[3] * scale + oy >= -20 && f.bbox[1] * scale + oy <= size.h + 20);
    g.lineJoin = 'round';

    const departments = visible(boundaries.departments);
    if (fill && departments.length > 0) {
      g.beginPath();
      for (const f of departments) trace(g, f, scale, ox, oy);
      g.fillStyle = '#16164a';
      g.fill('evenodd');
    }

    if (lines) {
      const stroke = (features, color, width) => {
        if (features.length === 0) return;
        g.beginPath();
        for (const f of features) trace(g, f, scale, ox, oy);
        g.strokeStyle = color;
        g.lineWidth = width;
        g.stroke();
      };
      const districtAlpha = clamp01((zoom - 8.4) / 1.2);
      if (districtAlpha > 0) stroke(visible(boundaries.districts), 'rgba(255,255,255,' + 0.17 * districtAlpha + ')', 0.8);
      const provinceAlpha = clamp01((zoom - 5.8) / 1.2);
      if (provinceAlpha > 0) stroke(visible(boundaries.provinces), 'rgba(133,213,246,' + 0.42 * provinceAlpha + ')', 1);
      stroke(departments, 'rgba(133,213,246,0.7)', 1.4);
    }

    if (highlight) {
      g.beginPath();
      trace(g, highlight, scale, ox, oy);
      g.fillStyle = 'rgba(188,251,137,0.1)';
      g.fill('evenodd');
      g.strokeStyle = '#bcfb89';
      g.lineWidth = 2;
      g.stroke();
    }

    // Nombres: un solo nivel a la vez y sin que se pisen.
    if (lines) {
      const level = zoom < 6.6 ? 'departments' : zoom < 9.4 ? 'provinces' : 'districts';
      const family = getComputedStyle(canvas).fontFamily || 'sans-serif';
      g.font = '600 ' + (level === 'departments' ? 12 : 11.5) + 'px ' + family;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.lineWidth = 3;
      g.strokeStyle = 'rgba(11,11,46,0.9)';
      g.fillStyle = 'rgba(255,255,255,0.74)';
      const placed = [];
      const candidates = visible(boundaries[level]).sort((a, b) => (b.bbox[2] - b.bbox[0]) * (b.bbox[3] - b.bbox[1]) - (a.bbox[2] - a.bbox[0]) * (a.bbox[3] - a.bbox[1]));
      for (const f of candidates) {
        const x = f.center.x * scale + ox;
        const y = f.center.y * scale + oy;
        if (x < 10 || y < 10 || x > size.w - 10 || y > size.h - 10) continue;
        const text = level === 'departments' ? f.name.toUpperCase() : f.name;
        const width = g.measureText(text).width;
        if (level !== 'departments' && (f.bbox[2] - f.bbox[0]) * scale < width * 0.7) continue;
        const rect = [x - width / 2 - 4, y - 9, x + width / 2 + 4, y + 9];
        if (placed.some((p) => rect[0] < p[2] && rect[2] > p[0] && rect[1] < p[3] && rect[3] > p[1])) continue;
        placed.push(rect);
        g.strokeText(text, x, y);
        g.fillText(text, x, y);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boundaries, highlight, lines, fill, view.lat, view.lng, view.zoom, size.w, size.h]);

  return <canvas ref={canvasRef} className="gm__base" style={{ width: size.w, height: size.h }} aria-hidden="true" />;
}

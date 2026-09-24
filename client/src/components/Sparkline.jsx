import React from 'react';

/**
 * A tiny inline SVG sparkline.
 * `data` — array of numbers (one per time period).
 * `width` / `height` — dimensions in px.
 * `color` — stroke color.
 * `fill` — whether to show a filled area below the line.
 */
export default function Sparkline({ data = [], width = 120, height = 36, color = 'var(--color-emerald-700)', fill = true, label = 'Trend' }) {
  if (data.length < 2) return <span style={{ fontSize: '0.7rem', color: 'var(--color-slate-400)' }}>—</span>;

  const max = Math.max(...data, 1);
  const pad = 4;
  const w = width - pad * 2;
  const h = height - pad * 2;

  const points = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * w;
    const y = pad + h - (v / max) * h;
    return `${x},${y}`;
  });
  const line = points.join(' ');

  // Fill polygon: line + bottom-right + bottom-left
  const fillPoly = `${line} ${pad + w},${pad + h} ${pad},${pad + h}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`${label}: ${data[data.length - 1]} (was ${data[0]})`}
      style={{ display: 'block' }}
    >
      {fill && (
        <polygon
          points={fillPoly}
          fill={color}
          opacity="0.1"
        />
      )}
      <polyline
        points={line}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* End dot */}
      <circle
        cx={pad + w}
        cy={pad + h - (data[data.length - 1] / max) * h}
        r="2.5"
        fill={color}
      />
    </svg>
  );
}

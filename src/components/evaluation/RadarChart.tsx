// Pure SVG spider/radar chart for the 360 self-vs-others view. No client JS —
// renders server-side. Values are on a fixed 0..max (default 5) scale; null
// points fall to the centre. Theme-aware via CSS variables / currentColor.

export interface RadarSeries {
  label: string;
  /** CSS color for the polygon stroke/fill. */
  color: string;
  values: (number | null)[]; // aligned with `axes`
}

export function RadarChart({
  axes,
  series,
  max = 5,
  size = 320,
}: {
  axes: string[];
  series: RadarSeries[];
  max?: number;
  size?: number;
}) {
  const n = axes.length;
  if (n < 3) return null; // a radar needs ≥3 axes to be meaningful
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - 56; // leave room for labels

  const angleFor = (i: number) => (-90 + (i * 360) / n) * (Math.PI / 180);
  const point = (i: number, v: number) => {
    const r = (Math.max(0, Math.min(max, v)) / max) * R;
    const a = angleFor(i);
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as const;
  };

  const rings = [0.25, 0.5, 0.75, 1];
  const labelPos = (i: number) => {
    const a = angleFor(i);
    return [cx + (R + 22) * Math.cos(a), cy + (R + 22) * Math.sin(a)] as const;
  };

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto h-auto w-full max-w-sm" role="img" aria-label={series.map((s) => s.label).join(" vs ")}>
      {/* grid rings */}
      {rings.map((f) => (
        <polygon
          key={f}
          points={axes.map((_, i) => point(i, f * max).join(",")).join(" ")}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.12}
        />
      ))}
      {/* spokes */}
      {axes.map((_, i) => {
        const [x, y] = point(i, max);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="currentColor" strokeOpacity={0.12} />;
      })}
      {/* series polygons */}
      {series.map((s) => (
        <polygon
          key={s.label}
          points={s.values.map((v, i) => point(i, v ?? 0).join(",")).join(" ")}
          fill={s.color}
          fillOpacity={0.15}
          stroke={s.color}
          strokeWidth={2}
        />
      ))}
      {/* axis labels */}
      {axes.map((label, i) => {
        const [x, y] = labelPos(i);
        const anchor = x < cx - 4 ? "end" : x > cx + 4 ? "start" : "middle";
        return (
          <text key={i} x={x} y={y} textAnchor={anchor} dominantBaseline="middle" className="fill-current text-[10px] opacity-70">
            {label.length > 16 ? label.slice(0, 15) + "…" : label}
          </text>
        );
      })}
    </svg>
  );
}

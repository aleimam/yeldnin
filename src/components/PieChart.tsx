// Pure SVG pie chart + legend — no client JS, renders on the server. Colors may be
// CSS variables (e.g. var(--brand)); applied via `style.fill` so they resolve.

export interface PieSlice {
  label: string;
  value: number;
  color: string;
  /** Optional secondary text shown after the label in the legend (e.g. a formatted amount). */
  hint?: string;
}

export function PieChart({ slices, size = 168 }: { slices: PieSlice[]; size?: number }) {
  const data = slices.filter((s) => s.value > 0);
  const total = data.reduce((s, x) => s + x.value, 0);
  const r = size / 2;
  const point = (frac: number): [number, number] => {
    const a = 2 * Math.PI * frac - Math.PI / 2;
    return [r + r * Math.cos(a), r + r * Math.sin(a)];
  };

  let acc = 0;
  const arcs = data.map((s) => {
    const start = acc / total;
    acc += s.value;
    const end = acc / total;
    return { ...s, start, end, pct: s.value / total };
  });

  return (
    <div className="flex flex-wrap items-center gap-5">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="pie chart" className="shrink-0">
        {total === 0 ? (
          <circle cx={r} cy={r} r={r} className="fill-canvas" />
        ) : arcs.length === 1 ? (
          <circle cx={r} cy={r} r={r} style={{ fill: arcs[0].color }} />
        ) : (
          arcs.map((s, i) => {
            const [x1, y1] = point(s.start);
            const [x2, y2] = point(s.end);
            const large = s.end - s.start > 0.5 ? 1 : 0;
            return <path key={i} d={`M ${r} ${r} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`} style={{ fill: s.color }} />;
          })
        )}
      </svg>
      <ul className="min-w-0 space-y-1.5 text-sm">
        {arcs.map((s, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: s.color }} />
            <span className="truncate text-ink">{s.label}</span>
            <span className="ms-auto whitespace-nowrap text-muted">{s.hint ? `${s.hint} · ` : ""}{Math.round(s.pct * 100)}%</span>
          </li>
        ))}
        {arcs.length === 0 && <li className="text-muted">—</li>}
      </ul>
    </div>
  );
}

import React from 'react';

// IELTS Writing Task 1 chart from data: bar (grouped), line, pie, table, mixed (bars + line on
// a second axis). Plain SVG so it works offline and prints; colours are a fixed accessible set.
const COLORS = ['#8A334C', '#2563EB', '#059669', '#D97706', '#7C3AED', '#0891B2'];
const W = 640, H = 300, L = 48, R = 48, T = 16, B = 44;

const niceMax = (v) => {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
};
const fmt = (v) => (Math.abs(v) >= 1000 ? `${+(v / 1000).toFixed(1)}k` : `${+(+v).toFixed(1)}`);

function Axes({ max, label, right, rightMax }) {
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  return (
    <g fontSize="11" fill="var(--text-secondary)">
      {ticks.map(t => {
        const y = T + (H - T - B) * (1 - t);
        return (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y} y2={y} stroke="var(--border-light)" />
            <text x={L - 6} y={y + 4} textAnchor="end">{fmt(max * t)}</text>
            {right && <text x={W - R + 6} y={y + 4}>{fmt(rightMax * t)}</text>}
          </g>
        );
      })}
      {label && <text x={L} y={T - 4} fontSize="10">{label}</text>}
    </g>
  );
}

function Legend({ series, kinds }) {
  return (
    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
      {series.map((s, i) => (
        <span key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 12, height: kinds?.[i] === 'line' ? 3 : 12, borderRadius: 2, backgroundColor: COLORS[i % COLORS.length] }} /> {s.name}
        </span>
      ))}
    </div>
  );
}

export default function Task1Chart({ chart }) {
  if (!chart) return null;
  const { type, categories = [], series = [], unit = '', title } = chart;
  const wrap = (children) => (
    <figure data-testid="task1-chart" style={{ margin: '0 0 12px', padding: 12, backgroundColor: 'var(--surface-plain)', border: '1px solid var(--border-light)', borderRadius: 12 }}>
      <figcaption style={{ textAlign: 'center', fontWeight: 700, color: 'var(--text-navy)', fontSize: '0.9rem', marginBottom: 6 }}>{title}</figcaption>
      {children}
    </figure>
  );

  if (type === 'table') {
    return wrap(
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', margin: '0 auto', fontSize: '0.85rem', color: 'var(--text-ink)' }}>
          <thead><tr><th style={{ border: '1px solid var(--border-medium)', padding: '6px 10px' }}></th>
            {series.map(s => <th key={s.name} style={{ border: '1px solid var(--border-medium)', padding: '6px 10px' }}>{s.name}</th>)}</tr></thead>
          <tbody>{categories.map((c, i) => (
            <tr key={c}><th style={{ border: '1px solid var(--border-medium)', padding: '6px 10px', textAlign: 'left' }}>{c}</th>
              {series.map(s => <td key={s.name} style={{ border: '1px solid var(--border-medium)', padding: '6px 10px', textAlign: 'right' }}>{s.values[i]}</td>)}</tr>
          ))}</tbody>
        </table>
        {unit && <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>Đơn vị: {unit}</div>}
      </div>
    );
  }

  if (type === 'pie') {
    const vals = series[0]?.values || [];
    const total = vals.reduce((a, b) => a + b, 0) || 1;
    let angle = -Math.PI / 2;
    const cx = 150, cy = 140, r = 115;
    const slices = vals.map((v, i) => {
      const a0 = angle, a1 = angle + (v / total) * Math.PI * 2;
      angle = a1;
      const large = a1 - a0 > Math.PI ? 1 : 0;
      const p = (a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
      const [x0, y0] = p(a0), [x1, y1] = p(a1);
      const mid = (a0 + a1) / 2;
      return { d: `M${cx},${cy} L${x0},${y0} A${r},${r} 0 ${large} 1 ${x1},${y1} Z`, lx: cx + r * 0.65 * Math.cos(mid), ly: cy + r * 0.65 * Math.sin(mid), v, i };
    });
    return wrap(
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
        <svg viewBox="0 0 300 280" style={{ width: 280, maxWidth: '100%' }} role="img" aria-label={title}>
          {slices.map(s => (
            <g key={s.i}>
              <path d={s.d} fill={COLORS[s.i % COLORS.length]} stroke="var(--surface-plain)" strokeWidth="2" />
              <text x={s.lx} y={s.ly + 4} textAnchor="middle" fontSize="12" fontWeight="700" fill="white">{s.v}{unit === '%' ? '%' : ''}</text>
            </g>
          ))}
        </svg>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: '0.82rem', color: 'var(--text-ink)' }}>
          {categories.map((c, i) => (
            <span key={c} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: COLORS[i % COLORS.length] }} />{c}</span>
          ))}
        </div>
      </div>
    );
  }

  const kinds = series.map(s => s.kind || (type === 'line' ? 'line' : 'bar'));
  const barSeries = series.filter((_, i) => kinds[i] === 'bar');
  const lineSeries = series.filter((_, i) => kinds[i] === 'line');
  const dual = type === 'mixed' && barSeries.length && lineSeries.length;
  const leftMax = niceMax(Math.max(...(dual ? barSeries : series).flatMap(s => s.values), 0));
  const rightMax = dual ? niceMax(Math.max(...lineSeries.flatMap(s => s.values), 0)) : leftMax;
  const plotW = W - L - R, plotH = H - T - B;
  const slot = plotW / Math.max(1, categories.length);
  const y = (v, max) => T + plotH * (1 - v / max);
  const bw = Math.min(28, (slot * 0.7) / Math.max(1, barSeries.length));

  return wrap(
    <>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: W, display: 'block', margin: '0 auto' }} role="img" aria-label={title}>
        <Axes max={leftMax} label={dual ? barSeries[0].name : unit} right={dual} rightMax={rightMax} />
        {categories.map((c, ci) => (
          <text key={c} x={L + slot * ci + slot / 2} y={H - B + 16} textAnchor="middle" fontSize="11" fill="var(--text-secondary)">{c}</text>
        ))}
        {barSeries.map((s, si) => {
          const color = COLORS[series.indexOf(s) % COLORS.length];
          return s.values.map((v, ci) => {
            const x = L + slot * ci + slot / 2 - (bw * barSeries.length) / 2 + si * bw;
            return <rect key={`${si}-${ci}`} x={x} y={y(v, leftMax)} width={bw - 2} height={T + plotH - y(v, leftMax)} fill={color} rx="2"><title>{`${s.name} · ${categories[ci]}: ${v}`}</title></rect>;
          });
        })}
        {lineSeries.map((s) => {
          const color = COLORS[series.indexOf(s) % COLORS.length];
          const max = dual ? rightMax : leftMax;
          const pts = s.values.map((v, ci) => [L + slot * ci + slot / 2, y(v, max)]);
          return (
            <g key={s.name}>
              <polyline points={pts.map(p => p.join(',')).join(' ')} fill="none" stroke={color} strokeWidth="2.5" />
              {pts.map(([px, py], ci) => <circle key={ci} cx={px} cy={py} r="3.5" fill={color}><title>{`${s.name} · ${categories[ci]}: ${s.values[ci]}`}</title></circle>)}
            </g>
          );
        })}
      </svg>
      <Legend series={series} kinds={kinds} />
    </>
  );
}

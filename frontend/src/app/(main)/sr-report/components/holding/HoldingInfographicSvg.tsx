'use client';

import type {
  IconKpiRowProps,
  InfographicBlockPayload,
  KpiOrbitProps,
  ReductionTimelineProps,
  ScopePyramidProps,
} from '../../lib/holdingInfographicTypes';

function KpiOrbitSvg({ props: p }: { props: KpiOrbitProps }) {
  const cx = 260;
  const cy = 130;
  const R = 38;
  const orbit = 95;
  const angles = [-90, 30, 150].map((deg) => {
    const rad = (deg * Math.PI) / 180;
    return { x: cx + orbit * Math.cos(rad), y: cy + orbit * Math.sin(rad) };
  });
  return (
    <svg viewBox="0 0 520 260" className="w-full max-w-[520px] h-auto" role="img" aria-label="KPI 원형 인포그래픽">
      <title>KPI 원형 인포그래픽</title>
      {angles.map((pt, i) => {
        const s = p.scopes[i];
        if (!s) return null;
        return (
          <g key={i}>
            <circle cx={pt.x} cy={pt.y} r={44} fill={s.color} opacity={0.88} />
            <text x={pt.x} y={pt.y - 6} textAnchor="middle" fill="#fff" fontSize={9} fontWeight={700}>
              {s.label}
            </text>
            <text x={pt.x} y={pt.y + 6} textAnchor="middle" fill="#fff" fontSize={11} fontWeight={700}>
              {s.value}
            </text>
            <text x={pt.x} y={pt.y + 20} textAnchor="middle" fill="rgba(255,255,255,0.85)" fontSize={7}>
              {s.sublabel}
            </text>
          </g>
        );
      })}
      <circle cx={cx} cy={cy} r={R} fill="#1e3a5f" />
      <text x={cx} y={cy - 6} textAnchor="middle" fill="#fff" fontSize={10} fontWeight={600}>
        {p.centerLabel}
      </text>
      <text x={cx} y={cy + 10} textAnchor="middle" fill="#fff" fontSize={18} fontWeight={800}>
        {p.centerPct}%
      </text>
    </svg>
  );
}

function ReductionTimelineSvg({ props: p }: { props: ReductionTimelineProps }) {
  const n = p.points.length;
  const w = 520;
  const pad = 40;
  const y = 100;
  const x = (i: number) => pad + ((w - 2 * pad) * i) / Math.max(1, n - 1);
  return (
    <svg viewBox={`0 0 ${w} 200`} className="w-full max-w-[520px] h-auto" role="img" aria-label="감축 여정 타임라인">
      <title>감축 여정 타임라인</title>
      <line x1={pad} y1={y} x2={w - pad} y2={y} stroke="#ccc" strokeWidth={2} />
      {p.points.map((pt, i) => (
        <g key={i}>
          <polygon
            points={`${x(i)},${y - 10} ${x(i) + 10},${y} ${x(i)},${y + 10} ${x(i) - 10},${y}`}
            fill={pt.color}
          />
          <text x={x(i)} y={y + 28} textAnchor="middle" fill="#333" fontSize={10} fontWeight={700}>
            {pt.year}
          </text>
          <text x={x(i)} y={y + 42} textAnchor="middle" fill="#666" fontSize={8}>
            {pt.title}
          </text>
          <text x={x(i)} y={y + 54} textAnchor="middle" fill="#222" fontSize={9} fontWeight={600}>
            {pt.value} {pt.status}
          </text>
        </g>
      ))}
    </svg>
  );
}

function ScopePyramidSvg({ props: p }: { props: ScopePyramidProps }) {
  const w = 400;
  const h = 220;
  const cx = w / 2;
  const layers = p.layers;
  const layerH = Math.min(52, Math.floor(160 / Math.max(layers.length, 1)));
  let yTop = 24;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full max-w-[400px] h-auto" role="img" aria-label="Scope 피라미드">
      <title>Scope 계층 피라미드</title>
      {layers.map((layer, i) => {
        const wTop = 200 - i * 38;
        const wBot = 200 - (i + 1) * 38;
        const pts = `${cx - wTop / 2},${yTop} ${cx + wTop / 2},${yTop} ${cx + wBot / 2},${yTop + layerH} ${cx - wBot / 2},${yTop + layerH}`;
        const midY = yTop + layerH / 2;
        const g = (
          <g key={i}>
            <polygon points={pts} fill={layer.color} opacity={0.92} stroke="#fff" strokeWidth={1.5} />
            <text x={cx} y={midY + 4} textAnchor="middle" fill="#fff" fontSize={10} fontWeight={700}>
              {layer.scope} · {layer.value} tCO₂e
            </text>
            {p.showPct && (
              <text x={cx + wTop / 2 + 8} y={midY + 4} textAnchor="start" fill="#555" fontSize={10} fontWeight={600}>
                {layer.pct}%
              </text>
            )}
          </g>
        );
        yTop += layerH;
        return g;
      })}
    </svg>
  );
}

function IconKpiRowSvg({ props: p }: { props: IconKpiRowProps }) {
  const w = 520;
  const items = p.items;
  const gap = w / Math.max(items.length, 1);
  return (
    <svg viewBox={`0 0 ${w} 120`} className="w-full max-w-[520px] h-auto" role="img" aria-label="아이콘 KPI">
      <title>아이콘 + 원형 KPI</title>
      {items.map((it, i) => {
        const cx = gap * i + gap / 2;
        const cy = 44;
        const r = 32;
        return (
          <g key={i}>
            <circle cx={cx} cy={cy} r={r} fill="#f5f5f5" stroke={it.color} strokeWidth={3} />
            <text x={cx} y={cy - 4} textAnchor="middle" fontSize={16}>
              {it.icon}
            </text>
            <text x={cx} y={cy + 12} textAnchor="middle" fill={it.color} fontSize={12} fontWeight={800}>
              {it.pct}%
            </text>
            <text x={cx} y={cy + 52} textAnchor="middle" fill="#333" fontSize={9} fontWeight={600}>
              {it.title}
            </text>
            <text x={cx} y={cy + 64} textAnchor="middle" fill="#888" fontSize={7}>
              {it.sub}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function HoldingInfographicSvg({ block }: { block: InfographicBlockPayload }) {
  switch (block.templateId) {
    case 'kpi-orbit':
      return <KpiOrbitSvg props={block.props} />;
    case 'reduction-timeline':
      return <ReductionTimelineSvg props={block.props} />;
    case 'scope-pyramid':
      return <ScopePyramidSvg props={block.props} />;
    case 'icon-kpi-row':
      return <IconKpiRowSvg props={block.props} />;
    default:
      return null;
  }
}

'use client';

import { C } from '@/app/(main)/dashboard/lib/constants';

const P = {
  ink: C.g800,
  muted: C.g500,
  faint: C.g400,
  dust: C.g300,
};

export function HoldingSparkline({
  values,
  color,
  height = 32,
  width = 80,
}: {
  values: number[];
  color: string;
  height?: number;
  width?: number;
}) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(' ');
  const lastY = height - ((values[values.length - 1] - min) / range) * (height - 4) - 2;
  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }} aria-hidden>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={width} cy={lastY} r="2.5" fill={color} />
    </svg>
  );
}

export function HoldingTag({ color, children, small }: { color: string; children: React.ReactNode; small?: boolean }) {
  return (
    <span
      style={{
        background: `${color}18`,
        color,
        fontSize: small ? 10 : 11,
        fontWeight: 700,
        padding: small ? '1px 6px' : '2px 8px',
        borderRadius: 4,
        whiteSpace: 'nowrap',
        border: `0.5px solid ${color}30`,
      }}
    >
      {children}
    </span>
  );
}

export function HoldingSLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 700,
        color: P.dust,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  );
}

export function HoldingMiniBarRow({
  val,
  max,
  color,
  thin,
}: {
  val: number;
  max: number;
  color: string;
  thin?: boolean;
}) {
  const pct = max > 0 ? Math.min(Math.round((val / max) * 100), 100) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div
        style={{
          flex: 1,
          height: thin ? 3 : 5,
          background: '#f5f4f0',
          borderRadius: 3,
          overflow: 'hidden',
        }}
      >
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 10, color: P.faint, minWidth: 28, textAlign: 'right' }}>{pct}%</span>
    </div>
  );
}

export function HoldingStackedGhgBar({
  scope1,
  scope2,
  scope3,
  maxTotal,
  muted,
}: {
  scope1: number;
  scope2: number;
  scope3: number;
  maxTotal: number;
  muted?: boolean;
}) {
  const w1 = maxTotal > 0 ? (scope1 / maxTotal) * 100 : 0;
  const w2 = maxTotal > 0 ? (scope2 / maxTotal) * 100 : 0;
  const w3 = maxTotal > 0 ? (scope3 / maxTotal) * 100 : 0;
  const op = muted ? 0.55 : 1;
  return (
    <div style={{ display: 'flex', height: 5, borderRadius: 3, overflow: 'hidden', gap: 1, opacity: op }}>
      <div style={{ width: `${w1}%`, height: '100%', background: C.teal, flexShrink: 0 }} title="Scope1" />
      <div style={{ width: `${w2}%`, height: '100%', background: C.blue, flexShrink: 0 }} title="Scope2" />
      <div style={{ width: `${w3}%`, height: '100%', background: C.g400, flexShrink: 0 }} title="Scope3" />
    </div>
  );
}

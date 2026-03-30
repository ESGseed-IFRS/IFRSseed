'use client';

import React from 'react';
import { C, CAT_CFG, ST_CFG } from '../../lib/constants';

/* ─── Card ────────────────────────────────────── */
export function Card({
  children,
  style = {},
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        background: 'white',
        border: `1px solid ${C.g200}`,
        borderRadius: 10,
        padding: '14px 16px',
        boxShadow: '0 1px 3px rgba(0,0,0,.05)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ─── CTitle (Card Title) ─────────────────────── */
export function CTitle({
  children,
  action,
  sub,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
  sub?: string;
}) {
  return (
    <div style={{ marginBottom: 11 }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '.07em',
            color: C.g400,
            flex: 1,
          }}
        >
          {children}
        </div>
        {action}
      </div>
      {sub ? (
        <div style={{ fontSize: 11, color: C.g500, marginTop: 4, fontWeight: 500, letterSpacing: 0 }}>
          {sub}
        </div>
      ) : null}
    </div>
  );
}

/* ─── Pbar (Progress bar) ─────────────────────── */
export function Pbar({
  pct,
  color = C.blue,
  h = 5,
}: {
  pct: number;
  color?: string;
  h?: number;
}) {
  return (
    <div
      style={{
        height: h,
        background: C.g100,
        borderRadius: h,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: '100%',
          borderRadius: h,
          background: color,
          transition: 'width .5s',
        }}
      />
    </div>
  );
}

/* ─── StBadge (Status badge) ──────────────────── */
export function StBadge({ s }: { s: 'done' | 'warn' | 'error' | 'none' }) {
  const cfg = ST_CFG[s] ?? ST_CFG.none;
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 600,
        padding: '2px 8px',
        borderRadius: 12,
        background: cfg.bg,
        color: cfg.color,
        whiteSpace: 'nowrap',
      }}
    >
      {cfg.label}
    </span>
  );
}

/* ─── CatBadge (Category badge) ────────────────── */
export function CatBadge({ cat }: { cat: 'E' | 'S' | 'G' | 'IT' }) {
  const cc = CAT_CFG[cat] ?? CAT_CFG.E;
  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 700,
        padding: '2px 6px',
        borderRadius: 4,
        background: cc.bg,
        color: cc.fg,
      }}
    >
      {cat}
    </span>
  );
}

/* ─── Btn ──────────────────────────────────────── */
export function Btn({
  children,
  onClick,
  v = 'outline',
  color = C.blue,
  disabled,
  style = {},
}: {
  children: React.ReactNode;
  onClick?: () => void;
  v?: 'outline' | 'solid' | 'ghost' | 'teal' | 'amber';
  color?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
}) {
  const vs: Record<string, { bg: string; bd: string; tc: string }> = {
    outline: { bg: 'white', bd: `1px solid ${color}`, tc: color },
    solid: { bg: color, bd: `1px solid ${color}`, tc: 'white' },
    ghost: { bg: 'transparent', bd: `1px solid ${C.g200}`, tc: C.g600 },
    teal: { bg: C.tealSoft, bd: '1px solid #6ee7d5', tc: C.teal },
    amber: { bg: C.amberSoft, bd: '1px solid #fcd34d', tc: C.amber },
  };
  const cfg = vs[v] ?? vs.outline;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        height: 30,
        padding: '0 12px',
        borderRadius: 6,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'inherit',
        fontSize: 11,
        fontWeight: 500,
        border: cfg.bd,
        background: cfg.bg,
        color: cfg.tc,
        opacity: disabled ? 0.5 : 1,
        ...style,
      }}
    >
      {children}
    </button>
  );
}

/* ─── KpiCard ──────────────────────────────────── */
export function KpiCard({
  label,
  val,
  unit,
  sub,
  color,
  top,
}: {
  label: string;
  val: string;
  unit?: string;
  sub?: string;
  color: string;
  top?: string;
}) {
  return (
    <div
      style={{
        background: 'white',
        borderRadius: 10,
        padding: '13px 15px',
        borderTop: `3px solid ${top ?? color}`,
        boxShadow: '0 1px 3px rgba(0,0,0,.06)',
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: C.g400,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '.07em',
          marginBottom: 5,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 700,
          color,
          fontFamily: "'DM Mono',monospace",
          lineHeight: 1,
          marginBottom: 3,
        }}
      >
        {val}
      </div>
      <div style={{ fontSize: 11, color: C.g500 }}>
        {unit && (
          <span
            style={{
              fontFamily: "'DM Mono',monospace",
              marginRight: 4,
              fontSize: 10,
            }}
          >
            {unit}{' '}
          </span>
        )}
        {sub}
      </div>
    </div>
  );
}

/* ─── AlertBanner ──────────────────────────────── */
export function AlertBanner({
  type = 'warn',
  msg,
  action,
  onAction,
}: {
  type?: 'warn' | 'error' | 'info';
  msg: string;
  action?: string;
  onAction?: () => void;
}) {
  const cfg: Record<string, { bg: string; bd: string; color: string; icon: string }> = {
    warn: { bg: C.amberSoft, bd: '#fcd34d', color: C.amber, icon: '⚠' },
    error: { bg: C.redSoft, bd: '#fca5a5', color: C.red, icon: '✗' },
    info: { bg: C.blueSoft, bd: '#c2d4f5', color: C.blue, icon: 'i' },
  };
  const c = cfg[type];
  return (
    <div
      style={{
        background: c.bg,
        border: `1px solid ${c.bd}`,
        borderRadius: 7,
        padding: '8px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 9,
      }}
    >
      <span style={{ fontSize: 12, color: c.color, fontWeight: 700 }}>{c.icon}</span>
      <div style={{ flex: 1, fontSize: 11, color: C.g700 }}>{msg}</div>
      {action && onAction && (
        <button
          type="button"
          onClick={onAction}
          style={{
            fontSize: 11,
            padding: '2px 9px',
            borderRadius: 4,
            border: `1px solid ${c.bd}`,
            background: 'white',
            color: c.color,
            cursor: 'pointer',
            fontFamily: 'inherit',
            whiteSpace: 'nowrap',
          }}
        >
          {action}
        </button>
      )}
    </div>
  );
}

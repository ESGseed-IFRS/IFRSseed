import type { ReactNode } from 'react';

function mk(d: ReactNode, sz = 16, col = '#94A3B8') {
  return (
    <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke={col} strokeWidth="2">
      {d}
    </svg>
  );
}

export function UserIcon() {
  return mk(
    <>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </>,
  );
}

export function LockIcon() {
  return mk(
    <>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </>,
  );
}

export function EyeIcon() {
  return mk(
    <>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </>,
  );
}

export function EyeOffIcon() {
  return mk(
    <>
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </>,
  );
}

export function InfoIcon({ size = 16, color = '#94A3B8' }: { size?: number; color?: string }) {
  return mk(
    <>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </>,
    size,
    color,
  );
}

export function MailIcon() {
  return mk(
    <>
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </>,
    28,
    '#2563EB',
  );
}

export function RegIcon() {
  return mk(
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <line x1="20" y1="8" x2="20" y2="14" />
      <line x1="23" y1="11" x2="17" y2="11" />
    </>,
    20,
    '#2563EB',
  );
}

export function CheckIcon({ size = 16 }: { size?: number }) {
  return mk(<polyline points="20 6 9 17 4 12" />, size, 'currentColor');
}

export function KeyIcon() {
  return mk(
    <>
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
    </>,
    16,
    '#4F7FFF',
  );
}

export function BuildingIcon() {
  return mk(
    <>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </>,
    18,
    '#2563EB',
  );
}

export function ClockIcon() {
  return mk(
    <>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </>,
    18,
    '#B45309',
  );
}

export function LogoMark() {
  return (
    <svg width="32" height="32" viewBox="0 0 36 36" fill="none">
      <rect x="0" y="0" width="16" height="16" rx="3" fill="#4F7FFF" />
      <rect x="20" y="0" width="16" height="16" rx="3" fill="#4F7FFF" opacity=".5" />
      <rect x="0" y="20" width="16" height="16" rx="3" fill="#4F7FFF" opacity=".3" />
      <rect x="20" y="20" width="16" height="16" rx="3" fill="#4F7FFF" />
    </svg>
  );
}

export function Spinner() {
  return (
    <span
      style={{
        width: 17,
        height: 17,
        border: '2px solid rgba(255,255,255,.3)',
        borderTopColor: '#fff',
        borderRadius: '50%',
        display: 'inline-block',
        animation: 'authSpin .7s linear infinite',
      }}
    />
  );
}

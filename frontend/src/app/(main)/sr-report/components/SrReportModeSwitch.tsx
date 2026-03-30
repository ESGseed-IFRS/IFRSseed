'use client';

export type SrReportWorkspace = 'subsidiary' | 'holding';

type Props = {
  value: SrReportWorkspace;
  onChange: (next: SrReportWorkspace) => void;
};

export function SrReportModeSwitch({ value, onChange }: Props) {
  const pill = (active: boolean) =>
    ({
      padding: '6px 14px',
      borderRadius: 999,
      border: active ? '1px solid rgba(19,81,216,0.45)' : '1px solid rgba(12,35,64,0.12)',
      background: active ? 'rgba(19,81,216,0.1)' : 'transparent',
      color: active ? '#1351D8' : 'rgba(12,35,64,0.55)',
      fontSize: 12,
      fontWeight: 800,
      cursor: 'pointer',
    }) as const;

  return (
    <div
      role="tablist"
      aria-label="작성 주체"
      style={{
        display: 'inline-flex',
        gap: 4,
        padding: 4,
        borderRadius: 999,
        background: 'rgba(12,35,64,0.04)',
        border: '1px solid rgba(12,35,64,0.08)',
      }}
    >
      <button type="button" role="tab" aria-selected={value === 'subsidiary'} style={pill(value === 'subsidiary')} onClick={() => onChange('subsidiary')}>
        계열사
      </button>
      <button type="button" role="tab" aria-selected={value === 'holding'} style={pill(value === 'holding')} onClick={() => onChange('holding')}>
        지주사
      </button>
    </div>
  );
}

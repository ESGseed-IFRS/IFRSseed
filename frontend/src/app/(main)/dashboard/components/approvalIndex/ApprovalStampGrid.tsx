'use client';

import { useMemo, type CSSProperties } from 'react';
import { C } from '@/app/(main)/dashboard/lib/constants';
import type { ApprovalDocUnified, ApprovalLine } from '@/app/(main)/dashboard/lib/approvalUnified';

const STAMP_ORDER: ApprovalLine['role'][] = ['기안', '협조', '검토', '승인'];

function shortDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${mm}.${dd} ${hh}:${mi}`;
}

function computeColumnStates(
  doc: ApprovalDocUnified,
  n: number,
): { state: string; time: string | null }[] {
  const out = Array.from({ length: n }, () => ({ state: '대기', time: null as string | null }));
  if (n === 0) return out;

  if (doc.status === 'draft') return out;

  if (doc.status === 'approved') {
    return out.map(() => ({ state: '승인', time: shortDateTime(doc.updatedAt) }));
  }

  if (doc.status === 'rejected') {
    if (n === 1) {
      out[0] = { state: '반려', time: shortDateTime(doc.updatedAt) };
      return out;
    }
    for (let i = 0; i < n - 1; i++) {
      out[i] = { state: '승인', time: shortDateTime(doc.draftedAt) };
    }
    out[n - 1] = { state: '반려', time: shortDateTime(doc.updatedAt) };
    return out;
  }

  if (doc.status === 'received') {
    return out.map(() => ({ state: '참조', time: null }));
  }

  out[0] = { state: '승인', time: shortDateTime(doc.draftedAt) };

  let progressIdx = -1;
  if (doc.myTurn) progressIdx = Math.min(1, n - 1);
  else if (doc.status === 'inProgress') progressIdx = n >= 2 ? n - 1 : 0;

  for (let i = 1; i < n; i++) {
    if (progressIdx >= 0 && i === progressIdx) out[i] = { state: '진행', time: null };
    else if (progressIdx >= 0 && i < progressIdx) out[i] = { state: '승인', time: shortDateTime(doc.updatedAt) };
    else out[i] = { state: '대기', time: null };
  }
  return out;
}

export function buildStampColumns(doc: ApprovalDocUnified): { role: string; name: string }[] {
  const cols: { role: string; name: string }[] = [];
  for (const role of STAMP_ORDER) {
    const line = doc.approvalLines.find((l) => l.role === role);
    if (!line?.people.length) continue;
    for (const p of line.people) cols.push({ role, name: p.name });
  }
  return cols;
}

export function ApprovalStampGrid({
  doc,
  onOpenLineModal,
}: {
  doc: ApprovalDocUnified;
  onOpenLineModal: () => void;
}) {
  const columns = useMemo(() => buildStampColumns(doc), [doc]);
  const states = useMemo(() => computeColumnStates(doc, columns.length), [doc, columns.length]);

  if (columns.length === 0) {
    return (
      <div
        style={{
          border: '1px solid #111',
          background: '#fff',
          padding: 16,
          textAlign: 'center',
          fontSize: 12,
          color: C.g600,
        }}
      >
        표시할 결재 단계가 없습니다.{' '}
        <button type="button" onClick={onOpenLineModal} style={linkBtn}>
          결재라인설정
        </button>
        에서 기안·검토·승인 인원을 등록하세요.
      </div>
    );
  }

  const cellBorder: CSSProperties = {
    border: '1px solid #111',
    padding: '8px 10px',
    textAlign: 'center',
    verticalAlign: 'middle',
    fontSize: 11,
    color: '#111',
    background: '#fff',
  };

  const thStyle: CSSProperties = {
    ...cellBorder,
    fontWeight: 800,
    background: '#f3f4f6',
    minWidth: 72,
  };

  return (
    <div style={{ border: '1px solid #111', background: '#fff', overflow: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
        <tbody>
          <tr>
            <td
              rowSpan={3}
              style={{
                ...cellBorder,
                width: 28,
                padding: '6px 4px',
                fontWeight: 800,
                fontSize: 12,
                writingMode: 'vertical-rl',
                textOrientation: 'mixed',
                letterSpacing: '0.15em',
                background: '#e5e7eb',
              }}
            >
              결재
            </td>
            {columns.map((c, i) => (
              <th key={`h-${i}-${c.role}-${c.name}`} style={thStyle}>
                {c.role}
              </th>
            ))}
          </tr>
          <tr>
            {columns.map((c, i) => (
              <td key={`n-${i}`} style={{ ...cellBorder, fontWeight: 700, minHeight: 44 }}>
                {c.name}
              </td>
            ))}
          </tr>
          <tr>
            {columns.map((_, i) => {
              const s = states[i] ?? { state: '대기', time: null };
              return (
                <td key={`s-${i}`} style={{ ...cellBorder, minHeight: 52, lineHeight: 1.45 }}>
                  <div style={{ fontWeight: 800 }}>{s.state}</div>
                  {s.time && <div style={{ fontSize: 10, color: '#374151', marginTop: 4 }}>{s.time}</div>}
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

const linkBtn: CSSProperties = {
  border: 'none',
  background: 'none',
  padding: 0,
  color: '#2563eb',
  fontWeight: 800,
  cursor: 'pointer',
  textDecoration: 'underline',
};

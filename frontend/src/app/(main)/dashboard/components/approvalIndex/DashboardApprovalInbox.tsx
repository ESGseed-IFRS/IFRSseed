'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from '@/components/ui/sonner';
import type { Dispatch, SetStateAction } from 'react';
import { ApprovalLineSetupModal } from '@/app/(main)/dashboard/components/approvalIndex/ApprovalLineSetupModal';
import { ApprovalOfficialDocumentPanel } from '@/app/(main)/dashboard/components/approvalIndex/ApprovalOfficialDocumentPanel';
import { C } from '@/app/(main)/dashboard/lib/constants';
import type { ApprovalDomain, ApprovalMenuKey } from '@/app/(main)/dashboard/lib/dashboardNewMock';
import {
  APPROVAL_MENU_LABEL,
  ENTITY_TYPE_LABEL,
  STATUS_LABEL,
  type ApprovalDocUnified,
  type EntityType,
  filterUnifiedDocs,
  formatEntitySourceLine,
  sortUnifiedDocs,
} from '@/app/(main)/dashboard/lib/approvalUnified';

const DOMAIN_CHIPS: { key: 'all' | ApprovalDomain; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'ghg', label: 'GHG' },
  { key: 'sr', label: 'SR' },
  { key: 'audit', label: '감사' },
];

const ENTITY_CHIPS: { key: 'all' | EntityType; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'datacenter', label: ENTITY_TYPE_LABEL.datacenter },
  { key: 'domestic_site', label: ENTITY_TYPE_LABEL.domestic_site },
  { key: 'overseas_legal', label: ENTITY_TYPE_LABEL.overseas_legal },
  { key: 'subsidiary', label: ENTITY_TYPE_LABEL.subsidiary },
];

const STATUS_STYLE: Record<
  ApprovalDocUnified['status'],
  { bg: string; color: string; border: string }
> = {
  draft: { bg: '#F8FAFC', color: '#64748B', border: '#E2E8F0' },
  pending: { bg: '#FFFBEB', color: '#B45309', border: '#FDE68A' },
  inProgress: { bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' },
  approved: { bg: '#F0FDF4', color: '#15803D', border: '#BBF7D0' },
  rejected: { bg: '#FEF2F2', color: '#B91C1C', border: '#FECACA' },
  received: { bg: '#F5F3FF', color: '#5B21B6', border: '#DDD6FE' },
};

function StatusChip({ status }: { status: ApprovalDocUnified['status'] }) {
  const st = STATUS_STYLE[status];
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        padding: '2px 8px',
        borderRadius: 999,
        background: st.bg,
        color: st.color,
        border: `1px solid ${st.border}`,
        whiteSpace: 'nowrap',
      }}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

function domainChipStyle(domain: ApprovalDocUnified['domain']): { background: string; color: string } {
  if (domain === 'sr') return { background: '#EFF6FF', color: '#1D4ED8' };
  if (domain === 'audit') return { background: '#F5F3FF', color: '#6D28D9' };
  return { background: '#F0FDFA', color: '#0F766E' };
}

function domainChipLabel(domain: ApprovalDocUnified['domain']): string {
  if (domain === 'audit') return '감사';
  return domain.toUpperCase();
}

function compactLineSummary(doc: ApprovalDocUnified): string {
  const parts = doc.approvalLines
    .flatMap((l) => l.people.map((p) => `${l.role}:${p.name}`))
    .slice(0, 4);
  return parts.length ? parts.join(' → ') : '—';
}

export function DashboardApprovalInbox({
  mode,
  approvalDomain,
  setApprovalDomain,
  approvalMenu,
  setApprovalMenu,
  focusDocId,
  focusSrDpId,
  docs,
  setDocs,
}: {
  mode: 'subsidiary' | 'holding';
  approvalDomain: ApprovalDomain | 'all';
  setApprovalDomain: Dispatch<SetStateAction<ApprovalDomain | 'all'>>;
  approvalMenu: ApprovalMenuKey;
  setApprovalMenu: (menu: ApprovalMenuKey) => void;
  focusDocId?: string | null;
  focusSrDpId?: string | null;
  docs: ApprovalDocUnified[];
  setDocs: Dispatch<SetStateAction<ApprovalDocUnified[]>>;
}) {
  const [entityFilter, setEntityFilter] = useState<'all' | EntityType>('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lineEditId, setLineEditId] = useState<string | null>(null);

  const appliedFocusKey = useRef<string | null>(null);

  const updateDoc = useCallback((id: string, patch: Partial<ApprovalDocUnified>) => {
    const ts = patch.updatedAt ?? new Date().toISOString();
    setDocs((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch, updatedAt: ts } : d)));
  }, []);

  const rows = useMemo(() => {
    const f = filterUnifiedDocs(docs, {
      menuKey: approvalMenu,
      domain: approvalDomain,
      entityType: mode === 'holding' ? entityFilter : 'all',
      q: search,
    });
    return sortUnifiedDocs(f);
  }, [docs, approvalMenu, approvalDomain, entityFilter, mode, search]);

  useEffect(() => {
    setSelectedId((prev) => {
      if (prev && rows.some((r) => r.id === prev)) return prev;
      return rows[0]?.id ?? null;
    });
  }, [rows]);

  const focusKey = `${focusDocId ?? ''}|${focusSrDpId ?? ''}`;
  useEffect(() => {
    if (!focusDocId && !focusSrDpId) return;
    if (appliedFocusKey.current === focusKey) return;
    const id =
      focusDocId ??
      docs.find(
        (d) =>
          d.links?.srDpId === focusSrDpId ||
          d.links?.srDpCode === focusSrDpId ||
          (focusSrDpId && d.id === focusSrDpId),
      )?.id;
    if (id && docs.some((d) => d.id === id)) {
      setSelectedId(id);
      appliedFocusKey.current = focusKey;
    }
  }, [focusDocId, focusSrDpId, focusKey, docs]);

  const selected = rows.find((r) => r.id === selectedId) ?? null;
  const lineEditDoc = lineEditId ? docs.find((d) => d.id === lineEditId) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        {DOMAIN_CHIPS.map((d) => (
          <button
            key={d.key}
            type="button"
            onClick={() => setApprovalDomain(d.key)}
            style={{
              borderRadius: 999,
              border: 'none',
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              background: approvalDomain === d.key ? C.navy : '#e5e7eb',
              color: approvalDomain === d.key ? '#fff' : C.g600,
            }}
          >
            {d.label}
          </button>
        ))}
      </div>

      {mode === 'holding' && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.g500, marginRight: 4 }}>출처(스냅샷)</span>
          {ENTITY_CHIPS.map((e) => (
            <button
              key={e.key}
              type="button"
              onClick={() => setEntityFilter(e.key)}
              style={{
                borderRadius: 999,
                border: `1px solid ${entityFilter === e.key ? C.navy : C.g200}`,
                padding: '4px 10px',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                background: entityFilter === e.key ? `${C.navy}12` : 'white',
                color: entityFilter === e.key ? C.navy : C.g600,
              }}
            >
              {e.label}
            </button>
          ))}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          gap: 0,
          borderRadius: 10,
          overflow: 'hidden',
          border: `1px solid ${C.g200}`,
          background: 'white',
          minHeight: 480,
          boxShadow: '0 1px 3px rgba(0,0,0,.05)',
        }}
      >
        <div
          style={{
            width: '38%',
            minWidth: 280,
            maxWidth: 420,
            borderRight: `1px solid ${C.g200}`,
            display: 'flex',
            flexDirection: 'column',
            background: '#FAFBFC',
          }}
        >
          <div style={{ padding: '12px 12px 10px', borderBottom: `1px solid ${C.g200}` }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="문서번호·제목·기안자·출처 검색"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '8px 10px',
                borderRadius: 8,
                border: `1px solid ${C.g200}`,
                fontSize: 12,
                outline: 'none',
              }}
            />
            <div style={{ fontSize: 10, color: C.g500, marginTop: 6 }}>
              메뉴: {APPROVAL_MENU_LABEL[approvalMenu]} · {rows.length}건
            </div>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {rows.length === 0 && (
              <div style={{ padding: 20, fontSize: 12, color: C.g500 }}>해당 문서가 없습니다.</div>
            )}
            {rows.map((r) => {
              const active = r.id === selectedId;
              const chip = domainChipStyle(r.domain);
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelectedId(r.id)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    border: 'none',
                    borderLeft: active ? `3px solid ${C.navy}` : '3px solid transparent',
                    background: active ? 'white' : 'transparent',
                    padding: '12px 12px 12px 14px',
                    cursor: 'pointer',
                    borderBottom: `1px solid ${C.g200}`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 800,
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: chip.background,
                        color: chip.color,
                      }}
                    >
                      {domainChipLabel(r.domain)}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 800, color: C.g800 }}>{r.id}</span>
                    {r.myTurn && (
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 800,
                          padding: '1px 6px',
                          borderRadius: 4,
                          background: C.amberSoft,
                          color: C.amber,
                        }}
                      >
                        내 차례
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: C.g800,
                      lineHeight: 1.35,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {r.title}
                  </div>
                  <div style={{ fontSize: 11, color: C.g500, marginTop: 6, lineHeight: 1.4 }}>
                    {r.drafter.name} · {formatEntitySourceLine(r)}
                  </div>
                  <div style={{ fontSize: 10, color: C.g400, marginTop: 4 }}>
                    {new Date(r.updatedAt).toLocaleString('ko-KR', {
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, gap: 8 }}>
                    <span style={{ fontSize: 10, color: C.g500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {compactLineSummary(r)}
                    </span>
                    <StatusChip status={r.status} />
                  </div>
                  {mode === 'holding' && (
                    <div style={{ marginTop: 6 }}>
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: 4,
                          background: '#F1F5F9',
                          color: '#475569',
                        }}
                      >
                        {ENTITY_TYPE_LABEL[r.entitySnapshot.entityType]}
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {!selected ? (
            <div style={{ padding: 24, fontSize: 13, color: C.g500 }}>문서를 선택하세요.</div>
          ) : (
            <ApprovalOfficialDocumentPanel
              doc={selected}
              onClose={() => setSelectedId(null)}
              onUpdateDoc={updateDoc}
              setApprovalMenu={setApprovalMenu}
              onOpenLineModal={() => setLineEditId(selected.id)}
            />
          )}
        </div>
      </div>

      {lineEditDoc && (
        <ApprovalLineSetupModal
          open={!!lineEditId}
          initialLines={lineEditDoc.approvalLines}
          readOnly={lineEditDoc.status === 'approved'}
          onClose={() => setLineEditId(null)}
          onSave={(lines) => {
            if (lineEditId) updateDoc(lineEditId, { approvalLines: lines });
            setLineEditId(null);
            toast.success('결재라인 반영됨', { description: '공문 우측 결재 표·요약에 즉시 반영됩니다. (mock 세션)' });
          }}
        />
      )}
    </div>
  );
}

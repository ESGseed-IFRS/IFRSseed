'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { Card, CTitle } from '@/app/(main)/dashboard/components/shared';
import { C } from '@/app/(main)/dashboard/lib/constants';
import type { ApprovalDomain } from '@/app/(main)/dashboard/lib/dashboardNewMock';
import type { ApprovalMenuKey } from '@/app/(main)/dashboard/lib/dashboardNewMock';
import {
  APPROVAL_MENU_LABEL,
  APPROVAL_UNIFIED_MOCK,
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
}: {
  mode: 'subsidiary' | 'holding';
  approvalDomain: ApprovalDomain | 'all';
  setApprovalDomain: Dispatch<SetStateAction<ApprovalDomain | 'all'>>;
  approvalMenu: ApprovalMenuKey;
}) {
  const [entityFilter, setEntityFilter] = useState<'all' | EntityType>('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const rows = useMemo(() => {
    const f = filterUnifiedDocs(APPROVAL_UNIFIED_MOCK, {
      menuKey: approvalMenu,
      domain: approvalDomain,
      entityType: mode === 'holding' ? entityFilter : 'all',
      q: search,
    });
    return sortUnifiedDocs(f);
  }, [approvalMenu, approvalDomain, entityFilter, mode, search]);

  useEffect(() => {
    setSelectedId((prev) => {
      if (prev && rows.some((r) => r.id === prev)) return prev;
      return rows[0]?.id ?? null;
    });
  }, [rows]);

  const selected = rows.find((r) => r.id === selectedId) ?? null;

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
        {/* 좌: 목록 */}
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
                        background: r.domain === 'sr' ? '#EFF6FF' : '#F0FDFA',
                        color: r.domain === 'sr' ? '#1D4ED8' : '#0F766E',
                      }}
                    >
                      {r.domain.toUpperCase()}
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
                    {new Date(r.updatedAt).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
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

        {/* 우: 공문 상세 */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {!selected ? (
            <div style={{ padding: 24, fontSize: 13, color: C.g500 }}>문서를 선택하세요.</div>
          ) : (
            <ApprovalOfficialDetail doc={selected} onClose={() => setSelectedId(null)} />
          )}
        </div>
      </div>
    </div>
  );
}

function ApprovalOfficialDetail({ doc, onClose }: { doc: ApprovalDocUnified; onClose: () => void }) {
  const readOnly = doc.status !== 'draft' && doc.status !== 'rejected';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div
        style={{
          padding: '12px 16px',
          borderBottom: `1px solid ${C.g200}`,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          justifyContent: 'flex-end',
          background: 'white',
        }}
      >
        <button
          type="button"
          disabled
          style={{
            padding: '6px 12px',
            fontSize: 11,
            fontWeight: 700,
            borderRadius: 8,
            border: `1px solid ${C.g200}`,
            background: '#F8FAFC',
            color: C.g400,
            cursor: 'not-allowed',
          }}
        >
          결재라인설정
        </button>
        <button
          type="button"
          disabled={readOnly}
          style={{
            padding: '6px 12px',
            fontSize: 11,
            fontWeight: 700,
            borderRadius: 8,
            border: 'none',
            background: readOnly ? C.g200 : C.navy,
            color: readOnly ? C.g400 : 'white',
            cursor: readOnly ? 'not-allowed' : 'pointer',
          }}
        >
          기안하기
        </button>
        <button
          type="button"
          disabled={readOnly}
          style={{
            padding: '6px 12px',
            fontSize: 11,
            fontWeight: 700,
            borderRadius: 8,
            border: `1px solid ${C.g200}`,
            background: 'white',
            color: readOnly ? C.g400 : C.g700,
            cursor: readOnly ? 'not-allowed' : 'pointer',
          }}
        >
          임시보관
        </button>
        <button
          type="button"
          onClick={onClose}
          style={{
            padding: '6px 12px',
            fontSize: 11,
            fontWeight: 700,
            borderRadius: 8,
            border: `1px solid ${C.g200}`,
            background: 'white',
            color: C.g600,
            cursor: 'pointer',
          }}
        >
          닫기
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: C.g800, marginBottom: 12 }}>결재기안</div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '120px 1fr',
            gap: '8px 16px',
            fontSize: 12,
            marginBottom: 16,
            maxWidth: 640,
          }}
        >
          {[
            ['문서번호', doc.id],
            ['기안일시', new Date(doc.draftedAt).toLocaleString('ko-KR')],
            ['기안부서', doc.dept],
            ['기안직급', doc.drafter.title ?? '—'],
            ['기안자', doc.drafter.name],
            ['보존연한', doc.retention],
            ['출처(스냅샷)', formatEntitySourceLine(doc)],
            ['엔티티유형', ENTITY_TYPE_LABEL[doc.entitySnapshot.entityType]],
          ].map(([k, v]) => (
            <div key={String(k)} style={{ display: 'contents' }}>
              <div style={{ color: C.g500, fontWeight: 600 }}>{k}</div>
              <div style={{ color: C.g800 }}>{v}</div>
            </div>
          ))}
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.g500, marginBottom: 4 }}>제목</div>
          <div
            style={{
              padding: '10px 12px',
              border: `1px solid ${C.g200}`,
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700,
              background: '#FAFBFC',
            }}
          >
            {doc.title}
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.g500, marginBottom: 4 }}>첨부</div>
          {doc.attachments.length === 0 ? (
            <div style={{ fontSize: 12, color: C.g400 }}>없음</div>
          ) : (
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: C.g700 }}>
              {doc.attachments.map((a) => (
                <li key={a.name}>
                  {a.name}
                  {a.size ? ` (${a.size})` : ''}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.g500, marginBottom: 4 }}>기안의견</div>
          <div style={{ padding: '10px 12px', border: `1px solid ${C.g200}`, borderRadius: 8, fontSize: 12, background: 'white' }}>
            {doc.opinion || '—'}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.g500, marginBottom: 4 }}>본문</div>
          <div
            style={{
              padding: 14,
              border: `1px solid ${C.g200}`,
              borderRadius: 8,
              fontSize: 13,
              lineHeight: 1.6,
              background: 'white',
              minHeight: 120,
            }}
            dangerouslySetInnerHTML={{ __html: doc.bodyHtml }}
          />
        </div>

        <Card style={{ marginBottom: 12 }}>
          <CTitle>결재선 요약</CTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {doc.approvalLines.map((line, i) => (
              <div key={i} style={{ fontSize: 12 }}>
                <span style={{ fontWeight: 800, color: C.navy }}>{line.role}</span>
                <span style={{ color: C.g500, marginLeft: 8 }}>
                  {line.people.map((p) => `${p.name}(${p.dept})`).join(', ')}
                </span>
              </div>
            ))}
          </div>
        </Card>

        {(doc.links?.srDpId || doc.links?.srDpCode || doc.links?.ghgAuditEventId) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {(doc.links.srDpId || doc.links.srDpCode) && (
              <Link
                href={`/sr-report?dpId=${encodeURIComponent(doc.links.srDpId ?? doc.links.srDpCode ?? '')}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  height: 30,
                  padding: '0 12px',
                  borderRadius: 8,
                  background: C.blue,
                  color: 'white',
                  fontSize: 12,
                  fontWeight: 700,
                  textDecoration: 'none',
                  border: `1px solid ${C.blue}`,
                }}
              >
                SR 원문 보기
              </Link>
            )}
            {doc.links.ghgAuditEventId && (
              <Link
                href="/ghg_calc"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  height: 30,
                  padding: '0 12px',
                  borderRadius: 8,
                  background: C.tealSoft,
                  color: C.teal,
                  fontSize: 12,
                  fontWeight: 700,
                  textDecoration: 'none',
                  border: '1px solid #6ee7d5',
                }}
              >
                GHG 산정에서 보기
              </Link>
            )}
          </div>
        )}

        {doc.links?.previousDocId && (
          <div style={{ fontSize: 11, color: C.g500, marginTop: 12 }}>
            이전 문서 참조: {doc.links.previousDocId}
          </div>
        )}
      </div>
    </div>
  );
}

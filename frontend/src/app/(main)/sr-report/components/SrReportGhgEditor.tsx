'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkspacePerspective } from '@/components/workspace/WorkspacePerspectiveContext';
import { buildDashboardApprovalHref } from '@/app/(main)/dashboard/lib/dashboardApprovalLink';
import { FieldInput } from './holding/FieldInput';
import { FIELD_SCHEMAS } from '../lib/platformData';
import type { SrDpCard, SrDpStatus, SrApprovalDoc } from '../lib/types';

const C = {
  blue: { bg: '#e8f1fb', text: '#185fa5' },
  amber: { bg: '#faeeda', text: '#854f0b' },
  gray: { bg: '#f1efe8', text: '#5f5e5a' },
  green: { bg: '#eaf3de', text: '#3b6d11' },
  red: { bg: '#fcebeb', text: '#a32d2d' },
};

const getStatusBadge = (st: SrDpStatus) => {
  if (st === 'todo') return { bg: C.gray.bg, color: C.gray.text, label: '미작성' };
  if (st === 'wip') return { bg: C.amber.bg, color: C.amber.text, label: '작성중' };
  if (st === 'submitted') return { bg: C.blue.bg, color: C.blue.text, label: '제출완료' };
  if (st === 'approved') return { bg: C.green.bg, color: C.green.text, label: '승인완료' };
  return { bg: C.red.bg, color: C.red.text, label: '반려' };
};

type GhgValues = Record<string, string>;

function safeParseJson(input: string): GhgValues {
  if (!input) return {};
  try {
    const v = JSON.parse(input);
    if (v && typeof v === 'object') return v as GhgValues;
    return {};
  } catch {
    return {};
  }
}

type Props = {
  card: SrDpCard;
  approvals: SrApprovalDoc[];
  onSaveValues: (dpId: string, values: GhgValues) => void;
  onSubmitValues: (dpId: string, values: GhgValues) => void;
  onBack: () => void;
};

export function SrReportGhgEditor({ card, approvals, onSaveValues, onSubmitValues, onBack }: Props) {
  const router = useRouter();
  const { perspective } = useWorkspacePerspective();
  const [activeScope, setActiveScope] = useState<'scope1' | 'scope2_lb' | 'scope2_mb' | 'scope3'>('scope1');
  const schema = FIELD_SCHEMAS.ghg;

  const [values, setValues] = useState<GhgValues>(() => safeParseJson(card.savedText));

  useEffect(() => {
    setValues(safeParseJson(card.savedText));
    setActiveScope('scope1');
  }, [card.id, card.savedText]);

  const isFrozen = card.status === 'approved';
  const showSubmitToApproval = card.status === 'submitted';
  const isRejected = card.status === 'rejected';
  const rejectedDoc = useMemo(() => approvals.find((a) => a.status === 'rejected') ?? null, [approvals]);
  const statusBadge = getStatusBadge(card.status);

  const showWipSubmit = card.status === 'wip';

  const quantSection = useMemo(() => schema.sections.find((s) => s.id === 'quant'), [schema.sections]);
  const methodSection = useMemo(() => schema.sections.find((s) => s.id === 'method'), [schema.sections]);
  const changeSection = useMemo(() => schema.sections.find((s) => s.id === 'change'), [schema.sections]);
  const actionSection = useMemo(() => schema.sections.find((s) => s.id === 'action'), [schema.sections]);

  const setField = (id: string, val: string) => {
    setValues((p) => ({ ...p, [id]: val }));
  };

  const activeScopeLabel = quantSection?.fields.find((f) => f.id === activeScope)?.label ?? activeScope;

  return (
    <div style={{ flex: 1, minWidth: 0, height: '100%', overflow: 'hidden', background: '#f8f8f6' }}>
      <div
        style={{
          height: 56,
          background: '#fff',
          borderBottom: '0.5px solid rgba(0,0,0,0.08)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 18px',
          gap: 14,
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={onBack}
          style={{
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 800,
            color: '#888780',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          ← 돌아가기
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: '#b4b2a9', fontWeight: 800 }}>{card.deadline} · 온실가스</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#0c447c', lineHeight: 1.2 }}>{card.title}</div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              background: statusBadge.bg,
              color: statusBadge.color,
              border: '0.5px solid rgba(0,0,0,0.08)',
              borderRadius: 999,
              padding: '4px 10px',
              fontSize: 11,
              fontWeight: 900,
              whiteSpace: 'nowrap',
            }}
          >
            {statusBadge.label}
          </span>

          {!isFrozen ? (
            <>
              <button
                type="button"
                onClick={() => onSaveValues(card.id, values)}
                style={{
                  fontSize: 12,
                  padding: '7px 14px',
                  borderRadius: 10,
                  border: '0.5px solid rgba(0,0,0,0.15)',
                  background: '#fff',
                  cursor: 'pointer',
                  fontWeight: 900,
                  color: '#2c2c2a',
                }}
              >
                {card.status === 'submitted' ? '수정' : '임시저장'}
              </button>
              {showWipSubmit && (
                <button
                  type="button"
                  onClick={() => onSubmitValues(card.id, values)}
                  style={{
                    fontSize: 12,
                    padding: '7px 14px',
                    borderRadius: 10,
                    border: 'none',
                    background: '#185fa5',
                    cursor: 'pointer',
                    fontWeight: 900,
                    color: '#fff',
                    whiteSpace: 'nowrap',
                  }}
                >
                  제출
                </button>
              )}
              {showSubmitToApproval && (
                <button
                  type="button"
                  onClick={() => {
                    router.push(
                      buildDashboardApprovalHref({
                        mode: perspective,
                        domain: 'sr',
                        menu: 'outbox.progress',
                        srDpId: card.id,
                      }),
                    );
                  }}
                  style={{
                    fontSize: 12,
                    padding: '7px 14px',
                    borderRadius: 10,
                    border: 'none',
                    background: '#0c447c',
                    cursor: 'pointer',
                    fontWeight: 900,
                    color: '#fff',
                    whiteSpace: 'nowrap',
                  }}
                >
                  결재 상신 →
                </button>
              )}
            </>
          ) : (
            <div
              style={{
                fontSize: 12,
                fontWeight: 900,
                color: '#534ab7',
                background: '#eeedfe',
                border: '0.5px solid rgba(83,74,183,0.25)',
                padding: '7px 12px',
                borderRadius: 12,
                whiteSpace: 'nowrap',
              }}
            >
              승인 완료 · 수정 불가
            </div>
          )}
        </div>
      </div>

      <div style={{ height: 'calc(100% - 56px)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {(isRejected || rejectedDoc?.rejReason) && (
          <div
            style={{
              background: C.red.bg,
              borderBottom: '0.5px solid rgba(163,45,45,0.25)',
              color: C.red.text,
              padding: '10px 18px',
              fontSize: 12,
              fontWeight: 900,
              lineHeight: 1.5,
              flexShrink: 0,
            }}
          >
            반려됨 · 수정 후 대시보드에서 재상신하세요
            {rejectedDoc?.rejReason ? (
              <span style={{ display: 'block', marginTop: 4, fontSize: 11, fontWeight: 700, color: '#791f1f' }}>
                사유: {rejectedDoc.rejReason}
              </span>
            ) : null}
          </div>
        )}

        <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '250px 1fr 300px', gap: 0 }}>
          {/* 왼쪽: Scope LNB */}
          <div style={{ background: '#fff', borderRight: '0.5px solid rgba(0,0,0,0.08)', overflowY: 'auto' }}>
            <div style={{ padding: '14px 12px' }}>
              <div style={{ fontSize: 10, fontWeight: 900, color: '#b4b2a9', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
                Scope 입력
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(
                  [
                    { id: 'scope1', label: 'Scope 1 직접배출', c: '#EF4444' },
                    { id: 'scope2_lb', label: 'Scope 2 (위치기반)', c: '#F59E0B' },
                    { id: 'scope2_mb', label: 'Scope 2 (시장기반)', c: '#A78BFA' },
                    { id: 'scope3', label: 'Scope 3 (산정 시)', c: '#4C1D95' },
                  ] as const
                ).map((s) => {
                  const active = activeScope === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setActiveScope(s.id)}
                      style={{
                        textAlign: 'left',
                        padding: '10px 12px',
                        borderRadius: 10,
                        cursor: 'pointer',
                        border: active ? `1px solid rgba(24,95,165,0.35)` : '0.5px solid rgba(0,0,0,0.10)',
                        background: active ? '#F0F7FF' : '#fff',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                        <div style={{ fontSize: 12, fontWeight: 900, color: '#2c2c2a' }}>{s.label}</div>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.c }} />
                      </div>
                    </button>
                  );
                })}
              </div>

              <div style={{ marginTop: 14, padding: 12, borderRadius: 12, background: '#f5f4f0', border: '0.5px solid rgba(0,0,0,0.06)' }}>
                <div style={{ fontSize: 10, fontWeight: 900, color: '#b4b2a9', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
                  현재 선택
                </div>
                <div style={{ fontSize: 12, fontWeight: 900, color: '#2c2c2a' }}>{activeScopeLabel}</div>
                <div style={{ fontSize: 11, color: '#888780', marginTop: 6, lineHeight: 1.5 }}>
                  {card.status === 'submitted' ? (
                    <>
                      <b>수정</b>을 누르면 <b>작성중</b>으로 바뀌며 내용을 다시 편집할 수 있습니다.
                    </>
                  ) : card.status === 'wip' ? (
                    <>
                      <b>임시저장</b>으로 저장하고 <b>제출</b>로 제출완료로 전환하세요.
                    </>
                  ) : (
                    <>
                      입력 후 <b>임시저장</b>으로 상태를 반영하세요.
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 가운데: 입력 폼 */}
          <div style={{ overflowY: 'auto', padding: 24, background: '#f8f8f6' }}>
            {/* 정량 데이터 */}
            {quantSection && (
              <div style={{ marginBottom: 18, background: '#fff', borderRadius: 12, border: '0.5px solid rgba(0,0,0,0.08)', overflow: 'hidden' }}>
                <div style={{ padding: '14px 16px', borderBottom: '0.5px solid rgba(0,0,0,0.06)' }}>
                  <div style={{ fontSize: 13, fontWeight: 900, color: '#185fa5', marginBottom: 4 }}>{quantSection.title}</div>
                  <div style={{ fontSize: 11, color: '#888780' }}>{quantSection.desc}</div>
                </div>
                <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {quantSection.fields
                    .filter((f) => ['scope1', 'scope2_lb', 'scope2_mb', 'scope3', 'intensity'].includes(f.id))
                    .map((field) => (
                      <div key={field.id} style={{ borderRadius: 10, padding: 12, background: field.id === activeScope ? '#F0F7FF' : '#f8f8f6' }}>
                        <FieldInput field={field} value={values[field.id] ?? ''} onChange={(val) => setField(field.id, val)} disabled={isFrozen} />
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* 산정 방법론 */}
            {methodSection && (
              <div style={{ marginBottom: 18, background: '#fff', borderRadius: 12, border: '0.5px solid rgba(0,0,0,0.08)', overflow: 'hidden' }}>
                <div style={{ padding: '14px 16px', borderBottom: '0.5px solid rgba(0,0,0,0.06)' }}>
                  <div style={{ fontSize: 13, fontWeight: 900, color: '#639922', marginBottom: 4 }}>{methodSection.title}</div>
                  <div style={{ fontSize: 11, color: '#888780' }}>{methodSection.desc}</div>
                </div>
                <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {methodSection.fields.map((field) => (
                    <div key={field.id}>
                      <FieldInput field={field} value={values[field.id] ?? ''} onChange={(val) => setField(field.id, val)} disabled={isFrozen} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 전년 대비 변화 사유 */}
            {changeSection && (
              <div style={{ marginBottom: 18, background: '#fff', borderRadius: 12, border: '0.5px solid rgba(0,0,0,0.08)', overflow: 'hidden' }}>
                <div style={{ padding: '14px 16px', borderBottom: '0.5px solid rgba(0,0,0,0.06)' }}>
                  <div style={{ fontSize: 13, fontWeight: 900, color: '#EF9F27', marginBottom: 4 }}>{changeSection.title}</div>
                  <div style={{ fontSize: 11, color: '#888780' }}>{changeSection.desc}</div>
                </div>
                <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {changeSection.fields.map((field) => (
                    <div key={field.id}>
                      <FieldInput field={field} value={values[field.id] ?? ''} onChange={(val) => setField(field.id, val)} disabled={isFrozen} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 감축 이행 활동 */}
            {actionSection && (
              <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid rgba(0,0,0,0.08)', overflow: 'hidden' }}>
                <div style={{ padding: '14px 16px', borderBottom: '0.5px solid rgba(0,0,0,0.06)' }}>
                  <div style={{ fontSize: 13, fontWeight: 900, color: '#3B6D11', marginBottom: 4 }}>{actionSection.title}</div>
                  <div style={{ fontSize: 11, color: '#888780' }}>{actionSection.desc}</div>
                </div>
                <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {actionSection.fields.map((field) => (
                    <div key={field.id}>
                      <FieldInput field={field} value={values[field.id] ?? ''} onChange={(val) => setField(field.id, val)} disabled={isFrozen} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 오른쪽: 문서 메타 */}
          <div style={{ background: '#fff', borderLeft: '0.5px solid rgba(0,0,0,0.1)', overflowY: 'auto', padding: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 900, color: '#b4b2a9', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
              문서 메타
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                ['문서번호', approvals[0]?.docNo ?? '—'],
                ['기안일', approvals[0]?.draftedAt.split(' ')[0] ?? '—'],
                ['기안자', approvals[0]?.drafter ?? `${card.assignee} 대리`],
                ['관련 기준', card.standards.map((s) => s.code).join(', ') || '—'],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <span style={{ width: 64, flexShrink: 0, fontSize: 11, color: '#b4b2a9', fontWeight: 900 }}>{k}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#2c2c2a', lineHeight: 1.4 }}>{v}</span>
                </div>
              ))}
            </div>

            <div style={{ height: 1, background: 'rgba(0,0,0,0.08)', margin: '14px 0' }} />

            <div style={{ fontSize: 10, fontWeight: 900, color: '#b4b2a9', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
              제출 가이드
            </div>

            <div style={{ fontSize: 12, color: '#2c2c2a', lineHeight: 1.65 }}>
              {card.status === 'submitted' ? (
                <>
                  - <b>제출완료</b> 상태에서는 상단 <b>수정</b>을 눌러 <b>작성중</b>으로 되돌린 뒤 편집합니다.
                  <br />
                  - 이후 변경 저장은 <b>임시저장</b>으로 반영합니다.
                  <br />- <b>결재 상신</b>은 대시보드/결재함에서 진행합니다.
                  <br />- 승인 완료 시에는 본 화면 입력이 비활성화됩니다.
                </>
              ) : card.status === 'wip' ? (
                <>
                  - <b>작성중</b>일 때 <b>임시저장</b>으로 내용을 저장하고, <b>제출</b>로 <b>제출완료</b> 상태로 바꿉니다.
                  <br />
                  - 제출완료 후 <b>결재 상신</b>은 상단 버튼으로 대시보드에서 진행합니다.
                  <br />- 승인 완료 시에는 본 화면 입력이 비활성화됩니다.
                </>
              ) : (
                <>
                  - <b>임시저장(작성중)</b> 후 내용을 다듬고 <b>제출</b>로 제출완료로 전환합니다.
                  <br />
                  - <b>결재 상신</b>은 제출완료 뒤 대시보드/결재함에서 진행합니다.
                  <br />- 승인 완료 시에는 본 화면 입력이 비활성화됩니다.
                </>
              )}
            </div>

            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 900, color: '#185fa5' }}>저장 값 미리보기</div>
              <div
                style={{
                  marginTop: 8,
                  fontSize: 11,
                  color: '#888780',
                  background: '#f5f4f0',
                  border: '0.5px solid rgba(0,0,0,0.06)',
                  borderRadius: 12,
                  padding: 12,
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {JSON.stringify(values, null, 2)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


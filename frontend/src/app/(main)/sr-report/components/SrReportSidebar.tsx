'use client';

import { C } from '@/app/(main)/dashboard/lib/constants';
import type { HoldingSrTabId, SrDpCard, SrDpStatus } from '../lib/types';
import type { SrReportWorkspace } from './SrReportModeSwitch';

const SIDEBAR_WIDTH = 236;
const FONT = "'Noto Sans KR','Pretendard',sans-serif";

const HOLDING_NAV: { id: HoldingSrTabId; label: string; hint: string }[] = [
  { id: 'h-aggregate-write', label: '공시데이터 작성', hint: '지주사 통합 작성' },
  { id: 'h-write', label: '페이지별 작성', hint: '목차·시각화' },
  { id: 'h-gen', label: '보고서 생성', hint: '형식별 다운로드' },
];

type Props = {
  workspace: SrReportWorkspace;
  cards: SrDpCard[];
  activeDpId: string | null;
  onSelectDpId: (dpId: string) => void;
  holdingTab: HoldingSrTabId;
  onSelectHoldingTab: (tab: HoldingSrTabId) => void;
};

const STATUS_ORDER: Record<SrDpStatus, number> = { todo: 1, wip: 2, rejected: 3, submitted: 4, approved: 5 };

function statusChip(st: SrDpStatus) {
  if (st === 'todo')
    return { label: '미작성', bg: 'rgba(255,255,255,0.08)', color: 'rgba(234,242,255,0.55)', border: 'rgba(255,255,255,0.08)' };
  if (st === 'wip')
    return { label: '작성중', bg: 'rgba(251,191,36,0.18)', color: '#FCD34D', border: 'rgba(251,191,36,0.25)' };
  if (st === 'submitted')
    return { label: '제출완료', bg: 'rgba(52,211,153,0.18)', color: '#34D399', border: 'rgba(52,211,153,0.25)' };
  if (st === 'approved')
    return { label: '승인완료', bg: 'rgba(99,102,241,0.22)', color: '#A5B4FC', border: 'rgba(99,102,241,0.28)' };
  return { label: '반려', bg: 'rgba(239,68,68,0.18)', color: '#FCA5A5', border: 'rgba(239,68,68,0.25)' };
}

function calcFrameworkProgress(cards: SrDpCard[], framework: 'GRI' | 'SASB' | 'TCFD') {
  const related = cards.filter((c) => c.standards.some((s) => s.type === framework));
  const total = related.length || 1;
  const done = related.filter((c) => c.status === 'submitted' || c.status === 'approved').length;
  const wip = related.filter((c) => c.status === 'wip' || c.status === 'rejected').length;
  const pct = Math.round(((done + 0.5 * wip) / total) * 100);
  return Math.max(0, Math.min(100, pct));
}

export function SrReportSidebar({
  workspace,
  cards,
  activeDpId,
  onSelectDpId,
  holdingTab,
  onSelectHoldingTab,
}: Props) {
  const overallTotal = Math.max(1, cards.length);
  const overallDone = cards.filter((c) => c.status === 'submitted' || c.status === 'approved').length;
  const overallWip = cards.filter((c) => c.status === 'wip' || c.status === 'rejected').length;
  const overallProgress = Math.round(((overallDone + 0.5 * overallWip) / overallTotal) * 100);

  const holdingStepDone = HOLDING_NAV.findIndex((n) => n.id === holdingTab) + 1;
  const holdingProgress = Math.round((holdingStepDone / HOLDING_NAV.length) * 100);

  return (
    <aside
      style={{
        width: SIDEBAR_WIDTH,
        background: C.navy,
        color: '#EAF2FF',
        flexShrink: 0,
        overflow: 'hidden',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: FONT,
      }}
    >
      <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: C.blue,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 600,
              fontSize: 11,
            }}
          >
            SDS
          </div>

          <div style={{ lineHeight: 1.2, flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 12 }}>Samsung SDS</div>
            <div style={{ fontSize: 10, fontWeight: 400, color: 'rgba(234,242,255,0.72)', marginTop: 2 }}>
              {workspace === 'holding' ? 'SR 지주사 작성' : 'SR 공시데이터 작성'}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr', gap: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
            <span style={{ fontSize: 10, fontWeight: 500, color: 'rgba(234,242,255,0.6)' }}>작성 주체</span>
            <span style={{ fontSize: 11, fontWeight: 500, color: 'rgba(234,242,255,0.92)' }}>
              {workspace === 'holding' ? '지주사(그룹)' : '삼성에스디에스(주)'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
            <span style={{ fontSize: 10, fontWeight: 500, color: 'rgba(234,242,255,0.6)' }}>보고 연도</span>
            <span style={{ fontSize: 11, fontWeight: 500, color: 'rgba(234,242,255,0.92)' }}>2024년도</span>
          </div>
        </div>

        <div
          style={{
            marginTop: 10,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 10,
            padding: 9,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(234,242,255,0.82)' }}>
              {workspace === 'holding' ? '작업 진행' : '전체 준수율'}
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.blue }}>
              {workspace === 'holding' ? `${holdingProgress}%` : `${overallProgress}%`}
            </div>
          </div>
          <div style={{ height: 5, background: 'rgba(255,255,255,0.08)', borderRadius: 999, overflow: 'hidden' }}>
            <div
              style={{
                width: `${workspace === 'holding' ? holdingProgress : overallProgress}%`,
                height: '100%',
                background: C.blue,
                transition: 'width 0.2s',
              }}
            />
          </div>
        </div>
      </div>

      {workspace === 'subsidiary' ? (
        <>
          <div style={{ padding: '10px 14px 8px', flexShrink: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 11, marginBottom: 8, color: 'rgba(234,242,255,0.82)' }}>
              직접 공시기준
            </div>

            {(
              [
                { label: 'GRI Standards 2021', framework: 'GRI' as const, color: '#3b6d11' },
                { label: 'ISSB / IFRS S2', framework: 'TCFD' as const, color: '#185fa5' },
                { label: 'SASB TCI-SI', framework: 'SASB' as const, color: '#EF9F27' },
                { label: 'ESRS (EU)', framework: 'GRI' as const, color: '#534ab7', fakeZero: true },
              ] as const
            ).map((row) => {
              const pct = 'fakeZero' in row && row.fakeZero ? 0 : calcFrameworkProgress(cards, row.framework);
              return (
                <div key={row.label} style={{ marginBottom: 7 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'rgba(234,242,255,0.88)' }}>{row.label}</div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: row.color }}>{pct}%</div>
                  </div>
                  <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: row.color, transition: 'width 0.2s' }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ padding: '8px 14px 12px', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(234,242,255,0.88)', marginBottom: 8, flexShrink: 0 }}>
              DP 목록
            </div>

            <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: 2 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {([...cards].sort((a, b) => STATUS_ORDER[b.status] - STATUS_ORDER[a.status])).map((c) => {
                  const isActive = c.id === activeDpId;
                  const standardsPreview = c.standards.slice(0, 2).map((s) => s.code).join(' · ');
                  const chip = statusChip(c.status);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => onSelectDpId(c.id)}
                      style={{
                        textAlign: 'left',
                        borderRadius: 8,
                        border: isActive ? `2px solid ${C.blue}` : '1px solid rgba(255,255,255,0.08)',
                        background: isActive ? 'rgba(19,81,216,0.14)' : 'rgba(255,255,255,0.04)',
                        padding: '7px 8px',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                        <div
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: 999,
                            background: isActive ? C.blue : 'rgba(255,255,255,0.22)',
                            flexShrink: 0,
                          }}
                        />
                        <div style={{ flex: 1 }} />
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 600,
                            padding: '1px 5px',
                            borderRadius: 999,
                            background: chip.bg,
                            color: chip.color,
                            border: `1px solid ${chip.border}`,
                            lineHeight: 1.5,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {chip.label}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(234,242,255,0.94)', lineHeight: 1.25, marginBottom: 3 }}>
                        {c.title.length > 18 ? `${c.title.slice(0, 18)}…` : c.title}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          fontWeight: 400,
                          color: 'rgba(234,242,255,0.58)',
                          lineHeight: 1.25,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {standardsPreview || '—'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div style={{ padding: '10px 14px 12px', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(234,242,255,0.88)', marginBottom: 8, flexShrink: 0 }}>
            작업 메뉴
          </div>
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: 2 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {HOLDING_NAV.map((row) => {
                const isActive = holdingTab === row.id;
                return (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => onSelectHoldingTab(row.id)}
                    style={{
                      textAlign: 'left',
                      borderRadius: 8,
                      border: isActive ? `2px solid ${C.blue}` : '1px solid rgba(255,255,255,0.08)',
                      background: isActive ? 'rgba(19,81,216,0.14)' : 'rgba(255,255,255,0.04)',
                      padding: '7px 8px',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <div
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 999,
                          background: isActive ? C.blue : 'rgba(255,255,255,0.22)',
                          flexShrink: 0,
                        }}
                      />
                      <div style={{ flex: 1 }} />
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(234,242,255,0.94)', lineHeight: 1.25, marginBottom: 3 }}>
                      {row.label}
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 400, color: 'rgba(234,242,255,0.58)', lineHeight: 1.25 }}>{row.hint}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

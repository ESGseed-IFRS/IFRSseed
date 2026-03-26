'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { C } from '@/app/(main)/dashboard/lib/constants';
import type { DashboardMainTab } from '@/app/(main)/dashboard/lib/dashboardNewNav';
import { Pbar } from '@/app/(main)/dashboard/components/shared';
import type { ApprovalMenuKey } from '@/app/(main)/dashboard/lib/dashboardNewMock';
import {
  DOMESTIC_SUBSIDIARIES,
  DOMESTIC_SITES,
  OVERSEAS_REGIONS,
} from '@/app/(main)/dashboard/lib/holdingData';
import { SR_ITEMS } from '@/app/(main)/dashboard/lib/mockData';
import { APPROVAL_COUNTS_HOLDING, APPROVAL_COUNTS_SUBSIDIARY } from '@/app/(main)/dashboard/lib/dashboardNewMock';

const SUBSIDIARY_NAV: {
  id: string;
  label: string;
  color: string;
  items: { id: DashboardMainTab; label: string; badge?: number; approvalMenuPreset?: ApprovalMenuKey }[];
}[] = [
  {
    id: 'OVERVIEW_PART',
    label: '대시보드',
    color: C.blue,
    items: [{ id: 'overview', label: '전체' }],
  },
  {
    id: 'SR_PART',
    label: 'SR 보고서',
    color: C.blue,
    items: [{ id: 'sr', label: 'SR 보고서 작성' }],
  },
  {
    id: 'GHG_PART',
    label: 'GHG 산정',
    color: C.teal,
    items: [{ id: 'ghg', label: 'GHG 산정' }],
  },
  {
    id: 'APPROVAL_PART',
    label: '결재함',
    color: C.navy,
    items: [],
  },
];

function ApprovalSidebarSubMenu({
  mode,
  activeTab,
  activeApprovalMenu,
  onSelectTab,
  onSelectApprovalMenu,
}: {
  mode: 'subsidiary' | 'holding';
  activeTab: DashboardMainTab;
  activeApprovalMenu?: ApprovalMenuKey;
  onSelectTab: (tab: DashboardMainTab) => void;
  onSelectApprovalMenu?: (menu: ApprovalMenuKey) => void;
}) {
  const countsBase = mode === 'holding' ? APPROVAL_COUNTS_HOLDING : APPROVAL_COUNTS_SUBSIDIARY;
  const getSum = (k: ApprovalMenuKey) => (countsBase[k]?.ghg ?? 0) + (countsBase[k]?.sr ?? 0);

  const select = (k: ApprovalMenuKey) => {
    onSelectTab('approval');
    onSelectApprovalMenu?.(k);
  };

  const INBOX: { key: ApprovalMenuKey; label: string }[] = [
    { key: 'inbox.request', label: '결재요청' },
    { key: 'inbox.history', label: '결재내역' },
    { key: 'inbox.cc', label: '수신참조' },
  ];

  const OUTBOX: { key: ApprovalMenuKey; label: string }[] = [
    { key: 'outbox.progress', label: '결재 진행함' },
    { key: 'outbox.completed', label: '결재 완료함' },
    { key: 'outbox.rejected', label: '반려함' },
    { key: 'outbox.draft', label: '임시저장' },
  ];

  const isApprovalActive = activeTab === 'approval';

  const Header = ({ children }: { children: ReactNode }) => (
    <div
      style={{
        padding: '8px 16px 4px 28px',
        fontSize: 10,
        fontWeight: 800,
        color: 'rgba(255,255,255,.7)',
        letterSpacing: '0.02em',
      }}
    >
      {children}
    </div>
  );

  const MenuBtn = ({ k, label }: { k: ApprovalMenuKey; label: string }) => {
    const isActive = isApprovalActive && activeApprovalMenu === k;
    const cnt = getSum(k);
    return (
      <button
        type="button"
        onClick={() => select(k)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 16px 6px 44px',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          background: isActive ? 'rgba(255,255,255,.09)' : 'transparent',
          borderLeft: isActive ? `2px solid ${C.navy}` : '2px solid transparent',
        }}
      >
        <div
          style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: isActive ? C.navy : 'rgba(255,255,255,.2)',
            flexShrink: 0,
          }}
        />
        <span
          style={{
            flex: 1,
            fontSize: 12,
            color: isActive ? 'white' : 'rgba(255,255,255,.55)',
            fontWeight: isActive ? 600 : 400,
          }}
        >
          {label}
        </span>
        {cnt > 0 && (
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              padding: '1px 5px',
              borderRadius: 8,
              background: C.amber,
              color: 'white',
              flexShrink: 0,
            }}
          >
            {cnt}
          </span>
        )}
      </button>
    );
  };

  return (
    <div style={{ paddingBottom: 4 }}>
      <Header>결재 수신함</Header>
      {INBOX.map((i) => (
        <MenuBtn key={i.key} k={i.key} label={i.label} />
      ))}

      <div style={{ height: 1, background: 'rgba(255,255,255,.06)', margin: '6px 16px 6px 16px' }} />

      <Header>결재 상신함</Header>
      {OUTBOX.map((i) => (
        <MenuBtn key={i.key} k={i.key} label={i.label} />
      ))}
    </div>
  );
}

interface DashboardNewSidebarProps {
  mode: 'subsidiary' | 'holding';
  activeTab: DashboardMainTab;
  onSelectTab: (tab: DashboardMainTab) => void;
  /** 결재함 네비 배지 (미결 처리 가능 건수 등) */
  approvalBadge?: number;
  activeApprovalMenu?: ApprovalMenuKey;
  onSelectApprovalMenu?: (menu: ApprovalMenuKey) => void;
}

export function DashboardNewSidebar({
  mode,
  activeTab,
  onSelectTab,
  approvalBadge: _approvalBadge = 0,
  activeApprovalMenu,
  onSelectApprovalMenu,
}: DashboardNewSidebarProps) {
  const [open, setOpen] = useState<Record<string, boolean>>({
    OVERVIEW_PART: true,
    SR_PART: true,
    GHG_PART: true,
    APPROVAL_PART: true,
  });

  const srPctSub =
    SR_ITEMS.length > 0
      ? Math.round((SR_ITEMS.filter((i) => i.status === 'done').length / SR_ITEMS.length) * 100)
      : 0;
  const urgentCnt = SR_ITEMS.filter((i) => i.dl === '03-20' && i.status !== 'done').length;

  const srPctHold =
    DOMESTIC_SUBSIDIARIES.length > 0
      ? Math.round(
          DOMESTIC_SUBSIDIARIES.reduce((a, s) => a + s.srPct, 0) / DOMESTIC_SUBSIDIARIES.length
        )
      : 0;

  return (
    <aside
      style={{
        width: 236,
        background: C.navy,
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: '15px 16px 12px', borderBottom: '1px solid rgba(255,255,255,.08)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div
            style={{
              width: 32,
              height: 32,
              background: C.blue,
              borderRadius: 7,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 10,
              fontWeight: 700,
              color: 'white',
              flexShrink: 0,
            }}
          >
            SDS
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'white' }}>Samsung SDS</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,.4)' }}>
              대시보드(신규){mode === 'holding' ? ' · 지주' : ' · 계열사'}
            </div>
          </div>
        </div>
      </div>

      {mode === 'subsidiary' ? (
        <div style={{ padding: '10px 16px 13px', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
          <div
            style={{
              fontSize: 10,
              color: 'rgba(255,255,255,.35)',
              textTransform: 'uppercase',
              letterSpacing: '.08em',
              marginBottom: 3,
            }}
          >
            작성 주체
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,.88)', marginBottom: 1 }}>
            삼성에스디에스㈜
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,.4)', marginBottom: 10 }}>보고 연도: 2024년도</div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,.4)' }}>SR 항목 완료율</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.teal }}>{srPctSub}%</span>
          </div>
          <Pbar pct={srPctSub} color={C.teal} h={3} />

        </div>
      ) : (
        <div style={{ padding: '10px 16px 12px', borderBottom: '1px solid rgba(255,255,255,.06)' }}>
          <div
            style={{
              fontSize: 10,
              color: 'rgba(255,255,255,.35)',
              textTransform: 'uppercase',
              letterSpacing: '.08em',
              marginBottom: 3,
            }}
          >
            관리 범위
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,.85)', marginBottom: 2 }}>
            삼성에스디에스㈜
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,.4)', lineHeight: 1.5 }}>
            국내 자회사 {DOMESTIC_SUBSIDIARIES.length}개 · 국내 사업장 {DOMESTIC_SITES.length}개
            <br />
            해외 거점 {OVERSEAS_REGIONS.length}개 지역 · 2024년도
          </div>
          <div style={{ marginTop: 9 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,.4)' }}>SR 전사 준수율(평균)</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: C.teal }}>{srPctHold}%</span>
            </div>
            <div style={{ height: 3, background: 'rgba(255,255,255,.1)', borderRadius: 2 }}>
              <div style={{ height: 3, width: `${srPctHold}%`, background: C.teal, borderRadius: 2 }} />
            </div>
          </div>
        </div>
      )}

      <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {SUBSIDIARY_NAV.map((section) => {
          const isOpen = open[section.id] ?? true;
          return (
            <div key={section.id}>
              <button
                type="button"
                onClick={() => setOpen((p) => ({ ...p, [section.id]: !p[section.id] }))}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '9px 16px',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <div
                  style={{
                    width: 3,
                    height: 14,
                    borderRadius: 2,
                    background: section.color,
                    flexShrink: 0,
                  }}
                />
                <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,.85)' }}>
                  {section.label}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    color: 'rgba(255,255,255,.3)',
                    transform: isOpen ? 'rotate(90deg)' : 'none',
                    transition: 'transform .2s',
                    display: 'inline-block',
                  }}
                >
                  ▶
                </span>
              </button>

              {isOpen && (
                <div style={{ marginBottom: 4 }}>
                  {section.id === 'APPROVAL_PART' ? (
                    <ApprovalSidebarSubMenu
                      mode={mode}
                      activeTab={activeTab}
                      activeApprovalMenu={activeApprovalMenu}
                      onSelectTab={onSelectTab}
                      onSelectApprovalMenu={onSelectApprovalMenu}
                    />
                  ) : (
                    section.items.map((item) => {
                      const isActive = activeTab === item.id;
                      const itemBadge = item.id === 'sr' && mode === 'subsidiary' && urgentCnt > 0 ? urgentCnt : undefined;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => onSelectTab(item.id)}
                          style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '7px 16px 7px 28px',
                            border: 'none',
                            cursor: 'pointer',
                            textAlign: 'left',
                            background: isActive ? 'rgba(255,255,255,.09)' : 'transparent',
                            borderLeft: isActive ? `2px solid ${section.color}` : '2px solid transparent',
                          }}
                        >
                          <div
                            style={{
                              width: 5,
                              height: 5,
                              borderRadius: '50%',
                              background: isActive ? section.color : 'rgba(255,255,255,.2)',
                              flexShrink: 0,
                            }}
                          />
                          <span
                            style={{
                              flex: 1,
                              fontSize: 12,
                              color: isActive ? 'white' : 'rgba(255,255,255,.55)',
                              fontWeight: isActive ? 500 : 400,
                            }}
                          >
                            {item.label}
                          </span>
                          {itemBadge != null && (
                            <span
                              style={{
                                fontSize: 9,
                                fontWeight: 700,
                                padding: '1px 5px',
                                borderRadius: 8,
                                background: C.amber,
                                color: 'white',
                              }}
                            >
                              {itemBadge}
                            </span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}

        {mode === 'subsidiary' ? (
          <div style={{ margin: '10px 16px 0', paddingTop: 10, borderTop: '1px solid rgba(255,255,255,.06)' }}>
            <div
              style={{
                fontSize: 9,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '.08em',
                color: 'rgba(255,255,255,.25)',
                marginBottom: 7,
              }}
            >
              적용 공시기준
            </div>
            {[
              { std: 'GRI Standards 2021', pct: 72, color: C.green },
              { std: 'ISSB / IFRS S2', pct: 58, color: C.blue },
              { std: 'SASB TC-SI', pct: 64, color: '#f9a8d4' },
              { std: 'ESRS (EU)', pct: 41, color: C.amber },
            ].map((s, i) => (
              <div key={i} style={{ marginBottom: 7 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,.5)' }}>{s.std}</span>
                  <span style={{ fontSize: 10, color: s.color, fontWeight: 600 }}>{s.pct}%</span>
                </div>
                <Pbar pct={s.pct} color={s.color} h={3} />
              </div>
            ))}
          </div>
        ) : (
          <div
            style={{
              margin: '8px 16px 0',
              paddingTop: 10,
              borderTop: '1px solid rgba(255,255,255,.06)',
            }}
          >
            <div
              style={{
                fontSize: 9,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '.08em',
                color: 'rgba(255,255,255,.25)',
                marginBottom: 6,
              }}
            >
              관리 대상
            </div>
            {[
              { label: `국내 자회사 ${DOMESTIC_SUBSIDIARIES.length}개`, sub: '미라콤·시큐아이·에스코어 등' },
              { label: `국내 사업장 ${DOMESTIC_SITES.length}개`, sub: '판교·상암·춘천 등' },
              { label: `해외 거점 ${OVERSEAS_REGIONS.length}개 지역`, sub: '유럽·북미·동남아 등' },
            ].map((o, i) => (
              <div
                key={i}
                style={{
                  padding: '5px 0',
                  borderBottom: i < 2 ? '1px solid rgba(255,255,255,.04)' : 'none',
                }}
              >
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,.55)', fontWeight: 500 }}>{o.label}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,.3)' }}>{o.sub}</div>
              </div>
            ))}
          </div>
        )}
      </nav>

      <div
        style={{
          margin: '6px 10px 10px',
          padding: '9px 12px',
          background: 'rgba(255,255,255,.04)',
          border: '1px solid rgba(255,255,255,.07)',
          borderRadius: 8,
        }}
      >
        <div
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: 'rgba(255,255,255,.3)',
            textTransform: 'uppercase',
            letterSpacing: '.07em',
            marginBottom: 6,
          }}
        >
          제출 일정
        </div>
        {[
          { l: '1차 (환경·IT)', d: '03-20', urgent: true },
          { l: '2차 (사회)', d: '03-28', urgent: false },
          { l: '최종 (지배구조)', d: '04-05', urgent: false },
        ].map((dl, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,.38)' }}>{dl.l}</span>
            <span
              style={{
                fontSize: 10,
                color: dl.urgent ? C.amber : 'rgba(255,255,255,.28)',
              }}
            >
              {dl.d}
            </span>
          </div>
        ))}
      </div>
    </aside>
  );
}

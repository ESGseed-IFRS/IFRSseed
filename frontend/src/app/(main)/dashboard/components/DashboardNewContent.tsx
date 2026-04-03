'use client';

import Link from 'next/link';
import type { Dispatch, SetStateAction } from 'react';
import { useEffect, useMemo } from 'react';
import { C, CAT_CFG } from '@/app/(main)/dashboard/lib/constants';
import { type ApprovalMenuKey, type ApprovalDomain, getSubsidiaryOverviewGhg } from '@/app/(main)/dashboard/lib/dashboardNewMock';
import {
  countUnifiedDocsByMenu,
  countUnifiedDocsByMenuDomain,
  type ApprovalDocUnified,
} from '@/app/(main)/dashboard/lib/approvalUnified';
import { GHG_STATUS } from '@/app/(main)/dashboard/lib/mockData';
import {
  WORKFLOW_STATUS_LABEL,
  WORKFLOW_STATUS_STYLE,
  type WorkflowStatus,
} from '@/app/(main)/dashboard/lib/workflowStatus';
import {
  AlertBanner,
  Card,
  CTitle,
  Pbar,
} from '@/app/(main)/dashboard/components/shared';
import type { DashboardMainTab } from '@/app/(main)/dashboard/lib/dashboardNewNav';
import { SR_ITEMS, FEEDBACKS } from '@/app/(main)/dashboard/lib/mockData';
import { DashboardApprovalInbox } from '@/app/(main)/dashboard/components/approvalIndex';
import { DashboardGhgTab } from '@/app/(main)/dashboard/components/ghg';
import { DashboardSrTab } from '@/app/(main)/dashboard/components/sr';
import { HoldingOverviewPanel } from '@/app/(main)/dashboard/components/holding/HoldingOverviewPanel';

export type DashboardPerspective = 'subsidiary' | 'holding';

function WorkflowBadge({ status }: { status: WorkflowStatus }) {
  const st = WORKFLOW_STATUS_STYLE[status];
  return (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        padding: '2px 8px',
        borderRadius: 12,
        background: st.bg,
        color: st.color,
        whiteSpace: 'nowrap',
      }}
    >
      {WORKFLOW_STATUS_LABEL[status]}
    </span>
  );
}

function StatTile({
  label,
  value,
  sub,
  accent,
  onClick,
}: {
  label: string;
  value: string;
  sub?: string;
  accent: string;
  onClick?: () => void;
}) {
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') onClick();
            }
          : undefined
      }
      style={{
        background: 'white',
        borderRadius: 10,
        padding: '13px 15px',
        borderTop: `3px solid ${accent}`,
        boxShadow: '0 1px 3px rgba(0,0,0,.06)',
        cursor: onClick ? 'pointer' : 'default',
        outline: 'none',
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: C.g400,
          fontWeight: 700,
          letterSpacing: '.06em',
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 21, fontWeight: 800, color: accent, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: C.g500, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

export function DashboardNewContent({
  mode,
  tab,
  onSelectTab,
  approvalDomain,
  setApprovalDomain,
  approvalMenu,
  setApprovalMenu,
  approvalFocusDocId,
  approvalFocusSrDpId,
  approvalDocs,
  setApprovalDocs,
  selectedDpId,
  setSelectedDpId,
  selectedFeedbackId,
  setSelectedFeedbackId,
  selectedAnomalyId,
  setSelectedAnomalyId,
}: {
  mode: DashboardPerspective;
  tab: DashboardMainTab;
  onSelectTab: (t: DashboardMainTab) => void;
  approvalDomain: ApprovalDomain | 'all';
  setApprovalDomain: Dispatch<SetStateAction<ApprovalDomain | 'all'>>;
  approvalMenu: ApprovalMenuKey;
  setApprovalMenu: Dispatch<SetStateAction<ApprovalMenuKey>>;
  approvalFocusDocId?: string | null;
  approvalFocusSrDpId?: string | null;
  approvalDocs: ApprovalDocUnified[];
  setApprovalDocs: Dispatch<SetStateAction<ApprovalDocUnified[]>>;
  selectedDpId: string | null;
  setSelectedDpId: Dispatch<SetStateAction<string | null>>;
  selectedFeedbackId: string | null;
  setSelectedFeedbackId: Dispatch<SetStateAction<string | null>>;
  selectedAnomalyId: string | null;
  setSelectedAnomalyId: Dispatch<SetStateAction<string | null>>;
}) {
  const apprDomain = approvalDomain;
  const setApprDomain = setApprovalDomain;
  const apprMenu = approvalMenu;
  const setApprMenu = setApprovalMenu;

  // GHG 탭: Overview에서 넘어온 이상치 선택을 자동으로 포커스
  useEffect(() => {
    if (tab !== 'ghg') return;
    if (!selectedAnomalyId) return;

    const el = document.getElementById(`ghg-anomaly-${selectedAnomalyId}`);
    if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [tab, selectedAnomalyId]);

  const approvalMenuTotals = useMemo(() => countUnifiedDocsByMenu(approvalDocs), [approvalDocs]);
  const approvalDomainByMenu = useMemo(() => countUnifiedDocsByMenuDomain(approvalDocs), [approvalDocs]);

  const ghgSub = useMemo(() => getSubsidiaryOverviewGhg(), []);
  const srDerived = useMemo(() => {
    const total = SR_ITEMS.length;
    const done = SR_ITEMS.filter((i) => i.status === 'done').length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    const required = SR_ITEMS.filter((i) => i.req);
    const requiredDone = required.filter((i) => i.status === 'done').length;
    const openFeedbackCnt = FEEDBACKS.filter((f) => f.status === 'open').length;

    const severityScore: Record<string, number> = { error: 2, warn: 1, none: 0, done: -1 };
    const attentionRows = SR_ITEMS.filter((i) => i.status !== 'done')
      .slice()
      .sort((a, b) => {
        const sa = severityScore[a.status] ?? 0;
        const sb = severityScore[b.status] ?? 0;
        if (sb !== sa) return sb - sa;
        // 마감일이 빠른 것이 위로
        return String(a.dl).localeCompare(String(b.dl));
      })
      .slice(0, 5);

    return { total, done, pct, required, requiredDone, openFeedbackCnt, attentionRows };
  }, []);

  const srStatusToWorkflow = (s: string): WorkflowStatus => {
    if (s === 'done') return 'approved';
    if (s === 'warn') return 'submitted';
    if (s === 'error') return 'drafting';
    return 'not_started';
  };

  const anomalyStatusToLabel = (s: string) => {
    // 화면 용어 통일: mock 데이터의 이상치 상태는 영문이 들어올 수 있습니다.
    if (s === 'unresolved') return '미조치';
    if (s === 'corrected') return '수정됨';
    if (s === 'resolved') return '해결됨';
    return s;
  };

  // open 피드백(지주 반려/수정 요청)에 해당하는 DP는 화면 용어상 '반려'로 표시합니다.
  const openFeedbackLabels = new Set(FEEDBACKS.filter((f) => f.status === 'open').map((f) => f.item));
  const getEffectiveSrWorkflow = (item: { status: string; label: string }): WorkflowStatus => {
    if (openFeedbackLabels.has(item.label)) return 'rejected';
    return srStatusToWorkflow(item.status);
  };

  const renderOverview = () => {
    if (mode === 'subsidiary') {
      const dpCounts = {
        not_started: 0,
        drafting: 0,
        submitted: 0,
        approved: 0,
        rejected: 0,
      } as Record<WorkflowStatus, number>;

      SR_ITEMS.forEach((i) => {
        dpCounts[getEffectiveSrWorkflow(i)] += 1;
      });

      // 주의 DP: open 피드백(반려/수정 요청) 기준으로 표시
      const _attentionDpCnt = srDerived.openFeedbackCnt;

      const srInboxNeed = approvalDomainByMenu['inbox.request'].sr;
      const srCcNeed = approvalDomainByMenu['inbox.cc'].sr;

      const inboxRequestTotal = approvalMenuTotals['inbox.request'];
      const inboxHistoryTotal = approvalMenuTotals['inbox.history'];
      const inboxCcTotal = approvalMenuTotals['inbox.cc'];

      const _topAttention = srDerived.attentionRows.slice(0, 3);

      const anomalySorted = [...GHG_STATUS.anomaly.items].sort((a, b) => {
        const pr: Record<string, number> = { unresolved: 0, corrected: 1, resolved: 2 };
        return (pr[a.status] ?? 9) - (pr[b.status] ?? 9);
      });
      const topAnomalies = anomalySorted.slice(0, 3);

      const unresolvedAnomaly = [...GHG_STATUS.anomaly.items].find((a) => a.status === 'unresolved') ?? null;

      const recentSrItems = SR_ITEMS.filter((i) => getEffectiveSrWorkflow(i) !== 'not_started')
        .slice()
        .sort((a, b) => {
          // 스크린샷 톤: 승인완료 → 반려/작성중 → 제출완료 순
          const pr: Record<WorkflowStatus, number> = {
            approved: 1,
            rejected: 2,
            drafting: 2,
            submitted: 3,
            not_started: 9,
          };
          const sa = getEffectiveSrWorkflow(a);
          const sb = getEffectiveSrWorkflow(b);
          if (pr[sa] !== pr[sb]) return pr[sa] - pr[sb];
          return String(a.dl).localeCompare(String(b.dl));
        })
        .slice(0, 3);

      const recentActivities = [
        ...recentSrItems.map((i) => {
          const st = getEffectiveSrWorkflow(i);
          const dot =
            st === 'approved'
              ? { bg: C.greenSoft, fg: C.green }
              : st === 'submitted'
                ? { bg: C.blueSoft, fg: C.blue }
                : st === 'drafting'
                  ? { bg: C.amberSoft, fg: C.amber }
                  : { bg: C.redSoft, fg: C.red };

          const title =
            st === 'approved'
              ? `${i.label} 승인완료`
              : st === 'submitted'
                ? `${i.label} 제출완료`
                : st === 'drafting'
                  ? `${i.label} 작성중`
                  : `${i.label} 반려 — 재작성/재제출`;

          return {
            key: i.id,
            cat: i.cat,
            dot,
            title,
            sub: `마감 ${i.dl}`,
            onClick: () => onSelectTab('sr'),
          };
        }),
        ...(unresolvedAnomaly
          ? [
              {
                key: unresolvedAnomaly.id,
                cat: 'E',
                dot: { bg: C.redSoft, fg: C.red },
                title: `${unresolvedAnomaly.scope} 이상치 감지`,
                sub: unresolvedAnomaly.label,
                onClick: () => onSelectTab('ghg'),
              },
            ]
          : []),
      ].slice(0, 4);

      const urgentDl = SR_ITEMS.filter((i) => getEffectiveSrWorkflow(i) !== 'approved')
        .slice()
        .sort((a, b) => String(a.dl).localeCompare(String(b.dl)))[0]?.dl;

      const urgentItems = urgentDl
        ? SR_ITEMS.filter((i) => i.dl === urgentDl && getEffectiveSrWorkflow(i) !== 'approved').slice(0, 4)
        : [];

      const dDayNum = (dl?: string) => {
        if (!dl) return 99;
        const year = new Date().getFullYear();
        const target = new Date(`${year}-${dl}`);
        if (Number.isNaN(target.getTime())) return 99;
        const today = new Date();
        const d = Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return d;
      };
      const dDayText = (dl?: string) => {
        const n = dDayNum(dl);
        if (!dl || n === 99) return '마감 없음';
        if (n <= 0) return 'D-day';
        return `D-${n}`;
      };

      const _urgentWindowItems = SR_ITEMS.filter((i) => getEffectiveSrWorkflow(i) !== 'approved' && dDayNum(i.dl) <= 3)
        .slice()
        .sort((a, b) => String(a.dl).localeCompare(String(b.dl)) || a.label.localeCompare(b.label))
        .slice(0, 8);

      const openFeedbacks = FEEDBACKS.filter((f) => f.status === 'open');
      const totalSrDp = SR_ITEMS.length || 1;
      const donutOrder: WorkflowStatus[] = ['approved', 'submitted', 'drafting', 'rejected', 'not_started'];
      let accDonut = 0;
      const donutStops: string[] = [];
      for (const s of donutOrder) {
        const v = dpCounts[s];
        if (!v) continue;
        const pct = (v / totalSrDp) * 100;
        const col = WORKFLOW_STATUS_STYLE[s].color;
        const start = accDonut;
        accDonut += pct;
        donutStops.push(`${col} ${start}% ${accDonut}%`);
      }
      const donutBg = donutStops.length ? `conic-gradient(${donutStops.join(', ')})` : C.g200;

      const categoryKeys = ['E', 'S', 'G', 'IT'] as const;
      const categoryStats = categoryKeys.map((ck) => {
        const items = SR_ITEMS.filter((i) => i.cat === ck);
        const done = items.filter((i) => getEffectiveSrWorkflow(i) === 'approved').length;
        const tot = items.length;
        const pct = tot ? Math.round((done / tot) * 100) : 0;
        return { ck, done, tot, pct };
      });

      const outboxRejectedTotal = approvalMenuTotals['outbox.rejected'];

      const scopeCards = (
        [
          { label: 'Scope 1', done: GHG_STATUS.scope1.done, val: GHG_STATUS.scope1.val, warn: GHG_STATUS.scope1.warn, warnMsg: GHG_STATUS.scope1.warnMsg },
          { label: 'Scope 2', done: GHG_STATUS.scope2.done, val: GHG_STATUS.scope2.val, warn: GHG_STATUS.scope2.warn, warnMsg: GHG_STATUS.scope2.warnMsg },
          { label: 'Scope 3', done: GHG_STATUS.scope3.done, val: GHG_STATUS.scope3.val, warn: GHG_STATUS.scope3.warn, warnMsg: GHG_STATUS.scope3.warnMsg },
        ] as const
      ).map((s) => ({
        ...s,
        sub: s.done ? (s.warn && s.warnMsg ? s.warnMsg : s.val ?? '산정 완료') : '미산정 또는 진행 필요',
      }));

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* [A] 상단 요약: 액션 중심 KPI 4개 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
            <StatTile
              label="마감 임박"
              value={dDayText(urgentDl)}
              sub={urgentDl ? `${urgentDl} · ${urgentItems.length}개 항목` : '마감 임박 항목 없음'}
              accent={dDayNum(urgentDl) <= 3 ? C.red : dDayNum(urgentDl) <= 7 ? C.amber : C.teal}
              onClick={() => onSelectTab('sr')}
            />
            <StatTile
              label="지주사 피드백(오픈)"
              value={`${openFeedbacks.length}건`}
              sub={openFeedbacks.length > 0 ? '수정/근거 보완 요청 확인' : '미처리 없음'}
              accent={openFeedbacks.length > 0 ? C.red : C.green}
              onClick={() => {
                const fb = openFeedbacks[0];
                if (fb) {
                  setSelectedFeedbackId(fb.id);
                  const sid = SR_ITEMS.find((i) => i.label === fb.item)?.id ?? null;
                  if (sid) setSelectedDpId(sid);
                }
                onSelectTab('sr');
              }}
            />
            <StatTile
              label="결재 대기"
              value={`${inboxRequestTotal}건`}
              sub="본인 승인요청 기준"
              accent={inboxRequestTotal > 0 ? C.blue : C.g600}
              onClick={() => {
                setApprDomain('all');
                setApprMenu('inbox.request');
                onSelectTab('approval');
              }}
            />
            <StatTile
              label="GHG 이상치(미조치)"
              value={`${ghgSub.anomalyOpen}건`}
              sub="데이터 검증/조치 필요"
              accent={ghgSub.anomalyOpen > 0 ? C.amber : C.green}
              onClick={() => {
                const first = GHG_STATUS.anomaly.items.find((x) => x.status === 'unresolved');
                if (first) setSelectedAnomalyId(first.id);
                onSelectTab('ghg');
              }}
            />
          </div>

          {/* [C] SR 진행 현황 (3컬럼) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
            <Card>
              <CTitle
                action={
                  <button
                    type="button"
                    onClick={() => onSelectTab('sr')}
                    style={{ border: 'none', background: 'transparent', color: C.blue, fontWeight: 800, cursor: 'pointer', fontSize: 12 }}
                  >
                    SR 작성 →
                  </button>
                }
              >
                DP 전체 분포
              </CTitle>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
                <div
                  style={{
                    width: 120,
                    height: 120,
                    borderRadius: '50%',
                    background: donutBg,
                    position: 'relative',
                    flexShrink: 0,
                    boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.06)',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      inset: 28,
                      borderRadius: '50%',
                      background: 'white',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                    }}
                  >
                    <div style={{ fontSize: 20, fontWeight: 900, color: C.g800, lineHeight: 1 }}>
                      {dpCounts.approved}/{SR_ITEMS.length}
                    </div>
                    <div style={{ fontSize: 10, color: C.g500, fontWeight: 700, marginTop: 2 }}>승인 / 전체</div>
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 140, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontSize: 11, color: C.g500, marginBottom: 2 }}>
                    필수 DP 승인 {srDerived.requiredDone}/{srDerived.required.length}
                  </div>
                  {donutOrder.map((s) => {
                    const cnt = dpCounts[s];
                    if (!cnt) return null;
                    const st = WORKFLOW_STATUS_STYLE[s];
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => onSelectTab('sr')}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 8,
                          border: `1px solid ${C.g200}`,
                          borderRadius: 8,
                          padding: '6px 10px',
                          background: 'white',
                          cursor: 'pointer',
                        }}
                      >
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ width: 8, height: 8, borderRadius: 2, background: st.color }} />
                          <span style={{ fontSize: 11, fontWeight: 700, color: C.g700 }}>{WORKFLOW_STATUS_LABEL[s]}</span>
                        </span>
                        <span style={{ fontSize: 12, fontWeight: 900, color: st.color }}>{cnt}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </Card>

            <Card>
              <CTitle>카테고리별 승인 진행</CTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
                {categoryStats.map(({ ck, done, tot, pct }) => (
                  <button
                    key={ck}
                    type="button"
                    onClick={() => onSelectTab('sr')}
                    style={{
                      border: `1px solid ${C.g200}`,
                      borderRadius: 10,
                      padding: '10px 12px',
                      background: 'white',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 800, color: C.g800 }}>{ck} 영역</span>
                      <span style={{ fontSize: 11, fontWeight: 800, color: C.g500 }}>
                        {done}/{tot} ({pct}%)
                      </span>
                    </div>
                    <Pbar pct={pct} color={CAT_CFG[ck]?.color ?? C.blue} />
                  </button>
                ))}
              </div>
            </Card>

            <Card>
              <CTitle sub="미결·반려 중심">결재 수신함</CTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginTop: 8 }}>
                {(
                  [
                    {
                      label: '결재요청',
                      cnt: inboxRequestTotal,
                      menu: 'inbox.request' as const,
                      accent: C.blue,
                      sub: '본인 승인 필요',
                      strong: true,
                    },
                    {
                      label: '반려함(내 상신)',
                      cnt: outboxRejectedTotal,
                      menu: 'outbox.rejected' as const,
                      accent: C.red,
                      sub: '재작성·재상신',
                      strong: true,
                    },
                    {
                      label: '결재내역',
                      cnt: inboxHistoryTotal,
                      menu: 'inbox.history' as const,
                      accent: C.g600,
                      sub: '처리 이력',
                      strong: false,
                    },
                    {
                      label: '수신참조',
                      cnt: inboxCcTotal,
                      menu: 'inbox.cc' as const,
                      accent: C.teal,
                      sub: '열람·참고',
                      strong: false,
                    },
                  ] as const
                ).map((x, idx) => (
                  <button
                    key={x.menu}
                    type="button"
                    onClick={() => {
                      setApprDomain('all');
                      setApprMenu(x.menu);
                      onSelectTab('approval');
                    }}
                    style={{
                      width: '100%',
                      border: 'none',
                      background: x.strong ? (idx === 0 ? C.blueSoft : C.redSoft) : 'transparent',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 12,
                      padding: '12px 10px',
                      borderTop: idx === 0 ? 'none' : `1px solid ${C.g200}`,
                      borderRadius: idx === 0 ? '10px 10px 0 0' : idx === 3 ? '0 0 10px 10px' : 0,
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 900, color: C.g800 }}>{x.label}</div>
                      <div style={{ fontSize: 11, color: C.g500 }}>{x.sub}</div>
                    </div>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 900,
                        color: x.accent,
                        background: 'white',
                        border: `1px solid ${C.g200}`,
                        padding: '6px 11px',
                        borderRadius: 10,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {x.cnt}
                    </span>
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 11, color: C.g500, marginTop: 10 }}>
                SR 결재 문의: 결재요청 {srInboxNeed}건 · 수신참조 {srCcNeed}건
              </div>
            </Card>
          </div>

          {/* [D] GHG 산정 + 최근 활동 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Card>
              <CTitle
                action={
                  <Link href="/ghg_calc" style={{ fontSize: 12, fontWeight: 800, color: C.teal, textDecoration: 'none' }}>
                    GHG 산정(신규) →
                  </Link>
                }
              >
                GHG 산정 현황
              </CTitle>
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 11, color: C.g500, marginBottom: 4 }}>Raw data 충실도</div>
                <div style={{ fontSize: 28, fontWeight: 900, color: C.teal, lineHeight: 1 }}>{ghgSub.rawPct}%</div>
                <div style={{ fontSize: 11, color: C.g500, marginTop: 6 }}>
                  이상치 미조치 {ghgSub.anomalyOpen}건 · 산정 적합성 {ghgSub.calcFitPct}%
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginTop: 14 }}>
                {scopeCards.map((sc) => (
                  <div
                    key={sc.label}
                    style={{
                      border: `1px solid ${C.g200}`,
                      borderRadius: 10,
                      padding: '10px 12px',
                      background: sc.done ? C.g50 : C.amberSoft,
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 900, color: C.g700, marginBottom: 6 }}>{sc.label}</div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: sc.done ? C.teal : C.amber }}>{sc.done ? '산정' : '미완'}</div>
                    <div style={{ fontSize: 10, color: C.g600, marginTop: 6, lineHeight: 1.4 }}>{sc.sub}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: C.g600, marginBottom: 8 }}>이상치 (우선 조치)</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {topAnomalies.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => {
                        setSelectedAnomalyId(a.id);
                        onSelectTab('ghg');
                      }}
                      style={{
                        width: '100%',
                        border: `1px solid ${C.g200}`,
                        background: 'white',
                        borderRadius: 10,
                        padding: '10px 12px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 12,
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 900, color: C.g800 }}>{a.label}</div>
                        <div style={{ fontSize: 11, color: C.g500 }}>
                          {a.scope} · YoY {a.yoy}
                        </div>
                      </div>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 900,
                          padding: '3px 10px',
                          borderRadius: 999,
                          background: a.status === 'unresolved' ? C.redSoft : a.status === 'resolved' ? C.amberSoft : C.greenSoft,
                          color: a.status === 'unresolved' ? C.red : a.status === 'resolved' ? C.amber : C.teal,
                          border:
                            a.status === 'unresolved' ? '1px solid #fca5a5' : a.status === 'resolved' ? '1px solid #fcd34d' : '1px solid #6ee7b7',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {anomalyStatusToLabel(a.status)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </Card>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Card>
                <CTitle>최근 활동</CTitle>
                <div style={{ position: 'relative', marginTop: 8, paddingLeft: 14, borderLeft: `2px solid ${C.g200}` }}>
                  {recentActivities.map((a) => (
                    <button
                      key={a.key}
                      type="button"
                      onClick={() => {
                        const sr = SR_ITEMS.find((i) => i.id === a.key) ?? null;
                        if (sr) {
                          setSelectedDpId(sr.id);
                          const fb = FEEDBACKS.find((f2) => f2.status === 'open' && f2.item === sr.label) ?? null;
                          setSelectedFeedbackId(fb ? fb.id : null);
                        } else {
                          const an = GHG_STATUS.anomaly.items.find((x) => x.id === a.key) ?? null;
                          if (an) setSelectedAnomalyId(an.id);
                        }
                        a.onClick();
                      }}
                      style={{
                        position: 'relative',
                        width: '100%',
                        textAlign: 'left',
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        padding: '0 0 18px 12px',
                        margin: 0,
                      }}
                    >
                      <span
                        style={{
                          position: 'absolute',
                          left: -17,
                          top: 5,
                          width: 8,
                          height: 8,
                          borderRadius: 999,
                          background: a.dot.fg,
                          border: `2px solid white`,
                          boxShadow: `0 0 0 1px ${C.g200}`,
                        }}
                      />
                      <div style={{ fontSize: 12, fontWeight: 800, color: C.g800, lineHeight: 1.35 }}>{a.title}</div>
                      <div style={{ fontSize: 11, color: C.g500, marginTop: 4 }}>{a.sub}</div>
                    </button>
                  ))}
                  {recentActivities.length === 0 && (
                    <div style={{ fontSize: 12, color: C.g500, padding: '4px 0 8px 12px' }}>최근 활동이 없습니다.</div>
                  )}
                </div>
              </Card>

              <Card>
                <CTitle sub={urgentDl ? `가장 임박한 마감일 ${urgentDl}` : undefined}>같은 마감일 묶음</CTitle>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginTop: 8 }}>
                  {urgentItems.map((i, idx) => {
                    const st = getEffectiveSrWorkflow(i);
                    return (
                      <button
                        key={i.id}
                        type="button"
                        onClick={() => {
                          setSelectedDpId(i.id);
                          onSelectTab('sr');
                        }}
                        style={{
                          width: '100%',
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          padding: idx === 0 ? '6px 0 12px' : '12px 0',
                          borderTop: idx === 0 ? 'none' : `1px solid ${C.g200}`,
                          textAlign: 'left',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 10,
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 800, color: C.g800 }}>{i.label}</div>
                          <div style={{ fontSize: 11, color: C.g500, marginTop: 2 }}>마감 {i.dl}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                          <WorkflowBadge status={st} />
                          <span style={{ fontSize: 11, fontWeight: 800, color: C.blue }}>작성</span>
                        </div>
                      </button>
                    );
                  })}
                  {urgentItems.length === 0 && <div style={{ fontSize: 12, color: C.g500, padding: '6px 0' }}>표시할 항목이 없습니다.</div>}
                </div>
              </Card>
            </div>
          </div>

        </div>
      );
    }

    // Holding: HoldingDashboard.jsx — 지주사 전체 오버뷰
    return (
      <HoldingOverviewPanel
        onSelectTab={onSelectTab}
        setApprMenu={setApprMenu}
        setApprDomain={setApprDomain}
        inboxRequestCount={approvalMenuTotals['inbox.request']}
      />
    );
  };

  const renderTab = () => {
    switch (tab) {
      case 'overview':
        return renderOverview();
      case 'sr':
        return (
          <DashboardSrTab mode={mode} selectedDpId={selectedDpId} selectedFeedbackId={selectedFeedbackId} />
        );
      case 'ghg':
        return <DashboardGhgTab mode={mode} />;
      case 'approval':
        return (
          <DashboardApprovalInbox
            mode={mode}
            approvalDomain={apprDomain}
            setApprovalDomain={setApprDomain}
            approvalMenu={apprMenu}
            setApprovalMenu={setApprMenu}
            focusDocId={approvalFocusDocId ?? null}
            focusSrDpId={approvalFocusSrDpId ?? null}
            docs={approvalDocs}
            setDocs={setApprovalDocs}
          />
        );
      default:
        return renderOverview();
    }
  };

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        padding: 20,
        background: '#EEF1F5',
        fontFamily: "'Noto Sans KR','Pretendard',sans-serif",
        fontSize: 13,
        color: '#111827',
      }}
    >
      {renderTab()}
    </div>
  );
}

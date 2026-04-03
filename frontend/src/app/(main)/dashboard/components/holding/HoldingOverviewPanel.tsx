'use client';

import type { Dispatch, SetStateAction } from 'react';
import { Btn, Card } from '@/app/(main)/dashboard/components/shared';
import {
  HoldingMiniBarRow,
  HoldingSLabel,
  HoldingSparkline,
  HoldingStackedGhgBar,
  HoldingTag,
} from '@/app/(main)/dashboard/components/holding/HoldingDashboardWidgets';
import { C } from '@/app/(main)/dashboard/lib/constants';
import type { ApprovalMenuKey } from '@/app/(main)/dashboard/lib/dashboardNewMock';
import {
  HOLDING_DASH_YEARS,
  HOLDING_GHG_HISTORY_YEAR,
  HOLDING_OVERVIEW_SR_BY_AFF,
  HOLDING_RECENT_ACTIVITIES,
  HOLDING_SR_HISTORY_YEAR,
  holdingDiff,
  holdingPct,
} from '@/app/(main)/dashboard/lib/holdingDashboardMock';
import type { DashboardMainTab } from '@/app/(main)/dashboard/lib/dashboardNewNav';

const ACT_COLOR: Record<string, string> = {
  green: C.green,
  red: C.red,
  amber: C.amber,
  blue: C.blue,
};

export function HoldingOverviewPanel({
  onSelectTab,
  setApprMenu,
  setApprDomain,
  inboxRequestCount,
}: {
  onSelectTab: (t: DashboardMainTab) => void;
  setApprMenu: (m: ApprovalMenuKey) => void;
  setApprDomain: Dispatch<SetStateAction<'ghg' | 'sr' | 'audit' | 'all'>>;
  inboxRequestCount: number;
}) {
  const srCur = HOLDING_SR_HISTORY_YEAR['2024'];
  const srPrv = HOLDING_SR_HISTORY_YEAR['2023'];
  const ghgCur = HOLDING_GHG_HISTORY_YEAR['2024'];
  const ghgPrv = HOLDING_GHG_HISTORY_YEAR['2023'];
  const totalGhgCur = ghgCur.scope1 + ghgCur.scope2 + ghgCur.scope3;
  const totalGhgPrv = ghgPrv.scope1 + ghgPrv.scope2 + ghgPrv.scope3;
  const ghgDiff = holdingDiff(totalGhgCur, totalGhgPrv);
  const srDiff = holdingDiff(srCur.approved, srPrv.approved);

  const srRate = holdingPct(srCur.approved, srCur.totalCos);
  const srSpark = HOLDING_DASH_YEARS.map((y) =>
    holdingPct(HOLDING_SR_HISTORY_YEAR[y].approved, HOLDING_SR_HISTORY_YEAR[y].totalCos),
  );
  const ghgSpark = HOLDING_DASH_YEARS.map((y) => {
    const g = HOLDING_GHG_HISTORY_YEAR[y];
    return (g.scope1 + g.scope2 + g.scope3) / 1000;
  });

  const noSubmit = HOLDING_OVERVIEW_SR_BY_AFF.filter((s) => s.submitted === 0).length;
  const rejected = HOLDING_OVERVIEW_SR_BY_AFF.filter((s) => s.rejected > 0).length;
  const pendingAff = HOLDING_OVERVIEW_SR_BY_AFF.filter(
    (s) => s.submitted > 0 && s.approved < s.submitted && s.rejected === 0,
  ).length;

  const maxGhgY = Math.max(
    ...HOLDING_DASH_YEARS.map((y) => {
      const g = HOLDING_GHG_HISTORY_YEAR[y];
      return g.scope1 + g.scope2 + g.scope3;
    }),
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div
            style={{
              fontSize: 11,
              color: C.g400,
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              marginBottom: 4,
            }}
          >
            ESG 통합 현황
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.g800 }}>지주사 대시보드</div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <HoldingTag color={C.blue}>2024년도 기준</HoldingTag>
          <HoldingTag color={C.g500}>목업 데이터 · 참고용</HoldingTag>
        </div>
      </div>

      {(noSubmit > 0 || rejected > 0) && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {noSubmit > 0 && (
            <div
              style={{
                flex: '1 1 280px',
                padding: '11px 16px',
                borderRadius: 9,
                background: C.redSoft,
                border: '0.5px solid rgba(220,38,38,0.25)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: C.red, flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: C.red }}>
                  미제출 계열사 {noSubmit}개사 — SR 보고서
                </span>
              </div>
              <Btn v="solid" color={C.red} onClick={() => onSelectTab('sr')} style={{ height: 28, fontSize: 11, fontWeight: 700 }}>
                바로가기 →
              </Btn>
            </div>
          )}
          {rejected > 0 && (
            <div
              style={{
                flex: '1 1 280px',
                padding: '11px 16px',
                borderRadius: 9,
                background: C.amberSoft,
                border: '0.5px solid rgba(217,119,6,0.25)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: C.amber, flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: C.amber }}>
                  반려 처리 계열사 {rejected}개사 — 재제출 요청 필요
                </span>
              </div>
              <Btn v="amber" onClick={() => onSelectTab('sr')} style={{ height: 28, fontSize: 11, fontWeight: 700 }}>
                바로가기 →
              </Btn>
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
        {[
          {
            label: 'SR 보고서 승인률',
            value: `${srRate}%`,
            sub: `${srCur.approved}개사 / ${srCur.totalCos}개사`,
            spark: srSpark.map((n) => n),
            color: C.blue,
            d: srDiff,
            dLabel: '전년 대비(승인 개사)',
            invert: false,
          },
          {
            label: 'GHG 총 배출량',
            value: `${(totalGhgCur / 1000).toFixed(0)}k`,
            sub: 'tCO₂eq · Scope 1+2+3',
            spark: ghgSpark,
            color: C.teal,
            d: ghgDiff,
            dLabel: '전년 대비(총량)',
            invert: true,
          },
          {
            label: '결재 요청 대기',
            value: String(inboxRequestCount),
            sub: '건 · 통합 결재함',
            spark: [Math.max(0, inboxRequestCount - 2), inboxRequestCount - 1, inboxRequestCount],
            color: C.amber,
            d: undefined,
            dLabel: '',
            invert: false,
          },
          {
            label: '미제출 계열사',
            value: String(noSubmit),
            sub: '개사 · SR 기준',
            spark: [2, 1, noSubmit],
            color: noSubmit > 0 ? C.red : C.green,
            d: undefined,
            dLabel: '',
            invert: false,
          },
        ].map((k, i) => (
          <Card key={i}>
            <div style={{ fontSize: 11, color: C.g500, fontWeight: 600, marginBottom: 10 }}>{k.label}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 8 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 26, fontWeight: 800, color: k.color, lineHeight: 1 }}>{k.value}</div>
                <div style={{ fontSize: 11, color: C.g400, marginTop: 4 }}>{k.sub}</div>
                {k.d && k.d.dir !== 'flat' && (
                  <div
                    style={{
                      fontSize: 11,
                      marginTop: 6,
                      color: k.invert
                        ? k.d.dir === 'down'
                          ? C.green
                          : C.red
                        : k.d.dir === 'up'
                          ? C.green
                          : C.red,
                    }}
                  >
                    {k.d.sign} {k.d.val} {k.dLabel}
                  </div>
                )}
              </div>
              <HoldingSparkline values={k.spark} color={k.color} />
            </div>
          </Card>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14 }}>
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div>
              <HoldingSLabel>SR 보고서</HoldingSLabel>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.g800 }}>연도별 제출·승인 추이</div>
            </div>
            <Btn v="ghost" onClick={() => onSelectTab('sr')} style={{ height: 28, fontSize: 11 }}>
              상세 보기
            </Btn>
          </div>
          {HOLDING_DASH_YEARS.map((y) => {
            const d = HOLDING_SR_HISTORY_YEAR[y];
            const isLatest = y === '2024';
            return (
              <div key={y} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: isLatest ? 800 : 500, color: isLatest ? C.g800 : C.g500 }}>
                    {y}년
                  </span>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    <HoldingTag color={C.blue} small>
                      제출 {d.submitted}/{d.totalCos}
                    </HoldingTag>
                    <HoldingTag color={C.green} small>
                      승인 {d.approved}
                    </HoldingTag>
                    {d.rejected > 0 && (
                      <HoldingTag color={C.red} small>
                        반려 {d.rejected}
                      </HoldingTag>
                    )}
                  </div>
                </div>
                <HoldingMiniBarRow
              val={d.approved}
              max={d.totalCos}
              color={isLatest ? C.blue : 'rgba(19, 81, 216, 0.45)'}
              thin
            />
              </div>
            );
          })}
        </Card>

        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
            <div>
              <HoldingSLabel>GHG 산정</HoldingSLabel>
              <div style={{ fontSize: 14, fontWeight: 800, color: C.g800 }}>연도별 배출량 추이</div>
            </div>
            <Btn v="ghost" onClick={() => onSelectTab('ghg')} style={{ height: 28, fontSize: 11 }}>
              상세 보기
            </Btn>
          </div>
          {HOLDING_DASH_YEARS.map((y) => {
            const d = HOLDING_GHG_HISTORY_YEAR[y];
            const total = d.scope1 + d.scope2 + d.scope3;
            const isLatest = y === '2024';
            return (
              <div key={y} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: isLatest ? 800 : 500, color: isLatest ? C.g800 : C.g500 }}>
                    {y}년
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: isLatest ? C.teal : C.g500 }}>
                    {total.toLocaleString()} tCO₂eq
                  </span>
                </div>
                <HoldingStackedGhgBar
                  scope1={d.scope1}
                  scope2={d.scope2}
                  scope3={d.scope3}
                  maxTotal={maxGhgY}
                  muted={!isLatest}
                />
              </div>
            );
          })}
          <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
            {[
              { c: C.teal, l: 'Scope 1' },
              { c: C.blue, l: 'Scope 2' },
              { c: C.g400, l: 'Scope 3' },
            ].map((s) => (
              <div key={s.l} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: s.c }} />
                <span style={{ fontSize: 10, color: C.g500 }}>{s.l}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.g300, letterSpacing: '0.08em', marginBottom: 2 }}>
              계열사 현황
            </div>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.g800 }}>2024 SR 제출 요약</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {HOLDING_OVERVIEW_SR_BY_AFF.map((sub) => {
              const statusColor =
                sub.submitted === 0 ? C.red : sub.rejected > 0 ? C.amber : sub.approved === sub.submitted ? C.green : C.blue;
              return (
                <div key={sub.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, color: C.g500, width: 52, flexShrink: 0 }}>{sub.short}</span>
                  <div style={{ flex: 1 }}>
                    <HoldingMiniBarRow val={sub.submitted} max={sub.total} color={statusColor} thin />
                  </div>
                  {sub.submitted === 0 && <HoldingTag color={C.red} small>미제출</HoldingTag>}
                  {sub.submitted > 0 && sub.rejected > 0 && (
                    <HoldingTag color={C.amber} small>
                      반려{sub.rejected}
                    </HoldingTag>
                  )}
                  {sub.submitted > 0 && sub.rejected === 0 && sub.approved === sub.submitted && (
                    <HoldingTag color={C.green} small>
                      완료
                    </HoldingTag>
                  )}
                  {sub.submitted > 0 && sub.rejected === 0 && sub.approved < sub.submitted && (
                    <HoldingTag color={C.blue} small>
                      검토중
                    </HoldingTag>
                  )}
                </div>
              );
            })}
          </div>
          {pendingAff > 0 && (
            <div style={{ marginTop: 10, fontSize: 11, color: C.g500 }}>
              검토 대기 계열사 약 <b style={{ color: C.amber }}>{pendingAff}</b>개사
            </div>
          )}
        </Card>
      </div>

      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: C.g800 }}>최근 처리 이력</div>
          <span style={{ fontSize: 10, fontWeight: 700, color: C.g300, letterSpacing: '0.06em' }}>목업 · 최근 7일</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 0 }}>
          {HOLDING_RECENT_ACTIVITIES.map((h, i) => (
            <div
              key={i}
              style={{
                padding: '10px 14px',
                borderLeft: i > 0 ? `0.5px solid ${C.g200}` : 'none',
                minWidth: 0,
              }}
            >
              <div style={{ fontSize: 10, color: C.g400, marginBottom: 4 }}>{h.date}</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: ACT_COLOR[h.color] ?? C.blue, marginBottom: 3 }}>{h.type}</div>
              <div style={{ fontSize: 11, color: C.g800, fontWeight: 600, marginBottom: 1, lineHeight: 1.4 }}>{h.actor}</div>
              <div style={{ fontSize: 11, color: C.g500, lineHeight: 1.4 }}>{h.target}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Btn
            v="ghost"
            onClick={() => {
              setApprDomain('all');
              setApprMenu('inbox.history');
              onSelectTab('approval');
            }}
            style={{ height: 28, fontSize: 11 }}
          >
            결재함에서 전체 보기
          </Btn>
        </div>
      </Card>
    </div>
  );
}

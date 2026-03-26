'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { Btn, Card, CTitle } from '@/app/(main)/dashboard/components/shared';
import { C } from '@/app/(main)/dashboard/lib/constants';
import {
  HOLDING_AFFILIATE_GHG,
  getHoldingSelfGhg,
  getSubsidiaryOverviewGhg,
} from '@/app/(main)/dashboard/lib/dashboardNewMock';
import { GHG_STATUS } from '@/app/(main)/dashboard/lib/mockData';
import {
  WORKFLOW_STATUS_LABEL,
  WORKFLOW_STATUS_STYLE,
  type WorkflowStatus,
} from '@/app/(main)/dashboard/lib/workflowStatus';
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
}: {
  label: string;
  value: string;
  sub?: string;
  accent: string;
}) {
  return (
    <div
      style={{
        background: 'white',
        borderRadius: 10,
        padding: '13px 15px',
        borderTop: `3px solid ${accent}`,
        boxShadow: '0 1px 3px rgba(0,0,0,.06)',
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

function anomalyStatusToLabel(s: string) {
  if (s === 'unresolved') return '미조치';
  if (s === 'corrected') return '수정됨';
  if (s === 'resolved') return '해결됨';
  return s;
}

export function DashboardGhgTab({ mode }: { mode: 'subsidiary' | 'holding' }) {
  const ghgSub = useMemo(() => getSubsidiaryOverviewGhg(), []);
  const ghgHoldSelf = useMemo(() => getHoldingSelfGhg(), []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div
        style={{
          background: C.tealSoft,
          border: '1px solid #6ee7d5',
          borderRadius: 9,
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.teal }}>GHG 산정(신규) 연동</div>
          <div style={{ fontSize: 11, color: C.g500, marginTop: 2 }}>
            Raw data·이상치·산정 결과는 GHG 산정(신규) 화면과 동일 데이터 정의를 사용합니다.
          </div>
        </div>
        <Link href="/ghg_calc">
          <Btn v="teal">GHG 산정(신규) →</Btn>
        </Link>
      </div>

      {mode === 'subsidiary' ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
            <StatTile label="필수 데이터 입력률" value={`${ghgSub.rawPct}%`} accent={C.teal} sub="GHG 산정(신규)에서 상세 확인" />
            <StatTile label="이상치 미조치" value={`${ghgSub.anomalyOpen}건`} accent={C.amber} sub="GHG 산정(신규)에서 상세 확인" />
            <StatTile label="검증 통과율" value={`${ghgSub.calcFitPct}%`} accent={C.blue} sub="GHG 산정(신규)에서 상세 확인" />
          </div>

          {(() => {
            const openAnomalies = GHG_STATUS.anomaly.items.filter((a) => a.status === 'unresolved');
            const missingRaw = GHG_STATUS.rawData.filter((r) => !r.done);

            const topActions = [
              ...openAnomalies.map((a) => ({
                key: `anomaly:${a.id}`,
                title: a.label,
                sub: `${a.scope} · YoY ${a.yoy}`,
                href: `/ghg_calc?focus=anomaly&id=${encodeURIComponent(a.id)}`,
                badge: '미조치',
                badgeBg: C.redSoft,
                badgeFg: C.red,
              })),
              ...missingRaw.map((r) => ({
                key: `raw:${r.id}`,
                title: r.label,
                sub: `${r.category} · 입력 필요`,
                href: `/ghg_calc?focus=raw&id=${encodeURIComponent(r.id)}`,
                badge: '누락',
                badgeBg: C.amberSoft,
                badgeFg: C.amber,
              })),
            ].slice(0, 5);

            const recentLike = [...GHG_STATUS.anomaly.items]
              .slice()
              .sort((a, b) => {
                const pr: Record<string, number> = { corrected: 0, resolved: 1, unresolved: 2 };
                return (pr[a.status] ?? 9) - (pr[b.status] ?? 9);
              })
              .slice(0, 3);

            return (
              <>
                <Card>
                  <CTitle
                    action={
                      <Link href="/ghg_calc" style={{ color: C.teal, fontWeight: 800, fontSize: 12, textDecoration: 'none' }}>
                        GHG 산정(신규) →
                      </Link>
                    }
                  >
                    내 조치 필요 TOP 5
                  </CTitle>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {topActions.map((x) => (
                      <Link
                        key={x.key}
                        href={x.href}
                        style={{
                          textDecoration: 'none',
                          border: `1px solid ${C.g200}`,
                          borderRadius: 10,
                          background: 'white',
                          padding: '10px 12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 12,
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 900, color: C.g800, marginBottom: 3 }}>{x.title}</div>
                          <div style={{ fontSize: 11, color: C.g500 }}>{x.sub}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 900,
                              padding: '4px 10px',
                              borderRadius: 999,
                              background: x.badgeBg,
                              color: x.badgeFg,
                              border: `1px solid ${C.g200}`,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {x.badge}
                          </span>
                          <span style={{ fontSize: 11, fontWeight: 900, color: C.blue, whiteSpace: 'nowrap' }}>상세 처리</span>
                        </div>
                      </Link>
                    ))}
                    {topActions.length === 0 && <div style={{ fontSize: 12, color: C.g500, padding: '6px 0' }}>지금 조치가 필요한 항목이 없습니다.</div>}
                  </div>
                </Card>

                <Card>
                  <CTitle sub="대시보드는 요약만 표시합니다. 상세는 GHG 산정(신규)에서 확인하세요.">최근 변경 이력</CTitle>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginTop: 4 }}>
                    {recentLike.map((a, idx) => (
                      <Link
                        key={a.id}
                        href={`/ghg_calc?focus=anomaly&id=${encodeURIComponent(a.id)}`}
                        style={{
                          textDecoration: 'none',
                          padding: idx === 0 ? '10px 0 12px' : '12px 0',
                          borderTop: idx === 0 ? 'none' : `1px solid ${C.g200}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 12,
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 800, color: C.g800 }}>{a.label}</div>
                          <div style={{ fontSize: 11, color: C.g500, marginTop: 3 }}>
                            {a.scope} · {anomalyStatusToLabel(a.status)}
                          </div>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 900, color: C.teal, whiteSpace: 'nowrap' }}>GHG 산정(신규)에서 확인</span>
                      </Link>
                    ))}
                    {recentLike.length === 0 && <div style={{ fontSize: 12, color: C.g500, padding: '10px 0' }}>이력이 없습니다.</div>}
                  </div>
                </Card>
              </>
            );
          })()}
        </>
      ) : (
        <Card>
          <CTitle>본사·계열사 GHG 매트릭스</CTitle>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: C.g500 }}>
                  <th style={{ padding: '8px 6px' }}>법인</th>
                  <th style={{ padding: '8px 6px' }}>Raw 충실도</th>
                  <th style={{ padding: '8px 6px' }}>이상치</th>
                  <th style={{ padding: '8px 6px' }}>산정 적합</th>
                  <th style={{ padding: '8px 6px' }}>단계</th>
                </tr>
              </thead>
              <tbody>
                {[ghgHoldSelf, ...HOLDING_AFFILIATE_GHG].map((row) => (
                  <tr key={row.entity} style={{ borderTop: `1px solid ${C.g200}` }}>
                    <td style={{ padding: '8px 6px', fontWeight: 600 }}>{row.entity}</td>
                    <td style={{ padding: '8px 6px' }}>{row.rawCompletenessPct}%</td>
                    <td style={{ padding: '8px 6px' }}>{row.anomalyOpen}건</td>
                    <td style={{ padding: '8px 6px' }}>{row.calcFitPct}%</td>
                    <td style={{ padding: '8px 6px' }}>
                      <WorkflowBadge status={row.pipeline} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Btn, Card } from '@/app/(main)/dashboard/components/shared';
import { HoldingSparkline, HoldingTag } from '@/app/(main)/dashboard/components/holding/HoldingDashboardWidgets';
import { C } from '@/app/(main)/dashboard/lib/constants';
import {
  HOLDING_DASH_YEARS,
  HOLDING_GHG_HISTORY_YEAR,
  HOLDING_GHG_ORG_ROWS,
  holdingDiff,
} from '@/app/(main)/dashboard/lib/holdingDashboardMock';

const fmtN = (n: number) => n.toLocaleString();

export function HoldingGhgDashboardPanel() {
  const [year, setYear] = useState<string>('2024');
  const ghgCur = HOLDING_GHG_HISTORY_YEAR[year];
  const prevY = String(Number(year) - 1);
  const ghgPrv = HOLDING_GHG_HISTORY_YEAR[prevY] ?? ghgCur;

  const totalCur = ghgCur.scope1 + ghgCur.scope2 + ghgCur.scope3;
  const totalPrv = ghgPrv.scope1 + ghgPrv.scope2 + ghgPrv.scope3;
  const reduction = holdingDiff(totalCur, totalPrv);
  const orgRows = HOLDING_GHG_ORG_ROWS;
  const verified = orgRows.filter((s) => s.verified).length;
  const submitted = orgRows.filter((s) => s.submitted).length;
  const approved = orgRows.filter((s) => s.approved).length;
  const chartSamples = useMemo(() => {
    const sub = orgRows.filter((r) => r.kind === 'subsidiary').slice(0, 3);
    const dom = orgRows.filter((r) => r.kind === 'domestic_site').slice(0, 3);
    return [...sub, ...dom];
  }, [orgRows]);

  const sparkTotals = useMemo(
    () => HOLDING_DASH_YEARS.map((y) => {
      const g = HOLDING_GHG_HISTORY_YEAR[y];
      return g.scope1 + g.scope2 + g.scope3;
    }),
    [],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.g400, letterSpacing: '0.08em', marginBottom: 4 }}>GHG 산정</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.g800 }}>온실가스 배출량 현황</div>
          <div style={{ fontSize: 11, color: C.g500, marginTop: 4 }}>
            자회사(계열사) 및 국내 사업장(데이터센터·캠퍼스 등) · 목업 데이터
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {HOLDING_DASH_YEARS.map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => setYear(y)}
              style={{
                fontSize: 12,
                padding: '6px 14px',
                borderRadius: 6,
                cursor: 'pointer',
                fontWeight: 700,
                border: year === y ? 'none' : `1px solid ${C.g200}`,
                background: year === y ? C.teal : 'white',
                color: year === y ? '#fff' : C.g500,
              }}
            >
              {y}
            </button>
          ))}
          <Link href="/ghg_calc" style={{ textDecoration: 'none' }}>
            <Btn v="teal">GHG 산정(신규) →</Btn>
          </Link>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 10 }}>
        {[
          {
            label: '총 배출량 (Scope 1+2+3)',
            value: `${(totalCur / 1000).toFixed(1)}k`,
            unit: 'tCO₂eq',
            color: C.teal,
            diff:
              totalPrv > 0
                ? `${reduction.sign} ${(((reduction.val / totalPrv) * 100).toFixed(1))}% 전년 대비`
                : undefined,
            diffColor: reduction.dir === 'down' ? C.green : C.red,
          },
          {
            label: 'Scope 1 (직접)',
            value: fmtN(ghgCur.scope1),
            unit: 'tCO₂eq',
            color: C.teal,
            diff: `${holdingDiff(ghgCur.scope1, ghgPrv.scope1).sign} ${fmtN(holdingDiff(ghgCur.scope1, ghgPrv.scope1).val)}`,
            diffColor: holdingDiff(ghgCur.scope1, ghgPrv.scope1).dir === 'down' ? C.green : C.red,
          },
          {
            label: 'Scope 2 (간접)',
            value: fmtN(ghgCur.scope2),
            unit: 'tCO₂eq',
            color: C.blue,
            diff: `${holdingDiff(ghgCur.scope2, ghgPrv.scope2).sign} ${fmtN(holdingDiff(ghgCur.scope2, ghgPrv.scope2).val)}`,
            diffColor: holdingDiff(ghgCur.scope2, ghgPrv.scope2).dir === 'down' ? C.green : C.red,
          },
          {
            label: '제출 완료',
            value: String(submitted),
            unit: `/ ${orgRows.length}개 조직(자회사·국내 사업장)`,
            color: C.blue,
          },
          {
            label: '제3자 검증',
            value: String(verified),
            unit: `/ ${orgRows.length}개 조직`,
            color: C.green,
          },
        ].map((k, i) => (
          <div
            key={i}
            style={{
              background: C.g50,
              borderRadius: 9,
              padding: '12px 14px',
              border: `1px solid ${C.g200}`,
            }}
          >
            <div style={{ fontSize: 10, color: C.g500, fontWeight: 600, marginBottom: 5 }}>{k.label}</div>
            <div style={{ fontSize: i === 0 ? 24 : 18, fontWeight: 800, color: k.color, lineHeight: 1 }}>{k.value}</div>
            <div style={{ fontSize: 10, color: C.g400, marginTop: 3 }}>{k.unit}</div>
            {k.diff && (
              <div style={{ fontSize: 10, color: k.diffColor, marginTop: 5, fontWeight: 600 }}>{k.diff}</div>
            )}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 320px) 1fr', gap: 14 }}>
        <Card>
          <div style={{ fontSize: 13, fontWeight: 800, color: C.g800, marginBottom: 14 }}>3개년 Scope별 배출량 추이</div>
          {(
            [
              { label: 'Scope 1', key: 'scope1' as const, color: C.teal },
              { label: 'Scope 2', key: 'scope2' as const, color: C.blue },
              { label: 'Scope 3', key: 'scope3' as const, color: C.g400 },
            ] as const
          ).map((sc) => {
            const vals = HOLDING_DASH_YEARS.map((y) => HOLDING_GHG_HISTORY_YEAR[y][sc.key]);
            const latest = vals[vals.length - 1];
            const prev = vals[vals.length - 2];
            const d = holdingDiff(latest, prev);
            const maxV = Math.max(...vals);
            return (
              <div
                key={sc.key}
                style={{
                  marginBottom: 14,
                  paddingBottom: 14,
                  borderBottom: `0.5px solid ${C.g200}`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.g800 }}>{sc.label}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: sc.color }}>{fmtN(latest)}</span>
                    <span style={{ fontSize: 10, color: d.dir === 'down' ? C.green : C.red, fontWeight: 600 }}>
                      {d.sign}
                      {fmtN(d.val)}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
                  {vals.map((v, vi) => {
                    const h = maxV > 0 ? (v / maxV) * 44 : 2;
                    return (
                      <div key={vi} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                        <div
                          style={{
                            width: '100%',
                            height: h,
                            borderRadius: '3px 3px 0 0',
                            background: vi === vals.length - 1 ? sc.color : `${sc.color}55`,
                          }}
                        />
                        <span style={{ fontSize: 9, color: C.g400 }}>{HOLDING_DASH_YEARS[vi].slice(2)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <div style={{ marginTop: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.g800, marginBottom: 6 }}>총 배출량 추이</div>
            <HoldingSparkline values={sparkTotals} color={C.teal} height={36} width={230} />
          </div>
        </Card>

        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <div
            style={{
              padding: '14px 18px',
              borderBottom: `0.5px solid ${C.g200}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 800, color: C.g800 }}>
              {year}년 법인·국내 사업장별 GHG 산정 현황
            </div>
            <Link href="/ghg_calc" style={{ textDecoration: 'none' }}>
              <Btn v="ghost" style={{ height: 28, fontSize: 11 }}>
                상세 산정 화면
              </Btn>
            </Link>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: C.g50 }}>
                  {['구분', '유형', '명칭', 'Scope 1', 'Scope 2', 'Scope 3', '합계', '제3자검증', '상태'].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: '9px 12px',
                        fontSize: 10,
                        fontWeight: 700,
                        color: C.g500,
                        textAlign: h === '명칭' || h === '구분' || h === '유형' ? 'left' : 'center',
                        borderBottom: `1px solid ${C.g200}`,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orgRows.map((sub) => {
                  const total = sub.scope1 + sub.scope2 + sub.scope3;
                  const seg = sub.kind === 'subsidiary' ? '자회사' : '국내 사업장';
                  const typ = sub.kind === 'subsidiary' ? '—' : sub.siteCategory ?? '—';
                  return (
                    <tr key={sub.id}>
                      <td
                        style={{
                          padding: '10px 12px',
                          fontSize: 11,
                          fontWeight: 600,
                          color: C.g600,
                          whiteSpace: 'nowrap',
                          borderBottom: `0.5px solid ${C.g200}`,
                        }}
                      >
                        {seg}
                      </td>
                      <td
                        style={{
                          padding: '10px 12px',
                          fontSize: 11,
                          color: C.g500,
                          whiteSpace: 'nowrap',
                          borderBottom: `0.5px solid ${C.g200}`,
                        }}
                      >
                        {typ}
                      </td>
                      <td
                        style={{
                          padding: '10px 12px',
                          fontWeight: 700,
                          color: C.g800,
                          whiteSpace: 'nowrap',
                          borderBottom: `0.5px solid ${C.g200}`,
                        }}
                      >
                        {sub.name}
                      </td>
                      {[sub.scope1, sub.scope2, sub.scope3].map((v, i) => (
                        <td
                          key={i}
                          style={{
                            padding: '10px 12px',
                            textAlign: 'center',
                            borderBottom: `0.5px solid ${C.g200}`,
                            color: v > 0 ? C.g800 : C.g400,
                            fontWeight: v > 0 ? 600 : 400,
                          }}
                        >
                          {v > 0 ? fmtN(v) : '—'}
                        </td>
                      ))}
                      <td
                        style={{
                          padding: '10px 12px',
                          textAlign: 'center',
                          fontWeight: 800,
                          color: total > 0 ? C.teal : C.g400,
                          borderBottom: `0.5px solid ${C.g200}`,
                        }}
                      >
                        {total > 0 ? fmtN(total) : '—'}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', borderBottom: `0.5px solid ${C.g200}` }}>
                        {sub.verified ? (
                          <HoldingTag color={C.green} small>
                            검증완료
                          </HoldingTag>
                        ) : (
                          <HoldingTag color={C.g400} small>
                            미검증
                          </HoldingTag>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center', borderBottom: `0.5px solid ${C.g200}` }}>
                        {!sub.submitted && (
                          <HoldingTag color={C.red} small>
                            미제출
                          </HoldingTag>
                        )}
                        {sub.submitted && sub.approved && (
                          <HoldingTag color={C.green} small>
                            승인
                          </HoldingTag>
                        )}
                        {sub.submitted && !sub.approved && (
                          <HoldingTag color={C.amber} small>
                            검토중
                          </HoldingTag>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Card>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.g800, marginBottom: 12 }}>
          조직별 총배출 요약 (3개년) — 자회사·국내 사업장 샘플
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 16 }}>
          {chartSamples.map((sub) => {
            const total = sub.scope1 + sub.scope2 + sub.scope3;
            const chartData = [
              { val: total * 1.08, label: '22' },
              { val: total * 1.04, label: '23' },
              { val: total, label: '24' },
            ];
            const max = Math.max(...chartData.map((d) => d.val), 1);
            return (
              <div key={sub.id}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.g800, marginBottom: 2 }}>{sub.short}</div>
                <div style={{ fontSize: 10, color: C.g400, marginBottom: 6 }}>{total > 0 ? `${fmtN(total)} tCO₂eq` : '미제출'}</div>
                <svg width={88} height={48} style={{ display: 'block' }}>
                  {chartData.map((d, i) => {
                    const bw = 22;
                    const gap = (88 - bw * chartData.length) / (chartData.length + 1);
                    const x = gap + i * (bw + gap);
                    const bh = max > 0 ? (d.val / max) * (48 - 16) : 0;
                    const y = 48 - bh - 14;
                    return (
                      <g key={i}>
                        <rect x={x} y={y} width={bw} height={bh} rx={3} fill={i === chartData.length - 1 ? C.teal : `${C.teal}55`} />
                        <text x={x + bw / 2} y={46} textAnchor="middle" fontSize={8} fill={C.g400}>
                          {d.label}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

'use client';

import { useGHGStore } from '../../store/ghg.store';
import { useMemo } from 'react';

/** GHG_AUDIT_TAB_DESIGN_v2 §4.4: 데이터 품질 분포 (M1/M2/E1/E2) */

type DQCategory = 'M1' | 'M2' | 'E1' | 'E2';

function dqFromDataType(dataType?: string): DQCategory {
  if (dataType === 'measured') return 'M1';
  if (dataType === 'supplier') return 'M2';
  if (dataType === 'estimated') return 'E1';
  return 'E2';
}

export function DataQualityDistributionView() {
  const scope1 = useGHGStore((s) => s.scope1);
  const scope2 = useGHGStore((s) => s.scope2);
  const scope3 = useGHGStore((s) => s.scope3);

  const distribution = useMemo(() => {
    const all: { scope: string; dq: DQCategory }[] = [];
    scope1.stationary.forEach((r) => all.push({ scope: 'Scope 1', dq: dqFromDataType(r.dataQuality?.dataType) }));
    scope1.mobile.forEach((r) => all.push({ scope: 'Scope 1', dq: dqFromDataType(r.dataQuality?.dataType) }));
    scope2.electricity.forEach((r) => all.push({ scope: 'Scope 2', dq: dqFromDataType(r.dataQuality?.dataType) }));
    scope3.categories.forEach((c) =>
      c.data.forEach((r) => all.push({ scope: 'Scope 3', dq: dqFromDataType(r.dataQuality?.dataType) }))
    );
    const total = all.length || 1;
    const m1 = all.filter((x) => x.dq === 'M1').length;
    const m2 = all.filter((x) => x.dq === 'M2').length;
    const e1 = all.filter((x) => x.dq === 'E1').length;
    const e2 = all.filter((x) => x.dq === 'E2').length;
    return [
      { label: 'M1 실측(계량기)', count: m1, pct: Math.round((m1 / total) * 100), scope: 'Scope 1·2' },
      { label: 'M2 실측(영수증)', count: m2, pct: Math.round((m2 / total) * 100), scope: '연료 구매' },
      { label: 'E1 추정(공학)', count: e1, pct: Math.round((e1 / total) * 100), scope: 'Scope 3 일부' },
      { label: 'E2 추정(프록시)', count: e2, pct: Math.round((e2 / total) * 100), scope: '통근·spend' },
    ];
  }, [scope1, scope2, scope3]);

  const total = distribution.reduce((s, d) => s + d.count, 0) || 1;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-slate-900">데이터 품질 분포</h2>
      <p className="text-base text-slate-600">
        M1 실측(계량기), M2 실측(영수증), E1 추정(공학), E2 추정(프록시) 비율을 시각화합니다.
      </p>
      <div className="space-y-4">
        <p className="text-sm font-medium text-slate-700">전체 {total}건 기준</p>
        {distribution.map((d) => (
          <div key={d.label} className="flex items-center gap-4">
            <span className="w-36 text-sm text-slate-700 shrink-0">{d.label}</span>
            <div className="flex-1 h-6 bg-slate-100 rounded overflow-hidden">
              <div
                className="h-full bg-primary/70 rounded transition-all"
                style={{ width: d.count > 0 ? `${Math.max(d.pct, 4)}%` : '0%' }}
              />
            </div>
            <span className="w-24 text-sm text-slate-600 shrink-0 tabular-nums">
              {d.pct}% {d.count}건
            </span>
            <span className="w-24 text-xs text-slate-500 shrink-0">{d.scope}</span>
          </div>
        ))}
      </div>
      {total === 0 && (
        <p className="text-sm text-slate-500">활동자료가 없습니다. 산정 입력 탭에서 데이터를 입력하면 품질 분포가 표시됩니다.</p>
      )}
    </div>
  );
}

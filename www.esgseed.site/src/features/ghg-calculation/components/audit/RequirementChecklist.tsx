'use client';

import { useGHGStore } from '../../store/ghg.store';
import { useMemo } from 'react';
import {
  FRAMEWORK_CHECKLISTS,
  getCompletionRate,
  computeItemStatus,
  type AuditFramework,
  type ChecklistItem,
} from '../../constants/auditChecklist';
import { FRAMEWORK_LABELS } from '../../constants/disclosure';

/**
 * GHG_AUDIT_TAB_DESIGN_v2 §3: 요건 체크리스트 — 메인 화면
 * 프레임워크별 IFRS S2 / K-ETS 등 요건 충족률·근거값 실제 데이터 연동
 */
export function RequirementChecklist({
  framework = 'ISSB',
  onLineageClick,
}: {
  framework?: AuditFramework;
  onLineageClick?: (itemId: string) => void;
}) {
  const scope1 = useGHGStore((s) => s.scope1);
  const scope2 = useGHGStore((s) => s.scope2);
  const scope3 = useGHGStore((s) => s.scope3);
  const boundaryPolicy = useGHGStore((s) => s.boundaryPolicy);
  const facilities = useGHGStore((s) => s.facilities);

  const scope1Total = useMemo(
    () =>
      scope1.stationary.reduce((s, r) => s + (r.emissions || 0), 0) +
      scope1.mobile.reduce((s, r) => s + (r.emissions || 0), 0),
    [scope1]
  );
  const scope1Stationary = useMemo(
    () => scope1.stationary.reduce((s, r) => s + (r.emissions || 0), 0),
    [scope1.stationary]
  );
  const scope1Mobile = useMemo(
    () => scope1.mobile.reduce((s, r) => s + (r.emissions || 0), 0),
    [scope1.mobile]
  );
  const scope2Total = useMemo(
    () => scope2.electricity.reduce((s, r) => s + (r.emissions || 0), 0),
    [scope2.electricity]
  );
  const scope3Total = useMemo(
    () => scope3.categories.reduce((s, c) => s + c.data.reduce((ss, r) => ss + (r.emissions || 0), 0), 0),
    [scope3]
  );
  const scope3CategoryIds = useMemo(
    () => scope3.categories.filter((c) => c.data.some((r) => (r.emissions || 0) > 0)).map((c) => c.category),
    [scope3]
  );

  const baseItems = FRAMEWORK_CHECKLISTS[framework] ?? FRAMEWORK_CHECKLISTS.ISSB;
  const ctx = {
    scope1Total,
    scope2Total,
    scope3Total,
    scope1Stationary,
    scope1Mobile,
    efDbVersion: boundaryPolicy?.efDbVersion,
    organizationBoundary: boundaryPolicy?.organizationBoundary,
    reportingYear: boundaryPolicy?.reportingYear,
    scope2Included: boundaryPolicy?.operationalBoundary?.scope2Included,
    scope3CategoryIds,
    facilitiesCount: facilities?.length,
  };

  const dynamicItems = useMemo(() => {
    return baseItems.map((item) => {
      let next = computeItemStatus(item, ctx);
      if ((framework === 'ISSB' || framework === 'GRI' || framework === 'KSSB' || framework === 'ESRS') && item.id === 's1') {
        next = { ...next, evidence: scope1Total > 0 ? `${scope1Total.toFixed(0)} tCO₂e` : next.evidence };
      }
      if ((framework === 'ISSB' || framework === 'GRI' || framework === 'KSSB' || framework === 'ESRS') && item.id === 's2-loc') {
        next = { ...next, evidence: scope2Total > 0 ? `${scope2Total.toFixed(0)} tCO₂e` : next.evidence };
      }
      if ((framework === 'ISSB' || framework === 'GRI' || framework === 'KSSB' || framework === 'ESRS') && item.id === 's3') {
        next = scope3Total > 0
          ? { ...next, evidence: scope3CategoryIds.length > 0 ? `Cat.${scope3CategoryIds.join(',')}` : `${scope3Total.toFixed(0)} tCO₂e`, status: 'ok' as const }
          : next;
      }
      if (framework === 'K-ETS') {
        if (item.id === 's1-stationary') next = { ...next, evidence: scope1Stationary > 0 ? `${scope1Stationary.toFixed(1)} tCO₂e` : next.evidence };
        if (item.id === 's1-mobile') next = { ...next, evidence: scope1Mobile > 0 ? `${scope1Mobile.toFixed(1)} tCO₂e` : next.evidence };
        if (item.id === 's2-power') next = { ...next, evidence: scope2Total > 0 ? `${scope2Total.toFixed(1)} tCO₂e` : next.evidence };
      }
      return next;
    });
  }, [baseItems, framework, ctx, scope1Total, scope2Total, scope3Total, scope1Stationary, scope1Mobile, scope3CategoryIds]);

  const { ok, warning, missing, total, rate } = getCompletionRate(dynamicItems);

  const label = FRAMEWORK_LABELS[framework] ?? framework;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-slate-900">{label} 감사 대응 체크리스트</h2>
        <div className="text-sm font-semibold text-slate-600">
          충족률: <span className="text-slate-900">{rate}%</span> ({ok + Math.floor(warning * 0.5)}/{total} 항목)
        </div>
      </div>

      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-200">
              <th className="px-4 py-3 text-left font-semibold text-slate-700 w-32">카테고리</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">요건</th>
              <th className="px-4 py-3 text-center font-semibold text-slate-700 w-20">상태</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">근거값</th>
              <th className="px-4 py-3 text-center font-semibold text-slate-700 w-16">계보</th>
            </tr>
          </thead>
          <tbody>
            {dynamicItems.map((item, idx) => {
              const firstInCategory = dynamicItems.findIndex((i) => i.category === item.category) === idx;
              return (
              <tr
                key={item.id}
                className={`border-b border-slate-100 ${firstInCategory ? 'border-t border-slate-200' : ''}`}
              >
                <td className="px-4 py-2.5 text-slate-600">
                  {firstInCategory ? (
                    <span className="font-medium">[{item.category}]</span>
                  ) : (
                    ''
                  )}
                </td>
                <td className="px-4 py-2.5 text-slate-800">{item.requirement}</td>
                <td className="px-4 py-2.5 text-center">
                  <StatusBadge status={item.status} />
                </td>
                <td className="px-4 py-2.5 text-slate-700 tabular-nums">{item.evidence ?? '—'}</td>
                <td className="px-4 py-2.5 text-center">
                  <button
                    type="button"
                    onClick={() => onLineageClick?.(item.id)}
                    className="text-primary hover:underline text-xs font-medium"
                    aria-label="계보 드릴다운"
                  >
                    [↗]
                  </button>
                </td>
              </tr>
            );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        <span className="text-emerald-600 font-medium">✅ 충족 {ok}건</span>
        <span className="text-amber-600 font-medium">⚠️ 주의 {warning}건</span>
        <span className="text-red-600 font-medium">❌ 미충족 {missing}건</span>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: ChecklistItem['status'] }) {
  if (status === 'ok') return <span className="text-emerald-600 font-bold">✅</span>;
  if (status === 'warning') return <span className="text-amber-600 font-bold">⚠️</span>;
  return <span className="text-red-600 font-bold">❌</span>;
}

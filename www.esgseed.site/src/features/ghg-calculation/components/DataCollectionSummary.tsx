'use client';

import { useMemo } from 'react';
import { useGHGStore } from '../store/ghg.store';

/**
 * ERP_DATA_DISCLOSURE_STRATEGY §6.5 Phase 4: 데이터 수집 현황
 * ERP/엑셀에서 가져온 데이터 vs 수동 입력 데이터 건수 표시
 */
export function DataCollectionSummary() {
  const scope1 = useGHGStore((s) => s.scope1);
  const scope2 = useGHGStore((s) => s.scope2);

  const { erpCount, manualCount, totalCount } = useMemo(() => {
    const allRows = [
      ...scope1.stationary,
      ...scope1.mobile,
      ...scope2.electricity,
    ];
    let erp = 0;
    let manual = 0;
    for (const r of allRows) {
      if (r.dataType === 'ems' || r.dataType === 'excel') {
        erp += 1;
      } else {
        manual += 1;
      }
    }
    return {
      erpCount: erp,
      manualCount: manual,
      totalCount: allRows.length,
    };
  }, [scope1.stationary, scope1.mobile, scope2.electricity]);

  return (
    <div className="flex flex-wrap items-center gap-4 py-2 px-3 rounded-lg border border-slate-200 bg-slate-50/80 text-sm">
      <span className="font-semibold text-slate-700">데이터 수집 현황</span>
      <span className="inline-flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full bg-blue-500" aria-hidden />
        <span className="text-slate-600">ERP/엑셀</span>
        <span className="font-semibold text-slate-900 tabular-nums">{erpCount}</span>
        <span className="text-slate-500">건</span>
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full bg-slate-400" aria-hidden />
        <span className="text-slate-600">수동</span>
        <span className="font-semibold text-slate-900 tabular-nums">{manualCount}</span>
        <span className="text-slate-500">건</span>
      </span>
      <span className="text-slate-500">|</span>
      <span className="text-slate-600">
        총 <span className="font-semibold text-slate-900 tabular-nums">{totalCount}</span>건
      </span>
    </div>
  );
}

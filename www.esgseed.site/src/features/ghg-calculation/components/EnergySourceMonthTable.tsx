'use client';

import { useMemo } from 'react';
import type { EmissionData } from '../types/ghg.types';

/** ERP_DATA_DISCLOSURE_STRATEGY §7.4: 원시 데이터 출처별 셀 배경색 (erp: 파랑, manual: 회색) */
const DATA_TYPE_BG: Record<string, string> = {
  ems: 'bg-blue-50 border-blue-200',
  excel: 'bg-blue-50 border-blue-200',
  manual: 'bg-slate-100 border-slate-300',
};

interface EnergySourceMonthTableProps {
  /** Scope 1 stationary + mobile 또는 Scope 2 electricity 등 */
  rows: EmissionData[];
  /** 에너지원 표시명 매핑 (예: lng → 도시가스(LNG)) */
  energySourceLabels: Record<string, string>;
  /** 필터: 선택한 사업장만 집계. 빈 배열이면 전체 */
  selectedFacilities: string[];
  /** SIDBAR_CONNECT: 선택한 에너지원만 표시. 빈 배열이면 전체 에너지원 */
  selectedEnergySources?: string[];
  /** SCOPE1,2_DETAIL: Scope별 전체 에너지원 키 목록. 있으면 해당 순서로 모든 행 표시(데이터 없으면 0/'-'), 합계 행 추가 */
  allEnergySourceKeys?: string[];
  /** 선택 연도 */
  year: number;
  /** 시기 단위 */
  periodType?: 'monthly' | 'quarterly' | 'yearly';
  /** STEP_DETAIL: RAW(사용량) vs 탄소 배출량(tCO2e) */
  viewMode?: 'raw' | 'emission';
  /** STEP_DETAIL: 셀 클릭 시 호출 (모달용) */
  onCellClick?: (params: { energySource: string; month: number; value: number; dataType?: string }) => void;
}

/**
 * 에너지원/월별 결과 테이블 — GHG_UI_Strategy_v2 + STEP_DETAIL
 * 행=에너지원, 열=월(1~12), dataType별 셀 색상, RAW vs 탄소 배출량
 */
export function EnergySourceMonthTable({
  rows,
  energySourceLabels,
  selectedFacilities,
  selectedEnergySources = [],
  allEnergySourceKeys,
  year,
  periodType = 'monthly',
  viewMode = 'emission',
  onCellClick,
}: EnergySourceMonthTableProps) {
  const { energyByMonth, dataTypeByCell, energySources, colHeaders, colLabels, showTotalRow } = useMemo(() => {
    const filtered = rows.filter((r) => {
      if (r.year !== year) return false;
      if (selectedFacilities.length > 0 && !selectedFacilities.includes(r.facility || '')) return false;
      if (selectedEnergySources.length > 0) {
        const src = r.energySource || '';
        const displayLabel = energySourceLabels[src] ?? src;
        const match = selectedEnergySources.some((s) => s === src || s === displayLabel);
        if (!match) return false;
      }
      return true;
    });

    const energySet = new Set<string>();
    const valueMap: Record<string, Record<number, number>> = {};
    const typeMap: Record<string, Record<number, string>> = {};

    for (const r of filtered) {
      const src = r.energySource || '';
      energySet.add(src);
      if (!valueMap[src]) valueMap[src] = {};
      if (!typeMap[src]) typeMap[src] = {};
      const m = r.month || 1;
      let colKey: number;
      if (periodType === 'yearly') {
        colKey = 0;
      } else if (periodType === 'quarterly') {
        colKey = Math.ceil(m / 3);
      } else {
        colKey = m;
      }
      const val = viewMode === 'raw' ? (r.amount || 0) : (r.emissions || 0);
      valueMap[src][colKey] = (valueMap[src][colKey] || 0) + val;
      if (!typeMap[src][colKey]) typeMap[src][colKey] = r.dataType || 'manual';
    }

    let sources: string[];
    const showTotalRow = !!allEnergySourceKeys?.length;
    if (allEnergySourceKeys?.length) {
      if (selectedEnergySources.length === 1) {
        const sel = selectedEnergySources[0];
        const matched = allEnergySourceKeys.filter((k) => k === sel || (energySourceLabels[k] ?? k) === sel);
        sources = matched.length ? matched : allEnergySourceKeys;
      } else {
        sources = [...allEnergySourceKeys];
      }
    } else {
      sources = Array.from(energySet).sort();
    }

    const cols = periodType === 'yearly' ? [0] : periodType === 'quarterly' ? [1, 2, 3, 4] : Array.from({ length: 12 }, (_, i) => i + 1);
    const labels = periodType === 'yearly' ? ['연도 합계'] : periodType === 'quarterly' ? ['1분기', '2분기', '3분기', '4분기'] : cols.map((c) => `${c}월`);

    return { energyByMonth: valueMap, dataTypeByCell: typeMap, energySources: sources, colHeaders: cols, colLabels: labels, showTotalRow };
  }, [rows, selectedFacilities, selectedEnergySources, allEnergySourceKeys, year, periodType, viewMode, energySourceLabels]);

  const unitLabel = viewMode === 'raw' ? '사용량(원본)' : 'tCO2e';

  return (
    <div className="border border-slate-200 bg-white p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-base font-black text-slate-900">
          에너지원/월별 {viewMode === 'raw' ? 'RAW 데이터' : '탄소 배출량'}
        </div>
        <div className="flex gap-2 text-xs text-slate-500">
          <span className="px-2 py-0.5 rounded bg-blue-50 border border-blue-200 text-blue-700">ERP/엑셀</span>
          <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-300 text-slate-600">수동</span>
        </div>
      </div>
      <div className="overflow-auto border border-slate-200">
        <table className="min-w-[600px] w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-slate-700 border-b border-slate-200">에너지원</th>
              {colLabels.map((label, i) => (
                <th key={i} className="px-3 py-2 text-right font-semibold text-slate-700 border-b border-slate-200">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {energySources.length === 0 ? (
              <tr>
                <td colSpan={colLabels.length + 1} className="py-12 text-center text-slate-500 text-sm">
                  <p className="font-medium mb-1.5">입력된 데이터가 없습니다.</p>
                  <p>[EMS 불러오기] 또는 [엑셀 업로드]로 데이터를 가져오거나, [+ 행 추가]로 직접 입력하세요.</p>
                  <p className="text-xs mt-2 text-slate-400">필터에서 사업장을 선택했을 경우, 해당 사업장에 데이터가 있는지 확인하세요.</p>
                </td>
              </tr>
            ) : (
              <>
                {energySources.map((src) => (
                  <tr key={src} className="border-b border-slate-100">
                <td className="px-3 py-2 font-semibold text-slate-700">
                  {energySourceLabels[src] ?? src}
                </td>
                {colHeaders.map((colKey) => {
                  const v = energyByMonth[src]?.[colKey] ?? 0;
                  const dt = dataTypeByCell[src]?.[colKey];
                  const bgClass = (dt && DATA_TYPE_BG[dt]) || 'bg-white';
                  const isClickable = !!onCellClick;
                  return (
                    <td
                      key={colKey}
                      className={`px-3 py-2 text-right tabular-nums text-slate-900 border border-slate-100 ${bgClass} ${isClickable ? 'cursor-pointer hover:ring-2 hover:ring-[#669900]/50' : ''}`}
                      onClick={() => isClickable && onCellClick({ energySource: src, month: colKey, value: v, dataType: dt })}
                      role={isClickable ? 'button' : undefined}
                    >
                      {v === 0 ? '-' : v.toFixed(3)}
                    </td>
                  );
                })}
                  </tr>
                ))}
                {showTotalRow && (
              <tr className="border-t-2 border-slate-300 bg-slate-100 font-bold">
                <td className="px-3 py-2 text-slate-900">합계</td>
                {colHeaders.map((colKey) => {
                  const total = energySources.reduce((sum, src) => sum + (energyByMonth[src]?.[colKey] ?? 0), 0);
                  return (
                    <td key={colKey} className="px-3 py-2 text-right tabular-nums text-slate-900 border border-slate-200">
                      {total === 0 ? '-' : total.toFixed(3)}
                    </td>
                  );
                })}
                </tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>
      <div className="text-xs text-slate-600">
        단위: {unitLabel} — <strong>사업장은 사이드바에서 선택</strong>하며, 선택한 사업장의 데이터만 반영됩니다.
      </div>
    </div>
  );
}

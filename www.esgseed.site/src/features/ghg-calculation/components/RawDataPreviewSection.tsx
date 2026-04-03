'use client';

import { useGHGStore } from '../store/ghg.store';
import type { EmissionData } from '../types/ghg.types';

/** ERP_DATA_DISCLOSURE_STRATEGY §7.4: 원시 데이터 출처별 행 배경색 (erp: 파랑, manual: 회색) */
const DATA_TYPE_BG: Record<string, string> = {
  ems: 'bg-blue-50 border-l-4 border-l-blue-400',
  excel: 'bg-blue-50 border-l-4 border-l-blue-400',
  manual: 'bg-slate-50 border-l-4 border-l-slate-400',
};

function getSourceLabel(dataType?: string): string {
  if (dataType === 'ems') return 'ERP';
  if (dataType === 'excel') return '엑셀';
  return '수동';
}

interface RawDataPreviewSectionProps {
  /** EMS 다이얼로그 열기 */
  onOpenEMS?: () => void;
  /** 엑셀 업로드 다이얼로그 열기 */
  onOpenExcel?: () => void;
}

/**
 * ERP_DATA_DISCLOSURE_STRATEGY §6.5 Phase 4, §7.4
 * 원시 데이터 수집 — 데이터 우선(Data-first) 구조에서 가장 먼저 표시
 * ERP/엑셀 vs 수동 출처별 색상 구분
 */
export function RawDataPreviewSection({ onOpenEMS, onOpenExcel }: RawDataPreviewSectionProps) {
  const scope1 = useGHGStore((s) => s.scope1);
  const scope2 = useGHGStore((s) => s.scope2);

  const rows: Array<{ scope: string; row: EmissionData }> = [
    ...scope1.stationary.map((r) => ({ scope: 'Scope 1 고정', row: r })),
    ...scope1.mobile.map((r) => ({ scope: 'Scope 1 이동', row: r })),
    ...scope2.electricity.map((r) => ({ scope: 'Scope 2 전력', row: r })),
  ].sort((a, b) => {
    const ya = a.row.year ?? 0;
    const yb = b.row.year ?? 0;
    if (ya !== yb) return ya - yb;
    return (a.row.month ?? 0) - (b.row.month ?? 0);
  });

  return (
    <section className="rounded-lg border border-primary/30 bg-primary/5 overflow-hidden">
      <div className="px-4 py-3 border-b border-primary/20 bg-primary/10">
        <h2 className="text-lg font-bold text-foreground">1. 원시 데이터 수집</h2>
        <p className="text-sm text-muted-foreground mt-1">
          ERP·엑셀에서 가져오거나 수동으로 입력한 활동자료를 먼저 확인합니다. 아래 테이블에 반영된 데이터가 Scope 1/2 산정에 사용됩니다.
        </p>
        <div className="flex flex-wrap items-center gap-3 mt-3">
          {(onOpenEMS || onOpenExcel) && (
            <div className="flex gap-2">
              {onOpenEMS && (
                <button
                  type="button"
                  onClick={onOpenEMS}
                  className="px-3 py-1.5 text-sm font-semibold rounded-md bg-blue-100 text-blue-800 hover:bg-blue-200 transition-colors"
                >
                  EMS 불러오기
                </button>
              )}
              {onOpenExcel && (
                <button
                  type="button"
                  onClick={onOpenExcel}
                  className="px-3 py-1.5 text-sm font-semibold rounded-md bg-blue-100 text-blue-800 hover:bg-blue-200 transition-colors"
                >
                  엑셀 업로드
                </button>
              )}
            </div>
          )}
          <div className="flex gap-4 text-xs text-slate-600">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-blue-500" aria-hidden />
              ERP/엑셀
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-slate-400" aria-hidden />
              수동
            </span>
          </div>
        </div>
      </div>
      <div className="overflow-auto max-h-[320px]">
        <table className="min-w-[700px] w-full text-sm">
          <thead className="bg-slate-100 sticky top-0 z-10">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-slate-700 border-b border-slate-200">Scope</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-700 border-b border-slate-200">연도</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-700 border-b border-slate-200">월</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-700 border-b border-slate-200">사업장</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-700 border-b border-slate-200">에너지원</th>
              <th className="px-3 py-2 text-right font-semibold text-slate-700 border-b border-slate-200">사용량</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-700 border-b border-slate-200">단위</th>
              <th className="px-3 py-2 text-left font-semibold text-slate-700 border-b border-slate-200">출처</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="align-top">
                  <div className="py-12 text-center text-muted-foreground text-sm">
                    <p className="font-medium mb-1.5">입력된 원시 데이터가 없습니다.</p>
                    <p>
                      {onOpenEMS || onOpenExcel ? (
                        <>위의 <strong>EMS 불러오기</strong> 또는 <strong>엑셀 업로드</strong>로 데이터를 가져오거나, 아래 <strong>2. 활동자료 입력</strong>에서 수동으로 입력하세요.</>
                      ) : (
                        <>상단 툴바의 <strong>EMS 불러오기</strong>, <strong>엑셀 업로드</strong>로 데이터를 가져오거나 아래에서 수동으로 입력하세요.</>
                      )}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              rows.map(({ scope, row }) => {
                const dt = row.dataType ?? 'manual';
                const bgClass = DATA_TYPE_BG[dt] ?? 'bg-white';
                return (
                  <tr key={row.id} className={`border-b border-slate-100 ${bgClass}`}>
                    <td className="px-3 py-2 text-slate-700">{scope}</td>
                    <td className="px-3 py-2 text-slate-700">{row.year}</td>
                    <td className="px-3 py-2 text-slate-700">{row.month}월</td>
                    <td className="px-3 py-2 text-slate-700">{row.facility || '-'}</td>
                    <td className="px-3 py-2 text-slate-700">{row.energySource || '-'}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-900">{(row.amount ?? 0).toLocaleString()}</td>
                    <td className="px-3 py-2 text-slate-600">{row.unit || '-'}</td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${dt === 'ems' || dt === 'excel' ? 'bg-blue-100 text-blue-800' : 'bg-slate-200 text-slate-700'}`}>
                        {getSourceLabel(dt)}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

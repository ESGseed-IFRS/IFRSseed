'use client';

import { useMemo } from 'react';
import { Calculator } from 'lucide-react';
import { useGHGStore } from '../store/ghg.store';
import { EMISSION_FACTOR_DB } from '../utils/emissionFactors';

/**
 * Step 4: 배출량 산정 결과
 * IFRS_RESULT.md: 접기/펼치기 없이 한 화면 고정. 버튼 3개·펼침 패널 없음. IFRS 상세는 IFRS 감사대응 탭에서 표시.
 */
export function Step4Results() {
  const scope1 = useGHGStore((s) => s.scope1);
  const scope2 = useGHGStore((s) => s.scope2);
  const scope3 = useGHGStore((s) => s.scope3);
  const scope2Included = useGHGStore((s) => s.boundaryPolicy?.operationalBoundary?.scope2Included ?? '');
  const factorYear = useGHGStore((s) => s.factorYear);

  const { total, s1, s2, s3, s2Market, hasEstimated } = useMemo(() => {
    const s1Total =
      scope1.stationary.reduce((sum, r) => sum + (r.emissions || 0), 0) +
      scope1.mobile.reduce((sum, r) => sum + (r.emissions || 0), 0);
    const s2Location = scope2.electricity.reduce((sum, r) => sum + (r.emissions || 0), 0);
    const s3Total = scope3.categories.reduce(
      (sum, cat) => sum + cat.data.reduce((s, r) => s + (r.emissions || 0), 0),
      0
    );

    // 시장 기반 Scope2 전력: 위치기반에서 재생에너지 이행 실적 반영분 차감
    const factorTPerKwh = EMISSION_FACTOR_DB[factorYear].electricity.kr_national.factor;
    const totalKwh = scope2.electricity.reduce((s, r) => {
      const amt = typeof r.amount === 'number' ? r.amount : parseFloat(String(r.amount ?? 0)) || 0;
      return s + (r.unit === 'MWh' ? amt * 1000 : amt);
    }, 0);
    const rn = scope2.renewablePerformance;
    const renewableKwh = rn
      ? (rn.greenPremiumKwh || 0) + (rn.recKwh || 0) + (rn.ppaKwh || 0) + (rn.onsiteKwh || 0)
      : 0;
    const deductibleKwh = Math.min(renewableKwh, totalKwh);
    const s2MarketVal = Math.max(0, s2Location - deductibleKwh * factorTPerKwh);

    const total = s1Total + s2Location + s3Total;
    const hasEstimated =
      [...scope1.stationary, ...scope1.mobile, ...scope2.electricity].some(
        (r) => r.dataQuality?.dataType === 'estimated'
      );
    return { total, s1: s1Total, s2: s2Location, s3: s3Total, s2Market: s2MarketVal, hasEstimated };
  }, [scope1, scope2, scope3, factorYear]);

  const confidenceLevel = hasEstimated ? 'Medium (Level 2)' : 'High (Level 1)';
  const confidenceColor = hasEstimated ? 'text-amber-600' : 'text-emerald-600';

  return (
    <div className="text-center space-y-6 py-4">
      {/* SCOPE1,2_DETAIL §1: 전체 사업장 합계 — 사업장 필터와 무관하게 항상 전체 합계 표시 */}
      <div className="text-left border border-slate-200 bg-slate-50 px-4 py-3 rounded-none mb-4">
        <p className="text-xs font-bold uppercase text-slate-500">전체 사업장 합계</p>
        <p className="text-lg font-bold text-slate-900 tabular-nums">{total.toFixed(2)} tCO₂e</p>
        <p className="text-xs text-slate-600 mt-1">모든 사업장의 Scope 1·2·3 합계입니다. 개별 사업장 데이터는 위 데이터 관리 영역에서 조회하세요.</p>
      </div>

      <div>
        <h3 className="text-slate-500 font-medium">최종 산정 배출량</h3>
        <div className="text-5xl font-black text-slate-900 mt-2 tabular-nums">
          {total.toFixed(2)} <span className="text-2xl font-normal text-slate-400">tCO₂e</span>
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-4 pt-4">
        <div className="px-6 py-3 bg-slate-50 rounded-2xl border border-slate-200 min-w-[140px]">
          <span className="block text-xs text-slate-400 font-bold uppercase">데이터 신뢰도</span>
          <span className={`font-bold ${confidenceColor}`}>{confidenceLevel}</span>
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-6 text-sm text-slate-600 pt-2">
        <span>Scope 1: {s1.toFixed(2)} tCO₂e</span>
        <span>
          Scope 2: {s2.toFixed(2)} tCO₂e
          {(scope2Included.includes('위치') || scope2Included.includes('동시')) && (
            <span className="ml-1 text-xs">
              (위치 기반: {s2.toFixed(2)}
              {(scope2Included.includes('시장') || scope2Included.includes('동시')) && <> · 시장 기반: {s2Market.toFixed(2)}</>})
            </span>
          )}
        </span>
        <span>Scope 3: {s3.toFixed(2)} tCO₂e</span>
      </div>
    </div>
  );
}

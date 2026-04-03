'use client';

import { useGHGStore } from '../store/ghg.store';
import { SCOPE1_METHODOLOGY, SCOPE2_ELECTRICITY_METHODOLOGY } from './MethodologyDetailPanel';

/**
 * IFRS_RESULT.md §0C: 적용 배출계수·산식 안내. 목적 명확, GPT 톤 제거, 표/본문으로 산식 표시.
 */
export function Step3Methodology() {
  const factorYear = useGHGStore((s) => s.factorYear);

  return (
    <div className="p-6 rounded-none border border-slate-200 bg-slate-50/50 space-y-4">
      <h4 className="font-bold text-slate-900">본 산정에 적용된 배출계수 및 산식</h4>
      <p className="text-sm text-slate-600">아래 계수·산식은 현재 산정에 적용된 기준입니다. 감사·검증 시 참고용으로 활용하세요.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-none border border-slate-200">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">배출계수 (Emission Factor)</span>
          <p className="text-sm font-semibold mt-1 text-slate-900">{SCOPE1_METHODOLOGY.efSource}</p>
          <p className="text-xs text-emerald-600 mt-1">{SCOPE1_METHODOLOGY.version}</p>
        </div>
        <div className="bg-white p-4 rounded-none border border-slate-200">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">지구온난화지수 (GWP)</span>
          <p className="text-sm font-semibold mt-1 text-slate-900">{SCOPE1_METHODOLOGY.gwp}</p>
          <p className="text-xs text-slate-500">100-year Horizon</p>
        </div>
      </div>

      <table className="w-full border border-slate-200 text-sm text-left bg-white">
        <tbody>
          <tr className="border-b border-slate-200">
            <td className="py-2 px-3 font-medium text-slate-500 w-36">Scope 1</td>
            <td className="py-2 px-3 text-slate-700">{SCOPE1_METHODOLOGY.formula}</td>
          </tr>
          <tr>
            <td className="py-2 px-3 font-medium text-slate-500">Scope 2 전력</td>
            <td className="py-2 px-3 text-slate-700">{SCOPE2_ELECTRICITY_METHODOLOGY.formula}</td>
          </tr>
        </tbody>
      </table>

      <p className="text-xs text-slate-500">
        적용 연도: {factorYear} KR Emission Factors. 연료·전력 종류에 따라 위 계수가 적용됩니다.
      </p>
    </div>
  );
}

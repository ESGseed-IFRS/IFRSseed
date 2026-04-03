'use client';

import { useGHGStore } from '../../store/ghg.store';
import { ExternalLink } from 'lucide-react';

/** GHG_AUDIT_TAB_DESIGN_v2 §4.1: 데이터 계보 추적 — Scope별 트리 드릴다운 */

export function LineageDrillDownView({
  focusItemId,
  onGoToInput,
}: {
  focusItemId?: string;
  onGoToInput?: (tab: string) => void;
}) {
  const scope1 = useGHGStore((s) => s.scope1);
  const scope2 = useGHGStore((s) => s.scope2);
  const boundaryPolicy = useGHGStore((s) => s.boundaryPolicy);

  const s1Stationary = scope1.stationary.reduce((s, r) => s + (r.emissions || 0), 0);
  const s1Mobile = scope1.mobile.reduce((s, r) => s + (r.emissions || 0), 0);
  const scope1Total = s1Stationary + s1Mobile;
  const scope2Total = scope2.electricity.reduce((s, r) => s + (r.emissions || 0), 0);
  const efVersion = boundaryPolicy?.efDbVersion ?? '환경부 국가 배출계수';
  const year = boundaryPolicy?.reportingYear ?? new Date().getFullYear();

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-slate-900">데이터 계보 추적</h2>
      <p className="text-base text-slate-600">
        요건 체크리스트 [↗] 클릭 시 해당 항목의 원천 레코드·배출계수·산식을 확인합니다.
      </p>

      <div className="rounded-lg border border-slate-200 bg-white p-6 font-mono text-sm">
        <div className="font-semibold text-slate-900 mb-4">
          Scope 1 배출량: {scope1Total > 0 ? scope1Total.toFixed(0) : '0'} tCO₂e (IFRS S2 §29 충족)
        </div>
        <ul className="space-y-4 text-slate-700">
          {s1Stationary > 0 && (
            <li>
              <div className="font-medium text-slate-800">├── 고정연소: {s1Stationary.toFixed(1)} tCO₂e</div>
              <ul className="ml-4 mt-1 space-y-0.5 text-slate-600">
                <li>├── 원천 탭: 연료·차량 탭 {onGoToInput && (
                  <button type="button" onClick={() => onGoToInput('fuel')} className="text-primary hover:underline inline-flex items-center gap-1">
                    [바로가기↗] <ExternalLink className="h-3 w-3" />
                  </button>
                )}</li>
                <li>├── 배출계수: {efVersion}</li>
                <li>└── 산식: consumption_amount × emission_factor × GWP</li>
              </ul>
            </li>
          )}
          {s1Mobile > 0 && (
            <li>
              <div className="font-medium text-slate-800">├── 이동연소: {s1Mobile.toFixed(1)} tCO₂e</div>
              <ul className="ml-4 mt-1 space-y-0.5 text-slate-600">
                <li>└── 배출계수: {efVersion}</li>
              </ul>
            </li>
          )}
          {scope1Total === 0 && (
            <li className="text-slate-500">활동자료가 없습니다. 연료·차량 탭에서 데이터를 입력하세요.</li>
          )}
        </ul>

        <div className="font-semibold text-slate-900 mt-6 mb-2">
          Scope 2 전력: {scope2Total > 0 ? scope2Total.toFixed(0) : '0'} tCO₂e
        </div>
        <ul className="space-y-1 text-slate-600">
          {scope2Total > 0 ? (
            <>
              <li>├── 원천 탭: 전력·열·스팀 탭 {onGoToInput && (
                <button type="button" onClick={() => onGoToInput('power')} className="text-primary hover:underline inline-flex items-center gap-1">
                  [바로가기↗] <ExternalLink className="h-3 w-3" />
                </button>
              )}</li>
              <li>├── 배출계수: {efVersion}</li>
              <li>└── 산식: kWh × grid_emission_factor</li>
            </>
          ) : (
            <li className="text-slate-500">활동자료가 없습니다. 전력·열·스팀 탭에서 데이터를 입력하세요.</li>
          )}
        </ul>

        <p className="mt-6 text-xs text-slate-500">
          산정 v1 | {year}년 | {boundaryPolicy?.organizationBoundary === 'operational_control' ? '운영통제법' : '지분법'}
        </p>
      </div>
    </div>
  );
}

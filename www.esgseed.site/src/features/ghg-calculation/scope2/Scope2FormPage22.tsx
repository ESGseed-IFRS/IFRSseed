'use client';

import type { ChangeEvent } from 'react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import type { EmissionData, KdhcBranchKey, Scope2FormData, Scope2HeatRow, RenewablePerformance } from '../types/ghg.types';
import { useGHGStore } from '../store/ghg.store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { calcHeatKDHC, calcHeatStandard, calcScope2Electricity, EMISSION_FACTOR_DB } from '../utils/emissionFactors';
import { EnergySourceMonthTable } from '../components/EnergySourceMonthTable';

type Props = {
  formData: Scope2FormData;
  onDataChange: (data: Scope2FormData) => void;
  facilities: string[];
  selectedYear?: number;
  /** GHG_UI_Strategy_v2: 사이드바에서 선택한 사업장 */
  selectedFacilities?: string[];
  /** SIDBAR_CONNECT: 사이드바에서 선택한 에너지원 (빈 배열이면 전체) */
  selectedEnergySources?: string[];
  periodType?: 'monthly' | 'quarterly' | 'yearly';
  /** STEP_DETAIL: 서브탭 선택 시 해당 섹션만 표시 */
  activeSubTab?: 'electricity' | 'heat';
  /** STEP_DETAIL: RAW vs 탄소 배출량 화면 */
  dataViewMode?: 'raw' | 'emission';
  /** STEP_DETAIL: 조회 버튼 클릭으로 필터가 적용되었는지 */
  filtersApplied?: boolean;
};

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

const KDHC_BRANCH_OPTIONS: { value: KdhcBranchKey; label: string }[] = [
  { value: 'metropolitan_link', label: '수도권연계지사' },
  { value: 'cheongju', label: '청주지사' },
  { value: 'sejong', label: '세종지사' },
  { value: 'daegu', label: '대구지사' },
  { value: 'yangsan', label: '양산지사' },
  { value: 'gimhae', label: '김해지사' },
  { value: 'gwangju_jeonnam', label: '광주전남지사' },
  { value: 'pyeongtaek', label: '평택지사' },
];

function safeNumber(v: any) {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : 0;
}

type SavedScope2Run = {
  id: string;
  createdAt: number;
  year: number;
  totalTco2e: number;
  breakdown: { electricity: number; heat: number };
  byMonthFacility: Record<string, number>;
};

function buildMonthFacilityTable(rows: EmissionData[]) {
  const map: Record<string, number> = {};
  for (const r of rows) {
    const m = r.month || 0;
    const f = r.facility || '';
    const key = `${m}@@${f}`;
    map[key] = (map[key] || 0) + (r.emissions || 0);
  }
  return map;
}

const DEFAULT_RENEWABLE: RenewablePerformance = { greenPremiumKwh: 0, recKwh: 0, ppaKwh: 0, onsiteKwh: 0 };

const SCOPE2_ENERGY_LABELS: Record<string, string> = { 전력: '전력', '열/스팀/온수': '열/스팀/온수' };
/** Scope2 전력 탭용 에너지원 키 (테이블 전체 행·합계용) */
const SCOPE2_ELECTRICITY_KEYS = ['전력'];

export function Scope2FormPage22({
  formData,
  onDataChange,
  facilities,
  selectedYear = new Date().getFullYear(),
  selectedFacilities = [],
  selectedEnergySources = [] as string[],
  periodType = 'monthly',
  activeSubTab,
  dataViewMode = 'raw',
  filtersApplied = true,
}: Props) {
  const factorYear = useGHGStore((s) => s.factorYear);
  const boundaryPolicy = useGHGStore((s) => s.boundaryPolicy);
  const [savedRuns, setSavedRuns] = useState<SavedScope2Run[]>([]);
  const stepFromSubTab = activeSubTab === 'heat' ? 3 : activeSubTab === 'electricity' ? 1 : 1;
  const [internalStep, setInternalStep] = useState<1 | 2 | 3>(1);
  const step = activeSubTab !== undefined ? stepFromSubTab : internalStep;

  const scope2Included = boundaryPolicy.operationalBoundary?.scope2Included ?? '';
  const showRenewable = scope2Included.includes('시장 기반') || scope2Included.includes('동시 산정');
  const renewable = formData.renewablePerformance ?? DEFAULT_RENEWABLE;
  const updateRenewable = (patch: Partial<RenewablePerformance>) => {
    onDataChange({ ...formData, renewablePerformance: { ...renewable, ...patch } });
  };

  const heatComputed = useMemo(() => {
    return formData.heat.map((row) => {
      if (row.kind === 'standard') {
        const factorTPerGJ =
          row.factorMode === 'manual'
            ? row.manualFactorUnit === 'kg_per_TJ'
              ? (row.manualFactor || 0) / 1_000_000 // kg/TJ -> t/GJ
              : (row.manualFactor || 0) // t/GJ
            : EMISSION_FACTOR_DB[factorYear].heat[row.source].factor;
        return calcHeatStandard(safeNumber(row.amount), row.amountUnit, factorTPerGJ);
      }
      return calcHeatKDHC({
        year: row.year,
        branch: row.branch,
        amount: safeNumber(row.amount),
        unit: row.unit,
        gwpPreset: row.gwpPreset,
        customGwpCh4: row.customGwpCh4,
        customGwpN2o: row.customGwpN2o,
      }).tCo2e;
    });
  }, [formData.heat, factorYear]);

  const totals = useMemo(() => {
    const electricity = formData.electricity.reduce((s, r) => s + (r.emissions || 0), 0);
    const heat = heatComputed.reduce((s, v) => s + (v || 0), 0);
    const total = electricity + heat;

    // 시장 기반: 전력 위치기반 배출량에서 재생에너지 이행 실적(kWh) 반영분을 차감
    const factorTPerKwh = EMISSION_FACTOR_DB[factorYear].electricity.kr_national.factor;
    const totalKwh = formData.electricity.reduce((s, r) => {
      const amt = safeNumber(r.amount);
      return s + ((r.unit === 'MWh' ? amt * 1000 : amt) || 0);
    }, 0);
    const rn = formData.renewablePerformance ?? DEFAULT_RENEWABLE;
    const renewableKwh = (rn.greenPremiumKwh || 0) + (rn.recKwh || 0) + (rn.ppaKwh || 0) + (rn.onsiteKwh || 0);
    const deductibleKwh = Math.min(renewableKwh, totalKwh);
    const marketBasedElectricity = Math.max(0, electricity - deductibleKwh * factorTPerKwh);
    const marketBasedTotal = marketBasedElectricity + heat;

    return {
      electricity,
      heat,
      total,
      locationBasedTotal: total,
      marketBasedElectricity,
      marketBasedTotal,
    };
  }, [formData.electricity, formData.renewablePerformance, heatComputed, factorYear]);

  const saveRun = () => {
    const byMonthFacility = buildMonthFacilityTable(formData.electricity);
    const run: SavedScope2Run = {
      id: `s2-run-${Date.now()}`,
      createdAt: Date.now(),
      year: selectedYear,
      totalTco2e: totals.total,
      breakdown: { electricity: totals.electricity, heat: totals.heat },
      byMonthFacility,
    };
    setSavedRuns((prev) => [run, ...prev].slice(0, 12));
  };

  const addElectricityRow = () => {
    const now = Date.now();
    const row: EmissionData = {
      id: `s2-elec-${now}`,
      year: selectedYear,
      month: new Date().getMonth() + 1,
      facility: facilities[0] || '',
      energySource: '전력',
      amount: 0,
      unit: 'kWh',
      emissions: 0,
      createdAt: new Date(),
    };
    onDataChange({ ...formData, electricity: [...formData.electricity, row] });
  };

  const updateElectricity = (id: string, patch: Partial<EmissionData>) => {
    const next = formData.electricity.map((r) => {
      if (r.id !== id) return r;
      const updated: EmissionData = { ...r, ...patch, energySource: '전력' };
      const unit = (updated.unit as 'kWh' | 'MWh') || 'kWh';
      updated.emissions = calcScope2Electricity(safeNumber(updated.amount), unit, 'kr_national', factorYear);
      return updated;
    });
    onDataChange({ ...formData, electricity: next });
  };

  const removeElectricity = (id: string) => onDataChange({ ...formData, electricity: formData.electricity.filter((r) => r.id !== id) });

  const addHeatStandard = () => {
    const row: Scope2HeatRow = { kind: 'standard', source: 'provider_avg', amount: 0, amountUnit: 'GJ', factorMode: 'preset' };
    onDataChange({ ...formData, heat: [...formData.heat, row] });
  };

  const addHeatKDHC = () => {
    const row: Scope2HeatRow = { kind: 'kdhc', year: '2024', branch: 'metropolitan_link', amount: 0, unit: 'GJ', gwpPreset: 'AR6_fossil' };
    onDataChange({ ...formData, heat: [...formData.heat, row] });
  };

  const updateHeat = (index: number, patch: Partial<Scope2HeatRow>) => {
    const next = formData.heat.map((r, i) => (i === index ? ({ ...r, ...patch } as Scope2HeatRow) : r));
    onDataChange({ ...formData, heat: next });
  };

  const removeHeat = (index: number) => onDataChange({ ...formData, heat: formData.heat.filter((_, i) => i !== index) });

  const elecFactor = EMISSION_FACTOR_DB[factorYear].electricity.kr_national;

  return (
    <div className="space-y-8">
      {/* SCOPE1,2_DETAIL §3: 현재 산정(위치/시장) 항상 노출 */}
      <div className="rounded-none border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700">
        <span className="font-semibold">현재 산정:</span>{' '}
        {scope2Included || '위치 기반 & 시장 기반 동시 산정'}
      </div>

      {/* Summary bar */}
      <div className="border border-[#669900] bg-white px-6 py-5">
        <div className="grid grid-cols-3 gap-6">
          <div>
            <div className="text-xs font-semibold text-slate-600">전력</div>
            <div className="mt-1 text-xl font-bold text-slate-900 tabular-nums">{totals.electricity.toFixed(3)}</div>
            <div className="text-xs text-slate-600">tCO2e</div>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-600">열/스팀/온수</div>
            <div className="mt-1 text-xl font-bold text-slate-900 tabular-nums">{totals.heat.toFixed(3)}</div>
            <div className="text-xs text-slate-600">tCO2e</div>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-600">SCOPE 2 총계</div>
            <div className="mt-1 text-xl font-bold text-slate-900 tabular-nums">{totals.total.toFixed(3)}</div>
            <div className="text-xs text-slate-600">tCO2e</div>
          </div>
        </div>
      </div>

      {/* Result + Save (Page22 스타일) */}
      <div className="pt-2">
        <div className="mt-2 pt-6 border-t border-slate-200">
          <div className="flex justify-between items-end">
            <span className="text-base font-black">Scope2 Result</span>
            <div className="flex items-center gap-3">
              <span className="text-2xl font-black">
                {totals.total.toFixed(2)} <span className="text-sm font-normal">tCO2e</span>
              </span>
              <button
                type="button"
                onClick={saveRun}
                className="px-4 py-2 text-sm font-semibold  bg-[#669900] text-white shadow-md hover:bg-slate-800 transition-colors"
              >
                결과 저장
              </button>
            </div>
          </div>
          <div className="mt-2 text-sm text-slate-700">
            전력 <span className="font-black tabular-nums">{totals.electricity.toFixed(3)}</span> · 열/스팀/온수{' '}
            <span className="font-black tabular-nums">{totals.heat.toFixed(3)}</span>
          </div>
          {/* SCOPE1,2_DETAIL §3: 위치 기반 / 시장 기반 tCO₂e 각각 표시 (동시 산정 시 둘 다) */}
          {(scope2Included.includes('위치') || scope2Included.includes('동시')) && (
            <p className="mt-1 text-xs text-slate-600">
              위치 기반: <span className="font-semibold tabular-nums">{totals.locationBasedTotal.toFixed(3)}</span> tCO₂e
              {(scope2Included.includes('시장') || scope2Included.includes('동시')) && (
                <> · 시장 기반: <span className="font-semibold tabular-nums">{totals.marketBasedTotal.toFixed(3)}</span> tCO₂e (재생에너지 이행 실적 입력 시 차감 반영)</>
              )}
            </p>
          )}
        </div>
      </div>

      {/* 에너지원/월별 테이블 — STEP_DETAIL: 조회 미적용 시 안내, RAW vs 탄소 배출량 */}
      <div className="mt-4">
        {!filtersApplied ? (
          <div className="border-2 border-dashed border-slate-300 bg-slate-50 rounded-none p-12 text-center text-slate-600">
            <p className="text-base font-semibold mb-2">조회를 클릭하여 데이터를 확인하세요</p>
            <p className="text-sm">사이드바에서 사업장·에너지원·연도·기간을 선택한 후 <strong>[조회]</strong> 버튼을 클릭하면 그리드에 데이터가 표시됩니다.</p>
          </div>
        ) : (
          <EnergySourceMonthTable
            rows={activeSubTab === 'heat' ? [] : formData.electricity}
            energySourceLabels={SCOPE2_ENERGY_LABELS}
            selectedFacilities={selectedFacilities}
            selectedEnergySources={selectedEnergySources}
            allEnergySourceKeys={activeSubTab === 'electricity' ? SCOPE2_ELECTRICITY_KEYS : undefined}
            year={selectedYear}
            periodType={periodType}
            viewMode={dataViewMode}
          />
        )}
      </div>

      {/* 저장된 산정값 */}
      <div className="mt-4">
        <div className="border border-slate-200 bg-white p-5 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-lg font-black">저장된 산정값 (Scope 2)</div>
            <button
              type="button"
              onClick={() => setSavedRuns([])}
              className="px-3 py-1.5 text-sm font-semibold border border-slate-200 bg-white hover:bg-slate-50 transition-colors disabled:opacity-40"
              disabled={savedRuns.length === 0}
            >
              전체 삭제
            </button>
          </div>
          {savedRuns.length === 0 ? (
            <div className="text-base">
              아직 저장된 산정값이 없습니다. 위에서 <span className="font-black">“결과 저장”</span>을 눌러 기록을 남겨보세요.
            </div>
          ) : (
            <div className="space-y-2">
              {savedRuns.slice(0, 6).map((r) => (
                <div key={r.id} className="border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-base">{new Date(r.createdAt).toLocaleString()} · {r.year}</div>
                    <button
                      type="button"
                      onClick={() => setSavedRuns((prev) => prev.filter((x) => x.id !== r.id))}
                      className="px-3 py-1.5 text-sm font-semibold border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
                    >
                      삭제
                    </button>
                  </div>
                  <div className="mt-2 text-base">
                    총 배출량: <span className="font-black tabular-nums">{r.totalTco2e.toFixed(4)}</span> tCO2e
                  </div>
                  <div className="mt-1 text-base">
                    전력 <span className="font-black tabular-nums">{r.breakdown.electricity.toFixed(4)}</span> · 열/스팀/온수{' '}
                    <span className="font-black tabular-nums">{r.breakdown.heat.toFixed(4)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 단계별 입력 — GHG_UI_Strategy_v2 / STEP_DETAIL: activeSubTab 제공 시 버튼 숨김 */}
      <div className="mt-6 pt-6 border-t border-slate-200">
        {activeSubTab === undefined && (
          <div className="flex items-center gap-2 mb-4">
            <button
              type="button"
              onClick={() => setInternalStep(1)}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${step === 1 ? 'bg-[#669900] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              ① 구매 전기
            </button>
            <button
              type="button"
              onClick={() => setInternalStep(2)}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${step === 2 ? 'bg-[#669900] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              ② 재생에너지 이행
            </button>
            <button
              type="button"
              onClick={() => setInternalStep(3)}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${step === 3 ? 'bg-[#669900] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              ③ 열/스팀/온수
            </button>
          </div>
        )}

      {/* Step 1: Electricity */}
      {step === 1 && (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-base font-semibold text-slate-900">구매 전기 (필수)</div>
          <button
            type="button"
            onClick={addElectricityRow}
            className="text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 px-4 py-2 transition-colors"
          >
            행 추가
          </button>
        </div>

        <div className="space-y-3">
          {formData.electricity.map((row) => (
            <div key={row.id} className="space-y-2">
              <div className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-2">
                  <select
                    value={row.month}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) => updateElectricity(row.id, { month: parseInt(e.target.value, 10) })}
                    className="w-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-slate-400"
                  >
                    {MONTHS.map((m) => (
                      <option key={m} value={m}>
                        {m}월
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-4">
                  <select
                    value={row.facility}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) => updateElectricity(row.id, { facility: e.target.value })}
                    className="w-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-slate-400"
                  >
                    {facilities.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-3">
                  <input
                    value={row.amount === 0 ? '' : row.amount}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => updateElectricity(row.id, { amount: safeNumber(e.target.value) })}
                    className="w-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-slate-400"
                    placeholder="0"
                    inputMode="decimal"
                  />
                </div>
                <div className="col-span-2">
                  <select
                    value={(row.unit as 'kWh' | 'MWh') || 'kWh'}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) => updateElectricity(row.id, { unit: e.target.value })}
                    className="w-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-slate-400"
                  >
                    <option value="kWh">kWh</option>
                    <option value="MWh">MWh</option>
                  </select>
                </div>
                <div className="col-span-1 text-right text-xs font-semibold text-slate-600">tCO2e</div>
              </div>

              <div className="border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                <div className="flex flex-wrap gap-x-2 gap-y-1 items-center">
                  <span className="text-slate-700 font-semibold">계수(적용)</span>
                  <span className="text-orange-600 font-bold">{(elecFactor.factor * 1_000_000).toFixed(1)}</span>
                  <span className="text-slate-600">kgCO2e/MWh</span>
                  <span className="text-slate-400">|</span>
                  <span className="text-orange-600 font-bold">{elecFactor.factor.toFixed(7)}</span>
                  <span className="text-slate-600">tCO2e/kWh</span>
                  <span className="text-slate-400">|</span>
                  <span className="text-slate-700 font-semibold">월 배출량</span>
                  <span className="text-orange-600 font-bold">{(row.emissions || 0).toFixed(3)}</span>
                  <span className="text-slate-600">tCO2e</span>
                </div>
                {elecFactor.note && <div className="mt-2 text-xs text-slate-600">비고: {elecFactor.note}</div>}
              </div>

              <div className="flex justify-end">
                <Button variant="ghost" size="sm" onClick={() => removeElectricity(row.id)} className="text-red-600 hover:text-red-700">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* 구매 전기 바로 아래: 재생에너지 이행 실적 입력 (시장 기반 차감 반영) */}
        {showRenewable && (
          <Card className="mt-6 border-emerald-200 bg-emerald-50/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-800">재생에너지 이행 실적 (시장 기반 산정)</CardTitle>
              <CardDescription className="text-xs">
                K-ETS 명세서에는 일부만 반영되며, RE100/시장 기반 산정 시 배출량 차감에 사용됩니다. 합산값이 전력 사용량을 넘지 않도록 자동 반영됩니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs font-medium">녹색프리미엄 (kWh)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={renewable.greenPremiumKwh || ''}
                    onChange={(e) => updateRenewable({ greenPremiumKwh: parseFloat(e.target.value) || 0 })}
                    placeholder="0"
                    className="rounded-lg border-slate-200"
                  />
                  <p className="text-[10px] text-slate-500">K-ETS 미반영, RE100 시 0kg 처리</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium">REC 구매 (kWh)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={renewable.recKwh || ''}
                    onChange={(e) => updateRenewable({ recKwh: parseFloat(e.target.value) || 0 })}
                    placeholder="0"
                    className="rounded-lg border-slate-200"
                  />
                  <p className="text-[10px] text-slate-500">K-ETS·RE100 감축 실적 반영</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium">PPA 제3자/직접 (kWh)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={renewable.ppaKwh || ''}
                    onChange={(e) => updateRenewable({ ppaKwh: parseFloat(e.target.value) || 0 })}
                    placeholder="0"
                    className="rounded-lg border-slate-200"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-medium">자가발전 On-site (kWh)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={renewable.onsiteKwh || ''}
                    onChange={(e) => updateRenewable({ onsiteKwh: parseFloat(e.target.value) || 0 })}
                    placeholder="0"
                    className="rounded-lg border-slate-200"
                  />
                  <p className="text-[10px] text-slate-500">소비량 중 자가 소비분 차감</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      )}

      {/* Step 2: 재생에너지 이행 실적 */}
      {step === 2 && showRenewable && (
        <Card className="border-emerald-200 bg-emerald-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold text-slate-800">재생에너지 이행 실적 (시장 기반 산정)</CardTitle>
            <CardDescription className="text-xs">
              K-ETS 명세서에는 일부만 반영되며, RE100/시장 기반 산정 시 배출량 차감에 사용됩니다.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs font-medium">녹색프리미엄 (kWh)</Label>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={renewable.greenPremiumKwh || ''}
                  onChange={(e) => updateRenewable({ greenPremiumKwh: parseFloat(e.target.value) || 0 })}
                  placeholder="0"
                  className="rounded-lg border-slate-200"
                />
                <p className="text-[10px] text-slate-500">K-ETS 미반영, RE100 시 0kg 처리</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">REC 구매 (kWh)</Label>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={renewable.recKwh || ''}
                  onChange={(e) => updateRenewable({ recKwh: parseFloat(e.target.value) || 0 })}
                  placeholder="0"
                  className="rounded-lg border-slate-200"
                />
                <p className="text-[10px] text-slate-500">K-ETS·RE100 감축 실적 반영</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">PPA 제3자/직접 (kWh)</Label>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={renewable.ppaKwh || ''}
                  onChange={(e) => updateRenewable({ ppaKwh: parseFloat(e.target.value) || 0 })}
                  placeholder="0"
                  className="rounded-lg border-slate-200"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">자가발전 On-site (kWh)</Label>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  value={renewable.onsiteKwh || ''}
                  onChange={(e) => updateRenewable({ onsiteKwh: parseFloat(e.target.value) || 0 })}
                  placeholder="0"
                  className="rounded-lg border-slate-200"
                />
                <p className="text-[10px] text-slate-500">소비량 중 자가 소비분 차감</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200">
              <div className="space-y-1">
                <Label className="text-xs font-medium">EAC 인증서 번호 (선택)</Label>
                <Input
                  value={renewable.eacCertificateNo ?? ''}
                  onChange={(e) => updateRenewable({ eacCertificateNo: e.target.value || undefined })}
                  placeholder="2027 RE100 대비"
                  className="rounded-lg border-slate-200"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">EAC 유효기간 (선택)</Label>
                <Input
                  type="text"
                  value={renewable.eacValidUntil ?? ''}
                  onChange={(e) => updateRenewable({ eacValidUntil: e.target.value || undefined })}
                  placeholder="YYYY-MM-DD"
                  className="rounded-lg border-slate-200"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      {step === 2 && !showRenewable && (
        <div className="border border-slate-200 bg-slate-50 p-6 text-slate-600 text-sm">
          시장 기반 산정 또는 위치·시장 동시 산정을 선택한 경우에만 재생에너지 이행 실적을 입력할 수 있습니다.
        </div>
      )}

      {/* Step 3: Heat/Steam/HotWater */}
      {step === 3 && (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-base font-semibold text-slate-900">구매 열/스팀/온수 (선택)</div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={addHeatStandard}
              className="text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 px-4 py-2 transition-colors"
            >
              표준 추가
            </button>
            <button
              type="button"
              onClick={addHeatKDHC}
              className="text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 px-4 py-2 transition-colors"
            >
              KDHC 추가
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {formData.heat.length === 0 ? (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              입력된 데이터가 없습니다. [EMS 불러오기] 또는 [엑셀 업로드]로 가져오거나, [표준 추가 / KDHC 추가]로 직접 입력하세요. “표준 추가 / KDHC 추가”로 입력하세요.
            </div>
          ) : (
            formData.heat.map((row, idx) => {
              const computed = heatComputed[idx] || 0;
              return (
                <div key={idx} className="border border-slate-200 bg-white p-5 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="text-sm font-bold text-slate-900">{row.kind === 'kdhc' ? 'KDHC' : '표준'} 항목</div>
                    <Button variant="ghost" size="sm" onClick={() => removeHeat(idx)} className="text-red-600 hover:text-red-700">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {row.kind === 'standard' ? (
                    <div className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-4">
                        <select
                          value={row.source}
                          onChange={(e: ChangeEvent<HTMLSelectElement>) => updateHeat(idx, { source: e.target.value as any })}
                          className="w-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-slate-400"
                        >
                          <option value="provider_avg">공급자 평균값(권장)</option>
                          <option value="national_default">국가고유/IPCC default</option>
                          <option value="lci_db">LCI DB/IPCC 2006</option>
                        </select>
                      </div>
                      <div className="col-span-4">
                        <input
                          value={row.amount === 0 ? '' : row.amount}
                          onChange={(e: ChangeEvent<HTMLInputElement>) => updateHeat(idx, { amount: safeNumber(e.target.value) } as any)}
                          className="w-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-slate-400"
                          placeholder="0"
                          inputMode="decimal"
                        />
                      </div>
                      <div className="col-span-2">
                        <select
                          value={row.amountUnit}
                          onChange={(e: ChangeEvent<HTMLSelectElement>) => updateHeat(idx, { amountUnit: e.target.value as any } as any)}
                          className="w-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-slate-400"
                        >
                          <option value="GJ">GJ</option>
                          <option value="TJ">TJ</option>
                        </select>
                      </div>
                      <div className="col-span-2 text-right text-sm font-bold text-slate-900 tabular-nums">
                        {computed.toFixed(3)} <span className="text-xs font-normal text-slate-600">tCO2e</span>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-4">
                        <select
                          value={row.branch}
                          onChange={(e: ChangeEvent<HTMLSelectElement>) => updateHeat(idx, { branch: e.target.value as KdhcBranchKey } as any)}
                          className="w-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-slate-400"
                        >
                          {KDHC_BRANCH_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-4">
                        <input
                          value={row.amount === 0 ? '' : row.amount}
                          onChange={(e: ChangeEvent<HTMLInputElement>) => updateHeat(idx, { amount: safeNumber(e.target.value) } as any)}
                          className="w-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-slate-400"
                          placeholder="0"
                          inputMode="decimal"
                        />
                      </div>
                      <div className="col-span-2">
                        <select
                          value={row.unit}
                          onChange={(e: ChangeEvent<HTMLSelectElement>) => updateHeat(idx, { unit: e.target.value as any } as any)}
                          className="w-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-slate-400"
                        >
                          <option value="GJ">GJ</option>
                          <option value="TJ">TJ</option>
                        </select>
                      </div>
                      <div className="col-span-2 text-right text-sm font-bold text-slate-900 tabular-nums">
                        {computed.toFixed(3)} <span className="text-xs font-normal text-slate-600">tCO2e</span>
                      </div>
                    </div>
                  )}

                  <div className="border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                    계산 결과는 입력값과 계수 기준 연도({factorYear})에 따라 자동 반영됩니다.
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
      )}
      </div>
    </div>
  );
}


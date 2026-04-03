'use client';

import type { ChangeEvent } from 'react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import type { DataQuality, DataQualityType, EmissionData, MobileFuelKey, Scope1FormData, StationaryFuelKey } from '../types/ghg.types';
import { calcScope1Mobile, calcScope1Stationary, EMISSION_FACTOR_DB } from '../utils/emissionFactors';
import { useGHGStore } from '../store/ghg.store';
import { EnergySourceMonthTable } from '../components/EnergySourceMonthTable';
import { CellEditModal } from '../components/CellEditModal';

type Props = {
  formData: Scope1FormData;
  onDataChange: (data: Scope1FormData) => void;
  facilities: string[];
  selectedYear?: number;
  /** GHG_UI_Strategy_v2: 사이드바에서 선택한 사업장 */
  selectedFacilities?: string[];
  /** SIDBAR_CONNECT: 사이드바에서 선택한 에너지원 (빈 배열이면 전체) */
  selectedEnergySources?: string[];
  periodType?: 'monthly' | 'quarterly' | 'yearly';
  /** STEP_DETAIL: 서브탭 선택 시 해당 섹션만 표시 */
  activeSubTab?: 'stationary' | 'mobile';
  /** STEP_DETAIL: RAW vs 탄소 배출량 화면 */
  dataViewMode?: 'raw' | 'emission';
  /** STEP_DETAIL: 조회 버튼 클릭으로 필터가 적용되었는지 */
  filtersApplied?: boolean;
  /** SCOPE1,2_DETAIL §0: 위저드 2단계=입력만, 3단계=결과·저장만 */
  wizardStepMode?: 2 | 3;
};

const STATIONARY_OPTIONS: Array<{ value: StationaryFuelKey; label: string; unit: string }> = [
  { value: 'lng', label: '도시가스(LNG)', unit: 'Nm³' },
  { value: 'diesel', label: '경유', unit: 'L' },
  { value: 'gasoline', label: '휘발유', unit: 'L' },
  { value: 'lpg', label: 'LPG', unit: 'kg' },
  { value: 'bunkerC', label: '벙커유(중유)', unit: 'ton' },
  { value: 'anthracite', label: '무연탄', unit: 'ton' },
];

const MOBILE_OPTIONS: Array<{ value: MobileFuelKey; label: string; unit: string }> = [
  { value: 'diesel', label: '경유(차량)', unit: 'L' },
  { value: 'gasoline', label: '휘발유(차량)', unit: 'L' },
];

/** GHG_Strategy2.md: 데이터 품질 선택 (사용자가 선택) */
const DATA_QUALITY_OPTIONS: { value: DataQualityType; label: string }[] = [
  { value: 'measured', label: '실측 (Primary Data - 고지서/계량기)' },
  { value: 'estimated', label: '추정 (Estimated Data - 산출식 적용)' },
  { value: 'supplier', label: '공급자 제공 (Supplier-specific)' },
  { value: 'other', label: '기타' },
];
const ESTIMATION_METHOD_OPTIONS = [
  { value: '과거 데이터 평균', label: '전년 동기 평균값 적용' },
  { value: '면적당 원단위', label: '사업장 면적당 에너지 사용량 원단위' },
  { value: '산업 평균', label: '산업군 평균 벤치마크' },
];

function monthOptions() {
  return Array.from({ length: 12 }, (_, i) => i + 1);
}

function safeNumber(v: any) {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : 0;
}

type SavedScope1Run = {
  id: string;
  createdAt: number;
  year: number;
  totalTco2e: number;
  breakdown: { stationary: number; mobile: number };
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

const ENERGY_LABELS: Record<string, string> = {
  lng: '도시가스(LNG)', diesel: '경유', gasoline: '휘발유', lpg: 'LPG', bunkerC: '벙커유(중유)', anthracite: '무연탄',
};

export function Scope1FormPage22({
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
  wizardStepMode,
}: Props) {
  const showOnlyInput = wizardStepMode === 2;
  const showOnlyResultAndSaved = wizardStepMode === 3;
  const factorYear = useGHGStore((s) => s.factorYear);
  const [savedRuns, setSavedRuns] = useState<SavedScope1Run[]>([]);
  const [cellEdit, setCellEdit] = useState<{ energySource: string; month: number; value: number; dataType?: string } | null>(null);
  const stepFromSubTab = activeSubTab === 'mobile' ? 2 : 1;
  const [internalStep, setInternalStep] = useState<1 | 2>(1);
  const step = activeSubTab !== undefined ? stepFromSubTab : internalStep;
  /** 연료 사용량 입력 시 즉시 표시용 (rowId -> 입력 중인 문자열). 블러 시 스토어 반영 후 제거 */
  const [editingAmount, setEditingAmount] = useState<Record<string, string>>({});

  const totals = useMemo(() => {
    const stationary = formData.stationary.reduce((s, r) => s + (r.emissions || 0), 0);
    const mobile = formData.mobile.reduce((s, r) => s + (r.emissions || 0), 0);
    return { stationary, mobile, total: stationary + mobile };
  }, [formData]);

  const saveRun = () => {
    const byMonthFacility = buildMonthFacilityTable([...formData.stationary, ...formData.mobile]);
    const run: SavedScope1Run = {
      id: `s1-run-${Date.now()}`,
      createdAt: Date.now(),
      year: selectedYear,
      totalTco2e: totals.total,
      breakdown: { stationary: totals.stationary, mobile: totals.mobile },
      byMonthFacility,
    };
    setSavedRuns((prev) => [run, ...prev].slice(0, 12));
  };

  const addStationary = () => {
    const first = STATIONARY_OPTIONS[0];
    const now = Date.now();
    const row: EmissionData = {
      id: `s1-st-${now}`,
      year: selectedYear,
      month: new Date().getMonth() + 1,
      facility: facilities[0] || '',
      energySource: first.value,
      amount: 0,
      unit: first.unit,
      emissions: 0,
      createdAt: new Date(),
    };
    onDataChange({ ...formData, stationary: [...formData.stationary, row] });
  };

  const addMobile = () => {
    const first = MOBILE_OPTIONS[0];
    const now = Date.now();
    const row: EmissionData = {
      id: `s1-mb-${now}`,
      year: selectedYear,
      month: new Date().getMonth() + 1,
      facility: facilities[0] || '',
      energySource: first.value,
      amount: 0,
      unit: first.unit,
      emissions: 0,
      createdAt: new Date(),
    };
    onDataChange({ ...formData, mobile: [...formData.mobile, row] });
  };

  const updateStationary = (id: string, patch: Partial<EmissionData>) => {
    const next = formData.stationary.map((r) => {
      if (r.id !== id) return r;
      const updated: EmissionData = { ...r, ...patch };
      const fuel = updated.energySource as StationaryFuelKey;
      const opt = STATIONARY_OPTIONS.find((o) => o.value === fuel);
      if (opt) updated.unit = opt.unit;
      updated.emissions = calcScope1Stationary(safeNumber(updated.amount), fuel, factorYear);
      return updated;
    });
    onDataChange({ ...formData, stationary: next });
  };

  const updateMobile = (id: string, patch: Partial<EmissionData>) => {
    const next = formData.mobile.map((r) => {
      if (r.id !== id) return r;
      const updated: EmissionData = { ...r, ...patch };
      const fuel = updated.energySource as MobileFuelKey;
      const opt = MOBILE_OPTIONS.find((o) => o.value === fuel);
      if (opt) updated.unit = opt.unit;
      updated.emissions = calcScope1Mobile(safeNumber(updated.amount), fuel, factorYear);
      return updated;
    });
    onDataChange({ ...formData, mobile: next });
  };

  const removeStationary = (id: string) => onDataChange({ ...formData, stationary: formData.stationary.filter((r) => r.id !== id) });
  const removeMobile = (id: string) => onDataChange({ ...formData, mobile: formData.mobile.filter((r) => r.id !== id) });

  return (
    <div className="space-y-8">
      {!showOnlyInput && (
        <>
          {/* Summary bar (이미지처럼 상단 요약) */}
          <div className="border border-[#669900] bg-white px-6 py-5">
            <div className="grid grid-cols-3 gap-6">
              <div>
                <div className="text-xs font-semibold text-slate-600">고정연소</div>
                <div className="mt-1 text-xl font-bold text-slate-900 tabular-nums">{totals.stationary.toFixed(3)}</div>
                <div className="text-xs text-slate-600">tCO2e</div>
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-600">이동연소</div>
                <div className="mt-1 text-xl font-bold text-slate-900 tabular-nums">{totals.mobile.toFixed(3)}</div>
                <div className="text-xs text-slate-600">tCO2e</div>
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-600">SCOPE 1 총계</div>
                <div className="mt-1 text-xl font-bold text-slate-900 tabular-nums">{totals.total.toFixed(3)}</div>
                <div className="text-xs text-slate-600">tCO2e</div>
              </div>
            </div>
          </div>

          {/* Result + Save (Page22 스타일) */}
          <div className="pt-2">
            <div className="mt-2 pt-6 border-t border-slate-200">
              <div className="flex justify-between items-end">
                <span className="text-base font-black">Scope1 Result</span>
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-black">
                    {totals.total.toFixed(2)} <span className="text-sm font-normal">tCO2e</span>
                  </span>
                  <button
                    type="button"
                    onClick={saveRun}
                    className="px-4 py-2 text-sm font-semibold bg-[#669900] text-white shadow-md hover:bg-slate-800 transition-colors"
                  >
                    결과 저장
                  </button>
                </div>
              </div>
              <div className="mt-2 text-sm text-slate-700">
                고정연소 <span className="font-black tabular-nums">{totals.stationary.toFixed(3)}</span> · 이동연소{' '}
                <span className="font-black tabular-nums">{totals.mobile.toFixed(3)}</span>
              </div>
            </div>
          </div>
        </>
      )}

      {!showOnlyResultAndSaved && (
      <>
      {/* 에너지원/월별 테이블 — STEP_DETAIL: 조회 미적용 시 안내, RAW vs 탄소 배출량 */}
      <div className="mt-4">
        {!filtersApplied ? (
          <div className="border-2 border-dashed border-slate-300 bg-slate-50 rounded-none p-12 text-center text-slate-600">
            <p className="text-base font-semibold mb-2">조회를 클릭하여 데이터를 확인하세요</p>
            <p className="text-sm">사이드바에서 사업장·에너지원·연도·기간을 선택한 후 <strong>[조회]</strong> 버튼을 클릭하면 그리드에 데이터가 표시됩니다.</p>
          </div>
        ) : (
          <>
            <EnergySourceMonthTable
              rows={activeSubTab === 'mobile' ? formData.mobile : activeSubTab === 'stationary' ? formData.stationary : [...formData.stationary, ...formData.mobile]}
              energySourceLabels={ENERGY_LABELS}
              selectedFacilities={selectedFacilities}
              selectedEnergySources={selectedEnergySources}
              allEnergySourceKeys={activeSubTab === 'stationary' ? STATIONARY_OPTIONS.map((o) => o.value) : activeSubTab === 'mobile' ? MOBILE_OPTIONS.map((o) => o.value) : undefined}
              year={selectedYear}
              periodType={periodType}
              viewMode={dataViewMode}
              onCellClick={(p) => setCellEdit({ energySource: p.energySource, month: p.month, value: p.value, dataType: p.dataType })}
            />
            {cellEdit && (
              <CellEditModal
              open={!!cellEdit}
              onOpenChange={(o) => !o && setCellEdit(null)}
              energySource={cellEdit.energySource}
              month={cellEdit.month}
              value={cellEdit.value}
              dataType={cellEdit.dataType}
              viewMode={dataViewMode}
              onSave={({ value: newVal }) => {
                const arr = activeSubTab === 'mobile' ? formData.mobile : formData.stationary;
                const matching = arr.filter((r) => {
                  const lbl = ENERGY_LABELS[r.energySource as StationaryFuelKey | MobileFuelKey] ?? r.energySource;
                  return lbl === cellEdit.energySource || r.energySource === cellEdit.energySource;
                }).filter((r) => r.month === cellEdit.month);
                if (matching.length === 1) {
                  const row = matching[0];
                  let amountPatch = newVal;
                  if (dataViewMode === 'emission') {
                    const fuel = row.energySource as StationaryFuelKey | MobileFuelKey;
                    const isMobile = activeSubTab === 'mobile';
                    const factors = isMobile ? EMISSION_FACTOR_DB[factorYear].mobile : EMISSION_FACTOR_DB[factorYear].stationary;
                    const factorItem = (factors as Record<string, { factor: number }>)[fuel];
                    const factor = factorItem?.factor ?? 0.001;
                    amountPatch = factor > 0 ? newVal / factor : newVal;
                  }
                  const update = activeSubTab === 'mobile' ? updateMobile : updateStationary;
                  update(row.id, { amount: amountPatch });
                }
              }}
              />
            )}
          </>
        )}
      </div>
      </>
      )}

      {!showOnlyInput && (
      <>
      {/* 저장된 산정값 */}
      <div className="mt-4">
        <div className="border border-slate-200 bg-white p-5 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-lg font-black">저장된 산정값 (Scope 1)</div>
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
                    <div className="text-base">
                      {new Date(r.createdAt).toLocaleString()} · {r.year}
                    </div>
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
                    고정연소 <span className="font-black tabular-nums">{r.breakdown.stationary.toFixed(4)}</span> · 이동연소{' '}
                    <span className="font-black tabular-nums">{r.breakdown.mobile.toFixed(4)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      </>
      )}

      {!showOnlyResultAndSaved && (
      <>
      {/* 단계별 입력 — GHG_UI_Strategy_v2 / STEP_DETAIL: activeSubTab 제공 시 버튼 숨김 */}
      <div className="mt-6 pt-6 border-t border-slate-200">
        {activeSubTab === undefined && (
          <div className="flex items-center gap-2 mb-4">
            <button
              type="button"
              onClick={() => setInternalStep(1)}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${step === 1 ? 'bg-[#669900] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              ① 고정 연소
            </button>
            <button
              type="button"
              onClick={() => setInternalStep(2)}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${step === 2 ? 'bg-[#669900] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              ② 이동 연소
            </button>
          </div>
        )}

      {/* Step 1: Stationary */}
      {step === 1 && (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-base font-semibold text-slate-900">고정 연소 (필수)</div>
          <button
            type="button"
            onClick={addStationary}
            className="text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 px-4 py-2 transition-colors"
          >
            연료 추가
          </button>
        </div>

        <div className="space-y-3">
          {formData.stationary.map((row) => {
            const fuel = row.energySource as StationaryFuelKey;
            const factorItem = EMISSION_FACTOR_DB[factorYear].stationary[fuel];
            return (
              <div key={row.id} className="space-y-2">
                <div className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-2">
                    <select
                      value={row.month}
                      onChange={(e: ChangeEvent<HTMLSelectElement>) => updateStationary(row.id, { month: parseInt(e.target.value, 10) })}
                      className="w-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-slate-400"
                    >
                      {monthOptions().map((m) => (
                        <option key={m} value={m}>
                          {m}월
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-3">
                    <select
                      value={row.facility}
                      onChange={(e: ChangeEvent<HTMLSelectElement>) => updateStationary(row.id, { facility: e.target.value })}
                      className="w-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-slate-400"
                    >
                      {facilities.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-4">
                    <select
                      value={fuel}
                      onChange={(e: ChangeEvent<HTMLSelectElement>) => updateStationary(row.id, { energySource: e.target.value as StationaryFuelKey })}
                      className="w-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-slate-400"
                    >
                      {STATIONARY_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <input
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      value={editingAmount[row.id] !== undefined ? editingAmount[row.id] : (row.amount === 0 ? '' : String(row.amount))}
                      onFocus={() => setEditingAmount((prev) => ({ ...prev, [row.id]: row.amount === 0 ? '' : String(row.amount) }))}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => {
                        const v = e.target.value;
                        setEditingAmount((prev) => ({ ...prev, [row.id]: v }));
                        updateStationary(row.id, { amount: safeNumber(v) });
                      }}
                      onBlur={() => setEditingAmount((prev) => {
                        const next = { ...prev };
                        delete next[row.id];
                        return next;
                      })}
                      className="w-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-slate-400"
                      placeholder="0"
                    />
                  </div>
                  <div className="col-span-1 text-right text-xs font-semibold text-slate-600">{factorItem.unit}</div>
                </div>

                {/* Info box (Page22처럼 계수/권장범위/결과) */}
                <div className="border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                  <div className="flex flex-wrap gap-x-2 gap-y-1 items-center">
                    <span className="text-slate-700 font-semibold">계수(적용)</span>
                    <span className="text-orange-600 font-bold">
                      {(factorItem.factor * 1000).toFixed(3)}
                    </span>
                    <span className="text-slate-600">kgCO2e/{factorItem.unit}</span>
                    <span className="text-slate-400">|</span>
                    <span className="text-orange-600 font-bold">{factorItem.factor.toFixed(6)}</span>
                    <span className="text-slate-600">tCO2e/{factorItem.unit}</span>
                    <span className="text-slate-400">|</span>
                    <span className="text-slate-700 font-semibold">월 배출량</span>
                    <span className="text-orange-600 font-bold">{(row.emissions || 0).toFixed(3)}</span>
                    <span className="text-slate-600">tCO2e</span>
                  </div>
                  {factorItem.recommendedKg && (
                    <div className="mt-2 text-xs text-slate-700">
                      권장 범위: {factorItem.recommendedKg.min} ~ {factorItem.recommendedKg.max} {factorItem.recommendedKg.unitLabel}
                    </div>
                  )}
                  {factorItem.note && <div className="mt-2 text-xs text-slate-600">비고: {factorItem.note}</div>}
                </div>

                {/* 데이터 품질 선택 (전략서: 실측/추정/공급자 제공/기타) */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-emerald-700">데이터 품질 (Data Quality)</label>
                  <select
                    value={row.dataQuality?.dataType ?? 'measured'}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                      const dataType = e.target.value as DataQualityType;
                      const next: DataQuality = { ...row.dataQuality, dataType };
                      if (dataType !== 'estimated') {
                        next.estimationMethod = undefined;
                        next.assumptions = undefined;
                      }
                      updateStationary(row.id, { dataQuality: next });
                    }}
                    className="w-full max-w-md border border-slate-200 bg-white px-3 py-2 text-sm rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    {DATA_QUALITY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  {(row.dataQuality?.dataType ?? 'measured') === 'estimated' && (
                    <div className="p-4 rounded-xl border border-emerald-100 bg-emerald-50/50 space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">추정 방법</label>
                        <select
                          value={row.dataQuality?.estimationMethod ?? ''}
                          onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                            updateStationary(row.id, {
                              dataQuality: { ...row.dataQuality, dataType: 'estimated', estimationMethod: e.target.value },
                            })
                          }
                          className="w-full border border-slate-200 bg-white px-3 py-2 text-sm rounded-lg"
                        >
                          <option value="">선택...</option>
                          {ESTIMATION_METHOD_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">가정 사항 (자유 텍스트)</label>
                        <textarea
                          rows={2}
                          placeholder="데이터가 추정된 구체적인 배경과 가정을 입력하세요..."
                          value={row.dataQuality?.assumptions ?? ''}
                          onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                            updateStationary(row.id, {
                              dataQuality: { ...row.dataQuality, dataType: 'estimated', assumptions: e.target.value },
                            })
                          }
                          className="w-full border border-slate-200 bg-white px-3 py-2 text-sm rounded-lg resize-none"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end">
                  <Button variant="ghost" size="sm" onClick={() => removeStationary(row.id)} className="text-red-600 hover:text-red-700">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      )}

      {/* Step 2: Mobile */}
      {step === 2 && (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-base font-semibold text-slate-900">이동 연소 (회사 차량)</div>
          <button
            type="button"
            onClick={addMobile}
            className="text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 px-4 py-2 transition-colors"
          >
            항목 추가
          </button>
        </div>

        <div className="space-y-3">
          {formData.mobile.map((row) => {
            const fuel = row.energySource as MobileFuelKey;
            const factorItem = EMISSION_FACTOR_DB[factorYear].mobile[fuel];
            return (
              <div key={row.id} className="space-y-2">
                <div className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-2">
                    <select
                      value={row.month}
                      onChange={(e: ChangeEvent<HTMLSelectElement>) => updateMobile(row.id, { month: parseInt(e.target.value, 10) })}
                      className="w-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-slate-400"
                    >
                      {monthOptions().map((m) => (
                        <option key={m} value={m}>
                          {m}월
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-3">
                    <select
                      value={row.facility}
                      onChange={(e: ChangeEvent<HTMLSelectElement>) => updateMobile(row.id, { facility: e.target.value })}
                      className="w-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-slate-400"
                    >
                      {facilities.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-4">
                    <select
                      value={fuel}
                      onChange={(e: ChangeEvent<HTMLSelectElement>) => updateMobile(row.id, { energySource: e.target.value as MobileFuelKey })}
                      className="w-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-slate-400"
                    >
                      {MOBILE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <input
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      value={editingAmount[row.id] !== undefined ? editingAmount[row.id] : (row.amount === 0 ? '' : String(row.amount))}
                      onFocus={() => setEditingAmount((prev) => ({ ...prev, [row.id]: row.amount === 0 ? '' : String(row.amount) }))}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => {
                        const v = e.target.value;
                        setEditingAmount((prev) => ({ ...prev, [row.id]: v }));
                        updateMobile(row.id, { amount: safeNumber(v) });
                      }}
                      onBlur={() => setEditingAmount((prev) => {
                        const next = { ...prev };
                        delete next[row.id];
                        return next;
                      })}
                      className="w-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-slate-400"
                      placeholder="0"
                    />
                  </div>
                  <div className="col-span-1 text-right text-xs font-semibold text-slate-600">{factorItem.unit}</div>
                </div>

                <div className="border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                  <div className="flex flex-wrap gap-x-2 gap-y-1 items-center">
                    <span className="text-slate-700 font-semibold">계수(적용)</span>
                    <span className="text-orange-600 font-bold">
                      {(factorItem.factor * 1000).toFixed(3)}
                    </span>
                    <span className="text-slate-600">kgCO2e/{factorItem.unit}</span>
                    <span className="text-slate-400">|</span>
                    <span className="text-orange-600 font-bold">{factorItem.factor.toFixed(6)}</span>
                    <span className="text-slate-600">tCO2e/{factorItem.unit}</span>
                    <span className="text-slate-400">|</span>
                    <span className="text-slate-700 font-semibold">월 배출량</span>
                    <span className="text-orange-600 font-bold">{(row.emissions || 0).toFixed(3)}</span>
                    <span className="text-slate-600">tCO2e</span>
                  </div>
                  {factorItem.note && <div className="mt-2 text-xs text-slate-600">비고: {factorItem.note}</div>}
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-emerald-700">데이터 품질 (Data Quality)</label>
                  <select
                    value={row.dataQuality?.dataType ?? 'measured'}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                      const dataType = e.target.value as DataQualityType;
                      const next: DataQuality = { ...row.dataQuality, dataType };
                      if (dataType !== 'estimated') {
                        next.estimationMethod = undefined;
                        next.assumptions = undefined;
                      }
                      updateMobile(row.id, { dataQuality: next });
                    }}
                    className="w-full max-w-md border border-slate-200 bg-white px-3 py-2 text-sm rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  >
                    {DATA_QUALITY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  {(row.dataQuality?.dataType ?? 'measured') === 'estimated' && (
                    <div className="p-4 rounded-xl border border-emerald-100 bg-emerald-50/50 space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">추정 방법</label>
                        <select
                          value={row.dataQuality?.estimationMethod ?? ''}
                          onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                            updateMobile(row.id, {
                              dataQuality: { ...row.dataQuality, dataType: 'estimated', estimationMethod: e.target.value },
                            })
                          }
                          className="w-full border border-slate-200 bg-white px-3 py-2 text-sm rounded-lg"
                        >
                          <option value="">선택...</option>
                          {ESTIMATION_METHOD_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">가정 사항 (자유 텍스트)</label>
                        <textarea
                          rows={2}
                          placeholder="데이터가 추정된 구체적인 배경과 가정을 입력하세요..."
                          value={row.dataQuality?.assumptions ?? ''}
                          onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                            updateMobile(row.id, {
                              dataQuality: { ...row.dataQuality, dataType: 'estimated', assumptions: e.target.value },
                            })
                          }
                          className="w-full border border-slate-200 bg-white px-3 py-2 text-sm rounded-lg resize-none"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end">
                  <Button variant="ghost" size="sm" onClick={() => removeMobile(row.id)} className="text-red-600 hover:text-red-700">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      )}
      </div>
      </>
      )}
    </div>
  );
}


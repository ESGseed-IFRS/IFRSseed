'use client';

import { useGHGStore } from '../store/ghg.store';
import { Scope1FormPage22 } from './Scope1FormPage22';
import type { FilterState } from '../types/ghg.types';
import type { GHGScope1SubTab, GHGDataViewMode } from '../store/ghg.store';

/**
 * Scope 1 페이지 — STEP_DETAIL
 * 고정연소 및 이동연소 배출량 산정 (서브탭별, 조회 시 필터 적용)
 */
export function Scope1Page({
  appliedFilters,
  activeSubTab,
  dataViewMode = 'raw',
  wizardStepMode,
}: {
  appliedFilters?: FilterState | null;
  activeSubTab?: GHGScope1SubTab;
  dataViewMode?: GHGDataViewMode;
  /** SCOPE1,2_DETAIL §0: 2=입력만, 3=결과·저장만 */
  wizardStepMode?: 2 | 3;
}) {
  const facilities = useGHGStore((s) => s.facilities);
  const formData = useGHGStore((s) => s.scope1);
  const setFormData = useGHGStore((s) => s.setScope1);
  const filters = useGHGStore((s) => s.filtersByScope.scope1);

  const effectiveFilters = appliedFilters ?? filters;
  const selectedYear = effectiveFilters?.year ?? filters?.year ?? new Date().getFullYear();
  const selectedFacilities = effectiveFilters?.facilities ?? filters?.facilities ?? [];
  const selectedEnergySources = effectiveFilters?.energySources ?? filters?.energySources ?? [];
  const periodType = effectiveFilters?.periodType ?? filters?.periodType ?? 'monthly';

  return (
    <Scope1FormPage22
      formData={formData}
      onDataChange={setFormData}
      facilities={facilities}
      selectedYear={selectedYear}
      selectedFacilities={selectedFacilities}
      selectedEnergySources={selectedEnergySources}
      periodType={periodType}
      activeSubTab={activeSubTab}
      dataViewMode={dataViewMode}
      filtersApplied={!!appliedFilters}
      wizardStepMode={wizardStepMode}
    />
  );
}

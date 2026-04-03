'use client';

import { useGHGStore } from '../store/ghg.store';
import { Scope2FormPage22 } from './Scope2FormPage22';
import type { FilterState } from '../types/ghg.types';
import type { GHGScope2SubTab, GHGDataViewMode } from '../store/ghg.store';

/**
 * Scope 2 페이지 — STEP_DETAIL
 * 전력 및 열/스팀/온수 구매로 인한 간접 배출량 산정
 */
export function Scope2Page({
  appliedFilters,
  activeSubTab,
  dataViewMode = 'raw',
}: {
  appliedFilters?: FilterState | null;
  activeSubTab?: GHGScope2SubTab;
  dataViewMode?: GHGDataViewMode;
}) {
  const facilities = useGHGStore((s) => s.facilities);
  const filters = useGHGStore((s) => s.filtersByScope.scope2);
  const formData = useGHGStore((s) => s.scope2);
  const setFormData = useGHGStore((s) => s.setScope2);

  const effectiveFilters = appliedFilters ?? filters;
  const selectedYear = effectiveFilters?.year ?? filters?.year ?? new Date().getFullYear();
  const selectedFacilities = effectiveFilters?.facilities ?? filters?.facilities ?? [];
  const selectedEnergySources = effectiveFilters?.energySources ?? filters?.energySources ?? [];
  const periodType = effectiveFilters?.periodType ?? filters?.periodType ?? 'monthly';

  return (
    <Scope2FormPage22
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
    />
  );
}

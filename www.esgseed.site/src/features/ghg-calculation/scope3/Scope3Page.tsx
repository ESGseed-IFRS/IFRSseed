'use client';

import { useGHGStore } from '../store/ghg.store';
import { Scope3FormPage22 } from './Scope3FormPage22';

/**
 * Scope 3 페이지
 * 기타 간접 배출량 산정 (영수증 첨부 기능 포함)
 * ERP_DATA_DISCLOSURE_STRATEGY §5: 공시기준별 우선 카테고리 표시
 */
export function Scope3Page({ disclosureFramework }: { disclosureFramework?: string }) {
  const facilities = useGHGStore((s) => s.facilities);
  const formData = useGHGStore((s) => s.scope3);
  const setFormData = useGHGStore((s) => s.setScope3);

  return (
    <Scope3FormPage22
      formData={formData}
      onDataChange={setFormData}
      facilities={facilities}
      selectedYear={new Date().getFullYear()}
      disclosureFramework={disclosureFramework}
    />
  );
}

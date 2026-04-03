/**
 * ERP_DATA_DISCLOSURE_STRATEGY §2: 공시기준 5개로 단일화
 * - ISSB, KSSB, K-ETS, GRI, ESRS
 * - CDP, K-ESG 제거 (KSSB·GRI로 포괄)
 */

export type GHGActiveScope = 'scope1' | 'scope2' | 'scope3';

/** ERP_DATA_DISCLOSURE_STRATEGY: 공시 프레임워크 5개 */
export const DISCLOSURE_FRAMEWORKS = ['ISSB', 'KSSB', 'K-ETS', 'GRI', 'ESRS'] as const;
export type DisclosureFramework = (typeof DISCLOSURE_FRAMEWORKS)[number];

export interface DisclosureItem {
  id: string;
  label: string;
  /** 해당 항목 입력/뷰로 이동할 Scope (월별 에너지는 scope1으로 이동해 공통 데이터 확인) */
  navigateTo: GHGActiveScope;
}

/** 공시 항목 마스터 — 공시 항목별 요약 테이블·배지·리포트 매핑용 */
export const DISCLOSURE_ITEMS: DisclosureItem[] = [
  { id: 'monthly_energy', label: '월별 에너지 사용량 (Scope 1·2)', navigateTo: 'scope1' },
  { id: 'scope1', label: 'Scope 1 배출량 (tCO₂e)', navigateTo: 'scope1' },
  { id: 'scope2', label: 'Scope 2 배출량 (tCO₂e)', navigateTo: 'scope2' },
  { id: 'scope3', label: 'Scope 3 배출량 (tCO₂e)', navigateTo: 'scope3' },
];

/** 프레임워크 ID (셀렉트 value용) — 5개 */
export const FRAMEWORK_IDS: readonly string[] = ['ISSB', 'KSSB', 'K-ETS', 'GRI', 'ESRS'] as const;

/** 프레임워크별 표시명 */
export const FRAMEWORK_LABELS: Record<string, string> = {
  ISSB: 'ISSB (IFRS S2)',
  KSSB: 'KSSB (국내 기후 공시)',
  'K-ETS': 'K-ETS (배출권거래제)',
  GRI: 'GRI 305',
  ESRS: 'ESRS E1',
};

/** 프레임워크별 필수 공시 항목 ID — ERP_DATA_DISCLOSURE_STRATEGY */
export const FRAMEWORK_REQUIRED_ITEMS: Record<string, string[]> = {
  ISSB: ['monthly_energy', 'scope1', 'scope2', 'scope3'],
  KSSB: ['monthly_energy', 'scope1', 'scope2', 'scope3'],
  'K-ETS': ['monthly_energy', 'scope1', 'scope2'],
  GRI: ['monthly_energy', 'scope1', 'scope2', 'scope3'],
  ESRS: ['monthly_energy', 'scope1', 'scope2', 'scope3'],
};

export function isRequiredByFramework(frameworkId: string, itemId: string): boolean {
  return (FRAMEWORK_REQUIRED_ITEMS[frameworkId] ?? []).includes(itemId);
}

/** 프레임워크별 필수 항목 기준 완료율 계산용 */
export function getRequiredItemsForFramework(frameworkId: string): string[] {
  return FRAMEWORK_REQUIRED_ITEMS[frameworkId] ?? [];
}

/** 프레임워크별 안내 문구 — ERP_DATA_DISCLOSURE_STRATEGY §4.7, §7 */
export const FRAMEWORK_GUIDANCE: Record<string, string> = {
  ISSB: 'ISSB: 연간 총합 + 측정 방법·가정 중심. Scope 2 위치/시장 기반, Scope 3 중대 카테고리 공시 필요.',
  KSSB: 'KSSB: 국내 ISSB 기반. Scope 1·2 필수, Scope 3 유예/중대성 판단. NF₃ 포함 7종 GHG.',
  'K-ETS': 'K-ETS: 월별 에너지 사용량 보고 의무. Scope 1 중심. 환경부 고시 배출계수 적용.',
  GRI: 'GRI 305: GHG Protocol 기반 Scope 1/2/3 공시. ISSB 데이터 90%+ 재사용.',
  ESRS: 'ESRS E1: EU CSRD. Scope 2 location/market 기반 필수. 전환 계획·15개 Scope 3 카테고리.',
};

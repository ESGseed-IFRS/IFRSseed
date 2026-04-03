/**
 * ERP_DATA_DISCLOSURE_STRATEGY §5.2, §7: 공시기준별 필수 원시 데이터 카테고리
 * 공시기준 선택 시 필요한 RawActivityData.category 필터링용
 */

import type { RawDataScope } from '../types/rawActivityData.types';

/** Scope 1 원시 카테고리 */
export const RAW_SCOPE1_CATEGORIES = ['stationary', 'mobile', 'refrigerant'] as const;

/** Scope 2 원시 카테고리 */
export const RAW_SCOPE2_CATEGORIES = ['electricity', 'heat', 'steam'] as const;

/** Scope 3 GHG Protocol 카테고리 (ERP_DATA_DISCLOSURE_STRATEGY §4) */
export const SCOPE3_CATEGORY_IDS = [
  'cat1', 'cat2', 'cat3', 'cat4', 'cat5', 'cat6', 'cat7', 'cat8',
  'cat9', 'cat10', 'cat11', 'cat12', 'cat13', 'cat14', 'cat15',
] as const;

export type DisclosureFramework = 'ISSB' | 'KSSB' | 'K-ETS' | 'GRI' | 'ESRS';

/** 공시기준별 필요한 Scope 3 카테고리 (우선 표시용) */
export const FRAMEWORK_SCOPE3_CATEGORIES: Record<DisclosureFramework, readonly string[]> = {
  'K-ETS': [], // K-ETS: Scope 3 선택적
  KSSB: ['cat1', 'cat4', 'cat9', 'cat11'], // Cat.1,4,9,11 우선
  ISSB: ['cat1', 'cat3', 'cat4', 'cat6', 'cat7', 'cat9', 'cat11', 'cat12'], // 중요 카테고리
  GRI: ['cat1', 'cat3', 'cat4', 'cat6', 'cat7', 'cat9', 'cat11', 'cat12'],
  ESRS: [...SCOPE3_CATEGORY_IDS], // 15개 대부분 필수
};

/** 공시기준별 Scope 포함 여부 */
export const FRAMEWORK_SCOPES: Record<DisclosureFramework, RawDataScope[]> = {
  'K-ETS': ['scope1', 'scope2'],
  KSSB: ['scope1', 'scope2', 'scope3'],
  ISSB: ['scope1', 'scope2', 'scope3'],
  GRI: ['scope1', 'scope2', 'scope3'],
  ESRS: ['scope1', 'scope2', 'scope3'],
};

/** 선택한 공시기준에 필요한 Scope 목록 반환 */
export function getRequiredScopes(framework: DisclosureFramework): RawDataScope[] {
  return FRAMEWORK_SCOPES[framework] ?? ['scope1', 'scope2', 'scope3'];
}

/** 선택한 공시기준에 우선 표시할 Scope 3 카테고리 반환 */
export function getScope3CategoriesForFramework(framework: DisclosureFramework): readonly string[] {
  return FRAMEWORK_SCOPE3_CATEGORIES[framework] ?? [];
}

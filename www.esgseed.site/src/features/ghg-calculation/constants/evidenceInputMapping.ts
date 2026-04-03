/**
 * GHG_TAB_DESIGN_v2: 데이터 입력 탭 6개 — 사용자 관점 "내가 어떤 데이터를 갖고 있는가"
 * - 1. 전력·열·스팀 [Scope 2] EMS
 * - 2. 연료·차량 [Scope 1] ERP
 * - 3. 냉매 [Scope 1] EHS
 * - 4. 폐기물 [Scope 1·3] EMS
 * - 5. 물류·출장·통근 [Scope 3] SRM·HR
 * - 6. 원료·제품 [Scope 3] SRM·PLM
 */

import type { GHGActiveScope } from '../store/ghg.store';

export type EvidenceInputTabId = 'power' | 'fuel' | 'refrigerant' | 'waste' | 'logistics' | 'materials';

export interface EvidenceInputItem {
  id: EvidenceInputTabId;
  label: string;
  /** 내부 Scope (필터·EMS·엑셀용) */
  scope: GHGActiveScope;
  /** 소스 시스템 */
  sourceSystem: string;
  /** 탭 설명 */
  description: string;
}

/** GHG_TAB_DESIGN_v2 §탭 네이밍: 6탭 구조 */
export const EVIDENCE_INPUT_ITEMS: EvidenceInputItem[] = [
  { id: 'power', label: '전력·열·스팀', scope: 'scope2', sourceSystem: 'EMS', description: '전기요금 고지서, 열·스팀 사용 내역서' },
  { id: 'fuel', label: '연료·차량', scope: 'scope1', sourceSystem: 'ERP', description: 'LNG·경유·휘발유 등 연료 구매·소비 기록' },
  { id: 'refrigerant', label: '냉매', scope: 'scope1', sourceSystem: 'EHS', description: '냉매 충전량·누출량 (에어컨·냉동기·칠러)' },
  { id: 'waste', label: '폐기물', scope: 'scope3', sourceSystem: 'EMS', description: '폐기물 종류·발생량·처리 방법(소각/매립/재활용/위탁)' },
  { id: 'logistics', label: '물류·출장·통근', scope: 'scope3', sourceSystem: 'SRM·HR', description: '운송·출장·통근 이동 수단·거리·중량/인원' },
  { id: 'materials', label: '원료·제품', scope: 'scope3', sourceSystem: 'SRM·PLM', description: '구매물품·제품 사용·제품 폐기 단계 배출량' },
];

/** Evidence Tab → Scope 매핑 */
export const EVIDENCE_TO_SCOPE: Record<EvidenceInputTabId, GHGActiveScope> = {
  power: 'scope2',
  fuel: 'scope1',
  refrigerant: 'scope1',
  waste: 'scope3',
  logistics: 'scope3',
  materials: 'scope3',
};

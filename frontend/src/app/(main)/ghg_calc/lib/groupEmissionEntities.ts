/**
 * 산정 결과 조회·GHG 보고서 mock 공통 — GHG_SUBSIDIARY_RESULTS_AND_HOLDING_REPORT_STRATEGY.md
 */
import type { GhgLegalEntityId } from '../types/ghg';

export type GroupEmissionEntityRow = {
  name: string;
  /** 그룹 API(`group-results`) 행과 매칭 시 DB `companies.id` */
  company_id?: string;
  scope1: number;
  scope2: number;
  scope3: number;
  total: number;
  prev: number;
  frozen: boolean;
  segment: 'subsidiary' | 'domestic';
  segmentLabel?: string;
  legalEntityId?: GhgLegalEntityId;
};

export const GHG_SUBSIDIARY_ENTITY_ROWS: GroupEmissionEntityRow[] = [
  { name: '미라콤', legalEntityId: 'miracom', scope1: 2180, scope2: 9540, scope3: 18240, total: 29960, prev: 28450, frozen: true, segment: 'subsidiary' },
  { name: '시큐아이', legalEntityId: 'secui', scope1: 5420, scope2: 18230, scope3: 32100, total: 55750, prev: 54210, frozen: true, segment: 'subsidiary' },
  { name: '에스코어', legalEntityId: 'score', scope1: 840, scope2: 3210, scope3: 6780, total: 10830, prev: 11240, frozen: true, segment: 'subsidiary' },
  { name: '멀티캠퍼스', legalEntityId: 'multicam', scope1: 3290, scope2: 4180, scope3: 12450, total: 19920, prev: 19100, frozen: true, segment: 'subsidiary' },
  { name: '엠로', legalEntityId: 'emro', scope1: 6780, scope2: 22100, scope3: 41200, total: 70080, prev: 71500, frozen: false, segment: 'subsidiary' },
  { name: '오픈핸즈', legalEntityId: 'openhands', scope1: 1230, scope2: 5670, scope3: 9870, total: 16770, prev: 16320, frozen: true, segment: 'subsidiary' },
];

export const GHG_DOMESTIC_SITE_ROWS: GroupEmissionEntityRow[] = [
  { name: '상암 데이터센터', scope1: 24800, scope2: 18600, scope3: 6200, total: 49600, prev: 48200, frozen: true, segment: 'domestic', segmentLabel: '데이터센터' },
  { name: '수원 데이터센터', scope1: 22400, scope2: 16200, scope3: 5100, total: 43700, prev: 42100, frozen: true, segment: 'domestic', segmentLabel: '데이터센터' },
  { name: '춘천 데이터센터', scope1: 38600, scope2: 28400, scope3: 8900, total: 75900, prev: 74200, frozen: true, segment: 'domestic', segmentLabel: '데이터센터' },
  { name: '판교 IT 캠퍼스', scope1: 18200, scope2: 22400, scope3: 12800, total: 53400, prev: 52100, frozen: true, segment: 'domestic', segmentLabel: '캠퍼스(HQ)' },
  { name: '서울 R&D 캠퍼스', scope1: 6200, scope2: 9800, scope3: 5400, total: 21400, prev: 20800, frozen: false, segment: 'domestic', segmentLabel: 'R&D' },
  { name: '동탄 데이터센터', scope1: 12400, scope2: 9800, scope3: 3100, total: 25300, prev: 24600, frozen: false, segment: 'domestic', segmentLabel: '데이터센터' },
];

export const GHG_ALL_GROUP_ENTITIES: GroupEmissionEntityRow[] = [...GHG_SUBSIDIARY_ENTITY_ROWS, ...GHG_DOMESTIC_SITE_ROWS];

export function sumEntityFields(entities: GroupEmissionEntityRow[]) {
  return entities.reduce(
    (acc, r) => ({
      scope1: acc.scope1 + r.scope1,
      scope2: acc.scope2 + r.scope2,
      scope3: acc.scope3 + r.scope3,
      total: acc.total + r.total,
      prev: acc.prev + r.prev,
    }),
    { scope1: 0, scope2: 0, scope3: 0, total: 0, prev: 0 },
  );
}

/** 지주사 SR 페이지별 작성 — 삼성SDS SR 2024 지표표 기준 목차·공시기준
 *
 * `srBodyIds` / `srImageIds` 기본값은 생성 파일에 있음.
 * 런타임 오버레이(어드민 저장)는 `holdingPageMappingsStorage.ts` → localStorage.
 */

import { HOLDING_SR_SDS_2024_PAGES } from './holdingSrSds2024Pages.generated';

export type HoldingSrPageRow = (typeof HOLDING_SR_SDS_2024_PAGES)[number] & {
  srBodyIds?: string[];
  srImageIds?: string[];
};

export const HOLDING_SR_PAGE_DATA: HoldingSrPageRow[] = HOLDING_SR_SDS_2024_PAGES;

const INFOGRAPHIC_SUGGEST: Record<string, string[]> = {
  'GRI 305': ['KPI 원형 인포그래픽 (Scope 1·2·3)', 'Scope 피라미드', '감축 여정 타임라인'],
  'GRI 302': ['아이콘+원형 KPI (재생에너지·에너지)', '연도별 막대 (자유 차트)'],
  'GRI 403': ['아이콘+원형 KPI (안전)', '연도 추이 (자유 차트)'],
  'GRI 405': ['아이콘+원형 KPI (다양성)', '맞춤 표 (자유)'],
  'GRI 404': ['아이콘+원형 KPI (역량)', '교육시간 추이 (자유 차트)'],
  'ESRS GOV': ['거버넌스 다이어그램 (자유 차트)', '이사회 구성 표'],
  'GRI 303': ['아이콘 KPI (용수)', '수자원 추이 (자유 차트)'],
  IFRS: ['감축 타임라인', '시나리오 라인차트 (자유 차트)'],
};

/** 우측 패널용 짧은 문구 추천(레거시) — 인포그래픽 템플릿과 병행 */
export function getInfographicSuggestions(standards: string[]): string[] {
  const found = new Set<string>();
  standards.forEach((std) => {
    Object.entries(INFOGRAPHIC_SUGGEST).forEach(([key, vals]) => {
      if (std.startsWith(key)) vals.forEach((v) => found.add(v));
    });
  });
  return found.size
    ? Array.from(found).slice(0, 5)
    : ['KPI 원형 인포그래픽', '감축 여정 타임라인', 'Scope 피라미드'];
}

export function findPageByKeyword(keyword: string): HoldingSrPageRow | undefined {
  const k = keyword.trim().toLowerCase();
  if (!k) return undefined;
  return HOLDING_SR_PAGE_DATA.find(
    (p) =>
      p.title.toLowerCase().includes(k) ||
      p.section.toLowerCase().includes(k) ||
      p.standards.some((s) => s.toLowerCase().includes(k)),
  );
}

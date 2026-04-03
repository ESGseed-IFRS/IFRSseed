/**
 * 지주 SR 대시보드 → /sr-report 지주 모드 딥링크 (SR_HOLDING_DASHBOARD_AND_REPORT_TAB_LINKAGE_STRATEGY.md)
 */

import { DP_MASTER_LIST } from './platformData';
import { HOLDING_SR_PAGE_DATA } from './holdingPageData';

/** 매트릭스 열 GRI/표준 코드 → 플랫폼 DP 마스터 ID */
export function dpMasterIdFromMatrixDpCode(dpCode: string): string | null {
  const t = dpCode.trim();
  const row = DP_MASTER_LIST.find((d) => {
    const g = d.coverage.gri?.trim();
    if (!g) return false;
    return g === t || g.startsWith(t) || t.startsWith(g.split(/\s/)[0] ?? '');
  });
  return row?.dp_id ?? null;
}

/**
 * 대시보드 페이지 카드 sectionId → HoldingPageByPageEditor의 findPageByKeyword 인자
 * (holdingSrSds2024Pages 제목·섹션과 맞물리도록 짧은 키워드 사용)
 */
export const DASHBOARD_SECTION_ID_TO_KEYWORD: Record<string, string> = {
  'sec-ceo': 'CEO 인사말',
  'sec-company': '회사소개',
  'sec-esg': 'ESG',
  'sec-env': '환경',
  'sec-social': '사회',
  'sec-governance': '지배',
  'sec-stakeholder': '이해관계자',
  'sec-gri': 'GRI',
  'sec-assurance': '검증',
  'sec-boundary': '경계',
};

/** `page-12` → 해당 페이지 행의 title (HoldingPageByPageEditor findPageByKeyword와 정합) */
export function keywordFromDashboardSectionId(sectionId: string | null): string | null {
  if (!sectionId) return null;
  if (sectionId.startsWith('page-')) {
    const n = parseInt(sectionId.replace(/^page-/, ''), 10);
    if (!Number.isFinite(n)) return null;
    const row = HOLDING_SR_PAGE_DATA.find((p) => p.page === n);
    return row?.title ?? null;
  }
  return DASHBOARD_SECTION_ID_TO_KEYWORD[sectionId] ?? null;
}

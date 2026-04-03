/**
 * Report 기능 관련 타입 정의
 */

// 목차 항목 타입
export interface TableOfContentsItem {
  id: string;
  title: string;
  order: number;
  pageNumber?: number; // 페이지 번호 (예: 04, 05, 36 등)
  parentId?: string; // 부모 항목 ID (하위 섹션용)
  level: number; // 깊이 레벨 (0: 최상위, 1: 하위)
}

// 페이지 내용 타입
export interface PageContent {
  id: string;
  tocId: string;
  content: string;
  quantitativeData: { [key: string]: number | string };
}

// 공시 기준 타입
export interface DisclosureStandard {
  id: string;
  name: string;
  type: 'GRI' | 'SASB' | 'ESRS' | 'IFRS' | 'KSSB';
  code: string;
  description: string;
  required: boolean;
}

// 페이지별 공시 기준 매핑 타입 (삼성SDS 매핑 데이터)
export interface PageStandardMapping {
  pageNumber: number;
  title: string;
  standards: string[]; // 공시 기준 코드 배열 (예: ['GRI 2-22', 'IFRS S1-27'])
}

// 일치도 정보 타입
export interface ComplianceMatch {
  standardId: string;
  matchStatus: 'matched' | 'partial' | 'unmatched';
  complianceRate: number; // 0-100
  missingItems: string[];
  suggestions: string[];
}

// 정량 데이터 검증 결과 타입
export interface QuantitativeValidation {
  field: string;
  value: number;
  previousValue?: number;
  isValid: boolean;
  warning?: string;
  severity: 'error' | 'warning' | 'info';
}

// 저장 모드 (직접 작성 / AI 생성)
export type WriteMode = 'MANUAL' | 'AI';

// 시각화 추천 항목 (SR_PAGE_IMPLEMENTATION F-04)
export interface VisualizationRecommendation {
  id: string;
  title: string;
  description: string;
  chartType: string;
  dataKey: string;
}

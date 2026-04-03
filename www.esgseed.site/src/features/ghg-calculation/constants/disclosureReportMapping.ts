/**
 * GHG_UI_SCOPE.md §1-5: 공시 항목 마스터·매핑 (데이터·리포트 레벨)
 * - 공시 항목 ID, 한글명, 단위, 적용 프레임워크, 데이터 소스 매핑
 * - 리포트/엑셀 생성 시 공시 항목별 시트·컬럼 매핑
 */

export type GHGActiveScope = 'scope1' | 'scope2' | 'scope3';

/** 데이터 소스 타입: 사용량(활동자료) vs 배출량(산정 결과) */
export type DisclosureDataType = 'usage' | 'emissions';

/** 기간 단위 */
export type DisclosurePeriodUnit = 'monthly' | 'yearly';

/** 공시 항목 → Scope/데이터 소스/기간 매핑 (§1-5 매핑 테이블) */
export interface DisclosureDataMapping {
  /** 연관 Scope (월별 에너지는 scope1+scope2) */
  scopes: GHGActiveScope[];
  /** 사용량(활동자료) 또는 배출량(tCO₂e) */
  dataType: DisclosureDataType;
  /** 월별 / 연도별 */
  periodUnit: DisclosurePeriodUnit;
  /** 단위 라벨 (예: kWh, GJ, tCO₂e) */
  unitLabel: string;
}

/** 리포트 시트 정의: 공시 항목별 Excel 시트명·컬럼 */
export interface DisclosureReportSheet {
  /** Excel 시트명 (공시 항목별 시트) */
  sheetName: string;
  /** 컬럼 헤더 (시트 첫 행) */
  columns: string[];
}

/** 공시 항목 마스터 (데이터·리포트 레벨) — §1-5 전체 정의 */
export interface DisclosureItemMaster {
  id: string;
  /** 한글 표시명 */
  label: string;
  /** 단위 (공시·보고용) */
  unit: string;
  /** 적용 공시 프레임워크 (예: K-ESG, GRI, IFRS S2) — 프론트는 disclosure.ts FRAMEWORK_REQUIRED_ITEMS 참고 */
  applicableFrameworks: string[];
  /** 공시 항목 ID → Scope/에너지원·카테고리/기간 단위 매핑 */
  dataMapping: DisclosureDataMapping;
  /** 리포트 생성 시 이 항목에 대응하는 시트명·컬럼 */
  reportSheet: DisclosureReportSheet;
}

/** 공시 항목 마스터 목록 (데이터·리포트 레벨) */
export const DISCLOSURE_ITEM_MASTER: DisclosureItemMaster[] = [
  {
    id: 'monthly_energy',
    label: '월별 에너지 사용량 (Scope 1·2)',
    unit: 'kWh / GJ / Nm³ 등 (연료별)',
    applicableFrameworks: ['ISSB', 'KSSB', 'K-ETS', 'GRI', 'ESRS'],
    dataMapping: {
      scopes: ['scope1', 'scope2'],
      dataType: 'usage',
      periodUnit: 'monthly',
      unitLabel: 'kWh/GJ/Nm³',
    },
    reportSheet: {
      sheetName: '공시_월별에너지사용량',
      columns: ['연도', '구분', '1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월', '합계', '단위'],
    },
  },
  {
    id: 'scope1',
    label: 'Scope 1 배출량 (tCO₂e)',
    unit: 'tCO₂e',
    applicableFrameworks: ['ISSB', 'KSSB', 'K-ETS', 'GRI', 'ESRS'],
    dataMapping: {
      scopes: ['scope1'],
      dataType: 'emissions',
      periodUnit: 'monthly',
      unitLabel: 'tCO₂e',
    },
    reportSheet: {
      sheetName: '공시_Scope1_배출량',
      columns: ['연도', '구분', '1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월', '연간합계', '단위'],
    },
  },
  {
    id: 'scope2',
    label: 'Scope 2 배출량 (tCO₂e)',
    unit: 'tCO₂e',
    applicableFrameworks: ['ISSB', 'KSSB', 'K-ETS', 'GRI', 'ESRS'],
    dataMapping: {
      scopes: ['scope2'],
      dataType: 'emissions',
      periodUnit: 'monthly',
      unitLabel: 'tCO₂e',
    },
    reportSheet: {
      sheetName: '공시_Scope2_배출량',
      columns: ['연도', '구분', '1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월', '연간합계', '단위'],
    },
  },
  {
    id: 'scope3',
    label: 'Scope 3 배출량 (tCO₂e)',
    unit: 'tCO₂e',
    applicableFrameworks: ['ISSB', 'KSSB', 'GRI', 'ESRS'],
    dataMapping: {
      scopes: ['scope3'],
      dataType: 'emissions',
      periodUnit: 'monthly',
      unitLabel: 'tCO₂e',
    },
    reportSheet: {
      sheetName: '공시_Scope3_배출량',
      columns: ['연도', '구분', '1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월', '연간합계', '단위'],
    },
  },
];

/** 공시 항목 ID → 마스터 조회 */
export const DISCLOSURE_MASTER_BY_ID: Record<string, DisclosureItemMaster> = Object.fromEntries(
  DISCLOSURE_ITEM_MASTER.map((m) => [m.id, m])
);

/** 리포트 생성 시 공시 항목별 시트 설정 반환 */
export function getReportSheetConfig(itemId: string): DisclosureReportSheet | null {
  return DISCLOSURE_MASTER_BY_ID[itemId]?.reportSheet ?? null;
}

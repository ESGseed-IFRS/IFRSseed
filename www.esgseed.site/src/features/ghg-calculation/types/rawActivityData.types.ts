/**
 * ERP_DATA_DISCLOSURE_STRATEGY §5.1: 원시 활동자료 타입 정의
 * ERP/Excel에서 가져온 데이터와 수동 입력 데이터의 공통 구조
 */

export type RawDataScope = 'scope1' | 'scope2' | 'scope3';
export type RawDataSource = 'erp' | 'manual';
export type RawPeriodType = 'monthly' | 'yearly';

/** Scope 3 GHG Protocol 카테고리 ID */
export type Scope3CategoryId =
  | 'cat1'  // 구매 상품·서비스
  | 'cat2'  // 자본재
  | 'cat3'  // 연료·에너지 활동
  | 'cat4'  // 상류 수송·배송
  | 'cat5'  // 폐기물 처리
  | 'cat6'  // 업무 출장
  | 'cat7'  // 직원 통근
  | 'cat8'  // 리스 자산
  | 'cat9'  // 하류 수송·배송
  | 'cat10' // 판매 상품 가공
  | 'cat11' // 판매 상품 사용
  | 'cat12' // 판매 상품 폐기·처분
  | 'cat13' // 임대 자산
  | 'cat14' // 프랜차이즈
  | 'cat15'; // 투자

/** 원시 활동자료 행 (Scope 1/2: 연료/전력별, Scope 3: 카테고리별) */
export interface RawActivityRow {
  id: string;
  /** 연료 타입 (Scope 1/2) 또는 카테고리 (Scope 3) */
  fuelType?: string;
  energyType?: string;
  /** 사용량/금액/중량 등 */
  amount: number;
  unit: string;
  /** 데이터 출처 */
  source: RawDataSource;
  /** ERP 원본 레코드 ID (source=erp 시) */
  erpRefId?: string;
  /** §2.3 적용 배출계수 ID (산정 시 스냅샷) */
  appliedFactorId?: string;
  appliedFactorVersion?: string;
  appliedFactorValue?: number;
  metadata?: Record<string, unknown>;
}

/** 원시 활동자료 집합 (scope + category + period 단위) */
export interface RawActivityData {
  id: string;
  scope: RawDataScope;
  /** 예: stationary, mobile, electricity, scope3_cat1 */
  category: string;
  source: RawDataSource;
  periodType: RawPeriodType;
  /** 예: '2025-01', '2025' */
  periodValue: string;
  siteId?: string;
  rows: RawActivityRow[];
  createdAt?: number;
  updatedAt?: number;
}

/**
 * GHG 산정 관련 공통 타입 정의
 */

// 연료 타입
export type StationaryFuelKey = 'lng' | 'diesel' | 'gasoline' | 'lpg' | 'bunkerC' | 'anthracite';
export type MobileFuelKey = 'diesel' | 'gasoline';
export type ElectricityGridKey = 'kr_national';
export type HeatKey = 'provider_avg' | 'national_default' | 'lci_db' | 'kdhc';

// 단위 타입
export type ElectricityAmountUnit = 'kWh' | 'MWh';
export type ElectricityFactorMode = 'auto' | 'manual';
export type ElectricityFactorUnit = 't_per_MWh' | 'kg_per_kWh';
export type Scope2Step = 'location' | 'market' | 'compare';
export type Scope2FactorInputMode = 'grid' | 'custom';

// KDHC 관련 타입
export type KdhcYear = '2024';
export type KdhcBranchKey =
  | 'metropolitan_link'
  | 'cheongju'
  | 'sejong'
  | 'daegu'
  | 'yangsan'
  | 'gimhae'
  | 'gwangju_jeonnam'
  | 'pyeongtaek';

export type KdhcGasKey = 'CO2' | 'CH4' | 'N2O';
export type GwpPreset = 'AR6_fossil' | 'AR6_nonfossil' | 'AR5_fossil' | 'AR5_nonfossil' | 'custom';

// 권장 범위
export type RecommendedRangeKg = { min: number; max: number; unitLabel: string };

// 배출계수 아이템
export type FactorItem = {
  /** tCO2e / unit */
  factor: number;
  unit: string;
  label: string;
  /** 권장 범위(kgCO2e 기준) */
  recommendedKg?: RecommendedRangeKg;
  /** 근거/비고(요약) */
  note?: string;
};

// 연도별 배출계수
export type YearFactors = {
  stationary: Record<StationaryFuelKey, FactorItem>;
  mobile: Record<MobileFuelKey, FactorItem>;
  electricity: Record<ElectricityGridKey, FactorItem>;
  heat: Record<HeatKey, FactorItem>;
};

// Scope 2 Heat Row 타입
export type Scope2HeatRow =
  | {
      kind: 'standard';
      source: Exclude<HeatKey, 'kdhc'>;
      amount: number;
      amountUnit: 'GJ' | 'TJ';
      factorMode: 'preset' | 'manual';
      manualFactor?: number;
      manualFactorUnit?: 't_per_GJ' | 'kg_per_TJ';
    }
  | {
      kind: 'kdhc';
      year: KdhcYear;
      branch: KdhcBranchKey;
      amount: number;
      unit: 'GJ' | 'TJ';
      gwpPreset: GwpPreset;
      customGwpCh4?: number;
      customGwpN2o?: number;
    };

// Scope 2 Heat 저장된 항목
export type Scope2HeatSavedEntry =
  | {
      kind: 'kdhc';
      id: string;
      createdAt: number;
      year: KdhcYear;
      branch: KdhcBranchKey;
      unit: 'GJ' | 'TJ';
      amount: number;
      gwpPreset: GwpPreset;
      gwpCh4: number;
      gwpN2o: number;
      kgCo2ePerTj: number;
      tCo2ePerTj: number;
      tCo2ePerGj: number;
      tCo2e: number;
    }
  | {
      kind: 'standard';
      id: string;
      createdAt: number;
      source: Exclude<HeatKey, 'kdhc'>;
      amount: number;
      amountUnit: 'GJ' | 'TJ';
      factorTPerGJ: number;
      tCo2e: number;
      note: string;
    };

// 필터 상태 타입
export interface FilterState {
  /** 년도 선택 (단일 또는 범위) */
  year?: number;
  yearRange?: { start: number; end: number };
  /** 월 선택 (단일 또는 범위) */
  month?: number;
  monthRange?: { start: number; end: number };
  /** 사업장 (multi-select) */
  facilities: string[];
  /** 에너지원/연료 종류 (multi-select) */
  energySources: string[];
  /** Scope 타입 */
  scope: 'scope1' | 'scope2' | 'scope3';
  /** 시기 단위 (월별/분기별/연간) - GHG_EMS_Excel_Data_Strategy */
  periodType?: 'monthly' | 'quarterly' | 'yearly';
}

// 입수 채널 (EMS 연동 / 수동 입력 / 엑셀 업로드) - GHG_EMS_Excel_Data_Strategy
export type EmissionDataType = 'ems' | 'manual' | 'excel';

// 배출 데이터 타입
export interface EmissionData {
  id: string;
  /** 년도 */
  year: number;
  /** 월 */
  month: number;
  /** 사업장 */
  facility: string;
  /** 에너지원/연료 종류 */
  energySource: string;
  /** 사용량 */
  amount: number;
  /** 단위 */
  unit: string;
  /** 배출량 (tCO2e) */
  emissions: number;
  /** 입수 채널 (EMS/수동/엑셀) - GHG_EMS_Excel_Data_Strategy */
  dataType?: EmissionDataType;
  /** 생성일시 */
  createdAt: Date;
  /** 수정일시 */
  updatedAt?: Date;
  /** 데이터 품질·가정 (실측/추정/공급자 제공/기타, 추정방법, 가정사항) */
  dataQuality?: DataQuality;
}

// 엑셀 업로드 데이터 타입
export interface ExcelUploadData {
  /** 시트명 */
  sheetName: string;
  /** 데이터 행 */
  rows: Record<string, any>[];
  /** 필수 컬럼 검증 결과 */
  validation: {
    isValid: boolean;
    errors: string[];
    missingColumns: string[];
  };
}

// EMS 데이터 타입
export interface EMSData {
  /** 데이터 ID */
  id: string;
  /** 년도 */
  year: number;
  /** 월 */
  month: number;
  /** 사업장 */
  facility: string;
  /** 에너지원 */
  energySource: string;
  /** 사용량 */
  amount: number;
  /** 단위 */
  unit: string;
}

// 영수증 첨부 타입
export interface ReceiptAttachment {
  /** 파일 ID */
  id: string;
  /** 파일명 */
  fileName: string;
  /** 파일 크기 (bytes) */
  fileSize: number;
  /** 파일 타입 */
  fileType: string;
  /** 파일 URL (업로드 후) */
  fileUrl?: string;
  /** 미리보기 URL */
  previewUrl?: string;
  /** 업로드 일시 */
  uploadedAt: Date;
  /** 관련 항목 ID */
  relatedItemId?: string;
}

// === GHG Protocol 재설계 전략 (Boundary & Policy, Methodology, Data Quality) ===

/** 조직경계: GHG Protocol (전략서: 운영통제법/지분비율법/재무통제법) */
export type OrganizationBoundary = 'operational_control' | 'equity_share' | 'financial_control';

/** 보고 목적: K-ETS(국내) / 글로벌(CDP·RE100) 동시 대응 */
export interface ReportPurpose {
  kEts: boolean;
  global: boolean;
}

/** 운영경계 설명 (Scope 1/2 포함 기준) */
export interface OperationalBoundaryDesc {
  /** Scope 1: 멀티 선택 (연료 연소 + 공정 배출 동시 선택 가능) */
  scope1Included: string[];
  /** Scope 2: 위치 기반 / 시장 기반 / 동시 산정 */
  scope2Included: string;
}

/** 산정 설정 (Boundary & Policy Layer) - GHG Protocol 준수 증명 */
export interface BoundaryPolicy {
  /** 보고 목적: K-ETS 및/또는 글로벌 (Dual Compliance) */
  reportPurpose?: ReportPurpose;
  /** 조직경계: 운영통제법 / 지분비율법 */
  organizationBoundary: OrganizationBoundary;
  /** 운영경계 설명 */
  operationalBoundary: OperationalBoundaryDesc;
  /** 보고연도 */
  reportingYear: number;
  /** 기준 가이드라인 (요약) */
  guideline: string;
  /** 적용 기준 버전 (세부) - e.g. GHG Protocol Corporate Standard Revised Edition (2004) + Scope 2 Guidance (2015) */
  guidelineVersion?: string;
  /** EF DB 버전 명시 - e.g. 환경부 국가 온실가스 배출계수 (2025 버전, 업데이트: 2025-12) */
  efDbVersion?: string;
}

/** 재생에너지 이행 실적 (Scope 2 시장 기반·RE100 대응) */
export interface RenewablePerformance {
  /** 녹색프리미엄 (K-ETS 미반영, RE100 시 0kg 처리) */
  greenPremiumKwh: number;
  /** REC(재생에너지 공급인증서) 구매량 kWh */
  recKwh: number;
  /** PPA(제3자/직접) kWh */
  ppaKwh: number;
  /** 자가발전(On-site) 소비분 kWh */
  onsiteKwh: number;
  /** EAC 인증서 번호 (선택, 2027 RE100 대비) */
  eacCertificateNo?: string;
  /** EAC 유효기간 (선택) */
  eacValidUntil?: string;
}

/** 산정 방식 메타 (Methodology Layer) - 감사 대응 */
export interface MethodologyInfo {
  methodologyId: string;
  guideline: string;
  method: string;
  /** 산식 명시 - e.g. CO₂ = 사용량 × EF × GWP */
  formula?: string;
  efSource: string;
  gwp: string;
  version: string;
}

/** 데이터 유형: 실측/추정/공급자 제공/기타 (Data Quality Layer) */
export type DataQualityType = 'measured' | 'estimated' | 'supplier' | 'other';

/** 데이터 품질 및 가정 (ISO 14064-1, IFRS S2 검증용) */
export interface DataQuality {
  /** 데이터 유형 */
  dataType: DataQualityType;
  /** 추정 방법 (추정 선택 시) */
  estimationMethod?: string;
  /** 가정 사항 (자유 텍스트) */
  assumptions?: string;
}

// Scope별 폼 데이터 타입
export interface Scope1FormData {
  /** 고정연소 데이터 */
  stationary: EmissionData[];
  /** 이동연소 데이터 */
  mobile: EmissionData[];
}

export interface Scope2FormData {
  /** 전력 사용 데이터 */
  electricity: EmissionData[];
  /** 열/스팀/온수 데이터 */
  heat: Scope2HeatRow[];
  /** 재생에너지 이행 실적 (시장 기반·RE100 시 조건부 노출) */
  renewablePerformance?: RenewablePerformance;
}

export interface Scope3FormData {
  /** Scope 3 카테고리별 데이터 */
  categories: {
    category: string;
    data: EmissionData[];
    receipts?: ReceiptAttachment[];
  }[];
}

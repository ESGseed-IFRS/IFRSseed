// GHG 관련 타입 정의

/** 법인 키 — 산정 결과·감사 mock·세션에서 공통 사용 */
export type GhgLegalEntityId =
  | 'miracom'
  | 'secui'
  | 'score'
  | 'multicam'
  | 'emro'
  | 'openhands';

export type Framework = 'ISSB' | 'KSSB' | 'K-ETS' | 'GRI' | 'ESRS';

export type Scope = 'scope1' | 'scope2' | 'scope3';

export type MainTab = 'calc' | 'audit' | 'report';

/** Raw Data 대분류 (사이드바 6개) */
export type RawDataCategory = 'energy' | 'waste' | 'pollution' | 'chemical' | 'energy-provider' | 'consignment';

export type InputTabId = 'power' | 'fuel' | 'refrigerant' | 'waste' | 'logistics' | 'material';

/** 통합 감사 추적 단일 화면 — 결재는 대시보드 통합 결재함 */
export type AuditMenuId = 'unified';

// Raw Data 타입
export interface EnergyData {
  id: number;
  facility: string;
  energyType: string;
  unit: string;
  jan: string;
  feb: string;
  mar: string;
  apr: string;
  may: string;
  jun: string;
  jul: string;
  aug: string;
  sep: string;
  oct: string;
  nov: string;
  dec: string;
  total: string;
  source: 'manual' | 'if';
  status: 'confirmed' | 'draft' | 'error';
}

export interface WasteData {
  id: number;
  facility: string;
  wasteType: string;
  disposalMethod: string;
  unit: string;
  jan: string;
  feb: string;
  mar: string;
  apr: string;
  may: string;
  jun: string;
  jul: string;
  aug: string;
  sep: string;
  oct: string;
  nov: string;
  dec: string;
  /** 연간(1~12월) 합계 */
  total: string;
  vendor: string;
  status: 'confirmed' | 'draft' | 'error';
}

export interface PollutionData {
  id: number;
  facility: string;
  outletName: string;
  pollutant: string;
  unit: string;
  jan: string;
  feb: string;
  mar: string;
  apr: string;
  may: string;
  jun: string;
  jul: string;
  aug: string;
  sep: string;
  oct: string;
  nov: string;
  dec: string;
  /** 해당 연도 12개월 산술평균(표시용) */
  avg: string;
  legalLimit: string;
  status: 'normal' | 'warning' | 'exceed';
}

export interface ChemicalData {
  id: number;
  facility: string;
  chemicalName: string;
  casNo: string;
  unit: string;
  jan: string;
  feb: string;
  mar: string;
  apr: string;
  may: string;
  jun: string;
  jul: string;
  aug: string;
  sep: string;
  oct: string;
  nov: string;
  dec: string;
  /** 연간(1~12월) 합계 */
  total: string;
  hazardClass: string;
  status: 'confirmed' | 'draft';
}

export interface EnergyProviderData {
  id: number;
  providerName: string;
  energyType: string;
  contractNo: string;
  supplyStart: string;
  supplyEnd: string;
  renewableRatio: string;
  certNo: string;
  status: 'active' | 'expired' | 'pending';
}

export interface ConsignmentData {
  id: number;
  vendorName: string;
  bizNo: string;
  wasteType: string;
  permitNo: string;
  permitExpiry: string;
  contractStart: string;
  contractEnd: string;
  status: 'active' | 'expired';
}

// 산정 결과 타입
export interface EmissionResult {
  scope: Scope;
  category: string;
  items: EmissionItem[];
  total: number;
  unit: string;
}

export interface EmissionItem {
  name: string;
  facility: string;
  unit: string;
  total: number;
  ef: string;
  efSource: string;
  yoy: number;
  status: 'confirmed' | 'draft' | 'warning';
}

// Total Inventory 타입
export interface TotalInventory {
  scope1: number;
  scope2: number;
  scope3: number;
  total: number;
  unit: string;
}

// 히스토리 타입
export interface CalculationHistory {
  id: string;
  version: string;
  createdAt: string;
  createdBy: string;
  description: string;
  total: number;
}

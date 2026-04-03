/**
 * GHG_UX_REDESIGN_SPEC_1 §2: 탭 진입 시 더미데이터 자동 로드
 * 각 탭별로 해당 CSV 형식에 맞는 Mock 데이터 생성
 */
import type { EmissionData } from '../types/ghg.types';
import type { EvidenceInputTabId } from '../constants/evidenceInputMapping';

const facilities = ['서울본사', '수원공장', '구미공장', '판교연구소', '부산물류'];
const year = new Date().getFullYear();

function createId(prefix: string, i: number) {
  return `${prefix}-${Date.now()}-${i}`;
}

const ELEC_FACTOR = 0.0004173; // tCO2e/kWh (2024 kr_national)
const LNG_FACTOR = 0.002247; // tCO2e/Nm³
const DIESEL_FACTOR = 0.00262; // tCO2e/L

/** 전력·열·스팀 — EMS_ENERGY_USAGE.csv (~240행) */
export function getDummyPowerHeat(): { electricity: EmissionData[] } {
  const rows: EmissionData[] = [];
  let idx = 0;
  for (const site of facilities) {
    for (let m = 1; m <= 12; m++) {
      const amount = 80000 + Math.floor(Math.random() * 100000);
      rows.push({
        id: createId('ems-e', idx++),
        year,
        month: m,
        facility: site,
        energySource: '전력',
        amount,
        unit: 'kWh',
        emissions: amount * ELEC_FACTOR,
        dataType: 'ems',
        createdAt: new Date(),
      });
    }
  }
  for (const site of facilities.slice(0, 3)) {
    for (let m = 1; m <= 12; m++) {
      const amount = 2000 + Math.floor(Math.random() * 2000);
      rows.push({
        id: createId('ems-h', idx++),
        year,
        month: m,
        facility: site,
        energySource: '열',
        amount,
        unit: 'Gcal',
        emissions: amount * 0.00025,
        dataType: 'ems',
        createdAt: new Date(),
      });
    }
  }
  return { electricity: rows };
}

/** 연료·차량 — ERP_FUEL_PURCHASE.csv (~180행) */
export function getDummyFuelVehicle(): {
  stationary: EmissionData[];
  mobile: EmissionData[];
} {
  const stationary: EmissionData[] = [];
  const mobile: EmissionData[] = [];
  let idx = 0;
  for (const site of facilities) {
    for (let m = 1; m <= 12; m++) {
      const amount = 5000 + Math.floor(Math.random() * 10000);
      stationary.push({
        id: createId('erp-s', idx++),
        year,
        month: m,
        facility: site,
        energySource: 'lng',
        amount,
        unit: 'Nm³',
        emissions: amount * LNG_FACTOR,
        dataType: 'ems',
        createdAt: new Date(),
      });
    }
  }
  for (const site of facilities) {
    for (let m = 1; m <= 12; m++) {
      const amount = 500 + Math.floor(Math.random() * 1500);
      mobile.push({
        id: createId('erp-m', idx++),
        year,
        month: m,
        facility: site,
        energySource: 'diesel',
        amount,
        unit: 'L',
        emissions: amount * DIESEL_FACTOR,
        dataType: 'ems',
        createdAt: new Date(),
      });
    }
  }
  return { stationary, mobile };
}

/** 탭 ID별 더미 데이터 로드 — 데이터가 없을 때만 로드 (덮어쓰지 않음) */
export function loadDummyForTabIfEmpty(
  tabId: EvidenceInputTabId,
  scope1: { stationary: EmissionData[]; mobile: EmissionData[] },
  scope2: { electricity: EmissionData[]; heat: unknown[]; renewablePerformance?: unknown },
  setScope1: (d: { stationary: EmissionData[]; mobile: EmissionData[] }) => void,
  setScope2: (d: typeof scope2) => void
) {
  if (tabId === 'power' && scope2.electricity.length === 0) {
    const { electricity } = getDummyPowerHeat();
    setScope2({ ...scope2, electricity });
  } else if (tabId === 'fuel' && scope1.stationary.length === 0 && scope1.mobile.length === 0) {
    const { stationary, mobile } = getDummyFuelVehicle();
    setScope1({ stationary, mobile });
  }
}

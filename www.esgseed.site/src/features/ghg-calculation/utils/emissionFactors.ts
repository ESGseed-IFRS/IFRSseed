'use client';

/**
 * 배출계수/계산 유틸
 *
 * 목적:
 * - `GhgCalculationPage22.tsx`에 있던 "계산이 되는" 경험을 `src/features/ghg-calculation`로 이식
 * - 디자인은 유지하고, 계산/플로우만 복원
 *
 * 단위 주의:
 * - 아래 factor는 기본적으로 tCO2e / unit 로 저장합니다.
 */

import type {
  ElectricityGridKey,
  FactorItem,
  GwpPreset,
  HeatKey,
  KdhcBranchKey,
  KdhcGasKey,
  KdhcYear,
  MobileFuelKey,
  StationaryFuelKey,
  YearFactors,
} from '../types/ghg.types';

// 일부 대표값(샘플). 실제 운영 시 국가고시/전력거래소/공급자 데이터로 교체 권장.
export const EMISSION_FACTOR_DB: Record<'2024' | '2023', YearFactors> = {
  '2024': {
    stationary: {
      lng: { factor: 0.002247, unit: 'Nm³', label: '도시가스(LNG)', recommendedKg: { min: 2.2, max: 2.27, unitLabel: 'kgCO2e/Nm³' } },
      diesel: { factor: 0.00262, unit: 'L', label: '경유', recommendedKg: { min: 2.58, max: 2.68, unitLabel: 'kgCO2e/L' } },
      gasoline: { factor: 0.002345, unit: 'L', label: '휘발유', recommendedKg: { min: 2.31, max: 2.38, unitLabel: 'kgCO2e/L' } },
      lpg: { factor: 0.003027, unit: 'kg', label: 'LPG', recommendedKg: { min: 3.0, max: 3.05, unitLabel: 'kgCO2e/kg' } },
      bunkerC: { factor: 3.114, unit: 'ton', label: '벙커유(중유)', note: '대표값(샘플). 운영 시 연료 규격/발열량에 맞춰 교체 권장.' },
      anthracite: { factor: 2.500, unit: 'ton', label: '무연탄', note: '대표값(샘플). 운영 시 연료 규격/발열량에 맞춰 교체 권장.' },
    },
    mobile: {
      diesel: { factor: 0.00262, unit: 'L', label: '경유(차량)' },
      gasoline: { factor: 0.002345, unit: 'L', label: '휘발유(차량)' },
    },
    electricity: {
      // tCO2e / kWh (샘플). 한국 그리드 배출계수는 연도별로 변동.
      kr_national: { factor: 0.0004173, unit: 'kWh', label: '전력(국가그리드)', note: '0.4173 t/MWh → 0.0004173 t/kWh' },
    },
    heat: {
      // tCO2e / GJ (샘플)
      provider_avg: { factor: 0.05, unit: 'GJ', label: '공급자 평균값(샘플)' },
      national_default: { factor: 0.05, unit: 'GJ', label: '국가고유/IPCC default(샘플)' },
      lci_db: { factor: 0.05, unit: 'GJ', label: 'LCI DB/IPCC 2006(샘플)' },
      kdhc: { factor: 0, unit: 'GJ', label: 'KDHC(계산식 적용)' },
    },
  },
  '2023': {
    stationary: {
      lng: { factor: 0.00224, unit: 'Nm³', label: '도시가스(LNG)' },
      diesel: { factor: 0.00262, unit: 'L', label: '경유' },
      gasoline: { factor: 0.002345, unit: 'L', label: '휘발유' },
      lpg: { factor: 0.003027, unit: 'kg', label: 'LPG' },
      bunkerC: { factor: 3.114, unit: 'ton', label: '벙커유(중유)' },
      anthracite: { factor: 2.500, unit: 'ton', label: '무연탄' },
    },
    mobile: {
      diesel: { factor: 0.00262, unit: 'L', label: '경유(차량)' },
      gasoline: { factor: 0.002345, unit: 'L', label: '휘발유(차량)' },
    },
    electricity: {
      kr_national: { factor: 0.0004173, unit: 'kWh', label: '전력(국가그리드)' },
    },
    heat: {
      provider_avg: { factor: 0.05, unit: 'GJ', label: '공급자 평균값(샘플)' },
      national_default: { factor: 0.05, unit: 'GJ', label: '국가고유/IPCC default(샘플)' },
      lci_db: { factor: 0.05, unit: 'GJ', label: 'LCI DB/IPCC 2006(샘플)' },
      kdhc: { factor: 0, unit: 'GJ', label: 'KDHC(계산식 적용)' },
    },
  },
};

export const GWP_PRESETS: Record<Exclude<GwpPreset, 'custom'>, { label: string; ch4: number; n2o: number }> = {
  AR6_fossil: { label: 'AR6(100년) · CH4=30(화석) · N2O=273', ch4: 30, n2o: 273 },
  AR6_nonfossil: { label: 'AR6(100년) · CH4=27(비화석) · N2O=273', ch4: 27, n2o: 273 },
  AR5_fossil: { label: 'AR5(100년) · CH4=30(화석) · N2O=265', ch4: 30, n2o: 265 },
  AR5_nonfossil: { label: 'AR5(100년) · CH4=28(비화석) · N2O=265', ch4: 28, n2o: 265 },
};

// KDHC(한국지역난방공사) 지사별 배출계수 (kg/TJ) - Page22 데이터 이식
export const KDHC_EF_KG_PER_TJ: Record<KdhcYear, Record<KdhcGasKey, Record<KdhcBranchKey, number>>> = {
  '2024': {
    CO2: {
      metropolitan_link: 35058,
      cheongju: 56642,
      sejong: 42672,
      daegu: 48249,
      yangsan: 35444,
      gimhae: 35747,
      gwangju_jeonnam: 34068,
      pyeongtaek: 15717,
    },
    CH4: {
      metropolitan_link: 0.634,
      cheongju: 1.4574,
      sejong: 0.7667,
      daegu: 2.5138,
      yangsan: 0.6346,
      gimhae: 0.6372,
      gwangju_jeonnam: 16.9847,
      pyeongtaek: 0.3793,
    },
    N2O: {
      metropolitan_link: 0.064,
      cheongju: 0.2295,
      sejong: 0.0767,
      daegu: 0.3705,
      yangsan: 0.0635,
      gimhae: 0.0637,
      gwangju_jeonnam: 2.2506,
      pyeongtaek: 0.0301,
    },
  },
};

export function calcSimple(amount: number, factorTPerUnit: number): number {
  if (!Number.isFinite(amount) || !Number.isFinite(factorTPerUnit)) return 0;
  if (amount <= 0 || factorTPerUnit <= 0) return 0;
  return parseFloat((amount * factorTPerUnit).toFixed(6));
}

export function calcScope1Stationary(amount: number, fuel: StationaryFuelKey, year: '2024' | '2023'): number {
  const factor = EMISSION_FACTOR_DB[year].stationary[fuel].factor;
  return calcSimple(amount, factor);
}

export function calcScope1Mobile(amount: number, fuel: MobileFuelKey, year: '2024' | '2023'): number {
  const factor = EMISSION_FACTOR_DB[year].mobile[fuel].factor;
  return calcSimple(amount, factor);
}

export function calcScope2Electricity(amount: number, unit: 'kWh' | 'MWh', grid: ElectricityGridKey, year: '2024' | '2023'): number {
  const factorTPerKwh = EMISSION_FACTOR_DB[year].electricity[grid].factor; // t/kWh
  const amountKwh = unit === 'MWh' ? amount * 1000 : amount;
  return calcSimple(amountKwh, factorTPerKwh);
}

export function calcHeatStandard(amount: number, amountUnit: 'GJ' | 'TJ', factorTPerGJ: number): number {
  const gj = amountUnit === 'TJ' ? amount * 1000 : amount;
  return calcSimple(gj, factorTPerGJ);
}

export function calcHeatKDHC(params: {
  year: KdhcYear;
  branch: KdhcBranchKey;
  amount: number;
  unit: 'GJ' | 'TJ';
  gwpPreset: GwpPreset;
  customGwpCh4?: number;
  customGwpN2o?: number;
}): { tCo2e: number; tCo2ePerTJ: number; note: string } {
  const { year, branch, amount, unit, gwpPreset, customGwpCh4, customGwpN2o } = params;
  const ef = KDHC_EF_KG_PER_TJ[year];
  const co2 = ef.CO2[branch];
  const ch4 = ef.CH4[branch];
  const n2o = ef.N2O[branch];

  const gwp =
    gwpPreset === 'custom'
      ? { ch4: customGwpCh4 || 0, n2o: customGwpN2o || 0 }
      : GWP_PRESETS[gwpPreset];

  // kgCO2e/TJ = CO2 + CH4*GWP + N2O*GWP
  const kgCo2ePerTj = co2 + ch4 * gwp.ch4 + n2o * gwp.n2o;
  const tCo2ePerTj = kgCo2ePerTj / 1000;

  const amountTj = unit === 'GJ' ? amount / 1000 : amount;
  const tCo2e = calcSimple(amountTj, tCo2ePerTj);
  return {
    tCo2e,
    tCo2ePerTJ: tCo2ePerTj,
    note: 'KDHC 지사별 kg/TJ + GWP 적용',
  };
}

export function tryMapScope1FuelKey(input: string): StationaryFuelKey | MobileFuelKey | null {
  const v = input.toLowerCase();
  if (v.includes('lng') || v.includes('도시가스')) return 'lng';
  if (v.includes('경유') || v.includes('diesel')) return 'diesel';
  if (v.includes('휘발유') || v.includes('gasoline')) return 'gasoline';
  if (v === 'lpg' || v.includes('lpg')) return 'lpg';
  if (v.includes('벙커') || v.includes('bunker')) return 'bunkerC';
  if (v.includes('무연탄') || v.includes('anthracite')) return 'anthracite';
  return null;
}


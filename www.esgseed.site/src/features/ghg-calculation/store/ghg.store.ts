'use client';

import { create } from 'zustand';
import type {
  BoundaryPolicy,
  EMSData,
  ExcelUploadData,
  FilterState,
  Scope1FormData,
  Scope2FormData,
  Scope3FormData,
} from '../types/ghg.types';

export type GHGActiveScope = 'scope1' | 'scope2' | 'scope3';
export type GHGMainTab = 'engine' | 'report';
export type GHGFactorYear = '2024' | '2023';

/** STEP_DETAIL: Scope 1 서브탭 (고정 연소 / 이동 연소) */
export type GHGScope1SubTab = 'stationary' | 'mobile';

/** STEP_DETAIL: Scope 2 서브탭 (전력 / 열/스팀/온수) */
export type GHGScope2SubTab = 'electricity' | 'heat';

/** STEP_DETAIL: RAW vs 탄소 배출량 화면 모드 */
export type GHGDataViewMode = 'raw' | 'emission';

export type GHGHistoryItem = {
  id: string;
  savedAt: number;
  label: string;
  scope1: Scope1FormData;
  scope2: Scope2FormData;
  scope3: Scope3FormData;
};

const defaultBoundaryPolicy: BoundaryPolicy = {
  reportPurpose: { kEts: true, global: true },
  organizationBoundary: 'operational_control',
  operationalBoundary: {
    scope1Included: ['직접 연료 연소 포함'],
    scope2Included: '위치 기반 & 시장 기반 동시 산정',
  },
  reportingYear: new Date().getFullYear(),
  guideline: 'GHG Protocol Corporate Standard (2004 + Scope 3 Guidance 보완)',
  guidelineVersion: 'GHG Protocol Corporate Standard Revised Edition (2004) + Scope 2 Guidance (2015)',
  efDbVersion: '환경부 국가 온실가스 배출계수 (2025 버전, 업데이트: 2025-12)',
};

const BOUNDARY_STORAGE_KEY = 'ghg.boundaryPolicy.v1';

function loadBoundaryFromStorage(): BoundaryPolicy | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(BOUNDARY_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BoundaryPolicy & { operationalBoundary?: { scope1Included?: string | string[] } };
    if (!parsed || typeof parsed.reportingYear !== 'number') return null;
    // 마이그레이션: scope1Included string → string[]
    const ob = parsed.operationalBoundary;
    if (ob && !Array.isArray(ob.scope1Included)) {
      parsed.operationalBoundary = {
        ...ob,
        scope1Included: ob.scope1Included ? [ob.scope1Included as string] : ['직접 연료 연소 포함'],
      };
    }
    if (!parsed.reportPurpose) parsed.reportPurpose = { kEts: true, global: true };
    if (!ob?.scope2Included) {
      parsed.operationalBoundary = { ...parsed.operationalBoundary, scope2Included: '위치 기반 & 시장 기반 동시 산정' };
    }
    return parsed as BoundaryPolicy;
  } catch {
    return null;
  }
}

function saveBoundaryToStorage(policy: BoundaryPolicy) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(BOUNDARY_STORAGE_KEY, JSON.stringify(policy));
  } catch {
    // ignore
  }
}

type GHGState = {
  mainTab: GHGMainTab;
  activeScope: GHGActiveScope;
  factorYear: GHGFactorYear;

  /** STEP_DETAIL: Scope 1 서브탭 */
  scope1SubTab: GHGScope1SubTab;
  /** STEP_DETAIL: Scope 2 서브탭 */
  scope2SubTab: GHGScope2SubTab;
  /** STEP_DETAIL: RAW vs 탄소 배출량 화면 모드 */
  dataViewMode: GHGDataViewMode;

  /** 산정 설정 (Boundary & Policy) - GHG Protocol 준수 증명 */
  boundaryPolicy: BoundaryPolicy;

  facilities: string[];
  /** 레거시: scope1 고정+이동 합친 목록 */
  scope1EnergySources: string[];
  /** 레거시: scope2 전력+열 합친 목록 */
  scope2EnergySources: string[];

  filtersByScope: Record<GHGActiveScope, FilterState>;
  /** STEP_DETAIL: 조회 버튼 클릭 시에만 적용되는 필터 (그리드에 사용) */
  appliedFiltersByScope: Record<GHGActiveScope, FilterState | null>;
  scope1: Scope1FormData;
  scope2: Scope2FormData;
  scope3: Scope3FormData;

  history: GHGHistoryItem[];

  /** SCOPE1,2_DETAIL §0: 단계별 위저드(1→2→3). key: 'scope1-stationary' | 'scope1-mobile' | 'scope2-electricity' | 'scope2-heat' | 'scope3' */
  wizardStepByKey: Record<string, 1 | 2 | 3>;
  setWizardStep: (key: string, step: 1 | 2 | 3) => void;

  /** GHG_UX_REDESIGN_SPEC_1: 탭별 스텝 플로우 (1=데이터확인, 2=산정실행, 3=결과확인) */
  tabStepByTabId: Record<string, 1 | 2 | 3>;
  setTabStep: (tabId: string, step: 1 | 2 | 3) => void;

  setBoundaryPolicy: (policy: BoundaryPolicy) => void;
  setFacilities: (facilities: string[]) => void;

  setMainTab: (tab: GHGMainTab) => void;
  setActiveScope: (scope: GHGActiveScope) => void;
  setScope1SubTab: (tab: GHGScope1SubTab) => void;
  setScope2SubTab: (tab: GHGScope2SubTab) => void;
  setDataViewMode: (mode: GHGDataViewMode) => void;
  setFactorYear: (year: GHGFactorYear) => void;
  setFilters: (scope: GHGActiveScope, filters: FilterState) => void;
  /** STEP_DETAIL: 조회 버튼 클릭 시 현재 필터를 적용 */
  applyFilters: (scope: GHGActiveScope) => void;
  /** STEP_DETAIL: 초기화 시 적용 필터 해제 */
  clearAppliedFilters: (scope: GHGActiveScope) => void;

  setScope1: (data: Scope1FormData) => void;
  setScope2: (data: Scope2FormData) => void;
  setScope3: (data: Scope3FormData) => void;

  saveSnapshot: (label?: string) => void;
  clearHistory: () => void;
};

const defaultFacilities = ['본사', '공장A', '공장B', '지점1', '지점2'];
/** STEP_DETAIL: Scope 1 고정 연소 에너지원 */
const defaultScope1StationarySources = ['도시가스(LNG)', '경유', '휘발유', 'LPG', '벙커유', '무연탄'];
/** STEP_DETAIL: Scope 1 이동 연소 에너지원 */
const defaultScope1MobileSources = ['경유(차량)', '휘발유(차량)'];
/** STEP_DETAIL: Scope 2 전력 에너지원 */
const defaultScope2ElectricitySources = ['전력'];
/** STEP_DETAIL: Scope 2 열 에너지원 */
const defaultScope2HeatSources = ['열/스팀/온수', '열(표준)', 'KDHC'];

const FACILITIES_STORAGE_KEY = 'ghg.facilities.v1';

function normalizeFacilities(list: string[]) {
  const cleaned = list.map((x) => String(x ?? '').trim()).filter((x) => x.length > 0);
  // 중복 제거(순서 유지)
  return cleaned.filter((x, i) => cleaned.indexOf(x) === i);
}

function loadFacilitiesFromStorage(): string[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(FACILITIES_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const normalized = normalizeFacilities(parsed as any[]);
    return normalized.length > 0 ? normalized : null;
  } catch {
    return null;
  }
}

function saveFacilitiesToStorage(list: string[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(FACILITIES_STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }
}

function pruneFiltersFacilities(filters: FilterState, allowed: string[]): FilterState {
  return { ...filters, facilities: filters.facilities.filter((f) => allowed.includes(f)) };
}

function createDefaultFilters(scope: GHGActiveScope): FilterState {
  return {
    facilities: [],
    energySources: [],
    scope,
    year: new Date().getFullYear(),
    periodType: 'monthly',
  };
}

export const useGHGStore = create<GHGState>((set, get) => ({
  mainTab: 'engine',
  activeScope: 'scope1',
  factorYear: '2024',
  scope1SubTab: 'stationary',
  scope2SubTab: 'electricity',
  dataViewMode: 'raw',

  boundaryPolicy: loadBoundaryFromStorage() || defaultBoundaryPolicy,

  facilities: loadFacilitiesFromStorage() || defaultFacilities,
  scope1EnergySources: [...defaultScope1StationarySources, ...defaultScope1MobileSources],
  scope2EnergySources: [...defaultScope2ElectricitySources, ...defaultScope2HeatSources],

  filtersByScope: {
    scope1: createDefaultFilters('scope1'),
    scope2: createDefaultFilters('scope2'),
    scope3: createDefaultFilters('scope3'),
  },
  appliedFiltersByScope: { scope1: null, scope2: null, scope3: null },

  scope1: { stationary: [], mobile: [] },
  scope2: {
    electricity: [],
    heat: [],
    renewablePerformance: { greenPremiumKwh: 0, recKwh: 0, ppaKwh: 0, onsiteKwh: 0 },
  },
  scope3: { categories: [] },

  history: [],

  wizardStepByKey: {},
  setWizardStep: (key, step) =>
    set((state) => ({ wizardStepByKey: { ...state.wizardStepByKey, [key]: step } })),

  tabStepByTabId: {},
  setTabStep: (tabId, step) =>
    set((state) => ({ tabStepByTabId: { ...state.tabStepByTabId, [tabId]: step } })),

  setFacilities: (facilities) => {
    const nextFacilities = normalizeFacilities(facilities);
    const fallback = nextFacilities[0] || '';

    saveFacilitiesToStorage(nextFacilities);

    set((state) => {
      const nextFiltersByScope = {
        scope1: pruneFiltersFacilities(state.filtersByScope.scope1, nextFacilities),
        scope2: pruneFiltersFacilities(state.filtersByScope.scope2, nextFacilities),
        scope3: pruneFiltersFacilities(state.filtersByScope.scope3, nextFacilities),
      };

      const fixFacility = (v: string) => (v && nextFacilities.includes(v) ? v : fallback);

      const scope1: Scope1FormData = {
        stationary: state.scope1.stationary.map((r) => ({ ...r, facility: fixFacility(r.facility) })),
        mobile: state.scope1.mobile.map((r) => ({ ...r, facility: fixFacility(r.facility) })),
      };

      const scope2: Scope2FormData = {
        ...state.scope2,
        electricity: state.scope2.electricity.map((r) => ({ ...r, facility: fixFacility(r.facility) })),
      };

      return { facilities: nextFacilities, filtersByScope: nextFiltersByScope, scope1, scope2 };
    });
  },

  setBoundaryPolicy: (policy) => {
    saveBoundaryToStorage(policy);
    set({ boundaryPolicy: policy });
  },
  setMainTab: (tab) => set({ mainTab: tab }),
  setActiveScope: (scope) => set({ activeScope: scope }),
  setScope1SubTab: (scope1SubTab) => set({ scope1SubTab }),
  setScope2SubTab: (scope2SubTab) => set({ scope2SubTab }),
  setDataViewMode: (dataViewMode) => set({ dataViewMode }),
  setFactorYear: (year) => set({ factorYear: year }),
  setFilters: (scope, filters) =>
    set((state) => ({ filtersByScope: { ...state.filtersByScope, [scope]: filters } })),
  applyFilters: (scope) =>
    set((state) => ({
      appliedFiltersByScope: {
        ...state.appliedFiltersByScope,
        [scope]: { ...state.filtersByScope[scope] },
      },
    })),
  clearAppliedFilters: (scope) =>
    set((state) => ({
      appliedFiltersByScope: { ...state.appliedFiltersByScope, [scope]: null },
    })),

  setScope1: (data) => set({ scope1: data }),
  setScope2: (data) => set({ scope2: data }),
  setScope3: (data) => set({ scope3: data }),

  saveSnapshot: (label) => {
    const now = Date.now();
    const item: GHGHistoryItem = {
      id: `ghg-h-${now}-${Math.random().toString(36).slice(2, 9)}`,
      savedAt: now,
      label: label || new Date(now).toLocaleString('ko-KR'),
      scope1: structuredClone(get().scope1),
      scope2: structuredClone(get().scope2),
      scope3: structuredClone(get().scope3),
    };
    set((state) => ({ history: [item, ...state.history].slice(0, 20) }));
  },

  clearHistory: () => set({ history: [] }),
}));


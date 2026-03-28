/**
 * HoldingDashboard.jsx 참고 — 지주사 오버뷰·GHG 탭용 목 데이터
 */

export const HOLDING_DASH_YEARS = ['2022', '2023', '2024'] as const;

/** SR 보고서 연도별 제출·승인 (지주 취합) */
export const HOLDING_SR_HISTORY_YEAR: Record<
  string,
  { submitted: number; approved: number; rejected: number; totalCos: number }
> = {
  '2022': { submitted: 7, approved: 6, rejected: 1, totalCos: 10 },
  '2023': { submitted: 8, approved: 7, rejected: 1, totalCos: 10 },
  '2024': { submitted: 8, approved: 5, rejected: 2, totalCos: 10 },
};

/** GHG 연도별 Scope 합계 (tCO₂eq) — HoldingDashboard.jsx GHG_HISTORY 와 동일 계열 */
export const HOLDING_GHG_HISTORY_YEAR: Record<string, { scope1: number; scope2: number; scope3: number }> = {
  '2022': { scope1: 42800, scope2: 31200, scope3: 118600 },
  '2023': { scope1: 40100, scope2: 28900, scope3: 112300 },
  '2024': { scope1: 37600, scope2: 26400, scope3: 107800 },
};

/** 계열사별 SR 진행 (2024 기준 요약) */
export const HOLDING_OVERVIEW_SR_BY_AFF = [
  { id: 'm1', short: '미라콤', submitted: 8, approved: 7, rejected: 0, total: 8, lastAt: '25.03.25' },
  { id: 'm2', short: '시큐아이', submitted: 6, approved: 4, rejected: 0, total: 8, lastAt: '25.03.24' },
  { id: 'm3', short: '에스코어', submitted: 8, approved: 8, rejected: 0, total: 8, lastAt: '25.03.23' },
  { id: 'm4', short: '멀티캠', submitted: 5, approved: 2, rejected: 2, total: 8, lastAt: '25.03.20' },
  { id: 'm5', short: '엠로', submitted: 8, approved: 8, rejected: 0, total: 8, lastAt: '25.03.25' },
  { id: 'm6', short: '오픈핸즈', submitted: 0, approved: 0, rejected: 0, total: 8, lastAt: '-' },
];

export type HoldingGhgOrgKind = 'subsidiary' | 'domestic_site';

/** GHG 산정 탭 — 자회사(계열사) + 국내 사업장(데이터센터·캠퍼스 등) 통합 행 */
export type HoldingGhgOrgRow = {
  id: string;
  kind: HoldingGhgOrgKind;
  /** 국내 사업장일 때만: 데이터센터 / 캠퍼스 / R&D·HQ 등 */
  siteCategory?: string;
  name: string;
  short: string;
  scope1: number;
  scope2: number;
  scope3: number;
  verified: boolean;
  submitted: boolean;
  approved: boolean;
};

/** 계열사(자회사)만 — 기존 명칭 유지 */
export const HOLDING_GHG_SUBSIDIARY_DETAIL: HoldingGhgOrgRow[] = [
  {
    id: 'm1',
    kind: 'subsidiary',
    name: '미라콤',
    short: '미라콤',
    scope1: 5800,
    scope2: 4200,
    scope3: 18400,
    verified: true,
    submitted: true,
    approved: true,
  },
  {
    id: 'm2',
    kind: 'subsidiary',
    name: '시큐아이',
    short: '시큐아이',
    scope1: 9200,
    scope2: 6800,
    scope3: 28600,
    verified: true,
    submitted: true,
    approved: true,
  },
  {
    id: 'm3',
    kind: 'subsidiary',
    name: '에스코어',
    short: '에스코어',
    scope1: 4100,
    scope2: 3100,
    scope3: 14200,
    verified: false,
    submitted: true,
    approved: false,
  },
  {
    id: 'm4',
    kind: 'subsidiary',
    name: '멀티캠퍼스',
    short: '멀티캠',
    scope1: 3200,
    scope2: 2400,
    scope3: 11800,
    verified: false,
    submitted: true,
    approved: false,
  },
  {
    id: 'm5',
    kind: 'subsidiary',
    name: '엠로',
    short: '엠로',
    scope1: 7400,
    scope2: 5200,
    scope3: 21600,
    verified: true,
    submitted: true,
    approved: true,
  },
  {
    id: 'm6',
    kind: 'subsidiary',
    name: '오픈핸즈',
    short: '오픈핸즈',
    scope1: 0,
    scope2: 0,
    scope3: 0,
    verified: false,
    submitted: false,
    approved: false,
  },
];

/** 지주 직접 운영 국내 사업장 — 데이터센터·캠퍼스·R&D 등 (holdingData DOMESTIC_SITES 기반) */
export const HOLDING_GHG_DOMESTIC_SITES: HoldingGhgOrgRow[] = [
  {
    id: 'd1',
    kind: 'domestic_site',
    siteCategory: '데이터센터',
    name: '상암 데이터센터',
    short: '상암DC',
    scope1: 24800,
    scope2: 18600,
    scope3: 6200,
    verified: true,
    submitted: true,
    approved: true,
  },
  {
    id: 'd2',
    kind: 'domestic_site',
    siteCategory: '데이터센터',
    name: '수원 데이터센터',
    short: '수원DC',
    scope1: 22400,
    scope2: 16200,
    scope3: 5100,
    verified: true,
    submitted: true,
    approved: true,
  },
  {
    id: 'd3',
    kind: 'domestic_site',
    siteCategory: '데이터센터',
    name: '춘천 데이터센터',
    short: '춘천DC',
    scope1: 38600,
    scope2: 28400,
    scope3: 8900,
    verified: true,
    submitted: true,
    approved: false,
  },
  {
    id: 'd4',
    kind: 'domestic_site',
    siteCategory: '데이터센터',
    name: '동탄 데이터센터',
    short: '동탄DC',
    scope1: 12400,
    scope2: 9800,
    scope3: 3100,
    verified: false,
    submitted: true,
    approved: false,
  },
  {
    id: 'd5',
    kind: 'domestic_site',
    siteCategory: '캠퍼스(HQ)',
    name: '판교 IT 캠퍼스',
    short: '판교IT',
    scope1: 18200,
    scope2: 22400,
    scope3: 12800,
    verified: true,
    submitted: true,
    approved: true,
  },
  {
    id: 'd6',
    kind: 'domestic_site',
    siteCategory: 'R&D',
    name: '서울 R&D 캠퍼스',
    short: '서울R&D',
    scope1: 6200,
    scope2: 9800,
    scope3: 5400,
    verified: false,
    submitted: true,
    approved: true,
  },
  {
    id: 'd7',
    kind: 'domestic_site',
    siteCategory: '물류·캠퍼스',
    name: '판교 물류 캠퍼스',
    short: '판교물류',
    scope1: 8400,
    scope2: 12100,
    scope3: 7800,
    verified: false,
    submitted: true,
    approved: false,
  },
];

/** GHG 산정 UI — 자회사 + 국내 사업장 통합 목록 */
export const HOLDING_GHG_ORG_ROWS: HoldingGhgOrgRow[] = [
  ...HOLDING_GHG_SUBSIDIARY_DETAIL,
  ...HOLDING_GHG_DOMESTIC_SITES,
];

export const HOLDING_RECENT_ACTIVITIES: {
  date: string;
  type: string;
  actor: string;
  target: string;
  color: 'green' | 'red' | 'amber' | 'blue';
}[] = [
  { date: '03.25 14:22', type: '승인', actor: '김지속 팀장', target: '미라콤 · GRI 302-1', color: 'green' },
  { date: '03.25 11:08', type: '반려', actor: '이보고 차장', target: '시큐아이 · GRI 405-1', color: 'red' },
  { date: '03.24 17:41', type: '리마인드', actor: '박담당 팀장', target: '오픈핸즈 전체 미제출', color: 'amber' },
  { date: '03.24 09:15', type: '승인', actor: '김지속 팀장', target: '엠로 · GHG Scope1', color: 'green' },
  { date: '03.23 15:00', type: '반려', actor: '이보고 차장', target: '멀티캠 · TCFD S-1', color: 'red' },
];

export function holdingPct(a: number, b: number): number {
  if (b === 0) return 0;
  return Math.round((a / b) * 100);
}

export function holdingDiff(cur: number, prev: number): { val: number; dir: 'down' | 'up' | 'flat'; sign: string } {
  const d = cur - prev;
  return {
    val: Math.abs(d),
    dir: d < 0 ? 'down' : d > 0 ? 'up' : 'flat',
    sign: d < 0 ? '▼' : d > 0 ? '▲' : '—',
  };
}

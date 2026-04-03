/**
 * GHG 보고서 미리보기용 파생 데이터 — GroupResults·groupEmissionEntities와 동일 mock 출처
 */
import type { GroupEmissionEntityRow } from './groupEmissionEntities';
import { GHG_ALL_GROUP_ENTITIES, sumEntityFields } from './groupEmissionEntities';

export type HoldingScopeTableRow = {
  scope: string;
  tCO2eq: number;
  yoyPct: number;
  note: string;
};

/** 보고서 상단 분기·연간 필터 (월별 파생 시계열의 부분합과 연동) */
export type GhgReportPeriodKey = '1Q' | '2Q' | '3Q' | '4Q' | 'FY';

export type MonthlyScopePoint = { month: string; s1: number; s2: number; s3: number };

const MONTH_LABELS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

export const GHG_REPORT_PERIOD_MONTH_INDICES: Record<GhgReportPeriodKey, number[]> = {
  '1Q': [0, 1, 2],
  '2Q': [3, 4, 5],
  '3Q': [6, 7, 8],
  '4Q': [9, 10, 11],
  FY: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};

export const GHG_REPORT_PERIOD_LABEL: Record<GhgReportPeriodKey, string> = {
  '1Q': '1분기',
  '2Q': '2분기',
  '3Q': '3분기',
  '4Q': '4분기',
  FY: '전체 연간',
};

export function sumMonthlyScopes(monthly: MonthlyScopePoint[], period: GhgReportPeriodKey) {
  const idx = GHG_REPORT_PERIOD_MONTH_INDICES[period];
  return idx.reduce(
    (acc, i) => ({
      s1: acc.s1 + (monthly[i]?.s1 ?? 0),
      s2: acc.s2 + (monthly[i]?.s2 ?? 0),
      s3: acc.s3 + (monthly[i]?.s3 ?? 0),
    }),
    { s1: 0, s2: 0, s3: 0 },
  );
}

export function filterMonthlyByPeriod(monthly: MonthlyScopePoint[], period: GhgReportPeriodKey): MonthlyScopePoint[] {
  return GHG_REPORT_PERIOD_MONTH_INDICES[period].map((i) => monthly[i]);
}

function holdingPrevScopeApprox(entities: GroupEmissionEntityRow[]) {
  return {
    s1: entities.reduce((a, r) => a + (r.scope1 * r.prev) / r.total, 0),
    s2: entities.reduce((a, r) => a + (r.scope2 * r.prev) / r.total, 0),
    s3: entities.reduce((a, r) => a + (r.scope3 * r.prev) / r.total, 0),
  };
}

const S2_MARKET_RATIO = 1167.1 / (2304.9 + 1167.1);

/** 지주: 자회사+국내 사업장 합산 Scope 요약 (시장/위치 S2 분할은 데모 비율) */
export function buildHoldingScopeTableRows(entities: GroupEmissionEntityRow[]): HoldingScopeTableRow[] {
  const s = sumEntityFields(entities);
  const prevApprox = holdingPrevScopeApprox(entities);
  const pct = (cur: number, p: number) => (p > 0 ? ((cur - p) / p) * 100 : 0);
  const s2m = s.scope2 * S2_MARKET_RATIO;
  const s2l = s.scope2 - s2m;
  const p2m = prevApprox.s2 * S2_MARKET_RATIO;
  const p2l = prevApprox.s2 - p2m;

  return [
    { scope: 'Scope 1', tCO2eq: s.scope1, yoyPct: pct(s.scope1, prevApprox.s1), note: '직접 배출 (자회사·국내 사업장 합산)' },
    { scope: 'Scope 2 (위치)', tCO2eq: s2l, yoyPct: pct(s2l, p2l), note: '위치기반 (그룹 합산)' },
    { scope: 'Scope 2 (시장)', tCO2eq: s2m, yoyPct: pct(s2m, p2m), note: '시장기반·재생 인증 반영 (데모 비율)' },
    { scope: 'Scope 3', tCO2eq: s.scope3, yoyPct: pct(s.scope3, prevApprox.s3), note: '가치사슬 (자회사·국내 사업장 합산)' },
  ];
}

export function formatYoy(pct: number): string {
  const rounded = pct.toFixed(1);
  return `${pct >= 0 ? '+' : ''}${rounded}%`;
}

export function buildHoldingMonthlyTrend(entities: GroupEmissionEntityRow[]) {
  const s = sumEntityFields(entities);
  const base = (s.scope1 + s.scope2 + s.scope3) / 12;
  const rS1 = s.scope1 / (s.scope1 + s.scope2 + s.scope3 || 1);
  const rS2 = s.scope2 / (s.scope1 + s.scope2 + s.scope3 || 1);
  const rS3 = s.scope3 / (s.scope1 + s.scope2 + s.scope3 || 1);
  const w = [0.92, 1.05, 0.98, 1.02, 0.95, 1.08, 1.0, 0.97, 1.03, 0.99, 1.01, 0.96];
  return MONTH_LABELS.map((month, i) => {
    const m = base * w[i];
    return {
      month,
      s1: Math.round(m * rS1 * 10) / 10,
      s2: Math.round(m * rS2 * 10) / 10,
      s3: Math.round(m * rS3 * 10) / 10,
    };
  });
}

/** Scope1 pie — 그룹 합계 대비 데모 비율 유지 */
export function buildHoldingScope1Breakdown(scope1Total: number) {
  const parts = [
    { name: 'LNG 연소', ratio: 231.2 / 273 },
    { name: '이동연소', ratio: 27.0 / 273 },
    { name: '냉매 누설', ratio: 8.5 / 273 },
    { name: '경유 연소', ratio: 6.3 / 273 },
  ];
  return parts.map((p) => ({ name: p.name, value: Math.round(scope1Total * p.ratio * 10) / 10 }));
}

export function getHoldingReportEntities() {
  return GHG_ALL_GROUP_ENTITIES;
}

export function buildSubsidiaryScopeTableRows(row: GroupEmissionEntityRow): HoldingScopeTableRow[] {
  const s2m = row.scope2 * S2_MARKET_RATIO;
  const s2l = row.scope2 - s2m;
  const prevS1 = (row.scope1 * row.prev) / row.total;
  const prevS2 = (row.scope2 * row.prev) / row.total;
  const prevS3 = (row.scope3 * row.prev) / row.total;
  const p2m = prevS2 * S2_MARKET_RATIO;
  const p2l = prevS2 - p2m;
  const pct = (cur: number, p: number) => (p > 0 ? ((cur - p) / p) * 100 : 0);

  return [
    { scope: 'Scope 1', tCO2eq: row.scope1, yoyPct: pct(row.scope1, prevS1), note: '직접 배출 (본 법인)' },
    { scope: 'Scope 2 (위치)', tCO2eq: s2l, yoyPct: pct(s2l, p2l), note: '위치기반' },
    { scope: 'Scope 2 (시장)', tCO2eq: s2m, yoyPct: pct(s2m, p2m), note: '시장기반 (데모 비율)' },
    { scope: 'Scope 3', tCO2eq: row.scope3, yoyPct: pct(row.scope3, prevS3), note: '가치사슬 (본 법인)' },
  ];
}

export function buildSubsidiaryMonthlyTrend(row: GroupEmissionEntityRow) {
  const tot = row.scope1 + row.scope2 + row.scope3;
  const base = tot / 12;
  const rS1 = row.scope1 / (tot || 1);
  const rS2 = row.scope2 / (tot || 1);
  const rS3 = row.scope3 / (tot || 1);
  const w = [0.92, 1.05, 0.98, 1.02, 0.95, 1.08, 1.0, 0.97, 1.03, 0.99, 1.01, 0.96];
  return MONTH_LABELS.map((month, i) => {
    const m = base * w[i];
    return {
      month,
      s1: Math.round(m * rS1 * 10) / 10,
      s2: Math.round(m * rS2 * 10) / 10,
      s3: Math.round(m * rS3 * 10) / 10,
    };
  });
}

export function buildSubsidiaryScope1Breakdown(row: GroupEmissionEntityRow) {
  return buildHoldingScope1Breakdown(row.scope1);
}

export function buildHoldingScopeTableRowsForPeriod(
  entities: GroupEmissionEntityRow[],
  monthly: MonthlyScopePoint[],
  period: GhgReportPeriodKey,
): HoldingScopeTableRow[] {
  if (period === 'FY') return buildHoldingScopeTableRows(entities);
  const s = sumEntityFields(entities);
  const prevApprox = holdingPrevScopeApprox(entities);
  const sums = sumMonthlyScopes(monthly, period);
  const pct = (cur: number, p: number) => (p > 0 ? ((cur - p) / p) * 100 : 0);
  const pS2m = sums.s2 * S2_MARKET_RATIO;
  const pS2l = sums.s2 - pS2m;
  const prevS1p = s.scope1 > 0 ? prevApprox.s1 * (sums.s1 / s.scope1) : 0;
  const prevS2p = s.scope2 > 0 ? prevApprox.s2 * (sums.s2 / s.scope2) : 0;
  const prevS3p = s.scope3 > 0 ? prevApprox.s3 * (sums.s3 / s.scope3) : 0;
  const p2mPrev = prevS2p * S2_MARKET_RATIO;
  const p2lPrev = prevS2p - p2mPrev;
  return [
    { scope: 'Scope 1', tCO2eq: sums.s1, yoyPct: pct(sums.s1, prevS1p), note: '직접 배출 (선택 구간 월 합)' },
    { scope: 'Scope 2 (위치)', tCO2eq: pS2l, yoyPct: pct(pS2l, p2lPrev), note: '위치기반 (선택 구간)' },
    { scope: 'Scope 2 (시장)', tCO2eq: pS2m, yoyPct: pct(pS2m, p2mPrev), note: '시장기반 (데모 비율)' },
    { scope: 'Scope 3', tCO2eq: sums.s3, yoyPct: pct(sums.s3, prevS3p), note: '가치사슬 (선택 구간 월 합)' },
  ];
}

export function buildSubsidiaryScopeTableRowsForPeriod(
  row: GroupEmissionEntityRow,
  monthly: MonthlyScopePoint[],
  period: GhgReportPeriodKey,
): HoldingScopeTableRow[] {
  if (period === 'FY') return buildSubsidiaryScopeTableRows(row);
  const sums = sumMonthlyScopes(monthly, period);
  const pS2m = sums.s2 * S2_MARKET_RATIO;
  const pS2l = sums.s2 - pS2m;
  const prevS1 = (row.scope1 * row.prev) / row.total;
  const prevS2 = (row.scope2 * row.prev) / row.total;
  const prevS3 = (row.scope3 * row.prev) / row.total;
  const prevS1p = row.scope1 > 0 ? prevS1 * (sums.s1 / row.scope1) : 0;
  const prevS2p = row.scope2 > 0 ? prevS2 * (sums.s2 / row.scope2) : 0;
  const prevS3p = row.scope3 > 0 ? prevS3 * (sums.s3 / row.scope3) : 0;
  const p2mPrev = prevS2p * S2_MARKET_RATIO;
  const p2lPrev = prevS2p - p2mPrev;
  const pct = (cur: number, p: number) => (p > 0 ? ((cur - p) / p) * 100 : 0);
  return [
    { scope: 'Scope 1', tCO2eq: sums.s1, yoyPct: pct(sums.s1, prevS1p), note: '직접 배출 (본 법인·선택 구간)' },
    { scope: 'Scope 2 (위치)', tCO2eq: pS2l, yoyPct: pct(pS2l, p2lPrev), note: '위치기반' },
    { scope: 'Scope 2 (시장)', tCO2eq: pS2m, yoyPct: pct(pS2m, p2mPrev), note: '시장기반 (데모 비율)' },
    { scope: 'Scope 3', tCO2eq: sums.s3, yoyPct: pct(sums.s3, prevS3p), note: '가치사슬 (본 법인·선택 구간)' },
  ];
}

export function buildHoldingGrandForPeriod(
  entities: GroupEmissionEntityRow[],
  monthly: MonthlyScopePoint[],
  period: GhgReportPeriodKey,
) {
  const s = sumEntityFields(entities);
  if (period === 'FY') {
    const prevT = entities.reduce((a, r) => a + r.prev, 0);
    const yoy = prevT > 0 ? ((s.total - prevT) / prevT) * 100 : 0;
    return { total: s.scope1 + s.scope2 + s.scope3, yoyLabel: formatYoy(yoy) };
  }
  const sums = sumMonthlyScopes(monthly, period);
  const prevApprox = holdingPrevScopeApprox(entities);
  const prevS1p = s.scope1 > 0 ? prevApprox.s1 * (sums.s1 / s.scope1) : 0;
  const prevS2p = s.scope2 > 0 ? prevApprox.s2 * (sums.s2 / s.scope2) : 0;
  const prevS3p = s.scope3 > 0 ? prevApprox.s3 * (sums.s3 / s.scope3) : 0;
  const pt = prevS1p + prevS2p + prevS3p;
  const ct = sums.s1 + sums.s2 + sums.s3;
  const yoy = pt > 0 ? ((ct - pt) / pt) * 100 : 0;
  return { total: ct, yoyLabel: formatYoy(yoy) };
}

export function buildSubsidiaryGrandForPeriod(
  row: GroupEmissionEntityRow,
  monthly: MonthlyScopePoint[],
  period: GhgReportPeriodKey,
) {
  if (period === 'FY') {
    const yoy = row.prev > 0 ? ((row.total - row.prev) / row.prev) * 100 : 0;
    return { total: row.scope1 + row.scope2 + row.scope3, yoyLabel: formatYoy(yoy) };
  }
  const sums = sumMonthlyScopes(monthly, period);
  const prevS1 = (row.scope1 * row.prev) / row.total;
  const prevS2 = (row.scope2 * row.prev) / row.total;
  const prevS3 = (row.scope3 * row.prev) / row.total;
  const prevS1p = row.scope1 > 0 ? prevS1 * (sums.s1 / row.scope1) : 0;
  const prevS2p = row.scope2 > 0 ? prevS2 * (sums.s2 / row.scope2) : 0;
  const prevS3p = row.scope3 > 0 ? prevS3 * (sums.s3 / row.scope3) : 0;
  const pt = prevS1p + prevS2p + prevS3p;
  const ct = sums.s1 + sums.s2 + sums.s3;
  const yoy = pt > 0 ? ((ct - pt) / pt) * 100 : 0;
  return { total: ct, yoyLabel: formatYoy(yoy) };
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

/** 데모: Scope 2 구성비 (합계 = scope2Total) */
export function buildScope2PieBreakdown(scope2Total: number) {
  const parts = [
    { name: '전력 (위치기반)', r: 0.74 },
    { name: '전력 (시장·REC)', r: 0.06 },
    { name: '열·스팀', r: 0.2 },
  ];
  let remaining = scope2Total;
  const out: { name: string; value: number }[] = [];
  for (let i = 0; i < parts.length; i++) {
    if (i === parts.length - 1) {
      out.push({ name: parts[i].name, value: round1(remaining) });
    } else {
      const v = round1(scope2Total * parts[i].r);
      remaining -= v;
      out.push({ name: parts[i].name, value: v });
    }
  }
  return out;
}

/** 데모: Scope 3 카테고리 구성비 (합계 = scope3Total) */
export function buildScope3PieBreakdown(scope3Total: number) {
  const parts = [
    { name: 'Cat.1 구매재화·서비스', r: 0.72 },
    { name: 'Cat.3 연료·에너지 관련', r: 0.08 },
    { name: 'Cat.4 업스트림 물류', r: 0.12 },
    { name: 'Cat.5 폐기물 등', r: 0.08 },
  ];
  let remaining = scope3Total;
  const out: { name: string; value: number }[] = [];
  for (let i = 0; i < parts.length; i++) {
    if (i === parts.length - 1) {
      out.push({ name: parts[i].name, value: round1(remaining) });
    } else {
      const v = round1(scope3Total * parts[i].r);
      remaining -= v;
      out.push({ name: parts[i].name, value: v });
    }
  }
  return out;
}

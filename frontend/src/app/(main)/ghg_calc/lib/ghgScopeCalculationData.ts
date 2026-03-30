/**
 * Scope 1·2·3 산정 탭 — groupEmissionEntities·ghgReportData 월별 파생과 정합 (GHG_SCOPE_CALC_AND_RESULTS_NUMERIC_CONSISTENCY_STRATEGY.md)
 */
import type { GroupEmissionEntityRow } from './groupEmissionEntities';
import { GHG_ALL_GROUP_ENTITIES, sumEntityFields } from './groupEmissionEntities';
import {
  buildHoldingMonthlyTrend,
  buildSubsidiaryMonthlyTrend,
  type MonthlyScopePoint,
} from './ghgReportData';

export const GHG_SCOPE_MONTH_LABELS = [
  '1월',
  '2월',
  '3월',
  '4월',
  '5월',
  '6월',
  '7월',
  '8월',
  '9월',
  '10월',
  '11월',
  '12월',
] as const;

export const GHG_SCOPE_MONTH_KEYS = [
  'jan',
  'feb',
  'mar',
  'apr',
  'may',
  'jun',
  'jul',
  'aug',
  'sep',
  'oct',
  'nov',
  'dec',
] as const;

export type ScopeCalcMonthKey = (typeof GHG_SCOPE_MONTH_KEYS)[number];

export type ScopeCalcLineItem = {
  name: string;
  facility: string;
  unit: string;
  jan: number;
  feb: number;
  mar: number;
  apr: number;
  may: number;
  jun: number;
  jul: number;
  aug: number;
  sep: number;
  oct: number;
  nov: number;
  dec: number;
  total: number;
  ef: string;
  efSource: string;
  yoy: number;
  status: string;
};

export type ScopeCalcCategory = {
  id: string;
  category: string;
  items: ScopeCalcLineItem[];
};

export type ScopeCalculationDataset = {
  /** 지주: 그룹 합산 / 계열사: 법인명 */
  label: string;
  scope1Categories: ScopeCalcCategory[];
  scope2Categories: ScopeCalcCategory[];
  scope3Categories: ScopeCalcCategory[];
  monthlyChart: { month: string; scope1: number; scope2: number; scope3: number }[];
  totals: { scope1: number; scope2: number; scope3: number };
  grandTotal: number;
  prev: { grand: number; s1: number; s2: number; s3: number };
};

const TPL_S1 = 273;
const TPL_S2 = 2304.9;
const TPL_S3 = 1512.4;

type TemplateItem = {
  name: string;
  facility: string;
  tpl: number;
  ef: string;
  efSource: string;
  yoy: number;
  status: string;
};

const TEMPLATE_S1: { id: string; category: string; items: TemplateItem[] }[] = [
  {
    id: 's1-1',
    category: '고정연소',
    items: [
      { name: 'LNG 연소 (보일러)', facility: '본관동', tpl: 73.4, ef: '2.176', efSource: '국가고시', yoy: 3.2, status: 'confirmed' },
      { name: 'LNG 연소 (생산동A)', facility: '생산동A', tpl: 157.8, ef: '2.176', efSource: '국가고시', yoy: -1.5, status: 'confirmed' },
      { name: '경유 (비상발전기)', facility: '전사', tpl: 6.3, ef: '2.603', efSource: 'IPCC', yoy: 0.0, status: 'confirmed' },
    ],
  },
  {
    id: 's1-2',
    category: '이동연소',
    items: [
      { name: '휘발유 (사업용 차량)', facility: '전사', tpl: 11.4, ef: '2.097', efSource: '국가고시', yoy: -8.1, status: 'draft' },
      { name: '경유 (화물 차량)', facility: '전사', tpl: 15.6, ef: '2.603', efSource: '국가고시', yoy: 2.3, status: 'draft' },
    ],
  },
  {
    id: 's1-3',
    category: '공정배출',
    items: [{ name: '냉매 누설 (HFC-134a)', facility: '생산동A', tpl: 8.5, ef: '1430', efSource: 'IPCC AR5', yoy: 15.4, status: 'warning' }],
  },
];

const TEMPLATE_S2: { id: string; category: string; items: TemplateItem[] }[] = [
  {
    id: 's2-1',
    category: '전력 (위치기반)',
    items: [
      { name: '전력 (본관동)', facility: '본관동', tpl: 185.4, ef: '0.4267', efSource: '국가 전력계수', yoy: 2.1, status: 'confirmed' },
      { name: '전력 (생산동A)', facility: '생산동A', tpl: 1137.9, ef: '0.4267', efSource: '국가 전력계수', yoy: 1.8, status: 'confirmed' },
      { name: '전력 (생산동B)', facility: '생산동B', tpl: 837.9, ef: '0.4267', efSource: '국가 전력계수', yoy: -0.9, status: 'confirmed' },
    ],
  },
  {
    id: 's2-2',
    category: '전력 (시장기반)',
    items: [{ name: '전력 (재생에너지 REC)', facility: '생산동A', tpl: 0.0, ef: '0', efSource: 'REC 인증', yoy: -100.0, status: 'confirmed' }],
  },
  {
    id: 's2-3',
    category: '열·스팀',
    items: [{ name: '열·스팀 구매 (생산동A)', facility: '생산동A', tpl: 143.7, ef: '0.2039', efSource: '국가고시', yoy: 3.5, status: 'confirmed' }],
  },
];

const TEMPLATE_S3: { id: string; category: string; items: TemplateItem[] }[] = [
  {
    id: 's3-1',
    category: 'Cat.1 구매재화·서비스',
    items: [
      { name: '원자재 구매 (철강)', facility: '생산동A', tpl: 1275.8, ef: '1.85', efSource: 'IPCC', yoy: 5.2, status: 'confirmed' },
      { name: '포장재 구매', facility: '전사', tpl: 37.2, ef: '0.55', efSource: '업체제공', yoy: -3.1, status: 'draft' },
    ],
  },
  {
    id: 's3-2',
    category: 'Cat.3 연료·에너지 관련',
    items: [{ name: '전력 T&D 손실', facility: '전사', tpl: 108.5, ef: '0.0395', efSource: '국가고시', yoy: 1.5, status: 'confirmed' }],
  },
  {
    id: 's3-3',
    category: 'Cat.4 업스트림 물류',
    items: [{ name: '원자재 운송 (협력사)', facility: '전사', tpl: 85.5, ef: '0.163', efSource: 'IPCC', yoy: 2.8, status: 'draft' }],
  },
  {
    id: 's3-4',
    category: 'Cat.5 사업 중 발생 폐기물',
    items: [{ name: '일반폐기물 (매립)', facility: '전사', tpl: 5.4, ef: '0.144', efSource: '국가고시', yoy: -5.1, status: 'confirmed' }],
  },
];

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

/** 12개월 합이 연간 Scope와 일치하도록 보정 (§3-2 불변식 4) */
function reconcileMonthlyToTargets(
  monthly: MonthlyScopePoint[],
  t1: number,
  t2: number,
  t3: number,
): MonthlyScopePoint[] {
  const series = (key: 's1' | 's2' | 's3', target: number) => {
    const raw = monthly.map((m) => m[key]);
    const s = raw.reduce((a, b) => a + b, 0) || 1;
    const f = target / s;
    const out: number[] = [];
    for (let i = 0; i < 11; i++) {
      out.push(round1(raw[i] * f));
    }
    const sum11 = out.reduce((a, b) => a + b, 0);
    out.push(round1(target - sum11));
    return out;
  };

  const s1 = series('s1', t1);
  const s2 = series('s2', t2);
  const s3 = series('s3', t3);

  return monthly.map((m, i) => ({
    month: m.month,
    s1: s1[i],
    s2: s2[i],
    s3: s3[i],
  }));
}

function itemMonthsFromScopeSeries(
  series: number[],
  share: number,
  itemTotal: number,
): Record<ScopeCalcMonthKey, number> {
  const out: number[] = [];
  for (let i = 0; i < 11; i++) {
    out.push(round1(series[i] * share));
  }
  const sum11 = out.reduce((a, b) => a + b, 0);
  out.push(round1(itemTotal - sum11));
  const rec: Record<string, number> = {};
  GHG_SCOPE_MONTH_KEYS.forEach((k, idx) => {
    rec[k] = out[idx];
  });
  return rec as Record<ScopeCalcMonthKey, number>;
}

function buildLineItems(
  template: { id: string; category: string; items: TemplateItem[] }[],
  tplTotal: number,
  targetScope: number,
  scopeKey: 's1' | 's2' | 's3',
  reconciled: MonthlyScopePoint[],
): ScopeCalcCategory[] {
  const series = reconciled.map((m) => m[scopeKey]);
  const cats = template.map((cat) => ({
    id: cat.id,
    category: cat.category,
    items: cat.items.map((it) => {
      const share = it.tpl / tplTotal;
      const itemTotal = round1(targetScope * share);
      const mo = itemMonthsFromScopeSeries(series, share, itemTotal);
      return {
        name: it.name,
        facility: it.facility,
        unit: 'tCO₂eq',
        ...mo,
        total: itemTotal,
        ef: it.ef,
        efSource: it.efSource,
        yoy: it.yoy,
        status: it.status,
      };
    }),
  }));

  const flat = cats.flatMap((c) => c.items);
  if (!flat.length) return cats;
  const sumT = flat.reduce((s, i) => s + i.total, 0);
  const drift = round1(targetScope - sumT);
  if (Math.abs(drift) >= 0.05) {
    const last = flat[flat.length - 1];
    last.total = round1(last.total + drift);
    last.dec = round1(last.dec + drift);
  }
  return cats;
}

export function targetsFromGroupEntities(entities: GroupEmissionEntityRow[]) {
  const s = sumEntityFields(entities);
  const prev = entities.reduce((a, e) => a + e.prev, 0);
  return {
    scope1: s.scope1,
    scope2: s.scope2,
    scope3: s.scope3,
    total: s.total,
    prev,
  };
}

export function buildScopeCalculationDataset(params: {
  mode: 'holding' | 'subsidiary';
  subsidiaryRow: GroupEmissionEntityRow | null;
}): ScopeCalculationDataset | null {
  const { mode, subsidiaryRow } = params;

  if (mode === 'subsidiary' && !subsidiaryRow) return null;

  const targets =
    mode === 'holding'
      ? targetsFromGroupEntities(GHG_ALL_GROUP_ENTITIES)
      : {
          scope1: subsidiaryRow!.scope1,
          scope2: subsidiaryRow!.scope2,
          scope3: subsidiaryRow!.scope3,
          total: subsidiaryRow!.total,
          prev: subsidiaryRow!.prev,
        };

  const monthlyRaw =
    mode === 'holding'
      ? buildHoldingMonthlyTrend(GHG_ALL_GROUP_ENTITIES)
      : buildSubsidiaryMonthlyTrend(subsidiaryRow!);

  const reconciled = reconcileMonthlyToTargets(
    monthlyRaw,
    targets.scope1,
    targets.scope2,
    targets.scope3,
  );

  const scope1Categories = buildLineItems(TEMPLATE_S1, TPL_S1, targets.scope1, 's1', reconciled);
  const scope2Categories = buildLineItems(TEMPLATE_S2, TPL_S2, targets.scope2, 's2', reconciled);
  const scope3Categories = buildLineItems(TEMPLATE_S3, TPL_S3, targets.scope3, 's3', reconciled);

  const monthlyChart = reconciled.map((m) => ({
    month: m.month,
    scope1: m.s1,
    scope2: m.s2,
    scope3: m.s3,
  }));

  const grandTotal = targets.scope1 + targets.scope2 + targets.scope3;
  const ttot = targets.total > 0 ? targets.total : 1;
  const prevS1 = (targets.scope1 * targets.prev) / ttot;
  const prevS2 = (targets.scope2 * targets.prev) / ttot;
  const prevS3 = (targets.scope3 * targets.prev) / ttot;

  return {
    label: mode === 'holding' ? '그룹 합산 (자회사·국내 사업장)' : subsidiaryRow!.name,
    scope1Categories,
    scope2Categories,
    scope3Categories,
    monthlyChart,
    totals: { scope1: targets.scope1, scope2: targets.scope2, scope3: targets.scope3 },
    grandTotal,
    prev: { grand: targets.prev, s1: prevS1, s2: prevS2, s3: prevS3 },
  };
}

/** 데모 검증: 카테고리 항목 total 합 ≈ 해당 Scope 연간값 */
export function assertScopeLineTotalsMatch(dataset: ScopeCalculationDataset, epsilon = 2) {
  const sumCat = (cats: ScopeCalcCategory[]) =>
    cats.flatMap((c) => c.items).reduce((s, i) => s + i.total, 0);
  const d1 = Math.abs(sumCat(dataset.scope1Categories) - dataset.totals.scope1);
  const d2 = Math.abs(sumCat(dataset.scope2Categories) - dataset.totals.scope2);
  const d3 = Math.abs(sumCat(dataset.scope3Categories) - dataset.totals.scope3);
  if (d1 > epsilon || d2 > epsilon || d3 > epsilon) {
    console.warn('[ghgScopeCalculationData] scope line totals drift', { d1, d2, d3 });
  }
}

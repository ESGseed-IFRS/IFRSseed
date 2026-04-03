/**
 * GHG_AUDIT_TAB_DESIGN_v2: 프레임워크별 요건 체크리스트
 */

export type ChecklistStatus = 'ok' | 'warning' | 'missing';

export interface ChecklistItem {
  id: string;
  category: string;
  requirement: string;
  status: ChecklistStatus;
  evidence?: string;
}

export type AuditFramework = 'ISSB' | 'GRI' | 'KSSB' | 'K-ETS' | 'ESRS';

/** IFRS S2 (ISSB) 체크리스트 항목 */
export const ISSB_CHECKLIST: ChecklistItem[] = [
  { id: 's1', category: '배출량 공시', requirement: 'Scope 1 배출량', status: 'ok', evidence: '1,234 tCO₂e' },
  { id: 's2-loc', category: '배출량 공시', requirement: 'Scope 2 (위치기반)', status: 'ok', evidence: '567 tCO₂e' },
  { id: 's2-mkt', category: '배출량 공시', requirement: 'Scope 2 (마켓기반)', status: 'ok', evidence: '489 tCO₂e' },
  { id: 's3', category: '배출량 공시', requirement: 'Scope 3 중요 카테고리', status: 'ok', evidence: 'Cat.1,4,6,7,9' },
  { id: 'ef-source', category: '방법론·근거', requirement: '배출계수 출처 명시', status: 'ok', evidence: '환경부 2024' },
  { id: 'gwp', category: '방법론·근거', requirement: 'GWP 기준 명시', status: 'ok', evidence: 'IPCC AR6' },
  { id: 'methodology', category: '방법론·근거', requirement: '산정 방법론 명시', status: 'ok', evidence: '연료연소법' },
  { id: 'boundary', category: '방법론·근거', requirement: '조직 경계 설정', status: 'ok', evidence: '운영통제, 5개소' },
  { id: 'manual-adj', category: '데이터 무결성', requirement: '수동 조정 이력 공개', status: 'warning', evidence: '3건 수동 수정' },
  { id: 'ef-version', category: '데이터 무결성', requirement: '배출계수 최신 여부', status: 'warning', evidence: '1건 구버전 적용' },
  { id: 's3-cat2', category: '추가 공시', requirement: 'Scope 3 Cat.2 자본재', status: 'missing', evidence: '미산정' },
  { id: 'internal-price', category: '추가 공시', requirement: '내부 탄소 가격', status: 'missing', evidence: '미설정' },
];

/** K-ETS 체크리스트 항목 */
export const KETS_CHECKLIST: ChecklistItem[] = [
  { id: 's1-stationary', category: '배출량 보고', requirement: 'Scope 1 고정연소', status: 'ok', evidence: '852.4 tCO₂e' },
  { id: 's1-mobile', category: '배출량 보고', requirement: 'Scope 1 이동연소', status: 'ok', evidence: '298.6 tCO₂e' },
  { id: 's1-fugitive', category: '배출량 보고', requirement: 'Scope 1 탈루(냉매)', status: 'ok', evidence: '61.2 tCO₂e' },
  { id: 's2-power', category: '배출량 보고', requirement: 'Scope 2 전력 구매', status: 'ok', evidence: '567.0 tCO₂e' },
  { id: 'allowance', category: '배출권 관리', requirement: '할당량 등록', status: 'ok', evidence: '12,500 tCO₂e' },
  { id: 'allowance-vs', category: '배출권 관리', requirement: '할당량 대비 실적', status: 'ok', evidence: '1,801 / 12,500' },
  { id: 'trading', category: '배출권 관리', requirement: '배출권 거래 내역', status: 'ok', evidence: '구매 500 tCO₂e' },
  { id: 'ef-kets', category: '방법론', requirement: '배출계수 출처 (환경부)', status: 'ok', evidence: '2024 KR' },
  { id: 'gwp-kets', category: '방법론', requirement: 'GWP 기준 (AR5)', status: 'ok', evidence: 'IPCC AR5' },
  { id: 'monitoring', category: '방법론', requirement: '모니터링 계획 적합성', status: 'warning', evidence: '일부 미등록' },
];

/** 프레임워크별 체크리스트 */
export const FRAMEWORK_CHECKLISTS: Record<AuditFramework, ChecklistItem[]> = {
  ISSB: ISSB_CHECKLIST,
  GRI: ISSB_CHECKLIST,
  KSSB: ISSB_CHECKLIST,
  'K-ETS': KETS_CHECKLIST,
  ESRS: ISSB_CHECKLIST,
};

export function getCompletionRate(items: ChecklistItem[]): { ok: number; warning: number; missing: number; total: number; rate: number } {
  const ok = items.filter((i) => i.status === 'ok').length;
  const warning = items.filter((i) => i.status === 'warning').length;
  const missing = items.filter((i) => i.status === 'missing').length;
  const total = items.length;
  const rate = total > 0 ? Math.round(((ok + warning * 0.5) / total) * 100) : 0;
  return { ok, warning, missing, total, rate };
}

/** 동적 상태 계산용: boundaryPolicy, scope 데이터 기반 */
export function computeItemStatus(
  item: ChecklistItem,
  ctx: {
    scope1Total: number;
    scope2Total: number;
    scope3Total: number;
    scope1Stationary: number;
    scope1Mobile: number;
    efDbVersion?: string;
    organizationBoundary?: string;
    reportingYear?: number;
    scope2Included?: string;
    scope3CategoryIds?: string[];
    facilitiesCount?: number;
  }
): ChecklistItem {
  const ob = ctx.organizationBoundary;
  const facilitiesCount = ctx.facilitiesCount ?? 5;
  const evidenceFromCtx = (): string | undefined => {
    if (item.id === 'ef-source' && ctx.efDbVersion) return ctx.efDbVersion.split(',')[0] ?? ctx.efDbVersion;
    if (item.id === 'boundary' && ob) return `${ob === 'operational_control' ? '운영통제' : ob === 'equity_share' ? '지분법' : ob}, ${facilitiesCount}개소`;
    if (item.id === 'gwp' || item.id === 'gwp-kets') return 'IPCC AR6';
    if (item.id === 'methodology') return '연료연소법';
    return item.evidence;
  };
  const statusFromCtx = (): ChecklistItem['status'] => {
    if (item.id === 's1' || item.id === 's1-stationary' || item.id === 's1-mobile') return ctx.scope1Total > 0 || ctx.scope1Stationary > 0 || ctx.scope1Mobile > 0 ? 'ok' : item.status;
    if (item.id === 's2-loc' || item.id === 's2-power') return ctx.scope2Total > 0 ? 'ok' : item.status;
    if (item.id === 'ef-source' || item.id === 'ef-kets') return ctx.efDbVersion ? 'ok' : 'missing';
    if (item.id === 'boundary') return ob ? 'ok' : 'missing';
    return item.status;
  };
  return { ...item, evidence: evidenceFromCtx() ?? item.evidence, status: statusFromCtx() };
}

/**
 * 지주 SR 취합 화면 — GHG 그룹 산정 결과 + subsidiary_data_contributions 조회
 */

import type { GroupScopeResultRowApi, GroupScopeResultsApi } from '@/app/(main)/ghg_calc/lib/ghgGroupScopeApi';
import type { SubsidiaryDpSubmission } from './platformTypes';

export type SrContributionApiRow = {
  id: string;
  company_id: string;
  subsidiary_name: string | null;
  facility_name: string | null;
  report_year: number;
  category: string | null;
  description: string | null;
  related_dp_ids: string[];
  quantitative_data: Record<string, unknown>;
  data_source: string | null;
  submitted_by: string | null;
  submission_date: string | null;
};

export type SrContributionsApiResponse = {
  contributions: SrContributionApiRow[];
  total_count: number;
};

function apiBase(): string {
  return (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:9001').replace(/\/$/, '');
}

export async function fetchGroupScopeResults(
  holdingCompanyId: string,
  year: number,
  basis: string = 'location',
  init?: RequestInit
): Promise<GroupScopeResultsApi> {
  const url = `${apiBase()}/ghg-calculation/scope/group-results?holding_company_id=${encodeURIComponent(
    holdingCompanyId,
  )}&year=${year}&basis=${encodeURIComponent(basis)}`;
  const res = await fetch(url, { credentials: 'include', ...init });
  if (!res.ok) {
    const t = await res.text().catch(() => res.statusText);
    throw new Error(t || `HTTP ${res.status}`);
  }
  return (await res.json()) as GroupScopeResultsApi;
}

export async function fetchSrContributions(
  holdingCompanyId: string,
  reportYear: number,
  init?: RequestInit
): Promise<SrContributionsApiResponse> {
  const url = `${apiBase()}/data-integration/subsidiary/sr-contributions?holding_company_id=${encodeURIComponent(
    holdingCompanyId,
  )}&report_year=${reportYear}`;
  const res = await fetch(url, { credentials: 'include', ...init });
  if (!res.ok) {
    const t = await res.text().catch(() => res.statusText);
    throw new Error(t || `HTTP ${res.status}`);
  }
  return (await res.json()) as SrContributionsApiResponse;
}

export function effectiveSubsidiaryCompanyId(row: SrContributionApiRow, holdingCompanyId: string): string {
  if (row.company_id === holdingCompanyId) {
    const c = row.quantitative_data?.contributor_company_id;
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return row.company_id;
}

/** GHG 행이 없을 때 계열사 목록을 기여 데이터에서 유도 */
export function subsidiaryOrderForDisplay(
  ghgRows: GroupScopeResultRowApi[],
  contributions: SrContributionApiRow[],
  holdingCompanyId: string,
): { company_id: string; name: string }[] {
  const fromGhg = ghgRows
    .filter((r) => r.role === 'subsidiary')
    .map((r) => ({ company_id: r.company_id, name: r.name }));
  if (fromGhg.length > 0) return fromGhg;
  const seen = new Set<string>();
  const out: { company_id: string; name: string }[] = [];
  for (const row of contributions) {
    const sid = effectiveSubsidiaryCompanyId(row, holdingCompanyId);
    if (seen.has(sid)) continue;
    seen.add(sid);
    out.push({ company_id: sid, name: (row.subsidiary_name ?? '').trim() || '미상' });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
}

function relatedMatchesTab(related: string[], tab: 'gri' | 'issb' | 'esrs'): boolean {
  if (!related.length) return false;
  const u = related.map((x) => x.toUpperCase());
  if (tab === 'gri') return u.some((c) => c.startsWith('GRI'));
  if (tab === 'esrs') return u.some((c) => c.startsWith('ESRS') || c.startsWith('ESRSE'));
  return u.some((c) => c.startsWith('IFRS') || c.startsWith('ISSB'));
}

/** DP-ENV-001 정성: 기준 탭에 맞는 related_dp_ids만 묶어 계열사별 통합 텍스트 */
export function buildGhgQualitativeTexts(
  holdingCompanyId: string,
  contributions: SrContributionApiRow[],
  subsidiaryOrder: { company_id: string; name: string }[],
  tab: 'gri' | 'issb' | 'esrs',
): { subsidiary_id: string; subsidiary_name: string; text: string }[] {
  const bySub = new Map<string, { name: string; blocks: string[] }>();

  for (const row of contributions) {
    if (!row.description?.trim()) continue;
    if (!relatedMatchesTab(row.related_dp_ids ?? [], tab)) continue;
    const sid = effectiveSubsidiaryCompanyId(row, holdingCompanyId);
    const name = (row.subsidiary_name ?? '').trim() || '미상';
    const cat = (row.category ?? '').trim() || '항목';
    const block = `【${cat}】\n${row.description.trim()}`;
    const cur = bySub.get(sid);
    if (cur) cur.blocks.push(block);
    else bySub.set(sid, { name, blocks: [block] });
  }

  return subsidiaryOrder.map(({ company_id, name }) => {
    const hit = bySub.get(company_id);
    const text = hit?.blocks.length
      ? hit.blocks.join('\n\n')
      : '해당 기준 탭에 맞는 제출 서술이 없습니다. (subsidiary_data_contributions)';
    return {
      subsidiary_id: company_id,
      subsidiary_name: hit?.name ?? name,
      text,
    };
  });
}

function yoyPercent(grand: number, prev: number | null | undefined): number | undefined {
  if (prev == null || prev <= 0) return undefined;
  return Math.round(((grand - prev) / prev) * 1000) / 10;
}

/** ghg_emission_results 기반 그룹 행 → DP-ENV-001 정량 취합 행 */
export function buildGhgQuantSubmissions(rows: GroupScopeResultRowApi[]): SubsidiaryDpSubmission[] {
  return rows
    .filter((r) => r.role === 'subsidiary')
    .map((r) => ({
      subsidiary_id: r.company_id,
      subsidiary_name: r.name,
      status: r.frozen ? ('ACCEPTED' as const) : ('SUBMITTED' as const),
      values: {
        scope1: r.scope1_total,
        scope2: r.scope2_total,
      },
      methodology: 'GHG Protocol · DB 저장 산정(location basis, Scope2는 location+market 합산)',
      yoy_change: yoyPercent(r.grand_total, r.prev_grand_total),
    }));
}

export function sumScope12AutoValue(rows: GroupScopeResultRowApi[]): number {
  return rows
    .filter((r) => r.role === 'subsidiary')
    .reduce((acc, r) => acc + r.scope1_total + r.scope2_total, 0);
}

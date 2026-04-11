/**
 * 지주 SR 페이지 매핑 — 백엔드 DB API (IFRS Agent `/ifrs-agent/holding-sr-mappings`)
 */

import type { HoldingSrPageRow } from './holdingPageData';
import {
  type StoredSrMappingsPayload,
  type StoredPageSrMapping,
  mergePayloadOntoBase,
  mergeHoldingSrPagesWithStorage,
} from './holdingPageMappingsStorage';

export const DEFAULT_HOLDING_SR_CATALOG_KEY = 'sds_2024';

/** SR 페이지 매핑 저장·조회 API에 사용하는 고정 회사 ID */
export const HOLDING_SR_MAPPINGS_COMPANY_ID = '550e8400-e29b-41d4-a716-446655440001';

function normalizeApiPayload(data: unknown): StoredSrMappingsPayload | null {
  if (!data || typeof data !== 'object') return null;
  const o = data as Record<string, unknown>;
  const version = o.version === 1 ? 1 : typeof o.version === 'number' ? 1 : 1;
  const pages = o.pages;
  if (!pages || typeof pages !== 'object') return null;
  const outPages: Record<string, StoredPageSrMapping> = {};
  for (const [k, v] of Object.entries(pages as Record<string, unknown>)) {
    if (!v || typeof v !== 'object') continue;
    const row = v as Record<string, unknown>;
    const b = row.srBodyIds;
    const i = row.srImageIds;
    outPages[String(k)] = {
      srBodyIds: Array.isArray(b) ? b.map(String) : [],
      srImageIds: Array.isArray(i) ? i.map(String) : [],
    };
  }
  return {
    version: 1,
    updatedAt: typeof o.updatedAt === 'string' ? o.updatedAt : new Date().toISOString(),
    pages: outPages,
  };
}

/** 네트워크/HTTP 실패 시 null */
export async function apiGetHoldingSrMappings(
  apiBase: string,
  companyId: string,
  catalogKey: string = DEFAULT_HOLDING_SR_CATALOG_KEY,
): Promise<StoredSrMappingsPayload | null> {
  const base = apiBase.replace(/\/$/, '');
  const q = new URLSearchParams({
    company_id: companyId.trim(),
    catalog_key: catalogKey.trim(),
  });
  try {
    const res = await fetch(`${base}/ifrs-agent/holding-sr-mappings?${q}`, {
      method: 'GET',
      credentials: 'include',
    });
    if (!res.ok) return null;
    const data = await res.json();
    return normalizeApiPayload(data);
  } catch {
    return null;
  }
}

export async function apiPutHoldingSrMappings(
  apiBase: string,
  companyId: string,
  payload: { version: number; pages: Record<string, StoredPageSrMapping> },
  catalogKey: string = DEFAULT_HOLDING_SR_CATALOG_KEY,
): Promise<StoredSrMappingsPayload | null> {
  const base = apiBase.replace(/\/$/, '');
  try {
    const res = await fetch(`${base}/ifrs-agent/holding-sr-mappings`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company_id: companyId.trim(),
        catalog_key: catalogKey.trim(),
        payload: {
          version: payload.version,
          pages: payload.pages,
        },
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return normalizeApiPayload(data);
  } catch {
    return null;
  }
}

export async function apiDeleteHoldingSrMappings(
  apiBase: string,
  companyId: string,
  catalogKey: string = DEFAULT_HOLDING_SR_CATALOG_KEY,
): Promise<boolean> {
  const base = apiBase.replace(/\/$/, '');
  const q = new URLSearchParams({
    company_id: companyId.trim(),
    catalog_key: catalogKey.trim(),
  });
  try {
    const res = await fetch(`${base}/ifrs-agent/holding-sr-mappings?${q}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * 병합 우선순위: API(성공 시) → localStorage → 생성 파일 기본값
 */
export async function resolveMergedHoldingSrPages(
  base: HoldingSrPageRow[],
  companyId: string | null | undefined,
  apiBase: string | null | undefined,
  catalogKey: string = DEFAULT_HOLDING_SR_CATALOG_KEY,
): Promise<HoldingSrPageRow[]> {
  const cid = (companyId ?? '').trim();
  const ab = (apiBase ?? '').trim();
  if (cid && ab) {
    const remote = await apiGetHoldingSrMappings(ab, cid, catalogKey);
    if (remote) {
      return mergePayloadOntoBase(base, remote);
    }
  }
  return mergeHoldingSrPagesWithStorage(base);
}

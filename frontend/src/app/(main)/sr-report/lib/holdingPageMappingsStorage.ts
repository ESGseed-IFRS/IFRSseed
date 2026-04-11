/**
 * SR 페이지 ↔ sr_report_body / sr_report_images ID 매핑 영구 저장 (브라우저 localStorage)
 *
 * - 생성 파일(holdingSrSds2024Pages.generated.ts)은 기본값
 * - 이 모듈에 저장된 페이지는 저장값으로 덮어씀 (빈 배열 = 직접 참조 없음 → 백엔드 검색 폴백)
 */

import type { HoldingSrPageRow } from './holdingPageData';

export const HOLDING_SR_MAPPINGS_STORAGE_KEY = 'ifrsseed:holding-sr-mappings:v1';

export const HOLDING_SR_MAPPINGS_CHANGED_EVENT = 'holding-sr-mappings-changed';

export type StoredPageSrMapping = {
  srBodyIds: string[];
  srImageIds: string[];
};

export type StoredSrMappingsPayload = {
  version: 1;
  updatedAt: string;
  /** 페이지 번호 문자열 키 → 매핑 */
  pages: Record<string, StoredPageSrMapping>;
};

/** API/저장소에서 받은 payload를 생성 파일 기준 행에 적용 */
export function mergePayloadOntoBase(
  base: HoldingSrPageRow[],
  payload: StoredSrMappingsPayload | null | undefined,
): HoldingSrPageRow[] {
  if (!payload?.pages || typeof payload.pages !== 'object') {
    return base.map((row) => ({ ...row }));
  }
  return base.map((row) => {
    const key = String(row.page);
    if (!(key in payload.pages)) {
      return { ...row };
    }
    const o = payload.pages[key];
    return {
      ...row,
      srBodyIds: o.srBodyIds.length > 0 ? [...o.srBodyIds] : undefined,
      srImageIds: o.srImageIds.length > 0 ? [...o.srImageIds] : undefined,
    };
  });
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function readStoredSrMappingsPayload(): StoredSrMappingsPayload | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(HOLDING_SR_MAPPINGS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const o = parsed as Partial<StoredSrMappingsPayload>;
    if (o.version !== 1 || !o.pages || typeof o.pages !== 'object') return null;
    return {
      version: 1,
      updatedAt: typeof o.updatedAt === 'string' ? o.updatedAt : new Date().toISOString(),
      pages: o.pages as Record<string, StoredPageSrMapping>,
    };
  } catch {
    return null;
  }
}

export function writeStoredSrMappingsPayload(payload: StoredSrMappingsPayload): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(HOLDING_SR_MAPPINGS_STORAGE_KEY, JSON.stringify(payload));
  window.dispatchEvent(new CustomEvent(HOLDING_SR_MAPPINGS_CHANGED_EVENT));
}

/** 단일 페이지 매핑만 갱신하고 나머지 페이지는 유지 */
export function upsertPageSrMapping(
  pageNumber: number,
  mapping: StoredPageSrMapping,
): void {
  const prev = readStoredSrMappingsPayload();
  const pages = { ...(prev?.pages ?? {}) };
  const key = String(pageNumber);
  pages[key] = {
    srBodyIds: [...mapping.srBodyIds],
    srImageIds: [...mapping.srImageIds],
  };
  writeStoredSrMappingsPayload({
    version: 1,
    updatedAt: new Date().toISOString(),
    pages,
  });
}

export function clearPageSrMapping(pageNumber: number): void {
  const prev = readStoredSrMappingsPayload();
  if (!prev?.pages) return;
  const key = String(pageNumber);
  if (!(key in prev.pages)) return;
  const pages = { ...prev.pages };
  delete pages[key];
  writeStoredSrMappingsPayload({
    version: 1,
    updatedAt: new Date().toISOString(),
    pages,
  });
}

export function clearAllSrMappings(): void {
  if (!isBrowser()) return;
  window.localStorage.removeItem(HOLDING_SR_MAPPINGS_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent(HOLDING_SR_MAPPINGS_CHANGED_EVENT));
}

/** 생성 파일 + localStorage 병합 */
export function mergeHoldingSrPagesWithStorage(base: HoldingSrPageRow[]): HoldingSrPageRow[] {
  return mergePayloadOntoBase(base, readStoredSrMappingsPayload());
}

export function exportSrMappingsJson(): string {
  const p = readStoredSrMappingsPayload();
  return JSON.stringify(p ?? { version: 1, updatedAt: '', pages: {} }, null, 2);
}

export function importSrMappingsJson(text: string): { ok: true } | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== 'object') return { ok: false, error: '유효하지 않은 JSON' };
    const o = parsed as Partial<StoredSrMappingsPayload>;
    if (o.version !== 1 || !o.pages || typeof o.pages !== 'object') {
      return { ok: false, error: 'version=1 및 pages 객체가 필요합니다' };
    }
    writeStoredSrMappingsPayload({
      version: 1,
      updatedAt: new Date().toISOString(),
      pages: o.pages as Record<string, StoredPageSrMapping>,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

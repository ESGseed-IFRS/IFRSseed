/**
 * AUDIT_TRAIL_IMPLEMENTATION_ROADMAP §5: Audit API 클라이언트
 * 백엔드 연동 시 아래 함수들을 실제 fetch/axios 호출로 교체
 */

const API_BASE = '/api/audit';

export async function getPeriodLocks(): Promise<unknown[]> {
  // TODO: GET ${API_BASE}/period-locks
  return [];
}

export async function createPeriodLock(_payload: { scope: string; periodType: string; periodValue: string }): Promise<unknown> {
  // TODO: POST ${API_BASE}/period-locks
  throw new Error('Not implemented');
}

export async function getUnlockRequests(): Promise<unknown[]> {
  // TODO: GET ${API_BASE}/unlock-requests
  return [];
}

export async function approveUnlockRequest(_id: string, _eSignData?: object): Promise<unknown> {
  // TODO: POST ${API_BASE}/unlock-requests/:id/approve
  throw new Error('Not implemented');
}

export async function getSnapshots(): Promise<unknown[]> {
  // TODO: GET ${API_BASE}/snapshots
  return [];
}

export async function createSnapshot(_payload: object): Promise<unknown> {
  // TODO: POST ${API_BASE}/snapshots
  throw new Error('Not implemented');
}

export async function getAuditLogs(_params?: { entityType?: string; from?: string; to?: string }): Promise<unknown[]> {
  // TODO: GET ${API_BASE}/logs
  return [];
}

export async function verifyEvidenceHash(_evidenceId: string): Promise<{ verified: boolean }> {
  // TODO: GET ${API_BASE}/evidence/:id/verify
  return { verified: false };
}

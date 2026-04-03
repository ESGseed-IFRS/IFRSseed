/**
 * 결재함 mock — 본인 차례 시뮬레이션 (전략: approvalMap 패턴)
 * ApprovalSystem.jsx ME — 박지훈(USR-003)
 */
import { APPROVAL_DEMO_DOCS } from './data/approvalDemoPack';
import { buildUnifiedTimeline } from './data/unifiedTimeline';
import type { ApprovalStep } from './types/auditEventDto';

export const AUDIT_CURRENT_USER = '박지훈';

/** ApprovalSystem.jsx ME.id — 기안함·결재선 매칭 */
export const AUDIT_CURRENT_USER_ID = 'USR-003';

/** 삼성SDS 지속가능경영팀장 */
export const AUDIT_CURRENT_USER_ROLE = '삼성SDS 지속가능경영팀장';

export const AUDIT_CURRENT_USER_DEPT = '삼성SDS 지속가능경영팀';

export function createInitialApprovalMap(): Record<string, ApprovalStep[]> {
  const m: Record<string, ApprovalStep[]> = {};
  buildUnifiedTimeline().forEach((e) => {
    m[e.id] = e.approvalSteps.map((s) => ({ ...s }));
  });
  APPROVAL_DEMO_DOCS.forEach((d) => {
    m[d.id] = d.approvalSteps.map((s) => ({ ...s }));
  });
  return m;
}

export function countMyPendingApprovals(
  map: Record<string, ApprovalStep[]>,
  userName: string = AUDIT_CURRENT_USER
): number {
  let n = 0;
  for (const steps of Object.values(map)) {
    if (steps.some((s) => s.who === userName && s.status === 'pending')) n++;
  }
  return n;
}

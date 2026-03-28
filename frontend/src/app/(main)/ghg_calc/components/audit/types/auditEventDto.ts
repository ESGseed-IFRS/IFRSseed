/**
 * AUDIT_TRAIL_WITH_APPROVAL_STRATEGY.md — 프론트 DTO
 */
/** ApprovalSystem.jsx — pending=내 차례, waiting=이전 단계 후 활성화 */
export type ApprovalStepStatus = 'pending' | 'approved' | 'rejected' | 'skipped' | 'waiting';

export type ApprovalStep = {
  role: string;
  who: string;
  at?: string;
  status: ApprovalStepStatus;
  comment?: string;
  /** 예제 결재선 — 부서 */
  dept?: string;
  /** 예제 ME.id 매칭 (기안함/미결함 분류) */
  userId?: string;
  /** draft | review | approve | final — 전결 버튼 등 */
  stepKind?: 'draft' | 'review' | 'approve' | 'final';
};

export type AuditEventType = 'change' | 'lineage' | 'emission_factor' | 'version' | 'freeze';

export type AuditEventStatus = 'approved' | 'pending' | 'rejected' | 'skipped';

export type ChangeDetails = {
  kind: 'change';
  before: string;
  after: string;
  /** ApprovalSystem.jsx changes.delta / impact */
  delta?: string;
  impact?: string;
  reason: string;
  lineageRef: string;
  factorRef: string;
  versionRef: string;
  /** AuditTrail_clean — 클릭형 계보 플로우 */
  lineage?: string[];
  lineageDetail?: string[];
  versionImpact?: string | null;
  factorName?: string;
  factorValue?: string;
  factorSource?: string;
};

export type LineageDetails = {
  kind: 'lineage';
  lineageRef: string;
  lineage?: string[];
  lineageDetail?: string[];
};

export type EmissionFactorDetails = {
  kind: 'emission_factor';
  factorName: string;
  value: string;
  source: string;
};

export type VersionDetails = {
  kind: 'version';
  version: string;
  totalEmission: string;
  diff: string;
  isFreeze: boolean;
  /** AuditTrail_clean — Scope 요약 */
  s1?: string;
  s2?: string;
  s3?: string;
  versionDiffRows?: { id: string; item: string; delta: string; pct: string }[];
};

export type AuditEventDetails = ChangeDetails | LineageDetails | EmissionFactorDetails | VersionDetails;

export interface AuditEventDTO {
  id: string;
  type: AuditEventType;
  at: string;
  corp: string;
  scope?: string;
  summary: string;
  author: string;
  status: AuditEventStatus;
  approvalSteps: ApprovalStep[];
  details: AuditEventDetails;
  /** ApprovalSystem.jsx 본문 */
  body?: string;
  attachments?: string[];
  urgency?: 'normal' | 'high' | 'urgent';
  /** 수신함 전용 */
  isReceived?: boolean;
  rejectionHistory?: { at: string; by: string; comment: string }[];
  /** 기안자 (기안함 탭) */
  draftedBy?: { id: string; name: string; dept: string };
}

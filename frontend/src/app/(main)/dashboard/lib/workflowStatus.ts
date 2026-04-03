/** SR/GH 공통 워크플로 상태 (화면 용어 통일) */

export type WorkflowStatus = 'not_started' | 'drafting' | 'submitted' | 'approved' | 'rejected';

export const WORKFLOW_STATUS_LABEL: Record<WorkflowStatus, string> = {
  not_started: '미작성',
  drafting: '작성중',
  submitted: '제출완료',
  approved: '승인완료',
  rejected: '반려',
};

export const WORKFLOW_STATUS_STYLE: Record<
  WorkflowStatus,
  { bg: string; color: string }
> = {
  not_started: { bg: '#F3F4F6', color: '#6B7280' },
  drafting: { bg: '#FEF3C7', color: '#B45309' },
  submitted: { bg: '#DBEAFE', color: '#1D4ED8' },
  approved: { bg: '#DCFCE7', color: '#15803D' },
  rejected: { bg: '#FEE2E2', color: '#DC2626' },
};

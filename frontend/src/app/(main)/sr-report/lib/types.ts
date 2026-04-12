export type SrStdType = 'GRI' | 'SASB' | 'TCFD' | 'ESRS' | 'IFRS';

export type SrCategory = '환경' | '사회' | '지배구조';

export type SrDpStatus = 'todo' | 'wip' | 'submitted' | 'approved' | 'rejected';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export type SrEditorMode = 'standards' | 'ghg';

/** 지주사 워크스페이스 탭(SR 플랫폼 취합·검토 제외) */
export type HoldingSrTabId = 'h-aggregate-write' | 'h-write' | 'h-gen';

export type SrStandardRef = {
  code: string;
  label: string;
  type: SrStdType;
};

export type SrDpCard = {
  id: string;
  title: string;
  standards: SrStandardRef[];
  category: SrCategory;
  deadline: string;
  status: SrDpStatus;
  assignee: string;
  savedText: string;
};

export type SrApprovalDoc = {
  id: string;
  dpId: string;
  docNo: string;
  title: string;
  drafter: string;
  draftedAt: string;
  status: ApprovalStatus;
  body: string;
  attachments: string[];
  comments: Array<{ author: string; date: string; text: string }>;
  rejReason: string;
};


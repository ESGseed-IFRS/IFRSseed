/**
 * 대시보드 결재함 통합 문서 모델 — APPROVAL_INBOX_DASHBOARD_STRATEGY.md §4·§5
 * 초기: 프론트 mock. API 연동 시 동일 스키마로 대체.
 */

import type { ApprovalMenuKey } from '@/app/(main)/dashboard/lib/dashboardNewMock';

export type ApprovalDomainUnified = 'sr' | 'ghg';

export type ApprovalDocStatus =
  | 'draft'
  | 'pending'
  | 'inProgress'
  | 'approved'
  | 'rejected'
  | 'received';

export type EntityType = 'datacenter' | 'domestic_site' | 'overseas_legal' | 'subsidiary';

export type ApprovalPerson = { id: string; name: string; dept: string; title?: string };

export type ApprovalLine = {
  role: '기안' | '검토' | '승인' | '합의' | '협조' | '수신' | '참조';
  people: ApprovalPerson[];
};

export type ApprovalDocEntitySnapshot = {
  id: string;
  entityType: EntityType;
  entityName: string;
  entityCode?: string;
  snapshotAt: string;
  companyName?: string;
  masterEntityId?: string;
};

export type ApprovalDocUnified = {
  id: string;
  domain: ApprovalDomainUnified;
  menuKey: ApprovalMenuKey;
  status: ApprovalDocStatus;
  entitySnapshot: ApprovalDocEntitySnapshot;
  draftedAt: string;
  drafter: ApprovalPerson;
  dept: string;
  retention: string;
  title: string;
  bodyHtml: string;
  opinion: string;
  attachments: Array<{ name: string; size?: string; url?: string }>;
  approvalLines: ApprovalLine[];
  links?: {
    srDpId?: string;
    srDpCode?: string;
    ghgAuditEventId?: string;
    previousDocId?: string;
  };
  updatedAt: string;
  /** 목록에서 내 차례 핀용(목 mock) */
  myTurn?: boolean;
};

export const ENTITY_TYPE_LABEL: Record<EntityType, string> = {
  datacenter: '데이터센터',
  domestic_site: '국내사업장',
  overseas_legal: '해외법인',
  subsidiary: '자회사',
};

export const APPROVAL_MENU_LABEL: Record<ApprovalMenuKey, string> = {
  'inbox.request': '결재요청',
  'inbox.history': '결재내역',
  'inbox.cc': '수신참조',
  'outbox.progress': '결재 진행함',
  'outbox.completed': '결재 완료함',
  'outbox.rejected': '반려함',
  'outbox.draft': '임시저장',
};

export const STATUS_LABEL: Record<ApprovalDocStatus, string> = {
  draft: '임시저장',
  pending: '결재 대기',
  inProgress: '진행 중',
  approved: '승인 완료',
  rejected: '반려',
  received: '수신',
};

function snap(
  entityType: EntityType,
  entityName: string,
  companyName?: string,
  entityCode?: string,
): ApprovalDocEntitySnapshot {
  return {
    id: `snap-${entityType}-${entityName}`,
    entityType,
    entityName,
    companyName,
    entityCode,
    snapshotAt: '2026-03-24T09:00:00+09:00',
  };
}

export const APPROVAL_UNIFIED_MOCK: ApprovalDocUnified[] = [
  {
    id: 'ESG-2026-0401',
    domain: 'ghg',
    menuKey: 'inbox.request',
    status: 'pending',
    entitySnapshot: snap('domestic_site', '판교 DC', '삼성에스디에스(주)', 'DC-PG-01'),
    draftedAt: '2026-03-24T10:12:00+09:00',
    drafter: { id: 'u1', name: '김환경', dept: '미라콤 ENV팀', title: '매니저' },
    dept: '미라콤 ENV팀',
    retention: '5년',
    title: 'Scope 2 전력 증빙 수정 승인 요청',
    opinion: '증빙 파일 교체 및 산정 근거 보완 건입니다. 검토 부탁드립니다.',
    bodyHtml:
      '<p><strong>요약</strong></p><p>전력 사용량 집계 구간 조정에 따른 Scope 2 재산정 결과를 첨부합니다.</p><ul><li>적용 배출계수: 한국전력 2025</li><li>변경 전후 배출량 비교표 참조</li></ul>',
    attachments: [{ name: 'scope2_evidence_v2.xlsx', size: '420KB' }],
    approvalLines: [
      { role: '기안', people: [{ id: 'u1', name: '김환경', dept: '미라콤 ENV팀' }] },
      { role: '검토', people: [{ id: 'u2', name: '이검토', dept: '미라콤 ESG팀' }] },
      { role: '승인', people: [{ id: 'u3', name: '박승인', dept: '지주 ESG팀' }] },
    ],
    links: { ghgAuditEventId: 'ghg-ev-2401' },
    updatedAt: '2026-03-24T10:12:00+09:00',
    myTurn: true,
  },
  {
    id: 'ESG-2026-0398',
    domain: 'sr',
    menuKey: 'outbox.progress',
    status: 'inProgress',
    entitySnapshot: snap('subsidiary', '지속가능경영실', '(주)에스코어', 'SUB-ESC'),
    draftedAt: '2026-03-24T09:40:00+09:00',
    drafter: { id: 'me', name: '본인', dept: '지속가능경영팀' },
    dept: '지속가능경영팀',
    retention: '영구',
    title: '공시 DP 패키지(1차) 제출 승인 요청',
    opinion: 'DP-E-01~03 패키지 제출본입니다.',
    bodyHtml:
      '<p>IFRS/ESRS 공시 데이터 포인트 패키지 1차 제출 건입니다.</p><p>첨부: 집계표 및 근거 링크 목록</p>',
    attachments: [{ name: 'dp_package_round1.pdf', size: '1.2MB' }],
    approvalLines: [
      { role: '기안', people: [{ id: 'me', name: '본인', dept: '지속가능경영팀' }] },
      { role: '승인', people: [{ id: 'u4', name: '최지주', dept: '지주 ESG팀' }] },
    ],
    links: { srDpId: 'dp-e-01', srDpCode: 'DP-E-01' },
    updatedAt: '2026-03-24T09:40:00+09:00',
  },
  {
    id: 'ESG-2026-0385',
    domain: 'ghg',
    menuKey: 'inbox.cc',
    status: 'received',
    entitySnapshot: snap('datacenter', '서울 리전', '삼성에스디에스(주)', 'DC-SEL-01'),
    draftedAt: '2026-03-20T08:00:00+09:00',
    drafter: { id: 'sys', name: '플랫폼', dept: '시스템' },
    dept: '시스템',
    retention: '3년',
    title: '배출계수 버전 변경 알림(참조)',
    opinion: '참조용 공문입니다.',
    bodyHtml: '<p>국가별 배출계수 테이블 v3.2 적용 안내</p>',
    attachments: [],
    approvalLines: [{ role: '참조', people: [{ id: 'u1', name: '김환경', dept: '미라콤 ENV팀' }] }],
    links: { ghgAuditEventId: 'ghg-coef-2385' },
    updatedAt: '2026-03-20T08:00:00+09:00',
  },
  {
    id: 'ESG-2026-0390',
    domain: 'ghg',
    menuKey: 'outbox.completed',
    status: 'approved',
    entitySnapshot: snap('domestic_site', '수원 사업장', '시큐아이(주)'),
    draftedAt: '2026-03-22T16:00:00+09:00',
    drafter: { id: 'u5', name: '정데이터', dept: '시큐아이 운영팀' },
    dept: '시큐아이 운영팀',
    retention: '5년',
    title: '이상치 조치 완료 보고',
    opinion: '이상치 원인 분석 및 조치 완료 보고드립니다.',
    bodyHtml: '<p>YoY 편차 15% 항목에 대한 근거 자료 및 수정 값 반영 내역</p>',
    attachments: [{ name: 'anomaly_closure.pdf', size: '890KB' }],
    approvalLines: [
      { role: '기안', people: [{ id: 'u5', name: '정데이터', dept: '시큐아이 운영팀' }] },
      { role: '승인', people: [{ id: 'u3', name: '박승인', dept: '지주 ESG팀' }] },
    ],
    links: { ghgAuditEventId: 'ghg-an-2390' },
    updatedAt: '2026-03-22T16:00:00+09:00',
  },
  {
    id: 'ESG-2026-0388',
    domain: 'sr',
    menuKey: 'inbox.history',
    status: 'approved',
    entitySnapshot: snap('overseas_legal', 'EU 법인 운영본부', '오픈핸즈 유럽법인', 'EU-OH-01'),
    draftedAt: '2026-03-21T11:30:00+09:00',
    drafter: { id: 'u6', name: '한공시', dept: '삼성SDS 지속가능경영팀' },
    dept: '삼성SDS 지속가능경영팀',
    retention: '영구',
    title: 'GRI 공시 항목 보완본',
    opinion: '지주 검토 의견 반영 보완본입니다.',
    bodyHtml: '<p>GRI 2 / GRI 3 및 주제별 공시 항목 보완</p>',
    attachments: [{ name: 'gri_supplement.docx', size: '2.1MB' }],
    approvalLines: [
      { role: '기안', people: [{ id: 'u6', name: '한공시', dept: '삼성SDS 지속가능경영팀' }] },
      { role: '승인', people: [{ id: 'u4', name: '최지주', dept: '지주 ESG팀' }] },
    ],
    links: { srDpCode: 'DP-S-01' },
    updatedAt: '2026-03-21T11:30:00+09:00',
  },
  {
    id: 'ESG-2026-0410',
    domain: 'sr',
    menuKey: 'outbox.draft',
    status: 'draft',
    entitySnapshot: snap('subsidiary', 'ESG기획팀', '(주)멀티캠퍼스'),
    draftedAt: '2026-03-25T09:05:00+09:00',
    drafter: { id: 'me', name: '본인', dept: 'ESG기획팀' },
    dept: 'ESG기획팀',
    retention: '5년',
    title: 'SR DP 패키지 임시저장',
    opinion: '',
    bodyHtml: '<p>(임시) 데이터 포인트 패키지 초안</p>',
    attachments: [],
    approvalLines: [{ role: '기안', people: [{ id: 'me', name: '본인', dept: 'ESG기획팀' }] }],
    links: { srDpCode: 'DP-E-02' },
    updatedAt: '2026-03-25T09:05:00+09:00',
  },
  {
    id: 'ESG-2026-0411',
    domain: 'ghg',
    menuKey: 'outbox.rejected',
    status: 'rejected',
    entitySnapshot: snap('domestic_site', '창원 공장', '엠로(주)', 'EM-CW'),
    draftedAt: '2026-03-25T08:30:00+09:00',
    drafter: { id: 'u7', name: '오산정', dept: '엠로 EHS팀' },
    dept: '엠로 EHS팀',
    retention: '5년',
    title: 'Scope 1 연료 산정 재상신 요청',
    opinion: '반려 사유: 연료 단위 환산 근거 미첨부',
    bodyHtml: '<p>재상신 본문 초안 — 근거 첨부 예정</p>',
    attachments: [{ name: 'fuel_calc_v3.xlsx', size: '310KB' }],
    approvalLines: [
      { role: '기안', people: [{ id: 'u7', name: '오산정', dept: '엠로 EHS팀' }] },
      { role: '승인', people: [{ id: 'u3', name: '박승인', dept: '지주 ESG팀' }] },
    ],
    links: { ghgAuditEventId: 'ghg-fuel-2411', previousDocId: 'ESG-2026-0399' },
    updatedAt: '2026-03-25T08:30:00+09:00',
  },
];

export function formatEntitySourceLine(doc: ApprovalDocUnified): string {
  const { companyName, entityName, entityCode } = doc.entitySnapshot;
  if (companyName) {
    return entityName ? `${companyName} · ${entityName}` : companyName;
  }
  if (entityName) return entityName;
  return entityCode ?? '출처 미지정';
}

function matchesSearch(doc: ApprovalDocUnified, q: string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  const pool = [
    doc.id,
    doc.title,
    doc.drafter.name,
    doc.drafter.dept,
    doc.entitySnapshot.companyName,
    doc.entitySnapshot.entityName,
    doc.entitySnapshot.entityCode,
    doc.links?.srDpId,
    doc.links?.srDpCode,
    doc.links?.ghgAuditEventId,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const tokens = s.split(/\s+/).filter(Boolean);
  return tokens.every((t) => pool.includes(t) || pool.indexOf(t) >= 0);
}

export type UnifiedDocFilter = {
  menuKey: ApprovalMenuKey;
  domain: 'all' | ApprovalDomainUnified;
  entityType: 'all' | EntityType;
  q: string;
};

export function filterUnifiedDocs(docs: ApprovalDocUnified[], f: UnifiedDocFilter): ApprovalDocUnified[] {
  return docs.filter((d) => {
    if (d.menuKey !== f.menuKey) return false;
    if (f.domain !== 'all' && d.domain !== f.domain) return false;
    if (f.entityType !== 'all' && d.entitySnapshot.entityType !== f.entityType) return false;
    if (!matchesSearch(d, f.q)) return false;
    return true;
  });
}

export function sortUnifiedDocs(docs: ApprovalDocUnified[]): ApprovalDocUnified[] {
  return [...docs].sort((a, b) => {
    const pin = Number(!!b.myTurn) - Number(!!a.myTurn);
    if (pin !== 0) return pin;
    const ua = new Date(a.updatedAt).getTime();
    const ub = new Date(b.updatedAt).getTime();
    if (ub !== ua) return ub - ua;
    return new Date(b.draftedAt).getTime() - new Date(a.draftedAt).getTime();
  });
}

/** 사이드바 배지: 결재요청함 중 처리 필요 건(목 기준) */
export function getApprovalInboxBadgeCount(): number {
  return APPROVAL_UNIFIED_MOCK.filter(
    (d) => d.menuKey === 'inbox.request' && (d.status === 'pending' || d.status === 'inProgress'),
  ).length;
}

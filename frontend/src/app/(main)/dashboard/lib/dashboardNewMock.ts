/**
 * 대시보드(신규) 목 데이터 — API 연동 시 동일 스키마로 대체
 */

import type { WorkflowStatus } from '@/app/(main)/dashboard/lib/workflowStatus';
import { GHG_STATUS } from '@/app/(main)/dashboard/lib/mockData';

export type DashboardMode = 'subsidiary' | 'holding';

export type ApprovalDomain = 'ghg' | 'sr';

export type ApprovalMenuKey =
  | 'outbox.progress'
  | 'outbox.completed'
  | 'outbox.rejected'
  | 'outbox.draft'
  | 'inbox.request'
  | 'inbox.history'
  | 'inbox.cc';

export interface AffiliateGhgRow {
  entity: string;
  rawCompletenessPct: number;
  anomalyOpen: number;
  calcFitPct: number;
  pipeline: WorkflowStatus;
}

export interface AffiliateSrRow {
  entity: string;
  dpPackage: WorkflowStatus;
  submit: WorkflowStatus;
  review: WorkflowStatus;
  submittedAt: string | null;
}

export interface HoldingPageRow {
  pageTitle: string;
  status: WorkflowStatus;
  progressPct: number;
}

export interface DpAggregateRow {
  dpCode: string;
  label: string;
  sourcesFilled: number;
  sourcesTotal: number;
  status: WorkflowStatus;
}

export interface SubsidiaryDpRow {
  dpCode: string;
  label: string;
  status: WorkflowStatus;
  progressPct: number;
}

export interface ApprovalDocRow {
  id: string;
  domain: ApprovalDomain;
  title: string;
  menuKey: ApprovalMenuKey;
  actor: string;
  updatedAt: string;
}

export const HOLDING_AFFILIATE_GHG: AffiliateGhgRow[] = [
  { entity: '미라콤', rawCompletenessPct: 82, anomalyOpen: 4, calcFitPct: 91, pipeline: 'drafting' },
  { entity: '시큐아이', rawCompletenessPct: 77, anomalyOpen: 6, calcFitPct: 86, pipeline: 'drafting' },
  { entity: '에스코어', rawCompletenessPct: 70, anomalyOpen: 3, calcFitPct: 88, pipeline: 'submitted' },
  { entity: '멀티캠퍼스', rawCompletenessPct: 64, anomalyOpen: 5, calcFitPct: 82, pipeline: 'drafting' },
  { entity: '엠로', rawCompletenessPct: 93, anomalyOpen: 1, calcFitPct: 97, pipeline: 'submitted' },
  { entity: '오픈핸즈', rawCompletenessPct: 0, anomalyOpen: 0, calcFitPct: 0, pipeline: 'not_started' },
];

export const HOLDING_AFFILIATE_SR: AffiliateSrRow[] = [
  {
    entity: '미라콤',
    dpPackage: 'drafting',
    submit: 'submitted',
    review: 'drafting',
    submittedAt: '2026-03-24 15:20',
  },
  {
    entity: '시큐아이',
    dpPackage: 'drafting',
    submit: 'drafting',
    review: 'not_started',
    submittedAt: null,
  },
  {
    entity: '에스코어',
    dpPackage: 'approved',
    submit: 'submitted',
    review: 'approved',
    submittedAt: '2026-03-23 18:10',
  },
  {
    entity: '멀티캠퍼스',
    dpPackage: 'drafting',
    submit: 'drafting',
    review: 'not_started',
    submittedAt: null,
  },
  {
    entity: '엠로',
    dpPackage: 'approved',
    submit: 'submitted',
    review: 'approved',
    submittedAt: '2026-03-23 18:40',
  },
  {
    entity: '오픈핸즈',
    dpPackage: 'drafting',
    submit: 'not_started',
    review: 'not_started',
    submittedAt: null,
  },
];

export const HOLDING_PAGE_ROWS: HoldingPageRow[] = [
  { pageTitle: 'CEO 메시지', status: 'approved', progressPct: 100 },
  { pageTitle: '회사 개요', status: 'approved', progressPct: 100 },
  { pageTitle: 'ESG 전략 및 목표', status: 'approved', progressPct: 100 },
  { pageTitle: '환경 성과 데이터', status: 'drafting', progressPct: 65 },
  { pageTitle: '사회 성과 데이터', status: 'drafting', progressPct: 40 },
  { pageTitle: '지배구조 현황', status: 'not_started', progressPct: 0 },
  { pageTitle: '이해관계자 참여', status: 'approved', progressPct: 100 },
  { pageTitle: 'GRI 인덱스', status: 'not_started', progressPct: 0 },
  { pageTitle: '제3자 검증 의견', status: 'drafting', progressPct: 30 },
  { pageTitle: '보고 경계 및 기준', status: 'approved', progressPct: 100 },
];

export const HOLDING_DP_AGGREGATE: DpAggregateRow[] = [
  { dpCode: 'DP-E-01', label: '온실가스 배출량', sourcesFilled: 2, sourcesTotal: 3, status: 'drafting' },
  { dpCode: 'DP-E-02', label: '에너지 사용', sourcesFilled: 2, sourcesTotal: 3, status: 'drafting' },
  { dpCode: 'DP-E-03', label: '취수 및 방류', sourcesFilled: 3, sourcesTotal: 3, status: 'approved' },
  { dpCode: 'DP-E-04', label: '기후 리스크 평가', sourcesFilled: 1, sourcesTotal: 3, status: 'drafting' },
  { dpCode: 'DP-S-01', label: '산업안전 및 보건', sourcesFilled: 3, sourcesTotal: 3, status: 'approved' },
  { dpCode: 'DP-S-02', label: '신규 채용 및 이직', sourcesFilled: 2, sourcesTotal: 3, status: 'drafting' },
  { dpCode: 'DP-S-03', label: '공급망 인권실사', sourcesFilled: 0, sourcesTotal: 3, status: 'not_started' },
  { dpCode: 'DP-G-01', label: '이사회 다양성', sourcesFilled: 2, sourcesTotal: 3, status: 'approved' },
];

/**
 * 지주사 관점: DP 코드별 계열사 제출/검토(승인/반려) 상태 mock
 * - review: 'drafting'을 "검토중(승인 대기)"로 취급
 */
export const HOLDING_AFFILIATE_SR_BY_DP: Record<string, AffiliateSrRow[]> = {
  'DP-E-01': [
    {
      entity: '미라콤',
      dpPackage: 'drafting',
      submit: 'submitted',
      review: 'drafting',
      submittedAt: '2026-03-24 15:20',
    },
    {
      entity: '시큐아이',
      dpPackage: 'drafting',
      submit: 'drafting',
      review: 'not_started',
      submittedAt: null,
    },
    {
      entity: '에스코어',
      dpPackage: 'drafting',
      submit: 'submitted',
      review: 'drafting',
      submittedAt: '2026-03-24 14:10',
    },
    {
      entity: '멀티캠퍼스',
      dpPackage: 'drafting',
      submit: 'drafting',
      review: 'not_started',
      submittedAt: null,
    },
    {
      entity: '엠로',
      dpPackage: 'approved',
      submit: 'submitted',
      review: 'approved',
      submittedAt: '2026-03-23 18:40',
    },
    {
      entity: '오픈핸즈',
      dpPackage: 'drafting',
      submit: 'not_started',
      review: 'not_started',
      submittedAt: null,
    },
  ],
  'DP-E-02': [
    {
      entity: '미라콤',
      dpPackage: 'drafting',
      submit: 'submitted',
      review: 'rejected',
      submittedAt: '2026-03-24 12:10',
    },
    {
      entity: '시큐아이',
      dpPackage: 'drafting',
      submit: 'not_started',
      review: 'not_started',
      submittedAt: null,
    },
    {
      entity: '에스코어',
      dpPackage: 'drafting',
      submit: 'submitted',
      review: 'drafting',
      submittedAt: '2026-03-23 13:40',
    },
    {
      entity: '멀티캠퍼스',
      dpPackage: 'drafting',
      submit: 'not_started',
      review: 'not_started',
      submittedAt: null,
    },
    {
      entity: '엠로',
      dpPackage: 'drafting',
      submit: 'submitted',
      review: 'drafting',
      submittedAt: '2026-03-23 09:40',
    },
    {
      entity: '오픈핸즈',
      dpPackage: 'drafting',
      submit: 'not_started',
      review: 'not_started',
      submittedAt: null,
    },
  ],
  'DP-S-01': [
    {
      entity: '미라콤',
      dpPackage: 'drafting',
      submit: 'drafting',
      review: 'not_started',
      submittedAt: null,
    },
    {
      entity: '시큐아이',
      dpPackage: 'approved',
      submit: 'submitted',
      review: 'approved',
      submittedAt: '2026-03-22 17:30',
    },
    {
      entity: '에스코어',
      dpPackage: 'drafting',
      submit: 'drafting',
      review: 'not_started',
      submittedAt: null,
    },
    {
      entity: '멀티캠퍼스',
      dpPackage: 'drafting',
      submit: 'drafting',
      review: 'not_started',
      submittedAt: null,
    },
    {
      entity: '엠로',
      dpPackage: 'drafting',
      submit: 'submitted',
      review: 'rejected',
      submittedAt: '2026-03-22 10:05',
    },
    {
      entity: '오픈핸즈',
      dpPackage: 'drafting',
      submit: 'not_started',
      review: 'not_started',
      submittedAt: null,
    },
  ],
  'DP-E-03': [
    { entity: '미라콤', dpPackage: 'approved', submit: 'submitted', review: 'approved', submittedAt: '2026-03-21 14:30' },
    { entity: '시큐아이', dpPackage: 'approved', submit: 'submitted', review: 'approved', submittedAt: '2026-03-21 16:00' },
    { entity: '에스코어', dpPackage: 'approved', submit: 'submitted', review: 'approved', submittedAt: '2026-03-21 13:20' },
    { entity: '멀티캠퍼스', dpPackage: 'approved', submit: 'submitted', review: 'approved', submittedAt: '2026-03-21 12:55' },
    { entity: '엠로', dpPackage: 'approved', submit: 'submitted', review: 'approved', submittedAt: '2026-03-21 10:20' },
    { entity: '오픈핸즈', dpPackage: 'not_started', submit: 'not_started', review: 'not_started', submittedAt: null },
  ],
  'DP-E-04': [
    { entity: '미라콤', dpPackage: 'drafting', submit: 'submitted', review: 'drafting', submittedAt: '2026-03-24 11:00' },
    { entity: '시큐아이', dpPackage: 'not_started', submit: 'not_started', review: 'not_started', submittedAt: null },
    { entity: '에스코어', dpPackage: 'drafting', submit: 'submitted', review: 'drafting', submittedAt: '2026-03-23 16:20' },
    { entity: '멀티캠퍼스', dpPackage: 'not_started', submit: 'not_started', review: 'not_started', submittedAt: null },
    { entity: '엠로', dpPackage: 'not_started', submit: 'not_started', review: 'not_started', submittedAt: null },
    { entity: '오픈핸즈', dpPackage: 'not_started', submit: 'not_started', review: 'not_started', submittedAt: null },
  ],
  'DP-S-02': [
    { entity: '미라콤', dpPackage: 'drafting', submit: 'submitted', review: 'drafting', submittedAt: '2026-03-25 09:30' },
    { entity: '시큐아이', dpPackage: 'drafting', submit: 'submitted', review: 'rejected', submittedAt: '2026-03-24 14:20' },
    { entity: '에스코어', dpPackage: 'drafting', submit: 'submitted', review: 'drafting', submittedAt: '2026-03-24 08:10' },
    { entity: '멀티캠퍼스', dpPackage: 'drafting', submit: 'submitted', review: 'rejected', submittedAt: '2026-03-24 11:45' },
    { entity: '엠로', dpPackage: 'not_started', submit: 'not_started', review: 'not_started', submittedAt: null },
    { entity: '오픈핸즈', dpPackage: 'not_started', submit: 'not_started', review: 'not_started', submittedAt: null },
  ],
  'DP-S-03': [
    { entity: '미라콤', dpPackage: 'not_started', submit: 'not_started', review: 'not_started', submittedAt: null },
    { entity: '시큐아이', dpPackage: 'not_started', submit: 'not_started', review: 'not_started', submittedAt: null },
    { entity: '에스코어', dpPackage: 'not_started', submit: 'not_started', review: 'not_started', submittedAt: null },
    { entity: '멀티캠퍼스', dpPackage: 'not_started', submit: 'not_started', review: 'not_started', submittedAt: null },
    { entity: '엠로', dpPackage: 'not_started', submit: 'not_started', review: 'not_started', submittedAt: null },
    { entity: '오픈핸즈', dpPackage: 'not_started', submit: 'not_started', review: 'not_started', submittedAt: null },
  ],
  'DP-G-01': [
    { entity: '미라콤', dpPackage: 'approved', submit: 'submitted', review: 'approved', submittedAt: '2026-03-20 18:00' },
    { entity: '시큐아이', dpPackage: 'drafting', submit: 'submitted', review: 'drafting', submittedAt: '2026-03-24 17:40' },
    { entity: '에스코어', dpPackage: 'approved', submit: 'submitted', review: 'approved', submittedAt: '2026-03-20 14:30' },
    { entity: '멀티캠퍼스', dpPackage: 'drafting', submit: 'submitted', review: 'drafting', submittedAt: '2026-03-22 10:10' },
    { entity: '엠로', dpPackage: 'approved', submit: 'submitted', review: 'approved', submittedAt: '2026-03-20 10:15' },
    { entity: '오픈핸즈', dpPackage: 'not_started', submit: 'not_started', review: 'not_started', submittedAt: null },
  ],
};

export const SUBSIDIARY_DP_ROWS: SubsidiaryDpRow[] = [
  { dpCode: 'DP-E-01', label: '온실가스 배출량', status: 'drafting', progressPct: 78 },
  { dpCode: 'DP-E-02', label: '에너지 사용', status: 'submitted', progressPct: 100 },
  { dpCode: 'DP-E-03', label: '취수 및 방류', status: 'approved', progressPct: 100 },
  { dpCode: 'DP-E-04', label: '기후 리스크 평가', status: 'drafting', progressPct: 45 },
  { dpCode: 'DP-S-01', label: '산업안전 및 보건', status: 'submitted', progressPct: 100 },
  { dpCode: 'DP-S-02', label: '신규 채용 및 이직', status: 'not_started', progressPct: 0 },
  { dpCode: 'DP-S-03', label: '공급망 인권실사', status: 'not_started', progressPct: 0 },
  { dpCode: 'DP-G-01', label: '이사회 다양성', status: 'approved', progressPct: 100 },
];

function subsidiaryGhgDerived() {
  const rawTotal = GHG_STATUS.rawData.length;
  const rawDone = GHG_STATUS.rawData.filter((r) => r.done).length;
  const rawPct = rawTotal ? Math.round((rawDone / rawTotal) * 100) : 0;
  const anomalyOpen = GHG_STATUS.anomaly.unresolved;
  const scopeOk =
    GHG_STATUS.scope1.done &&
    GHG_STATUS.scope2.done &&
    !GHG_STATUS.scope1.warn &&
    !GHG_STATUS.scope2.warn;
  const calcFitPct = scopeOk ? 94 : 78;
  let pipeline: WorkflowStatus = 'not_started';
  if (rawPct >= 100 && anomalyOpen === 0 && scopeOk) pipeline = 'submitted';
  else if (rawPct > 0 || anomalyOpen > 0 || GHG_STATUS.scope1.done) pipeline = 'drafting';
  return { rawPct, anomalyOpen, calcFitPct, pipeline };
}

export function getSubsidiaryOverviewGhg() {
  return subsidiaryGhgDerived();
}

export function getHoldingSelfGhg(): AffiliateGhgRow {
  const s = subsidiaryGhgDerived();
  return {
    entity: '삼성에스디에스㈜ (지주)',
    rawCompletenessPct: s.rawPct,
    anomalyOpen: s.anomalyOpen,
    calcFitPct: s.calcFitPct,
    pipeline: s.pipeline,
  };
}

export const APPROVAL_COUNTS_SUBSIDIARY: Record<
  ApprovalMenuKey,
  Record<ApprovalDomain, number>
> = {
  'outbox.progress': { ghg: 1, sr: 2 },
  'outbox.completed': { ghg: 8, sr: 6 },
  'outbox.rejected': { ghg: 1, sr: 1 },
  'outbox.draft': { ghg: 1, sr: 1 },
  'inbox.request': { ghg: 2, sr: 1 },
  'inbox.history': { ghg: 3, sr: 3 },
  'inbox.cc': { ghg: 1, sr: 1 },
};

export const APPROVAL_COUNTS_HOLDING: Record<
  ApprovalMenuKey,
  Record<ApprovalDomain, number>
> = {
  'outbox.progress': { ghg: 3, sr: 2 },
  'outbox.completed': { ghg: 24, sr: 18 },
  'outbox.rejected': { ghg: 2, sr: 2 },
  'outbox.draft': { ghg: 2, sr: 1 },
  'inbox.request': { ghg: 5, sr: 6 },
  'inbox.history': { ghg: 7, sr: 8 },
  'inbox.cc': { ghg: 4, sr: 5 },
};

export const APPROVAL_DOCS_MOCK: ApprovalDocRow[] = [
  {
    id: 'A-2401',
    domain: 'ghg',
    title: 'Scope 2 전력 증빙 수정 승인요청',
    menuKey: 'inbox.request',
    actor: '미라콤 ENV팀',
    updatedAt: '03-24 10:12',
  },
  {
    id: 'A-2402',
    domain: 'sr',
    title: '공시 DP 패키지(1차) 제출',
    menuKey: 'outbox.progress',
    actor: '본인 기안',
    updatedAt: '03-24 09:40',
  },
  {
    id: 'A-2390',
    domain: 'ghg',
    title: '이상치 조치 완료 보고',
    menuKey: 'outbox.completed',
    actor: '시스템',
    updatedAt: '03-22 16:00',
  },
  {
    id: 'A-2388',
    domain: 'sr',
    title: 'GRI 공시 항목 보완본',
    menuKey: 'inbox.history',
    actor: '삼성SDS 지속가능경영팀',
    updatedAt: '03-21 11:30',
  },
  {
    id: 'A-2385',
    domain: 'ghg',
    title: '배출계수 버전 변경 알림(참조)',
    menuKey: 'inbox.cc',
    actor: '플랫폼',
    updatedAt: '03-20 08:00',
  },
  {
    id: 'A-2410',
    domain: 'sr',
    title: 'SR DP 패키지 임시저장',
    menuKey: 'outbox.draft',
    actor: '본인 기안',
    updatedAt: '03-25 09:05',
  },
  {
    id: 'A-2411',
    domain: 'ghg',
    title: 'Scope 1 연료 산정 재상신 요청',
    menuKey: 'outbox.rejected',
    actor: '삼성SDS 지속가능경영팀',
    updatedAt: '03-25 08:30',
  },
];

/** 계열사 SR(DP 패키지) 요약 — 목업 */
export function getSubsidiarySrSummary(): {
  dpPackage: WorkflowStatus;
  submit: WorkflowStatus;
  review: WorkflowStatus;
} {
  return {
    dpPackage: 'drafting',
    submit: 'submitted',
    review: 'drafting',
  };
}

import type { ApprovalDomain, ApprovalMenuKey } from '@/app/(main)/dashboard/lib/dashboardNewMock';

export type DashboardApprovalLinkOptions = {
  mode?: 'subsidiary' | 'holding';
  domain?: ApprovalDomain | 'all';
  menu?: ApprovalMenuKey;
  docId?: string | null;
  srDpId?: string | null;
};

/** SR·GHG·감사 공통 — 대시보드 결재함 딥링크 */
export function buildDashboardApprovalHref(opts: DashboardApprovalLinkOptions = {}): string {
  const q = new URLSearchParams();
  q.set('version', 'new');
  q.set('mode', opts.mode ?? 'subsidiary');
  q.set('tab', 'approval');
  q.set('domain', opts.domain ?? 'all');
  q.set('menu', opts.menu ?? 'inbox.request');
  if (opts.docId) q.set('docId', opts.docId);
  if (opts.srDpId) {
    q.set('dpId', opts.srDpId);
    q.set('srDpId', opts.srDpId);
  }
  return `/dashboard?${q.toString()}`;
}

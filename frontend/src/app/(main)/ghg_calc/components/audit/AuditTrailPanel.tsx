'use client';

/**
 * AUDIT_TRAIL_UNIFIED_SINGLE_VIEW_STRATEGY.md
 * - Audit: 단일 통합 화면(AuditTrailFeedView)만 렌더
 * - 결재 처리: 대시보드 통합 결재함으로 이동
 */
import { useMemo, useState } from 'react';
import { AuditTrailFeedView } from './AuditTrailFeedView';
import { createInitialApprovalMap, AUDIT_CURRENT_USER, AUDIT_CURRENT_USER_ID } from './auditApprovalState';
import { countActionableApprovals } from './approvalWorkflow';
import { buildDashboardApprovalHref } from '@/app/(main)/dashboard/lib/dashboardApprovalLink';

export function AuditTrailPanel() {
  const [approvalMap] = useState(createInitialApprovalMap);
  const myPendingCount = useMemo(
    () => countActionableApprovals(approvalMap, AUDIT_CURRENT_USER, AUDIT_CURRENT_USER_ID),
    [approvalMap],
  );
  const dashboardApprovalHref = useMemo(
    () => buildDashboardApprovalHref({ domain: 'all', menu: 'inbox.request' }),
    [],
  );

  return (
    <AuditTrailFeedView
      approvalMap={approvalMap}
      myPendingCount={myPendingCount}
      dashboardApprovalHref={dashboardApprovalHref}
    />
  );
}

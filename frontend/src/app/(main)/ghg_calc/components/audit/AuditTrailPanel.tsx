'use client';

/**
 * AUDIT_TRAIL_UNIFIED_SINGLE_VIEW_STRATEGY.md
 * - Audit: 단일 통합 화면(AuditTrailFeedView)만 렌더
 * - 결재함: 별도 뷰
 * - 기존 4탭(lineage/manual/factors/version)은 사이드바·패널 탭에서 제거, 피드 상세 아코디언에서 재사용
 */
import { useState, useMemo } from 'react';
import { AuditTrailFeedView } from './AuditTrailFeedView';
import { ApprovalInboxView } from './ApprovalInboxView';
import { createInitialApprovalMap, AUDIT_CURRENT_USER, AUDIT_CURRENT_USER_ID } from './auditApprovalState';
import { countActionableApprovals } from './approvalWorkflow';
import type { AuditSubTab } from '../layout/Sidebar';

export function AuditTrailPanel({
  activeTab,
  onTabChange,
}: {
  activeTab: AuditSubTab;
  onTabChange?: (tab: AuditSubTab) => void;
}) {
  const [approvalMap, setApprovalMap] = useState(createInitialApprovalMap);
  const myPendingCount = useMemo(
    () => countActionableApprovals(approvalMap, AUDIT_CURRENT_USER, AUDIT_CURRENT_USER_ID),
    [approvalMap]
  );

  if (activeTab === 'approval') {
    return <ApprovalInboxView approvalMap={approvalMap} setApprovalMap={setApprovalMap} />;
  }

  return (
    <AuditTrailFeedView
      approvalMap={approvalMap}
      myPendingCount={myPendingCount}
      onGoApproval={() => onTabChange?.('approval')}
    />
  );
}

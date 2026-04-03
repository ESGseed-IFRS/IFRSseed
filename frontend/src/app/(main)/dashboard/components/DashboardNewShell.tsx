'use client';

import { useEffect, useMemo, useState } from 'react';
import { C } from '@/app/(main)/dashboard/lib/constants';
import type { DashboardMainTab } from '@/app/(main)/dashboard/lib/dashboardNewNav';
import { DASHBOARD_TAB_LABEL, DASHBOARD_TAB_SECTION, DASHBOARD_TAB_SUBTITLE } from '@/app/(main)/dashboard/lib/dashboardNewNav';
import { DashboardNewSidebar } from '@/app/(main)/dashboard/components/DashboardNewSidebar';
import { DashboardNewContent, type DashboardPerspective } from '@/app/(main)/dashboard/components/DashboardNewContent';
import { GlobalSearch } from '@/app/(main)/dashboard/components/GlobalSearch';
import {
  cloneApprovalUnifiedMock,
  countUnifiedDocsByMenu,
  getApprovalInboxBadgeCountForDocs,
  type ApprovalDocUnified,
} from '@/app/(main)/dashboard/lib/approvalUnified';
import type { ApprovalDomain, ApprovalMenuKey } from '@/app/(main)/dashboard/lib/dashboardNewMock';

export function DashboardNewShell({
  mode,
  urlTab,
  urlDomain,
  urlMenu,
  focusDocId,
  focusSrDpId,
}: {
  mode: DashboardPerspective;
  urlTab?: DashboardMainTab | null;
  urlDomain?: ApprovalDomain | 'all' | null;
  urlMenu?: ApprovalMenuKey | null;
  focusDocId?: string | null;
  focusSrDpId?: string | null;
}) {
  const [tab, setTab] = useState<DashboardMainTab>('overview');

  const [approvalDomain, setApprovalDomain] = useState<ApprovalDomain | 'all'>('all');
  const [approvalMenu, setApprovalMenu] = useState<ApprovalMenuKey>('inbox.request');

  useEffect(() => {
    if (urlTab) setTab(urlTab);
    if (urlDomain != null) setApprovalDomain(urlDomain);
    if (urlMenu) setApprovalMenu(urlMenu);
  }, [urlTab, urlDomain, urlMenu]);

  // Overview → 각 탭(SR/GHG/결재함)으로 이어지는 딥링크 상태
  const [selectedDpId, setSelectedDpId] = useState<string | null>(null);
  const [selectedFeedbackId, setSelectedFeedbackId] = useState<string | null>(null);
  const [selectedAnomalyId, setSelectedAnomalyId] = useState<string | null>(null);

  const [approvalDocs, setApprovalDocs] = useState<ApprovalDocUnified[]>(() => cloneApprovalUnifiedMock());
  const approvalMenuCounts = useMemo(() => countUnifiedDocsByMenu(approvalDocs), [approvalDocs]);
  const approvalActionCount = useMemo(
    () => getApprovalInboxBadgeCountForDocs(approvalDocs),
    [approvalDocs],
  );

  const sectionTint = tab === 'ghg' ? C.teal : C.blue;

  return (
    <div
      style={{
        display: 'flex',
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
        fontFamily: "'Noto Sans KR','Pretendard',sans-serif",
        fontSize: 13,
        background: '#EEF1F5',
        color: '#111827',
      }}
    >
      <DashboardNewSidebar
        mode={mode}
        activeTab={tab}
        onSelectTab={setTab}
        approvalBadge={approvalActionCount}
        activeApprovalMenu={approvalMenu}
        approvalMenuCounts={approvalMenuCounts}
        onSelectApprovalMenu={(menu) => {
          setApprovalMenu(menu);
          setApprovalDomain('all');
          setTab('approval');
        }}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <NewDashboardTopBar
          tab={tab}
          tint={sectionTint}
          onNavLegacy={(legacyId) => {
            if (legacyId === 'sr_status' || legacyId === 'sr_feedback') setTab('sr');
          }}
        />

        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <DashboardNewContent
            mode={mode}
            tab={tab}
            onSelectTab={setTab}
            approvalDomain={approvalDomain}
            setApprovalDomain={setApprovalDomain}
            approvalMenu={approvalMenu}
            setApprovalMenu={setApprovalMenu}
            approvalFocusDocId={focusDocId ?? null}
            approvalFocusSrDpId={focusSrDpId ?? null}
            approvalDocs={approvalDocs}
            setApprovalDocs={setApprovalDocs}
            selectedDpId={selectedDpId}
            setSelectedDpId={setSelectedDpId}
            selectedFeedbackId={selectedFeedbackId}
            setSelectedFeedbackId={setSelectedFeedbackId}
            selectedAnomalyId={selectedAnomalyId}
            setSelectedAnomalyId={setSelectedAnomalyId}
          />
        </div>
      </div>
    </div>
  );
}

function NewDashboardTopBar({
  tab,
  tint,
  onNavLegacy,
}: {
  tab: DashboardMainTab;
  tint: string;
  onNavLegacy: (legacyNavId: string) => void;
}) {
  return (
    <div
      style={{
        height: 46,
        background: 'white',
        borderBottom: `1px solid ${C.g200}`,
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        gap: 10,
        flexShrink: 0,
        boxShadow: '0 1px 3px rgba(0,0,0,.04)',
      }}
    >
      <div style={{ width: 3, height: 16, borderRadius: 2, background: tint, flexShrink: 0 }} />
      <div style={{ fontSize: 11, color: tint, fontWeight: 600, whiteSpace: 'nowrap' }}>
        {DASHBOARD_TAB_SECTION[tab]}
      </div>
      <div style={{ fontSize: 11, color: C.g300 }}>/</div>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.g800, whiteSpace: 'nowrap' }}>
        {DASHBOARD_TAB_LABEL[tab]}
      </div>
      <div style={{ fontSize: 11, color: C.g400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        — {DASHBOARD_TAB_SUBTITLE[tab]}
      </div>
      <div style={{ flex: 1 }} />
      <GlobalSearch onNav={onNavLegacy} />
    </div>
  );
}

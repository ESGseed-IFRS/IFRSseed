'use client';

import { Suspense, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useWorkspacePerspective } from '@/components/workspace/WorkspacePerspectiveContext';
import { DashboardNewShell } from './components/DashboardNewShell';
import type { ApprovalDomain, ApprovalMenuKey } from './lib/dashboardNewMock';
import type { DashboardMainTab } from './lib/dashboardNewNav';

const APPROVAL_MENU_KEYS: ApprovalMenuKey[] = [
  'outbox.progress',
  'outbox.completed',
  'outbox.rejected',
  'outbox.draft',
  'inbox.request',
  'inbox.history',
  'inbox.cc',
];

function parseDashboardTab(v: string | null): DashboardMainTab | null {
  if (v === 'overview' || v === 'sr' || v === 'ghg' || v === 'approval') return v;
  return null;
}

function parseApprovalDomain(v: string | null): ApprovalDomain | 'all' | null {
  if (v === 'all' || v === 'ghg' || v === 'sr' || v === 'audit') return v;
  return null;
}

function parseApprovalMenu(v: string | null): ApprovalMenuKey | null {
  if (!v) return null;
  return APPROVAL_MENU_KEYS.includes(v as ApprovalMenuKey) ? (v as ApprovalMenuKey) : null;
}

function DashboardWithSearchParams() {
  const { perspective } = useWorkspacePerspective();
  const searchParams = useSearchParams();

  const { urlTab, urlDomain, urlMenu, focusDocId, focusSrDpId } = useMemo(() => {
    return {
      urlTab: parseDashboardTab(searchParams.get('tab')),
      urlDomain: parseApprovalDomain(searchParams.get('domain')),
      urlMenu: parseApprovalMenu(searchParams.get('menu')),
      focusDocId: searchParams.get('docId'),
      focusSrDpId: searchParams.get('dpId') ?? searchParams.get('srDpId'),
    };
  }, [searchParams]);

  return (
    <DashboardNewShell
      mode={perspective}
      urlTab={urlTab}
      urlDomain={urlDomain}
      urlMenu={urlMenu}
      focusDocId={focusDocId}
      focusSrDpId={focusSrDpId}
    />
  );
}

export function DashboardPageClient() {
  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-[#f4f6f4] font-['Pretendard','Apple_SD_Gothic_Neo',sans-serif] text-[#1a1a1a]">
      <div className="flex min-h-0 flex-1 flex-col">
        <Suspense
          fallback={<div style={{ padding: 24, fontSize: 13, color: '#64748B' }}>대시보드 불러오는 중…</div>}
        >
          <DashboardWithSearchParams />
        </Suspense>
      </div>
    </div>
  );
}

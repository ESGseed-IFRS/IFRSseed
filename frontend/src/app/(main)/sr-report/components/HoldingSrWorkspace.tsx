'use client';

import { useCallback, useState } from 'react';
import { HoldingWrite } from './holding/HoldingWrite';
import { HoldingAggregateWrite } from './holding/HoldingAggregateWrite';
import { HoldingGenerate } from './holding/HoldingGenerate';
import type { HoldingSrTabId } from '../lib/types';

export type { HoldingSrTabId };

type Props = {
  activeTab: HoldingSrTabId;
  onTabChange: (tab: HoldingSrTabId) => void;
  /** 대시보드「페이지 작성」카드 → sectionId 기반 목차 키워드 */
  dashboardWriteKeyword?: string | null;
  onDashboardWriteKeywordConsumed?: () => void;
  /** 대시보드 매트릭스 → 공시데이터 취합 DP */
  dashboardAggregateDpId?: string | null;
  dashboardFocusEntityId?: string | null;
};

export function HoldingSrWorkspace({
  activeTab,
  onTabChange,
  dashboardWriteKeyword,
  onDashboardWriteKeywordConsumed,
  dashboardAggregateDpId,
  dashboardFocusEntityId,
}: Props) {
  const [pendingToc, setPendingToc] = useState<string | null>(null);

  const handleInsertToReport = useCallback(() => {
    setPendingToc('온실가스 배출');
    onTabChange('h-write');
  }, [onTabChange]);

  const writeInitial = pendingToc ?? dashboardWriteKeyword ?? null;
  const handleWriteInitialConsumed = useCallback(() => {
    if (pendingToc) setPendingToc(null);
    onDashboardWriteKeywordConsumed?.();
  }, [pendingToc, onDashboardWriteKeywordConsumed]);

  return (
    <div
      className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden font-['Pretendard','Apple_SD_Gothic_Neo','Noto_Sans_KR',sans-serif] text-[13px] text-[#222] bg-[#f4f6f4]"
      style={{ fontFamily: "'Pretendard','Apple SD Gothic Neo','Noto Sans KR',sans-serif" }}
    >
      <div className={`flex-1 min-h-0 overflow-hidden flex flex-col ${activeTab === 'h-gen' ? 'overflow-y-auto' : ''}`}>
        {activeTab === 'h-aggregate-write' && (
          <HoldingAggregateWrite
            onInsertToReport={handleInsertToReport}
            initialDpId={dashboardAggregateDpId}
            focusEntityId={dashboardFocusEntityId}
          />
        )}
        {activeTab === 'h-write' && (
          <HoldingWrite initialToc={writeInitial} onInitialTocConsumed={handleWriteInitialConsumed} />
        )}
        {activeTab === 'h-gen' && <HoldingGenerate />}
      </div>
    </div>
  );
}

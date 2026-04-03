'use client';

import { useMemo } from 'react';
import { useReportStore } from '@/store/reportStore';
import { useGHGStore } from '@/features/ghg-calculation/store/ghg.store';
import { useDashboardStore } from '@/store/dashboardStore';

/** DASHBOARD_STRATEGY_V2: 4개 카드, SR 준수율, 액션 우선순위 */

export type PageStatus = 'completed' | 'in-progress' | 'pending';
export type PageStatusItem = { status: PageStatus; percent?: number; message?: string; link: string };

export interface ActionItem {
  id: string;
  priority: number;
  message: string;
  link: string;
  page: string;
}

export interface ScorecardItem {
  id: string;
  label: string;
  met: boolean;
  detail?: string;
}

export interface DashboardStatus {
  overallProgress: number;
  completedCount: number;
  inProgressCount: number;
  pendingCount: number;
  pageStatuses: {
    companyInfo: PageStatusItem;
    ghg: PageStatusItem;
    sr: PageStatusItem;
    charts: PageStatusItem;
  };
  actionItems: ActionItem[];
  scorecardItems: ScorecardItem[];
}

export function useDashboardStatus(): DashboardStatus {
  const finalCompanyInfo = useReportStore((s) => s.finalCompanyInfo);
  const companyInfo = useReportStore((s) => s.companyInfo);
  const charts = useReportStore((s) => s.charts);
  const esgTables = useReportStore((s) => s.esgTables);
  const renewableTable = useReportStore((s) => s.renewableTable);
  const srComplianceRate = useDashboardStore((s) => s.srComplianceRate);
  const srDataSubmitted = useDashboardStore((s) => s.srDataSubmitted);
  const pendingApprovals = useDashboardStore((s) => s.pendingApprovals);
  const role = useDashboardStore((s) => s.role);

  const scope1 = useGHGStore((s) => s.scope1);
  const scope2 = useGHGStore((s) => s.scope2);
  const scope3 = useGHGStore((s) => s.scope3);
  const ghgHistory = useGHGStore((s) => s.history);

  return useMemo(() => {
    const hasCompanyInfo = !!companyInfo?.companyName;
    const hasFinalSubmit = !!finalCompanyInfo;
    const companyStatus: PageStatusItem = {
      status: hasFinalSubmit ? 'completed' : hasCompanyInfo ? 'in-progress' : 'pending',
      message: hasFinalSubmit ? '제출 완료' : hasCompanyInfo ? '최종 제출 필요' : '입력 필요',
      link: '/company-info',
    };

    const s1Total = scope1.stationary.length + scope1.mobile.length;
    const s2Total = scope2.electricity.length + scope2.heat.length;
    const s3Total = scope3.categories.reduce((s, c) => s + c.data.length, 0);
    const hasGhgData = s1Total > 0 || s2Total > 0 || s3Total > 0;
    const ghgResultSaved = ghgHistory.length > 0;
    const ghgCompleted = hasGhgData && ghgResultSaved;
    const ghgStatus: PageStatusItem = {
      status: ghgCompleted ? 'completed' : hasGhgData ? 'in-progress' : 'pending',
      message: ghgCompleted ? '산정·리포트 완료' : hasGhgData ? '결과 저장 필요' : '미시작',
      link: '/ghg-calculation',
    };

    const chartsCount = charts.length + esgTables.length + (renewableTable.length > 0 ? 1 : 0);
    const chartsStatus: PageStatusItem = {
      status: chartsCount > 0 ? 'completed' : chartsCount > 0 ? 'in-progress' : 'pending',
      percent: chartsCount > 0 ? 100 : 0,
      message: chartsCount > 0 ? `차트 ${chartsCount}건` : '저장 0건',
      link: '/charts',
    };

    const srMet = srComplianceRate >= 90 && srDataSubmitted;
    const srInProgress = srComplianceRate > 0 || srDataSubmitted;
    const srStatus: PageStatusItem = {
      status: srMet ? 'completed' : srInProgress ? 'in-progress' : 'pending',
      percent: srComplianceRate,
      message: srMet ? '준수율 90%↑ 제출' : srInProgress ? `${srComplianceRate}% 준수` : '미작성',
      link: '/report',
    };

    const pageStatuses = {
      companyInfo: companyStatus,
      ghg: ghgStatus,
      sr: srStatus,
      charts: chartsStatus,
    };

    const statusCount = (s: PageStatus) =>
      Object.values(pageStatuses).filter((p) => p.status === s).length;
    const completedCount = statusCount('completed');
    const inProgressCount = statusCount('in-progress');
    const pendingCount = statusCount('pending');
    const total = 4;
    const overallProgress = Math.round(((completedCount + inProgressCount * 0.5) / total) * 100);

    // V2 우선순위별 액션
    const actionItems: ActionItem[] = [];
    if (role === 'MANAGER' && pendingApprovals.length > 0) {
      actionItems.push({
        id: 'team-approval',
        priority: 1,
        message: `${pendingApprovals.length}명의 팀원 가입 승인이 필요합니다.`,
        link: '/dashboard',
        page: '대시보드',
      });
    }
    // 2: 회사정보 미제출
    if (!hasFinalSubmit) {
      actionItems.push({
        id: 'company-submit',
        priority: 2,
        message: hasCompanyInfo
          ? '회사정보를 최종 보고서에 제출해 주세요.'
          : '회사정보를 입력해 주세요.',
        link: '/company-info',
        page: '회사정보',
      });
    }
    // 3: GHG 결과 미저장
    if (hasGhgData && !ghgResultSaved) {
      actionItems.push({
        id: 'ghg-save',
        priority: 3,
        message: 'GHG 산정 결과를 저장해 주세요.',
        link: '/ghg-calculation',
        page: 'GHG 산정',
      });
    } else if (!hasGhgData) {
      actionItems.push({
        id: 'ghg-input',
        priority: 3,
        message: 'GHG 산정 데이터를 입력해 주세요.',
        link: '/ghg-calculation',
        page: 'GHG 산정',
      });
    }
    // 4: SR 준수율 90% 미만
    if (srComplianceRate > 0 && srComplianceRate < 90) {
      const unmapped = Math.ceil(((90 - srComplianceRate) / 100) * 10); // 대략
      actionItems.push({
        id: 'sr-compliance',
        priority: 4,
        message: `SR 작성: ${unmapped}개 기준 미준수 (현재 ${srComplianceRate}%).`,
        link: '/report',
        page: 'SR 작성',
      });
    } else if (!srInProgress) {
      actionItems.push({
        id: 'sr-start',
        priority: 4,
        message: 'SR 작성을 시작해 주세요.',
        link: '/report',
        page: 'SR 작성',
      });
    }
    // 5: SR 데이터 미제출
    if (srInProgress && !srDataSubmitted && srComplianceRate >= 90) {
      actionItems.push({
        id: 'sr-submit',
        priority: 5,
        message: '데이터 최종 제출이 필요합니다.',
        link: '/report',
        page: 'SR 작성',
      });
    }
    // 6: 차트 0건
    if (chartsCount === 0) {
      actionItems.push({
        id: 'charts',
        priority: 6,
        message: '저장된 차트가 없습니다.',
        link: '/charts',
        page: '도표 생성',
      });
    }
    actionItems.sort((a, b) => a.priority - b.priority);
    const filteredActions = actionItems.filter((a) => a.id !== 'team-approval' || true); // team-approval은 팀장만, 여기선 모두 표시 후 페이지에서 처리

    // 블록 6 완성도 스코어카드
    const scorecardItems: ScorecardItem[] = [
      {
        id: 'company',
        label: '회사정보 제출',
        met: !!hasFinalSubmit,
        detail: hasFinalSubmit ? '✓' : '✗',
      },
      {
        id: 'ghg',
        label: 'GHG 산정 결과 저장',
        met: ghgCompleted,
        detail: ghgCompleted ? '✓' : '✗',
      },
      {
        id: 'sr',
        label: 'SR 준수율 90% 이상',
        met: srComplianceRate >= 90,
        detail: `현재 ${srComplianceRate}%`,
      },
      {
        id: 'charts',
        label: '차트·도표 저장',
        met: chartsCount > 0,
        detail: chartsCount > 0 ? `✓ (${chartsCount}건)` : '✗ (0건)',
      },
    ];

    return {
      overallProgress,
      completedCount,
      inProgressCount,
      pendingCount,
      pageStatuses,
      actionItems: actionItems.slice(0, 7),
      scorecardItems,
    };
  }, [
    finalCompanyInfo,
    companyInfo,
    charts.length,
    esgTables.length,
    renewableTable.length,
    scope1,
    scope2,
    scope3,
    ghgHistory.length,
    srComplianceRate,
    srDataSubmitted,
    pendingApprovals.length,
    role,
  ]);
}

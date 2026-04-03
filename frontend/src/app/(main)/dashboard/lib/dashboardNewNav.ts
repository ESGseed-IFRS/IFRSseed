/** 대시보드(신규) — 사이드바·탑바와 동기화되는 탭 ID */

export type DashboardMainTab = 'overview' | 'sr' | 'ghg' | 'approval';

export const DASHBOARD_TAB_LABEL: Record<DashboardMainTab, string> = {
  overview: '전체',
  sr: 'SR 보고서 작성',
  ghg: 'GHG 산정',
  approval: '결재함',
};

export const DASHBOARD_TAB_SUBTITLE: Record<DashboardMainTab, string> = {
  overview: '한눈에 보는 현황',
  sr: '공시기준 데이터·보고서 흐름',
  ghg: 'Raw data · 이상치 · 산정 적합성',
  approval: 'GHG·SR 통합 결재함',
};

export const DASHBOARD_TAB_SECTION: Record<DashboardMainTab, string> = {
  overview: '통합 개요',
  sr: 'SR 보고서 작성',
  ghg: 'GHG 산정',
  approval: '결재함',
};

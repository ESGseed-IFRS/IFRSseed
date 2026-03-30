/** SUBSIDIARY_DASHBOARD_STRATEGY 컬러·상태 토큰 */

export const C = {
  navy: '#0C2340',
  navyM: '#1a3a5c',
  blue: '#1351D8',
  blueSoft: '#e8eef8',
  teal: '#00A389',
  tealSoft: '#e0f5f1',
  amber: '#D97706',
  amberSoft: '#fef3e2',
  red: '#DC2626',
  redSoft: '#fef0ef',
  green: '#059669',
  greenSoft: '#ECFDF3',
  purple: '#7C3AED',
  purpleSoft: '#f5f3ff',
  orange: '#C05600',
  orangeSoft: '#fff5f0',
  g50: '#F9FAFB',
  g100: '#F3F4F6',
  g200: '#E5E7EB',
  g300: '#D1D5DB',
  g400: '#9CA3AF',
  g500: '#6B7280',
  g600: '#4B5563',
  g700: '#374151',
  g800: '#1F2937',
} as const;

export const CAT_CFG: Record<string, { bg: string; fg: string; color: string }> = {
  E: { bg: '#1a5e3a', fg: '#7fdba7', color: C.green },
  S: { bg: '#1a3d7a', fg: '#7ab4f5', color: C.blue },
  G: { bg: '#7a4a10', fg: '#f5c97a', color: C.amber },
  IT: { bg: '#4a1878', fg: '#c97af5', color: C.purple },
};

export const ST_CFG: Record<string, { label: string; bg: string; color: string }> = {
  done: { label: '완료', bg: C.greenSoft, color: C.green },
  warn: { label: '진행중', bg: C.amberSoft, color: C.amber },
  error: { label: '미입력', bg: C.redSoft, color: C.red },
  none: { label: '미시작', bg: C.g100, color: C.g400 },
};

export const NAV = [
  {
    id: 'SR',
    label: 'SR 보고서 현황',
    color: C.blue,
    items: [
      { id: 'sr_home', label: '통합 현황 개요' },
      { id: 'sr_status', label: 'SR 작성 현황' },
      { id: 'sr_feedback', label: '지주사 피드백' },
    ],
  },
  {
    id: 'GHG',
    label: 'GHG 배출량 현황',
    color: C.teal,
    items: [{ id: 'ghg_summary', label: '배출량 요약 · 이동' }],
  },
] as const;

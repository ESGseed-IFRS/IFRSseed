/**
 * SR 플랫폼 상수 (SRReportPlatform.jsx 기반)
 */

export const STD_STYLE: Record<string, { bg: string; color: string }> = {
  ISSB: { bg: '#EFF5FC', color: '#0C447C' },
  GRI: { bg: '#EAF3DE', color: '#3B6D11' },
  ESRS: { bg: '#FAEEDA', color: '#633806' },
  /** 통합 지속가능경영보고서(전체 SR) */
  통합: { bg: '#EFF5FC', color: '#185FA5' },
};

export const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  완료: { bg: '#EAF3DE', color: '#3B6D11' },
  작성중: { bg: '#FAEEDA', color: '#633806' },
  미작성: { bg: '#F1EFE8', color: '#5F5E5A' },
  제출완료: { bg: '#EFF5FC', color: '#0C447C' },
  반려: { bg: '#FCEBEB', color: '#A32D2D' },
  머지완료: { bg: '#EAF3DE', color: '#3B6D11' },
};

export const DOT_COLOR: Record<string, string> = {
  done: '#639922',
  wip: '#EF9F27',
  none: '#D3D1C7',
};

export const ITEM_SCHEMA_MAP: Record<number, string> = {
  1: 'ghg',
  2: 'energy',
  3: 'safety',
  4: 'climate',
  5: 'safety',
  6: 'supply',
  7: 'diversity',
  8: 'governance',
  9: 'ethics',
  10: 'water',
};

export const SUBMISSION_SCHEDULE = [
  { date: '03-20', label: '1차 마감 (환경·안전보건)', urgent: true },
  { date: '03-28', label: '2차 마감 (공급망·임직원)', urgent: false },
  { date: '04-05', label: '최종 마감 (지배구조)', urgent: false },
];

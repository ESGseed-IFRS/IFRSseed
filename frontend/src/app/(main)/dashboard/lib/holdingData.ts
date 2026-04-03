/** holding_dashboard_v3.jsx 기반 지주사 대시보드 Mock 데이터 */

export interface DomesticSub {
  id: string;
  name: string;
  short: string;
  biz: string;
  color: string;
  emp: number;
  srPct: number;
  srStatus: 'done' | 'partial' | 'warn' | 'danger';
  ghgS1: number;
  ghgS2: number;
  ghgStatus: 'submitted' | 'approved' | 'draft' | 'missing';
}

export interface DomesticSite {
  id: string;
  name: string;
  short: string;
  type: string;
  addr: string;
  ghgS1: number;
  ghgS2: number;
}

export interface OverseasRegion {
  id: string;
  name: string;
  short: string;
  cnt: number;
  ghgS1: number;
  ghgS2: number;
  ghgStatus: 'submitted' | 'approved' | 'draft' | 'missing';
}

export interface QueueItem {
  id: string;
  sub: string;
  item?: string;
  scope?: string;
  at: string;
  val: string;
  issue: string | null;
  sev: 'ok' | 'warn' | 'error';
}

export interface AuditLogItem {
  time: string;
  actor: string;
  action: string;
  target: string;
  reason: string | null;
  type: 'approve' | 'reject' | 'submit' | 'remind';
}

export const DOMESTIC_SUBSIDIARIES: DomesticSub[] = [
  { id: 'miracom', name: '미라콤', short: '미라콤', biz: 'Total ERP·ITO·Smart Factory', color: '#1351D8', emp: 1780, srPct: 100, srStatus: 'done', ghgS1: 4210, ghgS2: 8600, ghgStatus: 'approved' },
  { id: 'secui', name: '시큐아이', short: '시큐아이', biz: '네트워크·클라우드 보안 솔루션', color: '#7C3AED', emp: 438, srPct: 85, srStatus: 'partial', ghgS1: 1840, ghgS2: 3210, ghgStatus: 'submitted' },
  { id: 'score', name: '에스코어', short: '에스코어', biz: '컨설팅·SW개발·MES 스마트팩토리', color: '#0E7490', emp: 357, srPct: 70, srStatus: 'partial', ghgS1: 920, ghgS2: 1840, ghgStatus: 'submitted' },
  { id: 'multicam', name: '멀티캠퍼스', short: '멀티캠', biz: 'HRD 기업교육·BPO·외국어교육', color: '#D97706', emp: 880, srPct: 60, srStatus: 'warn', ghgS1: 2100, ghgS2: 4800, ghgStatus: 'draft' },
  { id: 'emro', name: '엠로', short: '엠로', biz: 'AI 기반 공급망 관리(SCM·SRM)', color: '#059669', emp: 320, srPct: 45, srStatus: 'warn', ghgS1: 680, ghgS2: 1200, ghgStatus: 'draft' },
  { id: 'openhands', name: '오픈핸즈', short: '오픈핸즈', biz: '장애인 표준사업장·SW테스트·물류운영', color: '#DC2626', emp: 267, srPct: 30, srStatus: 'danger', ghgS1: 210, ghgS2: 580, ghgStatus: 'missing' },
];

export const DOMESTIC_SITES: DomesticSite[] = [
  { id: 'pangyo_it', name: '판교 IT 캠퍼스', short: '판교IT', type: 'HQ', addr: '성남시 수정구 창업로 17', ghgS1: 18200, ghgS2: 22400 },
  { id: 'pangyo_logi', name: '판교 물류 캠퍼스', short: '판교물류', type: 'HQ', addr: '성남시 분당구 대왕판교로 606', ghgS1: 8400, ghgS2: 12100 },
  { id: 'seoul_rnd', name: '서울 R&D 캠퍼스', short: '서울R&D', type: 'HQ', addr: '서초구 성촌길 56', ghgS1: 6200, ghgS2: 9800 },
  { id: 'sangam_dc', name: '상암 데이터센터', short: '상암DC', type: 'DC', addr: '마포구 월드컵북로 60길 24', ghgS1: 24800, ghgS2: 18600 },
  { id: 'suwon_dc', name: '수원 데이터센터', short: '수원DC', type: 'DC', addr: '수원시 영통구 삼성로 168', ghgS1: 22400, ghgS2: 16200 },
  { id: 'chuncheon_dc', name: '춘천 데이터센터', short: '춘천DC', type: 'DC', addr: '춘천시 옛경춘로 409-14', ghgS1: 38600, ghgS2: 28400 },
  { id: 'dongtan_dc', name: '동탄 데이터센터', short: '동탄DC', type: 'DC', addr: '화성시 동탄대로9나길 14', ghgS1: 12400, ghgS2: 9800 },
  { id: 'gumi_dc', name: '구미 데이터센터', short: '구미DC', type: 'DC', addr: '경상북도 구미시', ghgS1: 10500, ghgS2: 8200 },
];

export const OVERSEAS_REGIONS: OverseasRegion[] = [
  { id: 'ov_eu', name: '유럽', short: '유럽', cnt: 14, ghgS1: 8200, ghgS2: 14200, ghgStatus: 'submitted' },
  { id: 'ov_na', name: '북미', short: '북미', cnt: 7, ghgS1: 12400, ghgS2: 18600, ghgStatus: 'submitted' },
  { id: 'ov_la', name: '중남미', short: '중남미', cnt: 10, ghgS1: 4100, ghgS2: 7200, ghgStatus: 'draft' },
  { id: 'ov_me', name: '중아서', short: '중아서', cnt: 6, ghgS1: 2800, ghgS2: 5400, ghgStatus: 'draft' },
  { id: 'ov_cn', name: '중국', short: '중국', cnt: 7, ghgS1: 6200, ghgS2: 11800, ghgStatus: 'submitted' },
  { id: 'ov_sea', name: '동남아', short: '동남아', cnt: 11, ghgS1: 5600, ghgS2: 9400, ghgStatus: 'missing' },
];

export const SR_ITEMS = [
  '온실가스 배출량', '에너지·재생에너지', '기후변화 리스크', '용수·폐기물',
  '임직원·다양성', '안전보건', '인권경영', '공급망 ESG',
  '고객·제품책임', '기업 지배구조', '윤리·준법', '리스크 관리', '정보보호·AI',
];

export const SR_QUEUE: QueueItem[] = [
  { id: 'q1', sub: '미라콤', item: '온실가스 배출량', at: '03-18 14:32', val: 'GHG 전체 데이터', issue: null, sev: 'ok' },
  { id: 'q2', sub: '시큐아이', item: '안전보건', at: '03-18 10:15', val: 'LTIR 0.0‰', issue: null, sev: 'ok' },
  { id: 'q3', sub: '에스코어', item: '임직원·다양성', at: '03-17 16:40', val: '여성관리자 미입력', issue: 'ESRS S1-9 필수항목', sev: 'error' },
  { id: 'q4', sub: '멀티캠퍼스', item: '에너지·재생에너지', at: '03-16 09:30', val: '미완성 제출', issue: '전력사용량 누락', sev: 'error' },
  { id: 'q5', sub: '엠로', item: '공급망 ESG', at: '03-15 14:00', val: '협력사 40개 평가', issue: null, sev: 'ok' },
];

export const GHG_QUEUE: QueueItem[] = [
  { id: 'g1', sub: '미라콤', scope: 'Scope 1+2', at: '03-18 14:32', val: '12,810 tCO₂eq', issue: null, sev: 'ok' },
  { id: 'g2', sub: '시큐아이', scope: 'Scope 1', at: '03-18 09:45', val: '1,840 tCO₂eq', issue: null, sev: 'ok' },
  { id: 'g3', sub: '에스코어', scope: 'Scope 1+2', at: '03-17 11:00', val: '2,760 tCO₂eq', issue: null, sev: 'ok' },
  { id: 'g4', sub: '멀티캠퍼스', scope: 'Scope 1', at: '03-16 09:30', val: '2,100 tCO₂eq', issue: 'Scope 3 미산정', sev: 'warn' },
  { id: 'g5', sub: '엠로', scope: 'Scope 1+2', at: '03-15 14:00', val: '1,880 tCO₂eq', issue: '전년比 +12.4%', sev: 'warn' },
];

export const GHG_TREND = [
  { year: '2022', s1: 82140, s2: 91200 },
  { year: '2023', s1: 67800, s2: 82500 },
  { year: '2024', s1: 122842, s2: 85340 },
];

export const AUDIT_LOG: AuditLogItem[] = [
  { time: '오늘 15:10', actor: '연시은 (지주사)', action: '반려', target: '멀티캠퍼스 · 에너지·재생에너지', reason: '전력사용량 누락', type: 'reject' },
  { time: '오늘 14:55', actor: '안수호 (지주사)', action: 'GHG 승인', target: '미라콤 · Scope 1+2', reason: null, type: 'approve' },
  { time: '오늘 14:32', actor: '박제조 (미라콤)', action: 'SR 제출', target: '온실가스 배출량', reason: null, type: 'submit' },
  { time: '어제 17:00', actor: '연시은 (지주사)', action: '리마인드', target: '오픈핸즈 · 전체 미제출', reason: null, type: 'remind' },
  { time: '어제 09:30', actor: '안수호 (지주사)', action: '반려', target: '에스코어 · 임직원·다양성', reason: 'ESRS S1-9 누락', type: 'reject' },
];

/** SR 연결 취합용 지표 */
export const SR_AGG = [
  { item: '총 임직원수', unit: '명', vals: { miracom: 1780, secui: 438, score: 357, multicam: 880, emro: 320, openhands: 267 } as Record<string, number | null>, issues: [] as string[] },
  { item: '여성 임직원 비율', unit: '%', vals: { miracom: 28.4, secui: 22.1, score: 31.2, multicam: 35.2, emro: null, openhands: null } as Record<string, number | null>, issues: ['엠로·오픈핸즈: 미입력'] },
  { item: '장애인 고용률', unit: '%', vals: { miracom: 2.1, secui: null, score: 2.8, multicam: 3.1, emro: null, openhands: 18.4 } as Record<string, number | null>, issues: ['시큐아이·엠로: 미입력', '오픈핸즈 장애인 표준사업장'] },
  { item: '산재 발생건수', unit: '건', vals: { miracom: 0, secui: 0, score: 0, multicam: 1, emro: 0, openhands: null } as Record<string, number | null>, issues: ['오픈핸즈: 미입력'] },
  { item: 'LTIR', unit: '‰', vals: { miracom: 0, secui: 0, score: 0, multicam: 0.54, emro: 0, openhands: null } as Record<string, number | null>, issues: [] },
  { item: '공정거래 위반', unit: '건', vals: { miracom: 0, secui: 0, score: 0, multicam: 0, emro: 0, openhands: 0 } as Record<string, number | null>, issues: [] },
  { item: '개인정보 유출', unit: '건', vals: { miracom: 0, secui: 0, score: 0, multicam: 0, emro: null, openhands: null } as Record<string, number | null>, issues: ['엠로·오픈핸즈: 미입력'] },
  { item: '사회공헌 기부금', unit: '억원', vals: { miracom: 4.2, secui: 1.8, score: 1.4, multicam: 3.6, emro: null, openhands: null } as Record<string, number | null>, issues: ['엠로·오픈핸즈: 미입력'] },
];

/** GHG 연결 취합용 지표 */
export const GHG_AGG = [
  { item: 'Scope 1 직접배출', unit: 'tCO₂eq', vals: { miracom: 4210, secui: 1840, score: 920, multicam: 2100, emro: 680, openhands: null } as Record<string, number | null>, issues: ['오픈핸즈: 미입력'] },
  { item: 'Scope 2 (위치기반)', unit: 'tCO₂eq', vals: { miracom: 8600, secui: 3210, score: 1840, multicam: 4800, emro: 1200, openhands: null } as Record<string, number | null>, issues: ['오픈핸즈: 미입력'] },
  { item: 'Scope 2 (시장기반)', unit: 'tCO₂eq', vals: { miracom: 8100, secui: 2900, score: 1640, multicam: 4300, emro: null, openhands: null } as Record<string, number | null>, issues: ['엠로·오픈핸즈: 미입력'] },
  { item: 'Scope 3 (가치사슬)', unit: 'tCO₂eq', vals: { miracom: null, secui: null, score: null, multicam: null, emro: null, openhands: null } as Record<string, number | null>, issues: ['전 자회사 미산정'] },
  { item: '총 에너지 소비량', unit: 'TJ', vals: { miracom: 310, secui: 88, score: 62, multicam: 120, emro: null, openhands: null } as Record<string, number | null>, issues: ['엠로·오픈핸즈: 미입력'] },
  { item: '재생에너지 비율', unit: '%', vals: { miracom: 8.4, secui: 5.2, score: null, multicam: 6.8, emro: null, openhands: null } as Record<string, number | null>, issues: ['에스코어·엠로·오픈핸즈: 미입력'] },
  { item: '탄소집약도', unit: 'tCO₂/억', vals: { miracom: 0.42, secui: 0.38, score: 0.77, multicam: 0.79, emro: null, openhands: null } as Record<string, number | null>, issues: [] },
];

export const SUB_IDS = ['miracom', 'secui', 'score', 'multicam', 'emro', 'openhands'] as const;
export const SUB_LABEL: Record<string, string> = {
  miracom: '미라콤', secui: '시큐아이', score: '에스코어', multicam: '멀티캠', emro: '엠로', openhands: '오픈핸즈',
};

/** @deprecated APPROVAL_QUEUE - SR_QUEUE 사용 */
export const APPROVAL_QUEUE = SR_QUEUE;

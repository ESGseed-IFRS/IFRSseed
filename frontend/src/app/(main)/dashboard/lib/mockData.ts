/** 계열사 대시보드 Mock 데이터 — SUBSIDIARY_DASHBOARD_STRATEGY / sr_dashboard_v5 기준 */

export const ME = '서은진';

export interface SRItem {
  id: string;
  cat: string;
  label: string;
  pct: number;
  status: string;
  dl: string;
  fb: number;
  req: boolean;
  gri: boolean;
  issb: boolean;
  esrs: boolean;
  owner?: string;
  evidence?: boolean;
}

export const SR_ITEMS: SRItem[] = [
  {
    id: 'ghg',
    cat: 'E',
    label: '온실가스 배출량',
    pct: 100,
    status: 'done',
    dl: '03-20',
    fb: 1,
    req: true,
    gri: true,
    issb: true,
    esrs: true,
    owner: ME,
    evidence: true,
  },
  {
    id: 'energy',
    cat: 'E',
    label: '에너지·재생에너지',
    pct: 60,
    status: 'warn',
    dl: '03-20',
    fb: 0,
    req: true,
    gri: true,
    issb: true,
    esrs: true,
    owner: ME,
    evidence: false,
  },
  {
    id: 'climate',
    cat: 'E',
    label: '기후변화 리스크·시나리오',
    pct: 0,
    status: 'none',
    dl: '03-20',
    fb: 0,
    req: true,
    gri: false,
    issb: true,
    esrs: true,
    owner: ME,
  },
  {
    id: 'water',
    cat: 'E',
    label: '용수·폐기물·생물다양성',
    pct: 20,
    status: 'none',
    dl: '03-25',
    fb: 0,
    req: false,
    gri: true,
    issb: false,
    esrs: true,
  },
  {
    id: 'people',
    cat: 'S',
    label: '임직원·다양성·포용',
    pct: 45,
    status: 'error',
    dl: '03-28',
    fb: 1,
    req: true,
    gri: true,
    issb: false,
    esrs: true,
    owner: ME,
  },
  {
    id: 'safety',
    cat: 'S',
    label: '안전보건',
    pct: 100,
    status: 'done',
    dl: '03-20',
    fb: 0,
    req: true,
    gri: true,
    issb: false,
    esrs: true,
  },
  {
    id: 'human',
    cat: 'S',
    label: '인권경영',
    pct: 0,
    status: 'none',
    dl: '03-28',
    fb: 0,
    req: false,
    gri: true,
    issb: false,
    esrs: false,
  },
  {
    id: 'supply',
    cat: 'S',
    label: '공급망·협력회사 ESG',
    pct: 0,
    status: 'none',
    dl: '03-28',
    fb: 0,
    req: false,
    gri: true,
    issb: false,
    esrs: true,
  },
  {
    id: 'customer',
    cat: 'S',
    label: '고객·제품책임',
    pct: 0,
    status: 'none',
    dl: '03-28',
    fb: 0,
    req: false,
    gri: true,
    issb: false,
    esrs: false,
  },
  {
    id: 'gov',
    cat: 'G',
    label: '기업 지배구조',
    pct: 30,
    status: 'none',
    dl: '04-05',
    fb: 0,
    req: true,
    gri: true,
    issb: true,
    esrs: true,
  },
  {
    id: 'ethics',
    cat: 'G',
    label: '윤리·준법경영',
    pct: 10,
    status: 'none',
    dl: '04-05',
    fb: 0,
    req: true,
    gri: true,
    issb: false,
    esrs: true,
  },
  {
    id: 'risk',
    cat: 'G',
    label: '리스크 관리',
    pct: 0,
    status: 'none',
    dl: '04-05',
    fb: 0,
    req: false,
    gri: true,
    issb: true,
    esrs: false,
  },
  {
    id: 'it',
    cat: 'IT',
    label: '정보보호·AI·디지털책임',
    pct: 50,
    status: 'warn',
    dl: '03-20',
    fb: 0,
    req: true,
    gri: true,
    issb: false,
    esrs: false,
    owner: ME,
  },
];

export const GHG_TREND = [
  { year: '2022', s1: 82140, s2: 91200, s2m: 78950, total: 173340, intensity: 0.72, energy: 2280, re: 180, pue: 1.45 },
  { year: '2023', s1: 67800, s2: 82500, s2m: 78950, total: 150300, intensity: 0.65, energy: 2380, re: 243, pue: 1.42 },
  { year: '2024', s1: 122842, s2: 85340, s2m: 71280, total: 208182, intensity: 0.71, energy: 2522, re: 306, pue: 1.39 },
];

export interface Feedback {
  id: string;
  item: string;
  from: string;
  date: string;
  status: string;
  responseDl: string | null;
  msg: string;
}

export const FEEDBACKS: Feedback[] = [
  {
    id: 'f1',
    item: '온실가스 배출량',
    from: '최다현 (삼성SDS 지속가능경영팀)',
    date: '03-19',
    status: 'open',
    responseDl: '03-21',
    msg: 'Scope 1이 전년比 49.6% 급증했습니다. 신규 데이터센터 가동 외 추가 요인 확인 및 변화 사유 기재 부탁드립니다.',
  },
  {
    id: 'f2',
    item: '임직원·다양성·포용',
    from: '정우석 (삼성SDS 지속가능경영팀)',
    date: '03-18',
    status: 'open',
    responseDl: '03-20',
    msg: '여성 관리자 비율이 누락되었습니다. ESRS S1-9 필수 기재사항으로 3월 20일 이전 입력 부탁드립니다.',
  },
  {
    id: 'f3',
    item: '안전보건',
    from: '최다현 (삼성SDS 지속가능경영팀)',
    date: '03-15',
    status: 'resolved',
    responseDl: null,
    msg: '산재 발생건수 4건 → 3건 수정 완료 확인했습니다.',
  },
];

export interface RawDataItem {
  id: string;
  label: string;
  category: string;
  done: boolean;
  val: string | null;
  ifLinked: boolean;
}

export interface AnomalyItem {
  id: string;
  label: string;
  scope: string;
  yoy: string;
  status: string;
}

export const GHG_STATUS = {
  rawData: [
    { id: 'elec', label: '전력 사용량', category: '에너지', done: true, val: '2,522 TJ', ifLinked: true },
    { id: 'lng', label: 'LNG 사용량', category: '에너지', done: true, val: '4,210 MWh', ifLinked: false },
    { id: 'steam', label: '열·스팀 사용량', category: '에너지', done: false, val: null, ifLinked: false },
    { id: 'water', label: '용수 사용량', category: '에너지', done: true, val: '182,400 m³', ifLinked: true },
    { id: 'waste', label: '폐기물 반출량', category: '폐기물', done: true, val: '1,240 톤', ifLinked: false },
    { id: 'wwater', label: '수질 오염물질 배출량', category: '오염물질', done: false, val: null, ifLinked: false },
    { id: 'air', label: '대기 오염물질 배출량', category: '오염물질', done: true, val: '산정 완료', ifLinked: false },
    { id: 'chem', label: '약품 사용량', category: '기타', done: false, val: null, ifLinked: false },
  ] as RawDataItem[],
  anomaly: {
    total: 4,
    unresolved: 2,
    resolved: 1,
    corrected: 1,
    items: [
      { id: 'a1', label: '전력 사용량', scope: 'Scope 2', yoy: '+52.3%', status: 'unresolved' },
      { id: 'a2', label: 'LNG 사용량', scope: 'Scope 1', yoy: '+67.1%', status: 'unresolved' },
      { id: 'a3', label: '폐기물 반출량', scope: 'Scope 1', yoy: '-58.4%', status: 'resolved' },
      { id: 'a4', label: '용수 사용량', scope: 'Scope 3', yoy: '+51.2%', status: 'corrected' },
    ] as AnomalyItem[],
  },
  scope1: { done: true, val: '122,842 tCO₂eq', warn: true, warnMsg: '전년比 +49.6% 변화 사유 미입력' },
  scope2: { done: true, val: '85,340 tCO₂eq', warn: false, warnMsg: null },
  scope3: { done: false, val: null, warn: false, warnMsg: '미산정 (선택 항목)' },
  submitted: false,
  frozenAt: null,
};

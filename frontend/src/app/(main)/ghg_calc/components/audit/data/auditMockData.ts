/** Audit Trail 전략 문서 기준 mock 데이터 */

export interface LineageNode {
  label: string;
  sub: string;
  type: 'sys' | 'man';
  time: string;
  who: string;
  id: string;
  file: string;
  formula: string;
}

export const nodeData: LineageNode[] = [
  {
    label: '원천파일',
    sub: '시스템 연동',
    type: 'sys',
    time: '2024-09-02 14:32:10',
    who: '연시은 (ESG팀)',
    id: 'TRK-2024Q3-001-SRC',
    file: 'energy_usage_2024Q3_raw.xlsx',
    formula: 'ERP 자동 수집',
  },
  {
    label: '활동자료',
    sub: '수기 입력',
    type: 'man',
    time: '2024-09-02 15:10:05',
    who: '연시은 (ESG팀)',
    id: 'TRK-2024Q3-001-ACT',
    file: '활동자료 수동 정리 시트',
    formula: '월별 사용량 합산 (단위변환 포함)',
  },
  {
    label: '배출계수',
    sub: '자동매핑',
    type: 'sys',
    time: '2024-09-02 15:45:00',
    who: '시스템 자동',
    id: 'TRK-2024Q3-001-EF',
    file: '환경부 배출계수 DB 2024',
    formula: '항목코드 → 계수 자동 매핑',
  },
  {
    label: '산정값',
    sub: '시스템 계산',
    type: 'sys',
    time: '2024-09-02 16:00:22',
    who: '시스템 자동',
    id: 'TRK-2024Q3-001-CALC',
    file: '산정 엔진 v2.3.1',
    formula: '활동자료 × 배출계수',
  },
  {
    label: '공시값',
    sub: '승인 확정',
    type: 'man',
    time: '2024-09-03 11:40:00',
    who: '박지훈 (본부장)',
    id: 'TRK-2024Q3-001-PUB',
    file: '공시 최종본 v6',
    formula: '산정값 검토 후 승인 확정',
  },
];

export const approvalSteps = [
  { who: '연시은 (입력 담당)', time: '2024-09-02 14:32', done: true },
  { who: '이민준 (팀장 검토)', time: '2024-09-03 09:15', done: true },
  { who: '박지훈 (본부장 승인)', time: '2024-09-03 11:40', done: true },
];

export interface ChangeEntry {
  id: string;
  time: string;
  corp: string;
  scope: 'S1' | 'S2' | 'S3';
  item: string;
  old: string;
  neu: string;
  writer: string;
  approver: string;
  reason: string;
  status: 'approved' | 'pending' | 'rejected';
  selfApprove: boolean;
}

export const changeData: ChangeEntry[] = [
  {
    id: 'CHG-0041',
    time: '09-05 10:22',
    corp: '멀티캠퍼스',
    scope: 'S1',
    item: '도시가스 사용량',
    old: '1,240 GJ',
    neu: '1,180 GJ',
    writer: '연시은',
    approver: '박지훈',
    reason: '오입력',
    status: 'approved',
    selfApprove: false,
  },
  {
    id: 'CHG-0040',
    time: '09-04 16:05',
    corp: '엠로',
    scope: 'S2',
    item: '전력 구매량',
    old: '8,500 MWh',
    neu: '8,720 MWh',
    writer: '김우빈',
    approver: '박지훈',
    reason: '오입력',
    status: 'pending',
    selfApprove: true,
  },
  {
    id: 'CHG-0039',
    time: '09-03 11:30',
    corp: '멀티캠퍼스',
    scope: 'S3',
    item: '출장 항공편',
    old: '52 편',
    neu: '67 편',
    writer: '최아윤',
    approver: '이민준',
    reason: '경계조정',
    status: 'approved',
    selfApprove: false,
  },
  {
    id: 'CHG-0038',
    time: '09-02 09:10',
    corp: '오픈핸즈',
    scope: 'S2',
    item: '스팀 구매량',
    old: '320 TJ',
    neu: '298 TJ',
    writer: '기가영',
    approver: '기가영',
    reason: '계수변경',
    status: 'rejected',
    selfApprove: true,
  },
];

export interface EmissionFactorEntry {
  item: string;
  scope: 'S1' | 'S2' | 'S3';
  ef: string;
  unit: string;
  src: string;
  ver: string;
  period: string;
  retrofix: boolean;
  manual: boolean;
  approval: 'approved' | 'pending';
}

export const efData: EmissionFactorEntry[] = [
  {
    item: '도시가스',
    scope: 'S1',
    ef: '2.176',
    unit: 'kgCO₂/m³',
    src: '환경부',
    ver: '2024',
    period: 'Q1–Q4',
    retrofix: false,
    manual: false,
    approval: 'approved',
  },
  {
    item: '열·스팀 구매',
    scope: 'S2',
    ef: '0.0956',
    unit: 'tCO₂/GJ',
    src: '자체계수',
    ver: '2024-r2',
    period: 'Q3–Q4',
    retrofix: true,
    manual: true,
    approval: 'pending',
  },
  {
    item: '전력 구매',
    scope: 'S2',
    ef: '0.4567',
    unit: 'kgCO₂/kWh',
    src: '환경부',
    ver: '2024-r1',
    period: 'Q2–Q4',
    retrofix: true,
    manual: true,
    approval: 'approved',
  },
  {
    item: '항공 출장',
    scope: 'S3',
    ef: '0.255',
    unit: 'kgCO₂/km',
    src: 'IPCC',
    ver: 'AR6',
    period: 'Q1–Q4',
    retrofix: false,
    manual: false,
    approval: 'approved',
  },
];

export interface VersionDiff {
  item: string;
  prev: string;
  curr: string;
  delta: string;
  material: string;
  high: boolean;
}

export interface VersionEntry {
  ver: string;
  latest: boolean;
  time: string;
  who: string;
  frozen: boolean;
  unfrozen: boolean;
  total: string;
  s1: string;
  s2: string;
  s3: string;
  approvalSteps: { who: string; time: string; done: boolean }[];
  diff: VersionDiff[];
  note?: string;
}

export const versionData: VersionEntry[] = [
  {
    ver: 'v6',
    latest: true,
    time: '2024-09-12 10:05',
    who: '박지훈',
    frozen: true,
    unfrozen: false,
    total: '12,450',
    s1: '4,120',
    s2: '6,890',
    s3: '1,440',
    approvalSteps: [
      { who: '박지훈 (기안)', time: '09-12 10:05', done: true },
      { who: '이민준 (검토)', time: '09-12 14:20', done: true },
      { who: '최대표 (승인·Freeze)', time: '09-13 09:00', done: true },
    ],
    diff: [
      {
        item: 'Scope 2 전력',
        prev: '6,540',
        curr: '6,890',
        delta: '+350',
        material: '±5.4% ▲',
        high: true,
      },
      {
        item: 'Scope 1 가스',
        prev: '4,100',
        curr: '4,120',
        delta: '+20',
        material: '±0.5%',
        high: false,
      },
    ],
  },
  {
    ver: 'v5',
    latest: false,
    time: '2024-09-08 17:30',
    who: '연시은',
    frozen: false,
    unfrozen: true,
    total: '12,200',
    s1: '4,100',
    s2: '6,540',
    s3: '1,560',
    approvalSteps: [],
    diff: [],
    note: '초기 Freeze 버전 — 배출계수 오류로 해제됨',
  },
  {
    ver: 'v4',
    latest: false,
    time: '2024-09-05 13:00',
    who: '김우빈',
    frozen: false,
    unfrozen: false,
    total: '11,980',
    s1: '3,980',
    s2: '6,480',
    s3: '1,520',
    approvalSteps: [],
    diff: [],
  },
  {
    ver: 'v3',
    latest: false,
    time: '2024-09-01 09:45',
    who: '최아윤',
    frozen: false,
    unfrozen: false,
    total: '11,540',
    s1: '3,840',
    s2: '6,200',
    s3: '1,500',
    approvalSteps: [],
    diff: [],
  },
];

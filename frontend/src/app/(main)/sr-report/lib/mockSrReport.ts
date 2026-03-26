import type { SrDpCard, SrApprovalDoc } from './types';

// `SRReportDashboard_v3.jsx`의 DP/결재 문서 mock을 sr보고서 화면에 맞게 최소 추출
export const DP_CARDS_INIT: SrDpCard[] = [
  {
    id: 'd1',
    title: '에너지 소비량',
    standards: [
      { code: 'GRI 302-1', type: 'GRI', label: 'GRI 302-1' },
      { code: 'SASB EM-EP', type: 'SASB', label: 'SASB EM-EP' },
    ],
    category: '환경',
    deadline: '25.04.10',
    status: 'wip',
    assignee: '박지훈',
    savedText:
      '2024년 총 에너지 소비량은 전력 1,234 TJ, 도시가스 567 TJ이며 전년 대비 3.2% 감소하였습니다.\n\n재생에너지 비중은 12.4%로 전년(9.1%) 대비 증가하였으며, 태양광 설비 추가 설치(3MW)에 따른 결과입니다.',
  },
  {
    id: 'd2',
    title: '온실가스 배출',
    standards: [
      { code: 'GRI 305-1', type: 'GRI', label: 'GRI 305-1' },
      { code: 'GRI 305-2', type: 'GRI', label: 'GRI 305-2' },
      { code: 'TCFD S-1', type: 'TCFD', label: 'TCFD S-1' },
    ],
    category: '환경',
    deadline: '25.04.10',
    status: 'todo',
    assignee: '김가영',
    savedText: '',
  },
  {
    id: 'd3',
    title: '취수 및 방류',
    standards: [
      { code: 'GRI 303-3', type: 'GRI', label: 'GRI 303-3' },
      { code: 'GRI 303-4', type: 'GRI', label: 'GRI 303-4' },
    ],
    category: '환경',
    deadline: '25.04.15',
    status: 'submitted',
    assignee: '박지훈',
    savedText:
      '2024년 총 취수량은 234,500 m³(지표수 180,000 / 지하수 54,500)이며 전년 대비 1.8% 감소하였습니다.\n\n방류량은 198,200 m³이며 방류수 수질검사 결과 전 항목 기준치 이내입니다.',
  },
  {
    id: 'd4',
    title: '신규 채용·이직',
    standards: [{ code: 'GRI 401-1', type: 'GRI', label: 'GRI 401-1' }],
    category: '사회',
    deadline: '25.04.20',
    status: 'todo',
    assignee: '김인사',
    savedText: '',
  },
  {
    id: 'd5',
    title: '이사회 다양성',
    standards: [
      { code: 'GRI 405-1', type: 'GRI', label: 'GRI 405-1' },
      { code: 'SASB CG', type: 'SASB', label: 'SASB CG' },
    ],
    category: '지배구조',
    deadline: '25.04.08',
    status: 'approved',
    assignee: '안수호',
    savedText:
      '2024년 이사회는 총 9명으로 구성되어 있으며 여성이사 비율 22.2%(2명), 사외이사 비율 66.7%(6명)입니다.',
  },
  {
    id: 'd6',
    title: '기후 리스크 평가',
    standards: [
      { code: 'TCFD S-2', type: 'TCFD', label: 'TCFD S-2' },
      { code: 'TCFD S-3', type: 'TCFD', label: 'TCFD S-3' },
    ],
    category: '환경',
    deadline: '25.04.12',
    status: 'wip',
    assignee: '김가영',
    savedText:
      '물리적 리스크: 2030년 기준 홍수 리스크 노출 자산 약 320억원(전체의 4.2%)으로 평가됩니다.\n\n전환 리스크: 탄소세 도입 시나리오(50$/tCO₂)에서 추가 비용 연간 약 28억원 예상됩니다.',
  },
  {
    id: 'd7',
    title: '공급망 인권실사',
    standards: [
      { code: 'GRI 414-1', type: 'GRI', label: 'GRI 414-1' },
      { code: 'GRI 414-2', type: 'GRI', label: 'GRI 414-2' },
    ],
    category: '사회',
    deadline: '25.04.25',
    status: 'todo',
    assignee: '박지훈',
    savedText: '',
  },
  {
    id: 'd8',
    title: '산업안전·보건',
    standards: [
      { code: 'GRI 403-9', type: 'GRI', label: 'GRI 403-9' },
      { code: 'GRI 403-10', type: 'GRI', label: 'GRI 403-10' },
    ],
    category: '사회',
    deadline: '25.04.18',
    status: 'submitted',
    assignee: '김인사',
    savedText:
      '2024년 재해율 0.42‰(전년 0.50‰), 산업재해 3건(경상 2건, 중상 1건), 직업성 질환 0건입니다.\n\n안전보건 교육 이수율 98.7%, 위험성 평가 실시율 100%입니다.',
  },
];

export const APPROVALS_INIT: SrApprovalDoc[] = [
  {
    id: 'a1',
    dpId: 'd3',
    docNo: 'ESG-2025-029',
    title: '취수 및 방류 데이터 제출 승인 요청',
    drafter: '박지훈 대리',
    draftedAt: '25.03.21 09:30',
    status: 'pending',
    body:
      'GRI 303-3, GRI 303-4 기준에 따라 2024년도 취수 및 방류 데이터를 첨부하여 제출합니다.\n\n■ 취수량: 234,500 m³ (지표수 180,000 / 지하수 54,500)\n■ 방류량: 198,200 m³\n■ 재이용수: 36,300 m³\n\n데이터 검증 완료 후 SR 보고서에 반영 예정입니다.',
    attachments: ['GRI303_data_2024.xlsx', '수질검사결과서.pdf'],
    comments: [],
    rejReason: '',
  },
  {
    id: 'a2',
    dpId: 'd8',
    docNo: 'ESG-2025-031',
    title: '산업안전보건 데이터 제출 승인 요청',
    drafter: '김인사 대리',
    draftedAt: '25.03.22 14:11',
    status: 'rejected',
    body:
      'GRI 403-9, GRI 403-10 기준에 따른 2024년도 산업안전보건 데이터를 제출합니다.\n\n■ 재해율: 0.42‰\n■ 산업재해 건수: 3건\n■ 직업성 질환: 0건',
    attachments: ['안전보건_통계_2024.xlsx'],
    comments: [
      {
        author: '연시은 차장',
        date: '25.03.23 10:15',
        text: '재해 분류 기준 근거 자료 추가 첨부 필요합니다. ILO 기준 적용 여부 명시 바랍니다.',
      },
    ],
    rejReason: '재해 분류 기준 근거 자료 미첨부 — ILO 기준 적용 여부 명시 후 재상신 바랍니다.',
  },
  {
    id: 'a3',
    dpId: 'd5',
    docNo: 'ESG-2025-025',
    title: '이사회 다양성 데이터 제출 승인 요청',
    drafter: '안수호 대리',
    draftedAt: '25.03.15 11:00',
    status: 'approved',
    body:
      'GRI 405-1 기준에 따른 이사회 구성 다양성 데이터를 제출합니다.\n\n■ 총 이사 수: 9명\n■ 여성이사: 2명(22.2%)\n■ 사외이사: 6명(66.7%)\n■ 평균 재임기간: 3.2년',
    attachments: ['이사회구성현황_2024.xlsx'],
    comments: [{ author: '김지속 팀장', date: '25.03.17 14:30', text: '내용 확인 완료. 승인합니다.' }],
    rejReason: '',
  },
];

export const DP_GHG_EDITOR_ID = 'd2';


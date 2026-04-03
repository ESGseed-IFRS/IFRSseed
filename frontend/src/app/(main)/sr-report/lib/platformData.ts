/**
 * SR 플랫폼 mock 데이터 — SRReportPlatform.jsx 기반
 */

import type { CategoryGroup, SubsidiarySubmission, MergedDataItem, TocGroup, VizItem, DpMaster, DpAggregation } from './platformTypes';

export const FIELD_SCHEMAS = {
  ghg: {
    label: '온실가스 배출량',
    sections: [
      {
        id: 'quant',
        title: '정량 데이터',
        color: '#185FA5',
        desc: '측정된 수치를 단위와 함께 입력하세요.',
        fields: [
          { id: 'scope1', label: 'Scope 1 직접배출', type: 'number' as const, unit: 'tCO₂e', required: true, placeholder: '예) 12450' },
          { id: 'scope2_lb', label: 'Scope 2 (위치기반)', type: 'number' as const, unit: 'tCO₂e', required: true, placeholder: '예) 8210' },
          { id: 'scope2_mb', label: 'Scope 2 (시장기반)', type: 'number' as const, unit: 'tCO₂e', required: false, placeholder: '예) 7890' },
          { id: 'scope3', label: 'Scope 3 (산정 시)', type: 'number' as const, unit: 'tCO₂e', required: false, placeholder: '미산정 시 공란' },
          { id: 'intensity', label: '탄소집약도', type: 'number' as const, unit: 'tCO₂e/억원', required: false, placeholder: '예) 8.4' },
        ],
      },
      {
        id: 'method',
        title: '산정 방법론',
        color: '#639922',
        desc: '어떤 기준/도구로 산정했는지 선택·서술하세요.',
        fields: [
          { id: 'protocol', label: '적용 프로토콜', type: 'select' as const, options: ['GHG Protocol Corporate Standard', 'ISO 14064-1', '환경부 온실가스 배출량 산정·보고 지침', '기타'], required: true },
          { id: 'boundary', label: '조직 경계 기준', type: 'select' as const, options: ['재무적 통제 기준', '운영적 통제 기준', '지분 비례 기준'], required: true },
          { id: 'base_year', label: '기준연도', type: 'number' as const, unit: '년', required: true, placeholder: '예) 2018' },
          { id: 'method_note', label: '보충 설명', type: 'textarea' as const, rows: 2, required: false, placeholder: '배출계수 출처, 추정 방법 등 추가 설명' },
        ],
      },
      {
        id: 'change',
        title: '전년 대비 변화 사유',
        color: '#EF9F27',
        desc: '전년 대비 증감이 있다면 원인을 서술하세요.',
        fields: [
          { id: 'yoy_reason', label: '증감 원인', type: 'textarea' as const, rows: 3, required: false, placeholder: '예) Scope 1 감소: 2호 생산라인 LNG→전기 전환...' },
        ],
      },
      {
        id: 'action',
        title: '감축 이행 활동',
        color: '#3B6D11',
        desc: '보고 기간 중 실시한 주요 감축 활동을 기술하세요.',
        fields: [
          { id: 'actions', label: '주요 감축 활동', type: 'textarea' as const, rows: 3, required: false, placeholder: '예) • 태양광 패널 옥상 설치...' },
          { id: 'third_party', label: '제3자 검증 여부', type: 'select' as const, options: ['미검증', '내부 검토 완료', '외부 검증 완료 (확인 수준)', '외부 검증 완료 (합리적 확신 수준)'], required: true },
          { id: 'verifier', label: '검증 기관', type: 'text' as const, required: false, placeholder: '예) 한국품질재단, DNV 등' },
        ],
      },
    ],
  },
  energy: {
    label: '에너지 소비량',
    sections: [
      {
        id: 'quant',
        title: '정량 데이터',
        color: '#185FA5',
        desc: '에너지원별 소비량을 입력하세요.',
        fields: [
          { id: 'total', label: '총 에너지 소비량', type: 'number' as const, unit: 'MWh', required: true, placeholder: '예) 45000' },
          { id: 'fossil', label: '화석연료 소비', type: 'number' as const, unit: 'MWh', required: true, placeholder: '예) 30600' },
          { id: 'renewable', label: '재생에너지 소비', type: 'number' as const, unit: 'MWh', required: true, placeholder: '예) 14400' },
          { id: 're_ratio', label: '재생에너지 비중', type: 'percent' as const, unit: '%', required: true, placeholder: '예) 32' },
          { id: 'intensity', label: '에너지 집약도', type: 'number' as const, unit: 'MWh/억원', required: false, placeholder: '예) 28.6' },
        ],
      },
      {
        id: 'method',
        title: '산정 방법론',
        color: '#639922',
        desc: '',
        fields: [
          { id: 'boundary', label: '집계 범위', type: 'select' as const, options: ['전사 (모든 사업장)', '국내 사업장만', '생산시설만', '기타'], required: true },
          { id: 're_type', label: '재생에너지 유형', type: 'text' as const, required: false, placeholder: '예) 태양광 20%, 풍력 12%' },
          { id: 'rec', label: 'REC/인증서 활용', type: 'select' as const, options: ['없음', '녹색 전력 인증서(K-REC)', '국제 재생에너지 인증(I-REC)', 'PPA 계약'], required: false },
        ],
      },
      {
        id: 'change',
        title: '전년 대비 변화 사유',
        color: '#EF9F27',
        desc: '',
        fields: [
          { id: 'yoy_reason', label: '증감 원인', type: 'textarea' as const, rows: 3, required: false, placeholder: '예) 재생에너지 비중 증가...' },
        ],
      },
    ],
  },
  safety: {
    label: '안전보건 지표',
    sections: [
      {
        id: 'quant',
        title: '정량 데이터',
        color: '#185FA5',
        desc: '직접 고용 기준.',
        fields: [
          { id: 'ltir', label: 'LTIR (근로손실재해율)', type: 'number' as const, unit: '', required: true, placeholder: '예) 0.42' },
          { id: 'trir', label: 'TRIR (총재해율)', type: 'number' as const, unit: '', required: false, placeholder: '예) 1.12' },
          { id: 'fatality', label: '사망사고 건수', type: 'number' as const, unit: '건', required: true, placeholder: '예) 0' },
          { id: 'accidents', label: '산업재해 건수', type: 'number' as const, unit: '건', required: true, placeholder: '예) 3' },
          { id: 'near_miss', label: '아차사고 보고 건수', type: 'number' as const, unit: '건', required: false, placeholder: '예) 47' },
          { id: 'training', label: '안전교육 이수율', type: 'percent' as const, unit: '%', required: true, placeholder: '예) 98.3' },
        ],
      },
      {
        id: 'quant2',
        title: '협력업체 안전 지표',
        color: '#185FA5',
        desc: '협력업체(도급·파견 포함) 기준 별도 기입.',
        fields: [
          { id: 'sub_ltir', label: '협력업체 LTIR', type: 'number' as const, unit: '', required: false, placeholder: '예) 0.65' },
          { id: 'sub_fatal', label: '협력업체 사망사고', type: 'number' as const, unit: '건', required: false, placeholder: '예) 0' },
        ],
      },
      {
        id: 'qualitative',
        title: '안전보건 경영 활동',
        color: '#639922',
        desc: '정책, 목표, 주요 이행 활동을 서술하세요.',
        fields: [
          { id: 'policy', label: '안전보건 방침·목표', type: 'textarea' as const, rows: 2, required: false, placeholder: '예) 2026년까지 LTIR 0.3 이하 달성 목표' },
          { id: 'programs', label: '주요 안전 프로그램', type: 'textarea' as const, rows: 3, required: false, placeholder: '예) • 전 사업장 KOSHA-MS 인증 유지...' },
        ],
      },
      {
        id: 'change',
        title: '전년 대비 변화 사유',
        color: '#EF9F27',
        desc: '',
        fields: [
          { id: 'yoy_reason', label: '증감 원인', type: 'textarea' as const, rows: 2, required: false, placeholder: '예) LTIR 개선...' },
        ],
      },
    ],
  },
  supply: {
    label: '공급망 인권실사',
    sections: [
      {
        id: 'quant',
        title: '정량 데이터',
        color: '#185FA5',
        desc: '실사 대상 범위와 결과를 수치로 입력하세요.',
        fields: [
          { id: 'total_sup', label: '전체 공급업체 수', type: 'number' as const, unit: '개사', required: true, placeholder: '예) 230' },
          { id: 'target_sup', label: '실사 대상 업체 수', type: 'number' as const, unit: '개사', required: true, placeholder: '예) 52' },
          { id: 'target_pct', label: '실사 대상 비율', type: 'percent' as const, unit: '%', required: false, placeholder: '예) 22.6' },
          { id: 'high_risk', label: '고위험 업체 수', type: 'number' as const, unit: '개사', required: true, placeholder: '예) 4' },
          { id: 'onsite', label: '현장 실사 완료', type: 'number' as const, unit: '개사', required: false, placeholder: '예) 2' },
          { id: 'corrective', label: '시정조치 이행 완료', type: 'number' as const, unit: '건', required: false, placeholder: '예) 6' },
        ],
      },
      {
        id: 'qualitative',
        title: '실사 프로세스 (정성)',
        color: '#639922',
        desc: '고위험 식별 기준과 대응 방법을 서술하세요.',
        fields: [
          { id: 'criteria', label: '고위험 식별 기준', type: 'textarea' as const, rows: 2, required: true, placeholder: '예) UN 기업인권지침(UNGPs) 기반...' },
          { id: 'process', label: '실사 절차', type: 'textarea' as const, rows: 3, required: false, placeholder: '예) 1단계: 자가진단 설문...' },
          { id: 'remediation', label: '주요 시정조치 내용', type: 'textarea' as const, rows: 2, required: false, placeholder: '예) 고위험 4개사 중 2개사...' },
        ],
      },
      {
        id: 'change',
        title: '전년 대비 변화 사유',
        color: '#EF9F27',
        desc: '',
        fields: [
          { id: 'yoy_reason', label: '변화 및 개선 사항', type: 'textarea' as const, rows: 2, required: false, placeholder: '예) 실사 대상 업체 수 확대...' },
        ],
      },
    ],
  },
  climate: {
    label: '기후 리스크 시나리오',
    sections: [
      {
        id: 'quant',
        title: '시나리오 설정',
        color: '#185FA5',
        desc: '적용한 시나리오와 분석 시계를 입력하세요.',
        fields: [
          { id: 'scenario', label: '적용 시나리오', type: 'select' as const, options: ['IEA NZE (1.5°C)', 'IEA SDS (2°C)', 'IEA STEPS (정책 미달성)', 'IPCC SSP1', 'IPCC SSP2', 'IPCC SSP3', 'IPCC SSP5', '기타'], required: true },
          { id: 'horizons', label: '분석 시계', type: 'text' as const, required: true, placeholder: '예) 단기 2025, 중기 2030, 장기 2050' },
          { id: 'framework', label: '분석 프레임워크', type: 'select' as const, options: ['TCFD', 'ISSB IFRS S2', '자체 개발 방법론'], required: true },
        ],
      },
      {
        id: 'qualitative',
        title: '리스크·기회 식별 (정성)',
        color: '#639922',
        desc: '주요 기후 리스크와 기회를 서술하세요.',
        fields: [
          { id: 'physical', label: '물리적 리스크', type: 'textarea' as const, rows: 3, required: true, placeholder: '예) 급성: 태풍·홍수...' },
          { id: 'transition', label: '전환 리스크', type: 'textarea' as const, rows: 3, required: true, placeholder: '예) 탄소세 도입 시...' },
          { id: 'opportunity', label: '기후 기회', type: 'textarea' as const, rows: 2, required: false, placeholder: '예) 저탄소 제품...' },
          { id: 'financial', label: '재무 영향 정량화', type: 'textarea' as const, rows: 2, required: false, placeholder: '예) 시나리오별 EBITDA...' },
        ],
      },
    ],
  },
  diversity: {
    label: '임직원 현황·다양성',
    sections: [
      {
        id: 'quant',
        title: '정량 데이터',
        color: '#185FA5',
        desc: '보고 기간 말일 기준 수치를 입력하세요.',
        fields: [
          { id: 'total_emp', label: '전체 임직원 수', type: 'number' as const, unit: '명', required: true, placeholder: '예) 1240' },
          { id: 'female_pct', label: '여성 직원 비율', type: 'percent' as const, unit: '%', required: true, placeholder: '예) 34.2' },
          { id: 'female_mgr', label: '여성 관리직 비율', type: 'percent' as const, unit: '%', required: true, placeholder: '예) 18.5' },
          { id: 'female_exec', label: '여성 임원 비율', type: 'percent' as const, unit: '%', required: false, placeholder: '예) 12.5' },
        ],
      },
      {
        id: 'qualitative',
        title: '다양성·포용 정책 (정성)',
        color: '#639922',
        desc: '조직의 다양성 관련 정책과 이행 내용을 서술하세요.',
        fields: [
          { id: 'policy', label: '다양성 정책·목표', type: 'textarea' as const, rows: 2, required: false, placeholder: '예) 2027년까지...' },
          { id: 'programs', label: '주요 다양성 프로그램', type: 'textarea' as const, rows: 3, required: false, placeholder: '예) • 여성 리더십...' },
        ],
      },
    ],
  },
  governance: {
    label: '이사회·지배구조',
    sections: [
      {
        id: 'quant',
        title: '정량 데이터',
        color: '#185FA5',
        desc: '',
        fields: [
          { id: 'board_total', label: '이사회 총 인원', type: 'number' as const, unit: '명', required: true, placeholder: '예) 8' },
          { id: 'indep_pct', label: '사외이사 비율', type: 'percent' as const, unit: '%', required: true, placeholder: '예) 62.5' },
          { id: 'female_pct', label: '여성 이사 비율', type: 'percent' as const, unit: '%', required: true, placeholder: '예) 25.0' },
        ],
      },
      {
        id: 'qualitative',
        title: 'ESG 거버넌스 구조 (정성)',
        color: '#639922',
        desc: '이사회의 지속가능성 관련 권한·책임 구조를 서술하세요.',
        fields: [
          { id: 'structure', label: '거버넌스 구조', type: 'textarea' as const, rows: 2, required: false, placeholder: '예) 이사회 산하 ESG위원회...' },
          { id: 'esg_link', label: '경영진 보수 ESG 연동', type: 'textarea' as const, rows: 2, required: false, placeholder: '예) 대표이사·임원 KPI...' },
        ],
      },
    ],
  },
  ethics: {
    label: '윤리·컴플라이언스',
    sections: [
      {
        id: 'quant',
        title: '정량 데이터',
        color: '#185FA5',
        desc: '',
        fields: [
          { id: 'training', label: '윤리교육 이수율', type: 'percent' as const, unit: '%', required: true, placeholder: '예) 99.1' },
          { id: 'whistleblow', label: '내부고발 접수 건수', type: 'number' as const, unit: '건', required: false, placeholder: '예) 7' },
        ],
      },
      {
        id: 'qualitative',
        title: '윤리경영 활동 (정성)',
        color: '#639922',
        desc: '',
        fields: [
          { id: 'policy', label: '반부패 정책·채널', type: 'textarea' as const, rows: 2, required: false, placeholder: '예) 부패방지 방침...' },
          { id: 'programs', label: '주요 이행 활동', type: 'textarea' as const, rows: 2, required: false, placeholder: '예) 전 임직원 반부패 교육...' },
        ],
      },
    ],
  },
  water: {
    label: '용수 취수·재이용',
    sections: [
      {
        id: 'quant',
        title: '정량 데이터',
        color: '#185FA5',
        desc: '',
        fields: [
          { id: 'withdrawal', label: '총 취수량', type: 'number' as const, unit: 'm³', required: true, placeholder: '예) 120000' },
          { id: 'municipal', label: '상수도 취수', type: 'number' as const, unit: 'm³', required: false, placeholder: '예) 90000' },
        ],
      },
      {
        id: 'qualitative',
        title: '수자원 경영 활동 (정성)',
        color: '#639922',
        desc: '',
        fields: [
          { id: 'stress', label: '물 스트레스 지역 여부', type: 'select' as const, options: ['해당 없음', '일부 사업장 해당 (WRI Aqueduct 기준)', '주요 사업장 해당'], required: false },
          { id: 'programs', label: '용수 절감 활동', type: 'textarea' as const, rows: 2, required: false, placeholder: '예) 냉각수 순환 시스템...' },
        ],
      },
    ],
  },
} as const;

export const CATEGORY_TREE: CategoryGroup[] = [
  {
    id: 'env',
    label: '환경 (E)',
    color: '#3B6D11',
    bg: '#EAF3DE',
    items: [
      {
        id: 1,
        name: 'GHG 배출량 (Scope 1·2·3)',
        standards: ['ISSB', 'GRI'],
        deadline: '03-20',
        status: '제출완료',
        rate: 100,
        submitDate: '03-12',
        holdingComment: null,
        fields: {
          scope1: '12450',
          scope2_lb: '8210',
          scope2_mb: '7890',
          protocol: 'GHG Protocol Corporate Standard',
          boundary: '운영적 통제 기준',
          base_year: '2018',
        },
      },
      {
        id: 2,
        name: '에너지 소비량',
        standards: ['ISSB', 'ESRS'],
        deadline: '03-20',
        status: '작성중',
        rate: 60,
        submitDate: null,
        holdingComment: null,
        fields: { total: '45000', fossil: '30600', renewable: '14400', re_ratio: '32' },
      },
      {
        id: 3,
        name: '기후 리스크 시나리오',
        standards: ['ISSB'],
        deadline: '03-25',
        status: '제출완료',
        rate: 100,
        submitDate: '03-10',
        holdingComment: null,
        fields: {},
      },
      {
        id: 10,
        name: '용수 취수·재이용',
        standards: ['GRI', 'ESRS'],
        deadline: '03-25',
        status: '미작성',
        rate: 0,
        submitDate: null,
        holdingComment: null,
        fields: {},
      },
    ],
  },
  {
    id: 'soc',
    label: '사회 (S)',
    color: '#633806',
    bg: '#FAEEDA',
    items: [
      {
        id: 4,
        name: '안전보건 지표 (LTIR)',
        standards: ['GRI'],
        deadline: '03-20',
        status: '제출완료',
        rate: 100,
        submitDate: '03-13',
        holdingComment: '근로자·협력업체 구분 데이터도 추가 부탁드립니다.',
        fields: { ltir: '0.42', fatality: '0', accidents: '3', training: '98.3' },
      },
      {
        id: 6,
        name: '공급망 인권실사',
        standards: ['ESRS', 'GRI'],
        deadline: '03-28',
        status: '작성중',
        rate: 40,
        submitDate: null,
        holdingComment: null,
        fields: { total_sup: '230', target_sup: '52', high_risk: '4' },
      },
      {
        id: 7,
        name: '임직원 현황 (다양성)',
        standards: ['GRI', 'ESRS'],
        deadline: '03-28',
        status: '미작성',
        rate: 0,
        submitDate: null,
        holdingComment: null,
        fields: {},
      },
    ],
  },
  {
    id: 'gov',
    label: '지배구조 (G)',
    color: '#0C447C',
    bg: '#EFF5FC',
    items: [
      {
        id: 8,
        name: '이사회 다양성·구성',
        standards: ['ISSB', 'ESRS'],
        deadline: '04-05',
        status: '미작성',
        rate: 0,
        submitDate: null,
        holdingComment: null,
        fields: {},
      },
      {
        id: 9,
        name: '윤리·컴플라이언스',
        standards: ['GRI'],
        deadline: '04-05',
        status: '미작성',
        rate: 0,
        submitDate: null,
        holdingComment: null,
        fields: {},
      },
    ],
  },
];

export const SUBSIDIARY_SUBMISSIONS: SubsidiarySubmission[] = [
  {
    corp: 'A법인',
    corpId: 'A',
    items: [
      { id: 1, name: 'GHG 배출량 (Scope 1·2·3)', standards: ['ISSB', 'GRI'], category: '환경·기후', value: 'Scope 1: 12,450 tCO₂e / Scope 2: 8,210 tCO₂e', file: 'GHG_2023_A.xlsx', status: '제출완료', submitDate: '03-12' },
      { id: 2, name: '에너지 소비량', standards: ['ISSB', 'ESRS'], category: '환경·에너지', value: '총 45,000 MWh / 재생에너지 32%', file: 'energy_A.pdf', status: '제출완료', submitDate: '03-12' },
      { id: 3, name: '안전보건 지표 (LTIR)', standards: ['GRI'], category: '사회·안전', value: 'LTIR 0.42 / 재해율 0.18%', file: 'safety_A.xlsx', status: '제출완료', submitDate: '03-13' },
      { id: 4, name: '공급망 인권실사', standards: ['ESRS', 'GRI'], category: '사회·공급망', value: '실사 대상 52개사', file: null, status: '작성중', submitDate: null },
    ],
  },
  {
    corp: 'B법인',
    corpId: 'B',
    items: [
      { id: 5, name: 'GHG 배출량 (Scope 1·2·3)', standards: ['ISSB', 'GRI'], category: '환경·기후', value: 'Scope 1: 8,210 tCO₂e / Scope 2: 5,400 tCO₂e', file: 'GHG_2023_B.xlsx', status: '제출완료', submitDate: '03-13' },
      { id: 6, name: '에너지 소비량', standards: ['ISSB', 'ESRS'], category: '환경·에너지', value: '총 28,000 MWh / 재생에너지 18%', file: 'energy_B.pdf', status: '제출완료', submitDate: '03-13' },
      { id: 7, name: '안전보건 지표 (LTIR)', standards: ['GRI'], category: '사회·안전', value: 'LTIR 0.61 / 재해율 0.24%', file: 'safety_B.xlsx', status: '제출완료', submitDate: '03-14' },
      { id: 8, name: '공급망 인권실사', standards: ['ESRS', 'GRI'], category: '사회·공급망', value: '실사 대상 76개사', file: 'supply_B.pdf', status: '제출완료', submitDate: '03-14' },
    ],
  },
  {
    corp: 'C법인',
    corpId: 'C',
    items: [
      { id: 9, name: 'GHG 배출량', standards: ['ISSB', 'GRI'], category: '환경·기후', value: '', file: null, status: '작성중', submitDate: null },
      { id: 10, name: '에너지 소비량', standards: ['ISSB', 'ESRS'], category: '환경·에너지', value: '총 11,200 MWh / 재생에너지 41%', file: 'energy_C.pdf', status: '제출완료', submitDate: '03-14' },
      { id: 11, name: '안전보건 지표', standards: ['GRI'], category: '사회·안전', value: '', file: null, status: '미작성', submitDate: null },
      { id: 12, name: '공급망 인권실사', standards: ['ESRS', 'GRI'], category: '사회·공급망', value: '', file: null, status: '미작성', submitDate: null },
    ],
  },
];

/** 지주사 취합 페이지 상단 KPI용 합산 수치 (GHG 기준) */
export const AGGREGATE_TOTALS = {
  scope1: 20660,
  scope2: 13610,
  emp: null as number | null, // TBD — 현재 데이터에 없음
};

/** Scope 1/2 파싱 (예: "Scope 1: 12,450 tCO₂e / Scope 2: 8,210 tCO₂e") */
function parseScopeFromValue(val: string): { scope1: number; scope2: number } {
  const s1 = val.match(/Scope\s*1[:\s]*([\d,]+)/i);
  const s2 = val.match(/Scope\s*2[:\s]*([\d,]+)/i);
  return {
    scope1: s1 ? parseInt(s1[1].replace(/,/g, ''), 10) : 0,
    scope2: s2 ? parseInt(s2[1].replace(/,/g, ''), 10) : 0,
  };
}

/** 공시데이터 작성 페이지용 — 계열사별 요약 (sds AggregatePage 스타일) */
export interface SubsidiarySummaryRow {
  corp: string;
  corpId: string;
  pct: number;
  scope1: number;
  scope2: number;
  emp: number | null;
  status: 'submitted' | 'approved' | 'draft';
}

export function getSubsidiarySummaries(): SubsidiarySummaryRow[] {
  return SUBSIDIARY_SUBMISSIONS.map((sub) => {
    const done = sub.items.filter((i) => i.status === '제출완료').length;
    const pct = sub.items.length > 0 ? Math.round((done / sub.items.length) * 100) : 0;
    const ghg = sub.items.find((i) => i.name.includes('GHG') || i.name.includes('Scope'));
    const { scope1, scope2 } = ghg?.value ? parseScopeFromValue(ghg.value) : { scope1: 0, scope2: 0 };
    let status: 'submitted' | 'approved' | 'draft' = 'draft';
    if (pct === 100) status = 'approved';
    else if (done > 0) status = 'submitted';
    return {
      corp: sub.corp,
      corpId: sub.corpId,
      pct,
      scope1,
      scope2,
      emp: null,
      status,
    };
  });
}

export const MERGED_DATA: MergedDataItem[] = [
  {
    id: 'm1',
    name: 'GHG 배출량 (Scope 1·2·3)',
    standards: ['ISSB', 'GRI'],
    merged: '그룹 전체 Scope 1: 20,660 tCO₂e / Scope 2: 13,610 tCO₂e (C법인 미제출)',
    sources: ['A법인 ✓', 'B법인 ✓', 'C법인 대기중'],
    mergeStatus: '부분',
    tocPage: '온실가스 배출',
  },
  {
    id: 'm2',
    name: '에너지 소비량',
    standards: ['ISSB', 'ESRS'],
    merged: '그룹 전체 총 84,200 MWh / 재생에너지 30.1%',
    sources: ['A법인 ✓', 'B법인 ✓', 'C법인 ✓'],
    mergeStatus: '완료',
    tocPage: '에너지 전환',
  },
  {
    id: 'm3',
    name: '안전보건 지표 (LTIR)',
    standards: ['GRI'],
    merged: '그룹 평균 LTIR 0.51 / 재해율 0.21%',
    sources: ['A법인 ✓', 'B법인 ✓', 'C법인 미제출'],
    mergeStatus: '부분',
    tocPage: '안전보건',
  },
  {
    id: 'm4',
    name: '공급망 인권실사',
    standards: ['ESRS', 'GRI'],
    merged: '그룹 전체 128개사 / 고위험 11개사',
    sources: ['A법인 대기중', 'B법인 ✓', 'C법인 미제출'],
    mergeStatus: '부분',
    tocPage: '공급망 관리',
  },
];

/** SR_Platform_Strategy: DP 마스터 — 지주사 취합 화면용 */
export const DP_MASTER_LIST: DpMaster[] = [
  {
    dp_id: 'DP-ENV-001',
    dp_name_ko: '온실가스 배출량 (Scope 1·2)',
    category: 'E',
    coverage: { gri: 'GRI 305-1', issb: 'ISSB S2-16', esrs: 'ESRS E1-6' },
    dp_type: 'ALL_THREE',
    aggregation_method: 'SUM',
    fields: {
      common: [],
      gri: [
        { field_id: 'scope1', label_ko: 'Scope 1 총 배출량', field_type: 'NUMBER', unit: 'tCO₂e', is_required: true, is_qualitative: false },
        { field_id: 'scope2', label_ko: 'Scope 2 총 배출량', field_type: 'NUMBER', unit: 'tCO₂e', is_required: true, is_qualitative: false },
        { field_id: 'narrative', label_ko: '감축 노력 및 계획 서술', field_type: 'TEXTAREA', is_required: false, is_qualitative: true, note: '자사의 온실가스 감축 활동, 목표, 성과를 서술하세요.' },
      ],
      issb: [
        { field_id: 'scope1', label_ko: 'Scope 1 (Gross basis)', field_type: 'NUMBER', unit: 'tCO₂e', is_required: true, is_qualitative: false },
        { field_id: 'scope2', label_ko: 'Scope 2 (위치기반)', field_type: 'NUMBER', unit: 'tCO₂e', is_required: true, is_qualitative: false },
        { field_id: 'target_progress', label_ko: '기후 목표 달성 진척도 서술', field_type: 'TEXTAREA', is_required: false, is_qualitative: true },
      ],
      esrs: [
        { field_id: 'scope1', label_ko: 'Gross 총 배출량', field_type: 'NUMBER', unit: 'tCO₂e', is_required: true, is_qualitative: false },
        { field_id: 'scope2', label_ko: 'Location-based 배출량', field_type: 'NUMBER', unit: 'tCO₂e', is_required: true, is_qualitative: false },
        { field_id: 'esrs_narrative', label_ko: 'ESRS 추가 맥락 서술', field_type: 'TEXTAREA', is_required: false, is_qualitative: true },
      ],
    },
  },
  {
    dp_id: 'DP-ENV-002',
    dp_name_ko: '에너지 소비량',
    category: 'E',
    coverage: { gri: 'GRI 302-1', issb: 'ISSB S2-17', esrs: 'ESRS E1-5' },
    dp_type: 'ALL_THREE',
    aggregation_method: 'SUM',
    fields: {
      common: [],
      gri: [
        { field_id: 'total_energy', label_ko: '총 에너지 소비량', field_type: 'NUMBER', unit: 'MWh', is_required: true, is_qualitative: false },
        { field_id: 'renewable_ratio', label_ko: '재생에너지 비중', field_type: 'NUMBER', unit: '%', is_required: true, is_qualitative: false },
        { field_id: 'narrative', label_ko: '에너지 전환 계획 서술', field_type: 'TEXTAREA', is_required: false, is_qualitative: true },
      ],
      issb: [],
      esrs: [],
    },
  },
  {
    dp_id: 'DP-SOC-001',
    dp_name_ko: '안전보건 지표 (LTIR)',
    category: 'S',
    coverage: { gri: 'GRI 403-9', issb: null, esrs: 'ESRS S1-1' },
    dp_type: 'GRI_ESRS',
    aggregation_method: 'WEIGHTED_AVG',
    fields: {
      common: [],
      gri: [
        { field_id: 'ltir', label_ko: 'LTIR (근로손실재해율)', field_type: 'NUMBER', is_required: true, is_qualitative: false },
        { field_id: 'narrative', label_ko: '안전보건 경영 활동 서술', field_type: 'TEXTAREA', is_required: false, is_qualitative: true },
      ],
      issb: [],
      esrs: [
        { field_id: 'ltir', label_ko: 'LTIR', field_type: 'NUMBER', is_required: true, is_qualitative: false },
        { field_id: 'narrative', label_ko: '안전보건 정책 서술', field_type: 'TEXTAREA', is_required: false, is_qualitative: true },
      ],
    },
  },
  {
    dp_id: 'DP-SOC-002',
    dp_name_ko: '공급망 인권실사',
    category: 'S',
    coverage: { gri: 'GRI 414', issb: null, esrs: 'ESRS S2-4' },
    dp_type: 'GRI_ESRS',
    aggregation_method: 'QUALITATIVE',
    fields: {
      common: [],
      gri: [
        { field_id: 'narrative', label_ko: '공급망 인권실사 서술', field_type: 'TEXTAREA', is_required: true, is_qualitative: true },
      ],
      issb: [],
      esrs: [
        { field_id: 'narrative', label_ko: '가치사슬 인권 실사 서술', field_type: 'TEXTAREA', is_required: true, is_qualitative: true },
      ],
    },
  },
];

/** DP별 지주사 취합 mock — DP-ENV-001(온실가스) 상세 */
export const DP_AGGREGATIONS: Record<string, DpAggregation> = {
  'DP-ENV-001': {
    dp_id: 'DP-ENV-001',
    report_year: 2024,
    status: 'REVIEWING',
    subsidiary_submissions: [
      { subsidiary_id: 'A', subsidiary_name: 'A법인', status: 'ACCEPTED', methodology: 'GHG Protocol Corporate Standard', yoy_change: -3.2, values: { scope1: 12450, scope2: 8210 } },
      { subsidiary_id: 'B', subsidiary_name: 'B법인', status: 'ACCEPTED', methodology: 'GHG Protocol Corporate Standard', yoy_change: -1.8, values: { scope1: 8210, scope2: 5400 } },
      { subsidiary_id: 'C', subsidiary_name: 'C법인', status: 'SUBMITTED', methodology: 'ISO 14064-1', yoy_change: 0.5, values: { scope1: null, scope2: null } },
    ],
    quantitative: {
      auto_value: 20660,
      final_value: null,
      unit: 'tCO₂e',
      adjustment_reason: undefined,
    },
    qualitative: {
      subsidiary_texts: [
        { subsidiary_id: 'A', subsidiary_name: 'A법인', text: '당사는 2024년 에너지 효율화 설비 교체를 통해 Scope 1 배출량을 3.2% 감축하였습니다. 2호 생산라인 LNG→전기 전환 및 태양광 패널 옥상 설치가 주요 원인입니다.' },
        { subsidiary_id: 'B', subsidiary_name: 'B법인', text: 'B사는 재생에너지 전환 로드맵에 따라 2024년 Scope 2 재생에너지 비중을 28%로 확대하였으며, PPA 계약을 통한 녹색전력 구매가 증가하였습니다.' },
        { subsidiary_id: 'C', subsidiary_name: 'C법인', text: 'C사의 경우 생산량 증가로 인해 Scope 1이 전년 대비 소폭 증가하였으나, 2025년 태양광 설치 계획으로 감축 전환을 추진 중입니다.' },
      ],
      integrated_text: '',
    },
  },
  'DP-ENV-002': {
    dp_id: 'DP-ENV-002',
    report_year: 2024,
    status: 'REVIEWING',
    subsidiary_submissions: [
      { subsidiary_id: 'A', subsidiary_name: 'A법인', status: 'ACCEPTED', methodology: undefined, yoy_change: undefined, values: { total_energy: 45000, renewable_ratio: 32 } },
      { subsidiary_id: 'B', subsidiary_name: 'B법인', status: 'ACCEPTED', methodology: undefined, yoy_change: undefined, values: { total_energy: 28000, renewable_ratio: 18 } },
      { subsidiary_id: 'C', subsidiary_name: 'C법인', status: 'ACCEPTED', methodology: undefined, yoy_change: undefined, values: { total_energy: 11200, renewable_ratio: 41 } },
    ],
    quantitative: { auto_value: 84200, final_value: null, unit: 'MWh', adjustment_reason: undefined },
    qualitative: {
      subsidiary_texts: [
        { subsidiary_id: 'A', subsidiary_name: 'A법인', text: '총 45,000 MWh / 재생에너지 32%. 태양광·풍력 PPAs 확대.' },
        { subsidiary_id: 'B', subsidiary_name: 'B법인', text: '총 28,000 MWh / 재생에너지 18%. 데이터센터 에너지 효율 개선.' },
        { subsidiary_id: 'C', subsidiary_name: 'C법인', text: '총 11,200 MWh / 재생에너지 41%. 신규 사업장 재생에너지 우선 적용.' },
      ],
      integrated_text: '',
    },
  },
  'DP-SOC-001': {
    dp_id: 'DP-SOC-001',
    report_year: 2024,
    status: 'CONFIRMED',
    subsidiary_submissions: [
      { subsidiary_id: 'A', subsidiary_name: 'A법인', status: 'ACCEPTED', methodology: undefined, yoy_change: undefined, values: { ltir: 0.42 } },
      { subsidiary_id: 'B', subsidiary_name: 'B법인', status: 'ACCEPTED', methodology: undefined, yoy_change: undefined, values: { ltir: 0.61 } },
      { subsidiary_id: 'C', subsidiary_name: 'C법인', status: 'SUBMITTED', methodology: undefined, yoy_change: undefined, values: { ltir: null } },
    ],
    quantitative: { auto_value: 0.51, final_value: 0.51, unit: '', adjustment_reason: undefined },
    qualitative: {
      subsidiary_texts: [
        { subsidiary_id: 'A', subsidiary_name: 'A법인', text: 'LTIR 0.42 달성. KOSHA-MS 인증 유지, 전 사업장 안전점검 정례화.' },
        { subsidiary_id: 'B', subsidiary_name: 'B법인', text: 'LTIR 0.61. 협력업체 안전관리 강화 프로그램 운영 중.' },
      ],
      integrated_text: '그룹 평균 LTIR 0.51, 재해율 0.21%로 전년 대비 개선되었습니다. A·B법인 KOSHA-MS 인증 유지 중이며, 협력업체 안전관리 강화를 지속 추진하고 있습니다.',
    },
  },
  'DP-SOC-002': {
    dp_id: 'DP-SOC-002',
    report_year: 2024,
    status: 'AGGREGATING',
    subsidiary_submissions: [
      { subsidiary_id: 'A', subsidiary_name: 'A법인', status: 'DRAFT', methodology: undefined, yoy_change: undefined, values: {} },
      { subsidiary_id: 'B', subsidiary_name: 'B법인', status: 'ACCEPTED', methodology: undefined, yoy_change: undefined, values: {} },
      { subsidiary_id: 'C', subsidiary_name: 'C법인', status: 'DRAFT', methodology: undefined, yoy_change: undefined, values: {} },
    ],
    quantitative: { auto_value: null, final_value: null, unit: null, adjustment_reason: undefined },
    qualitative: {
      subsidiary_texts: [
        { subsidiary_id: 'B', subsidiary_name: 'B법인', text: '실사 대상 76개사. 고위험 11개사 식별, 현장 실사 2개사 완료, 시정조치 6건 이행.' },
      ],
      integrated_text: '',
    },
  },
};

export const TOC_ITEMS: TocGroup[] = [
  { group: '개요', items: [{ label: 'CEO 메시지', dot: 'done' }, { label: '회사 개요', dot: 'done' }] },
  {
    group: '환경 (E)',
    items: [
      { label: '기후변화 대응', dot: 'wip' },
      { label: '온실가스 배출', dot: 'done', sub: true, linkedMerge: 'm1' },
      { label: '에너지 전환', dot: 'wip', sub: true, linkedMerge: 'm2' },
      { label: '탄소중립 로드맵', dot: 'none', sub: true },
      { label: '환경경영', dot: 'none' },
    ],
  },
  {
    group: '사회 (S)',
    items: [
      { label: '인권·노동', dot: 'none' },
      { label: '안전보건', dot: 'none', linkedMerge: 'm3' },
      { label: '공급망 관리', dot: 'none', linkedMerge: 'm4' },
    ],
  },
  {
    group: '지배구조 (G)',
    items: [
      { label: '이사회', dot: 'none' },
      { label: '윤리경영', dot: 'none' },
    ],
  },
  { group: '부록', items: [{ label: 'GRI 지표 대조표', dot: 'none' }, { label: '제3자 검증', dot: 'none' }] },
];

/** 보고서 생성 탭 — 생성·다운로드 이력 (표시용) */
export type GenerateDownloadRow = {
  std: 'ISSB' | 'GRI' | 'ESRS' | '통합';
  format: string;
  user: string;
  date: string;
};

export const GENERATE_DOWNLOAD_LOG: GenerateDownloadRow[] = [
  { std: '통합', format: 'PowerPoint', user: '김지주', date: '2025-07-05 16:40' },
  { std: 'GRI', format: 'Excel', user: '연시은', date: '2025-07-08 14:22' },
  { std: 'ISSB', format: 'PowerPoint', user: '박철수', date: '2025-07-07 09:15' },
];

export const VIZ_RECOMMENDATIONS: Record<string, VizItem[]> = {
  '온실가스 배출': [
    { id: 'v1', type: 'bar', label: 'Scope별 연도 추이', desc: 'Scope 1·2 연도별 막대 그래프 (3개년 비교)', icon: 'bar', data: [[2021, 21800, 14200], [2022, 22100, 14800], [2023, 20660, 13610]], cols: ['연도', 'Scope 1', 'Scope 2'], urgent: true },
    { id: 'v2', type: 'bar_grouped', label: '법인별 Scope 1 비교', desc: 'A·B·C법인 Scope 1 그룹 막대 차트', icon: 'bar', data: [['A법인', 12450], ['B법인', 8210], ['C법인', 0]], cols: ['법인', 'Scope 1 (tCO₂e)'] },
    { id: 'v3', type: 'donut', label: 'Scope 구성 비율', desc: 'Scope 1·2 비중 도넛 차트', icon: 'pie', data: [['Scope 1', 60], ['Scope 2', 40]], cols: ['항목', '비율(%)'] },
    { id: 'v4', type: 'table', label: 'GHG 배출 요약 테이블', desc: '법인별 Scope 1·2 정량 수치 표', icon: 'table', data: [['A법인', '12,450', '8,210'], ['B법인', '8,210', '5,400'], ['그룹 합계', '20,660', '13,610']], cols: ['법인', 'Scope 1 (tCO₂e)', 'Scope 2 (tCO₂e)'] },
    { id: 'v5', type: 'infographic', label: '탄소 감축 로드맵', desc: '연도별 감축 목표 인포그래픽 (2025→2030→2050)', icon: 'infographic', infographicLayout: 'roadmap', infographicData: { milestones: [{ year: 2025, label: 'RE100 30%' }, { year: 2030, label: '50% 감축' }, { year: 2050, label: 'Net Zero' }] } },
  ],
  '에너지 전환': [
    { id: 'v6', type: 'stacked_bar', label: '에너지원별 구성 추이', desc: '화석·재생 에너지 적층 막대 (3개년)', icon: 'bar', data: [[2021, 36000, 11200], [2022, 34000, 13200], [2023, 30600, 14400]], cols: ['연도', '화석연료(MWh)', '재생에너지(MWh)'], urgent: true },
    { id: 'v7', type: 'donut', label: '재생에너지 비중', desc: '재생/화석 비율 도넛 차트', icon: 'pie', data: [['재생에너지', 32], ['화석연료', 68]], cols: ['구분', '비율(%)'] },
    { id: 'v8', type: 'line', label: '재생에너지 비중 추이', desc: '연도별 재생에너지 비중(%) 선 그래프', icon: 'line', data: [[2020, 18], [2021, 22], [2022, 24], [2023, 32]], cols: ['연도', '재생에너지 비중(%)'] },
    { id: 'v9a', type: 'infographic', label: '재생에너지 목표 게이지', desc: '목표 대비 재생에너지 비중 진행률', icon: 'infographic', infographicLayout: 'gauge', infographicData: { value: 32, max: 50, unit: '%', label: '재생에너지 비중' } },
  ],
  '안전보건': [
    { id: 'v10', type: 'line', label: 'LTIR 추이', desc: '그룹 평균 LTIR 연도별 선 그래프', icon: 'line', data: [[2020, 0.72], [2021, 0.65], [2022, 0.58], [2023, 0.51]], cols: ['연도', 'LTIR'], urgent: true },
    { id: 'v11', type: 'bar', label: '법인별 LTIR 비교', desc: 'A·B법인 LTIR 막대 차트', icon: 'bar', data: [['A법인', 0.42], ['B법인', 0.61], ['그룹 평균', 0.51]], cols: ['법인', 'LTIR'] },
    { id: 'v13', type: 'infographic', label: '안전 성과 인포그래픽', desc: '주요 안전 지표를 아이콘+수치로 표현', icon: 'infographic', infographicLayout: 'kpi-cards', infographicData: { cards: [{ icon: 'ltir', value: '0.51', label: 'LTIR' }, { icon: 'safety', value: '0건', label: '사망사고' }, { icon: 'edu', value: '97%', label: '안전교육 이수' }] } },
  ],
  '공급망 관리': [
    { id: 'v14', type: 'infographic', label: '공급망 실사 프로세스', desc: '단계별 실사 절차 흐름 인포그래픽', icon: 'infographic', urgent: true, infographicLayout: 'process', infographicData: { steps: ['자가진단 설문', '문서 검토', '현장 실사', '개선계획 수립'] } },
    { id: 'v15', type: 'donut', label: '고위험 업체 비율', desc: '전체 중 고위험 업체 비율 도넛 차트', icon: 'pie', data: [['고위험', 11], ['일반', 117]], cols: ['구분', '개사'] },
  ],
  '이사회': [
    { id: 'v16', type: 'infographic', label: '여성 비율 피라미드', desc: '관리직·실무자·전체 여성 비율 비교', icon: 'infographic', infographicLayout: 'pyramid', infographicData: { levels: [{ label: '관리직', pct: 18 }, { label: '실무자', pct: 45 }, { label: '전체', pct: 100 }] } },
  ],
};

/**
 * Environmental 차트/테이블 데이터
 * REFACTOR_CHARTS_DATA_STRATEGY: data 분리로 토큰 절약
 */

import type { EnvTablePresetId, EnvCategory } from '../types';

export const TABLE_PRESETS: Array<{ id: EnvTablePresetId; label: string; description: string }> = [
  { id: 'ghg_emissions', label: '온실가스 배출량', description: 'Scope 1·2 요약 + Scope 3 카테고리 테이블 세트' },
  { id: 'energy', label: '에너지/재생에너지', description: '에너지 사용량 + 재생에너지 사용량 테이블 세트' },
  { id: 'investment_pue', label: '투자/PUE', description: '친환경 투자내역 + PUE(평균/센터별) 테이블 세트' },
  { id: 'water', label: '용수/폐수', description: '용수 취수량/방류량 + 용수 사용량 테이블 세트' },
  { id: 'waste_air', label: '폐기물/대기', description: '폐기물 발생량 + 처리량 + 환경/에너지경영시스템 + 기후리스크 테이블 세트' },
];

export const GHG_TABLES = [
  {
    id: 's12',
    title: 'Scope 1, 2 온실가스 배출량',
    note: '시장 기반/지역 기반 및 Scope 1·2 세부 항목을 입력합니다. (모든 값은 편집 가능)',
    columns: [
      { key: 'category', label: '구분', align: 'left' as const },
      { key: 'unit', label: '단위', align: 'center' as const },
      { key: '2021', label: '2021', align: 'right' as const },
      { key: '2022', label: '2022', align: 'right' as const },
      { key: '2023', label: '2023', align: 'right' as const },
      { key: '2024', label: '2024', align: 'right' as const },
      { key: 'target', label: '목표', align: 'right' as const },
    ],
    rows: [
      { cells: { category: '(시장 기반) 온실가스 배출량', unit: 'tCO₂eq', '2021': '101,588', '2022': '122,569', '2023': '164,995', '2024': '184,807', target: '171,955' } },
      { cells: { category: '  · 직접 배출량(Scope 1)', unit: 'tCO₂eq', '2021': '3,420', '2022': '4,619', '2023': '5,517', '2024': '5,336', target: '5,885' } },
      { cells: { category: '  · 간접 배출량(Scope 2)', unit: 'tCO₂eq', '2021': '98,167', '2022': '117,961', '2023': '159,489', '2024': '179,480', target: '166,070' } },
      { cells: { category: '(지역 기반) 온실가스 배출량', unit: 'tCO₂eq', '2021': '101,588', '2022': '122,569', '2023': '164,995', '2024': '187,509', target: '171,955' } },
      { cells: { category: '  · 직접 배출량(Scope 1)', unit: 'tCO₂eq', '2021': '3,420', '2022': '4,619', '2023': '5,517', '2024': '5,336', target: '5,885' } },
      { cells: { category: '  · 간접 배출량(Scope 2)', unit: 'tCO₂eq', '2021': '98,167', '2022': '117,961', '2023': '159,489', '2024': '182,182', target: '166,070' } },
      { cells: { category: '원단위 배출', unit: 'tCO₂eq/억 원', '2021': '0.75', '2022': '0.71', '2023': '1.24', '2024': '1.34', target: '1.24' } },
    ],
  },
  {
    id: 's3',
    title: 'Scope 3 온실가스 배출량',
    note: 'Scope 3 총배출 및 주요 카테고리별 배출량을 입력합니다.',
    columns: [
      { key: 'category', label: '구분', align: 'left' as const },
      { key: 'unit', label: '단위', align: 'center' as const },
      { key: '2022', label: '2022', align: 'right' as const },
      { key: '2023', label: '2023', align: 'right' as const },
      { key: '2024', label: '2024', align: 'right' as const },
    ],
    rows: [
      { cells: { category: 'Scope 3 총배출량', unit: 'tCO₂eq', '2022': '3,154,519', '2023': '2,909,796', '2024': '2,992,478' } },
      { cells: { category: '전체', unit: 'tCO₂eq', '2022': '2,996,426', '2023': '2,663,923', '2024': '2,696,176' } },
      { cells: { category: 'Air', unit: 'tCO₂eq', '2022': '1,388,921', '2023': '1,027,207', '2024': '1,103,203' } },
      { cells: { category: 'Truck', unit: 'tCO₂eq', '2022': '1,023,681', '2023': '1,034,641', '2024': '975,033' } },
      { cells: { category: 'Ocean', unit: 'tCO₂eq', '2022': '575,023', '2023': '575,448', '2024': '609,015' } },
      { cells: { category: 'Train', unit: 'tCO₂eq', '2022': '8,055', '2023': '8,974', '2024': '3,373' } },
      { cells: { category: 'Warehouse', unit: 'tCO₂eq', '2022': '746', '2023': '17,653', '2024': '5,552' } },
    ],
  },
];

export const WATER_TABLES = [
  {
    id: 'intake_discharge',
    title: '용수 취수량 및 방류량',
    note: '¹⁾ 지하수는 상암 데이터센터에서 발생하는 유출 지하수로 취수량과 방류량이 동일함.\n※ 유출 지하수 활용 시 배출 비용 및 정부기관 허가 등의 제약으로 당사는 유출 지하수를 미활용하고 있음.\n²⁾ 상수도 취수 총량 기준으로 하수처리 비용 납부 중',
    columns: [
      { key: 'category', label: '구분', align: 'left' as const },
      { key: 'unit', label: '단위', align: 'center' as const },
      { key: '2022', label: '2022', align: 'right' as const },
      { key: '2023', label: '2023', align: 'right' as const },
      { key: '2024', label: '2024', align: 'right' as const },
      { key: 'target', label: '목표', align: 'right' as const },
    ],
    rows: [
      { cells: { category: '취수량', unit: '', '2022': '', '2023': '', '2024': '', target: '' } },
      { cells: { category: '  상수도', unit: '톤', '2022': '469,111', '2023': '532,649', '2024': '605,579', target: '688,643' } },
      { cells: { category: '  지하수¹⁾', unit: '톤', '2022': '164,997', '2023': '165,008', '2024': '158,585', target: '163,643' } },
      { cells: { category: '방류량', unit: '', '2022': '', '2023': '', '2024': '', target: '' } },
      { cells: { category: '  하수도²⁾', unit: '톤', '2022': '469,111', '2023': '532,649', '2024': '605,579', target: '688,643' } },
      { cells: { category: '  지하수', unit: '톤', '2022': '164,997', '2023': '165,008', '2024': '158,585', target: '163,643' } },
    ],
  },
  {
    id: 'water_usage',
    title: '용수 사용량¹⁾',
    note: '¹⁾ 산업용수와 생활용수 합산 총량. 전량 상수도 사용',
    columns: [
      { key: 'category', label: '구분', align: 'left' as const },
      { key: 'unit', label: '단위', align: 'center' as const },
      { key: '2022', label: '2022', align: 'right' as const },
      { key: '2023', label: '2023', align: 'right' as const },
      { key: '2024', label: '2024', align: 'right' as const },
    ],
    rows: [
      { cells: { category: '국내', unit: '톤', '2022': '401,701', '2023': '521,784', '2024': '579,089' } },
      { cells: { category: '  일반 사업장', unit: '톤', '2022': '153,228', '2023': '188,972', '2024': '176,559' } },
      { cells: { category: '  상암 데이터센터', unit: '톤', '2022': '44,461', '2023': '57,834', '2024': '94,246' } },
      { cells: { category: '  수원 데이터센터', unit: '톤', '2022': '163,495', '2023': '192,663', '2024': '173,569' } },
      { cells: { category: '  구미 데이터센터', unit: '톤', '2022': '20,542', '2023': '24,033', '2024': '27,804' } },
      { cells: { category: '  춘천 데이터센터', unit: '톤', '2022': '15,329', '2023': '13,825', '2024': '11,029' } },
      { cells: { category: '  동탄 데이터센터', unit: '톤', '2022': '4,646', '2023': '44,457', '2024': '95,882' } },
      { cells: { category: '해외', unit: '톤', '2022': '67,410', '2023': '10,865', '2024': '26,490' } },
      { cells: { category: '합계', unit: '톤', '2022': '469,111', '2023': '532,649', '2024': '605,579' } },
    ],
  },
];

export const WASTE_AIR_TABLES = [
  {
    id: 'waste_generation',
    title: '폐기물 발생량',
    note: '※ 본사 외 자회사, 해외법인은 본사 비율(인당 발생량)으로 산정함.\n1) 폐기물 관리 및 산정체계 고도화에 따라 2024년 폐기물 발생량 증가\n2) 폐기물 처리방법 모르는 경우, 보수적 방법을 적용하여 배출계수가 큰 소각으로 산정함.',
    columns: [
      { key: 'category', label: '구분', align: 'left' as const },
      { key: 'unit', label: '단위', align: 'center' as const },
      { key: '2022', label: '2022', align: 'right' as const },
      { key: '2023', label: '2023', align: 'right' as const },
      { key: '2024', label: '2024', align: 'right' as const },
    ],
    rows: [
      { cells: { category: '폐기물 발생량 합계', unit: '톤', '2022': '2,183.8', '2023': '2,892.9', '2024': '4,702.0' } },
      { cells: { category: '폐기물 사용/재활용/판매량', unit: '톤', '2022': '897.2', '2023': '1,345.4', '2024': '2,505.3' } },
      { cells: { category: '폐기물 처리량', unit: '', '2022': '', '2023': '', '2024': '' } },
      { cells: { category: '  전체', unit: '톤', '2022': '1,286.6', '2023': '1,547.5', '2024': '2,196.7' } },
      { cells: { category: '  매립된 폐기물', unit: '톤', '2022': '1,019.4', '2023': '1,278.8', '2024': '491.8' } },
      { cells: { category: '  에너지를 회수한 소각된 폐기물', unit: '톤', '2022': '3.8', '2023': '16.7', '2024': '1,704.9' } },
      { cells: { category: '  에너지 회수 없이 소각된 폐기물', unit: '톤', '2022': '11.4', '2023': '0.0', '2024': '-' } },
      { cells: { category: '  기타 처리 방법으로 처리된 폐기물', unit: '톤', '2022': '252.0', '2023': '252.0', '2024': '-' } },
      { cells: { category: '  처리 방법을 알 수 없는 폐기물', unit: '톤', '2022': '0.0', '2023': '0.0', '2024': '-' } },
    ],
  },
  {
    id: 'hq_waste_by_type',
    title: '본사 폐기물 유형별 처리량',
    columns: [
      { key: 'category', label: '구분', align: 'left' as const },
      { key: 'method', label: '처리 방법', align: 'left' as const },
      { key: 'unit', label: '단위', align: 'center' as const },
      { key: '2022', label: '2022', align: 'right' as const },
      { key: '2023', label: '2023', align: 'right' as const },
      { key: '2024', label: '2024', align: 'right' as const },
    ],
    rows: [
      { cells: { category: '폐기물 처리량 합계', method: '', unit: '톤', '2022': '496.7', '2023': '1,205.8', '2024': '2,083.9' } },
      { cells: { category: '일반 폐기물', method: '', unit: '', '2022': '', '2023': '', '2024': '' } },
      { cells: { category: '  일반 폐기물', method: '매립', unit: '톤', '2022': '371.2', '2023': '629.6', '2024': '-' } },
      { cells: { category: '  일반 폐기물', method: '소각', unit: '톤', '2022': '11.4', '2023': '12.7', '2024': '572.9' } },
      { cells: { category: '  일반 폐기물', method: '재활용', unit: '톤', '2022': '95.3', '2023': '543.2', '2024': '1,471.4' } },
      { cells: { category: '지정 폐기물', method: '', unit: '', '2022': '', '2023': '', '2024': '' } },
      { cells: { category: '  지정 폐기물', method: '매립', unit: '톤', '2022': '-', '2023': '1.0', '2024': '-' } },
      { cells: { category: '  지정 폐기물', method: '소각', unit: '톤', '2022': '0.7', '2023': '0.8', '2024': '2.1' } },
      { cells: { category: '  지정 폐기물', method: '재활용', unit: '톤', '2022': '18.2', '2023': '18.5', '2024': '37.4' } },
    ],
  },
  {
    id: 'iso_systems',
    title: '환경·에너지경영시스템(ISO 14001 & ISO 50001)',
    columns: [
      { key: 'category', label: '구분', align: 'left' as const },
      { key: 'unit', label: '단위', align: 'center' as const },
      { key: '2024', label: '2024', align: 'right' as const },
    ],
    rows: [
      { cells: { category: '합계', unit: '%', '2024': '100' } },
      { cells: { category: '국제기준에 준한 검증 커버리지', unit: '%', '2024': '100' } },
      { cells: { category: '외부 전문 기관으로부터 받은 제3자 검증 커버리지', unit: '%', '2024': '100' } },
      { cells: { category: '본사에서 파견된 내부 전문가에 의한 검증 커버리지', unit: '%', '2024': '100' } },
    ],
  },
  {
    id: 'physical_climate_risk',
    title: '물리적 기후 리스크',
    columns: [
      { key: 'category', label: '구분', align: 'left' as const },
      { key: 'unit', label: '단위', align: 'center' as const },
      { key: '2024', label: '2024', align: 'right' as const },
    ],
    rows: [
      { cells: { category: '리스크 평가 및 계획에 포함된 기존 사업장의 수익 비율', unit: '%', '2024': '100' } },
      { cells: { category: '리스크 평가 및 계획에 포함된 새로운 사업장의 수익 비율', unit: '%', '2024': '100' } },
    ],
  },
];

export const INVEST_PUE_TABLES = [
  {
    id: 'invest',
    title: '친환경 투자내역',
    columns: [
      { key: 'division', label: '구분', align: 'left' as const },
      { key: 'item', label: '품목', align: 'left' as const },
      { key: 'unit', label: '단위', align: 'center' as const },
      { key: '2024', label: '2024', align: 'right' as const },
    ],
    rows: [
      { cells: { division: '수원 데이터센터', item: 'UPS 교체', unit: '억 원', '2024': '69' } },
      { cells: { division: '동탄 데이터센터', item: '태양광 발전설비 증설', unit: '억 원', '2024': '3.2' } },
      { cells: { division: '본사', item: '차량(하이브리드) 전환', unit: '억 원', '2024': '0.86' } },
      { cells: { division: '데이터센터', item: '전기차 충전시설', unit: '대', '2024': '18' } },
    ],
  },
  {
    id: 'pue_avg',
    title: '데이터센터 평균 PUE',
    columns: [
      { key: 'metric', label: '구분', align: 'left' as const },
      { key: 'unit', label: '단위', align: 'center' as const },
      { key: '2022', label: '2022', align: 'right' as const },
      { key: '2023', label: '2023', align: 'right' as const },
      { key: '2024', label: '2024', align: 'right' as const },
      { key: 'target', label: '목표', align: 'right' as const },
    ],
    rows: [
      { cells: { metric: '평균 PUE', unit: '-', '2022': '1.47', '2023': '1.41', '2024': '1.36', target: '1.45' } },
      { cells: { metric: '데이터 범위', unit: '%', '2022': '100', '2023': '100', '2024': '100', target: '-' } },
    ],
  },
  {
    id: 'pue_dc',
    title: '데이터센터별 PUE',
    columns: [
      { key: 'division', label: '구분', align: 'left' as const },
      { key: 'unit', label: '단위', align: 'center' as const },
      { key: '2024', label: '2024', align: 'right' as const },
    ],
    rows: [
      { cells: { division: '상암 데이터센터', unit: '-', '2024': '1.37' } },
      { cells: { division: '수원 데이터센터', unit: '-', '2024': '1.45' } },
      { cells: { division: '구미 데이터센터', unit: '-', '2024': '2.00' } },
      { cells: { division: '춘천 데이터센터', unit: '-', '2024': '1.30' } },
      { cells: { division: '동탄 데이터센터', unit: '-', '2024': '1.20' } },
    ],
  },
];

export const ENERGY_TABLES = [
  {
    id: 'energy_usage',
    title: '에너지사용량',
    note:
      '※ 국가별 온실가스 관리지침, IPCC가이드라인, ISO 14064 기준을 적용하여 산정함.\n' +
      '1) 총에너지 사용량은 조직 내 연료, 전기, 열, 난방, 스팀, 재생에너지 사용량을 포함함.\n' +
      '2) 2022~2023년도 사업장 관리와 의무 증제로 인한 데이터 변경\n' +
      '3) 사업장 단위 절사 후 합산 기준 적용에 따라 연료별 합산 값과 차이가 발생할 수 있음.\n' +
      '4) 재생에너지 사용량 불포함',
    columns: [
      { key: 'category', label: '구분', align: 'left' as const },
      { key: 'unit', label: '단위', align: 'center' as const },
      { key: '2022', label: '2022', align: 'right' as const },
      { key: '2023', label: '2023', align: 'right' as const },
      { key: '2024', label: '2024', align: 'right' as const },
      { key: 'target', label: '목표', align: 'right' as const },
    ],
    rows: [
      { cells: { category: '총에너지 사용량¹,²)', unit: 'TJ', '2022': '2,526', '2023': '3,225', '2024': '3,782', target: '3,497' } },
      { cells: { category: '  LNG', unit: 'TJ', '2022': '62', '2023': '76', '2024': '66', target: '' } },
      { cells: { category: '  경유', unit: 'TJ', '2022': '5', '2023': '7', '2024': '7', target: '' } },
      { cells: { category: '  휘발유', unit: 'TJ', '2022': '16', '2023': '17', '2024': '22', target: '' } },
      { cells: { category: '  구매전력', unit: 'TJ', '2022': '2,421', '2023': '3,100', '2024': '3,664', target: '' } },
      { cells: { category: '  구매스팀', unit: 'TJ', '2022': '22', '2023': '25', '2024': '22', target: '' } },
      { cells: { category: '에너지 사용량(연결)', unit: '', '2022': '', '2023': '', '2024': '', target: '' } },
      { cells: { category: '  비재생 에너지 사용량³)', unit: 'TJ', '2022': '2,515', '2023': '3,204', '2024': '3,720', target: '' } },
      { cells: { category: '    LNG', unit: 'TJ', '2022': '62', '2023': '76', '2024': '66', target: '' } },
      { cells: { category: '    경유', unit: 'TJ', '2022': '5', '2023': '7', '2024': '7', target: '' } },
      { cells: { category: '    휘발유', unit: 'TJ', '2022': '16', '2023': '17', '2024': '22', target: '' } },
      { cells: { category: '    구매전력', unit: 'TJ', '2022': '2,419', '2023': '3,092', '2024': '3,614', target: '' } },
      { cells: { category: '    구매스팀', unit: 'TJ', '2022': '22', '2023': '25', '2024': '22', target: '' } },
      { cells: { category: '  재생에너지 사용량', unit: 'TJ', '2022': '2', '2023': '9', '2024': '51', target: '-' } },
      { cells: { category: '    생산량', unit: '', '2022': '', '2023': '', '2024': '', target: '' } },
      { cells: { category: '      태양광(자가발전)', unit: 'TJ', '2022': '2', '2023': '7', '2024': '9', target: '' } },
      { cells: { category: '      태양열급탕', unit: 'TJ', '2022': '0.3', '2023': '0.3', '2024': '0.1', target: '' } },
      { cells: { category: '      지열', unit: 'TJ', '2022': '-', '2023': '2', '2024': '2', target: '' } },
      { cells: { category: '    구매량', unit: '', '2022': '', '2023': '', '2024': '', target: '' } },
      { cells: { category: '      기타(녹색 프리미엄)', unit: 'TJ', '2022': '-', '2023': '-', '2024': '20', target: '' } },
      { cells: { category: '      기타(REC)', unit: 'TJ', '2022': '-', '2023': '-', '2024': '20', target: '' } },
      { cells: { category: '재생에너지 비중', unit: '%', '2022': '0.10', '2023': '0.27', '2024': '1.34', target: '' } },
      { cells: { category: '에너지 집약도', unit: 'TJ/억 원', '2022': '0.015', '2023': '0.024', '2024': '0.027', target: '' } },
      { cells: { category: '사업장별 사용량⁴)', unit: '', '2022': '', '2023': '', '2024': '', target: '' } },
      { cells: { category: '  본사(캠퍼스 포함)', unit: 'TJ', '2022': '283', '2023': '314', '2024': '286', target: '' } },
      { cells: { category: '  상암 데이터센터', unit: 'TJ', '2022': '615', '2023': '735', '2024': '857', target: '' } },
      { cells: { category: '  수원 데이터센터', unit: 'TJ', '2022': '1,052', '2023': '1,214', '2024': '1,159', target: '' } },
      { cells: { category: '  구미 데이터센터', unit: 'TJ', '2022': '170', '2023': '141', '2024': '170', target: '' } },
      { cells: { category: '  춘천 데이터센터', unit: 'TJ', '2022': '284', '2023': '331', '2024': '345', target: '' } },
      { cells: { category: '  동탄 데이터센터', unit: 'TJ', '2022': '50', '2023': '375', '2024': '805', target: '' } },
      { cells: { category: '  기타 사업장', unit: 'TJ', '2022': '61', '2023': '94', '2024': '98', target: '' } },
    ],
  },
  {
    id: 'dc_renewable',
    title: '본사 데이터센터 재생에너지 사용량',
    note: '1) 2024년 4월~10월 설비 누수보수작업으로 미가동',
    columns: [
      { key: 'division', label: '구분', align: 'left' as const },
      { key: 'item', label: '항목', align: 'left' as const },
      { key: 'unit', label: '단위', align: 'center' as const },
      { key: '2022', label: '2022', align: 'right' as const },
      { key: '2023', label: '2023', align: 'right' as const },
      { key: '2024', label: '2024', align: 'right' as const },
      { key: 'target', label: '목표', align: 'right' as const },
    ],
    rows: [
      { cells: { division: '수원 데이터센터', item: '태양열 급탕', unit: 'MWh', '2022': '85.84', '2023': '79.89', '2024': '14.53¹)', target: '' } },
      { cells: { division: '수원 데이터센터', item: '태양광 발전', unit: 'MWh', '2022': '19.11', '2023': '62.96', '2024': '71.38', target: '' } },
      { cells: { division: '상암 데이터센터', item: '태양광 발전', unit: 'MWh', '2022': '56.73', '2023': '55.34', '2024': '55.92', target: '-' } },
      { cells: { division: '상암 데이터센터', item: '지열', unit: 'MWh', '2022': '-', '2023': '435.62', '2024': '474.82', target: '-' } },
      { cells: { division: '춘천 데이터센터', item: '태양광 발전', unit: 'MWh', '2022': '144.63', '2023': '196.36', '2024': '230.71', target: '' } },
      { cells: { division: '동탄 데이터센터', item: '태양광 발전', unit: 'MWh', '2022': '-', '2023': '385.08', '2024': '555.77', target: '' } },
      { cells: { division: '합계', item: '', unit: 'MWh', '2022': '306.31', '2023': '1215.25', '2024': '1,403.13', target: '1,267' } },
    ],
  },
];

export const dataSources: Array<{ value: string; label: string; unit?: string }> = [
  { value: 'ghg_s12_total', label: 'Scope 1 + Scope 2 (총 직/간접 온실가스 배출량)', unit: 'tCO₂eq' },
  { value: 'ghg_s1_total', label: 'Scope 1 (총 직접 배출량)', unit: 'tCO₂eq' },
  { value: 'ghg_s2_total', label: 'Scope 2 (총 간접 배출량)', unit: 'tCO₂eq' },
  { value: 'ghg_s3_total_k', label: 'Scope 3 (총 기타간접 배출량)', unit: '천 tCO₂eq' },
  { value: 'energy_total', label: '총 에너지 소비량', unit: 'TJ' },
  { value: 'renewable_energy', label: '재생에너지 사용 현황', unit: 'TJ, %' },
  { value: 'carbon', label: '탄소 배출량 데이터' },
  { value: 'energy', label: '에너지 사용량 데이터' },
  { value: 'waste_total', label: '총 폐기물 발생량', unit: '톤' },
  { value: 'chemical_emission', label: '화학물질 배출량', unit: '톤' },
  { value: 'waste_status_treatment', label: '폐기물 현황 (처리 유형별)', unit: '톤, %' },
  { value: 'waste_status_type', label: '폐기물 현황 (종류별)', unit: '톤' },
  { value: 'nox', label: 'NOx 배출량', unit: '톤' },
  { value: 'sox', label: 'SOx 배출량', unit: '톤' },
  { value: 'tsp', label: '먼지 배출량 (TSP)', unit: '톤' },
  { value: 'voc', label: 'VOC 배출량', unit: '톤' },
  { value: 'hazardous_chemicals', label: '유해화학물질 배출량', unit: '톤' },
  { value: 'water_use', label: '용수 사용량', unit: 't (톤)' },
  { value: 'wastewater_treatment', label: '폐수 처리량', unit: 't (톤)' },
  { value: 'water_intake', label: '용수 취수량', unit: 't (톤)' },
  { value: 'water_recycle', label: '용수 재활용량', unit: 't (톤)' },
  { value: 'toc', label: 'TOC 배출량', unit: 't (톤)' },
  { value: 'bod', label: 'BOD 배출량', unit: 't (톤)' },
  { value: 'tn', label: 'TN 배출량', unit: 't (톤)' },
];

export const dataSourceLegendHints: Record<string, string[]> = {
  waste_status_treatment: ['매립', '소각', '재활용', '기타', '폐기물 재활용률(%)'],
  waste_status_type: ['일반폐기물', '지정폐기물', '건설폐기물'],
  renewable_energy: ['재생에너지 사용량(TJ)', '비재생에너지 사용량(TJ)', '재생에너지 비중(%)'],
};

export const categoryTabs: Array<{
  id: EnvCategory;
  label: string;
  sources: readonly string[];
}> = [
  { id: 'ghg_energy', label: '온실가스 / 에너지', sources: ['ghg_s12_total', 'ghg_s1_total', 'ghg_s2_total', 'ghg_s3_total_k', 'energy_total', 'renewable_energy', 'carbon', 'energy'] },
  { id: 'waste_air', label: '폐기물 / 대기', sources: ['waste_total', 'chemical_emission', 'waste_status_treatment', 'waste_status_type', 'nox', 'sox', 'tsp', 'voc', 'hazardous_chemicals'] },
  { id: 'water_wastewater', label: '용수 / 폐수', sources: ['water_use', 'wastewater_treatment', 'water_intake', 'water_recycle', 'toc', 'bod', 'tn'] },
];

export const ENV_COLORS = [
  '#2F5D3A', '#4C7A4F', '#7FA66B', '#B9C8A5', '#D8E2C7', '#F2EBD7',
];

export const ENV_DATA_SOURCE_SET = new Set(dataSources.map((s) => s.value));

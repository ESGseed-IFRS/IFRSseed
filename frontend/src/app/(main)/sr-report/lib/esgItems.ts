/** 보고서 생성(HoldingGenerate) 미리보기용 mock — 기존 @/features/esg-sr-report 대체 */

export type EsgItemRow = {
  no: number;
  name: string;
  issb: string;
  gri: string;
  esrs: string;
};

const NDASH = '\u2013';

export const ESG_ITEMS: EsgItemRow[] = [
  { no: 1, name: '온실가스 배출 (Scope 1·2·3)', issb: 'S2', gri: '305-1', esrs: 'E1' },
  { no: 2, name: '에너지 소비 및 효율', issb: 'S2', gri: '302-1', esrs: 'E1' },
  { no: 3, name: '폐기물 발생 및 처리', issb: NDASH, gri: '306-3', esrs: 'E5' },
  { no: 4, name: '용수 취수·방류', issb: NDASH, gri: '303-3', esrs: 'E3' },
  { no: 5, name: '산업안전·보건 지표', issb: NDASH, gri: '403-9', esrs: 'S1-1' },
  { no: 6, name: '다양성·평등 (이사회·임직원)', issb: NDASH, gri: '405-1', esrs: 'S1-9' },
  { no: 7, name: '공급망 인권·실사', issb: NDASH, gri: '414-1', esrs: 'S2-1' },
  { no: 8, name: '이사회 구성·독립성', issb: 'G1', gri: '2-9', esrs: 'G1-1' },
  { no: 9, name: '윤리·반부패', issb: NDASH, gri: '205-2', esrs: 'G1-5' },
  { no: 10, name: '기후 리스크 시나리오 (TCFD)', issb: 'S2', gri: NDASH, esrs: 'E1' },
  { no: 11, name: '생물다양성 영향', issb: NDASH, gri: '304-2', esrs: NDASH },
  { no: 12, name: '지역사회 투자·기부', issb: NDASH, gri: '413-1', esrs: 'S3-4' },
  { no: 13, name: '고객 건강·안전', issb: NDASH, gri: '416-1', esrs: NDASH },
  { no: 14, name: '개인정보·데이터 보안', issb: NDASH, gri: NDASH, esrs: 'S4-1' },
  { no: 15, name: '세금·국가별 기여', issb: NDASH, gri: '207-4', esrs: NDASH },
  { no: 16, name: '정책 관여·로비', issb: NDASH, gri: '415-1', esrs: NDASH },
  { no: 17, name: '경영진 성과연동 ESG', issb: 'G1', gri: '2-19', esrs: 'G1-3' },
  { no: 18, name: '핵심 지속가능성 과제 도출', issb: 'S1', gri: '3-2', esrs: 'SBM-3' },
  { no: 19, name: '이해관계자 소통', issb: 'S1', gri: '2-29', esrs: 'SBM-2' },
  { no: 20, name: '중대성 평가 프로세스', issb: 'S1', gri: '3-1', esrs: 'SBM-3' },
];

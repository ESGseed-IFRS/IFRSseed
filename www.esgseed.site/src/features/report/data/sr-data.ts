/**
 * SR 보고서 목차 및 페이지별 공시 기준 매핑 데이터
 * 토큰 절약을 위해 별도 파일로 분리
 */

import type { TableOfContentsItem, PageStandardMapping } from '../types';

// SR 보고서 작성 탭 목차 구조
export const srTableOfContents: TableOfContentsItem[] = [
  // Introduction (04)
  { id: 'intro', title: 'Introduction', order: 1, pageNumber: 4, level: 0 },
  { id: 'intro-1', title: 'ESG 위원회 위원장 인사말', order: 2, pageNumber: 5, parentId: 'intro', level: 1 },
  { id: 'intro-2', title: 'CEO 인사말', order: 3, pageNumber: 6, parentId: 'intro', level: 1 },
  { id: 'intro-3', title: '회사 소개', order: 4, pageNumber: 7, parentId: 'intro', level: 1 },
  
  // Sustainability Management (17)
  { id: 'sustainability', title: 'Sustainability Management', order: 5, pageNumber: 17, level: 0 },
  { id: 'sustainability-1', title: '지속가능경영 거버넌스', order: 6, pageNumber: 18, parentId: 'sustainability', level: 1 },
  { id: 'sustainability-2', title: '이중 중대성 평가', order: 7, pageNumber: 19, parentId: 'sustainability', level: 1 },
  { id: 'sustainability-3', title: '지속가능경영 전략', order: 8, pageNumber: 22, parentId: 'sustainability', level: 1 },
  { id: 'sustainability-4', title: '지속가능경영 주요 성과', order: 9, pageNumber: 28, parentId: 'sustainability', level: 1 },
  
  // ESG Performance (31)
  { id: 'esg-performance', title: 'ESG Performance', order: 10, pageNumber: 31, level: 0 },
  
  // Environmental (32)
  { id: 'environmental', title: 'Environmental', order: 11, pageNumber: 32, parentId: 'esg-performance', level: 1 },
  { id: 'env-1', title: '환경경영', order: 12, pageNumber: 33, parentId: 'environmental', level: 2 },
  { id: 'env-2', title: '온실가스 관리', order: 13, pageNumber: 36, parentId: 'environmental', level: 2 },
  { id: 'env-3', title: '기후변화 대응', order: 14, pageNumber: 41, parentId: 'environmental', level: 2 },
  { id: 'env-4', title: '수자원 관리', order: 15, pageNumber: 55, parentId: 'environmental', level: 2 },
  { id: 'env-5', title: '생물다양성 관리', order: 16, pageNumber: 57, parentId: 'environmental', level: 2 },
  { id: 'env-6', title: '폐기물 관리', order: 17, pageNumber: 61, parentId: 'environmental', level: 2 },
  
  // Social (63)
  { id: 'social', title: 'Social', order: 18, pageNumber: 63, parentId: 'esg-performance', level: 1 },
  { id: 'social-1', title: '인권경영', order: 19, pageNumber: 64, parentId: 'social', level: 2 },
  { id: 'social-2', title: 'DEI(다양성, 형평성, 포용성)', order: 20, pageNumber: 67, parentId: 'social', level: 2 },
  { id: 'social-3', title: '임직원', order: 21, pageNumber: 70, parentId: 'social', level: 2 },
  { id: 'social-4', title: '안전보건', order: 22, pageNumber: 79, parentId: 'social', level: 2 },
  { id: 'social-5', title: '협력회사', order: 23, pageNumber: 85, parentId: 'social', level: 2 },
  { id: 'social-6', title: '지역사회', order: 24, pageNumber: 92, parentId: 'social', level: 2 },
  { id: 'social-7', title: '고객', order: 25, pageNumber: 95, parentId: 'social', level: 2 },
  { id: 'social-8', title: '디지털 책임', order: 26, pageNumber: 99, parentId: 'social', level: 2 },
  
  // Governance (104)
  { id: 'governance', title: 'Governance', order: 27, pageNumber: 104, parentId: 'esg-performance', level: 1 },
  { id: 'gov-1', title: '기업 지배구조', order: 28, pageNumber: 105, parentId: 'governance', level: 2 },
  { id: 'gov-2', title: '리스크 관리', order: 29, pageNumber: 112, parentId: 'governance', level: 2 },
  { id: 'gov-3', title: '윤리경영', order: 30, pageNumber: 114, parentId: 'governance', level: 2 },
  { id: 'gov-4', title: '준법경영', order: 31, pageNumber: 116, parentId: 'governance', level: 2 },
  { id: 'gov-5', title: '정보보호', order: 32, pageNumber: 120, parentId: 'governance', level: 2 },
  
  // Appendix (128)
  { id: 'appendix', title: 'Appendix', order: 33, pageNumber: 128, level: 0 },
  { id: 'appendix-1', title: 'ESG Data', order: 34, pageNumber: 129, parentId: 'appendix', level: 1 },
  { id: 'appendix-2', title: '가입 협회 리스트', order: 35, pageNumber: 143, parentId: 'appendix', level: 1 },
  { id: 'appendix-3', title: 'ESG Policy Book', order: 36, pageNumber: 144, parentId: 'appendix', level: 1 },
  { id: 'appendix-4', title: 'ESG 가치 창출 산정 프로세스', order: 37, pageNumber: 145, parentId: 'appendix', level: 1 },
  { id: 'appendix-5', title: 'GRI Standards Index', order: 38, pageNumber: 146, parentId: 'appendix', level: 1 },
  { id: 'appendix-6', title: 'SASB Index', order: 39, pageNumber: 148, parentId: 'appendix', level: 1 },
  { id: 'appendix-7', title: 'IFRS Index', order: 40, pageNumber: 149, parentId: 'appendix', level: 1 },
  { id: 'appendix-8', title: 'ESRS Index', order: 41, pageNumber: 150, parentId: 'appendix', level: 1 },
  { id: 'appendix-9', title: '온실가스 검증의견서', order: 42, pageNumber: 154, parentId: 'appendix', level: 1 },
  { id: 'appendix-10', title: '온실가스 감축 검증의견서', order: 43, pageNumber: 155, parentId: 'appendix', level: 1 },
  { id: 'appendix-11', title: '제3자 검증의견서', order: 44, pageNumber: 156, parentId: 'appendix', level: 1 },
];

// 삼성SDS 페이지별 공시 기준 매핑 데이터
export const srPageStandardMappings: PageStandardMapping[] = [
  // 1. Introduction & Sustainability Management
  { pageNumber: 5, title: 'ESG 위원회 위원장 인사말', standards: ['GRI 2-22'] },
  { pageNumber: 6, title: 'CEO 인사말', standards: ['GRI 2-22'] },
  { pageNumber: 7, title: '회사 소개', standards: ['GRI 2-1', 'ESRS SBM-1'] },
  { pageNumber: 18, title: '지속가능경영 거버넌스', standards: ['GRI 2-12', 'GRI 2-13', 'GRI 2-14', 'IFRS S1-27', 'ESRS GOV-1', 'ESRS GOV-2'] },
  { pageNumber: 19, title: '이중 중대성 평가', standards: ['GRI 3-1', 'GRI 3-2', 'IFRS S1-44', 'ESRS IRO-1'] },
  { pageNumber: 20, title: '지속가능경영 전략', standards: ['GRI 3-2', 'IFRS S1-30', 'IFRS S1-33', 'ESRS SBM-3', 'ESRS MDR-A'] },
  { pageNumber: 22, title: '지속가능경영 전략', standards: ['IFRS S1-51', 'ESRS SBM-1', 'ESRS MDR-A', 'ESRS MDR-T'] },
  { pageNumber: 27, title: '지속가능경영 주요 성과', standards: ['GRI 2-29', 'ESRS GOV-4', 'ESRS SBM-2', 'ESRS S4-2'] },
  { pageNumber: 28, title: '지속가능경영 주요 성과', standards: ['SASB TC-SI-130a.3'] },
  { pageNumber: 29, title: '지속가능경영 주요 성과', standards: ['ESRS MDR-M', 'ESRS SBM-1'] },
  
  // 2. ESG Performance - Environmental
  { pageNumber: 33, title: '환경경영', standards: ['ESRS E1-2', 'ESRS E2-1', 'ESRS E2-2'] },
  { pageNumber: 36, title: '온실가스 관리', standards: ['GRI 3-3', 'GRI 305-1', 'GRI 305-2', 'GRI 305-5', 'IFRS S1-78', 'IFRS S2-29', 'ESRS E1-1', 'ESRS E1-3', 'ESRS E1-6'] },
  { pageNumber: 40, title: '기후변화 대응', standards: ['GRI 2-17', 'GRI 201-2', 'GRI 3-3', 'SASB TC-SI-130a.3', 'IFRS S1-27', 'IFRS S1-30', 'IFRS S1-32', 'IFRS S1-78', 'IFRS S2-6', 'IFRS S2-10', 'IFRS S2-14', 'IFRS S2-15', 'IFRS S2-16', 'IFRS S2-25', 'ESRS GOV-3', 'ESRS E1-1', 'ESRS SBM-3', 'ESRS IRO-1', 'ESRS E1-8', 'ESRS E1-9'] },
  { pageNumber: 55, title: '수자원 관리', standards: ['ESRS E2-1', 'ESRS E2-2', 'ESRS IRO-1', 'ESRS E3-1', 'ESRS E3-3', 'ESRS E3-4'] },
  { pageNumber: 57, title: '생물다양성 관리', standards: ['ESRS IRO-1', 'ESRS E4-1', 'ESRS E4-3', 'ESRS E4-5', 'ESRS SBM-3'] },
  { pageNumber: 61, title: '폐기물 관리', standards: ['ESRS E2-2', 'ESRS E5-1', 'ESRS E5-2', 'ESRS E5-5'] },
  
  // 3. ESG Performance - Social
  { pageNumber: 64, title: '인권경영', standards: ['GRI 2-24', 'GRI 2-25', 'GRI 3-3', 'GRI 406-1', 'ESRS S1-1', 'ESRS S1-3', 'ESRS S1-4', 'ESRS S1-17', 'ESRS G1-1'] },
  { pageNumber: 67, title: 'DEI', standards: ['ESRS S1-1', 'ESRS S1-12', 'ESRS G1-1'] },
  { pageNumber: 69, title: '임직원', standards: ['GRI 2-30', 'GRI 3-3', 'GRI 401-2', 'GRI 404-2', 'ESRS S1-1', 'ESRS S1-2', 'ESRS S1-3', 'ESRS S1-4', 'ESRS S1-8', 'ESRS S1-11', 'ESRS S1-13', 'ESRS G1-1'] },
  { pageNumber: 79, title: '안전보건', standards: ['GRI 3-3', 'GRI 403-1', 'GRI 403-2', 'GRI 403-3', 'GRI 403-4', 'GRI 403-5', 'GRI 403-6', 'GRI 403-7', 'ESRS S1-1', 'ESRS S1-4', 'ESRS S1-5'] },
  { pageNumber: 85, title: '협력회사', standards: ['GRI 3-3', 'GRI 308-1', 'GRI 308-2', 'GRI 414-2', 'ESRS S2-1', 'ESRS S2-2', 'ESRS S2-3', 'ESRS S2-4', 'ESRS S2-5', 'ESRS G1-2', 'ESRS G1-6'] },
  { pageNumber: 92, title: '지역사회', standards: ['ESRS S3-1', 'ESRS S3-4'] },
  { pageNumber: 95, title: '고객', standards: ['SASB TC-SI-550a.2', 'ESRS SBM-3', 'ESRS S4-1', 'ESRS S4-2', 'ESRS S4-3', 'ESRS S4-4'] },
  { pageNumber: 99, title: '디지털 책임', standards: ['GRI 3-3', 'ESRS MDR-P'] },
  
  // 4. ESG Performance - Governance
  { pageNumber: 105, title: '기업 지배구조', standards: ['GRI 2-9', 'GRI 2-10', 'GRI 2-11', 'GRI 2-15', 'GRI 2-16', 'GRI 2-18', 'GRI 2-19', 'GRI 2-20', 'ESRS GOV-1', 'ESRS G1-1'] },
  { pageNumber: 112, title: '리스크 관리', standards: ['GRI 2-24', 'IFRS S1-44'] },
  { pageNumber: 114, title: '윤리경영', standards: ['GRI 3-3', 'GRI 205-3', 'ESRS MDR-P', 'ESRS S1-17', 'ESRS G1-3'] },
  { pageNumber: 116, title: '준법경영', standards: ['GRI 2-24', 'GRI 205-2', 'ESRS MDR-P', 'ESRS G1-1', 'ESRS G1-3'] },
  { pageNumber: 120, title: '정보보호', standards: ['GRI 3-3', 'SASB TC-SI-220a.1', 'SASB TC-SI-230a.2', 'ESRS MDR-P'] },
  
  // 5. Appendix
  { pageNumber: 129, title: 'ESG Data', standards: ['GRI 201-1', 'GRI 302-1', 'GRI 302-2', 'GRI 302-3', 'GRI 305-1', 'GRI 305-2', 'GRI 305-3', 'GRI 305-4', 'GRI 401-2', 'GRI 401-3', 'GRI 403-8', 'GRI 403-9', 'GRI 403-10', 'GRI 404-3', 'GRI 405-1', 'GRI 405-2', 'GRI 406-1', 'GRI 205-1', 'GRI 205-3', 'GRI 2-4', 'GRI 2-7', 'GRI 2-8', 'GRI 2-21', 'GRI 2-27', 'SASB TC-SI-130a.1', 'SASB TC-SI-130a.2', 'SASB TC-SI-220a.2', 'SASB TC-SI-220a.3', 'SASB TC-SI-220a.4', 'SASB TC-SI-230a.1', 'SASB TC-SI-330a.1', 'SASB TC-SI-330a.3', 'SASB TC-SI-520a.1', 'SASB TC-SI-550a.1', 'IFRS S1-46', 'IFRS S1-48', 'IFRS S2-29', 'ESRS BP-2', 'ESRS S1-6', 'ESRS S1-13', 'ESRS S1-14', 'ESRS S1-16', 'ESRS S1-17', 'ESRS S2-4', 'ESRS S4-5', 'ESRS G1-4', 'ESRS G1-5'] },
  { pageNumber: 143, title: '가입 협회 리스트', standards: ['GRI 2-28'] },
  { pageNumber: 144, title: 'ESG Policy Book', standards: ['GRI 2-23'] },
  { pageNumber: 145, title: 'ESG 가치 창출', standards: ['GRI 203-2', 'ESRS SBM-1'] },
  { pageNumber: 154, title: '온실가스 검증의견서', standards: ['GRI 2-5'] },
];

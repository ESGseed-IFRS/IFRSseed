/**
 * 공시 기준 데이터 생성 유틸리티
 * 토큰 절약을 위해 별도 파일로 분리
 */

import type { DisclosureStandard, PageStandardMapping } from '../types';

/**
 * 공시 기준 코드로부터 DisclosureStandard 객체 생성
 */
export function createDisclosureStandard(code: string): DisclosureStandard | null {
  const parts = code.split(' ');
  if (parts.length < 2) return null;

  const type = parts[0];
  const standardCode = parts.slice(1).join(' ');

  let standardType: 'GRI' | 'SASB' | 'ESRS' | 'IFRS' | 'KSSB';
  let description = '';
  let required = true;

  if (type === 'GRI') {
    standardType = 'GRI';
    description = `GRI ${standardCode} 기준`;
  } else if (type === 'SASB') {
    standardType = 'SASB';
    description = `SASB ${standardCode} 기준`;
  } else if (type === 'ESRS') {
    standardType = 'ESRS';
    description = `ESRS ${standardCode} 기준`;
  } else if (type === 'IFRS') {
    standardType = 'IFRS';
    description = `IFRS ${standardCode} 기준`;
  } else {
    return null;
  }

  return {
    id: code.toLowerCase().replace(/\s+/g, '-'),
    name: code,
    type: standardType,
    code: standardCode,
    description,
    required,
  };
}

/**
 * 페이지별 매핑 데이터로부터 모든 공시 기준 추출
 */
export function extractDisclosureStandards(pageStandardMappings: PageStandardMapping[]): DisclosureStandard[] {
  const standardsSet = new Set<string>();
  pageStandardMappings.forEach(mapping => {
    mapping.standards.forEach(std => standardsSet.add(std));
  });
  
  // 빠진 부분 보완
  standardsSet.add('IFRS S1-78');
  standardsSet.add('ESRS BP-2');

  const standards: DisclosureStandard[] = [];
  standardsSet.forEach(code => {
    const standard = createDisclosureStandard(code);
    if (standard) {
      standards.push(standard);
    }
  });

  return standards;
}

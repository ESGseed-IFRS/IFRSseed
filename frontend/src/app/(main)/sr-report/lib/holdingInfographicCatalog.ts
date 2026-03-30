import type { InfographicTemplateId } from './holdingInfographicTypes';

export type InfographicCatalogEntry = {
  templateId: InfographicTemplateId;
  title: string;
  description: string;
  tags: string[];
  styleBullets: string[];
  referenceReports: Array<{ name: string; year: string }>;
  schemaVersion: number;
};

export const HOLDING_INFOGRAPHIC_CATALOG: InfographicCatalogEntry[] = [
  {
    templateId: 'kpi-orbit',
    title: 'KPI 원형 인포그래픽',
    description: '중앙에 핵심 감축 목표(%)를 두고 Scope 1·2·3 배출을 위성형으로 배치합니다.',
    tags: ['GRI 305', 'GRI 305-1', 'GRI 305-2', 'GRI 305-3', 'IFRS 29', 'ESRS E1', 'GHG', '온실가스'],
    styleBullets: [
      '중앙 원은 그룹 핵심 KPI(감축 목표)를 강조합니다.',
      '주변 영역에 Scope별 절대량(tCO₂e)을 색상으로 구분합니다.',
    ],
    referenceReports: [
      { name: 'Microsoft ESG Report', year: '2024' },
      { name: 'Samsung SDS SR', year: '2024' },
    ],
    schemaVersion: 1,
  },
  {
    templateId: 'reduction-timeline',
    title: '감축 여정 타임라인',
    description: '기준년·현재·목표 연도를 한 축에 배치해 감축 궤적을 표현합니다.',
    tags: ['GRI 305', 'GRI 305-5', 'IFRS 14', 'ESRS E1-3', '감축', 'Net-Zero'],
    styleBullets: [
      '마커(다이아몬드/점)로 연도별 이정표를 표시합니다.',
      '배출량 수치와 단계 라벨(기준년/진행/목표)을 함께 둡니다.',
    ],
    referenceReports: [{ name: 'TCFD Climate Report', year: '2024' }],
    schemaVersion: 1,
  },
  {
    templateId: 'scope-pyramid',
    title: 'Scope 계층 피라미드',
    description: 'Scope 3 비중이 큰 구조를 역삼각 층으로 강조합니다.',
    tags: ['GRI 305', 'GRI 305-3', 'ESRS E1-6', '배출 구조'],
    styleBullets: [
      '넓은 상단이 Scope 3 등 대규모 배출원에 해당합니다.',
      '층별 비율(%) 표시를 선택할 수 있습니다.',
    ],
    referenceReports: [{ name: 'SASB Software & IT Services', year: '2024' }],
    schemaVersion: 1,
  },
  {
    templateId: 'icon-kpi-row',
    title: '아이콘 + 원형 KPI',
    description: '환경·에너지·자원 등 복수 KPI를 가로 한 줄에 나란히 둡니다.',
    tags: ['GRI 302', 'GRI 303', 'GRI 306', 'ESRS E1-3', 'ESRS E3', 'KPI'],
    styleBullets: [
      '아이콘으로 과제를 빠르게 식별합니다.',
      '원형 게이지와 부제(전년비·목표년 등)를 함께 표기합니다.',
    ],
    referenceReports: [{ name: 'Samsung SDS SR Key Figures', year: '2024' }],
    schemaVersion: 1,
  },
];

function normTag(s: string) {
  return s.replace(/\s/g, '').toUpperCase();
}

/** 페이지 공시기준과 태그 매칭으로 추천 템플릿 정렬 */
export function getRecommendedInfographicTemplates(standards: string[]): InfographicCatalogEntry[] {
  const stdSet = standards.map(normTag);
  const score = (e: InfographicCatalogEntry) => {
    let s = 0;
    for (const t of e.tags) {
      const nt = normTag(t);
      if (stdSet.some((st) => st.includes(nt) || nt.includes(st) || st.startsWith(nt.split('-')[0]))) s += 2;
    }
    for (const st of stdSet) {
      for (const t of e.tags) {
        if (st.includes(normTag(t).replace(/[^A-Z0-9]/g, ''))) s += 1;
      }
    }
    return s;
  };
  return [...HOLDING_INFOGRAPHIC_CATALOG].sort((a, b) => score(b) - score(a));
}

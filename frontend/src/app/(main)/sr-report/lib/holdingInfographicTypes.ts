/** SR 인포그래픽 블록 — SR_INFOGRAPHIC_TEMPLATE_STRATEGY.md */

export type InfographicDataSource = 'manual' | 'ghg_group_2025';

export type InfographicTemplateId = 'kpi-orbit' | 'reduction-timeline' | 'scope-pyramid' | 'icon-kpi-row';

export type KpiOrbitProps = {
  centerPct: string;
  centerLabel: string;
  scopes: Array<{ label: string; value: string; sublabel: string; color: string }>;
};

export type ReductionTimelineProps = {
  points: Array<{
    year: string;
    title: string;
    value: string;
    status: string;
    color: string;
  }>;
};

export type ScopePyramidProps = {
  showPct: boolean;
  layers: Array<{ scope: string; value: string; pct: string; color: string }>;
};

export type IconKpiRowProps = {
  items: Array<{ icon: string; title: string; pct: string; sub: string; color: string }>;
};

export type InfographicPropsById = {
  'kpi-orbit': KpiOrbitProps;
  'reduction-timeline': ReductionTimelineProps;
  'scope-pyramid': ScopePyramidProps;
  'icon-kpi-row': IconKpiRowProps;
};

export type InfographicBlockPayload =
  | {
      type: 'infographic';
      templateId: 'kpi-orbit';
      schemaVersion: number;
      dataSource: InfographicDataSource;
      props: KpiOrbitProps;
    }
  | {
      type: 'infographic';
      templateId: 'reduction-timeline';
      schemaVersion: number;
      dataSource: InfographicDataSource;
      props: ReductionTimelineProps;
    }
  | {
      type: 'infographic';
      templateId: 'scope-pyramid';
      schemaVersion: number;
      dataSource: InfographicDataSource;
      props: ScopePyramidProps;
    }
  | {
      type: 'infographic';
      templateId: 'icon-kpi-row';
      schemaVersion: number;
      dataSource: InfographicDataSource;
      props: IconKpiRowProps;
    };

export const DEFAULT_INFOGRAPHIC_PROPS: InfographicPropsById = {
  'kpi-orbit': {
    centerPct: '42',
    centerLabel: '감축 목표',
    scopes: [
      { label: 'Scope 1', value: '45,230', sublabel: '직접 배출 (tCO₂e)', color: '#c94c4c' },
      { label: 'Scope 2', value: '123,450', sublabel: '간접 배출 (tCO₂e)', color: '#3b6ea5' },
      { label: 'Scope 3', value: '248,000', sublabel: '가치사슬 (tCO₂e)', color: '#7b4fa3' },
    ],
  },
  'reduction-timeline': {
    points: [
      { year: '2020', title: '기준년', value: '473,460', status: 'tCO₂e', color: '#333' },
      { year: '2023', title: '진행', value: '432,150', status: 'tCO₂e', color: '#e67e22' },
      { year: '2025', title: '현재', value: '416,680', status: 'tCO₂e', color: '#2980b9' },
      { year: '2030', title: '중간목표', value: '274,620', status: 'tCO₂e', color: '#27ae60' },
      { year: '2050', title: 'Net-Zero', value: '—', status: '목표', color: '#555' },
    ],
  },
  'scope-pyramid': {
    showPct: true,
    layers: [
      { scope: 'Scope 3', value: '248,000', pct: '59.5', color: '#7b4fa3' },
      { scope: 'Scope 2', value: '123,450', pct: '29.6', color: '#3b6ea5' },
      { scope: 'Scope 1', value: '45,230', pct: '10.9', color: '#c94c4c' },
    ],
  },
  'icon-kpi-row': {
    items: [
      { icon: '🌱', title: 'GHG 감축', pct: '42', sub: '2030 목표', color: '#2d6a4f' },
      { icon: '⚡', title: '재생에너지', pct: '68', sub: '전력 비중', color: '#e9c46a' },
      { icon: '💧', title: '용수 절감', pct: '15', sub: '전년 대비', color: '#457b9d' },
      { icon: '♻', title: '재활용', pct: '89', sub: '폐기물', color: '#80b192' },
    ],
  },
};

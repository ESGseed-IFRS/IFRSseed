/**
 * 차트 기능 공통 타입
 * REFACTOR_CHARTS_DATA_STRATEGY: data 분리로 토큰 절약
 */

export interface DataPoint {
  label: string;
  value: number;
}

export type SeriesType = 'bar' | 'line';

export interface ChartSeries {
  id: string;
  name: string;
  type: SeriesType;
  values: number[];
}

export interface SavedChart {
  id: string;
  chartType: string;
  dataSource: string;
  chartTitle: string;
  xAxisLabel: string;
  yAxisLabel: string;
  dataPoints: DataPoint[];
  thumbnail?: string;
}

export interface EditableTableColumn {
  key: string;
  label: string;
  align?: 'left' | 'center' | 'right';
}

export interface EditableTableRow {
  id: string;
  cells: Record<string, string>;
}

export interface EditableTable {
  id: string;
  title: string;
  note?: string;
  columns: EditableTableColumn[];
  rows: EditableTableRow[];
}

/** 테이블 행 템플릿 (id 제외, hydrate 시 주입) */
export interface TableRowTemplate {
  cells: Record<string, string>;
}

/** 테이블 템플릿 (rows에 id 없음) */
export interface TableTemplate {
  id: string;
  title: string;
  note?: string;
  columns: EditableTableColumn[];
  rows: TableRowTemplate[];
}

// Environmental
export type EnvTablePresetId = 'ghg_emissions' | 'energy' | 'investment_pue' | 'water' | 'waste_air';
export type EnvCategory = 'ghg_energy' | 'waste_air' | 'water_wastewater';

// Social
export type SocialTablePresetId =
  | 'social_workforce'
  | 'social_training'
  | 'social_diversity_retention'
  | 'social_safety_health'
  | 'social_supply_chain'
  | 'social_customer_privacy';

// Governance
export type GovTablePresetId = 'governance_board' | 'governance_ethics';

export interface GovernanceDataSource {
  value: string;
  label: string;
  unit?: string;
  legend?: string[];
  defaultChartType?: string;
  defaultLabels?: string[];
  defaultSeries?: number[][];
  defaultSeriesTypes?: SeriesType[];
}

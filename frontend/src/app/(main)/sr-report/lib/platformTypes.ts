/** SR 플랫폼 타입 정의 — SRReportPlatform.jsx 기반 */

export type SchemaKey = 'ghg' | 'energy' | 'safety' | 'supply' | 'climate' | 'diversity' | 'governance' | 'ethics' | 'water';

export type FieldType = 'number' | 'percent' | 'text' | 'textarea' | 'select';

export interface FieldSchema {
  id: string;
  label: string;
  type: FieldType;
  unit?: string;
  required: boolean;
  placeholder?: string;
  rows?: number;
  options?: string[];
}

export interface SectionSchema {
  id: string;
  title: string;
  color: string;
  desc?: string;
  fields: FieldSchema[];
}

export interface ItemSchema {
  label: string;
  sections: SectionSchema[];
}

export type ItemStatus = '완료' | '작성중' | '미작성' | '제출완료' | '반려' | '머지완료';

export interface CategoryItem {
  id: number;
  name: string;
  standards: string[];
  deadline: string | null;
  status: ItemStatus;
  rate: number;
  submitDate: string | null;
  holdingComment: string | null;
  fields: Record<string, string>;
}

export interface CategoryGroup {
  id: string;
  label: string;
  color: string;
  bg: string;
  items: CategoryItem[];
}

export interface SubsidiarySubmissionItem {
  id: number;
  name: string;
  standards: string[];
  category: string;
  value: string;
  file: string | null;
  status: ItemStatus;
  submitDate: string | null;
}

export interface SubsidiarySubmission {
  corp: string;
  corpId: string;
  items: SubsidiarySubmissionItem[];
}

export interface MergedDataItem {
  id: string;
  name: string;
  standards: string[];
  merged: string;
  sources: string[];
  mergeStatus: '완료' | '부분';
  tocPage: string;
}

export interface TocItem {
  label: string;
  dot: 'done' | 'wip' | 'none';
  sub?: boolean;
  linkedMerge?: string;
}

export interface TocGroup {
  group: string;
  items: TocItem[];
}

export type InfographicLayout = 'process' | 'roadmap' | 'kpi-cards' | 'gauge' | 'pyramid';

/** SR_Platform_Strategy: DP(Disclosure Point) 정의 */
export type DpFieldType = 'NUMBER' | 'TEXT' | 'TEXTAREA' | 'SELECT' | 'FILE';
export type DpType = 'GRI_ONLY' | 'ISSB_ONLY' | 'ESRS_ONLY' | 'GRI_ISSB' | 'GRI_ESRS' | 'ISSB_ESRS' | 'ALL_THREE';
export type AggregationMethod = 'SUM' | 'WEIGHTED_AVG' | 'HQ_ONLY' | 'QUALITATIVE';
export type DpAggregationStatus = 'AGGREGATING' | 'REVIEWING' | 'CONFIRMED';

export interface DpField {
  field_id: string;
  label_ko: string;
  field_type: DpFieldType;
  unit?: string;
  is_required: boolean;
  is_qualitative: boolean;
  options?: string[];
  note?: string;
}

export interface DpMaster {
  dp_id: string;
  dp_name_ko: string;
  category: 'E' | 'S' | 'G';
  coverage: { gri: string | null; issb: string | null; esrs: string | null };
  dp_type: DpType;
  aggregation_method: AggregationMethod;
  fields: {
    common: DpField[];
    gri: DpField[];
    issb: DpField[];
    esrs: DpField[];
  };
}

export interface SubsidiaryDpSubmission {
  subsidiary_id: string;
  subsidiary_name: string;
  status: 'DRAFT' | 'SUBMITTED' | 'REVISION_REQUESTED' | 'ACCEPTED';
  values: Record<string, string | number | null>;
  methodology?: string;
  yoy_change?: number;
}

export interface DpAggregation {
  dp_id: string;
  report_year: number;
  status: DpAggregationStatus;
  subsidiary_submissions: SubsidiaryDpSubmission[];
  quantitative: {
    auto_value: number | null;
    final_value: number | null;
    unit: string | null;
    adjustment_reason: string | null | undefined;
  };
  qualitative: {
    subsidiary_texts: { subsidiary_id: string; subsidiary_name: string; text: string }[];
    integrated_text: string;
  };
}

export interface VizItem {
  id: string;
  type: string;
  label: string;
  desc: string;
  icon: string;
  urgent?: boolean;
  data?: (string | number)[][];
  cols?: string[];
  /** 인포그래픽 전용: 미리보기 레이아웃 종류 */
  infographicLayout?: InfographicLayout;
  /** 인포그래픽 전용: layout별 샘플 데이터 */
  infographicData?: Record<string, unknown>;
}

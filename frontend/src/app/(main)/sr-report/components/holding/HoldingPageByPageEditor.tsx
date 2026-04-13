'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, Loader2 } from 'lucide-react';
import {
  fetchWithAuthJson,
  mergeAuthIntoRequestBody,
  useAuthSessionStore,
} from '@/store/authSessionStore';
import {
  HOLDING_SR_PAGE_DATA,
  getInfographicSuggestions,
  findPageByKeyword,
  type HoldingSrPageRow,
} from '../../lib/holdingPageData';
import {
  HOLDING_SR_MAPPINGS_CHANGED_EVENT,
  HOLDING_SR_MAPPINGS_STORAGE_KEY,
} from '../../lib/holdingPageMappingsStorage';
import {
  HOLDING_SR_MAPPINGS_COMPANY_ID,
  resolveMergedHoldingSrPages,
} from '../../lib/holdingPageMappingsApi';
import { getRecommendedInfographicTemplates } from '../../lib/holdingInfographicCatalog';
import type { InfographicBlockPayload } from '../../lib/holdingInfographicTypes';
import {
  HoldingChartSVG,
  HoldingChartEditor,
  HoldingTableEditor,
  HoldingTableBlock,
  uid,
  type ChartSeriesState,
  type PageContentBlock,
  type ChartBlockPayload,
  type TableBlockPayload,
} from './HoldingPageEditorBlocks';
import { HoldingInfographicEditor } from './HoldingInfographicEditor';
import { HoldingInfographicSvg } from './HoldingInfographicSvg';

const INFO_ICONS = ['📊', '📈', '🗂️', '🎯', '📉'];

type Props = {
  /** 공시데이터 작성 등에서 넘어올 때 목차 키워드(예: 온실가스 배출)로 해당 페이지 자동 선택 */
  initialKeyword?: string | null;
  onInitialKeywordConsumed?: () => void;
};

type LayoutBlock =
  | { kind: 'paragraph'; text?: string }
  | { kind: 'table'; markdown?: string; note?: string }
  | {
      kind: 'image_recommendation';
      image_ref?: string;
      role?: string;
      placement_hint?: string;
      rationale_ko?: string;
    };

/** validator_node 확장 응답 (schema_version, accuracy, feedback_items, rationale) */
export type ValidatorFeedbackItem = {
  severity?: string;
  dimension_id?: string;
  issue_ko?: string;
  suggestion_ko?: string;
  quote?: string | null;
  source?: string;
};

export type ValidatorAccuracyDimension = {
  id?: string;
  score?: number;
  weight?: number;
  source?: string;
  notes_ko?: string;
};

export type HoldingAgentValidation = {
  is_valid?: boolean;
  errors?: string[];
  warnings?: string[];
  schema_version?: string;
  accuracy?: {
    overall?: { score?: number; band?: string; label_ko?: string };
    by_dimension?: ValidatorAccuracyDimension[];
  };
  feedback_items?: ValidatorFeedbackItem[];
  rationale?: {
    summary_ko?: string;
    rule_summary_ko?: string;
    llm_summary_ko?: string;
  };
};

/** DP별 문장 매핑 */
export type DpSentenceMapping = {
  dp_id: string;
  dp_name_ko: string;
  sentences: string[];
  rationale?: string;
};

/** gen_node data_provenance (백엔드 WorkflowResponse와 동일 구조) */
export type DataProvenanceSourceDetails = Record<string, unknown>;

export type QuantitativeProvenanceItem = {
  value?: unknown;
  unit?: string;
  dp_id?: string;
  source_type?: string;
  source_details?: DataProvenanceSourceDetails;
  mapped_dp_ids?: string[];
  used_in_sentences?: string[];
};

export type QualitativeProvenanceItem = {
  dp_id?: string;
  source_type?: string;
  source_details?: DataProvenanceSourceDetails;
  used_in_sentences?: string[];
};

export type DataProvenance = {
  quantitative_sources?: QuantitativeProvenanceItem[];
  qualitative_sources?: QualitativeProvenanceItem[];
  reference_pages?: Record<string, number | string | null | undefined>;
};

const SOURCE_TYPE_LABEL_KO: Record<string, string> = {
  environmental_data: '환경 DB',
  social_data: '사회 DB',
  governance_data: '지배구조 DB',
  subsidiary_data: '계열사 기여 데이터',
  external_news: '외부 보도',
  sr_reference: 'SR 참조 본문',
  rulebook: '기준서(rulebook)',
};

function sourceTypeLabelKo(t: string | undefined): string {
  if (!t) return '—';
  return SOURCE_TYPE_LABEL_KO[t] ?? t;
}

function formatDetailValue(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
}

function shouldShowProvenanceBlock(p: DataProvenance | undefined | null): boolean {
  return p !== undefined && p !== null && typeof p === 'object';
}

type CreateReportResponse = {
  workflow_id?: string;
  status?: string;
  generated_text?: string;
  dp_sentence_mappings?: DpSentenceMapping[];
  data_provenance?: DataProvenance | null;
  validation?: HoldingAgentValidation;
  layout?: { version?: number; blocks?: LayoutBlock[] };
  image_recommendations?: Array<{
    image_ref?: string;
    role?: string;
    placement_hint?: string;
    rationale_ko?: string;
  }>;
  error?: string | null;
};

const DIMENSION_LABEL_KO: Record<string, string> = {
  format_completeness: '형식·완성도',
  numeric_presence: '수치 반영',
  fact_consistency: '사실 일관성',
  greenwashing_risk: '과장·그린워싱',
  dp_availability: 'DP 데이터',
};

function dimensionLabelKo(id: string | undefined): string {
  if (!id) return '—';
  return DIMENSION_LABEL_KO[id] ?? id;
}

function bandAccentClass(band: string | undefined): string {
  switch (band) {
    case 'excellent':
      return 'text-[#1b4332] bg-[#d8f3dc] border-[#95d5b2]';
    case 'good':
      return 'text-[#2d6a4f] bg-[#e8f5e9] border-[#a8d5ba]';
    case 'fair':
      return 'text-[#8a6d3b] bg-[#fff8e6] border-[#f0d78c]';
    case 'poor':
      return 'text-[#7f1d1d] bg-[#fee2e2] border-[#fca5a5]';
    default:
      return 'text-[#444] bg-[#f0f0f0] border-[#ddd]';
  }
}

function severityStyles(sev: string | undefined): string {
  switch (sev) {
    case 'error':
      return 'border-l-[#dc2626] bg-[#fef2f2]';
    case 'warning':
      return 'border-l-[#d97706] bg-[#fffbeb]';
    default:
      return 'border-l-[#457b9d] bg-[#f0f7fb]';
  }
}

type HoldingValidationPanelProps = {
  v: HoldingAgentValidation | undefined;
};

function HoldingValidationPanel({ v }: HoldingValidationPanelProps) {
  if (!v || (v.schema_version == null && v.accuracy == null && !v.feedback_items?.length)) {
    const hasLegacy =
      v &&
      (v.is_valid != null ||
        (v.errors && v.errors.length > 0) ||
        (v.warnings && v.warnings.length > 0));
    if (!hasLegacy) {
      return (
        <div className="rounded-[10px] border border-dashed border-[#dde1e7] bg-[#fafafa] px-4 py-8 text-center text-[12px] text-[#888] leading-relaxed">
          아직 검증 결과가 없습니다.
          <br />
          <span className="text-[11px] text-[#aaa]">「본문 편집」에서 AI 문단 생성 후 확인할 수 있습니다.</span>
        </div>
      );
    }
  }

  const overall = v.accuracy?.overall;
  const byDim = v.accuracy?.by_dimension ?? [];

  return (
    <div className="flex flex-col gap-4 min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-[11px] font-bold ${
            v.is_valid === true
              ? 'border-[#95d5b2] bg-[#e8f5e9] text-[#1b4332]'
              : v.is_valid === false
                ? 'border-[#fca5a5] bg-[#fee2e2] text-[#7f1d1d]'
                : 'border-[#ddd] bg-[#f5f5f5] text-[#666]'
          }`}
        >
          {v.is_valid === true ? '검증 통과' : v.is_valid === false ? '검증 미통과' : '검증 상태 미상'}
        </span>
        {overall && (
          <span
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-bold ${bandAccentClass(overall.band)}`}
          >
            <span>종합 {overall.score ?? '—'}점</span>
            {overall.label_ko && <span className="font-semibold opacity-90">({overall.label_ko})</span>}
          </span>
        )}
        {v.schema_version && (
          <span className="text-[10px] text-[#aaa] font-mono">schema: {v.schema_version}</span>
        )}
      </div>

      {v.warnings && v.warnings.length > 0 && (
        <div className="rounded-lg border border-[#f0d78c] bg-[#fffbeb] px-3 py-2">
          <div className="text-[10px] font-bold text-[#92400e] mb-1">경고</div>
          <ul className="list-disc pl-4 text-[11px] text-[#78350f] space-y-0.5">
            {v.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {v.errors && v.errors.length > 0 && (
        <div className="rounded-lg border border-[#fca5a5] bg-[#fef2f2] px-3 py-2">
          <div className="text-[10px] font-bold text-[#991b1b] mb-1">오류(재생성 피드백)</div>
          <ul className="list-disc pl-4 text-[11px] text-[#7f1d1d] space-y-0.5">
            {v.errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {byDim.length > 0 && (
        <div className="rounded-[10px] border border-[#dbe9df] bg-[#f7fbf8] p-3.5">
          <div className="text-[11px] font-bold text-[#2d6a4f] mb-3">차원별 점수</div>
          <div className="flex flex-col gap-3">
            {byDim.map((row, i) => {
              const score = typeof row.score === 'number' ? row.score : 0;
              return (
                <div key={row.id ?? i} className="min-w-0">
                  <div className="flex justify-between gap-2 text-[10px] mb-1">
                    <span className="font-semibold text-[#333] truncate">
                      {dimensionLabelKo(row.id)}
                      <span className="ml-1 font-normal text-[#888]">
                        ({row.source === 'llm' ? 'LLM' : '규칙'})
                      </span>
                    </span>
                    <span className="shrink-0 text-[#2d6a4f] font-bold">{score}점</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-[#e4e6ea] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#74c69d] to-[#2d6a4f] transition-[width]"
                      style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
                    />
                  </div>
                  {row.notes_ko && (
                    <p className="mt-1 text-[10px] leading-relaxed text-[#555]">{row.notes_ko}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {v.rationale && (v.rationale.summary_ko || v.rationale.llm_summary_ko || v.rationale.rule_summary_ko) && (
        <div className="rounded-[10px] border border-[#dde1e7] bg-white p-3.5">
          <div className="text-[11px] font-bold text-[#444] mb-2">판단 요약</div>
          {v.rationale.summary_ko && (
            <p className="text-[12px] leading-relaxed text-[#333] mb-2">{v.rationale.summary_ko}</p>
          )}
          <div className="text-[10px] text-[#666] space-y-1 border-t border-[#eee] pt-2">
            {v.rationale.rule_summary_ko && (
              <p>
                <span className="font-semibold text-[#888]">규칙: </span>
                {v.rationale.rule_summary_ko}
              </p>
            )}
            {v.rationale.llm_summary_ko && (
              <p>
                <span className="font-semibold text-[#888]">LLM: </span>
                {v.rationale.llm_summary_ko}
              </p>
            )}
          </div>
        </div>
      )}

      {v.feedback_items && v.feedback_items.length > 0 && (
        <div>
          <div className="text-[11px] font-bold text-[#2d6a4f] mb-2">구체적 피드백</div>
          <div className="flex flex-col gap-2.5">
            {v.feedback_items.map((item, i) => (
              <div
                key={i}
                className={`rounded-lg border border-[#e4e6ea] border-l-4 pl-3 pr-3 py-2.5 ${severityStyles(item.severity)}`}
              >
                <div className="flex flex-wrap items-center gap-1.5 mb-1">
                  <span className="text-[9px] font-bold uppercase tracking-wide text-[#666]">
                    {item.severity || 'suggestion'}
                  </span>
                  <span className="text-[9px] text-[#888]">· {dimensionLabelKo(item.dimension_id)}</span>
                  {item.source && (
                    <span className="text-[9px] text-[#aaa]">({item.source})</span>
                  )}
                </div>
                {item.issue_ko && <p className="text-[11px] font-semibold text-[#333] mb-1">{item.issue_ko}</p>}
                {item.suggestion_ko && (
                  <p className="text-[11px] leading-relaxed text-[#555]">{item.suggestion_ko}</p>
                )}
                {item.quote && (
                  <blockquote className="mt-2 rounded bg-white/70 border border-[#e8e8e8] px-2 py-1.5 text-[10px] text-[#444] font-mono whitespace-pre-wrap break-words">
                    {item.quote}
                  </blockquote>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

type SectionHeaderProps = {
  section: string;
};

function SectionHeader({ section }: SectionHeaderProps) {
  return (
    <div className="px-3.5 pt-2.5 pb-1">
      <div className="text-[10px] font-bold text-[#aaa] tracking-widest uppercase">{section}</div>
    </div>
  );
}

function DataProvenanceSection({ provenance }: { provenance: DataProvenance }) {
  const quant = Array.isArray(provenance.quantitative_sources) ? provenance.quantitative_sources : [];
  const qual = Array.isArray(provenance.qualitative_sources) ? provenance.qualitative_sources : [];
  const refPages = provenance.reference_pages && typeof provenance.reference_pages === 'object'
    ? provenance.reference_pages
    : {};

  if (quant.length === 0 && qual.length === 0 && Object.keys(refPages).length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#dbe9df] bg-[#fafcfa] px-4 py-6 text-center">
        <div className="text-sm font-semibold text-[#666] mb-1">데이터 출처 없음</div>
        <p className="text-[11px] text-[#999] max-w-md mx-auto leading-relaxed">
          최신 에이전트는 정량·정성 출처를 JSON으로 반환합니다. 생성 후에도 이 영역이 비어 있으면 API·모델 응답에{' '}
          <code className="text-[10px] bg-[#eee] px-1 rounded">data_provenance</code>가 포함되는지 확인하세요.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {Object.keys(refPages).length > 0 && (
        <div className="rounded-xl border border-[#e4e6ea] bg-[#f8faf9] p-4">
          <div className="text-[11px] font-bold text-[#2d6a4f] mb-2">SR 참조 페이지</div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(refPages).map(([yr, pg]) => (
              <span
                key={yr}
                className="text-[11px] bg-white border border-[#dbe9df] rounded-lg px-2.5 py-1 text-[#333]"
              >
                {yr}년: {pg != null && pg !== '' ? String(pg) : '—'}페이지
              </span>
            ))}
          </div>
        </div>
      )}

      {quant.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-bold text-[#333]">정량 데이터 출처</span>
            <span className="text-[10px] bg-[#e3f2fd] text-[#1565c0] px-2 py-0.5 rounded-full font-semibold">
              {quant.length}건
            </span>
          </div>
          <div className="flex flex-col gap-3">
            {quant.map((row, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-[#cfe8fc] bg-white p-3.5 shadow-sm"
              >
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="text-[11px] font-bold text-[#0d47a1]">
                    {row.value != null ? formatDetailValue(row.value) : '—'}
                    {row.unit ? ` ${row.unit}` : ''}
                  </span>
                  {row.dp_id && (
                    <span className="text-[10px] font-mono bg-[#f5f5f5] px-1.5 py-0.5 rounded text-[#555]">
                      {row.dp_id}
                    </span>
                  )}
                  <span className="text-[10px] text-[#666]">
                    {sourceTypeLabelKo(row.source_type)}
                  </span>
                </div>
                {row.mapped_dp_ids && row.mapped_dp_ids.length > 0 && (
                  <div className="mb-2">
                    <div className="text-[10px] text-[#888] mb-1">UCM 매핑 DP</div>
                    <div className="flex flex-wrap gap-1">
                      {row.mapped_dp_ids.map((id) => (
                        <span
                          key={id}
                          className="text-[9px] font-mono bg-[#fff8e1] text-[#795548] px-1.5 py-0.5 rounded"
                        >
                          {id}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {row.source_details && Object.keys(row.source_details).length > 0 && (
                  <ul className="text-[10px] text-[#555] space-y-0.5 mb-2 pl-3 list-disc">
                    {Object.entries(row.source_details).map(([k, v]) => (
                      <li key={k}>
                        <span className="font-semibold text-[#444]">{k}</span>: {formatDetailValue(v)}
                      </li>
                    ))}
                  </ul>
                )}
                {row.used_in_sentences && row.used_in_sentences.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-[#eee]">
                    <div className="text-[10px] text-[#888] mb-1">인용 문장</div>
                    {row.used_in_sentences.map((s, i) => (
                      <p key={i} className="text-[11px] text-[#333] leading-relaxed bg-[#f5f9ff] rounded p-2 mb-1">
                        {s}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {qual.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-bold text-[#333]">정성 데이터 출처</span>
            <span className="text-[10px] bg-[#f3e5f5] text-[#6a1b9a] px-2 py-0.5 rounded-full font-semibold">
              {qual.length}건
            </span>
          </div>
          <div className="flex flex-col gap-3">
            {qual.map((row, idx) => (
              <div
                key={idx}
                className="rounded-xl border border-[#e1bee7] bg-white p-3.5 shadow-sm"
              >
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  {row.dp_id && (
                    <span className="text-[10px] font-mono bg-[#f5f5f5] px-1.5 py-0.5 rounded text-[#555]">
                      {row.dp_id}
                    </span>
                  )}
                  <span className="text-[10px] text-[#666]">
                    {sourceTypeLabelKo(row.source_type)}
                  </span>
                </div>
                {row.source_details && Object.keys(row.source_details).length > 0 && (
                  <ul className="text-[10px] text-[#555] space-y-0.5 mb-2 pl-3 list-disc">
                    {Object.entries(row.source_details).map(([k, v]) => (
                      <li key={k}>
                        <span className="font-semibold text-[#444]">{k}</span>: {formatDetailValue(v)}
                      </li>
                    ))}
                  </ul>
                )}
                {row.used_in_sentences && row.used_in_sentences.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-[#eee]">
                    <div className="text-[10px] text-[#888] mb-1">인용 문장</div>
                    {row.used_in_sentences.map((s, i) => (
                      <p key={i} className="text-[11px] text-[#333] leading-relaxed bg-[#faf5fc] rounded p-2 mb-1">
                        {s}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** DP-문장 매핑 + 데이터 출처 패널 */
function DpMappingPanel({
  mappings,
  pageStandards,
  provenance,
}: {
  mappings: DpSentenceMapping[];
  pageStandards: string[];
  provenance?: DataProvenance | null;
}) {
  const hasMappings = mappings && mappings.length > 0;
  const showProvBlock = shouldShowProvenanceBlock(provenance);

  if (!hasMappings && !showProvBlock) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="text-4xl mb-3 opacity-60">🔗</div>
        <div className="text-sm font-semibold text-[#666] mb-1">DP 매핑·출처 정보 없음</div>
        <p className="text-xs text-[#999] max-w-xs">
          AI 문단 생성 후 DP별 문장 매핑과 정량·정성 데이터 출처를 확인할 수 있습니다.
        </p>
        {pageStandards.length > 0 && (
          <div className="mt-4 px-3 py-2 bg-[#f5f8f6] rounded-lg">
            <div className="text-[10px] text-[#888] mb-1">이 페이지에 매핑된 DP:</div>
            <div className="flex flex-wrap gap-1">
              {pageStandards.slice(0, 8).map((s) => (
                <span key={s} className="text-[9px] bg-[#edf5ef] text-[#2d6a4f] px-1.5 py-0.5 rounded">
                  {s}
                </span>
              ))}
              {pageStandards.length > 8 && (
                <span className="text-[9px] text-[#999]">+{pageStandards.length - 8}</span>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {hasMappings && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-base">🔗</span>
            <span className="text-sm font-bold text-[#333]">DP별 문장 매핑</span>
            <span className="text-[10px] bg-[#e8f5e9] text-[#2d6a4f] px-2 py-0.5 rounded-full font-semibold">
              {mappings.length}개 DP
            </span>
          </div>
          <p className="text-[11px] text-[#666] -mt-2 mb-2">
            생성된 문단에서 각 Data Point(DP)에 해당하는 문장들을 보여줍니다.
          </p>
          {mappings.map((m, idx) => (
            <div
              key={m.dp_id || idx}
              className="rounded-xl border border-[#dbe9df] bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="inline-flex items-center gap-1 bg-[#2d6a4f] text-white text-[11px] font-bold px-2.5 py-1 rounded-lg">
                  <span className="opacity-75">DP</span>
                  {m.dp_id}
                </span>
                {m.dp_name_ko && (
                  <span className="text-xs text-[#555] font-medium">{m.dp_name_ko}</span>
                )}
              </div>
              <div className="flex flex-col gap-2">
                {m.sentences.map((sentence, sIdx) => (
                  <div
                    key={sIdx}
                    className="flex gap-2 items-start text-[12px] leading-relaxed text-[#333] bg-[#f8fdf9] rounded-lg p-3 border-l-[3px] border-[#74c69d]"
                  >
                    <span className="shrink-0 text-[10px] text-[#74c69d] font-bold mt-0.5">
                      {sIdx + 1}.
                    </span>
                    <span>{sentence}</span>
                  </div>
                ))}
              </div>
              {m.rationale && (
                <div className="mt-3 pt-3 border-t border-[#eee]">
                  <div className="flex items-center gap-1 text-[10px] text-[#888] mb-1">
                    <span>💡</span>
                    <span className="font-semibold">매핑 근거</span>
                  </div>
                  <p className="text-[11px] text-[#666] leading-relaxed">{m.rationale}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showProvBlock && provenance && (
        <div className="flex flex-col gap-3 pt-2 border-t border-[#e8ebe8]">
          <div className="flex items-center gap-2">
            <span className="text-base">📎</span>
            <span className="text-sm font-bold text-[#333]">데이터 출처 (정량·정성)</span>
          </div>
          <p className="text-[11px] text-[#666] -mt-1 mb-1">
            문단에 사용된 수치·서술이 어떤 소스(SR, DB, 계열사, 외부 뉴스 등)에서 왔는지 표시합니다.
          </p>
          <DataProvenanceSection provenance={provenance} />
        </div>
      )}
    </div>
  );
}

type PageListItemProps = {
  page: HoldingSrPageRow;
  active: boolean;
  hasText: boolean;
  blockCount: number;
  onSelect: () => void;
};

function PageListItem({ page, active, hasText, blockCount, onSelect }: PageListItemProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      className={`w-full text-left px-3.5 py-2 cursor-pointer border-l-[3px] transition-colors outline-none ${
        active ? 'border-[#2d6a4f] bg-[#f0faf3]' : 'border-transparent bg-transparent hover:bg-[#fafafa]'
      }`}
    >
      <div className="flex justify-between items-center">
        <span className={`text-[10px] font-mono font-semibold ${active ? 'text-[#2d6a4f]' : 'text-[#aaa]'}`}>
          P.{page.page}
        </span>
        <div className="flex gap-0.5 items-center">
          {hasText && (
            <span className="text-[9px] bg-[#edf5ef] text-[#2d6a4f] rounded-md px-1 py-px">
              문단
            </span>
          )}
          {blockCount > 0 && (
            <span className="text-[9px] bg-[#fff3e8] text-[#c06020] rounded-md px-1 py-px">
              +{blockCount}
            </span>
          )}
        </div>
      </div>
      <div
        className={`text-xs mt-0.5 leading-snug ${
          active ? 'text-[#2d6a4f] font-bold' : 'text-[#444] font-normal'
        }`}
      >
        {page.title}
      </div>
    </div>
  );
}

export function HoldingPageByPageEditor({ initialKeyword, onInitialKeywordConsumed }: Props) {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:9001';
  const companyId = useAuthSessionStore((s) => s.user?.company_id?.trim() ?? '');
  const [selectedPage, setSelectedPage] = useState<HoldingSrPageRow | null>(null);
  const [search, setSearch] = useState('');
  const [pagesData, setPagesData] = useState<HoldingSrPageRow[]>(() => [...HOLDING_SR_PAGE_DATA]);
  const [pageTexts, setPageTexts] = useState<Record<string, string>>({});
  const [agentReplies, setAgentReplies] = useState<Record<string, string>>({});
  const [agentLayouts, setAgentLayouts] = useState<Record<string, LayoutBlock[]>>({});
  const [blocks, setBlocks] = useState<Record<string, PageContentBlock[]>>({});
  const [pageValidations, setPageValidations] = useState<Record<string, HoldingAgentValidation | undefined>>(
    {},
  );
  const [pageDpMappings, setPageDpMappings] = useState<Record<string, DpSentenceMapping[]>>({});
  const [pageDataProvenance, setPageDataProvenance] = useState<Record<string, DataProvenance | undefined>>({});
  const [activeTab, setActiveTab] = useState<
    'content' | 'chart' | 'table' | 'infographic' | 'accuracy' | 'dp-mapping'
  >('content');
  const [generating, setGenerating] = useState(false);
  /** 페이지별 에이전트 진행 단계(SSE 이벤트 메시지 누적) */
  const [generationSteps, setGenerationSteps] = useState<Record<string, string[]>>({});
  const [requestError, setRequestError] = useState<string | null>(null);
  const [newStandard, setNewStandard] = useState('');
  const [editingStandardIndex, setEditingStandardIndex] = useState<number | null>(null);
  const [editingStandardValue, setEditingStandardValue] = useState('');
  const [infographicEdit, setInfographicEdit] = useState<{
    id: string;
    payload: InfographicBlockPayload;
  } | null>(null);

  /** DB(API) → localStorage → 생성 파일 병합 동기화 (로그인 시 서버 우선, 어드민·다른 탭 반영) */
  useEffect(() => {
    let cancelled = false;
    const refreshPages = async () => {
      const merged = await resolveMergedHoldingSrPages(
        HOLDING_SR_PAGE_DATA,
        HOLDING_SR_MAPPINGS_COMPANY_ID,
        apiBase,
      );
      if (cancelled) return;
      setPagesData(merged);
      setSelectedPage((prev) => {
        if (!prev) return null;
        return merged.find((p) => p.page === prev.page) ?? prev;
      });
    };
    void refreshPages();
    const onChanged = () => void refreshPages();
    window.addEventListener(HOLDING_SR_MAPPINGS_CHANGED_EVENT, onChanged);
    const onStorage = (e: StorageEvent) => {
      if (e.key === HOLDING_SR_MAPPINGS_STORAGE_KEY) void refreshPages();
    };
    window.addEventListener('storage', onStorage);
    return () => {
      cancelled = true;
      window.removeEventListener(HOLDING_SR_MAPPINGS_CHANGED_EVENT, onChanged);
      window.removeEventListener('storage', onStorage);
    };
  }, [apiBase]);

  useEffect(() => {
    if (!initialKeyword?.trim()) return;
    const found = findPageByKeyword(initialKeyword);
    if (found) {
      const inCurrent = pagesData.find((p) => p.page === found.page) || null;
      setSelectedPage(inCurrent ?? found);
    }
    onInitialKeywordConsumed?.();
  }, [initialKeyword, onInitialKeywordConsumed, pagesData]);

  const sections = useMemo(
    // pagesData의 "등장 순서"를 유지 (Set은 삽입 순서를 유지하지만, 명시적으로 안전하게 생성)
    () => pagesData.reduce<string[]>((acc, p) => (acc.includes(p.section) ? acc : [...acc, p.section]), []),
    [pagesData],
  );
  const filtered = useMemo(
    () =>
      pagesData.filter(
        (p) =>
          p.title.toLowerCase().includes(search.toLowerCase()) ||
          p.standards.some((s) => s.toLowerCase().includes(search.toLowerCase())),
      ),
    [search, pagesData],
  );

  const pageKey = selectedPage ? String(selectedPage.page) : null;
  const currentText = pageKey ? pageTexts[pageKey] || '' : '';
  const currentReply = pageKey ? agentReplies[pageKey] || '' : '';
  const currentLayoutBlocks = pageKey ? agentLayouts[pageKey] || [] : [];
  const currentGenerationSteps = pageKey ? generationSteps[pageKey] || [] : [];
  const currentBlocks = pageKey ? blocks[pageKey] || [] : [];
  const currentValidation = pageKey ? pageValidations[pageKey] : undefined;
  const visibleSections = useMemo(
    () => sections.filter((sec) => filtered.some((p) => p.section === sec)),
    [sections, filtered],
  );

  function updateSelectedPageStandards(updater: (prev: string[]) => string[]) {
    if (!selectedPage) return;
    const page = selectedPage.page;
    setPagesData((prev) =>
      prev.map((p) => (p.page === page ? { ...p, standards: updater(p.standards || []) } : p)),
    );
    setSelectedPage((prev) =>
      prev && prev.page === page ? { ...prev, standards: updater(prev.standards || []) } : prev,
    );
  }

  function addStandard() {
    const v = newStandard.trim();
    if (!v) return;
    updateSelectedPageStandards((prev) => (prev.includes(v) ? prev : [...prev, v]));
    setNewStandard('');
  }

  function removeStandard(target: string) {
    updateSelectedPageStandards((prev) => prev.filter((s) => s !== target));
    if (editingStandardValue === target) {
      setEditingStandardIndex(null);
      setEditingStandardValue('');
    }
  }

  function startEditStandard(index: number, value: string) {
    setEditingStandardIndex(index);
    setEditingStandardValue(value);
  }

  function cancelEditStandard() {
    setEditingStandardIndex(null);
    setEditingStandardValue('');
  }

  function saveEditStandard() {
    if (editingStandardIndex == null) return;
    const v = editingStandardValue.trim();
    if (!v) return;
    updateSelectedPageStandards((prev) =>
      prev.map((s, idx) => (idx === editingStandardIndex ? v : s)),
    );
    cancelEditStandard();
  }

  async function generateText() {
    if (!selectedPage || !pageKey) return;
    const pk = pageKey;
    if (!companyId) {
      setRequestError('로그인된 회사 ID가 없습니다. 다시 로그인해 주세요.');
      return;
    }
    const resolvedCategory = (selectedPage.title || selectedPage.section || '').trim();
    const dpIds = Array.from(
      new Set(
        (selectedPage.standards || [])
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    );
    if (!resolvedCategory) {
      setRequestError('카테고리가 비어 있습니다.');
      return;
    }

    setGenerating(true);
    setRequestError(null);
    setGenerationSteps((prev) => ({ ...prev, [pk]: [] }));

    const jsonBody = {
      company_id: companyId,
      category: resolvedCategory,
      dp_ids: dpIds,
      ref_pages: {},
      max_retries: 3,
      // 직접 참조 ID 전달 (39페이지에 매핑된 sr_report_body, sr_report_images ID)
      sr_body_ids: selectedPage.srBodyIds || [],
      sr_image_ids: selectedPage.srImageIds || [],
    };

    const baseUrl = `${apiBase.replace(/\/$/, '')}/ifrs-agent/reports`;

    function appendStep(line: string) {
      setGenerationSteps((prev) => ({
        ...prev,
        [pk]: [...(prev[pk] || []), line],
      }));
    }

    function applyCreateResult(body: CreateReportResponse) {
      if (body.error) throw new Error(body.error);
      const generated = (body.generated_text || '').trim();
      if (generated) {
        setPageTexts((prev) => ({ ...prev, [pk]: generated }));
      }
      const layoutBlocks: LayoutBlock[] = Array.isArray(body.layout?.blocks)
        ? body.layout?.blocks || []
        : Array.isArray(body.image_recommendations)
          ? body.image_recommendations.map((r) => ({
              kind: 'image_recommendation' as const,
              image_ref: r.image_ref,
              role: r.role,
              placement_hint: r.placement_hint,
              rationale_ko: r.rationale_ko,
            }))
          : [];
      setAgentLayouts((prev) => ({ ...prev, [pk]: layoutBlocks }));
      
      // 검증 결과 저장 (확장된 accuracy/feedback 포함)
      if (body.validation) {
        setPageValidations((prev) => ({ ...prev, [pk]: body.validation }));
      }
      
      // DP-문장 매핑 저장
      if (body.dp_sentence_mappings && body.dp_sentence_mappings.length > 0) {
        setPageDpMappings((prev) => ({ ...prev, [pk]: body.dp_sentence_mappings! }));
      } else {
        setPageDpMappings((prev) => ({ ...prev, [pk]: [] }));
      }

      // 데이터 출처 (gen_node data_provenance)
      setPageDataProvenance((prev) => ({
        ...prev,
        [pk]: body.data_provenance ?? undefined,
      }));
      
      const replyLines = [
        `workflow_id: ${body.workflow_id ?? '-'}`,
        `status: ${body.status ?? '-'}`,
        `validation: ${body.validation?.is_valid === true ? 'passed' : body.validation?.is_valid === false ? 'failed' : '-'}`,
        body.validation?.errors?.length ? `errors: ${body.validation.errors.join(' | ')}` : 'errors: -',
        generated ? `generated_text: ${generated.slice(0, 220)}${generated.length > 220 ? '…' : ''}` : 'generated_text: -',
        layoutBlocks.length ? `layout_blocks: ${layoutBlocks.length}` : 'layout_blocks: 0',
      ];
      setAgentReplies((prev) => ({ ...prev, [pk]: replyLines.join('\n') }));
    }

    try {
      let body: CreateReportResponse | null = null;

      const merged = mergeAuthIntoRequestBody(jsonBody);
      const streamRes = await fetch(`${baseUrl}/create/stream`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify(merged),
      });

      if (streamRes.ok && streamRes.body) {
        const reader = streamRes.body.getReader();
        const dec = new TextDecoder();
        let buf = '';
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const parts = buf.split('\n\n');
          buf = parts.pop() ?? '';
          for (const block of parts) {
            for (const line of block.split('\n')) {
              if (!line.startsWith('data:')) continue;
              const raw = line.slice(5).trim();
              if (!raw) continue;
              let ev: Record<string, unknown>;
              try {
                ev = JSON.parse(raw) as Record<string, unknown>;
              } catch {
                continue;
              }
              const detail = ev.detail as { message_ko?: string } | undefined;
              const step = ev.step as string | undefined;
              const lineMsg =
                detail?.message_ko ||
                [ev.phase, ev.step].filter(Boolean).join(' · ') ||
                '이벤트';
              appendStep(lineMsg);
              if (step === 'stream_error') {
                throw new Error(detail?.message_ko || 'stream_error');
              }
              if (step === 'workflow_finished') {
                const resObj = (detail as { result?: CreateReportResponse } | undefined)?.result;
                if (resObj) body = resObj;
              }
            }
          }
        }
      }

      if (!body) {
        const res = await fetchWithAuthJson(`${baseUrl}/create`, {
          method: 'POST',
          jsonBody,
        });
        if (!res.ok) {
          const t = await res.text();
          throw new Error(t || res.statusText || '요청 실패');
        }
        body = (await res.json()) as CreateReportResponse;
        appendStep('(스트림 미사용) 동기 응답 수신');
      }

      applyCreateResult(body);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '요청에 실패했습니다.';
      setRequestError(msg);
      setAgentReplies((prev) => ({ ...prev, [pk]: `요청 실패\n${msg}` }));
      setPageValidations((prev) => ({ ...prev, [pk]: undefined }));
      setPageDataProvenance((prev) => ({ ...prev, [pk]: undefined }));
    } finally {
      setGenerating(false);
    }
  }

  useEffect(() => {
    setEditingStandardIndex(null);
    setEditingStandardValue('');
    setNewStandard('');
  }, [selectedPage?.page]);

  function addBlock(b: ChartBlockPayload | TableBlockPayload | InfographicBlockPayload) {
    if (!pageKey) return;
    setBlocks((prev) => ({
      ...prev,
      [pageKey]: [...(prev[pageKey] || []), { ...b, id: uid() } as PageContentBlock],
    }));
    setActiveTab('content');
    setInfographicEdit(null);
  }

  function saveInfographicEdit(blockId: string, payload: InfographicBlockPayload) {
    if (!pageKey) return;
    setBlocks((prev) => ({
      ...prev,
      [pageKey]: (prev[pageKey] || []).map((bl) =>
        bl.id === blockId ? ({ ...payload, id: blockId } as PageContentBlock) : bl,
      ),
    }));
    setInfographicEdit(null);
    setActiveTab('content');
  }

  function removeBlock(id: string) {
    if (!pageKey) return;
    setBlocks((prev) => ({
      ...prev,
      [pageKey]: (prev[pageKey] || []).filter((b) => b.id !== id),
    }));
  }

  const suggestions = selectedPage ? getInfographicSuggestions(selectedPage.standards) : [];
  const templateRecs = selectedPage ? getRecommendedInfographicTemplates(selectedPage.standards) : [];
  const totalBlocks = Object.values(blocks).reduce((a, arr) => a + arr.length, 0);

  function seriesForPreview(chart: ChartBlockPayload): ChartSeriesState[] {
    return chart.series.map((s, i) => ({
      id: `s-${i}`,
      name: s.name,
      type: s.type,
      color: s.color,
      labels: s.labels,
      values: s.values,
    }));
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-[#f7f8fa] text-[#222] overflow-hidden font-sans">
      <header className="h-[50px] shrink-0 bg-white border-b border-[#e4e6ea] flex items-center justify-between px-5 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-[30px] h-[30px] rounded-lg bg-gradient-to-br from-[#2d6a4f] to-[#5a9e6e] flex items-center justify-center text-white text-sm font-bold">
            SR
          </div>
          <span className="text-[15px] font-bold text-[#222]">페이지별 작성</span>
          <span className="text-[11px] text-[#aaa]">지주사 편집</span>
        </div>
        <span className="text-[11px] text-[#888]">
          페이지 {pagesData.length}개 · 블록 {totalBlocks}개
        </span>
      </header>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <aside className="w-64 shrink-0 bg-white border-r border-[#e4e6ea] flex flex-col">
          <div className="px-3.5 pt-3.5 pb-2.5 border-b border-[#f0f0f0]">
            <div className="mb-2">
              <div className="text-[11px] font-bold text-[#2d6a4f] tracking-wide">페이지 목록</div>
            </div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="페이지·공시기준 검색..."
              className="w-full bg-[#f5f6f8] border border-[#e4e6ea] rounded-md py-1.5 px-2.5 text-xs text-[#222] outline-none box-border"
            />
          </div>
          <div className="flex-1 overflow-y-auto">
            {visibleSections.map((sec) => {
              const pages = filtered.filter((p) => p.section === sec);
              if (!pages.length) return null;
              return (
                <div key={sec}>
                  <SectionHeader section={sec} />
                  {pages.map((p) => {
                    const pKey = String(p.page);
                    const blkCount = (blocks[pKey] || []).length;
                    const hasText = !!pageTexts[pKey];
                    const active = selectedPage?.page === p.page;
                    return (
                      <PageListItem
                        key={p.page}
                        page={p}
                        active={active}
                        hasText={hasText}
                        blockCount={blkCount}
                        onSelect={() => {
                          setSelectedPage(p);
                          setActiveTab('content');
                        }}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </aside>

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {!selectedPage ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-[#ccc]">
              <div className="text-5xl">📄</div>
              <div className="text-sm text-[#bbb]">좌측에서 편집할 페이지를 선택하세요</div>
            </div>
          ) : (
            <>
              <div className="shrink-0 px-6 pt-4 pb-0 border-b border-[#e4e6ea] bg-white">
                <div className="flex justify-between items-start gap-4">
                  <div className="min-w-0">
                    <div className="text-[10px] text-[#aaa] font-mono mb-0.5">
                      PAGE {selectedPage.page} · {selectedPage.section}
                    </div>
                    <h2 className="text-[17px] font-bold text-[#222]">{selectedPage.title}</h2>
                    <div className="mt-1.5 flex flex-wrap gap-1.5 items-center">
                      {selectedPage.standards.map((s, idx) => {
                        const isEditing = editingStandardIndex === idx;
                        return isEditing ? (
                          <div key={`edit-${idx}`} className="inline-flex items-center gap-1">
                            <input
                              value={editingStandardValue}
                              onChange={(e) => setEditingStandardValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveEditStandard();
                                if (e.key === 'Escape') cancelEditStandard();
                              }}
                              className="h-6 min-w-[120px] bg-white border border-[#cfe2d7] rounded-full px-2.5 text-[10px] text-[#2d6a4f] outline-none"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={saveEditStandard}
                              className="text-[10px] text-[#2d6a4f] font-semibold hover:underline"
                            >
                              저장
                            </button>
                            <button
                              type="button"
                              onClick={cancelEditStandard}
                              className="text-[10px] text-[#999] hover:underline"
                            >
                              취소
                            </button>
                          </div>
                        ) : (
                          <span
                            key={`${s}-${idx}`}
                            className="inline-flex items-center gap-1 text-[10px] bg-[#edf5ef] text-[#2d6a4f] rounded-full px-2 py-0.5"
                          >
                            {s}
                            <button
                              type="button"
                              onClick={() => startEditStandard(idx, s)}
                              className="text-[#2d6a4f] hover:underline"
                              title="DP 수정"
                            >
                              수정
                            </button>
                            <button
                              type="button"
                              onClick={() => removeStandard(s)}
                              className="text-[#999] hover:text-[#c06020]"
                              title="DP 삭제"
                            >
                              ✕
                            </button>
                          </span>
                        );
                      })}
                      <div className="inline-flex items-center gap-1">
                        <input
                          value={newStandard}
                          onChange={(e) => setNewStandard(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') addStandard();
                          }}
                          placeholder="DP 추가"
                          className="h-6 w-[120px] bg-white border border-[#e4e6ea] rounded-full px-2.5 text-[10px] outline-none"
                        />
                        <button
                          type="button"
                          onClick={addStandard}
                          className="text-[10px] text-[#2d6a4f] font-semibold hover:underline"
                        >
                          추가
                        </button>
                      </div>
                    </div>
                  </div>
                  {activeTab === 'content' && (
                    <button
                      type="button"
                      onClick={() => void generateText()}
                      disabled={generating}
                      className="shrink-0 flex items-center gap-2 py-2 px-4 rounded-lg bg-[#2d6a4f] text-white text-xs font-bold disabled:opacity-60"
                    >
                      {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>✦</span>}
                      {generating ? '생성 중...' : 'AI 문단 생성'}
                    </button>
                  )}
                </div>
                <div className="flex gap-0 mt-3 flex-wrap">
                  {(
                    [
                      ['content', '📝 본문 편집'],
                      ['accuracy', '🎯 정확도·피드백'],
                      ['dp-mapping', '🔗 DP매핑'],
                      ['chart', '📊 차트(자유)'],
                      ['table', '📋 표'],
                      ['infographic', '🎨 인포그래픽'],
                    ] as const
                  ).map(([t, label]) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setActiveTab(t)}
                      className={`py-2 px-[18px] text-xs font-semibold cursor-pointer border-none bg-transparent border-b-2 transition-colors ${
                        activeTab === t
                          ? 'text-[#2d6a4f] border-[#2d6a4f]'
                          : 'text-[#888] border-transparent'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex min-h-0 flex-1 overflow-hidden">
                <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
                  {activeTab === 'content' && (
                    <>
                      <div className="min-w-0 bg-[#f7fbf8] border border-[#dbe9df] rounded-[10px] p-3.5">
                        <div className="text-[11px] font-bold text-[#2d6a4f] tracking-wide mb-2">
                          문단생성 에이전트 응답
                        </div>
                        {(generating || currentGenerationSteps.length > 0) && (
                          <details
                            className="mb-2 min-w-0 max-w-full rounded-lg border border-[#cfe2d7] bg-white/80 px-2.5 py-2"
                            open={generating}
                          >
                            <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[11px] font-semibold text-[#2d6a4f] [&::-webkit-details-marker]:hidden">
                              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#4a90d9] to-[#2d6a4f] text-[10px] text-white">
                                ✦
                              </span>
                              <span className="min-w-0 flex-1 break-words">
                                {generating
                                  ? currentGenerationSteps[currentGenerationSteps.length - 1] ||
                                    '에이전트 처리 중…'
                                  : '진행 로그'}
                              </span>
                              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[#888] [[details[open]_&]]:rotate-180 transition-transform" />
                            </summary>
                            <ol className="mt-2 max-h-[160px] min-w-0 overflow-x-hidden overflow-y-auto border-t border-[#e8efe9] pt-2 text-[10px] leading-relaxed text-[#555]">
                              {currentGenerationSteps.map((s, i) => {
                                const isActive =
                                  generating && i === currentGenerationSteps.length - 1;
                                return (
                                  <li
                                    key={`${i}-${s.slice(0, 24)}`}
                                    className="mb-1.5 flex min-w-0 items-start gap-1.5 pl-0.5"
                                  >
                                    <span className="min-w-0 flex-1 break-words pr-1">
                                      <span className="text-[#aaa]">{i + 1}. </span>
                                      {s}
                                    </span>
                                    <span
                                      className="mt-px flex h-3 w-3 shrink-0 items-center justify-center self-start"
                                      aria-hidden
                                      title={isActive ? '진행 중' : '완료'}
                                    >
                                      {isActive ? (
                                        <span className="box-border inline-block h-2.5 w-2.5 rounded-full border-2 border-[#e8eef3] border-t-[#4a90d9] animate-spin" />
                                      ) : (
                                        <Check
                                          className="h-2.5 w-2.5 text-[#2d6a4f]"
                                          strokeWidth={3}
                                          aria-hidden
                                        />
                                      )}
                                    </span>
                                  </li>
                                );
                              })}
                            </ol>
                          </details>
                        )}
                        <textarea
                          value={currentReply}
                          readOnly
                          placeholder="아직 생성된 에이전트 응답이 없습니다. 상단의 'AI 문단 생성' 버튼을 눌러주세요."
                          className="w-full min-h-[120px] border border-[#dde1e7] rounded-[8px] py-2.5 px-3 text-[12px] leading-[1.7] resize-y outline-none text-[#444] bg-white box-border"
                        />
                        {requestError && (
                          <div className="mt-2 text-[11px] text-[#c06020]">
                            {requestError}
                          </div>
                        )}
                        {currentLayoutBlocks.length > 0 && (
                          <div className="mt-3 border-t border-[#e4e6ea] pt-2.5">
                            <div className="text-[11px] font-bold text-[#2d6a4f] mb-1.5">추천 레이아웃</div>
                            <div className="flex flex-col gap-1.5">
                              {currentLayoutBlocks.map((bl, i) => (
                                <div key={`${bl.kind}-${i}`} className="text-[11px] bg-white border border-[#e4e6ea] rounded-md p-2">
                                  {bl.kind === 'table' && (
                                    <>
                                      <div className="font-semibold text-[#2d6a4f]">표 추천</div>
                                      <div className="text-[#555] whitespace-pre-wrap">{bl.markdown || '-'}</div>
                                      {bl.note && <div className="text-[#888] mt-1">{bl.note}</div>}
                                    </>
                                  )}
                                  {bl.kind === 'image_recommendation' && (
                                    <>
                                      <div className="font-semibold text-[#2d6a4f]">{bl.role || '이미지 추천'}</div>
                                      <div className="text-[#555]">ref: {bl.image_ref || '-'}</div>
                                      <div className="text-[#555]">위치: {bl.placement_hint || '-'}</div>
                                      <div className="text-[#777] mt-1">{bl.rationale_ko || '-'}</div>
                                    </>
                                  )}
                                  {bl.kind === 'paragraph' && (
                                    <>
                                      <div className="font-semibold text-[#2d6a4f]">문단 블록</div>
                                      <div className="text-[#555] whitespace-pre-wrap">{bl.text || '-'}</div>
                                    </>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      <textarea
                        value={currentText}
                        onChange={(e) =>
                          pageKey &&
                          setPageTexts((prev) => ({ ...prev, [pageKey]: e.target.value }))
                        }
                        placeholder={`${selectedPage.title} 페이지의 내용을 작성하거나 AI 생성을 활용하세요.\n\n계열사로부터 받은 DP 내용이 여기에 취합됩니다.`}
                        className="w-full min-h-[200px] border border-[#dde1e7] rounded-[10px] py-3.5 px-4 text-[13px] leading-[1.9] resize-y outline-none text-[#333] bg-white box-border"
                      />
                      {currentBlocks.length > 0 && (
                        <div>
                          <div className="text-[11px] font-bold text-[#2d6a4f] tracking-wide mb-2.5">
                            추가된 콘텐츠
                          </div>
                          {currentBlocks.map((block) => (
                            <div
                              key={block.id}
                              className="bg-white border border-[#e4e6ea] rounded-[10px] p-4 mb-3"
                            >
                              <div className="flex justify-between mb-2.5 gap-2">
                                <span className="text-[11px] bg-[#edf5ef] text-[#2d6a4f] rounded-lg px-2.5 py-0.5 font-semibold">
                                  {block.type === 'chart'
                                    ? `📊 ${block.chartType?.split(' ')[0]} 차트`
                                    : block.type === 'infographic'
                                      ? `🎨 인포그래픽 · ${block.templateId}`
                                      : '📋 표'}
                                  {block.type === 'chart' && block.title && ` · ${block.title}`}
                                  {block.type === 'table' && block.tableTitle && ` · ${block.tableTitle}`}
                                </span>
                                <div className="flex items-center gap-2 shrink-0">
                                  {block.type === 'infographic' && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setInfographicEdit({
                                          id: block.id,
                                          payload: {
                                            type: 'infographic',
                                            templateId: block.templateId,
                                            schemaVersion: block.schemaVersion,
                                            dataSource: block.dataSource,
                                            props: block.props,
                                          } as InfographicBlockPayload,
                                        });
                                        setActiveTab('infographic');
                                      }}
                                      className="text-[10px] text-[#457b9d] font-semibold underline-offset-2 hover:underline"
                                    >
                                      편집
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => removeBlock(block.id)}
                                    className="bg-transparent border-none text-[#ccc] cursor-pointer text-base leading-none"
                                    aria-label="삭제"
                                  >
                                    ✕
                                  </button>
                                </div>
                              </div>
                              {block.type === 'chart' && (
                                <HoldingChartSVG
                                  chartType={block.chartType}
                                  series={seriesForPreview(block)}
                                  title={block.title}
                                />
                              )}
                              {block.type === 'table' && <HoldingTableBlock block={block} />}
                              {block.type === 'infographic' && <HoldingInfographicSvg block={block} />}
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                  {activeTab === 'accuracy' && <HoldingValidationPanel v={currentValidation} />}
                  {activeTab === 'dp-mapping' && selectedPage && (
                    <DpMappingPanel
                      mappings={pageDpMappings[selectedPage.page] ?? []}
                      pageStandards={selectedPage.standards}
                      provenance={pageDataProvenance[selectedPage.page]}
                    />
                  )}
                  {activeTab === 'chart' && <HoldingChartEditor onAdd={addBlock} />}
                  {activeTab === 'table' && <HoldingTableEditor onAdd={addBlock} />}
                  {activeTab === 'infographic' && selectedPage && (
                    <HoldingInfographicEditor
                      standards={selectedPage.standards}
                      onAdd={addBlock}
                      onSwitchToFreeChart={() => setActiveTab('chart')}
                      editTarget={infographicEdit}
                      onSaveEdit={saveInfographicEdit}
                      onCancelEdit={() => setInfographicEdit(null)}
                    />
                  )}
                </div>

                <aside className="w-[200px] shrink-0 border-l border-[#e4e6ea] px-3.5 py-4 overflow-y-auto bg-[#fafafa]">
                  <div className="text-[10px] font-bold text-[#2d6a4f] tracking-wide mb-2.5">인포그래픽 템플릿</div>
                  {templateRecs.slice(0, 5).map((t) => (
                    <button
                      key={t.templateId}
                      type="button"
                      onClick={() => {
                        setInfographicEdit(null);
                        setActiveTab('infographic');
                      }}
                      className="w-full text-left bg-white border border-[#e4e6ea] rounded-lg p-2.5 text-[10px] text-[#333] mb-2 cursor-pointer hover:border-[#5a9e6e] hover:bg-[#f8fdf9] transition-colors"
                    >
                      <div className="font-semibold text-[#2d6a4f] mb-0.5">{t.title}</div>
                      <div className="text-[#888] line-clamp-3">{t.description}</div>
                    </button>
                  ))}
                  <div className="text-[10px] font-bold text-[#888] tracking-wide mb-2 mt-4">문구 아이디어</div>
                  {suggestions.map((s, i) => (
                    <div
                      key={i}
                      className="w-full text-left bg-[#f5f6f8] border border-[#e8e8e8] rounded-lg p-2 text-[10px] text-[#555] mb-2"
                    >
                      <span className="mr-1">{INFO_ICONS[i % INFO_ICONS.length]}</span>
                      {s}
                    </div>
                  ))}
                  <div className="mt-3 p-2.5 bg-[#f5f6f8] rounded-lg text-[10px] text-[#aaa] leading-relaxed">
                    공시기준 기반 자동 추천
                    <br />
                    {selectedPage.standards.slice(0, 3).join(', ')}
                  </div>
                  <div className="mt-4 p-2.5 bg-white border border-[#e4e6ea] rounded-lg">
                    <div className="text-[10px] font-bold text-[#666] mb-1.5">페이지 완성도</div>
                    <div className="flex flex-col gap-1">
                      {[
                        { label: '본문', done: !!currentText },
                        { label: '시각화', done: currentBlocks.length > 0 },
                      ].map((item) => (
                        <div
                          key={item.label}
                          className={`flex items-center gap-1.5 text-[11px] ${
                            item.done ? 'text-[#2d6a4f]' : 'text-[#bbb]'
                          }`}
                        >
                          <span>{item.done ? '✅' : '⭕'}</span> {item.label}
                        </div>
                      ))}
                    </div>
                  </div>
                </aside>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

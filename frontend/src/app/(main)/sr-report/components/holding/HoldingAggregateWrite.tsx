'use client';

import { useState, useEffect, useMemo } from 'react';
import { DP_MASTER_LIST, DP_AGGREGATIONS } from '../../lib/platformData';
import type { DpAggregation, DpAggregationStatus, DpSidebarPillTone } from '../../lib/platformTypes';
import {
  buildQualitativeTextsFromContributionsForDp,
  buildQuantSubmissionsFromContributionsForDp,
  fetchSrContributions,
  rankQuantColumnKeysFromSubmissions,
  subsidiaryOrderFromContributionsForDp,
  type SrContributionApiRow,
} from '../../lib/holdingAggregateApi';
import { isHoldingCompany, useAuthSessionStore } from '@/store/authSessionStore';

interface HoldingAggregateWriteProps {
  onInsertToReport?: () => void;
  /** 대시보드 매트릭스 등에서 dpCode로 진입 시 해당 DP 선택 */
  initialDpId?: string | null;
  /** 행(자회사/사업장) 식별자 — 후속 UI 하이라이트·필터용 */
  focusEntityId?: string | null;
}

const STD_TAG = {
  GRI: { bg: '#E1F5EE', color: '#085041' },
  ISSB: { bg: '#E6F1FB', color: '#0C447C' },
  ESRS: { bg: '#FAEEDA', color: '#633806' },
} as const;

const STATUS_STYLE: Record<DpAggregationStatus, { bg: string; color: string; label: string }> = {
  AGGREGATING: { bg: '#f1efef', color: '#888', label: '취합중' },
  REVIEWING: { bg: '#FFF8E7', color: '#EF9F27', label: '검토중' },
  CONFIRMED: { bg: '#E1F5EE', color: '#085041', label: '확정' },
};

const SUBS_STATUS: Record<string, { label: string; color: string }> = {
  DRAFT: { label: '작성중', color: '#888' },
  SUBMITTED: { label: '제출', color: '#185FA5' },
  REVISION_REQUESTED: { label: '수정요청', color: '#EF9F27' },
  ACCEPTED: { label: '승인', color: '#085041' },
};

const PILL_TONE_TO_STD: Record<DpSidebarPillTone, keyof typeof STD_TAG> = {
  gri: 'GRI',
  issb: 'ISSB',
  esrs: 'ESRS',
};

function DisclosurePill({ code, tone }: { code: string; tone: DpSidebarPillTone }) {
  const s = STD_TAG[PILL_TONE_TO_STD[tone]];
  return (
    <span
      className="inline-block max-w-full break-all px-1 py-0.5 rounded text-[9px] font-medium leading-snug"
      style={{
        background: s.bg,
        color: s.color,
      }}
    >
      {code}
    </span>
  );
}

const DEFAULT_REPORT_YEAR = 2024;
/** DB 시드(삼성SDS 데모)에서 계열사 parent_company_id 로 쓰이는 지주 UUID가 많음 */
const DEFAULT_AGGREGATE_HOLDING_ID = '550e8400-e29b-41d4-a716-446655440000';

function humanizeQuantKey(k: string): string {
  return k.replace(/_/g, ' ');
}

export function HoldingAggregateWrite({
  onInsertToReport,
  initialDpId,
  focusEntityId,
}: HoldingAggregateWriteProps) {
  const user = useAuthSessionStore((s) => s.user);
  const holdingCompanyId = useMemo(() => {
    if (isHoldingCompany(user) && user?.company_id?.trim()) return user.company_id.trim();
    return (
      process.env.NEXT_PUBLIC_SR_AGGREGATE_HOLDING_ID ??
      process.env.NEXT_PUBLIC_SR_HOLDING_COMPANY_ID ??
      DEFAULT_AGGREGATE_HOLDING_ID
    ).trim();
  }, [user]);

  const [selectedDpId, setSelectedDpId] = useState<string>(() => {
    if (initialDpId && DP_MASTER_LIST.some((d) => d.dp_id === initialDpId)) return initialDpId;
    return DP_MASTER_LIST[0]?.dp_id ?? '';
  });
  const [standardTab, setStandardTab] = useState<'gri' | 'issb' | 'esrs'>('gri');
  const [finalValue, setFinalValue] = useState<string>('');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [integratedText, setIntegratedText] = useState('');

  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);
  /** null: 아직 로드 전·API 실패, 배열: subsidiary_data_contributions 조회 완료 */
  const [contribRows, setContribRows] = useState<SrContributionApiRow[] | null>(null);

  const dp = DP_MASTER_LIST.find((d) => d.dp_id === selectedDpId);
  const baseAgg = dp ? DP_AGGREGATIONS[dp.dp_id] : null;

  // 현재 기준 탭에 해당하는 필드만 (coverage 확인)
  const hasGri = !!dp?.coverage.gri;
  const hasIssb = !!dp?.coverage.issb;
  const hasEsrs = !!dp?.coverage.esrs;

  const activeTabs = [
    hasGri && { id: 'gri' as const, label: 'GRI 취합' },
    hasIssb && { id: 'issb' as const, label: 'ISSB 취합' },
    hasEsrs && { id: 'esrs' as const, label: 'ESRS 취합' },
  ].filter(Boolean) as { id: 'gri' | 'issb' | 'esrs'; label: string }[];

  const currentTabId = activeTabs.find((t) => t.id === standardTab) ? standardTab : activeTabs[0]?.id ?? 'gri';
  const fields = dp ? dp.fields[currentTabId] ?? [] : [];
  const quantFields = fields.filter((f) => !f.is_qualitative && f.field_type === 'NUMBER');
  const qualFields = fields.filter((f) => f.is_qualitative);

  const isQuantitative = dp && ['SUM', 'WEIGHTED_AVG'].includes(dp.aggregation_method);

  const orderForDp = useMemo(() => {
    if (contribRows === null || !dp) return [];
    return subsidiaryOrderFromContributionsForDp(holdingCompanyId, contribRows, dp);
  }, [contribRows, dp, holdingCompanyId]);

  const agg: DpAggregation | null = useMemo(() => {
    if (!baseAgg || !dp) return null;
    if (contribRows === null) return baseAgg;

    const subs = buildQuantSubmissionsFromContributionsForDp(holdingCompanyId, contribRows, dp);
    const qualTexts = buildQualitativeTextsFromContributionsForDp(
      holdingCompanyId,
      contribRows,
      dp,
      orderForDp,
    );

    return {
      ...baseAgg,
      report_year: DEFAULT_REPORT_YEAR,
      subsidiary_submissions: subs,
      qualitative: {
        ...baseAgg.qualitative,
        subsidiary_texts: qualTexts,
      },
    };
  }, [baseAgg, dp, contribRows, holdingCompanyId, orderForDp]);

  const contribQuantKeys = useMemo(() => {
    if (contribRows === null || !agg) return [];
    return rankQuantColumnKeysFromSubmissions(agg.subsidiary_submissions, 14);
  }, [contribRows, agg]);

  const tableQuantColumns = useMemo((): { field_id: string; label_ko: string; unit?: string }[] => {
    if (contribRows !== null) {
      return contribQuantKeys.length > 0
        ? contribQuantKeys.map((k) => ({ field_id: k, label_ko: humanizeQuantKey(k) }))
        : [];
    }
    return quantFields;
  }, [contribRows, contribQuantKeys, quantFields]);

  /** QUALITATIVE DP라도 DB quantitative_data 컬럼이 있으면 표 표시 (집계 푸터는 isQuantitative일 때만) */
  const showQuantSection = tableQuantColumns.length > 0;
  const showQualSection = qualFields.length > 0 || (contribRows !== null && orderForDp.length > 0);

  useEffect(() => {
    if (!holdingCompanyId) return;
    let cancelled = false;
    setLiveLoading(true);
    setLiveError(null);
    (async () => {
      try {
        const cr = await fetchSrContributions(holdingCompanyId, DEFAULT_REPORT_YEAR);
        if (cancelled) return;
        setContribRows(cr.contributions);
      } catch (e) {
        if (!cancelled) {
          setLiveError(e instanceof Error ? e.message : '데이터 조회 실패');
          setContribRows(null);
        }
      } finally {
        if (!cancelled) setLiveLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [holdingCompanyId]);

  useEffect(() => {
    if (!initialDpId || !DP_MASTER_LIST.some((d) => d.dp_id === initialDpId)) return;
    setSelectedDpId(initialDpId);
  }, [initialDpId]);

  /** ESRS_ONLY 등 단일 기준 DP는 해당 탭으로 초기 포커스 */
  useEffect(() => {
    const d = DP_MASTER_LIST.find((x) => x.dp_id === selectedDpId);
    if (!d) return;
    const g = !!d.coverage.gri;
    const i = !!d.coverage.issb;
    const e = !!d.coverage.esrs;
    const n = [g, i, e].filter(Boolean).length;
    if (n !== 1) return;
    if (e) setStandardTab('esrs');
    else if (i) setStandardTab('issb');
    else setStandardTab('gri');
  }, [selectedDpId]);

  // DP 선택 시 기존 확정값 로드
  useEffect(() => {
    const a = selectedDpId ? DP_AGGREGATIONS[selectedDpId] : null;
    if (a) {
      setFinalValue(a.quantitative.final_value != null ? String(a.quantitative.final_value) : '');
      setAdjustmentReason(a.quantitative.adjustment_reason ?? '');
      setIntegratedText(a.qualitative.integrated_text);
    }
  }, [selectedDpId]);

  const handleSelectDp = (id: string) => {
    setSelectedDpId(id);
  };

  const handlePrevDp = () => {
    const idx = DP_MASTER_LIST.findIndex((d) => d.dp_id === selectedDpId);
    if (idx > 0) handleSelectDp(DP_MASTER_LIST[idx - 1].dp_id);
  };

  const handleNextDp = () => {
    const idx = DP_MASTER_LIST.findIndex((d) => d.dp_id === selectedDpId);
    if (idx >= 0 && idx < DP_MASTER_LIST.length - 1) handleSelectDp(DP_MASTER_LIST[idx + 1].dp_id);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {focusEntityId ? (
        <div className="shrink-0 px-4 py-1.5 text-[11px] text-[#185FA5] bg-[#EFF5FC] border-b border-[#d4e4f4]">
          대시보드 연동 · 조직: <span className="font-semibold">{focusEntityId}</span>
        </div>
      ) : null}
      <div className="flex-1 flex min-h-0 min-w-0 overflow-hidden">
      {/* DP 목록 사이드바 */}
      <div className="w-[248px] min-w-[248px] max-w-[280px] bg-white border-r border-[#e8e8e4] flex flex-col overflow-hidden shrink-0">
        <div className="px-3 py-2.5 border-b border-[#e8e8e4] text-[10px] font-medium text-[#888] uppercase tracking-wider">
          DP 목록
        </div>
        <div className="flex-1 overflow-y-auto py-1.5">
          {DP_MASTER_LIST.map((d) => {
            const a = DP_AGGREGATIONS[d.dp_id];
            const st = a ? STATUS_STYLE[a.status] : STATUS_STYLE.AGGREGATING;
            const sel = selectedDpId === d.dp_id;
            return (
              <button
                key={d.dp_id}
                type="button"
                onClick={() => handleSelectDp(d.dp_id)}
                className={`w-full px-3 py-2.5 text-left text-xs transition-colors border-l-2 ${
                  sel
                    ? 'bg-[#EFF5FC] border-[#185FA5]'
                    : 'border-transparent hover:bg-[#f8f8f6]'
                }`}
              >
                <div className="font-medium text-[#333] mb-1">{d.dp_name_ko}</div>
                <div className="flex flex-wrap gap-0.5 mb-1">
                  {d.sidebar_pills.map((p) => (
                    <DisclosurePill key={`${d.dp_id}-${p.code}`} code={p.code} tone={p.tone} />
                  ))}
                </div>
                <span
                  className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium"
                  style={{ background: st.bg, color: st.color }}
                >
                  {a ? st.label : '취합중'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 취합 패널 */}
      <div className="flex-1 flex min-h-0 min-w-0 flex-col overflow-hidden">
        {dp && agg ? (
          <>
            {/* 헤더 */}
            <div className="px-4 py-2 bg-white border-b border-[#e8e8e4] shrink-0 space-y-1.5">
              {liveLoading ? (
                <div className="text-[11px] text-[#185FA5] bg-[#EFF5FC] border border-[#d4e4f4] rounded px-2 py-1.5">
                  subsidiary_data_contributions 데이터를 불러오는 중…
                </div>
              ) : null}
              {liveError ? (
                <div className="text-[11px] text-amber-900 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                  {liveError} — 연결 실패 시 목 데이터를 표시합니다.
                </div>
              ) : null}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-[#333]">{dp.dp_name_ko}</span>
                <div className="flex flex-wrap gap-0.5 items-center max-w-full">
                  {dp.sidebar_pills.map((p) => (
                    <DisclosurePill key={`hdr-${dp.dp_id}-${p.code}`} code={p.code} tone={p.tone} />
                  ))}
                </div>
                <span
                  className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold"
                  style={{
                    background: STATUS_STYLE[agg.status].bg,
                    color: STATUS_STYLE[agg.status].color,
                  }}
                >
                  {STATUS_STYLE[agg.status].label}
                </span>
              </div>
            </div>

            {/* 기준 탭 */}
            <div className="px-4 py-1.5 bg-[#fafaf8] border-b border-[#e8e8e4] flex gap-1 shrink-0">
              {activeTabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setStandardTab(t.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded border cursor-pointer transition-colors ${
                    currentTabId === t.id
                      ? 'bg-white border-[#185FA5] text-[#185FA5]'
                      : 'bg-transparent border-[#e8e8e4] text-[#888] hover:bg-white'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* 메인 스크롤 영역: 정량+정성 전체가 이 박스 안에서만 스크롤 (flex-1 자식에 min-h-0 필수) */}
            <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-auto overscroll-y-contain px-4 py-2 flex flex-col gap-4 [scrollbar-gutter:stable]">
              {/* 정량 섹션 */}
              {showQuantSection && (
                <div className="shrink-0 bg-white border border-[#e8e8e4] rounded-lg overflow-hidden">
                  <div className="px-4 py-3 border-b border-[#e8e8e4] text-sm font-semibold text-[#333]">
                    정량 섹션
                    {contribRows !== null && contribQuantKeys.length > 0 ? (
                      <span className="ml-2 text-[11px] font-normal text-[#888]">
                        (quantitative_data · related_dp_ids 매칭)
                      </span>
                    ) : null}
                  </div>
                  <div className="p-4">
                    <table className="w-full border-collapse text-xs">
                      <thead>
                        <tr className="bg-[#fafaf8]">
                          <th className="px-3 py-2 text-left font-medium text-[#888] border-b border-[#e8e8e4]">
                            계열사
                          </th>
                          {tableQuantColumns.map((f) => (
                            <th key={f.field_id} className="px-3 py-2 text-left font-medium text-[#888] border-b border-[#e8e8e4]">
                              {f.label_ko}
                              {f.unit && ` (${f.unit})`}
                            </th>
                          ))}
                          <th className="px-3 py-2 text-left font-medium text-[#888] border-b border-[#e8e8e4]">
                            증감률
                          </th>
                          <th className="px-3 py-2 text-left font-medium text-[#888] border-b border-[#e8e8e4]">
                            방법론
                          </th>
                          <th className="px-3 py-2 text-left font-medium text-[#888] border-b border-[#e8e8e4]">
                            상태
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {agg.subsidiary_submissions.map((sub, i) => {
                          const st = SUBS_STATUS[sub.status];
                          return (
                            <tr key={sub.subsidiary_id} className={i % 2 === 0 ? 'bg-white' : 'bg-[#fafaf8]'}>
                              <td className="px-3 py-2.5 border-b border-[#e8e8e4] font-medium text-[#333]">
                                {sub.subsidiary_name}
                              </td>
                              {tableQuantColumns.map((f) => {
                                const v = sub.values[f.field_id];
                                const disp = v != null ? (typeof v === 'number' ? v.toLocaleString() : String(v)) : '—';
                                return (
                                  <td key={f.field_id} className="px-3 py-2.5 border-b border-[#e8e8e4] font-mono text-[#555]">
                                    {disp}
                                  </td>
                                );
                              })}
                              <td className="px-3 py-2.5 border-b border-[#e8e8e4]">
                                {sub.yoy_change != null ? (
                                  <span className={sub.yoy_change > 0 ? 'text-[#EF9F27]' : ''}>
                                    {sub.yoy_change > 0 ? '+' : ''}{sub.yoy_change}%
                                  </span>
                                ) : '—'}
                              </td>
                              <td className="px-3 py-2.5 border-b border-[#e8e8e4] text-[11px] text-[#666]">
                                {sub.methodology ?? '—'}
                              </td>
                              <td className="px-3 py-2.5 border-b border-[#e8e8e4]">
                                <span
                                  className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium"
                                  style={{ background: `${st.color}18`, color: st.color }}
                                >
                                  {st.label}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    {isQuantitative ? (
                      <div className="mt-4 flex flex-wrap gap-4 items-end">
                        <div>
                          <div className="text-[11px] text-[#888] mb-1">자동 집계</div>
                          <div className="text-lg font-bold font-mono text-[#185FA5]">
                            {agg.quantitative.auto_value != null
                              ? agg.quantitative.auto_value.toLocaleString()
                              : '—'}{' '}
                            {agg.quantitative.unit ?? ''}
                          </div>
                          <div className="text-[10px] text-[#888] mt-0.5">
                            (방식: {dp.aggregation_method})
                          </div>
                        </div>
                        <div>
                          <div className="text-[11px] text-[#888] mb-1">최종 확정값</div>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={finalValue}
                              onChange={(e) => setFinalValue(e.target.value)}
                              placeholder="—"
                              className="w-32 px-2 py-1.5 border border-[#e8e8e4] rounded text-sm font-mono"
                            />
                            <span className="text-xs text-[#888]">{agg.quantitative.unit ?? ''}</span>
                          </div>
                        </div>
                        <div className="flex-1 min-w-[200px]">
                          <div className="text-[11px] text-[#888] mb-1">조정 사유 (자동값과 다를 때 필수)</div>
                          <textarea
                            value={adjustmentReason}
                            onChange={(e) => setAdjustmentReason(e.target.value)}
                            placeholder="자동 집계값과 최종 확정값이 다를 경우 사유를 입력하세요."
                            rows={2}
                            className="w-full px-2 py-1.5 border border-[#e8e8e4] rounded text-xs resize-none"
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              )}

              {/* 정성 섹션 */}
              {showQualSection && (
                <div className="shrink-0 flex flex-col overflow-visible rounded-lg border border-[#e8e8e4] bg-white">
                  <div className="shrink-0 border-b border-[#e8e8e4] px-4 py-2.5 text-sm font-semibold text-[#333]">
                    정성 섹션 — 계열사 서술 원문 (읽기 전용)
                    {contribRows !== null && orderForDp.length > 0 ? (
                      <span className="ml-2 text-[11px] font-normal text-[#888]">(description · related_dp_ids 매칭)</span>
                    ) : null}
                  </div>
                  <div className="space-y-3 p-4">
                    {agg.qualitative.subsidiary_texts.map((t) => (
                      <div
                        key={t.subsidiary_id}
                        className="rounded border border-[#e8e8e4] bg-[#f8f8f6] p-3 text-xs text-[#555]"
                      >
                        <div className="mb-1.5 shrink-0 font-medium text-[#333]">{t.subsidiary_name}</div>
                        <div className="whitespace-pre-wrap break-words leading-relaxed pr-1">{t.text}</div>
                      </div>
                    ))}
                  </div>

                  <div className="shrink-0 border-t border-[#e8e8e4] bg-[#fafaf8] px-4 py-2.5">
                    <div className="mb-1.5 text-sm font-semibold text-[#333]">
                      그룹 통합 서술 (지주사 직접 작성)
                    </div>
                    <p className="mb-2 text-[11px] text-[#888]">
                      위 계열사 원문을 참고하여 그룹 전체의 통합 서술을 작성하세요.
                    </p>
                    <textarea
                      value={integratedText}
                      onChange={(e) => setIntegratedText(e.target.value)}
                      placeholder="계열사 원문을 참고하여 통합 서술을 입력하세요."
                      rows={8}
                      className="w-full px-3 py-2 border border-[#e8e8e4] rounded text-xs resize-none bg-[#F0F4FF]"
                    />
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        type="button"
                        className="h-8 px-3 text-xs border border-[#185FA5] rounded-md bg-white text-[#185FA5] cursor-pointer hover:bg-[#EFF5FC]"
                      >
                        AI 초안 생성
                      </button>
                      <span className="text-[11px] text-[#888]">
                        글자수: {integratedText.length}/1000
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {!showQuantSection && !showQualSection && (
                <div className="text-center py-8 text-[#888] text-sm">
                  이 DP에는 표시할 정량·정성 데이터가 없습니다. (subsidiary_data_contributions · related_dp_ids)
                </div>
              )}
            </div>

            {/* 하단 액션 바 */}
            <div className="flex shrink-0 items-center justify-between border-t border-[#e8e8e4] bg-white px-4 py-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  className="h-8 px-3 text-xs border border-[#EF9F27] rounded-md bg-white text-[#EF9F27] cursor-pointer hover:bg-[#FFF8E7]"
                >
                  수정요청
                </button>
                <button
                  type="button"
                  onClick={handlePrevDp}
                  className="h-8 px-3 text-xs border border-[#e8e8e4] rounded-md bg-white text-[#555] cursor-pointer hover:bg-[#f5f5f5]"
                >
                  이전 DP
                </button>
                <button
                  type="button"
                  onClick={handleNextDp}
                  className="h-8 px-3 text-xs border border-[#e8e8e4] rounded-md bg-white text-[#555] cursor-pointer hover:bg-[#f5f5f5]"
                >
                  다음 DP
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onInsertToReport}
                  className="h-8 px-3 text-xs border border-[#e8e8e4] rounded-md bg-white text-[#555] cursor-pointer hover:bg-[#f5f5f5]"
                >
                  보고서에 삽입
                </button>
                <button
                  type="button"
                  className="h-8 px-4 text-xs border border-[#185FA5] rounded-md bg-[#185FA5] text-white cursor-pointer hover:bg-[#0d4a8a]"
                >
                  기준별 확정 →
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-[#888] text-sm">
            DP를 선택하세요
          </div>
        )}
      </div>
    </div>
    </div>
  );
}

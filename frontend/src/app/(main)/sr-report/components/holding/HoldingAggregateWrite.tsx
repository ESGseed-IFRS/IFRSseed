'use client';

import { useState, useEffect } from 'react';
import { DP_MASTER_LIST, DP_AGGREGATIONS } from '../../lib/platformData';
import type { DpAggregationStatus } from '../../lib/platformTypes';

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

function StdTag({ std, active }: { std: 'GRI' | 'ISSB' | 'ESRS'; active: boolean }) {
  const s = STD_TAG[std];
  return (
    <span
      className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium mr-1"
      style={{
        background: active ? s.bg : '#f5f5f5',
        color: active ? s.color : '#bbb',
        textDecoration: active ? 'none' : 'line-through',
      }}
    >
      {std}
    </span>
  );
}

export function HoldingAggregateWrite({
  onInsertToReport,
  initialDpId,
  focusEntityId,
}: HoldingAggregateWriteProps) {
  const [selectedDpId, setSelectedDpId] = useState<string>(() => {
    if (initialDpId && DP_MASTER_LIST.some((d) => d.dp_id === initialDpId)) return initialDpId;
    return DP_MASTER_LIST[0]?.dp_id ?? '';
  });
  const [standardTab, setStandardTab] = useState<'gri' | 'issb' | 'esrs'>('gri');
  const [finalValue, setFinalValue] = useState<string>('');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [integratedText, setIntegratedText] = useState('');

  const dp = DP_MASTER_LIST.find((d) => d.dp_id === selectedDpId);
  const agg = dp ? DP_AGGREGATIONS[dp.dp_id] : null;

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

  useEffect(() => {
    if (!initialDpId || !DP_MASTER_LIST.some((d) => d.dp_id === initialDpId)) return;
    setSelectedDpId(initialDpId);
  }, [initialDpId]);

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
      <div className="flex-1 flex overflow-hidden min-w-0">
      {/* DP 목록 사이드바 */}
      <div className="w-56 min-w-[224px] bg-white border-r border-[#e8e8e4] flex flex-col overflow-hidden shrink-0">
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
                  <StdTag std="GRI" active={!!d.coverage.gri} />
                  <StdTag std="ISSB" active={!!d.coverage.issb} />
                  <StdTag std="ESRS" active={!!d.coverage.esrs} />
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
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {dp && agg ? (
          <>
            {/* 헤더 */}
            <div className="px-4 py-3 bg-white border-b border-[#e8e8e4] shrink-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-[#333]">{dp.dp_name_ko}</span>
                <StdTag std="GRI" active={!!dp.coverage.gri} />
                <StdTag std="ISSB" active={!!dp.coverage.issb} />
                <StdTag std="ESRS" active={!!dp.coverage.esrs} />
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
            <div className="px-4 py-2 bg-[#fafaf8] border-b border-[#e8e8e4] flex gap-1 shrink-0">
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

            {/* 메인 스크롤 영역 */}
            <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-6">
              {/* 정량 섹션 */}
              {isQuantitative && quantFields.length > 0 && (
                <div className="bg-white border border-[#e8e8e4] rounded-lg overflow-hidden">
                  <div className="px-4 py-3 border-b border-[#e8e8e4] text-sm font-semibold text-[#333]">
                    정량 섹션
                  </div>
                  <div className="p-4">
                    <table className="w-full border-collapse text-xs">
                      <thead>
                        <tr className="bg-[#fafaf8]">
                          <th className="px-3 py-2 text-left font-medium text-[#888] border-b border-[#e8e8e4]">
                            계열사
                          </th>
                          {quantFields.map((f) => (
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
                              {quantFields.map((f) => {
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
                  </div>
                </div>
              )}

              {/* 정성 섹션 */}
              {qualFields.length > 0 && (
                <div className="bg-white border border-[#e8e8e4] rounded-lg overflow-hidden">
                  <div className="px-4 py-3 border-b border-[#e8e8e4] text-sm font-semibold text-[#333]">
                    정성 섹션 — 계열사 서술 원문 (읽기 전용)
                  </div>
                  <div className="p-4 space-y-3">
                    {agg.qualitative.subsidiary_texts.map((t) => (
                      <div
                        key={t.subsidiary_id}
                        className="p-3 bg-[#f8f8f6] border border-[#e8e8e4] rounded text-xs text-[#555]"
                      >
                        <div className="font-medium text-[#333] mb-1.5">{t.subsidiary_name}</div>
                        <div className="whitespace-pre-wrap leading-relaxed">{t.text}</div>
                      </div>
                    ))}
                  </div>

                  <div className="px-4 py-3 border-t border-[#e8e8e4] bg-[#fafaf8]">
                    <div className="text-sm font-semibold text-[#333] mb-2">
                      그룹 통합 서술 (지주사 직접 작성)
                    </div>
                    <p className="text-[11px] text-[#888] mb-2">
                      위 계열사 원문을 참고하여 그룹 전체의 통합 서술을 작성하세요.
                    </p>
                    <textarea
                      value={integratedText}
                      onChange={(e) => setIntegratedText(e.target.value)}
                      placeholder="계열사 원문을 참고하여 통합 서술을 입력하세요."
                      rows={6}
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

              {!isQuantitative && qualFields.length === 0 && (
                <div className="text-center py-8 text-[#888] text-sm">
                  이 DP에는 정량·정성 필드가 없습니다.
                </div>
              )}
            </div>

            {/* 하단 액션 바 */}
            <div className="px-4 py-3 bg-white border-t border-[#e8e8e4] flex items-center justify-between shrink-0">
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

'use client';

import { useMemo, useState } from 'react';
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  Search,
} from 'lucide-react';
import { LineageFlow } from './LineageFlow';
import { AUDIT_CURRENT_USER, AUDIT_CURRENT_USER_ID } from './auditApprovalState';
import { canUserActOnApproval } from './approvalWorkflow';
import { buildApprovalInboxFeedEvents } from './data/auditFeedData';
import type { ApprovalStep } from './types/auditEventDto';
import { buildUnifiedTimeline, type UnifiedTimelineEvent } from './data/unifiedTimeline';
import type { AuditEventDTO, AuditEventStatus, AuditEventType } from './types/auditEventDto';

const TYPE_LABEL: Record<AuditEventType, string> = {
  change: '데이터 변경',
  lineage: '계보',
  emission_factor: '배출계수',
  version: '산정 버전',
  freeze: 'Freeze',
};

const STATUS_LABEL: Record<AuditEventStatus, string> = {
  approved: '승인완료',
  pending: '검토중',
  rejected: '반려',
  skipped: '생략',
};

const STATUS_CLASS: Record<AuditEventStatus, string> = {
  approved: 'border-slate-200 bg-slate-50 text-slate-700',
  pending: 'border-slate-200 bg-slate-50 text-slate-700',
  rejected: 'border-slate-200 bg-slate-50 text-slate-700',
  skipped: 'border-slate-200 bg-slate-50 text-slate-600',
};

const STATUS_DOT_CLASS: Record<AuditEventStatus, string> = {
  approved: 'bg-emerald-600',
  pending: 'bg-amber-500',
  rejected: 'bg-red-500',
  skipped: 'bg-slate-300',
};

function summaryStatusChip(status: AuditEventStatus): string {
  if (status === 'approved') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'rejected') return 'border-red-200 bg-red-50 text-red-700';
  if (status === 'pending') return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-slate-200 bg-slate-50 text-slate-600';
}

/** 통합 감사 추적 본문 — 기존 900px 제한 해제, 대형 화면에서 가독성 확대 */
const FEED_CONTAINER = 'mx-auto w-full max-w-screen-xl';

function formatFeedDateTime(value: string): string {
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  const hh = String(dt.getHours()).padStart(2, '0');
  const min = String(dt.getMinutes()).padStart(2, '0');
  return `${mm}.${dd} ${hh}:${min}`;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2.5 text-xs font-bold uppercase tracking-[0.07em] text-slate-400">{children}</div>
  );
}

function findEventByIdExact(events: AuditEventDTO[], raw: string): string | null {
  const q = raw.trim().toUpperCase().replace(/\s+/g, '');
  if (!q) return null;
  return (
    events.find(
      (e) =>
        e.id.toUpperCase() === q ||
        e.id.replace(/^chg-/i, '').toUpperCase() === q ||
        e.id.toUpperCase().endsWith(q)
    )?.id ?? null
  );
}

/** AuditTrail_clean.jsx — 3열: 상세+계보 | 계수+영향도 | 결재 */
function ExpandedPanel({
  ev,
  unified,
  onGoApproval,
}: {
  ev: AuditEventDTO;
  unified: UnifiedTimelineEvent | undefined;
  onGoApproval?: () => void;
}) {
  const steps = ev.approvalSteps;
  const pending = steps.some((s) => s.status === 'pending');
  const myTurn = canUserActOnApproval(steps, AUDIT_CURRENT_USER, AUDIT_CURRENT_USER_ID);
  const d = ev.details;
  const eventStatus = ev.status;

  const lineageNodes =
    d.kind === 'change' && d.lineage?.length
      ? d.lineage
      : d.kind === 'lineage' && d.lineage?.length
        ? d.lineage
        : null;
  const lineageDetails =
    d.kind === 'change' && d.lineageDetail?.length
      ? d.lineageDetail
      : d.kind === 'lineage' && d.lineageDetail?.length
        ? d.lineageDetail
        : undefined;

  const showFactorMid = d.kind === 'change' && !!(d.factorName && ev.type !== 'emission_factor');
  const showVersionImpact = d.kind === 'change' || d.kind === 'version';
  const hasMiddleCol = true;

  return (
    <div className="border-t border-slate-200 bg-[#FAFBFC] px-5 py-6 md:px-8" role="region" aria-label={`${ev.id} 상세`}>
      <div
        className={`grid w-full grid-cols-1 gap-6 ${
          hasMiddleCol ? 'lg:grid-cols-[1.1fr_1.1fr_minmax(300px,1fr)]' : 'lg:grid-cols-[1fr_minmax(300px,1fr)]'
        }`}
      >
        {/* 좌: 상세 + Data Lineage */}
        <div className="flex min-w-0 flex-col gap-4">
          <section>
            <SectionLabel>상세 내역</SectionLabel>
            {d.kind === 'change' && (
              <>
                <div className="mb-2 grid grid-cols-2 gap-3">
                  <div className="rounded-r-md border border-slate-200 border-l-2 border-l-slate-300 bg-white py-3 pl-4 pr-3">
                    <div className="mb-1 text-xs text-slate-400">이전 값</div>
                    <div className="text-sm text-slate-400 line-through">{d.before}</div>
                  </div>
                  <div className="rounded-r-md border border-slate-200 border-l-2 border-l-[#1A5FA8] bg-white py-3 pl-4 pr-3">
                    <div className="mb-1 text-xs text-[#1A5FA8]">변경 후 값</div>
                    <div className="text-sm font-bold text-slate-900">{d.after}</div>
                  </div>
                </div>
                <div className="rounded-md border border-slate-200 bg-white p-4">
                  <div className="mb-1 text-xs text-slate-400">변경 사유</div>
                  <p className="text-sm italic leading-relaxed text-slate-600">&quot;{d.reason}&quot;</p>
                </div>
              </>
            )}
            {d.kind === 'lineage' && (
              <div className="rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-800">
                추적 ID: <span className="font-semibold text-[#1A5FA8]">{d.lineageRef}</span>
              </div>
            )}
            {d.kind === 'emission_factor' && (
              <div className="space-y-2 rounded-md border border-slate-200 bg-white p-4">
                {[
                  ['계수명', d.factorName],
                  ['값', d.value],
                  ['출처', d.source],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between border-b border-slate-100 py-2 text-sm last:border-0">
                    <span className="text-slate-500">{k}</span>
                    <span className={`font-medium ${k === '값' ? 'text-[#1A5FA8]' : 'text-slate-900'}`}>{v}</span>
                  </div>
                ))}
              </div>
            )}
            {d.kind === 'version' && (
              <div className="rounded-md border border-slate-200 bg-white p-4">
                <div className="mb-3 flex justify-between border-b border-slate-100 pb-2">
                  <span className="text-sm text-slate-500">총 배출량</span>
                  <span className="text-base font-bold text-[#1A5FA8]">{d.totalEmission}</span>
                </div>
                {d.s1 != null && d.s2 != null && d.s3 != null && (
                  <div className="mb-3 grid grid-cols-3 gap-2">
                    {[
                      ['Scope 1', d.s1],
                      ['Scope 2', d.s2],
                      ['Scope 3', d.s3],
                    ].map(([k, v]) => (
                      <div key={k} className="rounded bg-slate-50 px-3 py-2">
                        <div className="text-xs text-slate-400">{k}</div>
                        <div className="text-sm font-semibold">{v} tCO₂e</div>
                      </div>
                    ))}
                  </div>
                )}
                {d.versionDiffRows && d.versionDiffRows.length > 0 && (
                  <>
                    <div className="mb-2 text-xs text-slate-400">변경 기여도</div>
                    {d.versionDiffRows.map((row) => (
                      <div
                        key={row.id}
                        className="mb-1.5 flex items-center justify-between rounded bg-slate-50 px-3 py-2 text-sm"
                      >
                        <div>
                          <span className="mr-2 font-semibold text-[#1A5FA8]">{row.id}</span>
                          {row.item}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-emerald-700">{row.delta}</span>
                          <span className="text-xs text-slate-400">{row.pct}</span>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}
          </section>

          {lineageNodes && (
            <section>
              <SectionLabel>Data Lineage</SectionLabel>
              <LineageFlow nodes={lineageNodes} details={lineageDetails} />
            </section>
          )}

          {unified?.change?.selfApprove && (
            <div className="rounded-md border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
              처리자와 승인자가 동일한 건입니다. 내부통제 검토가 필요할 수 있습니다.
            </div>
          )}
        </div>

        {/* 중: 적용 배출계수 + 버전 영향도 (AuditTrail_clean) */}
        {hasMiddleCol && (
          <div className="flex min-w-0 flex-col gap-4">
            <section>
              <SectionLabel>메타 정보</SectionLabel>
              <div className="rounded-md border border-slate-200 bg-white">
                {[
                  ['문서 ID', ev.id],
                  ['법인', ev.corp],
                  ['기안자', ev.author],
                  ['일자', formatFeedDateTime(ev.at)],
                  ['유형', TYPE_LABEL[ev.type]],
                  ...(ev.scope ? ([['범위', ev.scope]] as [string, string][]) : []),
                ].map(([k, v], idx, arr) => (
                  <div
                    key={k}
                    className={`flex items-start justify-between gap-3 px-4 py-2.5 text-sm ${idx < arr.length - 1 ? 'border-b border-slate-100' : ''}`}
                  >
                    <span className="text-slate-500">{k}</span>
                    <span className="text-right font-medium text-slate-900">
                      {v}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {ev.rejectionHistory && ev.rejectionHistory.length > 0 && (
              <section>
                <SectionLabel>반려 이력</SectionLabel>
                <div className="space-y-2">
                  {ev.rejectionHistory.map((h, idx) => (
                    <div key={`${h.at}-${idx}`} className="rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="font-medium text-red-800">{h.by}</span>
                        <span className="text-xs text-red-700">{formatFeedDateTime(h.at)}</span>
                      </div>
                      <p className="text-red-700">{h.comment}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {showFactorMid && d.kind === 'change' && (
              <section>
                <SectionLabel>적용 배출계수</SectionLabel>
                <div className="rounded-md border border-slate-200 bg-white p-4">
                  {[
                    ['계수명', d.factorName ?? '—'],
                    ['값', d.factorValue ?? '—'],
                    ['출처', d.factorSource ?? '—'],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between border-b border-slate-100 py-2 text-sm last:border-0">
                      <span className="text-slate-500">{k}</span>
                      <span className={`font-medium ${k === '값' ? 'text-[#1A5FA8]' : 'text-slate-900'}`}>{v}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {showVersionImpact && (
              <section>
                <SectionLabel>버전 영향도</SectionLabel>
                {d.kind === 'change' && d.versionImpact != null && d.versionImpact !== '' ? (
                  <div className="rounded-md border border-[#93C5FD] bg-[#EBF4FF] px-4 py-3 text-sm font-medium text-[#1A5FA8]">
                    {d.versionImpact}
                  </div>
                ) : d.kind === 'change' && (d.versionImpact === null || d.versionImpact === '') ? (
                  <p className="text-sm text-slate-400">버전 확정 전 — 영향도 미산정</p>
                ) : d.kind === 'version' ? (
                  <div className="rounded-md border border-[#93C5FD] bg-[#EBF4FF] px-4 py-3 text-sm font-medium text-[#1A5FA8]">
                    {d.diff}
                  </div>
                ) : null}
              </section>
            )}
          </div>
        )}

        {/* 우: 결재 타임라인 */}
        <div className="h-fit rounded-md border border-slate-200 bg-white p-5">
          <div className="mb-4 flex items-start justify-between gap-2 border-b border-slate-200 pb-3">
            <div>
              <span className="text-xs font-bold uppercase tracking-[0.07em] text-slate-400">결재 타임라인</span>
              <p className="mt-1 text-xs text-slate-400">이 요청의 실제 결재 단계</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${STATUS_DOT_CLASS.approved}`} />
              <span className={`h-2 w-2 rounded-full ${pending ? STATUS_DOT_CLASS.pending : 'bg-slate-300'}`} />
              <span className={`h-2 w-2 rounded-full ${eventStatus === 'rejected' ? STATUS_DOT_CLASS.rejected : 'bg-slate-300'}`} />
              <span className={`rounded border px-2 py-0.5 text-[11px] font-medium ${STATUS_CLASS[eventStatus]}`}>
                {STATUS_LABEL[eventStatus]}
              </span>
            </div>
          </div>

          <div className="space-y-3">
            {steps.map((step, idx) => {
              const done = step.status === 'approved';
              const rejected = step.status === 'rejected';
              const current = step.status === 'pending';
              const applied = step.status === 'skipped';
              const displayAt = step.at
                ? formatFeedDateTime(step.at)
                : done || applied
                  ? formatFeedDateTime(ev.at)
                  : '';
              const statusLabel = done ? '승인완료' : rejected ? '반려' : current ? '결재대기' : applied ? '적용완료' : '대기';
              return (
                <div key={`${step.who}-${idx}`} className="flex gap-3">
                  <div className="flex w-5 flex-col items-center">
                    <div
                      className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-bold ${
                        done
                          ? 'border-emerald-600 bg-emerald-600 text-white'
                          : rejected
                            ? 'border-red-500 bg-red-500 text-white'
                            : current
                              ? 'border-amber-500 bg-white text-amber-600'
                              : applied
                                ? 'border-slate-500 bg-slate-500 text-white'
                                : 'border-slate-300 bg-white text-slate-400'
                      }`}
                    >
                      {done ? '✓' : rejected ? '✕' : applied ? '•' : '·'}
                    </div>
                    {idx < steps.length - 1 && <div className="mt-1 h-7 w-px bg-slate-200" />}
                  </div>
                  <div className="min-w-0 pb-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-semibold text-slate-800">{step.who}</span>
                      {step.dept && <span className="text-xs text-slate-400">{step.dept}</span>}
                      <span className="text-xs text-slate-400">({step.role})</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                      <span
                        className={`rounded border px-1.5 py-0.5 font-medium ${
                          done
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                            : rejected
                              ? 'border-red-200 bg-red-50 text-red-700'
                              : current
                                ? 'border-amber-200 bg-amber-50 text-amber-700'
                                : applied
                                  ? 'border-slate-300 bg-slate-100 text-slate-700'
                                  : 'border-slate-200 bg-slate-50 text-slate-500'
                        }`}
                      >
                        {statusLabel}
                      </span>
                      <span className="text-slate-400">{displayAt || (current ? '처리 대기 중' : '')}</span>
                    </div>
                    {step.comment && (
                      <div className="mt-1 rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600">
                        사유: {step.comment}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {myTurn && (
            <div className="mt-2 rounded border border-slate-300 bg-slate-50 px-3 py-2 text-center text-xs font-semibold text-slate-700">
              내 차례 문서입니다
            </div>
          )}
          {(pending || myTurn) && onGoApproval && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onGoApproval();
              }}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded border border-slate-300 bg-white py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              결재함에서 처리
              <ExternalLink size={12} aria-hidden />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function AuditTrailFeedView({
  onGoApproval,
  myPendingCount,
  approvalMap,
}: {
  onGoApproval?: () => void;
  myPendingCount: number;
  approvalMap?: Record<string, ApprovalStep[]>;
}) {
  const events = useMemo(() => buildApprovalInboxFeedEvents(approvalMap ?? {}), [approvalMap]);
  const timelineById = useMemo(() => {
    const m = new Map<string, UnifiedTimelineEvent>();
    buildUnifiedTimeline().forEach((e) => m.set(e.id, e));
    return m;
  }, []);

  const [filterType, setFilterType] = useState<'all' | AuditEventType>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [jumpErr, setJumpErr] = useState(false);
  const activeFilterLabel = filterType === 'all' ? '전체 유형' : TYPE_LABEL[filterType];
  const hasSearch = searchQuery.trim().length > 0;

  const filtered = useMemo(() => {
    let list = filterType === 'all' ? events : events.filter((e) => e.type === filterType);
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (e) =>
          e.id.toLowerCase().includes(q) ||
          e.summary.toLowerCase().includes(q) ||
          e.author.toLowerCase().includes(q)
      );
    }
    return list;
  }, [events, filterType, searchQuery]);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    const id = findEventByIdExact(events, searchQuery);
    if (id) {
      setExpandedId(id);
      setJumpErr(false);
      requestAnimationFrame(() => {
        document.getElementById(`audit-row-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    } else {
      setJumpErr(true);
    }
  };

  return (
    <div
      className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#F8FAFC]"
      style={{ fontFamily: "'Noto Sans KR', sans-serif" }}
    >
      <header className="shrink-0 border-b border-slate-200 bg-white px-6 py-4 md:px-8">
        <div className={`flex flex-wrap items-start justify-between gap-3 ${FEED_CONTAINER}`}>
          <div>
            <h1 className="flex items-center gap-2.5 text-xl font-bold text-slate-900">
              <FileText className="text-[#1A5FA8]" size={22} aria-hidden />
              검사 및 내부통제
            </h1>
            <p className="mt-1 text-sm text-slate-500">데이터 변경 계보와 결재 이력을 투명하게 추적합니다.</p>
          </div>
        </div>
      </header>

      <div className="shrink-0 border-b border-slate-200 bg-white py-3">
        <div className={`flex flex-wrap items-center gap-3 px-1 ${FEED_CONTAINER}`}>
          <div className="relative min-w-[200px] flex-1">
            <Search
              className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${jumpErr ? 'text-red-500' : 'text-slate-400'}`}
            />
            <input
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setJumpErr(false);
              }}
              onKeyDown={handleSearchKeyDown}
              placeholder="이벤트 ID 또는 요약 검색 (Enter로 ID 점프)…"
              aria-invalid={jumpErr}
              className={`h-10 w-full rounded-md border bg-[#F8FAFC] py-2 pl-10 pr-3 text-sm text-slate-800 outline-none ${
                jumpErr ? 'border-red-300' : 'border-slate-200'
              } focus:border-[#93C5FD] focus:ring-1 focus:ring-[#93C5FD]`}
            />
          </div>
          <label htmlFor="audit-feed-filter" className="sr-only">
            유형
          </label>
          <select
            id="audit-feed-filter"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as 'all' | AuditEventType)}
            className="h-10 min-w-[120px] rounded-md border border-slate-200 bg-[#F8FAFC] px-3 text-sm text-slate-600 outline-none"
          >
            <option value="all">전체 유형</option>
            <option value="change">데이터 변경</option>
            <option value="lineage">계보 추적</option>
            <option value="emission_factor">배출계수</option>
            <option value="version">산정 버전</option>
            <option value="freeze">Freeze</option>
          </select>
          <button
            type="button"
            onClick={onGoApproval}
            className="relative inline-flex h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700"
          >
            결재함
            {myPendingCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {myPendingCount}
              </span>
            )}
          </button>
          <button
            type="button"
            className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700"
          >
            <Download size={16} aria-hidden />
            증빙 패키지
          </button>
        </div>
        <div className={`mt-2 flex flex-wrap items-center gap-1.5 px-1 text-xs text-slate-500 ${FEED_CONTAINER}`}>
          <span>필터: {activeFilterLabel}</span>
          {hasSearch && <span>· 검색어: &quot;{searchQuery.trim()}&quot;</span>}
          <span>· 결과 {filtered.length}건</span>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 md:px-8 md:py-7">
        <div className={`flex flex-col gap-3 ${FEED_CONTAINER}`}>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center rounded-lg border border-dashed border-slate-200 bg-white py-14 text-slate-400">
              <AlertCircle className="mb-3 h-11 w-11 stroke-1" aria-hidden />
              <p className="text-sm">조건에 맞는 이벤트가 없습니다. 검색어 또는 유형 필터를 조정해 주세요.</p>
            </div>
          ) : (
            filtered.map((ev) => {
              const open = expandedId === ev.id;
              const myTurn = canUserActOnApproval(ev.approvalSteps, AUDIT_CURRENT_USER, AUDIT_CURRENT_USER_ID);
              return (
                <div
                  key={ev.id}
                  id={`audit-row-${ev.id}`}
                  className={`overflow-hidden rounded-xl border bg-white transition-shadow ${
                    open ? 'border-slate-300 shadow-[0_2px_10px_rgba(15,23,42,0.06)]' : 'border-slate-200'
                  }`}
                >
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => setExpandedId(open ? null : ev.id)}
                    className={`relative flex w-full items-center gap-3 px-4 py-3 text-left ${
                      open ? 'bg-slate-50/80' : 'bg-white hover:bg-slate-50/70'
                    }`}
                  >
                    {open && <div className="absolute bottom-0 left-0 top-0 w-[3px] rounded-l bg-slate-400" aria-hidden />}
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${
                          ev.type === 'change'
                            ? 'bg-blue-500'
                            : ev.type === 'emission_factor'
                              ? 'bg-violet-500'
                              : ev.type === 'version'
                                ? 'bg-emerald-500'
                                : ev.type === 'freeze'
                                  ? 'bg-amber-500'
                                  : 'bg-pink-500'
                        }`}
                      />
                    </div>
                    <div className="grid min-w-0 flex-1 grid-cols-1 items-center gap-2 md:grid-cols-[1fr_auto] md:gap-3">
                      <div className="min-w-0">
                        <div className="mb-1 flex flex-wrap items-center gap-1.5">
                          <span className="text-xs text-slate-500">{ev.id}</span>
                          <span className="rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[11px] font-semibold text-blue-600">
                            {TYPE_LABEL[ev.type]}
                          </span>
                          {ev.scope && (
                            <span className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[11px] text-slate-500">
                              {ev.scope}
                            </span>
                          )}
                          {ev.urgency === 'high' || ev.urgency === 'urgent' ? (
                            <span className="text-[11px] font-semibold text-amber-600">긴급</span>
                          ) : null}
                        </div>
                        <div className="text-sm font-semibold leading-snug text-slate-900">{ev.summary}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                          <span>{ev.author}</span>
                          <span>·</span>
                          <span>{ev.corp}</span>
                          <span>·</span>
                          <span>{formatFeedDateTime(ev.at)}</span>
                        </div>
                      </div>
                      <div className="ml-auto flex items-center justify-end gap-2 self-stretch md:min-w-[190px]">
                        <div className="flex items-center gap-1.5">
                          {ev.approvalSteps.slice(0, 4).map((s, idx) => {
                            const cls =
                              s.status === 'approved'
                                ? 'bg-emerald-600'
                                : s.status === 'rejected'
                                  ? 'bg-red-500'
                                  : s.status === 'pending'
                                    ? 'border border-amber-400 bg-white'
                                    : 'border border-slate-300 bg-white';
                            return <span key={`${s.who}-${idx}`} className={`h-2.5 w-2.5 rounded-full ${cls}`} />;
                          })}
                        </div>
                        <span className={`rounded border px-2 py-0.5 text-[11px] font-semibold ${summaryStatusChip(ev.status)}`}>
                          {STATUS_LABEL[ev.status]}
                        </span>
                        {myTurn && (
                          <span className="rounded border border-blue-300 bg-white px-2 py-0.5 text-[11px] font-semibold text-blue-600">
                            내 차례
                          </span>
                        )}
                        <div className="pl-1 text-slate-400" aria-hidden>
                          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </div>
                      </div>
                    </div>
                  </button>
                  {open && <ExpandedPanel ev={ev} unified={timelineById.get(ev.id)} onGoApproval={onGoApproval} />}
                </div>
              );
            })
          )}
        </div>
      </div>

      <footer className="shrink-0 border-t border-slate-200 bg-white px-6 py-2.5 md:px-8">
        <div className={`flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 ${FEED_CONTAINER}`}>
          <div>
            총 {filtered.length}건 표시 중 · 유형: {activeFilterLabel}
          </div>
          <div className="flex flex-wrap gap-3">
            {[
              ['bg-slate-700', '승인됨'],
              ['bg-slate-500', '대기 중'],
              ['border border-slate-300 bg-slate-200', '미진행'],
            ].map(([c, l]) => (
              <span key={l} className="inline-flex items-center gap-1.5 font-medium text-slate-500">
                <span className={`h-1.5 w-1.5 rounded-full ${c}`} />
                {l}
              </span>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}

/** AUDIT_TRAIL_UNIFIED_SINGLE_VIEW_STRATEGY — 가칭과 동일 뷰 */
export { AuditTrailFeedView as UnifiedAuditView };

'use client';

/**
 * ApprovalSystem.jsx — 전자결재함 (미결/기결/기안/수신 + 목록·미리보기·모달)
 */
import { useEffect, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { Bell, FileText, Search, Stamp, User } from 'lucide-react';
import { buildApprovalInboxFeedEvents } from './data/auditFeedData';
import { ApprovalDocumentBody } from './ApprovalDocumentBody';
import { ApprovalLineView } from './ApprovalLineView';
import {
  applyApprovalAction,
  countActionableApprovals,
  filterMyDone,
  filterMyDraft,
  filterMyPendingTurn,
  filterMyWaitingQueue,
  filterReceived,
  listDocStatus,
  type ListDocStatus,
} from './approvalWorkflow';
import {
  AUDIT_CURRENT_USER,
  AUDIT_CURRENT_USER_DEPT,
  AUDIT_CURRENT_USER_ID,
  AUDIT_CURRENT_USER_ROLE,
} from './auditApprovalState';
import type { ApprovalStep, AuditEventDTO, AuditEventType } from './types/auditEventDto';

const DOC_TYPE_META: Record<AuditEventType, { label: string; className: string }> = {
  change: { label: 'GHG 데이터 변경', className: 'bg-[#EBF4FF] text-[#1A5FA8]' },
  lineage: { label: '계보', className: 'bg-slate-100 text-slate-700' },
  emission_factor: { label: '배출계수 변경', className: 'bg-emerald-50 text-emerald-900' },
  version: { label: '산정 버전 확정', className: 'bg-violet-50 text-violet-900' },
  freeze: { label: '데이터 Freeze', className: 'bg-amber-50 text-amber-900' },
};

const LIST_STATUS: Record<ListDocStatus, { label: string; className: string }> = {
  myTurn: { label: '결재 필요', className: 'border-amber-200 bg-amber-50 text-amber-900' },
  inProgress: { label: '진행 중', className: 'border-blue-200 bg-blue-50 text-blue-800' },
  approved: { label: '결재 완료', className: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  rejected: { label: '반려', className: 'border-red-200 bg-red-50 text-red-900' },
  received: { label: '수신', className: 'border-violet-200 bg-violet-50 text-violet-900' },
};

function orderByEvents(ids: string[], events: AuditEventDTO[]): string[] {
  const order = new Map(events.map((e, i) => [e.id, i]));
  return [...ids].sort((a, b) => (order.get(a) ?? 999) - (order.get(b) ?? 999));
}

export function ApprovalInboxView({
  approvalMap,
  setApprovalMap,
}: {
  approvalMap: Record<string, ApprovalStep[]>;
  setApprovalMap: Dispatch<SetStateAction<Record<string, ApprovalStep[]>>>;
}) {
  const events = useMemo(() => buildApprovalInboxFeedEvents(approvalMap), [approvalMap]);
  const byId = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);

  const allIds = useMemo(() => events.map((e) => e.id), [events]);

  const myPendingTurnIds = useMemo(
    () => filterMyPendingTurn(allIds, approvalMap, AUDIT_CURRENT_USER, AUDIT_CURRENT_USER_ID),
    [allIds, approvalMap]
  );
  const myWaitingIds = useMemo(
    () => filterMyWaitingQueue(allIds, approvalMap, AUDIT_CURRENT_USER, AUDIT_CURRENT_USER_ID),
    [allIds, approvalMap]
  );

  const pendingTabIds = useMemo(() => {
    const set = new Set([...myPendingTurnIds, ...myWaitingIds]);
    return orderByEvents(allIds.filter((id) => set.has(id)), events);
  }, [allIds, myPendingTurnIds, myWaitingIds, events]);

  const doneTabIds = useMemo(() => {
    const raw = filterMyDone(allIds, approvalMap, AUDIT_CURRENT_USER, AUDIT_CURRENT_USER_ID);
    const noRecv = raw.filter((id) => !byId.get(id)?.isReceived);
    return orderByEvents(noRecv, events);
  }, [allIds, approvalMap, byId, events]);

  const draftTabIds = useMemo(
    () => orderByEvents(filterMyDraft(allIds, events, AUDIT_CURRENT_USER_ID), events),
    [allIds, events]
  );

  const receivedTabIds = useMemo(
    () => orderByEvents(filterReceived(allIds, events), events),
    [allIds, events]
  );

  const actionableCount = useMemo(
    () => countActionableApprovals(approvalMap, AUDIT_CURRENT_USER, AUDIT_CURRENT_USER_ID),
    [approvalMap]
  );

  const [tab, setTab] = useState<'pending' | 'done' | 'draft' | 'received'>('pending');
  const [selId, setSelId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [comment, setComment] = useState('');
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectText, setRejectText] = useState('');

  const tabIds = useMemo(() => {
    switch (tab) {
      case 'pending':
        return pendingTabIds;
      case 'done':
        return doneTabIds;
      case 'draft':
        return draftTabIds;
      case 'received':
        return receivedTabIds;
      default:
        return [];
    }
  }, [tab, pendingTabIds, doneTabIds, draftTabIds, receivedTabIds]);

  const filteredIds = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tabIds;
    return tabIds.filter((id) => {
      const ev = byId.get(id);
      if (!ev) return false;
      return (
        ev.id.toLowerCase().includes(q) ||
        ev.summary.toLowerCase().includes(q) ||
        ev.author.toLowerCase().includes(q) ||
        (ev.draftedBy?.name.toLowerCase().includes(q) ?? false)
      );
    });
  }, [tabIds, search, byId]);

  useEffect(() => {
    setSelId((prev) => {
      if (prev && filteredIds.includes(prev)) return prev;
      return filteredIds[0] ?? null;
    });
  }, [filteredIds]);

  const selected = selId ? byId.get(selId) : null;
  const steps = selId ? approvalMap[selId] ?? [] : [];

  const applyAction = (action: 'approve' | 'reject' | 'skip') => {
    if (!selId) return;
    const now = new Date().toLocaleString('ko-KR', { hour12: false });
    const msg =
      action === 'reject'
        ? rejectText.trim() || '반려'
        : action === 'approve'
          ? comment.trim() || '승인'
          : comment.trim() || '전결 처리';
    setApprovalMap((prev) => ({
      ...prev,
      [selId]: applyApprovalAction(
        prev[selId] ?? [],
        AUDIT_CURRENT_USER,
        AUDIT_CURRENT_USER_ID,
        action === 'skip' ? 'skip' : action === 'reject' ? 'reject' : 'approve',
        msg,
        now
      ),
    }));
    setComment('');
    setRejectMode(false);
    setRejectText('');
  };

  const dateShort = (at: string) => at.split(/\s+/)[0] ?? at;

  const TABS = [
    { key: 'pending' as const, label: '미결함', count: pendingTabIds.length },
    { key: 'done' as const, label: '기결함', count: doneTabIds.length },
    { key: 'draft' as const, label: '기안함', count: draftTabIds.length },
    { key: 'received' as const, label: '수신함', count: receivedTabIds.length },
  ];

  return (
    <div
      className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#F1F5F9] text-slate-900"
      style={{ fontFamily: "'Noto Sans KR', sans-serif" }}
    >
      <header className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-7 py-3">
        <div>
          <div className="flex items-center gap-2 text-[15px] font-bold text-slate-900">
            <Stamp className="text-[#1A5FA8]" size={16} aria-hidden />
            전자결재
          </div>
          <p className="mt-0.5 text-[11px] text-slate-400">GHG 데이터 관리 결재 시스템</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 text-[12px]">
            <User size={14} className="text-slate-500" />
            <span className="font-semibold text-slate-800">{AUDIT_CURRENT_USER}</span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-600">{AUDIT_CURRENT_USER_ROLE}</span>
            <span className="hidden text-slate-400 sm:inline">· {AUDIT_CURRENT_USER_DEPT}</span>
          </div>
          <div className="relative flex items-center justify-center p-1">
            <Bell size={18} className="text-slate-500" aria-hidden />
            {actionableCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-red-500 px-1 text-[8px] font-bold text-white">
                {actionableCount}
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="flex w-[380px] shrink-0 flex-col overflow-hidden border-r border-slate-200 bg-white">
          <div className="flex border-b border-slate-200">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => {
                  setTab(t.key);
                  setSelId(null);
                }}
                className={`flex flex-1 items-center justify-center gap-1 border-b-2 py-2.5 text-[12px] font-medium transition-colors ${
                  tab === t.key
                    ? 'border-[#1A5FA8] bg-white text-[#1A5FA8]'
                    : 'border-transparent bg-white text-slate-500 hover:text-slate-700'
                }`}
              >
                {t.label}
                {t.count > 0 && (
                  <span
                    className={`flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold ${
                      tab === t.key ? 'bg-[#1A5FA8] text-white' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="border-b border-slate-100 px-3.5 py-2.5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="문서 검색…"
                className="h-8 w-full rounded-md border border-slate-200 bg-[#F8FAFC] py-1 pl-7 pr-2 text-[11px] text-slate-800 outline-none focus:border-[#93C5FD] focus:ring-1 focus:ring-[#93C5FD]"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {filteredIds.length === 0 && (
              <div className="px-4 py-10 text-center text-[12px] text-slate-400">문서가 없습니다.</div>
            )}
            {filteredIds.map((id) => {
              const ev = byId.get(id);
              if (!ev) return null;
              const st = approvalMap[id] ?? [];
              const chipKey = listDocStatus(st, AUDIT_CURRENT_USER, AUDIT_CURRENT_USER_ID, ev.isReceived);
              const chip = LIST_STATUS[chipKey];
              const meta = DOC_TYPE_META[ev.type];
              const isSel = selId === id;
              const isTurn = chipKey === 'myTurn';
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSelId(id)}
                  className={`relative w-full border-b border-slate-100 p-4 text-left transition-colors ${
                    isSel ? 'bg-[#EBF4FF]' : isTurn ? 'bg-amber-50/50' : 'bg-white hover:bg-slate-50/80'
                  }`}
                >
                  {isSel && <div className="absolute bottom-0 left-0 top-0 w-[3px] bg-[#1A5FA8]" />}
                  {isTurn && !isSel && <div className="absolute bottom-0 left-0 top-0 w-[3px] bg-amber-500" />}

                  <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${meta.className}`}>{meta.label}</span>
                    <span className="text-[10px] font-bold text-[#1A5FA8]">{ev.id}</span>
                    {ev.urgency === 'urgent' && (
                      <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-bold text-red-700">긴급</span>
                    )}
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${chip.className}`}>
                      {chip.label}
                    </span>
                  </div>
                  <div className="mb-2 line-clamp-2 text-[13px] font-semibold leading-snug text-slate-900">{ev.summary}</div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] text-slate-400">
                      {(ev.draftedBy?.name ?? ev.author) + ' · ' + dateShort(ev.at)}
                    </span>
                    <ApprovalLineView steps={st} compact />
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-[#F1F5F9] px-4 py-4 md:px-6 md:py-5">
          {!selected ? (
            <div className="flex h-full min-h-[240px] flex-col items-center justify-center text-slate-400">
              <FileText className="mb-3 h-12 w-12 stroke-1 opacity-40" />
              <p className="text-[13px] font-medium">좌측에서 문서를 선택하면 상세 내용을 확인할 수 있습니다.</p>
              {actionableCount > 0 && (
                <p className="mt-2 text-[12px] font-medium text-amber-700">현재 결재 대기 {actionableCount}건이 있습니다.</p>
              )}
            </div>
          ) : (
            <div className="mx-auto w-full max-w-screen-2xl pb-4">
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <ApprovalDocumentBody
                  ev={selected}
                  steps={steps}
                  comment={comment}
                  setComment={setComment}
                  rejectMode={rejectMode}
                  setRejectMode={setRejectMode}
                  rejectText={rejectText}
                  setRejectText={setRejectText}
                  onApprove={() => applyAction('approve')}
                  onReject={() => applyAction('reject')}
                  onSkip={() => applyAction('skip')}
                  titleId="approval-inbox-detail-title"
                />
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

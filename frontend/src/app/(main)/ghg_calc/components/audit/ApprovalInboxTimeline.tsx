'use client';

import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import type { ApprovalStep } from './types/auditEventDto';

/**
 * 결재함 우측 전용 — 세로 타임라인 (프로토타입 FullApprovalTimeline)
 * AUDIT_TRAIL_APPROVAL_INBOX_UI.md
 */
export function ApprovalInboxTimelineVertical({
  steps,
  embed,
}: {
  steps: ApprovalStep[];
  /** true면 상단 제목 숨김 (감사 피드 우측 카드 등 중복 방지) */
  embed?: boolean;
}) {
  if (!steps.length) {
    return (
      <span className="text-xs text-slate-500">결재 단계 없음 (시스템 자동)</span>
    );
  }

  return (
    <div className="py-1" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>
      {!embed && (
        <h4 className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
          <Clock size={14} className="text-[#1A5FA8]" />
          결재 진행 이력
        </h4>
      )}
      <div className="space-y-0">
        {steps.map((step, idx) => (
          <div
            key={idx}
            className="relative ml-2 border-l border-slate-200 pb-5 pl-7 last:border-l-transparent last:pb-0"
          >
            <div
              className={`absolute -left-[11px] top-0 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white shadow-sm ${
                step.status === 'approved' || step.status === 'skipped'
                  ? 'bg-emerald-500'
                  : step.status === 'rejected'
                    ? 'bg-red-500'
                    : step.status === 'pending'
                      ? 'bg-[#1A5FA8]'
                      : 'bg-slate-300'
              }`}
            >
              {step.status === 'approved' || step.status === 'skipped' ? (
                <CheckCircle2 size={12} className="text-white" strokeWidth={2.5} />
              ) : step.status === 'rejected' ? (
                <XCircle size={12} className="text-white" strokeWidth={2.5} />
              ) : step.status === 'pending' ? (
                <Clock size={12} className="text-white" strokeWidth={2.5} />
              ) : null}
            </div>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <span className="text-sm font-bold text-slate-800">
                {step.role}: {step.who}
              </span>
              <span className="text-xs text-slate-400">{step.at ?? '—'}</span>
            </div>
            {step.comment ? (
              <p className="mt-2 rounded border border-slate-100 bg-slate-50 p-2.5 text-sm italic leading-relaxed text-slate-600">
                {step.comment}
              </p>
            ) : null}
            {step.status === 'pending' && (
              <span className="mt-2 inline-block rounded border border-[#93C5FD] bg-[#EBF4FF] px-2 py-0.5 text-xs font-medium text-[#1A5FA8]">
                현재 대기
              </span>
            )}
            {step.status === 'waiting' && (
              <span className="mt-2 text-xs text-slate-400">이전 단계 완료 후 활성화</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

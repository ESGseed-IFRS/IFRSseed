'use client';

/**
 * ApprovalSystem.jsx — 결재선 시각화 (가로 / 컴팩트)
 * pending | waiting | approved | rejected | skipped
 */
import { CheckCircle2, Clock, Send, XCircle } from 'lucide-react';
import type { ApprovalStep } from './types/auditEventDto';

type DisplayStatus = ApprovalStep['status'];

function ringFor(s: DisplayStatus) {
  if (s === 'waiting')
    return { bg: 'bg-slate-50', border: 'border-slate-300', icon: 'wait' as const };
  if (s === 'skipped')
    return { bg: 'bg-blue-50', border: 'border-blue-300', icon: 'send' as const };
  const m: Record<string, { bg: string; border: string; icon: 'ok' | 'no' | 'wait' | 'send' }> = {
    approved: { bg: 'bg-emerald-50', border: 'border-emerald-300', icon: 'ok' },
    rejected: { bg: 'bg-red-50', border: 'border-red-300', icon: 'no' },
    pending: { bg: 'bg-amber-50', border: 'border-amber-300', icon: 'wait' },
  };
  return m[s] ?? { bg: 'bg-slate-50', border: 'border-slate-300', icon: 'wait' };
}

function StepIcon({ status, compact }: { status: DisplayStatus; compact: boolean }) {
  const cfg = ringFor(status);
  const sz = compact ? 10 : 16;
  if (cfg.icon === 'ok') return <CheckCircle2 size={sz} className="text-emerald-600" strokeWidth={2} />;
  if (cfg.icon === 'no') return <XCircle size={sz} className="text-red-600" strokeWidth={2} />;
  if (cfg.icon === 'send') return <Send size={sz} className="text-blue-700" strokeWidth={2} />;
  if (status === 'waiting') {
    return <span className={`font-bold ${compact ? 'text-[8px]' : 'text-[10px]'} text-slate-400`}>⋯</span>;
  }
  return <Clock size={sz} className="text-amber-600" strokeWidth={2} />;
}

function labelFor(status: DisplayStatus): string {
  if (status === 'waiting') return '대기 중';
  if (status === 'skipped') return '전결';
  if (status === 'approved') return '승인';
  if (status === 'rejected') return '반려';
  return '결재 대기';
}

export function ApprovalLineView({
  steps,
  compact = false,
  highlightUserName,
  highlightUserId,
}: {
  steps: ApprovalStep[];
  compact?: boolean;
  highlightUserName?: string;
  highlightUserId?: string;
}) {
  const isHighlight = (step: ApprovalStep) => {
    if (step.status !== 'pending') return false;
    if (highlightUserId && step.userId) return step.userId === highlightUserId;
    if (highlightUserName) return step.who === highlightUserName;
    return false;
  };

  if (!steps.length) {
    return <p className="text-xs text-slate-400">결재 단계 없음 (시스템 자동)</p>;
  }

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        {steps.map((step, i) => {
          const cfg = ringFor(step.status);
          return (
            <div key={i} className="flex items-center gap-1">
              <div
                title={`${step.role}: ${step.who} (${labelFor(step.status)})`}
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] ${cfg.bg} ${cfg.border}`}
              >
                <StepIcon status={step.status} compact />
              </div>
              {i < steps.length - 1 && (
                <div
                  className={`h-px w-2.5 ${step.status === 'approved' || step.status === 'skipped' ? 'bg-emerald-200' : 'bg-slate-200'}`}
                />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex min-w-0 items-start gap-0 overflow-x-auto pb-1">
      {steps.map((step, i) => {
        const cfg = ringFor(step.status);
        const showMyTurn = isHighlight(step);
        return (
          <div key={i} className="flex min-w-0 flex-1 items-start">
            <div className="flex min-w-0 flex-1 flex-col items-center px-1.5">
              <div
                className={`mb-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 ${cfg.bg} ${cfg.border}`}
              >
                <StepIcon status={step.status} compact={false} />
              </div>
              <div className="mb-0.5 text-center text-[11px] font-bold leading-tight text-slate-800">{step.role}</div>
              <div className="text-center text-[11px] leading-tight text-slate-600">{step.who}</div>
              {step.dept ? (
                <div className="text-center text-[10px] leading-tight text-slate-400">{step.dept}</div>
              ) : null}
              {step.at ? (
                <div className="mt-1 text-[9px] text-slate-400">{step.at.split(/\s+/)[0]}</div>
              ) : null}
              <div className="mt-1">
                <span
                  className={`inline-block rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${
                    step.status === 'approved'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      : step.status === 'rejected'
                        ? 'border-red-200 bg-red-50 text-red-800'
                        : step.status === 'pending'
                          ? 'border-amber-200 bg-amber-50 text-amber-900'
                          : step.status === 'waiting'
                            ? 'border-slate-200 bg-slate-50 text-slate-600'
                            : 'border-blue-200 bg-blue-50 text-blue-800'
                  }`}
                >
                  {labelFor(step.status)}
                </span>
              </div>
              {showMyTurn && (
                <div className="mt-1 rounded-full border border-[#93C5FD] bg-[#EBF4FF] px-1.5 py-0.5 text-[9px] font-semibold text-[#1A5FA8]">
                  내 차례
                </div>
              )}
              {step.comment ? (
                <p className="mt-1.5 max-w-[120px] border border-slate-200 bg-slate-50 px-1.5 py-1 text-left text-[10px] italic leading-snug text-slate-600">
                  &quot;{step.comment}&quot;
                </p>
              ) : null}
            </div>
            {i < steps.length - 1 && (
              <div
                className={`mx-0.5 mt-4 h-0.5 w-6 shrink-0 self-start ${step.status === 'approved' || step.status === 'skipped' ? 'bg-emerald-200' : 'bg-slate-200'}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

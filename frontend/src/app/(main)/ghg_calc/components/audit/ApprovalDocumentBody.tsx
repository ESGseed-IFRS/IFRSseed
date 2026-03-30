'use client';

/**
 * ApprovalSystem.jsx — DocDetailModal 본문 (모달·결재함 우측 인라인 공통)
 * @see APPROVAL_INBOX_FULL_DETAIL_STRATEGY.md 옵션 A
 */
import { AlertTriangle, CheckCircle2, Clock, Eye, Paperclip, Stamp, XCircle } from 'lucide-react';
import { ApprovalLineView } from './ApprovalLineView';
import { canUserActOnApproval, matchesActor } from './approvalWorkflow';
import { AUDIT_CURRENT_USER, AUDIT_CURRENT_USER_ID } from './auditApprovalState';
import type { ApprovalStep, AuditEventDTO, AuditEventType } from './types/auditEventDto';

const TYPE_META: Record<AuditEventType, { label: string; className: string }> = {
  change: { label: 'GHG 데이터 변경', className: 'border-[#1A5FA822] bg-[#EBF4FF] text-[#1A5FA8]' },
  lineage: { label: '계보 추적', className: 'border-slate-200 bg-slate-100 text-slate-700' },
  emission_factor: { label: '배출계수 변경', className: 'border-emerald-200 bg-emerald-50 text-emerald-900' },
  version: { label: '산정 버전 확정', className: 'border-violet-200 bg-violet-50 text-violet-900' },
  freeze: { label: '데이터 Freeze', className: 'border-amber-200 bg-amber-50 text-amber-900' },
};

export type ApprovalDocumentBodyProps = {
  ev: AuditEventDTO;
  steps: ApprovalStep[];
  comment: string;
  setComment: (v: string) => void;
  rejectMode: boolean;
  setRejectMode: (v: boolean) => void;
  rejectText: string;
  setRejectText: (v: string) => void;
  onApprove: () => void;
  onReject: () => void;
  onSkip: () => void;
  /** 모달에서만 전달 — 헤더에 닫기 버튼 */
  onClose?: () => void;
  /** 제목 요소 id (접근성) */
  titleId?: string;
};

export function ApprovalDocumentBody({
  ev,
  steps,
  comment,
  setComment,
  rejectMode,
  setRejectMode,
  rejectText,
  setRejectText,
  onApprove,
  onReject,
  onSkip,
  onClose,
  titleId = 'approval-document-title',
}: ApprovalDocumentBodyProps) {
  const myStep = steps.find((s) => matchesActor(s, AUDIT_CURRENT_USER, AUDIT_CURRENT_USER_ID) && s.status === 'pending');
  const isMyTurn = !!myStep && canUserActOnApproval(steps, AUDIT_CURRENT_USER, AUDIT_CURRENT_USER_ID);
  const overallRejected = steps.some((s) => s.status === 'rejected');
  const overallApproved =
    steps.length > 0 && steps.every((s) => s.status === 'approved' || s.status === 'skipped');
  const overallPending = !overallRejected && !overallApproved;

  const meta = TYPE_META[ev.type];
  const d = ev.details;
  const isFinalStep = myStep?.stepKind === 'final' || (myStep?.role?.includes('최종') ?? false);

  const changeGrid =
    d.kind === 'change'
      ? [
          ['변경 전', d.before, 'text-slate-500', 'bg-white'],
          ['변경 후', d.after, 'font-semibold text-[#1A5FA8]', 'bg-[#EBF4FF]'],
          ['증감', d.delta ?? '—', 'text-slate-700', 'bg-white'],
          ['영향도', d.impact ?? '—', 'text-slate-700', 'bg-white'],
        ]
      : null;

  return (
    <div style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>
      <div className="flex items-start justify-between rounded-t-xl border-b border-slate-200 bg-[#F8FAFC] px-6 py-4">
        <div>
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <span className={`rounded border px-2 py-0.5 text-[11px] font-bold ${meta.className}`}>{meta.label}</span>
            <span className="text-xs font-bold text-[#1A5FA8]">{ev.id}</span>
            {ev.urgency === 'urgent' && (
              <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">
                긴급
              </span>
            )}
            {ev.isReceived && (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                수신
              </span>
            )}
          </div>
          <h2 id={titleId} className="text-base font-bold text-slate-950">
            {ev.summary}
          </h2>
          <p className="mt-1 text-[11px] text-slate-500">
            기안: {ev.draftedBy ? `${ev.draftedBy.name} (${ev.draftedBy.dept})` : ev.author} · {ev.at} · {ev.corp}
            {ev.scope ? ` · ${ev.scope}` : ''}
          </p>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
          >
            닫기
          </button>
        ) : null}
      </div>

      <div className="flex flex-col gap-4 px-6 py-5">
        <section className="rounded-lg border border-slate-200 bg-[#F8FAFC] px-4 py-4">
          <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.07em] text-slate-500">결재선</div>
          <ApprovalLineView
            steps={steps}
            highlightUserName={AUDIT_CURRENT_USER}
            highlightUserId={AUDIT_CURRENT_USER_ID}
          />
        </section>

        {ev.rejectionHistory && ev.rejectionHistory.length > 0 && (
          <section className="rounded-lg border border-red-200 bg-red-50/90 px-4 py-3">
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold text-red-900">
              <AlertTriangle size={12} />
              반려 이력
            </div>
            {ev.rejectionHistory.map((r, i) => (
              <div key={i} className="text-[12px] leading-relaxed text-red-950">
                <span className="mr-2 text-[10px] text-red-600">{r.at}</span>
                <strong>{r.by}</strong>: {r.comment}
              </div>
            ))}
          </section>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="flex flex-col gap-3">
            <section>
              <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.07em] text-slate-500">기안 내용</div>
              <div className="rounded-lg border border-slate-200 bg-[#F8FAFC] px-3 py-3 text-[13px] leading-relaxed text-slate-700">
                {ev.body ?? (d.kind === 'change' ? `${ev.summary}\n\n사유: ${d.reason}` : ev.summary)}
              </div>
            </section>

            {changeGrid && (
              <section>
                <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.07em] text-slate-500">변경 내역</div>
                <div className="overflow-hidden rounded-lg border border-slate-200">
                  {changeGrid.map(([k, v, tc, bc]) => (
                    <div
                      key={String(k)}
                      className={`flex justify-between border-b border-slate-200 px-3 py-2 text-[12px] last:border-0 ${bc}`}
                    >
                      <span className="text-slate-500">{k}</span>
                      <span className={tc}>{v}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {d.kind === 'emission_factor' && (
              <section>
                <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.07em] text-slate-500">배출계수</div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12px]">
                  <div className="flex justify-between">
                    <span className="text-slate-500">항목</span>
                    <span className="font-medium">{d.factorName}</span>
                  </div>
                  <div className="mt-1 flex justify-between">
                    <span className="text-slate-500">값</span>
                    <span className="font-semibold">{d.value}</span>
                  </div>
                  <div className="mt-1 flex justify-between">
                    <span className="text-slate-500">출처</span>
                    <span>{d.source}</span>
                  </div>
                </div>
              </section>
            )}

            {d.kind === 'version' && (
              <section>
                <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.07em] text-slate-500">버전·산정</div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12px]">
                  <div className="flex justify-between">
                    <span className="text-slate-500">버전</span>
                    <span className="font-bold">{d.version}</span>
                  </div>
                  <div className="mt-1 flex justify-between">
                    <span className="text-slate-500">합계</span>
                    <span>{d.totalEmission}</span>
                  </div>
                  <div className="mt-1 flex justify-between">
                    <span className="text-slate-500">변동</span>
                    <span>{d.diff}</span>
                  </div>
                </div>
              </section>
            )}

            {ev.attachments && ev.attachments.length > 0 && (
              <section>
                <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.07em] text-slate-500">
                  첨부파일 ({ev.attachments.length})
                </div>
                <div className="flex flex-col gap-1.5">
                  {ev.attachments.map((f, i) => (
                    <div
                      key={i}
                      className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-[#F8FAFC] px-3 py-2 text-[12px] hover:bg-slate-100"
                    >
                      <Paperclip size={13} className="text-slate-500" />
                      <span className="flex-1 font-medium text-[#1A5FA8]">{f}</span>
                      <Eye size={13} className="text-slate-400" />
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          <section>
            <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.07em] text-slate-500">결재 이력</div>
            <div className="rounded-lg border border-slate-200 bg-[#F8FAFC] py-1">
              {steps.map((step, i) => (
                <div
                  key={i}
                  className="flex gap-3 border-b border-slate-200 px-3 py-2.5 last:border-0"
                >
                  <div
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-[1.5px] ${
                      step.status === 'approved' || step.status === 'skipped'
                        ? 'border-emerald-200 bg-emerald-50'
                        : step.status === 'rejected'
                          ? 'border-red-200 bg-red-50'
                          : step.status === 'pending'
                            ? 'border-amber-200 bg-amber-50'
                            : 'border-slate-200 bg-slate-50'
                    }`}
                  >
                    {step.status === 'approved' || step.status === 'skipped' ? (
                      <CheckCircle2 size={13} className="text-emerald-600" />
                    ) : step.status === 'rejected' ? (
                      <XCircle size={13} className="text-red-600" />
                    ) : step.status === 'pending' ? (
                      <Clock size={13} className="text-amber-600" />
                    ) : (
                      <span className="text-[10px] font-bold text-slate-400">{i + 1}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <span className="text-[12px] font-semibold text-slate-800">
                        {step.role}: {step.who}
                      </span>
                      {step.at ? <span className="text-[10px] text-slate-400">{step.at}</span> : null}
                    </div>
                    {step.dept ? <div className="text-[10px] text-slate-400">{step.dept}</div> : null}
                    {step.comment ? (
                      <p className="mt-1 rounded border border-slate-200 bg-white px-2 py-1.5 text-[11px] italic leading-relaxed text-slate-600">
                        &quot;{step.comment}&quot;
                      </p>
                    ) : null}
                    {matchesActor(step, AUDIT_CURRENT_USER, AUDIT_CURRENT_USER_ID) && step.status === 'pending' ? (
                      <p className="mt-1 text-[10px] font-semibold text-[#1A5FA8]">← 현재 내 결재 차례</p>
                    ) : null}
                    {step.status === 'waiting' ? (
                      <p className="mt-1 text-[10px] text-slate-400">이전 단계 완료 후 활성화</p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {isMyTurn && !ev.isReceived && overallPending && (
          <section className="rounded-lg border border-amber-200 bg-amber-50/90 px-4 py-4">
            <div className="mb-3 flex items-center gap-2 text-[13px] font-bold text-amber-950">
              <Stamp size={15} className="text-amber-800" />
              {myStep?.role} 결재 — {AUDIT_CURRENT_USER}
            </div>
            {!rejectMode ? (
              <>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="결재 의견을 입력해주세요 (선택사항)"
                  className="mb-3 h-16 w-full resize-none rounded-lg border border-amber-200 bg-white px-3 py-2 text-[12px] outline-none focus:ring-1 focus:ring-amber-300"
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={onApprove}
                    className="flex min-w-[120px] flex-[2] items-center justify-center gap-2 rounded-lg bg-[#1A5FA8] py-2.5 text-[13px] font-bold text-white hover:bg-[#154d8a]"
                  >
                    <CheckCircle2 size={15} />
                    승인
                  </button>
                  <button
                    type="button"
                    onClick={() => setRejectMode(true)}
                    className="flex-1 rounded-lg border border-red-200 bg-white py-2.5 text-[13px] font-semibold text-red-600 hover:bg-red-50"
                  >
                    반려
                  </button>
                  {isFinalStep && (
                    <button
                      type="button"
                      onClick={onSkip}
                      className="flex-1 rounded-lg border border-blue-200 bg-blue-50 py-2.5 text-[13px] font-semibold text-blue-800 hover:bg-blue-100"
                    >
                      전결
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div>
                <p className="mb-2 text-[12px] font-semibold text-red-700">반려 사유 입력 (필수)</p>
                <textarea
                  value={rejectText}
                  onChange={(e) => setRejectText(e.target.value)}
                  placeholder="반려 사유를 구체적으로 입력하세요. 기안자에게 통보되며 변경 이력에 기록됩니다."
                  className="mb-3 h-20 w-full resize-none rounded-lg border border-red-200 px-3 py-2 text-[12px] outline-none"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!rejectText.trim()) return;
                      onReject();
                      setRejectMode(false);
                    }}
                    className="flex-1 rounded-lg border border-red-200 bg-red-100 py-2 text-[12px] font-bold text-red-800 hover:bg-red-200/80"
                  >
                    반려 확정
                  </button>
                  <button
                    type="button"
                    onClick={() => setRejectMode(false)}
                    className="flex-1 rounded-lg border border-slate-200 bg-white py-2 text-[12px] text-slate-600"
                  >
                    취소
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {overallApproved && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] font-medium text-emerald-800">
            <CheckCircle2 size={16} />
            결재 완료된 문서입니다.
          </div>
        )}

        {overallRejected && !isMyTurn && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-medium text-red-900">
            <XCircle size={16} />
            반려된 문서입니다. 기안자가 수정 후 재기안해야 합니다.
          </div>
        )}

        {myStep && !canUserActOnApproval(steps, AUDIT_CURRENT_USER, AUDIT_CURRENT_USER_ID) && overallPending && (
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-[13px] text-slate-600">
            <Clock size={16} />
            이전 단계 결재 완료 후 결재 가능합니다.
          </div>
        )}

        {ev.isReceived && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-900">
            <Eye size={16} />
            수신 문서입니다. (결재 처리 불필요)
          </div>
        )}
      </div>
    </div>
  );
}

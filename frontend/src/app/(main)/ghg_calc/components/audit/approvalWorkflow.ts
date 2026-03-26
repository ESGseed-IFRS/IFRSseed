import type { ApprovalStep } from './types/auditEventDto';

/** userId가 있으면 id 우선, 없으면 이름 */
export function matchesActor(s: ApprovalStep, userName: string, userId?: string): boolean {
  if (userId && s.userId) return s.userId === userId;
  return s.who === userName;
}

/** ApprovalSystem.jsx — 이전 단계 승인 후에만 액션 가능 */
export function canUserActOnApproval(
  steps: ApprovalStep[],
  userName: string,
  userId?: string
): boolean {
  const i = steps.findIndex((s) => matchesActor(s, userName, userId) && s.status === 'pending');
  if (i < 0) return false;
  for (let j = 0; j < i; j++) {
    if (steps[j].status !== 'approved' && steps[j].status !== 'skipped') return false;
  }
  return true;
}

export type InboxRowStatus = 'myTurn' | 'waiting' | 'approved' | 'rejected' | 'inProgress';

export function inboxRowStatus(
  steps: ApprovalStep[],
  userName: string,
  userId?: string
): InboxRowStatus {
  if (steps.some((s) => s.status === 'rejected')) return 'rejected';
  if (steps.length > 0 && steps.every((s) => s.status === 'approved' || s.status === 'skipped')) {
    return 'approved';
  }
  if (steps.some((s) => matchesActor(s, userName, userId) && s.status === 'waiting')) {
    return 'waiting';
  }
  const hasMyPending = steps.some((s) => matchesActor(s, userName, userId) && s.status === 'pending');
  if (hasMyPending) {
    return canUserActOnApproval(steps, userName, userId) ? 'myTurn' : 'waiting';
  }
  return 'inProgress';
}

/** 목록 칩 — ApprovalSystem.jsx docStatus + 수신 */
export type ListDocStatus = 'myTurn' | 'inProgress' | 'approved' | 'rejected' | 'received';

export function listDocStatus(
  steps: ApprovalStep[],
  userName: string,
  userId: string | undefined,
  isReceived?: boolean
): ListDocStatus {
  if (isReceived) return 'received';
  if (steps.some((s) => s.status === 'rejected')) return 'rejected';
  if (steps.length > 0 && steps.every((s) => s.status === 'approved' || s.status === 'skipped')) {
    return 'approved';
  }
  const myPending = steps.find(
    (s) => matchesActor(s, userName, userId) && s.status === 'pending'
  );
  if (myPending && canUserActOnApproval(steps, userName, userId)) return 'myTurn';
  return 'inProgress';
}

/** 미결함 — 내 차례(처리 가능)만 */
export function filterMyPendingTurn(
  ids: string[],
  approvalMap: Record<string, ApprovalStep[]>,
  userName: string,
  userId?: string
): string[] {
  return ids.filter((id) => {
    const steps = approvalMap[id] ?? [];
    return (
      steps.some((s) => matchesActor(s, userName, userId) && s.status === 'pending') &&
      canUserActOnApproval(steps, userName, userId)
    );
  });
}

/** 미결함 — 순번 대기(내 단계는 아직 활성 전) */
export function filterMyWaitingQueue(
  ids: string[],
  approvalMap: Record<string, ApprovalStep[]>,
  userName: string,
  userId?: string
): string[] {
  return ids.filter((id) => {
    const steps = approvalMap[id] ?? [];
    const myP = steps.some((s) => matchesActor(s, userName, userId) && s.status === 'pending');
    const myW = steps.some((s) => matchesActor(s, userName, userId) && s.status === 'waiting');
    if (myW) return true;
    if (myP && !canUserActOnApproval(steps, userName, userId)) return true;
    return false;
  });
}

/** 기결함 — 내가 한 건이 승인/반려/전결 */
export function filterMyDone(
  ids: string[],
  approvalMap: Record<string, ApprovalStep[]>,
  userName: string,
  userId?: string
): string[] {
  return ids.filter((id) => {
    const steps = approvalMap[id] ?? [];
    return steps.some(
      (s) =>
        matchesActor(s, userName, userId) &&
        (s.status === 'approved' || s.status === 'rejected' || s.status === 'skipped')
    );
  });
}

/** 기안함 */
export function filterMyDraft(ids: string[], events: { id: string; draftedBy?: { id: string } }[], meId: string): string[] {
  return ids.filter((id) => {
    const ev = events.find((e) => e.id === id);
    return ev?.draftedBy?.id === meId;
  });
}

/** 수신함 */
export function filterReceived(ids: string[], events: { id: string; isReceived?: boolean }[]): string[] {
  return ids.filter((id) => events.find((e) => e.id === id)?.isReceived);
}

/** 승인/반려/전결 후 다음 waiting → pending */
export function applyApprovalAction(
  steps: ApprovalStep[],
  userName: string,
  userId: string | undefined,
  action: 'approve' | 'reject' | 'skip',
  comment: string,
  now: string
): ApprovalStep[] {
  if (!canUserActOnApproval(steps, userName, userId)) return steps;
  const i = steps.findIndex((s) => matchesActor(s, userName, userId) && s.status === 'pending');
  if (i < 0) return steps;

  const next = steps.map((s) => ({ ...s }));
  if (action === 'reject') {
    next[i] = {
      ...next[i],
      status: 'rejected',
      at: now,
      comment: comment.trim() || '반려',
    };
    return next;
  }
  const newStatus = action === 'skip' ? ('skipped' as const) : ('approved' as const);
  const cmt =
    action === 'skip' ? comment.trim() || '전결 처리' : comment.trim() || '승인';
  next[i] = { ...next[i], status: newStatus, at: now, comment: cmt };

  const nextWait = next.findIndex((s, j) => j > i && s.status === 'waiting');
  if (nextWait >= 0) {
    next[nextWait] = { ...next[nextWait], status: 'pending' };
  }
  return next;
}

/** 벨 배지 — 내 차례 건만 (ApprovalSystem myPending) */
export function countActionableApprovals(
  map: Record<string, ApprovalStep[]>,
  userName: string,
  userId?: string
): number {
  let n = 0;
  for (const steps of Object.values(map)) {
    if (
      steps.some((s) => matchesActor(s, userName, userId) && s.status === 'pending') &&
      canUserActOnApproval(steps, userName, userId)
    ) {
      n++;
    }
  }
  return n;
}

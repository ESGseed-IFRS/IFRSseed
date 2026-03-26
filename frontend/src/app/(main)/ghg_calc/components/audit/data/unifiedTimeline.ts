/**
 * 통합 Audit 타임라인 — mock 병합
 */
import {
  changeData,
  efData,
  versionData,
  nodeData,
  approvalSteps as defaultLineageApproval,
  type ChangeEntry,
} from './auditMockData';
import type { ApprovalStep } from '../types/auditEventDto';

export type UnifiedEventType = 'change' | 'lineage' | 'emission_factor' | 'version' | 'freeze';

export interface UnifiedTimelineEvent {
  id: string;
  sortKey: number;
  type: UnifiedEventType;
  atLabel: string;
  summary: string;
  actor: string;
  approvalSteps: ApprovalStep[];
  change?: ChangeEntry;
  trkRoot?: string;
  efIndex?: number;
  versionVer?: string;
}

function stepsFromLineage(): ApprovalStep[] {
  return defaultLineageApproval.map((s, i) => ({
    role: i === 0 ? '입력' : i === 1 ? '검토' : '승인',
    who: s.who.replace(/\s*\([^)]*\)\s*/g, '').trim() || s.who,
    at: s.time,
    status: (s.done ? 'approved' : 'pending') as ApprovalStep['status'],
    comment: '',
  }));
}

function stepsFromChange(c: ChangeEntry): ApprovalStep[] {
  return [
    { role: '처리', who: c.writer, at: `2024-${c.time}`, status: 'approved', comment: '' },
    {
      role: '승인',
      who: c.approver,
      status: c.status === 'approved' ? 'approved' : c.status === 'rejected' ? 'rejected' : 'pending',
      comment: c.status === 'rejected' ? '반려' : '',
    },
  ];
}

function stepsFromVersion(v: (typeof versionData)[0]): ApprovalStep[] {
  if (!v.approvalSteps?.length) {
    return v.frozen
      ? [{ role: 'Freeze', who: v.who, at: v.time, status: 'approved' as const, comment: '' }]
      : [];
  }
  return v.approvalSteps.map((s, i) => ({
    role: i === 0 ? '기안' : i === v.approvalSteps.length - 1 ? '승인·Freeze' : '검토',
    who: s.who.replace(/\s*\([^)]*\)\s*/g, '').trim() || s.who,
    at: s.time,
    status: (s.done ? 'approved' : 'pending') as ApprovalStep['status'],
    comment: '',
  }));
}

const TYPE_ORDER: Record<UnifiedEventType, number> = {
  version: 0,
  change: 1,
  lineage: 2,
  emission_factor: 3,
  freeze: 4,
};

export function buildUnifiedTimeline(): UnifiedTimelineEvent[] {
  const out: UnifiedTimelineEvent[] = [];

  changeData.forEach((c, i) => {
    out.push({
      id: `chg-${c.id}`,
      sortKey: 400 - i,
      type: 'change',
      atLabel: `2024-${c.time}`,
      summary: `[변경] ${c.item} (${c.corp}) — ${c.old} → ${c.neu}`,
      actor: c.writer,
      approvalSteps: stepsFromChange(c),
      change: c,
    });
  });

  out.push({
    id: 'lin-001',
    sortKey: 410,
    type: 'lineage',
    atLabel: '2024-09-03 11:40',
    summary: '[계보] TRK-2024Q3-001 원천→공시 추적 완료',
    actor: '박지훈 (본부장)',
    approvalSteps: stepsFromLineage(),
    trkRoot: 'TRK-2024Q3-001',
  });

  efData.forEach((ef, i) => {
    out.push({
      id: `ef-${i}`,
      sortKey: 380 - i,
      type: 'emission_factor',
      atLabel: '2024-09-02 15:45',
      summary: `[배출계수] ${ef.item} (${ef.scope}) — ${ef.ef} ${ef.unit} · ${ef.manual ? '수동' : '자동'}`,
      actor: ef.manual ? '연시은' : '시스템',
      approvalSteps: [
        {
          role: '적용',
          who: ef.manual ? '연시은' : '시스템',
          status: ef.approval === 'approved' ? 'approved' : 'pending',
          comment: '',
        },
      ],
      efIndex: i,
    });
  });

  versionData.forEach((v, i) => {
    const isFreeze = v.frozen && !v.unfrozen;
    out.push({
      id: `ver-${v.ver}`,
      sortKey: 500 - i,
      type: isFreeze ? 'freeze' : 'version',
      atLabel: v.time,
      summary: isFreeze
        ? `[Freeze] ${v.ver} 합계 ${v.total} tCO₂e 확정`
        : v.unfrozen
          ? `[버전] ${v.ver} Freeze 해제 · ${v.note ?? ''}`
          : `[버전] ${v.ver} 산정 스냅샷 · 합계 ${v.total}`,
      actor: v.who,
      approvalSteps: stepsFromVersion(v),
      versionVer: v.ver,
    });
  });

  return out.sort((a, b) => b.sortKey - a.sortKey || TYPE_ORDER[a.type] - TYPE_ORDER[b.type]);
}

export { nodeData, efData, versionData };


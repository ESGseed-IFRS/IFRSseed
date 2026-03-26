/**
 * 통합 타임라인 → AuditEventDTO
 */
import { buildUnifiedTimeline, efData, versionData } from './unifiedTimeline';
import { changeData, type ChangeEntry } from './auditMockData';
import { APPROVAL_DEMO_DOCS } from './approvalDemoPack';
import type { AuditEventDTO, AuditEventDetails, AuditEventStatus } from '../types/auditEventDto';
import type { ApprovalStep } from '../types/auditEventDto';

const DEMO_INBOX_IDS = new Set(APPROVAL_DEMO_DOCS.map((d) => d.id));

export function overallStatus(steps: ApprovalStep[]): AuditEventStatus {
  if (!steps.length) return 'skipped';
  if (steps.some((s) => s.status === 'rejected')) return 'rejected';
  if (steps.some((s) => s.status === 'pending' || s.status === 'waiting')) return 'pending';
  return 'approved';
}

/** AuditTrail_clean.jsx — 계보 노드·상세 텍스트 (데모) */
function richLineageForChange(c: ChangeEntry) {
  const lineage = ['원천 파일', '활동자료', '배출계수 적용', '산정값', '공시값'];
  const lineageDetail = [
    `${c.item} 원천 집계 · ${c.corp} · 반영 분기`,
    `${c.item} ${c.neu} (변경 반영 후)`,
    `Scope ${c.scope} 배출계수 매핑 적용`,
    `산정 엔진 집계 · ${c.scope}`,
    `보고 버전 반영 · v6 기준`,
  ];
  return {
    lineage,
    lineageDetail,
    versionImpact: c.status === 'pending' ? null : '버전 확정 후 집계 반영 (예시)',
    factorName: `${c.item} (${c.scope})`,
    factorValue: '엔진 매핑값',
    factorSource: '국가 고시 / 내부 매핑 테이블',
  };
}

function detailsForChange(c: ChangeEntry): AuditEventDetails {
  return {
    kind: 'change',
    before: c.old,
    after: c.neu,
    reason: c.reason,
    lineageRef: 'TRK-2024Q3-001',
    factorRef: 'EF-2024',
    versionRef: 'v6',
    ...richLineageForChange(c),
  };
}

export function buildAuditFeedEvents(approvalMap?: Record<string, ApprovalStep[]>): AuditEventDTO[] {
  const timeline = buildUnifiedTimeline();
  const changeById = new Map(changeData.map((c) => [c.id, c]));

  return timeline.map((ev) => {
    const steps = approvalMap?.[ev.id] ?? ev.approvalSteps;
    const status = overallStatus(steps);
    let details: AuditEventDetails;
    let corp = 'A법인';
    let scope: string | undefined;

    switch (ev.type) {
      case 'change': {
        const c = ev.change ?? changeById.get(ev.id.replace('chg-', ''));
        if (c) {
          corp = c.corp;
          scope = c.scope;
          details = detailsForChange(c);
        } else {
          details = {
            kind: 'change',
            before: '—',
            after: '—',
            reason: '—',
            lineageRef: '—',
            factorRef: '—',
            versionRef: '—',
          };
        }
        break;
      }
      case 'lineage':
        corp = 'A법인';
        scope = 'ALL';
        details = {
          kind: 'lineage',
          lineageRef: ev.trkRoot ?? 'TRK-2024Q3-001',
          lineage: ['원천 파일', '활동자료', '배출계수 적용', '산정값', '공시값'],
          lineageDetail: [
            '원천 수집 완료',
            '활동자료 정합',
            '계수 매핑',
            '산정 엔진 실행',
            '공시 단계 확정',
          ],
        };
        break;
      case 'emission_factor': {
        const ef = ev.efIndex !== undefined ? efData[ev.efIndex] : efData[0];
        corp = ef && !ef.manual ? '시스템' : 'A법인';
        scope = ef?.scope;
        details = {
          kind: 'emission_factor',
          factorName: `${ef?.item ?? '항목'} (${ef?.scope ?? ''})`,
          value: ef ? `${ef.ef} ${ef.unit}` : '—',
          source: ef?.src ?? '—',
        };
        break;
      }
      case 'version':
      case 'freeze': {
        const v = versionData.find((x) => x.ver === ev.versionVer) ?? versionData[0];
        details = {
          kind: 'version',
          version: v.ver,
          totalEmission: `${v.total} tCO₂e`,
          diff: ev.type === 'freeze' ? 'Freeze 확정' : '이전 대비 변경',
          isFreeze: !!(v.frozen && !v.unfrozen),
          s1: v.s1,
          s2: v.s2,
          s3: v.s3,
          versionDiffRows:
            v.diff?.map((d, i) => ({
              id: `Δ-${i + 1}`,
              item: d.item,
              delta: `${d.delta} tCO₂e`,
              pct: d.material,
            })) ?? [],
        };
        corp = '전사';
        scope = 'ALL';
        break;
      }
    }

    return {
      id: ev.id,
      type: ev.type as AuditEventDTO['type'],
      at: ev.atLabel,
      corp,
      scope,
      summary: ev.summary.replace(/^\[[^\]]+\]\s*/, ''),
      author: ev.actor,
      status,
      approvalSteps: steps,
      details,
    };
  });
}

/** ApprovalSystem.jsx 데모 6건 + 통합 타임라인 — 결재함 전용 목록 */
export function buildApprovalInboxFeedEvents(approvalMap: Record<string, ApprovalStep[]>): AuditEventDTO[] {
  const demoEvents: AuditEventDTO[] = APPROVAL_DEMO_DOCS.map((doc) => {
    const steps = approvalMap[doc.id] ?? doc.approvalSteps;
    return {
      ...doc,
      approvalSteps: steps.map((s) => ({ ...s })),
      status: overallStatus(steps),
    };
  });
  const feed = buildAuditFeedEvents(approvalMap);
  const rest = feed.filter((e) => !DEMO_INBOX_IDS.has(e.id));
  return [...demoEvents, ...rest].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}

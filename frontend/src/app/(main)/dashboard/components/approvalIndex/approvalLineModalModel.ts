/**
 * 결재라인 설정 모달 ↔ ApprovalLine[] 변환 (전략 문서 §7·참고 UI)
 */

import type { ApprovalLine, ApprovalPerson } from '@/app/(main)/dashboard/lib/approvalUnified';

export type ApprovalSeqRow = {
  key: string;
  person: ApprovalPerson;
  stamp: '기안' | '협조' | '결재';
  agree: boolean;
  final: boolean;
};

export type RoutingItem =
  | { kind: 'person'; person: ApprovalPerson }
  | { kind: 'dept'; code: string; name: string };

export const APPROVAL_LINE_DEPT_MOCK: { code: string; name: string }[] = [
  { code: '1000', name: '마이오피스' },
  { code: '1100', name: '대표이사실' },
  { code: '2100', name: '사업기획팀' },
  { code: '3100', name: 'ESG추진팀' },
  { code: '4100', name: '지속가능경영팀' },
];

export const APPROVAL_LINE_PRESETS: { id: string; label: string; lines: ApprovalLine[] }[] = [
  {
    id: 'sr-default',
    label: 'SR 표준 (계열사→지주)',
    lines: [
      { role: '기안', people: [{ id: 'me', name: '본인', dept: '계열사 ESG' }] },
      { role: '검토', people: [{ id: 'u2', name: '이검토', dept: '미라콤 ESG팀' }] },
      { role: '승인', people: [{ id: 'u3', name: '박승인', dept: '지주 ESG팀' }] },
    ],
  },
  {
    id: 'ghg-default',
    label: 'GHG 감사 표준',
    lines: [
      { role: '기안', people: [{ id: 'u1', name: '김환경', dept: '미라콤 ENV팀' }] },
      { role: '검토', people: [{ id: 'u2', name: '이검토', dept: '미라콤 ESG팀' }] },
      { role: '승인', people: [{ id: 'u3', name: '박승인', dept: '지주 ESG팀' }] },
    ],
  },
];

export function linesToModalDraft(lines: ApprovalLine[]): {
  seq: ApprovalSeqRow[];
  agreement: ApprovalPerson[];
  receive: RoutingItem[];
  reference: RoutingItem[];
} {
  let k = 0;
  const seq: ApprovalSeqRow[] = [];
  const agreement: ApprovalPerson[] = [];
  const receive: RoutingItem[] = [];
  const reference: RoutingItem[] = [];

  for (const line of lines) {
    if (line.role === '합의') {
      for (const p of line.people) agreement.push({ ...p });
      continue;
    }
    if (line.role === '수신') {
      for (const p of line.people) receive.push(personLikeToRouting(p));
      continue;
    }
    if (line.role === '참조') {
      for (const p of line.people) reference.push(personLikeToRouting(p));
      continue;
    }
    for (const p of line.people) {
      if (line.role === '기안') {
        seq.push({ key: `r-${k++}`, person: { ...p }, stamp: '기안', agree: false, final: false });
      } else if (line.role === '협조') {
        seq.push({ key: `r-${k++}`, person: { ...p }, stamp: '협조', agree: false, final: false });
      } else if (line.role === '검토' || line.role === '승인') {
        seq.push({
          key: `r-${k++}`,
          person: { ...p },
          stamp: '결재',
          agree: false,
          final: line.role === '승인',
        });
      }
    }
  }
  return { seq, agreement, receive, reference };
}

function personLikeToRouting(p: ApprovalPerson): RoutingItem {
  if (p.id.startsWith('dept-') || p.dept === '부서') {
    const code = p.id.replace(/^dept-/, '') || p.name;
    return { kind: 'dept', code, name: p.name };
  }
  return { kind: 'person', person: { ...p } };
}

function routingToPeople(items: RoutingItem[]): ApprovalPerson[] {
  return items.map((i) =>
    i.kind === 'person'
      ? { ...i.person }
      : { id: `dept-${i.code}`, name: i.name, dept: '부서' },
  );
}

export function modalDraftToLines(d: {
  seq: ApprovalSeqRow[];
  agreement: ApprovalPerson[];
  receive: RoutingItem[];
  reference: RoutingItem[];
}): ApprovalLine[] {
  const lines: ApprovalLine[] = [];

  type R = ApprovalLine['role'];
  const buckets: { role: R; people: ApprovalPerson[] }[] = [];
  const pushSeq = (role: R, person: ApprovalPerson) => {
    const last = buckets[buckets.length - 1];
    if (last && last.role === role) last.people.push(person);
    else buckets.push({ role, people: [person] });
  };

  for (const row of d.seq) {
    if (row.stamp === '기안') pushSeq('기안', row.person);
    else if (row.stamp === '협조') pushSeq('협조', row.person);
    else pushSeq(row.final ? '승인' : '검토', row.person);
  }
  for (const b of buckets) lines.push({ role: b.role, people: b.people });

  if (d.agreement.length) lines.push({ role: '합의', people: d.agreement.map((p) => ({ ...p })) });
  const recv = routingToPeople(d.receive);
  if (recv.length) lines.push({ role: '수신', people: recv });
  const ref = routingToPeople(d.reference);
  if (ref.length) lines.push({ role: '참조', people: ref });

  if (!lines.some((l) => l.role === '기안')) {
    lines.unshift({ role: '기안', people: [{ id: 'me', name: '본인', dept: '기안부서' }] });
  }
  return lines;
}

'use client';

import { useGHGStore } from '../../store/ghg.store';

/** AUDIT_UI_DESIGN_STRATEGY: 제목 text-xl, 카드 text-sm/3xl, 숫자·라벨 중심, 아이콘 생략 */

export function AuditDashboard() {
  const scope1 = useGHGStore((s) => s.scope1);
  const scope2 = useGHGStore((s) => s.scope2);
  const scope3 = useGHGStore((s) => s.scope3);
  const history = useGHGStore((s) => s.history);

  const totalRows =
    scope1.stationary.length +
    scope1.mobile.length +
    scope2.electricity.length +
    scope3.categories.reduce((s, c) => s + c.data.length, 0);
  const receiptCount = scope3.categories.reduce((s, c) => s + (c.receipts?.length ?? 0), 0);
  const evidenceRate = totalRows > 0 ? Math.min(100, Math.round((receiptCount / totalRows) * 100)) : 0;

  return (
    <div className="space-y-6 leading-relaxed">
      <h2 className="text-xl font-bold text-slate-900">내부통제 요약 대시보드</h2>
      <p className="text-base text-slate-600">
        감사 질문을 사전에 방어하기 위한 주요 지표입니다.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-700 mb-1">증빙 구비율</p>
          <p className="text-3xl font-extrabold text-slate-900">{evidenceRate}%</p>
          <p className="text-sm text-slate-600 mt-1">레코드 대비 증빙 연결 ({receiptCount}/{totalRows || 0})</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-700 mb-1">주요 변경 요약</p>
          <p className="text-sm text-slate-700">직전 검증 대비 ±10% 변동</p>
          <p className="text-sm text-slate-600 mt-1">스냅샷 비교 시 표시</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-700 mb-1">결재 완료율</p>
          <p className="text-sm text-slate-700">승인 워크플로우</p>
          <p className="text-sm text-slate-600 mt-1">Phase 2 백엔드 연동 예정</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-700 mb-1">Lock / Snapshot</p>
          <p className="text-3xl font-extrabold text-slate-900">{history.length}</p>
          <p className="text-sm text-slate-600 mt-1">저장된 스냅샷 건수</p>
        </div>
      </div>
    </div>
  );
}

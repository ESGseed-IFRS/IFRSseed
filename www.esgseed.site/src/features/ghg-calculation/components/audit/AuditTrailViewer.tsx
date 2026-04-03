'use client';

import { History } from 'lucide-react';

/** AUDIT_TRAIL_IMPLEMENTATION_ROADMAP §3.4: 변경 이력(Audit Trail) */
export function AuditTrailViewer() {
  return (
    <div className="space-y-6 leading-relaxed">
      <h2 className="text-xl font-bold text-slate-900">변경 이력 (Audit Trail)</h2>
      <p className="text-base text-slate-600">
        데이터의 CREATE / UPDATE / DELETE 이력을 타임라인으로 확인합니다. 변경 전/후 값 diff, 변경자, 변경 사유가 기록됩니다.
      </p>
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-8 text-center">
        <History className="h-10 w-10 mx-auto text-slate-400 mb-3 stroke-[1.5]" />
        <p className="text-base font-medium text-slate-700">변경 이력</p>
        <p className="text-sm text-slate-600 mt-1">
          백엔드 audit_logs API 연동 후 타임라인이 표시됩니다.
        </p>
        <p className="text-sm text-slate-600 mt-2">
          Phase 1.5: 데이터 변경 시 로그 API 호출 연동 예정
        </p>
      </div>
    </div>
  );
}

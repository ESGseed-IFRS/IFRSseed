'use client';

/** GHG_AUDIT_TAB_DESIGN_v2 §4.2: 수동 조정 이력 (synced_at vs updated_at) */

const DUMMY_ADJUSTMENTS = [
  { id: 'ERP-F-2024-013', tab: '연료·차량', editor: 'user_002', date: '02-10 14:32', before: '275,000 Nm³', after: '280,000 Nm³', reason: '계량기 오독' },
  { id: 'EMS-E-2024-002', tab: '전력·열·스팀', editor: 'user_002', date: '02-10 14:32', before: '275,000 kWh', after: '280,000 kWh', reason: '현장 확인' },
  { id: 'EHS-R-2024-005', tab: '냉매', editor: 'user_001', date: '02-08 09:15', before: '12.5 kg', after: '14.2 kg', reason: '충전량 재계측' },
];

export function ManualAdjustmentsView() {
  const count = DUMMY_ADJUSTMENTS.length;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-slate-900">수동 조정 이력</h2>
      <p className="text-base text-slate-600">
        synced_at vs updated_at 24시간 초과 건을 자동 감지하여 표시합니다. IFRS S2 기준 수동 조정 이력 공개 요건 대응을 위한 화면입니다.
      </p>
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-200">
              <th className="px-4 py-3 text-left font-semibold text-slate-700">레코드 ID</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">탭</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">수정자</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">수정일시</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">수정 전</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">수정 후</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">사유</th>
            </tr>
          </thead>
          <tbody>
            {DUMMY_ADJUSTMENTS.map((row) => (
              <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-2.5 font-medium text-slate-900">{row.id}</td>
                <td className="px-4 py-2.5 text-slate-700">{row.tab}</td>
                <td className="px-4 py-2.5 text-slate-700">{row.editor}</td>
                <td className="px-4 py-2.5 text-slate-700 tabular-nums">{row.date}</td>
                <td className="px-4 py-2.5 text-slate-700 tabular-nums">{row.before}</td>
                <td className="px-4 py-2.5 text-slate-700 tabular-nums">{row.after}</td>
                <td className="px-4 py-2.5 text-slate-600">{row.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-amber-700 font-medium">
        총 {count}건 | IFRS S2: 수동 조정 이력 공개 ⚠️ 근거 첨부 권장
      </p>
    </div>
  );
}

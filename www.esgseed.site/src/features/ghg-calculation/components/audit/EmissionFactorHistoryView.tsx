'use client';

/** GHG_AUDIT_TAB_DESIGN_v2 §4.3: 배출계수 적용 내역 (MDG 현행값 비교) */

const DUMMY_FACTORS = [
  { id: 'EF-전력-2024', applied: 0.4781, current: 0.4781, version: '2024-환경부', tab: '전력·열', status: 'ok' as const },
  { id: 'EF-LNG-2023', applied: 2.159, current: 2.159, version: '2023-환경부', tab: '연료·차량', status: 'ok' as const },
  { id: 'EF-전력-2022', applied: 0.456, current: 0.4781, version: '2022-환경부', tab: '전력·열', status: 'warning' as const },
];

export function EmissionFactorHistoryView() {
  const outdatedCount = DUMMY_FACTORS.filter((f) => f.status === 'warning').length;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-slate-900">배출계수 적용 내역</h2>
      <p className="text-base text-slate-600">
        산정 시점 스냅샷 기준으로 표시합니다. MDG 현행값과 비교해 구버전 적용 시 자동 경고합니다.
      </p>
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-200">
              <th className="px-4 py-3 text-left font-semibold text-slate-700">배출계수 ID</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">적용값</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">현행 MDG값</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">버전</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">적용 탭</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">상태</th>
            </tr>
          </thead>
          <tbody>
            {DUMMY_FACTORS.map((row) => (
              <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-2.5 font-medium text-slate-900">{row.id}</td>
                <td className="px-4 py-2.5 text-slate-700 tabular-nums">{row.applied}</td>
                <td className="px-4 py-2.5 text-slate-700 tabular-nums">{row.current}</td>
                <td className="px-4 py-2.5 text-slate-700">{row.version}</td>
                <td className="px-4 py-2.5 text-slate-700">{row.tab}</td>
                <td className="px-4 py-2.5">
                  {row.status === 'ok' ? (
                    <span className="text-emerald-600 font-medium">✅ 최신</span>
                  ) : (
                    <span className="text-amber-600 font-medium">⚠️ 구버전</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {outdatedCount > 0 && (
        <p className="text-sm text-amber-700 font-medium">
          ⚠️ 구버전 적용 레코드 {outdatedCount}건 — 재산정 권장
        </p>
      )}
    </div>
  );
}

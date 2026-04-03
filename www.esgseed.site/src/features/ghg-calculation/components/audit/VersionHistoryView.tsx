'use client';

import { useGHGStore } from '../../store/ghg.store';
import { useMemo } from 'react';

/** GHG_AUDIT_TAB_DESIGN_v2 §4.5: 산정 버전 히스토리 (v1/v2/v3 비교) */

export function VersionHistoryView() {
  const history = useGHGStore((s) => s.history);
  const scope1 = useGHGStore((s) => s.scope1);
  const scope2 = useGHGStore((s) => s.scope2);
  const scope3 = useGHGStore((s) => s.scope3);

  const currentS1 = useMemo(
    () =>
      scope1.stationary.reduce((s, r) => s + (r.emissions || 0), 0) +
      scope1.mobile.reduce((s, r) => s + (r.emissions || 0), 0),
    [scope1]
  );
  const currentS2 = useMemo(
    () => scope2.electricity.reduce((s, r) => s + (r.emissions || 0), 0),
    [scope2.electricity]
  );
  const currentS3 = useMemo(
    () => scope3.categories.reduce((s, c) => s + c.data.reduce((ss, r) => ss + (r.emissions || 0), 0), 0),
    [scope3]
  );

  const rows = useMemo(() => {
    const currentRow = {
      version: '현재',
      date: '-',
      user: '-',
      scope1: currentS1,
      scope2: currentS2,
      scope3: currentS3,
      label: '[현재]',
    };
    const histRows = history.map((h, i) => {
      const s1 = h.scope1.stationary.reduce((s, r) => s + (r.emissions || 0), 0) +
        h.scope1.mobile.reduce((s, r) => s + (r.emissions || 0), 0);
      const s2 = h.scope2.electricity.reduce((s, r) => s + (r.emissions || 0), 0);
      const s3 = h.scope3.categories.reduce((s, c) => s + c.data.reduce((ss, r) => ss + (r.emissions || 0), 0), 0);
      return {
        version: `v${history.length - i}`,
        date: new Date(h.savedAt).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }),
        user: 'user_001',
        scope1: s1,
        scope2: s2,
        scope3: s3,
        label: h.label,
      };
    });
    return [currentRow, ...histRows];
  }, [history, currentS1, currentS2, currentS3]);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-slate-900">산정 버전 히스토리</h2>
      <p className="text-base text-slate-600">
        산정 버전별 Scope 1·2·3 배출량 변화를 비교합니다. GHG 산정 탭에서 스냅샷 저장 시 반영됩니다.
      </p>
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-200">
              <th className="px-4 py-3 text-left font-semibold text-slate-700">버전</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">산정일시</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">산정자</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Scope 1</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Scope 2</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">Scope 3</th>
              <th className="px-4 py-3 text-left font-semibold text-slate-700">비고</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-2.5 font-medium text-slate-900">{row.version}</td>
                <td className="px-4 py-2.5 text-slate-700 tabular-nums">{row.date}</td>
                <td className="px-4 py-2.5 text-slate-700">{row.user}</td>
                <td className="px-4 py-2.5 text-slate-700 tabular-nums">{row.scope1.toFixed(0)} tCO₂e</td>
                <td className="px-4 py-2.5 text-slate-700 tabular-nums">{row.scope2.toFixed(0)} tCO₂e</td>
                <td className="px-4 py-2.5 text-slate-700 tabular-nums">{row.scope3.toFixed(0)} tCO₂e</td>
                <td className="px-4 py-2.5 text-slate-600">{row.label}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {history.length === 0 && (
        <p className="text-sm text-slate-500">
          GHG 산정 탭에서 스냅샷 저장을 하면 버전 히스토리가 쌓입니다.
        </p>
      )}
    </div>
  );
}

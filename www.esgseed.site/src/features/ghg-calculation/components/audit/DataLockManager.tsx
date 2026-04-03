'use client';

import { Lock, Unlock, Save, Calendar } from 'lucide-react';
import { useGHGStore } from '../../store/ghg.store';
import { usePeriodLocks } from '../../hooks/usePeriodLocks';
import { toast } from 'sonner';

/** AUDIT_TRAIL_IMPLEMENTATION_ROADMAP §3.2: 데이터 마감/확정 관리 */
export function DataLockManager() {
  const { locks, isLocked, addLock, removeLock } = usePeriodLocks();
  const boundaryPolicy = useGHGStore((s) => s.boundaryPolicy);
  const scope1 = useGHGStore((s) => s.scope1);
  const scope2 = useGHGStore((s) => s.scope2);
  const scope3 = useGHGStore((s) => s.scope3);
  const saveSnapshot = useGHGStore((s) => s.saveSnapshot);
  const history = useGHGStore((s) => s.history);

  const handleLock = (scope: 'scope1' | 'scope2' | 'scope3' | 'all', periodType: 'monthly' | 'yearly', periodValue: string) => {
    addLock(scope, periodType, periodValue);
    toast.success(`${periodValue} ${scope === 'all' ? '전체' : scope} 마감되었습니다.`);
  };

  const handleUnlock = (id: string) => {
    removeLock(id);
    toast.success('마감이 해제되었습니다.');
  };

  const handleSaveSnapshot = () => {
    saveSnapshot('감사대응 스냅샷');
    toast.success('스냅샷이 저장되었습니다. 저장된 히스토리에서 확인하세요.');
  };

  const reportingYear = boundaryPolicy?.reportingYear ?? new Date().getFullYear();
  const months = Array.from({ length: 12 }, (_, i) => `${reportingYear}-${String(i + 1).padStart(2, '0')}`);

  return (
    <div className="space-y-6 leading-relaxed">
      <h2 className="text-xl font-bold text-slate-900">데이터 마감/확정 관리 (Lock & Snapshot)</h2>
      <p className="text-base text-slate-600">
        월별 또는 연도별 산정 완료 시 마감(Lock) 처리할 수 있습니다. 마감된 데이터는 Read-only로 관리됩니다.
      </p>

      {/* 스냅샷 저장 */}
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="text-base font-semibold text-slate-800 mb-2">스냅샷 저장</h3>
        <p className="text-sm text-slate-600 mb-3">
          현재 시점의 전체 데이터(Scope 1/2/3, 산정 설정)를 스냅샷으로 저장합니다. 이후 데이터 변경과 무관하게 이 시점 기준 값을 재현할 수 있습니다.
        </p>
        <button
          type="button"
          onClick={handleSaveSnapshot}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Save className="h-4 w-4 stroke-[1.5]" />
          스냅샷 저장
        </button>
        <p className="text-sm text-slate-600 mt-2">저장된 스냅샷: {history.length}건</p>
      </section>

      {/* 기간별 마감 */}
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="text-base font-semibold text-slate-800 mb-2">기간별 마감 (Period Lock)</h3>
        <p className="text-sm text-slate-600 mb-4">
          마감된 기간의 데이터는 수정이 제한됩니다. (백엔드 연동 시 전면 적용)
        </p>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 stroke-[1.5] text-slate-500" />
            <span className="text-base font-medium text-slate-700">{reportingYear}년 월별 마감</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {months.map((m) => {
              const locked = locks.find((l) => l.periodType === 'monthly' && l.periodValue === m);
              return (
                <div key={m} className="flex items-center gap-1 rounded border border-slate-200 px-3 py-1.5 text-sm">
                  <span>{m.slice(5)}월</span>
                  {locked ? (
                    <button type="button" onClick={() => handleUnlock(locked.id)} className="text-amber-600 hover:text-amber-700" title="마감 해제">
                      <Unlock className="h-3.5 w-3.5" />
                    </button>
                  ) : (
                    <button type="button" onClick={() => handleLock('all', 'monthly', m)} className="text-slate-400 hover:text-slate-600" title="마감">
                      <Lock className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 마감 현황 */}
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="text-base font-semibold text-slate-800 mb-2">마감 현황</h3>
        {locks.length === 0 ? (
          <p className="text-sm text-slate-600">마감된 기간이 없습니다.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {locks.map((l) => (
              <li key={l.id} className="flex items-center justify-between rounded bg-slate-50 px-3 py-2">
                <span>
                  {l.scope === 'all' ? '전체' : l.scope} / {l.periodValue} ({l.periodType})
                </span>
                <span className="text-sm text-slate-600">{new Date(l.lockedAt).toLocaleString('ko-KR')}</span>
                <button type="button" onClick={() => handleUnlock(l.id)} className="text-sm text-amber-600 hover:underline">
                  마감 해제
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

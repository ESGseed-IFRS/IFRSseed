'use client';

import { GitBranch } from 'lucide-react';
import { useGHGStore } from '../../store/ghg.store';
import { SCOPE1_METHODOLOGY, SCOPE2_ELECTRICITY_METHODOLOGY } from '../MethodologyDetailPanel';

/** AUDIT_TRAIL_IMPLEMENTATION_ROADMAP §3.6: 산정 방법론 및 로직 계보(Lineage) */
export function LineageViewer() {
  const boundaryPolicy = useGHGStore((s) => s.boundaryPolicy);
  const factorYear = useGHGStore((s) => s.factorYear);

  return (
    <div className="space-y-6 leading-relaxed">
      <h2 className="text-xl font-bold text-slate-900">산정 방법론 및 로직 계보 (Lineage)</h2>
      <p className="text-base text-slate-600">
        적용 배출계수 버전, 산식, 방법론 변경 이력을 확인합니다.
      </p>

      {/* 적용 배출계수·산식 */}
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="text-base font-semibold text-slate-800 mb-3">적용 배출계수 및 산식</h3>
        <dl className="space-y-2 text-base">
          <div className="flex justify-between">
            <dt className="text-slate-600">배출계수 DB</dt>
            <dd className="font-medium text-slate-900">{boundaryPolicy?.efDbVersion ?? '-'}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-600">계수 기준 연도</dt>
            <dd className="font-medium text-slate-900">{factorYear}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-600">Scope 1 산식</dt>
            <dd className="font-medium text-slate-900">{SCOPE1_METHODOLOGY.formula}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-600">Scope 2 전력 산식</dt>
            <dd className="font-medium text-slate-900">{SCOPE2_ELECTRICITY_METHODOLOGY.formula}</dd>
          </div>
        </dl>
      </section>

      {/* 방법론 변경 이력 */}
      <section className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center">
        <GitBranch className="h-10 w-10 mx-auto text-slate-400 mb-2 stroke-[1.5]" />
        <p className="text-base font-medium text-slate-700">방법론 변경 이력</p>
        <p className="text-sm text-slate-600 mt-1">
          methodology_changes 테이블 및 UI 연동 후 표시됩니다.
        </p>
      </section>
    </div>
  );
}

'use client';

import { useState } from 'react';
import {
  AuditNav,
  RequirementChecklist,
  LineageDrillDownView,
  ManualAdjustmentsView,
  EmissionFactorHistoryView,
  DataQualityDistributionView,
  VersionHistoryView,
  AuditorView,
  AuditPackageExport,
} from './audit';
import type { AuditSubMenu } from './audit';
import { DISCLOSURE_FRAMEWORKS, FRAMEWORK_LABELS } from '../constants/disclosure';
import type { AuditFramework } from '../constants/auditChecklist';
import { useGHGStore } from '../store/ghg.store';

/** GHG_AUDIT_TAB_DESIGN_v2: 상단 공시 프레임워크 탭 + 요건 체크리스트 기본 화면 */

export interface IFRSAuditViewProps {
  onGoToReport?: () => void;
  onGoToInput?: (tabId: string) => void;
}

export function IFRSAuditView({ onGoToReport, onGoToInput }: IFRSAuditViewProps) {
  const [activeMenu, setActiveMenu] = useState<AuditSubMenu>('checklist');
  const [framework, setFramework] = useState<AuditFramework>('ISSB');
  const [drillDownItemId, setDrillDownItemId] = useState<string | undefined>();
  const boundaryPolicy = useGHGStore((s) => s.boundaryPolicy);
  const reportingYear = boundaryPolicy?.reportingYear ?? new Date().getFullYear();

  const renderContent = () => {
    switch (activeMenu) {
      case 'checklist':
        return (
          <RequirementChecklist
            framework={framework}
            onLineageClick={(id) => {
              setDrillDownItemId(id);
              setActiveMenu('lineage');
            }}
          />
        );
      case 'lineage':
        return (
          <LineageDrillDownView focusItemId={drillDownItemId} onGoToInput={onGoToInput} />
        );
      case 'manual-adjustments':
        return <ManualAdjustmentsView />;
      case 'emission-factors':
        return <EmissionFactorHistoryView />;
      case 'data-quality':
        return <DataQualityDistributionView />;
      case 'version-history':
        return <VersionHistoryView />;
      case 'auditor':
        return <AuditorView />;
      case 'export':
        return <AuditPackageExport onGoToReport={onGoToReport} framework={framework === 'ISSB' ? 'IFRS S2' : framework === 'K-ETS' ? 'K-ETS' : framework} />;
      default:
        return <RequirementChecklist framework={framework} />;
    }
  };

  const frameworkLabel = FRAMEWORK_LABELS[framework] ?? framework;

  return (
    <div className="flex flex-col min-h-0">
      {/* 상단 공시 프레임워크 전환 탭 */}
      <div className="shrink-0 border-b border-slate-200 bg-white px-6 py-4">
        <p className="text-sm text-slate-600 mb-3">공시 프레임워크 선택</p>
        <div className="flex flex-wrap gap-2">
          {DISCLOSURE_FRAMEWORKS.map((f) => {
            const id = f as AuditFramework;
            const isActive = framework === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setFramework(id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {id === 'ISSB' ? 'IFRS S2' : FRAMEWORK_LABELS[id] ?? id}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-slate-500 mt-2">
          {frameworkLabel} 기준 | {reportingYear} 보고연도 | 한국 | 모든 서브 메뉴는 선택된 프레임워크에 따라 표시가 변경됩니다.
        </p>
      </div>

      <div className="flex flex-1 min-h-0">
        <AuditNav activeMenu={activeMenu} onSelect={setActiveMenu} />
        <main className="flex-1 min-w-0 overflow-auto p-6 md:p-8">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}

'use client';

import { useEffect } from 'react';
import { Step2ActivityData } from './Step2ActivityData';
import { Scope3Page } from '../scope3/Scope3Page';
import { Step4Results } from './Step4Results';
import { GHGStepFlowView } from './GHGStepFlowView';
import { RawDataPreviewSection } from './RawDataPreviewSection';
import { useGHGStore } from '../store/ghg.store';
import { EVIDENCE_INPUT_ITEMS, type EvidenceInputTabId } from '../constants/evidenceInputMapping';
import { loadDummyForTabIfEmpty } from '../utils/dummyDataLoader';

/**
 * GHG_TAB_DESIGN_v2: 6탭 데이터 입력 구조
 * - 1. 전력·열·스팀 [Scope 2] EMS
 * - 2. 연료·차량 [Scope 1] ERP
 * - 3. 냉매 [Scope 1] EHS
 * - 4. 폐기물 [Scope 1·3] EMS
 * - 5. 물류·출장·통근 [Scope 3] SRM·HR
 * - 6. 원료·제품 [Scope 3] SRM·PLM
 */
export function GHGDataManagementCenter({
  disclosureFramework = 'ISSB',
  activeEvidenceTab = 'power',
  onOpenEMS,
  onOpenExcel,
}: {
  disclosureFramework?: string;
  activeEvidenceTab?: EvidenceInputTabId;
  onOpenEMS?: () => void;
  onOpenExcel?: () => void;
}) {
  const setActiveScope = useGHGStore((s) => s.setActiveScope);
  const setScope1SubTab = useGHGStore((s) => s.setScope1SubTab);
  const setScope2SubTab = useGHGStore((s) => s.setScope2SubTab);
  const scope1 = useGHGStore((s) => s.scope1);
  const scope2 = useGHGStore((s) => s.scope2);
  const setScope1 = useGHGStore((s) => s.setScope1);
  const setScope2 = useGHGStore((s) => s.setScope2);
  const tabStepByTabId = useGHGStore((s) => s.tabStepByTabId);
  const setTabStep = useGHGStore((s) => s.setTabStep);
  const saveSnapshot = useGHGStore((s) => s.saveSnapshot);

  const item = EVIDENCE_INPUT_ITEMS.find((i) => i.id === activeEvidenceTab);
  const step = tabStepByTabId[activeEvidenceTab] ?? 1;

  /** 탭 선택 시 Scope·서브탭 동기화 */
  useEffect(() => {
    if (!item) return;
    setActiveScope(item.scope);
    if (item.id === 'power') setScope2SubTab('electricity');
    if (item.id === 'fuel') setScope1SubTab('stationary');
  }, [activeEvidenceTab, item?.id]);

  /** GHG_UX_REDESIGN_SPEC_1 §2: 탭 진입 시 더미데이터 자동 로드 */
  useEffect(() => {
    if (activeEvidenceTab === 'power' || activeEvidenceTab === 'fuel') {
      loadDummyForTabIfEmpty(activeEvidenceTab, scope1, scope2, setScope1, setScope2);
    }
  }, [activeEvidenceTab]);

  const handleStepChange = (s: 1 | 2 | 3) => setTabStep(activeEvidenceTab, s);

  /** 탭 1. 전력·열·스팀 — Scope 2 (EMS) + GHG_UX_REDESIGN_SPEC_1 스텝 플로우 */
  if (activeEvidenceTab === 'power') {
    const hasData = scope2.electricity.length > 0 || scope2.heat.length > 0;
    return (
      <div className="rounded-md border border-border bg-card overflow-hidden">
        <div className="flex-1 min-w-0 p-6 space-y-4">
          <div className="mb-4 p-3 rounded-md bg-slate-50 border border-slate-200 text-sm text-slate-700">
            <strong>전력·열·스팀:</strong> 외부 구매 에너지(전기요금 고지서, 열·스팀 사용 내역서). EMS에서 적재 또는 엑셀 업로드.
          </div>
          <GHGStepFlowView
            tabId="power"
            tabLabel="전력·열·스팀"
            step={step}
            onStepChange={handleStepChange}
            canProceedStep1={hasData}
            canProceedStep2={hasData}
            onSaveTabResult={() => saveSnapshot('전력·열·스팀 결과')}
            step1Content={
              <>
                <RawDataPreviewSection onOpenEMS={onOpenEMS} onOpenExcel={onOpenExcel} />
                <Step2ActivityData disclosureFramework={disclosureFramework} hideScopeSwitch />
              </>
            }
            step2Content={
              <div className="p-4 border border-slate-200 rounded-lg bg-slate-50">
                <p className="text-sm font-semibold text-slate-700 mb-2">산정 실행 — 행별 배출계수 매칭</p>
                <p className="text-sm text-slate-600">STEP 1 데이터에 배출계수를 1:1 매칭하여 산정합니다. (상세 그리드는 Phase 2)</p>
                <Step2ActivityData disclosureFramework={disclosureFramework} hideScopeSwitch />
              </div>
            }
            step3Content={
              <div className="p-4 border border-slate-200 rounded-lg">
                <p className="text-sm font-semibold text-slate-800 mb-4">전력·열·스팀 탭 산정 결과</p>
                <Step4Results />
              </div>
            }
          />
        </div>
      </div>
    );
  }

  /** 탭 2. 연료·차량 — Scope 1 (ERP) + 스텝 플로우 */
  if (activeEvidenceTab === 'fuel') {
    const hasData = scope1.stationary.length > 0 || scope1.mobile.length > 0;
    return (
      <div className="rounded-md border border-border bg-card overflow-hidden">
        <div className="flex-1 min-w-0 p-6 space-y-4">
          <div className="mb-4 p-3 rounded-md bg-slate-50 border border-slate-200 text-sm text-slate-700">
            <strong>연료·차량:</strong> 직접 태우는 에너지(LNG·경유·휘발유 등). 보일러·발전기(고정연소), 차량·지게차(이동연소). ERP에서 적재 또는 엑셀 업로드.
          </div>
          <GHGStepFlowView
            tabId="fuel"
            tabLabel="연료·차량"
            step={step}
            onStepChange={handleStepChange}
            canProceedStep1={hasData}
            canProceedStep2={hasData}
            onSaveTabResult={() => saveSnapshot('연료·차량 결과')}
            step1Content={
              <>
                <RawDataPreviewSection onOpenEMS={onOpenEMS} onOpenExcel={onOpenExcel} />
                <Step2ActivityData disclosureFramework={disclosureFramework} hideScopeSwitch />
              </>
            }
            step2Content={
              <div className="p-4 border border-slate-200 rounded-lg bg-slate-50">
                <p className="text-sm font-semibold text-slate-700 mb-2">산정 실행 — 행별 배출계수 매칭</p>
                <Step2ActivityData disclosureFramework={disclosureFramework} hideScopeSwitch />
              </div>
            }
            step3Content={
              <div className="p-4 border border-slate-200 rounded-lg">
                <p className="text-sm font-semibold text-slate-800 mb-4">연료·차량 탭 산정 결과</p>
                <Step4Results />
              </div>
            }
          />
        </div>
      </div>
    );
  }

  /** 탭 3. 냉매 — Scope 1 (EHS) */
  if (activeEvidenceTab === 'refrigerant') {
    return (
      <div className="rounded-md border border-border bg-card overflow-hidden">
        <div className="flex-1 min-w-0 p-6">
          <div className="mb-4 p-3 rounded-md bg-amber-50 border border-amber-200 text-sm text-amber-900">
            <strong>냉매:</strong> 에어컨·냉동기·칠러의 냉매 누출 배출. EHS 시스템에서 적재 또는 수동 입력.
          </div>
          <RefrigerantTabPlaceholder />
        </div>
      </div>
    );
  }

  /** 탭 4. 폐기물 — Scope 1·3 (EMS) */
  if (activeEvidenceTab === 'waste') {
    return (
      <div className="rounded-md border border-border bg-card overflow-hidden">
        <div className="flex-1 min-w-0 p-6">
          <div className="mb-4 p-3 rounded-md bg-slate-50 border border-slate-200 text-sm text-slate-700">
            <strong>폐기물:</strong> 소각 → Scope 1, 위탁·매립·재활용 → Scope 3 Cat.12. EMS_WASTE.csv 적재 또는 엑셀 업로드.
          </div>
          <Scope3Page disclosureFramework={disclosureFramework} />
        </div>
      </div>
    );
  }

  /** 탭 5. 물류·출장·통근 — Scope 3 (SRM·HR) */
  if (activeEvidenceTab === 'logistics') {
    return (
      <div className="rounded-md border border-border bg-card overflow-hidden">
        <div className="flex-1 min-w-0 p-6">
          <div className="mb-4 p-3 rounded-md bg-slate-50 border border-slate-200 text-sm text-slate-700">
            <strong>물류·출장·통근:</strong> Cat.4 인바운드 물류, Cat.6 출장, Cat.7 통근, Cat.9 아웃바운드 물류. SRM·HR 시스템에서 적재.
          </div>
          <Scope3Page disclosureFramework={disclosureFramework} />
        </div>
      </div>
    );
  }

  /** 탭 6. 원료·제품 — Scope 3 (SRM·PLM) */
  if (activeEvidenceTab === 'materials') {
    return (
      <div className="rounded-md border border-border bg-card overflow-hidden">
        <div className="flex-1 min-w-0 p-6">
          <div className="mb-4 p-3 rounded-md bg-slate-50 border border-slate-200 text-sm text-slate-700">
            <strong>원료·제품:</strong> Cat.1 구매 물품, Cat.11 제품 사용, Cat.12 제품 폐기. SRM·PLM 시스템에서 적재.
          </div>
          <Scope3Page disclosureFramework={disclosureFramework} />
        </div>
      </div>
    );
  }

  return null;
}

/** GHG_TAB_DESIGN_v2 §탭 3: 냉매 그리드 플레이스홀더 */
function RefrigerantTabPlaceholder() {
  const cols = [
    '사업장',
    '설비ID',
    '설비유형',
    '냉매종류',
    '충전(kg)',
    '누출(kg)',
    'GWP',
    '점검일',
    '품질',
    '출처',
    '이력',
  ];
  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-200">
              {cols.map((c) => (
                <th key={c} className="px-4 py-3 text-left font-semibold text-slate-700">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={cols.length} className="py-12 text-center text-muted-foreground text-sm">
                <p className="font-medium mb-1.5">입력된 데이터가 없습니다.</p>
                <p>[EHS 불러오기] 또는 [엑셀 업로드]로 데이터를 가져오거나, [+ 행 추가]로 직접 입력하세요.</p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

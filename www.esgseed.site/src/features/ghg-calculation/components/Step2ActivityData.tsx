'use client';

import { Button } from '@/components/ui/button';
import { Scope1Page } from '../scope1/Scope1Page';
import { Scope2Page } from '../scope2/Scope2Page';
import { Scope3Page } from '../scope3/Scope3Page';
import { useGHGStore } from '../store/ghg.store';
import type { GHGActiveScope, GHGScope1SubTab, GHGScope2SubTab } from '../store/ghg.store';

/**
 * Step 2: 활동자료 입력 (Data Quality)
 * SCOPE1,2_DETAIL §0: 단계별 위저드(1→2→3), 한 번에 한 단계만 표시
 */
function getWizardKey(scope: GHGActiveScope, scope1SubTab: GHGScope1SubTab, scope2SubTab: GHGScope2SubTab): string {
  if (scope === 'scope1') return `scope1-${scope1SubTab}`;
  if (scope === 'scope2') return `scope2-${scope2SubTab}`;
  return 'scope3';
}

/** 1단계: 조건 선택·조회 안내 카드 */
function WizardStep1Card({
  onNext,
  canNext,
  scopeLabel,
}: {
  onNext: () => void;
  canNext: boolean;
  scopeLabel: string;
}) {
  return (
    <div className="border-2 border-slate-200 bg-slate-50 p-8">
      <h3 className="text-xl font-bold text-slate-900 mb-2">1. 조건 선택·조회</h3>
      <p className="text-slate-700 mb-4">
        왼쪽 사이드바에서 <strong>연도·사업장·에너지원</strong>을 선택한 후 <strong>[조회]</strong> 버튼을 클릭하세요.
        <br />
        선택한 조건으로 데이터를 조회합니다.
      </p>
      <p className="text-slate-600 text-sm mb-4">
        상단 툴바의 <strong>[EMS 불러오기]</strong>, <strong>[엑셀 업로드]</strong>로도 데이터를 불러올 수 있습니다. 불러온 데이터는 2단계 테이블에 자동 반영됩니다.
      </p>
      <Button
        onClick={onNext}
        disabled={!canNext}
        className="rounded-none bg-[#669900] hover:bg-[#558000] text-white font-semibold px-6 py-2"
      >
        다음 단계
      </Button>
    </div>
  );
}

export function Step2ActivityData({
  disclosureFramework = 'ISSB',
  hideScopeSwitch = false,
}: {
  disclosureFramework?: string;
  /** GHG_TAB_DESIGN_v2: 탭 모드에서는 Scope 1/2/3 전환 숨김 */
  hideScopeSwitch?: boolean;
}) {
  const activeScope = useGHGStore((s) => s.activeScope);
  const setActiveScope = useGHGStore((s) => s.setActiveScope);
  const scope1SubTab = useGHGStore((s) => s.scope1SubTab);
  const setScope1SubTab = useGHGStore((s) => s.setScope1SubTab);
  const scope2SubTab = useGHGStore((s) => s.scope2SubTab);
  const setScope2SubTab = useGHGStore((s) => s.setScope2SubTab);
  const dataViewMode = useGHGStore((s) => s.dataViewMode);
  const setDataViewMode = useGHGStore((s) => s.setDataViewMode);
  const appliedFiltersByScope = useGHGStore((s) => s.appliedFiltersByScope);
  const wizardStepByKey = useGHGStore((s) => s.wizardStepByKey);
  const setWizardStep = useGHGStore((s) => s.setWizardStep);

  const activeTab = activeScope;
  const appliedFilters = appliedFiltersByScope[activeScope];
  const wizardKey = getWizardKey(activeTab, scope1SubTab, scope2SubTab);
  const step = wizardStepByKey[wizardKey] ?? 1;
  const setStep = (s: 1 | 2 | 3) => setWizardStep(wizardKey, s);

  const scopeLabel =
    activeTab === 'scope1'
      ? `Scope 1 — ${scope1SubTab === 'stationary' ? '고정 연소' : '이동 연소'}`
      : activeTab === 'scope2'
        ? `Scope 2 — ${scope2SubTab === 'electricity' ? '전력' : '열/스팀/온수'}`
        : 'Scope 3';

  return (
    <div className="space-y-6">
      {/* Scope 세그먼트 + 서브탭 + RAW/탄소 */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-wrap gap-4">
          {activeTab === 'scope1' && (
            <div className="flex gap-0">
              <button
                type="button"
                onClick={() => setScope1SubTab('stationary')}
                className={`px-4 py-2 text-sm font-medium rounded-none border border-slate-200 transition-all ${
                  scope1SubTab === 'stationary' ? 'bg-[#669900] text-white border-[#669900]' : 'text-slate-600 bg-slate-50 hover:bg-slate-100'
                }`}
              >
                고정 연소
              </button>
              <button
                type="button"
                onClick={() => setScope1SubTab('mobile')}
                className={`px-4 py-2 text-sm font-medium rounded-none border border-slate-200 transition-all -ml-px ${
                  scope1SubTab === 'mobile' ? 'bg-[#669900] text-white border-[#669900]' : 'text-slate-600 bg-slate-50 hover:bg-slate-100'
                }`}
              >
                이동 연소
              </button>
            </div>
          )}
          {activeTab === 'scope2' && (
            <div className="flex gap-0">
              <button
                type="button"
                onClick={() => setScope2SubTab('electricity')}
                className={`px-4 py-2 text-sm font-medium rounded-none border border-slate-200 transition-all ${
                  scope2SubTab === 'electricity' ? 'bg-[#669900] text-white border-[#669900]' : 'text-slate-600 bg-slate-50 hover:bg-slate-100'
                }`}
              >
                전력
              </button>
              <button
                type="button"
                onClick={() => setScope2SubTab('heat')}
                className={`px-4 py-2 text-sm font-medium rounded-none border border-slate-200 transition-all -ml-px ${
                  scope2SubTab === 'heat' ? 'bg-[#669900] text-white border-[#669900]' : 'text-slate-600 bg-slate-50 hover:bg-slate-100'
                }`}
              >
                열/스팀/온수
              </button>
            </div>
          )}
          {(activeTab === 'scope1' || activeTab === 'scope2') && step !== 1 && (
            <div className="flex gap-0 p-1 bg-amber-50/50 border border-amber-200/50">
              <button
                type="button"
                onClick={() => setDataViewMode('raw')}
                className={`px-4 py-2 text-sm font-medium rounded-none transition-all ${
                  dataViewMode === 'raw' ? 'bg-amber-600 text-white' : 'text-slate-600 hover:bg-amber-100'
                }`}
              >
                RAW 데이터 관리
              </button>
              <button
                type="button"
                onClick={() => setDataViewMode('emission')}
                className={`px-4 py-2 text-sm font-medium rounded-none transition-all ${
                  dataViewMode === 'emission' ? 'bg-amber-600 text-white' : 'text-slate-600 hover:bg-amber-100'
                }`}
              >
                탄소 배출량 관리
              </button>
            </div>
          )}
        </div>
        {!hideScopeSwitch && (
          <div className="flex gap-0 border border-slate-300 rounded-none overflow-hidden ml-auto">
            {(['scope1', 'scope2', 'scope3'] as const)
              .filter((s) => !(disclosureFramework === 'K-ETS' && s === 'scope3'))
              .map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setActiveScope(s)}
                className={`px-5 py-2.5 text-sm font-semibold rounded-none transition-all border-r border-slate-300 last:border-r-0 ${
                  activeTab === s ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {s === 'scope1' ? 'Scope 1' : s === 'scope2' ? 'Scope 2' : 'Scope 3'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 단계 인디케이터 (SCOPE1,2_DETAIL §0) */}
      <div className="flex gap-2 text-sm">
        <span className={step === 1 ? 'font-bold text-[#669900]' : 'text-slate-500'}>1. 조건 선택</span>
        <span className="text-slate-400">→</span>
        <span className={step === 2 ? 'font-bold text-[#669900]' : 'text-slate-500'}>2. 활동자료 입력</span>
        <span className="text-slate-400">→</span>
        <span className={step === 3 ? 'font-bold text-[#669900]' : 'text-slate-500'}>3. 결과 확인</span>
      </div>

      {activeTab === 'scope1' && (
        <section>
          <h3 className="text-lg font-bold text-foreground mb-2">{scopeLabel}</h3>
          {disclosureFramework === 'K-ETS' && (
            <div className="mb-4 p-3 rounded-md bg-amber-50 border border-amber-200 text-sm text-amber-900">
              <strong>K-ETS:</strong> 월별 에너지 사용량 보고 의무. Scope 1 데이터를 우선 입력하세요.
            </div>
          )}
          {step === 1 && (
            <WizardStep1Card
              scopeLabel={scopeLabel}
              canNext={!!appliedFilters}
              onNext={() => setStep(2)}
            />
          )}
          {step === 2 && (
            <>
              <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-none space-y-2">
                <p className="text-sm font-semibold text-slate-900">2. 활동자료 입력</p>
                <p className="text-sm text-slate-700">
                  월·사업장·에너지원·<strong>사용량</strong>을 입력하세요. <strong>입력 행이 없으면 [연료 추가](고정연소) 또는 [항목 추가](이동연소) 버튼을 먼저 눌러 주세요.</strong>
                </p>
                <p className="text-xs text-slate-600">
                  EMS·엑셀: 상단 툴바 <strong>[EMS 불러오기]</strong> 또는 <strong>[엑셀 업로드]</strong> 클릭 → 데이터는 이 화면 테이블에 반영됩니다.
                </p>
              </div>
              <Scope1Page
                appliedFilters={appliedFilters}
                activeSubTab={scope1SubTab}
                dataViewMode={dataViewMode}
                wizardStepMode={2}
              />
              <div className="flex gap-3 mt-6">
                <Button variant="outline" className="rounded-none" onClick={() => setStep(1)}>
                  이전 단계
                </Button>
                <Button className="rounded-none bg-[#669900] hover:bg-[#558000] text-white" onClick={() => setStep(3)}>
                  다음 단계
                </Button>
              </div>
            </>
          )}
          {step === 3 && (
            <>
              <Scope1Page
                appliedFilters={appliedFilters}
                activeSubTab={scope1SubTab}
                dataViewMode={dataViewMode}
                wizardStepMode={3}
              />
              <div className="flex gap-3 mt-6">
                <Button variant="outline" className="rounded-none" onClick={() => setStep(2)}>
                  이전 단계
                </Button>
              </div>
            </>
          )}
        </section>
      )}

      {activeTab === 'scope2' && (
        <section>
          <h3 className="text-lg font-bold text-foreground mb-2">{scopeLabel}</h3>
          {(disclosureFramework === 'ISSB' || disclosureFramework === 'ESRS') && (
            <div className="mb-4 p-3 rounded-md bg-slate-50 border border-slate-200 text-sm text-slate-700">
              <strong>ISSB/ESRS:</strong> Scope 2는 위치 기반 + 시장 기반(REC/PPA) 이중 공시 필요. 시장 기반 적용 시 REC·PPA 입력을 활용하세요.
            </div>
          )}
          {step === 1 && (
            <WizardStep1Card
              scopeLabel={scopeLabel}
              canNext={!!appliedFilters}
              onNext={() => setStep(2)}
            />
          )}
          {(step === 2 || step === 3) && (
            <>
              {step === 2 && (
                <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-none space-y-2">
                  <p className="text-sm font-semibold text-slate-900">2. 활동자료 입력</p>
                  <p className="text-sm text-slate-700">
                    사용량을 입력하세요. <strong>입력 행이 없으면 [전력 행 추가] 또는 [표준열 추가]/[KDHC 추가](열) 버튼을 먼저 눌러 주세요.</strong>
                  </p>
                  <p className="text-xs text-slate-600">
                    EMS·엑셀: 상단 툴바 <strong>[EMS 불러오기]</strong>, <strong>[엑셀 업로드]</strong> → 데이터는 이 화면 테이블에 반영됩니다.
                  </p>
                </div>
              )}
              <Scope2Page
                appliedFilters={appliedFilters}
                activeSubTab={scope2SubTab}
                dataViewMode={dataViewMode}
              />
              <div className="flex gap-3 mt-6">
                <Button variant="outline" className="rounded-none" onClick={() => setStep(step === 2 ? 1 : 2)}>
                  이전 단계
                </Button>
                {step === 2 && (
                  <Button className="rounded-none bg-[#669900] hover:bg-[#558000] text-white" onClick={() => setStep(3)}>
                    다음 단계
                  </Button>
                )}
              </div>
            </>
          )}
        </section>
      )}
      {activeTab === 'scope3' && (
        <section>
          <h3 className="text-lg font-bold text-foreground mb-2">{scopeLabel}</h3>
          {(disclosureFramework === 'ISSB' || disclosureFramework === 'ESRS') && (
            <div className="mb-4 p-3 rounded-md bg-slate-50 border border-slate-200 text-sm text-slate-700">
              <strong>ISSB/ESRS:</strong> 중대한 카테고리 우선 입력 권장. 카테고리별 중대성 판단 후 공시 범위를 결정하세요.
            </div>
          )}
          {step === 1 && (
            <WizardStep1Card
              scopeLabel={scopeLabel}
              canNext={!!appliedFilters}
              onNext={() => setStep(2)}
            />
          )}
          {(step === 2 || step === 3) && (
            <>
              <Scope3Page disclosureFramework={disclosureFramework} />
              <div className="flex gap-3 mt-6">
                <Button variant="outline" className="rounded-none" onClick={() => setStep(step === 2 ? 1 : 2)}>
                  이전 단계
                </Button>
                {step === 2 && (
                  <Button className="rounded-none bg-[#669900] hover:bg-[#558000] text-white" onClick={() => setStep(3)}>
                    다음 단계
                  </Button>
                )}
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}

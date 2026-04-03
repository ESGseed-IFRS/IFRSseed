'use client';

import { Button } from '@/components/ui/button';
import { useGHGStore } from '../store/ghg.store';

/**
 * GHG_UX_REDESIGN_SPEC_1 §1: 스텝 플로우 UI
 * ● STEP 1 데이터 확인 ── ○ STEP 2 산정 실행 ── ○ STEP 3 결과 확인
 * 한 번에 하나의 STEP만 화면에 표시
 */
interface GHGStepFlowViewProps {
  tabId: string;
  tabLabel: string;
  step: 1 | 2 | 3;
  onStepChange: (step: 1 | 2 | 3) => void;
  step1Content: React.ReactNode;
  step2Content: React.ReactNode;
  step3Content: React.ReactNode;
  canProceedStep1?: boolean;
  canProceedStep2?: boolean;
  onSaveTabResult?: () => void;
}

export function GHGStepFlowView({
  tabId,
  tabLabel,
  step,
  onStepChange,
  step1Content,
  step2Content,
  step3Content,
  canProceedStep1 = true,
  canProceedStep2 = true,
  onSaveTabResult,
}: GHGStepFlowViewProps) {
  const setTabStep = useGHGStore((s) => s.setTabStep);

  const goNext = () => {
    if (step === 1 && canProceedStep1) {
      onStepChange(2);
      setTabStep(tabId, 2);
    } else if (step === 2 && canProceedStep2) {
      onStepChange(3);
      setTabStep(tabId, 3);
    }
  };

  const goPrev = () => {
    if (step === 2) {
      onStepChange(1);
      setTabStep(tabId, 1);
    } else if (step === 3) {
      onStepChange(2);
      setTabStep(tabId, 2);
    }
  };

  return (
    <div className="space-y-6">
      {/* GHG_UX_REDESIGN_SPEC_1 §1: 스텝 인디케이터 */}
      <nav
        className="flex items-center gap-2 text-sm font-semibold text-slate-600"
        aria-label="산정 단계"
      >
        <StepDot
          label="STEP 1 데이터 확인"
          isActive={step === 1}
          isComplete={step > 1}
          onClick={() => {
            onStepChange(1);
            setTabStep(tabId, 1);
          }}
        />
        <span className="text-slate-300">──</span>
        <StepDot
          label="STEP 2 산정 실행"
          isActive={step === 2}
          isComplete={step > 2}
          onClick={() => step > 1 && (onStepChange(2), setTabStep(tabId, 2))}
        />
        <span className="text-slate-300">──</span>
        <StepDot
          label="STEP 3 결과 확인"
          isActive={step === 3}
          isComplete={false}
          onClick={() => step > 2 && (onStepChange(3), setTabStep(tabId, 3))}
        />
      </nav>

      {/* 단계별 콘텐츠 — 한 번에 하나만 표시 */}
      <div className="min-h-[320px]">
        {step === 1 && step1Content}
        {step === 2 && step2Content}
        {step === 3 && step3Content}
      </div>

      {/* 이전 / 다음 버튼 */}
      <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
        {step > 1 ? (
          <Button variant="outline" onClick={goPrev} className="rounded-md">
            ← 이전
          </Button>
        ) : (
          <div />
        )}
        {step === 1 && (
          <Button
            onClick={goNext}
            disabled={!canProceedStep1}
            className="rounded-md bg-[#669900] hover:bg-[#558000]"
          >
            다음 단계 →
          </Button>
        )}
        {step === 2 && (
          <Button
            onClick={goNext}
            disabled={!canProceedStep2}
            className="rounded-md bg-[#669900] hover:bg-[#558000]"
          >
            다음 단계 →
          </Button>
        )}
        {step === 3 && (
          <Button
            onClick={onSaveTabResult ?? (() => useGHGStore.getState().saveSnapshot(`${tabLabel} 결과`))}
            className="rounded-md bg-[#669900] hover:bg-[#558000]"
          >
            이 탭 결과 저장
          </Button>
        )}
      </div>
    </div>
  );
}

function StepDot({
  label,
  isActive,
  isComplete,
  onClick,
}: {
  label: string;
  isActive: boolean;
  isComplete: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#669900] rounded px-2 py-1 ${
        isActive ? 'text-[#669900]' : isComplete ? 'text-slate-500' : 'text-slate-400'
      }`}
    >
      <span
        className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold ${
          isActive ? 'bg-[#669900] text-white' : isComplete ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-500'
        }`}
        aria-hidden
      >
        {isComplete ? '✓' : isActive ? '●' : '○'}
      </span>
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

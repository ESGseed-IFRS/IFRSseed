'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { GHGBoundarySettings, isBoundaryComplete } from './GHGBoundarySettings';
import { Step2ActivityData } from './Step2ActivityData';
import { Step3Methodology } from './Step3Methodology';
import { Step4Results } from './Step4Results';
import { Step5Report } from './Step5Report';
import { useGHGStore } from '../store/ghg.store';
import { toast } from 'sonner';

const TOTAL_STEPS = 5;

const STEP_INFO: { label: string; title: string; desc: string }[] = [
  { label: 'Step 1: Boundary Setting', title: '산정 설정 (Boundary & Policy)', desc: 'GHG Protocol 준수를 위한 조직 및 운영 경계를 설정합니다.' },
  { label: 'Step 2: Activity Data', title: '활동자료 입력 (Data Quality)', desc: '배출 활동에 대한 정량적 데이터를 입력하고 품질(실측/추정/공급자)을 선택합니다.' },
  { label: 'Step 3: Methodology', title: '방법론 자동 매핑 (Logic)', desc: '입력 데이터와 최적의 배출계수를 알고리즘으로 연결합니다.' },
  { label: 'Step 4: Result Analysis', title: '배출량 산정 결과', desc: '최종 계산된 온실가스 배출량 및 데이터 신뢰도를 확인합니다.' },
  { label: 'Step 5: Documentation', title: '증적 저장 및 보고', desc: '공시 및 검증에 필요한 모든 데이터 리포트를 생성합니다.' },
];

/**
 * GHG_Strategy2.md 기반 5단계 스테퍼 위저드
 * 사용자·실무자 업무 플로우: 경계 선택 → 활동자료+데이터품질 선택 → 방법론 자동매핑 확인 → 결과 → 보고
 */
export function GHGStepperWizard() {
  const [currentStep, setCurrentStep] = useState(1);
  const boundaryPolicy = useGHGStore((s) => s.boundaryPolicy);
  const boundaryComplete = isBoundaryComplete(boundaryPolicy);

  const progressPercent = (currentStep / TOTAL_STEPS) * 100;
  const info = STEP_INFO[currentStep - 1];

  const canGoNext = () => {
    if (currentStep === 1) return boundaryComplete;
    return true;
  };

  const handleNext = () => {
    if (currentStep === 1 && !boundaryComplete) {
      toast.error('조직 경계를 선택한 뒤 다음 단계로 진행해 주세요.');
      return;
    }
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep((s) => s + 1);
    } else {
      setCurrentStep(1);
      toast.success('처음 단계로 돌아갑니다.');
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) setCurrentStep((s) => s - 1);
  };

  return (
    <div className="space-y-6">
      {/* 진행 바 */}
      <div>
        <div className="flex justify-between mb-2">
          <span className="text-sm font-semibold text-[#669900] uppercase tracking-wider">{info.label}</span>
          <span className="text-sm font-medium text-slate-400">{Math.round(progressPercent)}% Completed</span>
        </div>
        <div className="w-full bg-slate-200 rounded-full h-2">
          <div
            className="h-2 rounded-full bg-[#558000] transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* 스텝 헤더 */}
      <div className="bg-slate-50 border-b border-slate-200 px-6 py-5 rounded-t-2xl">
        <h2 className="text-2xl font-bold text-slate-900">{info.title}</h2>
        <p className="text-slate-500 mt-1">{info.desc}</p>
      </div>

      {/* 스텝 콘텐츠 */}
      <div className="bg-white border border-t-0 border-slate-200 rounded-b-2xl shadow-sm overflow-hidden">
        <div className="p-6 md:p-8">
          {currentStep === 1 && <GHGBoundarySettings />}
          {currentStep === 2 && <Step2ActivityData />}
          {currentStep === 3 && <Step3Methodology />}
          {currentStep === 4 && <Step4Results />}
          {currentStep === 5 && <Step5Report />}
        </div>

        {/* 이전 / 다음 */}
        <div className="mt-6 pt-6 border-t border-slate-100 px-6 md:px-8 flex justify-between items-center">
          <Button
            type="button"
            variant="ghost"
            className="text-slate-500 hover:text-slate-700"
            onClick={handlePrev}
            disabled={currentStep === 1}
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            이전
          </Button>
          <Button
            type="button"
            className="bg-slate-900 hover:bg-emerald-700 text-white px-8"
            onClick={handleNext}
          >
            {currentStep === TOTAL_STEPS ? (
              <>
                처음으로 <RotateCcw className="h-4 w-4 ml-2" />
              </>
            ) : (
              <>
                다음 단계 <ChevronRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

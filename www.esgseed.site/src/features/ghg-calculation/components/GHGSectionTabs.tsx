'use client';

import { useState } from 'react';
import { GHGDataManagementCenter } from './GHGDataManagementCenter';
import { Step3Methodology } from './Step3Methodology';
import { Step4Results } from './Step4Results';
import { Step5Report } from './Step5Report';

export type GHGSectionTab = 'data' | 'result' | 'report';

/** SIDBAR_CONNECT 0-1: 리포트는 상단 '리포트 생성' 탭으로 이동, 여기는 데이터+결과만 */
const SECTIONS: { id: GHGSectionTab; label: string; title: string; desc: string }[] = [
  { id: 'data', label: '데이터 관리 센터', title: '활동자료 입력 (Data Quality)', desc: '사이드바에서 사업장·에너지원·연도·시기 단위를 선택하고, EMS·엑셀·수동으로 데이터를 입력합니다.' },
  { id: 'result', label: '결과', title: '배출량 산정 결과', desc: '최종 계산된 온실가스 배출량 및 데이터 신뢰도를 확인합니다.' },
  { id: 'report', label: '리포트', title: '증적 저장 및 보고', desc: '공시 및 검증에 필요한 PDF·Excel 리포트를 생성합니다.' },
];

/**
 * GHG 산정 플랫 섹션 탭 — GHG_UI_Strategy_v2
 * 산정 설정 제거, 데이터 관리 센터 기본 진입
 */
export function GHGSectionTabs() {
  const [activeTab, setActiveTab] = useState<GHGSectionTab>('data');

  const info = SECTIONS.find((s) => s.id === activeTab) ?? SECTIONS[0];

  return (
    <div className="space-y-6">
      {/* SIDBAR_CONNECT 0-2: 날카로운 모서리, 산정 엔진 내부 탭(데이터+결과) */}
      <nav className="flex flex-wrap gap-0 p-0 w-fit">
        {SECTIONS.filter((s) => s.id !== 'report').map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setActiveTab(s.id)}
            className={`px-5 py-2.5 text-sm font-semibold rounded-none transition-all border border-slate-200 ${
              i === 0 ? 'rounded-l-sm' : ''
            } ${i === SECTIONS.filter((x) => x.id !== 'report').length - 1 ? 'rounded-r-sm' : ''} ${
              activeTab === s.id ? 'bg-[#669900] text-white border-[#669900] shadow' : 'text-slate-600 bg-slate-100 hover:bg-white'
            }`}
          >
            {s.label}
          </button>
        ))}
      </nav>

      {/* 섹션 헤더 - 날카로운 모서리 */}
      <div className="bg-slate-50 border-b border-slate-200 px-6 py-5 rounded-t-sm">
        <h2 className="text-2xl font-bold text-slate-900">{info.title}</h2>
        <p className="text-slate-500 mt-1">{info.desc}</p>
      </div>

      {/* 섹션 콘텐츠 - 날카로운 모서리 */}
      <div className="bg-white border border-t-0 border-slate-200 rounded-b-sm shadow-sm overflow-hidden">
        <div className="p-6 md:p-8">
          {activeTab === 'data' && <GHGDataManagementCenter />}
          {activeTab === 'result' && (
            <>
              <Step4Results />
              <div className="mt-6 pt-6 border-t border-slate-100">
                <Step3Methodology />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

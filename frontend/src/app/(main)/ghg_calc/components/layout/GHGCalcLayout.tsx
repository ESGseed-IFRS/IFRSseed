'use client';

import { Bell, HelpCircle, ChevronDown } from "lucide-react";
import { Sidebar, type CalcSubTab } from "./Sidebar";
import type { MainTab, RawDataCategory } from "../../types/ghg";

const RAW_DATA_CATEGORY_LABELS: Record<RawDataCategory, string> = {
  energy: "에너지 사용량",
  waste: "폐기물 반출량",
  pollution: "오염물질 배출량",
  chemical: "약품사용량",
  "energy-provider": "에너지조달업체",
  consignment: "위탁처리업체",
};

const breadcrumbMap: Record<string, string[]> = {
  'calc-raw-data': ["3-1. GHG 산정", "Raw Data 업로드"],
  'calc-anomaly': ["3-1. GHG 산정", "이상치 검증"],
  'calc-emission-factor': ["3-1. GHG 산정", "배출계수 매핑"],
  'calc-scope-calculation': ["3-1. GHG 산정", "Scope 1·2·3 산정"],
  'calc-group-results': ["3-1. GHG 산정", "산정 결과 조회 (그룹)"],
  audit: ["3-2. Audit Trail", "통합 감사 추적 (타임라인)"],
  'report': ["3-3. GHG 보고서", "GHG 보고서 출력"],
};

interface GHGCalcLayoutProps {
  mainTab: MainTab;
  setMainTab: (t: MainTab) => void;
  calcSubTab: CalcSubTab;
  setCalcSubTab: (t: CalcSubTab) => void;
  rawDataCategory: RawDataCategory;
  setRawDataCategory: (c: RawDataCategory) => void;
  children: React.ReactNode;
}

export function GHGCalcLayout({
  mainTab,
  setMainTab,
  calcSubTab,
  setCalcSubTab,
  rawDataCategory,
  setRawDataCategory,
  children,
}: GHGCalcLayoutProps) {
  const key = mainTab === 'calc' ? `calc-${calcSubTab}` : mainTab === 'audit' ? 'audit' : 'report';
  const baseCrumbs = breadcrumbMap[key] ?? ["홈"];
  const crumbs = calcSubTab === 'raw-data'
    ? ["3-1. GHG 산정", "Raw Data", RAW_DATA_CATEGORY_LABELS[rawDataCategory]]
    : baseCrumbs;

  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden bg-[#f4f6f9]">
      <Sidebar
        mainTab={mainTab}
        setMainTab={setMainTab}
        calcSubTab={calcSubTab}
        setCalcSubTab={setCalcSubTab}
        rawDataCategory={rawDataCategory}
        setRawDataCategory={setRawDataCategory}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="hover:text-gray-700 cursor-pointer">홈</span>
            {crumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-1.5">
                <span className="text-gray-300">/</span>
                <span className={i === crumbs.length - 1 ? "text-gray-800" : "text-gray-500"} style={i === crumbs.length - 1 ? { fontWeight: 600 } : {}}>
                  {c}
                </span>
              </span>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <button className="relative p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <Bell size={16} className="text-gray-500" />
              <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
            <button className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              <HelpCircle size={16} className="text-gray-500" />
            </button>
            <div className="flex items-center gap-2 pl-3 border-l border-gray-200">
              <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center">
                <span className="text-emerald-700 text-xs" style={{ fontWeight: 700 }}>김</span>
              </div>
              <div className="text-xs">
                <div className="text-gray-800" style={{ fontWeight: 600 }}>박지훈</div>
                <div className="text-gray-400" style={{ fontSize: "10px" }}>미라콤</div>
              </div>
              <ChevronDown size={12} className="text-gray-400" />
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

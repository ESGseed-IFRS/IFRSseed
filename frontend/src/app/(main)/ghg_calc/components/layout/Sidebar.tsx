'use client';

import { useState } from "react";
import {
  ChevronDown, ChevronRight,
  Upload, AlertTriangle, GitMerge, Calculator,
  BarChart3, FlaskConical,
  FileBarChart2, Shield,
  Zap, Trash2, Wind, Factory, Building2,
} from "lucide-react";
import { C } from '@/app/(main)/dashboard/lib/constants';
import type { MainTab, RawDataCategory } from "../../types/ghg";
import { useGhgSession } from "../../lib/ghgSession";

export type CalcSubTab = 'raw-data' | 'anomaly' | 'emission-factor' | 'scope-calculation' | 'group-results';

/** Raw Data 대분류 6개 (사이드바 1depth) */
const RAW_DATA_CATEGORIES: { id: RawDataCategory; label: string; icon: React.ReactNode }[] = [
  { id: 'energy', label: '에너지 사용량', icon: <Zap size={13} /> },
  { id: 'waste', label: '폐기물 반출량', icon: <Trash2 size={13} /> },
  { id: 'pollution', label: '오염물질 배출량', icon: <Wind size={13} /> },
  { id: 'chemical', label: '약품사용량', icon: <FlaskConical size={13} /> },
  { id: 'energy-provider', label: '에너지조달업체', icon: <Factory size={13} /> },
  { id: 'consignment', label: '위탁처리업체', icon: <Building2 size={13} /> },
];

interface SidebarProps {
  mainTab: MainTab;
  setMainTab: (t: MainTab) => void;
  calcSubTab: CalcSubTab;
  setCalcSubTab: (t: CalcSubTab) => void;
  rawDataCategory: RawDataCategory;
  setRawDataCategory: (c: RawDataCategory) => void;
}

const calcOtherChildrenBase: { id: CalcSubTab; label: string; icon: React.ReactNode; badge?: string }[] = [
  { id: 'anomaly', label: '이상치 검증', icon: <AlertTriangle size={13} /> },
  { id: 'emission-factor', label: '배출계수 매핑', icon: <GitMerge size={13} /> },
  { id: 'scope-calculation', label: 'Scope 1·2·3 산정', icon: <Calculator size={13} /> },
  { id: 'group-results', label: '산정 결과 조회 (그룹)', icon: <BarChart3 size={13} />, badge: '지주' },
];

const badgeColor: Record<string, string> = {
  실무: "bg-blue-500/20 text-blue-300",
  지주: "bg-purple-500/20 text-purple-300",
  "본 법인": "bg-blue-500/20 text-blue-300",
  감사: "bg-orange-500/20 text-orange-300",
};

export function Sidebar({ mainTab, setMainTab, calcSubTab, setCalcSubTab, rawDataCategory, setRawDataCategory }: SidebarProps) {
  const { session } = useGhgSession();
  const [openMenus, setOpenMenus] = useState<string[]>(["ghg-section", "raw-data-section", "audit-section", "report-section"]);

  const calcMenuOthers = calcOtherChildrenBase.map((c) =>
    c.id === "group-results"
      ? {
          ...c,
          label: session.canViewGroupAggregate ? "산정 결과 조회 (그룹)" : "산정 결과 조회",
          badge: session.canViewGroupAggregate ? "지주" : "본 법인",
        }
      : c,
  );

  const toggleMenu = (key: string) => {
    setOpenMenus((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const selectRawDataCategory = (category: RawDataCategory) => {
    setMainTab('calc');
    setCalcSubTab('raw-data');
    setRawDataCategory(category);
  };

  const isCalcActive = mainTab === 'calc';
  const isRawDataActive = isCalcActive && calcSubTab === 'raw-data';
  const isAuditActive = mainTab === 'audit';
  const isReportActive = mainTab === 'report';

  return (
    <aside
      className="flex h-full w-[236px] shrink-0 flex-col text-white"
      style={{ background: C.navy }}
    >
      <div className="border-b border-white/[0.08] px-3.5 py-3" style={{ flexShrink: 0 }}>
        <div className="flex items-center gap-2">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-semibold text-white"
            style={{ background: C.blue }}
          >
            SDS
          </div>
          <div className="min-w-0 leading-tight" style={{ lineHeight: 1.2 }}>
            <div className="text-white" style={{ fontWeight: 600, fontSize: 12 }}>
              Samsung SDS
            </div>
            <div style={{ fontSize: 10, fontWeight: 400, color: 'rgba(234,242,255,0.72)', marginTop: 2 }}>
              GHG 관리 시스템
            </div>
          </div>
        </div>
      </div>

      <div className="border-b border-white/10 bg-white/[0.04] px-3.5 py-2">
        <div className="flex items-center gap-2">
          <div
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-blue-100"
            style={{ fontSize: '10px', fontWeight: 600, background: 'rgba(19,81,216,0.25)', borderColor: 'rgba(19,81,216,0.45)' }}
          >
            박
          </div>
          <div className="min-w-0">
            <div className="truncate text-white/90" style={{ fontSize: '11px', fontWeight: 500 }}>
              {session.userDisplayName} · {session.corpDisplayName}
            </div>
            <div className="mt-0.5 flex items-center gap-1">
              <span
                className="rounded px-1.5 py-0.5 text-blue-200"
                style={{ fontSize: '9px', fontWeight: 600, background: 'rgba(19,81,216,0.2)' }}
              >
                {session.userRoleLabel}
              </span>
            </div>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-1.5" style={{ scrollbarWidth: 'none' }}>

        {/* 3-1. GHG 산정 */}
        <div>
          <button
            type="button"
            onClick={() => toggleMenu("ghg-section")}
            className="flex w-full items-center gap-2 px-3.5 py-1.5 text-white/50 transition-colors hover:text-white/75"
          >
            <Calculator size={14} />
            <span className="flex-1 text-left" style={{ fontSize: '12px', fontWeight: 600 }}>
              GHG 산정
            </span>
            {openMenus.includes("ghg-section") ? <ChevronDown size={11} className="opacity-50" /> : <ChevronRight size={11} className="opacity-50" />}
          </button>
          {openMenus.includes("ghg-section") && (
            <div className="pb-1">
              {/* Raw Data — 6개 대분류 1depth (전략: 전력/열·스팀/수질/대기는 사이드바에 넣지 않음) */}
              <div>
                <button
                  type="button"
                  onClick={() => toggleMenu("raw-data-section")}
                  className="mx-2 flex w-full items-center gap-2 rounded-lg py-1 pl-7 pr-2.5 text-left text-white/50 transition-colors hover:text-white/75"
                >
                  <Upload size={13} className="opacity-70 shrink-0" />
                  <span className="flex-1 truncate" style={{ fontSize: "11.5px" }}>Raw Data</span>
                  <span className="px-1.5 py-0.5 rounded shrink-0 bg-blue-500/20 text-blue-300" style={{ fontSize: "9px" }}>실무</span>
                  {openMenus.includes("raw-data-section") ? <ChevronDown size={11} className="opacity-50" /> : <ChevronRight size={11} className="opacity-50" />}
                </button>
                {openMenus.includes("raw-data-section") && (
                  <div className="pl-2">
                    {RAW_DATA_CATEGORIES.map((cat) => {
                      const active = isRawDataActive && rawDataCategory === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => selectRawDataCategory(cat.id)}
                          className={`flex w-full items-center gap-2 rounded-lg py-1 pl-9 pr-2.5 text-left transition-colors ${
                            active ? 'bg-white/10 text-white' : 'text-white/45 hover:bg-white/5 hover:text-white/75'
                          }`}
                        >
                          <span className="opacity-70 shrink-0">{cat.icon}</span>
                          <span className="flex-1 truncate" style={{ fontSize: "11px" }}>{cat.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              {/* 이상치 검증, 배출계수 매핑 등 */}
              {calcMenuOthers.map((child) => {
                const active = isCalcActive && calcSubTab === child.id;
                return (
                  <button
                    key={child.id}
                    type="button"
                    onClick={() => {
                      setMainTab('calc');
                      setCalcSubTab(child.id);
                    }}
                    className={`mx-2 flex w-full items-center gap-2 rounded-lg py-1 pl-7 pr-2.5 text-left transition-colors ${
                      active ? 'bg-white/10 text-white' : 'text-white/45 hover:bg-white/5 hover:text-white/75'
                    }`}
                  >
                    <span className="opacity-70 shrink-0">{child.icon}</span>
                    <span className="flex-1 truncate" style={{ fontSize: "11.5px" }}>{child.label}</span>
                    {child.badge && (
                      <span className={`px-1.5 py-0.5 rounded shrink-0 ${badgeColor[child.badge] ?? "bg-gray-500/20 text-gray-400"}`} style={{ fontSize: "9px" }}>
                        {child.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 3-2. Audit Trail */}
        <div>
          <button
            type="button"
            onClick={() => toggleMenu("audit-section")}
            className="flex w-full items-center gap-2 px-3.5 py-1.5 text-white/50 transition-colors hover:text-white/75"
          >
            <Shield size={14} />
            <span className="flex-1 text-left" style={{ fontSize: '12px', fontWeight: 600 }}>
              Audit Trail
            </span>
            {openMenus.includes("audit-section") ? <ChevronDown size={11} className="opacity-50" /> : <ChevronRight size={11} className="opacity-50" />}
          </button>
          {openMenus.includes("audit-section") && (
            <div className="pb-1">
              <button
                type="button"
                onClick={() => setMainTab('audit')}
                className={`mx-2 flex w-full items-center gap-2 rounded-lg py-1 pl-7 pr-2.5 text-left transition-colors ${
                  isAuditActive ? 'bg-white/10 text-white' : 'text-white/45 hover:bg-white/5 hover:text-white/75'
                }`}
              >
                <span className="opacity-70 shrink-0">
                  <Shield size={13} />
                </span>
                <span className="flex-1 truncate" style={{ fontSize: '11.5px' }}>
                  통합 감사 추적
                </span>
              </button>
            </div>
          )}
        </div>

        {/* 3-3. GHG 보고서 */}
        <div>
          <button
            type="button"
            onClick={() => setMainTab('report')}
            className={`mx-2 flex w-full items-center gap-2 rounded-lg px-2 py-2 transition-colors ${
              isReportActive ? 'bg-white/10 text-white' : 'text-white/55 hover:bg-white/5 hover:text-white/80'
            }`}
          >
            <FileBarChart2 size={14} />
            <span style={{ fontSize: '12px', fontWeight: isReportActive ? 600 : 400 }}>GHG 보고서</span>
          </button>
        </div>
      </nav>

      <div className="flex items-center justify-between border-t border-white/10 px-3.5 py-2.5">
        <div className="text-white/30" style={{ fontSize: '10px', fontWeight: 500 }}>
          v2.4.1 · 2026년
        </div>
        <div className="h-2 w-2 animate-pulse rounded-full" style={{ background: C.blue }} />
      </div>
    </aside>
  );
}

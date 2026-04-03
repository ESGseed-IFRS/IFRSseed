'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, HelpCircle, ChevronDown, Building2, User, LogOut } from "lucide-react";
import { Sidebar, type CalcSubTab } from "./Sidebar";
import type { MainTab, RawDataCategory } from "../../types/ghg";
import { readAuthUserFromStorage, useGhgSession } from "../../lib/ghgSession";
import { useAuthSessionStore } from "@/store/authSessionStore";

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
  const router = useRouter();
  const { session } = useGhgSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const authUser = typeof window !== 'undefined' ? readAuthUserFromStorage() : null;
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:9006';

  const handleLogout = async () => {
    setMenuOpen(false);
    try {
      await fetch(`${apiBaseUrl}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      /* 서버 실패 시에도 클라이언트 세션은 정리 */
    }
    sessionStorage.removeItem('accessToken');
    useAuthSessionStore.getState().clearAuth();
    router.push('/login');
  };

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
            <div className="relative pl-3 border-l border-gray-200" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((o) => !o)}
                className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-0.5 hover:bg-gray-100 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                aria-label="계정 메뉴"
              >
                <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                  <span className="text-emerald-700 text-xs" style={{ fontWeight: 700 }}>
                    {session.userDisplayName.slice(0, 1)}
                  </span>
                </div>
                <div className="text-xs text-left min-w-0">
                  <div className="text-gray-800 truncate" style={{ fontWeight: 600 }}>
                    {session.userDisplayName}
                  </div>
                  <div className="text-gray-400 truncate" style={{ fontSize: '10px' }}>
                    {session.corpDisplayName}
                  </div>
                </div>
                <ChevronDown
                  size={12}
                  className={`text-gray-400 shrink-0 transition-transform ${menuOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-full z-50 mt-1.5 w-72 rounded-lg border border-gray-200 bg-white py-2 shadow-lg"
                >
                  <div className="border-b border-gray-100 px-3 pb-2">
                    <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                      <Building2 size={12} className="text-gray-400" aria-hidden />
                      회사 정보
                    </div>
                    <p className="text-sm font-semibold text-gray-900">{session.corpDisplayName}</p>
                    {authUser?.company_id && (
                      <p className="mt-0.5 break-all text-[11px] text-gray-500">ID: {authUser.company_id}</p>
                    )}
                  </div>
                  <div className="px-3 py-2">
                    <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                      <User size={12} className="text-gray-400" aria-hidden />
                      사용자 정보
                    </div>
                    <p className="text-sm font-semibold text-gray-900">{session.userDisplayName}</p>
                    <p className="mt-0.5 text-[11px] text-gray-600">역할: {session.userRoleLabel}</p>
                    {authUser?.email && (
                      <p className="mt-1 break-all text-[11px] text-gray-500">{authUser.email}</p>
                    )}
                    {authUser?.department && (
                      <p className="mt-0.5 text-[11px] text-gray-500">부서: {authUser.department}</p>
                    )}
                    {authUser?.position && (
                      <p className="mt-0.5 text-[11px] text-gray-500">직위: {authUser.position}</p>
                    )}
                    {authUser?.user_id && (
                      <p className="mt-1 break-all text-[10px] text-gray-400">사용자 ID: {authUser.user_id}</p>
                    )}
                  </div>
                  <div className="border-t border-gray-100 px-2 pt-1">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-xs font-medium text-red-600 hover:bg-red-50"
                    >
                      <LogOut size={14} className="shrink-0" aria-hidden />
                      로그아웃
                    </button>
                  </div>
                </div>
              )}
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

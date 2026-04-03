'use client';

import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { GHGFilterSidebar } from './components/GHGFilterSidebar';
import { GHGDataManagementCenter } from './components/GHGDataManagementCenter';
import { Step3Methodology } from './components/Step3Methodology';
import { Step4Results } from './components/Step4Results';
import { Step5Report } from './components/Step5Report';
import { IFRSAuditView } from './components/IFRSAuditView';
import { EMSDataLoader } from './components/EMSDataLoader';
import { DataCollectionSummary } from './components/DataCollectionSummary';
import { ExcelUploader } from './components/ExcelUploader';
import type { EmissionData, EMSData, ExcelUploadData, FilterState } from './types/ghg.types';
import { useGHGStore, type GHGActiveScope } from './store/ghg.store';
import { getRequiredItemsForFramework, FRAMEWORK_GUIDANCE, FRAMEWORK_IDS, FRAMEWORK_LABELS } from './constants/disclosure';
import { EVIDENCE_INPUT_ITEMS, EVIDENCE_TO_SCOPE, type EvidenceInputTabId } from './constants/evidenceInputMapping';
import { EMPTY_HISTORY_MESSAGE } from './constants/emptyState';
import { toast } from 'sonner';

/**
 * GHG 산정 메인 진입점
 * Page22 디자인 스타일 유지 + ghgcalculation.md 기능 추가
 */
export function GHGCalculationMain() {
  /** GHG_UI_SCOPE.md: 상단 탭 3개 — GHG 산정·공시 | IFRS 감사대응 | 리포트 생성 */
  const [activeTab, setActiveTab] = useState<'result' | 'ifrs' | 'report'>('result');
  const factorYear = useGHGStore((s) => s.factorYear);
  const setFactorYear = useGHGStore((s) => s.setFactorYear);
  
  const activeScope = useGHGStore((s) => s.activeScope);
  const setActiveScope = useGHGStore((s) => s.setActiveScope);
  const facilities = useGHGStore((s) => s.facilities);
  const setFacilities = useGHGStore((s) => s.setFacilities);
  const scope1EnergySources = useGHGStore((s) => s.scope1EnergySources);
  const scope2EnergySources = useGHGStore((s) => s.scope2EnergySources);
  const filtersByScope = useGHGStore((s) => s.filtersByScope);
  const setFilters = useGHGStore((s) => s.setFilters);
  const applyFilters = useGHGStore((s) => s.applyFilters);
  const clearAppliedFilters = useGHGStore((s) => s.clearAppliedFilters);

  const boundaryPolicy = useGHGStore((s) => s.boundaryPolicy);
  const scope1 = useGHGStore((s) => s.scope1);
  const setScope1 = useGHGStore((s) => s.setScope1);
  const scope2 = useGHGStore((s) => s.scope2);
  const setScope2 = useGHGStore((s) => s.setScope2);
  const scope3 = useGHGStore((s) => s.scope3);

  const saveSnapshot = useGHGStore((s) => s.saveSnapshot);
  const history = useGHGStore((s) => s.history);

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isEMSOpen, setIsEMSOpen] = useState(false);
  const [isExcelOpen, setIsExcelOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  /** ERP_DATA_DISCLOSURE_STRATEGY: 공시 프레임워크 5개 (ISSB, KSSB, K-ETS, GRI, ESRS) */
  const [disclosureFramework, setDisclosureFramework] = useState<string>('ISSB');
  /** GHG_TAB_DESIGN_v2: 6탭 구조 */
  const [selectedEvidenceTab, setSelectedEvidenceTab] = useState<EvidenceInputTabId>('power');

  /** Evidence 탭 변경 시 activeScope 동기화 */
  useEffect(() => {
    const scope = EVIDENCE_TO_SCOPE[selectedEvidenceTab];
    if (scope !== activeScope) setActiveScope(scope);
  }, [selectedEvidenceTab]);

  /** K-ETS: Scope 3 탭(waste, logistics, materials) 숨김 → 해당 탭 선택 시 power로 전환 */
  useEffect(() => {
    if (
      disclosureFramework === 'K-ETS' &&
      (selectedEvidenceTab === 'waste' || selectedEvidenceTab === 'logistics' || selectedEvidenceTab === 'materials')
    ) {
      setSelectedEvidenceTab('power');
      setActiveScope('scope2');
    }
  }, [disclosureFramework]);

  const activeFilters = filtersByScope[activeScope];
  const activeEnergySources = activeScope === 'scope1' ? scope1EnergySources : activeScope === 'scope2' ? scope2EnergySources : [];

  const results = useMemo(() => {
    const s1 =
      scope1.stationary.reduce((sum, r) => sum + (r.emissions || 0), 0) + scope1.mobile.reduce((sum, r) => sum + (r.emissions || 0), 0);
    const s2 = scope2.electricity.reduce((sum, r) => sum + (r.emissions || 0), 0);
    const s3 = scope3.categories.reduce((sum, cat) => sum + cat.data.reduce((s, r) => s + (r.emissions || 0), 0), 0);
    const total = s1 + s2 + s3;
    return { s1, s2, s3, total };
  }, [scope1, scope2, scope3]);

  /** GHG_TAB_DESIGN_v2: 6탭 기준 완료율 */
  const disclosureCompletionRate = useMemo(() => {
    const required: EvidenceInputTabId[] =
      disclosureFramework === 'K-ETS'
        ? ['power', 'fuel', 'refrigerant']
        : ['power', 'fuel', 'refrigerant', 'waste', 'logistics', 'materials'];
    const hasData = (tabId: EvidenceInputTabId) => {
      if (tabId === 'power') return scope2.electricity.length > 0 || scope2.heat.length > 0;
      if (tabId === 'fuel') return scope1.stationary.length > 0 || scope1.mobile.length > 0;
      if (tabId === 'refrigerant') return false; // 냉매 전용 저장소 없음 — 추후 확장
      if (tabId === 'waste') return scope3.categories.some((c) => c.category.includes('12.') && c.data.length > 0);
      if (tabId === 'logistics' || tabId === 'materials') return scope3.categories.some((c) => c.data.length > 0);
      return false;
    };
    const filled = required.filter(hasData).length;
    return Math.round((filled / required.length) * 100);
  }, [disclosureFramework, scope1.stationary.length, scope1.mobile.length, scope2.electricity.length, scope2.heat.length, scope3.categories]);

  const toScope1 = (rows: EmissionData[]) => {
    const stationaryKeywords = ['lng', 'lpg', 'bunker', '무연탄', '도시가스', '벙커', '고정'];
    const isStationary = (src: string) => stationaryKeywords.some((k) => src.toLowerCase().includes(k.toLowerCase()));
    const stationary = rows.filter((r) => isStationary(r.energySource));
    const mobile = rows.filter((r) => !isStationary(r.energySource));
    setScope1({
      stationary: [...scope1.stationary, ...stationary],
      mobile: [...scope1.mobile, ...mobile],
    });
    toast.success(`${rows.length}개 데이터가 Scope 1에 추가되었습니다.`);
  };

  const toScope2Electricity = (rows: EmissionData[]) => {
    setScope2({
      ...scope2,
      electricity: [...scope2.electricity, ...rows.map((r) => ({ ...r, energySource: '전력' }))],
    });
    toast.success(`${rows.length}개 데이터가 Scope 2(전력)에 추가되었습니다.`);
  };

  const handleEMSLoad = (data: EMSData[]) => {
    const year = activeFilters.year || activeFilters.yearRange?.start || new Date().getFullYear();
    const rows: EmissionData[] = data.map((d, idx) => ({
      id: `ems-${Date.now()}-${idx}`,
      year: d.year || year,
      month: d.month,
      facility: d.facility,
      energySource: d.energySource,
      amount: d.amount,
      unit: d.unit,
      emissions: 0,
      dataType: 'ems' as const,
      createdAt: new Date(),
    }));

    if (activeScope === 'scope1') toScope1(rows);
    else if (activeScope === 'scope2') toScope2Electricity(rows);
    else toast.info('Scope 3은 EMS/엑셀 자동 입력을 지원하지 않습니다.');
  };

  const handleExcelUpload = (uploadData: ExcelUploadData) => {
    if (!uploadData.validation.isValid) {
      toast.error('엑셀 파일 검증에 실패했습니다.');
      return;
    }
    const year = activeFilters.year || activeFilters.yearRange?.start || new Date().getFullYear();
    const rows: EmissionData[] = uploadData.rows.map((row, idx) => ({
      id: `excel-${Date.now()}-${idx}`,
      year,
      month: parseInt(row['월'] || row['month'] || '1'),
      facility: row['사업장'] || row['facility'] || facilities[0] || '',
      energySource: row['에너지원'] || row['energySource'] || (activeScope === 'scope2' ? '전력' : ''),
      amount: parseFloat(row['사용량'] || row['amount'] || '0'),
      unit: row['단위'] || row['unit'] || (activeScope === 'scope2' ? 'kWh' : ''),
      emissions: 0,
      dataType: 'excel' as const,
      createdAt: new Date(),
    }));

    if (activeScope === 'scope1') toScope1(rows);
    else if (activeScope === 'scope2') toScope2Electricity(rows);
    else toast.info('Scope 3은 EMS/엑셀 자동 입력을 지원하지 않습니다.');
  };

  const exportCSV = () => {
    const header = ['scope', 'year', 'month', 'facility', 'energySource', 'amount', 'unit', 'emissions_tCO2e'];
    const lines: string[] = [header.join(',')];

    const pushEmission = (scope: string, r: EmissionData) => {
      const cols = [
        scope,
        String(r.year ?? ''),
        String(r.month ?? ''),
        `"${(r.facility ?? '').replaceAll('"', '""')}"`,
        `"${(r.energySource ?? '').replaceAll('"', '""')}"`,
        String(r.amount ?? ''),
        `"${(r.unit ?? '').replaceAll('"', '""')}"`,
        String(r.emissions ?? ''),
      ];
      lines.push(cols.join(','));
    };

    scope1.stationary.forEach((r) => pushEmission('scope1_stationary', r));
    scope1.mobile.forEach((r) => pushEmission('scope1_mobile', r));
    scope2.electricity.forEach((r) => pushEmission('scope2_electricity', r));
    scope3.categories.forEach((cat) => cat.data.forEach((r) => pushEmission(`scope3_${cat.category}`, r)));

    const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ghg_export_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success('CSV 내보내기가 완료되었습니다.');
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans text-[16px] md:text-[18px] leading-relaxed">
      {/* 헤더 — GHG_UI_SCOPE Part 2 시각 계층 */}
      <div className="w-full bg-primary">
        <div className="max-w-none w-full mx-auto px-5 sm:px-6 lg:px-8 2xl:px-10 py-8">
          <h1 className="text-3xl md:text-4xl font-bold text-primary-foreground">온실가스 배출량 산정 (GHG Protocol)</h1>
        </div>
      </div>

      <div className="max-w-none w-full mx-auto px-5 sm:px-6 lg:px-8 2xl:px-10 py-8">
        <div className="bg-card border border-border rounded-lg px-6 sm:px-8 lg:px-10 py-8 shadow-sm">
          {/* 헤더 - 탭과 연도 선택 */}
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
            {/* GHG_UI_SCOPE.md: GHG 산정·공시 | IFRS 감사대응 | 리포트 생성 (순서 고정) */}
            <nav className="flex items-center overflow-hidden rounded-lg border border-border bg-card" aria-label="GHG 산정 탭">
              <button
                type="button"
                onClick={() => setActiveTab('result')}
                aria-current={activeTab === 'result' ? 'page' : undefined}
                className={`px-6 py-2.5 text-base font-semibold transition-all rounded-l-md border-r border-border focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                  activeTab === 'result'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                }`}
              >
                GHG 산정·공시
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('ifrs')}
                aria-current={activeTab === 'ifrs' ? 'page' : undefined}
                className={`px-6 py-2.5 text-base font-semibold transition-all border-r border-border focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                  activeTab === 'ifrs'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                }`}
              >
                감사·검증 대응
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('report')}
                aria-current={activeTab === 'report' ? 'page' : undefined}
                className={`px-6 py-2.5 text-base font-semibold transition-all rounded-r-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                  activeTab === 'report'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                }`}
              >
                리포트 생성
              </button>
            </nav>

            {/* 오른쪽 툴바 */}
            <div className="flex items-center gap-3 ml-auto">
              <div className="flex items-center gap-2 border border-slate-200 bg-white p-1">
                {/* 히스토리 */}
                <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" className="h-9 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                      히스토리 ({history.length})
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="text-lg font-bold text-slate-900">저장된 히스토리</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 mt-4">
                      {history.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8 text-sm">
                          {EMPTY_HISTORY_MESSAGE}
                        </p>
                      ) : (
                        history.map((item) => {
                          const total =
                            item.scope1.stationary.reduce((s, r) => s + (r.emissions || 0), 0) +
                            item.scope1.mobile.reduce((s, r) => s + (r.emissions || 0), 0) +
                            item.scope2.electricity.reduce((s, r) => s + (r.emissions || 0), 0) +
                            item.scope3.categories.reduce((s, c) => s + c.data.reduce((ss, r) => ss + (r.emissions || 0), 0), 0);
                          const s1 =
                            item.scope1.stationary.reduce((s, r) => s + (r.emissions || 0), 0) +
                            item.scope1.mobile.reduce((s, r) => s + (r.emissions || 0), 0);
                          const s2 = item.scope2.electricity.reduce((s, r) => s + (r.emissions || 0), 0);
                          const s3 = item.scope3.categories.reduce((s, c) => s + c.data.reduce((ss, r) => ss + (r.emissions || 0), 0), 0);
                          return (
                            <div key={item.id} className="border border-slate-200 p-4 bg-white">
                              <div className="flex justify-between items-start mb-3">
                                <div>
                                  <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                                  <p className="text-xs text-slate-600">{new Date(item.savedAt).toLocaleString('ko-KR')}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-base font-bold text-slate-900">{total.toFixed(2)} tCO₂e</p>
                                  <p className="text-xs text-slate-600">총 배출량</p>
                                </div>
                              </div>
                              <div className="grid grid-cols-3 gap-2 text-xs">
                                <div className="bg-slate-50 p-2 border border-slate-200">
                                  <p className="text-xs text-slate-600">Scope 1</p>
                                  <p className="font-semibold text-slate-900">{s1.toFixed(2)}</p>
                                </div>
                                <div className="bg-slate-50 p-2 border border-slate-200">
                                  <p className="text-xs text-slate-600">Scope 2 (L)</p>
                                  <p className="font-semibold text-slate-900">{s2.toFixed(2)}</p>
                                </div>
                                <div className="bg-slate-50 p-2 border border-slate-200">
                                  <p className="text-xs text-slate-600">Scope 3</p>
                                  <p className="font-semibold text-slate-900">{s3.toFixed(2)}</p>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </DialogContent>
                </Dialog>

                {/* 필터 — lg 이상은 좌측 사이드바, 미만은 다이얼로그 (FILTER_MERGE: 동일 GHGFilterSidebar) */}
                <Dialog open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" className="h-9 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 lg:hidden">
                      필터
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md p-0 overflow-hidden">
                    <div className="max-h-[85vh] overflow-y-auto">
                      <GHGFilterSidebar
                        variant="embedded"
                        initialFilters={activeFilters}
                        onFilterChange={(f: FilterState) => setFilters(activeScope, f)}
                        onApplyFilters={() => {
                          applyFilters(activeScope);
                          setIsFilterOpen(false);
                        }}
                        onReset={() => clearAppliedFilters(activeScope)}
                        facilities={facilities}
                        energySources={activeEnergySources}
                        scope={activeScope}
                      />
                    </div>
                  </DialogContent>
                </Dialog>

                {/* EMS */}
                <Dialog open={isEMSOpen} onOpenChange={setIsEMSOpen}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" className="h-9 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                      EMS 불러오기
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-3xl">
                    <DialogHeader>
                      <DialogTitle>EMS 데이터 가져오기</DialogTitle>
                      <DialogDescription>필터 조건을 기반으로 EMS 데이터를 자동 입력합니다.</DialogDescription>
                    </DialogHeader>
                    <EMSDataLoader filters={activeFilters} onDataLoad={handleEMSLoad} scope={activeScope} />
                  </DialogContent>
                </Dialog>

                {/* 엑셀 업로드 */}
                <Dialog open={isExcelOpen} onOpenChange={setIsExcelOpen}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" className="h-9 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                      엑셀 업로드
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-3xl">
                    <DialogHeader>
                      <DialogTitle>엑셀 업로드</DialogTitle>
                      <DialogDescription>엑셀 파일로 데이터를 일괄 입력합니다.</DialogDescription>
                    </DialogHeader>
                    <ExcelUploader
                      requiredColumns={['월', '사업장', '에너지원', '사용량', '단위']}
                      onUploadComplete={handleExcelUpload}
                      scope={activeScope}
                    />
                  </DialogContent>
                </Dialog>

                {/* 전체 결과 저장 */}
                <Button
                  onClick={() => saveSnapshot()}
                  variant="ghost"
                  className="h-9 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  전체 결과 저장
                </Button>

                {/* CSV 내보내기 */}
                <Button onClick={exportCSV} className="h-9 px-3 text-sm font-semibold bg-primary hover:bg-primary/90 text-primary-foreground transition-colors">
                  CSV 내보내기
                </Button>
              </div>

              {/* 연도 선택 */}
              <div className="flex flex-col items-end">
                <span className="text-xs font-semibold text-slate-700 mb-1">계수 기준 연도</span>
                <select
                  value={factorYear}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                    setFactorYear(e.target.value as '2024' | '2023');
                    toast.success('계수 기준 연도가 변경되었습니다.');
                  }}
                  className="text-sm font-semibold border border-slate-200 bg-white px-3 py-2 outline-none focus:ring-2 focus:ring-slate-400 transition-all text-slate-900"
                >
                  <option value="2024">2024 KR Emission Factors</option>
                  <option value="2023">2023 KR Emission Factors</option>
                </select>
              </div>
            </div>
          </div>

          {/* 메인 컨텐츠 — GHG_UI_SCOPE.md: GHG 산정·공시 | IFRS 감사대응 | 리포트 생성 */}
          <main className="mt-8 space-y-6">
            {activeTab === 'result' && (
              <div className="flex gap-6">
                {/* GHG_PLANNING: 좌측 사이드바 — 공시·보고 항목(상) + 필터(하) 통합 */}
                <aside
                  className="w-64 shrink-0 rounded-lg border border-slate-700 bg-slate-800 overflow-hidden hidden lg:block"
                  aria-label="공시 항목 및 필터"
                >
                  {/* GHG_TAB_DESIGN_v2: 6탭 산정 입력 */}
                  <div className="text-slate-400 uppercase tracking-widest text-xs font-semibold px-4 py-3 border-b border-slate-700">
                    산정 입력
                  </div>
                  <nav className="p-2 overflow-y-auto max-h-[45vh]" aria-label="산정 입력 탭">
                    <ul className="space-y-0.5">
                      {EVIDENCE_INPUT_ITEMS.filter((item) => {
                        if (disclosureFramework === 'K-ETS' && (item.id === 'waste' || item.id === 'logistics' || item.id === 'materials'))
                          return false;
                        return true;
                      }).map((item) => {
                        const isActive = selectedEvidenceTab === item.id;
                        const required =
                          disclosureFramework === 'K-ETS'
                            ? ['power', 'fuel', 'refrigerant'].includes(item.id)
                            : true;
                        return (
                          <li key={item.id}>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedEvidenceTab(item.id);
                                setActiveScope(item.scope);
                              }}
                              className={`w-full text-left text-sm px-3 py-2 rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
                                isActive
                                  ? 'bg-slate-600 text-white font-medium'
                                  : 'text-slate-200 hover:bg-slate-700 hover:text-white'
                              }`}
                            >
                              <span className="flex items-center justify-between gap-2">
                                <span>{item.label}</span>
                                {!required && <span className="text-[10px] text-slate-400">선택</span>}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </nav>
                  {/* FILTER_MERGE_STRATEGY: 통합 필터 — GHGFilterSidebar 디자인(오른쪽 필터 스타일) */}
                  <div className="overflow-y-auto flex-1 min-h-0">
                    <GHGFilterSidebar
                      variant="embedded"
                      initialFilters={activeFilters}
                      onFilterChange={(f: FilterState) => setFilters(activeScope, f)}
                      onApplyFilters={() => applyFilters(activeScope)}
                      onReset={() => clearAppliedFilters(activeScope)}
                      facilities={facilities}
                      energySources={activeEnergySources}
                      scope={activeScope}
                    />
                  </div>
                </aside>
                <div className="min-w-0 flex-1">
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                <div className="xl:col-span-10 space-y-6">
                  {/* GHG_PLANNING §3-1: 메인 상단 — 공시 프레임워크 + 입력 완료율 (컴팩트) */}
                  <div className="flex flex-wrap items-center justify-between gap-4 py-3 px-4 rounded-lg border border-border bg-card">
                    <div className="flex items-center gap-4">
                      <label htmlFor="disclosure-framework" className="text-sm font-medium text-foreground whitespace-nowrap">
                        공시 프레임워크
                      </label>
                      <select
                        id="disclosure-framework"
                        value={disclosureFramework}
                        onChange={(e: ChangeEvent<HTMLSelectElement>) => setDisclosureFramework(e.target.value)}
                        className="text-sm border border-border rounded-md bg-background px-3 py-1.5 text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
                      >
                        {FRAMEWORK_IDS.map((id) => (
                          <option key={id} value={id}>
                            {FRAMEWORK_LABELS[id] ?? id}
                          </option>
                        ))}
                      </select>
                      <span className="text-sm text-muted-foreground">선택 기준 대비 입력 완료율</span>
                      <span className="font-bold tabular-nums text-foreground">{disclosureCompletionRate}%</span>
                      <DataCollectionSummary />
                    </div>
                    {/* GHG_TAB_DESIGN_v2: 6탭 항목별 현황 요약 (클릭 시 해당 탭으로 전환) */}
                    <div className="flex flex-wrap gap-1.5">
                      {EVIDENCE_INPUT_ITEMS.filter(
                        (item) => !(disclosureFramework === 'K-ETS' && (item.id === 'waste' || item.id === 'logistics' || item.id === 'materials'))
                      ).map((item) => {
                        const hasValue =
                          item.id === 'power'
                            ? scope2.electricity.length > 0 || scope2.heat.length > 0
                            : item.id === 'fuel'
                              ? scope1.stationary.length > 0 || scope1.mobile.length > 0
                              : item.id === 'refrigerant'
                                ? false
                                : item.id === 'waste'
                                  ? scope3.categories.some((c) => c.category.includes('12.') && c.data.length > 0)
                                  : scope3.categories.some((c) => c.data.length > 0);
                        return (
                          <Button
                            key={item.id}
                            variant={selectedEvidenceTab === item.id ? 'default' : 'ghost'}
                            size="sm"
                            className="h-7 text-xs shrink-0"
                            onClick={() => {
                              setSelectedEvidenceTab(item.id);
                              setActiveScope(item.scope);
                            }}
                          >
                            {hasValue ? '✓ ' : ''}{item.label}
                          </Button>
                        );
                      })}
                    </div>
                  </div>

                  {/* ERP_DATA_DISCLOSURE_STRATEGY §7.4: 기준별 화면 강조 */}
                  {disclosureFramework === 'K-ETS' && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                      <span className="font-semibold">K-ETS:</span> 월별 에너지 사용량 보고 의무. Scope 1 중심. 기존 입력 그리드 + ERP/엑셀 자동 채움 활용.
                    </div>
                  )}
                  {disclosureFramework === 'ESRS' && (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                      <span className="font-semibold">ESRS E1:</span> Scope 2 location/market 기반 필수. 전환 계획·시나리오 분석 자료 입력 필드 (Phase 2 연동 예정).
                    </div>
                  )}

                  {/* GHG_UX_REDESIGN_SPEC_1: RawDataPreviewSection은 STEP 1 내부로 이동 */}

                  {/* 선택한 탭 — 활동자료 입력 (스텝 플로우: power/fuel) */}
                  <Card className="border-border bg-card">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg font-semibold text-foreground">
                        2. {EVIDENCE_INPUT_ITEMS.find((i) => i.id === selectedEvidenceTab)?.label ?? '산정 입력'} — 활동자료 입력 및 결과
                      </CardTitle>
                      <CardDescription className="text-sm text-muted-foreground">
                        {EVIDENCE_INPUT_ITEMS.find((i) => i.id === selectedEvidenceTab)?.description ?? ''} → 산정에 반영됩니다.
                        {FRAMEWORK_GUIDANCE[disclosureFramework] && (
                          <span className="block mt-1.5 text-xs text-muted-foreground/90">
                            {FRAMEWORK_GUIDANCE[disclosureFramework]}
                          </span>
                        )}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-2">
                      <GHGDataManagementCenter
                        disclosureFramework={disclosureFramework}
                        activeEvidenceTab={selectedEvidenceTab}
                        onOpenEMS={() => setIsEMSOpen(true)}
                        onOpenExcel={() => setIsExcelOpen(true)}
                      />
                    </CardContent>
                  </Card>

                  {/* GHG_UX_REDESIGN_SPEC_1: 배출량 산정 결과는 스텝 플로우 STEP 3에 통합. power/fuel 외 탭용 폴백 */}
                  {(selectedEvidenceTab === 'refrigerant' ||
                    selectedEvidenceTab === 'waste' ||
                    selectedEvidenceTab === 'logistics' ||
                    selectedEvidenceTab === 'materials') && (
                    <Card className="border-border overflow-hidden">
                      <CardHeader className="bg-muted/50 border-b border-border px-6 py-5">
                        <CardTitle className="text-xl font-bold text-foreground">배출량 산정 결과</CardTitle>
                        <CardDescription className="text-muted-foreground mt-1">
                          최종 계산된 온실가스 배출량 및 데이터 신뢰도를 확인합니다.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="p-6 md:p-8">
                        <Step4Results />
                        <div className="mt-6 pt-6 border-t border-border">
                          <Step3Methodology />
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* Total Summary — GHG_UI_SCOPE Part 2 카드·패널 통일 */}
                <div className="space-y-6 xl:col-span-2 xl:col-start-11 xl:row-start-1 xl:row-end-4 sticky top-24 self-start">
                  <Card className="bg-primary text-primary-foreground border-primary overflow-hidden shadow-lg">
                    <CardContent className="relative p-6 md:p-8">
                      <div className="absolute -right-4 -top-4 w-32 h-32 bg-primary-foreground/10 rounded-full blur-3xl" aria-hidden />
                      <div className="relative z-10">
                        <h3 className="text-xs font-bold text-primary-foreground/80 uppercase tracking-widest mb-2">
                          Total Carbon Inventory
                        </h3>
                      <div className="text-5xl font-black mb-10 tabular-nums">{results.total.toFixed(2)}</div>

                      <div className="space-y-8">
                        <div>
                          <div className="flex justify-between text-sm font-bold mb-2">
                            <span className="text-primary-foreground/70">Scope 1 Contribution</span>
                            <span className="text-orange-400">
                              {((results.s1 / (results.total || 1)) * 100).toFixed(1)}%
                            </span>
                          </div>
                          <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-orange-500"
                              style={{ width: `${(results.s1 / (results.total || 1)) * 100}%` }}
                            ></div>
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-sm font-bold mb-2">
                            <span className="text-primary-foreground/70">Scope 2 Contribution</span>
                            <span className="text-yellow-400">
                              {((results.s2 / (results.total || 1)) * 100).toFixed(1)}%
                            </span>
                          </div>
                          <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-yellow-500"
                              style={{ width: `${(results.s2 / (results.total || 1)) * 100}%` }}
                            ></div>
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-sm font-bold mb-2">
                            <span className="text-primary-foreground/70">Scope 3 Contribution</span>
                            <span className="text-purple-400">
                              {((results.s3 / (results.total || 1)) * 100).toFixed(1)}%
                            </span>
                          </div>
                          <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-purple-500"
                              style={{ width: `${(results.s3 / (results.total || 1)) * 100}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* 저장된 히스토리 — 카드 스타일 통일 */}
                  <Card className="border-border">
                    <CardHeader>
                      <CardTitle className="text-lg font-bold text-foreground">저장된 히스토리</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                    <div className="space-y-3 max-h-[900px] overflow-y-auto pr-1">
                      {history.length === 0 ? (
                        <div className="text-sm text-center text-muted-foreground py-10">
                          {EMPTY_HISTORY_MESSAGE}
                        </div>
                      ) : (
                        history.slice(0, 20).map((h) => {
                          const date = new Date(h.savedAt);
                          const year = date.getFullYear();
                          const month = String(date.getMonth() + 1).padStart(2, '0');
                          const day = String(date.getDate()).padStart(2, '0');
                          const hours = date.getHours();
                          const minutes = String(date.getMinutes()).padStart(2, '0');
                          const ampm = hours >= 12 ? '오후' : '오전';
                          const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
                          const timeString = `${ampm} ${String(displayHours).padStart(2, '0')}:${minutes}`;
                          const dateString = `${year}. ${month}. ${day}. ${timeString}`;
                          const total =
                            h.scope1.stationary.reduce((s, r) => s + (r.emissions || 0), 0) +
                            h.scope1.mobile.reduce((s, r) => s + (r.emissions || 0), 0) +
                            h.scope2.electricity.reduce((s, r) => s + (r.emissions || 0), 0) +
                            h.scope3.categories.reduce((s, c) => s + c.data.reduce((ss, r) => ss + (r.emissions || 0), 0), 0);
                          return (
                            <div key={h.id} className="border border-slate-200 bg-white p-5">
                              <div className="flex justify-between items-start mb-3">
                                <div className="text-sm font-semibold text-slate-900">{dateString}</div>
                                <div className="text-xs font-bold px-3 py-1.5 bg-orange-100 text-orange-700">Scope 전체</div>
                              </div>
                              <div className="text-2xl font-bold text-slate-900 tabular-nums mb-2">
                                {total.toFixed(2)} <span className="text-base font-normal text-slate-700">tCO₂e</span>
                              </div>
                              <div className="text-sm text-slate-600">{new Date(h.savedAt).getFullYear()}년</div>
                            </div>
                          );
                        })
                      )}
                    </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
                </div>
              </div>
            )}
            {activeTab === 'ifrs' && (
              <Card className="border-border overflow-hidden">
                <CardHeader className="bg-muted/50 border-b border-border px-6 py-5">
                  <CardTitle className="text-xl font-bold text-foreground">감사·검증 대응 (Audit & Verification)</CardTitle>
                  <CardDescription className="text-muted-foreground mt-1">
                    외부 감사·제3자 검증·내부 검토에 대응하는 데이터 확정, 감사 추적, 증빙 무결성을 확인합니다.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <IFRSAuditView
                    onGoToReport={() => setActiveTab('report')}
                    onGoToInput={(tabId) => {
                      setActiveTab('result');
                      setSelectedEvidenceTab(tabId as EvidenceInputTabId);
                    }}
                  />
                </CardContent>
              </Card>
            )}
            {activeTab === 'report' && (
              <Card className="border-border overflow-hidden">
                <CardContent className="p-6 md:p-8">
                  <Step5Report disclosureFramework={disclosureFramework} />
                </CardContent>
              </Card>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

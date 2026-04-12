'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  RefreshCw,
  Download,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Info,
  CheckCircle2,
  AlertCircle,
  Layers,
  Zap,
  Truck,
  BarChart2,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useGhgSession } from '../../lib/ghgSession';
import {
  GHG_SCOPE_MONTH_KEYS,
  GHG_SCOPE_MONTH_LABELS,
  buildEmptyScopeCalculationDataset,
  mergeScopeCalculationWithApi12,
  type ScopeCalcCategory,
  type ScopeCalcLineItem,
  type ScopeRecalculateApiResponse,
} from '../../lib/ghgScopeCalculationData';
import { fetchWithAuthJson, useAuthSessionStore } from '@/store/authSessionStore';

type ScopeTab = 'scope1' | 'scope2' | 'scope3';

function TrendBadge({ value }: { value: number | null | undefined }) {
  if (value == null) {
    return <span className="text-xs text-gray-400">—</span>;
  }
  const isUp = value > 0;
  const isZero = value === 0;
  return (
    <span
      className={`flex items-center gap-0.5 text-xs ${isZero ? 'text-gray-400' : isUp ? 'text-red-500' : 'text-emerald-600'}`}
    >
      {!isZero && (isUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />)}
      {isZero ? '0.0%' : `${isUp ? '+' : ''}${value.toFixed(1)}%`}
    </span>
  );
}

function StatusDot({ status }: { status: string }) {
  const c: Record<string, string> = {
    confirmed: 'bg-emerald-400',
    draft: 'bg-yellow-400',
    warning: 'bg-orange-400',
    error: 'bg-red-500',
  };
  return <span className={`inline-block w-2 h-2 rounded-full ${c[status] ?? 'bg-gray-300'}`} />;
}

function monthVal(item: ScopeCalcLineItem, key: (typeof GHG_SCOPE_MONTH_KEYS)[number]) {
  return item[key];
}

function CategoryTable({ categories }: { categories: ScopeCalcCategory[] }) {
  const [expanded, setExpanded] = useState<string[]>(categories.map((c) => c.id));

  return (
    <div className="space-y-2">
      {categories.map((cat) => {
        const catTotal = cat.items.reduce((s, i) => s + i.total, 0);
        const isOpen = expanded.includes(cat.id);
        return (
          <div key={cat.id} className="border border-gray-200 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() =>
                setExpanded((p) => (p.includes(cat.id) ? p.filter((x) => x !== cat.id) : [...p, cat.id]))
              }
              className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-2">
                {isOpen ? (
                  <ChevronDown size={13} className="text-gray-500" />
                ) : (
                  <ChevronRight size={13} className="text-gray-500" />
                )}
                <span className="text-xs text-gray-800" style={{ fontWeight: 600 }}>
                  {cat.category}
                </span>
                <span className="text-xs text-gray-400">({cat.items.length}개 항목)</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">소계</span>
                <span className="text-sm text-gray-800" style={{ fontWeight: 700 }}>
                  {catTotal.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                </span>
                <span className="text-xs text-gray-400">tCO₂eq</span>
              </div>
            </button>

            {isOpen && (
              <div className="overflow-x-auto border-t border-gray-100">
                <table className="w-full text-xs min-w-[920px]">
                  <thead>
                    <tr className="bg-[#fafbfc] border-b border-gray-100">
                      <th className="sticky left-0 z-10 bg-[#fafbfc] px-4 py-2 text-left text-gray-500 w-6 border-r border-gray-100" />
                      <th className="sticky left-6 z-10 bg-[#fafbfc] px-3 py-2 text-left text-gray-500 min-w-[140px] border-r border-gray-100">
                        항목명
                      </th>
                      <th className="sticky left-[146px] z-10 bg-[#fafbfc] px-3 py-2 text-left text-gray-500 min-w-[72px] border-r border-gray-200">
                        시설
                      </th>
                      {GHG_SCOPE_MONTH_LABELS.map((m) => (
                        <th key={m} className="px-2 py-2 text-right text-gray-500 whitespace-nowrap min-w-[52px]">
                          {m}
                        </th>
                      ))}
                      <th className="px-3 py-2 text-right text-gray-500 border-l border-gray-200 whitespace-nowrap min-w-[88px]">
                        합계
                      </th>
                      <th className="px-2 py-2 text-center text-gray-500">배출계수</th>
                      <th className="px-2 py-2 text-center text-gray-500">출처</th>
                      <th className="px-2 py-2 text-right text-gray-500">전년대비</th>
                      <th className="px-2 py-2 text-center text-gray-500">상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cat.items.map((item) => (
                      <tr
                        key={item.name}
                        className="border-b border-gray-100 last:border-0 hover:bg-blue-50/30 transition-colors"
                      >
                        <td className="sticky left-0 z-[1] bg-white px-4 py-2.5 text-center border-r border-gray-100">
                          <StatusDot status={item.status} />
                        </td>
                        <td
                          className="sticky left-6 z-[1] bg-white px-3 py-2.5 text-gray-700 border-r border-gray-100"
                          style={{ fontWeight: 500 }}
                        >
                          {item.name}
                        </td>
                        <td className="sticky left-[146px] z-[1] bg-white px-3 py-2.5 text-gray-500 border-r border-gray-200">
                          {item.facility}
                        </td>
                        {GHG_SCOPE_MONTH_KEYS.map((k) => (
                          <td key={k} className="px-2 py-2.5 text-right text-gray-600 tabular-nums">
                            {monthVal(item, k).toLocaleString(undefined, { maximumFractionDigits: 1 })}
                          </td>
                        ))}
                        <td
                          className="px-3 py-2.5 text-right text-gray-900 border-l border-gray-200 tabular-nums"
                          style={{ fontWeight: 700 }}
                        >
                          {item.total.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                        </td>
                        <td className="px-2 py-2.5 text-center text-gray-500 font-mono">{item.ef}</td>
                        <td className="px-2 py-2.5 text-center">
                          <span className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded text-xs border border-blue-200">
                            {item.efSource}
                          </span>
                        </td>
                        <td className="px-2 py-2.5 text-right">
                          <TrendBadge value={item.yoy} />
                        </td>
                        <td className="px-2 py-2.5 text-center">
                          {item.status === 'confirmed' ? (
                            <CheckCircle2 size={13} className="inline text-emerald-500" />
                          ) : item.status === 'warning' ? (
                            <AlertCircle size={13} className="inline text-orange-400" />
                          ) : (
                            <span className="text-yellow-500 text-xs">임시</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

interface ScopeCalculationProps {
  onApiResponseUpdate?: (data: ScopeRecalculateApiResponse | null) => void;
}

export function ScopeCalculation({ onApiResponseUpdate }: ScopeCalculationProps) {
  const { session } = useGhgSession();
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:9001';
  const companyId = useAuthSessionStore((s) => s.user?.company_id?.trim() ?? '');
  const [activeScope, setActiveScope] = useState<ScopeTab>('scope1');
  const [selectedYear, setSelectedYear] = useState('2026');
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [recalcDone, setRecalcDone] = useState(false);
  const [liveApi, setLiveApi] = useState<ScopeRecalculateApiResponse | null>(null);
  const [scopeCalcError, setScopeCalcError] = useState<string | null>(null);

  const emptyBaseDataset = useMemo(() => {
    const label =
      session.tenantType === 'holding'
        ? '그룹 합산 (자회사·국내 사업장)'
        : (session.corpDisplayName ?? '').trim() || '본 법인';
    return buildEmptyScopeCalculationDataset(label);
  }, [session.tenantType, session.corpDisplayName]);

  const dataset = useMemo(() => {
    if (!liveApi || liveApi.year !== selectedYear) return emptyBaseDataset;
    return mergeScopeCalculationWithApi12(emptyBaseDataset, liveApi);
  }, [emptyBaseDataset, liveApi, selectedYear]);

  useEffect(() => {
    if (!companyId) {
      setLiveApi(null);
      onApiResponseUpdate?.(null);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetchWithAuthJson(
          `${apiBase.replace(/\/$/, '')}/ghg-calculation/scope/results?company_id=${encodeURIComponent(companyId)}&year=${encodeURIComponent(selectedYear)}&basis=location`,
        );
        if (cancelled) return;
        if (res.ok) {
          const body = (await res.json()) as ScopeRecalculateApiResponse;
          setLiveApi(body);
          onApiResponseUpdate?.(body);
        } else {
          setLiveApi(null);
          onApiResponseUpdate?.(null);
        }
      } catch {
        if (!cancelled) {
          setLiveApi(null);
          onApiResponseUpdate?.(null);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiBase, companyId, selectedYear, onApiResponseUpdate]);

  const handleRecalculate = async () => {
    if (!companyId) {
      setScopeCalcError('로그인된 회사 ID가 없습니다. 다시 로그인해 주세요.');
      return;
    }
    setScopeCalcError(null);
    setIsRecalculating(true);
    setRecalcDone(false);
    try {
      const res = await fetchWithAuthJson(`${apiBase.replace(/\/$/, '')}/ghg-calculation/scope/recalculate`, {
        method: 'POST',
        jsonBody: { company_id: companyId, year: selectedYear, basis: 'location' },
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || res.statusText);
      }
      const body = (await res.json()) as ScopeRecalculateApiResponse;
      
      // 🔍 디버그: API 응답 확인
      console.log('=== Scope Calculation API Response ===');
      console.log('Scope 1 Total:', body.scope1_total);
      console.log('Scope 2 Total:', body.scope2_total);
      console.log('Grand Total:', body.grand_total);
      
      // 첫 번째 Scope 1 아이템 확인
      if (body.scope1_categories && body.scope1_categories.length > 0) {
        const firstCat = body.scope1_categories[0];
        if (firstCat.items && firstCat.items.length > 0) {
          const firstItem = firstCat.items[0];
          console.log('\n=== First Scope 1 Item ===');
          console.log('Name:', firstItem.name);
          console.log('Facility:', firstItem.facility);
          console.log('Source Unit:', `[${firstItem.source_unit}]`);
          console.log('Annual Activity:', firstItem.annual_activity);
          console.log('EF:', firstItem.ef);
          console.log('EF Unit:', firstItem.ef_unit);
          console.log('Total Emission:', firstItem.total);
        } else {
          console.log('⚠️ Scope 1 카테고리에 items가 없습니다');
        }
      } else {
        console.log('⚠️ Scope 1 카테고리가 비어있습니다');
      }
      
      // 첫 번째 Scope 2 아이템 확인
      if (body.scope2_categories && body.scope2_categories.length > 0) {
        const firstCat = body.scope2_categories[0];
        if (firstCat.items && firstCat.items.length > 0) {
          const firstItem = firstCat.items[0];
          console.log('\n=== First Scope 2 Item ===');
          console.log('Name:', firstItem.name);
          console.log('Source Unit:', `[${firstItem.source_unit}]`);
          console.log('Annual Activity:', firstItem.annual_activity);
        }
      }
      console.log('=====================================\n');
      
      setLiveApi(body);
      onApiResponseUpdate?.(body);
      setRecalcDone(true);
      setTimeout(() => setRecalcDone(false), 3000);
    } catch (e) {
      setScopeCalcError(e instanceof Error ? e.message : '재계산에 실패했습니다.');
    } finally {
      setIsRecalculating(false);
    }
  };

  const lastCalcLabel = liveApi?.calculated_at
    ? new Date(liveApi.calculated_at).toLocaleString('ko-KR')
    : null;

  const scopeTabs: {
    key: ScopeTab;
    label: string;
    icon: React.ReactNode;
    desc: string;
    colorClass: string;
  }[] = [
    { key: 'scope1', label: 'Scope 1', icon: <Layers size={13} />, desc: '직접 배출', colorClass: 'border-red-400 text-red-600 bg-red-50' },
    { key: 'scope2', label: 'Scope 2', icon: <Zap size={13} />, desc: '간접 배출 (에너지)', colorClass: 'border-orange-400 text-orange-600 bg-orange-50' },
    { key: 'scope3', label: 'Scope 3', icon: <Truck size={13} />, desc: '기타 간접 배출', colorClass: 'border-purple-400 text-purple-600 bg-purple-50' },
  ];

  const {
    totals,
    grandTotal,
    prev,
    monthlyChart,
    scope1Categories,
    scope2Categories,
    scope3Categories,
    label,
    hideYoy,
  } = dataset;

  const grandYoyPct = prev.grand > 0 ? ((grandTotal - prev.grand) / prev.grand) * 100 : 0;
  const s1yoy = prev.s1 > 0 ? ((totals.scope1 - prev.s1) / prev.s1) * 100 : 0;
  const s2yoy = prev.s2 > 0 ? ((totals.scope2 - prev.s2) / prev.s2) * 100 : 0;
  const s3yoy = prev.s3 > 0 ? ((totals.scope3 - prev.s3) / prev.s3) * 100 : 0;

  const formatTco2 = (n: number) => n.toLocaleString('ko-KR', { minimumFractionDigits: 0, maximumFractionDigits: 3 });
  /** Scope 2·전체 합계 등 카드용: 반올림 정수 표시 */
  const formatRoundedInt = (n: number) => Math.round(n).toLocaleString('ko-KR');

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-gray-900 mt-1">Scope별 배출량 산정 결과</h1>
          <p className="text-gray-500 text-xs mt-0.5">
            스테이징 에너지 데이터와 배출계수로 Scope 1·2·3을 산정합니다. 아래 수치는 저장된 산정 결과 조회 또는「재계산」으로
            채워집니다.
          </p>
          <p className="text-blue-700/80 text-[11px] mt-1">
            기준: <span style={{ fontWeight: 600 }}>{label}</span>
            {!liveApi || liveApi.year !== selectedYear ? (
              <span className="block mt-0.5 text-slate-600/90">
                아직 해당 연도 산정 결과가 없으면 0으로 표시됩니다. 로그인 회사 ID로 조회되며, 재계산 시 DB에 반영됩니다.
              </span>
            ) : null}
            {liveApi && liveApi.year === selectedYear ? (
              <span className="block mt-0.5 text-emerald-800/90">
                Scope 1·2·3 연간 합계·월별 추이·카테고리 라인은 DB 산정 API(ghg_emission_results)와 동일합니다. Scope 3
                카테고리는 스테이징 EMS(<code className="text-[10px] bg-emerald-50 px-1 rounded">staging_ems_data</code>)에
                적재된 Scope3 상세 행이 있을 때만 재계산으로 집계됩니다.
                {liveApi.prev_year_totals && liveApi.comparison_year
                  ? ` 표·상단 카드의 전년 대비는 동일 basis로 저장된 ${liveApi.comparison_year}년 행(ghg_emission_results)과 비교합니다. 행 단위는 시설·항목명이 일치할 때만 %가 채워집니다.`
                  : ' 직전 연도 저장 산정이 없으면 상단 전년 대비와 행 단위 전년대비는 표시하지 않습니다.'}
              </span>
            ) : null}
          </p>
          {scopeCalcError ? (
            <p className="text-red-600 text-[11px] mt-1 max-w-xl">{scopeCalcError}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="appearance-none border border-gray-300 rounded-lg pl-3 pr-7 py-2 text-xs text-gray-700 bg-white focus:outline-none focus:border-blue-400"
            >
              {['2026', '2025', '2024'].map((y) => (
                <option key={y} value={y}>
                  {y}년
                </option>
              ))}
            </select>
            <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
          {recalcDone && (
            <span className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-200">
              <CheckCircle2 size={12} /> 재계산 완료
            </span>
          )}
          <button
            type="button"
            onClick={handleRecalculate}
            disabled={isRecalculating}
            className="flex items-center gap-1.5 px-3 py-2 text-xs text-blue-600 border border-blue-300 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={13} className={isRecalculating ? 'animate-spin' : ''} />
            {isRecalculating ? '재계산 중...' : '재계산'}
          </button>
          <button
            type="button"
            className="flex items-center gap-1.5 px-3 py-2 text-xs text-gray-600 border border-gray-300 bg-white rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download size={13} />
            Excel 다운로드
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div className="bg-[#0d1b36] rounded-xl p-4 text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-white/60 text-xs">전체 배출량 합계</span>
            <BarChart2 size={15} className="text-white/30" />
          </div>
          <div
            className="text-white tabular-nums tracking-tight break-all"
            style={{ fontSize: grandTotal >= 1_000_000 ? '20px' : '24px', fontWeight: 800, lineHeight: 1.1 }}
          >
            {formatRoundedInt(grandTotal)}
          </div>
          <div className="text-white/50 text-xs mt-0.5">
            tCO₂eq ({selectedYear}년 1~12월, Scope 1+2+3)
          </div>
          {hideYoy ? (
            <div className="flex items-center gap-1 mt-2 text-xs text-white/45">전년 대비 — (직전년 미연동)</div>
          ) : (
            <div
              className={`flex items-center gap-1 mt-2 text-xs ${grandYoyPct > 0 ? 'text-red-300' : grandYoyPct < 0 ? 'text-emerald-300' : 'text-white/50'}`}
            >
              {grandYoyPct > 0 ? <TrendingUp size={11} /> : grandYoyPct < 0 ? <TrendingDown size={11} /> : null}
              전년 대비 {grandYoyPct > 0 ? '+' : ''}
              {grandYoyPct.toFixed(1)}%
            </div>
          )}
        </div>

        <div className="bg-white border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-xs text-gray-500" style={{ fontWeight: 600 }}>
              Scope 1 (직접)
            </span>
          </div>
          <div className="text-gray-900 tabular-nums break-all" style={{ fontSize: '20px', fontWeight: 800 }}>
            {formatTco2(totals.scope1)}
          </div>
          <div className="text-gray-400 text-xs mt-0.5">tCO₂eq</div>
          {hideYoy ? (
            <div className="flex items-center gap-1 mt-2 text-xs text-gray-400">전년 대비 — (직전년 미연동)</div>
          ) : (
            <div className={`flex items-center gap-1 mt-2 text-xs ${s1yoy > 0 ? 'text-red-500' : s1yoy < 0 ? 'text-emerald-600' : 'text-gray-400'}`}>
              {s1yoy > 0 ? <TrendingUp size={11} /> : s1yoy < 0 ? <TrendingDown size={11} /> : null}
              {s1yoy > 0 ? '+' : ''}
              {s1yoy.toFixed(1)}% 전년대비
            </div>
          )}
        </div>

        <div className="bg-white border border-orange-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-orange-500" />
            <span className="text-xs text-gray-500" style={{ fontWeight: 600 }}>
              Scope 2 (간접·에너지)
            </span>
          </div>
          <div className="text-gray-900 tabular-nums break-all" style={{ fontSize: '20px', fontWeight: 800 }}>
            {formatRoundedInt(totals.scope2)}
          </div>
          <div className="text-gray-400 text-xs mt-0.5">tCO₂eq (위치기반 합)</div>
          {hideYoy ? (
            <div className="flex items-center gap-1 mt-2 text-xs text-gray-400">전년 대비 — (직전년 미연동)</div>
          ) : (
            <div className={`flex items-center gap-1 mt-2 text-xs ${s2yoy > 0 ? 'text-red-500' : s2yoy < 0 ? 'text-emerald-600' : 'text-gray-400'}`}>
              {s2yoy > 0 ? <TrendingUp size={11} /> : s2yoy < 0 ? <TrendingDown size={11} /> : null}
              {s2yoy > 0 ? '+' : ''}
              {s2yoy.toFixed(1)}% 전년대비
            </div>
          )}
        </div>

        <div className="bg-white border border-purple-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-purple-500" />
            <span className="text-xs text-gray-500" style={{ fontWeight: 600 }}>
              Scope 3 (기타 간접)
            </span>
          </div>
          <div className="text-gray-900 tabular-nums break-all" style={{ fontSize: '20px', fontWeight: 800 }}>
            {formatTco2(totals.scope3)}
          </div>
          <div className="text-gray-400 text-xs mt-0.5">tCO₂eq</div>
          {hideYoy ? (
            <div className="flex items-center gap-1 mt-2 text-xs text-gray-400">전년 대비 — (직전년 미연동)</div>
          ) : (
            <div className={`flex items-center gap-1 mt-2 text-xs ${s3yoy > 0 ? 'text-red-500' : s3yoy < 0 ? 'text-emerald-600' : 'text-gray-400'}`}>
              {s3yoy > 0 ? <TrendingUp size={11} /> : s3yoy < 0 ? <TrendingDown size={11} /> : null}
              {s3yoy > 0 ? '+' : ''}
              {s3yoy.toFixed(1)}% 전년대비
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-gray-800" style={{ fontSize: '13px' }}>
              월별 Scope 배출량 추이 (1~12월)
            </h3>
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm inline-block bg-red-400" />
                Scope 1
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm inline-block bg-orange-400" />
                Scope 2
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm inline-block bg-purple-400" />
                Scope 3
              </span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyChart} barSize={12} barGap={1}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} tickLine={false} interval={0} angle={-35} textAnchor="end" height={52} />
              <YAxis tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={56} tickFormatter={(v: number) => v.toLocaleString('ko-KR')} />
              <Tooltip
                cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const row = payload[0].payload as { month: string; scope1: number; scope2: number; scope3: number };
                  const labelMap: Record<string, string> = { scope1: 'Scope 1', scope2: 'Scope 2', scope3: 'Scope 3' };
                  return (
                    <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs shadow-sm min-w-[150px]">
                      <div className="font-semibold text-gray-800 mb-1.5">{row.month}</div>
                      {payload.map((p) => (
                        <div key={String(p.dataKey)} className="flex justify-between gap-4 py-0.5">
                          <span className="text-gray-500">{labelMap[String(p.dataKey)] ?? String(p.dataKey)}</span>
                          <span className="tabular-nums text-gray-800" style={{ fontWeight: 600 }}>
                            {String(p.dataKey) === 'scope2'
                              ? Math.round(Number(p.value)).toLocaleString('ko-KR')
                              : Number(p.value).toLocaleString(undefined, { maximumFractionDigits: 1 })}{' '}
                            tCO₂eq
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                }}
              />
              <Bar dataKey="scope1" stackId="a" fill="#f87171" />
              <Bar dataKey="scope2" stackId="a" fill="#fb923c" />
              <Bar dataKey="scope3" stackId="a" fill="#a78bfa" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h3 className="text-gray-800 mb-3" style={{ fontSize: '13px' }}>
            Scope별 구성비
          </h3>
          <div className="space-y-3">
            {[
              { label: 'Scope 1', value: totals.scope1, total: grandTotal, color: 'bg-red-400' },
              { label: 'Scope 2', value: totals.scope2, total: grandTotal, color: 'bg-orange-400' },
              { label: 'Scope 3', value: totals.scope3, total: grandTotal, color: 'bg-purple-400' },
            ].map((s) => {
              const pct = grandTotal > 0 ? ((s.value / s.total) * 100).toFixed(1) : '0';
              return (
                <div key={s.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-600">{s.label}</span>
                    <div className="text-right">
                      <span className="text-xs text-gray-800" style={{ fontWeight: 700 }}>
                        {s.label === 'Scope 2' ? formatRoundedInt(s.value) : formatTco2(s.value)}
                      </span>
                      <span className="text-xs text-gray-400 ml-1">t ({pct}%)</span>
                    </div>
                  </div>
                  <div className="bg-gray-100 rounded-full h-2">
                    <div className={`${s.color} rounded-full h-2 transition-all duration-500`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            <div className="pt-2 border-t border-gray-100">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">전체 합계</span>
                <span className="text-gray-900 tabular-nums" style={{ fontWeight: 700 }}>
                  {formatRoundedInt(grandTotal)} tCO₂eq
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex border-b border-gray-200 bg-gray-50">
          {scopeTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveScope(tab.key)}
              className={`flex items-center gap-2 px-5 py-3 text-xs transition-colors border-b-2 ${
                activeScope === tab.key
                  ? 'border-blue-500 bg-white text-blue-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-white/60'
              }`}
            >
              {tab.icon}
              <div className="text-left">
                <div style={{ fontWeight: 600 }}>{tab.label}</div>
                <div className="text-gray-400" style={{ fontSize: '10px' }}>
                  {tab.desc}
                </div>
              </div>
              <span
                className={`ml-1 px-2 py-0.5 rounded-full text-xs border ${
                  activeScope === tab.key ? tab.colorClass : 'bg-gray-100 text-gray-500 border-gray-200'
                }`}
              >
                {`${
                  tab.key === 'scope2'
                    ? formatRoundedInt(totals.scope2)
                    : formatTco2(
                        tab.key === 'scope1' ? totals.scope1 : totals.scope3,
                      )
                } t`}
              </span>
            </button>
          ))}
          <div className="flex-1" />
          <div className="flex items-center gap-3 px-4 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
              확정
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />
              임시
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />
              주의
            </span>
          </div>
        </div>

        <div className="px-4 py-2.5 bg-blue-50 border-b border-blue-100 flex items-center gap-2 text-xs text-blue-700">
          <Info size={12} />
          {activeScope === 'scope1' && 'Scope 1: 사업장 내 직접 연소·공정·냉매 누설 등 직접 배출량입니다.'}
          {activeScope === 'scope2' && 'Scope 2: 구매 전력·열·스팀 사용에 의한 간접 배출량입니다. 위치기반/시장기반 두 가지 방법으로 산정됩니다.'}
          {activeScope === 'scope3' && 'Scope 3: 가치사슬 전반에 걸친 기타 간접 배출량입니다. GHG Protocol 15개 카테고리 기준으로 산정됩니다.'}
        </div>

        <div className="p-4">
          {activeScope === 'scope1' &&
            (scope1Categories.length > 0 ? (
              <CategoryTable categories={scope1Categories} />
            ) : (
              <p className="text-sm text-gray-500 py-8 text-center px-4">
                표시할 Scope 1 라인이 없습니다. 재계산을 실행하면 스테이징 기반 항목이 여기에 채워집니다.
              </p>
            ))}
          {activeScope === 'scope2' &&
            (scope2Categories.length > 0 ? (
              <CategoryTable categories={scope2Categories} />
            ) : (
              <p className="text-sm text-gray-500 py-8 text-center px-4">
                표시할 Scope 2 라인이 없습니다. 재계산을 실행하면 스테이징 기반 항목이 여기에 채워집니다.
              </p>
            ))}
          {activeScope === 'scope3' &&
            (scope3Categories.length > 0 ? (
              <CategoryTable categories={scope3Categories} />
            ) : (
              <p className="text-sm text-gray-500 py-8 text-center px-4">
                {totals.scope3 > 0
                  ? 'Scope 3 연간 합계는 있으나 카테고리 라인이 비어 있습니다. 재계산 후에도 동일하면 백엔드 응답의 scope3_categories를 확인하세요.'
                  : '표시할 Scope 3 항목이 없습니다. 원시 데이터 I/F·업로드로 EMS Scope3 상세가 staging_ems_data에 적재된 뒤 재계산을 실행하면 카테고리별 라인이 채워집니다.'}
              </p>
            ))}
        </div>

        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
          <div className="text-xs text-gray-500 flex items-center gap-1">
            <Info size={11} />
            배출계수 출처: IPCC AR5 GWP 기준 / 국가 고시 배출계수 (2024년 적용)
          </div>
          <span className="text-xs text-gray-400">
            마지막 산정: {lastCalcLabel ?? '—'}
          </span>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState, Fragment, useMemo } from "react";
import {
  Search, Filter, ChevronDown,
  Edit2, RotateCcw, History, Save, X,
  AlertCircle, CheckCircle2, Info,
} from "lucide-react";
import type { ScopeRecalculateApiResponse, ScopeRecalculateApiLineItem, ScopeRecalculateApiCategory } from "../../lib/ghgScopeCalculationData";

interface MappingRow {
  id: string;
  activityType: string;
  facility: string;
  scope: string;
  category: string;
  sourceUnit: string;
  efValue: string;
  efUnit: string;
  source: string;
  version: string;
  appliedFrom: string;
  factorCode: string;
  calculationFormula: string;
  heatContent: number | null;
  annualActivity: number;
  annualEmission: number;
  isManual: boolean;
  status: "active" | "changed" | "pending";
  changeHistory?: { date: string; from: string; to: string; user: string; reason: string }[];
}

interface EmissionFactorMappingProps {
  apiResponse: ScopeRecalculateApiResponse | null;
  isLoading?: boolean;
}

function extractMappingsFromApi(api: ScopeRecalculateApiResponse | null): MappingRow[] {
  if (!api) return [];
  
  const rows: MappingRow[] = [];
  let idx = 0;
  
  const processCategories = (categories: ScopeRecalculateApiCategory[], scopeLabel: string) => {
    for (const cat of categories) {
      for (const item of cat.items) {
        rows.push({
          id: `${scopeLabel}-${cat.id}-${idx++}`,
          activityType: item.name.replace(/\s*\([^)]*\)\s*$/, '').trim(),
          facility: item.facility,
          scope: scopeLabel,
          category: cat.category,
          sourceUnit: item.source_unit || '',
          efValue: item.ef,
          efUnit: item.ef_unit || '',
          source: item.ef_source,
          version: item.ef_version || api.emission_factor_version,
          appliedFrom: api.calculated_at?.split('T')[0] || new Date().toISOString().split('T')[0],
          factorCode: item.factor_code || '',
          calculationFormula: item.calculation_formula || '',
          heatContent: item.heat_content ?? null,
          annualActivity: item.annual_activity || 0,
          annualEmission: item.total,
          isManual: false,
          status: item.status === 'confirmed' ? 'active' : item.status === 'warning' ? 'pending' : 'active',
        });
      }
    }
  };
  
  processCategories(api.scope1_categories, 'Scope 1');
  processCategories(api.scope2_categories, 'Scope 2');
  
  return rows;
}

export function EmissionFactorMapping({ apiResponse, isLoading }: EmissionFactorMappingProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState<string | null>(null);
  const [showFormula, setShowFormula] = useState<string | null>(null);
  const [scopeFilter, setScopeFilter] = useState("전체");
  const [searchQuery, setSearchQuery] = useState("");

  const mappings = useMemo(() => extractMappingsFromApi(apiResponse), [apiResponse]);
  
  const filtered = useMemo(() => {
    return mappings.filter(m => {
      const scopeMatch = scopeFilter === "전체" || m.scope === scopeFilter;
      const searchMatch = !searchQuery || 
        m.activityType.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.facility.toLowerCase().includes(searchQuery.toLowerCase());
      return scopeMatch && searchMatch;
    });
  }, [mappings, scopeFilter, searchQuery]);

  const statusBadge = (s: MappingRow["status"]) => {
    const map = { 
      active: "text-emerald-600 bg-emerald-50 border-emerald-200", 
      changed: "text-blue-600 bg-blue-50 border-blue-200", 
      pending: "text-yellow-600 bg-yellow-50 border-yellow-200" 
    };
    const labels = { active: "적용중", changed: "변경됨", pending: "검토중" };
    return <span className={`text-xs px-2 py-0.5 rounded-full border ${map[s]}`}>{labels[s]}</span>;
  };

  const scopeBadge = (scope: string) => {
    const colors: Record<string, string> = {
      "Scope 1": "bg-red-50 text-red-600",
      "Scope 2": "bg-orange-50 text-orange-600",
      "Scope 3": "bg-purple-50 text-purple-600",
    };
    return <span className={`text-xs px-1.5 py-0.5 rounded ${colors[scope] || 'bg-gray-50 text-gray-600'}`}>{scope}</span>;
  };

  if (isLoading) {
    return (
      <div className="p-5 space-y-4">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500 text-sm">배출계수 매핑 정보를 불러오는 중...</div>
        </div>
      </div>
    );
  }

  if (!apiResponse) {
    return (
      <div className="p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-gray-900">배출계수 매핑</h1>
            <p className="text-gray-500 text-xs mt-0.5">활동자료별 자동 매핑 결과 확인 및 수동 변경</p>
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle size={16} className="text-yellow-600 mt-0.5 shrink-0" />
          <div className="text-xs text-yellow-800">
            <p className="font-semibold mb-1">산정 결과가 없습니다</p>
            <p>Scope 1·2·3 산정 탭에서 <strong>재계산</strong> 버튼을 클릭하면 배출계수 매핑 결과가 여기에 표시됩니다.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-gray-900">배출계수 매핑</h1>
          <p className="text-gray-500 text-xs mt-0.5">활동자료별 자동 매핑 결과 확인 및 수동 변경. 변경 시 근거·출처 입력 필수, 이력 자동 기록</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <CheckCircle2 size={12} className="text-emerald-500" />
          <span>산정일: {apiResponse.calculated_at?.split('T')[0] || '-'}</span>
          <span className="text-gray-300">|</span>
          <span>버전: {apiResponse.emission_factor_version}</span>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2">
        <Info size={14} className="text-blue-600 mt-0.5 shrink-0" />
        <div className="text-xs text-blue-700">
          배출계수는 <strong>환경부 고시, IPCC 가이드라인, 국가 인벤토리</strong> 기반으로 자동 매핑됩니다. 
          수동 변경 시 <strong>근거·출처·적용 기간을 반드시 입력</strong>해야 하며, 변경 이력은 Audit Trail에 자동 기록됩니다.
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3">
        <Filter size={12} className="text-gray-400" />
        <div className="relative">
          <select 
            value={scopeFilter} 
            onChange={e => setScopeFilter(e.target.value)} 
            className="appearance-none border border-gray-300 rounded-lg pl-3 pr-7 py-1.5 text-xs bg-white focus:outline-none focus:border-blue-400"
          >
            {["전체", "Scope 1", "Scope 2", "Scope 3"].map(s => <option key={s}>{s}</option>)}
          </select>
          <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
        <div className="relative flex-1">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="활동유형, 시설 검색..." 
            className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-1.5 text-xs focus:outline-none focus:border-blue-400" 
          />
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <span className="text-xs text-gray-600">
            총 <strong>{filtered.length}</strong>개 매핑 항목
            {scopeFilter !== "전체" && <span className="text-gray-400 ml-1">({scopeFilter} 필터)</span>}
          </span>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-400"></span> Scope 1: {mappings.filter(m => m.scope === 'Scope 1').length}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-orange-400"></span> Scope 2: {mappings.filter(m => m.scope === 'Scope 2').length}
            </span>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#f8fafc] border-b border-gray-200">
                <th className="px-4 py-2.5 text-left text-gray-500">활동유형</th>
                <th className="px-3 py-2.5 text-left text-gray-500">시설</th>
                <th className="px-3 py-2.5 text-left text-gray-500">Scope</th>
                <th className="px-3 py-2.5 text-left text-gray-500">활동단위</th>
                <th className="px-3 py-2.5 text-right text-gray-500">연간활동량</th>
                <th className="px-3 py-2.5 text-right text-gray-500">배출계수</th>
                <th className="px-3 py-2.5 text-left text-gray-500">출처</th>
                <th className="px-3 py-2.5 text-right text-gray-500">연간배출량</th>
                <th className="px-3 py-2.5 text-center text-gray-500">상태</th>
                <th className="px-3 py-2.5 text-center text-gray-500">관리</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-gray-400">
                    {searchQuery ? '검색 결과가 없습니다.' : '해당 Scope의 매핑 데이터가 없습니다.'}
                  </td>
                </tr>
              ) : filtered.map((row) => (
                <Fragment key={row.id}>
                  <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {row.isManual && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block shrink-0" title="수동 변경됨"></span>}
                        <span className="text-gray-800" style={{ fontWeight: 500 }}>{row.activityType}</span>
                      </div>
                      {row.category && <div className="text-[10px] text-gray-400 mt-0.5">{row.category}</div>}
                    </td>
                    <td className="px-3 py-3 text-gray-500">{row.facility}</td>
                    <td className="px-3 py-3">{scopeBadge(row.scope)}</td>
                    <td className="px-3 py-3 text-gray-500 font-mono text-[11px]">{row.sourceUnit || '-'}</td>
                    <td className="px-3 py-3 text-right text-gray-600 font-mono">
                      {row.annualActivity > 0 ? row.annualActivity.toLocaleString(undefined, { maximumFractionDigits: 0 }) : '-'}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <span className="text-gray-800 font-mono" style={{ fontWeight: 700 }}>{row.efValue}</span>
                      {row.efUnit && (
                        <div className="text-[10px] text-gray-400 mt-0.5 max-w-[120px] truncate" title={row.efUnit}>
                          {row.efUnit.split('(')[0].trim()}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 text-xs">{row.source}</span>
                      <div className="text-[10px] text-gray-400 mt-0.5">{row.version}</div>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <span className="text-gray-800 font-mono" style={{ fontWeight: 700 }}>
                        {row.annualEmission.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </span>
                      <div className="text-[10px] text-gray-400">tCO₂eq</div>
                    </td>
                    <td className="px-3 py-3 text-center">{statusBadge(row.status)}</td>
                    <td className="px-3 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {row.calculationFormula && (
                          <button 
                            onClick={() => setShowFormula(showFormula === row.id ? null : row.id)} 
                            className={`p-1 rounded transition-colors ${showFormula === row.id ? 'bg-emerald-100 text-emerald-600' : 'hover:bg-gray-100 text-gray-400 hover:text-gray-600'}`}
                            title="계산식 보기"
                          >
                            <Info size={12} />
                          </button>
                        )}
                        <button 
                          onClick={() => setEditingId(editingId === row.id ? null : row.id)} 
                          className="p-1 rounded hover:bg-blue-100 text-gray-400 hover:text-blue-600 transition-colors" 
                          title="수동 변경"
                        >
                          <Edit2 size={12} />
                        </button>
                        {row.changeHistory && row.changeHistory.length > 0 && (
                          <button 
                            onClick={() => setShowHistory(showHistory === row.id ? null : row.id)} 
                            className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors" 
                            title="변경 이력"
                          >
                            <History size={12} />
                          </button>
                        )}
                        {row.isManual && (
                          <button 
                            className="p-1 rounded hover:bg-yellow-100 text-gray-400 hover:text-yellow-600 transition-colors" 
                            title="원복"
                          >
                            <RotateCcw size={12} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  
                  {/* 계산식 표시 */}
                  {showFormula === row.id && row.calculationFormula && (
                    <tr>
                      <td colSpan={10} className="px-4 py-3 bg-emerald-50 border-b border-emerald-100">
                        <div className="flex items-start gap-2">
                          <Info size={12} className="text-emerald-600 mt-0.5 shrink-0" />
                          <div>
                            <div className="text-xs text-emerald-800 font-semibold mb-1">계산 공식</div>
                            <code className="text-xs text-emerald-700 bg-emerald-100 px-2 py-1 rounded font-mono">
                              {row.calculationFormula}
                            </code>
                            {row.heatContent && (
                              <div className="text-[10px] text-emerald-600 mt-1">
                                열량계수: {row.heatContent} TJ/천{row.sourceUnit}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  
                  {/* 수동 변경 폼 */}
                  {editingId === row.id && (
                    <tr>
                      <td colSpan={10} className="px-4 py-4 bg-blue-50 border-b border-blue-100">
                        <div className="grid grid-cols-4 gap-4">
                          <div>
                            <label className="text-xs text-gray-600 mb-1 block" style={{ fontWeight: 600 }}>
                              변경 배출계수값 <span className="text-red-500">*</span>
                            </label>
                            <input 
                              defaultValue={row.efValue} 
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-400" 
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-600 mb-1 block" style={{ fontWeight: 600 }}>
                              출처 <span className="text-red-500">*</span>
                            </label>
                            <input 
                              defaultValue={row.source} 
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-400" 
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-600 mb-1 block" style={{ fontWeight: 600 }}>
                              버전
                            </label>
                            <input 
                              defaultValue={row.version} 
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-400" 
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-600 mb-1 block" style={{ fontWeight: 600 }}>
                              적용 시작일 <span className="text-red-500">*</span>
                            </label>
                            <input 
                              type="date" 
                              defaultValue={row.appliedFrom} 
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-400" 
                            />
                          </div>
                          <div className="col-span-4">
                            <label className="text-xs text-gray-600 mb-1 block" style={{ fontWeight: 600 }}>
                              변경 근거 <span className="text-red-500">*</span>
                            </label>
                            <textarea 
                              rows={2} 
                              placeholder="배출계수 변경 근거를 입력하세요 (예: 최신 IPCC AR6 GWP 값 적용, 환경부 2024년 고시 반영 등)" 
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-400 resize-none" 
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-3">
                          <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
                            <Save size={11} /> 변경 저장
                          </button>
                          <button 
                            onClick={() => setEditingId(null)} 
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                          >
                            <X size={11} /> 취소
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                  
                  {/* 변경 이력 */}
                  {showHistory === row.id && row.changeHistory && row.changeHistory.length > 0 && (
                    <tr>
                      <td colSpan={10} className="px-4 py-4 bg-gray-50 border-b border-gray-100">
                        <div className="text-xs text-gray-600 mb-2 flex items-center gap-1" style={{ fontWeight: 600 }}>
                          <History size={12} /> 변경 이력
                        </div>
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="py-1 text-left text-gray-400 pr-4">일시</th>
                              <th className="py-1 text-left text-gray-400 pr-4">변경 전</th>
                              <th className="py-1 text-left text-gray-400 pr-4">변경 후</th>
                              <th className="py-1 text-left text-gray-400 pr-4">담당자</th>
                              <th className="py-1 text-left text-gray-400">변경 사유</th>
                            </tr>
                          </thead>
                          <tbody>
                            {row.changeHistory.map((h, i) => (
                              <tr key={i} className="border-b border-gray-100 last:border-0">
                                <td className="py-1.5 pr-4 text-gray-500">{h.date}</td>
                                <td className="py-1.5 pr-4 text-red-500 line-through">{h.from}</td>
                                <td className="py-1.5 pr-4 text-emerald-600" style={{ fontWeight: 600 }}>{h.to}</td>
                                <td className="py-1.5 pr-4 text-gray-600">{h.user}</td>
                                <td className="py-1.5 text-gray-500">{h.reason}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

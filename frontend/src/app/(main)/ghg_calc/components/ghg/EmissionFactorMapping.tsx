'use client';

import { useState, Fragment } from "react";
import {
  Search, Filter, ChevronDown,
  Edit2, RotateCcw, History, Save, X,
} from "lucide-react";

interface MappingRow {
  id: number;
  activityType: string;
  facility: string;
  scope: string;
  gasType: string;
  unit: string;
  efValue: string;
  efUnit: string;
  source: string;
  version: string;
  appliedFrom: string;
  appliedTo: string;
  isManual: boolean;
  status: "active" | "changed" | "pending";
  changeHistory?: { date: string; from: string; to: string; user: string; reason: string }[];
}

const mappings: MappingRow[] = [
  { id: 1, activityType: "LNG 연소", facility: "전사", scope: "Scope 1", gasType: "CO₂", unit: "Nm³", efValue: "2.1764", efUnit: "kgCO₂eq/Nm³", source: "국가 고시 배출계수", version: "2024년", appliedFrom: "2024-01-01", appliedTo: "현재", isManual: false, status: "active" },
  { id: 2, activityType: "경유 연소 (고정)", facility: "전사", scope: "Scope 1", gasType: "CO₂", unit: "L", efValue: "2.6030", efUnit: "kgCO₂eq/L", source: "국가 고시 배출계수", version: "2024년", appliedFrom: "2024-01-01", appliedTo: "현재", isManual: false, status: "active" },
  { id: 3, activityType: "HFC-134a 냉매", facility: "생산동A", scope: "Scope 1", gasType: "HFCs", unit: "kg", efValue: "1,430", efUnit: "kgCO₂eq/kg", source: "IPCC AR5", version: "5차보고서", appliedFrom: "2023-01-01", appliedTo: "현재", isManual: true, status: "active", changeHistory: [{ date: "2023-01-10", from: "1,300 (IPCC AR4)", to: "1,430 (IPCC AR5)", user: "박지훈", reason: "최신 IPCC AR5 GWP 값으로 업데이트" }] },
  { id: 4, activityType: "전력 (위치기반)", facility: "전사", scope: "Scope 2", gasType: "CO₂", unit: "kWh", efValue: "0.4267", efUnit: "kgCO₂eq/kWh", source: "국가 전력 배출계수", version: "2022년", appliedFrom: "2024-01-01", appliedTo: "현재", isManual: false, status: "changed", changeHistory: [{ date: "2024-03-15", from: "0.4593 (2021년)", to: "0.4267 (2022년)", user: "이담당", reason: "환경부 2022년 국가 전력 배출계수 발표에 따른 업데이트" }] },
  { id: 5, activityType: "열·스팀 구매", facility: "전사", scope: "Scope 2", gasType: "CO₂", unit: "Gcal", efValue: "0.2039", efUnit: "kgCO₂eq/MJ", source: "국가 고시 배출계수", version: "2024년", appliedFrom: "2024-01-01", appliedTo: "현재", isManual: false, status: "active" },
  { id: 6, activityType: "원자재 구매 (철강)", facility: "생산동A", scope: "Scope 3", gasType: "CO₂eq", unit: "톤", efValue: "1.85", efUnit: "tCO₂eq/t", source: "IPCC", version: "AR5", appliedFrom: "2024-01-01", appliedTo: "현재", isManual: true, status: "pending", changeHistory: [] },
];

export function EmissionFactorMapping() {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showHistory, setShowHistory] = useState<number | null>(null);
  const [scopeFilter, setScopeFilter] = useState("전체");

  const filtered = mappings.filter(m => scopeFilter === "전체" || m.scope === scopeFilter);

  const statusBadge = (s: MappingRow["status"]) => {
    const map = { active: "text-emerald-600 bg-emerald-50 border-emerald-200", changed: "text-blue-600 bg-blue-50 border-blue-200", pending: "text-yellow-600 bg-yellow-50 border-yellow-200" };
    const labels = { active: "적용중", changed: "변경됨", pending: "검토중" };
    return <span className={`text-xs px-2 py-0.5 rounded-full border ${map[s]}`}>{labels[s]}</span>;
  };

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-gray-900">배출계수 매핑</h1>
          <p className="text-gray-500 text-xs mt-0.5">활동자료별 자동 매핑 결과 확인 및 수동 변경. 변경 시 근거·출처 입력 필수, 이력 자동 기록</p>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2">
        <div className="text-xs text-blue-700">
          배출계수는 IPCC·국가고시·자체 DB 기반으로 자동 매핑됩니다. 수동 변경 시 <strong>근거·출처·적용 기간을 반드시 입력</strong>해야 하며, 변경 이력은 Audit Trail에 자동 기록됩니다.
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3">
        <Filter size={12} className="text-gray-400" />
        <div className="relative">
          <select value={scopeFilter} onChange={e => setScopeFilter(e.target.value)} className="appearance-none border border-gray-300 rounded-lg pl-3 pr-7 py-1.5 text-xs bg-white focus:outline-none focus:border-blue-400">
            {["전체", "Scope 1", "Scope 2", "Scope 3"].map(s => <option key={s}>{s}</option>)}
          </select>
          <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
        <div className="relative flex-1">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input placeholder="활동유형 검색..." className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-1.5 text-xs focus:outline-none focus:border-blue-400" />
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <span className="text-xs text-gray-600">총 <strong>{filtered.length}</strong>개 매핑 항목</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#f8fafc] border-b border-gray-200">
                <th className="px-4 py-2.5 text-left text-gray-500">활동유형</th>
                <th className="px-3 py-2.5 text-left text-gray-500">시설</th>
                <th className="px-3 py-2.5 text-left text-gray-500">Scope</th>
                <th className="px-3 py-2.5 text-left text-gray-500">단위</th>
                <th className="px-3 py-2.5 text-right text-gray-500">배출계수값</th>
                <th className="px-3 py-2.5 text-left text-gray-500">출처</th>
                <th className="px-3 py-2.5 text-left text-gray-500">적용기간</th>
                <th className="px-3 py-2.5 text-center text-gray-500">상태</th>
                <th className="px-3 py-2.5 text-center text-gray-500">관리</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <Fragment key={row.id}>
                  <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {row.isManual && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block shrink-0"></span>}
                        <span className="text-gray-800" style={{ fontWeight: 500 }}>{row.activityType}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-gray-500">{row.facility}</td>
                    <td className="px-3 py-3">
                      <span className={`text-xs px-1.5 py-0.5 rounded ${row.scope === "Scope 1" ? "bg-red-50 text-red-600" : row.scope === "Scope 2" ? "bg-orange-50 text-orange-600" : "bg-purple-50 text-purple-600"}`}>{row.scope}</span>
                    </td>
                    <td className="px-3 py-3 text-gray-500">{row.unit}</td>
                    <td className="px-3 py-3 text-right text-gray-800 font-mono" style={{ fontWeight: 700 }}>{row.efValue}</td>
                    <td className="px-3 py-3"><span className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 text-xs">{row.source}</span></td>
                    <td className="px-3 py-3 text-gray-500">{row.appliedFrom} ~</td>
                    <td className="px-3 py-3 text-center">{statusBadge(row.status)}</td>
                    <td className="px-3 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => setEditingId(editingId === row.id ? null : row.id)} className="p-1 rounded hover:bg-blue-100 text-gray-400 hover:text-blue-600 transition-colors" title="수동 변경"><Edit2 size={12} /></button>
                        {row.changeHistory && row.changeHistory.length > 0 && (
                          <button onClick={() => setShowHistory(showHistory === row.id ? null : row.id)} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors" title="변경 이력"><History size={12} /></button>
                        )}
                        {row.isManual && <button className="p-1 rounded hover:bg-yellow-100 text-gray-400 hover:text-yellow-600 transition-colors" title="원복"><RotateCcw size={12} /></button>}
                      </div>
                    </td>
                  </tr>
                  {editingId === row.id && (
                    <tr key={`edit-${row.id}`}>
                      <td colSpan={9} className="px-4 py-4 bg-blue-50 border-b border-blue-100">
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <label className="text-xs text-gray-600 mb-1 block" style={{ fontWeight: 600 }}>변경 배출계수값 <span className="text-red-500">*</span></label>
                            <input defaultValue={row.efValue} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-400" />
                          </div>
                          <div>
                            <label className="text-xs text-gray-600 mb-1 block" style={{ fontWeight: 600 }}>출처 <span className="text-red-500">*</span></label>
                            <input defaultValue={row.source} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-400" />
                          </div>
                          <div>
                            <label className="text-xs text-gray-600 mb-1 block" style={{ fontWeight: 600 }}>적용 시작일 <span className="text-red-500">*</span></label>
                            <input type="date" defaultValue={row.appliedFrom} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-400" />
                          </div>
                          <div className="col-span-3">
                            <label className="text-xs text-gray-600 mb-1 block" style={{ fontWeight: 600 }}>변경 근거 <span className="text-red-500">*</span></label>
                            <textarea rows={2} placeholder="배출계수 변경 근거를 입력하세요 (필수)" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-400 resize-none" />
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-3">
                          <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"><Save size={11} /> 변경 저장</button>
                          <button onClick={() => setEditingId(null)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"><X size={11} /> 취소</button>
                        </div>
                      </td>
                    </tr>
                  )}
                  {showHistory === row.id && row.changeHistory && row.changeHistory.length > 0 && (
                    <tr key={`hist-${row.id}`}>
                      <td colSpan={9} className="px-4 py-4 bg-gray-50 border-b border-gray-100">
                        <div className="text-xs text-gray-600 mb-2 flex items-center gap-1" style={{ fontWeight: 600 }}><History size={12} /> 변경 이력</div>
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

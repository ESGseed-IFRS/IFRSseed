'use client';

import { useState } from "react";
import {
  RefreshCw, Download, ChevronDown, ChevronRight, TrendingUp, TrendingDown,
  Info, CheckCircle2, AlertCircle, Layers, Zap, Truck,
  BarChart2
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

type ScopeTab = "scope1" | "scope2" | "scope3";

// Mock data
const scope1Categories = [
  {
    id: "s1-1", category: "고정연소", items: [
      { name: "LNG 연소 (보일러)", facility: "본관동", unit: "tCO₂eq", jan: 24.5, feb: 26.1, mar: 22.8, total: 73.4, ef: "2.176", efSource: "국가고시", yoy: 3.2, status: "confirmed" },
      { name: "LNG 연소 (생산동A)", facility: "생산동A", unit: "tCO₂eq", jan: 52.3, feb: 55.8, mar: 49.7, total: 157.8, ef: "2.176", efSource: "국가고시", yoy: -1.5, status: "confirmed" },
      { name: "경유 (비상발전기)", facility: "전사", unit: "tCO₂eq", jan: 2.1, feb: 2.1, mar: 2.1, total: 6.3, ef: "2.603", efSource: "IPCC", yoy: 0.0, status: "confirmed" },
    ]
  },
  {
    id: "s1-2", category: "이동연소", items: [
      { name: "휘발유 (사업용 차량)", facility: "전사", unit: "tCO₂eq", jan: 3.8, feb: 3.5, mar: 4.1, total: 11.4, ef: "2.097", efSource: "국가고시", yoy: -8.1, status: "confirmed" },
      { name: "경유 (화물 차량)", facility: "전사", unit: "tCO₂eq", jan: 5.2, feb: 4.9, mar: 5.5, total: 15.6, ef: "2.603", efSource: "국가고시", yoy: 2.3, status: "draft" },
    ]
  },
  {
    id: "s1-3", category: "공정배출", items: [
      { name: "냉매 누설 (HFC-134a)", facility: "생산동A", unit: "tCO₂eq", jan: 0.0, feb: 8.5, mar: 0.0, total: 8.5, ef: "1430", efSource: "IPCC AR5", yoy: 15.4, status: "warning" },
    ]
  },
];

const scope2Categories = [
  {
    id: "s2-1", category: "전력 (위치기반)", items: [
      { name: "전력 (본관동)", facility: "본관동", unit: "tCO₂eq", jan: 61.8, feb: 58.9, mar: 64.7, total: 185.4, ef: "0.4267", efSource: "국가 전력계수", yoy: 2.1, status: "confirmed" },
      { name: "전력 (생산동A)", facility: "생산동A", unit: "tCO₂eq", jan: 380.5, feb: 373.2, mar: 384.2, total: 1137.9, ef: "0.4267", efSource: "국가 전력계수", yoy: 1.8, status: "confirmed" },
      { name: "전력 (생산동B)", facility: "생산동B", unit: "tCO₂eq", jan: 279.3, feb: 273.4, mar: 285.2, total: 837.9, ef: "0.4267", efSource: "국가 전력계수", yoy: -0.9, status: "confirmed" },
    ]
  },
  {
    id: "s2-2", category: "전력 (시장기반)", items: [
      { name: "전력 (재생에너지 REC)", facility: "생산동A", unit: "tCO₂eq", jan: 0.0, feb: 0.0, mar: 0.0, total: 0.0, ef: "0", efSource: "REC 인증", yoy: -100.0, status: "confirmed" },
    ]
  },
  {
    id: "s2-3", category: "열·스팀", items: [
      { name: "열·스팀 구매 (생산동A)", facility: "생산동A", unit: "tCO₂eq", jan: 47.8, feb: 49.2, mar: 46.7, total: 143.7, ef: "0.2039", efSource: "국가고시", yoy: 3.5, status: "confirmed" },
    ]
  },
];

const scope3Categories = [
  {
    id: "s3-1", category: "Cat.1 구매재화·서비스", items: [
      { name: "원자재 구매 (철강)", facility: "생산동A", unit: "tCO₂eq", jan: 425.2, feb: 418.5, mar: 432.1, total: 1275.8, ef: "1.85", efSource: "IPCC", yoy: 5.2, status: "confirmed" },
      { name: "포장재 구매", facility: "전사", unit: "tCO₂eq", jan: 12.3, feb: 11.8, mar: 13.1, total: 37.2, ef: "0.55", efSource: "업체제공", yoy: -3.1, status: "draft" },
    ]
  },
  {
    id: "s3-2", category: "Cat.3 연료·에너지 관련", items: [
      { name: "전력 T&D 손실", facility: "전사", unit: "tCO₂eq", jan: 36.2, feb: 35.5, mar: 36.8, total: 108.5, ef: "0.0395", efSource: "국가고시", yoy: 1.5, status: "confirmed" },
    ]
  },
  {
    id: "s3-3", category: "Cat.4 업스트림 물류", items: [
      { name: "원자재 운송 (협력사)", facility: "전사", unit: "tCO₂eq", jan: 28.5, feb: 27.2, mar: 29.8, total: 85.5, ef: "0.163", efSource: "IPCC", yoy: 2.8, status: "draft" },
    ]
  },
  {
    id: "s3-4", category: "Cat.5 사업 중 발생 폐기물", items: [
      { name: "일반폐기물 (매립)", facility: "전사", unit: "tCO₂eq", jan: 1.8, feb: 1.7, mar: 1.9, total: 5.4, ef: "0.144", efSource: "국가고시", yoy: -5.1, status: "confirmed" },
    ]
  },
];

const scopeSummary = {
  scope1: { total: 273.0, prev: 261.5, unit: "tCO₂eq", color: "#ef4444", items: 6 },
  scope2_lb: { total: 2305.0, prev: 2271.3, unit: "tCO₂eq", color: "#f97316", items: 4 },
  scope3: { total: 1512.4, prev: 1441.2, unit: "tCO₂eq", color: "#8b5cf6", items: 5 },
};

const monthlyChart = [
  { month: "1월", scope1: 88.9, scope2: 769.4, scope3: 504.0 },
  { month: "2월", scope1: 100.9, scope2: 754.7, scope3: 494.7 },
  { month: "3월", scope1: 83.2, scope2: 780.8, scope3: 513.7 },
];

function TrendBadge({ value }: { value: number }) {
  const isUp = value > 0;
  const isZero = value === 0;
  return (
    <span className={`flex items-center gap-0.5 text-xs ${isZero ? "text-gray-400" : isUp ? "text-red-500" : "text-emerald-600"}`}>
      {!isZero && (isUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />)}
      {isZero ? "—" : `${isUp ? "+" : ""}${value.toFixed(1)}%`}
    </span>
  );
}

function StatusDot({ status }: { status: string }) {
  const c: Record<string, string> = {
    confirmed: "bg-emerald-400",
    draft: "bg-yellow-400",
    warning: "bg-orange-400",
    error: "bg-red-500",
  };
  return <span className={`inline-block w-2 h-2 rounded-full ${c[status] ?? "bg-gray-300"}`} />;
}

interface CategoryTableProps {
  categories: typeof scope1Categories;
  scope: string;
}

function CategoryTable({ categories, scope: _scope }: CategoryTableProps) {
  const [expanded, setExpanded] = useState<string[]>(categories.map((c) => c.id));

  return (
    <div className="space-y-2">
      {categories.map((cat) => {
        const catTotal = cat.items.reduce((s, i) => s + i.total, 0);
        const isOpen = expanded.includes(cat.id);
        return (
          <div key={cat.id} className="border border-gray-200 rounded-xl overflow-hidden">
            {/* Category Header */}
            <button
              onClick={() => setExpanded((p) => p.includes(cat.id) ? p.filter((x) => x !== cat.id) : [...p, cat.id])}
              className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-2">
                {isOpen ? <ChevronDown size={13} className="text-gray-500" /> : <ChevronRight size={13} className="text-gray-500" />}
                <span className="text-xs text-gray-800" style={{ fontWeight: 600 }}>{cat.category}</span>
                <span className="text-xs text-gray-400">({cat.items.length}개 항목)</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">소계</span>
                <span className="text-sm text-gray-800" style={{ fontWeight: 700 }}>{catTotal.toFixed(1)}</span>
                <span className="text-xs text-gray-400">tCO₂eq</span>
              </div>
            </button>

            {/* Items Table */}
            {isOpen && (
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#fafbfc] border-b border-gray-100">
                    <th className="px-4 py-2 text-left text-gray-500 w-6"></th>
                    <th className="px-3 py-2 text-left text-gray-500">항목명</th>
                    <th className="px-3 py-2 text-left text-gray-500">시설</th>
                    <th className="px-3 py-2 text-right text-gray-500">1월</th>
                    <th className="px-3 py-2 text-right text-gray-500">2월</th>
                    <th className="px-3 py-2 text-right text-gray-500">3월</th>
                    <th className="px-3 py-2 text-right text-gray-500 border-l border-gray-100">합계 (tCO₂eq)</th>
                    <th className="px-3 py-2 text-center text-gray-500">배출계수</th>
                    <th className="px-3 py-2 text-center text-gray-500">출처</th>
                    <th className="px-3 py-2 text-right text-gray-500">전년대비</th>
                    <th className="px-3 py-2 text-center text-gray-500">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {cat.items.map((item) => (
                    <tr key={item.name} className="border-b border-gray-100 last:border-0 hover:bg-blue-50/30 transition-colors">
                      <td className="px-4 py-2.5 text-center">
                        <StatusDot status={item.status} />
                      </td>
                      <td className="px-3 py-2.5 text-gray-700" style={{ fontWeight: 500 }}>{item.name}</td>
                      <td className="px-3 py-2.5 text-gray-500">{item.facility}</td>
                      <td className="px-3 py-2.5 text-right text-gray-600">{item.jan.toFixed(1)}</td>
                      <td className="px-3 py-2.5 text-right text-gray-600">{item.feb.toFixed(1)}</td>
                      <td className="px-3 py-2.5 text-right text-gray-600">{item.mar.toFixed(1)}</td>
                      <td className="px-3 py-2.5 text-right text-gray-900 border-l border-gray-100" style={{ fontWeight: 700 }}>{item.total.toFixed(1)}</td>
                      <td className="px-3 py-2.5 text-center text-gray-500 font-mono">{item.ef}</td>
                      <td className="px-3 py-2.5 text-center">
                        <span className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded text-xs border border-blue-200">{item.efSource}</span>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <TrendBadge value={item.yoy} />
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {item.status === "confirmed" ? (
                          <CheckCircle2 size={13} className="inline text-emerald-500" />
                        ) : item.status === "warning" ? (
                          <AlertCircle size={13} className="inline text-orange-400" />
                        ) : (
                          <span className="text-yellow-500 text-xs">임시</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function ScopeCalculation() {
  const [activeScope, setActiveScope] = useState<ScopeTab>("scope1");
  const [selectedYear, setSelectedYear] = useState("2026");
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [recalcDone, setRecalcDone] = useState(false);

  const handleRecalculate = () => {
    setIsRecalculating(true);
    setRecalcDone(false);
    setTimeout(() => {
      setIsRecalculating(false);
      setRecalcDone(true);
      setTimeout(() => setRecalcDone(false), 3000);
    }, 1800);
  };

  const scopeTabs: { key: ScopeTab; label: string; icon: React.ReactNode; desc: string; colorClass: string }[] = [
    { key: "scope1", label: "Scope 1", icon: <Layers size={13} />, desc: "직접 배출", colorClass: "border-red-400 text-red-600 bg-red-50" },
    { key: "scope2", label: "Scope 2", icon: <Zap size={13} />, desc: "간접 배출 (에너지)", colorClass: "border-orange-400 text-orange-600 bg-orange-50" },
    { key: "scope3", label: "Scope 3", icon: <Truck size={13} />, desc: "기타 간접 배출", colorClass: "border-purple-400 text-purple-600 bg-purple-50" },
  ];

  const totals = {
    scope1: scope1Categories.flatMap(c => c.items).reduce((s, i) => s + i.total, 0),
    scope2: scope2Categories.flatMap(c => c.items).reduce((s, i) => s + i.total, 0),
    scope3: scope3Categories.flatMap(c => c.items).reduce((s, i) => s + i.total, 0),
  };
  const grandTotal = totals.scope1 + totals.scope2 + totals.scope3;
  const prevGrand = scopeSummary.scope1.prev + scopeSummary.scope2_lb.prev + scopeSummary.scope3.prev;

  return (
    <div className="p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-gray-900 mt-1">Scope별 배출량 산정 결과</h1>
          <p className="text-gray-500 text-xs mt-0.5">입력 데이터와 배출계수 기반 Scope 1·2·3 배출량 산정 결과 조회 및 재계산</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="appearance-none border border-gray-300 rounded-lg pl-3 pr-7 py-2 text-xs text-gray-700 bg-white focus:outline-none focus:border-blue-400"
            >
              {["2026", "2025", "2024"].map(y => <option key={y} value={y}>{y}년</option>)}
            </select>
            <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
          {recalcDone && (
            <span className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg border border-emerald-200">
              <CheckCircle2 size={12} /> 재계산 완료
            </span>
          )}
          <button
            onClick={handleRecalculate}
            disabled={isRecalculating}
            className="flex items-center gap-1.5 px-3 py-2 text-xs text-blue-600 border border-blue-300 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={13} className={isRecalculating ? "animate-spin" : ""} />
            {isRecalculating ? "재계산 중..." : "재계산"}
          </button>
          <button className="flex items-center gap-1.5 px-3 py-2 text-xs text-gray-600 border border-gray-300 bg-white rounded-lg hover:bg-gray-50 transition-colors">
            <Download size={13} />
            Excel 다운로드
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-4 gap-3">
        {/* Grand Total */}
        <div className="bg-[#0d1b36] rounded-xl p-4 text-white">
          <div className="flex items-center justify-between mb-2">
            <span className="text-white/60 text-xs">전체 배출량 합계</span>
            <BarChart2 size={15} className="text-white/30" />
          </div>
          <div className="text-white" style={{ fontSize: "26px", fontWeight: 800, lineHeight: 1 }}>
            {grandTotal.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
          </div>
          <div className="text-white/50 text-xs mt-0.5">tCO₂eq ({selectedYear}년 1~3월)</div>
          <div className={`flex items-center gap-1 mt-2 text-xs ${((grandTotal - prevGrand) / prevGrand * 100) > 0 ? "text-red-300" : "text-emerald-300"}`}>
            <TrendingUp size={11} />
            전년 동기 대비 +{(((grandTotal - prevGrand) / prevGrand) * 100).toFixed(1)}%
          </div>
        </div>

        {/* Scope 1 */}
        <div className="bg-white border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-red-500"></div>
            <span className="text-xs text-gray-500" style={{ fontWeight: 600 }}>Scope 1 (직접)</span>
          </div>
          <div className="text-gray-900" style={{ fontSize: "22px", fontWeight: 800, lineHeight: 1 }}>{totals.scope1.toFixed(1)}</div>
          <div className="text-gray-400 text-xs mt-0.5">tCO₂eq</div>
          <div className="flex items-center gap-1 mt-2 text-xs text-red-500">
            <TrendingUp size={11} />
            +{(((totals.scope1 - scopeSummary.scope1.prev) / scopeSummary.scope1.prev) * 100).toFixed(1)}% 전년대비
          </div>
        </div>

        {/* Scope 2 */}
        <div className="bg-white border border-orange-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-orange-500"></div>
            <span className="text-xs text-gray-500" style={{ fontWeight: 600 }}>Scope 2 (간접·에너지)</span>
          </div>
          <div className="text-gray-900" style={{ fontSize: "22px", fontWeight: 800, lineHeight: 1 }}>{totals.scope2.toFixed(1)}</div>
          <div className="text-gray-400 text-xs mt-0.5">tCO₂eq (위치기반)</div>
          <div className="flex items-center gap-1 mt-2 text-xs text-red-500">
            <TrendingUp size={11} />
            +{(((totals.scope2 - scopeSummary.scope2_lb.prev) / scopeSummary.scope2_lb.prev) * 100).toFixed(1)}% 전년대비
          </div>
        </div>

        {/* Scope 3 */}
        <div className="bg-white border border-purple-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-purple-500"></div>
            <span className="text-xs text-gray-500" style={{ fontWeight: 600 }}>Scope 3 (기타 간접)</span>
          </div>
          <div className="text-gray-900" style={{ fontSize: "22px", fontWeight: 800, lineHeight: 1 }}>{totals.scope3.toFixed(1)}</div>
          <div className="text-gray-400 text-xs mt-0.5">tCO₂eq</div>
          <div className="flex items-center gap-1 mt-2 text-xs text-red-500">
            <TrendingUp size={11} />
            +{(((totals.scope3 - scopeSummary.scope3.prev) / scopeSummary.scope3.prev) * 100).toFixed(1)}% 전년대비
          </div>
        </div>
      </div>

      {/* Chart + Scope Composition */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-gray-800" style={{ fontSize: "13px" }}>월별 Scope 배출량 추이</h3>
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block bg-red-400"></span>Scope 1</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block bg-orange-400"></span>Scope 2</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm inline-block bg-purple-400"></span>Scope 3</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={monthlyChart} barSize={20} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} unit=" t" width={55} />
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 8, border: "1px solid #e5e7eb" }}
                formatter={(v: number) => [`${v.toFixed(1)} tCO₂eq`]}
              />
              <Bar dataKey="scope1" stackId="a" fill="#f87171" radius={[0, 0, 0, 0]} />
              <Bar dataKey="scope2" stackId="a" fill="#fb923c" radius={[0, 0, 0, 0]} />
              <Bar dataKey="scope3" stackId="a" fill="#a78bfa" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Scope Breakdown */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <h3 className="text-gray-800 mb-3" style={{ fontSize: "13px" }}>Scope별 구성비</h3>
          <div className="space-y-3">
            {[
              { label: "Scope 1", value: totals.scope1, total: grandTotal, color: "bg-red-400" },
              { label: "Scope 2", value: totals.scope2, total: grandTotal, color: "bg-orange-400" },
              { label: "Scope 3", value: totals.scope3, total: grandTotal, color: "bg-purple-400" },
            ].map((s) => {
              const pct = ((s.value / s.total) * 100).toFixed(1);
              return (
                <div key={s.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-600">{s.label}</span>
                    <div className="text-right">
                      <span className="text-xs text-gray-800" style={{ fontWeight: 700 }}>{s.value.toFixed(0)}</span>
                      <span className="text-xs text-gray-400 ml-1">t ({pct}%)</span>
                    </div>
                  </div>
                  <div className="bg-gray-100 rounded-full h-2">
                    <div className={`${s.color} rounded-full h-2 transition-all duration-500`} style={{ width: `${pct}%` }}></div>
                  </div>
                </div>
              );
            })}
            <div className="pt-2 border-t border-gray-100">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">전체 합계</span>
                <span className="text-gray-900" style={{ fontWeight: 700 }}>{grandTotal.toFixed(0)} tCO₂eq</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scope Tabs + Detail Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {/* Scope Tab Selector */}
        <div className="flex border-b border-gray-200 bg-gray-50">
          {scopeTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveScope(tab.key)}
              className={`flex items-center gap-2 px-5 py-3 text-xs transition-colors border-b-2 ${
                activeScope === tab.key
                  ? `border-blue-500 bg-white text-blue-700`
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-white/60"
              }`}
            >
              {tab.icon}
              <div className="text-left">
                <div style={{ fontWeight: 600 }}>{tab.label}</div>
                <div className="text-gray-400" style={{ fontSize: "10px" }}>{tab.desc}</div>
              </div>
              <span className={`ml-1 px-2 py-0.5 rounded-full text-xs border ${
                activeScope === tab.key
                  ? tab.colorClass
                  : "bg-gray-100 text-gray-500 border-gray-200"
              }`}>
                {activeScope === tab.key
                  ? `${totals[tab.key === "scope1" ? "scope1" : tab.key === "scope2" ? "scope2" : "scope3"].toFixed(0)} t`
                  : tab.key === "scope1" ? `${totals.scope1.toFixed(0)} t` : tab.key === "scope2" ? `${totals.scope2.toFixed(0)} t` : `${totals.scope3.toFixed(0)} t`
                }
              </span>
            </button>
          ))}
          <div className="flex-1"></div>
          {/* Legend */}
          <div className="flex items-center gap-3 px-4 text-xs text-gray-400">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span>확정</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block"></span>임시</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400 inline-block"></span>주의</span>
          </div>
        </div>

        {/* Info Banner */}
        <div className="px-4 py-2.5 bg-blue-50 border-b border-blue-100 flex items-center gap-2 text-xs text-blue-700">
          <Info size={12} />
          {activeScope === "scope1" && "Scope 1: 사업장 내 직접 연소·공정·냉매 누설 등 직접 배출량입니다."}
          {activeScope === "scope2" && "Scope 2: 구매 전력·열·스팀 사용에 의한 간접 배출량입니다. 위치기반/시장기반 두 가지 방법으로 산정됩니다."}
          {activeScope === "scope3" && "Scope 3: 가치사슬 전반에 걸친 기타 간접 배출량입니다. GHG Protocol 15개 카테고리 기준으로 산정됩니다."}
        </div>

        {/* Tables */}
        <div className="p-4">
          {activeScope === "scope1" && <CategoryTable categories={scope1Categories} scope="scope1" />}
          {activeScope === "scope2" && <CategoryTable categories={scope2Categories} scope="scope2" />}
          {activeScope === "scope3" && <CategoryTable categories={scope3Categories} scope="scope3" />}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
          <div className="text-xs text-gray-500 flex items-center gap-1">
            <Info size={11} />
            배출계수 출처: IPCC AR5 GWP 기준 / 국가 고시 배출계수 (2024년 적용)
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">마지막 산정: 2026-03-06 09:32</span>
          </div>
        </div>
      </div>
    </div>
  );
}

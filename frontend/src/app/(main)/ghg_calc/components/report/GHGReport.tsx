'use client';

import { useState } from "react";
import { FileBarChart2, Download, ChevronDown, CheckCircle2, Package } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from "recharts";

const scopeData = [
  { scope: "Scope 1", tCO2eq: 273.0, yoy: "+4.4%" },
  { scope: "Scope 2 (위치)", tCO2eq: 2304.9, yoy: "+1.5%" },
  { scope: "Scope 2 (시장)", tCO2eq: 1167.1, yoy: "-49.3%" },
  { scope: "Scope 3", tCO2eq: 1512.4, yoy: "+4.9%" },
];

const scope1Breakdown = [
  { name: "LNG 연소", value: 231.2 },
  { name: "이동연소", value: 27.0 },
  { name: "냉매 누설", value: 8.5 },
  { name: "경유 연소", value: 6.3 },
];

const monthlyTrend = [
  { month: "1월", s1: 88.9, s2: 769.4, s3: 504.0 },
  { month: "2월", s1: 100.9, s2: 754.7, s3: 494.7 },
  { month: "3월", s1: 83.2, s2: 780.8, s3: 513.7 },
];

const PIE_COLORS = ["#ef4444", "#f97316", "#f59e0b", "#22c55e"];

export function GHGReport() {
  const [selectedYear, setSelectedYear] = useState("2026");
  const [selectedPeriod, setSelectedPeriod] = useState("1Q");
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportReady, setReportReady] = useState(false);

  const handleGenerate = () => {
    setIsGenerating(true);
    setTimeout(() => { setIsGenerating(false); setReportReady(true); }, 1800);
  };

  return (
    <div className="p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">3-3. GHG 보고서 출력</span>
          </div>
          <h1 className="text-gray-900">GHG 보고서 출력</h1>
          <p className="text-gray-500 text-xs mt-0.5">정량 배출량 결과 요약 및 기초 보고서 생성 (내부 검토·이해관계자 공유·공시 준비용)</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <select value={selectedYear} onChange={e => setSelectedYear(e.target.value)} className="appearance-none border border-gray-300 rounded-lg pl-3 pr-7 py-2 text-xs bg-white focus:outline-none focus:border-blue-400">
              {["2026", "2025", "2024"].map(y => <option key={y}>{y}년</option>)}
            </select>
            <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
          <div className="relative">
            <select value={selectedPeriod} onChange={e => setSelectedPeriod(e.target.value)} className="appearance-none border border-gray-300 rounded-lg pl-3 pr-7 py-2 text-xs bg-white focus:outline-none focus:border-blue-400">
              {[["1Q","1분기"],["2Q","2분기"],["3Q","3분기"],["4Q","4분기"],["FY","전체 연간"]].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
          {reportReady ? (
            <button className="flex items-center gap-1.5 px-3 py-2 text-xs text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors">
              <Download size={13} /> PDF 다운로드
            </button>
          ) : (
            <button onClick={handleGenerate} disabled={isGenerating} className="flex items-center gap-1.5 px-3 py-2 text-xs text-white bg-[#0d1b36] rounded-lg hover:bg-[#1a3060] disabled:opacity-50 transition-colors">
              {isGenerating ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <FileBarChart2 size={13} />}
              {isGenerating ? "생성 중..." : "보고서 생성"}
            </button>
          )}
          <button className="flex items-center gap-1.5 px-3 py-2 text-xs text-gray-600 border border-gray-300 bg-white rounded-lg hover:bg-gray-50 transition-colors">
            <Package size={13} /> 증빙 패키지
          </button>
        </div>
      </div>

      {reportReady && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-xs text-emerald-700">
          <CheckCircle2 size={14} /> GHG 보고서가 생성되었습니다. PDF / Excel 형식으로 다운로드 가능합니다.
        </div>
      )}

      {/* Report Preview */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {/* Report Header */}
        <div className="bg-[#0d1b36] px-6 py-5 text-white">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-white/60 text-xs mb-1">GHG Emissions Report · GHG Protocol 기준</div>
              <div className="text-white" style={{ fontSize: "18px", fontWeight: 700 }}>온실가스 배출량 보고서</div>
              <div className="text-white/70 text-xs mt-1">미라콤 · {selectedYear}년 {selectedPeriod === "FY" ? "전체 연간" : `${selectedPeriod}`}</div>
            </div>
            <div className="text-right">
              <div className="text-white/50 text-xs">보고일</div>
              <div className="text-white text-xs" style={{ fontWeight: 600 }}>2026-03-06</div>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Scope Summary Table */}
          <div>
            <h3 className="text-gray-800 mb-3" style={{ fontSize: "13px" }}>1. 배출량 통계 결과 (Scope 1·2·3)</h3>
            <table className="w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
              <thead>
                <tr className="bg-[#f8fafc] border-b border-gray-200">
                  <th className="px-4 py-2.5 text-left text-gray-600">구분</th>
                  <th className="px-4 py-2.5 text-right text-gray-600">배출량 (tCO₂eq)</th>
                  <th className="px-4 py-2.5 text-right text-gray-600">전년 동기 대비</th>
                  <th className="px-4 py-2.5 text-left text-gray-600">비고</th>
                </tr>
              </thead>
              <tbody>
                {scopeData.map((row, i) => (
                  <tr key={i} className="border-b border-gray-100 last:border-0">
                    <td className="px-4 py-2.5 text-gray-700" style={{ fontWeight: 500 }}>{row.scope}</td>
                    <td className="px-4 py-2.5 text-right text-gray-900" style={{ fontWeight: 700 }}>{row.tCO2eq.toFixed(1)}</td>
                    <td className={`px-4 py-2.5 text-right text-xs ${row.yoy.startsWith("+") ? "text-red-500" : "text-emerald-600"}`}>{row.yoy}</td>
                    <td className="px-4 py-2.5 text-gray-400 text-xs">
                      {i === 0 && "직접 배출 (고정·이동·냉매)"}
                      {i === 1 && "위치기반 방법 적용"}
                      {i === 2 && "시장기반 (RE 인증 반영)"}
                      {i === 3 && "Cat.1·3·4·5 산정 완료"}
                    </td>
                  </tr>
                ))}
                <tr className="bg-gray-50">
                  <td className="px-4 py-2.5 text-gray-800" style={{ fontWeight: 700 }}>총 배출량 합계 (Scope 1+2+3)</td>
                  <td className="px-4 py-2.5 text-right text-gray-900" style={{ fontWeight: 800 }}>4,090.3</td>
                  <td className="px-4 py-2.5 text-right text-xs text-red-500">+2.9%</td>
                  <td className="px-4 py-2.5 text-gray-400 text-xs">위치기반 기준</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Charts */}
          <div className="grid grid-cols-3 gap-4">
            {/* Monthly Trend */}
            <div className="col-span-2">
              <h3 className="text-gray-800 mb-3" style={{ fontSize: "13px" }}>2. 월별 배출량 추이</h3>
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={monthlyTrend} barSize={16} barGap={3}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} formatter={(v: number) => [`${v.toFixed(1)} tCO₂eq`]} />
                  <Bar dataKey="s1" stackId="a" fill="#ef4444" name="Scope 1" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="s2" stackId="a" fill="#f97316" name="Scope 2" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="s3" stackId="a" fill="#8b5cf6" name="Scope 3" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Scope 1 Breakdown */}
            <div>
              <h3 className="text-gray-800 mb-3" style={{ fontSize: "13px" }}>Scope 1 세부 breakdown</h3>
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie data={scope1Breakdown} cx="50%" cy="50%" outerRadius={55} dataKey="value" nameKey="name">
                    {scope1Breakdown.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 10, borderRadius: 6 }} formatter={(v: number) => [`${v.toFixed(1)} t`]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Methodology */}
          <div className="border border-gray-200 rounded-xl p-4">
            <h3 className="text-gray-800 mb-3" style={{ fontSize: "13px" }}>3. 기본 산정 방법 개요</h3>
            <div className="grid grid-cols-2 gap-4 text-xs">
              {[
                ["산정 기준", "GHG Protocol Corporate Standard"],
                ["배출계수 출처", "국가 온실가스 배출·흡수계수 고시 (2024년) / IPCC AR5"],
                ["Scope 경계", "운영 통제 방식 (Operational Control)"],
                ["GWP 기준", "IPCC 5차 보고서 (AR5), 100년 기준"],
                ["기준연도", "2020년 (재계산 트리거 조건 검토 중)"],
                ["검증 수준", "제3자 검증 예정 (2026년 하반기)"],
              ].map(([k, v]) => (
                <div key={k} className="flex gap-2">
                  <span className="text-gray-400 shrink-0 w-28">{k}</span>
                  <span className="text-gray-700">{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

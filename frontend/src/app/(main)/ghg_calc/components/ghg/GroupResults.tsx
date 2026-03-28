'use client';

import { useState } from "react";
import {
  TrendingDown, TrendingUp, Download,
  ChevronDown, Snowflake, ExternalLink
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from "recharts";

type GroupEntityRow = {
  name: string;
  scope1: number;
  scope2: number;
  scope3: number;
  total: number;
  prev: number;
  frozen: boolean;
  segment: "subsidiary" | "domestic";
  /** 국내 사업장일 때: 데이터센터·캠퍼스 등 */
  segmentLabel?: string;
};

const subsidiaryRows: GroupEntityRow[] = [
  { name: "미라콤", scope1: 2180, scope2: 9540, scope3: 18240, total: 29960, prev: 28450, frozen: true, segment: "subsidiary" },
  { name: "시큐아이", scope1: 5420, scope2: 18230, scope3: 32100, total: 55750, prev: 54210, frozen: true, segment: "subsidiary" },
  { name: "에스코어", scope1: 840, scope2: 3210, scope3: 6780, total: 10830, prev: 11240, frozen: true, segment: "subsidiary" },
  { name: "멀티캠퍼스", scope1: 3290, scope2: 4180, scope3: 12450, total: 19920, prev: 19100, frozen: true, segment: "subsidiary" },
  { name: "엠로", scope1: 6780, scope2: 22100, scope3: 41200, total: 70080, prev: 71500, frozen: false, segment: "subsidiary" },
  { name: "오픈핸즈", scope1: 1230, scope2: 5670, scope3: 9870, total: 16770, prev: 16320, frozen: true, segment: "subsidiary" },
];

/** 지주 직접 운영 국내 사업장(데이터센터·캠퍼스·R&D 등) */
const domesticSiteRows: GroupEntityRow[] = [
  { name: "상암 데이터센터", scope1: 24800, scope2: 18600, scope3: 6200, total: 49600, prev: 48200, frozen: true, segment: "domestic", segmentLabel: "데이터센터" },
  { name: "수원 데이터센터", scope1: 22400, scope2: 16200, scope3: 5100, total: 43700, prev: 42100, frozen: true, segment: "domestic", segmentLabel: "데이터센터" },
  { name: "춘천 데이터센터", scope1: 38600, scope2: 28400, scope3: 8900, total: 75900, prev: 74200, frozen: true, segment: "domestic", segmentLabel: "데이터센터" },
  { name: "판교 IT 캠퍼스", scope1: 18200, scope2: 22400, scope3: 12800, total: 53400, prev: 52100, frozen: true, segment: "domestic", segmentLabel: "캠퍼스(HQ)" },
  { name: "서울 R&D 캠퍼스", scope1: 6200, scope2: 9800, scope3: 5400, total: 21400, prev: 20800, frozen: false, segment: "domestic", segmentLabel: "R&D" },
  { name: "동탄 데이터센터", scope1: 12400, scope2: 9800, scope3: 3100, total: 25300, prev: 24600, frozen: false, segment: "domestic", segmentLabel: "데이터센터" },
];

const allEntities: GroupEntityRow[] = [...subsidiaryRows, ...domesticSiteRows];

const trendData = [
  { year: "2021", total: 165420, scope1: 12800, scope2: 54300, scope3: 98320 },
  { year: "2022", total: 178350, scope1: 14200, scope2: 58100, scope3: 106050 },
  { year: "2023", total: 188920, scope1: 15400, scope2: 61200, scope3: 112320 },
  { year: "2024", total: 196100, scope1: 17800, scope2: 63200, scope3: 115100 },
  { year: "2025", total: 200330, scope1: 19740, scope2: 63170, scope3: 117420 },
];

export function GroupResults() {
  const [yearRange, setYearRange] = useState("2025");
  const [showFrozenOnly, setShowFrozenOnly] = useState(false);

  const displayed = showFrozenOnly ? allEntities.filter((c) => c.frozen) : allEntities;
  const groupTotal = displayed.reduce((s, c) => s + c.total, 0);
  const groupPrev = displayed.reduce((s, c) => s + c.prev, 0);
  const changeRate = ((groupTotal - groupPrev) / groupPrev * 100).toFixed(1);

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-gray-900">산정 결과 조회 — 그룹 통합</h1>
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full border border-purple-200">지주사 전용</span>
          </div>
          <p className="text-gray-500 text-xs mt-0.5">
            자회사(계열사) 및 국내 사업장(데이터센터·캠퍼스 등) GHG 배출량 통합 집계 및 추세 파악
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
            <input type="checkbox" checked={showFrozenOnly} onChange={e => setShowFrozenOnly(e.target.checked)} className="rounded" />
            <Snowflake size={12} className="text-blue-400" />
            동결 완료 조직만
          </label>
          <div className="relative">
            <select value={yearRange} onChange={e => setYearRange(e.target.value)} className="appearance-none border border-gray-300 rounded-lg pl-3 pr-7 py-2 text-xs bg-white focus:outline-none focus:border-blue-400">
              {["2025", "2024", "2023"].map(y => <option key={y} value={y}>{y}년</option>)}
            </select>
            <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
          <button className="flex items-center gap-1.5 px-3 py-2 text-xs text-gray-600 border border-gray-300 bg-white rounded-lg hover:bg-gray-50 transition-colors">
            <Download size={13} /> Excel/CSV
          </button>
          <button className="flex items-center gap-1.5 px-3 py-2 text-xs text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors">
            <ExternalLink size={13} /> SR 페이지에 삽입
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div className="col-span-1 bg-[#0d1b36] rounded-xl p-4 text-white">
          <div className="text-white/60 text-xs mb-2">그룹 전체 배출량</div>
          <div style={{ fontSize: "28px", fontWeight: 800, lineHeight: 1 }}>{(groupTotal / 1000).toFixed(1)}k</div>
          <div className="text-white/50 text-xs mt-0.5">tCO₂eq ({yearRange}년)</div>
          <div className={`flex items-center gap-1 mt-2 text-xs ${parseFloat(changeRate) > 0 ? "text-red-300" : "text-emerald-300"}`}>
            {parseFloat(changeRate) > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            전년 대비 {parseFloat(changeRate) > 0 ? "+" : ""}{changeRate}%
          </div>
        </div>
        <div className="bg-white border border-red-100 rounded-xl p-4">
          <div className="flex items-center gap-1 text-xs text-gray-500 mb-1.5"><span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span>Scope 1</div>
          <div className="text-gray-900" style={{ fontSize: "22px", fontWeight: 800 }}>{(displayed.reduce((s, c) => s + c.scope1, 0) / 1000).toFixed(1)}k</div>
          <div className="text-gray-400 text-xs">tCO₂eq</div>
        </div>
        <div className="bg-white border border-orange-100 rounded-xl p-4">
          <div className="flex items-center gap-1 text-xs text-gray-500 mb-1.5"><span className="w-2 h-2 rounded-full bg-orange-500 inline-block"></span>Scope 2</div>
          <div className="text-gray-900" style={{ fontSize: "22px", fontWeight: 800 }}>{(displayed.reduce((s, c) => s + c.scope2, 0) / 1000).toFixed(1)}k</div>
          <div className="text-gray-400 text-xs">tCO₂eq</div>
        </div>
        <div className="bg-white border border-purple-100 rounded-xl p-4">
          <div className="flex items-center gap-1 text-xs text-gray-500 mb-1.5"><span className="w-2 h-2 rounded-full bg-purple-500 inline-block"></span>Scope 3</div>
          <div className="text-gray-900" style={{ fontSize: "22px", fontWeight: 800 }}>{(displayed.reduce((s, c) => s + c.scope3, 0) / 1000).toFixed(1)}k</div>
          <div className="text-gray-400 text-xs">tCO₂eq</div>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4">
        <div className="col-span-3 bg-white border border-gray-200 rounded-xl p-4">
          <h3 className="text-gray-800 mb-3" style={{ fontSize: "13px" }}>연도별 그룹 배출량 추이</h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="year" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${(v/1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} formatter={(v: number) => [`${v.toLocaleString()} tCO₂eq`]} />
              <Line type="monotone" dataKey="total" stroke="#0d1b36" strokeWidth={2.5} dot={{ r: 3, fill: "#0d1b36" }} name="전체 합계" />
              <Line type="monotone" dataKey="scope1" stroke="#ef4444" strokeWidth={1.5} dot={false} strokeDasharray="4 2" name="Scope 1" />
              <Line type="monotone" dataKey="scope2" stroke="#f97316" strokeWidth={1.5} dot={false} strokeDasharray="4 2" name="Scope 2" />
              <Line type="monotone" dataKey="scope3" stroke="#8b5cf6" strokeWidth={1.5} dot={false} strokeDasharray="4 2" name="Scope 3" />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="col-span-2 bg-white border border-gray-200 rounded-xl p-4">
          <h3 className="text-gray-800 mb-3" style={{ fontSize: "13px" }}>조직별 동결 현황</h3>
          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
            {allEntities.map((corp) => (
              <div key={`${corp.segment}-${corp.name}`} className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
                <div className="flex items-center gap-2 min-w-0">
                  {corp.frozen ? <Snowflake size={12} className="text-blue-400 shrink-0" /> : <div className="w-3 h-3 rounded-full border-2 border-gray-300 shrink-0"></div>}
                  <div className="min-w-0">
                    <span className="text-[10px] text-gray-400 block leading-tight">
                      {corp.segment === "domestic" ? "국내 사업장" : "자회사"}
                      {corp.segmentLabel ? ` · ${corp.segmentLabel}` : ""}
                    </span>
                    <span className="text-xs text-gray-700">{corp.name}</span>
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full border shrink-0 ${corp.frozen ? "text-blue-600 bg-blue-50 border-blue-200" : "text-yellow-600 bg-yellow-50 border-yellow-200"}`}>
                  {corp.frozen ? "동결완료" : "진행중"}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-2 border-t border-gray-100 text-xs text-gray-400 text-center">
            {allEntities.filter((c) => c.frozen).length} / {allEntities.length} 조직 동결 완료
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="text-gray-800" style={{ fontSize: "13px" }}>자회사·국내 사업장별 배출량 비교</h3>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-[#f8fafc] border-b border-gray-200">
              <th className="px-4 py-2.5 text-left text-gray-500 whitespace-nowrap">구분</th>
              <th className="px-4 py-2.5 text-left text-gray-500 whitespace-nowrap">유형</th>
              <th className="px-4 py-2.5 text-left text-gray-500">명칭</th>
              <th className="px-4 py-2.5 text-right text-gray-500">Scope 1</th>
              <th className="px-4 py-2.5 text-right text-gray-500">Scope 2</th>
              <th className="px-4 py-2.5 text-right text-gray-500">Scope 3</th>
              <th className="px-4 py-2.5 text-right text-gray-500 border-l border-gray-100">총합 (tCO₂eq)</th>
              <th className="px-4 py-2.5 text-right text-gray-500">전년대비</th>
              <th className="px-4 py-2.5 text-center text-gray-500">동결</th>
            </tr>
          </thead>
          <tbody>
            {displayed.map((corp, i) => {
              const chg = ((corp.total - corp.prev) / corp.prev * 100);
              return (
                <tr key={`${corp.segment}-${corp.name}`} className={`border-b border-gray-100 hover:bg-gray-50 ${i % 2 === 1 ? "bg-white" : "bg-[#fafbfc]"}`}>
                  <td className="px-4 py-2.5 text-gray-600 text-xs whitespace-nowrap">{corp.segment === "domestic" ? "국내 사업장" : "자회사"}</td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs whitespace-nowrap">{corp.segment === "subsidiary" ? "—" : corp.segmentLabel ?? "—"}</td>
                  <td className="px-4 py-2.5 text-gray-800" style={{ fontWeight: 500 }}>{corp.name}</td>
                  <td className="px-4 py-2.5 text-right text-gray-600">{corp.scope1.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right text-gray-600">{corp.scope2.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right text-gray-600">{corp.scope3.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right text-gray-900 border-l border-gray-100" style={{ fontWeight: 700 }}>{corp.total.toLocaleString()}</td>
                  <td className={`px-4 py-2.5 text-right text-xs ${chg > 0 ? "text-red-500" : "text-emerald-600"}`}>
                    <div className="flex items-center justify-end gap-0.5">
                      {chg > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                      {chg > 0 ? "+" : ""}{chg.toFixed(1)}%
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    {corp.frozen ? <Snowflake size={14} className="inline text-blue-400" /> : <span className="text-yellow-500 text-xs">진행중</span>}
                  </td>
                </tr>
              );
            })}
            <tr className="bg-[#0d1b36] text-white">
              <td className="px-4 py-3 text-xs" colSpan={3} style={{ fontWeight: 700 }}>그룹 합계 (표시 행 기준)</td>
              <td className="px-4 py-3 text-right text-xs">{displayed.reduce((s, c) => s + c.scope1, 0).toLocaleString()}</td>
              <td className="px-4 py-3 text-right text-xs">{displayed.reduce((s, c) => s + c.scope2, 0).toLocaleString()}</td>
              <td className="px-4 py-3 text-right text-xs">{displayed.reduce((s, c) => s + c.scope3, 0).toLocaleString()}</td>
              <td className="px-4 py-3 text-right border-l border-white/10 text-sm" style={{ fontWeight: 800 }}>{groupTotal.toLocaleString()}</td>
              <td className={`px-4 py-3 text-right text-xs ${parseFloat(changeRate) > 0 ? "text-red-300" : "text-emerald-300"}`}>
                {parseFloat(changeRate) > 0 ? "+" : ""}{changeRate}%
              </td>
              <td className="px-4 py-3 text-center text-xs text-white/60">
                {allEntities.filter((c) => c.frozen).length}/{allEntities.length}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

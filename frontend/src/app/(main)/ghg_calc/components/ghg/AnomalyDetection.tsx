'use client';

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, CheckCircle2, Filter,
  ChevronDown, Search, Edit2, SkipForward, Save,
} from "lucide-react";
import { fetchWithAuthJson, useAuthSessionStore } from "@/store/authSessionStore";

type AnomalyStatus = "unresolved" | "reason_added" | "corrected" | "ignored";

interface Anomaly {
  id: number;
  ruleCode: string;
  facility: string;
  scope: string;
  dataType: string;
  period: string;
  currentValue: number;
  /** 비교 유형 라벨 (전년 동월 / 전월 / 직전 평균 / Z-Score) */
  baselineKind: string;
  /** 기준값 한 줄 요약 */
  baselineAmount: string;
  /** 변동 표시 (%, 배, |Z| 등 규칙에 맞게) */
  changeDisplay: string;
  /** 행 강조(고위험) 여부 */
  alertStrong: boolean;
  unit: string;
  status: AnomalyStatus;
  reason?: string;
  correctedValue?: number;
}

type ScanFinding = {
  rule_code: string;
  severity: "critical" | "high" | "medium" | "low";
  message?: string;
  context?: Record<string, unknown>;
};

type AnomalyScanResponse = {
  company_id: string;
  timeseries_findings: ScanFinding[];
};

const CATEGORY_TO_SCOPE: Record<string, string> = {
  energy: "Scope 2",
  waste: "Scope 3",
  pollution: "Scope 1",
  chemical: "Scope 1",
};

const CATEGORY_LABEL: Record<string, string> = {
  energy: "에너지",
  waste: "폐기물",
  pollution: "오염물질",
  chemical: "약품",
};

const statusInfo: Record<AnomalyStatus, { label: string; color: string; icon: React.ReactNode }> = {
  unresolved: { label: "미처리", color: "text-red-600 bg-red-50 border-red-200", icon: <AlertTriangle size={11} /> },
  reason_added: { label: "사유완료", color: "text-blue-600 bg-blue-50 border-blue-200", icon: <Edit2 size={11} /> },
  corrected: { label: "보정완료", color: "text-emerald-600 bg-emerald-50 border-emerald-200", icon: <CheckCircle2 size={11} /> },
  ignored: { label: "무시처리", color: "text-gray-500 bg-gray-50 border-gray-200", icon: <SkipForward size={11} /> },
};

function mapScanFindingToAnomaly(f: ScanFinding, idx: number): Anomaly {
  const ctx = f.context ?? {};
  const category = String(ctx.category ?? "energy");
  const ymNum = Number(ctx.year_month ?? 0);
  const yearPart = Math.floor(ymNum / 100);
  const monthPart = ymNum % 100;
  const period = ymNum > 0 ? `${yearPart}-${String(monthPart).padStart(2, "0")}` : "-";
  const currentValue = Number(ctx.current ?? 0);
  const unit = String(ctx.unit ?? "-");
  const metric = String(ctx.metric ?? "지표");
  const categoryLabel = CATEGORY_LABEL[category] ?? category;
  const system = String(ctx.system ?? "");
  const rule = f.rule_code;

  let baselineKind = "기준";
  let baselineAmount = "-";
  let changeDisplay = "-";
  let alertStrong = false;

  if (rule === "YOY_PCT") {
    const prev = Number(ctx.prior_year_same_month ?? 0);
    const explicitPct = Number(ctx.change_pct ?? NaN);
    const mag = Number.isFinite(explicitPct)
      ? explicitPct
      : prev > 1e-9
        ? Math.abs(((currentValue - prev) / prev) * 100)
        : 0;
    const signedPct = currentValue >= prev ? mag : -mag;
    baselineKind = "전년 동월";
    baselineAmount = `${prev.toLocaleString()} ${unit}`;
    changeDisplay = `${signedPct >= 0 ? "+" : ""}${signedPct.toFixed(1)}%`;
    alertStrong = mag >= 100;
  } else if (rule === "MOM_RATIO") {
    const prev = Number(ctx.prior_month ?? 0);
    const ratio = prev > 1e-9 ? currentValue / prev : 0;
    baselineKind = "전월";
    baselineAmount = `${prev.toLocaleString()} ${unit}`;
    changeDisplay = `${ratio.toFixed(2)}배`;
    alertStrong = ratio >= 2;
  } else if (rule === "MA12_RATIO") {
    const ma = Number(ctx.ma12 ?? 0);
    const ratio = ma > 1e-9 ? currentValue / ma : 0;
    const pct = ma > 1e-9 ? ((currentValue - ma) / ma) * 100 : 0;
    baselineKind = "직전 평균(≤12M)";
    baselineAmount = `${ma.toLocaleString()} ${unit}`;
    changeDisplay = `${ratio.toFixed(2)}배 (${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%)`;
    alertStrong = ratio >= 2.5 || Math.abs(pct) >= 100;
  } else if (rule === "ZSCORE_12M") {
    const z = Number(ctx.zscore ?? 0);
    const n = Number(ctx.window_n ?? 0);
    baselineKind = "Z-Score";
    baselineAmount = `직전 구간 n=${Number.isFinite(n) ? n : "—"}`;
    changeDisplay = `|Z|=${Number.isFinite(z) ? z.toFixed(2) : "—"}`;
    alertStrong = z >= 3;
  } else {
    baselineKind = rule;
    baselineAmount = "-";
    changeDisplay = f.message?.slice(0, 48) ?? rule;
  }

  const dataType = `${categoryLabel} · ${metric}${system && system !== "all" ? ` (${system.toUpperCase()})` : ""}`;

  return {
    id: idx + 1,
    ruleCode: rule,
    facility: String(ctx.facility ?? "미상"),
    scope: CATEGORY_TO_SCOPE[category] ?? "전체",
    dataType,
    period,
    currentValue,
    baselineKind,
    baselineAmount,
    changeDisplay,
    alertStrong,
    unit,
    status: "unresolved",
  };
}

export function AnomalyDetection() {
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedScope, setSelectedScope] = useState<string>("전체");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [reasonInputs, setReasonInputs] = useState<Record<number, string>>({});
  const [searchKeyword, setSearchKeyword] = useState("");
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:9001";
  const companyId = useAuthSessionStore((s) => s.user?.company_id?.trim() ?? "");

  useEffect(() => {
    const fetchAnomalies = async () => {
      if (!companyId) return;
      setLoading(true);
      setLoadError(null);
      try {
        const res = await fetchWithAuthJson(
          `${apiBase}/ghg-calculation/raw-data/anomaly-latest?company_id=${encodeURIComponent(companyId)}`,
          { method: "GET" },
        );
        if (!res.ok) {
          throw new Error(`이상치 조회 실패 (${res.status})`);
        }
        const payload = (await res.json()) as AnomalyScanResponse;
        const mapped: Anomaly[] = (payload.timeseries_findings ?? []).map((f, idx) =>
          mapScanFindingToAnomaly(f, idx),
        );
        setAnomalies(mapped);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "알 수 없는 오류";
        setLoadError(msg);
        setAnomalies([]);
      } finally {
        setLoading(false);
      }
    };
    void fetchAnomalies();
  }, [apiBase, companyId]);

  const filtered = useMemo(() => anomalies.filter((a) => {
    const matchStatus = selectedStatus === "all" || a.status === selectedStatus;
    const matchScope = selectedScope === "전체" || a.scope === selectedScope;
    const q = searchKeyword.trim().toLowerCase();
    const matchKeyword =
      !q ||
      `${a.facility} ${a.dataType} ${a.period} ${a.baselineKind} ${a.ruleCode}`.toLowerCase().includes(q);
    return matchStatus && matchScope && matchKeyword;
  }), [anomalies, searchKeyword, selectedScope, selectedStatus]);

  const counts = {
    all: anomalies.length,
    unresolved: anomalies.filter(a => a.status === "unresolved").length,
    reason_added: anomalies.filter(a => a.status === "reason_added").length,
    corrected: anomalies.filter(a => a.status === "corrected").length,
    ignored: anomalies.filter(a => a.status === "ignored").length,
  };

  const handleSaveReason = (id: number) => {
    const reason = (reasonInputs[id] ?? "").trim();
    if (!reason) return;
    setAnomalies((prev) =>
      prev.map((a) => (a.id === id ? { ...a, reason, status: "reason_added" } : a))
    );
  };

  const handleMarkCorrected = (id: number) => {
    setAnomalies((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, status: "corrected", correctedValue: a.currentValue } : a
      )
    );
  };

  const handleIgnore = (id: number) => {
    setAnomalies((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: "ignored" } : a))
    );
  };

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-gray-900">이상치 검증</h1>
          <p className="text-gray-500 text-xs mt-0.5">전년비/전월비/이동평균/Z-Score 자동 감지 결과에 대해 사유 입력 또는 보정 처리</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 py-2 text-xs text-white bg-[#0d1b36] rounded-lg hover:bg-[#1a3060] transition-colors">
            <CheckCircle2 size={13} />
            일괄 조치
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <button onClick={() => setSelectedStatus("unresolved")} className={`bg-white border rounded-xl p-3 text-left transition-all ${selectedStatus === "unresolved" ? "border-red-400 shadow-md" : "border-red-200 hover:border-red-300"}`}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-500">미처리</span>
            <AlertTriangle size={14} className="text-red-500" />
          </div>
          <div className="text-red-600" style={{ fontSize: "24px", fontWeight: 800 }}>{counts.unresolved}</div>
          <div className="text-gray-400 text-xs">즉시 처리 필요</div>
        </button>
        <button onClick={() => setSelectedStatus("reason_added")} className={`bg-white border rounded-xl p-3 text-left transition-all ${selectedStatus === "reason_added" ? "border-blue-400 shadow-md" : "border-blue-200 hover:border-blue-300"}`}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-500">사유완료</span>
            <Edit2 size={14} className="text-blue-500" />
          </div>
          <div className="text-blue-600" style={{ fontSize: "24px", fontWeight: 800 }}>{counts.reason_added}</div>
          <div className="text-gray-400 text-xs">사유 입력됨</div>
        </button>
        <button onClick={() => setSelectedStatus("corrected")} className={`bg-white border rounded-xl p-3 text-left transition-all ${selectedStatus === "corrected" ? "border-emerald-400 shadow-md" : "border-emerald-200 hover:border-emerald-300"}`}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-500">보정완료</span>
            <CheckCircle2 size={14} className="text-emerald-500" />
          </div>
          <div className="text-emerald-600" style={{ fontSize: "24px", fontWeight: 800 }}>{counts.corrected}</div>
          <div className="text-gray-400 text-xs">보정값 적용됨</div>
        </button>
        <button onClick={() => setSelectedStatus("ignored")} className={`bg-white border rounded-xl p-3 text-left transition-all ${selectedStatus === "ignored" ? "border-gray-400 shadow-md" : "border-gray-200 hover:border-gray-300"}`}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-500">무시처리</span>
            <SkipForward size={14} className="text-gray-400" />
          </div>
          <div className="text-gray-500" style={{ fontSize: "24px", fontWeight: 800 }}>{counts.ignored}</div>
          <div className="text-gray-400 text-xs">무시됨</div>
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3">
        <Filter size={12} className="text-gray-400" />
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">상태</label>
          <select value={selectedStatus} onChange={e => setSelectedStatus(e.target.value)} className="appearance-none border border-gray-300 rounded-lg pl-3 pr-7 py-1.5 text-xs bg-white focus:outline-none focus:border-blue-400">
            <option value="all">전체 ({counts.all})</option>
            <option value="unresolved">미처리</option>
            <option value="reason_added">사유완료</option>
            <option value="corrected">보정완료</option>
            <option value="ignored">무시처리</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">Scope</label>
          <select value={selectedScope} onChange={e => setSelectedScope(e.target.value)} className="appearance-none border border-gray-300 rounded-lg pl-3 pr-7 py-1.5 text-xs bg-white focus:outline-none focus:border-blue-400">
            {["전체", "Scope 1", "Scope 2", "Scope 3"].map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="flex-1 relative">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            placeholder="시설명 검색..."
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-1.5 text-xs focus:outline-none focus:border-blue-400"
          />
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <span className="text-xs text-gray-700">총 <strong>{filtered.length}</strong>건의 이상치 항목</span>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            탐지 기준: YoY / MoM / MA12 / Z-Score
          </div>
        </div>
        {loading && <div className="px-4 py-3 text-xs text-gray-500">이상치 데이터를 불러오는 중...</div>}
        {loadError && <div className="px-4 py-3 text-xs text-red-500">{loadError}</div>}
        {!loading && !loadError && filtered.length === 0 && (
          <div className="px-4 py-3 text-xs text-gray-500">표시할 이상치 항목이 없습니다.</div>
        )}
        <div className="divide-y divide-gray-100">
          {filtered.map((anomaly) => {
            const si = statusInfo[anomaly.status];
            const isExpanded = expandedId === anomaly.id;
            const isHighAlert = anomaly.alertStrong;
            return (
              <div key={`${anomaly.id}-${anomaly.ruleCode}-${anomaly.period}`} className={isHighAlert && anomaly.status === "unresolved" ? "bg-red-50/30" : ""}>
                <div
                  className="flex items-center px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors gap-3"
                  onClick={() => setExpandedId(isExpanded ? null : anomaly.id)}
                >
                  <div className="flex items-center gap-2 w-48 shrink-0">
                    <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs ${si.color}`}>
                      {si.icon} {si.label}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-800" style={{ fontWeight: 600 }}>{anomaly.facility}</span>
                      <span className="text-xs text-gray-400">·</span>
                      <span className="text-xs text-gray-600">{anomaly.dataType}</span>
                      <span className="text-xs text-violet-700 bg-violet-50 border border-violet-200 px-1.5 py-0.5 rounded">
                        {anomaly.ruleCode}
                      </span>
                      <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{anomaly.scope}</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">{anomaly.period}</div>
                  </div>
                  <div className="text-right shrink-0 w-36">
                    <div className="text-xs text-gray-500">현재값</div>
                    <div className="text-xs text-gray-800" style={{ fontWeight: 600 }}>{anomaly.currentValue.toLocaleString()} {anomaly.unit}</div>
                  </div>
                  <div className="text-right shrink-0 w-40">
                    <div className="text-xs text-gray-500">비교 기준</div>
                    <div className="text-xs text-gray-500">{anomaly.baselineKind}</div>
                    <div className="text-xs text-gray-800" style={{ fontWeight: 600 }}>{anomaly.baselineAmount}</div>
                  </div>
                  <div className={`text-right shrink-0 w-32 text-xs ${isHighAlert && anomaly.status === "unresolved" ? "text-red-600" : "text-orange-600"}`} style={{ fontWeight: 700 }}>
                    <div className="text-xs text-gray-500 font-normal">변동</div>
                    {anomaly.changeDisplay}
                  </div>
                  <ChevronDown size={13} className={`text-gray-400 shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                </div>
                {isExpanded && (
                  <div className="px-4 pb-4 bg-gray-50 border-t border-gray-100">
                    <div className="pt-3 space-y-3">
                      {anomaly.reason && (
                        <div className="bg-white border border-gray-200 rounded-lg p-3">
                          <div className="text-xs text-gray-500 mb-1" style={{ fontWeight: 600 }}>등록된 사유</div>
                          <div className="text-xs text-gray-700">{anomaly.reason}</div>
                        </div>
                      )}
                      {anomaly.correctedValue !== undefined && (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center gap-2">
                          <CheckCircle2 size={13} className="text-emerald-500" />
                          <span className="text-xs text-emerald-700">보정값: <strong>{anomaly.correctedValue.toLocaleString()} {anomaly.unit}</strong></span>
                        </div>
                      )}
                      {anomaly.status === "unresolved" && (
                        <div className="space-y-2">
                          <label className="text-xs text-gray-600" style={{ fontWeight: 600 }}>이상치 사유 입력 <span className="text-red-500">*</span></label>
                          <textarea
                            rows={2}
                            placeholder="이상치 발생 사유를 입력하세요"
                            value={reasonInputs[anomaly.id] ?? ""}
                            onChange={e => setReasonInputs(p => ({ ...p, [anomaly.id]: e.target.value }))}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-blue-400 resize-none"
                          />
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleSaveReason(anomaly.id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                            >
                              <Save size={11} /> 사유 저장
                            </button>
                            <button
                              onClick={() => handleMarkCorrected(anomaly.id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-300 rounded-lg hover:bg-emerald-100 transition-colors"
                            >
                              보정값 입력
                            </button>
                            <button
                              onClick={() => handleIgnore(anomaly.id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                            >
                              <SkipForward size={11} /> 무시 처리
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

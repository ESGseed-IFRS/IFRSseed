'use client';

import { useState } from "react";
import { X, RefreshCw, CheckCircle2, Database, Clock, Building2, AlertCircle } from "lucide-react";

interface Props {
  tabLabel: string;
  onClose: () => void;
  onSync: (year: string, month: string) => Promise<void>;
}

const ifSources = [
  { name: "ERP 시스템", type: "에너지(전력·LNG)", lastSync: "2026-03-06 08:00", records: 14, status: "연결" },
  { name: "MES 시스템", type: "에너지(열·스팀·용수)", lastSync: "2026-03-05 23:00", records: 8, status: "연결" },
  { name: "환경관리시스템", type: "폐기물·오염물질", lastSync: "2026-03-04 17:30", records: 22, status: "연결" },
  { name: "구매관리시스템", type: "약품사용량", lastSync: "2026-03-03 12:00", records: 5, status: "지연" },
];

export function IFSyncModal({ tabLabel: _tabLabel, onClose, onSync }: Props) {
  const [syncing, setSyncing] = useState(false);
  const [syncDone, setSyncDone] = useState(false);
  const [selectedYear, setSelectedYear] = useState("2026");
  const [selectedMonth, setSelectedMonth] = useState("03");
  const [progress, setProgress] = useState(0);

  const selectedMonthLabel = selectedMonth === "all" ? "전체" : `${selectedMonth}월`;

  const handleSync = async () => {
    setSyncing(true);
    setProgress(0);
    try {
      setProgress(30);
      await onSync(selectedYear, selectedMonth);
      setProgress(100);
      setSyncDone(true);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Database size={18} className="text-blue-600" />
            <h2 className="text-gray-900" style={{ fontSize: "15px" }}>I/F 연동 데이터 조회</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Filter */}
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="text-xs text-gray-500 mb-1 block">조회 연도</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-700 bg-white focus:outline-none focus:border-blue-400"
              >
                {["2026", "2025", "2024"].map((y) => (
                  <option key={y} value={y}>{y}년</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-500 mb-1 block">조회 월</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-700 bg-white focus:outline-none focus:border-blue-400"
              >
                <option value="all">전체</option>
                {["01","02","03","04","05","06","07","08","09","10","11","12"].map((m) => (
                  <option key={m} value={m}>{m}월</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-500 mb-1 block">법인</label>
              <div className="border border-gray-300 rounded-lg px-3 py-2 text-xs text-gray-700 bg-gray-50">
                미라콤
              </div>
            </div>
          </div>

          {/* I/F Sources */}
          <div>
            <div className="text-xs text-gray-600 mb-2" style={{ fontWeight: 600 }}>연동 시스템 현황</div>
            <div className="space-y-2">
              {ifSources.map((src) => (
                <div key={src.name} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg bg-gray-50">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${src.status === "연결" ? "bg-emerald-400" : "bg-yellow-400"}`}></div>
                    <div>
                      <div className="text-xs text-gray-800" style={{ fontWeight: 600 }}>{src.name}</div>
                      <div className="text-gray-400" style={{ fontSize: "10px" }}>{src.type}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-500 flex items-center gap-1 justify-end">
                      <Clock size={10} />
                      {src.lastSync}
                    </div>
                    <div className="text-gray-400 flex items-center gap-1 justify-end" style={{ fontSize: "10px" }}>
                      <Building2 size={10} />
                      {src.records}건
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Progress */}
          {syncing && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs text-blue-700 flex items-center gap-1.5">
                  <RefreshCw size={12} className="animate-spin" />
                  데이터 동기화 중...
                </div>
                <span className="text-xs text-blue-600" style={{ fontWeight: 600 }}>{progress}%</span>
              </div>
              <div className="bg-blue-200 rounded-full h-1.5">
                <div
                  className="bg-blue-500 rounded-full h-1.5 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>
          )}

          {syncDone && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-center gap-3">
              <CheckCircle2 size={20} className="text-emerald-500 shrink-0" />
              <div>
                <div className="text-xs text-emerald-700" style={{ fontWeight: 600 }}>동기화 완료</div>
                <div className="text-emerald-600 text-xs">총 49건 데이터가 갱신되었습니다. ({selectedYear}년 {selectedMonthLabel})</div>
              </div>
            </div>
          )}

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle size={13} className="text-yellow-500 mt-0.5 shrink-0" />
            <div className="text-xs text-yellow-700">
              I/F 연동 데이터는 각 시스템의 확정 데이터를 기준으로 조회됩니다.
              연동 오류 발생 시 시스템 관리자에게 문의해주세요.
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onClose} className="px-4 py-2 text-xs text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              닫기
            </button>
            <button
              onClick={handleSync}
              disabled={syncing || syncDone}
              className="flex items-center gap-2 px-4 py-2 text-xs text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <RefreshCw size={13} className={syncing ? "animate-spin" : ""} />
              {syncDone ? "동기화 완료" : syncing ? "동기화 중..." : "데이터 동기화"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState, useRef } from "react";
import { X, Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Download, ChevronRight } from "lucide-react";

interface Props {
  tabLabel: string;
  onClose: () => void;
}

type UploadStep = "upload" | "preview" | "result";

const mockPreviewRows = [
  { row: 2, facility: "생산동A", type: "전력", unit: "kWh", jan: "892,100", feb: "875,320", mar: "901,450", status: "정상" },
  { row: 3, facility: "생산동B", type: "전력", unit: "kWh", jan: "654,780", feb: "641,200", mar: "668,900", status: "정상" },
  { row: 4, facility: "본관동", type: "LNG", unit: "Nm³", jan: "12,450", feb: "13,200", mar: "11,800", status: "정상" },
  { row: 5, facility: "유틸리티동", type: "용수", unit: "m³", jan: "8,920", feb: "9,100", mar: "", status: "오류" },
  { row: 6, facility: "연구동", type: "순수", unit: "m³", jan: "1,230", feb: "1,180", mar: "1,310", status: "정상" },
];

export function ExcelUploadModal({ tabLabel, onClose }: Props) {
  const [step, setStep] = useState<UploadStep>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped && (dropped.name.endsWith(".xlsx") || dropped.name.endsWith(".xls"))) {
      setFile(dropped);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  };

  const handleNext = () => {
    if (!file) return;
    setIsUploading(true);
    setTimeout(() => {
      setIsUploading(false);
      setStep("preview");
    }, 1200);
  };

  const handleConfirm = () => {
    setStep("result");
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <FileSpreadsheet size={18} className="text-emerald-600" />
            <h2 className="text-gray-900" style={{ fontSize: "15px" }}>엑셀 업로드 — {tabLabel}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-2 px-6 py-3 bg-gray-50 border-b border-gray-200">
          {(["upload", "preview", "result"] as UploadStep[]).map((s, i) => {
            const labels = ["파일 선택", "데이터 검토", "업로드 완료"];
            const active = s === step;
            const done = ["upload", "preview", "result"].indexOf(step) > i;
            return (
              <div key={s} className="flex items-center gap-2">
                <div className={`flex items-center gap-1.5 text-xs ${active ? "text-blue-600" : done ? "text-emerald-600" : "text-gray-400"}`}>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-white ${active ? "bg-blue-500" : done ? "bg-emerald-500" : "bg-gray-300"}`} style={{ fontSize: "10px" }}>
                    {done ? "✓" : i + 1}
                  </div>
                  {labels[i]}
                </div>
                {i < 2 && <ChevronRight size={12} className="text-gray-300" />}
              </div>
            );
          })}
        </div>

        {/* Content */}
        <div className="p-6">
          {step === "upload" && (
            <div className="space-y-4">
              {/* Template Download */}
              <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2 text-xs text-blue-700">
                  <FileSpreadsheet size={14} />
                  <span>업로드 전 반드시 <strong>양식 파일</strong>을 다운로드하여 작성해주세요.</span>
                </div>
                <button className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 border border-blue-300 bg-white rounded-lg px-3 py-1.5 transition-colors">
                  <Download size={12} />
                  양식 다운로드
                </button>
              </div>

              {/* Drop Zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                  isDragging ? "border-blue-400 bg-blue-50" : file ? "border-emerald-400 bg-emerald-50" : "border-gray-300 hover:border-gray-400 hover:bg-gray-50"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={handleFileChange}
                />
                {file ? (
                  <div className="space-y-2">
                    <FileSpreadsheet size={36} className="mx-auto text-emerald-500" />
                    <div className="text-emerald-700 text-sm" style={{ fontWeight: 600 }}>{file.name}</div>
                    <div className="text-gray-400 text-xs">{(file.size / 1024).toFixed(1)} KB · 클릭하여 다른 파일 선택</div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Upload size={36} className="mx-auto text-gray-300" />
                    <div className="text-gray-600 text-sm">파일을 드래그하거나 클릭하여 선택</div>
                    <div className="text-gray-400 text-xs">xlsx, xls 파일만 지원 · 최대 10MB</div>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <div className="text-xs text-gray-500 flex items-start gap-1.5">
                  <AlertCircle size={12} className="text-yellow-500 mt-0.5 shrink-0" />
                  계열사별 본인 법인 데이터만 입력하여 주십시오.
                </div>
                <div className="text-xs text-gray-500 flex items-start gap-1.5">
                  <AlertCircle size={12} className="text-yellow-500 mt-0.5 shrink-0" />
                  기존 저장된 데이터와 중복될 경우 덮어쓰기됩니다.
                </div>
                <div className="text-xs text-gray-500 flex items-start gap-1.5">
                  <AlertCircle size={12} className="text-yellow-500 mt-0.5 shrink-0" />
                  폐기물·오염·약품 등 월별 Raw는 해당 연도 1~12월 컬럼이 포함된 양식을 사용해 주세요.
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button onClick={onClose} className="px-4 py-2 text-xs text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                  취소
                </button>
                <button
                  onClick={handleNext}
                  disabled={!file || isUploading}
                  className="px-4 py-2 text-xs text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {isUploading ? (
                    <>
                      <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      분석 중...
                    </>
                  ) : "다음 단계"}
                </button>
              </div>
            </div>
          )}

          {step === "preview" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-xs text-gray-600">
                  총 <strong>{mockPreviewRows.length}건</strong> 데이터 감지 ·{" "}
                  <span className="text-emerald-600">정상 {mockPreviewRows.filter(r => r.status === "정상").length}건</span>,{" "}
                  <span className="text-red-500">오류 {mockPreviewRows.filter(r => r.status === "오류").length}건</span>
                </div>
              </div>

              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-2 text-left text-gray-500">행</th>
                      <th className="px-3 py-2 text-left text-gray-500">시설명</th>
                      <th className="px-3 py-2 text-left text-gray-500">에너지유형</th>
                      <th className="px-3 py-2 text-left text-gray-500">단위</th>
                      <th className="px-3 py-2 text-right text-gray-500">1월</th>
                      <th className="px-3 py-2 text-right text-gray-500">2월</th>
                      <th className="px-3 py-2 text-right text-gray-500">3월</th>
                      <th className="px-3 py-2 text-center text-gray-500">상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mockPreviewRows.map((row) => (
                      <tr key={row.row} className={`border-b border-gray-100 last:border-0 ${row.status === "오류" ? "bg-red-50" : ""}`}>
                        <td className="px-3 py-2 text-gray-400">{row.row}</td>
                        <td className="px-3 py-2 text-gray-700">{row.facility}</td>
                        <td className="px-3 py-2 text-gray-700">{row.type}</td>
                        <td className="px-3 py-2 text-gray-500">{row.unit}</td>
                        <td className="px-3 py-2 text-right text-gray-700">{row.jan}</td>
                        <td className="px-3 py-2 text-right text-gray-700">{row.feb}</td>
                        <td className={`px-3 py-2 text-right ${row.mar ? "text-gray-700" : "text-red-400"}`}>{row.mar || "누락"}</td>
                        <td className="px-3 py-2 text-center">
                          {row.status === "정상" ? (
                            <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">정상</span>
                          ) : (
                            <span className="text-red-500 bg-red-50 px-2 py-0.5 rounded-full">오류</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-700 flex items-start gap-2">
                <AlertCircle size={13} className="mt-0.5 shrink-0 text-yellow-500" />
                <span>오류 건은 업로드에서 제외됩니다. 정상 건(4건)만 저장됩니다. 오류 건은 양식 파일을 수정 후 재업로드해주세요.</span>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setStep("upload")} className="px-4 py-2 text-xs text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                  이전
                </button>
                <button onClick={handleConfirm} className="px-4 py-2 text-xs text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors">
                  확인 업로드
                </button>
              </div>
            </div>
          )}

          {step === "result" && (
            <div className="space-y-4 text-center py-4">
              <CheckCircle2 size={48} className="mx-auto text-emerald-500" />
              <div>
                <div className="text-gray-900 text-base" style={{ fontWeight: 600 }}>업로드 완료</div>
                <div className="text-gray-500 text-xs mt-1">{file?.name} · {new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</div>
              </div>
              <div className="flex items-center justify-center gap-4 text-sm">
                <div className="text-center">
                  <div className="text-emerald-600" style={{ fontWeight: 700, fontSize: "22px" }}>4</div>
                  <div className="text-gray-400 text-xs">업로드 성공</div>
                </div>
                <div className="text-center">
                  <div className="text-red-500" style={{ fontWeight: 700, fontSize: "22px" }}>1</div>
                  <div className="text-gray-400 text-xs">오류 제외</div>
                </div>
              </div>
              <div className="flex justify-center gap-2 pt-2">
                <button onClick={onClose} className="px-5 py-2 text-xs text-white bg-gray-800 rounded-lg hover:bg-gray-900 transition-colors">
                  닫기
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

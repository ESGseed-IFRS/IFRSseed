'use client';

import { useState, useRef, useEffect } from "react";
import { X, Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Download, ChevronRight } from "lucide-react";
import type { RawDataCategory } from "../../types/ghg";
import { downloadRawDataCsvTemplate } from "../../lib/rawDataCsvTemplates";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

interface Props {
  tabLabel: string;
  /** 현재 Raw Data 탭 — 양식 다운로드 파일명·컬럼 예시에만 사용 */
  rawCategory: RawDataCategory;
  onClose: () => void;
  /** 예: process.env.NEXT_PUBLIC_API_BASE — `/data-integration/staging/upload-csv` 호출에 사용 */
  apiBase: string;
  companyId: string;
}

type UploadStep = "upload" | "preview" | "result";

const mockPreviewRows = [
  { row: 2, facility: "생산동A", type: "전력", unit: "kWh", jan: "892,100", feb: "875,320", mar: "901,450", status: "정상" },
  { row: 3, facility: "생산동B", type: "전력", unit: "kWh", jan: "654,780", feb: "641,200", mar: "668,900", status: "정상" },
  { row: 4, facility: "본관동", type: "LNG", unit: "Nm³", jan: "12,450", feb: "13,200", mar: "11,800", status: "정상" },
  { row: 5, facility: "유틸리티동", type: "용수", unit: "m³", jan: "8,920", feb: "9,100", mar: "", status: "오류" },
  { row: 6, facility: "연구동", type: "순수", unit: "m³", jan: "1,230", feb: "1,180", mar: "1,310", status: "정상" },
];

function isCsvFile(f: File): boolean {
  return f.name.toLowerCase().endsWith(".csv");
}

function isExcelFile(f: File): boolean {
  const n = f.name.toLowerCase();
  return n.endsWith(".xlsx") || n.endsWith(".xls");
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQ = !inQ;
      continue;
    }
    if (!inQ && c === ",") {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += c;
  }
  out.push(cur.trim());
  return out;
}

function parseCsvForPreview(text: string, maxDataRows: number): { headers: string[]; rows: string[][]; totalDataRows: number } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return { headers: lines.length ? parseCsvLine(lines[0]) : [], rows: [], totalDataRows: 0 };
  }
  const headers = parseCsvLine(lines[0]);
  const dataLines = lines.slice(1);
  const totalDataRows = dataLines.length;
  const rows = dataLines.slice(0, maxDataRows).map((ln) => parseCsvLine(ln));
  return { headers, rows, totalDataRows };
}

function headersIncludeSourceSystem(headers: string[]): boolean {
  return headers.some((h) => h.trim().toLowerCase().replace(/\s+/g, "_") === "source_system");
}

type CsvPreview = {
  headers: string[];
  rows: string[][];
  totalDataRows: number;
};

function apiErrorMessage(data: unknown): string {
  if (data && typeof data === "object" && "detail" in data) {
    const d = (data as { detail: unknown }).detail;
    if (typeof d === "string") return d;
    if (Array.isArray(d)) return d.map((x) => (typeof x === "object" && x && "msg" in x ? String((x as { msg: unknown }).msg) : String(x))).join(", ");
  }
  return "업로드 실패";
}

export function ExcelUploadModal({ tabLabel, rawCategory, onClose, apiBase, companyId }: Props) {
  const [step, setStep] = useState<UploadStep>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [csvPreview, setCsvPreview] = useState<CsvPreview | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [csvResult, setCsvResult] = useState<{
    totalRows: number;
    batchCount: number;
    ingestLabel: string;
    ghgRawCategory: string | null;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCsvPreview(null);
    setUploadError(null);
    setCsvResult(null);
    setStep("upload");
  }, [file]);

  const pickFile = (f: File | undefined) => {
    if (!f) return;
    if (isCsvFile(f) || isExcelFile(f)) {
      setFile(f);
      return;
    }
    window.alert("xlsx, xls 또는 csv 파일만 선택할 수 있습니다.");
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    pickFile(e.dataTransfer.files[0]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    pickFile(e.target.files?.[0]);
  };

  const handleNext = async () => {
    if (!file) return;
    setUploadError(null);
    if (file.size > MAX_UPLOAD_BYTES) {
      window.alert("파일은 10MB 이하여야 합니다.");
      return;
    }
    if (isCsvFile(file)) {
      setIsUploading(true);
      try {
        const text = await file.text();
        const prev = parseCsvForPreview(text, 8);
        if (!headersIncludeSourceSystem(prev.headers)) {
          window.alert("CSV에 source_system 열이 필요합니다 (예: EMS, ERP, MDG).");
          return;
        }
        if (prev.totalDataRows === 0) {
          window.alert("데이터 행이 없습니다.");
          return;
        }
        setCsvPreview(prev);
        setStep("preview");
      } finally {
        setIsUploading(false);
      }
      return;
    }
    if (isExcelFile(file)) {
      setIsUploading(true);
      setCsvPreview(null);
      window.setTimeout(() => {
        setIsUploading(false);
        setStep("preview");
      }, 1200);
      return;
    }
  };

  const handleConfirm = async () => {
    if (!file) return;
    setUploadError(null);
    if (isCsvFile(file)) {
      if (!companyId.trim()) {
        window.alert("회사 ID가 없습니다. 로그인 후 다시 시도해 주세요.");
        return;
      }
      setIsSaving(true);
      try {
        const fd = new FormData();
        fd.append("company_id", companyId);
        fd.append("file", file);
        const res = await fetch(`${apiBase.replace(/\/$/, "")}/data-integration/staging/upload-csv`, {
          method: "POST",
          body: fd,
          credentials: "include",
        });
        const data: unknown = await res.json().catch(() => ({}));
        if (!res.ok) {
          setUploadError(apiErrorMessage(data));
          return;
        }
        const payload = data as {
          inserts?: { item_count: number }[];
          ingest_source_label?: string;
          ghg_raw_category?: string | null;
        };
        const inserts = payload.inserts ?? [];
        const totalRows = inserts.reduce((a, b) => a + b.item_count, 0);
        setCsvResult({
          totalRows,
          batchCount: inserts.length,
          ingestLabel: payload.ingest_source_label ?? "파일 업로드",
          ghgRawCategory: payload.ghg_raw_category ?? null,
        });
        setStep("result");
      } catch {
        setUploadError("네트워크 오류가 발생했습니다.");
      } finally {
        setIsSaving(false);
      }
      return;
    }
    setStep("result");
  };

  const isCsv = file ? isCsvFile(file) : false;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <div className="flex items-center gap-2">
            <FileSpreadsheet size={18} className="text-emerald-600" />
            <h2 className="text-gray-900" style={{ fontSize: "15px" }}>파일 업로드 — {tabLabel}</h2>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        <div className="flex items-center gap-2 px-6 py-3 bg-gray-50 border-b border-gray-200 shrink-0">
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

        <div className="p-6 overflow-y-auto flex-1 min-h-0">
          {step === "upload" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center gap-2 text-xs text-blue-700 min-w-0">
                  <FileSpreadsheet size={14} className="shrink-0" />
                  <span>
                    DB 저장은 <strong>CSV</strong>만 지원합니다. <strong>source_system</strong> 열이 필요합니다. <strong>ghg_raw_category</strong>는 양식에 없으며, 서버가 컬럼·파일명으로 판별합니다(필요 시 열을 직접 추가해 명시할 수 있음).
                    양식 예시: <strong>{tabLabel}</strong> (<code className="text-[10px] bg-white/80 px-1 rounded">{rawCategory}</code>).
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => downloadRawDataCsvTemplate(rawCategory)}
                  className="shrink-0 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 border border-blue-300 bg-white rounded-lg px-3 py-1.5 transition-colors"
                >
                  <Download size={12} />
                  양식 다운로드
                </button>
              </div>

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
                  accept=".xlsx,.xls,.csv"
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
                    <div className="text-gray-400 text-xs">csv(스테이징 저장) · xlsx/xls(검토만) · 최대 10MB</div>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <div className="text-xs text-gray-500 flex items-start gap-1.5">
                  <AlertCircle size={12} className="text-yellow-500 mt-0.5 shrink-0" />
                  CSV 적재 시 ingest_source는 DB에 <code className="text-[11px] bg-gray-100 px-1 rounded">file_upload</code>로 저장됩니다(표시: 파일 업로드).
                </div>
                <div className="text-xs text-gray-500 flex items-start gap-1.5">
                  <AlertCircle size={12} className="text-yellow-500 mt-0.5 shrink-0" />
                  기존 저장된 데이터와 중복될 경우 덮어쓰기됩니다.
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={onClose} className="px-4 py-2 text-xs text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                  취소
                </button>
                <button
                  type="button"
                  onClick={() => void handleNext()}
                  disabled={!file || isUploading}
                  className="px-4 py-2 text-xs text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {isUploading ? (
                    <>
                      <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      분석 중...
                    </>
                  ) : "다음 단계"}
                </button>
              </div>
            </div>
          )}

          {step === "preview" && (
            <div className="space-y-4">
              {uploadError && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{uploadError}</div>
              )}
              {isCsv && csvPreview ? (
                <>
                  <div className="text-xs text-gray-600">
                    총 <strong>{csvPreview.totalDataRows}행</strong> · 미리보기 최대 8행 · <span className="text-emerald-600">source_system 검증 통과</span>
                  </div>
                  <div className="border border-gray-200 rounded-lg overflow-x-auto max-h-64 overflow-y-auto">
                    <table className="w-full text-xs min-w-[480px]">
                      <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                        <tr>
                          <th className="px-2 py-2 text-left text-gray-500 whitespace-nowrap">#</th>
                          {csvPreview.headers.map((h) => (
                            <th key={h} className="px-2 py-2 text-left text-gray-500 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {csvPreview.rows.map((cells, ri) => (
                          <tr key={ri} className="border-b border-gray-100 last:border-0">
                            <td className="px-2 py-2 text-gray-400">{ri + 2}</td>
                            {csvPreview.headers.map((_, ci) => (
                              <td key={ci} className="px-2 py-2 text-gray-700 max-w-[140px] truncate" title={cells[ci] ?? ""}>{cells[ci] ?? ""}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
                    확인 시 시스템별로 staging_ems_data 등에 저장되며, ghg_raw_category는 CSV에 열이 있으면 그 값(전 행 동일), 없으면 헤더·파일명으로 추정하고 ingest_source는 file_upload입니다.
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-gray-600">
                      총 <strong>{mockPreviewRows.length}건</strong> 데이터 감지 ·{" "}
                      <span className="text-emerald-600">정상 {mockPreviewRows.filter(r => r.status === "정상").length}건</span>,{" "}
                      <span className="text-red-500">오류 {mockPreviewRows.filter(r => r.status === "오류").length}건</span>
                      <span className="block mt-1 text-gray-400">엑셀은 데모 미리보기이며 서버 저장은 CSV만 지원합니다.</span>
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
                    <span>엑셀은 시연용입니다. 실제 DB 적재는 CSV를 업로드하세요.</span>
                  </div>
                </>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setStep("upload")} className="px-4 py-2 text-xs text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                  이전
                </button>
                <button
                  type="button"
                  onClick={() => void handleConfirm()}
                  disabled={isSaving}
                  className="px-4 py-2 text-xs text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      저장 중...
                    </>
                  ) : isCsv ? "확인 후 서버 저장" : "확인(데모)"}
                </button>
              </div>
            </div>
          )}

          {step === "result" && (
            <div className="space-y-4 text-center py-4">
              <CheckCircle2 size={48} className="mx-auto text-emerald-500" />
              <div>
                <div className="text-gray-900 text-base" style={{ fontWeight: 600 }}>{isCsv && csvResult ? "서버 저장 완료" : "업로드 완료"}</div>
                <div className="text-gray-500 text-xs mt-1">{file?.name} · {new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</div>
                {isCsv && csvResult && (
                  <div className="text-gray-500 text-xs mt-1 space-y-0.5">
                    <div>유입 구분: {csvResult.ingestLabel} (DB: file_upload)</div>
                    {csvResult.ghgRawCategory ? (
                      <div>ghg_raw_category: <code className="text-[11px] bg-gray-100 px-1 rounded">{csvResult.ghgRawCategory}</code></div>
                    ) : null}
                  </div>
                )}
              </div>
              <div className="flex items-center justify-center gap-4 text-sm">
                {isCsv && csvResult ? (
                  <>
                    <div className="text-center">
                      <div className="text-emerald-600" style={{ fontWeight: 700, fontSize: "22px" }}>{csvResult.totalRows}</div>
                      <div className="text-gray-400 text-xs">저장된 행 수</div>
                    </div>
                    <div className="text-center">
                      <div className="text-blue-600" style={{ fontWeight: 700, fontSize: "22px" }}>{csvResult.batchCount}</div>
                      <div className="text-gray-400 text-xs">스테이징 INSERT 건수</div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-center">
                      <div className="text-emerald-600" style={{ fontWeight: 700, fontSize: "22px" }}>4</div>
                      <div className="text-gray-400 text-xs">업로드 성공</div>
                    </div>
                    <div className="text-center">
                      <div className="text-red-500" style={{ fontWeight: 700, fontSize: "22px" }}>1</div>
                      <div className="text-gray-400 text-xs">오류 제외</div>
                    </div>
                  </>
                )}
              </div>
              <div className="flex justify-center gap-2 pt-2">
                <button type="button" onClick={onClose} className="px-5 py-2 text-xs text-white bg-gray-800 rounded-lg hover:bg-gray-900 transition-colors">
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

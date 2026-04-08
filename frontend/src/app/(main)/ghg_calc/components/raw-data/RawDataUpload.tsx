'use client';

import { useState } from "react";
import {
  Upload, RefreshCw, Plus, Search, Download, Save,
  CheckCircle2, AlertCircle, Clock, Info, ChevronDown,
  Edit2, Trash, Filter, Database
} from "lucide-react";
import {
  energyData, wasteData, pollutionData, chemicalData,
  energyProviderData, consignmentData, FACILITIES, YEARS,
} from "../../lib/mockData";
import { PERIOD_TYPES, ENERGY_SUB_TYPES, POLLUTANT_SUB_TYPES, MONTHS } from "../../lib/constants";
import type { PeriodType } from "../../lib/constants";
import type {
  EnergyData,
  WasteData,
  PollutionData,
  ChemicalData,
  EnergyProviderData,
  ConsignmentData,
  RawDataCategory,
} from "../../types/ghg";
import { ExcelUploadModal } from "./ExcelUploadModal";
import { IFSyncModal } from "./IFSyncModal";
import { fetchWithAuthJson, useAuthSessionStore } from "@/store/authSessionStore";

const CATEGORY_LABELS: Record<RawDataCategory, string> = {
  energy: "에너지 사용량",
  waste: "폐기물 반출량",
  pollution: "오염물질 배출량",
  chemical: "약품사용량",
  "energy-provider": "에너지조달업체",
  consignment: "위탁처리업체",
};

const RAW_TABLE_MONTH_LABELS = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"] as const;

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    confirmed: "text-emerald-600 bg-emerald-50 border-emerald-200",
    draft: "text-yellow-600 bg-yellow-50 border-yellow-200",
    error: "text-red-600 bg-red-50 border-red-200",
    normal: "text-emerald-600 bg-emerald-50 border-emerald-200",
    warning: "text-yellow-600 bg-yellow-50 border-yellow-200",
    exceed: "text-red-600 bg-red-50 border-red-200",
    active: "text-emerald-600 bg-emerald-50 border-emerald-200",
    expired: "text-gray-500 bg-gray-50 border-gray-200",
    pending: "text-blue-600 bg-blue-50 border-blue-200",
  };
  const label: Record<string, string> = {
    confirmed: "확정", draft: "임시저장", error: "오류",
    normal: "정상", warning: "주의", exceed: "초과",
    active: "유효", expired: "만료", pending: "검토중",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full border text-xs ${map[status] ?? "text-gray-500 bg-gray-50 border-gray-200"}`}>
      {label[status] ?? status}
    </span>
  );
}

function SourceBadge({ source }: { source: "manual" | "if" }) {
  return source === "if" ? (
    <span className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
      <Database size={10} /> I/F
    </span>
  ) : (
    <span className="flex items-center gap-1 text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-200">
      <Edit2 size={10} /> 직접입력
    </span>
  );
}

function EnergyTable({ data }: { data: EnergyData[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs min-w-[900px]">
        <thead>
          <tr className="bg-[#f8fafc] border-b-2 border-gray-200">
            <th className="px-3 py-2.5 text-left text-gray-600 whitespace-nowrap">시설명</th>
            <th className="px-3 py-2.5 text-left text-gray-600 whitespace-nowrap">에너지유형</th>
            <th className="px-3 py-2.5 text-left text-gray-600 whitespace-nowrap">단위</th>
            {RAW_TABLE_MONTH_LABELS.map((m) => (
              <th key={m} className="px-2 py-2.5 text-right text-gray-600 whitespace-nowrap">{m}</th>
            ))}
            <th className="px-3 py-2.5 text-right text-gray-600 whitespace-nowrap">합계</th>
            <th className="px-3 py-2.5 text-center text-gray-600">입력방식</th>
            <th className="px-3 py-2.5 text-center text-gray-600">상태</th>
            <th className="px-3 py-2.5 text-center text-gray-600">관리</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={row.id} className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${i % 2 === 1 ? "bg-white" : "bg-[#fafbfc]"}`}>
              <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap" style={{ fontWeight: 500 }}>{row.facility}</td>
              <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{row.energyType}</td>
              <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{row.unit}</td>
              {[row.jan,row.feb,row.mar,row.apr,row.may,row.jun,row.jul,row.aug,row.sep,row.oct,row.nov,row.dec].map((val, mi) => (
                <td key={mi} className={`px-2 py-2.5 text-right whitespace-nowrap ${val ? "text-gray-700" : "text-gray-300"}`}>
                  {val || "—"}
                </td>
              ))}
              <td className="px-3 py-2.5 text-right text-gray-800 whitespace-nowrap" style={{ fontWeight: 600 }}>{row.total}</td>
              <td className="px-3 py-2.5 text-center"><SourceBadge source={row.source} /></td>
              <td className="px-3 py-2.5 text-center"><StatusBadge status={row.status} /></td>
              <td className="px-3 py-2.5 text-center">
                <div className="flex items-center justify-center gap-1">
                  <button className="p-1 rounded hover:bg-blue-100 text-gray-400 hover:text-blue-600 transition-colors"><Edit2 size={12} /></button>
                  <button className="p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-500 transition-colors"><Trash size={12} /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const WASTE_MONTH_KEYS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"] as const;

function WasteTable({ data }: { data: WasteData[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs min-w-[1100px]">
        <thead>
          <tr className="bg-[#f8fafc] border-b-2 border-gray-200">
            <th className="px-3 py-2.5 text-left text-gray-600 whitespace-nowrap">시설명</th>
            <th className="px-3 py-2.5 text-left text-gray-600 whitespace-nowrap">폐기물 종류</th>
            <th className="px-3 py-2.5 text-left text-gray-600 whitespace-nowrap">처리방법</th>
            <th className="px-3 py-2.5 text-left text-gray-600 whitespace-nowrap">단위</th>
            {RAW_TABLE_MONTH_LABELS.map((m) => (
              <th key={m} className="px-2 py-2.5 text-right text-gray-600 whitespace-nowrap">{m}</th>
            ))}
            <th className="px-3 py-2.5 text-right text-gray-600 whitespace-nowrap">합계</th>
            <th className="px-3 py-2.5 text-left text-gray-600 whitespace-nowrap">위탁업체</th>
            <th className="px-3 py-2.5 text-center text-gray-600 whitespace-nowrap">상태</th>
            <th className="px-3 py-2.5 text-center text-gray-600 whitespace-nowrap">관리</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={row.id} className={`border-b border-gray-100 hover:bg-gray-50 ${i % 2 === 1 ? "bg-white" : "bg-[#fafbfc]"}`}>
              <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap" style={{ fontWeight: 500 }}>{row.facility}</td>
              <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{row.wasteType}</td>
              <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{row.disposalMethod}</td>
              <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{row.unit}</td>
              {WASTE_MONTH_KEYS.map((k) => (
                <td key={k} className="px-2 py-2.5 text-right whitespace-nowrap text-gray-700">{row[k]}</td>
              ))}
              <td className="px-3 py-2.5 text-right text-gray-800 whitespace-nowrap" style={{ fontWeight: 600 }}>{row.total}</td>
              <td className="px-3 py-2.5 text-gray-500 text-xs whitespace-nowrap">{row.vendor}</td>
              <td className="px-3 py-2.5 text-center"><StatusBadge status={row.status} /></td>
              <td className="px-3 py-2.5 text-center">
                <div className="flex items-center justify-center gap-1">
                  <button className="p-1 rounded hover:bg-blue-100 text-gray-400 hover:text-blue-600"><Edit2 size={12} /></button>
                  <button className="p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-500"><Trash size={12} /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const POLLUTION_MONTH_KEYS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"] as const;

function PollutionTable({ data }: { data: PollutionData[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs min-w-[1180px]">
        <thead>
          <tr className="bg-[#f8fafc] border-b-2 border-gray-200">
            <th className="px-3 py-2.5 text-left text-gray-600 whitespace-nowrap">시설명</th>
            <th className="px-3 py-2.5 text-left text-gray-600 whitespace-nowrap">배출구명</th>
            <th className="px-3 py-2.5 text-left text-gray-600 whitespace-nowrap">오염물질</th>
            <th className="px-3 py-2.5 text-left text-gray-600 whitespace-nowrap">단위</th>
            {RAW_TABLE_MONTH_LABELS.map((m) => (
              <th key={m} className="px-2 py-2.5 text-right text-gray-600 whitespace-nowrap">{m}</th>
            ))}
            <th className="px-3 py-2.5 text-right text-gray-600 whitespace-nowrap" title="해당 연도 12개월 산술평균">평균</th>
            <th className="px-3 py-2.5 text-right text-gray-600 whitespace-nowrap">법적기준</th>
            <th className="px-3 py-2.5 text-center text-gray-600 whitespace-nowrap">상태</th>
            <th className="px-3 py-2.5 text-center text-gray-600 whitespace-nowrap">관리</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={row.id} className={`border-b border-gray-100 hover:bg-gray-50 ${row.status === "exceed" ? "bg-red-50" : row.status === "warning" ? "bg-yellow-50" : i % 2 === 1 ? "bg-white" : "bg-[#fafbfc]"}`}>
              <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap" style={{ fontWeight: 500 }}>{row.facility}</td>
              <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{row.outletName}</td>
              <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap">{row.pollutant}</td>
              <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{row.unit}</td>
              {POLLUTION_MONTH_KEYS.map((k) => (
                <td key={k} className="px-2 py-2.5 text-right whitespace-nowrap text-gray-700">{row[k]}</td>
              ))}
              <td className={`px-3 py-2.5 text-right whitespace-nowrap ${row.status === "exceed" ? "text-red-600" : "text-gray-700"}`} style={{ fontWeight: 600 }}>{row.avg}</td>
              <td className="px-3 py-2.5 text-right text-gray-500 whitespace-nowrap">{row.legalLimit}</td>
              <td className="px-3 py-2.5 text-center"><StatusBadge status={row.status} /></td>
              <td className="px-3 py-2.5 text-center">
                <div className="flex items-center justify-center gap-1">
                  <button className="p-1 rounded hover:bg-blue-100 text-gray-400 hover:text-blue-600"><Edit2 size={12} /></button>
                  <button className="p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-500"><Trash size={12} /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const CHEMICAL_MONTH_KEYS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"] as const;

function ChemicalTable({ data }: { data: ChemicalData[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs min-w-[1100px]">
        <thead>
          <tr className="bg-[#f8fafc] border-b-2 border-gray-200">
            <th className="px-3 py-2.5 text-left text-gray-600 whitespace-nowrap">시설명</th>
            <th className="px-3 py-2.5 text-left text-gray-600 whitespace-nowrap">약품명</th>
            <th className="px-3 py-2.5 text-left text-gray-600 whitespace-nowrap">CAS No.</th>
            <th className="px-3 py-2.5 text-left text-gray-600 whitespace-nowrap">단위</th>
            {RAW_TABLE_MONTH_LABELS.map((m) => (
              <th key={m} className="px-2 py-2.5 text-right text-gray-600 whitespace-nowrap">{m}</th>
            ))}
            <th className="px-3 py-2.5 text-right text-gray-600 whitespace-nowrap">합계</th>
            <th className="px-3 py-2.5 text-center text-gray-600 whitespace-nowrap">유해물질 분류</th>
            <th className="px-3 py-2.5 text-center text-gray-600 whitespace-nowrap">상태</th>
            <th className="px-3 py-2.5 text-center text-gray-600 whitespace-nowrap">관리</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={row.id} className={`border-b border-gray-100 hover:bg-gray-50 ${i % 2 === 1 ? "bg-white" : "bg-[#fafbfc]"}`}>
              <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap" style={{ fontWeight: 500 }}>{row.facility}</td>
              <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap">{row.chemicalName}</td>
              <td className="px-3 py-2.5 text-gray-500 font-mono whitespace-nowrap">{row.casNo}</td>
              <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{row.unit}</td>
              {CHEMICAL_MONTH_KEYS.map((k) => (
                <td key={k} className="px-2 py-2.5 text-right whitespace-nowrap text-gray-700">{row[k]}</td>
              ))}
              <td className="px-3 py-2.5 text-right text-gray-800 whitespace-nowrap" style={{ fontWeight: 600 }}>{row.total}</td>
              <td className="px-3 py-2.5 text-center">
                <span className="px-2 py-0.5 rounded-full bg-orange-50 border border-orange-200 text-orange-600 text-xs">{row.hazardClass}</span>
              </td>
              <td className="px-3 py-2.5 text-center"><StatusBadge status={row.status} /></td>
              <td className="px-3 py-2.5 text-center">
                <div className="flex items-center justify-center gap-1">
                  <button className="p-1 rounded hover:bg-blue-100 text-gray-400 hover:text-blue-600"><Edit2 size={12} /></button>
                  <button className="p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-500"><Trash size={12} /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EnergyProviderTable({ data }: { data: EnergyProviderData[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-[#f8fafc] border-b-2 border-gray-200">
            <th className="px-3 py-2.5 text-left text-gray-600">공급업체명</th>
            <th className="px-3 py-2.5 text-left text-gray-600">에너지 유형</th>
            <th className="px-3 py-2.5 text-left text-gray-600">계약번호</th>
            <th className="px-3 py-2.5 text-left text-gray-600">공급시작일</th>
            <th className="px-3 py-2.5 text-left text-gray-600">공급종료일</th>
            <th className="px-3 py-2.5 text-center text-gray-600">재생에너지 비율</th>
            <th className="px-3 py-2.5 text-left text-gray-600">인증서 번호</th>
            <th className="px-3 py-2.5 text-center text-gray-600">상태</th>
            <th className="px-3 py-2.5 text-center text-gray-600">관리</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={row.id} className={`border-b border-gray-100 hover:bg-gray-50 ${i % 2 === 1 ? "bg-white" : "bg-[#fafbfc]"}`}>
              <td className="px-3 py-2.5 text-gray-800" style={{ fontWeight: 500 }}>{row.providerName}</td>
              <td className="px-3 py-2.5 text-gray-600">{row.energyType}</td>
              <td className="px-3 py-2.5 text-gray-500 font-mono text-xs">{row.contractNo}</td>
              <td className="px-3 py-2.5 text-gray-500">{row.supplyStart}</td>
              <td className="px-3 py-2.5 text-gray-500">{row.supplyEnd}</td>
              <td className="px-3 py-2.5 text-center">
                {row.renewableRatio === "100%" ? (
                  <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">{row.renewableRatio}</span>
                ) : (
                  <span className="text-gray-500">{row.renewableRatio}</span>
                )}
              </td>
              <td className="px-3 py-2.5 text-gray-500 font-mono text-xs">{row.certNo}</td>
              <td className="px-3 py-2.5 text-center"><StatusBadge status={row.status} /></td>
              <td className="px-3 py-2.5 text-center">
                <div className="flex items-center justify-center gap-1">
                  <button className="p-1 rounded hover:bg-blue-100 text-gray-400 hover:text-blue-600"><Edit2 size={12} /></button>
                  <button className="p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-500"><Trash size={12} /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ConsignmentTable({ data }: { data: ConsignmentData[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-[#f8fafc] border-b-2 border-gray-200">
            <th className="px-3 py-2.5 text-left text-gray-600">업체명</th>
            <th className="px-3 py-2.5 text-left text-gray-600">사업자번호</th>
            <th className="px-3 py-2.5 text-left text-gray-600">처리 폐기물 유형</th>
            <th className="px-3 py-2.5 text-left text-gray-600">허가번호</th>
            <th className="px-3 py-2.5 text-left text-gray-600">허가만료일</th>
            <th className="px-3 py-2.5 text-left text-gray-600">계약시작일</th>
            <th className="px-3 py-2.5 text-left text-gray-600">계약종료일</th>
            <th className="px-3 py-2.5 text-center text-gray-600">상태</th>
            <th className="px-3 py-2.5 text-center text-gray-600">관리</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={row.id} className={`border-b border-gray-100 hover:bg-gray-50 ${i % 2 === 1 ? "bg-white" : "bg-[#fafbfc]"}`}>
              <td className="px-3 py-2.5 text-gray-800" style={{ fontWeight: 500 }}>{row.vendorName}</td>
              <td className="px-3 py-2.5 text-gray-500 font-mono">{row.bizNo}</td>
              <td className="px-3 py-2.5 text-gray-600">{row.wasteType}</td>
              <td className="px-3 py-2.5 text-gray-500 font-mono text-xs">{row.permitNo}</td>
              <td className={`px-3 py-2.5 ${row.status === "expired" ? "text-red-500" : "text-gray-500"}`}>{row.permitExpiry}</td>
              <td className="px-3 py-2.5 text-gray-500">{row.contractStart}</td>
              <td className="px-3 py-2.5 text-gray-500">{row.contractEnd}</td>
              <td className="px-3 py-2.5 text-center"><StatusBadge status={row.status} /></td>
              <td className="px-3 py-2.5 text-center">
                <div className="flex items-center justify-center gap-1">
                  <button className="p-1 rounded hover:bg-blue-100 text-gray-400 hover:text-blue-600"><Edit2 size={12} /></button>
                  <button className="p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-500"><Trash size={12} /></button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export interface RawDataUploadProps {
  category: RawDataCategory;
}

interface RawDataInquiryAllResponse {
  category: string;
  year: string;
  energyRows: EnergyData[];
  wasteRows: WasteData[];
  pollutionRows: PollutionData[];
  chemicalRows: ChemicalData[];
  energyProviderRows: EnergyProviderData[];
  consignmentRows: ConsignmentData[];
}

export function RawDataUpload({ category }: RawDataUploadProps) {
  const [selectedYear, setSelectedYear] = useState("2026");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const selectedMonthLabel = selectedMonth === "all" ? "전체" : `${selectedMonth}월`;

  const [periodType, setPeriodType] = useState<PeriodType>("월");
  const [selectedFacility, setSelectedFacility] = useState("전체");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [energyTypeFilter, setEnergyTypeFilter] = useState<string>("전체");
  const [pollutantTypeFilter, setPollutantTypeFilter] = useState<string>("전체");
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [showIFModal, setShowIFModal] = useState(false);
  const [savedAlert, setSavedAlert] = useState(false);
  const [loadingSync, setLoadingSync] = useState(false);
  const [energyRows, setEnergyRows] = useState<EnergyData[]>(energyData);
  const [wasteRows, setWasteRows] = useState<WasteData[]>(wasteData);
  const [pollutionRows, setPollutionRows] = useState<PollutionData[]>(pollutionData);
  const [chemicalRows, setChemicalRows] = useState<ChemicalData[]>(chemicalData);
  const [providerRows, setProviderRows] = useState<EnergyProviderData[]>(energyProviderData);
  const [consignmentRows, setConsignmentRows] = useState<ConsignmentData[]>(consignmentData);

  const categoryLabel = CATEGORY_LABELS[category];
  const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:9001";
  const companyIdForUpload = useAuthSessionStore((s) => s.user?.company_id?.trim() ?? "");

  const handleSave = () => {
    setSavedAlert(true);
    setTimeout(() => setSavedAlert(false), 3000);
  };

  const handleResetFilter = () => {
    setSelectedYear("2026");
    setSelectedMonth("all");
    setPeriodType("월");
    setSelectedFacility("전체");
    setSearchKeyword("");
    setEnergyTypeFilter("전체");
    setPollutantTypeFilter("전체");
  };

  const subTypeForApi = (): string => {
    if (category === "energy") return energyTypeFilter;
    if (category === "pollution") return pollutantTypeFilter;
    return "전체";
  };

  const runRawDataInquiry = async (year: string, month: string) => {
    const companyId = useAuthSessionStore.getState().user?.company_id?.trim();
    if (!companyId) {
      window.alert("회사 ID가 없습니다. 로그인 후 다시 시도해 주세요.");
      return;
    }
    setLoadingSync(true);
    try {
      const res = await fetchWithAuthJson(`${apiBase}/ghg-calculation/raw-data/inquiry`, {
        method: "POST",
        jsonBody: {
          company_id: companyId,
          year,
          month: month === "all" ? "" : month,
          period_type: periodType,
          facility: selectedFacility,
          sub_type: subTypeForApi(),
          search_keyword: searchKeyword.trim(),
        },
      });
      if (!res.ok) {
        throw new Error(`조회 실패 (${res.status})`);
      }
      const payload = (await res.json()) as RawDataInquiryAllResponse;
      setEnergyRows(payload.energyRows ?? []);
      setWasteRows(payload.wasteRows ?? []);
      setPollutionRows(payload.pollutionRows ?? []);
      setChemicalRows(payload.chemicalRows ?? []);
      setProviderRows(payload.energyProviderRows ?? []);
      setConsignmentRows(payload.consignmentRows ?? []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "알 수 없는 오류";
      window.alert(`Raw Data 조회 실패: ${msg}`);
    } finally {
      setLoadingSync(false);
    }
  };

  const handleFilterInquiry = () => {
    void runRawDataInquiry(selectedYear, selectedMonth);
  };

  const filteredEnergyData = (() => {
    let data = energyRows;
    if (energyTypeFilter !== "전체") {
      const typeMap: Record<string, string> = {
        "전력": "전력",
        "열·스팀": "열·스팀",
        "순수(정제수)": "순수",
        "LNG": "LNG",
        "용수": "용수",
      };
      data = data.filter((row) => row.energyType === (typeMap[energyTypeFilter] ?? energyTypeFilter));
    }
    if (selectedFacility !== "전체") {
      data = data.filter((row) => row.facility === selectedFacility);
    }
    if (searchKeyword.trim()) {
      const q = searchKeyword.toLowerCase();
      data = data.filter(
        (row) =>
          row.facility.toLowerCase().includes(q) ||
          row.energyType.toLowerCase().includes(q)
      );
    }
    return data;
  })();

  const filteredPollutionData = (() => {
    let data = pollutionRows;
    if (pollutantTypeFilter === "수질") {
      data = data.filter((row) => row.pollutant.includes("(수질)"));
    } else if (pollutantTypeFilter === "대기") {
      data = data.filter((row) => row.pollutant.includes("(대기)"));
    }
    if (selectedFacility !== "전체") {
      data = data.filter((row) => row.facility === selectedFacility);
    }
    if (searchKeyword.trim()) {
      const q = searchKeyword.toLowerCase();
      data = data.filter(
        (row) =>
          row.facility.toLowerCase().includes(q) ||
          row.pollutant.toLowerCase().includes(q)
      );
    }
    return data;
  })();

  const handleIfSync = async (year: string, month: string) => {
    setSelectedYear(year);
    setSelectedMonth(month);
    await runRawDataInquiry(year, month);
  };

  const getAlertCount = () => {
    if (category === "pollution") return filteredPollutionData.filter(d => d.status !== "normal").length;
    if (category === "waste") return wasteRows.filter(d => d.status === "error").length;
    return 0;
  };

  const alertCount = getAlertCount();

  return (
    <div className="p-5 space-y-4">
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-gray-900">Raw Data 업로드</h1>
            <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full border border-blue-200">실무자</span>
          </div>
          <p className="text-gray-500 text-xs mt-1">시스템 I/F 연동 데이터 조회 및 엑셀 업로드 · 계열사별 본인 법인 데이터만 입력</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowIFModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs text-blue-600 border border-blue-300 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <RefreshCw size={13} />
            I/F 연동 조회
          </button>
          <button
            onClick={() => setShowExcelModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs text-emerald-600 border border-emerald-300 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors"
          >
            <Upload size={13} />
            엑셀 업로드
          </button>
          <button className="flex items-center gap-1.5 px-3 py-2 text-xs text-gray-600 border border-gray-300 bg-white rounded-lg hover:bg-gray-50 transition-colors">
            <Download size={13} />
            엑셀 다운로드
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-3 py-2 text-xs text-white bg-[#0f1f3d] rounded-lg hover:bg-[#1a3060] transition-colors"
          >
            <Save size={13} />
            저장
          </button>
        </div>
      </div>

      {/* Save Alert */}
      {savedAlert && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-xs text-emerald-700">
          <CheckCircle2 size={14} />
          데이터가 임시저장되었습니다. 확정 전 관리자 검토가 필요합니다.
        </div>
      )}

      {/* Alert Banner */}
      {alertCount > 0 && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-xs text-red-700">
          <AlertCircle size={14} />
          {category === "pollution"
            ? `${alertCount}건의 오염물질 배출량이 주의/초과 기준입니다. 내용을 확인하세요.`
            : `${alertCount}건의 데이터에 오류가 있습니다. 확인 후 수정해주세요.`}
        </div>
      )}

      {/* Filter Bar — 전략: 연도, 기간(월/분기/반기), 시설, 유형(드릴다운), 검색어, 조회, 초기화. 필터 바 밑에 버튼 없음 */}
      <div className="bg-gray-100 border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <Filter size={12} />
          <span>필터:</span>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">연도</label>
          <div className="relative">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="appearance-none border border-gray-300 rounded-lg pl-3 pr-6 py-1.5 text-xs text-gray-700 bg-white focus:outline-none focus:border-blue-400 cursor-pointer min-w-[72px]"
            >
              {YEARS.map(y => <option key={y} value={y}>{y}년</option>)}
            </select>
            <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">월</label>
          <div className="relative">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="appearance-none border border-gray-300 rounded-lg pl-3 pr-6 py-1.5 text-xs text-gray-700 bg-white focus:outline-none focus:border-blue-400 cursor-pointer min-w-[76px]"
            >
              {MONTHS.map((m) => (
                <option key={m} value={m === "전체" ? "all" : m}>
                  {m === "전체" ? "전체" : `${m}월`}
                </option>
              ))}
            </select>
            <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">기간</label>
          <div className="relative">
            <select
              value={periodType}
              onChange={(e) => setPeriodType(e.target.value as PeriodType)}
              className="appearance-none border border-gray-300 rounded-lg pl-3 pr-6 py-1.5 text-xs text-gray-700 bg-white focus:outline-none focus:border-blue-400 cursor-pointer min-w-[72px]"
            >
              {PERIOD_TYPES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500">시설</label>
          <div className="relative">
            <select
              value={selectedFacility}
              onChange={(e) => setSelectedFacility(e.target.value)}
              className="appearance-none border border-gray-300 rounded-lg pl-3 pr-6 py-1.5 text-xs text-gray-700 bg-white focus:outline-none focus:border-blue-400 cursor-pointer min-w-[80px]"
            >
              {FACILITIES.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>
        {/* 유형 드롭다운(드릴다운) — 에너지 시 전력/열·스팀/…, 오염물질 시 수질/대기. 필터 바 밑에 버튼 없음 */}
        {category === "energy" && (
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">유형</label>
            <div className="relative">
              <select
                value={energyTypeFilter}
                onChange={(e) => setEnergyTypeFilter(e.target.value)}
                className="appearance-none border border-gray-300 rounded-lg pl-3 pr-6 py-1.5 text-xs text-gray-700 bg-white focus:outline-none focus:border-blue-400 cursor-pointer min-w-[100px]"
              >
                {ENERGY_SUB_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>
        )}
        {category === "pollution" && (
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">유형</label>
            <div className="relative">
              <select
                value={pollutantTypeFilter}
                onChange={(e) => setPollutantTypeFilter(e.target.value)}
                className="appearance-none border border-gray-300 rounded-lg pl-3 pr-6 py-1.5 text-xs text-gray-700 bg-white focus:outline-none focus:border-blue-400 cursor-pointer min-w-[72px]"
              >
                {POLLUTANT_SUB_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>
        )}
        <div className="flex-1 min-w-[180px]">
          <div className="relative">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="검색어 입력..."
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg pl-7 pr-3 py-1.5 text-xs text-gray-700 bg-white focus:outline-none focus:border-blue-400"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={() => void handleFilterInquiry()}
          disabled={loadingSync}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Search size={12} />
          {loadingSync ? "조회 중…" : "조회"}
        </button>
        <button
          type="button"
          onClick={handleResetFilter}
          className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1.5 rounded-lg hover:bg-gray-200 transition-colors"
        >
          초기화
        </button>
      </div>

      {/* Main Content Card — 탭 없음, 사이드바에서 선택한 카테고리만 표시 */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {/* Table Toolbar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-600">
              <strong className="text-gray-800">{categoryLabel}</strong> 데이터
            </span>
            <span className="text-xs text-gray-400">
              총 {category === "energy" ? filteredEnergyData.length : category === "pollution" ? filteredPollutionData.length : category === "waste" ? wasteRows.length : category === "chemical" ? chemicalRows.length : category === "energy-provider" ? providerRows.length : consignmentRows.length}건
            </span>
            {category === "energy" && (
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Info size={11} /> 에너지유형: 전력, 열·스팀, 순수, LNG, 용수
              </span>
            )}
          </div>
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-blue-600 border border-blue-300 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">
            <Plus size={12} />
            행 추가
          </button>
        </div>

        {/* Data Table — 사이드바에서 선택한 카테고리만 표시 */}
        <div className="overflow-hidden">
          {category === "energy" && <EnergyTable data={filteredEnergyData} />}
          {category === "waste" && <WasteTable data={wasteRows} />}
          {category === "pollution" && <PollutionTable data={filteredPollutionData} />}
          {category === "chemical" && <ChemicalTable data={chemicalRows} />}
          {category === "energy-provider" && <EnergyProviderTable data={providerRows} />}
          {category === "consignment" && <ConsignmentTable data={consignmentRows} />}
        </div>

        {/* Table Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <CheckCircle2 size={11} className="text-emerald-500" /> 확정
            </span>
            <span className="flex items-center gap-1">
              <Clock size={11} className="text-yellow-500" /> 임시저장
            </span>
            <span className="flex items-center gap-1">
              <AlertCircle size={11} className="text-red-400" /> 오류
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span>1 / 1 페이지</span>
            <span>·</span>
            <span>{selectedYear}년 {selectedMonthLabel} · {periodType}{loadingSync ? " · 조회중" : ""}</span>
            <span>·</span>
            <span>{selectedFacility === "전체" ? "전체 시설" : selectedFacility}</span>
          </div>
        </div>
      </div>

      {/* Bottom Notes */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex items-start gap-2 mb-2">
          <Info size={14} className="text-blue-400 mt-0.5 shrink-0" />
          <div className="text-xs text-gray-600" style={{ fontWeight: 600 }}>데이터 입력 안내</div>
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-1 pl-5">
          {[
            "계열사별 본인 법인 데이터만 입력하시기 바랍니다.",
            "I/F 연동 데이터는 시스템에서 자동으로 가져옵니다.",
            "엑셀 업로드 시 제공된 양식 파일을 사용해주세요.",
            "데이터 입력 완료 후 반드시 저장 버튼을 클릭하세요.",
            "오류 데이터는 확정 처리가 불가합니다. 수정 후 재입력하세요.",
            "문의사항은 ESG 시스템 관리자에게 연락해주세요.",
          ].map((note) => (
            <div key={note} className="flex items-start gap-1.5 text-xs text-gray-500">
              <span className="text-gray-300 mt-0.5">•</span>
              {note}
            </div>
          ))}
        </div>
      </div>

      {/* Modals */}
      {showExcelModal && (
        <ExcelUploadModal
          tabLabel={categoryLabel}
          rawCategory={category}
          apiBase={apiBase}
          companyId={companyIdForUpload}
          onClose={() => setShowExcelModal(false)}
        />
      )}
      {showIFModal && (
        <IFSyncModal
          tabLabel={categoryLabel}
          onSync={handleIfSync}
          onClose={() => setShowIFModal(false)}
        />
      )}
    </div>
  );
}

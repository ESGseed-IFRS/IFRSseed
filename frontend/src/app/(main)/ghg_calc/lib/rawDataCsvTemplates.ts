/**
 * Raw Data 탭별 CSV 업로드 양식 — 헤더는 `raw_data_inquiry_service` 매핑과 맞춤.
 * ghg_raw_category 열은 포함하지 않음(서버가 헤더·파일명으로 추정하거나, 필요 시 열을 직접 추가 가능).
 */
import type { RawDataCategory } from "../types/ghg";

function csvEscape(cell: string): string {
  if (/[",\r\n]/.test(cell)) {
    return `"${cell.replace(/"/g, '""')}"`;
  }
  return cell;
}

function row(cells: string[]): string {
  return cells.map(csvEscape).join(",");
}

/** 탭별 샘플 CSV (헤더 + 예시 1행). */
const TEMPLATE_BODY: Record<RawDataCategory, string[]> = {
  energy: [
    row([
      "source_system",
      "year",
      "facility",
      "site_name",
      "energy_type",
      "usage_unit",
      "month",
      "usage_amount",
      "created_at",
    ]),
    row([
      "EMS",
      "2024",
      "본관",
      "본관",
      "전력",
      "kWh",
      "1",
      "120000",
      "2024-01-15 10:00:00",
    ]),
  ],
  waste: [
    row([
      "source_system",
      "year",
      "facility",
      "waste_type",
      "treatment_method",
      "unit",
      "vendor",
      "month",
      "generation_ton",
      "created_at",
    ]),
    row([
      "EMS",
      "2024",
      "생산동A",
      "일반폐기물",
      "소각",
      "톤",
      "위탁업체A",
      "1",
      "1.2",
      "2024-01-10 09:00:00",
    ]),
  ],
  pollution: [
    row([
      "source_system",
      "year",
      "facility",
      "discharge_point",
      "month",
      "quarter",
      "bod_mg_l",
      "cod_mg_l",
      "ss_mg_l",
      "regulatory_limit_bod",
      "created_at",
    ]),
    row([
      "EHS",
      "2024",
      "수원 데이터센터",
      "방류구-01-01",
      "4",
      "1",
      "5.2",
      "8.5",
      "3.1",
      "30.0",
      "2024-04-05 09:00:00",
    ]),
  ],
  chemical: [
    row([
      "source_system",
      "year",
      "facility",
      "chemical_name",
      "cas_no",
      "hazard_class",
      "unit",
      "month",
      "usage_amount_kg",
      "created_at",
    ]),
    row([
      "EHS",
      "2024",
      "공장A",
      "에탄올",
      "64-17-5",
      "유해",
      "kg",
      "3",
      "50",
      "2024-03-01 10:00:00",
    ]),
  ],
  "energy-provider": [
    row([
      "source_system",
      "provider_name",
      "supplier_name",
      "energy_type",
      "contract_no",
      "supply_start",
      "supply_end",
      "renewable_ratio",
      "cert_no",
      "status",
    ]),
    row([
      "MDG",
      "한전에너지",
      "",
      "전력",
      "CTR-2024-001",
      "2024-01-01",
      "2025-12-31",
      "12%",
      "CERT-001",
      "active",
    ]),
  ],
  consignment: [
    row([
      "source_system",
      "vendor_name",
      "biz_no",
      "waste_type",
      "permit_no",
      "permit_expiry",
      "contract_start",
      "contract_end",
      "status",
    ]),
    row([
      "MDG",
      "그린처리",
      "123-45-67890",
      "지정폐기물",
      "PER-001",
      "2026-12-31",
      "2024-01-01",
      "2025-12-31",
      "active",
    ]),
  ],
};

const TEMPLATE_FILENAME: Record<RawDataCategory, string> = {
  energy: "ghg_raw_energy_template.csv",
  waste: "ghg_raw_waste_template.csv",
  pollution: "ghg_raw_pollution_template.csv",
  chemical: "ghg_raw_chemical_template.csv",
  "energy-provider": "ghg_raw_energy_provider_template.csv",
  consignment: "ghg_raw_consignment_template.csv",
};

export function downloadRawDataCsvTemplate(category: RawDataCategory): void {
  const lines = TEMPLATE_BODY[category];
  const name = TEMPLATE_FILENAME[category];
  const text = `\uFEFF${lines.join("\r\n")}\r\n`;
  const blob = new Blob([text], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

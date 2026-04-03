'use client';

import * as XLSX from 'xlsx';
import type {
  BoundaryPolicy,
  Scope1FormData,
  Scope2FormData,
  Scope3FormData,
  ReceiptAttachment,
} from '../types/ghg.types';
import { DISCLOSURE_ITEM_MASTER } from '../constants/disclosureReportMapping';

/** 공시 프레임워크 ID → 표시명 (ERP_DATA_DISCLOSURE_STRATEGY) */
const FRAMEWORK_LABELS: Record<string, string> = {
  ISSB: 'ISSB (IFRS S2)',
  KSSB: 'KSSB',
  'K-ETS': 'K-ETS',
  GRI: 'GRI 305',
  ESRS: 'ESRS E1',
};

/** Phase 8: 공시기준별 리포트 안내 */
const FRAMEWORK_REPORT_NOTE: Record<string, string> = {
  'K-ETS': 'K-ETS 국내 형식: 월별 에너지 사용량·Scope 1 중심',
  ISSB: 'ISSB: 연간 총합, Scope 2 위치/시장 기반, Scope 3 중대 카테고리',
  KSSB: 'KSSB: 국내 ISSB 기반, Scope 3 유예/중대성 판단',
  GRI: 'GRI 305: GHG Protocol 기반 Scope 1/2/3',
  ESRS: 'ESRS E1: double materiality, 15개 Scope 3 카테고리',
};

/** JSON/엑셀용 직렬화: Date → ISO 문자열, 영수증 포함 */
export interface EvidencePayload {
  generatedAt: string;
  boundaryPolicy: BoundaryPolicy;
  scope1: Scope1FormData;
  scope2: Scope2FormData;
  scope3: Scope3FormDataSerialized;
  /** 공시 기준 (리포트 헤더 표기용) */
  disclosureFramework?: string;
  summary: {
    totalTco2e: number;
    scope1Tco2e: number;
    scope2Tco2e: number;
    scope3Tco2e: number;
  };
}

interface Scope3FormDataSerialized {
  categories: {
    category: string;
    data: Array<{
      id: string;
      year: number;
      month: number;
      facility: string;
      energySource: string;
      amount: number;
      unit: string;
      emissions: number;
      dataQuality?: { dataType: string; estimationMethod?: string; assumptions?: string };
    }>;
    receipts?: Array<{
      id: string;
      fileName: string;
      fileSize: number;
      fileType: string;
      fileUrl?: string;
      uploadedAt: string;
      relatedItemId?: string;
    }>;
  }[];
}

function serializeReceipt(r: ReceiptAttachment) {
  return {
    id: r.id,
    fileName: r.fileName,
    fileSize: r.fileSize,
    fileType: r.fileType,
    fileUrl: r.fileUrl,
    uploadedAt: r.uploadedAt instanceof Date ? r.uploadedAt.toISOString() : String(r.uploadedAt),
    relatedItemId: r.relatedItemId,
  };
}

export function buildEvidencePayload(
  boundaryPolicy: BoundaryPolicy,
  scope1: Scope1FormData,
  scope2: Scope2FormData,
  scope3: Scope3FormData,
  disclosureFramework?: string
): EvidencePayload {
  const s1 =
    scope1.stationary.reduce((s, r) => s + (r.emissions || 0), 0) +
    scope1.mobile.reduce((s, r) => s + (r.emissions || 0), 0);
  const s2 = scope2.electricity.reduce((s, r) => s + (r.emissions || 0), 0);
  const s3 = scope3.categories.reduce(
    (sum, cat) => sum + cat.data.reduce((ss, r) => ss + (r.emissions || 0), 0),
    0
  );

  const scope3Serialized: Scope3FormDataSerialized = {
    categories: scope3.categories.map((cat) => ({
      category: cat.category,
      data: cat.data.map((r) => ({
        id: r.id,
        year: r.year,
        month: r.month,
        facility: r.facility,
        energySource: r.energySource,
        amount: r.amount,
        unit: r.unit,
        emissions: r.emissions ?? 0,
        dataQuality: r.dataQuality,
      })),
      receipts: cat.receipts?.map(serializeReceipt),
    })),
  };

  return {
    generatedAt: new Date().toISOString(),
    boundaryPolicy,
    scope1,
    scope2,
    scope3: scope3Serialized,
    disclosureFramework,
    summary: {
      totalTco2e: s1 + s2 + s3,
      scope1Tco2e: s1,
      scope2Tco2e: s2,
      scope3Tco2e: s3,
    },
  };
}

/** Excel 다운로드: 산정설정, Scope1, Scope2, Scope3, Scope3 영수증 목록 시트 */
export function downloadEvidenceExcel(payload: EvidencePayload, fileName: string) {
  const wb = XLSX.utils.book_new();

  const orgLabels: Record<string, string> = {
    operational_control: '운영통제법',
    equity_share: '지분비율법',
    financial_control: '재무통제법',
  };

  // 시트 1: 요약 (Phase 8: 기준별 템플릿 반영)
  const summaryRows: (string | number)[][] = [
    ['GHG 증적 리포트 요약'],
    ['생성일시', payload.generatedAt],
    ...(payload.disclosureFramework
      ? [
          ['공시 기준', FRAMEWORK_LABELS[payload.disclosureFramework] ?? payload.disclosureFramework],
          ...(FRAMEWORK_REPORT_NOTE[payload.disclosureFramework]
            ? [['기준별 안내', FRAMEWORK_REPORT_NOTE[payload.disclosureFramework]]]
            : []),
        ]
      : []),
    [],
    ['구분', '배출량 (tCO₂e)'],
    ['Scope 1', payload.summary.scope1Tco2e],
    ['Scope 2', payload.summary.scope2Tco2e],
    ['Scope 3', payload.summary.scope3Tco2e],
    ['총계', payload.summary.totalTco2e],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryRows), '요약');

  // 시트 2: 산정 설정
  const bp = payload.boundaryPolicy;
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ['산정 설정 (Boundary & Policy)'],
      ['조직 경계', orgLabels[bp.organizationBoundary] ?? bp.organizationBoundary],
      ['보고 연도', bp.reportingYear],
      ['Scope 1 포함 기준', bp.operationalBoundary.scope1Included],
      ['Scope 2 포함 기준', bp.operationalBoundary.scope2Included],
      ['기준 가이드라인', bp.guideline ?? ''],
      ['적용 기준 버전(세부)', bp.guidelineVersion ?? ''],
      ['EF DB 버전', bp.efDbVersion ?? ''],
    ]),
    '산정설정'
  );

  // 시트 3: Scope 1 고정연소
  const s1StationaryRows = payload.scope1.stationary.map((r) => ({
    월: r.month,
    사업장: r.facility,
    연료: r.energySource,
    사용량: r.amount,
    단위: r.unit,
    배출량_tCO2e: r.emissions ?? 0,
    데이터품질: r.dataQuality?.dataType ?? '',
    추정방법: r.dataQuality?.estimationMethod ?? '',
    가정사항: r.dataQuality?.assumptions ?? '',
  }));
  if (s1StationaryRows.length > 0) {
    const cols = ['월', '사업장', '연료', '사용량', '단위', '배출량_tCO2e', '데이터품질', '추정방법', '가정사항'];
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(s1StationaryRows, { header: cols }),
      'Scope1_고정연소'
    );
  }

  // 시트 4: Scope 1 이동연소
  const s1MobileRows = payload.scope1.mobile.map((r) => ({
    월: r.month,
    사업장: r.facility,
    연료: r.energySource,
    사용량: r.amount,
    단위: r.unit,
    배출량_tCO2e: r.emissions ?? 0,
    데이터품질: r.dataQuality?.dataType ?? '',
    추정방법: r.dataQuality?.estimationMethod ?? '',
    가정사항: r.dataQuality?.assumptions ?? '',
  }));
  if (s1MobileRows.length > 0) {
    const cols = ['월', '사업장', '연료', '사용량', '단위', '배출량_tCO2e', '데이터품질', '추정방법', '가정사항'];
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(s1MobileRows, { header: cols }),
      'Scope1_이동연소'
    );
  }

  // 시트 5: Scope 2 전력
  const s2Rows = payload.scope2.electricity.map((r) => ({
    월: r.month,
    사업장: r.facility,
    에너지원: r.energySource,
    사용량: r.amount,
    단위: r.unit,
    배출량_tCO2e: r.emissions ?? 0,
    데이터품질: r.dataQuality?.dataType ?? '',
  }));
  if (s2Rows.length > 0) {
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(s2Rows, {
        header: ['월', '사업장', '에너지원', '사용량', '단위', '배출량_tCO2e', '데이터품질'],
      }),
      'Scope2_전력'
    );
  }

  // 시트 6: Scope 3 카테고리별
  const s3Rows: Array<{ 카테고리: string; 사업장: string; 항목: string; 사용량: number; 단위: string; 배출량_tCO2e: number }> = [];
  for (const cat of payload.scope3.categories) {
    for (const r of cat.data) {
      s3Rows.push({
        카테고리: cat.category,
        사업장: r.facility,
        항목: r.energySource,
        사용량: r.amount,
        단위: r.unit,
        배출량_tCO2e: r.emissions ?? 0,
      });
    }
  }
  if (s3Rows.length > 0) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(s3Rows), 'Scope3_데이터');
  }

  // 시트 7: Scope 3 영수증 첨부 목록
  const receiptRows: Array<{ 카테고리: string; 파일명: string; 파일크기: number; 업로드일시: string; 파일URL: string }> = [];
  for (const cat of payload.scope3.categories) {
    for (const rec of cat.receipts ?? []) {
      receiptRows.push({
        카테고리: cat.category,
        파일명: rec.fileName,
        파일크기: rec.fileSize,
        업로드일시: rec.uploadedAt,
        파일URL: rec.fileUrl ?? '',
      });
    }
  }
  if (receiptRows.length > 0) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(receiptRows), 'Scope3_영수증목록');
  } else {
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([['Scope 3 영수증 첨부 목록'], ['카테고리', '파일명', '파일크기', '업로드일시', '파일URL'], []]),
      'Scope3_영수증목록'
    );
  }

  // §1-5: 공시 항목별 시트 — 매핑 테이블 기반 시트·컬럼 생성
  const disclosureSheets = buildDisclosureSheetsFromPayload(payload);
  for (const { sheetName, rows } of disclosureSheets) {
    if (rows.length > 0) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), sheetName);
    }
  }

  XLSX.writeFile(wb, fileName);
}

/** payload에서 보고 연도 추출 */
function getReportYear(payload: EvidencePayload): number {
  const y = payload.boundaryPolicy?.reportingYear;
  if (typeof y === 'number' && y > 1990 && y < 2100) return y;
  const first =
    payload.scope1.stationary[0]?.year ??
    payload.scope1.mobile[0]?.year ??
    payload.scope2.electricity[0]?.year;
  if (typeof first === 'number') return first;
  return new Date().getFullYear();
}

/** §1-5: 공시 항목별 시트 데이터 생성 (매핑 테이블 시트명·컬럼 사용) */
function buildDisclosureSheetsFromPayload(
  payload: EvidencePayload
): Array<{ sheetName: string; rows: (string | number)[][] }> {
  const year = getReportYear(payload);
  const result: Array<{ sheetName: string; rows: (string | number)[][] }> = [];

  for (const master of DISCLOSURE_ITEM_MASTER) {
    const { sheetName, columns } = master.reportSheet;
    const rows: (string | number)[][] = [columns];

    if (master.id === 'monthly_energy') {
      // Scope 1+2 사용량 월별 집계 (연도, 구분=에너지원, 1~12월, 합계, 단위)
      const byKey = new Map<string, { unit: string; months: number[] }>();
      const add = (r: { year?: number; month: number; energySource: string; amount: number; unit: string }) => {
        const y = r.year ?? year;
        if (y !== year) return;
        const key = `${r.energySource}\t${r.unit}`;
        if (!byKey.has(key)) byKey.set(key, { unit: r.unit, months: new Array(13).fill(0) });
        const rec = byKey.get(key)!;
        rec.months[r.month - 1] += r.amount;
      };
      payload.scope1.stationary.forEach(add);
      payload.scope1.mobile.forEach(add);
      payload.scope2.electricity.forEach((r) => add({ ...r, energySource: r.energySource || '전력' }));
      byKey.forEach((v, key) => {
        const [구분, unit] = key.split('\t');
        const m = v.months;
        const sum = m.slice(0, 12).reduce((a, b) => a + b, 0);
        rows.push([year, 구분, ...m.slice(0, 12), sum, unit]);
      });
    } else if (master.id === 'scope1') {
      const months = new Array(12).fill(0);
      const add = (r: { month: number; emissions?: number }) => {
        months[r.month - 1] += r.emissions ?? 0;
      };
      payload.scope1.stationary.forEach(add);
      payload.scope1.mobile.forEach(add);
      const total = months.reduce((a, b) => a + b, 0);
      rows.push([year, 'Scope 1', ...months, total, 'tCO₂e']);
    } else if (master.id === 'scope2') {
      const months = new Array(12).fill(0);
      payload.scope2.electricity.forEach((r) => {
        months[r.month - 1] += r.emissions ?? 0;
      });
      const total = months.reduce((a, b) => a + b, 0);
      rows.push([year, 'Scope 2', ...months, total, 'tCO₂e']);
    } else if (master.id === 'scope3') {
      const months = new Array(12).fill(0);
      for (const cat of payload.scope3.categories) {
        for (const r of cat.data) {
          months[r.month - 1] += r.emissions ?? 0;
        }
      }
      const total = months.reduce((a, b) => a + b, 0);
      rows.push([year, 'Scope 3', ...months, total, 'tCO₂e']);
    }

    if (rows.length > 1) result.push({ sheetName, rows });
  }

  return result;
}

export function downloadEvidenceJson(payload: EvidencePayload, fileName: string) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

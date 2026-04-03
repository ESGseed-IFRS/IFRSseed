'use client';

import { useState } from 'react';
import { FileCheck, FileSpreadsheet, Loader2, Download } from 'lucide-react';
import { pdf } from '@react-pdf/renderer';
import { useGHGStore } from '../store/ghg.store';
import { toast } from 'sonner';
import {
  buildEvidencePayload,
  downloadEvidenceExcel,
  downloadEvidenceJson,
} from '../utils/evidenceReport';
import { EvidencePdfDocument } from './EvidencePdfDocument';

const FILE_PREFIX = `ghg-evidence-${new Date().toISOString().slice(0, 10)}`;

/** 검증의견서 부속 서류 6항목 — IFRS_RESULT_REPORT.md: 리포트 생성 탭으로 통합 */
const VERIFICATION_DOCS = [
  { id: 'scope', name: '검증 범위 요약', desc: '등록 사업장·배출원, 산정 연도, 조직 경계, Scope 1/2/3 포함 여부' },
  { id: 'aggregation', name: '배출량 집계표', desc: 'Scope 1/2/3 합계 및 카테고리별(에너지원별) 상세 tCO₂e' },
  { id: 'data-quality', name: '데이터 품질 통계', desc: '실측 vs 추정 비율, 실측 증빙(OCR 완료) 비중, 데이터 품질 등급' },
  { id: 'methodology', name: '적용 배출계수·산식 요약', desc: 'EF 출처·버전, GWP, Scope별 산식' },
  { id: 'activity', name: '활동자료 요약 (Activity Data Summary)', desc: '검증 대상 기간 총 사용량(연료/전력 등), 단위별 합계' },
  { id: 'evidence-list', name: '증빙 목록', desc: '고지서·영수증 첨부 목록(파일명, 연계 항목)' },
] as const;

/**
 * Step 5: 증적 저장 및 보고
 * PDF / Excel / JSON / 일괄 — 산정설정·Scope1·2·3·데이터품질·검증의견서 부속 서류 포함
 */
export function Step5Report({ disclosureFramework = 'ISSB' }: { disclosureFramework?: string }) {
  const boundaryPolicy = useGHGStore((s) => s.boundaryPolicy);
  const scope1 = useGHGStore((s) => s.scope1);
  const scope2 = useGHGStore((s) => s.scope2);
  const scope3 = useGHGStore((s) => s.scope3);
  const saveSnapshot = useGHGStore((s) => s.saveSnapshot);
  const [loading, setLoading] = useState<'pdf' | 'excel' | 'json' | 'all' | null>(null);

  const getPayload = () =>
    buildEvidencePayload(boundaryPolicy, scope1, scope2, scope3, disclosureFramework);

  const handleDownload = async (format: 'pdf' | 'excel' | 'json') => {
    setLoading(format);
    try {
      const payload = getPayload();
      saveSnapshot(`${format.toUpperCase()} 리포트`);

      if (format === 'json') {
        downloadEvidenceJson(payload, `${FILE_PREFIX}.json`);
        toast.success('JSON 파일이 다운로드되었습니다.');
      } else if (format === 'excel') {
        downloadEvidenceExcel(payload, `${FILE_PREFIX}.xlsx`);
        toast.success('Excel 파일이 다운로드되었습니다. (산정설정·Scope1·2·3·영수증 목록 포함)');
      } else {
        const blob = await pdf(<EvidencePdfDocument data={payload} />).toBlob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${FILE_PREFIX}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('PDF 파일이 다운로드되었습니다. (산정 근거·영수증 목록 포함)');
      }
    } catch (e) {
      console.error(e);
      toast.error(`${format.toUpperCase()} 생성 중 오류가 발생했습니다.`);
    } finally {
      setLoading(null);
    }
  };

  const handleDownloadAll = async () => {
    setLoading('all');
    try {
      const payload = getPayload();
      downloadEvidenceExcel(payload, `${FILE_PREFIX}.xlsx`);
      const blob = await pdf(<EvidencePdfDocument data={payload} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${FILE_PREFIX}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('검증의견서 부속 서류(PDF·Excel) 일괄 다운로드 완료.');
    } catch (e) {
      console.error(e);
      toast.error('일괄 다운로드 중 오류가 발생했습니다.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#669900] p-8 rounded-2xl text-white text-center">
        <FileCheck className="h-12 w-12 mx-auto mb-4 opacity-90" />
        <h3 className="text-xl font-bold">Evidence Report 생성 완료</h3>
        <p className="opacity-80 text-sm mt-2">모든 산정 근거와 메타데이터가 포함된 디지털 증적 자료가 준비되었습니다.</p>
      </div>

      {/* PDF / Excel 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          type="button"
          disabled={!!loading}
          onClick={() => handleDownload('pdf')}
          className="flex flex-col items-center justify-center p-6 bg-white border border-slate-200 rounded-2xl hover:border-emerald-500 transition-all group disabled:opacity-60"
        >
          {loading === 'pdf' ? (
            <Loader2 className="h-8 w-8 text-red-500 animate-spin" />
          ) : (
            <FileCheck className="h-8 w-8 text-red-500 group-hover:scale-110 transition-transform" />
          )}
          <span className="mt-2 font-bold text-sm">PDF Report</span>
          <span className="text-xs text-slate-500 mt-1">산정설정·Scope1·2·3·영수증 목록</span>
        </button>
        <button
          type="button"
          disabled={!!loading}
          onClick={() => handleDownload('excel')}
          className="flex flex-col items-center justify-center p-6 bg-white border border-slate-200 rounded-2xl hover:border-emerald-500 transition-all group disabled:opacity-60"
        >
          {loading === 'excel' ? (
            <Loader2 className="h-8 w-8 text-green-600 animate-spin" />
          ) : (
            <FileSpreadsheet className="h-8 w-8 text-green-600 group-hover:scale-110 transition-transform" />
          )}
          <span className="mt-2 font-bold text-sm">Excel Details</span>
          <span className="text-xs text-slate-500 mt-1">시트: 요약·산정설정·Scope1·2·3·영수증</span>
        </button>
      </div>

      {/* 검증의견서 부속 서류 — IFRS_RESULT_REPORT.md: 리포트 생성으로 통합 */}
      <section className="border-t border-slate-200 pt-6 space-y-4">
        <p className="text-sm text-slate-600">
          아래 서류는 GHG Protocol·KMR 검증의견서 제출 시 참고용으로 활용할 수 있습니다. 검증기관별 추가 요청이 있을 수 있으니 확인 후 제출하세요.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {VERIFICATION_DOCS.map((doc) => (
            <div
              key={doc.id}
              className="border border-slate-200 rounded-none bg-white p-5 flex flex-col"
            >
              <div className="flex items-start gap-3">
                <FileCheck className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <h4 className="font-semibold text-slate-900">{doc.name}</h4>
                  <p className="text-xs text-slate-500 mt-1">{doc.desc}</p>
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-3">
                PDF·Excel 일괄 다운로드 시 아래 항목이 포함됩니다.
              </p>
            </div>
          ))}
        </div>
        <div className="border-t border-slate-200 pt-4">
          <p className="text-sm text-slate-600 mb-4">
            검증의견서 부속 서류를 PDF 또는 Excel로 다운로드할 수 있습니다. (검증 범위, 배출량 집계표, 데이터 품질, 활동자료 요약, 적용 계수·영수증 목록 포함)
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={!!loading}
              onClick={() => handleDownload('pdf')}
              className="inline-flex items-center gap-2 rounded-none border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              {loading === 'pdf' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck className="h-4 w-4" />}
              PDF 다운로드
            </button>
            <button
              type="button"
              disabled={!!loading}
              onClick={() => handleDownload('excel')}
              className="inline-flex items-center gap-2 rounded-none border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              {loading === 'excel' ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
              Excel 다운로드
            </button>
            <button
              type="button"
              disabled={!!loading}
              onClick={handleDownloadAll}
              className="inline-flex items-center gap-2 rounded-none bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              {loading === 'all' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              검증의견서 부속 서류 일괄 다운로드
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

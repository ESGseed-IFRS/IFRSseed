'use client';

import { Package, FileSpreadsheet, FileText } from 'lucide-react';
import { useGHGStore } from '../../store/ghg.store';

/** GHG_AUDIT_TAB_DESIGN_v2 §4.7: 증빙 패키지 내보내기 — 프레임워크별 5종 */

export interface AuditPackageExportProps {
  onGoToReport?: () => void;
  framework?: string;
}

const EXPORT_ITEMS = [
  { id: 'result', icon: FileText, label: 'GHG_산정결과_2024.pdf', desc: 'Scope 1/2/3 배출량·산식·배출계수 요약', target: '공시 제출' },
  { id: 'lineage', icon: FileSpreadsheet, label: 'GHG_데이터계보_2024.xlsx', desc: '전체 레코드 source_system·synced_at', target: '감사인' },
  { id: 'manual', icon: FileSpreadsheet, label: 'GHG_수동조정이력_2024.xlsx', desc: '수정 건 전후값·사유·수정자', target: '감사인' },
  { id: 'factors', icon: FileSpreadsheet, label: 'GHG_배출계수적용내역_2024.xlsx', desc: 'applied_factor_id·value 스냅샷', target: '감사인' },
  { id: 'checklist', icon: FileText, label: 'GHG_IFRS_S2_체크리스트_2024.pdf', desc: '12개 요건 충족 여부·근거 요약', target: '검증의견서' },
];

export function AuditPackageExport({ onGoToReport, framework = 'IFRS S2' }: AuditPackageExportProps) {
  const boundaryPolicy = useGHGStore((s) => s.boundaryPolicy);
  const year = boundaryPolicy?.reportingYear ?? new Date().getFullYear();
  const checklistLabel = framework === 'K-ETS' ? 'GHG_K-ETS_체크리스트' : 'GHG_IFRS_S2_체크리스트';

  const items = EXPORT_ITEMS.map((i) => ({
    ...i,
    label: i.id === 'checklist' ? `${checklistLabel}_${year}.pdf` : i.label.replace('2024', String(year)),
  }));

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-slate-900">증빙 패키지 내보내기</h2>
      <p className="text-base text-slate-600">
        프레임워크 선택에 따라 파일명과 체크리스트 내용이 자동 변경됩니다.
      </p>

      <div>
        <p className="text-sm font-semibold text-slate-700 mb-3">다운로드 패키지 ({framework} 기준)</p>
        <div className="space-y-2">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.id}
                className="flex items-center gap-4 p-4 rounded-lg border border-slate-200 bg-white hover:bg-slate-50"
              >
                <Icon className="h-8 w-8 text-slate-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900">{item.label}</p>
                  <p className="text-sm text-slate-600">{item.desc} → {item.target}</p>
                </div>
                <button
                  type="button"
                  className="shrink-0 px-3 py-1.5 rounded border border-slate-200 text-sm font-medium hover:bg-slate-100"
                >
                  다운로드
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white font-medium text-sm hover:bg-primary/90"
        >
          <Package className="h-4 w-4" />
          전체 다운로드 (ZIP)
        </button>
        <span className="text-sm text-slate-500 self-center">개별 다운로드 위 버튼 사용</span>
      </div>

      {onGoToReport && (
        <div className="pt-4 border-t border-slate-200">
          <button
            type="button"
            onClick={onGoToReport}
            className="text-primary font-medium text-sm hover:underline"
          >
            리포트 생성 탭으로 이동 →
          </button>
        </div>
      )}
    </div>
  );
}

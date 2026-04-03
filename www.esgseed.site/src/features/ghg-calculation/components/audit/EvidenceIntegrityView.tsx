'use client';

import { FileCheck } from 'lucide-react';
import { useGHGStore } from '../../store/ghg.store';

/** AUDIT_TRAIL_IMPLEMENTATION_ROADMAP §3.5: 증빙자료(Evidence & Integrity) */
export function EvidenceIntegrityView() {
  const scope3 = useGHGStore((s) => s.scope3);

  const receipts: { category: string; fileName: string; fileSize: number; uploadedAt: string }[] = [];
  scope3.categories.forEach((cat) => {
    (cat.receipts ?? []).forEach((r) => {
      receipts.push({
        category: cat.category,
        fileName: r.fileName,
        fileSize: r.fileSize,
        uploadedAt: r.uploadedAt instanceof Date ? r.uploadedAt.toISOString() : String(r.uploadedAt),
      });
    });
  });

  return (
    <div className="space-y-6 leading-relaxed">
      <h2 className="text-xl font-bold text-slate-900">증빙자료 (Evidence & Integrity)</h2>
      <p className="text-base text-slate-600">
        첨부된 고지서·영수증 목록 및 무결성 검증(Hash Verification) 결과를 확인합니다.
      </p>

      {/* Hash Verification 안내 */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="text-base font-semibold text-slate-800 mb-2">Integrity Check</p>
        <p className="text-sm text-slate-600">
          각 증빙 파일 옆 "Integrity Check" 버튼으로 현재 파일 해시와 업로드 당시 해시를 비교할 수 있습니다.
          Phase 2에서 evidence_files SHA-256 저장 및 검증 API 연동 예정입니다.
        </p>
      </div>

      {/* 첨부 목록 */}
      <section>
        <h3 className="text-base font-semibold text-slate-800 mb-2">첨부된 증빙 파일</h3>
        {receipts.length === 0 ? (
          <p className="text-sm text-slate-600">첨부된 증빙 파일이 없습니다.</p>
        ) : (
          <ul className="space-y-2">
            {receipts.map((r, i) => (
              <li key={i} className="flex items-center justify-between rounded border border-slate-200 bg-white px-3 py-2 text-base">
                <span className="flex items-center gap-2">
                  <FileCheck className="h-4 w-4 stroke-[1.5] text-slate-400" />
                  {r.fileName}
                </span>
                <span className="text-sm text-slate-600">
                  {r.category} · {(r.fileSize / 1024).toFixed(1)} KB
                </span>
                <button
                  type="button"
                  className="text-sm text-slate-600 hover:text-slate-800"
                  title="Phase 2 연동 예정"
                >
                  Integrity Check
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

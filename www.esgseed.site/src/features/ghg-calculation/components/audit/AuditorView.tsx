'use client';

import { useState } from 'react';
import { Copy, Link2 } from 'lucide-react';

/** GHG_AUDIT_TAB_DESIGN_v2 §4.6: 감사인 전용 뷰 — 읽기 전용 링크 생성 */

export function AuditorView() {
  const [scope, setScope] = useState<'full' | 'scope1' | 'facility'>('full');
  const [days, setDays] = useState(30);
  const [includeChecklist, setIncludeChecklist] = useState(true);
  const [includeLineage, setIncludeLineage] = useState(true);
  const [includeManualAdj, setIncludeManualAdj] = useState(true);
  const [includeFactors, setIncludeFactors] = useState(true);
  const [includeSourceDetail, setIncludeSourceDetail] = useState(false);
  const [link, setLink] = useState<string | null>(null);

  const handleGenerate = () => {
    const id = Math.random().toString(36).slice(2, 12);
    setLink(`https://ifrsseed.com/audit/share/${id}`);
  };

  const handleCopy = () => {
    if (link) navigator.clipboard.writeText(link);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-slate-900">감사인 전용 뷰</h2>
      <p className="text-base text-slate-600">
        감사인 전용 읽기 전용 링크를 생성하여 공유합니다.
      </p>

      <div className="rounded-lg border border-slate-200 bg-white p-6 space-y-6 max-w-xl">
        <div>
          <p className="text-sm font-semibold text-slate-700 mb-2">공유 범위</p>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" checked={scope === 'full'} onChange={() => setScope('full')} className="rounded" />
              <span>전체</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" checked={scope === 'scope1'} onChange={() => setScope('scope1')} className="rounded" />
              <span>Scope 1만</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" checked={scope === 'facility'} onChange={() => setScope('facility')} className="rounded" />
              <span>사업장 선택</span>
            </label>
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold text-slate-700 mb-2">유효 기간</p>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="border border-slate-200 rounded px-3 py-2 text-sm"
          >
            <option value={7}>7일</option>
            <option value={14}>14일</option>
            <option value={30}>30일</option>
            <option value={60}>60일</option>
          </select>
        </div>

        <div>
          <p className="text-sm font-semibold text-slate-700 mb-2">포함 내용</p>
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={includeChecklist} onChange={(e) => setIncludeChecklist(e.target.checked)} />
              <span>요건 체크리스트</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={includeLineage} onChange={(e) => setIncludeLineage(e.target.checked)} />
              <span>계보 드릴다운</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={includeManualAdj} onChange={(e) => setIncludeManualAdj(e.target.checked)} />
              <span>수동 조정 이력</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={includeFactors} onChange={(e) => setIncludeFactors(e.target.checked)} />
              <span>배출계수 내역</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={includeSourceDetail} onChange={(e) => setIncludeSourceDetail(e.target.checked)} />
              <span>원천 레코드 상세</span>
            </label>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          <button
            type="button"
            onClick={handleGenerate}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white font-medium text-sm hover:bg-primary/90"
          >
            <Link2 className="h-4 w-4" />
            링크 생성
          </button>
          {link && (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-sm text-slate-600 truncate flex-1">링크: {link}</span>
              <button
                type="button"
                onClick={handleCopy}
                className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded border border-slate-200 text-sm hover:bg-slate-50"
              >
                <Copy className="h-3.5 w-3.5" />
                복사
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

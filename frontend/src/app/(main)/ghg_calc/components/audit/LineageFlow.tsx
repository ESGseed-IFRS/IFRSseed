'use client';

import { Fragment, useState } from 'react';
import { ArrowRight } from 'lucide-react';

/** AuditTrail_clean.jsx — Data Lineage 플로우 (노드 클릭 시 상세) */
export function LineageFlow({
  nodes,
  details,
}: {
  nodes: string[];
  details?: string[];
}) {
  const [sel, setSel] = useState<number | null>(null);

  if (!nodes?.length) {
    return <p className="text-xs text-slate-400">계보 정보 없음</p>;
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1">
        {nodes.map((node, i) => (
          <Fragment key={`${node}-${i}`}>
            <button
              type="button"
              onClick={() => setSel(sel === i ? null : i)}
              className={`rounded border px-2.5 py-1 text-[11px] transition-colors ${
                sel === i
                  ? 'border-[#1A5FA8] bg-[#EBF4FF] font-semibold text-[#1A5FA8]'
                  : i === nodes.length - 1
                    ? 'border-[#93C5FD] bg-slate-50 font-bold text-[#1A5FA8]'
                    : 'border-slate-200 bg-white text-slate-600'
              }`}
            >
              {node}
            </button>
            {i < nodes.length - 1 && <ArrowRight size={12} className="shrink-0 text-slate-300" aria-hidden />}
          </Fragment>
        ))}
      </div>
      {sel !== null && details?.[sel] && (
        <div className="mt-2.5 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-600">
          {details[sel]}
        </div>
      )}
    </div>
  );
}

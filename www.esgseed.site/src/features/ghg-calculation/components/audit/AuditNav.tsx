'use client';

/** GHG_AUDIT_TAB_DESIGN_v2: 새 사이드 메뉴 구조 */

export type AuditSubMenu =
  | 'checklist'
  | 'lineage'
  | 'manual-adjustments'
  | 'emission-factors'
  | 'data-quality'
  | 'version-history'
  | 'auditor'
  | 'export';

const NAV_ITEMS: { id: AuditSubMenu; label: string }[] = [
  { id: 'checklist', label: '요건 체크리스트' },
  { id: 'lineage', label: '데이터 계보 추적' },
  { id: 'manual-adjustments', label: '수동 조정 이력' },
  { id: 'emission-factors', label: '배출계수 적용 내역' },
  { id: 'data-quality', label: '데이터 품질 분포' },
  { id: 'version-history', label: '산정 버전 히스토리' },
  { id: 'auditor', label: '감사인 전용 뷰' },
  { id: 'export', label: '증빙 패키지 내보내기' },
];

export interface AuditNavProps {
  activeMenu: AuditSubMenu;
  onSelect: (menu: AuditSubMenu) => void;
}

export function AuditNav({ activeMenu, onSelect }: AuditNavProps) {
  return (
    <nav
      className="w-64 shrink-0 flex flex-col rounded-lg border border-slate-700 bg-slate-800 overflow-hidden"
      aria-label="감사대응 메뉴"
    >
      <div className="text-slate-400 uppercase tracking-widest text-sm font-semibold px-4 py-3 border-b border-slate-700">
        감사·검증 대응
      </div>
      <ul className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const isActive = activeMenu === item.id;
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onSelect(item.id)}
                className={`w-full text-left px-3 py-2.5 rounded-md text-base transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${
                  isActive
                    ? 'bg-slate-600 text-white font-medium'
                    : 'text-slate-200 hover:bg-slate-700 hover:text-white'
                }`}
              >
                {item.label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

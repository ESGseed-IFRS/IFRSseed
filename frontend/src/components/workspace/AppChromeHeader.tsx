'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sprout } from 'lucide-react';
import { useWorkspacePerspective } from '@/components/workspace/WorkspacePerspectiveContext';
import { isHoldingCompany, isSubsidiaryLikeCompany, useAuthSessionStore } from '@/store/authSessionStore';

function moduleTitle(pathname: string): string {
  if (pathname.startsWith('/dashboard')) return '대시보드';
  if (pathname.startsWith('/sr-report')) return 'SR 보고서';
  if (pathname.startsWith('/ghg_calc')) return 'GHG 산정';
  return 'IFRSseed';
}

export function AppChromeHeader() {
  const pathname = usePathname() ?? '/';
  const { perspective, setPerspective } = useWorkspacePerspective();
  const user = useAuthSessionStore((s) => s.user);
  const lockSubsidiary = isSubsidiaryLikeCompany(user);
  const lockHolding = isHoldingCompany(user);
  const title = moduleTitle(pathname);

  return (
    <header className="flex h-[52px] shrink-0 items-center gap-4 border-b border-border bg-white px-4 shadow-sm">
      <Link href="/" className="flex shrink-0 items-center gap-2 text-primary">
        <Sprout className="h-7 w-7 text-secondary leaf-sway" aria-hidden />
        <span className="text-lg font-bold tracking-tight">IFRSseed</span>
      </Link>

      <span className="hidden text-muted-foreground sm:inline" aria-hidden>
        /
      </span>
      <span className="hidden text-sm font-semibold text-foreground sm:inline">{title}</span>

      <div className="flex-1" />

      {lockSubsidiary ? (
        <span
          className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-4 py-1.5 text-xs font-semibold text-slate-600"
          title="소속 회사 유형에 따라 단일 법인 관점만 사용할 수 있습니다."
        >
          계열사·종속
        </span>
      ) : lockHolding ? (
        <span
          className="shrink-0 rounded-full border border-indigo-200 bg-indigo-50 px-4 py-1.5 text-xs font-semibold text-indigo-800"
          title="지주사 계정은 그룹 통합 관점만 사용할 수 있습니다."
        >
          지주사
        </span>
      ) : (
        <div
          className="inline-flex shrink-0 rounded-full p-0.5"
          style={{ background: '#e5e7eb', boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)' }}
          role="group"
          aria-label="관점 전환"
        >
          {(['subsidiary', 'holding'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setPerspective(m)}
              className="relative rounded-full px-4 py-1.5 text-xs font-semibold transition-all duration-200 sm:px-5 sm:text-sm"
              style={{
                color: perspective === m ? '#1d4ed8' : '#9ca3af',
                background: perspective === m ? 'white' : 'transparent',
                boxShadow: perspective === m ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              {m === 'subsidiary' ? '계열사' : '지주사'}
            </button>
          ))}
        </div>
      )}
    </header>
  );
}

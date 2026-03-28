'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Calculator, FileText, LayoutDashboard } from 'lucide-react';

/** 순서: 대시보드 → GHG 산정 → SR 보고서 (아이콘만으로 구분 어려울 수 있어 짧은 라벨 병기) */
const MODULES = [
  { href: '/dashboard', label: '대시보드', railCaption: '대시보드', Icon: LayoutDashboard },
  { href: '/ghg_calc', label: 'GHG 산정', railCaption: 'GHG\n산정', Icon: Calculator },
  { href: '/sr-report', label: 'SR 보고서', railCaption: 'SR\n보고서', Icon: FileText },
] as const;

function activeFor(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === '/dashboard' || pathname.startsWith('/dashboard/');
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppModuleRail() {
  const pathname = usePathname() ?? '/';

  return (
    <aside
      className="flex w-[66px] shrink-0 flex-col items-stretch gap-1.5 border-r border-white/10 px-1.5 py-3"
      style={{ background: 'linear-gradient(180deg, #0B3A6B 0%, #082a52 100%)' }}
      aria-label="모듈 전환"
    >
      {MODULES.map(({ href, label, railCaption, Icon }) => {
        const active = activeFor(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            title={label}
            aria-label={label}
            aria-current={active ? 'page' : undefined}
            className={[
              'flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-lg px-0.5 py-1.5 transition-colors',
              active
                ? 'bg-white/15 text-white shadow-inner'
                : 'text-white/75 hover:bg-white/10 hover:text-white',
            ].join(' ')}
          >
            <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.85} aria-hidden />
            <span
              className="w-full whitespace-pre-line text-center text-[9px] font-semibold leading-[1.2] tracking-tight"
              style={{ wordBreak: 'keep-all' }}
            >
              {railCaption}
            </span>
          </Link>
        );
      })}
    </aside>
  );
}

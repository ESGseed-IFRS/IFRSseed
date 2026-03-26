'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Calculator, FileText, LayoutDashboard } from 'lucide-react';

const MODULES = [
  { href: '/dashboard', label: '대시보드', Icon: LayoutDashboard },
  { href: '/sr-report', label: 'SR 보고서', Icon: FileText },
  { href: '/ghg_calc', label: 'GHG 산정', Icon: Calculator },
] as const;

function activeFor(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === '/dashboard' || pathname.startsWith('/dashboard/');
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppModuleRail() {
  const pathname = usePathname() ?? '/';

  return (
    <aside
      className="flex w-[52px] shrink-0 flex-col items-center gap-1 border-r border-white/10 py-3"
      style={{ background: 'linear-gradient(180deg, #0B3A6B 0%, #082a52 100%)' }}
      aria-label="모듈 전환"
    >
      {MODULES.map(({ href, label, Icon }) => {
        const active = activeFor(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            title={label}
            aria-label={label}
            aria-current={active ? 'page' : undefined}
            className={[
              'flex h-11 w-11 items-center justify-center rounded-lg transition-colors',
              active
                ? 'bg-white/15 text-white shadow-inner'
                : 'text-white/70 hover:bg-white/10 hover:text-white',
            ].join(' ')}
          >
            <Icon className="h-5 w-5" strokeWidth={1.75} />
          </Link>
        );
      })}
    </aside>
  );
}

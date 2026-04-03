'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { AUTH_USER_SESSION_KEY, useAuthSessionStore } from '@/store/authSessionStore';
import { Sprout, User, LogOut } from 'lucide-react';

function pathActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function HomeNavigation() {
  const pathname = usePathname() ?? '/';
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);

  useEffect(() => {
    const storedUser = sessionStorage.getItem(AUTH_USER_SESSION_KEY);
    if (!storedUser) return;
    try {
      setUser(JSON.parse(storedUser));
    } catch {
      /* ignore */
    }
  }, []);

  const handleLogout = () => {
    sessionStorage.removeItem('accessToken');
    useAuthSessionStore.getState().clearAuth();
    window.location.reload();
  };

  const centerLinks: { href: string; label: string }[] = [
    { href: '/', label: '홈' },
    { href: '/dashboard', label: '대시보드' },
    { href: '/ghg_calc', label: 'GHG 산정' },
    { href: '/sr-report', label: 'SR 보고서' },
  ];

  return (
    <nav className="fixed left-0 right-0 top-0 z-50 border-b border-border bg-white shadow-sm">
      <div className="relative mx-auto flex h-16 max-w-[1400px] items-center px-4 sm:px-6 lg:px-8">
        <Link href="/" className="relative z-10 flex shrink-0 items-center gap-2.5 text-primary">
          <Sprout className="h-8 w-8 text-secondary leaf-sway" aria-hidden />
          <span className="text-xl font-bold tracking-tight">IFRSseed</span>
        </Link>

        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <ul className="pointer-events-auto flex items-center gap-1 sm:gap-2">
            {centerLinks.map(({ href, label }) => {
              const active = pathActive(pathname, href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    className={[
                      'block rounded-md px-3 py-2 text-sm font-semibold transition-colors sm:px-4 sm:text-[15px]',
                      active
                        ? 'text-primary underline decoration-2 underline-offset-8'
                        : 'text-foreground/80 hover:text-primary',
                    ].join(' ')}
                  >
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="relative z-10 ml-auto flex shrink-0 items-center gap-2">
          {!user && (
            <Button variant="ghost" asChild className="font-medium text-muted-foreground hover:text-primary">
              <Link href="/login">로그인</Link>
            </Button>
          )}
          {user && (
            <>
              <div className="hidden items-center gap-2 border-l border-border pl-3 text-sm text-muted-foreground sm:flex">
                <User className="h-4 w-4 shrink-0" aria-hidden />
                <span className="max-w-[140px] truncate font-medium">{user.name || user.email}</span>
              </div>
              <Button
                variant="ghost"
                onClick={handleLogout}
                className="font-medium text-muted-foreground hover:text-primary"
              >
                <LogOut className="mr-1.5 h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">로그아웃</span>
              </Button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

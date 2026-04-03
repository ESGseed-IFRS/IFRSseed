'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { HomeNavigation } from '@/components/HomeNavigation';
import { Navigation } from '@/components/Navigation';
import { AUTH_USER_SESSION_KEY } from '@/store/authSessionStore';

function isWorkspacePath(path: string) {
  return (
    path === '/dashboard' ||
    path.startsWith('/dashboard/') ||
    path === '/sr-report' ||
    path.startsWith('/sr-report/') ||
    path === '/ghg_calc' ||
    path.startsWith('/ghg_calc/')
  );
}

export function AppLayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '/';
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);

  useEffect(() => {
    const storedUser = sessionStorage.getItem(AUTH_USER_SESSION_KEY);
    if (!storedUser) return;
    try {
      setUser(JSON.parse(storedUser));
    } catch {
      // ignore
    }
  }, []);

  const hideChrome = pathname === '/login' || pathname === '/register';

  if (hideChrome) {
    return <>{children}</>;
  }

  if (isWorkspacePath(pathname)) {
    return <>{children}</>;
  }

  if (pathname === '/') {
    return (
      <div className="min-h-screen bg-background">
        <HomeNavigation />
        <main className="pt-16">{children}</main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation user={user} />
      <main className="pt-16">{children}</main>
    </div>
  );
}

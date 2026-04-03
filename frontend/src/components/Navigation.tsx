'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useAuthSessionStore } from '@/store/authSessionStore';
import { Sprout, LogIn, User, LogOut, LayoutDashboard, Calculator, FileText } from 'lucide-react';

interface NavigationProps {
  user?: { name: string; email: string } | null;
}

function pathActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Navigation({ user }: NavigationProps) {
  const pathname = usePathname() ?? '/';

  const handleLogout = () => {
    sessionStorage.removeItem('accessToken');
    useAuthSessionStore.getState().clearAuth();
    window.location.reload();
  };

  const items: {
    href: string;
    label: string;
    icon: typeof Sprout;
    hideWhenUser?: boolean;
  }[] = [
    { href: '/', label: '홈', icon: Sprout },
    { href: '/dashboard', label: '대시보드', icon: LayoutDashboard },
    { href: '/ghg_calc', label: 'GHG 산정', icon: Calculator },
    { href: '/sr-report', label: 'SR 보고서', icon: FileText },
    { href: '/login', label: '로그인', icon: LogIn, hideWhenUser: true },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-border shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center space-x-3">
            <div className="relative">
              <Sprout className="h-8 w-8 text-secondary leaf-sway" />
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-accent rounded-full animate-pulse" />
            </div>
            <h1 className="text-2xl font-bold text-primary">IFRSseed</h1>
          </Link>

          <div className="flex items-center space-x-1 flex-wrap justify-end gap-y-1">
            {items.map((tab) => {
              if (tab.hideWhenUser && user) return null;
              const Icon = tab.icon;
              const isActive = pathActive(pathname, tab.href);
              return (
                <Button
                  key={tab.href}
                  variant={isActive ? 'default' : 'ghost'}
                  asChild
                  className={`
                    flex items-center space-x-2 px-3 py-2 rounded-lg transition-all duration-300
                    ${isActive
                      ? 'bg-primary text-primary-foreground shadow-seed'
                      : 'text-muted-foreground hover:text-primary hover:bg-seed-light/20'
                    }
                  `}
                >
                  <Link href={tab.href}>
                    <Icon className={`h-4 w-4 ${isActive ? 'seed-grow' : ''}`} />
                    <span className="font-medium">{tab.label}</span>
                  </Link>
                </Button>
              );
            })}

            {user && (
              <>
                <div className="flex items-center space-x-2 px-4 py-2 text-muted-foreground border-l border-border ml-2">
                  <User className="h-4 w-4" />
                  <span className="font-medium">{user.name || user.email}</span>
                </div>
                <Button
                  variant="ghost"
                  onClick={handleLogout}
                  className="flex items-center space-x-2 px-4 py-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-seed-light/20"
                >
                  <LogOut className="h-4 w-4" />
                  <span className="font-medium">로그아웃</span>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

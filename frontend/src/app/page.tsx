'use client';

import { useRouter } from 'next/navigation';
import { HomePage } from '@/components/HomePage';

export default function Home() {
  const router = useRouter();

  return (
    <HomePage
      onNavigate={(tab) => {
        if (tab === 'login') {
          router.push('/login');
          return;
        }
        const routes: Record<string, string> = {
          company: '/dashboard',
          content: '/sr-report',
          charts: '/ghg_calc',
          cdp: '/sr-report',
          ghg: '/ghg_calc',
          report: '/sr-report',
        };
        const path = routes[tab];
        if (path) router.push(path);
      }}
    />
  );
}

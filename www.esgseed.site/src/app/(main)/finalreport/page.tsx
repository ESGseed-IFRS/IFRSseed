'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** DASHBOARD_STRATEGY: /finalreport → /dashboard 리다이렉트 (기존 링크 호환) */
export default function FinalReportRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard');
  }, [router]);
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <p className="text-muted-foreground">대시보드로 이동 중...</p>
    </div>
  );
}

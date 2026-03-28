import { Suspense } from 'react';
import { SrReportPageClient } from './SrReportPageClient';

export default function SrReportPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[240px] flex items-center justify-center text-sm text-muted-foreground">
          SR 보고서를 불러오는 중…
        </div>
      }
    >
      <SrReportPageClient />
    </Suspense>
  );
}

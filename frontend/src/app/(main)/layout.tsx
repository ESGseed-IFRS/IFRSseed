import { Suspense } from 'react';
import { MainWorkspaceClient } from '@/components/workspace/MainWorkspaceClient';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex h-[100dvh] items-center justify-center bg-[#eef1f5] text-sm text-muted-foreground">
          작업 화면을 불러오는 중…
        </div>
      }
    >
      <MainWorkspaceClient>{children}</MainWorkspaceClient>
    </Suspense>
  );
}

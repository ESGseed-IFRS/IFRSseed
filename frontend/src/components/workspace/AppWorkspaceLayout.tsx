'use client';

import type { ReactNode } from 'react';
import { AppChromeHeader } from '@/components/workspace/AppChromeHeader';
import { AppModuleRail } from '@/components/workspace/AppModuleRail';

export function AppWorkspaceLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-[#eef1f5]">
      <AppModuleRail />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <AppChromeHeader />
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
